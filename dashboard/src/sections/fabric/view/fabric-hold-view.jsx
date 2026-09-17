'use client';

import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import CardContent from '@mui/material/CardContent';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';

import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { CONFIG } from 'src/config-global';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  holdFabricItem,
  useGetFabricItems,
  decommissionFabricItem,
  useGetFabricItemDetail,
} from 'src/actions/fabric';
import {
  rejectDecommissionRequest,
  approveDecommissionRequest,
  useGetDecommissionRequests,
} from 'src/actions/decommissionRequests';

import { toast } from 'src/components/snackbar';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { HeldItemsCard } from './held-items-card';
import {
  STATUS_LABEL,
  STATUS_COLOR,
  REASON_CODE_OPTIONS,
  MAX_PHOTO_SIZE_BYTES,
} from '../fabric-constants';

// ----------------------------------------------------------------------

const ActionSchema = zod.object({
  epcCode: zod.string().min(1, { message: 'กรอกรหัส EPC' }),
  reasonCode: zod.string().min(1, { message: 'เลือกเหตุผล' }),
  // react-dropzone ยิง onDrop มาพร้อม acceptedFiles ว่างเปล่าด้วยตอนไฟล์โดน reject (เช่น เกิน
  // 2MB) ทำให้ค่า field กลายเป็น undefined ไม่ใช่ null — ต้องรับทั้งสองแบบ ไม่งั้นจะเห็น error
  // message ดิบของ zod ("Input not instance of File") ซ้อนกับกล่อง rejection ของ dropzone เอง
  photo: zod
    .instanceof(File)
    .nullable()
    .optional()
    .refine((file) => !file || file.size <= MAX_PHOTO_SIZE_BYTES, {
      message: 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 2MB',
    }),
});

// CONFIG.serverUrl มี /api/v1 ต่อท้ายอยู่แล้ว (baseURL ของ axios instance) แต่รูปที่อัปโหลด
// เสิร์ฟจาก root ของ server ตรงๆ (server/src/app.js: app.use('/uploads', ...)) ต้องตัด /api/v1 ออก
const SERVER_ORIGIN = CONFIG.serverUrl.replace(/\/api\/v1\/?$/, '');

