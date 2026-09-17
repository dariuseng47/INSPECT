'use client';

import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import NoSsr from '@mui/material/NoSsr';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import { useTheme } from '@mui/material/styles';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import TableContainer from '@mui/material/TableContainer';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useSocketEvent } from 'src/hooks/use-socket-event';

import { fDateTime } from 'src/utils/format-time';
import { exportRowsToExcel } from 'src/utils/export-excel';

import { useGetRestockReport } from 'src/actions/restockReport';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { SectionAvatar } from './restock-section-avatar';
import { WardIssueHistoryReportPDF } from '../ward-issue-history-report-pdf';

// ----------------------------------------------------------------------

const GRANULARITIES = [
  { value: 'day', label: 'รายวัน', unit: 'day', pickerLabel: 'เลือกวัน', views: undefined },
  { value: 'month', label: 'รายเดือน', unit: 'month', pickerLabel: 'เลือกเดือน', views: ['year', 'month'] },
  { value: 'year', label: 'รายปี', unit: 'year', pickerLabel: 'เลือกปี', views: ['year'] },
];

const BUCKET_FORMAT = { day: 'D MMM BBBB', month: 'MMMM BBBB', year: 'ปี BBBB' };
const BUCKET_KEY = { day: 'YYYY-MM-DD', month: 'YYYY-MM', year: 'YYYY' };

const CHART_COLOR_KEYS = ['primary', 'info', 'warning', 'secondary', 'success', 'error'];

// ----------------------------------------------------------------------

function aggregate(history, keyOf, labelOf) {
  const map = new Map();
  history.forEach((h) => {
    const key = keyOf(h);
    if (!map.has(key)) map.set(key, { key, label: labelOf(h), count: 0, transferCount: 0 });
    const entry = map.get(key);
    entry.count += 1;
    if (h.isTransfer) entry.transferCount += 1;
  });
  return [...map.values()];
}

// ----------------------------------------------------------------------

