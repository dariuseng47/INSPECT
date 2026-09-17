'use client';

import { useRef, useState, useMemo } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { createScan } from 'src/actions/scans';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

const STATUS_LABEL = {
  auto_matched: 'จับคู่อัตโนมัติ',
  user_confirmed: 'ยืนยันแล้ว',
  unidentified: 'ไม่รู้จัก',
  pending_review: 'ไม่แน่ใจ',
};
const STATUS_COLOR = {
  auto_matched: 'success',
  user_confirmed: 'success',
  unidentified: 'error',
  pending_review: 'warning',
};

export function PhoneScanView() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [batches, setBatches] = useState([]); // ผลของทุกภาพในรอบนี้ (รองรับ bulk)
  const fileInputRef = useRef(null);

  const overallSummary = useMemo(() => {
    if (!batches.length) return null;
    const byCapacity = new Map();
    let totalDevices = 0;
    let uncertainCount = 0;
    batches.forEach(({ summary }) => {
      totalDevices += summary.totalDevices;
      uncertainCount += summary.uncertainCount;
      summary.byCapacity.forEach((row) => {
        byCapacity.set(row.capacityGb, (byCapacity.get(row.capacityGb) ?? 0) + row.count);
      });
    });
    return {
      totalDevices,
      uncertainCount,
      byCapacity: [...byCapacity.entries()]
        .map(([capacityGb, count]) => ({ capacityGb, count }))
        .sort((a, b) => a.capacityGb - b.capacityGb),
    };
  }, [batches]);

  const handleFilesSelected = async (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;

    setUploading(true);
    setBatches([]);
    setProgress({ done: 0, total: files.length });

    const results = [];
    let failedCount = 0;
    // อัพทีละภาพ (ไม่ยิงพร้อมกัน) — ML-Service รันบนเครื่อง CPU 2 core เดียว ยิงพร้อมกันจะแย่งกันช้าลงทั้งหมด
    await files.reduce(
      (chain, file) =>
        chain
          .then(() => createScan(file))
          .then((data) => {
            results.push(data);
          })
          .catch((error) => {
            failedCount += 1;
            toast.error(`"${file.name}" ตรวจสอบไม่สำเร็จ: ${error?.message || 'เกิดข้อผิดพลาด'}`);
          })
          .finally(() => {
            setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
          }),
      Promise.resolve()
    );

    setBatches(results);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const uncertainTotal = results.reduce((sum, r) => sum + r.summary.uncertainCount, 0);
    if (failedCount > 0) {
      toast.warning(`ตรวจสอบสำเร็จ ${results.length}/${files.length} ภาพ`);
    } else if (uncertainTotal > 0) {
      toast.warning(`พบ ${uncertainTotal} เครื่องที่ไม่แน่ใจ — ดูรายละเอียดที่คิวตรวจสอบ`);
    } else {
      toast.success('ตรวจสอบสำเร็จ');
    }
  };

  return (
    <>
      <CustomBreadcrumbs
        heading="ตรวจสอบรุ่นโทรศัพท์"
        links={[{ name: 'ตรวจสอบรุ่นโทรศัพท์' }]}
        action={
          <LoadingButton
            variant="contained"
            component="label"
            loading={uploading}
            startIcon={<Iconify icon="solar:camera-add-bold-duotone" />}
          >
            อัพโหลดภาพ (เลือกได้หลายภาพ)
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleFilesSelected}
            />
          </LoadingButton>
        }
        sx={{ mb: { xs: 2, md: 3 } }}
      />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        ถ่ายภาพโทรศัพท์วางเรียงบนโต๊ะ/ถาดในที่แสงสว่างปกติ ระบบจะตรวจจับแต่ละเครื่อง จับคู่รุ่น
        และสรุปจำนวนตามความจุให้อัตโนมัติ — เลือกได้หลายภาพพร้อมกันถ้ามีหลายถาด
      </Typography>

      {uploading && (
        <Card sx={{ p: 3, mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            กำลังตรวจสอบภาพที่ {progress.done + 1} จาก {progress.total}...
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress.total ? (progress.done / progress.total) * 100 : 0}
          />
        </Card>
      )}

      {!batches.length && !uploading && (
        <Card sx={{ py: 10 }}>
          <EmptyContent title="ยังไม่มีผลการตรวจสอบ" description='กด "อัพโหลดภาพ" เพื่อเริ่มสแกน' />
        </Card>
      )}

      {batches.length > 0 && overallSummary && (
        <Stack spacing={3}>
          <Card sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              สรุปผลรวม {batches.length} ภาพ — พบทั้งหมด {overallSummary.totalDevices} เครื่อง
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: overallSummary.uncertainCount ? 2 : 0 }}>
              {overallSummary.byCapacity.map((row) => (
                <Chip
                  key={row.capacityGb}
                  variant="soft"
                  color="primary"
                  label={`${row.capacityGb} GB × ${row.count} เครื่อง`}
                />
              ))}
            </Stack>
            {overallSummary.uncertainCount > 0 && (
              <Chip
                variant="soft"
                color="warning"
                icon={<Iconify icon="solar:question-circle-bold-duotone" />}
                label={`ไม่แน่ใจ ${overallSummary.uncertainCount} เครื่อง — ไปที่คิวตรวจสอบ`}
                component={RouterLink}
                href={paths.dashboard.phone.queue}
                clickable
              />
            )}
          </Card>

          {batches.map((data, index) => (
            <BatchResultCard key={data.batch.id} data={data} index={index} total={batches.length} />
          ))}
        </Stack>
      )}
    </>
  );
}

function BatchResultCard({ data, index, total }) {
  return (
    <Stack spacing={2}>
      {total > 1 && (
        <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
          ภาพที่ {index + 1} จาก {total}
        </Typography>
      )}
      <Card sx={{ p: 2 }}>
        <Box component="img" src={data.batch.annotated_image_path} sx={{ width: '100%', borderRadius: 1.5 }} />
      </Card>

      <Card>
        <Scrollbar>
          <TableContainer sx={{ minWidth: 640 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ภาพเครื่อง</TableCell>
                  <TableCell>รุ่นที่จับคู่ได้</TableCell>
                  <TableCell>ความจุ</TableCell>
                  <TableCell>ความมั่นใจ</TableCell>
                  <TableCell>สถานะ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Box component="img" src={item.crop_image_path} sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1 }} />
                    </TableCell>
                    <TableCell>{item.brand ? `${item.brand} ${item.model_name}` : '—'}</TableCell>
                    <TableCell>{item.min_capacity_gb ? `${item.min_capacity_gb} GB` : '—'}</TableCell>
                    <TableCell>
                      {item.confidence_score != null ? `${Math.round(item.confidence_score * 100)}%` : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="soft" color={STATUS_COLOR[item.status]} label={STATUS_LABEL[item.status]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      </Card>
    </Stack>
  );
}
