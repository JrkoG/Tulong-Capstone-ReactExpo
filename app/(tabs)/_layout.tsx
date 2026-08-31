import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications'; // Added expo-notifications
import { Tabs, useRouter } from 'expo-router'; // Added useRouter
import { getAuth } from 'firebase/auth';
import { limitToLast, onValue, query, ref } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native'; // Added Platform

import GuardianResponseModal from '../../components/GuardianResponseModal';
import { db, rtdb } from '../../config/firebase';

// ─── STEP 3: Configure Foreground Notification Behavior ────────────────────────
// This dictates how notifications act when the app is actively on screen.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Maps guardian status → human-readable message for the response modal
const STATUS_MESSAGES: Record<string, string> = {
  responded: 'has responded to the alert',
  on_the_way: 'is on the way to the wearer',
  arrived: "has arrived at the wearer's location",
  aided: 'has aided the wearer — situation under control',
};

// ─── Module-level session state ───────────────────────────────────────────────
let _seenGuardianStatusKey: string | null = null;
let _alertsListenerInitialized = false;

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter(); // Initialize router for notification tap handling

  const [showResponseModal, setShowResponseModal] = useState(false);
  const [latestResponse, setLatestResponse] = useState<any>(null);

  const [groupId, setGroupId] = useState<string | null>(null);
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  // ─── STEP 3: Initialize Notification Channels & Listeners ────────────────────
  useEffect(() => {
    async function configurePushNotifications() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('sos-alerts', {
          name: 'SOS & Fall Alerts',
          importance: Notifications.AndroidImportance.MAX, // Max priority for emergencies
          vibrationPattern: [0, 500, 200, 500], // Matches your modal vibration
          lightColor: '#f87171',
          sound: 'CAREAlertRingtone', // MUST match the filename in assets and app.json exactly
        });
      }
    }
    
    configurePushNotifications();

    // Listen for users tapping the notification when the app is in the background or killed
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log("User tapped notification, data:", data);
      
      // When tapped, immediately route the user to the dashboard. 
      // Your existing components/Firebase listeners will handle displaying the FallSOSModal or SOSModal automatically.
      router.push('/dashboard');
    });

    return () => {
      responseListener.remove();
    };
  }, []);

  // ─── Fetch the user's group on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const fetchUserGroup = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists() && userDoc.data().groupId) {
          setGroupId(userDoc.data().groupId);
        }
      } catch (e) {
        console.error('Error fetching group in layout:', e);
      }
    };

    fetchUserGroup();
  }, [userId]);

  // ─── GLOBAL Guardian Response Listener ───────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;

    const alertsQuery = query(ref(rtdb, `groups/${groupId}/alerts`), limitToLast(1));

    const unsubscribe = onValue(alertsQuery, (snapshot) => {
      if (!snapshot.exists()) return;

      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();

        if (
          data.status === 'resolved' ||
          data.status === 'aided' ||
          !data.currentStatus ||
          !data.lastResponderName ||
          !data.lastUpdateAt
        ) {
          return;
        }

        const statusKey = `${data.lastResponderName}-${data.currentStatus}-${data.lastUpdateAt}`;
        const updateTime = new Date(data.lastUpdateAt).getTime();
        const isRecent = Date.now() - updateTime < 90 * 1000;

        if (!_alertsListenerInitialized) {
          _seenGuardianStatusKey = statusKey;
          return;
        }

        if (!isRecent || statusKey === _seenGuardianStatusKey) return;
        _seenGuardianStatusKey = statusKey;

        if (data.lastResponderId === userId) return;

        setLatestResponse(data);
        setShowResponseModal(true);
      });

      _alertsListenerInitialized = true;
    });

    return () => unsubscribe();
  }, [groupId, userId]);

  return (
    <>
      {/* --- TABS --- */}
      <Tabs screenOptions={{ tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="add-contact"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />
        <Tabs.Screen
          name="group"
          options={{
            title: 'Group',
            tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={24} color={color} />,
          }}
        />
        <Tabs.Screen name="tracker" options={{ title: 'Tracker' }} />
      </Tabs>

      {/* --- GLOBAL NOTIFICATION MODAL --- */}
      <GuardianResponseModal
        visible={showResponseModal}
        guardianName={latestResponse?.lastResponderName || 'A Guardian'}
        status={latestResponse?.currentStatus || 'responded'}
        message={`${latestResponse?.lastResponderName ?? 'A Guardian'} ${
          STATUS_MESSAGES[latestResponse?.currentStatus] ?? 'updated their status'
        }`}
        timestamp={latestResponse?.lastUpdateAt}
        onDismiss={() => setShowResponseModal(false)}
      />
    </>
  );
}