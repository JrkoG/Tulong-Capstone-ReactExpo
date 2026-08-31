import { useAudioPlayer } from 'expo-audio';
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

const soundSource = require('../assets/sounds/care_alert_ringtone.wav');

export default function SOSModal({ visible, message, location, timestamp, onDismiss }: Props) {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const player = useAudioPlayer(soundSource);

  useEffect(() => {
    if (visible) {
      Vibration.vibrate([0, 500, 200, 500], true);
      player.loop = true;
      player.play();

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
      player.pause();
      player.seekTo(0);
      fadeAnim.setValue(0);
      slideAnim.setValue(60);
    }

    return () => {
      Vibration.cancel();
      player.pause();
    };
  }, [visible]);

  const handleOkayPress = () => {
    player.pause();
    player.seekTo(0);
    Vibration.cancel(); 
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
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🚨</Text>
          </View>
          
          <Text style={styles.title}>SOS ALERT</Text>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.locationContainer}>
            <Text style={styles.locationTitle}>📍 {"Wearer's"} Location Coordinates:</Text>
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
            <Text style={styles.okayBtnText}>Dismiss & Track Location</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#1c1c1e', width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#f87171' },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(248,113,113,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  icon: { fontSize: 40 },
  title: { color: '#f87171', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  message: { color: '#fff', textAlign: 'center', fontSize: 16, marginBottom: 12 },
  locationContainer: { backgroundColor: 'rgba(255,255,255,0.05)', width: '100%', padding: 12, borderRadius: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  locationTitle: { color: '#D0A97E', fontSize: 12, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  locationText: { color: '#fff', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '500' },
  timestampText: { color: '#ef4444', fontSize: 13, fontWeight: '600', marginBottom: 20, backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
  okayBtn: { backgroundColor: '#D0A97E', width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  okayBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});