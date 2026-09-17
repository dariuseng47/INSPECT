'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { useGetFabricItemDetail } from 'src/actions/fabric';

// ----------------------------------------------------------------------

function shortEpc(epc) {
  return epc.length > 6 ? epc.slice(-6) : epc;
}

// แสดง EPC แค่ 6 ตัวท้ายทันทีที่สแกนติด (เร็ว ไม่ต้องรอ query) ส่วนชนิดผ้า lazy-load ตามมาทีหลัง
// ผ่าน useGetFabricItemDetail ต่อแท็ก (SWR แคชกันยิงซ้ำถ้า epc เดิมโผล่หลายจุด) เพื่อความเสถียร
// ของหน้าสแกนที่ต้องขึ้นผลไว ๆ ตอนสแกนรัว ๆ
export function ScannedTagLabel({ epc, hospitalId }) {
  const { fabricItem, detailLoading } = useGetFabricItemDetail(epc, hospitalId);

  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontFamily: 'monospace' }}
    >
      {shortEpc(epc)}
      {detailLoading ? (
        <CircularProgress size={9} thickness={7} sx={{ opacity: 0.6, color: 'inherit' }} />
      ) : (
        `-${fabricItem?.category_name || '?'}`
      )}
    </Box>
  );
}
