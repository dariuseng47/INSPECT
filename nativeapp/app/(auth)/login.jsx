import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';

import { useAuth } from '../../src/auth/AuthContext';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { alpha, brand, sage, surface } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

const PIN_LENGTH = 6;
const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'backspace'],
];

// v9 — PIN login เป็นทางเลือกที่สอง (ตามที่ผู้ใช้ยืนยัน "มีทั้งสองแบบ ให้เลือก" ไม่ใช่แทนที่
// username/password) เริ่มต้นที่โหมด PIN เพราะเป็นทางที่เร็วกว่าสำหรับ handheld หน้างานจริง แต่
// สลับไปกรอก username/password แบบเดิมได้เสมอผ่าน segment ด้านบน — คงดีไซน์ card เดิมไว้ทั้งหมด
export default function LoginScreen() {
  const { signIn, signInWithPin } = useAuth();
  const [mode, setMode] = useState('pin'); // 'pin' | 'password'

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [focusedField, setFocusedField] = useState(null); // null | 'username' | 'password'

  const [pin, setPin] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setPin('');
  };

  const handlePasswordSubmit = async () => {
    if (!username || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await signIn({ username: username.trim(), password });
    } catch (err) {
      setError(err?.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้/รหัสผ่าน');
    } finally {
      setSubmitting(false);
    }
  };

  const submitPin = async (fullPin) => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithPin(fullPin);
    } catch (err) {
      setError(err?.message || 'PIN ไม่ถูกต้อง');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (key) => {
    if (submitting) return;
    if (key === '' ) return;
    if (key === 'backspace') {
      setError('');
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      submitPin(next);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AppCard style={styles.card}>
              <Image
                source={require('../../assets/logo/welgroup-logo.jpg')}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={[type.h2, styles.title]}>เข้าสู่ระบบ</Text>
              <Text style={[type.body2, styles.subtitle]}>
                {mode === 'pin' ? 'กรอก PIN 6 หลักเพื่อเข้าสู่ระบบ' : 'เข้าสู่ระบบเพื่อเริ่มใช้งาน'}
              </Text>

              <View style={styles.segment}>
                {[
                  { key: 'pin', label: 'เข้าด้วย PIN' },
                  { key: 'password', label: 'เข้าด้วย Username' },
                ].map((item) => {
                  const active = mode === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => switchMode(item.key)}
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

              {mode === 'pin' ? (
                <View style={styles.pinSection}>
                  <View style={styles.pinDotsRow}>
                    {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                      <View
                        key={index}
                        style={[styles.pinDot, index < pin.length && styles.pinDotFilled]}
                      />
                    ))}
                  </View>

                  <View style={styles.keypad}>
                    {KEYPAD_ROWS.map((row, rowIndex) => (
                      <View key={rowIndex} style={styles.keypadRow}>
                        {row.map((key, keyIndex) => {
                          if (key === '') {
                            return <View key={keyIndex} style={styles.keypadKeySpacer} />;
                          }
                          return (
                            <Pressable
                              key={keyIndex}
                              onPress={() => handleKeyPress(key)}
                              disabled={submitting}
                              style={({ pressed }) => [
                                styles.keypadKey,
                                key === 'backspace' && styles.keypadKeyGhost,
                                pressed && styles.keypadKeyPressed,
                              ]}
                            >
                              <Text style={[type.h3, styles.keypadKeyLabel]}>
                                {key === 'backspace' ? '⌫' : key}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.fields}>
                  <View style={[styles.inputWrap, focusedField === 'username' && styles.inputWrapFocused]}>
                    <TextInput
                      mode="flat"
                      label="ชื่อผู้ใช้"
                      value={username}
                      onChangeText={setUsername}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      underlineColor="transparent"
                      activeUnderlineColor="transparent"
                      style={styles.input}
                      theme={{ colors: { background: 'transparent' } }}
                      left={
                        <TextInput.Icon
                          icon="account-outline"
                          color={focusedField === 'username' ? brand.primary.dark : brand.grey[500]}
                        />
                      }
                    />
                  </View>

                  <View style={[styles.inputWrap, focusedField === 'password' && styles.inputWrapFocused]}>
                    <TextInput
                      mode="flat"
                      label="รหัสผ่าน"
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={secure}
                      autoCapitalize="none"
                      autoCorrect={false}
                      underlineColor="transparent"
                      activeUnderlineColor="transparent"
                      style={styles.input}
                      theme={{ colors: { background: 'transparent' } }}
                      left={
                        <TextInput.Icon
                          icon="lock-outline"
                          color={focusedField === 'password' ? brand.primary.dark : brand.grey[500]}
                        />
                      }
                      right={
                        <TextInput.Icon
                          icon={secure ? 'eye-outline' : 'eye-off-outline'}
                          onPress={() => setSecure((prev) => !prev)}
                          color={brand.grey[500]}
                        />
                      }
                    />
                  </View>
                </View>
              )}

              {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

              {mode === 'password' ? (
                <AppButton
                  variant="filled"
                  onPress={handlePasswordSubmit}
                  loading={submitting}
                  disabled={submitting}
                  style={styles.submit}
                >
                  เข้าสู่ระบบ
                </AppButton>
              ) : null}
            </AppCard>

            <Text style={[type.caption, styles.footer]}>
              Multi-Tenant IoT RFID Laundry Management System
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: surface.background,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: alpha(brand.primary.main, 0.06),
  },
  blobTop: {
    width: 260,
    height: 260,
    top: -110,
    right: -90,
  },
  blobBottom: {
    width: 220,
    height: 220,
    bottom: -80,
    left: -70,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    gap: 4,
    // AppCard shows a soft shadow by default (used everywhere else in the app) — this
    // screen wants a completely flat, borderless, shadowless card, so cancel it out here
    // rather than changing the shared component (that would flatten every card in the app).
    shadowOpacity: 0,
    elevation: 0,
  },
  logo: {
    width: 220,
    height: 58,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    color: brand.grey[800],
    textAlign: 'center',
  },
  subtitle: {
    color: brand.grey[500],
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 18,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: brand.grey[100],
    borderRadius: radius.sm,
    padding: 4,
    gap: 4,
    marginBottom: 20,
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
  fields: {
    gap: 14,
  },
  inputWrap: {
    borderRadius: radius.sm,
    backgroundColor: brand.grey[100],
    overflow: 'hidden',
  },
  inputWrapFocused: {
    backgroundColor: sage.tint,
  },
  input: {
    height: 62,
    fontSize: 17,
    backgroundColor: 'transparent',
  },
  pinSection: {
    alignItems: 'center',
    gap: 22,
  },
  pinDotsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: brand.grey[300],
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: brand.primary.main,
    borderColor: brand.primary.main,
  },
  keypad: {
    width: '100%',
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keypadKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.grey[100],
  },
  keypadKeySpacer: {
    width: 72,
    height: 72,
  },
  keypadKeyGhost: {
    backgroundColor: 'transparent',
  },
  keypadKeyPressed: {
    backgroundColor: sage.tint,
  },
  keypadKeyLabel: {
    color: brand.grey[800],
  },
  error: {
    color: brand.error.main,
    marginTop: 12,
    textAlign: 'center',
  },
  submit: {
    marginTop: 20,
  },
  footer: {
    color: brand.grey[400],
    textAlign: 'center',
    marginTop: 20,
  },
});
