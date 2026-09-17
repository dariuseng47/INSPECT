'use client';

import { useState } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Collapse from '@mui/material/Collapse';
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

function RoundRow({ round }) {
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
          <Stack direction="row" alignItems="center">
            <Iconify
              icon="solar:clock-circle-bold-duotone"
              width={16}
              sx={{ color: 'text.disabled', mr: 0.75 }}
            />
            {fDateTime(round.createdAt)}
          </Stack>
        </TableCell>
        <TableCell align="right">
          <Chip size="small" variant="soft" color="success" label={`${round.itemCount} ชิ้น`} />
        </TableCell>
        <TableCell>{round.userName}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={4} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} unmountOnExit>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ py: 1.5 }}>
              {round.items.map((item) => (
                <Chip
                  key={item.epcCode}
                  size="small"
                  variant="soft"
                  label={`${item.epcCode} · ${item.categoryName}`}
                />
              ))}
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export function StockScanRoundsTable({ rounds }) {
  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:history-bold-duotone" color="secondary" />}
        title="ประวัติรอบการสแกนเข้าสต๊อค"
        subheader="แต่ละแถว = 1 รอบที่กดยืนยัน — กดลูกศรเพื่อดูรายชิ้นในรอบ"
      />
      {rounds.length === 0 ? (
        <EmptyContent title="ยังไม่มีรอบการสแกน" sx={{ py: 8 }} />
      ) : (
        <Scrollbar>
          <TableContainer sx={{ minWidth: 560 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={48} />
                  <TableCell>เวลา</TableCell>
                  <TableCell align="right">จำนวนชิ้น</TableCell>
                  <TableCell>สแกนโดย</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rounds.map((round) => (
                  <RoundRow key={round.roundId} round={round} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      )}
    </Card>
  );
}
