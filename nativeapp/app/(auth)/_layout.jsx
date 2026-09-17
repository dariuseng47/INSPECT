import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/auth/AuthContext';

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'signedIn') {
    return <Redirect href="/account" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
