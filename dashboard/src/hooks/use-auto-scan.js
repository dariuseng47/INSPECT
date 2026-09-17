import { useRef, useState, useEffect, useCallback } from 'react';

import { scanCheckpoint } from 'src/actions/rfidReader';

import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------

// อ่าน RFID แบบต่อเนื่อง: ยิง scanCheckpoint ซ้ำติดกันจนกว่าจะกดหยุด แต่ละรอบที่เจอ EPC จะส่งเข้า
// onTags ทันที (ให้ผู้เรียกเอาไปรวมกับรายการที่มีอยู่) — ความเร็วต่อรอบคุมจาก scan_profile ของ
// อุปกรณ์ฝั่ง backend (ตั้ง "เร็วมาก" ได้ในหน้า "อุปกรณ์ & สัญญาณ RFID")
export function useAutoScan({ hospitalId, onTags, gapMs = 100 }) {
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const deviceRef = useRef(null);
  const onTagsRef = useRef(onTags);

  useEffect(() => {
    onTagsRef.current = onTags;
  });

  const loop = useCallback(async () => {
    while (runningRef.current) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const { epcs } = await scanCheckpoint(Number(deviceRef.current), hospitalId);
        if (runningRef.current && epcs.length) onTagsRef.current(epcs);
      } catch (error) {
        runningRef.current = false;
        setRunning(false);
        toast.error(error?.message || 'อ่านอัตโนมัติหยุด — เชื่อมต่อเครื่องอ่านไม่สำเร็จ');
        return;
      }
      if (gapMs > 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => {
          setTimeout(r, gapMs);
        });
      }
    }
  }, [hospitalId, gapMs]);

  const start = useCallback(
    (deviceId) => {
      if (runningRef.current || !deviceId) return;
      deviceRef.current = deviceId;
      runningRef.current = true;
      setRunning(true);
      loop();
    },
    [loop]
  );

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  // หยุดวนอ่านเมื่อ component ถูก unmount
  useEffect(
    () => () => {
      runningRef.current = false;
    },
    []
  );

  return { running, start, stop };
}
