import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { createScan } from '../../src/api/scans.api';
import { resolveUploadUrl } from '../../src/api/client';
import { fetchPhoneModels } from '../../src/api/phoneModels.api';
import { addExtraImages, rejectQueueItem, resolveQueueItem } from '../../src/api/unidentifiedQueue.api';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { PermissionGate } from '../../src/components/PermissionGate';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { brand, sage, surface } from '../../src/theme/colors';
import { type } from '../../src/theme/typography';

const STATUS_LABEL = {
  auto_matched: 'จับคู่อัตโนมัติ',
  user_confirmed: 'ยืนยันแล้ว',
  unidentified: 'ไม่รู้จัก',
  pending_review: 'ไม่แน่ใจ',
  rejected: 'ปฏิเสธแล้ว',
};
const STATUS_COLOR = {
  auto_matched: brand.success.main,
  user_confirmed: brand.success.main,
  unidentified: brand.error.main,
  pending_review: brand.warning.dark,
  rejected: brand.grey[500],
};

function aggregateSummary(batches) {
  const byCapacity = new Map();
  let totalDevices = 0;
  let uncertainCount = 0;
  batches.forEach(({ summary }) => {
    totalDevices += summary.totalDevices;
    uncertainCount += summary.uncertainCount;
    summary.byCapacity.forEach((row) => {
      byCapacity.set(row.capacityGb, (byCapacity.get(row.capacityGb) ?? 0) + row.count);
    });
  });
  return {
    totalDevices,
    uncertainCount,
    byCapacity: [...byCapacity.entries()]
      .map(([capacityGb, count]) => ({ capacityGb, count }))
      .sort((a, b) => a.capacityGb - b.capacityGb),
  };
}

