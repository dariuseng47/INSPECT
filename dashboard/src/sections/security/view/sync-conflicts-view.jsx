'use client';

import { useState } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';

import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { fDateTime } from 'src/utils/format-time';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetSyncConflicts, approveSyncConflict } from 'src/actions/sync';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

const EVENT_TYPE_LABEL = {
  WARD_ISSUE: 'จ่ายผ้าไปตู้แผนก',
  WARD_RECEIVE: 'รับผ้ากลับเข้าซัก',
};

function CandidateCard({ label, candidate, cabinetName, onApprove, approving }) {
  return (
    <Card variant="outlined" sx={{ flex: 1 }}>
      <CardContent>
        <Stack spacing={1}>
          <Chip size="small" label={`Candidate ${label}`} sx={{ alignSelf: 'flex-start' }} />
          <Typography variant="subtitle2">{EVENT_TYPE_LABEL[candidate.eventType] ?? candidate.eventType}</Typography>
          {cabinetName && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              ตู้ปลายทาง: {cabinetName}
            </Typography>
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            ผู้สแกน: {candidate.userName ?? '—'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            เวลา: {fDateTime(candidate.scannedAt)}
          </Typography>
          <LoadingButton
            variant="contained"
            size="small"
            loading={approving}
            onClick={onApprove}
            sx={{ mt: 1 }}
          >
            เลือกก้อนนี้
          </LoadingButton>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function SyncConflictsView() {
  const { user } = useAuthContext();
  const isSuperadmin = user?.role === 'SUPERADMIN';

  const { hospitals } = useEffectiveHospital();
  const [hospitalFilter, setHospitalFilter] = useState('');

  const { conflicts, conflictsLoading, conflictsEmpty, refreshConflicts } = useGetSyncConflicts(
    isSuperadmin ? hospitalFilter || undefined : undefined
  );
  const [approvingKey, setApprovingKey] = useState('');

  // มือถือออฟไลน์ 2 เครื่อง sync มาชนกัน -> ขึ้นรายการรอตรวจสอบทันที ไม่ต้องรอรีเฟรชเอง
  useSocketEvent('sync:conflict_detected', (payload) => {
    toast.info(`พบข้อมูลชนกันใหม่: ${payload.epcCode}`);
    refreshConflicts();
  });
  useSocketEvent('sync:conflict_resolved', refreshConflicts);

  const handleApprove = async (conflict, chosen) => {
    const key = `${conflict.id}-${chosen}`;
    setApprovingKey(key);
    try {
      await approveSyncConflict(conflict.id, chosen);
      toast.success('เลือกข้อมูลที่ถูกต้องสำเร็จ');
      refreshConflicts();
    } catch (error) {
      toast.error(error?.message || 'ดำเนินการไม่สำเร็จ');
    } finally {
      setApprovingKey('');
    }
  };

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="xl">
        {!isSuperadmin && <HospitalContextChip sx={{ mb: 1.5 }} />}

        <CustomBreadcrumbs
          heading="ข้อมูลชนกันจากออฟไลน์"
          links={[{ name: 'ความปลอดภัย & ตั้งค่าระบบ' }, { name: 'ข้อมูลชนกันจากออฟไลน์' }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {isSuperadmin && (
          <TextField
            select
            label="โรงพยาบาล"
            value={hospitalFilter}
            onChange={(e) => setHospitalFilter(e.target.value)}
            sx={{ minWidth: 220, mb: 3 }}
          >
            <MenuItem value="">ทุกโรงพยาบาล</MenuItem>
            {hospitals.map((h) => (
              <MenuItem key={h.id} value={h.id}>
                {h.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        {conflictsLoading ? (
          <LoadingScreen />
        ) : conflictsEmpty ? (
          <EmptyContent
            title="ไม่มีข้อมูลชนกันรอตรวจสอบ"
            description="เมื่อมือถือออฟไลน์ 2 เครื่องสแกนผ้าชิ้นเดียวกันไปคนละที่พร้อมกัน ระบบจะขึ้นรายการรอเลือกที่นี่"
            sx={{ py: 10 }}
          />
        ) : (
          <Stack spacing={3}>
            {conflicts.map((row) => (
              <Card key={row.id}>
                <CardHeader
                  avatar={<Iconify icon="solar:shuffle-bold-duotone" width={24} sx={{ color: 'warning.main' }} />}
                  title={`EPC: ${row.epc_code}`}
                  subheader={
                    isSuperadmin
                      ? `${row.hospital_name} — ตรวจพบเมื่อ ${fDateTime(row.created_at)}`
                      : `ตรวจพบเมื่อ ${fDateTime(row.created_at)}`
                  }
                />
                <CardContent sx={{ pt: 0 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <CandidateCard
                      label="A"
                      candidate={{
                        eventType: row.a_event_type,
                        userName: row.a_user_name,
                        scannedAt: row.a_scanned_at,
                      }}
                      cabinetName={row.a_cabinet_name}
                      approving={approvingKey === `${row.id}-A`}
                      onApprove={() => handleApprove(row, 'A')}
                    />
                    <CandidateCard
                      label="B"
                      candidate={{
                        eventType: row.b_event_type,
                        userName: row.b_user_name,
                        scannedAt: row.b_scanned_at,
                      }}
                      cabinetName={row.b_cabinet_name}
                      approving={approvingKey === `${row.id}-B`}
                      onApprove={() => handleApprove(row, 'B')}
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </DashboardContent>
    </RoleBasedGuard>
  );
}
