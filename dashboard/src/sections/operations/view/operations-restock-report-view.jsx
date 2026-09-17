'use client';

import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Grid from '@mui/material/Grid';
import NoSsr from '@mui/material/NoSsr';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';

import { useTabs } from 'src/hooks/use-tabs';
import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { fDate } from 'src/utils/format-time';
import { sanitizeFileName } from 'src/utils/export-excel';

import { varAlpha } from 'src/theme/styles';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetRestockReport } from 'src/actions/restockReport';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';

import { RestockReportPDF } from '../restock-report-pdf';
import { RestockRoundsCard } from './restock-rounds-card';
import { RestockHistoryCard } from './restock-history-card';
import { RestockForecastCard } from './restock-forecast-card';
import { RestockHighlightsCard } from './restock-highlights-card';
import { RestockTrendChartCard } from './restock-trend-chart-card';
import { RestockDateFilterCard } from './restock-date-filter-card';
import { RestockWardSummaryCard } from './restock-ward-summary-card';
import { RestockFillHistoryCard } from './restock-fill-history-card';
import { RestockBuildingSummaryCard } from './restock-building-summary-card';

// ----------------------------------------------------------------------

const DETAIL_TABS = [
  {
    value: 'building',
    label: 'สรุปตามตึก',
    icon: <Iconify icon="solar:buildings-2-bold-duotone" width={22} />,
  },
  {
    value: 'ward',
    label: 'สรุปตามวอร์ด',
    icon: <Iconify icon="solar:hospital-bold-duotone" width={22} />,
  },
  {
    value: 'forecast',
    label: 'คาดการณ์การใช้ผ้า',
    icon: <Iconify icon="solar:test-tube-bold-duotone" width={22} />,
  },
  {
    value: 'rounds',
    label: 'รอบตรวจนับ/เติมผ้า',
    icon: <Iconify icon="solar:clipboard-list-bold-duotone" width={22} />,
  },
  {
    value: 'history',
    label: 'ประวัติรายชิ้น',
    icon: <Iconify icon="solar:document-text-bold-duotone" width={22} />,
  },
  {
    value: 'fill-history',
    label: 'ประวัติยอดการเติมผ้า',
    icon: <Iconify icon="solar:history-3-bold-duotone" width={22} />,
  },
];

// ----------------------------------------------------------------------

