'use client';

import { z as zod } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useGetPhoneModels } from 'src/actions/phoneModels';
import { useGetQueue, addExtraImages, resolveQueueItem, rejectQueueItem } from 'src/actions/unidentifiedQueue';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import { useBoolean } from 'src/hooks/use-boolean';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

const newModelSchema = zod.object({
  brand: zod.string().min(1, { message: 'กรอกยี่ห้อ' }),
  modelName: zod.string().min(1, { message: 'กรอกชื่อรุ่น' }),
  minCapacityGb: zod.coerce.number().int().positive({ message: 'กรอกความจุขั้นต่ำ (GB)' }),
});

function ResolveDialog({ item, onClose, onDone }) {
  const { models } = useGetPhoneModels();
  const [mode, setMode] = useState('candidate'); // candidate | existing | new
  const [selectedModelId, setSelectedModelId] = useState(item.candidate_model_ids[0]?.modelId ?? '');
  const [saving, setSaving] = useState(false);

  const methods = useForm({
    resolver: zodResolver(newModelSchema),
    defaultValues: { brand: '', modelName: '', minCapacityGb: '' },
  });

  const handleResolve = async () => {
    setSaving(true);
    try {
      if (mode === 'new') {
        const valid = await methods.trigger();
        if (!valid) {
          setSaving(false);
          return;
        }
        await resolveQueueItem(item.id, { newModel: methods.getValues() });
        toast.success('สร้างรุ่นใหม่และเพิ่มภาพนี้เป็นข้อมูลอ้างอิงแล้ว');
      } else {
        if (!selectedModelId) {
          toast.error('กรุณาเลือกรุ่น');
          setSaving(false);
          return;
        }
        await resolveQueueItem(item.id, { resolvedModelId: selectedModelId });
        toast.success('ยืนยันรุ่นและเพิ่มภาพนี้เป็นข้อมูลอ้างอิงแล้ว');
      }
      onDone();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>ยืนยันรุ่นโทรศัพท์</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Box component="img" src={item.crop_image_path} sx={{ width: '100%', borderRadius: 1.5, maxHeight: 220, objectFit: 'contain', bgcolor: 'background.neutral' }} />

        <ToggleButtonGroup exclusive value={mode} onChange={(e, v) => v && setMode(v)} size="small" fullWidth>
          <ToggleButton value="candidate" disabled={!item.candidate_model_ids.length}>
            เลือกจาก candidate
          </ToggleButton>
          <ToggleButton value="existing">เลือกรุ่นอื่น</ToggleButton>
          <ToggleButton value="new">สร้างรุ่นใหม่</ToggleButton>
        </ToggleButtonGroup>

        {mode === 'candidate' && (
          <Stack spacing={1}>
            {item.candidate_model_ids.map((c) => (
              <Box
                key={c.modelId}
                onClick={() => setSelectedModelId(c.modelId)}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: selectedModelId === c.modelId ? 'primary.main' : 'divider',
                  cursor: 'pointer',
                }}
              >
                <Typography variant="body2">
                  {c.model ? `${c.model.brand} ${c.model.model_name}` : `รุ่น #${c.modelId}`}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  คะแนนใกล้เคียง {Math.round(c.score * 100)}%
                </Typography>
              </Box>
            ))}
          </Stack>
        )}

        {mode === 'existing' && (
          <ToggleButtonGroup
            orientation="vertical"
            exclusive
            value={selectedModelId}
            onChange={(e, v) => v && setSelectedModelId(v)}
            sx={{ maxHeight: 240, overflowY: 'auto' }}
          >
            {models.map((m) => (
              <ToggleButton key={m.id} value={m.id} sx={{ justifyContent: 'flex-start' }}>
                {m.brand} {m.model_name}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}

        {mode === 'new' && (
          <Form methods={methods}>
            <Stack spacing={2}>
              <Field.Text name="brand" label="ยี่ห้อ" />
              <Field.Text name="modelName" label="ชื่อรุ่น" />
              <Field.Text name="minCapacityGb" label="ความจุขั้นต่ำ (GB)" type="number" />
            </Stack>
          </Form>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={handleResolve}>
          ยืนยัน
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

function QueueCard({ item, onResolved, onRejected }) {
  const resolveDialog = useBoolean();
  const [uploadingExtra, setUploadingExtra] = useState(false);

  const handleExtraImages = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    setUploadingExtra(true);
    try {
      await addExtraImages(item.id, files);
      toast.success(`เพิ่มภาพเพิ่มเติมแล้ว ${files.length} ภาพ`);
      onResolved();
    } catch (error) {
      toast.error(error?.message || 'อัพโหลดไม่สำเร็จ');
    } finally {
      setUploadingExtra(false);
    }
  };

  const handleReject = async () => {
    try {
      await rejectQueueItem(item.id);
      toast.success('ปฏิเสธรายการนี้แล้ว');
      onRejected();
    } catch (error) {
      toast.error(error?.message || 'ดำเนินการไม่สำเร็จ');
    }
  };

  return (
    <Card sx={{ p: 2 }}>
      <Stack direction="row" spacing={2}>
        <Box component="img" src={item.crop_image_path} sx={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 1.5 }} />
        <Stack spacing={0.5} sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            ความมั่นใจ: {item.confidence_score != null ? `${Math.round(item.confidence_score * 100)}%` : 'ไม่มี candidate'}
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {item.candidate_model_ids.length === 0 ? (
              <Chip size="small" variant="soft" color="error" label="ไม่รู้จักเลย — อาจเป็นรุ่นใหม่" />
            ) : (
              item.candidate_model_ids.map((c) => (
                <Chip
                  key={c.modelId}
                  size="small"
                  variant="soft"
                  label={`${c.model ? `${c.model.brand} ${c.model.model_name}` : `#${c.modelId}`} (${Math.round(c.score * 100)}%)`}
                />
              ))
            )}
          </Stack>
          {item.extra_images.length > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              มีภาพเพิ่มเติม {item.extra_images.length} ภาพแล้ว
            </Typography>
          )}
        </Stack>
        <Stack spacing={1} justifyContent="center">
          <Button size="small" variant="contained" onClick={resolveDialog.onTrue}>
            ยืนยันรุ่น
          </Button>
          <LoadingButton size="small" variant="outlined" component="label" loading={uploadingExtra}>
            ถ่ายเพิ่มมุมอื่น
            <input type="file" multiple hidden accept="image/*" onChange={handleExtraImages} />
          </LoadingButton>
          <Tooltip title="ไม่ใช่โทรศัพท์ / ภาพเสีย">
            <IconButton size="small" color="error" onClick={handleReject}>
              <Iconify icon="solar:close-circle-bold" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {resolveDialog.value && (
        <ResolveDialog
          item={item}
          onClose={resolveDialog.onFalse}
          onDone={() => {
            resolveDialog.onFalse();
            onResolved();
          }}
        />
      )}
    </Card>
  );
}

export function UnidentifiedQueueView() {
  const { items, queueLoading, queueEmpty, refreshQueue } = useGetQueue('pending');

  return (
    <>
      <CustomBreadcrumbs heading="คิวตรวจสอบ" links={[{ name: 'ตรวจสอบรุ่นโทรศัพท์' }, { name: 'คิวตรวจสอบ' }]} sx={{ mb: { xs: 2, md: 3 } }} />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        เครื่องที่ระบบไม่มั่นใจหรือยังไม่รู้จักจากการสแกนทุกครั้ง — ยืนยันรุ่นที่ถูกต้องเพื่อให้ระบบเรียนรู้เพิ่มขึ้น
        (อย่าลืมกด &quot;ประมวลผลใหม่&quot; ที่หน้าข้อมูลรุ่นโทรศัพท์หลังยืนยันเสร็จ)
      </Typography>

      {queueLoading ? (
        <LoadingScreen />
      ) : queueEmpty ? (
        <Card sx={{ py: 10 }}>
          <EmptyContent title="ไม่มีรายการรอตรวจสอบ" description="ทุกเครื่องถูกจับคู่ได้หมดแล้ว" />
        </Card>
      ) : (
        <Stack spacing={2}>
          {items.map((item) => (
            <QueueCard key={item.id} item={item} onResolved={refreshQueue} onRejected={refreshQueue} />
          ))}
        </Stack>
      )}
    </>
  );
}
