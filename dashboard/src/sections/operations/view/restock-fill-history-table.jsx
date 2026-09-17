import { useMemo } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { fDate } from 'src/utils/format-time';
import { fNumber } from 'src/utils/format-number';

import { Scrollbar } from 'src/components/scrollbar';

import { cellKey } from './restock-fill-history-utils';
import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

const METRIC_LABELS = ['แนะนำ', 'สแกน', 'เติม', 'หลังเติม'];
const METRIC_FIELDS = ['recommendedQty', 'scannedQty', 'filledQty', 'afterFillQty'];

// ตาราง 1 วัน — หัวตาราง 2 ชั้น (ชื่อวอร์ด merge ครอบ 4 คอลัมน์ย่อย: แนะนำ/สแกน/เติม/หลังเติม) แถว =
// ชนิดผ้า เซลล์ที่ไม่มีข้อมูล (ตู้วอร์ดนั้นไม่ได้ตั้ง par level ของชนิดผ้านั้น หรือวันนั้นไม่มีรอบเลย)
// แสดง "—" แทน (ดูที่มาของ cells ใน restockFillHistory.controller.js#buildFillHistoryDays)
export function RestockFillHistoryTable({ day, wards, categories }) {
  const hasBuildingMix = useMemo(
    () => new Set(wards.map((w) => w.buildingId)).size > 1,
    [wards]
  );

  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:calendar-mark-bold-duotone" color="primary" />}
        title={fDate(day.date)}
        subheader={`${categories.length} ชนิดผ้า · ${wards.length} แผนก`}
      />
      <CardContent sx={{ pt: 0 }}>
        <Scrollbar sx={{ maxHeight: 560 }}>
          <TableContainer sx={{ minWidth: 120 + wards.length * 4 * 90 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell rowSpan={2} sx={{ minWidth: 160 }}>
                    ชนิดผ้า
                  </TableCell>
                  {wards.map((w) => (
                    <TableCell
                      key={w.id}
                      colSpan={METRIC_LABELS.length}
                      align="center"
                      sx={{ borderLeft: (theme) => `1px solid ${theme.palette.divider}` }}
                    >
                      {hasBuildingMix ? `${w.name} (ตึก${w.buildingName})` : w.name}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  {wards.map((w) =>
                    METRIC_LABELS.map((label, i) => (
                      <TableCell
                        key={`${w.id}-${label}`}
                        align="right"
                        sx={i === 0 ? { borderLeft: (theme) => `1px solid ${theme.palette.divider}` } : undefined}
                      >
                        {label}
                      </TableCell>
                    ))
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id} hover>
                    <TableCell>{cat.name}</TableCell>
                    {wards.map((w) => {
                      const cell = day.cells[cellKey(cat.id, w.id)];
                      return METRIC_FIELDS.map((field, i) => (
                        <TableCell
                          key={`${w.id}-${field}`}
                          align="right"
                          sx={i === 0 ? { borderLeft: (theme) => `1px solid ${theme.palette.divider}` } : undefined}
                        >
                          {cell ? fNumber(cell[field]) : '—'}
                        </TableCell>
                      ));
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      </CardContent>
    </Card>
  );
}
