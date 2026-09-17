import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import NoSsr from '@mui/material/NoSsr';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';
import { sanitizeFileName, exportSheetsToExcel } from 'src/utils/export-excel';

import { useGetDepartments } from 'src/actions/departments';
import { useGetRestockFillHistory } from 'src/actions/restockReport';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { SectionAvatar } from './restock-section-avatar';
import { RestockDateFilterCard } from './restock-date-filter-card';
import { RestockFillHistoryTable } from './restock-fill-history-table';
import { RestockFillHistoryPDF } from '../restock-fill-history-report-pdf';
import { getWardOptions, getBuildingOptions, buildFillHistoryExcelSheets } from './restock-fill-history-utils';

// ----------------------------------------------------------------------

// แท็บ "ประวัติยอดการเติมผ้า" — จำลอง sheet กระดาษเดิม (แถว = ชนิดผ้า, คอลัมน์กลุ่ม = แผนก/วอร์ด)
// กรองได้ถึงระดับวัน-เวลา (ต่างจากแท็บอื่นในหน้านี้ที่กรองแค่ระดับวัน) + เลือกขอบเขตตึก/วอร์ดได้
// export แยกไฟล์ต่อวัน (Excel 1 ชีต/วัน, PDF 1 หน้า/วัน) ดู restock-fill-history-utils.js สำหรับ logic
// จัดกลุ่ม/สร้าง sheet ทั้งหมด
export function RestockFillHistoryCard({ hospitalId, hospitalName }) {
  const [startDate, setStartDate] = useState(dayjs().subtract(6, 'day'));
  const [endDate, setEndDate] = useState(dayjs());
  const [activePreset, setActivePreset] = useState('7 วันล่าสุด');
  const [building, setBuilding] = useState(null); // null = ทุกตึก
  const [selectedWards, setSelectedWards] = useState([]); // [] = ทุกวอร์ดในขอบเขตตึก

  const { departments } = useGetDepartments(hospitalId);

  const buildingOptions = useMemo(() => getBuildingOptions(departments), [departments]);
  const wardOptions = useMemo(
    () => getWardOptions(departments, building?.id ?? null),
    [departments, building]
  );

  const handlePreset = (preset) => {
    const [from, to] = preset.getRange();
    setStartDate(from);
    setEndDate(to);
    setActivePreset(preset.label);
  };

  const handleChangeBuilding = (event, newValue) => {
    setBuilding(newValue);
    setSelectedWards([]); // ตัวเลือกวอร์ดเปลี่ยนขอบเขตตามตึก ต้องเคลียร์ของเดิมทิ้ง
  };

  const { range, days, wards, categories, fillHistoryLoading } = useGetRestockFillHistory(hospitalId, {
    startDateTime: startDate ? startDate.format('YYYY-MM-DD HH:mm:ss') : undefined,
    endDateTime: endDate ? endDate.format('YYYY-MM-DD HH:mm:ss') : undefined,
    buildingId: building?.id,
    wardIds: selectedWards.map((w) => w.id),
  });

  const scopeLabel =
    selectedWards.length > 0
      ? selectedWards.map((w) => w.name).join(', ')
      : building
        ? `ทุกวอร์ด (ตึก${building.name})`
        : 'ทุกตึก ทุกวอร์ด';

  const rangeLabel = range ? `${fDateTime(range.from)} — ${fDateTime(range.to)}` : '';

  const exportFileBase = `ประวัติเติมผ้า-${hospitalName ? `${sanitizeFileName(hospitalName)}-` : ''}${sanitizeFileName(scopeLabel)}-${startDate.format('YYYYMMDDHHmm')}-${endDate.format('YYYYMMDDHHmm')}`;

  const handleExportExcel = () => {
    if (days.length === 0) return;
    const sheets = buildFillHistoryExcelSheets({ days, wards, categories, hospitalName, scopeLabel });
    exportSheetsToExcel({ fileName: exportFileBase, sheets });
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
        granularity="datetime"
        description="กรองได้ถึงระดับชั่วโมง/นาที — ไม่ผูกกับตัวกรองของแท็บอื่นในหน้านี้"
      />

      <Card>
        <CardHeader
          avatar={<SectionAvatar icon="solar:history-3-bold-duotone" color="info" />}
          title="ประวัติยอดการเติมผ้า"
          subheader={rangeLabel}
          action={
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Autocomplete
                size="small"
                options={buildingOptions}
                value={building}
                onChange={handleChangeBuilding}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                sx={{ minWidth: 200 }}
                renderInput={(params) => (
                  <TextField {...params} label="เลือกตึก" placeholder="ทั้งหมด (ทุกตึก)" />
                )}
              />
              <Autocomplete
                multiple
                size="small"
                options={wardOptions}
                value={selectedWards}
                onChange={(event, newValue) => setSelectedWards(newValue)}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                sx={{ minWidth: 260 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="เลือกแผนก/วอร์ด"
                    placeholder={selectedWards.length === 0 ? 'ทั้งหมด' : ''}
                  />
                )}
              />
              {days.length > 0 && (
                <>
                  <NoSsr>
                    <PDFDownloadLink
                      document={
                        <RestockFillHistoryPDF
                          hospitalName={hospitalName}
                          scopeLabel={scopeLabel}
                          days={days}
                          wards={wards}
                          categories={categories}
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
      </Card>

      {fillHistoryLoading ? (
        <LoadingScreen />
      ) : days.length === 0 ? (
        <Card>
          <EmptyContent
            title="ไม่มีข้อมูลการเติมผ้าในช่วงเวลานี้"
            description="ลองเลือกช่วงวันที่-เวลา หรือขอบเขตตึก/วอร์ดอื่น"
            sx={{ py: 8 }}
          />
        </Card>
      ) : (
        days.map((day) => <RestockFillHistoryTable key={day.date} day={day} wards={wards} categories={categories} />)
      )}
    </Stack>
  );
}
