import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/auth/AuthContext';
import { ScanReadyProvider } from '../src/context/ScanReadyContext';
import { HospitalWorkspaceProvider } from '../src/hospital/HospitalWorkspaceContext';
import { paperTheme } from '../src/theme/theme';
import { googleFontsToLoad } from '../src/theme/typography';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(googleFontsToLoad);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <AuthProvider>
          <HospitalWorkspaceProvider>
            <ScanReadyProvider>
              <StatusBar style="dark" />
              <Slot />
            </ScanReadyProvider>
          </HospitalWorkspaceProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
