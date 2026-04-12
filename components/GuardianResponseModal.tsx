import { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type Props = {
  visible: boolean;
  guardianName: string;
  status: 'responded' | 'on_the_way' | 'arrived' | 'aided';
  message: string;
  timestamp: any;
  onDismiss: () => void;
};

const STATUS_CONFIG = {
  responded:  { icon: '👋', label: 'Responded',     color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
  on_the_way: { icon: '🚗', label: 'On The Way',    color: '#fb923c', bg: 'rgba(251,146,60,0.1)'  },
  arrived:    { icon: '📍', label: 'Arrived',        color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
  aided:      { icon: '✅', label: 'Wearer Aided',   color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
};

export default function GuardianResponseModal({
  visible,
  guardianName,
  status,
  message,
  timestamp,
  onDismiss,
}: Props) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.responded;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(60);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.card,
            {
              borderColor: config.color + '55',
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: config.bg }]}>
            <Text style={styles.icon}>{config.icon}</Text>
          </View>

          {/* Status label */}
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <Text style={[styles.statusLabel, { color: config.color }]}>
              {config.label}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Guardian Update</Text>
          <Text style={styles.subtitle}>{message}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Info rows */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Guardian</Text>
            <Text style={styles.infoValue}>{guardianName}</Text>
          </View>

          {timestamp && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>{formatTime(timestamp)}</Text>
            </View>
          )}

          {/* Okay button */}
          <TouchableOpacity
            style={[styles.okayBtn, { backgroundColor: config.color }]}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={styles.okayBtnText}>Okay</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#13131f',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: { fontSize: 32 },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 4,
  },
  infoRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '500',
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  okayBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  okayBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});