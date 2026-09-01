import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Tabs, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { limitToLast, onValue, query, ref } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import GuardianResponseModal from '../../components/GuardianResponseModal';
import { db, rtdb } from '../../config/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowList: true,
  }),
});

const STATUS_MESSAGES: Record<string, string> = {
  responded: 'has responded to the alert',
  on_the_way: 'is on the way to the wearer',
  arrived: "has arrived at the wearer's location",
  aided: 'has aided the wearer — situation under control',
};

let _seenGuardianStatusKey: string | null = null;
let _alertsListenerInitialized = false;

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const [showResponseModal, setShowResponseModal] = useState(false);
  const [latestResponse, setLatestResponse] = useState<any>(null);

  const [groupId, setGroupId] = useState<string | null>(null);
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  useEffect(() => {
  async function configurePushNotifications() {
    const { status } = await Notifications.requestPermissionsAsync(); //[cite: 4]
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      // Force delete old cached channel[cite: 4]
      await Notifications.deleteNotificationChannelAsync('emergency_alerts'); //[cite: 4]

      // Register new channel with clean sound name (no extension)[cite: 4]
      await Notifications.setNotificationChannelAsync('emergency_alerts_v2', {
        name: 'Emergency Alerts V2',
        importance: Notifications.AndroidImportance.MAX, //[cite: 4]
        vibrationPattern: [0, 500, 200, 500], //[cite: 4]
        lightColor: '#f87171', //[cite: 4]
        sound: 'care_alert_ringtone', //[cite: 4]
      });
    }
  }
  
  configurePushNotifications();
}, []);

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