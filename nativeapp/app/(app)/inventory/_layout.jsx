import { Stack } from 'expo-router';

import { brand, surface } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';

export default function InventoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: surface.card },
        headerShadowVisible: false,
        headerTintColor: brand.grey[800],
        headerTitleStyle: { fontFamily: fontFamily.semiBold, fontSize: 16 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'จัดการผ้า' }} />
      <Stack.Screen name="[epc]" options={{ title: 'รายละเอียดผ้า' }} />
      <Stack.Screen name="register" options={{ title: 'ลงทะเบียนผ้าใหม่' }} />
    </Stack>
  );
}
