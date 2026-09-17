import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchWardIssueRounds } from '../../src/api/operations.api';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { alpha, brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

// "รอบ" หนึ่ง = ตรวจนับตู้ผ้าสำเร็จ 1 ครั้ง (ดู ward.jsx ขั้นที่ 1) แล้วผ้าทุกชิ้นที่จ่ายออกตามมาใน
// รอบนั้น (ขั้นที่ 2 + ปุ่มโอนผ้าเข้าแผนกนี้จากรายการ anomaly) จะถูกนับรวมเป็น stamp เดียวในหน้านี้ —
// ดู GET /scans/ward-issue-rounds (server/src/controllers/scans.controller.js)
function formatDateTime(value) {
  return new Date(value).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function RoundStamp({ round }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <AppCard style={styles.card} elevated>
      <View style={styles.headerRow}>
        <View style={styles.stampIcon}>
          <MaterialCommunityIcons name="check-decagram" size={22} color={sage.text} />
        </View>
        <View style={styles.headerText}>
          <Text style={[type.subtitle1, styles.cabinetName]} numberOfLines={1}>
            {round.cabinetName}
          </Text>
          <Text style={[type.caption, styles.meta]} numberOfLines={1}>
            {round.departmentName} • {round.userName}
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={[type.subtitle2, styles.countBadgeText]}>{round.itemCount} ชิ้น</Text>
        </View>
      </View>

      <Text style={[type.caption, styles.meta]}>{formatDateTime(round.createdAt)}</Text>

      <View style={styles.breakdownList}>
        {round.categoryBreakdown.map((row) => (
          <View key={row.categoryName} style={styles.breakdownRow}>
            <Text style={[type.body2, styles.breakdownCategory]} numberOfLines={1}>
              {row.categoryName}
            </Text>
            <Text style={[type.subtitle2, styles.breakdownCount]}>× {row.count}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={() => setExpanded((prev) => !prev)} style={styles.detailToggle} hitSlop={8}>
        <Text style={[type.body2, styles.detailToggleText]}>
          {expanded ? 'ซ่อนรายการ EPC' : 'ดูรายการ EPC ทั้งหมด'}
        </Text>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={brand.primary.dark}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.chipRow}>
          {round.items.map((item) => (
            <View key={item.epcCode} style={styles.epcChip}>
              <Text style={[type.caption, styles.epcChipLabel]}>{item.epcCode}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </AppCard>
  );
}

export default function WardHistoryScreen() {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError('');
      fetchWardIssueRounds()
        .then((data) => {
          if (!cancelled) setRounds(data.rounds || []);
        })
        .catch((err) => {
          if (!cancelled) setError(err?.message || 'โหลดประวัติไม่สำเร็จ');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <ScreenContainer>
      <Text style={[type.h3, styles.title]}>ประวัติการจ่ายผ้า</Text>
      <Text style={[type.body2, styles.subtitle]}>แต่ละรายการคือ 1 รอบตรวจนับตู้ผ้า พร้อมสรุปว่าจ่ายอะไรไปบ้าง</Text>

      {loading ? (
        <ActivityIndicator color={brand.primary.main} style={styles.loading} />
      ) : error ? (
        <Text style={[type.body2, styles.error]}>{error}</Text>
      ) : rounds.length === 0 ? (
        <EmptyState icon="history" title="ยังไม่มีประวัติการจ่ายผ้า" />
      ) : (
        rounds.map((round) => <RoundStamp key={round.roundId} round={round} />)
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: brand.grey[800],
  },
  subtitle: {
    color: brand.grey[500],
    marginTop: -8,
  },
  loading: {
    marginTop: 24,
  },
  error: {
    color: brand.error.main,
  },
  card: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stampIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  cabinetName: {
    color: brand.grey[800],
  },
  meta: {
    color: brand.grey[500],
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: alpha(brand.primary.main, 0.12),
  },
  countBadgeText: {
    color: brand.primary.dark,
  },
  breakdownList: {
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: brand.grey[100],
  },
  breakdownCategory: {
    flex: 1,
    color: brand.grey[700],
  },
  breakdownCount: {
    color: brand.grey[800],
  },
  detailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  detailToggleText: {
    color: brand.primary.dark,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  epcChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: alpha(brand.primary.main, 0.12),
  },
  epcChipLabel: {
    color: sage.text,
  },
});
