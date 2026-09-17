// Font scale ported from dashboard/src/theme/core/typography.js (Public Sans body,
// Barlow headings). React Native has no CSS variable-font weights, so each weight
// is loaded as a discrete font family via @expo-google-fonts/*.

import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from '@expo-google-fonts/public-sans';
import { Barlow_700Bold, Barlow_800ExtraBold } from '@expo-google-fonts/barlow';

export const fontFamily = {
  regular: 'PublicSans_400Regular',
  medium: 'PublicSans_500Medium',
  semiBold: 'PublicSans_600SemiBold',
  bold: 'PublicSans_700Bold',
  headingBold: 'Barlow_700Bold',
  headingExtraBold: 'Barlow_800ExtraBold',
};

export const googleFontsToLoad = {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
  Barlow_700Bold,
  Barlow_800ExtraBold,
};

// สเกลขยายขึ้นทั้งหมดจากเดิม (~12-15%) — ใช้งานหน้างานจริงบนเครื่อง handheld ต้องอ่านง่าย
// เห็นชัดแม้ไม่ได้จ้องใกล้ๆ ตลอดเวลา
export const type = {
  h1: { fontFamily: fontFamily.headingExtraBold, fontSize: 36, lineHeight: 44 },
  h2: { fontFamily: fontFamily.headingBold, fontSize: 30, lineHeight: 38 },
  h3: { fontFamily: fontFamily.headingBold, fontSize: 24, lineHeight: 31 },
  subtitle1: { fontFamily: fontFamily.semiBold, fontSize: 18, lineHeight: 26 },
  subtitle2: { fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 22 },
  body1: { fontFamily: fontFamily.regular, fontSize: 18, lineHeight: 26 },
  body2: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  overline: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  button: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22 },
};