// คำขอแทงชำรุดที่ยิงมาจากมือถือ (nativeapp/) เข้าสถานะรออนุมัติเสมอ ต้องมี admin กด approve/reject
// ที่นี่ก่อนถึงจะมีผลจริงกับ fabric_items.status — ดู
// server/src/controllers/fabricItems.controller.js#decommissionFabricItem
function PendingDecommissionCard({ hospitalId }) {
  const { requests, requestsLoading, requestsEmpty, refreshRequests } = useGetDecommissionRequests(hospitalId);
  const [submittingId, setSubmittingId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reviewNote, setReviewNote] = useState('');

  useSocketEvent('fabric:decommission-pending', (payload) => {
    toast.info(`มีคำขอแทงชำรุดใหม่จากมือถือ: ${payload.epcCode}`);
    refreshRequests();
  });
  useSocketEvent('fabric:decommission-reviewed', () => {
    refreshRequests();
  });

  const handleApprove = async (id) => {
    setSubmittingId(id);
    try {
      await approveDecommissionRequest(id);
      toast.success('อนุมัติแทงชำรุดสำเร็จ');
      refreshRequests();
    } catch (error) {
      toast.error(error?.message || 'อนุมัติไม่สำเร็จ');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReject = async () => {
    setSubmittingId(rejectTarget.id);
    try {
      await rejectDecommissionRequest(rejectTarget.id, { reviewNote: reviewNote.trim() || undefined });
      toast.success('ปฏิเสธคำขอแล้ว');
      setRejectTarget(null);
      setReviewNote('');
      refreshRequests();
    } catch (error) {
      toast.error(error?.message || 'ปฏิเสธไม่สำเร็จ');
    } finally {
      setSubmittingId(null);
    }
  };

  if (!hospitalId || (!requestsLoading && requestsEmpty)) return null;

  return (
    <Card>
      <CardHeader title="คำขอแทงชำรุดรออนุมัติ (จากมือถือ)" subheader="ต้องตรวจสอบก่อนถึงจะมีผลจริง" />
      {requestsLoading ? (
        <LoadingScreen sx={{ height: 120 }} />
      ) : (
        <Scrollbar>
          <TableContainer sx={{ minWidth: 720 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>รหัส EPC</TableCell>
                  <TableCell>เหตุผล</TableCell>
                  <TableCell>รูปภาพ</TableCell>
                  <TableCell>ขอเมื่อ</TableCell>
                  <TableCell align="right">การดำเนินการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} hover>
                    <TableCell>{request.epc_code}</TableCell>
                    <TableCell>{request.reason_code}</TableCell>
                    <TableCell>
                      {request.photo_url ? (
                        <Button
                          size="small"
                          href={`${SERVER_ORIGIN}${request.photo_url}`}
                          target="_blank"
                          rel="noopener"
                        >
                          ดูรูป
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{new Date(request.created_at).toLocaleString('th-TH')}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <LoadingButton
                          size="small"
                          variant="contained"
                          color="success"
                          loading={submittingId === request.id}
                          disabled={!!submittingId}
                          onClick={() => handleApprove(request.id)}
                        >
                          อนุมัติ
                        </LoadingButton>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          disabled={!!submittingId}
                          onClick={() => setRejectTarget(request)}
                        >
                          ปฏิเสธ
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      )}

      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ปฏิเสธคำขอแทงชำรุด — {rejectTarget?.epc_code}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="เหตุผลที่ปฏิเสธ (ถ้ามี)"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)}>ยกเลิก</Button>
          <LoadingButton
            variant="contained"
            color="error"
            loading={submittingId === rejectTarget?.id}
            onClick={handleReject}
          >
            ยืนยันปฏิเสธ
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function HoldActionCard({ hospitalId, onDone }) {
  const [lookupEpc, setLookupEpc] = useState('');
  const { fabricItem, detailLoading } = useGetFabricItemDetail(lookupEpc || undefined, hospitalId);

  const methods = useForm({
    resolver: zodResolver(ActionSchema),
    defaultValues: { epcCode: '', reasonCode: '', photo: null },
  });
  const {
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
  } = methods;

  const epcCode = watch('epcCode');

  const handleLookup = useCallback(() => setLookupEpc(epcCode), [epcCode]);

  const runAction = (action) =>
    handleSubmit(async (data) => {
      if (!fabricItem) {
        toast.error('กรุณาค้นหาและยืนยันรหัส EPC ก่อน');
        return;
      }
      try {
        let payload;
        if (data.photo instanceof File) {
          payload = new FormData();
          payload.append('reasonCode', data.reasonCode);
          payload.append('photo', data.photo);
        } else {
          payload = { reasonCode: data.reasonCode };
        }

        if (action === 'hold') {
          await holdFabricItem(fabricItem.id, payload);
          toast.success('พักผ้าชิ้นนี้สำเร็จ');
        } else {
          await decommissionFabricItem(fabricItem.id, payload);
          toast.success('แทงชำรุดผ้าชิ้นนี้สำเร็จ');
        }
        reset();
        setLookupEpc('');
        onDone();
      } catch (error) {
        toast.error(error?.message || 'ดำเนินการไม่สำเร็จ');
      }
    });

  return (
    <Card>
      <CardHeader title="พัก / แทงชำรุดผ้า" subheader="ค้นหาด้วยรหัส EPC แล้วเลือกการดำเนินการ" />
      <CardContent>
        <Form methods={methods}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1}>
              <Field.Text name="epcCode" label="รหัส EPC" disabled={!hospitalId} fullWidth />
              <Button type="button" variant="outlined" onClick={handleLookup} sx={{ flexShrink: 0 }}>
                ค้นหา
              </Button>
            </Stack>

            {detailLoading && lookupEpc && <LoadingScreen sx={{ height: 80 }} />}

            {fabricItem && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral' }}
              >
                <Typography variant="body2">พบผ้า: {fabricItem.epc_code} — สถานะปัจจุบัน</Typography>
                <Chip
                  size="small"
                  variant="soft"
                  color={STATUS_COLOR[fabricItem.status]}
                  label={STATUS_LABEL[fabricItem.status] ?? fabricItem.status}
                />
              </Stack>
            )}

            <Field.Select name="reasonCode" label="เหตุผล" disabled={!hospitalId}>
              {REASON_CODE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Field.Select>

            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                รูปภาพประกอบ (ถ้ามี)
              </Typography>
              <Field.Upload
                name="photo"
                maxSize={MAX_PHOTO_SIZE_BYTES}
                disabled={!hospitalId}
                onDelete={() => methods.setValue('photo', null, { shouldValidate: true })}
                helperText="รองรับไฟล์ JPG, PNG, WEBP ขนาดไม่เกิน 2MB"
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <LoadingButton
                type="button"
                variant="contained"
                color="warning"
                loading={isSubmitting}
                disabled={!fabricItem}
                onClick={runAction('hold')}
              >
                พักใช้งาน
              </LoadingButton>
              <LoadingButton
                type="button"
                variant="contained"
                color="error"
                loading={isSubmitting}
                disabled={!fabricItem}
                onClick={runAction('decommission')}
              >
                แทงชำรุด
              </LoadingButton>
            </Stack>
          </Stack>
        </Form>
      </CardContent>
    </Card>
  );
}

export function FabricHoldView() {
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin, hospitals } = useEffectiveHospital();
  // ใส่ชื่อโรงพยาบาลลงในรายงาน export (ดู pattern เดียวกันใน operations-restock-report-view.jsx)
  const hospitalName = isSuperadmin
    ? hospitals.find((h) => h.id === hospitalId)?.name
    : user?.hospital_name;

  const { fabricItems, fabricItemsLoading, refreshFabricItems } = useGetFabricItems({
    hospitalId,
    status: 'HOLD',
  });

  // เครื่องอื่น (เช่นมือถือ operator) พัก/แทงชำรุดผ้า -> อัปเดตตารางนี้ทันทีไม่ต้องรีเฟรช
  // (server ยิง event เข้าห้อง hospital:<id> เดียวกับที่ socket นี้ join อัตโนมัติตาม JWT)
  useSocketEvent('fabric:hold', (payload) => {
    toast.info(`มีการพักผ้าใหม่: ${payload.epcCode}`);
    refreshFabricItems();
  });
  useSocketEvent('fabric:decommission', (payload) => {
    toast.info(`มีการแทงชำรุดผ้าใหม่: ${payload.epcCode}`);
    refreshFabricItems();
  });

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN', 'OPERATOR']}>
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="รายการพัก & ชำรุด"
          links={[{ name: 'จัดการผ้าและล็อต' }, { name: 'รายการพัก & ชำรุด' }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Stack spacing={3}>
          {['ADMIN', 'SUPERADMIN'].includes(user?.role) && (
            <PendingDecommissionCard hospitalId={hospitalId} />
          )}

          <HoldActionCard hospitalId={hospitalId} onDone={refreshFabricItems} />

          <HeldItemsCard
            hospitalId={hospitalId}
            hospitalName={hospitalName}
            fabricItems={fabricItems}
            fabricItemsLoading={fabricItemsLoading}
          />
        </Stack>
      </DashboardContent>
    </RoleBasedGuard>
  );
}
