'use client';

import { useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
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
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const data = await createScan(file);
      setResult(data);
      if (data.summary.uncertainCount > 0) {
        toast.warning(`พบ ${data.summary.uncertainCount} เครื่องที่ไม่แน่ใจ — ดูรายละเอียดที่คิวตรวจสอบ`);
      } else {
        toast.success('ตรวจสอบสำเร็จ');
      }
    } catch (error) {
      toast.error(error?.message || 'ตรวจสอบไม่สำเร็จ');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <CustomBreadcrumbs
        heading="ตรวจสอบรุ่นโทรศัพท์"
        links={[{ name: 'ตรวจสอบรุ่นโทรศัพท์' }]}
        action={
          <LoadingButton variant="contained" component="label" loading={uploading} startIcon={<Iconify icon="solar:camera-add-bold-duotone" />}>
            อัพโหลดภาพ
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleFileSelected}
            />
          </LoadingButton>
        }
        sx={{ mb: { xs: 2, md: 3 } }}
      />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        ถ่ายภาพโทรศัพท์วางเรียงบนโต๊ะ/ถาดในที่แสงสว่างปกติ ระบบจะตรวจจับแต่ละเครื่อง จับคู่รุ่น
        และสรุปจำนวนตามความจุให้อัตโนมัติ
      </Typography>

      {!result && !uploading && (
        <Card sx={{ py: 10 }}>
          <EmptyContent title="ยังไม่มีผลการตรวจสอบ" description='กด "อัพโหลดภาพ" เพื่อเริ่มสแกน' />
        </Card>
      )}

      {result && (
        <Stack spacing={3}>
          <Card sx={{ p: 2 }}>
            <Box component="img" src={result.batch.annotated_image_path} sx={{ width: '100%', borderRadius: 1.5 }} />
          </Card>

          <Card sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              สรุปผล — พบทั้งหมด {result.summary.totalDevices} เครื่อง
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: result.summary.uncertainCount ? 2 : 0 }}>
              {result.summary.byCapacity.map((row) => (
                <Chip
                  key={row.capacityGb}
                  variant="soft"
                  color="primary"
                  label={`${row.capacityGb} GB × ${row.count} เครื่อง`}
                />
              ))}
            </Stack>
            {result.summary.uncertainCount > 0 && (
              <Chip
                variant="soft"
                color="warning"
                icon={<Iconify icon="solar:question-circle-bold-duotone" />}
                label={`ไม่แน่ใจ ${result.summary.uncertainCount} เครื่อง — ไปที่คิวตรวจสอบ`}
                component={RouterLink}
                href={paths.dashboard.phone.queue}
                clickable
              />
            )}
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
                    {result.items.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Box component="img" src={item.crop_image_path} sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1 }} />
                        </TableCell>
                        <TableCell>
                          {item.brand ? `${item.brand} ${item.model_name}` : '—'}
                        </TableCell>
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
      )}
    </>
  );
}
