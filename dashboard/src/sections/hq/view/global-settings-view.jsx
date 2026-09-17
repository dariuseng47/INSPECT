'use client';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetGlobalSettings, updateGlobalSettings } from 'src/actions/globalSettings';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

function buildFormState(settings) {
  return {
    defaultRssiThresholdDbm: settings ? String(settings.default_rssi_threshold_dbm) : '',
    defaultParLevelWarningPct: settings ? String(settings.default_par_level_warning_pct) : '',
  };
}

export function GlobalSettingsView() {
  const { user } = useAuthContext();
  const { settings, settingsLoading, refreshSettings } = useGetGlobalSettings();

  const [values, setValues] = useState(() => buildFormState(null));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (settings) setValues(buildFormState(settings));
  }, [settings]);

  const isDirty =
    !!settings &&
    (values.defaultRssiThresholdDbm !== String(settings.default_rssi_threshold_dbm) ||
      values.defaultParLevelWarningPct !== String(settings.default_par_level_warning_pct));

  const handleChange = (key, value) => {
    if (value !== '' && value !== '-' && !/^-?\d+$/.test(value)) return;
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await updateGlobalSettings({
        defaultRssiThresholdDbm: Number(values.defaultRssiThresholdDbm),
        defaultParLevelWarningPct: Number(values.defaultParLevelWarningPct),
      });
      toast.success('บันทึกการตั้งค่าระบบส่วนกลางสำเร็จ');
      refreshSettings();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN']}>
      <DashboardContent maxWidth="md">
        <CustomBreadcrumbs
          heading="ตั้งค่าระบบส่วนกลาง"
          links={[{ name: 'ศูนย์บริหารเครือข่าย' }, { name: 'ตั้งค่าระบบส่วนกลาง' }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {settingsLoading ? (
          <LoadingScreen />
        ) : (
          <Card sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              ค่ามาตรฐานกลางที่ระบบจะใช้เป็นค่าเริ่มต้น เมื่อโรงพยาบาลไม่ได้ระบุค่าของตัวเองไว้เฉพาะจุด
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="RSSI Threshold เริ่มต้น"
                  value={values.defaultRssiThresholdDbm}
                  onChange={(e) => handleChange('defaultRssiThresholdDbm', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="solar:signal-broken-bold-duotone" width={20} />
                      </InputAdornment>
                    ),
                    endAdornment: <InputAdornment position="end">dBm</InputAdornment>,
                  }}
                  helperText="ใช้เมื่อเพิ่มอุปกรณ์ RFID ใหม่โดยไม่ได้ระบุค่าความแรงสัญญาณขั้นต่ำเอง"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="% เตือนผ้าคงเหลือน้อยเริ่มต้น"
                  value={values.defaultParLevelWarningPct}
                  onChange={(e) => handleChange('defaultParLevelWarningPct', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="solar:box-minimalistic-bold-duotone" width={20} />
                      </InputAdornment>
                    ),
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText="ใช้เมื่อตั้งค่า Par Level ตู้แผนกใหม่โดยไม่ได้ระบุ % แจ้งเตือนเอง"
                />
              </Grid>
            </Grid>

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 4 }}>
              <Button
                color="inherit"
                sx={{ mr: 1.5 }}
                disabled={!isDirty || submitting}
                onClick={() => setValues(buildFormState(settings))}
              >
                ยกเลิก
              </Button>
              <LoadingButton
                variant="contained"
                loading={submitting}
                disabled={!isDirty}
                onClick={handleSave}
              >
                บันทึก
              </LoadingButton>
            </Stack>
          </Card>
        )}
      </DashboardContent>
    </RoleBasedGuard>
  );
}
