import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { surface } from '../theme/colors';

export function ScreenContainer({ children, scroll = true, style }) {
  const Wrapper = scroll ? ScrollView : View;
  const wrapperProps = scroll
    ? { contentContainerStyle: [styles.content, style], keyboardShouldPersistTaps: 'handled' }
    : { style: [styles.content, style] };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Wrapper {...wrapperProps}>{children}</Wrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: surface.background,
  },
  content: {
    padding: 20,
    // Extra clearance for the floating tab bar AND the "พร้อมสแกน" badge that floats
    // above it (app/(app)/_layout.jsx, ScanReadyContext) — both are absolutely
    // positioned, so screen content doesn't get that space reserved automatically and
    // the last item(s) would otherwise sit behind them when scrolled to the bottom.
    paddingBottom: 190,
    gap: 18,
  },
});
