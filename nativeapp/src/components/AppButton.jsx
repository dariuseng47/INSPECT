import { Button } from 'react-native-paper';

import { brand, sage } from '../theme/colors';
import { radius } from '../theme/theme';
import { fontFamily } from '../theme/typography';

// Thin wrapper over Paper's Button that adds the dashboard's "soft" variant —
// a 16%-alpha tint background + dark-toned text (dashboard/src/theme/core/components/button.jsx)
// — explicitly, rather than relying on Paper's mode-to-theme-slot mapping.
export function AppButton({ variant = 'filled', style, labelStyle, contentStyle, ...props }) {
  const variantProps = {
    filled: { mode: 'contained', buttonColor: brand.primary.main, textColor: brand.primary.contrastText },
    soft: { mode: 'contained', buttonColor: sage.tint, textColor: sage.text },
    outlined: { mode: 'outlined', textColor: brand.primary.dark },
    text: { mode: 'text', textColor: brand.primary.dark },
  }[variant];

  return (
    <Button
      {...variantProps}
      style={[{ borderRadius: radius.sm }, style]}
      // ความสูงปุ่ม default ขยายขึ้น (ก่อนหน้านี้ปล่อยให้ Paper กำหนดเอง ~40px) ให้เป็นจุดแตะ
      // ที่ใหญ่พอสำหรับใช้งานหน้างานจริง — หน้าไหนอยาก override เอง ก็ยังส่ง contentStyle มาทับได้
      contentStyle={[{ minHeight: 56, paddingVertical: 6 }, contentStyle]}
      labelStyle={[{ fontFamily: fontFamily.bold, fontSize: 17 }, labelStyle]}
      {...props}
    />
  );
}
