'use client';

import { z as zod } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';

import { varAlpha } from 'src/theme/styles';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from '../../hooks';
import { FormHead } from '../../components/form-head';
import { signInWithPassword } from '../../context/jwt';

// ----------------------------------------------------------------------

// กรอบ input เข้มขึ้นกว่าค่า default ของธีม (grey 500 @ 0.2) ให้อ่านง่ายขึ้นบนหน้า login
const fieldOutlineSx = {
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: (theme) => varAlpha(theme.vars.palette.grey['500Channel'], 0.48),
  },
};

export const SignInSchema = zod.object({
  username: zod.string().min(1, { message: 'กรุณากรอกชื่อผู้ใช้' }),
  password: zod
    .string()
    .min(1, { message: 'กรุณากรอกรหัสผ่าน' })
    .min(6, { message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }),
});

// ----------------------------------------------------------------------

export function JwtSignInView() {
  const router = useRouter();

  const { checkUserSession } = useAuthContext();

  const [errorMsg, setErrorMsg] = useState('');

  const password = useBoolean();

  const defaultValues = {
    username: '',
    password: '',
  };

  const methods = useForm({
    resolver: zodResolver(SignInSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await signInWithPassword({ username: data.username, password: data.password });
      await checkUserSession?.();

      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMsg(typeof error === 'string' ? error : error.message);
    }
  });

  const renderForm = (
    <Box gap={3} display="flex" flexDirection="column">
      <Field.Text
        name="username"
        label="ชื่อผู้ใช้"
        InputLabelProps={{ shrink: true }}
        sx={fieldOutlineSx}
      />

      <Box gap={1.5} display="flex" flexDirection="column">
        <Link
          component={RouterLink}
          href="#"
          variant="body2"
          color="inherit"
          sx={{ alignSelf: 'flex-end' }}
        >
          ลืมรหัสผ่าน?
        </Link>

        <Field.Text
          name="password"
          label="รหัสผ่าน"
          placeholder="อย่างน้อย 6 ตัวอักษร"
          type={password.value ? 'text' : 'password'}
          InputLabelProps={{ shrink: true }}
          sx={fieldOutlineSx}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={password.onToggle} edge="end">
                  <Iconify icon={password.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <LoadingButton
        fullWidth
        color="primary"
        size="large"
        type="submit"
        variant="contained"
        loading={isSubmitting}
        loadingIndicator="กำลังเข้าสู่ระบบ..."
        sx={{
          py: 1.5,
          borderRadius: 1.5,
          typography: 'subtitle1',
          boxShadow: (theme) => `0 8px 16px 0 ${theme.vars.palette.primary.main}4D`,
          '&:hover': { boxShadow: (theme) => `0 8px 20px 2px ${theme.vars.palette.primary.main}66` },
        }}
      >
        เข้าสู่ระบบ
      </LoadingButton>
    </Box>
  );

  return (
    <>
      <FormHead title="เข้าสู่ระบบ" titleVariant="h3" sx={{ textAlign: 'center' }} />

      {!!errorMsg && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMsg}
        </Alert>
      )}

      <Form methods={methods} onSubmit={onSubmit}>
        {renderForm}
      </Form>
    </>
  );
}
