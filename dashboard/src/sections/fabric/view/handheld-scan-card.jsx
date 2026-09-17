'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';

import { useGetDevices } from 'src/actions/devices';
import {
  cancelScanSession,
  useGetScanSession,
  useGetScanSessions,
  confirmScanSession,
  triggerScanSession,
} from 'src/actions/scanSessions';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const SESSION_STATUS_LABEL = {
  PENDING: 'รอเครื่อง Handheld เริ่มสแกน',
  SCANNING: 'กำลังสแกน...',
  REPORTED: 'สแกนเสร็จแล้ว — รอตรวจสอบ',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
};

// Select แบบง่ายที่ไม่ผูกกับ react-hook-form (ใช้ state ตรงๆ เพราะฟอร์มนี้ไม่มี validation ซับซ้อน)
function TextFieldSelect({ label, value, onChange, disabled, options }) {
  return (
    <TextField
      select
      fullWidth
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function HandheldScanCard({ hospitalId, lots, categories, onConfirmed }) {
  const { devices } = useGetDevices(hospitalId, 'HANDHELD');

  // ผูกล็อต หรือระบุแค่หมวดหมู่ตรงๆ (ไม่ผูกล็อต) ก็ได้ — เหมือน register-item-card.jsx
  const [lotId, setLotId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [sessionId, setSessionId] = useState(null);

  // เลือกอุปกรณ์ handheld ที่ตั้งเป็น "ค่าเริ่มต้น" ของจุดนี้ให้อัตโนมัติ (ตั้งในหน้า "อุปกรณ์ & สัญญาณ RFID")
  useEffect(() => {
    if (deviceId) return;
    const preset = devices.find((d) =>
      (d.default_scan_points ?? []).includes('FABRIC_REGISTER_HANDHELD')
    );
    if (preset) setDeviceId(preset.id);
  }, [devices, deviceId]);
  const [triggering, setTriggering] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busyQueueId, setBusyQueueId] = useState(null);

  const { session, refreshSession } = useGetScanSession(sessionId, hospitalId);

  // session ที่ยังค้างทั้งหมดของโรงพยาบาลนี้ รวมถึงที่ trigger มาจากเครื่อง handheld เอง
  // (การ์ดนี้เดิมเห็นเฉพาะ session ที่กด trigger จากบนเว็บ — ที่มาจาก handheld เลยค้าง
  // สถานะ REPORTED ไม่มีใครกดยืนยัน ผ้าไม่เข้าคลังสักที)
  const { sessions: pendingSessions, refreshSessions } = useGetScanSessions(hospitalId);

  const handleTrigger = useCallback(async () => {
    if ((!lotId && !categoryId) || !deviceId) {
      toast.error('เลือกล็อต (หรือหมวดหมู่) และอุปกรณ์ handheld ก่อน');
      return;
    }
    setTriggering(true);
    try {
      const { session: newSession } = await triggerScanSession({
        fabricLotId: lotId ? Number(lotId) : undefined,
        fabricCategoryId: lotId ? undefined : Number(categoryId),
        deviceId: Number(deviceId),
      });
      setSessionId(newSession.id);
      toast.success('ส่งสัญญาณไปที่อุปกรณ์แล้ว — รอผลสแกนจากเครื่อง Handheld');
    } catch (error) {
      toast.error(error?.message || 'เริ่ม session ไม่สำเร็จ');
    } finally {
      setTriggering(false);
    }
  }, [lotId, categoryId, deviceId]);

  const handleConfirm = useCallback(async () => {
    setConfirming(true);
    try {
      const result = await confirmScanSession(sessionId);
      toast.success(
        `ยืนยันสำเร็จ — เพิ่มผ้าใหม่ ${result.created.length} ชิ้น${
          result.skipped.length ? ` (ข้าม ${result.skipped.length} ชิ้นที่ EPC ซ้ำ)` : ''
        }`
      );
      setSessionId(null);
      setLotId('');
      setCategoryId('');
      setDeviceId('');
      refreshSessions();
      onConfirmed();
    } catch (error) {
      toast.error(error?.message || 'ยืนยันไม่สำเร็จ');
    } finally {
      setConfirming(false);
    }
  }, [sessionId, onConfirmed, refreshSessions]);

  const handleCancel = useCallback(async () => {
    try {
      await cancelScanSession(sessionId);
      toast.success('ยกเลิก session แล้ว');
      setSessionId(null);
      refreshSession();
      refreshSessions();
    } catch (error) {
      toast.error(error?.message || 'ยกเลิกไม่สำเร็จ');
    }
  }, [sessionId, refreshSession, refreshSessions]);

  // ยืนยัน/ยกเลิก session ที่ trigger มาจากเครื่อง handheld (แสดงในคิว "รอตรวจสอบ" ด้านล่าง)
  const handleQueueConfirm = useCallback(
    async (id) => {
      setBusyQueueId(id);
      try {
        const result = await confirmScanSession(id);
        toast.success(
          `ยืนยันสำเร็จ — เพิ่มผ้าใหม่ ${result.created.length} ชิ้น${
            result.skipped.length ? ` (ข้าม ${result.skipped.length} ชิ้นที่ EPC ซ้ำ)` : ''
          }`
        );
        refreshSessions();
        onConfirmed();
      } catch (error) {
        toast.error(error?.message || 'ยืนยันไม่สำเร็จ');
      } finally {
        setBusyQueueId(null);
      }
    },
    [onConfirmed, refreshSessions]
  );

  const handleQueueCancel = useCallback(
    async (id) => {
      setBusyQueueId(id);
      try {
        await cancelScanSession(id);
        toast.success('ยกเลิก session แล้ว');
        refreshSessions();
      } catch (error) {
        toast.error(error?.message || 'ยกเลิกไม่สำเร็จ');
      } finally {
        setBusyQueueId(null);
      }
    },
    [refreshSessions]
  );

  const isSessionActive = sessionId && session && !['CONFIRMED', 'CANCELLED'].includes(session.status);

  // ตัด session ที่กำลังติดตามอยู่ด้านบน (กด trigger จากการ์ดนี้) ออกจากคิว ไม่ให้ซ้ำ
  const queue = (pendingSessions ?? []).filter((s) => s.id !== sessionId);

  return (
    <Card>
      <CardHeader
        title="สแกนเพิ่มผ้าด้วย Handheld"
        subheader="เลือกล็อต + อุปกรณ์ handheld ที่ผูกไว้ แล้วส่งสัญญาณให้เครื่องเข้าโหมดสแกน"
      />
      <CardContent>
        <Stack spacing={2.5}>
          {devices.length === 0 && (
            <Typography variant="caption" sx={{ color: 'warning.main' }}>
              ยังไม่มีอุปกรณ์ handheld ที่ผูกกับโรงพยาบาลนี้ — ต้องเพิ่มในหน้า &ldquo;อุปกรณ์ & สัญญาณ
              RFID&rdquo; ก่อน
            </Typography>
          )}

          <Stack direction="row" spacing={2}>
            <TextFieldSelect
              label="ล็อตผ้า (ถ้าไม่ผูกล็อต เลือกหมวดหมู่แทนได้)"
              value={lotId}
              onChange={(value) => {
                setLotId(value);
                if (value) setCategoryId('');
              }}
              disabled={!hospitalId || !!isSessionActive}
              options={[
                { value: '', label: 'ไม่ผูกล็อต' },
                ...lots.map((lot) => ({ value: lot.id, label: lot.lot_code })),
              ]}
            />
            <TextFieldSelect
              label="หมวดหมู่ผ้า (ถ้าไม่ผูกล็อต)"
              value={categoryId}
              onChange={setCategoryId}
              disabled={!hospitalId || !!isSessionActive || !!lotId}
              options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <TextFieldSelect
              label="อุปกรณ์ Handheld"
              value={deviceId}
              onChange={setDeviceId}
              disabled={!hospitalId || !!isSessionActive}
              options={devices.map((d) => ({
                value: d.id,
                label: `#${d.id} ${d.caretaker_name ? `(${d.caretaker_name})` : ''}`,
              }))}
            />
          </Stack>

          {!isSessionActive ? (
            <LoadingButton
              type="button"
              variant="contained"
              loading={triggering}
              disabled={!hospitalId || (!lotId && !categoryId) || !deviceId}
              onClick={handleTrigger}
              startIcon={<Iconify icon="solar:radar-2-bold-duotone" />}
            >
              เริ่มสแกน (Trigger Handheld)
            </LoadingButton>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">สถานะ:</Typography>
                <Chip
                  size="small"
                  variant="soft"
                  color={session.status === 'REPORTED' ? 'success' : 'info'}
                  label={SESSION_STATUS_LABEL[session.status] ?? session.status}
                />
              </Stack>

              {session.status === 'REPORTED' && (
                <>
                  <Typography variant="subtitle2">
                    พบ RFID Tag {session.scanned_epcs?.length ?? 0} รายการ
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {(session.scanned_epcs ?? []).map((epc) => (
                      <Chip key={epc} size="small" label={epc} />
                    ))}
                  </Stack>
                </>
              )}

              <Stack direction="row" spacing={2}>
                <LoadingButton
                  type="button"
                  variant="contained"
                  color="success"
                  loading={confirming}
                  disabled={session.status !== 'REPORTED'}
                  onClick={handleConfirm}
                >
                  ยืนยันเพิ่มผ้าเข้าระบบ
                </LoadingButton>
                <Button type="button" color="inherit" variant="outlined" onClick={handleCancel}>
                  ยกเลิก
                </Button>
              </Stack>
            </Stack>
          )}

          {queue.length > 0 && (
            <>
              <Divider />
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                  รอตรวจสอบจากเครื่อง Handheld ({queue.length})
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  session ที่เริ่มสแกนจากตัวเครื่องเอง — กดยืนยันเพื่อเพิ่มผ้าเข้าคลัง
                </Typography>

                {queue.map((s) => {
                  const bindLabel = s.lot_code
                    ? `ล็อต ${s.lot_code}`
                    : s.category_name
                      ? `หมวดหมู่ ${s.category_name}`
                      : '—';
                  const isReported = s.status === 'REPORTED';
                  const busy = busyQueueId === s.id;

                  return (
                    <Box
                      key={s.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        border: (theme) => `1px solid ${theme.vars.palette.divider}`,
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        alignItems={{ sm: 'center' }}
                        justifyContent="space-between"
                      >
                        <Stack spacing={0.25}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle2">{bindLabel}</Typography>
                            <Chip
                              size="small"
                              variant="soft"
                              color={isReported ? 'success' : 'info'}
                              label={SESSION_STATUS_LABEL[s.status] ?? s.status}
                            />
                          </Stack>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {isReported
                              ? `พบ ${s.scanned_epcs?.length ?? 0} แท็ก`
                              : 'ยังไม่ส่งผลสแกน'}
                            {s.device_caretaker_name ? ` · ${s.device_caretaker_name}` : ''}
                            {s.triggered_by_name ? ` · โดย ${s.triggered_by_name}` : ''}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1}>
                          <LoadingButton
                            type="button"
                            size="small"
                            variant="contained"
                            color="success"
                            loading={busy}
                            disabled={!isReported || busy}
                            onClick={() => handleQueueConfirm(s.id)}
                          >
                            ยืนยัน
                          </LoadingButton>
                          <Button
                            type="button"
                            size="small"
                            color="inherit"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => handleQueueCancel(s.id)}
                          >
                            ยกเลิก
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
