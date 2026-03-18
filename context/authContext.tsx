import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../config/firebase';

// ─── Keys ─────────────────────────────────────────────────────────────────────
const KEYS = {
  HAS_LAUNCHED: 'app:hasLaunched',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type User = { id: string; email: string } | null;

type AuthContextType = {
  user: User;
  isFirstLaunch: boolean | null;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]                   = useState<User>(null);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  // ── On mount: listen to Firebase auth state ────────────────────────────────
  useEffect(() => {
    // Check first launch
    AsyncStorage.getItem(KEYS.HAS_LAUNCHED).then((value) => {
      setIsFirstLaunch(value === null);
    });

    // Firebase keeps the user logged in automatically — just listen to it
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({ id: firebaseUser.uid, email: firebaseUser.email! });
      } else {
        setUser(null);
      }
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
      value={{ user, isFirstLaunch, login, logout }}
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