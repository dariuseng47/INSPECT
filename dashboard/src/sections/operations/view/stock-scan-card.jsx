'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';

import { bgGradient } from 'src/theme/styles';
import { useGetDevices } from 'src/actions/devices';
import { scanCheckpoint } from 'src/actions/rfidReader';
import { useGetFabricItemDetail } from 'src/actions/fabric';
import { stockScan as stockScanAction } from 'src/actions/scans';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { ScannedTagLabel } from './scanned-tag-label';
import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

// สถานะที่ถือว่า "อยู่ระหว่างซัก/อบ/พับ" ก่อนเข้าสต๊อคกลาง — ตรงกับ PRE_STOCK_STATUSES ฝั่ง server
// (stockScan.controller.js) แท็กที่สถานะไม่ตรงตอนสแกนถือว่า "ข้ามขั้นตอน" ระบายสีแดงเตือนไว้ก่อนยืนยัน
const STOCK_SCAN_EXPECTED_STATUSES = ['WASH'];

// เพื่อความไว โชว์สีปกติไปก่อนระหว่างรอผล lazy-load แล้วค่อยสลับเป็นแดงทีหลังถ้าข้ามขั้นตอนจริง
function StockTagChip({ tag, hospitalId, onToggle }) {
  const { fabricItem, detailLoading } = useGetFabricItemDetail(tag.epc, hospitalId);
  const isStepSkipped =
    !detailLoading && !!fabricItem && !STOCK_SCAN_EXPECTED_STATUSES.includes(fabricItem.status);

  return (
    <Chip
      clickable
      size="small"
      label={<ScannedTagLabel epc={tag.epc} hospitalId={hospitalId} />}
      onClick={() => onToggle(tag.epc)}
      color={isStepSkipped ? 'error' : tag.selected ? 'primary' : 'default'}
      variant={tag.selected || isStepSkipped ? 'filled' : 'outlined'}
      icon={tag.selected ? <Iconify icon="eva:checkmark-fill" width={16} /> : undefined}
    />
  );
}

