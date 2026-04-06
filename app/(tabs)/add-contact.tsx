import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
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

  // Smart Theme Configuration 
  const theme = {
    background: isDark ? '#000000' : '#FFFFFF', 
    text: isDark ? '#FFFFFF' : '#1C1C1E',
    inputBg: isDark ? '#16161e' : '#F9F9F9',
    border: isDark ? '#333333' : 'rgba(0,0,0,0.1)',
    placeholder: isDark ? '#666666' : '#A0A0A5',
    buttonBg: isDark ? '#FFFFFF' : '#000000', 
    buttonText: isDark ? '#000000' : '#FFFFFF', 
    brandGold: '#D0A97E',
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
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
            <Text style={[styles.backText, { color: theme.text }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Add Contact</Text>
          <View style={{ width: 80 }} /> 
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: theme.text }]}>FULL NAME</Text>
          <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <TextInput
              style={[styles.typingInput, { color: theme.text }]}
              placeholder="" 
              value={name}
              onChangeText={setName}
              placeholderTextColor={theme.placeholder}
            />
          </View>

          <Text style={[styles.label, { color: theme.text, marginTop: 24 }]}>PHONE NUMBER</Text>
          <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <TextInput
              style={[styles.typingInput, { color: theme.text }]}
              placeholder="" 
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              placeholderTextColor={theme.placeholder}
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
                  relationship === item && { backgroundColor: theme.buttonBg, borderColor: theme.buttonBg }
                ]}
              >
                <Text style={[
                  styles.chipText, 
                  { color: theme.placeholder },
                  relationship === item && { color: theme.buttonText }
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: theme.buttonBg, opacity: loading ? 0.7 : 1 }]} 
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>
              {loading ? 'Saving...' : 'Save Contact'}
            </Text>
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20, 
    paddingBottom: 25,
    alignItems: 'center',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  backText: { fontSize: 16, fontWeight: '600', marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
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
  typingInput: { 
    flex: 1, 
    fontSize: 17, 
    fontWeight: '500', 
    letterSpacing: 0.5 
  },
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
    borderRadius: 12, 
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 10, 
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  saveButton: {
    height: 56,
    borderRadius: 12, 
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { fontSize: 16, fontWeight: '700' },
});