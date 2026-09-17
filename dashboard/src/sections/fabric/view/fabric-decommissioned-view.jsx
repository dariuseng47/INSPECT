'use client';

import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { sanitizeFileName, exportRowsToExcel } from 'src/utils/export-excel';

import { useGetFabricItems } from 'src/actions/fabric';
import { DashboardContent } from 'src/layouts/dashboard';

import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';

import { FabricListReportPDF } from '../fabric-report-pdf';
import { FabricExportToolbar } from '../fabric-export-toolbar';
import { fabricPdfRange, fabricRangeLabel, filterRowsByDateRange } from '../fabric-export-utils';

// ----------------------------------------------------------------------

// width เป็นตัวเลข (หน่วยเดียวกับ ss:Width ของ Excel) ไม่ใช่ '%' — ดู fabric-report-pdf.jsx
const EXPORT_COLUMNS = [
  { key: 'epc', label: 'รหัส EPC', width: 400 },
  { key: 'washCount', label: 'รอบซักก่อนแทงชำรุด', width: 200, align: 'right' },
  { key: 'updatedAt', label: 'วันที่อัปเดตล่าสุด', width: 400 },
];

export function FabricDecommissionedView() {
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin, hospitals } = useEffectiveHospital();
  // ใส่ชื่อโรงพยาบาลลงในรายงาน export (ดู pattern เดียวกันใน operations-restock-report-view.jsx)
  const hospitalName = isSuperadmin
    ? hospitals.find((h) => h.id === hospitalId)?.name
    : user?.hospital_name;

  const { fabricItems, fabricItemsLoading, refreshFabricItems } = useGetFabricItems({
    hospitalId,
    status: 'DECOMMISSIONED',
  });

  // มือถือ operator แทงชำรุดผ้าใหม่ -> ตารางนี้ขึ้นทันทีไม่ต้องรีเฟรช
  useSocketEvent('fabric:decommission', refreshFabricItems);

  const [decommissionedFrom, setDecommissionedFrom] = useState(null);
  const [decommissionedTo, setDecommissionedTo] = useState(null);
  const [activeDatePreset, setActiveDatePreset] = useState('ทั้งหมด');

  const handleDatePreset = (preset) => {
    const [from, to] = preset.getRange();
    setDecommissionedFrom(from);
    setDecommissionedTo(to);
    setActiveDatePreset(preset.label);
  };

  // กรองตามวันที่อัปเดตล่าสุด (updated_at ~ วันที่ถูกแทงชำรุด เพราะเป็นครั้งล่าสุดที่สถานะเปลี่ยน)
  const dateFilteredItems = useMemo(
    () => filterRowsByDateRange(fabricItems, 'updated_at', decommissionedFrom, decommissionedTo),
    [fabricItems, decommissionedFrom, decommissionedTo]
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

  const rangeLabel = fabricRangeLabel(decommissionedFrom, decommissionedTo);
  const pdfRange = fabricPdfRange(decommissionedFrom, decommissionedTo);
  const rangeSuffix =
    decommissionedFrom || decommissionedTo
      ? `-${dayjs(decommissionedFrom ?? decommissionedTo).format('YYYYMMDD')}-${dayjs(decommissionedTo ?? decommissionedFrom).format('YYYYMMDD')}`
      : '';
  // ต่อท้ายชื่อไฟล์ด้วยวันที่-เวลาที่กดออก (DDMMYY-HHmm เช่น 130926-1800) กันสับสนเวลา export
  // ซ้ำหลายรอบในเงื่อนไขเดียวกัน — ไม่ใช่วันที่ของข้อมูล (นั่นคือ rangeSuffix ด้านบน)
  const exportedAtSuffix = dayjs().format('DDMMYY-HHmm');
  const exportFileBase = `จำหน่ายออก${hospitalName ? `-${sanitizeFileName(hospitalName)}` : ''}${rangeSuffix}-${exportedAtSuffix}`;

  const handleExportExcel = () => {
    exportRowsToExcel({
      fileName: exportFileBase,
      sheetName: 'จำหน่ายออก',
      title: 'รายงานประวัติผ้าที่จำหน่ายออก',
      subtitle: [hospitalName, `ช่วงเวลา ${rangeLabel}`].filter(Boolean).join(' · '),
      columns: EXPORT_COLUMNS,
      rows: exportRows,
    });
  };

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="ประวัติผ้าที่จำหน่ายออก"
        links={[{ name: 'จัดการผ้าและล็อต' }, { name: 'ประวัติผ้าที่จำหน่ายออก' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <CardContent>
          {hospitalId && fabricItems.length > 0 && (
            <Stack spacing={2} sx={{ mb: 2.5 }}>
              <FabricExportToolbar
                dateFilterProps={{
                  startDate: decommissionedFrom,
                  endDate: decommissionedTo,
                  activePreset: activeDatePreset,
                  onChangeStartDate: (v) => {
                    setDecommissionedFrom(v);
                    setActiveDatePreset(null);
                  },
                  onChangeEndDate: (v) => {
                    setDecommissionedTo(v);
                    setActiveDatePreset(null);
                  },
                  onSelectPreset: handleDatePreset,
                  dateLabel: 'วันที่จำหน่ายออก',
                }}
                pdfDocument={
                  <FabricListReportPDF
                    title="รายงานประวัติผ้าที่จำหน่ายออก"
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
            <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
          ) : fabricItemsLoading ? (
            <LoadingScreen />
          ) : dateFilteredItems.length === 0 ? (
            <EmptyContent
              title={
                fabricItems.length === 0
                  ? 'ยังไม่มีผ้าที่จำหน่ายออกจากระบบ'
                  : 'ไม่พบผ้าที่จำหน่ายออกตามช่วงเวลาที่เลือก'
              }
              sx={{ py: 10 }}
            />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 560 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>รหัส EPC</TableCell>
                      <TableCell>รอบซักก่อนแทงชำรุด</TableCell>
                      <TableCell>วันที่อัปเดตล่าสุด</TableCell>
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
    </DashboardContent>
  );
}
