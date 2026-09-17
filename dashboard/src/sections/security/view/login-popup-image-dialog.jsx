'use client';

import { z as zod } from 'zod';
import { useRef, useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
import FormHelperText from '@mui/material/FormHelperText';
import FormControlLabel from '@mui/material/FormControlLabel';

import { createLoginPopupImage, updateLoginPopupImage } from 'src/actions/loginPopupImages';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';

import { ROLE_LABEL } from './user-list-shared';

// ----------------------------------------------------------------------

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ROLE_OPTIONS = ['SUPERADMIN', 'ADMIN', 'OPERATOR'];

const LoginPopupImageSchema = zod.object({
  // react-dropzone ยิง onDrop มาพร้อม acceptedFiles ว่างเปล่าตอนไฟล์โดน reject (เกิน 2MB) ทำให้
  // ค่า field กลายเป็น undefined ไม่ใช่ null — ต้องรับทั้งสองแบบ เหมือน fabric-hold-view.jsx
  image: zod
    .instanceof(File)
    .nullable()
    .optional()
    .refine((file) => !file || file.size <= MAX_IMAGE_SIZE_BYTES, {
      message: 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 2MB',
    }),
  roles: zod.array(zod.enum(ROLE_OPTIONS)).min(1, 'ต้องเลือกอย่างน้อย 1 บทบาท'),
  sortOrder: zod.coerce.number().int(),
});

const DEFAULT_VALUES = { image: null, roles: [], sortOrder: 0 };

export function LoginPopupImageDialog({ open, onClose, target, onSaved }) {
  const isEdit = !!target;

  // null = ไม่ได้กำลังอัปโหลด, 0-100 = % จำลอง (ไม่ได้ผูกกับ progress จริงของไฟล์ — แค่ให้ผู้ใช้เห็น
  // ว่าระบบกำลังทำงานอยู่ระหว่างรอ request เสร็จ) ไล่ขึ้นเรื่อยๆ จนถึง 90% แล้วค้างรอจน request จบ
  const [uploadProgress, setUploadProgress] = useState(null);
  const progressTimerRef = useRef(null);

  const methods = useForm({
    resolver: zodResolver(LoginPopupImageSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const {
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    formState: { isSubmitting, errors },
  } = methods;

  useEffect(() => {
    if (!open) return;
    reset(
      target
        ? { image: null, roles: target.roles, sortOrder: target.sort_order }
        : DEFAULT_VALUES
    );
    setUploadProgress(null);
  }, [open, target, reset]);

  useEffect(() => () => clearInterval(progressTimerRef.current), []);

  const roles = useWatch({ control, name: 'roles' });

  const toggleRole = (role) => {
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    setValue('roles', next, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (data) => {
    if (!isEdit && !data.image) {
      setError('image', { message: 'ต้องเลือกรูปภาพ' });
      return;
    }

    const formData = new FormData();
    if (data.image) formData.append('image', data.image);
    formData.append('roles', JSON.stringify(data.roles));
    formData.append('sortOrder', String(data.sortOrder));

    setUploadProgress(0);
    progressTimerRef.current = setInterval(() => {
      setUploadProgress((prev) => Math.min((prev ?? 0) + 10, 90));
    }, 200);

    try {
      if (isEdit) {
        await updateLoginPopupImage(target.id, formData);
        toast.success('แก้ไขรูปภาพ popup สำเร็จ');
      } else {
        await createLoginPopupImage(formData);
        toast.success('เพิ่มรูปภาพ popup สำเร็จ');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      clearInterval(progressTimerRef.current);
      setUploadProgress(null);
    }
  });

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>{isEdit ? 'แก้ไขรูปภาพ Popup' : 'เพิ่มรูปภาพ Popup'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Upload
            name="image"
            maxSize={MAX_IMAGE_SIZE_BYTES}
            onDelete={() => setValue('image', null, { shouldValidate: true })}
            helperText={isEdit ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรูป' : 'รองรับไฟล์ JPG, PNG, WEBP ขนาดไม่เกิน 2MB'}
          />

          {uploadProgress !== null && (
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  กำลังบันทึก...
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {uploadProgress}%
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}

          <div>
            <FormGroup row>
              {ROLE_OPTIONS.map((role) => (
                <FormControlLabel
                  key={role}
                  control={
                    <Checkbox checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                  }
                  label={ROLE_LABEL[role]}
                />
              ))}
            </FormGroup>
            {!!errors.roles && <FormHelperText error>{errors.roles.message}</FormHelperText>}
          </div>

          <Field.Text name="sortOrder" label="ลำดับการแสดง" type="number" helperText="เลขน้อยแสดงก่อน" />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose} disabled={isSubmitting}>
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
