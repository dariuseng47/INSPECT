import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { decommissionFabricItem, fetchFabricItemByEpc, holdFabricItem } from '../../../src/api/fabric.api';
import { useAuth } from '../../../src/auth/AuthContext';
import { AppButton } from '../../../src/components/AppButton';
import { AppCard } from '../../../src/components/AppCard';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { StatusChip } from '../../../src/components/StatusChip';
import { STATUS_COLOR, STATUS_LABEL } from '../../../src/constants/fabric';
import { brand } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/theme';
import { type } from '../../../src/theme/typography';

export default function FabricDetailScreen() {
  const { epc } = useLocalSearchParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMode, setActionMode] = useState(null); // null | 'hold' | 'decommission'
  const [reasonCode, setReasonCode] = useState('');
  const [photo, setPhoto] = useState(null); // expo-image-picker asset | null
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const canManage = user?.role === 'ADMIN' || user?.role === 'OPERATOR';

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchFabricItemByEpc(epc);
      setDetail(data);
    } catch (err) {
      setError(err?.message || 'โหลดข้อมูลผ้าไม่สำเร็จ');
    }
  }, [epc]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const resetActionForm = () => {
    setActionMode(null);
    setReasonCode('');
    setPhoto(null);
    setActionError('');
  };

  const pickPhoto = async (source) => {
    setActionError('');
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setActionError(
        source === 'camera' ? 'กรุณาอนุญาตให้แอปใช้กล้อง' : 'กรุณาอนุญาตให้แอปเข้าถึงคลังรูปภาพ'
      );
      return;
    }

    const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    // expo-image-picker ~15.x (Expo SDK 51, ตัวที่รองรับ Android 6.0/API 23 สำหรับ Orca 50)
    // ยังไม่มี mediaTypes array API (มาทีหลังใน 16.0.0) ต้องใช้ MediaTypeOptions enum แบบเดิม
    const result = await launch({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const submitAction = async () => {
    if (!reasonCode.trim()) {
      setActionError('กรุณาระบุเหตุผล');
      return;
    }
    setSubmitting(true);
    setActionError('');
    try {
      if (actionMode === 'hold') {
        await holdFabricItem(detail.fabricItem.id, { reasonCode: reasonCode.trim(), photo });
      } else {
        const result = await decommissionFabricItem(detail.fabricItem.id, {
          reasonCode: reasonCode.trim(),
          photo,
        });
        // เว็บ dashboard ทำแทงชำรุดเองมีผลทันที แต่คำขอจากมือถือต้องรอ admin โรงพยาบาล approve
        // ก่อน — ดู server/src/controllers/fabricItems.controller.js#decommissionFabricItem
        if (result.status === 'PENDING_DECOMMISSION') {
          Alert.alert(
            'ส่งคำขอแทงชำรุดแล้ว',
            'รอ admin ของโรงพยาบาลตรวจสอบและอนุมัติที่หน้าเว็บก่อน ถึงจะมีผลจริง'
          );
        }
      }
      resetActionForm();
      await load();
    } catch (err) {
      setActionError(err?.message || 'ดำเนินการไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={brand.primary.main} size="large" />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <ScreenContainer>
        <Text style={[type.body1, styles.error]}>{error || 'ไม่พบข้อมูล'}</Text>
      </ScreenContainer>
    );
  }

  const { fabricItem, scanHistory } = detail;
  const isClosed = fabricItem.status === 'DECOMMISSIONED' || fabricItem.status === 'PENDING_DECOMMISSION';

  return (
    <ScreenContainer>
      <AppCard style={styles.summaryCard} elevated>
        <View style={styles.summaryHeader}>
          <Text style={[type.h3, styles.epc]} numberOfLines={1}>
            {fabricItem.epc_code}
          </Text>
          <StatusChip
            label={STATUS_LABEL[fabricItem.status] ?? fabricItem.status}
            color={STATUS_COLOR[fabricItem.status] || 'default'}
          />
        </View>
        <Text style={[type.body2, styles.meta]}>ซักแล้ว {fabricItem.wash_count} รอบ</Text>
        {fabricItem.created_by_name ? (
          <Text style={[type.caption, styles.meta]}>เพิ่มโดย: {fabricItem.created_by_name}</Text>
        ) : null}
        {fabricItem.photo_url ? (
          <Text style={[type.caption, styles.meta]}>มีรูปแนบ: {fabricItem.photo_url}</Text>
        ) : null}
        {fabricItem.status === 'PENDING_DECOMMISSION' ? (
          <Text style={[type.caption, styles.pendingNote]}>
            ส่งคำขอแทงชำรุดแล้ว รอ admin ของโรงพยาบาลตรวจสอบที่หน้าเว็บ
          </Text>
        ) : null}
      </AppCard>

      {canManage && !isClosed && actionMode === null ? (
        <View style={styles.actionRow}>
          <AppButton variant="soft" onPress={() => setActionMode('hold')} style={styles.actionButton}>
            พักผ้า
          </AppButton>
          <AppButton
            variant="outlined"
            onPress={() => setActionMode('decommission')}
            style={styles.actionButton}
          >
            แทงชำรุด
          </AppButton>
        </View>
      ) : null}

      {actionMode ? (
        <AppCard style={styles.formCard}>
          <Text style={[type.subtitle2, styles.meta]}>
            {actionMode === 'hold' ? 'เหตุผลที่พักผ้า' : 'เหตุผลที่แทงชำรุด'}
          </Text>
          <TextInput
            mode="outlined"
            value={reasonCode}
            onChangeText={setReasonCode}
            placeholder="เช่น ผ้าขาด, รอยเปื้อนล้างไม่ออก"
            outlineColor={brand.grey[300]}
            activeOutlineColor={brand.primary.main}
          />

          <Text style={[type.subtitle2, styles.meta]}>รูปภาพประกอบ (ถ้ามี)</Text>
          {photo ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
              <Pressable
                onPress={() => setPhoto(null)}
                style={styles.photoRemoveButton}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="close" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <AppButton
                variant="soft"
                icon="camera-outline"
                onPress={() => pickPhoto('camera')}
                style={styles.actionButton}
              >
                ถ่ายรูป
              </AppButton>
              <AppButton
                variant="outlined"
                icon="image-outline"
                onPress={() => pickPhoto('library')}
                style={styles.actionButton}
              >
                เลือกรูป
              </AppButton>
            </View>
          )}

          {actionError ? <Text style={[type.caption, styles.error]}>{actionError}</Text> : null}
          <View style={styles.actionRow}>
            <AppButton
              variant="filled"
              onPress={submitAction}
              loading={submitting}
              disabled={submitting}
              style={styles.actionButton}
            >
              ยืนยัน
            </AppButton>
            <AppButton
              variant="text"
              onPress={resetActionForm}
              disabled={submitting}
              style={styles.actionButton}
            >
              ยกเลิก
            </AppButton>
          </View>
        </AppCard>
      ) : null}

      <View style={styles.historySection}>
        <Text style={[type.subtitle1, styles.meta]}>ประวัติการสแกน</Text>
        {scanHistory.length === 0 ? (
          <Text style={[type.body2, styles.meta]}>ยังไม่มีประวัติการสแกน</Text>
        ) : (
          scanHistory.map((scan) => (
            <AppCard key={scan.id} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <Text style={[type.subtitle2, styles.epc]}>{scan.event_type}</Text>
                <Text style={[type.caption, styles.meta]}>
                  {new Date(scan.scanned_at).toLocaleString('th-TH')}
                </Text>
              </View>
            </AppCard>
          ))
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: brand.error.main,
  },
  summaryCard: {
    gap: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  epc: {
    color: brand.grey[800],
    flexShrink: 1,
  },
  meta: {
    color: brand.grey[500],
  },
  pendingNote: {
    color: brand.warning.dark,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  formCard: {
    gap: 10,
  },
  photoPreviewWrap: {
    alignSelf: 'flex-start',
  },
  photoPreview: {
    width: 96,
    height: 96,
    borderRadius: radius.sm,
    backgroundColor: brand.grey[100],
  },
  photoRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: brand.grey[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySection: {
    gap: 8,
  },
  historyCard: {
    padding: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
