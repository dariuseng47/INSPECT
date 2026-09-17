import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../auth/AuthContext';
import { brand } from '../theme/colors';
import { type } from '../theme/typography';

// ครอบเนื้อหาหน้าจอที่ต้องมีสิทธิ์ handheld.<module>.view — ไม่มีสิทธิ์แสดงข้อความแทน
// (backend เป็นตัวกันจริงอีกชั้น — ตัวนี้แค่กัน UX งงว่าทำไมกดแล้ว error)
export function PermissionGate({ perm, children }) {
  const { can } = useAuth();
  if (can(perm)) return children;
  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons name="lock-outline" size={40} color={brand.grey[400]} />
      <Text style={[type.subtitle1, styles.title]}>ไม่มีสิทธิ์เข้าถึงเมนูนี้</Text>
      <Text style={[type.body2, styles.desc]}>กรุณาติดต่อผู้ดูแลระบบให้เปิดสิทธิ์ให้</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  title: { marginTop: 8 },
  desc: { color: brand.grey[500], textAlign: 'center' },
});
