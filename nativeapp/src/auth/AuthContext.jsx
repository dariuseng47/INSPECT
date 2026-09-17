import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  fetchMe,
  login as loginRequest,
  loginWithPin as loginWithPinRequest,
  logout as logoutRequest,
} from '../api/auth.api';
import { fetchMyPermissions } from '../api/permissions.api';
import {
  clearAuthHeader,
  setAuthHeader,
  setSessionExpiredHandler,
  setPermStaleHandler,
} from '../api/client';
import { connectSocket, disconnectSocket } from '../api/socket';
import {
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setSessionExpiresAt,
} from '../api/tokenStore';
import { SessionTimeoutModal } from './SessionTimeoutModal';

const AuthContext = createContext(null);

// status: 'booting' | 'signedOut' | 'signedIn'
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('booting');
  const [user, setUser] = useState(null);
  const [permVersion, setPermVersion] = useState(null);
  // null = ยังไม่โหลด/โหลดไม่สำเร็จ -> can() คืน true ไว้ก่อน (backend เป็นตัวกันจริงอยู่แล้ว)
  const [permissions, setPermissions] = useState(null);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      disconnectSocket();
      setUser(null);
      setPermVersion(null);
      setPermissions(null);
      setStatus('signedOut');
    });
  }, []);

  const loadPermissions = async () => {
    try {
      setPermissions(await fetchMyPermissions());
    } catch {
      setPermissions(null);
    }
  };

  // interceptor เรียกหลัง refresh ที่มาจาก 401 PERM_STALE — ดึงสิทธิ์ใหม่มา gate เมนู
  useEffect(() => {
    setPermStaleHandler(() => {
      loadPermissions();
    });
  }, []);

  useEffect(() => {
    (async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setStatus('signedOut');
        return;
      }

      setAuthHeader(accessToken);
      try {
        const me = await fetchMe();
        await setSessionExpiresAt(me.sessionExpiresAt);
        setUser(me.user);
        setPermVersion(me.permVersion);
        await loadPermissions();
        setStatus('signedIn');
        // ต่อ socket ให้ presence.js เห็นว่า handheld นี้ "ออนไลน์" ทันทีที่ยืนยันตัวตนสำเร็จ
        // (ไม่ใช่แค่ตอน signIn สด — เปิดแอปแล้ว token เดิมยัง valid ก็ต้องนับออนไลน์ด้วย)
        connectSocket();
      } catch {
        // Expired/invalid tokens are handled by the client's 401 refresh flow;
        // if we land here, refresh itself failed and already cleared storage.
        setStatus('signedOut');
      }
    })();
  }, []);

  // ทั้ง signIn (username/password) และ signInWithPin (PIN 6 หลัก) ทำสิ่งเดียวกันหลังจากนั้น —
  // ต่างกันแค่ request แรกที่ใช้แลก token คู่แรกมา
  const finishSignIn = async (result) => {
    await setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    await setSessionExpiresAt(result.sessionExpiresAt);
    setAuthHeader(result.accessToken);

    const me = await fetchMe();
    setUser(me.user);
    setPermVersion(me.permVersion);
    await loadPermissions();
    setStatus('signedIn');
    connectSocket();
  };

  const signIn = async ({ username, password }) => {
    const result = await loginRequest({ username, password });
    await finishSignIn(result);
  };

  const signInWithPin = async (pin) => {
    const result = await loginWithPinRequest({ pin });
    await finishSignIn(result);
  };

  const signOut = async () => {
    const refreshToken = await getRefreshToken();
    await logoutRequest({ refreshToken });
    disconnectSocket();
    await clearTokens();
    clearAuthHeader();
    setUser(null);
    setPermVersion(null);
    setPermissions(null);
    setStatus('signedOut');
  };

  // can('handheld.ward.view') -> true/false ; superadmin หรือยังโหลดสิทธิ์ไม่เสร็จ = true
  const can = useMemo(() => {
    const isSuperadmin = user?.role === 'SUPERADMIN';
    const granted = new Set((permissions || []).filter((p) => p.effective).map((p) => p.key));
    return (permKey) => {
      if (!permKey) return true;
      if (isSuperadmin || permissions == null) return true;
      return granted.has(permKey);
    };
  }, [user, permissions]);

  const value = useMemo(
    () => ({ status, user, permVersion, permissions, can, signIn, signInWithPin, signOut }),
    [status, user, permVersion, permissions, can]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {status === 'signedIn' && <SessionTimeoutModal onForceLogout={signOut} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
