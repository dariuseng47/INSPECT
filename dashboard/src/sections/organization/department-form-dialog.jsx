'use client';

import { z as zod } from 'zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { createDepartment, updateDepartment } from 'src/actions/departments';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';

import { LEVEL_LABEL } from './organization-constants';

// ----------------------------------------------------------------------

const Schema = zod.object({
  name: zod.string().min(1, { message: 'กรอกชื่อ' }),
});

// mode: 'create' (ต้องมี levelType + parent มาด้วย) หรือ 'edit' (มี department มาด้วย)
export function DepartmentFormDialog({
  open,
  onClose,
  mode,
  levelType,
  parent,
  department,
  hospitalId,
  onSaved,
}) {
  const methods = useForm({
    resolver: zodResolver(Schema),
    defaultValues: { name: '' },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) reset({ name: mode === 'edit' ? (department?.name ?? '') : '' });
  }, [open, mode, department, reset]);

  const effectiveLevelType = mode === 'edit' ? department?.level_type : levelType;

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (mode === 'edit') {
        await updateDepartment(department.id, { name: data.name });
        toast.success('แก้ไขชื่อสำเร็จ');
      } else {
        await createDepartment({
          name: data.name,
          levelType: effectiveLevelType,
          parentId: parent?.id,
          hospitalId,
        });
        toast.success(`เพิ่ม${LEVEL_LABEL[effectiveLevelType]}สำเร็จ`);
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
        <DialogTitle>
          {mode === 'edit'
            ? `แก้ไข${LEVEL_LABEL[effectiveLevelType] ?? ''}`
            : `เพิ่ม${LEVEL_LABEL[effectiveLevelType] ?? ''}${parent ? ` ใน "${parent.name}"` : ''}`}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Field.Text
            name="name"
            label={`ชื่อ${LEVEL_LABEL[effectiveLevelType] ?? ''}`}
            autoFocus
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
