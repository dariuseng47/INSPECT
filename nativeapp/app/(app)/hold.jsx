import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { fetchFabricItems } from '../../src/api/fabric.api';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { StatusChip } from '../../src/components/StatusChip';
import { PermissionGate } from '../../src/components/PermissionGate';
import { STATUS_COLOR, STATUS_LABEL } from '../../src/constants/fabric';
import { brand, sage, surface } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

const filters = [
  { key: 'HOLD', label: 'พักใช้งาน' },
  { key: 'PENDING_DECOMMISSION', label: 'รออนุมัติ' },
  { key: 'DECOMMISSIONED', label: 'แทงชำรุด' },
];

const EMPTY_TITLE = {
  HOLD: 'ไม่มีผ้าที่พักใช้งาน',
  PENDING_DECOMMISSION: 'ไม่มีคำขอแทงชำรุดที่รออนุมัติ',
  DECOMMISSIONED: 'ไม่มีผ้าที่แทงชำรุด',
};

export default function HoldScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('HOLD');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchFabricItems({ status });
      setItems(data.fabricItems || []);
    } catch (err) {
      setError(err?.message || 'โหลดรายการไม่สำเร็จ');
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <PermissionGate perm="handheld.hold.view">
    <View style={styles.container}>
      <View style={styles.segment}>
        {filters.map((item) => {
          const active = status === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setStatus(item.key)}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <Text style={[type.subtitle2, styles.segmentLabel, active && styles.segmentLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="pause-circle-outline" title={EMPTY_TITLE[status]} />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/inventory/${item.epc_code}`)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <AppCard style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={[type.subtitle1, styles.epc]} numberOfLines={1}>
                    {item.epc_code}
                  </Text>
                  <Text style={[type.caption, styles.meta]}>ซักแล้ว {item.wash_count} รอบ</Text>
                </View>
                <StatusChip
                  label={STATUS_LABEL[item.status] ?? item.status}
                  color={STATUS_COLOR[item.status] || 'default'}
                />
              </View>
            </AppCard>
          </Pressable>
        )}
      />
    </View>
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: surface.background,
  },
  segment: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    backgroundColor: brand.grey[100],
    borderRadius: radius.sm,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentLabel: {
    color: brand.grey[500],
  },
  segmentLabelActive: {
    color: sage.text,
  },
  error: {
    color: brand.error.main,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    // Clearance for the floating tab bar — see ScreenContainer.jsx.
    paddingBottom: 110,
    gap: 10,
  },
  itemCard: {
    padding: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  epc: {
    color: brand.grey[800],
  },
  meta: {
    color: brand.grey[500],
  },
});
