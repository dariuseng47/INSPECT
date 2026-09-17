import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchLocationByEpc } from '../../../src/api/operations.api';
import { AppCard } from '../../../src/components/AppCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { ScannerInput } from '../../../src/components/ScannerInput';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { StatusChip } from '../../../src/components/StatusChip';
import { TriggerScanStatus } from '../../../src/components/TriggerScanStatus';
import { STATUS_COLOR, STATUS_LABEL } from '../../../src/constants/fabric';
import { useTriggerScan } from '../../../src/rfid/useTriggerScan';
import { brand, sage } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/theme';
import { type } from '../../../src/theme/typography';

// เดิมหน้านี้โชว์ลิสต์ผ้าทั้งหมด — เปลี่ยนเป็นสแกนหาทีละชิ้นแทน (เร็วกว่าสำหรับหน้างานจริง ไม่ต้อง
// ไล่สกอลหาในลิสต์ยาวๆ) และรวมข้อมูลตำแหน่งผ้าล่าสุดมาแสดงในผลลัพธ์เดียวกันเลย (เดิมต้องไปหน้า
// "ค้นหาตำแหน่งผ้า" แยกต่างหาก) — ใช้ endpoint เดียวกับหน้านั้น (GET /tracking/location/:epc)
// เพราะ response มีทั้งสถานะผ้าและตำแหน่งอยู่แล้วในตัว
export default function InventoryScreen() {
  const router = useRouter();
  const [epc, setEpc] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // รับ code ตรงๆ ได้ (ตอนสแกนจากเครื่องอ่าน state ยังไม่ทันอัปเดต) — ถ้าไม่ส่งมาใช้ค่าในช่องพิมพ์
  const handleSearch = async (codeArg) => {
    const code = (typeof codeArg === 'string' ? codeArg : epc).trim();
    if (!code) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await fetchLocationByEpc(code);
      setResult(data);
    } catch (err) {
      setError(err?.message || 'ไม่พบผ้ารหัสนี้');
    } finally {
      setLoading(false);
    }
  };

  // เหนี่ยวปุ่มไกที่ตัวเครื่อง → เอา EPC แท็กแรกไปค้นสถานะ/ตำแหน่งให้อัตโนมัติ
  const { hasRfidDevice, rfidStatus, rfidErrorMessage, triggerActive } = useTriggerScan({
    onEpc: (scanned) => {
      setEpc(scanned);
      handleSearch(scanned);
    },
  });

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/inventory/register')}
              style={styles.headerButton}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={22} color={brand.primary.dark} />
            </Pressable>
          ),
        }}
      />

      <AppCard style={styles.searchCard} elevated>
        <View style={styles.searchTitleRow}>
          <View style={styles.searchIcon}>
            <MaterialCommunityIcons name="barcode-scan" size={24} color={brand.primary.dark} />
          </View>
          <View style={styles.searchTitleText}>
            <Text style={[type.subtitle1, styles.searchTitle]}>สแกนเพื่อค้นหาผ้า</Text>
            <Text style={[type.body2, styles.searchHint]}>ดูสถานะและตำแหน่งล่าสุดจากรหัส EPC</Text>
          </View>
        </View>
        {hasRfidDevice ? (
          <TriggerScanStatus
            status={rfidStatus}
            errorMessage={rfidErrorMessage}
            triggerActive={triggerActive}
            busy={loading}
            busyLabel="กำลังค้นหา..."
            idleLabel="เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อสแกนผ้า"
          />
        ) : null}

        <ScannerInput value={epc} onChangeText={setEpc} onSubmit={handleSearch} />
      </AppCard>

      {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

      {!loading && !result && !error ? (
        <EmptyState icon="archive-search-outline" title="กรอกหรือสแกนรหัส EPC เพื่อค้นหาผ้า" />
      ) : null}

      {result ? (
        <Pressable onPress={() => router.push(`/inventory/${result.fabricItem.epcCode}`)}>
          <AppCard style={styles.resultCard} elevated>
            <View style={styles.resultHeader}>
              <Text style={[type.h3, styles.epc]} numberOfLines={1}>
                {result.fabricItem.epcCode}
              </Text>
              <StatusChip
                label={STATUS_LABEL[result.fabricItem.status] ?? result.fabricItem.status}
                color={STATUS_COLOR[result.fabricItem.status] || 'default'}
              />
            </View>

            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={sage.text} />
              <Text style={[type.subtitle1, styles.locationText]}>
                {result.location.name || 'ไม่ทราบตำแหน่งปัจจุบัน'}
              </Text>
            </View>

            {result.lastScan ? (
              <Text style={[type.body2, styles.meta]}>
                สแกนล่าสุด: {result.lastScan.event_type} —{' '}
                {new Date(result.lastScan.scanned_at).toLocaleString('th-TH')}
              </Text>
            ) : (
              <Text style={[type.body2, styles.meta]}>ยังไม่มีประวัติการสแกน</Text>
            )}

            <View style={styles.detailLinkRow}>
              <Text style={[type.subtitle2, styles.detailLink]}>ดูรายละเอียดเพิ่มเติม</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={brand.primary.dark} />
            </View>
          </AppCard>
        </Pressable>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    marginRight: 12,
    padding: 4,
  },
  searchCard: {
    gap: 14,
  },
  searchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
  },
  searchTitleText: {
    flex: 1,
    gap: 2,
  },
  searchTitle: {
    color: brand.grey[800],
  },
  searchHint: {
    color: brand.grey[500],
  },
  error: {
    color: brand.error.main,
  },
  resultCard: {
    gap: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  epc: {
    color: brand.grey[800],
    flexShrink: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: sage.tint,
  },
  locationText: {
    color: sage.text,
    flexShrink: 1,
  },
  meta: {
    color: brand.grey[500],
  },
  detailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  detailLink: {
    color: brand.primary.dark,
  },
});