// เครื่องที่ "ไม่แน่ใจ/ไม่รู้จัก" — เลือกรุ่นที่ถูกต้องได้ทันที (candidate หรือรุ่นอื่นที่มีอยู่), หรือถ่าย
// เพิ่มมุมอื่นส่งเข้าคิวให้แอดมินตั้งรุ่นใหม่ทีหลัง (ตาม spec — สร้างรุ่นใหม่ทำได้แค่ฝั่งแอดมินเท่านั้น)
function ResolveModal({ item, onClose, onResolved }) {
  const [allModels, setAllModels] = useState(null);
  const [showAllModels, setShowAllModels] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadAllModels = async () => {
    setShowAllModels(true);
    if (allModels) return;
    try {
      setAllModels(await fetchPhoneModels());
    } catch {
      setAllModels([]);
    }
  };

  const handlePickModel = async (modelId, model) => {
    setBusy(true);
    try {
      await resolveQueueItem(item.queue_id, { resolvedModelId: modelId });
      onResolved(item.id, {
        status: 'user_confirmed',
        matchedModelId: modelId,
        brand: model?.brand,
        modelName: model?.model_name,
      });
    } catch (error) {
      Alert.alert('บันทึกไม่สำเร็จ', error?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setBusy(false);
    }
  };

  const handleTakeMorePhotos = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('ต้องอนุญาตกล้อง', 'กรุณาอนุญาตให้แอปใช้กล้องในตั้งค่าเครื่อง');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled) return;

    setBusy(true);
    try {
      await addExtraImages(item.queue_id, result.assets);
      Alert.alert('ส่งภาพเพิ่มแล้ว', 'แอดมินจะตรวจสอบและตั้งชื่อรุ่นให้ภายหลัง');
      onResolved(item.id, { status: 'pending_review', extraPhotoAdded: true });
    } catch (error) {
      Alert.alert('อัพโหลดไม่สำเร็จ', error?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await rejectQueueItem(item.queue_id);
      onResolved(item.id, { status: 'rejected' });
    } catch (error) {
      Alert.alert('ดำเนินการไม่สำเร็จ', error?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <Image source={{ uri: resolveUploadUrl(item.crop_image_path) }} style={styles.modalImage} />

          <Text style={[type.subtitle1, styles.modalTitle]}>เครื่องนี้คือรุ่นอะไร?</Text>

          {item.candidate_model_ids?.length > 0 && (
            <>
              <Text style={[type.caption, styles.sectionLabel]}>รุ่นที่ใกล้เคียง</Text>
              {item.candidate_model_ids.map((c) => (
                <Pressable
                  key={c.modelId}
                  style={styles.optionRow}
                  onPress={() => handlePickModel(c.modelId, c.model)}
                  disabled={busy}
                >
                  <Text style={type.body1}>{c.model ? `${c.model.brand} ${c.model.model_name}` : `รุ่น #${c.modelId}`}</Text>
                  <Text style={[type.caption, styles.meta]}>ใกล้เคียง {Math.round(c.score * 100)}%</Text>
                </Pressable>
              ))}
            </>
          )}

          {!showAllModels ? (
            <Pressable onPress={loadAllModels} style={styles.linkRow} disabled={busy}>
              <Text style={[type.body2, styles.linkText]}>เลือกจากรุ่นอื่น...</Text>
            </Pressable>
          ) : (
            <>
              <Text style={[type.caption, styles.sectionLabel]}>รุ่นทั้งหมด</Text>
              {allModels === null ? (
                <ActivityIndicator style={{ marginVertical: 12 }} />
              ) : (
                <FlatList
                  data={allModels}
                  keyExtractor={(m) => String(m.id)}
                  style={styles.modelList}
                  renderItem={({ item: m }) => (
                    <Pressable style={styles.optionRow} onPress={() => handlePickModel(m.id, m)} disabled={busy}>
                      <Text style={type.body2}>
                        {m.brand} {m.model_name}
                      </Text>
                    </Pressable>
                  )}
                />
              )}
            </>
          )}

          <View style={styles.modalActions}>
            <AppButton variant="outlined" onPress={handleTakeMorePhotos} loading={busy} style={styles.modalButton}>
              ไม่ใช่รุ่นเหล่านี้ — ถ่ายเพิ่ม
            </AppButton>
            <AppButton variant="text" onPress={handleReject} loading={busy} style={styles.modalButton}>
              ไม่ใช่โทรศัพท์ / ปฏิเสธ
            </AppButton>
            <AppButton variant="text" onPress={onClose} disabled={busy} style={styles.modalButton}>
              ปิด
            </AppButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function PhoneScanScreen() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [batches, setBatches] = useState([]);
  const [resolvingItem, setResolvingItem] = useState(null);

  const runScans = async (assets) => {
    setUploading(true);
    setBatches([]);
    setProgress({ done: 0, total: assets.length });

    const results = [];
    for (const asset of assets) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const data = await createScan(asset);
        results.push(data);
      } catch (error) {
        Alert.alert('ตรวจสอบไม่สำเร็จ', error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
      setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }
    setBatches(results);
    setUploading(false);
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('ต้องอนุญาตกล้อง', 'กรุณาอนุญาตให้แอปใช้กล้องในตั้งค่าเครื่อง');
      return;
    }
    const pickerResult = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!pickerResult.canceled) runScans(pickerResult.assets);
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('ต้องอนุญาตคลังภาพ', 'กรุณาอนุญาตให้แอปเข้าถึงคลังภาพในตั้งค่าเครื่อง');
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      allowsMultipleSelection: true,
    });
    if (!pickerResult.canceled) runScans(pickerResult.assets);
  };

  // อัพเดตสถานะไอเทมใน state ทันทีหลังยืนยัน/ปฏิเสธ/ถ่ายเพิ่ม โดยไม่ต้อง refetch ทั้งรอบสแกนใหม่
  const applyLocalResolution = (itemId, { status, matchedModelId, brand: modelBrand, modelName }) => {
    setBatches((prev) =>
      prev.map((batch) => ({
        ...batch,
        items: batch.items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                status,
                matched_model_id: matchedModelId ?? it.matched_model_id,
                brand: modelBrand ?? it.brand,
                model_name: modelName ?? it.model_name,
              }
            : it
        ),
      }))
    );
    setResolvingItem(null);
  };

  const allItems = batches.flatMap((b) => b.items);
  const summary = batches.length ? aggregateSummary(batches) : null;

  return (
    <PermissionGate perm="handheld.phone.scan.view">
      <ScreenContainer>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={brand.grey[700]} />
          <Text style={[type.body2, styles.backLabel]}>กลับ</Text>
        </Pressable>

        <Text style={[type.h3, styles.heading]}>ตรวจสอบรุ่นโทรศัพท์</Text>
        <Text style={[type.body2, styles.subheading]}>
          ถ่ายภาพโทรศัพท์วางเรียงบนโต๊ะ/ถาดในที่แสงสว่างปกติ ถ่ายหรือเลือกได้หลายภาพพร้อมกันถ้ามีหลายถาด
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
            <Text style={[type.body2, styles.loadingText]}>
              กำลังวิเคราะห์ภาพที่ {progress.done + 1} จาก {progress.total}...
            </Text>
          </AppCard>
        )}

        {!uploading && !batches.length && (
          <AppCard style={styles.centerCard}>
            <EmptyState icon="camera-outline" title="ยังไม่มีผลการตรวจสอบ" description="ถ่ายภาพหรือเลือกภาพเพื่อเริ่มสแกน" />
          </AppCard>
        )}

        {!uploading && batches.length > 0 && (
          <>
            <AppCard style={styles.imageCard}>
              <Image
                source={{ uri: resolveUploadUrl(batches[0].batch.annotated_image_path) }}
                style={styles.resultImage}
                resizeMode="contain"
              />
              {batches.length > 1 && (
                <Text style={[type.caption, styles.meta, { marginTop: 8 }]}>
                  + อีก {batches.length - 1} ภาพ (ดูรายละเอียดเครื่องด้านล่าง)
                </Text>
              )}
            </AppCard>

            <AppCard>
              <Text style={[type.subtitle1, styles.summaryTitle]}>พบทั้งหมด {summary.totalDevices} เครื่อง</Text>
              <View style={styles.chipsRow}>
                {summary.byCapacity.map((row) => (
                  <View key={row.capacityGb} style={styles.chip}>
                    <Text style={[type.caption, styles.chipText]}>
                      {row.capacityGb} GB × {row.count}
                    </Text>
                  </View>
                ))}
              </View>
            </AppCard>

            {allItems.map((item) => (
              <AppCard key={item.id} style={styles.itemRow}>
                <Image source={{ uri: resolveUploadUrl(item.crop_image_path) }} style={styles.itemThumb} />
                <View style={styles.itemInfo}>
                  <Text style={[type.body1, styles.itemTitle]}>
                    {item.brand ? `${item.brand} ${item.model_name}` : 'ไม่รู้จักรุ่น'}
                  </Text>
                  <Text style={[type.caption, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
                </View>
                {(item.status === 'unidentified' || item.status === 'pending_review') && item.queue_id && (
                  <AppButton variant="soft" onPress={() => setResolvingItem(item)} style={styles.resolveButton}>
                    ยืนยันรุ่น
                  </AppButton>
                )}
              </AppCard>
            ))}
          </>
        )}
      </ScreenContainer>

      {resolvingItem && (
        <ResolveModal item={resolvingItem} onClose={() => setResolvingItem(null)} onResolved={applyLocalResolution} />
      )}
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
  itemRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  itemThumb: { width: 56, height: 56, borderRadius: 8 },
  itemInfo: { flex: 1, gap: 2 },
  itemTitle: { color: brand.grey[800] },
  meta: { color: brand.grey[500] },
  resolveButton: { minWidth: 110 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: surface.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    gap: 8,
  },
  modalImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 8 },
  modalTitle: { color: brand.grey[800], marginBottom: 4 },
  sectionLabel: { color: brand.grey[500], marginTop: 8, marginBottom: 2 },
  optionRow: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: brand.grey[300],
  },
  linkRow: { paddingVertical: 8 },
  linkText: { color: brand.primary.dark, fontWeight: '600' },
  modelList: { maxHeight: 180 },
  modalActions: { marginTop: 12, gap: 8 },
  modalButton: { width: '100%' },
});
