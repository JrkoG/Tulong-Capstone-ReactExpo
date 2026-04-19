import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/authContext';

// ─── Inner component (needs access to useAuth) ────────────────────────────────
function RouteGuard() {
  const { user, isFirstLaunch, isLoadingAuth, isSessionExpired, clearExpired } = useAuth();
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // 1. Wait until BOTH AsyncStorage and Firebase Auth are completely finished loading
    if (isFirstLaunch === null || isLoadingAuth) return;

    const inAuthGroup = segments[0] === '(auth)';

    // 2. Session expired → go to login with an expired flag
    if (isSessionExpired) {
      clearExpired();
      router.replace({ pathname: '/(auth)/login', params: { expired: 'true' } });
      return;
    }

    // 3. First time ever opening the app → register
    if (isFirstLaunch && !user) {
      router.replace('/(auth)/register');
      return;
    }

    // 4. Not logged in and not already in auth screens → login
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    // 5. Logged in but still on an auth screen → go to app
    if (user && inAuthGroup) {
      router.replace('/(tabs)/dashboard' as any);
      return;
    }
  }, [user, isFirstLaunch, isLoadingAuth, isSessionExpired, segments]);

  // ─── The Render Block ───────────────────────────────────────────────────────
  
  // If we are still figuring out who the user is, DO NOT render the app screens yet.
  // This physically prevents your database queries from firing prematurely.
  if (isFirstLaunch === null || isLoadingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  // Once Firebase is 100% ready, render the actual routes
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