'use client';

import { useMemo } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';

import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { fDateTime } from 'src/utils/format-time';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetProcessStatus } from 'src/actions/tracking';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { STATUS_LABEL, STATUS_COLOR } from '../../fabric/fabric-constants';

// ----------------------------------------------------------------------

// ลำดับตามการไหลของกระบวนการจริง — สถานะผ้ายุบเหลือ 4 (ดู fabric-constants.js / migration 023)
const PIPELINE_STATUSES = ['WASH', 'CENTRAL_STOCK', 'WARD_CABINET', 'IN_USE_WARD'];
const EXCEPTION_STATUSES = ['HOLD', 'DECOMMISSIONED'];

// label ของการ์ดขั้นตอนใช้ STATUS_LABEL กลางได้เลย ไม่ต้อง override
const PIPELINE_LABEL = {};

// map 1:1 หลังยุบสถานะ (ไม่มีการรวมหลายสถานะเป็นการ์ดเดียวอีกแล้ว)
const PIPELINE_VALUE_STATUSES = {};

// สีเฉพาะการ์ดขั้นตอนหลักของหน้านี้ — เลือกให้ทั้ง 4 ใบสีต่างกันชัดเจนจริงๆ (primary #00A76F กับ
// success #22C55E ของธีมนี้เป็นเขียวทั้งคู่ ใกล้กันเกินไปถ้าเอามาวางคู่กัน จึงเลี่ยงใช้ทั้งสองสีนี้ร่วมกัน)
const PIPELINE_COLOR = {
  WASH: 'warning', // #FFAB00 อำพัน
  CENTRAL_STOCK: 'primary', // #00A76F เขียว
  WARD_CABINET: 'info', // #00B8D9 ฟ้า
  IN_USE_WARD: 'secondary', // #8E33FF ม่วง
};

// StatCard อ่าน theme.vars.palette[color].lighter ตรงๆ — ไม่รองรับ 'default' แบบที่ Chip รองรับ
const STATCARD_COLOR_FALLBACK = { default: 'secondary' };

const STATUS_ICON = {
  WASH: 'solar:washing-machine-bold-duotone',
  CENTRAL_STOCK: 'solar:box-bold-duotone',
  WARD_CABINET: 'solar:archive-bold-duotone',
  IN_USE_WARD: 'solar:hospital-bold-duotone',
  HOLD: 'solar:pause-circle-bold-duotone',
  DECOMMISSIONED: 'solar:trash-bin-trash-bold-duotone',
};

export function OperationsProcessMonitorView() {
  const { hospitalId } = useEffectiveHospital();

  const { statusCounts, stuckItems, processStatusLoading, refreshProcessStatus } =
    useGetProcessStatus(hospitalId);

  // ผ้าผ่านจุดสแกนไหนก็ตาม (edge device จุดชั่ง/พับ, มือถือ operator ที่วอร์ด, sync ออฟไลน์)
  // -> อัปเดตภาพรวมนี้ทันที ไม่ต้องรอ poll รอบถัดไป
  useSocketEvent('scan:created', refreshProcessStatus);
  useSocketEvent('scan:ward-issue', refreshProcessStatus);
  useSocketEvent('scan:ward-receive', refreshProcessStatus);
  useSocketEvent('fabric:hold', refreshProcessStatus);
  useSocketEvent('fabric:decommission', refreshProcessStatus);

  const countByStatus = useMemo(
    () => new Map(statusCounts.map((row) => [row.status, Number(row.count)])),
    [statusCounts]
  );

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="ติดตามสถานะกระบวนการ"
        links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'ติดตามสถานะกระบวนการ' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {!hospitalId ? (
        <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
      ) : processStatusLoading ? (
        <LoadingScreen />
      ) : (
        <Stack spacing={3}>
          <div>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              ขั้นตอนหลัก
            </Typography>
            <Grid container spacing={2}>
              {PIPELINE_STATUSES.map((status) => (
                <Grid item xs={6} sm={4} md={3} key={status}>
                  <StatCard
                    icon={STATUS_ICON[status]}
                    title={PIPELINE_LABEL[status] ?? STATUS_LABEL[status]}
                    value={(PIPELINE_VALUE_STATUSES[status] ?? [status]).reduce(
                      (sum, s) => sum + (countByStatus.get(s) ?? 0),
                      0
                    )}
                    color={PIPELINE_COLOR[status]}
                  />
                </Grid>
              ))}
            </Grid>
          </div>

          <div>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              สถานะข้อยกเว้น
            </Typography>
            <Grid container spacing={2}>
              {EXCEPTION_STATUSES.map((status) => (
                <Grid item xs={6} sm={4} md={3} key={status}>
                  <StatCard
                    icon={STATUS_ICON[status]}
                    title={STATUS_LABEL[status]}
                    value={countByStatus.get(status) ?? 0}
                    color={STATCARD_COLOR_FALLBACK[STATUS_COLOR[status]] ?? STATUS_COLOR[status]}
                  />
                </Grid>
              ))}
            </Grid>
          </div>

          <Card>
            <CardHeader
              title="ผ้าที่ค้างสถานะเกินเวลาที่ตั้งไว้"
              subheader='ดูตั้งค่าได้ที่ "ความปลอดภัย & ตั้งค่าระบบ > ตั้งค่าเวลาค้างสถานะ"'
            />
            {stuckItems.length === 0 ? (
              <EmptyContent title="ไม่มีผ้าค้างสถานะเกินเวลา" sx={{ py: 8 }} />
            ) : (
              <Scrollbar>
                <TableContainer sx={{ minWidth: 640 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>รหัส EPC</TableCell>
                        <TableCell>สถานะ</TableCell>
                        <TableCell>เข้าสถานะนี้เมื่อ</TableCell>
                        <TableCell align="right">ค้างมาแล้ว</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stuckItems.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{item.epc_code}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              variant="soft"
                              color={STATUS_COLOR[item.status]}
                              label={STATUS_LABEL[item.status] ?? item.status}
                            />
                          </TableCell>
                          <TableCell>{fDateTime(item.updated_at)}</TableCell>
                          <TableCell align="right">
                            <Stack
                              direction="row"
                              spacing={0.5}
                              alignItems="center"
                              justifyContent="flex-end"
                            >
                              <Iconify
                                icon="solar:danger-triangle-bold-duotone"
                                width={16}
                                sx={{ color: 'error.main' }}
                              />
                              <Typography variant="body2" sx={{ color: 'error.main' }}>
                                {item.hours_stuck} ชม. (เกิน {item.max_hours} ชม.)
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Scrollbar>
            )}
          </Card>
        </Stack>
      )}
    </DashboardContent>
  );
}
