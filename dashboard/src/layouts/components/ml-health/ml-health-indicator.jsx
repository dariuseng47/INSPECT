'use client';

import { useRef } from 'react';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { useMlHealth } from 'src/actions/mlHealth';
import { fDateTime } from 'src/utils/format-time';

import { useBoolean } from 'src/hooks/use-boolean';

// ----------------------------------------------------------------------

function loadColor(percent) {
  if (percent == null) return 'default';
  if (percent >= 85) return 'error';
  if (percent >= 60) return 'warning';
  return 'success';
}

export function MlHealthIndicator() {
  const { health, reachable } = useMlHealth();
  const popover = useBoolean();
  const anchorRef = useRef(null);

  const dotColor = !health ? 'text.disabled' : reachable ? 'success.main' : 'error.main';
  const label = !health ? 'กำลังเชื่อมต่อ...' : reachable ? 'ML-Service ออนไลน์' : 'ML-Service ไม่ตอบสนอง';

  return (
    <>
      <Tooltip title={label}>
        <Box
          ref={anchorRef}
          onClick={popover.onTrue}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            cursor: 'pointer',
            border: '1px solid',
            borderColor: 'divider',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: 'nowrap', display: { xs: 'none', md: 'block' } }}>
            ML-Service
          </Typography>
        </Box>
      </Tooltip>

      <Popover
        open={popover.value}
        onClose={popover.onFalse}
        anchorEl={anchorRef.current}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 280, p: 2 } } }}
      >
        {!reachable ? (
          <Typography variant="body2" sx={{ color: 'error.main' }}>
            เชื่อมต่อ ML-Service ไม่ได้ในขณะนี้ — การตรวจสอบรุ่นโทรศัพท์อาจใช้งานไม่ได้ชั่วคราว
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2">สถานะ ML-Service</Typography>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption">CPU</Typography>
                <Typography variant="caption">{health.cpuPercent?.toFixed(0)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={health.cpuPercent ?? 0} color={loadColor(health.cpuPercent)} sx={{ height: 6, borderRadius: 1 }} />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption">หน่วยความจำ</Typography>
                <Typography variant="caption">{health.memoryPercent?.toFixed(0)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={health.memoryPercent ?? 0} color={loadColor(health.memoryPercent)} sx={{ height: 6, borderRadius: 1 }} />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pt: 0.5 }}>
              <Row label="ภาพในฐานข้อมูล" value={`${health.indexSize} ภาพ`} />
              <Row label="จำนวนคำขอทั้งหมด" value={health.requestCount} />
              <Row label="เรียกใช้ล่าสุด" value={health.lastRequestAt ? fDateTime(health.lastRequestAt * 1000) : '—'} />
              <Row label="ทำงานต่อเนื่อง" value={formatUptime(health.uptimeSeconds)} />
            </Box>
          </Box>
        )}
      </Popover>
    </>
  );
}

function Row({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  );
}

function formatUptime(seconds) {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  return `${minutes} นาที`;
}
