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
    gap: 18,
  },
});
