'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';

import { useAuthContext } from 'src/auth/hooks';

import { signOut } from './action';
import { getSessionExpiresAt } from './utils';

// ----------------------------------------------------------------------

// เพดานอายุเซสชันรวม 8 ชม. คำนวณและบังคับจริงฝั่ง server เสมอ (ดู auth.controller.js
// #sessionExpiresAtOf + authenticate.js) — component นี้แค่ "เฝ้าดู" เวลาที่ server บอกไว้
// (sessionStorage, อัปเดตทุกครั้งที่ login/checkUserSession/silent refresh) แล้วเตือน + auto
// logout ให้ตรงเวลาแบบ client-side เท่านั้น ต่อให้ popup/timer ฝั่งนี้พลาดด้วยเหตุผลใดก็ตาม
// (แท็บถูกปิดค้าง เครื่อง sleep) request ถัดไปก็จะโดน 401 SESSION_EXPIRED จาก server อยู่ดี
// เช็คทุก 1 วิ — เบามากและทำให้ countdown ในป๊อปอัพนับได้ลื่นไม่ต้องสลับ interval ไปมา
const CHECK_INTERVAL_MS = 1000;
const WARNING_LEAD_MS = 5 * 60 * 1000; // เตือนล่วงหน้า 5 นาทีก่อนหมดเวลา

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function SessionTimeoutWatcher() {
  const { checkUserSession } = useAuthContext();

  const [remainingMs, setRemainingMs] = useState(null); // null = ยังไม่เข้าช่วงเตือน
  const loggingOutRef = useRef(false);

  const handleForceLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try {
      await signOut();
    } finally {
      await checkUserSession?.();
    }
  }, [checkUserSession]);

  useEffect(() => {
    const tick = () => {
      if (loggingOutRef.current) return;

      const expiresAtRaw = getSessionExpiresAt();
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
    return () => clearInterval(interval);
  }, [handleForceLogout]);

  const open = remainingMs !== null;

  return (
    <Dialog open={open} disableEscapeKeyDown maxWidth="xs" fullWidth>
      <DialogTitle>เซสชันใกล้หมดอายุ</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2">
          เพื่อความปลอดภัย ระบบจะให้ออกจากระบบอัตโนมัติเมื่อครบ 8 ชั่วโมงนับจากเข้าสู่ระบบ
          กรุณาบันทึกงานที่ทำค้างไว้ก่อน
        </Typography>
        <Typography variant="h3" sx={{ textAlign: 'center' }}>
          {open ? formatCountdown(remainingMs) : '0:00'}
        </Typography>
        <LinearProgress
          variant="determinate"
          color="warning"
          value={open ? Math.min(100, (remainingMs / WARNING_LEAD_MS) * 100) : 0}
          sx={{ height: 6, borderRadius: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="error" onClick={handleForceLogout}>
          ออกจากระบบตอนนี้
        </Button>
      </DialogActions>
    </Dialog>
  );
}
