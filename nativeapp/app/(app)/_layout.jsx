import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthContext';
import { tabs } from '../../src/constants/nav';
import { useScanReady } from '../../src/context/ScanReadyContext';
import { useHospitalWorkspace } from '../../src/hospital/HospitalWorkspaceContext';
import { brand, sage, surface } from '../../src/theme/colors';
import { shadow } from '../../src/theme/shadows';
import { radius } from '../../src/theme/theme';
import { fontFamily } from '../../src/theme/typography';

// ลอยเหนือปุ่มหน้าแรกกลาง tab bar แทนที่จะติดอยู่กับช่องกรอกแต่ละหน้า (ดู ScanReadyContext) —
// เห็นชัดจุดเดียวไม่ว่าจะอยู่หน้าไหน โทนส้ม (brand.warning) ให้ตัดกับปุ่มหน้าแรกสีเขียวด้านล่าง
function ScanReadyBadge() {
  const { scanReady } = useScanReady();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!scanReady) return undefined;
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanReady, pulse]);

  if (!scanReady) return null;

  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] });

  return (
    <View
      pointerEvents="none"
      style={[styles.scanReadyWrap, { bottom: Math.max(insets.bottom, 12) + 106 }]}
    >
      <Animated.View style={[styles.scanReadyBadge, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}>
        <MaterialCommunityIcons name="cellphone-wireless" size={20} color={brand.warning.contrastText} />
        <Text style={styles.scanReadyText}>พร้อมสแกน</Text>
      </Animated.View>
    </View>
  );
}

export default function AppLayout() {
  const { status, can } = useAuth();
  const { ready: hospitalReady } = useHospitalWorkspace();
  const insets = useSafeAreaInsets();

  if (status === 'booting') {
    return null;
  }

  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  // รอจนรู้ว่ากำลังทำงานที่โรงพยาบาลไหนก่อน ค่อยให้หน้าอื่นเริ่มยิง request
  // (superadmin/แอดมินหลายโรงพยาบาล: request แรกๆ ต้องมี hospitalId ที่ถูกต้อง)
  if (!hospitalReady) {
    return (
      <View style={styles.bootGate}>
        <ActivityIndicator color={brand.primary.main} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScanReadyBadge />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.primary.dark,
        tabBarInactiveTintColor: brand.grey[400],
        // Floating pill bar instead of the old full-width bordered bar — modern trend,
        // and it reads as one deliberate object instead of a strip glued to the edge.
        tabBarStyle: [
          styles.tabBar,
          { bottom: Math.max(insets.bottom, 12) },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: { fontFamily: fontFamily.semiBold, fontSize: 13 },
      }}
    >
      {tabs.map((tab) => {
        // "หน้าแรก" อยู่กึ่งกลางแถบเมนู (ดู src/constants/nav.js) และตั้งใจให้เป็นปุ่มวงกลม
        // ใหญ่เด่นลอยขึ้นมาเหนือแถบ ต่างจากแท็บอื่นที่เป็นไอคอนแบบ pill ปกติ
        const isHome = tab.name === 'home';
        // ไม่มีสิทธิ์ handheld.<module>.view -> ซ่อนแท็บ (route ยังอยู่ เผื่อ push ตรง)
        const hidden = !isHome && !can(tab.perm);

        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              href: hidden ? null : undefined,
              tabBarItemStyle: isHome ? styles.tabBarItemHome : styles.tabBarItem,
              // โชว์ข้อความเมนูตลอดสำหรับแท็บที่ไม่ใช่ home — ยกเว้น home ที่ไม่โชว์เลย
              // เพราะวงกลมใหญ่เห็นชัดเจนอยู่แล้วในตัวเอง
              tabBarLabel: ({ focused, color }) =>
                !isHome ? (
                  <Text style={[styles.label, { color }]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                ) : null,
              tabBarIcon: ({ color, focused, size }) =>
                isHome ? (
                  <View style={styles.homeCircle}>
                    <MaterialCommunityIcons
                      name={focused ? tab.iconActive : tab.icon}
                      color={brand.primary.contrastText}
                      size={size + 10}
                    />
                  </View>
                ) : (
                  <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                    <MaterialCommunityIcons
                      name={focused ? tab.iconActive : tab.icon}
                      color={color}
                      size={size + 4}
                    />
                  </View>
                ),
            }}
          />
        );
      })}
      <Tabs.Screen name="account" options={{ href: null, title: 'บัญชีผู้ใช้' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'ตั้งค่าเครื่อง' }} />
      <Tabs.Screen name="status-change" options={{ href: null, title: 'เปลี่ยนสถานะผ้า' }} />
      <Tabs.Screen name="select-hospital" options={{ href: null, title: 'เลือกโรงพยาบาล' }} />
      {/* เอาออกจากเมนู/tab bar แล้ว แต่หน้าจอยังอยู่ เผื่อมี route เข้าตรงๆ จากที่อื่น */}
      <Tabs.Screen name="hold" options={{ href: null, title: 'พัก & ชำรุด' }} />
      <Tabs.Screen name="location" options={{ href: null, title: 'ค้นหาตำแหน่งผ้า' }} />
      <Tabs.Screen name="ward-history" options={{ href: null, title: 'ประวัติการจ่ายผ้า' }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bootGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.background,
  },
  scanReadyWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  scanReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: brand.warning.main,
    ...shadow.raised,
  },
  scanReadyText: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: brand.warning.contrastText,
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: surface.card,
    borderTopWidth: 0,
    paddingHorizontal: 4,
    ...shadow.raised,
  },
  tabBarItem: {
    paddingTop: 10,
  },
  tabBarItemHome: {
    paddingTop: 0,
  },
  iconWrap: {
    width: 48,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: sage.tint,
  },
  // วงกลมใหญ่ลอยขึ้นเหนือแถบเมนู — จุดเด่นตรงกลาง แตะง่ายเพราะเป็นปุ่มที่ใช้บ่อยที่สุด
  homeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.primary.main,
    borderWidth: 4,
    borderColor: surface.card,
    ...shadow.raised,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    marginTop: 2,
  },
});
