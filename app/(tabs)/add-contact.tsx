import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/authContext';

export default function AddContactScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [relationship, setRelationship] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const [nameFocused, setNameFocused]         = useState(false);
  const [phoneFocused, setPhoneFocused]       = useState(false);
  const [relFocused, setRelFocused]           = useState(false);

  const handleSave = async () => {
    console.log('handleSave called'); // ← add this as very first line
    console.log('user:', user);
    setError('');

    // Validation
    if (!name.trim()) {
      console.log('name failed');
      setError('Please enter a name.');
      return;
    }
    if (!phone.trim()) {
      console.log('phone failed');
      setError('Please enter a phone number.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      console.log('phone length failed:', phone.replace(/\D/g, '').length);
      setError('Please enter a valid phone number.');
      return;
    }

    console.log('passed validation, saving...');

    try {
      setLoading(true);

      // Check if already at 3 contacts
      const existing = await getDocs(collection(db, 'users', user!.id, 'contacts'));
      if (existing.size >= 3) {
        setError('You can only add up to 3 emergency contacts.');
        setLoading(false);
        return;
      }

      // Save to Firestore
      await addDoc(collection(db, 'users', user!.id, 'contacts'), {
        name: name.trim(),
        phone: phone.trim(),
        relationship: relationship.trim() || 'Contact',
        userId: user!.id,
      });

      Alert.alert(
        'Contact Added',
        `${name} has been added as an emergency contact.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      setError('Failed to save contact. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Add Contact</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Emergency contacts will be notified when an SOS alert is triggered. You can add up to 3 contacts.
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.form}>

          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={[styles.inputWrapper, nameFocused && styles.inputWrapperFocused]}>
              <Text style={[styles.inputIcon, nameFocused && styles.inputIconFocused]}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Juan dela Cruz"
                placeholderTextColor="rgba(255,255,255,0.2)"
                autoCapitalize="words"
                autoCorrect={false}
                value={name}
                onChangeText={setName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={[styles.inputWrapper, phoneFocused && styles.inputWrapperFocused]}>
              <Text style={[styles.inputIcon, phoneFocused && styles.inputIconFocused]}>📞</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 09171234567"
                placeholderTextColor="rgba(255,255,255,0.2)"
                keyboardType="phone-pad"
                autoCorrect={false}
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
              />
            </View>
          </View>

          {/* Relationship */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Relationship <Text style={styles.optional}>(optional)</Text></Text>
            <View style={[styles.inputWrapper, relFocused && styles.inputWrapperFocused]}>
              <Text style={[styles.inputIcon, relFocused && styles.inputIconFocused]}>🤝</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mother, Friend, Sibling"
                placeholderTextColor="rgba(255,255,255,0.2)"
                autoCapitalize="words"
                autoCorrect={false}
                value={relationship}
                onChangeText={setRelationship}
                onFocus={() => setRelFocused(true)}
                onBlur={() => setRelFocused(false)}
              />
            </View>
          </View>

          {/* Quick relationship pills */}
          <View style={styles.pillRow}>
            {['Mother', 'Father', 'Sibling', 'Friend', 'Partner'].map((rel) => (
              <TouchableOpacity
                key={rel}
                style={[styles.pill, relationship === rel && styles.pillActive]}
                onPress={() => setRelationship(rel)}
              >
                <Text style={[styles.pillText, relationship === rel && styles.pillTextActive]}>
                  {rel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Contact</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d14',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 60,
  },
  backText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  topBarTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  content: {
    padding: 20,
    gap: 16,
     paddingBottom: 60,
  },
  infoBanner: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    borderRadius: 12,
    padding: 14,
  },
  infoBannerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  optional: {
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  inputWrapperFocused: {
    borderColor: 'rgba(99,102,241,0.5)',
    backgroundColor: 'rgba(99,102,241,0.07)',
  },
  inputIcon: {
    paddingLeft: 16,
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
  },
  inputIconFocused: {
    color: '#6366f1',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 15, android: 12 }),
    fontSize: 15,
    color: '#ffffff',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillActive: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderColor: 'rgba(99,102,241,0.5)',
  },
  pillText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  pillTextActive: {
    color: '#6366f1',
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});