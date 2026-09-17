'use client';

import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useCallback } from 'react';

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
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  createHospital,
  deleteHospital,
  updateHospital,
  useGetHospitalsSummary,
} from 'src/actions/hospitals';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

const HospitalSchema = zod.object({
  name: zod.string().min(2, { message: 'กรอกชื่อโรงพยาบาลอย่างน้อย 2 ตัวอักษร' }),
  region: zod.string().optional(),
});

function HospitalFormDialog({ open, onClose, mode, hospital, onSaved }) {
  const methods = useForm({
    resolver: zodResolver(HospitalSchema),
    defaultValues: { name: '', region: '' },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) reset({ name: mode === 'edit' ? (hospital?.name ?? '') : '', region: '' });
  }, [open, mode, hospital, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (mode === 'edit') {
        await updateHospital(hospital.id, { name: data.name });
        toast.success('แก้ไขโรงพยาบาลสำเร็จ');
      } else {
        await createHospital(data);
        toast.success('เพิ่มโรงพยาบาลสำเร็จ');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>{mode === 'edit' ? 'แก้ไขโรงพยาบาล' : 'เพิ่มโรงพยาบาล (Tenant ใหม่)'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Text name="name" label="ชื่อโรงพยาบาล" />
          {mode === 'create' && <Field.Text name="region" label="ภูมิภาค (ถ้ามี)" />}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            บันทึก
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

export function HospitalListView() {
  const { user } = useAuthContext();
  const router = useRouter();
  const { hospitalsSummary, hospitalsSummaryLoading, refreshHospitalsSummary } =
    useGetHospitalsSummary();

  const formDialog = useBoolean();
  const [formMode, setFormMode] = useState('create');
  const [activeHospital, setActiveHospital] = useState(null);

  const deleteDialog = useBoolean();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openCreate = useCallback(() => {
    setFormMode('create');
    setActiveHospital(null);
    formDialog.onTrue();
  }, [formDialog]);

  const openEdit = useCallback(
    (hospital, event) => {
      event.stopPropagation();
      setFormMode('edit');
      setActiveHospital(hospital);
      formDialog.onTrue();
    },
    [formDialog]
  );

  const openDelete = useCallback(
    (hospital, event) => {
      event.stopPropagation();
      setDeleteTarget(hospital);
      deleteDialog.onTrue();
    },
    [deleteDialog]
  );

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteHospital(deleteTarget.id);
      toast.success('ลบโรงพยาบาลสำเร็จ');
      refreshHospitalsSummary();
    } catch (error) {
      toast.error(error?.message || 'ลบไม่สำเร็จ');
    } finally {
      deleteDialog.onFalse();
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteDialog, refreshHospitalsSummary]);

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN']}>
      <DashboardContent maxWidth="xl">
        <CustomBreadcrumbs
          heading="จัดการโรงพยาบาล"
          links={[{ name: 'ศูนย์บริหารเครือข่าย' }, { name: 'จัดการโรงพยาบาล' }]}
          action={
            <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={openCreate}>
              เพิ่มโรงพยาบาล
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          {hospitalsSummaryLoading ? (
            <LoadingScreen />
          ) : hospitalsSummary.length === 0 ? (
            <EmptyContent
              title="ยังไม่มีโรงพยาบาลในระบบ"
              description="เริ่มต้นด้วยการเพิ่มโรงพยาบาลแรก"
              sx={{ py: 10 }}
            />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 760 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ชื่อโรงพยาบาล</TableCell>
                      <TableCell>กลุ่ม/ภาค</TableCell>
                      <TableCell align="center">ผ้า</TableCell>
                      <TableCell align="center">ผู้ใช้</TableCell>
                      <TableCell align="center">อุปกรณ์</TableCell>
                      <TableCell>สร้างเมื่อ</TableCell>
                      <TableCell align="right">การจัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {hospitalsSummary.map((hospital) => (
                      <TableRow
                        key={hospital.id}
                        hover
                        onClick={() => router.push(paths.dashboard.hq.hospitalDetails(hospital.id))}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography
                            component={RouterLink}
                            href={paths.dashboard.hq.hospitalDetails(hospital.id)}
                            variant="subtitle2"
                            onClick={(e) => e.stopPropagation()}
                            sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
                          >
                            {hospital.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{hospital.organizationName}</TableCell>
                        <TableCell align="center">{hospital.fabricCount}</TableCell>
                        <TableCell align="center">{hospital.userCount}</TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            variant="soft"
                            color={hospital.devicesOffline > 0 ? 'warning' : 'success'}
                            label={`${hospital.devicesOnline}/${hospital.devicesOnline + hospital.devicesOffline}`}
                          />
                        </TableCell>
                        <TableCell>{new Date(hospital.createdAt).toLocaleDateString('th-TH')}</TableCell>
                        <TableCell align="right">
                          <IconButton onClick={(e) => openEdit(hospital, e)}>
                            <Iconify icon="solar:pen-bold-duotone" width={18} />
                          </IconButton>
                          <IconButton color="error" onClick={(e) => openDelete(hospital, e)}>
                            <Iconify icon="solar:trash-bin-trash-bold-duotone" width={18} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </Card>

        <HospitalFormDialog
          open={formDialog.value}
          onClose={formDialog.onFalse}
          mode={formMode}
          hospital={activeHospital}
          onSaved={refreshHospitalsSummary}
        />

        <Dialog open={deleteDialog.value} onClose={deleteDialog.onFalse} maxWidth="xs" fullWidth>
          <DialogTitle>ยืนยันการลบโรงพยาบาล</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              ต้องการลบ &quot;{deleteTarget?.name}&quot; ใช่หรือไม่? ระบบจะปฏิเสธถ้ายังมีผู้ใช้งาน ผ้า
              หรือโครงสร้างแผนกของโรงพยาบาลนี้อยู่
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={deleteDialog.onFalse}>
              ยกเลิก
            </Button>
            <Button variant="contained" color="error" onClick={handleConfirmDelete}>
              ลบ
            </Button>
          </DialogActions>
        </Dialog>
      </DashboardContent>
    </RoleBasedGuard>
  );
}
