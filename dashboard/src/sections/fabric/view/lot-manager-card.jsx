'use client';

import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';

import { sanitizeFileName, exportRowsToExcel } from 'src/utils/export-excel';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { LotFormDialog } from './lot-form-dialog';
import { FabricListReportPDF } from '../fabric-report-pdf';
import { FabricExportToolbar } from '../fabric-export-toolbar';
import { fabricPdfRange, fabricRangeLabel, filterRowsByDateRange } from '../fabric-export-utils';

// ----------------------------------------------------------------------

// width เป็นตัวเลข (หน่วยเดียวกับ ss:Width ของ Excel) ไม่ใช่ '%' — ดู fabric-report-pdf.jsx
const EXPORT_COLUMNS = [
  { key: 'lotCode', label: 'รหัสล็อต', width: 180 },
  { key: 'category', label: 'หมวดหมู่', width: 180 },
  { key: 'quantity', label: 'จำนวน', width: 120, align: 'right' },
  { key: 'maxWashCycles', label: 'รอบซักไม่เกิน', width: 140, align: 'right' },
  { key: 'purchasedAt', label: 'วันที่จัดซื้อ', width: 180 },
  { key: 'createdBy', label: 'เพิ่มโดย', width: 200 },
];

export function LotManagerCard({
  hospitalId,
  hospitalName,
  lots,
  lotsLoading,
  categories,
  onChanged,
  onWantNewCategory,
}) {
  const formDialog = useBoolean();

  const [purchasedFrom, setPurchasedFrom] = useState(null);
  const [purchasedTo, setPurchasedTo] = useState(null);
  const [activeDatePreset, setActiveDatePreset] = useState('ทั้งหมด');

  const handleDatePreset = (preset) => {
    const [from, to] = preset.getRange();
    setPurchasedFrom(from);
    setPurchasedTo(to);
    setActiveDatePreset(preset.label);
  };

  // กรองตามวันที่จัดซื้อ (purchased_at) — ล็อตที่ยังไม่ระบุวันที่จัดซื้อ ('0000-00-00'/ว่าง) จะถูก
  // ตัดออกเมื่อเลือกช่วงเวลาใดช่วงเวลาหนึ่ง (ดู filterRowsByDateRange)
  const filteredLots = useMemo(
    () => filterRowsByDateRange(lots, 'purchased_at', purchasedFrom, purchasedTo),
    [lots, purchasedFrom, purchasedTo]
  );

  const exportRows = useMemo(
    () =>
      filteredLots.map((lot) => ({
        lotCode: lot.lot_code,
        category: lot.category_name ?? '—',
        quantity: lot.quantity,
        maxWashCycles: lot.max_wash_cycles ? `${lot.max_wash_cycles} ครั้ง` : '—',
        purchasedAt:
          lot.purchased_at && lot.purchased_at !== '0000-00-00'
            ? new Date(lot.purchased_at).toLocaleDateString('th-TH')
            : '—',
        createdBy: lot.created_by_name ?? '—',
      })),
    [filteredLots]
  );

  const rangeLabel = fabricRangeLabel(purchasedFrom, purchasedTo);
  const pdfRange = fabricPdfRange(purchasedFrom, purchasedTo);
  const rangeSuffix =
    purchasedFrom || purchasedTo
      ? `-${dayjs(purchasedFrom ?? purchasedTo).format('YYYYMMDD')}-${dayjs(purchasedTo ?? purchasedFrom).format('YYYYMMDD')}`
      : '';
  const exportFileBase = `ล็อตผ้า${hospitalName ? `-${sanitizeFileName(hospitalName)}` : ''}${rangeSuffix}`;

  const handleExportExcel = () => {
    exportRowsToExcel({
      fileName: exportFileBase,
      sheetName: 'ล็อตผ้า',
      title: 'รายงานล็อตผ้าทั้งหมด',
      subtitle: [hospitalName, `ช่วงเวลา ${rangeLabel}`].filter(Boolean).join(' · '),
      columns: EXPORT_COLUMNS,
      rows: exportRows,
    });
  };

  return (
    <Card>
      <CardHeader
        title="ล็อตผ้าทั้งหมด"
        subheader="ล็อตที่ลงทะเบียนไว้ในโรงพยาบาลนี้ — สแกนเพิ่ม EPC รายชิ้นเข้าล็อตได้ทีหลังตอนติด RFID tag จริง"
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={formDialog.onTrue}
            disabled={!hospitalId}
          >
            เพิ่มล็อต
          </Button>
        }
      />
      <CardContent>
        {hospitalId && lots.length > 0 && (
          <Stack spacing={2} sx={{ mb: 2.5 }}>
            <FabricExportToolbar
              dateFilterProps={{
                startDate: purchasedFrom,
                endDate: purchasedTo,
                activePreset: activeDatePreset,
                onChangeStartDate: (v) => {
                  setPurchasedFrom(v);
                  setActiveDatePreset(null);
                },
                onChangeEndDate: (v) => {
                  setPurchasedTo(v);
                  setActiveDatePreset(null);
                },
                onSelectPreset: handleDatePreset,
                dateLabel: 'วันที่จัดซื้อ',
              }}
              pdfDocument={
                <FabricListReportPDF
                  title="รายงานล็อตผ้าทั้งหมด"
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
        ) : lotsLoading ? (
          <LoadingScreen sx={{ height: 200 }} />
        ) : lots.length === 0 ? (
          <EmptyContent
            title="ยังไม่มีล็อตผ้าในระบบ"
            description="เริ่มต้นด้วยการเพิ่มล็อตแรกตอนจัดซื้อ/นำเข้าผ้า"
            sx={{ py: 8 }}
          />
        ) : filteredLots.length === 0 ? (
          <EmptyContent title="ไม่พบล็อตผ้าตามช่วงเวลาที่เลือก" sx={{ py: 8 }} />
        ) : (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 760 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>รหัสล็อต</TableCell>
                    <TableCell>หมวดหมู่</TableCell>
                    <TableCell align="right">จำนวน</TableCell>
                    <TableCell align="right">รอบซักไม่เกิน</TableCell>
                    <TableCell>วันที่จัดซื้อ</TableCell>
                    <TableCell>เพิ่มโดย</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLots.map((lot) => (
                    <TableRow key={lot.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{lot.lot_code}</TableCell>
                      <TableCell>
                        {lot.category_name ? (
                          <Chip size="small" variant="soft" label={lot.category_name} />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell align="right">{lot.quantity}</TableCell>
                      <TableCell align="right">
                        {lot.max_wash_cycles ? `${lot.max_wash_cycles} ครั้ง` : '—'}
                      </TableCell>
                      <TableCell>
                        {lot.purchased_at && lot.purchased_at !== '0000-00-00'
                          ? new Date(lot.purchased_at).toLocaleDateString('th-TH')
                          : '—'}
                      </TableCell>
                      <TableCell>{lot.created_by_name ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}
      </CardContent>

      <LotFormDialog
        open={formDialog.value}
        onClose={formDialog.onFalse}
        categories={categories}
        hospitalId={hospitalId}
        onCreated={onChanged}
        onWantNewCategory={onWantNewCategory}
      />
    </Card>
  );
}
