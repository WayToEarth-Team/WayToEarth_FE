import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ensureAccessToken, onAuthTokenChange, clearTokens } from '../utils/auth/tokenManager';
import { getMyProfile, type UserProfile } from '../utils/api/users';

type AuthContextValue = {
  user: UserProfile | null;
  userId: number | null;
  loading: boolean;
  initialized: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const token = await ensureAccessToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await getMyProfile();
      setUser(me);
    } catch (e) {
      // On failure, keep user null
      setUser(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    // Initial load once at app start
    loadProfile();
    // Subscribe to token changes (login/logout/refresh scenarios)
    const off = onAuthTokenChange(() => {
      // Re-load profile when access/refresh tokens change
      loadProfile();
    });
    return () => {
      try { off(); } catch {}
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    try {
      await clearTokens();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    userId: user?.id ?? null,
    loading,
    initialized,
    refreshProfile,
    signOut,
  }), [user, loading, initialized, refreshProfile, signOut]);

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

