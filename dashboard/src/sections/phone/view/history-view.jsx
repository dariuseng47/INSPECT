'use client';

import { useState } from 'react';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { fDateTime } from 'src/utils/format-time';

import { useGetReviewLogs } from 'src/actions/reviewLogs';
import { useGetScanBatch, useGetScanBatches } from 'src/actions/scans';

import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

const REVIEW_ACTION_LABEL = {
  QUEUE_RESOLVED_EXISTING: 'ยืนยันรุ่นที่มีอยู่แล้ว',
  QUEUE_NEW_MODEL_CREATED: 'สร้างรุ่นใหม่จากคิว',
  QUEUE_REJECTED: 'ปฏิเสธรายการ',
};

function BatchDetailDialog({ id, onClose }) {
  const { batch, items, summary, batchLoading } = useGetScanBatch(id);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>รายละเอียดรอบสแกน #{id}</DialogTitle>
      <DialogContent>
        {batchLoading ? (
          <LoadingScreen sx={{ height: 200 }} />
        ) : (
          <Stack spacing={2}>
            <Box component="img" src={batch?.annotated_image_path} sx={{ width: '100%', borderRadius: 1.5 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {summary?.byCapacity.map((row) => (
                <Chip key={row.capacityGb} size="small" variant="soft" color="primary" label={`${row.capacityGb} GB × ${row.count}`} />
              ))}
              {summary?.uncertainCount > 0 && (
                <Chip size="small" variant="soft" color="warning" label={`ไม่แน่ใจ ${summary.uncertainCount}`} />
              )}
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>รุ่น</TableCell>
                  <TableCell>ความจุ</TableCell>
                  <TableCell>สถานะ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.brand ? `${item.brand} ${item.model_name}` : '—'}</TableCell>
                    <TableCell>{item.min_capacity_gb ? `${item.min_capacity_gb} GB` : '—'}</TableCell>
                    <TableCell>{item.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewLogsTable() {
  const { reviewLogs, reviewLogsLoading } = useGetReviewLogs();

  if (reviewLogsLoading) return <LoadingScreen />;
  if (!reviewLogs.length) {
    return <EmptyContent title="ยังไม่มี log การแก้ไข" sx={{ py: 10 }} />;
  }

  return (
    <Scrollbar>
      <TableContainer sx={{ minWidth: 640 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>วันที่</TableCell>
              <TableCell>แอดมิน</TableCell>
              <TableCell>การกระทำ</TableCell>
              <TableCell>หมายเหตุ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reviewLogs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>{fDateTime(log.created_at)}</TableCell>
                <TableCell>{log.admin_full_name ?? log.admin_username}</TableCell>
                <TableCell>
                  <Chip size="small" variant="soft" label={REVIEW_ACTION_LABEL[log.action] ?? log.action} />
                </TableCell>
                <TableCell>{log.note ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Scrollbar>
  );
}

export function ScanHistoryView() {
  const { batches, batchesLoading, batchesEmpty } = useGetScanBatches();
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('batches');

  return (
    <>
      <CustomBreadcrumbs heading="ประวัติการสแกน" links={[{ name: 'ตรวจสอบรุ่นโทรศัพท์' }, { name: 'ประวัติการสแกน' }]} sx={{ mb: { xs: 2, md: 3 } }} />

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="batches" label="ประวัติการสแกน" />
        <Tab value="reviewLogs" label="Log การแก้ไข" />
      </Tabs>

      {tab === 'batches' && (
        <Card>
          {batchesLoading ? (
            <LoadingScreen />
          ) : batchesEmpty ? (
            <EmptyContent title="ยังไม่มีประวัติการสแกน" sx={{ py: 10 }} />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 640 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>วันที่</TableCell>
                      <TableCell>ผู้สแกน</TableCell>
                      <TableCell>จำนวนเครื่อง</TableCell>
                      <TableCell>ช่องทาง</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id} hover onClick={() => setSelectedId(batch.id)} sx={{ cursor: 'pointer' }}>
                        <TableCell>{fDateTime(batch.created_at)}</TableCell>
                        <TableCell>{batch.user_full_name ?? `user #${batch.user_id}`}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{batch.device_count} เครื่อง</Typography>
                        </TableCell>
                        <TableCell>{batch.source === 'app' ? 'มือถือ' : 'เว็บ'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </Card>
      )}

      {tab === 'reviewLogs' && <Card><ReviewLogsTable /></Card>}

      {selectedId && <BatchDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  );
}
