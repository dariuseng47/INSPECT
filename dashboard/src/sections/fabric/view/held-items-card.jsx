'use client';

import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { sanitizeFileName, exportRowsToExcel } from 'src/utils/export-excel';

import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { FabricListReportPDF } from '../fabric-report-pdf';
import { FabricExportToolbar } from '../fabric-export-toolbar';
import { fabricPdfRange, fabricRangeLabel, filterRowsByDateRange } from '../fabric-export-utils';

// ----------------------------------------------------------------------

// width เป็นตัวเลข (หน่วยเดียวกับ ss:Width ของ Excel) ไม่ใช่ '%' — ดู fabric-report-pdf.jsx
const EXPORT_COLUMNS = [
  { key: 'epc', label: 'รหัส EPC', width: 400 },
  { key: 'washCount', label: 'รอบซัก', width: 200, align: 'right' },
  { key: 'updatedAt', label: 'อัปเดตล่าสุด', width: 400 },
];

// ตารางผ้าที่พักใช้งานอยู่ตอนนี้ + ตัวกรองวันที่ + export Excel/PDF — แยกออกมาจาก
// fabric-hold-view.jsx เพื่อไม่ให้ไฟล์นั้นยาวเกินไป (มี PendingDecommissionCard/HoldActionCard
// อยู่แล้ว)
export function HeldItemsCard({ hospitalId, hospitalName, fabricItems, fabricItemsLoading }) {
  const [heldFrom, setHeldFrom] = useState(null);
  const [heldTo, setHeldTo] = useState(null);
  const [activeDatePreset, setActiveDatePreset] = useState('ทั้งหมด');

  const handleDatePreset = (preset) => {
    const [from, to] = preset.getRange();
    setHeldFrom(from);
    setHeldTo(to);
    setActiveDatePreset(preset.label);
  };

  // กรองตามวันที่อัปเดตล่าสุด (updated_at ~ วันที่ถูกพัก เพราะเป็นครั้งล่าสุดที่สถานะเปลี่ยน)
  const dateFilteredItems = useMemo(
    () => filterRowsByDateRange(fabricItems, 'updated_at', heldFrom, heldTo),
    [fabricItems, heldFrom, heldTo]
  );

  const exportRows = useMemo(
    () =>
      dateFilteredItems.map((item) => ({
        epc: item.epc_code,
        washCount: item.wash_count,
        updatedAt: new Date(item.updated_at).toLocaleString('th-TH'),
      })),
    [dateFilteredItems]
  );

  const rangeLabel = fabricRangeLabel(heldFrom, heldTo);
  const pdfRange = fabricPdfRange(heldFrom, heldTo);
  const rangeSuffix =
    heldFrom || heldTo
      ? `-${dayjs(heldFrom ?? heldTo).format('YYYYMMDD')}-${dayjs(heldTo ?? heldFrom).format('YYYYMMDD')}`
      : '';
  const exportFileBase = `พักใช้งาน${hospitalName ? `-${sanitizeFileName(hospitalName)}` : ''}${rangeSuffix}`;

  const handleExportExcel = () => {
    exportRowsToExcel({
      fileName: exportFileBase,
      sheetName: 'พักใช้งาน',
      title: 'รายงานผ้าที่พักใช้งาน',
      subtitle: [hospitalName, `ช่วงเวลา ${rangeLabel}`].filter(Boolean).join(' · '),
      columns: EXPORT_COLUMNS,
      rows: exportRows,
    });
  };

  return (
    <Card>
      <CardHeader title="ผ้าที่พักใช้งานอยู่ตอนนี้" />
      <CardContent>
        {hospitalId && fabricItems.length > 0 && (
          <Stack spacing={2} sx={{ mb: 2.5 }}>
            <FabricExportToolbar
              dateFilterProps={{
                startDate: heldFrom,
                endDate: heldTo,
                activePreset: activeDatePreset,
                onChangeStartDate: (v) => {
                  setHeldFrom(v);
                  setActiveDatePreset(null);
                },
                onChangeEndDate: (v) => {
                  setHeldTo(v);
                  setActiveDatePreset(null);
                },
                onSelectPreset: handleDatePreset,
                dateLabel: 'วันที่อัปเดต',
              }}
              pdfDocument={
                <FabricListReportPDF
                  title="รายงานผ้าที่พักใช้งาน"
                  hospitalName={hospitalName}
                  range={pdfRange}
                  columns={EXPORT_COLUMNS}
                  rows={exportRows}
                />
              }
              pdfFileName={`${exportFileBase}.pdf`}
              onExportExcel={handleExportExcel}
            />
            <Divider />
          </Stack>
        )}

        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 8 }} />
        ) : fabricItemsLoading ? (
          <LoadingScreen sx={{ height: 200 }} />
        ) : dateFilteredItems.length === 0 ? (
          <EmptyContent
            title={
              fabricItems.length === 0
                ? 'ไม่มีผ้าพักใช้งานอยู่ในขณะนี้'
                : 'ไม่พบผ้าพักใช้งานตามช่วงเวลาที่เลือก'
            }
            sx={{ py: 8 }}
          />
        ) : (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 560 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>รหัส EPC</TableCell>
                    <TableCell>รอบซัก</TableCell>
                    <TableCell>อัปเดตล่าสุด</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dateFilteredItems.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.epc_code}</TableCell>
                      <TableCell>{item.wash_count}</TableCell>
                      <TableCell>{new Date(item.updated_at).toLocaleString('th-TH')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}
      </CardContent>
    </Card>
  );
}
