import {
    addNotificationResponseReceivedListener,
    AndroidNotificationPriority,
    requestPermissionsAsync,
    scheduleNotificationAsync,
} from 'expo-notifications';
import {
    addDoc,
    collection,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
type GuardianResponse = {
  id: string;
  guardianId: string;
  guardianName: string;
  status: 'responded' | 'on_the_way' | 'arrived' | 'aided';
  message: string;
  timestamp: any;
  seen: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useGuardianResponse(
  userId: string | undefined,
  groupId: string | undefined,
  myName: string | undefined
) {
  const [activeResponse, setActiveResponse] = useState<GuardianResponse | null>(null);
  const [responding, setResponding]         = useState(false);
  const listenerRef = useRef<any>(null);

  // ── Request notification permission ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permission not granted');
      }
    })();

    listenerRef.current = addNotificationResponseReceivedListener(() => {});

    return () => {
      if (listenerRef.current) {
        listenerRef.current.remove();
      }
    };
  }, []);

  // ── Listen to group responses ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !groupId) return;

    const q = query(
      collection(db, 'groups', groupId, 'responses'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) return;

      const latestDoc = snap.docs[0];
      const data = latestDoc.data();

      // Only notify OTHER guardians — not the one who responded
      if (!data.seen && data.guardianId !== userId) {
        const response: GuardianResponse = {
          id: latestDoc.id,
          guardianId: data.guardianId,
          guardianName: data.guardianName,
          status: data.status,
          message: data.message,
          timestamp: data.timestamp,
          seen: false,
        };

        setActiveResponse(response);

        // Send push notification
        await scheduleNotificationAsync({
          content: {
            title: getNotifTitle(data.status),
            body: data.message,
            sound: true,
            ...(Platform.OS === 'android' && {
              priority: AndroidNotificationPriority.HIGH,
            }),
          },
          trigger: null,
        });
      }
    });

    return () => unsub();
  }, [userId, groupId]);

  // ── Send a response ────────────────────────────────────────────────────────
  const sendResponse = async (
    status: GuardianResponse['status'],
    alertId?: string
  ) => {
    if (!userId || !groupId || !myName) return;

    try {
      setResponding(true);

      const message = getStatusMessage(status, myName);

      // Write response to group responses collection
      await addDoc(collection(db, 'groups', groupId, 'responses'), {
        guardianId: userId,
        guardianName: myName,
        status,
        message,
        alertId: alertId ?? null,
        timestamp: serverTimestamp(),
        seen: false,
      });

      // Update member status in the group
      await updateDoc(doc(db, 'groups', groupId, 'members', userId), {
        responseStatus: status,
        lastResponse: serverTimestamp(),
      });

      // Also log it to the alert if alertId is provided
      if (alertId) {
        await addDoc(
          collection(db, 'groups', groupId, 'responses', alertId, 'logs'),
          {
            guardianId: userId,
            guardianName: myName,
            status,
            message,
            timestamp: serverTimestamp(),
          }
        );
      }
    } catch (e) {
      console.error('Failed to send response:', e);
    } finally {
      setResponding(false);
    }
  };

  // ── Dismiss the response notification ─────────────────────────────────────
  const dismissResponse = async () => {
    if (!activeResponse || !groupId) return;
    try {
      await updateDoc(
        doc(db, 'groups', groupId, 'responses', activeResponse.id),
        { seen: true }
      );
    } catch (e) {
      console.error('Failed to dismiss response:', e);
    }
    setActiveResponse(null);
  };

  return { activeResponse, dismissResponse, sendResponse, responding };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStatusMessage(status: GuardianResponse['status'], name: string): string {
  switch (status) {
    case 'responded':  return `${name} has responded to the SOS alert.`;
    case 'on_the_way': return `${name} is on the way to the wearer.`;
    case 'arrived':    return `${name} has arrived at the wearer's location.`;
    case 'aided':      return `${name} has aided the wearer. Situation is under control.`;
    default:           return `${name} has updated their status.`;
  }
}

function getNotifTitle(status: GuardianResponse['status']): string {
  switch (status) {
    case 'responded':  return '👋 Guardian Responded';
    case 'on_the_way': return '🚗 Guardian On The Way';
    case 'arrived':    return '📍 Guardian Arrived';
    case 'aided':      return '✅ Wearer Has Been Aided';
    default:           return '🔔 Guardian Update';
  }
}