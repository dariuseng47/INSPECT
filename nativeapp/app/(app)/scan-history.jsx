import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchScanBatches } from '../../src/api/scans.api';
import { resolveUploadUrl } from '../../src/api/client';
import { EmptyState } from '../../src/components/EmptyState';
import { PermissionGate } from '../../src/components/PermissionGate';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { brand } from '../../src/theme/colors';
import { type } from '../../src/theme/typography';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value.replace(' ', 'T')).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function ScanHistoryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetchScanBatches()
      .then((data) => {
        if (mounted) setBatches(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PermissionGate perm="handheld.phone.scan.view">
      <ScreenContainer scroll={false}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={brand.grey[700]} />
          <Text style={[type.body2, styles.backLabel]}>กลับ</Text>
        </Pressable>

        <Text style={[type.h3, styles.heading]}>ประวัติการสแกนของฉัน</Text>

        {loading ? (
          <ActivityIndicator size="large" color={brand.primary.main} style={{ marginTop: 32 }} />
        ) : batches.length === 0 ? (
          <EmptyState icon="history" title="ยังไม่มีประวัติการสแกน" />
        ) : (
          <FlatList
            data={batches}
            keyExtractor={(b) => String(b.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Image source={{ uri: resolveUploadUrl(item.annotated_image_path) }} style={styles.thumb} />
                <View style={styles.rowInfo}>
                  <Text style={[type.body1, styles.rowTitle]}>{item.device_count} เครื่อง</Text>
                  <Text style={[type.caption, styles.meta]}>{formatDateTime(item.created_at)}</Text>
                </View>
              </View>
            )}
          />
        )}
      </ScreenContainer>
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backLabel: { color: brand.grey[700] },
  heading: { color: brand.grey[800] },
  list: { gap: 12, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: brand.grey[100],
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  rowInfo: { gap: 2 },
  rowTitle: { color: brand.grey[800] },
  meta: { color: brand.grey[500] },
});
