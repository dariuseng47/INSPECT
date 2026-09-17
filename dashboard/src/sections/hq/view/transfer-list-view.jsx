'use client';

import { z as zod } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';

import { fDateTime } from 'src/utils/format-time';

import { useGetHospitals } from 'src/actions/hospitals';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetFabricCategories } from 'src/actions/fabric';
import { createTransfer, useGetTransfers } from 'src/actions/transfers';

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

const TransferSchema = zod.object({
  epcCode: zod.string().min(1, { message: 'กรอกรหัส EPC' }),
  toHospitalId: zod.coerce.number({ invalid_type_error: 'เลือกโรงพยาบาลปลายทาง' }).int().positive(),
  toCategoryId: zod.coerce.number({ invalid_type_error: 'เลือกหมวดหมู่ผ้าปลายทาง' }).int().positive(),
});

function NewTransferDialog({ open, onClose, onCreated, hospitals }) {
  const methods = useForm({
    resolver: zodResolver(TransferSchema),
    defaultValues: { epcCode: '', toHospitalId: '', toCategoryId: '' },
  });

  const {
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = methods;

  const toHospitalId = useWatch({ control, name: 'toHospitalId' });
  const { categories } = useGetFabricCategories(toHospitalId || undefined);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createTransfer(data);
      toast.success('โอนย้ายผ้าสำเร็จ');
      reset();
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'โอนย้ายไม่สำเร็จ');
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      TransitionProps={{ onExited: () => reset() }}
    >
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>โอนย้ายผ้าข้ามโรงพยาบาล</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Text name="epcCode" label="รหัส EPC" />

          <Field.Select name="toHospitalId" label="โรงพยาบาลปลายทาง">
            {hospitals.map((h) => (
              <MenuItem key={h.id} value={h.id}>
                {h.name}
              </MenuItem>
            ))}
          </Field.Select>

          <Field.Select name="toCategoryId" label="หมวดหมู่ผ้าปลายทาง" disabled={!toHospitalId}>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Field.Select>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            โอนย้าย
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

export function TransferListView() {
  const { user } = useAuthContext();
  const { hospitals } = useGetHospitals();
  const { transfers, transfersLoading, transfersEmpty, refreshTransfers } = useGetTransfers();
  const dialog = useBoolean();

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN']}>
      <DashboardContent maxWidth="xl">
        <CustomBreadcrumbs
          heading="โอนย้ายผ้าข้ามโรงพยาบาล"
          links={[{ name: 'ศูนย์บริหารเครือข่าย' }, { name: 'โอนย้ายผ้าข้ามโรงพยาบาล' }]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="solar:transfer-horizontal-bold-duotone" />}
              onClick={dialog.onTrue}
            >
              โอนย้ายผ้า
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          {transfersLoading ? (
            <LoadingScreen />
          ) : transfersEmpty ? (
            <EmptyContent title="ยังไม่มีประวัติการโอนย้าย" sx={{ py: 10 }} />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 720 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>เวลา</TableCell>
                      <TableCell>รหัส EPC</TableCell>
                      <TableCell>จาก</TableCell>
                      <TableCell>ไปยัง</TableCell>
                      <TableCell>ผู้อนุมัติ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transfers.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(row.transferred_at)}</TableCell>
                        <TableCell>{row.epc_code}</TableCell>
                        <TableCell>{row.from_hospital_name}</TableCell>
                        <TableCell>{row.to_hospital_name}</TableCell>
                        <TableCell>{row.approved_by_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </Card>

        <NewTransferDialog
          open={dialog.value}
          onClose={dialog.onFalse}
          onCreated={refreshTransfers}
          hospitals={hospitals}
        />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
