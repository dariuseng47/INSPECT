import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthContext';
import { AppCard } from '../../src/components/AppCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useHospitalWorkspace } from '../../src/hospital/HospitalWorkspaceContext';
import { alpha, brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

const quickActions = [
  { href: '/ward', label: 'รับ-ส่งผ้าวอร์ด', icon: 'truck-delivery-outline', perm: 'handheld.ward.view' },
  { href: '/inventory', label: 'จัดการผ้า', icon: 'archive-outline', perm: 'handheld.inventory.view' },
  {
    href: '/status-change',
    label: 'เปลี่ยนสถานะผ้า',
    icon: 'swap-horizontal',
    perm: 'handheld.status_change.view',
  },
];

export default function HomeScreen() {
  const { user, can } = useAuth();
  const visibleActions = quickActions.filter((a) => can(a.perm));
  const { isSuperadmin, canSwitch, activeHospital } = useHospitalWorkspace();
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[type.body2, styles.greetingLabel]}>สวัสดี</Text>
          <Text style={[type.h3, styles.greetingName]} numberOfLines={1}>
            {user?.full_name || user?.username}
          </Text>
          {!isSuperadmin && !canSwitch && (activeHospital?.name || user?.hospital_name) ? (
            <View style={styles.hospitalBadge}>
              <MaterialCommunityIcons name="hospital-building" size={14} color={sage.text} />
              <Text style={[type.caption, styles.hospitalBadgeText]}>
                {activeHospital?.name || user.hospital_name}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={() => router.push('/account')}
          style={styles.accountButton}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="account-circle-outline" size={30} color={brand.primary.dark} />
        </Pressable>
      </View>

      {canSwitch ? (
        <Pressable onPress={() => router.push('/select-hospital')}>
          <AppCard style={styles.managingCard}>
            <View style={styles.managingIcon}>
              <MaterialCommunityIcons name="hospital-building" size={24} color={brand.primary.dark} />
            </View>
            <View style={styles.managingText}>
              <Text style={[type.caption, styles.managingLabel]}>
                {isSuperadmin ? 'กำลังจัดการโรงพยาบาล' : 'กำลังทำงานที่โรงพยาบาล'}
              </Text>
              <Text style={[type.subtitle1, styles.managingName]} numberOfLines={1}>
                {activeHospital?.name || 'ยังไม่ได้เลือก — แตะเพื่อเลือก'}
              </Text>
            </View>
            <MaterialCommunityIcons name="swap-horizontal" size={22} color={brand.primary.main} />
          </AppCard>
        </Pressable>
      ) : null}

      <View style={styles.list}>
        {visibleActions.map((action) => (
          <Pressable
            key={action.href}
            onPress={() => router.push(action.href)}
            style={({ pressed }) => [pressed && styles.listItemPressed]}
          >
            <AppCard style={styles.actionCard}>
              <View style={styles.actionIcon}>
                <MaterialCommunityIcons name={action.icon} size={30} color={brand.primary.dark} />
              </View>
              <Text style={[type.subtitle1, styles.actionLabel]} numberOfLines={1}>
                {action.label}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={26} color={brand.grey[400]} />
            </AppCard>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  greetingLabel: {
    color: brand.grey[500],
  },
  greetingName: {
    color: brand.grey[800],
  },
  hospitalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: sage.tint,
  },
  hospitalBadgeText: {
    color: sage.text,
  },
  managingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: alpha(brand.primary.main, 0.35),
    backgroundColor: alpha(brand.primary.main, 0.06),
  },
  managingIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
  },
  managingText: {
    flex: 1,
    gap: 2,
  },
  managingLabel: {
    color: brand.grey[500],
  },
  managingName: {
    color: brand.grey[800],
  },
  accountButton: {
    padding: 4,
  },
  list: {
    gap: 12,
  },
  listItemPressed: {
    opacity: 0.7,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 84,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(brand.primary.main, 0.12),
  },
  actionLabel: {
    flex: 1,
    color: brand.grey[800],
  },
});
