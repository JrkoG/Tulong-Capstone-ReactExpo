import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { onValue, ref } from "firebase/database";
import {
  collection,
  onSnapshot
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity, // Added ScrollView for the lists
  useColorScheme,
  View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import PrivacyConsentModal from '../../components/PrivacyConsentModal';
import SOSModal from '../../components/SOSModal';
import { db, rtdb } from '../../config/firebase';
import { useAuth } from '../../context/authContext';
import { useAlertListener } from '../../hooks/useAlertListener';

type Contact = { id: string; name: string; phone: string; };
type AlertLog = { id: string; message: string; timestamp: any; };
type DeviceLocation = { latitude: number; longitude: number; } | null;

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const { activeAlert, dismissAlert } = useAlertListener(user?.id);
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const mapRef = useRef<MapView>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const [userLocation, setUserLocation] = useState<DeviceLocation>(null);
  const [wearerLocation, setWearerLocation] = useState<DeviceLocation>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const theme = {
    background: isDark ? '#000' : '#fff',
    card: isDark ? '#111' : '#f9f9f9',
    text: isDark ? '#fff' : '#111',
    subText: isDark ? '#888' : '#666',
    border: isDark ? '#222' : 'rgba(0,0,0,0.06)',
    brandGold: '#D0A97E',
  };

  // --- RESTORED LISTENERS ---
  useEffect(() => {
    if (!user?.id) return;
    const wearerRef = ref(rtdb, `users/${user.id}/location`);
    return onValue(wearerRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setWearerLocation({ latitude: data.latitude, longitude: data.longitude });
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    return onSnapshot(collection(db, 'users', user.id, 'contacts'), (snap) => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Contact[]);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const alertsRef = ref(rtdb, `users/${user.id}/alerts`);
    return onValue(alertsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse().slice(0, 5);
        setAlerts(list as AlertLog[]);
      }
    });
  }, [user?.id]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* 1. RESTORED HEADER WITH LOGOUT */}
      <View style={[styles.header, { paddingTop: 60 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Dashboard</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 2. MAP SECTION */}
        <View style={[styles.mapCard, { borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>Live Tracking</Text>
            <TouchableOpacity onPress={() => mapRef.current?.animateToRegion({...userLocation!, latitudeDelta: 0.01, longitudeDelta: 0.01})}>
              <Text style={{ color: theme.brandGold }}>Center</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mapContainer}>
            {userLocation && (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{ ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
              >
                <Marker coordinate={userLocation} title="You" />
                {wearerLocation && <Marker coordinate={wearerLocation} title="Wearer" pinColor="blue" />}
              </MapView>
            )}
          </View>
        </View>

        {/* 3. RESTORED CONTACTS SECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Emergency Contacts</Text>
          {contacts.length > 0 ? (
            contacts.map(contact => (
              <View key={contact.id} style={[styles.itemCard, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{contact.name}</Text>
                <Text style={{ color: theme.subText }}>{contact.phone}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.subText, marginLeft: 16 }}>No contacts added.</Text>
          )}
        </View>

        {/* 4. RESTORED RECENT ALERTS SECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Alerts</Text>
          {alerts.map(alert => (
            <View key={alert.id} style={[styles.itemCard, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text }}>{alert.message}</Text>
              <Text style={{ color: theme.subText, fontSize: 12 }}>{new Date(alert.timestamp).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <PrivacyConsentModal visible={showPrivacy} userId={user?.id ?? ''} onConsent={() => setShowPrivacy(false)} />
      <SOSModal visible={!!activeAlert} message={activeAlert?.message ?? ''} onDismiss={dismissAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  logoutBtn: { padding: 5 },
  mapCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', margin: 16 },
  mapContainer: { height: 250, backgroundColor: '#eee' },
  map: { width: '100%', height: '100%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  itemCard: { padding: 15, borderRadius: 10, marginBottom: 8, flexDirection: 'column' },
});