import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Menu, Modal, Portal, TextInput } from 'react-native-paper';

import { statusChangeScan } from '../../src/api/operations.api';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { PermissionGate } from '../../src/components/PermissionGate';
import { StatusChip } from '../../src/components/StatusChip';
import { TriggerScanStatus } from '../../src/components/TriggerScanStatus';
import { STATUS_COLOR, STATUS_LABEL } from '../../src/constants/fabric';
import { useTriggerScan } from '../../src/rfid/useTriggerScan';
import { alpha, brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

// สถานะที่เลือกเป็น "ก่อน/หลัง" ได้ (ตรงกับ statusChangeSchema ฝั่ง server) — lifecycle 4 สถานะ
// ไม่รวม HOLD/แทงชำรุด ที่มี flow อนุมัติแยกต่างหาก
const STATUS_OPTIONS = ['WASH', 'CENTRAL_STOCK', 'WARD_CABINET', 'IN_USE_WARD'];

const PRESETS = [
  { from: 'IN_USE_WARD', to: 'WASH', label: 'วอร์ดใช้งาน → รับผ้าหลังซัก' },
  { from: 'WASH', to: 'WARD_CABINET', label: 'รับผ้าหลังซัก → เข้าตู้แผนก' },
];

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

function StatusPicker({ label, value, onChange, exclude }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.pickerCol}>
      <Text style={[type.caption, styles.pickerLabel]}>{label}</Text>
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchorPosition="bottom"
        anchor={
          <Pressable onPress={() => setVisible(true)} style={styles.dropdown}>
            <Text
              style={[type.body1, styles.dropdownText, !value && styles.dropdownPlaceholder]}
              numberOfLines={1}
            >
              {value ? STATUS_LABEL[value] ?? value : 'เลือกสถานะ'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={brand.grey[500]} />
          </Pressable>
        }
      >
        {STATUS_OPTIONS.filter((s) => s !== exclude).map((s) => (
          <Menu.Item
            key={s}
            onPress={() => {
              onChange(s);
              setVisible(false);
            }}
            title={STATUS_LABEL[s] ?? s}
            titleStyle={type.body1}
          />
        ))}
      </Menu>
    </View>
  );
}

