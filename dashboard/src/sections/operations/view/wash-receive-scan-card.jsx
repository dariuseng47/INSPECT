'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Accordion from '@mui/material/Accordion';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';

import { usePermission } from 'src/hooks/use-has-permission';

import { bgGradient } from 'src/theme/styles';
import { useGetDevices } from 'src/actions/devices';
import { scanCheckpoint } from 'src/actions/rfidReader';
import { washReceiveBatchScan } from 'src/actions/scans';
import { useGetFabricItemDetail } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { ScannedTagLabel } from './scanned-tag-label';
import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

// สแกน RFID ที่ประตูชั่งน้ำหนัก: server ต่อเข้าไปอ่านแท็กจากเครื่อง (device_type = WEIGHT_GATE ที่ตั้ง
// IP/Port ไว้) เติมเข้าช่องรหัส EPC — หรือกรอกเองก็ได้ ส่วนน้ำหนักยังกรอกมือ (เซนเซอร์ชั่งยังไม่เชื่อม)
// contract ของ endpoint ไม่เปลี่ยน (ดู scans.controller.js#washReceiveBatch)
// สถานะที่ถือว่ามาจาก "ใช้งานที่วอร์ด" ก่อนรับกลับมาซัก — ตรงกับเงื่อนไข isStepSkipped ฝั่ง server
// (scans.controller.js#washReceiveBatch) แท็กที่สถานะไม่ตรงตอนสแกนถือว่า "ข้ามขั้นตอน" ระบายสีแดง
// เตือนไว้ก่อนยืนยัน — เพื่อความไว โชว์สีปกติไปก่อนระหว่างรอผล lazy-load แล้วค่อยสลับเป็นแดงทีหลัง
const WASH_RECEIVE_EXPECTED_STATUSES = ['IN_USE_WARD', 'WARD_CABINET'];

function WashReceiveTagChip({ epc, hospitalId }) {
  const { fabricItem, detailLoading } = useGetFabricItemDetail(epc, hospitalId);
  const isStepSkipped =
    !detailLoading && !!fabricItem && !WASH_RECEIVE_EXPECTED_STATUSES.includes(fabricItem.status);

  return (
    <Chip
      size="small"
      variant={isStepSkipped ? 'filled' : 'soft'}
      color={isStepSkipped ? 'error' : 'default'}
      label={<ScannedTagLabel epc={epc} hospitalId={hospitalId} />}
    />
  );
}

