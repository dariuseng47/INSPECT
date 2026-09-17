'use client';

import { z as zod } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useBoolean } from 'src/hooks/use-boolean';

import { deleteUser, updateUser } from 'src/actions/users';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

export const ROLE_LABEL = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
};

export const ROLE_COLOR = {
  SUPERADMIN: 'error',
  ADMIN: 'warning',
  OPERATOR: 'default',
};

export const LOGIN_CLIENT_LABEL = {
  mobile: 'มือถือ',
  web: 'เว็บ',
};

// เขียว = มี Socket.io connection ค้างอยู่ตอนนี้ (server/src/sockets/presence.js) — สำหรับมือถือ
// หมายถึงแอปเปิดอยู่หน้าจอจริงๆ ไม่ใช่แค่เคย login ไว้เฉยๆ
export function OnlineDot({ online }) {
  return (
    <Tooltip title={online ? 'ออนไลน์ตอนนี้' : 'ออฟไลน์'}>
      <Box
        sx={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          bgcolor: online ? 'success.main' : 'grey.400',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
    </Tooltip>
  );
}

const EditUserSchema = zod.object({
  fullName: zod.string().min(1, { message: 'กรอกชื่อ-นามสกุล' }),
  phone: zod.string().optional(),
  isActive: zod.boolean(),
});

export function EditUserDialog({ open, onClose, targetUser, onSaved }) {
  const methods = useForm({
    resolver: zodResolver(EditUserSchema),
    defaultValues: { fullName: '', phone: '', isActive: true },
  });
  const {
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open && targetUser) {
      reset({
        fullName: targetUser.full_name ?? '',
        phone: targetUser.phone ?? '',
        isActive: !!targetUser.is_active,
      });
    }
  }, [open, targetUser, reset]);

  const isActive = useWatch({ control, name: 'isActive' });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await updateUser(targetUser.id, data);
      toast.success('แก้ไขบัญชีผู้ใช้สำเร็จ');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>แก้ไขบัญชีผู้ใช้ ({targetUser?.username})</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Text name="fullName" label="ชื่อ-นามสกุล" />
          <Field.Text name="phone" label="เบอร์โทร (ถ้ามี)" />
          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(e) => methods.setValue('isActive', e.target.checked)}
              />
            }
            label={isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
          />
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

// รวม state/handlers ที่ทั้งหน้า admin&staff กับหน้า superadmin ใช้เหมือนกัน (edit dialog + delete)
// กันโค้ดซ้ำ — เหลือแค่ NewXxxDialog กับ table columns ที่ต่างกันจริงในแต่ละหน้า
export function useUserRowActions(refreshUsers) {
  const editDialog = useBoolean();
  const [editTarget, setEditTarget] = useState(null);

  const openEdit = useCallback(
    (row) => {
      setEditTarget(row);
      editDialog.onTrue();
    },
    [editDialog]
  );

  const handleDelete = useCallback(
    async (id) => {
      try {
        await deleteUser(id);
        toast.success('ลบบัญชีผู้ใช้สำเร็จ');
        refreshUsers();
      } catch (error) {
        toast.error(error?.message || 'ลบบัญชีไม่สำเร็จ');
      }
    },
    [refreshUsers]
  );

  return { editDialog, editTarget, openEdit, handleDelete };
}