export default function StatusChangeScreen() {
  const router = useRouter();
  const [fromStatus, setFromStatus] = useState(null);
  const [toStatus, setToStatus] = useState(null);
  const [epcCodes, setEpcCodes] = useState([]);
  const [bulkEpc, setBulkEpc] = useState('');
  const [manualVisible, setManualVisible] = useState(false);
  const [preview, setPreview] = useState(null); // ผลตรวจสอบก่อนเปลี่ยน
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]);

  const ready = !!fromStatus && !!toStatus && fromStatus !== toStatus;

  const addEpcIfNew = (code) => {
    setPreview(null);
    setEpcCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
  };

  const addBulkEpcs = () => {
    const codes = parseEpcCodes(bulkEpc);
    if (codes.length === 0) return;
    setPreview(null);
    setEpcCodes((prev) => [...new Set([...prev, ...codes])]);
    setBulkEpc('');
  };

  const removeEpc = (code) => {
    setPreview(null);
    setEpcCodes((prev) => prev.filter((c) => c !== code));
  };

  const { hasRfidDevice, rfidStatus, rfidErrorMessage, triggerActive } = useTriggerScan({
    enabled: ready,
    onEpc: addEpcIfNew,
  });

  const applyPreset = (p) => {
    setFromStatus(p.from);
    setToStatus(p.to);
    setPreview(null);
  };

  const handleCheck = async () => {
    if (!ready) {
      setError('เลือกสถานะก่อนและหลัง (ต้องไม่เหมือนกัน)');
      return;
    }
    if (epcCodes.length === 0) {
      setError('สแกนหรือกรอกรหัส EPC อย่างน้อย 1 รายการ');
      return;
    }
    setError('');
    setChecking(true);
    try {
      const result = await statusChangeScan({ fromStatus, toStatus, epcCodes, confirm: false });
      setPreview(result);
    } catch (err) {
      setError(err?.message || 'ตรวจสอบไม่สำเร็จ');
    } finally {
      setChecking(false);
    }
  };

  const changeableCount = preview
    ? (preview.ready?.length ?? 0) + (preview.mismatched?.length ?? 0)
    : 0;

  const handleApply = async () => {
    setError('');
    setApplying(true);
    try {
      const result = await statusChangeScan({ fromStatus, toStatus, epcCodes, confirm: true });
      setRecent((prev) =>
        [
          {
            at: Date.now(),
            fromStatus,
            toStatus,
            applied: result.applied?.length ?? 0,
            mismatched: (result.applied ?? []).filter((a) => a.mismatched).length,
          },
          ...prev,
        ].slice(0, 10)
      );
      setEpcCodes([]);
      setPreview(null);
    } catch (err) {
      setError(err?.message || 'เปลี่ยนสถานะไม่สำเร็จ');
    } finally {
      setApplying(false);
    }
  };

  return (
    <PermissionGate perm="handheld.status_change.view">
    <ScreenContainer>
      <Pressable onPress={() => router.back()} style={styles.backLink} hitSlop={8}>
        <MaterialCommunityIcons name="chevron-left" size={20} color={brand.grey[700]} />
        <Text style={[type.body2, styles.backText]}>กลับ</Text>
      </Pressable>

      <Text style={[type.h3, styles.title]}>เปลี่ยนสถานะผ้า</Text>
      <Text style={[type.body2, styles.subtitle]}>
        สแกนผ้าเป็นชุด เลือกสถานะก่อน/หลังเอง แล้วเปลี่ยนรวดเดียว — มี log ทุกชิ้น
      </Text>

      <AppCard style={styles.card}>
        <Text style={[type.subtitle2, styles.sectionLabel]}>ทางลัด</Text>
        <View style={styles.chipRow}>
          {PRESETS.map((p) => {
            const active = fromStatus === p.from && toStatus === p.to;
            return (
              <Pressable
                key={p.label}
                onPress={() => applyPreset(p)}
                style={[styles.presetChip, active && styles.presetChipActive]}
              >
                <Text style={[type.caption, styles.presetChipText, active && styles.presetChipTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.pickerRow}>
          <StatusPicker
            label="จากสถานะ"
            value={fromStatus}
            onChange={(s) => {
              setFromStatus(s);
              setPreview(null);
            }}
            exclude={toStatus}
          />
          <MaterialCommunityIcons
            name="arrow-right"
            size={20}
            color={brand.grey[400]}
            style={styles.arrow}
          />
          <StatusPicker
            label="เป็นสถานะ"
            value={toStatus}
            onChange={(s) => {
              setToStatus(s);
              setPreview(null);
            }}
            exclude={fromStatus}
          />
        </View>
      </AppCard>

      {ready ? (
        <AppCard style={styles.card}>
          <View style={styles.stepHeaderRow}>
            <Text style={[type.subtitle2, styles.sectionLabel]}>สแกนผ้า ({epcCodes.length})</Text>
            <Pressable
              onPress={() => setManualVisible(true)}
              style={styles.cornerEntryButton}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="keyboard-outline" size={18} color={brand.primary.dark} />
            </Pressable>
          </View>

          {hasRfidDevice ? (
            <TriggerScanStatus
              status={rfidStatus}
              errorMessage={rfidErrorMessage}
              triggerActive={triggerActive}
              idleLabel="เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อสแกนผ้า"
            />
          ) : null}

          {epcCodes.length === 0 ? (
            <Text style={[type.body2, styles.sectionLabel]}>ยังไม่มีรายการ</Text>
          ) : (
            <View style={styles.chipRow}>
              {epcCodes.map((code) => (
                <View key={code} style={styles.epcChip}>
                  <Text style={[type.caption, styles.epcChipLabel]}>{code}</Text>
                  <Pressable onPress={() => removeEpc(code)} hitSlop={6}>
                    <MaterialCommunityIcons name="close" size={14} color={sage.text} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {!preview ? (
            <AppButton
              variant="filled"
              onPress={handleCheck}
              loading={checking}
              disabled={checking || epcCodes.length === 0}
            >
              ตรวจสอบก่อนเปลี่ยน
            </AppButton>
          ) : null}
        </AppCard>
      ) : null}

      {preview ? (
        <AppCard style={styles.card}>
          <Text style={[type.subtitle1, styles.sectionLabel]}>ผลตรวจสอบ</Text>

          <View style={styles.summaryRow}>
            <MaterialCommunityIcons name="check-circle-outline" size={18} color={sage.text} />
            <Text style={[type.body2, styles.summaryText]}>
              พร้อมเปลี่ยน (สถานะตรง) {preview.ready?.length ?? 0} ชิ้น
            </Text>
          </View>

          {preview.mismatched?.length > 0 ? (
            <View style={styles.warnBox}>
              <Text style={[type.subtitle2, styles.warnHeader]}>
                ⚠️ สถานะไม่ตรง {preview.mismatched.length} ชิ้น — จะเปลี่ยนให้ถ้ากดยืนยัน
              </Text>
              {preview.mismatched.map((m) => (
                <View key={m.epcCode} style={styles.mismatchRow}>
                  <Text style={[type.caption, styles.mismatchEpc]} numberOfLines={1}>
                    {m.epcCode}
                  </Text>
                  <StatusChip
                    label={STATUS_LABEL[m.currentStatus] ?? m.currentStatus}
                    color={STATUS_COLOR[m.currentStatus] || 'default'}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {preview.blocked?.length > 0 ? (
            <Text style={[type.body2, styles.mutedError]}>
              ⛔ เปลี่ยนไม่ได้ (พัก/แทงชำรุด) {preview.blocked.length} ชิ้น:{' '}
              {preview.blocked.map((b) => b.epcCode).join(', ')}
            </Text>
          ) : null}

          {preview.alreadyDone?.length > 0 ? (
            <Text style={[type.body2, styles.sectionLabel]}>
              ℹ️ เป็นสถานะปลายทางอยู่แล้ว {preview.alreadyDone.length} ชิ้น (ข้าม)
            </Text>
          ) : null}

          {preview.notFound?.length > 0 ? (
            <Text style={[type.body2, styles.mutedError]}>
              ❓ ไม่พบในระบบ {preview.notFound.length} ชิ้น: {preview.notFound.join(', ')}
            </Text>
          ) : null}

          <AppButton
            variant="filled"
            onPress={handleApply}
            loading={applying}
            disabled={applying || changeableCount === 0}
          >
            ยืนยันเปลี่ยนสถานะ ({changeableCount} ชิ้น)
          </AppButton>
          <AppButton variant="text" onPress={() => setPreview(null)} disabled={applying}>
            แก้ไขรายการ
          </AppButton>
        </AppCard>
      ) : null}

      {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

      {recent.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={[type.subtitle2, styles.sectionLabel]}>รายการล่าสุด</Text>
          {recent.map((r) => (
            <AppCard key={r.at} style={styles.historyCard}>
              <Text style={[type.body2, styles.historyText]}>
                {STATUS_LABEL[r.fromStatus] ?? r.fromStatus} → {STATUS_LABEL[r.toStatus] ?? r.toStatus}
              </Text>
              <Text style={[type.caption, styles.sectionLabel]}>
                เปลี่ยน {r.applied} ชิ้น{r.mismatched ? ` (สถานะไม่ตรง ${r.mismatched} ชิ้น)` : ''}
              </Text>
            </AppCard>
          ))}
        </View>
      ) : null}

      <Portal>
        <Modal
          visible={manualVisible}
          onDismiss={() => setManualVisible(false)}
          contentContainerStyle={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <Text style={[type.subtitle1, styles.modalTitle]}>วางรหัส EPC หลายรายการ</Text>
            <TextInput
              mode="outlined"
              value={bulkEpc}
              onChangeText={setBulkEpc}
              placeholder={'เช่น\nEPC-0001\nEPC-0002'}
              multiline
              numberOfLines={5}
              autoFocus
              autoCapitalize="characters"
              outlineColor={brand.grey[300]}
              activeOutlineColor={brand.primary.main}
              style={styles.modalBulkInput}
            />
            <View style={styles.modalActions}>
              <AppButton
                variant="text"
                onPress={() => setManualVisible(false)}
                style={styles.modalActionButton}
              >
                ยกเลิก
              </AppButton>
              <AppButton
                variant="filled"
                onPress={() => {
                  addBulkEpcs();
                  setManualVisible(false);
                }}
                disabled={!bulkEpc.trim()}
                style={styles.modalActionButton}
              >
                เพิ่ม
              </AppButton>
            </View>
          </View>
        </Modal>
      </Portal>
    </ScreenContainer>
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  backText: {
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
  card: {
    gap: 12,
  },
  sectionLabel: {
    color: brand.grey[600],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.grey[300],
  },
  presetChipActive: {
    backgroundColor: sage.tint,
    borderColor: brand.primary.main,
  },
  presetChipText: {
    color: brand.grey[700],
  },
  presetChipTextActive: {
    color: sage.text,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  pickerCol: {
    flex: 1,
    gap: 4,
  },
  pickerLabel: {
    color: brand.grey[500],
  },
  arrow: {
    marginBottom: 16,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: '#FFFFFF',
  },
  dropdownText: {
    flex: 1,
    color: brand.grey[800],
  },
  dropdownPlaceholder: {
    color: brand.grey[400],
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cornerEntryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: brand.grey[100],
  },
  epcChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: alpha(brand.primary.main, 0.12),
  },
  epcChipLabel: {
    color: sage.text,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryText: {
    color: brand.grey[700],
  },
  warnBox: {
    gap: 8,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: alpha(brand.warning.main, 0.12),
  },
  warnHeader: {
    color: brand.warning.dark,
  },
  mismatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mismatchEpc: {
    flex: 1,
    color: brand.grey[800],
  },
  mutedError: {
    color: brand.error.dark,
  },
  error: {
    color: brand.error.main,
  },
  historySection: {
    gap: 8,
  },
  historyCard: {
    padding: 12,
    gap: 2,
  },
  historyText: {
    color: brand.grey[800],
  },
  modalWrap: {
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    color: brand.grey[800],
  },
  modalBulkInput: {
    backgroundColor: '#FFFFFF',
    minHeight: 110,
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
