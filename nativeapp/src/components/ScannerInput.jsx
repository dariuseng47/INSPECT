import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Modal, Portal, TextInput } from 'react-native-paper';

import { useScanReady } from '../context/ScanReadyContext';
import { brand, sage, surface } from '../theme/colors';
import { shadow } from '../theme/shadows';
import { radius } from '../theme/theme';
import { type } from '../theme/typography';
import { AppButton } from './AppButton';

// Stand-in for real RFID/camera scanning (out of scope this pass — see plan).
// Operator types or pastes an EPC for now; swap the trailing icon's onPress
// for a camera/BLE reader flow later without changing the call sites below.
//
// variant="field" (default) — the classic always-visible outlined text field, used where
// typing-as-you-go matters (e.g. inventory search). variant="button" — a compact button
// that opens a popup to type the code, for screens where a bare text box sitting on
// screen at all times reads as visual clutter (ward.jsx's restock/receive steps).
export function ScannerInput({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'กรอกรหัส EPC',
  variant = 'field',
  ...props
}) {
  // Publishes readiness to the app-wide ScanReadyContext instead of rendering its own
  // badge — app/(app)/_layout.jsx shows the actual "พร้อมสแกน" indicator floating over
  // the home tab, one shared spot regardless of which screen's field is currently armed.
  //
  // Bottom-tab screens stay mounted when you switch tabs (no unmount), so this must also
  // gate on focus — otherwise a ScannerInput left empty on a tab you navigated away from
  // keeps broadcasting "ready" forever since its cleanup never re-runs.
  const { setScanReady } = useScanReady();
  const isFocused = useIsFocused();
  const ready = isFocused && !props.disabled && !value;

  useEffect(() => {
    setScanReady(ready);
    return () => setScanReady(false);
  }, [ready, setScanReady]);

  if (variant === 'button') {
    return (
      <ScannerEntryButton
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        disabled={props.disabled}
      />
    );
  }

  return (
    <View style={styles.wrapper}>
      <TextInput
        mode="outlined"
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        outlineColor={brand.grey[300]}
        activeOutlineColor={brand.primary.main}
        style={styles.input}
        right={<TextInput.Icon icon="barcode-scan" onPress={onSubmit} color={brand.primary.dark} />}
        {...props}
      />
    </View>
  );
}

function ScannerEntryButton({ value, onChangeText, placeholder, disabled }) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState('');

  const openModal = () => {
    if (disabled) return;
    setDraft(value || '');
    setVisible(true);
  };

  const closeModal = () => setVisible(false);

  const confirm = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChangeText(trimmed);
    setVisible(false);
  };

  return (
    <>
      <View style={styles.entryRow}>
        <Pressable
          onPress={openModal}
          disabled={disabled}
          style={({ pressed }) => [
            styles.entryButton,
            !value && styles.entryButtonEmpty,
            !!value && styles.entryButtonFilled,
            disabled && styles.entryButtonDisabled,
            pressed && !disabled && styles.entryButtonPressed,
          ]}
        >
          {value ? (
            <>
              <MaterialCommunityIcons name="barcode-scan" size={16} color={brand.primary.dark} />
              <Text style={[type.body2, styles.entryValue]} numberOfLines={1}>
                {value}
              </Text>
              <Pressable onPress={() => onChangeText('')} hitSlop={10} disabled={disabled}>
                <MaterialCommunityIcons name="close-circle" size={16} color={brand.grey[400]} />
              </Pressable>
            </>
          ) : (
            <MaterialCommunityIcons
              name="keyboard-outline"
              size={18}
              color={disabled ? brand.grey[400] : brand.primary.dark}
            />
          )}
        </Pressable>
      </View>

      <Portal>
        <Modal visible={visible} onDismiss={closeModal} contentContainerStyle={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={[type.subtitle1, styles.modalTitle]}>กรอกรหัส EPC</Text>
            <TextInput
              mode="outlined"
              value={draft}
              onChangeText={setDraft}
              placeholder={placeholder}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={confirm}
              outlineColor={brand.grey[300]}
              activeOutlineColor={brand.primary.main}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <AppButton variant="text" onPress={closeModal} style={styles.modalActionButton}>
                ยกเลิก
              </AppButton>
              <AppButton
                variant="filled"
                onPress={confirm}
                disabled={!draft.trim()}
                style={styles.modalActionButton}
              >
                ยืนยัน
              </AppButton>
            </View>
          </View>
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  input: {
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
    fontSize: 17,
    height: 58,
  },
  // "ไม่ค่อยได้ใช้งาน" ตามที่ผู้ใช้บอก — ตั้งใจให้เล็กและหลบไปมุมขวา ไม่แย่งความสนใจจากปุ่มสแกน
  // RFID จริงที่เป็นทางหลัก ต่างจาก entryButtonFilled ที่ขยายตามเนื้อหาเพราะตอนนั้นมีค่าที่ต้อง
  // ให้ผู้ใช้เห็น/ตรวจทานจริงๆ ก่อนกดยืนยัน
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  entryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    minWidth: 36,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: brand.grey[100],
  },
  entryButtonEmpty: {
    paddingHorizontal: 0,
  },
  entryButtonFilled: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    borderColor: brand.primary.main,
    backgroundColor: sage.tint,
  },
  entryButtonDisabled: {
    opacity: 0.5,
  },
  entryButtonPressed: {
    backgroundColor: brand.grey[200],
  },
  entryValue: {
    flexShrink: 1,
    color: sage.text,
  },
  modalWrap: {
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: surface.card,
    borderRadius: radius.card,
    padding: 20,
    gap: 16,
    ...shadow.raised,
  },
  modalTitle: {
    color: brand.grey[800],
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    fontSize: 17,
    height: 58,
    borderRadius: radius.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionButton: {
    flex: 1,
  },
});
