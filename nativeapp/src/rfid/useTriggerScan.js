import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';

import { getSelectedDeviceId, NONE_DEVICE_ID } from './deviceSettings';
import { useRfidReader } from './useRfidReader';

// รอสแกนแบบ "เหนี่ยวปุ่มไกที่ตัวเครื่อง" ให้เหมือนกันทุกหน้า เรียก onEpc(epc) ทุกครั้งที่ได้แท็ก
// ระหว่างเหนี่ยวไก และคืน triggerActive ไว้ให้จอโชว์ว่ากำลังกดปุ่ม
//
//  - Orca 50: ไม่มี event ปุ่มไก — อาศัย firmware trigger (setTrigger(true)) เป็นตัวเริ่ม/หยุด
//    inventory แอปแค่ฟัง TagEvent แล้วเดา "ปล่อยไก" จากการเงียบไป RELEASE_MS หลังแท็กสุดท้าย
//  - SEUIC UTouch 2: มี TriggerDown/TriggerUp จริง — สั่ง startRead()/stopRead() รอบ ๆ ตรง ๆ
//    triggerActive มาจาก event ไม่ใช่การเดา
//
// onEpc อ้างผ่าน ref เสมอ → ส่ง inline closure ที่ปิดทับ state ล่าสุดเข้ามาได้โดยไม่ต้อง useCallback
const RELEASE_MS = 700;

export function useTriggerScan({ onEpc, enabled = true } = {}) {
  const isFocused = useIsFocused();
  const [rfidDeviceId, setRfidDeviceId] = useState(NONE_DEVICE_ID);
  const [triggerActive, setTriggerActive] = useState(false);
  const releaseTimer = useRef(null);
  const onEpcRef = useRef(onEpc);
  onEpcRef.current = onEpc;

  const hasRfidDevice = rfidDeviceId !== NONE_DEVICE_ID;
  const {
    status,
    errorMessage,
    hasTriggerEvents,
    listenTags,
    listenTrigger,
    startRead,
    stopRead,
    cleanBuffer,
  } = useRfidReader({
    enabled: hasRfidDevice && enabled,
    deviceId: rfidDeviceId,
  });

  useEffect(() => {
    getSelectedDeviceId().then(setRfidDeviceId);
  }, []);

  const listening = hasRfidDevice && enabled && isFocused && status === 'connected';
  useEffect(() => {
    if (!listening) return undefined;

    const onTag = (epc) => {
      if (!hasTriggerEvents) {
        // Orca: มีแท็กเข้ามา = กำลังเหนี่ยวไกอยู่ ต่ออายุตัวจับเวลา "ปล่อยไก" ทุกครั้งที่ได้แท็ก
        setTriggerActive(true);
        clearTimeout(releaseTimer.current);
        releaseTimer.current = setTimeout(() => {
          setTriggerActive(false);
          cleanBuffer(); // ปล่อยไกแล้วล้าง buffer ให้เหนี่ยวซ้ำแท็กเดิมได้อีก
        }, RELEASE_MS);
      }
      onEpcRef.current?.(epc);
    };
    const unlistenTags = listenTags(onTag);

    // SEUIC: ผูก event ปุ่มไกจริง — กดไก = เริ่ม inventory, ปล่อย = หยุด + ล้าง buffer
    let unlistenTrigger;
    if (hasTriggerEvents) {
      unlistenTrigger = listenTrigger(
        () => {
          setTriggerActive(true);
          startRead();
        },
        () => {
          setTriggerActive(false);
          stopRead();
          cleanBuffer();
        }
      );
    }

    return () => {
      clearTimeout(releaseTimer.current);
      setTriggerActive(false);
      if (unlistenTags) unlistenTags();
      if (unlistenTrigger) unlistenTrigger();
    };
  }, [
    listening,
    hasTriggerEvents,
    listenTags,
    listenTrigger,
    startRead,
    stopRead,
    cleanBuffer,
  ]);

  return {
    hasRfidDevice,
    rfidStatus: status,
    rfidErrorMessage: errorMessage,
    triggerActive,
  };
}
