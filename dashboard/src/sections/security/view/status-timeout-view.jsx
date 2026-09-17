'use client';

import { useMemo, useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetStatusTimeouts, updateStatusTimeouts } from 'src/actions/statusTimeouts';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { STATUS_LABEL } from '../../fabric/fabric-constants';

// ----------------------------------------------------------------------

// เฉพาะสถานะที่อยู่ระหว่างกระบวนการ (ไม่รวม WARD_CABINET/IN_USE_WARD ที่ตั้งใจให้ค้างได้นาน
// และไม่รวม HOLD/DECOMMISSIONED ที่เป็น exception state อยู่แล้ว) — ตรงกับ ENUM ฝั่ง backend
const TIMEOUT_STATUSES = ['WASH', 'CENTRAL_STOCK'];

const STATUS_ICON = {
  WASH: 'solar:washing-machine-bold-duotone',
  CENTRAL_STOCK: 'solar:box-bold-duotone',
};

function buildFormState(settings) {
  const byStatus = new Map(settings.map((s) => [s.status, s.max_hours]));
  return TIMEOUT_STATUSES.reduce((acc, status) => {
    acc[status] = byStatus.has(status) ? String(byStatus.get(status)) : '';
    return acc;
  }, {});
}

export function StatusTimeoutView() {
  const { user } = useAuthContext();
  const { hospitalId, hospitalsLoading } = useEffectiveHospital();

  const { statusTimeouts, statusTimeoutsLoading, refreshStatusTimeouts } =
    useGetStatusTimeouts(hospitalId);

  const [values, setValues] = useState(() => buildFormState([]));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(buildFormState(statusTimeouts));
  }, [statusTimeouts]);

  const isDirty = useMemo(() => {
    const current = buildFormState(statusTimeouts);
    return TIMEOUT_STATUSES.some((status) => current[status] !== values[status]);
  }, [statusTimeouts, values]);

  const handleChange = (status, value) => {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setValues((prev) => ({ ...prev, [status]: value }));
  };

  const handleSave = async () => {
    const settings = TIMEOUT_STATUSES.filter((status) => values[status] !== '').map((status) => ({
      status,
      maxHours: Number(values[status]),
    }));

    setSubmitting(true);
    try {
      await updateStatusTimeouts(hospitalId, settings);
      toast.success('บันทึกการตั้งค่าเวลาค้างสถานะสำเร็จ');
      refreshStatusTimeouts();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const loading = hospitalsLoading || statusTimeoutsLoading;

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="md">
        <Stack spacing={1} sx={{ mb: { xs: 3, md: 5 } }}>
          <HospitalContextChip />
          <CustomBreadcrumbs
            heading="ตั้งค่าเวลาค้างสถานะ"
            links={[{ name: 'ความปลอดภัย & ตั้งค่าระบบ' }, { name: 'ตั้งค่าเวลาค้างสถานะ' }]}
          />
        </Stack>

        {!hospitalId ? (
          <EmptyContent title="ไม่พบข้อมูลโรงพยาบาล" sx={{ py: 10 }} />
        ) : loading ? (
          <LoadingScreen />
        ) : (
          <Card sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              กำหนดจำนวนชั่วโมงสูงสุดที่ยอมให้ผ้าค้างอยู่ในแต่ละสถานะ หากเกินเวลาที่ตั้งไว้ระบบจะแจ้งเตือนในหน้า
              &quot;แจ้งเตือน & ข้อยกเว้น&quot; — เว้นว่างไว้หากไม่ต้องการตั้งเวลาแจ้งเตือนสำหรับสถานะนั้น
            </Typography>

            <Grid container spacing={2.5}>
              {TIMEOUT_STATUSES.map((status) => (
                <Grid item xs={12} sm={6} key={status}>
                  <TextField
                    fullWidth
                    label={STATUS_LABEL[status]}
                    value={values[status]}
                    onChange={(e) => handleChange(status, e.target.value)}
                    placeholder="ไม่กำหนด"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Iconify icon={STATUS_ICON[status]} width={20} />
                        </InputAdornment>
                      ),
                      endAdornment: <InputAdornment position="end">ชั่วโมง</InputAdornment>,
                    }}
                  />
                </Grid>
              ))}
            </Grid>

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 4 }}>
              <Button
                color="inherit"
                sx={{ mr: 1.5 }}
                disabled={!isDirty || submitting}
                onClick={() => setValues(buildFormState(statusTimeouts))}
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
