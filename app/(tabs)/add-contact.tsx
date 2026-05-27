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
  View,
  useColorScheme
} from 'react-native';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/authContext';

// Relationship Options
const RELATIONS = ['Parent', 'Sibling', 'Spouse', 'Friend', 'Other'];

export default function AddContactScreen() {
  const { user } = useAuth();
  const router = useRouter();

  
  // SMART THEME: Automatically follows system settings
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState(''); // Stores the chosen pill
  const [otherRelation, setOtherRelation] = useState(''); // Stores custom input
  const [loading, setLoading] = useState(false);

  // DYNAMIC THEME TOKENS
  const theme = {
    background: isDark ? '#000000' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#111',
    inputBg: isDark ? '#111' : '#F9F9F9',
    border: isDark ? '#222' : '#E5E5E5',
    brandGold: '#D0A97E',
  };

  const handleSave = async () => {
    // Determine the final value to save
    const finalRelationship = relationship === 'Other' ? otherRelation : relationship;

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

        {/* RELATIONSHIP CHOICES */}
        <Text style={[styles.label, { color: theme.text, marginTop: 20 }]}>RELATIONSHIP</Text>
        <View style={styles.pillContainer}>
          {RELATIONS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.pill,
                { borderColor: theme.border },
                relationship === item && { backgroundColor: theme.brandGold, borderColor: theme.brandGold }
              ]}
              onPress={() => setRelationship(item)}
            >
              <Text style={[
                styles.pillText,
                { color: theme.text },
                relationship === item && { color: '#fff' }
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
  form: { paddingHorizontal: 20, paddingBottom: 40 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  input: { height: 56, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
  });