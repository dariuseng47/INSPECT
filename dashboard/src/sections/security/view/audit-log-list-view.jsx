'use client';

import { useMemo, useState } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { fDateTime } from 'src/utils/format-time';

import { useGetAuditLogs } from 'src/actions/auditLogs';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

const ACTION_META = {
  LOGIN: { label: 'เข้าสู่ระบบ', color: 'info', icon: 'solar:login-3-bold-duotone' },
  LOGOUT: { label: 'ออกจากระบบ', color: 'default', icon: 'solar:logout-3-bold-duotone' },
  USER_CREATED: { label: 'สร้างบัญชีผู้ใช้', color: 'success', icon: 'solar:user-plus-bold-duotone' },
  USER_UPDATED: { label: 'แก้ไขบัญชีผู้ใช้', color: 'warning', icon: 'solar:user-id-bold-duotone' },
  USER_DELETED: { label: 'ลบบัญชีผู้ใช้', color: 'error', icon: 'solar:user-cross-bold-duotone' },
  HOSPITAL_CREATED: {
    label: 'สร้างโรงพยาบาล',
    color: 'success',
    icon: 'solar:buildings-2-bold-duotone',
  },
  HOSPITAL_UPDATED: {
    label: 'แก้ไขโรงพยาบาล',
    color: 'warning',
    icon: 'solar:buildings-2-bold-duotone',
  },
  HOSPITAL_DELETED: {
    label: 'ลบโรงพยาบาล',
    color: 'error',
    icon: 'solar:buildings-2-bold-duotone',
  },
  PERMISSION_UPDATED: {
    label: 'แก้ไขสิทธิ์การเข้าถึง',
    color: 'warning',
    icon: 'solar:shield-user-bold-duotone',
  },
  CROSS_TENANT_READ: {
    label: 'เข้าดูข้อมูลข้ามโรงพยาบาล',
    color: 'info',
    icon: 'solar:eye-bold-duotone',
  },
};

function actionMeta(action) {
  return ACTION_META[action] ?? { label: action, color: 'default', icon: 'solar:document-bold-duotone' };
}

function formatDetail(row) {
  const { action, entity_type: entityType, entity_id: entityId, metadata } = row;

  switch (action) {
    case 'USER_CREATED':
      return `${metadata?.username ?? '—'} (${metadata?.role ?? '—'})`;
    case 'USER_DELETED':
      return metadata?.username ?? '—';
    case 'HOSPITAL_CREATED':
    case 'HOSPITAL_UPDATED':
      return metadata?.name ?? '—';
    case 'PERMISSION_UPDATED':
      return `แก้ไข ${metadata?.overrides?.length ?? 0} รายการ`;
    case 'CROSS_TENANT_READ':
      return `โรงพยาบาล #${metadata?.hospitalId ?? entityId ?? '—'}`;
    default:
      return entityType ? `${entityType}${entityId ? ` #${entityId}` : ''}` : '—';
  }
}

export function AuditLogListView() {
  const { user } = useAuthContext();
  const isSuperadmin = user?.role === 'SUPERADMIN';

  const { hospitals } = useEffectiveHospital();

  const [hospitalFilter, setHospitalFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { auditLogs, auditLogsLoading, auditLogsEmpty } = useGetAuditLogs({
    hospitalId: isSuperadmin ? hospitalFilter || undefined : undefined,
    action: actionFilter || undefined,
    limit: 200,
  });

  const hospitalNameById = useMemo(
    () => new Map(hospitals.map((h) => [h.id, h.name])),
    [hospitals]
  );

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="xl">
        <Stack spacing={1} sx={{ mb: { xs: 3, md: 5 } }}>
          {!isSuperadmin && <HospitalContextChip />}
          <CustomBreadcrumbs
            heading="ประวัติการใช้งานระบบ"
            links={[{ name: 'ความปลอดภัย & ตั้งค่าระบบ' }, { name: 'ประวัติการใช้งานระบบ' }]}
          />
        </Stack>

        <Card>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            {isSuperadmin && (
              <TextField
                select
                label="โรงพยาบาล"
                value={hospitalFilter}
                onChange={(e) => setHospitalFilter(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">ทุกโรงพยาบาล</MenuItem>
                {hospitals.map((h) => (
                  <MenuItem key={h.id} value={h.id}>
                    {h.name}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              select
              label="การกระทำ"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">ทุกประเภท</MenuItem>
              {Object.keys(ACTION_META).map((key) => (
                <MenuItem key={key} value={key}>
                  {ACTION_META[key].label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {auditLogsLoading ? (
            <LoadingScreen />
          ) : auditLogsEmpty ? (
            <EmptyContent title="ไม่พบประวัติการใช้งาน" sx={{ py: 10 }} />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 720 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>เวลา</TableCell>
                      <TableCell>ผู้ใช้</TableCell>
                      <TableCell>การกระทำ</TableCell>
                      <TableCell>รายละเอียด</TableCell>
                      {isSuperadmin && <TableCell>โรงพยาบาล</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.map((row) => {
                      const meta = actionMeta(row.action);

                      return (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {fDateTime(row.created_at)}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{row.user_full_name ?? '—'}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {row.username ?? `user #${row.user_id}`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              variant="soft"
                              color={meta.color}
                              icon={<Iconify icon={meta.icon} width={16} />}
                              label={meta.label}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              {formatDetail(row)}
                            </Typography>
                          </TableCell>
                          {isSuperadmin && (
                            <TableCell>
                              {row.hospital_name ?? hospitalNameById.get(row.hospital_id) ?? '—'}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </Card>
      </DashboardContent>
    </RoleBasedGuard>
  );
}
