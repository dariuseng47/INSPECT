import { StyleSheet, Text, View } from 'react-native';

import { alpha, brand } from '../theme/colors';
import { radius } from '../theme/theme';
import { fontFamily } from '../theme/typography';

// Ported from dashboard/src/components/label/label.jsx `variant="soft"` — a
// 16%-alpha tint of the status color + dark-toned text. Used for fabric item
// status (in-use/hold/decommissioned/etc.) so the color language matches the
// web dashboard's status semantics.
const colorMap = {
  default: { main: brand.grey[500], dark: brand.grey[700] },
  primary: brand.primary,
  success: brand.success,
  warning: brand.warning,
  error: brand.error,
  info: brand.info,
};

export function StatusChip({ label, color = 'default', style }) {
  const tone = colorMap[color] || colorMap.default;

  return (
    <View
      style={[styles.chip, { backgroundColor: alpha(tone.main, 0.16) }, style]}
    >
      <Text style={[styles.label, { color: tone.dark }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
  },
});
