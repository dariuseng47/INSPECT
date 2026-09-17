'use client';

import { z as zod } from 'zod';
import { useState, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
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
import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { createUser, useGetUsers } from 'src/actions/users';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { PermissionEditorDialog } from './permission-editor-dialog';
import {
  OnlineDot,
  ROLE_LABEL,
  ROLE_COLOR,
  EditUserDialog,
  useUserRowActions,
  LOGIN_CLIENT_LABEL,
} from './user-list-shared';

// ----------------------------------------------------------------------

function buildSchema(isSuperadmin) {
  return zod.object({
    username: zod.string().min(3, { message: 'อย่างน้อย 3 ตัวอักษร' }),
    password: zod.string().min(8, { message: 'อย่างน้อย 8 ตัวอักษร' }),
    // PIN สำหรับ login จาก handheld แทน username/password ได้ (เลือกได้ทั้งสองแบบ) — ห้ามซ้ำกับ
    // ของ user คนอื่นในระบบ (เช็คที่ server อีกชั้น คืน error PIN_TAKEN ถ้าซ้ำ)
    pin: zod.string().regex(/^\d{6}$/, { message: 'PIN ต้องเป็นตัวเลขล้วน 6 หลัก' }),
    fullName: zod.string().min(1, { message: 'กรอกชื่อ-นามสกุล' }),
    phone: zod.string().optional(),
    role: isSuperadmin ? zod.enum(['ADMIN', 'OPERATOR']) : zod.literal('OPERATOR'),
  });
}

// สร้างบัญชี admin/staff ให้ "โรงพยาบาลที่กำลังเลือกอยู่" เสมอ (มาจาก sidebar switcher) — ไม่ต้อง
// เลือกโรงพยาบาลซ้ำในฟอร์มอีกรอบ เพราะทั้งหน้านี้ถูกกรองตามโรงพยาบาลนั้นอยู่แล้ว
function NewUserDialog({ open, onClose, onCreated, isSuperadmin, hospitalId }) {
  const methods = useForm({
    resolver: zodResolver(buildSchema(isSuperadmin)),
    defaultValues: {
      username: '',
      password: '',
      pin: '',
      fullName: '',
      phone: '',
      role: isSuperadmin ? 'ADMIN' : 'OPERATOR',
    },
  });

  const {
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = methods;

  const role = useWatch({ control, name: 'role' });

  const onSubmit = handleSubmit(async (data) => {
    try {
      const res = await createUser({ ...data, hospitalId });
      toast.success('สร้างบัญชีแล้ว — ตั้งค่าสิทธิ์/โรงพยาบาล/handheld ต่อได้เลย');
      reset();
      onCreated(res?.user ?? null);
      onClose();
    } catch (error) {
      toast.error(error?.message || 'สร้างบัญชีไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>สร้างบัญชีผู้ใช้</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {isSuperadmin && (
            <Field.Select name="role" label="บทบาท (Role)">
              <MenuItem value="ADMIN">Admin</MenuItem>
              <MenuItem value="OPERATOR">Operator</MenuItem>
            </Field.Select>
          )}

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
          <LoadingButton type="submit" variant="contained" loading={isSubmitting} disabled={!role}>
            สร้างบัญชี
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

export function UserListView() {
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin, hospitalsLoading } = useEffectiveHospital();

  const { users, usersLoading, usersEmpty, refreshUsers } = useGetUsers({
    hospitalId,
    role: 'ADMIN,OPERATOR',
  });

  // ผู้ใช้คนไหน login/logout จากมือถือ(handheld)/เว็บ ตอนนี้ -> จุดสถานะอัปเดตสดไม่ต้องรีเฟรช
  // (server/src/sockets/presence.js ยิง event นี้เข้าห้อง hospital:<id> เดียวกับที่ต่อ socket อยู่)
  useSocketEvent('presence:update', () => {
    refreshUsers();
  });
  const dialog = useBoolean();

  const { editDialog, editTarget, openEdit, handleDelete } = useUserRowActions(refreshUsers);

  const permissionsDialog = useBoolean();
  const [permissionsTarget, setPermissionsTarget] = useState(null);

  const openPermissions = useCallback(
    (row) => {
      setPermissionsTarget(row);
      permissionsDialog.onTrue();
    },
    [permissionsDialog]
  );

  // สร้างเสร็จ -> รีเฟรชรายชื่อ + เปิดหน้าตั้งค่าสิทธิ์ให้บัญชีใหม่ทันที (ตั้ง scope/handheld/เมนู)
  const handleCreated = useCallback(
    (newUser) => {
      refreshUsers();
      if (newUser) openPermissions(newUser);
    },
    [refreshUsers, openPermissions]
  );

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="xl">
        <CustomBreadcrumbs
          heading="ผู้ใช้งาน & สิทธิ์การเข้าถึง"
          links={[{ name: 'ความปลอดภัย & ตั้งค่าระบบ' }, { name: 'ผู้ใช้งาน & สิทธิ์การเข้าถึง' }]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={dialog.onTrue}
              disabled={!hospitalId}
            >
              สร้างบัญชีผู้ใช้
            </Button>
          }
          sx={{ mb: { xs: 2, md: 3 } }}
        />

        <HospitalContextChip sx={{ mb: 2 }} />

        {hospitalsLoading ? (
          <LoadingScreen />
        ) : !hospitalId ? (
          <Card sx={{ p: 2 }}>
            <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
          </Card>
        ) : (
          <Card>
            {usersLoading ? (
              <LoadingScreen />
            ) : usersEmpty ? (
              <EmptyContent title="ยังไม่มีผู้ใช้งาน" sx={{ py: 10 }} />
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
                        // hard-coded boundary ตาม docs/rbac-permissions.md — admin แก้ไข/ลบได้เฉพาะ operator
                        const canManage = isSuperadmin || row.role === 'OPERATOR';

                        return (
                          <TableRow key={row.id} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <OnlineDot online={!!row.isOnline} />
                                {row.username}
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
                                <Box>
                                  <Typography variant="body2">
                                    {new Date(row.last_login_at).toLocaleString('th-TH')}
                                  </Typography>
                                  {row.last_login_client && (
                                    <Chip
                                      size="small"
                                      variant="soft"
                                      color={row.last_login_client === 'mobile' ? 'info' : 'default'}
                                      icon={
                                        <Iconify
                                          icon={
                                            row.last_login_client === 'mobile'
                                              ? 'solar:smartphone-bold-duotone'
                                              : 'solar:monitor-bold-duotone'
                                          }
                                          width={14}
                                        />
                                      }
                                      label={LOGIN_CLIENT_LABEL[row.last_login_client] ?? row.last_login_client}
                                      sx={{ mt: 0.5 }}
                                    />
                                  )}
                                </Box>
                              ) : (
                                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                  ยังไม่เคยเข้าสู่ระบบ
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {canManage && (
                                <>
                                  {(isSuperadmin
                                    ? row.role !== 'SUPERADMIN'
                                    : row.role === 'OPERATOR') && (
                                    <IconButton
                                      onClick={() => openPermissions(row)}
                                      title="ตั้งค่าสิทธิ์ / โรงพยาบาล / handheld"
                                    >
                                      <Iconify icon="solar:shield-user-bold-duotone" width={18} />
                                    </IconButton>
                                  )}
                                  <IconButton onClick={() => openEdit(row)}>
                                    <Iconify icon="solar:pen-bold-duotone" width={18} />
                                  </IconButton>
                                  <IconButton color="error" onClick={() => handleDelete(row.id)}>
                                    <Iconify icon="solar:trash-bin-trash-bold" />
                                  </IconButton>
                                </>
                              )}
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
        )}

        <NewUserDialog
          open={dialog.value}
          onClose={dialog.onFalse}
          onCreated={handleCreated}
          isSuperadmin={isSuperadmin}
          hospitalId={hospitalId}
        />

        <EditUserDialog
          open={editDialog.value}
          onClose={editDialog.onFalse}
          targetUser={editTarget}
          onSaved={refreshUsers}
        />

        <PermissionEditorDialog
          open={permissionsDialog.value}
          onClose={permissionsDialog.onFalse}
          targetUser={permissionsTarget}
          onSaved={refreshUsers}
        />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
