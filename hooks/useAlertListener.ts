import {
  addNotificationResponseReceivedListener,
  AndroidNotificationPriority,
  requestPermissionsAsync,
  scheduleNotificationAsync,
} from 'expo-notifications';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
type SOSAlert = {
  id: string;
  message: string;
  location?: { latitude: number; longitude: number };
  timestamp: any;
  seen: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAlertListener(userId: string | undefined) {
  const [activeAlert, setActiveAlert] = useState<SOSAlert | null>(null);
  const listenerRef = useRef<any>(null);

  // ── Request notification permission ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permission not granted');
      }
    })();

    // Listen for notification taps when app is in background
    listenerRef.current = addNotificationResponseReceivedListener(() => {
      // App opens — Firestore listener below will show the modal
    });

    return () => {
      if (listenerRef.current) {
        listenerRef.current?.remove();
      }
    };
  }, []);

  // ── Listen to Firestore for new alerts ────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'users', userId, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) return;

      const latestDoc = snap.docs[0];
      const data = latestDoc.data();

      // Only trigger if alert hasn't been seen yet
      if (!data.seen) {
        const alert: SOSAlert = {
          id: latestDoc.id,
          message: data.message || 'SOS! The wearer needs help!',
          location: data.location,
          timestamp: data.timestamp,
          seen: false,
        };

        // Show in-app modal
        setActiveAlert(alert);

        // Send push notification (works when app is in background)
        await scheduleNotificationAsync({
          content: {
            title: '🚨 SOS Alert!',
            body: alert.message,
            sound: true,
            ...(Platform.OS === 'android' && {
              priority: AndroidNotificationPriority.MAX,
            }),
          },
          trigger: null,
        });
      }
    });

    return () => unsub();
  }, [userId]);

  // ── Mark alert as seen when user presses Okay ─────────────────────────────
  const dismissAlert = async () => {
    if (!activeAlert || !userId) return;
    try {
      await updateDoc(
        doc(db, 'users', userId, 'alerts', activeAlert.id),
        { seen: true }
      );
    } catch (e) {
      console.error('Failed to mark alert as seen:', e);
    }
    setActiveAlert(null);
  };

  return { activeAlert, dismissAlert };
}