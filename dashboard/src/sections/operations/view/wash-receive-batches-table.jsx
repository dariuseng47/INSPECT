'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import { alpha } from '@mui/material/styles';
import Collapse from '@mui/material/Collapse';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';

import { fDateTime } from 'src/utils/format-time';
import { fNumber } from 'src/utils/format-number';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';

import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

function BatchRow({ batch, getCategoryColor }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow hover>
        <TableCell width={48}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)}>
            <Iconify icon={open ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'} />
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Iconify
              icon="solar:clock-circle-bold-duotone"
              width={16}
              sx={{ color: 'text.disabled', mr: 0.75 }}
            />
            {fDateTime(batch.createdAt)}
          </Box>
        </TableCell>
        <TableCell align="right">
          <Chip size="small" variant="soft" label={`${fNumber(batch.itemCount)} ชิ้น`} />
        </TableCell>
        <TableCell align="right">
          <Chip
            size="small"
            variant="soft"
            color="warning"
            label={`${fNumber(batch.weightKg)} กก.`}
          />
        </TableCell>
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar sx={{ width: 26, height: 26, fontSize: 13 }}>
              {batch.userName?.charAt(0)?.toUpperCase() ?? '?'}
            </Avatar>
            <Box sx={{ typography: 'body2' }}>{batch.userName}</Box>
          </Stack>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} unmountOnExit>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ py: 1.5 }}>
              {batch.items.map((item) => {
                const color = getCategoryColor(item.categoryName);
                return (
                  <Chip
                    key={item.epcCode}
                    size="small"
                    variant="soft"
                    label={`${item.epcCode} · ${item.categoryName}`}
                    sx={{
                      bgcolor: alpha(color, 0.16),
                      color,
                      fontFamily: 'monospace',
                    }}
                  />
                );
              })}
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export function WashReceiveBatchesTable({ batches, getCategoryColor }) {
  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:history-bold-duotone" color="secondary" />}
        title="ประวัติชุดสแกน + ชั่งน้ำหนัก"
        subheader="แต่ละแถว = 1 ชุดที่สแกนพร้อมกัน — กดลูกศรเพื่อดูรายชิ้นในชุด"
      />
      {batches.length === 0 ? (
        <EmptyContent title="ไม่มีข้อมูลในช่วงเวลาที่เลือก" sx={{ py: 8 }} />
      ) : (
        <Scrollbar>
          <TableContainer sx={{ minWidth: 640 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={48} />
                  <TableCell>เวลา</TableCell>
                  <TableCell align="right">จำนวนชิ้น</TableCell>
                  <TableCell align="right">น้ำหนัก</TableCell>
                  <TableCell>บันทึกโดย</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.map((batch) => (
                  <BatchRow key={batch.id} batch={batch} getCategoryColor={getCategoryColor} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      )}
    </Card>
  );
}
