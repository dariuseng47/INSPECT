import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';

import { fDate, fDateTime } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';

import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

export function RestockRoundsCard({ rounds, range }) {
  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:clipboard-list-bold-duotone" color="warning" />}
        title="ประวัติการตรวจนับ/เติมผ้า (แยกเป็นรอบ)"
        subheader={range ? `${fDate(range.from)} — ${fDate(range.to)}` : ''}
      />
      {rounds.length === 0 ? (
        <EmptyContent title="ไม่มีรอบตรวจนับในช่วงเวลานี้" sx={{ py: 8 }} />
      ) : (
        <Scrollbar sx={{ maxHeight: 480 }}>
          <TableContainer sx={{ minWidth: 720 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>เวลา</TableCell>
                  <TableCell>วอร์ด</TableCell>
                  <TableCell>ตู้</TableCell>
                  <TableCell>ผู้ดำเนินการ</TableCell>
                  <TableCell align="right">จำนวนผ้าที่เติม</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rounds.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Iconify
                          icon="solar:clock-circle-bold-duotone"
                          width={16}
                          sx={{ color: 'text.disabled', mr: 0.75 }}
                        />
                        {fDateTime(r.createdAt)}
                      </Box>
                    </TableCell>
                    <TableCell>{r.wardName}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Iconify icon="solar:box-bold-duotone" width={16} sx={{ color: 'text.disabled', mr: 0.75 }} />
                        {r.cabinetName}
                      </Box>
                    </TableCell>
                    <TableCell>{r.userName}</TableCell>
                    <TableCell align="right">
                      <Chip size="small" variant="soft" label={`${r.itemCount} ชิ้น`} />
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
