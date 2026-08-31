import {
  AndroidNotificationPriority,
  scheduleNotificationAsync
} from 'expo-notifications';
import { limitToLast, onValue, query, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { rtdb } from '../config/firebase';

type SOSAlert = {
  id: string;
  message: string;
  location?: { latitude: number; longitude: number };
  timestamp: any;
  seen: boolean;
};

export function useAlertListener(userId: string | undefined, groupId: string | null) {
  const [activeAlert, setActiveAlert] = useState<SOSAlert | null>(null);

  useEffect(() => {
    if (!userId || !groupId) return;

    // Listen to the active group's alerts node
    const alertsRef = query(ref(rtdb, `groups/${groupId}/alerts`), limitToLast(1));

    const unsub = onValue(alertsRef, async (snapshot) => {
      if (!snapshot.exists()) return;

      const dataMap = snapshot.val();
      const alertIds = Object.keys(dataMap);
      const alertId = alertIds[alertIds.length - 1]; 
      const data = dataMap[alertId];

      // Ignore if triggered by the current user or already resolved
      if (data && data.triggeredBy !== userId && data.status !== "resolved" && data.status !== "aided") {
        const alert: SOSAlert = {
          id: alertId,
          message: data.message || 'SOS! Emergency alert triggered!',
          location: data.latitude && data.longitude ? { latitude: data.latitude, longitude: data.longitude } : undefined,
          timestamp: data.timestamp || Date.now(),
          seen: false,
        };

        setActiveAlert(alert);

        // Fire local push notification to device tray
        await scheduleNotificationAsync({
          content: {
            title: '🚨 EMERGENCY ALERT DETECTED',
            body: alert.message,
            sound: 'care_alert_ringtone.wav', // Required with extension for iOS/fallback
            ...(Platform.OS === 'android' && {
              priority: AndroidNotificationPriority.MAX,
            }),
          },
          trigger: null,
          ...(Platform.OS === 'android' && { channelId: 'emergency_alerts' }),
        });
      }
    });

    return () => unsub();
  }, [userId, groupId]);

  const dismissAlert = () => {
    setActiveAlert(null);
  };

  return { activeAlert, dismissAlert };
}