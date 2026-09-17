'use client';

import { z as zod } from 'zod';
import { Fragment, useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  useGetPhoneModels,
  createPhoneModel,
  deletePhoneModel,
  reindexPhoneModels,
} from 'src/actions/phoneModels';

import { DashboardContent } from 'src/layouts/dashboard';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { useBoolean } from 'src/hooks/use-boolean';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

const SUFFICIENCY_COLOR = { good: 'success', medium: 'warning', low: 'error' };

const schema = zod.object({
  brand: zod.string().min(1, { message: 'กรอกยี่ห้อ' }),
  modelName: zod.string().min(1, { message: 'กรอกชื่อรุ่น' }),
  minCapacityGb: zod.coerce.number().int().positive({ message: 'กรอกความจุขั้นต่ำ (GB)' }),
});

function NewModelDialog({ open, onClose, onCreated }) {
  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: { brand: '', modelName: '', minCapacityGb: '' },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createPhoneModel(data);
      toast.success('เพิ่มรุ่นโทรศัพท์แล้ว');
      reset();
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'เพิ่มรุ่นไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>เพิ่มรุ่นโทรศัพท์</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Text name="brand" label="ยี่ห้อ (เช่น Apple, Samsung)" />
          <Field.Text name="modelName" label="ชื่อรุ่น (เช่น iPhone 13)" />
          <Field.Text
            name="minCapacityGb"
            label="ความจุขั้นต่ำ (GB)"
            type="number"
            inputProps={{ min: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            เพิ่มรุ่น
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

export function PhoneModelListView() {
  const { models, advice, modelsLoading, modelsEmpty, refreshModels } = useGetPhoneModels();
  const dialog = useBoolean();
  const confirmDelete = useBoolean();
  const [target, setTarget] = useState(null);
  const [reindexing, setReindexing] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map();
    models.forEach((m) => {
      if (!map.has(m.brand)) map.set(m.brand, []);
      map.get(m.brand).push(m);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [models]);

  const pendingCount = models.reduce((sum, m) => sum + (m.imageCount - m.embeddedCount), 0);

  const handleDelete = useCallback((model) => {
    setTarget(model);
    confirmDelete.onTrue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmDeleteAction = async () => {
    try {
      await deletePhoneModel(target.id);
      toast.success('ลบรุ่นแล้ว');
      refreshModels();
    } catch (error) {
      toast.error(error?.message || 'ลบไม่สำเร็จ');
    } finally {
      confirmDelete.onFalse();
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const result = await reindexPhoneModels();
      toast.success(`ประมวลผลภาพใหม่แล้ว ${result.indexed} ภาพ`);
      refreshModels();
    } catch (error) {
      toast.error(error?.message || 'ประมวลผลไม่สำเร็จ');
    } finally {
      setReindexing(false);
    }
  };

  return (
    <DashboardContent maxWidth="xl">
      <CustomBreadcrumbs
        heading="ข้อมูลรุ่นโทรศัพท์"
        links={[{ name: 'ตรวจสอบรุ่นโทรศัพท์' }, { name: 'ข้อมูลรุ่นโทรศัพท์' }]}
        action={
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <LoadingButton
              variant="outlined"
              startIcon={<Iconify icon="solar:refresh-bold-duotone" />}
              loading={reindexing}
              onClick={handleReindex}
            >
              ประมวลผลใหม่ {pendingCount > 0 ? `(${pendingCount} ภาพรอ)` : ''}
            </LoadingButton>
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={dialog.onTrue}
            >
              เพิ่มรุ่นโทรศัพท์
            </Button>
          </Box>
        }
        sx={{ mb: { xs: 2, md: 3 } }}
      />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {advice}
      </Typography>

      <Card>
        {modelsLoading ? (
          <LoadingScreen />
        ) : modelsEmpty ? (
          <EmptyContent title="ยังไม่มีรุ่นโทรศัพท์ในระบบ" description="เริ่มเพิ่มรุ่นแรกได้เลย" sx={{ py: 10 }} />
        ) : (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 720 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ยี่ห้อ / รุ่น</TableCell>
                    <TableCell>ความจุขั้นต่ำ</TableCell>
                    <TableCell>ภาพอ้างอิง</TableCell>
                    <TableCell align="right">การจัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {grouped.map(([brand, brandModels]) => (
                    <Fragment key={brand}>
                      <TableRow>
                        <TableCell colSpan={4} sx={{ bgcolor: 'background.neutral', py: 0.75 }}>
                          <Typography variant="subtitle2">{brand}</Typography>
                        </TableCell>
                      </TableRow>
                      {brandModels.map((model) => (
                        <TableRow key={model.id} hover>
                          <TableCell sx={{ pl: 4 }}>{model.model_name}</TableCell>
                          <TableCell>{model.min_capacity_gb} GB</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              variant="soft"
                              color={SUFFICIENCY_COLOR[model.sufficiency.level]}
                              label={`${model.imageCount} ภาพ · ${model.sufficiency.label}`}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              component={RouterLink}
                              href={paths.dashboard.phone.modelDetails(model.id)}
                              title="จัดการภาพอ้างอิง"
                            >
                              <Iconify icon="solar:gallery-bold-duotone" width={18} />
                            </IconButton>
                            <IconButton color="error" onClick={() => handleDelete(model)}>
                              <Iconify icon="solar:trash-bin-trash-bold" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}
      </Card>

      <NewModelDialog open={dialog.value} onClose={dialog.onFalse} onCreated={refreshModels} />

      <ConfirmDialog
        open={confirmDelete.value}
        onClose={confirmDelete.onFalse}
        title="ลบรุ่นโทรศัพท์"
        content={`ต้องการลบ "${target?.brand} ${target?.model_name}" ใช่หรือไม่?`}
        action={
          <Button variant="contained" color="error" onClick={confirmDeleteAction}>
            ลบ
          </Button>
        }
      />
    </DashboardContent>
  );
}
