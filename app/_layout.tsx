import * as Notifications from 'expo-notifications';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/authContext';

// ─── Global Notification Handler (Allows sound & alert in Foreground) ─────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  })as any,
});

// ─── Inner component (needs access to useAuth) ────────────────────────────────
function RouteGuard() {
  const { user, isFirstLaunch, isLoadingAuth, isSessionExpired, clearExpired } = useAuth();
  const router   = useRouter();
  const segments = useSegments();

  // 1. Notification Permissions & Channel Setup
  useEffect(() => {
    async function configurePushNotifications() {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions denied.');
        return;
      }

      if (Platform.OS === 'android') {
        await Notifications.deleteNotificationChannelAsync('emergency_alerts_v2');
        await Notifications.setNotificationChannelAsync('emergency_alerts_v3', {
          name: 'Emergency Alerts V3',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#f87171',
          sound: 'care_alert_ringtone', // Extension omitted for Android native res/raw/
        });
      }
    }

    configurePushNotifications();
  }, []);

  // 2. Auth Route Protection Logic
  useEffect(() => {
    if (isFirstLaunch === null || isLoadingAuth) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isSessionExpired) {
      clearExpired();
      router.replace({ pathname: '/(auth)/login', params: { expired: 'true' } });
      return;
    }

    if (isFirstLaunch && !user) {
      router.replace('/(auth)/login');
      return;
    }

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (user && inAuthGroup) {
      router.replace('/(tabs)/dashboard' as any);
      return;
    }
  }, [user, isFirstLaunch, isLoadingAuth, isSessionExpired, segments]);

  // ─── Render Block ──────────────────────────────────────────────────────────
  if (isFirstLaunch === null || isLoadingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return <Slot />;
}

// ─── Root layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <AuthProvider>
      <RouteGuard />
    </AuthProvider>
  );
}