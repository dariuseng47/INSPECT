import { useMemo } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { fDate } from 'src/utils/format-time';
import { fNumber, fPercent } from 'src/utils/format-number';

import { Scrollbar } from 'src/components/scrollbar';

import { SectionAvatar } from './restock-section-avatar';
import { computeTotals } from './restock-building-summary-utils';

// ----------------------------------------------------------------------

export function BuildingTable({ building, range }) {
  const totals = useMemo(() => computeTotals(building.rows), [building.rows]);
  const totalPct = totals.parQty > 0 ? (totals.totalQty / totals.parQty) * 100 : null;

  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:buildings-2-bold-duotone" color="info" />}
        title={`ตึก${building.buildingName}`}
        subheader={range ? `สรุปการเติมผ้าทุกวอร์ดในตึก · ${fDate(range.from)} — ${fDate(range.to)}` : ''}
      />
      <CardContent sx={{ pt: 0 }}>
        <Scrollbar sx={{ maxHeight: 480 }}>
          <TableContainer sx={{ minWidth: 640 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>รายการ</TableCell>
                  <TableCell align="right">จำนวนสต็อค (Par)</TableCell>
                  <TableCell align="right">จำนวนที่เติม</TableCell>
                  <TableCell align="right">จำนวนสต็อคบนวอร์ด</TableCell>
                  <TableCell align="right">รวมทั้งหมด</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {building.rows.map((row) => (
                  <TableRow key={row.categoryId ?? row.categoryName} hover>
                    <TableCell>{row.categoryName}</TableCell>
                    <TableCell align="right">{fNumber(row.parQty)}</TableCell>
                    <TableCell align="right">{fNumber(row.restockedQty)}</TableCell>
                    <TableCell align="right">{fNumber(row.onWardQty)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2">{fNumber(row.totalQty)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'background.neutral' }}>
                  <TableCell>
                    <Typography variant="subtitle2">รวมจำนวนทั้งหมด</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2">{fNumber(totals.parQty)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2">{fNumber(totals.restockedQty)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2">{fNumber(totals.onWardQty)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2">{fNumber(totals.totalQty)}</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      คิดเป็นเปอร์เซ็นต์ (รวมทั้งหมด / จำนวนสต็อค)
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {totalPct === null ? (
                      '—'
                    ) : (
                      <Chip
                        size="small"
                        variant="soft"
                        color={totalPct >= 100 ? 'success' : totalPct >= 70 ? 'warning' : 'error'}
                        label={fPercent(totalPct)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      </CardContent>
    </Card>
  );
}
