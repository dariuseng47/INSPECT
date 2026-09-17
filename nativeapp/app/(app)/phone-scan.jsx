import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { createScan } from '../../src/api/scans.api';
import { resolveUploadUrl } from '../../src/api/client';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { PermissionGate } from '../../src/components/PermissionGate';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { brand, sage } from '../../src/theme/colors';
import { type } from '../../src/theme/typography';

const STATUS_LABEL = {
  auto_matched: 'จับคู่อัตโนมัติ',
  user_confirmed: 'ยืนยันแล้ว',
  unidentified: 'ไม่รู้จัก',
  pending_review: 'ไม่แน่ใจ',
};
const STATUS_COLOR = {
  auto_matched: brand.success.main,
  user_confirmed: brand.success.main,
  unidentified: brand.error.main,
  pending_review: brand.warning.dark,
};

export default function PhoneScanScreen() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const runScan = async (asset) => {
    setUploading(true);
    setResult(null);
    try {
      const data = await createScan(asset);
      setResult(data);
    } catch (error) {
      Alert.alert('ตรวจสอบไม่สำเร็จ', error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setUploading(false);
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('ต้องอนุญาตกล้อง', 'กรุณาอนุญาตให้แอปใช้กล้องในตั้งค่าเครื่อง');
      return;
    }
    const pickerResult = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!pickerResult.canceled) runScan(pickerResult.assets[0]);
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('ต้องอนุญาตคลังภาพ', 'กรุณาอนุญาตให้แอปเข้าถึงคลังภาพในตั้งค่าเครื่อง');
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
    if (!pickerResult.canceled) runScan(pickerResult.assets[0]);
  };

  return (
    <PermissionGate perm="handheld.phone.scan.view">
      <ScreenContainer>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={brand.grey[700]} />
          <Text style={[type.body2, styles.backLabel]}>กลับ</Text>
        </Pressable>

        <Text style={[type.h3, styles.heading]}>ตรวจสอบรุ่นโทรศัพท์</Text>
        <Text style={[type.body2, styles.subheading]}>
          ถ่ายภาพโทรศัพท์วางเรียงบนโต๊ะ/ถาดในที่แสงสว่างปกติ ระบบจะตรวจจับแต่ละเครื่องและจับคู่รุ่นให้อัตโนมัติ
        </Text>

        <View style={styles.actionsRow}>
          <AppButton style={styles.actionButton} onPress={pickFromCamera} disabled={uploading}>
            ถ่ายภาพ
          </AppButton>
          <AppButton
            variant="outlined"
            style={styles.actionButton}
            onPress={pickFromLibrary}
            disabled={uploading}
          >
            เลือกจากคลังภาพ
          </AppButton>
        </View>

        {uploading && (
          <AppCard style={styles.centerCard}>
            <ActivityIndicator size="large" color={brand.primary.main} />
            <Text style={[type.body2, styles.loadingText]}>กำลังวิเคราะห์ภาพ...</Text>
          </AppCard>
        )}

        {!uploading && !result && (
          <AppCard style={styles.centerCard}>
            <EmptyState icon="camera-outline" title="ยังไม่มีผลการตรวจสอบ" description="ถ่ายภาพหรือเลือกภาพเพื่อเริ่มสแกน" />
          </AppCard>
        )}

        {!uploading && result && (
          <>
            <AppCard style={styles.imageCard}>
              <Image
                source={{ uri: resolveUploadUrl(result.batch.annotated_image_path) }}
                style={styles.resultImage}
                resizeMode="contain"
              />
            </AppCard>

            <AppCard>
              <Text style={[type.subtitle1, styles.summaryTitle]}>
                พบทั้งหมด {result.summary.totalDevices} เครื่อง
              </Text>
              <View style={styles.chipsRow}>
                {result.summary.byCapacity.map((row) => (
                  <View key={row.capacityGb} style={styles.chip}>
                    <Text style={[type.caption, styles.chipText]}>
                      {row.capacityGb} GB × {row.count}
                    </Text>
                  </View>
                ))}
              </View>
              {result.summary.uncertainCount > 0 && (
                <View style={[styles.chip, styles.warningChip]}>
                  <Text style={[type.caption, styles.warningChipText]}>
                    ไม่แน่ใจ {result.summary.uncertainCount} เครื่อง — แจ้งแอดมินตรวจสอบที่คิว
                  </Text>
                </View>
              )}
            </AppCard>

            {result.items.map((item) => (
              <AppCard key={item.id} style={styles.itemRow}>
                <Image source={{ uri: resolveUploadUrl(item.crop_image_path) }} style={styles.itemThumb} />
                <View style={styles.itemInfo}>
                  <Text style={[type.body1, styles.itemTitle]}>
                    {item.brand ? `${item.brand} ${item.model_name}` : 'ไม่รู้จักรุ่น'}
                  </Text>
                  <Text style={[type.caption, styles.meta]}>
                    {item.min_capacity_gb ? `${item.min_capacity_gb} GB · ` : ''}
                    {item.confidence_score != null ? `มั่นใจ ${Math.round(item.confidence_score * 100)}%` : ''}
                  </Text>
                  <Text style={[type.caption, { color: STATUS_COLOR[item.status] }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
              </AppCard>
            ))}
          </>
        )}
      </ScreenContainer>
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backLabel: { color: brand.grey[700] },
  heading: { color: brand.grey[800] },
  subheading: { color: brand.grey[500] },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1 },
  centerCard: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  loadingText: { color: brand.grey[500] },
  imageCard: { padding: 8 },
  resultImage: { width: '100%', height: 260, borderRadius: 12 },
  summaryTitle: { marginBottom: 10, color: brand.grey[800] },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: sage.tint,
  },
  chipText: { color: sage.text, fontWeight: '600' },
  warningChip: { backgroundColor: brand.warning.lighter, marginTop: 10, alignSelf: 'flex-start' },
  warningChipText: { color: brand.warning.dark, fontWeight: '600' },
  itemRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  itemThumb: { width: 56, height: 56, borderRadius: 8 },
  itemInfo: { flex: 1, gap: 2 },
  itemTitle: { color: brand.grey[800] },
  meta: { color: brand.grey[500] },
});