// สแกนเข้าสต๊อค — ใช้เครื่องอ่าน RFID จุดตรวจสอบตัวเดียวกับตอนลงทะเบียนผ้าใหม่ (ดู
// checkpoint-scan-card.jsx) ต่างกันที่หน้านี้เน้นตัวเลขจำนวนที่สแกนได้ใหญ่ๆ ให้รีเช็คไว ๆ ว่า
// แท็กที่ถืออยู่ในมือ (ปกติ ~4-5 ชิ้น/ครั้ง) อ่านครบตามจำนวนจริงก่อนยืนยันเข้าสต๊อคกลาง
export function StockScanCard({ hospitalId, onConfirmed }) {
  const theme = useTheme();
  const { devices } = useGetDevices(hospitalId, 'RFID_CHECKPOINT');

  const [deviceId, setDeviceId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // เลือกเครื่องอ่านที่ตั้งเป็น "ค่าเริ่มต้น" ของจุดนี้ให้อัตโนมัติ (ตั้งในหน้า "อุปกรณ์ & สัญญาณ RFID")
  useEffect(() => {
    if (deviceId) return;
    const preset = devices.find((d) => (d.default_scan_points ?? []).includes('STOCK_SCAN'));
    if (preset) setDeviceId(preset.id);
  }, [devices, deviceId]);
  // Map<epc, { epc, rssi, selected }> — สะสมผลไว้ถ้ากดสแกนซ้ำหลายรอบก่อนยืนยัน
  const [foundTags, setFoundTags] = useState(new Map());

  const handleScan = useCallback(async () => {
    if (!deviceId) {
      toast.error('เลือกเครื่องอ่าน RFID ก่อน');
      return;
    }
    setScanning(true);
    try {
      const { epcs } = await scanCheckpoint(Number(deviceId), hospitalId);
      setFoundTags((prev) => {
        const next = new Map(prev);
        epcs.forEach((tag) => next.set(tag.epc, { ...tag, selected: true }));
        return next;
      });
      if (epcs.length === 0) toast.error('ไม่พบแท็กในระยะสัญญาณ');
    } catch (error) {
      toast.error(
        error?.message || 'สแกนไม่สำเร็จ — ตรวจสอบว่าเครื่องอ่านเปิดอยู่และเชื่อมเครือข่ายได้'
      );
    } finally {
      setScanning(false);
    }
  }, [deviceId, hospitalId]);

  const handleToggleTag = useCallback((epc) => {
    setFoundTags((prev) => {
      const next = new Map(prev);
      const tag = next.get(epc);
      if (tag) next.set(epc, { ...tag, selected: !tag.selected });
      return next;
    });
  }, []);

  const handleClear = useCallback(() => setFoundTags(new Map()), []);

  const tagList = useMemo(() => [...foundTags.values()], [foundTags]);
  const selectedEpcs = useMemo(
    () => tagList.filter((tag) => tag.selected).map((tag) => tag.epc),
    [tagList]
  );

  const handleConfirm = useCallback(async () => {
    if (selectedEpcs.length === 0) {
      toast.error('เลือกแท็กที่จะยืนยันเข้าสต๊อคก่อน');
      return;
    }
    setConfirming(true);
    try {
      const result = await stockScanAction({
        epcCodes: selectedEpcs,
        deviceId: deviceId ? Number(deviceId) : undefined,
      });
      toast.success(
        `ยืนยันเข้าสต๊อคกลางสำเร็จ ${result.processed.length} ชิ้น${
          result.skipped.length ? ` (ข้าม ${result.skipped.length} ชิ้น)` : ''
        }`
      );
      setFoundTags(new Map());
      onConfirmed();
    } catch (error) {
      toast.error(error?.message || 'ยืนยันเข้าสต๊อคไม่สำเร็จ');
    } finally {
      setConfirming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEpcs, deviceId, onConfirmed]);

  return (
    <Grid container spacing={3} alignItems="stretch">
      <Grid item xs={12} md={7}>
        <Card sx={{ height: 1 }}>
          <CardHeader
            avatar={<SectionAvatar icon="solar:radar-2-bold-duotone" color="primary" />}
            title="สแกนเข้าสต๊อค"
            subheader="สแกนผ้าที่ซัก/อบ/พับเสร็จผ่านเครื่องอ่าน RFID จุดตรวจสอบเป็นชุด (~4-5 ชิ้น/ครั้ง)"
            action={
              devices.length > 0 ? (
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
            <Stack spacing={2.5}>
              {devices.length === 0 && (
                <Alert
                  severity="warning"
                  icon={<Iconify icon="solar:danger-triangle-bold-duotone" />}
                >
                  ยังไม่มีเครื่องอ่าน RFID ประเภท &ldquo;จุดตรวจสอบ&rdquo; ที่ผูกกับโรงพยาบาลนี้ —
                  ต้องเพิ่มในหน้า &ldquo;อุปกรณ์ & สัญญาณ RFID&rdquo; ก่อน (ระบุ IP/Port
                  ของเครื่องอ่าน)
                </Alert>
              )}

              <LoadingButton
                fullWidth
                type="button"
                size="large"
                variant="contained"
                loading={scanning}
                disabled={!deviceId}
                onClick={handleScan}
                startIcon={<Iconify icon="solar:radar-2-bold-duotone" width={30} />}
                sx={{ py: 2.25, fontSize: 22, fontWeight: 700, minHeight: 72 }}
              >
                สแกน
              </LoadingButton>

              {tagList.length === 0 ? (
                <EmptyContent
                  title="ยังไม่พบแท็ก"
                  description="เลือกเครื่องอ่านแล้วกด “สแกน” เพื่อเริ่มอ่านแท็กในระยะสัญญาณ"
                  sx={{ py: 5 }}
                />
              ) : (
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2">
                      รายการแท็กที่พบ ({tagList.length}) — แตะเพื่อเลือก/ยกเลิก
                    </Typography>
                    <Button size="small" color="inherit" onClick={handleClear}>
                      ล้างรายการ
                    </Button>
                  </Stack>
                  <Box
                    sx={{
                      p: 1.5,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1,
                      maxHeight: 260,
                      overflowY: 'auto',
                      borderRadius: 1.5,
                      bgcolor: 'background.neutral',
                    }}
                  >
                    {tagList.map((tag) => (
                      <StockTagChip
                        key={tag.epc}
                        tag={tag}
                        hospitalId={hospitalId}
                        onToggle={handleToggleTag}
                      />
                    ))}
                  </Box>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={5}>
        <Stack spacing={2.5} sx={{ height: 1 }}>
          <Card
            sx={{
              flexGrow: 1,
              position: 'relative',
              overflow: 'hidden',
              color: 'common.white',
              ...bgGradient({
                color: `to bottom, ${theme.vars.palette.success.dark} 0%, ${theme.vars.palette.success.darker} 100%`,
              }),
            }}
          >
            <Iconify
              icon="solar:box-bold-duotone"
              width={140}
              sx={{ position: 'absolute', right: -24, bottom: -28, opacity: 0.14 }}
            />
            <CardContent
              sx={{
                height: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                position: 'relative',
                textAlign: 'center',
              }}
            >
              <Typography
                sx={{
                  opacity: 0.9,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  fontSize: 14,
                }}
              >
                จำนวนที่จะยืนยันเข้าสต๊อค
              </Typography>
              <Typography sx={{ lineHeight: 1, fontWeight: 700, fontSize: { xs: 144, sm: 168 } }}>
                {selectedEpcs.length}
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                ชิ้น
                {tagList.length !== selectedEpcs.length
                  ? ` · พบทั้งหมด ${tagList.length} ชิ้น`
                  : ''}
              </Typography>
            </CardContent>
          </Card>

          <LoadingButton
            fullWidth
            type="button"
            size="large"
            variant="contained"
            color="success"
            loading={confirming}
            disabled={selectedEpcs.length === 0}
            onClick={handleConfirm}
            startIcon={<Iconify icon="solar:check-read-bold-duotone" width={26} />}
            sx={{ py: 1.75, fontSize: 18, fontWeight: 700, minHeight: 60 }}
          >
            ยืนยันเข้าสต๊อคกลาง
          </LoadingButton>
        </Stack>
      </Grid>
    </Grid>
  );
}
