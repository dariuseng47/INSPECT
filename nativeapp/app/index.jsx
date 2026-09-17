import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { brand, surface } from '../src/theme/colors';

export default function Index() {
  const { status } = useAuth();

  if (status === 'booting') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={brand.primary.main} size="large" />
      </View>
    );
  }

  return <Redirect href={status === 'signedIn' ? '/home' : '/login'} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.background,
  },
});