function parseEpcCodes(raw) {
  return [
    ...new Set(
      raw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

export function WashReceiveScanCard({ hospitalId, onSubmitted }) {
  const theme = useTheme();
  // เลือก/สั่งเครื่องอ่าน RFID ผูกกับสิทธิ์เมนู "อุปกรณ์ & สัญญาณ RFID" (web.devices.view)
  // ไม่ผูกกับ role แล้ว — admin ที่ถอดสิทธิ์นี้ก็สแกนไม่ได้, operator ที่เปิดสิทธิ์ให้ก็สแกนได้
  // ไม่มีสิทธิ์ = กรอกรหัส EPC เองได้ตามเดิม
  const { can } = usePermission();
  const canUseReader = can('web.devices.view');

  const { devices } = useGetDevices(canUseReader ? hospitalId : null, 'WEIGHT_GATE');

  const [epcRaw, setEpcRaw] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // เลือกเครื่องอ่านที่ตั้งเป็น "ค่าเริ่มต้น" ของจุดนี้ให้อัตโนมัติ (ตั้งในหน้า "อุปกรณ์ & สัญญาณ RFID")
  // ทำครั้งแรกที่ยังไม่ได้เลือกเท่านั้น — ผู้ใช้เปลี่ยนเป็นเครื่องอื่นเองได้
  useEffect(() => {
    if (deviceId) return;
    const preset = devices.find((d) => (d.default_scan_points ?? []).includes('WASH_RECEIVE'));
    if (preset) setDeviceId(preset.id);
  }, [devices, deviceId]);

  const epcCodes = parseEpcCodes(epcRaw);

  const handleScanFromReader = useCallback(async () => {
    if (!deviceId) {
      toast.error('เลือกเครื่องอ่าน RFID ที่ประตูชั่งก่อน');
      return;
    }
    setScanning(true);
    try {
      const { epcs } = await scanCheckpoint(Number(deviceId), hospitalId);
      setEpcRaw((prev) => {
        const merged = [...new Set([...parseEpcCodes(prev), ...epcs.map((tag) => tag.epc)])];
        return merged.join('\n');
      });
      if (epcs.length === 0) {
        toast.error('เครื่องอ่านตอบกลับแล้ว แต่ไม่พบแท็กในระยะสัญญาณ');
      } else {
        toast.success(`สแกนพบแท็ก ${epcs.length} รายการ`);
      }
    } catch (error) {
      toast.error(
        error?.message || 'สแกนไม่สำเร็จ — ตรวจสอบว่าเครื่องอ่านเปิดอยู่และเชื่อมเครือข่ายได้'
      );
    } finally {
      setScanning(false);
    }
  }, [deviceId, hospitalId]);

  const handleSubmit = useCallback(async () => {
    if (epcCodes.length === 0) {
      toast.error('กรอกรหัส EPC อย่างน้อย 1 รายการ');
      return;
    }
    if (weightKg === '' || Number(weightKg) < 0) {
      toast.error('กรอกน้ำหนักที่ชั่งได้ (กก.)');
      return;
    }
    setSubmitting(true);
    try {
      const result = await washReceiveBatchScan({ epcCodes, weightKg: Number(weightKg) });
      toast.success(
        `บันทึกชุดสแกน+ชั่งสำเร็จ ${result.processed.length} ชิ้น${
          result.skipped.length ? ` (ข้าม ${result.skipped.length} ชิ้น)` : ''
        }`
      );
      setEpcRaw('');
      setWeightKg('');
      onSubmitted();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epcCodes, weightKg, onSubmitted]);

  const canSubmit = hospitalId && epcCodes.length > 0 && weightKg !== '' && Number(weightKg) >= 0;

  return (
    <Grid container spacing={3} alignItems="stretch">
      <Grid item xs={12} md={7}>
        <Card sx={{ height: 1 }}>
          <CardHeader
            avatar={<SectionAvatar icon="solar:scale-bold-duotone" color="primary" />}
            title="สแกน + ชั่งน้ำหนัก 1 ชุด"
            subheader="สแกนแท็กจากเครื่องอ่านที่ประตูชั่ง (หรือกรอกรหัส EPC เอง) แล้วดูสรุปทางขวา"
            action={
              canUseReader && devices.length > 0 ? (
                <TextField
                  select
                  size="small"
                  label="เครื่องอ่าน"
                  value={deviceId}
                  disabled={!hospitalId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  sx={{ minWidth: 160, maxWidth: 220 }}
                >
                  {devices.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {`#${d.id} ${d.ip_address ? `(${d.ip_address}:${d.port})` : ''}`}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null
            }
          />
          <CardContent>
            {canUseReader && (
              <>
                {devices.length === 0 && (
                  <Alert
                    severity="info"
                    icon={<Iconify icon="solar:info-circle-bold-duotone" />}
                    sx={{ mb: 2.5 }}
                  >
                    ยังไม่มีเครื่องอ่าน RFID ประเภท &ldquo;ประตูชั่งน้ำหนัก&rdquo; ที่ตั้ง IP/Port ไว้ —
                    เพิ่มได้ในหน้า &ldquo;อุปกรณ์ & สัญญาณ RFID&rdquo; หรือกรอกรหัส EPC ด้วยมือไปก่อน
                  </Alert>
                )}

                <LoadingButton
                  fullWidth
                  type="button"
                  size="large"
                  variant="contained"
                  loading={scanning}
                  disabled={!deviceId}
                  onClick={handleScanFromReader}
                  startIcon={<Iconify icon="solar:radar-2-bold-duotone" width={30} />}
                  sx={{ mb: 2.5, py: 2.25, fontSize: 22, fontWeight: 700, minHeight: 72 }}
                >
                  สแกน
                </LoadingButton>
              </>
            )}

            <Stack spacing={2}>
              <Typography variant="subtitle2" color="text.secondary">
                รายการที่สแกนได้{epcCodes.length > 0 ? ` (${epcCodes.length})` : ''}
              </Typography>

              {epcCodes.length === 0 ? (
                <EmptyContent
                  title="ยังไม่พบรหัส"
                  description={
                    canUseReader
                      ? 'กด “สแกน” เพื่อเริ่มอ่านแท็ก หรือพิมพ์รหัสเองด้านล่าง'
                      : 'พิมพ์หรือวางรหัส EPC ด้านล่างเพื่อเริ่ม'
                  }
                  sx={{ py: 5 }}
                />
              ) : (
                <Box
                  sx={{
                    p: 1.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignContent: 'flex-start',
                    gap: 1,
                    minHeight: 160,
                    maxHeight: 320,
                    overflowY: 'auto',
                    borderRadius: 1.5,
                    bgcolor: 'background.neutral',
                  }}
                >
                  {epcCodes.map((code) => (
                    <WashReceiveTagChip key={code} epc={code} hospitalId={hospitalId} />
                  ))}
                </Box>
              )}

              <Accordion
                defaultExpanded={!canUseReader}
                disableGutters
                sx={{
                  boxShadow: 'none',
                  bgcolor: 'transparent',
                  border: (t) => `1px dashed ${t.vars.palette.divider}`,
                  borderRadius: 1.5,
                  '&:before': { display: 'none' },
                }}
              >
                <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
                  <Typography variant="body2" color="text.secondary">
                    พิมพ์หรือวางรหัส EPC เอง
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    fullWidth
                    multiline
                    rows={5}
                    placeholder={'วางหรือพิมพ์รหัส EPC\n1 รายการต่อบรรทัด หรือคั่นด้วย comma'}
                    value={epcRaw}
                    disabled={!hospitalId}
                    onChange={(e) => setEpcRaw(e.target.value)}
                    slotProps={{ htmlInput: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
                  />
                </AccordionDetails>
              </Accordion>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={5}>
        <Stack spacing={2.5} sx={{ height: 1 }}>
          <Card
            sx={{
              position: 'relative',
              overflow: 'hidden',
              color: 'common.white',
              ...bgGradient({
                color: `to bottom, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.darker} 100%`,
              }),
            }}
          >
            <Iconify
              icon="solar:qr-code-bold-duotone"
              width={140}
              sx={{ position: 'absolute', right: -24, bottom: -28, opacity: 0.14 }}
            />
            <CardContent sx={{ position: 'relative', textAlign: 'center' }}>
              <Typography
                sx={{
                  opacity: 0.9,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  fontSize: 14,
                }}
              >
                รหัสที่พบ
              </Typography>
              <Typography sx={{ lineHeight: 1, fontWeight: 700, fontSize: { xs: 72, sm: 80 } }}>
                {epcCodes.length}
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                รายการ
              </Typography>
            </CardContent>
          </Card>

          <Card
            sx={{
              position: 'relative',
              overflow: 'hidden',
              color: 'common.white',
              ...bgGradient({
                color: `to bottom, ${theme.vars.palette.warning.dark} 0%, ${theme.vars.palette.warning.darker} 100%`,
              }),
            }}
          >
            <Iconify
              icon="solar:scale-bold-duotone"
              width={140}
              sx={{ position: 'absolute', right: -24, bottom: -28, opacity: 0.14 }}
            />
            <CardContent sx={{ position: 'relative', textAlign: 'center' }}>
              <Typography
                sx={{
                  opacity: 0.9,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  fontSize: 14,
                }}
              >
                น้ำหนักที่ชั่งได้
              </Typography>
              <Typography sx={{ lineHeight: 1, fontWeight: 700, fontSize: { xs: 72, sm: 80 } }}>
                {weightKg === '' ? '0' : weightKg}
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9, mb: 2.5 }}>
                กก.
              </Typography>

              <TextField
                type="number"
                value={weightKg}
                disabled={!hospitalId}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="กรอกน้ำหนักที่ชั่งได้"
                sx={{
                  mx: 'auto',
                  maxWidth: 240,
                  bgcolor: 'common.white',
                  borderRadius: 1,
                }}
                slotProps={{
                  htmlInput: {
                    min: 0,
                    step: 0.1,
                    style: { textAlign: 'center' },
                  },
                }}
              />
            </CardContent>
          </Card>

          <Box sx={{ flexGrow: 1 }} />

          <LoadingButton
            fullWidth
            type="button"
            size="large"
            variant="contained"
            loading={submitting}
            disabled={!canSubmit}
            onClick={handleSubmit}
            startIcon={<Iconify icon="solar:check-read-bold-duotone" width={26} />}
            sx={{ py: 1.75, fontSize: 18, fontWeight: 700, minHeight: 60 }}
          >
            บันทึกชุดนี้
          </LoadingButton>
        </Stack>
      </Grid>
    </Grid>
  );
}
