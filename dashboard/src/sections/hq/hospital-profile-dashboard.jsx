'use client';

import { useMemo } from 'react';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';

import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { STATUS_LABEL } from '../fabric/fabric-constants';

// ----------------------------------------------------------------------

export function QuickLinkCard({ icon, title, description, href }) {
  return (
    <CardActionArea
      component={RouterLink}
      href={href}
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: (theme) => `1px solid ${theme.vars.palette.divider}`,
        transition: (theme) => theme.transitions.create(['box-shadow', 'border-color']),
        '&:hover': { boxShadow: (theme) => theme.customShadows?.z8 ?? 4, borderColor: 'primary.main' },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Stack
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 1.5,
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'primary.lighter',
            color: 'primary.dark',
          }}
        >
          <Iconify icon={icon} width={22} />
        </Stack>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">{title}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {description}
          </Typography>
        </Stack>
      </Stack>
    </CardActionArea>
  );
}

// สรุปสถิติ + สถานะผ้าของโรงพยาบาลเดียว — ใช้ร่วมกันระหว่างหน้า HQ (superadmin ดูได้ทุก รพ.)
// และหน้าแดชบอร์ดโปรไฟล์ของตัวเอง (admin/operator ที่ได้รับสิทธิ์ ดูได้เฉพาะ รพ. ตัวเอง)
export function HospitalProfileDashboard({ hospital, summary, loading }) {
  const totalFabric = useMemo(
    () => summary?.fabricByStatus?.reduce((sum, row) => sum + Number(row.count), 0) ?? 0,
    [summary]
  );
  const onlineDevices = useMemo(
    () => summary?.devicesByStatus?.find((row) => row.status === 'ONLINE')?.count ?? 0,
    [summary]
  );
  const offlineDevices = useMemo(
    () => summary?.devicesByStatus?.find((row) => row.status === 'OFFLINE')?.count ?? 0,
    [summary]
  );

  if (loading) return <LoadingScreen />;
  if (!hospital) return <EmptyContent title="ไม่พบโรงพยาบาลนี้" sx={{ py: 10 }} />;

  return (
    <Stack spacing={4}>
      <Card sx={{ p: 3 }}>
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.lighter', color: 'primary.dark' }}>
            <Iconify icon="solar:hospital-bold-duotone" width={32} />
          </Avatar>
          <Stack>
            <Typography variant="h5">{hospital.name}</Typography>
            {(hospital.organization_name || hospital.created_at) && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {[
                  hospital.organization_name,
                  hospital.created_at &&
                    `สร้างเมื่อ ${new Date(hospital.created_at).toLocaleDateString('th-TH')}`,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </Typography>
            )}
          </Stack>
        </Stack>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon="solar:t-shirt-bold-duotone" title="ผ้าในระบบทั้งหมด" value={totalFabric} color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon="solar:wi-fi-router-bold-duotone"
            title="อุปกรณ์ออนไลน์"
            value={onlineDevices}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon="solar:wi-fi-router-minimalistic-broken"
            title="อุปกรณ์ออฟไลน์"
            value={offlineDevices}
            color="error"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon="solar:danger-triangle-bold-duotone"
            title="ผ้าข้ามขั้นตอน (7 วันล่าสุด)"
            value={summary?.stepSkippedLast7Days ?? 0}
            color="warning"
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            ผ้าแยกตามสถานะ
          </Typography>
          {summary?.fabricByStatus?.length ? (
            <Stack direction="row" flexWrap="wrap" gap={1.5}>
              {summary.fabricByStatus.map((row) => (
                <Chip
                  key={row.status}
                  label={`${STATUS_LABEL[row.status] ?? row.status}: ${row.count}`}
                  variant="soft"
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              ยังไม่มีข้อมูลผ้าในระบบของโรงพยาบาลนี้
            </Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
