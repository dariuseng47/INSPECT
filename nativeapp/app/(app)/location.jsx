import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fetchLocationByEpc } from '../../src/api/operations.api';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ScannerInput } from '../../src/components/ScannerInput';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { StatusChip } from '../../src/components/StatusChip';
import { brand, sage } from '../../src/theme/colors';
import { type } from '../../src/theme/typography';

export default function LocationScreen() {
  const [epc, setEpc] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!epc.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await fetchLocationByEpc(epc.trim());
      setResult(data);
    } catch (err) {
      setError(err?.message || 'ไม่พบตำแหน่งผ้ารหัสนี้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <AppCard style={styles.searchCard}>
        <Text style={[type.subtitle2, styles.label]}>ค้นหาตำแหน่งผ้าจากรหัส EPC</Text>
        <ScannerInput value={epc} onChangeText={setEpc} onSubmit={handleSearch} />
      </AppCard>

      {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

      {!loading && !result && !error ? (
        <EmptyState icon="map-marker-radius-outline" title="กรอกรหัส EPC เพื่อค้นหาตำแหน่งล่าสุด" />
      ) : null}

      {result ? (
        <AppCard style={styles.resultCard} elevated>
          <View style={styles.resultHeader}>
            <Text style={[type.h3, styles.epc]} numberOfLines={1}>
              {result.fabricItem.epcCode}
            </Text>
            <StatusChip label={result.fabricItem.status} color="primary" />
          </View>

          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={20} color={sage.text} />
            <Text style={[type.subtitle1, styles.locationText]}>
              {result.location.name || 'ไม่ทราบตำแหน่งปัจจุบัน'}
            </Text>
          </View>

          {result.lastScan ? (
            <Text style={[type.body2, styles.label]}>
              สแกนล่าสุด: {result.lastScan.event_type} —{' '}
              {new Date(result.lastScan.scanned_at).toLocaleString('th-TH')}
            </Text>
          ) : (
            <Text style={[type.body2, styles.label]}>ยังไม่มีประวัติการสแกน</Text>
          )}
        </AppCard>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    gap: 10,
  },
  label: {
    color: brand.grey[600],
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
    padding: 10,
    borderRadius: 12,
    backgroundColor: sage.tint,
  },
  locationText: {
    color: sage.text,
    flexShrink: 1,
  },
});
