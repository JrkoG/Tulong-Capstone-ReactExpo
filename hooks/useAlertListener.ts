import {
  AndroidNotificationPriority,
  scheduleNotificationAsync
} from 'expo-notifications';
import { limitToLast, onValue, query, ref, update } from 'firebase/database'; // Change to database
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { rtdb } from '../config/firebase'; // Import rtdb, NOT db

type SOSAlert = {
  id: string;
  message: string;
  location?: { latitude: number; longitude: number };
  timestamp: any;
  seen: boolean;
};

export function useAlertListener(userId: string | undefined) {
  const [activeAlert, setActiveAlert] = useState<SOSAlert | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Use RTDB ref instead of Firestore query
    const alertsRef = query(ref(rtdb, `users/${userId}/alerts`), limitToLast(1));

    const unsub = onValue(alertsRef, async (snapshot) => {
  if (!snapshot.exists()) return;

  const dataMap = snapshot.val();
  // Get the IDs and pick the very last one (the most recent)
  const alertIds = Object.keys(dataMap);
  const alertId = alertIds[alertIds.length - 1]; 
  const data = dataMap[alertId];

  if (data && data.seen === false) {
        const alert: SOSAlert = {
          id: alertId,
          message: data.message || 'SOS! The wearer needs help!',
          location: data.location,
          timestamp: data.timestamp,
          seen: false,
        };

        setActiveAlert(alert);

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

  const dismissAlert = async () => {
    if (!activeAlert || !userId) return;
    try {
      // Update RTDB path
      await update(ref(rtdb, `users/${userId}/alerts/${activeAlert.id}`), {
        seen: true,
      });
    } catch (e) {
      console.error('Failed to dismiss alert:', e);
    }
    setActiveAlert(null);
  };

  return { activeAlert, dismissAlert };
}