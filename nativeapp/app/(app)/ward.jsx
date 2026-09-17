import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Menu, Modal, Portal, TextInput } from 'react-native-paper';

import { fetchCabinets } from '../../src/api/cabinets.api';
import { cabinetAuditScan, wardIssueScan, wardReceiveScan } from '../../src/api/operations.api';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { ScannedTagChip } from '../../src/components/ScannedTagChip';
import { ScannerInput } from '../../src/components/ScannerInput';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { StatusChip } from '../../src/components/StatusChip';
import { TriggerScanStatus } from '../../src/components/TriggerScanStatus';
import { STATUS_COLOR, STATUS_LABEL } from '../../src/constants/fabric';
import { useTriggerScan } from '../../src/rfid/useTriggerScan';
import { alpha, brand, sage, surface } from '../../src/theme/colors';
import { shadow } from '../../src/theme/shadows';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

const modes = [
  { key: 'issue', label: 'จ่ายผ้าไปวอร์ด' },
  { key: 'receive', label: 'รับผ้าคืน' },
];

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

// จ่ายผ้าไปวอร์ดแบ่งเป็น 2 ขั้นตามที่ผู้ใช้กำหนด: (1) สแกนหน้าตู้ตรวจนับของคงเหลือจริง เทียบกับ
// par level ที่ตั้งไว้ (POST /scans/cabinet-audit) — เจอผ้าที่ระบบไม่ได้บันทึกว่าอยู่ตู้นี้ก็เตือน + ปุ่ม
// โอนเข้าแผนกนี้ (2) หยิบผ้าจากรถมาจัดเข้าจริง สแกนทีละชิ้น (ward-issue เดิม) — ล็อกขั้น 2 ไว้จนกว่าจะ
// ตรวจนับตู้เสร็จก่อน สลับตู้ปลายทางใหม่ต้องตรวจนับใหม่เสมอ
export default function WardScreen() {
  const router = useRouter();
  const [mode, setMode] = useState('issue');
  const [cabinets, setCabinets] = useState([]);
  const [cabinetId, setCabinetId] = useState(null);
  const [cabinetMenuVisible, setCabinetMenuVisible] = useState(false);

  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [emptyAuditVisible, setEmptyAuditVisible] = useState(false);
  const [auditEpcCodes, setAuditEpcCodes] = useState([]);
  const [auditBulkEpc, setAuditBulkEpc] = useState('');
  const [auditSubmitting, setAuditSubmitting] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditResult, setAuditResult] = useState(null);
  const [transferringEpc, setTransferringEpc] = useState(null);

  const [epc, setEpc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message }
  const [recent, setRecent] = useState([]);

  // ขั้นที่ 2 (หยิบผ้าจากรถเข้าตู้) รอสแกนผ่าน handheld เหมือนขั้นตรวจนับ — สะสมรายการไว้ก่อน
  // แล้วค่อยยิง ward-issue ทีละชิ้นตอนกดยืนยัน (endpoint รับทีละ epc) ดู handleIssueConfirm
  const [issueEpcCodes, setIssueEpcCodes] = useState([]);
  const [issueBulkEpc, setIssueBulkEpc] = useState('');
  const [issueManualVisible, setIssueManualVisible] = useState(false);

  useEffect(() => {
    fetchCabinets()
      .then((data) => setCabinets(data.cabinets || []))
      .catch(() => {});
  }, []);

  const reset = () => {
    setEpc('');
    setFeedback(null);
    setIssueEpcCodes([]);
    setIssueBulkEpc('');
  };

  const resetAudit = () => {
    setAuditEpcCodes([]);
    setAuditBulkEpc('');
    setAuditError('');
    setAuditResult(null);
    setEmptyAuditVisible(false);
  };

  const handleSelectCabinet = (id) => {
    setCabinetId(id);
    setCabinetMenuVisible(false);
    resetAudit();
    reset();
  };

  const addAuditEpcIfNew = (code) => {
    setAuditEpcCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
  };

  const addAuditBulkEpcs = () => {
    const codes = parseEpcCodes(auditBulkEpc);
    if (codes.length === 0) return;
    setAuditEpcCodes((prev) => [...new Set([...prev, ...codes])]);
    setAuditBulkEpc('');
  };

  const removeAuditEpc = (code) => {
    setAuditEpcCodes((prev) => prev.filter((c) => c !== code));
  };

  // ตรวจนับจริง — codes อาจเป็น [] ได้ (เคสตู้เปล่า เติมผ้าครั้งแรก) ยืนยันผ่าน modal ก่อนแล้วค่อยเข้ามา
  const submitAudit = async (codes) => {
    setAuditSubmitting(true);
    setAuditError('');
    try {
      const result = await cabinetAuditScan({ cabinetId, epcCodes: codes });
      setAuditResult(result);
      setAuditEpcCodes([]);
    } catch (err) {
      setAuditError(err?.message || 'ตรวจนับไม่สำเร็จ');
    } finally {
      setAuditSubmitting(false);
    }
  };

  const handleAuditSubmit = async () => {
    if (!cabinetId) {
      setAuditError('กรุณาเลือกตู้ปลายทางก่อน');
      return;
    }
    // ไม่มีรายการเลย = ยืนยันว่าตู้เปล่า (เติมผ้าครั้งแรก / ไม่มีผ้าเดิมคงเหลือ) — ถามยืนยันกันกดพลาด
    if (auditEpcCodes.length === 0) {
      setAuditError('');
      setEmptyAuditVisible(true);
      return;
    }

    await submitAudit(auditEpcCodes);
  };

  const handleConfirmEmptyAudit = async () => {
    setEmptyAuditVisible(false);
    await submitAudit([]);
  };

  const handleTransferAnomaly = async (item) => {
    setTransferringEpc(item.epcCode);
    try {
      await wardIssueScan({ epcCode: item.epcCode, cabinetId, roundId: auditResult?.roundId });
      setAuditResult((prev) =>
        prev ? { ...prev, anomalies: prev.anomalies.filter((a) => a.epcCode !== item.epcCode) } : prev
      );
    } catch (err) {
      setAuditError(err?.message || 'โอนผ้าเข้าแผนกนี้ไม่สำเร็จ');
    } finally {
      setTransferringEpc(null);
    }
  };

  // โหมด "รับผ้าคืน" — ทีละชิ้น (ไม่ผูกตู้ปลายทาง) รับ code จากการสแกนตรงๆ ได้ ไม่งั้นใช้ค่าในช่องพิมพ์
  const submitReceive = async (codeArg) => {
    const code = (typeof codeArg === 'string' ? codeArg : epc).trim();
    if (!code) {
      setFeedback({ type: 'error', message: 'กรุณากรอกรหัส EPC' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await wardReceiveScan({ epcCode: code });
      setFeedback({ type: 'success', message: `${result.epcCode} → ${result.status}` });
      setRecent((prev) => [{ ...result, mode: 'receive', at: Date.now() }, ...prev].slice(0, 10));
      setEpc('');
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'ดำเนินการไม่สำเร็จ' });
    } finally {
      setSubmitting(false);
    }
  };

  const addIssueEpcIfNew = (code) => {
    setIssueEpcCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
  };

  const addIssueBulkEpcs = () => {
    const codes = parseEpcCodes(issueBulkEpc);
    if (codes.length === 0) return;
    setIssueEpcCodes((prev) => [...new Set([...prev, ...codes])]);
    setIssueBulkEpc('');
  };

  const removeIssueEpc = (code) => {
    setIssueEpcCodes((prev) => prev.filter((c) => c !== code));
  };

  // ยิง ward-issue ทีละชิ้น (endpoint รับทีละ epc) — เก็บที่ล้มเหลวไว้ในลิสต์ให้ลองใหม่ได้
  const handleIssueConfirm = async () => {
    if (!cabinetId) {
      setFeedback({ type: 'error', message: 'กรุณาเลือกตู้ปลายทาง' });
      return;
    }
    const codes = issueEpcCodes;
    if (codes.length === 0) {
      setFeedback({ type: 'error', message: 'ยังไม่มีรายการผ้าที่จะจ่าย — สแกนหรือกรอกรหัสก่อน' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    const succeeded = [];
    const failed = [];
    for (const code of codes) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await wardIssueScan({ epcCode: code, cabinetId, roundId: auditResult?.roundId });
        succeeded.push(result);
        setRecent((prev) => [{ ...result, mode: 'issue', at: Date.now() }, ...prev].slice(0, 10));
      } catch (err) {
        failed.push({ code, message: err?.message || 'จ่ายไม่สำเร็จ' });
      }
    }
    setSubmitting(false);
    setIssueEpcCodes(failed.map((f) => f.code));
    setFeedback(
      failed.length === 0
        ? { type: 'success', message: `จ่ายผ้าเข้าตู้สำเร็จ ${succeeded.length} ชิ้น` }
        : {
            type: 'error',
            message: `สำเร็จ ${succeeded.length} ชิ้น · ไม่สำเร็จ ${failed.length} ชิ้น (${failed[0].message})`,
          }
    );
  };

  // เหนี่ยวปุ่มไกที่ตัวเครื่อง → route ตามโหมด/ขั้นตอนปัจจุบัน (onEpc อ่านผ่าน ref ค่าจึงสดเสมอ)
  //  - รับผ้าคืน: ยิง ward-receive ทันทีทีละชิ้น
  //  - จ่ายผ้า ขั้น 1 (ยังไม่ตรวจนับ): เก็บเข้า auditEpcCodes
  //  - จ่ายผ้า ขั้น 2 (ตรวจนับแล้ว): เก็บเข้า issueEpcCodes
  const handleScannedEpc = (code) => {
    if (mode === 'receive') {
      submitReceive(code);
    } else if (!cabinetId) {
      // ยังไม่เลือกตู้ปลายทาง — ยังไม่รับผลสแกน
    } else if (!auditResult) {
      addAuditEpcIfNew(code);
    } else {
      addIssueEpcIfNew(code);
    }
  };

  const { hasRfidDevice, rfidStatus, rfidErrorMessage, triggerActive } = useTriggerScan({
    onEpc: handleScannedEpc,
  });

  const restockLocked = mode === 'issue' && !auditResult;

  const feedbackBlock = feedback ? (
    <View
      style={[
        styles.feedback,
        { backgroundColor: feedback.type === 'success' ? sage.tint : alpha(brand.error.main, 0.12) },
      ]}
    >
      <MaterialCommunityIcons
        name={feedback.type === 'success' ? 'check-circle-outline' : 'alert-circle-outline'}
        size={18}
        color={feedback.type === 'success' ? sage.text : brand.error.dark}
      />
      <Text
        style={[
          type.body2,
          styles.feedbackText,
          { color: feedback.type === 'success' ? sage.text : brand.error.dark },
        ]}
      >
        {feedback.message}
      </Text>
    </View>
  ) : null;

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.push('/ward-history')} style={styles.historyLink} hitSlop={8}>
        <MaterialCommunityIcons name="history" size={18} color={brand.primary.dark} />
        <Text style={[type.body2, styles.historyLinkText]}>ประวัติการจ่ายผ้า</Text>
      </Pressable>

      <View style={styles.segment}>
        {modes.map((item) => {
          const active = mode === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                setMode(item.key);
                reset();
              }}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <Text
                style={[type.subtitle2, styles.segmentLabel, active && styles.segmentLabelActive]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'issue' ? (
        <>
          <AppCard style={styles.cabinetCard}>
            <Text style={[type.subtitle2, styles.sectionLabel]}>เลือกตู้ปลายทาง</Text>
            {cabinets.length === 0 ? (
              <Text style={[type.body2, styles.sectionLabel]}>ไม่พบตู้เก็บผ้าในระบบ</Text>
            ) : (
              <Menu
                visible={cabinetMenuVisible}
                onDismiss={() => setCabinetMenuVisible(false)}
                anchor={
                  <Pressable
                    onPress={() => setCabinetMenuVisible(true)}
                    style={styles.dropdown}
                  >
                    <Text
                      style={[
                        type.body1,
                        styles.dropdownText,
                        !cabinetId && styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {cabinets.find((c) => c.id === cabinetId)?.name || 'เลือกตู้ปลายทาง'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={22} color={brand.grey[500]} />
                  </Pressable>
                }
                anchorPosition="bottom"
                contentStyle={styles.dropdownMenu}
              >
                {cabinets.map((cabinet) => (
                  <Menu.Item
                    key={cabinet.id}
                    onPress={() => handleSelectCabinet(cabinet.id)}
                    title={cabinet.name}
                    titleStyle={type.body1}
                  />
                ))}
              </Menu>
            )}
          </AppCard>

          {cabinetId ? (
            <AppCard style={styles.auditCard}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepBadge}>
                  <Text style={[type.subtitle2, styles.stepBadgeText]}>1</Text>
                </View>
                <Text style={[type.subtitle1, styles.stepTitle]}>ตรวจนับตู้ผ้า</Text>
                <Pressable
                  onPress={() => setManualEntryVisible(true)}
                  style={styles.cornerEntryButton}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="keyboard-outline" size={18} color={brand.primary.dark} />
                </Pressable>
              </View>
              <Text style={[type.body2, styles.stepHint]}>
                สแกนผ้าทุกชิ้นที่เจอในตู้นี้ตอนนี้ ก่อนหยิบผ้าจากรถมาจัดเข้า — ถ้าตู้เปล่าไม่มีผ้าเดิม
                (เติมครั้งแรก) กดยืนยันตรวจนับได้เลยโดยไม่ต้องสแกน
              </Text>

              {hasRfidDevice ? (
                <TriggerScanStatus
                  status={rfidStatus}
                  errorMessage={rfidErrorMessage}
                  triggerActive={triggerActive}
                  idleLabel="เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อสแกนผ้าในตู้"
                />
              ) : null}

              <Text style={[type.subtitle2, styles.sectionLabel]}>
                รายการที่สแกนแล้ว ({auditEpcCodes.length})
              </Text>
              {auditEpcCodes.length === 0 ? (
                <Text style={[type.body2, styles.sectionLabel]}>ยังไม่มีรายการ</Text>
              ) : (
                <View style={styles.chipRow}>
                  {auditEpcCodes.map((code) => (
                    <ScannedTagChip key={code} epc={code} onRemove={removeAuditEpc} />
                  ))}
                </View>
              )}

              {auditError ? <Text style={[type.body2, styles.error]}>{auditError}</Text> : null}

              <AppButton
                variant="filled"
                onPress={handleAuditSubmit}
                loading={auditSubmitting}
                disabled={auditSubmitting}
              >
                {auditEpcCodes.length === 0 ? 'ยืนยันตรวจนับ (ตู้เปล่า)' : 'ยืนยันตรวจนับ'}
              </AppButton>

              <Portal>
                <Modal
                  visible={manualEntryVisible}
                  onDismiss={() => setManualEntryVisible(false)}
                  contentContainerStyle={styles.modalWrap}
                >
                  <View style={styles.modalCard}>
                    <Text style={[type.subtitle1, styles.modalTitle]}>วางรหัส EPC หลายรายการ</Text>
                    <TextInput
                      mode="outlined"
                      value={auditBulkEpc}
                      onChangeText={setAuditBulkEpc}
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
                        onPress={() => setManualEntryVisible(false)}
                        style={styles.modalActionButton}
                      >
                        ยกเลิก
                      </AppButton>
                      <AppButton
                        variant="filled"
                        onPress={() => {
                          addAuditBulkEpcs();
                          setManualEntryVisible(false);
                        }}
                        disabled={!auditBulkEpc.trim()}
                        style={styles.modalActionButton}
                      >
                        เพิ่ม
                      </AppButton>
                    </View>
                  </View>
                </Modal>

                <Modal
                  visible={emptyAuditVisible}
                  onDismiss={() => setEmptyAuditVisible(false)}
                  contentContainerStyle={styles.modalWrap}
                >
                  <View style={styles.modalCard}>
                    <Text style={[type.subtitle1, styles.modalTitle]}>ยืนยันว่าตู้เปล่า?</Text>
                    <Text style={[type.body2, styles.stepHint]}>
                      ยังไม่ได้สแกนผ้าเลย ระบบจะบันทึกว่าตู้นี้ไม่มีผ้าคงเหลือ (เติมผ้าครั้งแรก)
                      แล้วเปิดขั้นจ่ายผ้าเข้าตู้ให้ต่อ
                    </Text>
                    <View style={styles.modalActions}>
                      <AppButton
                        variant="text"
                        onPress={() => setEmptyAuditVisible(false)}
                        style={styles.modalActionButton}
                      >
                        กลับไปสแกน
                      </AppButton>
                      <AppButton
                        variant="filled"
                        onPress={handleConfirmEmptyAudit}
                        style={styles.modalActionButton}
                      >
                        ยืนยันตู้เปล่า
                      </AppButton>
                    </View>
                  </View>
                </Modal>
              </Portal>
            </AppCard>
          ) : null}

          {auditResult ? (
            <AppCard style={styles.resultCard}>
              <Text style={[type.subtitle1, styles.stepTitle]}>ผลตรวจนับ</Text>

              {auditResult.unknownEpcs?.length > 0 ? (
                <Text style={[type.body2, styles.error]}>
                  ไม่พบในระบบ: {auditResult.unknownEpcs.join(', ')}
                </Text>
              ) : null}

              {auditResult.reconciliation.length > 0 ? (
                <View style={styles.reconList}>
                  {auditResult.reconciliation.map((row) => (
                    <View key={row.fabricCategoryId} style={styles.reconRow}>
                      <Text style={[type.body1, styles.reconCategory]} numberOfLines={1}>
                        {row.categoryName}
                      </Text>
                      <Text style={[type.subtitle1, styles.reconQty, row.lowStock && styles.reconQtyLow]}>
                        {row.actualQty}/{row.parLevelQty}
                      </Text>
                      {row.lowStock ? (
                        <View style={styles.lowStockBadge}>
                          <MaterialCommunityIcons name="alert-outline" size={13} color={brand.warning.dark} />
                          <Text style={[type.caption, styles.lowStockText]}>ขาด {row.shortageQty}</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[type.body2, styles.sectionLabel]}>ยังไม่ได้ตั้งค่า par level ให้ตู้นี้</Text>
              )}

              {auditResult.anomalies?.length > 0 ? (
                <View style={styles.anomalySection}>
                  <View style={styles.anomalyHeaderRow}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={brand.error.dark} />
                    <Text style={[type.subtitle2, styles.anomalyHeaderText]}>
                      พบผ้าที่ไม่ได้บันทึกว่าอยู่ตู้นี้ ({auditResult.anomalies.length})
                    </Text>
                  </View>
                  {auditResult.anomalies.map((item) => (
                    <View key={item.epcCode} style={styles.anomalyRow}>
                      <View style={styles.anomalyInfo}>
                        <Text style={[type.body2, styles.anomalyEpc]} numberOfLines={1}>
                          {item.epcCode}
                        </Text>
                        <View style={styles.anomalyMetaRow}>
                          <StatusChip
                            label={STATUS_LABEL[item.status] ?? item.status}
                            color={STATUS_COLOR[item.status] || 'default'}
                          />
                          {item.categoryName ? (
                            <Text style={[type.caption, styles.anomalyMeta]} numberOfLines={1}>
                              {item.categoryName}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <AppButton
                        variant="soft"
                        onPress={() => handleTransferAnomaly(item)}
                        loading={transferringEpc === item.epcCode}
                        disabled={transferringEpc === item.epcCode}
                        contentStyle={styles.transferButtonContent}
                        labelStyle={styles.transferButtonLabel}
                        style={styles.transferButton}
                      >
                        โอนผ้าเข้าแผนกนี้
                      </AppButton>
                    </View>
                  ))}
                </View>
              ) : null}
            </AppCard>
          ) : null}
        </>
      ) : null}

      {mode === 'issue' && cabinetId ? (
        <AppCard style={[styles.scanCard, restockLocked && styles.scanCardLocked]}>
          <View style={styles.stepHeaderRow}>
            <View style={[styles.stepBadge, restockLocked && styles.stepBadgeLocked]}>
              <Text style={[type.subtitle2, styles.stepBadgeText]}>2</Text>
            </View>
            <Text style={[type.subtitle1, styles.stepTitle]}>หยิบผ้าจากรถมาจัดเข้าตู้</Text>
            <Pressable
              onPress={() => setIssueManualVisible(true)}
              style={styles.cornerEntryButton}
              hitSlop={8}
              disabled={restockLocked}
            >
              <MaterialCommunityIcons name="keyboard-outline" size={18} color={brand.primary.dark} />
            </Pressable>
          </View>

          {restockLocked ? (
            <Text style={[type.body2, styles.stepHint]}>ตรวจนับตู้ผ้าให้เสร็จก่อน (ขั้นที่ 1)</Text>
          ) : (
            <>
              <Text style={[type.body2, styles.stepHint]}>
                สแกนผ้าที่หยิบจากรถใส่เข้าตู้นี้ด้วยเครื่องอ่าน แล้วกดยืนยันจ่ายผ้า
              </Text>

              {hasRfidDevice ? (
                <TriggerScanStatus
                  status={rfidStatus}
                  errorMessage={rfidErrorMessage}
                  triggerActive={triggerActive}
                  idleLabel="เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อสแกนผ้าเข้าตู้"
                />
              ) : null}

              <Text style={[type.subtitle2, styles.sectionLabel]}>
                รายการที่จะจ่ายเข้าตู้ ({issueEpcCodes.length})
              </Text>
              {issueEpcCodes.length === 0 ? (
                <Text style={[type.body2, styles.sectionLabel]}>ยังไม่มีรายการ</Text>
              ) : (
                <View style={styles.chipRow}>
                  {issueEpcCodes.map((code) => (
                    <ScannedTagChip key={code} epc={code} onRemove={removeIssueEpc} />
                  ))}
                </View>
              )}

              {feedbackBlock}

              <AppButton
                variant="filled"
                onPress={handleIssueConfirm}
                loading={submitting}
                disabled={submitting || issueEpcCodes.length === 0}
              >
                ยืนยันจ่ายผ้า
              </AppButton>
            </>
          )}

          <Portal>
            <Modal
              visible={issueManualVisible}
              onDismiss={() => setIssueManualVisible(false)}
              contentContainerStyle={styles.modalWrap}
            >
              <View style={styles.modalCard}>
                <Text style={[type.subtitle1, styles.modalTitle]}>วางรหัส EPC หลายรายการ</Text>
                <TextInput
                  mode="outlined"
                  value={issueBulkEpc}
                  onChangeText={setIssueBulkEpc}
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
                    onPress={() => setIssueManualVisible(false)}
                    style={styles.modalActionButton}
                  >
                    ยกเลิก
                  </AppButton>
                  <AppButton
                    variant="filled"
                    onPress={() => {
                      addIssueBulkEpcs();
                      setIssueManualVisible(false);
                    }}
                    disabled={!issueBulkEpc.trim()}
                    style={styles.modalActionButton}
                  >
                    เพิ่ม
                  </AppButton>
                </View>
              </View>
            </Modal>
          </Portal>
        </AppCard>
      ) : null}

      {mode === 'receive' ? (
        <AppCard style={styles.scanCard}>
          <View style={styles.stepHeaderRow}>
            <Text style={[type.subtitle2, styles.sectionLabel, styles.stepTitle]}>รหัส EPC</Text>
            <ScannerInput
              value={epc}
              onChangeText={setEpc}
              onSubmit={submitReceive}
              variant="button"
            />
          </View>

          {hasRfidDevice ? (
            <TriggerScanStatus
              status={rfidStatus}
              errorMessage={rfidErrorMessage}
              triggerActive={triggerActive}
              busy={submitting}
              busyLabel="กำลังบันทึกรับคืน..."
              idleLabel="เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อรับผ้าคืน"
            />
          ) : null}

          {feedbackBlock}

          <AppButton
            variant="filled"
            onPress={() => submitReceive()}
            loading={submitting}
            disabled={submitting}
          >
            ยืนยันรับผ้าคืน
          </AppButton>
        </AppCard>
      ) : null}

      {recent.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={[type.subtitle2, styles.sectionLabel]}>รายการล่าสุด</Text>
          {recent.map((entry) => (
            <AppCard key={`${entry.epcCode}-${entry.at}`} style={styles.historyCard}>
              <Text style={[type.body2, styles.historyEpc]}>{entry.epcCode}</Text>
              <Text style={[type.caption, styles.sectionLabel]}>
                {entry.mode === 'issue' ? 'จ่ายไปวอร์ด' : 'รับคืน'} → {entry.status}
              </Text>
            </AppCard>
          ))}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingVertical: 4,
  },
  historyLinkText: {
    color: brand.primary.dark,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: brand.grey[100],
    borderRadius: radius.sm,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentLabel: {
    color: brand.grey[500],
  },
  segmentLabelActive: {
    color: brand.primary.dark,
  },
  cabinetCard: {
    gap: 10,
  },
  sectionLabel: {
    color: brand.grey[600],
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 58,
    paddingHorizontal: 16,
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
  dropdownMenu: {
    marginTop: 4,
  },
  auditCard: {
    gap: 12,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.primary.main,
  },
  stepBadgeLocked: {
    backgroundColor: brand.grey[400],
  },
  stepBadgeText: {
    color: '#FFFFFF',
  },
  stepTitle: {
    color: brand.grey[800],
    flex: 1,
  },
  stepHint: {
    color: brand.grey[500],
  },
  // "ไม่ค่อยได้ใช้งาน" ตามที่ผู้ใช้บอก — ทั้งช่องรหัส EPC เดี่ยว (ScannerInput variant="button")
  // และตัวกระตุ้นกรอกเองของขั้นตรวจนับตู้ผ้านี้ ใช้ปุ่มเล็กหลบมุมแบบเดียวกันตั้งใจให้คู่กัน
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  error: {
    color: brand.error.main,
  },
  resultCard: {
    gap: 12,
  },
  reconList: {
    gap: 8,
  },
  reconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: brand.grey[100],
  },
  reconCategory: {
    flex: 1,
    color: brand.grey[800],
  },
  reconQty: {
    color: brand.grey[700],
  },
  reconQtyLow: {
    color: brand.warning.dark,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: alpha(brand.warning.main, 0.16),
  },
  lowStockText: {
    color: brand.warning.dark,
  },
  anomalySection: {
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: brand.grey[200],
  },
  anomalyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  anomalyHeaderText: {
    color: brand.error.dark,
    flex: 1,
  },
  anomalyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: alpha(brand.error.main, 0.06),
  },
  anomalyInfo: {
    flex: 1,
    gap: 4,
  },
  anomalyEpc: {
    color: brand.grey[800],
  },
  anomalyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  anomalyMeta: {
    color: brand.grey[500],
    flexShrink: 1,
  },
  transferButton: {
    alignSelf: 'center',
  },
  transferButtonContent: {
    minHeight: 40,
    paddingHorizontal: 4,
  },
  transferButtonLabel: {
    fontSize: 13,
  },
  scanCard: {
    gap: 12,
  },
  scanCardLocked: {
    opacity: 0.5,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
  },
  feedbackText: {
    flex: 1,
  },
  historySection: {
    gap: 8,
  },
  historyCard: {
    padding: 12,
    gap: 2,
  },
  historyEpc: {
    color: brand.grey[800],
  },
});
