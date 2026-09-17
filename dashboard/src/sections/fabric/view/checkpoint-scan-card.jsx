'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useAutoScan } from 'src/hooks/use-auto-scan';

import { useGetDevices } from 'src/actions/devices';
import { scanCheckpoint } from 'src/actions/rfidReader';
import { bulkCreateFabricItems } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// Select แบบง่ายที่ไม่ผูกกับ react-hook-form (เหมือน handheld-scan-card.jsx)
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

export function CheckpointScanCard({ hospitalId, lots, categories, onConfirmed }) {
  const { devices } = useGetDevices(hospitalId, 'RFID_CHECKPOINT');

  const [lotId, setLotId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Map<epc, { epc, rssi, selected }> — ใช้ Map กันแท็กซ้ำถ้ากดสแกนซ้ำหลายรอบ (สะสมผลไว้ก่อนกดเพิ่ม)
  const [foundTags, setFoundTags] = useState(new Map());

  // เลือกเครื่องอ่านที่ตั้งเป็น "ค่าเริ่มต้น" ของจุดนี้ให้อัตโนมัติ (ตั้งในหน้า "อุปกรณ์ & สัญญาณ RFID")
  useEffect(() => {
    if (deviceId) return;
    const preset = devices.find((d) => (d.default_scan_points ?? []).includes('FABRIC_REGISTER'));
    if (preset) setDeviceId(preset.id);
  }, [devices, deviceId]);

  // รวมแท็กที่อ่านได้เข้ารายการ (ใช้ทั้งสแกนครั้งเดียว และโหมดอ่านอัตโนมัติ)
  const mergeTags = useCallback((epcs) => {
    setFoundTags((prev) => {
      const next = new Map(prev);
      epcs.forEach((tag) => {
        if (!next.has(tag.epc)) next.set(tag.epc, { ...tag, selected: true });
      });
      return next;
    });
  }, []);

  const {
    running: autoScanning,
    start: startAutoScan,
    stop: stopAutoScan,
  } = useAutoScan({ hospitalId, onTags: mergeTags });

  const handleScan = useCallback(async () => {
    if (!deviceId) {
      toast.error('เลือกเครื่องอ่าน RFID ก่อน');
      return;
    }
    setScanning(true);
    try {
      const { epcs } = await scanCheckpoint(Number(deviceId), hospitalId);
      mergeTags(epcs);
      if (epcs.length === 0) {
        toast.error('เครื่องอ่านตอบกลับแล้ว แต่ไม่พบแท็กในระยะสัญญาณ — ลองขยับผ้าเข้าใกล้เสาอากาศ');
      } else {
        toast.success(`สแกนพบแท็ก ${epcs.length} รายการ`);
      }
    } catch (error) {
      toast.error(error?.message || 'สแกนไม่สำเร็จ — ตรวจสอบว่าเครื่องอ่านเปิดอยู่และเชื่อมเครือข่ายได้');
    } finally {
      setScanning(false);
    }
  }, [deviceId, hospitalId, mergeTags]);

  const handleToggleTag = useCallback((epc) => {
    setFoundTags((prev) => {
      const next = new Map(prev);
      const tag = next.get(epc);
      if (tag) next.set(epc, { ...tag, selected: !tag.selected });
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setFoundTags(new Map());
  }, []);

  const selectedEpcs = [...foundTags.values()].filter((tag) => tag.selected).map((tag) => tag.epc);

  const handleConfirm = useCallback(async () => {
    stopAutoScan();
    if ((!lotId && !categoryId) || selectedEpcs.length === 0) {
      toast.error('เลือกล็อต (หรือหมวดหมู่) และแท็กที่จะเพิ่มก่อน');
      return;
    }
    setConfirming(true);
    try {
      const result = await bulkCreateFabricItems({
        epcCodes: selectedEpcs,
        fabricLotId: lotId ? Number(lotId) : undefined,
        fabricCategoryId: lotId ? undefined : Number(categoryId),
        hospitalId,
      });
      toast.success(
        `เพิ่มผ้าใหม่ ${result.created.length} ชิ้น${
          result.skipped.length ? ` (ข้าม ${result.skipped.length} ชิ้นที่ EPC ซ้ำ)` : ''
        }`
      );
      setFoundTags(new Map());
      onConfirmed();
    } catch (error) {
      toast.error(error?.message || 'เพิ่มเข้าระบบไม่สำเร็จ');
    } finally {
      setConfirming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotId, categoryId, selectedEpcs, hospitalId, onConfirmed, stopAutoScan]);

  const tagList = [...foundTags.values()];

  return (
    <Card>
      <CardHeader
        title="สแกนผ่านจุดตรวจสอบ"
        subheader="สั่งเครื่องอ่าน RFID ที่จุดตรวจสอบให้อ่านแท็กที่อยู่ในระยะสัญญาณ แล้วเลือกเพิ่มเข้าระบบ"
      />
      <CardContent>
        <Stack spacing={2.5}>
          {devices.length === 0 && (
            <Typography variant="caption" sx={{ color: 'warning.main' }}>
              ยังไม่มีเครื่องอ่าน RFID ประเภท &ldquo;จุดตรวจสอบ&rdquo; ที่ผูกกับโรงพยาบาลนี้ — ต้องเพิ่มในหน้า
              &ldquo;อุปกรณ์ & สัญญาณ RFID&rdquo; ก่อน (ระบุ IP/Port ของเครื่องอ่าน)
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
              disabled={!hospitalId}
              options={[
                { value: '', label: 'ไม่ผูกล็อต' },
                ...lots.map((lot) => ({ value: lot.id, label: lot.lot_code })),
              ]}
            />
            <TextFieldSelect
              label="หมวดหมู่ผ้า (ถ้าไม่ผูกล็อต)"
              value={categoryId}
              onChange={setCategoryId}
              disabled={!hospitalId || !!lotId}
              options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <TextFieldSelect
              label="เครื่องอ่าน RFID"
              value={deviceId}
              onChange={setDeviceId}
              disabled={!hospitalId || autoScanning}
              options={devices.map((d) => ({
                value: d.id,
                label: `#${d.id} ${d.ip_address ? `(${d.ip_address}:${d.port})` : ''}`,
              }))}
            />
          </Stack>

          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <LoadingButton
              type="button"
              variant="contained"
              loading={scanning}
              disabled={!deviceId || autoScanning}
              onClick={handleScan}
              startIcon={<Iconify icon="solar:radar-2-bold-duotone" />}
            >
              สแกนครั้งเดียว
            </LoadingButton>

            {autoScanning ? (
              <Button
                type="button"
                variant="contained"
                color="error"
                onClick={stopAutoScan}
                startIcon={<Iconify icon="solar:stop-bold-duotone" />}
              >
                หยุดอ่านอัตโนมัติ
              </Button>
            ) : (
              <Button
                type="button"
                variant="outlined"
                disabled={!deviceId || scanning}
                onClick={() => startAutoScan(deviceId)}
                startIcon={<Iconify icon="solar:refresh-circle-bold-duotone" />}
              >
                เริ่มอ่านอัตโนมัติ
              </Button>
            )}

            {tagList.length > 0 && !autoScanning && (
              <Button type="button" color="inherit" variant="outlined" onClick={handleClear}>
                ล้างรายการ
              </Button>
            )}
          </Stack>

          {autoScanning && (
            <Typography variant="caption" sx={{ color: 'info.main' }}>
              กำลังอ่านอัตโนมัติ… เจอแท็กใหม่จะเพิ่มเข้ารายการเอง — กด &ldquo;หยุดอ่านอัตโนมัติ&rdquo;
              หรือ &ldquo;เพิ่มเข้าระบบ&rdquo; เมื่อครบ
            </Typography>
          )}

          {tagList.length > 0 && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">
                พบ RFID Tag {tagList.length} รายการ (เลือกแล้ว {selectedEpcs.length})
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {tagList.map((tag) => (
                  <FormControlLabel
                    key={tag.epc}
                    control={
                      <Checkbox
                        size="small"
                        checked={tag.selected}
                        onChange={() => handleToggleTag(tag.epc)}
                      />
                    }
                    label={<Chip size="small" label={tag.epc} />}
                    sx={{ mr: 0 }}
                  />
                ))}
              </Stack>

              <LoadingButton
                type="button"
                variant="contained"
                color="success"
                loading={confirming}
                disabled={(!lotId && !categoryId) || selectedEpcs.length === 0}
                onClick={handleConfirm}
                sx={{ alignSelf: 'flex-start' }}
              >
                เพิ่มเข้าระบบ ({selectedEpcs.length} ชิ้น)
              </LoadingButton>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
