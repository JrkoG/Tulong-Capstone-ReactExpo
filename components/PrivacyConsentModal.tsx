import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../config/firebase';

type Props = {
  visible: boolean;
  userId: string;
  onConsent: () => void;
};

export default function PrivacyConsentModal({ visible, userId, onConsent }: Props) {
  const [loading, setLoading]       = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(80);
      setScrolled(false);
    }
  }, [visible]);

  const handleConsent = async () => {
    try {
      setLoading(true);
      // Save consent to Firestore
      await setDoc(doc(db, 'users', userId, 'consent', 'privacy'), {
        consentGiven: true,
        consentDate: serverTimestamp(),
        userId: userId,
        version: '1.0',
        platform: Platform.OS,
      });
      onConsent();
    } catch (e) {
      console.error('Failed to save consent:', e);
      // Still proceed even if save fails
      onConsent();
    } finally {
      setLoading(false);
    }
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
          style={[styles.card, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>🔒</Text>
            </View>
            <Text style={styles.title}>Data Privacy Notice</Text>
            <Text style={styles.subtitle}>
              Please read before using Tulong
            </Text>
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const isAtBottom =
                layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
              if (isAtBottom) setScrolled(true);
            }}
            scrollEventThrottle={16}
          >
            <Text style={styles.sectionTitle}>Republic Act No. 10173</Text>
            <Text style={styles.sectionSubtitle}>Data Privacy Act of 2012</Text>
            <Text style={styles.body}>
              In compliance with the Data Privacy Act of 2012 (RA 10173) of the Philippines,
              Tulong is committed to protecting and respecting your personal information.
              This notice explains how we collect, use, and store your data.
            </Text>

            <Text style={styles.sectionTitle}>What data we collect</Text>
            <View style={styles.bulletList}>
              {[
                'Full name and email address provided during registration',
                'Real-time GPS location of the app user and IoT wearable device',
                'Emergency contact information (name, phone number, relationship)',
                'SOS alert history including timestamps and location coordinates',
                'Device connection status and usage logs',
              ].map((item, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Why we collect it</Text>
            <View style={styles.bulletList}>
              {[
                'To provide emergency alert notifications to your designated contacts',
                'To track the real-time location of the wearer during emergencies',
                'To maintain a history of SOS events for safety review',
                'To ensure the wearable device is properly connected and functioning',
              ].map((item, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>How we store your data</Text>
            <Text style={styles.body}>
              Your data is stored securely using Google Firebase Firestore, a cloud-based
              database with industry-standard encryption. We do not sell, share, or
              disclose your personal information to third parties outside of the
              emergency contacts you designate.
            </Text>

            <Text style={styles.sectionTitle}>Your rights</Text>
            <Text style={styles.body}>
              Under RA 10173, you have the right to access, correct, and request deletion
              of your personal data at any time. You may also withdraw your consent by
              contacting the Tulong development team or by deleting your account.
            </Text>

            <Text style={styles.sectionTitle}>Data retention</Text>
            <Text style={styles.body}>
              Your data is retained for as long as your account is active. Alert history
              is kept for a maximum of 90 days. Upon account deletion, all personal data
              will be permanently removed from our systems within 30 days.
            </Text>

            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.body}>
              If you have questions or concerns about how your data is handled, please
              reach out to the Tulong development team through your institution.
            </Text>

            <View style={styles.scrollHint}>
              <Text style={styles.scrollHintText}>
                {scrolled ? '✓ You have read the full notice' : 'Scroll down to read the full notice'}
              </Text>
            </View>
          </ScrollView>

          {/* Consent button */}
          <View style={styles.footer}>
            <Text style={styles.consentNote}>
              By tapping "I Agree & Give Consent" you acknowledge that you have read,
              understood, and agreed to the collection and use of your data as described above.
            </Text>

            <TouchableOpacity
              style={[styles.consentBtn, !scrolled && styles.consentBtnDisabled]}
              onPress={handleConsent}
              disabled={loading || !scrolled}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.consentBtnText}>
                  {scrolled ? 'I Agree & Give Consent' : 'Scroll to read first'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#13131f',
    borderRadius: 24,
    width: '100%',
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99,102,241,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  scrollArea: {
    maxHeight: 380,
  },
  scrollContent: {
    padding: 20,
    gap: 10,
  },
  sectionTitle: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 6,
    marginTop: -6,
  },
  body: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    lineHeight: 20,
  },
  bulletList: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bullet: {
    color: '#6366f1',
    fontSize: 14,
    lineHeight: 20,
  },
  bulletText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  scrollHint: {
    marginTop: 16,
    padding: 10,
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderRadius: 8,
    alignItems: 'center',
  },
  scrollHintText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
  },
  footer: {
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  consentNote: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  consentBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  consentBtnDisabled: {
    backgroundColor: 'rgba(99,102,241,0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  consentBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});