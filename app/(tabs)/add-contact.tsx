import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';

export default function AddContactScreen() {
  const router = useRouter();
<<<<<<< HEAD
=======

>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a
  
  // SMART THEME: Automatically follows system settings
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
<<<<<<< HEAD
=======

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState(''); // Stores the chosen pill
  const [otherRelation, setOtherRelation] = useState(''); // Stores custom input
  const [loading, setLoading] = useState(false);
>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a

  // DYNAMIC THEME TOKENS
  const theme = {
    background: isDark ? '#000000' : '#f8f9fa',
    cardBackground: isDark ? '#121212' : '#ffffff',
    textPrimary: isDark ? '#ffffff' : '#111111',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    brandGold: '#D0A97E',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
    inputPlaceholder: isDark ? '#4b5563' : '#9ca3af'
  };

  // Input states
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [relationship, setRelationship] = useState<string | null>(null);

<<<<<<< HEAD
  const relationshipOptions = ['Parent', 'Sibling', 'Spouse', 'Friend', 'Other'];

  const handleSaveContact = () => {
    if (!fullName || !phoneNumber || !relationship) {
      Alert.alert("Missing Fields", "Please populate all fields and select a relationship type.");
      return;
    }
    
    Alert.alert("Success", "Contact saved successfully!", [
      { text: "OK", onPress: () => router.push('/(tabs)/dashboard') }
    ]);
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
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Add Contact</Text>
=======
     if (!name || !phone || !finalRelationship) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

     if (!user?.id) {
      Alert.alert('Error', 'User not authenticated'); 
      return;
    }

  const relationshipOptions = ['Parent', 'Sibling', 'Spouse', 'Friend', 'Other'];

  setLoading(true);
    try {
      await addDoc(collection(db, 'users', user.id, 'contacts'), {
        name,
        phone,
        relationship: finalRelationship,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Contact added successfully');
      router.back();
    } catch (e) {
      console.error("Save contact error:", e);
      Alert.alert('Error', 'Could not save contact.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Add Contact</Text>
>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* FULL NAME INPUT */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>FULL NAME</Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: theme.cardBackground, color: theme.textPrimary, borderColor: theme.border }]}
            placeholderTextColor={theme.inputPlaceholder}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
        </View>

<<<<<<< HEAD
        {/* PHONE NUMBER INPUT */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>PHONE NUMBER</Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: theme.cardBackground, color: theme.textPrimary, borderColor: theme.border }]}
            placeholderTextColor={theme.inputPlaceholder}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
        </View>

        {/* RELATIONSHIP CHIP SELECTOR */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>RELATIONSHIP</Text>
          <View style={styles.chipsContainer}>
            {relationshipOptions.map((option) => {
              const isSelected = relationship === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.chip,
                    { 
                      backgroundColor: isSelected ? theme.brandGold : 'transparent',
                      borderColor: isSelected ? theme.brandGold : theme.border
                    }
                  ]}
                  onPress={() => setRelationship(option)}
                  activeOpacity={0.8}
                >
                  <Text 
                    style={[
                      styles.chipText, 
                      { color: isSelected ? '#000000' : theme.textPrimary }
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.brandGold }]}
          onPress={handleSaveContact}
          activeOpacity={0.8}
=======
        {/* CONDITIONAL "OTHER" INPUT */}
        {relationship === 'Other' && (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.label, { color: theme.text }]}>PLEASE SPECIFY</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
              value={otherRelation}
              onChangeText={setOtherRelation}
              placeholder="e.g. Cousin"
              placeholderTextColor="#666"
              autoFocus
            /> 
      </View>
      )}

        <TouchableOpacity 
          style={[styles.saveBtn, { backgroundColor: theme.brandGold }]} 
          onPress={handleSave}
          disabled={loading}

>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a
        >
          <Text style={styles.saveButtonText}>Save Contact</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
<<<<<<< HEAD
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    flex: 1,
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
=======
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 16, marginBottom: 30 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 4 },
  form: { paddingHorizontal: 20, paddingBottom: 40 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  input: { height: 56, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
  });
>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a
