import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { brand, sage } from '../theme/colors';
import { radius } from '../theme/theme';
import { type } from '../theme/typography';
import { StatusChip } from './StatusChip';

const RFID_STATUS_LABEL = {
  connecting: 'กำลังเชื่อมต่อเครื่องอ่าน...',
  connected: 'เครื่องอ่านพร้อมใช้งาน',
  error: 'เชื่อมต่อเครื่องอ่านไม่สำเร็จ',
};

// แถบสถานะเครื่องอ่าน + ตัวบอกว่า "กำลังกดปุ่มสแกน" ใช้ร่วมกับ useTriggerScan ทุกหน้าให้เหมือนกัน
export function TriggerScanStatus({
  status,
  errorMessage,
  triggerActive,
  busy = false,
  busyLabel = 'กำลังทำรายการ...',
  idleLabel = 'เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อสแกน',
  activeLabel = 'กำลังกดปุ่มสแกน...',
}) {
  return (
    <>
      <StatusChip
        label={
          status === 'error'
            ? errorMessage || RFID_STATUS_LABEL.error
            : RFID_STATUS_LABEL[status] || RFID_STATUS_LABEL.connecting
        }
        color={status === 'connected' ? 'success' : status === 'error' ? 'error' : 'info'}
      />

      {status === 'connected' ? (
        <View style={[styles.row, triggerActive && styles.rowActive]}>
          {triggerActive || busy ? (
            <ActivityIndicator size="small" color={brand.primary.dark} />
          ) : (
            <MaterialCommunityIcons name="gesture-tap-button" size={22} color={brand.grey[500]} />
          )}
          <Text style={[type.body2, styles.text, triggerActive && styles.textActive]}>
            {busy ? busyLabel : triggerActive ? activeLabel : idleLabel}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.grey[200],
    backgroundColor: brand.grey[100],
  },
  rowActive: {
    borderColor: brand.primary.main,
    backgroundColor: sage.tint,
  },
  text: {
    flex: 1,
    color: brand.grey[600],
  },
  textActive: {
    color: sage.text,
    fontWeight: '700',
  },
});
