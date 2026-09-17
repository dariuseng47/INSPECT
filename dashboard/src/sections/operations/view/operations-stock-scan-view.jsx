'use client';

import Stack from '@mui/material/Stack';

import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetStockScanRounds } from 'src/actions/stockScanRounds';

import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { StockScanCard } from './stock-scan-card';
import { StockScanRoundsTable } from './stock-scan-rounds-table';

// ----------------------------------------------------------------------

export function OperationsStockScanView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();

  const { rounds, refreshRounds } = useGetStockScanRounds(hospitalId);

  // ผ้าถูกสแกนเข้าสต๊อคจากที่ไหนก็ตาม -> รีเฟรชประวัติรอบการสแกนทันที
  useSocketEvent('scan:stock-scan', refreshRounds);

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN', 'OPERATOR']}>
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="สแกนเข้าสต๊อค"
          links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'สแกนเข้าสต๊อค' }]}
          sx={{ mb: { xs: 3, md: 4 } }}
        />

        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
        ) : (
          <Stack spacing={3}>
            <StockScanCard hospitalId={hospitalId} onConfirmed={() => refreshRounds()} />
            <StockScanRoundsTable rounds={rounds} />
          </Stack>
        )}
      </DashboardContent>
    </RoleBasedGuard>
  );
}
