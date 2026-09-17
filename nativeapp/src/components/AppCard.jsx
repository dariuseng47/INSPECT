import { StyleSheet, View } from 'react-native';

import { surface } from '../theme/colors';
import { shadow } from '../theme/shadows';
import { radius } from '../theme/theme';

// Soft floating card — no border, depth comes from a gentle shadow instead (the app's
// previous hairline-border cards read as flat/dated). `elevated` swaps in a stronger
// shadow tier for cards that should visually lead the screen (e.g. summary/profile
// cards). Pass shadowOpacity/elevation: 0 via `style` to cancel the shadow entirely
// (see app/(auth)/login.jsx, which wants a completely borderless, shadowless card).
export function AppCard({ style, elevated = false, children, ...props }) {
  return (
    <View style={[styles.card, elevated ? shadow.raised : shadow.low, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.card,
    borderRadius: radius.card,
    padding: 20,
  },
});
