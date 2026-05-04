import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { limitToLast, onValue, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

// 👇 Make sure these paths match where your files actually are
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import GuardianResponseModal from '../../components/GuardianResponseModal';
import { db, rtdb } from '../../config/firebase';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // --- 1. NEW STATES FOR EMERGENCY MODAL ---
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [latestResponse, setLatestResponse] = useState<any>(null);

  const [groupId, setGroupId] = useState<string | null>(null);
  const auth = getAuth();
  const currentUserName = auth.currentUser?.displayName || "A Guardian"; 
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;

    const fetchUserGroup = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists() && userDoc.data().groupId) {
          setGroupId(userDoc.data().groupId);
        }
      } catch (e) {
        console.error("Error fetching group in layout:", e);
      }
    };

    fetchUserGroup();
  }, [userId]);

  // --- 2. GLOBAL EMERGENCY LISTENER ---
  useEffect(() => {
    if (!groupId) return;

    // Listen to the most recent alert for this specific group
    const alertsQuery = query(ref(rtdb, `groups/${groupId}/alerts`), limitToLast(1));

    const unsubscribe = onValue(alertsQuery, (snapshot) => {
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();

          if (data.status !== 'resolved' && data.status !== 'aided' && data.lastResponderName) {
            // Prevent the user from seeing their own update
            if (data.lastResponderName !== currentUserName) {
              setLatestResponse(data);
              setShowResponseModal(true);
            }
          }
        });
      }
    });

    return () => unsubscribe();
  }, [groupId, currentUserName]);

  return (
    <>
      {/* --- 3. YOUR EXISTING TABS --- */}
      <Tabs screenOptions={{ tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen
          name="index"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => (
              <Ionicons name="grid-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="add-contact"
          options={{
            href: null, 
            tabBarStyle: { display: 'none' }, 
          }}
        />
        <Tabs.Screen
          name="group"
          options={{
            title: 'Group',
            tabBarIcon: ({ color }) => (
              <Ionicons name="people-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tracker"
          options={{
            title: "Tracker",
          }}
        />
      </Tabs>

      {/* --- 4. THE GLOBAL NOTIFICATION MODAL --- */}
      <GuardianResponseModal
        visible={showResponseModal}
        guardianName={latestResponse?.lastResponderName || 'A Guardian'}
        status={latestResponse?.currentStatus || 'responded'}
        message={`has updated their status to ${latestResponse?.currentStatus?.replace('_', ' ')}`}
        timestamp={latestResponse?.lastUpdateAt}
        onDismiss={() => setShowResponseModal(false)}
      />
    </>
  );
}