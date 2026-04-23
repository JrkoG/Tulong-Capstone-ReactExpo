import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import { usePushNotifications } from '../hooks/usePushNotifications';

// ─── Keys ─────────────────────────────────────────────────────────────────────
const KEYS = {
  HAS_LAUNCHED: 'app:hasLaunched',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type User = { id: string; email: string } | null;

type AuthContextType = {
  user: User;
  isFirstLaunch: boolean | null;
  isLoadingAuth: boolean; // 1. Add this to your types
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]                   = useState<User>(null);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // 2. Initialize as true

  const { registerForPushNotificationsAsync } = usePushNotifications();

  // ── On mount: listen to Firebase auth state ────────────────────────────────
  useEffect(() => {
    // Check first launch
    AsyncStorage.getItem(KEYS.HAS_LAUNCHED).then((value) => {
      setIsFirstLaunch(value === null);
    });

    // Firebase keeps the user logged in automatically — just listen to it
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({ id: firebaseUser.uid, email: firebaseUser.email! });

       try {
          await registerForPushNotificationsAsync(firebaseUser.uid);
        } catch (error) {
          console.log("Push Registration Error:", error);
        }

      } else {
        setUser(null);
      }
      setIsLoadingAuth(false); // 3. Set to false once Firebase makes a decision
    });

    return () => unsubscribe();
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function login(userData: User) {
    await AsyncStorage.setItem(KEYS.HAS_LAUNCHED, 'true');
    setIsFirstLaunch(false);
    setUser(userData);
  }

  async function logout() {
    await auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, isFirstLaunch, isLoadingAuth, login, logout }}
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
