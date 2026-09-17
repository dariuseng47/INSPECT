import { useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Modal, Portal, ProgressBar } from 'react-native-paper';

import { AppButton } from '../components/AppButton';
import { brand, surface } from '../theme/colors';
import { radius } from '../theme/theme';
import { type } from '../theme/typography';
import { getSessionExpiresAt } from '../api/tokenStore';

// เพดานอายุเซสชันรวม 8 ชม. คำนวณและบังคับจริงฝั่ง server เสมอ (ดู
// server/src/controllers/auth.controller.js#sessionExpiresAtOf + middleware/authenticate.js)
// component นี้แค่ "เฝ้าดู" เวลาที่ server บอกไว้ (SecureStore, อัปเดตทุกครั้งที่ signIn/fetchMe/
// silent refresh — ดู tokenStore.js) แล้วเตือน + auto logout ให้ตรงเวลาแบบ client-side เท่านั้น
// ต่อให้ popup/timer ฝั่งนี้พลาด (แอปถูกพักไว้เบื้องหลังนาน) request ถัดไปก็จะโดน 401
// SESSION_EXPIRED จาก server อยู่ดี — เช็คทุก 1 วิ ให้ countdown นับลื่น
const CHECK_INTERVAL_MS = 1000;
const WARNING_LEAD_MS = 5 * 60 * 1000; // เตือนล่วงหน้า 5 นาทีก่อนหมดเวลา

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function SessionTimeoutModal({ onForceLogout }) {
  const [remainingMs, setRemainingMs] = useState(null); // null = ยังไม่เข้าช่วงเตือน
  const loggingOutRef = useRef(false);

  const handleForceLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    await onForceLogout();
  }, [onForceLogout]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (loggingOutRef.current || cancelled) return;

      const expiresAtRaw = await getSessionExpiresAt();
      if (cancelled) return;

      if (!expiresAtRaw) {
        setRemainingMs(null);
        return;
      }

      const remaining = new Date(expiresAtRaw).getTime() - Date.now();

      if (remaining <= 0) {
        handleForceLogout();
        return;
      }

      setRemainingMs(remaining <= WARNING_LEAD_MS ? remaining : null);
    };

    tick();
    const interval = setInterval(tick, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [handleForceLogout]);

  const visible = remainingMs !== null;

  return (
    <Portal>
      <Modal visible={visible} dismissable={false} contentContainerStyle={styles.wrap}>
        <View style={styles.card}>
          <Text style={[type.subtitle1, styles.title]}>เซสชันใกล้หมดอายุ</Text>
          <Text style={[type.body2, styles.body]}>
            เพื่อความปลอดภัย ระบบจะให้ออกจากระบบอัตโนมัติเมื่อครบ 8 ชั่วโมงนับจากเข้าสู่ระบบ
            กรุณาบันทึกงานที่ทำค้างไว้ก่อน
          </Text>
          <Text style={[type.h3, styles.countdown]}>
            {visible ? formatCountdown(remainingMs) : '0:00'}
          </Text>
          <ProgressBar
            progress={visible ? Math.min(1, remainingMs / WARNING_LEAD_MS) : 0}
            color={brand.warning.main}
            style={styles.progress}
          />
          <AppButton variant="filled" onPress={handleForceLogout} style={styles.button}>
            ออกจากระบบตอนนี้
          </AppButton>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: surface.card,
    borderRadius: radius.card,
    padding: 20,
    gap: 12,
  },
  title: {
    color: brand.grey[800],
  },
  body: {
    color: brand.grey[600],
  },
  countdown: {
    textAlign: 'center',
    color: brand.error.main,
  },
  progress: {
    height: 6,
    borderRadius: 3,
  },
  button: {
    marginTop: 4,
  },
});
