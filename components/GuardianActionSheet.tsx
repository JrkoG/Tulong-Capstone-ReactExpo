import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type Status = 'responded' | 'on_the_way' | 'arrived' | 'aided';

type Props = {
  visible: boolean;
  responding: boolean;
  onSelect: (status: Status) => void;
  onClose: () => void;
};

const ACTIONS: { status: Status; icon: string; label: string; sub: string; color: string; bg: string }[] = [
  {
    status: 'responded',
    icon: '👋',
    label: 'I have responded',
    sub: 'Let others know you saw the alert',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
  },
  {
    status: 'on_the_way',
    icon: '🚗',
    label: 'I am on the way',
    sub: 'Heading to the wearer now',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.1)',
  },
  {
    status: 'arrived',
    icon: '📍',
    label: 'I have arrived',
    sub: 'At the wearer\'s location',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
  },
  {
    status: 'aided',
    icon: '✅',
    label: 'Wearer has been aided',
    sub: 'Situation is under control',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.1)',
  },
];

export default function GuardianActionSheet({ visible, responding, onSelect, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          <Text style={styles.title}>Update your status</Text>
          <Text style={styles.subtitle}>
            Let other guardians know what you are doing
          </Text>

          <View style={styles.actions}>
            {ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.status}
                style={[styles.actionBtn, { backgroundColor: action.bg, borderColor: action.color + '44' }]}
                onPress={() => onSelect(action.status)}
                disabled={responding}
                activeOpacity={0.8}
              >
                <Text style={styles.actionIcon}>{action.icon}</Text>
                <View style={styles.actionText}>
                  <Text style={[styles.actionLabel, { color: action.color }]}>
                    {action.label}
                  </Text>
                  <Text style={styles.actionSub}>{action.sub}</Text>
                </View>
                {responding && (
                  <ActivityIndicator size="small" color={action.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#13131f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  actions: { gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionIcon: { fontSize: 24 },
  actionText: { flex: 1 },
  actionLabel: { fontSize: 14, fontWeight: '700' },
  actionSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  cancelBtn: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
  },
  cancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
});