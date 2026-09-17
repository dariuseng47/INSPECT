'use client';

import { z as zod } from 'zod';
import { useCallback } from 'react';
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
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';

import { DashboardContent } from 'src/layouts/dashboard';
import { createUser, useGetUsers } from 'src/actions/users';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import {
  OnlineDot,
  ROLE_COLOR,
  ROLE_LABEL,
  EditUserDialog,
  useUserRowActions,
} from './user-list-shared';

// ----------------------------------------------------------------------

const NewSuperadminSchema = zod.object({
  username: zod.string().min(3, { message: 'อย่างน้อย 3 ตัวอักษร' }),
  password: zod.string().min(8, { message: 'อย่างน้อย 8 ตัวอักษร' }),
  // PIN สำหรับ login จาก handheld — ห้ามซ้ำกับของ user คนอื่นในระบบ (server เช็คซ้ำอีกชั้น)
  pin: zod.string().regex(/^\d{6}$/, { message: 'PIN ต้องเป็นตัวเลขล้วน 6 หลัก' }),
  fullName: zod.string().min(1, { message: 'กรอกชื่อ-นามสกุล' }),
  phone: zod.string().optional(),
});

function NewSuperadminDialog({ open, onClose, onCreated }) {
  const methods = useForm({
    resolver: zodResolver(NewSuperadminSchema),
    defaultValues: { username: '', password: '', pin: '', fullName: '', phone: '' },
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createUser({ ...data, role: 'SUPERADMIN' });
      toast.success('สร้างบัญชี Superadmin สำเร็จ');
      reset();
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'สร้างบัญชีไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>สร้างบัญชี Superadmin</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Text name="username" label="Username" />
          <Field.Text name="password" label="Password" type="password" />
          <Field.Text
            name="pin"
            label="PIN 6 หลัก (login จาก handheld)"
            inputProps={{ maxLength: 6, inputMode: 'numeric' }}
            helperText="ตัวเลขล้วน 6 หลัก ห้ามซ้ำกับผู้ใช้คนอื่น"
          />
          <Field.Text name="fullName" label="ชื่อ-นามสกุล" />
          <Field.Text name="phone" label="เบอร์โทร (ถ้ามี)" />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            สร้างบัญชี
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

export function SuperadminListView() {
  const { user } = useAuthContext();

  const { users, usersLoading, usersEmpty, refreshUsers } = useGetUsers({ role: 'SUPERADMIN' });

  const dialog = useBoolean();
  const { editDialog, editTarget, openEdit, handleDelete } = useUserRowActions(refreshUsers);

  const handleCreated = useCallback(() => {
    refreshUsers();
  }, [refreshUsers]);

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN']}>
      <DashboardContent maxWidth="xl">
        <CustomBreadcrumbs
          heading="ตั้งค่า Superadmin"
          links={[{ name: 'ตั้งค่า Superadmin' }]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={dialog.onTrue}
            >
              สร้างบัญชี Superadmin
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          {usersLoading ? (
            <LoadingScreen />
          ) : usersEmpty ? (
            <EmptyContent title="ยังไม่มีบัญชี Superadmin" sx={{ py: 10 }} />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 720 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>ชื่อ-นามสกุล</TableCell>
                      <TableCell>บทบาท</TableCell>
                      <TableCell>สถานะ</TableCell>
                      <TableCell>เข้าสู่ระบบล่าสุด</TableCell>
                      <TableCell align="right">การจัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((row) => {
                      // กันล็อกตัวเองออกจากระบบโดยไม่ตั้งใจ — ต้องให้ superadmin คนอื่นแก้ไข/ลบบัญชีนี้แทน
                      const isSelf = row.id === user?.id;

                      return (
                        <TableRow key={row.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <OnlineDot online={!!row.isOnline} />
                              {row.username}
                              {isSelf && (
                                <Chip size="small" variant="soft" label="คุณ" sx={{ ml: 0.5 }} />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>{row.full_name}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={ROLE_COLOR[row.role]}
                              label={ROLE_LABEL[row.role]}
                              variant="soft"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={row.is_active ? 'success' : 'default'}
                              label={row.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                              variant="soft"
                            />
                          </TableCell>
                          <TableCell>
                            {row.last_login_at ? (
                              <Typography variant="body2">
                                {new Date(row.last_login_at).toLocaleString('th-TH')}
                              </Typography>
                            ) : (
                              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                ยังไม่เคยเข้าสู่ระบบ
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton onClick={() => openEdit(row)}>
                              <Iconify icon="solar:pen-bold-duotone" width={18} />
                            </IconButton>
                            <IconButton
                              color="error"
                              disabled={isSelf}
                              onClick={() => handleDelete(row.id)}
                            >
                              <Iconify icon="solar:trash-bin-trash-bold" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </Card>

        <NewSuperadminDialog open={dialog.value} onClose={dialog.onFalse} onCreated={handleCreated} />

        <EditUserDialog
          open={editDialog.value}
          onClose={editDialog.onFalse}
          targetUser={editTarget}
          onSaved={refreshUsers}
        />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
