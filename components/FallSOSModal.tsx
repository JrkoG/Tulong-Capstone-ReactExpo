import {
  AndroidNotificationPriority,
  dismissAllNotificationsAsync,
  scheduleNotificationAsync,
} from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  message: string;
  location?: { latitude: number; longitude: number };
  timestamp: any;
  onDismiss: () => void;
};

export default function FallSOSModal({ visible, message, location, timestamp, onDismiss }: Props) {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    const triggerAlarmSound = async () => {
      try {
        await scheduleNotificationAsync({
          content: {
            title: '⚠️ FALL DETECTED',
            body: message,
            sound: Platform.OS === 'android' ? 'care_alert_ringtone' : 'care_alert_ringtone.wav',
            ...(Platform.OS === 'android' && {
              priority: AndroidNotificationPriority.MAX,
              channelId: 'emergency_alerts',
            }),
          },
          trigger: null,
        });
      } catch (e) {
        console.log('Notification trigger error:', e);
      }
    };

    if (visible) {
      Vibration.vibrate([0, 400, 150, 400], true);
      triggerAlarmSound();

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(1)),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Vibration.cancel();
      dismissAllNotificationsAsync();
      fadeAnim.setValue(0);
      slideAnim.setValue(60);
    }

    return () => {
      Vibration.cancel();
      dismissAllNotificationsAsync();
    };
  }, [visible, fadeAnim, slideAnim, message]);

  const handleOkayPress = async () => {
    Vibration.cancel();
    await dismissAllNotificationsAsync();
    onDismiss();
    router.push('/dashboard');
  };

  const formatTime = (ts: any) => {
    if (!ts) return 'Just now';
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>⚠️</Text>
          </View>

          <Text style={styles.title}>FALL DETECTED</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.locationContainer}>
            <Text style={styles.locationTitle}>📍 Fall Coordinates:</Text>
            <Text style={styles.locationText}>
              Lat: {location?.latitude ? location.latitude.toFixed(6) : 'Unknown'}
            </Text>
            <Text style={styles.locationText}>
              Lng: {location?.longitude ? location.longitude.toFixed(6) : 'Unknown'}
            </Text>
          </View>

          <Text style={styles.timestampText}>Time: {formatTime(timestamp)}</Text>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.okayBtn}
            onPress={handleOkayPress}
            activeOpacity={0.85}
          >
            <Text style={styles.okayBtnText}>Dismiss & Check Wearer</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#1c1c1e', width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: '#f59e0b' },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(245,158,11,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  icon: { fontSize: 40 },
  title: { color: '#f59e0b', fontSize: 24, fontWeight: '900', marginBottom: 8, letterSpacing: 0.5 },
  message: { color: '#fff', textAlign: 'center', fontSize: 16, marginBottom: 12 },
  locationContainer: { backgroundColor: 'rgba(255,255,255,0.05)', width: '100%', padding: 12, borderRadius: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  locationTitle: { color: '#D0A97E', fontSize: 12, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  locationText: { color: '#fff', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '500' },
  timestampText: { color: '#f59e0b', fontSize: 13, fontWeight: '600', marginBottom: 20, backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
  okayBtn: { backgroundColor: '#f59e0b', width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  okayBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
});