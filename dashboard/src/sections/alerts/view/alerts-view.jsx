'use client';

import { useMemo } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { fDateTime } from 'src/utils/format-time';

import { useGetAlerts } from 'src/actions/alerts';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { STATUS_LABEL, STATUS_COLOR } from '../../fabric/fabric-constants';

// ----------------------------------------------------------------------

function AlertSectionCard({ icon, title, subheader, count, children }) {
  return (
    <Card>
      <CardHeader
        avatar={<Iconify icon={icon} width={24} sx={{ color: 'warning.main' }} />}
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">{title}</Typography>
            <Chip size="small" color="error" label={count} />
          </Stack>
        }
        subheader={subheader}
      />
      {children}
    </Card>
  );
}

export function AlertsView() {
  const { hospitalId } = useEffectiveHospital();

  const {
    statusTimeout,
    parLevel,
    deviceOffline,
    weakSignal,
    stepSkipped,
    alertsLoading,
    refreshAlerts,
  } = useGetAlerts(hospitalId);

  // เหตุการณ์ที่อาจกระทบเงื่อนไขแจ้งเตือน (สัญญาณอ่อน/ข้ามขั้นตอน/par level/อุปกรณ์ offline)
  // -> รีเฟรชทันที ไม่ต้องรอ poll รอบถัดไป (30 วิ)
  useSocketEvent('scan:created', refreshAlerts);
  useSocketEvent('scan:ward-issue', refreshAlerts);
  useSocketEvent('scan:ward-receive', refreshAlerts);
  useSocketEvent('device:status_changed', refreshAlerts);

  const totalCount = useMemo(
    () =>
      statusTimeout.length + parLevel.length + deviceOffline.length + weakSignal.length + stepSkipped.length,
    [statusTimeout, parLevel, deviceOffline, weakSignal, stepSkipped]
  );

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="แจ้งเตือน & ข้อยกเว้น"
        links={[{ name: 'แดชบอร์ดโรงพยาบาล' }, { name: 'แจ้งเตือน & ข้อยกเว้น' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {!hospitalId ? (
        <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
      ) : alertsLoading ? (
        <LoadingScreen />
      ) : totalCount === 0 ? (
        <EmptyContent
          title="ไม่มีการแจ้งเตือน"
          description="ระบบไม่พบข้อยกเว้นหรือความผิดปกติในขณะนี้"
          sx={{ py: 10 }}
        />
      ) : (
        <Stack spacing={3}>
          {parLevel.length > 0 && (
            <AlertSectionCard
              icon="solar:box-minimalistic-bold-duotone"
              title="ผ้าคงเหลือต่ำกว่า Par Level"
              subheader="ตู้แผนกที่มีผ้าคงเหลือต่ำกว่า % แจ้งเตือนที่ตั้งไว้"
              count={parLevel.length}
            >
              <Scrollbar>
                <TableContainer sx={{ minWidth: 640 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>ตู้ / แผนก</TableCell>
                        <TableCell>หมวดหมู่ผ้า</TableCell>
                        <TableCell sx={{ width: 220 }}>คงเหลือ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {parLevel.map((row) => {
                        const pct = row.par_level_qty
                          ? Math.round((row.current_qty / row.par_level_qty) * 100)
                          : 0;
                        return (
                          <TableRow key={`${row.cabinet_id}-${row.fabric_category_id}`} hover>
                            <TableCell>
                              <Typography variant="body2">{row.cabinet_name}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {row.department_name}
                              </Typography>
                            </TableCell>
                            <TableCell>{row.category_name}</TableCell>
                            <TableCell>
                              <Stack spacing={0.5}>
                                <Typography variant="caption" sx={{ color: 'error.main' }}>
                                  {row.current_qty} / {row.par_level_qty} ({pct}%)
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(pct, 100)}
                                  color="error"
                                  sx={{ height: 6, borderRadius: 1 }}
                                />
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Scrollbar>
            </AlertSectionCard>
          )}

          {statusTimeout.length > 0 && (
            <AlertSectionCard
              icon="solar:clock-circle-bold-duotone"
              title="ผ้าค้างสถานะเกินเวลา"
              subheader="เกินเวลาสูงสุดที่ตั้งไว้ในตั้งค่าเวลาค้างสถานะ"
              count={statusTimeout.length}
            >
              <Scrollbar>
                <TableContainer sx={{ minWidth: 640 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>รหัส EPC</TableCell>
                        <TableCell>สถานะ</TableCell>
                        <TableCell align="right">ค้างมาแล้ว</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {statusTimeout.map((item) => (
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
                          <TableCell align="right" sx={{ color: 'error.main' }}>
                            {item.hours_stuck} ชม. (เกิน {item.max_hours} ชม.)
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Scrollbar>
            </AlertSectionCard>
          )}

          {deviceOffline.length > 0 && (
            <AlertSectionCard
              icon="solar:wi-fi-router-minimalistic-bold-duotone"
              title="อุปกรณ์ออฟไลน์"
              count={deviceOffline.length}
            >
              <Scrollbar>
                <TableContainer sx={{ minWidth: 480 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>ประเภทอุปกรณ์</TableCell>
                        <TableCell>ผู้ดูแล</TableCell>
                        <TableCell>ครั้งล่าสุดที่ออนไลน์</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {deviceOffline.map((device) => (
                        <TableRow key={device.id} hover>
                          <TableCell>{device.device_type}</TableCell>
                          <TableCell>
                            {device.caretaker_name || '—'}
                            {device.caretaker_phone ? ` (${device.caretaker_phone})` : ''}
                          </TableCell>
                          <TableCell>
                            {device.last_heartbeat_at ? fDateTime(device.last_heartbeat_at) : 'ไม่เคยออนไลน์'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Scrollbar>
            </AlertSectionCard>
          )}

          {weakSignal.length > 0 && (
            <AlertSectionCard
              icon="solar:signal-broken-bold-duotone"
              title="สัญญาณ RFID อ่อนกว่าเกณฑ์"
              subheader="อ่านแท็กได้ แต่สัญญาณต่ำกว่าค่าที่ตั้งไว้ (24 ชม.ล่าสุด)"
              count={weakSignal.length}
            >
              <Scrollbar>
                <TableContainer sx={{ minWidth: 640 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>รหัส EPC</TableCell>
                        <TableCell>อุปกรณ์</TableCell>
                        <TableCell>สัญญาณ / เกณฑ์</TableCell>
                        <TableCell>เวลา</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {weakSignal.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{row.epc_code}</TableCell>
                          <TableCell>{row.device_type}</TableCell>
                          <TableCell sx={{ color: 'error.main' }}>
                            {row.rssi_dbm} / {row.rssi_threshold_dbm} dBm
                          </TableCell>
                          <TableCell>{fDateTime(row.scanned_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Scrollbar>
            </AlertSectionCard>
          )}

          {stepSkipped.length > 0 && (
            <AlertSectionCard
              icon="solar:danger-triangle-bold-duotone"
              title="พบผ้าข้ามขั้นตอน"
              subheader="ผ้าที่ผ่านจุดสแกนโดยไม่มี log ของขั้นตอนก่อนหน้า (7 วันล่าสุด)"
              count={stepSkipped.length}
            >
              <Scrollbar>
                <TableContainer sx={{ minWidth: 480 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>รหัส EPC</TableCell>
                        <TableCell>ขั้นตอนที่สแกน</TableCell>
                        <TableCell>เวลา</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stepSkipped.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{row.epc_code}</TableCell>
                          <TableCell>{row.event_type}</TableCell>
                          <TableCell>{fDateTime(row.scanned_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Scrollbar>
            </AlertSectionCard>
          )}
        </Stack>
      )}
    </DashboardContent>
  );
}
