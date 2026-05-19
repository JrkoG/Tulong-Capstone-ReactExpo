import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import QuickBar from '../../components/QuickBar';
import { auth } from '../../config/firebase';

export default function DashboardScreen() {
  const router = useRouter();
  
  // SMART THEME: Automatically follows system settings (Light/Dark)
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';

  // THEME COLORS
  const theme = {
    background: isDark ? '#000000' : '#f8f9fa',
    cardBackground: isDark ? '#121212' : '#ffffff',
    textPrimary: isDark ? '#ffffff' : '#111111',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    brandGold: '#D0A97E',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    danger: '#ef4444',
  };

  const handleLogoutPress = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out of Tulong App?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: async () => {
            try {
              await auth.signOut();
            } catch (error) {
              Alert.alert("Error", "Failed to log out cleanly.");
            }
          } 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Tabs.Screen options={{ headerShown: false }} />
      
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* ─── HEADER ROW ─── */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Dashboard</Text>
        
        <View style={styles.headerActions}>
          {/* Logout Icon */}
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={handleLogoutPress}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={26} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollPaddingBottom}
        showsVerticalScrollIndicator={false}
      >
        {/* WEARER HEALTH CARD */}
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>WEARER HEALTH</Text>
            <Text style={[styles.timeText, { color: theme.textSecondary }]}>Last synced: --</Text>
          </View>
          <View style={styles.healthStatsRow}>
            <View style={styles.statBox}>
              <Ionicons name="battery-dead" size={28} color={theme.danger} />
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>0%</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>BATTERY</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="cellular-outline" size={28} color={theme.textSecondary} />
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>Offline</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>SIGNAL</Text>
            </View>
          </View>
        </View>

        {/* LIVE TRACKING MAP CONTAINER */}
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Live Tracking</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/tracker')}>
              <Text style={{ color: theme.brandGold, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif' }}>Center</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.mapPlaceholder, { backgroundColor: isDark ? '#1a1a1a' : '#e5e7eb' }]}>
            <Text style={{ color: theme.textSecondary }}>Map Content Space</Text>
          </View>
        </View>

        {/* EMERGENCY CONTACTS */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Emergency Contacts</Text>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: 'rgba(208, 169, 126, 0.15)' }]} onPress={() => router.push('/(tabs)/add-contact')}>
            <Text style={{ color: theme.brandGold, fontWeight: '700' }}>+ Add</Text>
          </TouchableOpacity>
        </View>
        
        <View style={[styles.card, { backgroundColor: theme.cardBackground, padding: 16, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]}>
          <Text style={[styles.contactName, { color: theme.textPrimary }]}>luke</Text>
          <Text style={[styles.contactPhone, { color: theme.textSecondary }]}>9931802186</Text>
        </View>

        {/* GUARDIAN SUMMARY */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 16 }]}>Guardian Summary</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderLeftWidth: 4, borderLeftColor: '#22c55e', padding: 16, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]}>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]}>No recent guardian activity.</Text>
        </View>

        {/* RECENT ALERTS */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 16 }]}>Recent Alerts</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBackground, padding: 16, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]}>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]}>No historical alerts logged.</Text>
        </View>
      </ScrollView>

      <QuickBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
  },
  scrollPaddingBottom: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 140 : 120, 
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  timeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  healthStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statBox: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  mapPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  contactName: {
    fontSize: 16,   
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  contactPhone: {
    fontSize: 14,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  bodyText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
});