export function WardIssueHistoryView({ hospitalId }) {
  const theme = useTheme();

  const [granularity, setGranularity] = useState('day');
  const [anchor, setAnchor] = useState(dayjs());

  const activeGran = GRANULARITIES.find((g) => g.value === granularity) ?? GRANULARITIES[0];

  const range = useMemo(
    () => ({
      start: anchor.startOf(activeGran.unit),
      end: anchor.endOf(activeGran.unit),
    }),
    [anchor, activeGran.unit]
  );

  const {
    range: reportRange,
    totals,
    history,
    reportLoading,
    refreshReport,
  } = useGetRestockReport(hospitalId, {
    startDate: range.start.format('YYYY-MM-DD'),
    endDate: range.end.format('YYYY-MM-DD'),
  });

  // ผ้าถูกจ่ายเข้าตู้จากที่ไหนก็ตาม (มือถือ operator เครื่องอื่น) -> รีเฟรชประวัติทันที
  useSocketEvent('scan:ward-issue', refreshReport);

  const byBucket = useMemo(() => {
    const rows = aggregate(
      history,
      (h) => dayjs(h.scannedAt).format(BUCKET_KEY[granularity]),
      (h) => dayjs(h.scannedAt).locale('th').format(BUCKET_FORMAT[granularity])
    );
    return rows.sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [history, granularity]);

  const byCategory = useMemo(() => {
    const rows = aggregate(history, (h) => h.categoryName, (h) => h.categoryName);
    return rows.sort((a, b) => b.count - a.count);
  }, [history]);

  const byWard = useMemo(() => {
    const rows = aggregate(history, (h) => h.wardName, (h) => h.wardName);
    return rows.sort((a, b) => b.count - a.count);
  }, [history]);

  const categoryColorMap = useMemo(() => {
    const map = new Map();
    byCategory.forEach((row, i) => {
      map.set(row.label, theme.palette[CHART_COLOR_KEYS[i % CHART_COLOR_KEYS.length]].main);
    });
    return map;
  }, [byCategory, theme]);

  const getCategoryColor = (name) => categoryColorMap.get(name) ?? theme.palette.grey[500];

  const pdfRows = useMemo(
    () => byCategory.map((r) => ({ label: r.label, count: r.count, transferCount: r.transferCount })),
    [byCategory]
  );

  const handleExportExcel = () => {
    exportRowsToExcel({
      fileName: `ประวัติการจ่ายผ้า-${range.start.format('YYYYMMDD')}-${range.end.format('YYYYMMDD')}`,
      sheetName: 'ประวัติการจ่ายผ้า',
      columns: [
        { key: 'time', label: 'เวลา' },
        { key: 'epcCode', label: 'รหัส EPC' },
        { key: 'categoryName', label: 'หมวดหมู่ผ้า' },
        { key: 'wardName', label: 'วอร์ด' },
        { key: 'cabinetName', label: 'ตู้ปลายทาง' },
        { key: 'userName', label: 'ผู้ดำเนินการ' },
        { key: 'type', label: 'ประเภท' },
      ],
      rows: history.map((h) => ({
        time: fDateTime(h.scannedAt),
        epcCode: h.epcCode,
        categoryName: h.categoryName,
        wardName: h.wardName,
        cabinetName: h.cabinetName,
        userName: h.userName,
        type: h.isTransfer ? 'โอนข้ามตู้' : 'เติมใหม่',
      })),
    });
  };

  const exportButtons = (
    <Stack direction="row" spacing={1}>
      <NoSsr>
        <PDFDownloadLink
          document={
            <WardIssueHistoryReportPDF
              range={reportRange}
              totals={totals}
              granularityLabel={activeGran.label}
              byBucket={byBucket}
              byCategory={pdfRows}
              byWard={byWard}
              history={history}
            />
          }
          fileName={`ward-issue-history-${reportRange?.from ?? ''}-${reportRange?.to ?? ''}.pdf`}
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
              disabled={loading || !hospitalId || history.length === 0}
            >
              Export PDF
            </Button>
          )}
        </PDFDownloadLink>
      </NoSsr>

      <Button
        variant="outlined"
        color="success"
        startIcon={<Iconify icon="solar:file-text-bold-duotone" />}
        onClick={handleExportExcel}
        disabled={!hospitalId || history.length === 0}
      >
        Export Excel
      </Button>
    </Stack>
  );

  const shiftAnchor = (delta) => setAnchor((prev) => prev.add(delta, activeGran.unit));

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 2.5 }}>
        <Box
          sx={{
            mb: 2,
            gap: 1.5,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SectionAvatar icon="solar:calendar-search-bold-duotone" color="primary" />
            <Typography variant="subtitle1" sx={{ ml: 1.5 }}>
              เลือกช่วงเวลารายงาน
            </Typography>
          </Box>

          {exportButtons}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={granularity}
            onChange={(_, value) => {
              if (value) setGranularity(value);
            }}
          >
            {GRANULARITIES.map((g) => (
              <ToggleButton key={g.value} value={g.value} sx={{ px: 2 }}>
                {g.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, display: { xs: 'none', sm: 'block' } }} />

          <IconButton size="small" onClick={() => shiftAnchor(-1)}>
            <Iconify icon="eva:arrow-ios-back-fill" />
          </IconButton>

          <DatePicker
            label={activeGran.pickerLabel}
            value={anchor}
            views={activeGran.views}
            onChange={(value) => value && setAnchor(value)}
            slotProps={{ textField: { size: 'small', sx: { width: 190 } } }}
          />

          <IconButton
            size="small"
            onClick={() => shiftAnchor(1)}
            disabled={range.end.isAfter(dayjs())}
          >
            <Iconify icon="eva:arrow-ios-forward-fill" />
          </IconButton>

          <Chip
            size="small"
            variant="soft"
            color="primary"
            label={`${range.start.locale('th').format('D MMM BBBB')} — ${range.end
              .locale('th')
              .format('D MMM BBBB')}`}
          />
        </Box>
      </Card>

      {reportLoading ? (
        <LoadingScreen />
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={4}>
              <StatCard
                icon="solar:t-shirt-bold-duotone"
                title="ครั้งที่จ่ายผ้า (ชิ้น)"
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

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <SummaryCard
                icon="solar:calendar-bold-duotone"
                color="primary"
                title={`สรุปยอด${activeGran.label}`}
                labelHead="ช่วงเวลา"
                rows={byBucket}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <SummaryCard
                icon="solar:tag-bold-duotone"
                color="info"
                title="สรุปตามหมวดหมู่ผ้า"
                labelHead="หมวดหมู่"
                rows={byCategory}
                getColor={getCategoryColor}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <SummaryCard
                icon="solar:hospital-bold-duotone"
                color="secondary"
                title="สรุปตามวอร์ด"
                labelHead="วอร์ด"
                rows={byWard}
              />
            </Grid>
          </Grid>

          <HistoryTableCard
            history={history}
            getCategoryColor={getCategoryColor}
            onRefresh={() => refreshReport()}
          />
        </>
      )}
    </Stack>
  );
}

// ----------------------------------------------------------------------

function SummaryCard({ icon, color, title, labelHead, rows, getColor }) {
  return (
    <Card sx={{ height: 1 }}>
      <CardHeader avatar={<SectionAvatar icon={icon} color={color} />} title={title} />
      {rows.length === 0 ? (
        <EmptyContent title="ไม่มีข้อมูล" sx={{ py: 5 }} />
      ) : (
        <Scrollbar sx={{ maxHeight: 320 }}>
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>{labelHead}</TableCell>
                  <TableCell align="right">จำนวน</TableCell>
                  <TableCell align="right">โอนข้ามตู้</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key ?? row.label} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getColor && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              mr: 1,
                              borderRadius: '50%',
                              flexShrink: 0,
                              bgcolor: getColor(row.label),
                            }}
                          />
                        )}
                        {row.label}
                      </Box>
                    </TableCell>
                    <TableCell align="right">{row.count}</TableCell>
                    <TableCell align="right">{row.transferCount || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

function HistoryTableCard({ history, getCategoryColor, onRefresh }) {
  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:document-text-bold-duotone" color="default" />}
        title="ประวัติการจ่ายผ้ารายชิ้น"
        subheader={`ทั้งหมด ${history.length} รายการในช่วงเวลาที่เลือก`}
        action={
          <Tooltip title="รีเฟรช">
            <IconButton onClick={onRefresh}>
              <Iconify icon="solar:refresh-bold-duotone" width={20} />
            </IconButton>
          </Tooltip>
        }
      />
      {history.length === 0 ? (
        <EmptyContent title="ไม่มีประวัติการจ่ายผ้าในช่วงเวลานี้" sx={{ py: 8 }} />
      ) : (
        <Scrollbar sx={{ maxHeight: 520 }}>
          <TableContainer sx={{ minWidth: 900 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>เวลา</TableCell>
                  <TableCell>รหัส EPC</TableCell>
                  <TableCell>หมวดหมู่</TableCell>
                  <TableCell>วอร์ด</TableCell>
                  <TableCell>ตู้ปลายทาง</TableCell>
                  <TableCell>ผู้ดำเนินการ</TableCell>
                  <TableCell align="center">ประเภท</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(h.scannedAt)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                      {h.epcCode}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            mr: 1,
                            borderRadius: '50%',
                            flexShrink: 0,
                            bgcolor: getCategoryColor(h.categoryName),
                          }}
                        />
                        {h.categoryName}
                      </Box>
                    </TableCell>
                    <TableCell>{h.wardName}</TableCell>
                    <TableCell>{h.cabinetName}</TableCell>
                    <TableCell>{h.userName}</TableCell>
                    <TableCell align="center">
                      {h.isTransfer ? (
                        <Chip
                          size="small"
                          variant="soft"
                          color="warning"
                          icon={<Iconify icon="solar:transfer-horizontal-bold-duotone" width={12} />}
                          label="โอนข้ามตู้"
                        />
                      ) : (
                        <Chip
                          size="small"
                          variant="soft"
                          color="primary"
                          icon={<Iconify icon="solar:add-circle-bold-duotone" width={12} />}
                          label="เติมใหม่"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      )}
    </Card>
  );
}
