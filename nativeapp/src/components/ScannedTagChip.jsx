import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchFabricItemByEpc } from '../api/fabric.api';
import { alpha, brand, sage } from '../theme/colors';
import { radius } from '../theme/theme';
import { type } from '../theme/typography';

function shortEpc(epc) {
  return epc.length > 6 ? epc.slice(-6) : epc;
}

// สถานะที่จ่ายผ้าออกไม่ได้จริง (server ปฏิเสธ 400 INVALID_STATE ดู scans.controller.js#wardIssue) —
// เจอสถานะพวกนี้ตอนสแกนถือว่า "ข้ามขั้นตอน" เตือนสีแดงไว้ก่อนกดยืนยัน กันสแกนไปแล้วเจอ error ทีหลัง
const STEP_SKIPPED_STATUSES = new Set(['HOLD', 'DECOMMISSIONED', 'PENDING_DECOMMISSION']);

// แสดง EPC แค่ 6 ตัวท้ายทันทีที่สแกนติด (เร็ว ไม่ต้องรอ query) ส่วนชนิดผ้า+สถานะ lazy-load ตามมาทีหลัง
// จาก GET /fabric-items/:epc ทีละแท็ก — เพื่อความไว โชว์สีปกติไปก่อน แล้วค่อยสลับเป็นแดงทีหลังถ้าข้ามขั้นตอนจริง
export function ScannedTagChip({ epc, onRemove }) {
  const [categoryName, setCategoryName] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetchFabricItemByEpc(epc)
      .then((data) => {
        if (cancelled) return;
        setCategoryName(data?.fabricItem?.category_name ?? null);
        setStatus(data?.fabricItem?.status ?? null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [epc]);

  const isStepSkipped = !loading && !failed && STEP_SKIPPED_STATUSES.has(status);

  return (
    <View style={[styles.chip, isStepSkipped && styles.chipSkipped]}>
      <Text style={[type.caption, styles.label, isStepSkipped && styles.labelSkipped]}>
        {shortEpc(epc)}
        {loading ? '' : `-${failed ? '?' : categoryName || '?'}`}
      </Text>
      {loading ? <ActivityIndicator size="small" color={sage.text} /> : null}
      {onRemove ? (
        <Pressable onPress={() => onRemove(epc)} hitSlop={6}>
          <MaterialCommunityIcons
            name="close"
            size={14}
            color={isStepSkipped ? brand.error.dark : sage.text}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: alpha(brand.primary.main, 0.12),
  },
  chipSkipped: {
    backgroundColor: alpha(brand.error.main, 0.14),
  },
  label: {
    color: sage.text,
  },
  labelSkipped: {
    color: brand.error.dark,
  },
});
