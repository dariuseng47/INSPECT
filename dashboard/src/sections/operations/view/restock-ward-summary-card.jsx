import dayjs from 'dayjs';
import { useMemo, useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import NoSsr from '@mui/material/NoSsr';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import Autocomplete from '@mui/material/Autocomplete';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { sanitizeFileName, exportSheetsToExcel } from 'src/utils/export-excel';

import { useGetRestockReport } from 'src/actions/restockReport';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { SectionAvatar } from './restock-section-avatar';
import { RestockWardReportPDF } from '../restock-ward-report-pdf';
import { RestockDateFilterCard } from './restock-date-filter-card';

// ----------------------------------------------------------------------

// จัดกลุ่ม summaryByWard (แถวละ 1 วอร์ด+หมวดหมู่) ให้เป็น 1 ก้อนต่อวอร์ด
function groupByWard(summaryByWard) {
  const map = new Map();
  summaryByWard.forEach((row) => {
    const key = row.wardName;
    if (!map.has(key)) map.set(key, { wardName: key, total: 0, categories: [] });
    const group = map.get(key);
    group.total += row.count;
    group.categories.push(row);
  });
  return [...map.values()].sort((a, b) => b.total - a.total);
}

const ALL_WARDS_OPTION = { value: null, label: 'ทั้งหมด (ทุกวอร์ด)' };

// แท็บนี้มีตัวกรองช่วงเวลาของตัวเอง แยกจากตัวกรองบนสุดของหน้า (ซึ่งใช้กับกราฟแนวโน้ม/ไฮไลท์/
// export รวมด้านบนแทน) — เหมือนแนวทางเดียวกับ RestockBuildingSummaryCard ค้นหาวอร์ดได้ในดรอปดาวน์
// เพราะโรงพยาบาลใหญ่อาจมีหลายสิบวอร์ด เลื่อนหาทีละอันไม่ไหว
export function RestockWardSummaryCard({ hospitalId, hospitalName, getCategoryColor }) {
  const [startDate, setStartDate] = useState(dayjs().subtract(6, 'day'));
  const [endDate, setEndDate] = useState(dayjs());
  const [activePreset, setActivePreset] = useState('7 วันล่าสุด');
  const [selectedWard, setSelectedWard] = useState(ALL_WARDS_OPTION);

  const { range, summaryByWard, reportLoading } = useGetRestockReport(hospitalId, {
    startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
    endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined,
  });

  const handlePreset = (preset) => {
    const [from, to] = preset.getRange();
    setStartDate(from);
    setEndDate(to);
    setActivePreset(preset.label);
  };

  const wardGroups = useMemo(() => groupByWard(summaryByWard), [summaryByWard]);
  const rangeLabel = range ? `${fDate(range.from)} — ${fDate(range.to)}` : '';

  const wardOptions = useMemo(
    () => [ALL_WARDS_OPTION, ...wardGroups.map((g) => ({ value: g.wardName, label: g.wardName }))],
    [wardGroups]
  );

  // ถ้าวอร์ดที่เลือกไว้หายไปเพราะเปลี่ยนช่วงเวลาแล้วไม่มีข้อมูลแล้ว ให้กลับไป "ทั้งหมด" อัตโนมัติ
  useEffect(() => {
    if (selectedWard.value === null) return;
    if (!wardGroups.some((g) => g.wardName === selectedWard.value)) {
      setSelectedWard(ALL_WARDS_OPTION);
    }
  }, [wardGroups, selectedWard]);

  const displayedGroups = useMemo(
    () =>
      selectedWard.value === null
        ? wardGroups
        : wardGroups.filter((g) => g.wardName === selectedWard.value),
    [wardGroups, selectedWard]
  );

  // ใส่ชื่อโรงพยาบาลนำหน้าชื่อไฟล์เสมอ (ถ้ามี) กันสับสนเวลามีรายงานจากหลายโรงพยาบาลปนกัน
  const exportFileBase = `สรุปตามวอร์ด-${hospitalName ? `${sanitizeFileName(hospitalName)}-` : ''}${range?.from ?? ''}-${range?.to ?? ''}`;

  const handleExportExcel = () => {
    if (displayedGroups.length === 0) return;
    const sheets = displayedGroups.map((group) => {
      const rows = [
        ...group.categories.map((c) => ({
          categoryName: c.categoryName,
          count: c.count,
          transferCount: c.transferCount,
        })),
        {
          categoryName: 'รวม',
          count: group.total,
          transferCount: group.categories.reduce((sum, c) => sum + c.transferCount, 0),
        },
      ];
      return {
        sheetName: group.wardName,
        title: `สรุปการเติมผ้า — ${group.wardName}`,
        subtitle: [hospitalName, rangeLabel ? `ช่วงเวลา ${rangeLabel}` : ''].filter(Boolean).join(' · '),
        columns: [
          { key: 'categoryName', label: 'หมวดหมู่ผ้า', width: 200 },
          { key: 'count', label: 'จำนวนครั้งที่เติม' },
          { key: 'transferCount', label: 'โอนข้ามตู้' },
        ],
        rows,
        totalRowIndexes: [rows.length - 1],
      };
    });
    exportSheetsToExcel({
      fileName: exportFileBase,
      sheets,
    });
  };

  return (
    <Stack spacing={3}>
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
        description="สรุปตามวอร์ดเป็นรายงานแยกช่วงเวลาของตัวเอง — ไม่ผูกกับตัวกรองของแท็บอื่น"
      />

      {reportLoading ? (
        <LoadingScreen />
      ) : (
        <Card>
          <CardHeader
            avatar={<SectionAvatar icon="solar:hospital-bold-duotone" color="success" />}
            title="สรุปการเติมผ้าแยกตามวอร์ด"
            subheader={rangeLabel}
            action={
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Autocomplete
                  size="small"
                  options={wardOptions}
                  value={selectedWard}
                  onChange={(event, newValue) => setSelectedWard(newValue ?? ALL_WARDS_OPTION)}
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, value) => option.value === value.value}
                  disableClearable
                  sx={{ minWidth: 220 }}
                  renderInput={(params) => <TextField {...params} label="เลือกวอร์ด" />}
                />
                {displayedGroups.length > 0 && (
                  <>
                    <NoSsr>
                      <PDFDownloadLink
                        document={
                          <RestockWardReportPDF
                            hospitalName={hospitalName}
                            range={range}
                            wardGroups={displayedGroups}
                          />
                        }
                        fileName={`${exportFileBase}.pdf`}
                        style={{ textDecoration: 'none' }}
                      >
                        {({ loading }) => (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={
                              loading ? (
                                <CircularProgress size={14} color="inherit" />
                              ) : (
                                <Iconify icon="solar:file-download-bold-duotone" />
                              )
                            }
                            disabled={loading}
                          >
                            Export PDF
                          </Button>
                        )}
                      </PDFDownloadLink>
                    </NoSsr>
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      startIcon={<Iconify icon="solar:file-text-bold-duotone" />}
                      onClick={handleExportExcel}
                    >
                      Export Excel
                    </Button>
                  </>
                )}
              </Stack>
            }
          />
          {displayedGroups.length === 0 ? (
            <EmptyContent
              title="ไม่มีข้อมูลการเติมผ้าในช่วงเวลานี้"
              description="ลองเลือกช่วงเวลาหรือวอร์ดอื่น หรือรอให้มีการเติมผ้าเข้าตู้ก่อน"
              sx={{ py: 8 }}
            />
          ) : (
            <Box sx={{ p: 2.5, pt: 1 }}>
              <Grid container spacing={2}>
                {displayedGroups.map((group) => (
                  <Grid item xs={12} md={6} key={group.wardName}>
                    <Card
                      variant="outlined"
                      sx={{
                        p: 2,
                        height: 1,
                        borderRadius: 1.5,
                        transition: (theme) => theme.transitions.create('box-shadow'),
                        '&:hover': { boxShadow: (theme) => theme.customShadows?.z8 ?? 4 },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: 'success.lighter',
                            color: 'success.darker',
                            mr: 1.5,
                          }}
                        >
                          <Iconify icon="solar:hospital-bold-duotone" width={20} />
                        </Avatar>
                        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                          {group.wardName}
                        </Typography>
                        <Chip size="small" variant="soft" color="default" label={`รวม ${group.total} ชิ้น`} />
                      </Box>
                      <Divider sx={{ mb: 1.5, borderStyle: 'dashed' }} />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {group.categories.map((c) => {
                          const color = getCategoryColor(c.categoryName);
                          const pct = group.total ? Math.round((c.count / group.total) * 100) : 0;
                          return (
                            <Box key={c.categoryId ?? c.categoryName}>
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: color,
                                    mr: 1,
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                  {c.categoryName}
                                </Typography>
                                {c.transferCount > 0 && (
                                  <Chip
                                    size="small"
                                    variant="soft"
                                    color="warning"
                                    icon={<Iconify icon="solar:transfer-horizontal-bold-duotone" width={12} />}
                                    label={c.transferCount}
                                    sx={{ mr: 1, height: 20, '& .MuiChip-label': { px: 0.75 } }}
                                  />
                                )}
                                <Typography variant="subtitle2">{c.count} ครั้ง</Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={{
                                  height: 6,
                                  borderRadius: 1,
                                  bgcolor: alpha(color, 0.16),
                                  '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 },
                                }}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Card>
      )}
    </Stack>
  );
}
