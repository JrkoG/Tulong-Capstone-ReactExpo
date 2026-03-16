import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/authContext';

// ─── Inner component (needs access to useAuth) ────────────────────────────────
function RouteGuard() {
  const { user, isFirstLaunch, isSessionExpired, clearExpired } = useAuth();
  const router  = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Still loading from AsyncStorage — wait
    if (isFirstLaunch === null) return;

    const inAuthGroup = segments[0] === '(auth)';

    // 1. Session expired → go to login with an expired flag
    if (isSessionExpired) {
      clearExpired();
      router.replace({ pathname: '/(auth)/login', params: { expired: 'true' } });
      return;
    }

    // 2. First time ever opening the app → register
    if (isFirstLaunch && !user) {
      router.replace('/(auth)/register');
      return;
    }

    // 3. Not logged in and not already in auth screens → login
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    // 4. Logged in but still on an auth screen → go to app
    if (user && inAuthGroup) {
      router.replace('/(tabs)/dashboard' as any);
      return;
    }
  }, [user, isFirstLaunch, isSessionExpired, segments]);

  return <Slot />;
}

// ─── Root layout (wraps everything in the provider) ───────────────────────────
export default function RootLayout() {
  return (
    <AuthProvider>
      <RouteGuard />
    </AuthProvider>
  );
}