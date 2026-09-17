import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useHospitalWorkspace } from '../../src/hospital/HospitalWorkspaceContext';
import { brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

export default function SelectHospitalScreen() {
  const router = useRouter();
  const { hospitals, hospitalId, loading, selectHospital } = useHospitalWorkspace();

  const handleSelect = async (id) => {
    if (id !== hospitalId) {
      await selectHospital(id);
    }
    router.back();
  };

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
        <MaterialCommunityIcons name="chevron-left" size={22} color={brand.grey[700]} />
        <Text style={[type.body2, styles.backLabel]}>กลับ</Text>
      </Pressable>

      <Text style={[type.h3, styles.title]}>เลือกโรงพยาบาล</Text>
      <Text style={[type.body2, styles.subtitle]}>
        เลือกโรงพยาบาลที่ต้องการจัดการ — ข้อมูลผ้า วอร์ด และการสแกนทั้งหมดในแอปจะเป็นของโรงพยาบาลนี้
        และระบบจะจำค่าที่เลือกไว้ให้ในการเปิดแอปครั้งถัดไป
      </Text>

      {loading ? (
        <ActivityIndicator color={brand.primary.main} style={styles.loading} />
      ) : hospitals.length === 0 ? (
        <EmptyState
          icon="hospital-building"
          title="ไม่พบโรงพยาบาล"
          description="ยังไม่มีโรงพยาบาลในระบบ หรือโหลดรายชื่อไม่สำเร็จ"
        />
      ) : (
        hospitals.map((hospital) => {
          const active = hospital.id === hospitalId;
          return (
            <Pressable key={hospital.id} onPress={() => handleSelect(hospital.id)}>
              <AppCard style={[styles.card, active && styles.cardActive]}>
                <View style={styles.icon}>
                  <MaterialCommunityIcons name="hospital-building" size={22} color={brand.primary.dark} />
                </View>
                <View style={styles.cardText}>
                  <Text style={[type.subtitle1, styles.cardLabel]} numberOfLines={1}>
                    {hospital.name}
                  </Text>
                  {hospital.organization_name ? (
                    <Text style={[type.caption, styles.cardMeta]} numberOfLines={1}>
                      {hospital.organization_name}
                    </Text>
                  ) : null}
                </View>
                {active ? (
                  <MaterialCommunityIcons name="check-circle" size={22} color={brand.primary.main} />
                ) : (
                  <MaterialCommunityIcons
                    name="checkbox-blank-circle-outline"
                    size={22}
                    color={brand.grey[300]}
                  />
                )}
              </AppCard>
            </Pressable>
          );
        })
      )}
    </ScreenContainer>
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
  title: {
    color: brand.grey[800],
    marginTop: 4,
  },
  subtitle: {
    color: brand.grey[500],
    marginBottom: 4,
  },
  loading: {
    marginTop: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardActive: {
    borderWidth: 1,
    borderColor: brand.primary.main,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    color: brand.grey[800],
  },
  cardMeta: {
    color: brand.grey[500],
  },
});
