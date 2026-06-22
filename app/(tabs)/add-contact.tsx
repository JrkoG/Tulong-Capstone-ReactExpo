import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/authContext';

const RELATIONSHIP_OPTIONS = ['Parent', 'Sibling', 'Spouse', 'Friend', 'Hotline', 'Other'];

export default function AddContactScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // SMART THEME: Automatically follows system settings
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';

  // DYNAMIC THEME TOKENS
  const theme = {
    background: isDark ? '#000000' : '#f8f9fa',
    cardBackground: isDark ? '#121212' : '#ffffff',
    textPrimary: isDark ? '#ffffff' : '#111111',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    brandGold: '#D0A97E',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
    inputPlaceholder: isDark ? '#4b5563' : '#9ca3af',
  };

  // Input states
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [relationship, setRelationship] = useState<string | null>(null);
  const [otherRelation, setOtherRelation] = useState(''); // Custom value when "Other" is picked
  const [loading, setLoading] = useState(false);

  // Light real-time filter — blocks only newlines/tabs. Letters are now
  // allowed through (unlike the old digit-only filter) because hotline
  // listings legitimately contain words like "to", "local", and labels
  // such as "(Text Hotline)" — the extraction logic below makes sense of
  // it at save time instead of blocking it at the keystroke level.
  const handlePhoneChange = (text: string) => {
    setPhoneNumber(text.replace(/[\n\t]/g, ''));
  };

  // Extracts ONE dialable number from messy hotline-style text, stripping
  // labels like "(Text Hotline)" or "(DSWD)", range markers like "to 65",
  // and local extensions like "local 100". Preserves area codes in
  // parentheses, e.g. "(02)". Falls back to the destination short code for
  // "Text XXXXX to YYYY" style SMS instructions (the short code is usually
  // still dialable even though the listing says "Text").
  // Examples:
  //   "(02) 8911-5061 to 65 local 100"  → "0289115061"
  //   "0918-912-2813 (Text Hotline)"     → "09189122813"
  //   "Text LTOHELP to 2600"             → "2600"
  //   "911"                              → "911"
  const extractDialableNumber = (raw: string): string | null => {
    const textToMatch = raw.match(/text\s+\w+\s+to\s+(\d+)/i);
    if (textToMatch) return textToMatch[1];

    let cleaned = raw.replace(/\((?!0\d{1,3}\))[^)]*\)/g, ''); // strip non-area-code parens
    cleaned = cleaned.split(/\bto\b/i)[0];
    cleaned = cleaned.split(/\blocal\b/i)[0];

    const digits = cleaned.replace(/[^0-9+]/g, '');
    return digits.length >= 3 ? digits : null;
  };

  // Splits on commas/semicolons so one entry can hold several lines
  // (e.g. an agency with 5 separate hotline numbers), extracting a
  // dialable number from each segment.
  const extractAllDialableNumbers = (raw: string): string[] => {
    return raw
      .split(/[,;]/)
      .map((seg) => extractDialableNumber(seg))
      .filter((n): n is string => n !== null);
  };

  // HARD gate — fails only if literally no dialable number could be found
  // anywhere in the text. This now accepts short codes (911, 117, 1627),
  // landlines, mobiles, and multi-number/labelled hotline listings.
  const isValidPhoneNumber = (phone: string): boolean => {
    return extractAllDialableNumbers(phone).length > 0;
  };

  // SOFT gate — checks a single cleaned number against common Philippine
  // formats: mobile (09XXXXXXXXX), landline with area code (0X XXX XXXX),
  // or a short code (3–5 digits, e.g. 911, 1627). Anything else is treated
  // as possibly international and triggers a confirmation prompt instead
  // of a hard block.
  const isValidPHNumber = (cleanedNumber: string): boolean => {
    return (
      /^(09\d{9}|(\+63|63)9\d{9})$/.test(cleanedNumber) || // mobile
      /^0\d{1,3}\d{6,8}$/.test(cleanedNumber) ||           // landline w/ area code
      /^\d{3,5}$/.test(cleanedNumber)                       // short code
    );
  };

  // Actually writes the contact to Firestore — separated out so it can be
  // called either immediately (PH format matched) or after the user
  // confirms "Save Anyway" on the non-PH format warning.
  const saveContactToFirestore = async (finalRelationship: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'users', user.id, 'contacts'), {
        name: fullName,
        phone: phoneNumber, // original text, kept for display (preserves "to 65 local 100" etc.)
        dialNumbers: extractAllDialableNumbers(phoneNumber), // cleaned numbers the call button actually dials
        relationship: finalRelationship,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Contact saved successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error('Save contact error:', e);
      Alert.alert('Error', 'Could not save contact. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = () => {
    const finalRelationship =
      relationship === 'Other' ? otherRelation.trim() : relationship;

    if (!fullName || !phoneNumber || !finalRelationship) {
      Alert.alert(
        'Missing Fields',
        'Please populate all fields and select a relationship type.',
      );
      return;
    }
    if (!isValidPhoneNumber(phoneNumber)) {
      Alert.alert(
        'Invalid Phone Number',
        "Couldn't find a dialable number in this entry. Try a format like 0917 123 4567, (02) 8911-1406, or 911.",
      );
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }

    // Soft warning — only blocks if the user doesn't confirm. International
    // numbers (e.g. a relative working abroad) are still allowed through.
    // Passes if AT LEAST ONE extracted number matches a PH format (mobile,
    // landline, or short code) — covers multi-number hotline listings where
    // not every segment needs to match.
    const extracted = extractAllDialableNumbers(phoneNumber);
    const hasPHMatch = extracted.some(isValidPHNumber);

    if (!hasPHMatch) {
      Alert.alert(
        'Unusual Number Format',
        "This doesn't look like a Philippine number or hotline code (e.g. 0917 123 4567, (02) 8911-1406, or 911). If this is an international contact, you can save it anyway.",
        [
          { text: 'Edit Number', style: 'cancel' },
          {
            text: 'Save Anyway',
            onPress: () => saveContactToFirestore(finalRelationship!),
          },
        ],
      );
      return;
    }

    saveContactToFirestore(finalRelationship!);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Tabs.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ─── CUSTOM HEADER ─── */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Add Contact
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* FULL NAME INPUT */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
              FULL NAME
            </Text>
            <TextInput
              style={[
                styles.inputField,
                {
                  backgroundColor: theme.cardBackground,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                },
              ]}
              placeholder="e.g. John Doe"
              placeholderTextColor={theme.inputPlaceholder}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          {/* PHONE NUMBER INPUT */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
              PHONE NUMBER
            </Text>
            <Text style={[styles.inputHint, { color: theme.textSecondary }]}>
              Personal number, landline, or hotline (e.g. 911, (02) 8911-1406)
            </Text>
            <TextInput
              style={[
                styles.inputField,
                {
                  backgroundColor: theme.cardBackground,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                },
              ]}
              placeholder="0912 345 6789"
              placeholderTextColor={theme.inputPlaceholder}
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              keyboardType="default"
            />
          </View>

          {/* RELATIONSHIP CHIP SELECTOR */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
              RELATIONSHIP
            </Text>
            <View style={styles.chipsContainer}>
              {RELATIONSHIP_OPTIONS.map((option) => {
                const isSelected = relationship === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? theme.brandGold : 'transparent',
                        borderColor: isSelected ? theme.brandGold : theme.border,
                      },
                    ]}
                    onPress={() => setRelationship(option)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? '#000000' : theme.textPrimary },
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* CONDITIONAL "OTHER" INPUT */}
          {relationship === 'Other' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                PLEASE SPECIFY
              </Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: theme.cardBackground,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="e.g. Cousin"
                placeholderTextColor={theme.inputPlaceholder}
                value={otherRelation}
                onChangeText={setOtherRelation}
                autoFocus
              />
            </View>
          )}

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: theme.brandGold },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleSaveContact}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.saveButtonText}>Save Contact</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    paddingBottom: 16,
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  inputGroup: { marginBottom: 24 },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  inputHint: {
    fontSize: 11,
    marginTop: -4,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  inputField: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  saveButton: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  saveButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
});