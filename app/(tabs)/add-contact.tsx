import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router'; // Added Stack
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/authContext';

export default function AddContactScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [loading, setLoading] = useState(false);

  const relationships = ['Mother', 'Father', 'Sibling', 'Friend', 'Partner'];

  const theme = {
    background: isDark ? '#0d0d14' : '#F2F2F7',
    text: isDark ? '#FFFFFF' : '#1C1C1E',
    inputBg: isDark ? '#16161e' : '#FFFFFF',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    placeholder: isDark ? '#555' : '#A0A0A5',
    infoBox: isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF',
    infoText: isDark ? '#a5a6f6' : '#4338ca',
  };

  const handleSave = async () => {
    if (!name || !phone || !relationship) {
      Alert.alert("Missing Info", "Please provide a name, number, and select a relationship.");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'users', user!.id, 'contacts'), {
        name: name.trim(),
        phone: phone.trim(),
        relationship,
        createdAt: serverTimestamp(),
      });
      router.back();
    } catch (e) {
      Alert.alert("Error", "Failed to save contact.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* THIS SECTION REMOVES THE TOP TEXT */}
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#6366f1" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Add Contact</Text>
          <View style={{ width: 80 }} /> 
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.infoBox }]}>
          <Text style={[styles.infoText, { color: theme.infoText }]}>
            Emergency contacts will be notified when an SOS alert is triggered. You can add up to 3 contacts.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: theme.text }]}>FULL NAME</Text>
          <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <Ionicons name="person" size={18} color={theme.placeholder} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="" 
              value={name}
              onChangeText={setName}
            />
          </View>

          <Text style={[styles.label, { color: theme.text, marginTop: 24 }]}>PHONE NUMBER</Text>
          <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <Ionicons name="call" size={18} color={theme.placeholder} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="" 
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <Text style={[styles.label, { color: theme.text, marginTop: 24 }]}>RELATIONSHIP</Text>
          <View style={styles.chipContainer}>
            {relationships.map((item) => (
              <TouchableOpacity 
                key={item} 
                onPress={() => setRelationship(item)}
                style={[
                  styles.chip, 
                  { borderColor: theme.border, backgroundColor: theme.inputBg },
                  relationship === item && styles.activeChip
                ]}
              >
                <Text style={[
                  styles.chipText, 
                  { color: theme.placeholder },
                  relationship === item && styles.activeChipText
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, { opacity: loading ? 0.7 : 1 }]} 
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Contact'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20, 
    paddingBottom: 15,
    alignItems: 'center',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  backText: { color: '#6366f1', fontSize: 16, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  infoBox: { margin: 20, padding: 16, borderRadius: 12 },
  infoText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  form: { paddingHorizontal: 20 },
  label: { fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 1 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15 },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', 
    justifyContent: 'flex-start',
    marginTop: 8,
    marginBottom: 30,
    marginHorizontal: -4, 
  },
  chip: { 
    width: '30.5%', 
    marginHorizontal: '1.4%', 
    paddingVertical: 14, 
    borderRadius: 20, 
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 10, 
  },
  activeChip: { 
    backgroundColor: 'rgba(99,102,241,0.1)', 
    borderColor: '#6366f1' 
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  activeChipText: { color: '#6366f1' },
  saveButton: {
    backgroundColor: '#6366f1',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});