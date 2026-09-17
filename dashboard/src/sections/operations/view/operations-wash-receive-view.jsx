'use client';

import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Grid from '@mui/material/Grid';
import NoSsr from '@mui/material/NoSsr';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';

import { useTabs } from 'src/hooks/use-tabs';
import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { varAlpha } from 'src/theme/styles';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetWashReceiveReport } from 'src/actions/washReceiveReport';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { WashReceiveScanCard } from './wash-receive-scan-card';
import { WashReceiveReportPDF } from '../wash-receive-report-pdf';
import { WashReceiveBatchesTable } from './wash-receive-batches-table';
import { WashReceiveDateFilterCard } from './wash-receive-date-filter-card';
import { WashReceiveCategoryBreakdownCard } from './wash-receive-category-breakdown-card';

// ----------------------------------------------------------------------

const TABS = [
  {
    value: 'scan',
    label: 'สแกน + ชั่งน้ำหนัก',
    icon: <Iconify icon="solar:scale-bold-duotone" width={22} />,
  },
  {
    value: 'overview',
    label: 'ภาพรวม',
    icon: <Iconify icon="solar:chart-2-bold-duotone" width={22} />,
  },
  {
    value: 'history',
    label: 'ประวัติชุดสแกน',
    icon: <Iconify icon="solar:history-bold-duotone" width={22} />,
  },
];

export function OperationsWashReceiveView() {
  const theme = useTheme();
  const { hospitalId } = useEffectiveHospital();
  const tabs = useTabs('scan');

  const [startDate, setStartDate] = useState(dayjs());
  const [endDate, setEndDate] = useState(dayjs());
  const [activePreset, setActivePreset] = useState('วันนี้');

  const { range, totals, byCategory, batches, reportLoading, refreshReport } =
    useGetWashReceiveReport(hospitalId, {
      startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
      endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined,
    });

  // ผ้าถูกสแกน+ชั่งเข้ามาจากที่ไหนก็ตาม (หน้านี้เอง หรืออุปกรณ์จริงในอนาคต) -> รีเฟรชสรุป/ตารางทันที
  useSocketEvent('scan:wash-receive', refreshReport);

  const handlePreset = (preset) => {
    const [from, to] = preset.getRange();
    setStartDate(from);
    setEndDate(to);
    setActivePreset(preset.label);
  };

  const chartColors = useMemo(
    () => [
      theme.palette.primary.main,
      theme.palette.info.main,
      theme.palette.warning.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.error.main,
      theme.palette.primary.dark,
      theme.palette.info.dark,
    ],
    [theme]
  );

  // แม็ปหมวดหมู่ -> สีเดียวกันทั้งหน้า (กราฟสรุป, ตารางประวัติ) เรียงตามยอดมากไปน้อยเพื่อให้สีคงที่
  const categoryColorMap = useMemo(() => {
    const sorted = [...byCategory].sort((a, b) => b.itemCount - a.itemCount);
    const map = new Map();
    sorted.forEach((row, i) => map.set(row.categoryName, chartColors[i % chartColors.length]));
    return map;
  }, [byCategory, chartColors]);

  const getCategoryColor = (name) => categoryColorMap.get(name) ?? theme.palette.grey[500];

  const exportPdfButton = (
    <NoSsr>
      <PDFDownloadLink
        document={
          <WashReceiveReportPDF range={range} totals={totals} byCategory={byCategory} batches={batches} />
        }
        fileName={`wash-receive-report-${range?.from ?? ''}-${range?.to ?? ''}.pdf`}
        style={{ textDecoration: 'none' }}
      >
        {({ loading }) => (
          <Button
            variant="contained"
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Iconify icon="solar:file-download-bold-duotone" />
              )
            }
            disabled={loading || !hospitalId}
          >
            Export PDF
          </Button>
        )}
      </PDFDownloadLink>
    </NoSsr>
  );

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="รับผ้าหลังซัก & ชั่งน้ำหนักผ้า"
        links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'รับผ้าหลังซัก & ชั่งน้ำหนักผ้า' }]}
        sx={{ mb: { xs: 3, md: 4 } }}
      />

      {!hospitalId ? (
        <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
      ) : (
        <>
          <Tabs
            value={tabs.value}
            onChange={tabs.onChange}
            sx={{
              mb: 3,
              boxShadow: (t) => `inset 0 -2px 0 0 ${varAlpha(t.vars.palette.grey['500Channel'], 0.08)}`,
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

          {tabs.value === 'scan' && (
            <WashReceiveScanCard hospitalId={hospitalId} onSubmitted={() => refreshReport()} />
          )}

          {tabs.value !== 'scan' && (
            <Stack spacing={3}>
              <WashReceiveDateFilterCard
                startDate={startDate}
                endDate={endDate}
                activePreset={activePreset}
                onChangeStartDate={(v) => {
                  setStartDate(v);
                  setActivePreset(null);
                }}
                onChangeEndDate={(v) => {
                  setEndDate(v);
                  setActivePreset(null);
                }}
                onSelectPreset={handlePreset}
                action={exportPdfButton}
              />

              {reportLoading ? (
                <LoadingScreen />
              ) : (
                <>
                  {tabs.value === 'overview' && (
                    <>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <StatCard
                            icon="solar:clipboard-list-bold-duotone"
                            title="ชุดสแกน+ชั่ง"
                            value={totals.totalBatches}
                            color="info"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <StatCard
                            icon="solar:t-shirt-bold-duotone"
                            title="ผ้าที่รับเข้า (ชิ้น)"
                            value={totals.totalItems}
                            color="primary"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <StatCard
                            icon="solar:scale-bold-duotone"
                            title="น้ำหนักรวม (กก.)"
                            value={totals.totalWeightKg.toLocaleString('th-TH')}
                            color="warning"
                          />
                        </Grid>
                      </Grid>

                      <WashReceiveCategoryBreakdownCard
                        byCategory={byCategory}
                        getCategoryColor={getCategoryColor}
                      />
                    </>
                  )}

                  {tabs.value === 'history' && (
                    <WashReceiveBatchesTable batches={batches} getCategoryColor={getCategoryColor} />
                  )}
                </>
              )}
            </Stack>
          )}
        </>
      )}
    </DashboardContent>
  );
}