export function OperationsRestockReportView() {
  const theme = useTheme();
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin, hospitals } = useEffectiveHospital();
  // ใส่ชื่อโรงพยาบาลลงในรายงาน export ทุกอัน (ดู HospitalContextChip ที่ใช้ pattern เดียวกัน) —
  // superadmin ดูได้หลายโรงพยาบาล ต้องหาชื่อจาก hospitals ที่โหลดมา ส่วน admin/operator มี
  // hospital_name ติดมากับ user อยู่แล้วเพราะสังกัดโรงพยาบาลเดียว
  const hospitalName = isSuperadmin
    ? hospitals.find((h) => h.id === hospitalId)?.name
    : user?.hospital_name;

  const [startDate, setStartDate] = useState(dayjs().subtract(6, 'day'));
  const [endDate, setEndDate] = useState(dayjs());
  const [activePreset, setActivePreset] = useState('7 วันล่าสุด');

  const {
    range,
    totals,
    history,
    summaryByWard,
    rounds,
    dailyChart,
    forecast,
    reportLoading,
    refreshReport,
  } = useGetRestockReport(hospitalId, {
    startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
    endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined,
  });

  // ผ้าถูกจ่ายเข้าตู้จากที่ไหนก็ตาม (หน้าเว็บนี้เอง หรือมือถือ operator เครื่องอื่น) -> รีเฟรช
  // รายงานทันที ไม่ต้องรอกดฟิลเตอร์ใหม่
  useSocketEvent('scan:ward-issue', refreshReport);

  const handlePreset = (preset) => {
    const [from, to] = preset.getRange();
    setStartDate(from);
    setEndDate(to);
    setActivePreset(preset.label);
  };

  // จัดกลุ่ม summaryByWard ตามวอร์ด เพื่อโชว์เป็นการ์ดย่อยแยกวอร์ด
  const wardGroups = useMemo(() => {
    const map = new Map();
    summaryByWard.forEach((row) => {
      const key = row.wardName;
      if (!map.has(key)) map.set(key, { wardName: key, total: 0, categories: [] });
      const group = map.get(key);
      group.total += row.count;
      group.categories.push(row);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [summaryByWard]);

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

  // เรียงหมวดหมู่จากมากไปน้อยตามยอดรวม 30 วัน แล้วใช้ลำดับเดียวกันนี้ทั้งการ stack กราฟ (หมวดที่ใช้
  // เยอะสุดอยู่ฐานล่างเสมอ ทุกแท่งเรียงสีเหมือนกัน) และแม็ปสีไปใช้กับจุดสี/ไอคอนของหมวดหมู่ผ้าที่อื่น
  // ในหน้านี้ (การ์ดวอร์ด, ตาราง forecast, ประวัติรายชิ้น) เพื่อให้จำสีต่อหมวดหมู่ได้ทั้งหน้า
  const sortedDailyChart = useMemo(() => {
    const sortedSeries = [...dailyChart.series].sort(
      (a, b) => b.data.reduce((s, v) => s + v, 0) - a.data.reduce((s, v) => s + v, 0)
    );
    return { days: dailyChart.days, series: sortedSeries };
  }, [dailyChart]);

  const categoryColorMap = useMemo(() => {
    const map = new Map();
    sortedDailyChart.series.forEach((s, i) => map.set(s.name, chartColors[i % chartColors.length]));
    return map;
  }, [sortedDailyChart, chartColors]);

  const getCategoryColor = (name) => categoryColorMap.get(name) ?? theme.palette.grey[500];

  // ไฮไลท์เด่นของช่วงเวลาที่เลือก โชว์คู่กราฟแนวโน้มโดยไม่ต้องไล่อ่านตาราง/กราฟทั้งหมด
  const peakDay = useMemo(() => {
    const totalsPerDay = sortedDailyChart.days.map((_, i) =>
      sortedDailyChart.series.reduce((sum, s) => sum + (s.data[i] ?? 0), 0)
    );
    const max = Math.max(...totalsPerDay, 0);
    const idx = totalsPerDay.indexOf(max);
    return idx >= 0 && max > 0 ? sortedDailyChart.days[idx] : null;
  }, [sortedDailyChart]);

  const topWard = wardGroups[0] ?? null;

  const topCategory = useMemo(() => {
    if (sortedDailyChart.series.length === 0) return null;
    const top = sortedDailyChart.series[0];
    return { name: top.name, total: top.data.reduce((s, v) => s + v, 0) };
  }, [sortedDailyChart]);

  const tabs = useTabs('building');

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="ประวัติ & วิเคราะห์การเติมผ้าประจำวอร์ด"
        links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'ประวัติ & วิเคราะห์การเติมผ้า' }]}
        action={
          <NoSsr>
            <PDFDownloadLink
              document={
                <RestockReportPDF
                  hospitalName={hospitalName}
                  range={range}
                  totals={totals}
                  wardGroups={wardGroups}
                  rounds={rounds}
                  forecast={forecast}
                />
              }
              fileName={`restock-report-${hospitalName ? `${sanitizeFileName(hospitalName)}-` : ''}${range?.from ?? ''}-${range?.to ?? ''}.pdf`}
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
        }
        sx={{ mb: { xs: 3, md: 4 } }}
      />

      {!hospitalId ? (
        <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <RestockDateFilterCard
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
          />

          {reportLoading ? (
            <LoadingScreen />
          ) : (
            <>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={4}>
                  <StatCard
                    icon="solar:t-shirt-bold-duotone"
                    title="ครั้งที่เติมผ้า"
                    value={totals.totalEvents}
                    color="primary"
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <StatCard
                    icon="solar:transfer-horizontal-bold-duotone"
                    title="โอนผ้าข้ามตู้"
                    value={totals.totalTransfers}
                    color="warning"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <StatCard
                    icon="solar:clipboard-list-bold-duotone"
                    title="รอบตรวจนับ/เติมผ้า"
                    value={totals.totalRounds}
                    color="info"
                  />
                </Grid>
              </Grid>

              <Grid container spacing={3} alignItems="stretch">
                <Grid item xs={12} md={8}>
                  <RestockTrendChartCard dailyChart={sortedDailyChart} chartColors={chartColors} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <RestockHighlightsCard
                    peakDayLabel={peakDay ? fDate(peakDay) : null}
                    topWard={topWard}
                    topCategory={topCategory}
                  />
                </Grid>
              </Grid>

              <Card>
                <Tabs
                  value={tabs.value}
                  onChange={tabs.onChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                  sx={{
                    px: 2.5,
                    boxShadow: (t) =>
                      `inset 0 -2px 0 0 ${varAlpha(t.vars.palette.grey['500Channel'], 0.08)}`,
                  }}
                >
                  {DETAIL_TABS.map((tab) => (
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

              {tabs.value === 'building' && (
                <RestockBuildingSummaryCard hospitalId={hospitalId} hospitalName={hospitalName} />
              )}

              {tabs.value === 'ward' && (
                <RestockWardSummaryCard
                  hospitalId={hospitalId}
                  hospitalName={hospitalName}
                  getCategoryColor={getCategoryColor}
                />
              )}

              {tabs.value === 'forecast' && (
                <RestockForecastCard forecast={forecast} getCategoryColor={getCategoryColor} />
              )}

              {tabs.value === 'rounds' && <RestockRoundsCard rounds={rounds} range={range} />}

              {tabs.value === 'history' && (
                <RestockHistoryCard
                  history={history}
                  onRefresh={() => refreshReport()}
                  getCategoryColor={getCategoryColor}
                />
              )}

              {tabs.value === 'fill-history' && (
                <RestockFillHistoryCard hospitalId={hospitalId} hospitalName={hospitalName} />
              )}
            </>
          )}
        </Box>
      )}
    </DashboardContent>
  );
}
