import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';

import { fDateTime } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';

import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

export function RestockHistoryCard({ history, onRefresh, getCategoryColor }) {
  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:document-text-bold-duotone" color="default" />}
        title="ประวัติรายชิ้น"
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
        <EmptyContent title="ไม่มีประวัติในช่วงเวลานี้" sx={{ py: 8 }} />
      ) : (
        <Scrollbar sx={{ maxHeight: 480 }}>
          <TableContainer sx={{ minWidth: 900 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>เวลา</TableCell>
                  <TableCell>รหัส EPC</TableCell>
                  <TableCell>หมวดหมู่</TableCell>
                  <TableCell>วอร์ด</TableCell>
                  <TableCell>ตู้</TableCell>
                  <TableCell>ผู้ดำเนินการ</TableCell>
                  <TableCell align="center">ประเภท</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(h.scannedAt)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{h.epcCode}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: getCategoryColor(h.categoryName),
                            mr: 1,
                            flexShrink: 0,
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
