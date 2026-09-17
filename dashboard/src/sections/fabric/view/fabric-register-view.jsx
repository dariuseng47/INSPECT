'use client';

import { useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';

import { useTabs } from 'src/hooks/use-tabs';
import { useBoolean } from 'src/hooks/use-boolean';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { varAlpha } from 'src/theme/styles';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetFabricLots, useGetFabricCategories } from 'src/actions/fabric';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { LotManagerCard } from './lot-manager-card';
import { RegisterItemCard } from './register-item-card';
import { HandheldScanCard } from './handheld-scan-card';
import { CategoryFormDialog } from './category-form-dialog';
import { CheckpointScanCard } from './checkpoint-scan-card';
import { CategoryManagerCard } from './category-manager-card';

// ----------------------------------------------------------------------

const TABS = [
  {
    value: 'lot',
    label: 'ลงทะเบียนล็อตใหม่',
    icon: <Iconify icon="solar:box-bold-duotone" width={22} />,
  },
  {
    value: 'category',
    label: 'หมวดหมู่ผ้า',
    icon: <Iconify icon="solar:tag-bold-duotone" width={22} />,
  },
  {
    value: 'handheld',
    label: 'สแกนด้วย Handheld',
    icon: <Iconify icon="solar:radar-2-bold-duotone" width={22} />,
  },
  {
    value: 'checkpoint',
    label: 'สแกนผ่านจุดตรวจสอบ',
    icon: <Iconify icon="solar:wi-fi-router-bold-duotone" width={22} />,
  },
  {
    value: 'item',
    label: 'ลงทะเบียนรายชิ้น',
    icon: <Iconify icon="solar:t-shirt-bold-duotone" width={22} />,
  },
];

export function FabricRegisterView() {
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin, hospitals } = useEffectiveHospital();
  // ใส่ชื่อโรงพยาบาลลงในรายงาน export ของแท็บ "ลงทะเบียนล็อตใหม่" (ดู pattern เดียวกันใน
  // operations-restock-report-view.jsx)
  const hospitalName = isSuperadmin
    ? hospitals.find((h) => h.id === hospitalId)?.name
    : user?.hospital_name;

  const { categories, categoriesLoading, refreshCategories } = useGetFabricCategories(hospitalId);
  const { lots, lotsLoading, refreshLots } = useGetFabricLots(hospitalId);

  const tabs = useTabs('lot');
  const categoryDialog = useBoolean();

  const handleCategoryCreated = useCallback(() => {
    refreshCategories();
  }, [refreshCategories]);

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="ลงทะเบียนผ้า / ล็อต"
          links={[{ name: 'จัดการผ้าและล็อต' }, { name: 'ลงทะเบียนผ้า / ล็อต' }]}
          sx={{ mb: { xs: 3, md: 4 } }}
        />

        <Card sx={{ mb: 3 }}>
          <Tabs
            value={tabs.value}
            onChange={tabs.onChange}
            sx={{
              px: 2.5,
              boxShadow: (theme) =>
                `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
            }}
          >
            {TABS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                icon={tab.icon}
                iconPosition="start"
                label={tab.label}
              />
            ))}
          </Tabs>
        </Card>

        <Box>
          {tabs.value === 'lot' && (
            <LotManagerCard
              hospitalId={hospitalId}
              hospitalName={hospitalName}
              lots={lots}
              lotsLoading={lotsLoading}
              categories={categories}
              onChanged={refreshLots}
              onWantNewCategory={categoryDialog.onTrue}
            />
          )}

          {tabs.value === 'category' && (
            <CategoryManagerCard
              hospitalId={hospitalId}
              categories={categories}
              categoriesLoading={categoriesLoading}
              onChanged={refreshCategories}
            />
          )}

          {tabs.value === 'handheld' && (
            <HandheldScanCard
              hospitalId={hospitalId}
              lots={lots}
              categories={categories}
              onConfirmed={refreshLots}
            />
          )}

          {tabs.value === 'checkpoint' && (
            <CheckpointScanCard
              hospitalId={hospitalId}
              lots={lots}
              categories={categories}
              onConfirmed={refreshLots}
            />
          )}

          {tabs.value === 'item' && (
            <Box sx={{ maxWidth: 640 }}>
              <RegisterItemCard
                hospitalId={hospitalId}
                categories={categories}
                lots={lots}
                onCreated={refreshLots}
                onWantNewCategory={categoryDialog.onTrue}
              />
            </Box>
          )}
        </Box>

        <CategoryFormDialog
          open={categoryDialog.value}
          onClose={categoryDialog.onFalse}
          mode="create"
          hospitalId={hospitalId}
          onSaved={handleCategoryCreated}
        />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
