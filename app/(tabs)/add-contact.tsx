import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
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
  const [loading, setLoading] = useState(false);

  const theme = {
    background: isDark ? '#000000' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#111',
    inputBg: isDark ? '#111' : '#F9F9F9',
    border: isDark ? '#222' : '#E5E5E5',
    brandGold: '#D0A97E',
  };

  const handleSave = async () => {
    if (!name || !phone) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);
    try {
      // Saves to /users/{uid}/contacts
      await addDoc(collection(db, 'users', user.id, 'contacts'), {
        name,
        phone,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Contact added successfully');
      router.back();
    } catch (e) {
      console.error("Save contact error:", e);
      Alert.alert('Error', 'Could not save contact. Check permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Add Contact</Text>
        <View style={{ width: 28 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <Text style={[styles.label, { color: theme.text }]}>FULL NAME</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. John Doe"
          placeholderTextColor="#666"
        />

        <Text style={[styles.label, { color: theme.text, marginTop: 20 }]}>PHONE NUMBER</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="0912 345 6789"
          placeholderTextColor="#666"
        />

        <TouchableOpacity 
          style={[styles.saveBtn, { backgroundColor: theme.brandGold }]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Contact</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 16, marginBottom: 30 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 4 },
  form: { paddingHorizontal: 20 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: { height: 56, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  saveBtn: { height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});