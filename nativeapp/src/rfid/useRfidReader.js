import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { getReaderPower, getSelectedDeviceId, NONE_DEVICE_ID } from './deviceSettings';
import { getDriver } from './drivers';

// Hook คุมเครื่องอ่าน RFID ในตัวเครื่อง (Orca 50 หรือ SEUIC UTouch 2) — เลือก driver จาก device id
// ที่ผู้ใช้ตั้งไว้ในหน้า "ตั้งค่าเครื่อง" แล้ว expose API เดียวกันไม่ว่าจะเครื่องไหน
//
//  - "single read": SDK ทั้งคู่ (ในทางที่เราใช้) ไม่มี primitive ตรง ๆ — startRead() แล้วหยุดที่
//    tag แรกเอง
//  - โหมด "เหนี่ยวไก": Orca อาศัย firmware trigger + listenTags อย่างเดียว / SEUIC ใช้
//    listenTrigger (TriggerDown/Up จริง) + startRead()/stopRead() — ดู useTriggerScan.js
const SINGLE_READ_TIMEOUT_MS = 10000;

export function useRfidReader({ enabled, deviceId }) {
  const [resolvedId, setResolvedId] = useState(deviceId ?? NONE_DEVICE_ID);
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error
  const [errorMessage, setErrorMessage] = useState('');
  const bulkListenerRef = useRef(null);

  useEffect(() => {
    if (deviceId !== undefined) {
      setResolvedId(deviceId);
      return;
    }
    getSelectedDeviceId().then(setResolvedId);
  }, [deviceId]);

  const driver = useMemo(() => getDriver(resolvedId), [resolvedId]);
  const hasRfidDevice = resolvedId !== NONE_DEVICE_ID;
  const active = enabled && hasRfidDevice && Platform.OS === 'android';

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const { scanner } = driver;
    let cancelled = false;
    setStatus('connecting');
    scanner
      .connect()
      .then((ok) => {
        if (cancelled) return;
        setStatus(ok ? 'connected' : 'error');
        if (!ok) {
          setErrorMessage('เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ');
          return;
        }
        // ตั้งกำลังส่งเสาอากาศตามค่าที่ผู้ใช้ตั้งไว้ (แยกช่วงตามรุ่นเครื่อง) แก้ปัญหาสัญญาณอ่อน
        getReaderPower(resolvedId)
          .then((power) => {
            if (cancelled) return;
            try {
              scanner.setAntennaPower(String(power));
            } catch {
              // เพิกเฉย — เครื่องที่ไม่ใช่ handheld ตัวจริงอาจ throw จาก native lib
            }
          })
          .catch(() => {});
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(err?.message || 'เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ');
      });

    return () => {
      cancelled = true;
      if (bulkListenerRef.current) {
        bulkListenerRef.current();
        bulkListenerRef.current = null;
      }
      scanner.disconnect();
      setStatus('idle');
    };
  }, [active, driver, resolvedId]);

  const singleRead = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (status !== 'connected') {
          reject(new Error('เครื่องอ่าน RFID ยังไม่พร้อม'));
          return;
        }

        const { scanner, event } = driver;
        let settled = false;
        const onTag = (epc) => {
          if (settled) return;
          settled = true;
          scanner.removeon(event.Tag, onTag);
          scanner.stopRead();
          resolve(epc);
        };

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          scanner.removeon(event.Tag, onTag);
          scanner.stopRead();
          reject(new Error('ไม่พบ RFID Tag ในระยะเวลาที่กำหนด'));
        }, SINGLE_READ_TIMEOUT_MS);

        scanner.on(event.Tag, (epc) => {
          clearTimeout(timer);
          onTag(epc);
        });
        scanner.cleanTagBuffer();
        scanner.startRead();
      }),
    [driver, status]
  );

  const startBulkRead = useCallback(
    (onTag) => {
      if (status !== 'connected') return;
      const { scanner, event } = driver;
      scanner.cleanTagBuffer();
      scanner.on(event.Tag, onTag);
      bulkListenerRef.current = () => scanner.removeon(event.Tag, onTag);
      scanner.startRead();
    },
    [driver, status]
  );

  const stopBulkRead = useCallback(() => {
    driver.scanner.stopRead();
    if (bulkListenerRef.current) {
      bulkListenerRef.current();
      bulkListenerRef.current = null;
    }
  }, [driver]);

  // โหมด "เหนี่ยวไก" — ผูก listener รับ TagEvent ที่ไหลเข้ามา คืน cleanup function สำหรับถอด
  const listenTags = useCallback(
    (onTag) => {
      if (status !== 'connected') return undefined;
      const { scanner, event } = driver;
      scanner.cleanTagBuffer();
      scanner.on(event.Tag, onTag);
      bulkListenerRef.current = () => scanner.removeon(event.Tag, onTag);
      return () => {
        scanner.removeon(event.Tag, onTag);
        bulkListenerRef.current = null;
      };
    },
    [driver, status]
  );

  // event ปุ่มไกจริง (SEUIC เท่านั้น) — onDown/onUp ถูกเรียกตอนกด/ปล่อยไกด้ามปืน คืน cleanup
  const listenTrigger = useCallback(
    (onDown, onUp) => {
      if (!driver.hasTriggerEvents || status !== 'connected') return undefined;
      const { scanner, event } = driver;
      const down = () => onDown?.();
      const up = () => onUp?.();
      scanner.on(event.TriggerDown, down);
      scanner.on(event.TriggerUp, up);
      return () => {
        scanner.removeon(event.TriggerDown, down);
        scanner.removeon(event.TriggerUp, up);
      };
    },
    [driver, status]
  );

  // สั่งเริ่ม/หยุด inventory ตรง ๆ — SEUIC ใช้คู่กับ listenTrigger (Orca อาศัย firmware ไม่ต้องเรียก)
  const startRead = useCallback(() => {
    if (status !== 'connected') return;
    const { scanner } = driver;
    scanner.cleanTagBuffer();
    scanner.startRead();
  }, [driver, status]);

  const stopRead = useCallback(() => {
    driver.scanner.stopRead();
  }, [driver]);

  // ล้าง buffer กันอ่านซ้ำ — เรียกหลังปล่อยไก เพื่อให้เหนี่ยวไกซ้ำแล้วอ่านแท็กเดิมได้อีก
  const cleanBuffer = useCallback(() => {
    driver.scanner.cleanTagBuffer();
  }, [driver]);

  // ปรับกำลังส่งเสาอากาศสด ๆ ระหว่างเชื่อมต่ออยู่ (dBm) — ให้หน้า "ตั้งค่าเครื่อง" เรียกตอนเลื่อนค่า
  const applyPower = useCallback(
    (power) => {
      if (status !== 'connected') return;
      try {
        driver.scanner.setAntennaPower(String(power));
      } catch {
        // เพิกเฉย
      }
    },
    [driver, status]
  );

  return {
    status,
    errorMessage,
    hasTriggerEvents: driver.hasTriggerEvents,
    singleRead,
    startBulkRead,
    stopBulkRead,
    listenTags,
    listenTrigger,
    startRead,
    stopRead,
    cleanBuffer,
    applyPower,
  };
}
