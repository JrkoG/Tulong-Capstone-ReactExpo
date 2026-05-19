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
    inputPlaceholder: isDark ? '#4b5563' : '#9ca3af'
  };

  // Input states
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [relationship, setRelationship] = useState<string | null>(null);

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
        >
          <Text style={styles.saveButtonText}>Save Contact</Text>
        </TouchableOpacity>

      </ScrollView>
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