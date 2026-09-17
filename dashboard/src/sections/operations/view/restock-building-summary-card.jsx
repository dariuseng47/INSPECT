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

import { fDate } from 'src/utils/format-time';
import { sanitizeFileName, exportSheetsToExcel } from 'src/utils/export-excel';

import { useGetRestockReport } from 'src/actions/restockReport';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { SectionAvatar } from './restock-section-avatar';
import { BuildingTable } from './restock-building-table';
import { RestockDateFilterCard } from './restock-date-filter-card';
import { RestockBuildingReportPDF } from '../restock-building-report-pdf';
import {
  computeTotals,
  groupByBuilding,
  buildCombinedSummary,
  groupWardsByBuilding,
  buildBuildingExcelSheets,
  buildWardOverviewSections,
} from './restock-building-summary-utils';

// ----------------------------------------------------------------------

// รายงานตามตึกเป็นรายงาน "ประจำเดือน" โดยธรรมชาติ (ดูตัวอย่างรายงานกระดาษเดิม) — ใช้ตัวกรองวันที่
// ของตัวเอง แยกจากตัวกรองบนสุดของหน้า (ซึ่งเน้นสรุปตามวอร์ด/ประวัติที่มักดูเป็นรายสัปดาห์)
// เลือกได้ทั้งหมด (ไม่เลือกอะไรเลย) ตึกเดียว หรือหลายตึกพร้อมกัน — export Excel จะแยกชีตตึก + ชีต
// "สรุปวอร์ด" ภาพรวม + ชีตรายวอร์ด ของทุกตึกที่เลือก ปิดท้ายด้วยชีตสรุปรวมข้ามตึกแยกตามชนิดผ้า
// (ดู restock-building-summary-utils.js ที่มี logic จัดกลุ่ม/สร้าง sheet ทั้งหมด)
export function RestockBuildingSummaryCard({ hospitalId, hospitalName }) {
  const [startDate, setStartDate] = useState(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState(dayjs());
  const [activePreset, setActivePreset] = useState('เดือนนี้');
  const [selectedBuildingIds, setSelectedBuildingIds] = useState([]); // ว่าง = ทั้งหมด

  const { range, summaryByBuilding, summaryByWard, reportLoading } = useGetRestockReport(hospitalId, {
    startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
    endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined,
  });

  const handlePreset = (preset) => {
    const [from, to] = preset.getRange();
    setStartDate(from);
    setEndDate(to);
    setActivePreset(preset.label);
  };

  const buildings = useMemo(() => groupByBuilding(summaryByBuilding), [summaryByBuilding]);
  const wardsByBuildingId = useMemo(() => groupWardsByBuilding(summaryByWard), [summaryByWard]);

  const selectedBuildingOptions = useMemo(
    () => buildings.filter((b) => selectedBuildingIds.includes(b.buildingId)),
    [buildings, selectedBuildingIds]
  );

  const displayedBuildings = selectedBuildingIds.length === 0 ? buildings : selectedBuildingOptions;

  const rangeLabel = range ? `${fDate(range.from)} — ${fDate(range.to)}` : '';

  // ใส่ชื่อโรงพยาบาลนำหน้าชื่อไฟล์เสมอ (ถ้ามี) กันสับสนเวลามีรายงานจากหลายโรงพยาบาลปนกัน — ต่อท้ายด้วย
  // ชื่อตึกถ้าเลือกตึกเดียว หรือ "ทุกตึก"/"หลายตึก" ถ้าเลือกมากกว่านั้น
  const scopeLabel =
    displayedBuildings.length === 1
      ? displayedBuildings[0].buildingName
      : selectedBuildingIds.length === 0
        ? 'ทุกตึก'
        : 'หลายตึก';
  const exportFileBase = `เติมผ้า-${hospitalName ? `${sanitizeFileName(hospitalName)}-` : ''}${sanitizeFileName(scopeLabel)}-${startDate.format('YYYYMMDD')}-${endDate.format('YYYYMMDD')}`;

  const handleExportExcel = () => {
    if (displayedBuildings.length === 0) return;
    const sheets = buildBuildingExcelSheets({
      displayedBuildings,
      wardsByBuildingId,
      hospitalName,
      rangeLabel,
      scopeLabel,
    });
    exportSheetsToExcel({ fileName: exportFileBase, sheets });
  };

  // ข้อมูล PDF ทั้งหมดนี้มีโครงหน้าเดียวกับ Excel ทุกประการ (ตึก -> สรุปวอร์ด -> รายวอร์ด -> สรุปรวม)
  // ใช้ฟังก์ชันจัดกลุ่มชุดเดียวกับ handleExportExcel เพื่อไม่ให้ตัวเลขสองฝั่งเพี้ยนกัน
  const pdfBuildings = useMemo(
    () =>
      displayedBuildings.map((building) => {
        const totals = computeTotals(building.rows);
        const totalPct = totals.parQty > 0 ? (totals.totalQty / totals.parQty) * 100 : null;
        return { ...building, totals, totalPct };
      }),
    [displayedBuildings]
  );

  const wardOverview = useMemo(
    () => buildWardOverviewSections(displayedBuildings, wardsByBuildingId),
    [displayedBuildings, wardsByBuildingId]
  );

  const wardDetails = useMemo(() => {
    const list = [];
    displayedBuildings.forEach((building) => {
      const wardGroups = wardsByBuildingId.get(building.buildingId ?? 'none') ?? [];
      wardGroups.forEach((group) => {
        list.push({
          buildingName: building.buildingName,
          wardName: group.wardName,
          rows: group.categories.map((c) => ({
            categoryId: c.categoryId,
            categoryName: c.categoryName,
            count: c.count,
            transferCount: c.transferCount,
          })),
          total: {
            count: group.total,
            transferCount: group.categories.reduce((sum, c) => sum + c.transferCount, 0),
          },
        });
      });
    });
    return list;
  }, [displayedBuildings, wardsByBuildingId]);

  const combinedSummary = useMemo(() => buildCombinedSummary(displayedBuildings), [displayedBuildings]);

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
        description="สรุปตามตึกเป็นรายงานแยกช่วงเวลาของตัวเอง — ไม่ผูกกับตัวกรองของแท็บอื่น"
      />

      <Card>
        <CardHeader
          avatar={<SectionAvatar icon="solar:buildings-2-bold-duotone" color="info" />}
          title="สรุปการเติมผ้าแยกตามตึก"
          subheader={rangeLabel}
          action={
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Autocomplete
                multiple
                size="small"
                options={buildings}
                value={selectedBuildingOptions}
                onChange={(event, newValue) => setSelectedBuildingIds(newValue.map((v) => v.buildingId))}
                getOptionLabel={(option) => option.buildingName}
                isOptionEqualToValue={(option, value) => option.buildingId === value.buildingId}
                sx={{ minWidth: 280 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="เลือกตึก"
                    placeholder={selectedBuildingIds.length === 0 ? 'ทั้งหมด (ทุกตึก)' : ''}
                  />
                )}
              />
              {displayedBuildings.length > 0 && (
                <>
                  <NoSsr>
                    <PDFDownloadLink
                      document={
                        <RestockBuildingReportPDF
                          hospitalName={hospitalName}
                          range={range}
                          scopeLabel={scopeLabel}
                          buildings={pdfBuildings}
                          wardOverview={wardOverview}
                          wardDetails={wardDetails}
                          combinedSummary={combinedSummary}
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

      {reportLoading ? (
        <LoadingScreen />
      ) : displayedBuildings.length === 0 ? (
        <Card>
          <EmptyContent
            title="ไม่มีข้อมูลการเติมผ้าในช่วงเวลานี้"
            description="ลองเลือกช่วงเวลาหรือตึกอื่น หรือตรวจสอบว่าวอร์ดถูกจัดอยู่ใต้ตึก/ชั้นในโครงสร้างโรงพยาบาลแล้ว"
            sx={{ py: 8 }}
          />
        </Card>
      ) : (
        displayedBuildings.map((building) => (
          <BuildingTable key={building.buildingId ?? 'none'} building={building} range={range} />
        ))
      )}
    </Stack>
  );
}
