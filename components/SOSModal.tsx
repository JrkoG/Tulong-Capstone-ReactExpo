import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react'; // Added useEffect
import {
  Animated,
  Easing,
  Modal,
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

export default function SOSModal({ visible, message, location, timestamp, onDismiss }: Props) {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  // 🔥 FIX 1: Add the Animation Trigger
  useEffect(() => {
    if (visible) {
      // Vibrate to alert user
      Vibration.vibrate([0, 500, 200, 500]);

      // Start the "Fade In" and "Slide Up" animation
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
      // Reset values when modal is closed
      fadeAnim.setValue(0);
      slideAnim.setValue(60);
    }
  }, [visible]);

  const handleOkayPress = () => {
    onDismiss(); 
    router.push('/tracker'); 
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlay}>
        {/* 🔥 FIX 2: Apply the animations to the View */}
        <Animated.View 
          style={[
            styles.modalCard,
            { 
              opacity: fadeAnim, // This makes it visible
              transform: [{ translateY: slideAnim }] // This makes it slide up
            }
          ]}
        >
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🚨</Text>
          </View>
          
          <Text style={styles.title}>SOS ALERT</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.okayBtn}
            onPress={handleOkayPress}
            activeOpacity={0.85}
          >
            <Text style={styles.okayBtnText}>Okay</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1c1c1e',
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f87171',
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(248,113,113,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16
  },
  icon: { fontSize: 40 },
  title: { color: '#f87171', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  message: { color: '#fff', textAlign: 'center', fontSize: 16, marginBottom: 20 },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
  okayBtn: {
    backgroundColor: '#D0A97E',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  okayBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});