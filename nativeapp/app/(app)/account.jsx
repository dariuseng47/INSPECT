import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthContext';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { brand, sage } from '../../src/theme/colors';
import { type } from '../../src/theme/typography';

const roleLabel = {
  SUPERADMIN: 'ผู้ดูแลระบบสูงสุด',
  ADMIN: 'ผู้ดูแลโรงพยาบาล',
  OPERATOR: 'เจ้าหน้าที่ปฏิบัติการ',
};

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut, can } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
        <MaterialCommunityIcons name="chevron-left" size={22} color={brand.grey[700]} />
        <Text style={[type.body2, styles.backLabel]}>กลับ</Text>
      </Pressable>

      <AppCard style={styles.profileCard} elevated>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account" size={36} color={brand.primary.dark} />
        </View>
        <Text style={[type.h3, styles.name]}>{user?.full_name || user?.username}</Text>
        <Text style={[type.body2, styles.meta]}>@{user?.username}</Text>
        {user?.role ? (
          <View style={styles.roleBadge}>
            <Text style={[type.caption, styles.roleBadgeText]}>
              {roleLabel[user.role] || user.role}
            </Text>
          </View>
        ) : null}
      </AppCard>

      <AppCard style={styles.infoCard}>
        <InfoRow icon="phone-outline" label="เบอร์โทร" value={user?.phone || '—'} />
      </AppCard>

      {can('handheld.phone.scan.view') && (
        <Pressable onPress={() => router.push('/phone-scan')}>
          <AppCard style={styles.navCard}>
            <View style={styles.navIcon}>
              <MaterialCommunityIcons name="cellphone-check" size={24} color={brand.primary.dark} />
            </View>
            <View style={styles.navText}>
              <Text style={[type.body1, styles.name]}>ตรวจสอบรุ่นโทรศัพท์</Text>
              <Text style={[type.caption, styles.meta]}>ถ่ายภาพเพื่อตรวจสอบรุ่นและความจุ</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={brand.grey[400]} />
          </AppCard>
        </Pressable>
      )}

      <AppButton
        variant="outlined"
        onPress={handleSignOut}
        loading={signingOut}
        disabled={signingOut}
        style={styles.signOutButton}
      >
        ออกจากระบบ
      </AppButton>
    </ScreenContainer>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={20} color={brand.grey[500]} />
      <View style={styles.infoText}>
        <Text style={[type.caption, styles.meta]}>{label}</Text>
        <Text style={[type.body1, styles.name]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  backLabel: {
    color: brand.grey[700],
  },
  profileCard: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
    marginBottom: 4,
  },
  name: {
    color: brand.grey[800],
  },
  meta: {
    color: brand.grey[500],
  },
  roleBadge: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: sage.tint,
  },
  roleBadgeText: {
    color: sage.text,
  },
  infoCard: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    gap: 2,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
  },
  navText: {
    flex: 1,
    gap: 2,
  },
  signOutButton: {
    marginTop: 8,
  },
});
