import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { limitToLast, onValue, query, ref } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import GuardianResponseModal from '../../components/GuardianResponseModal';
import { db, rtdb } from '../../config/firebase';

// Maps guardian status → human-readable message for the response modal
const STATUS_MESSAGES: Record<string, string> = {
  responded: 'has responded to the alert',
  on_the_way: 'is on the way to the wearer',
  arrived: "has arrived at the wearer's location",
  aided: 'has aided the wearer — situation under control',
};

// ─── Module-level session state ───────────────────────────────────────────────
// Lives OUTSIDE the component so it survives remounts, tab switches, and Fast
// Refresh. This is the ONLY guardian-response listener in the entire app —
// it lives here because _layout.tsx wraps every tab, so the modal can pop up
// no matter which screen the user is currently on. Do NOT duplicate this
// logic in dashboard.tsx or any other screen — that caused two independent,
// undeduped listeners to fire simultaneously, which is what caused stale
// "9:01 AM" style responses to keep reappearing every time a tab was switched.
let _seenGuardianStatusKey: string | null = null;
let _alertsListenerInitialized = false;

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [showResponseModal, setShowResponseModal] = useState(false);
  const [latestResponse, setLatestResponse] = useState<any>(null);

  const [groupId, setGroupId] = useState<string | null>(null);
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

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

        // Skip resolved/aided alerts or entries with no guardian response yet
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

        // Recency gate: only show if the status was updated within the last 90
        // seconds. This is what stops old/stale Firebase data (like a response
        // from hours ago) from ever triggering the modal again, regardless of
        // how many times this listener re-subscribes.
        const updateTime = new Date(data.lastUpdateAt).getTime();
        const isRecent = Date.now() - updateTime < 90 * 1000;

        if (!_alertsListenerInitialized) {
          // First fire on this listener (cold start, remount, or Fast Refresh)
          // — seed the dedup key without showing the modal.
          _seenGuardianStatusKey = statusKey;
          return;
        }

        if (!isRecent || statusKey === _seenGuardianStatusKey) return;
        _seenGuardianStatusKey = statusKey;

        // Don't show the modal to the guardian who triggered this status
        // themselves — checked by UID, not displayName (displayName is never
        // set on the Firebase Auth profile in this app, so it was always
        // "A Guardian" and the old self-check never actually worked).
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
      {/* This is the ONLY GuardianResponseModal in the app. It lives here so it
          can appear regardless of which tab the user is currently viewing. */}
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