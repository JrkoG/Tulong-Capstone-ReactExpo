import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes — change as needed
const KEYS = {
  HAS_LAUNCHED: 'app:hasLaunched',
  USER:         'app:user',
  LOGIN_TIME:   'app:loginTime',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type User = { id: string; email: string } | null;

type AuthContextType = {
  user: User;
  isFirstLaunch: boolean | null; // null = still loading
  isSessionExpired: boolean;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  clearExpired: () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]                   = useState<User>(null);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── On mount: check first launch + restore session ──────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [hasLaunched, storedUser, loginTime] = await Promise.all([
          AsyncStorage.getItem(KEYS.HAS_LAUNCHED),
          AsyncStorage.getItem(KEYS.USER),
          AsyncStorage.getItem(KEYS.LOGIN_TIME),
        ]);

        // First launch check
        setIsFirstLaunch(hasLaunched === null);

        // Restore session if it hasn't expired
        if (storedUser && loginTime) {
          const elapsed = Date.now() - Number(loginTime);
          if (elapsed < SESSION_TIMEOUT_MS) {
            setUser(JSON.parse(storedUser));
            // Resume the remaining time on the timeout
            scheduleTimeout(SESSION_TIMEOUT_MS - elapsed);
          } else {
            // Session already expired while app was closed
            await clearStorage();
            setIsSessionExpired(true);
          }
        }
      } catch (e) {
        console.error('Auth init error:', e);
      }
    }
    init();
    return () => clearTimer();
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function scheduleTimeout(ms: number) {
    clearTimer();
    timeoutRef.current = setTimeout(async () => {
      await clearStorage();
      setUser(null);
      setIsSessionExpired(true);
    }, ms);
  }

  function clearTimer() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }

  async function clearStorage() {
    await AsyncStorage.multiRemove([KEYS.USER, KEYS.LOGIN_TIME]);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function login(userData: User) {
    const now = Date.now();
    await Promise.all([
      AsyncStorage.setItem(KEYS.HAS_LAUNCHED, 'true'),  // mark as launched
      AsyncStorage.setItem(KEYS.USER, JSON.stringify(userData)),
      AsyncStorage.setItem(KEYS.LOGIN_TIME, String(now)),
    ]);
    setIsFirstLaunch(false);
    setIsSessionExpired(false);
    setUser(userData);
    scheduleTimeout(SESSION_TIMEOUT_MS);
  }

  async function logout() {
    clearTimer();
    await clearStorage();
    setUser(null);
    setIsSessionExpired(false);
  }

  function clearExpired() {
    setIsSessionExpired(false);
  }

  return (
    <AuthContext.Provider
      value={{ user, isFirstLaunch, isSessionExpired, login, logout, clearExpired }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}