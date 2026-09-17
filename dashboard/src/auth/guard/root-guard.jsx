'use client';

import { useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { CONFIG } from 'src/config-global';

import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from '../hooks';

// ----------------------------------------------------------------------

export function RootGuard() {
  const router = useRouter();

  const { authenticated, loading } = useAuthContext();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (authenticated) {
      router.replace(CONFIG.auth.redirectPath);
      return;
    }

    router.replace(paths.auth.jwt.signIn);
  }, [authenticated, loading, router]);

  return <SplashScreen />;
}
