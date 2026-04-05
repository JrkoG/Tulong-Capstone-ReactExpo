import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import PrivacyConsentModal from '../../components/PrivacyConsentModal';
import SOSModal from '../../components/SOSModal';
import { db } from '../../config/firebase';
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

  // --- Synchronized Theme Palette ---
  const theme = {
    background: isDark ? '#000000' : '#FFFFFF', 
    card: isDark ? '#111111' : '#F9F9F9',
    text: isDark ? '#FFFFFF' : '#1C1C1E',
    subText: isDark ? '#888888' : '#666666',
    border: isDark ? '#222222' : 'rgba(0,0,0,0.06)',
    accent: isDark ? '#FFFFFF' : '#000000', // Solid buttons/accents
    brandGold: '#D0A97E',
    danger: '#f87171',
    success: '#4ade80'
  };

  const [userLocation, setUserLocation] = useState<DeviceLocation>(null);
  const [wearerLocation, setWearerLocation] = useState<DeviceLocation>(null);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [locationReady, setLocationReady] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const consentDoc = await getDoc(doc(db, 'users', user.id, 'consent', 'privacy'));
      if (consentDoc.exists() && consentDoc.data().consentGiven) {
        setConsentGiven(true);
        requestLocation();
      } else {
        setShowPrivacy(true);
      }
    })();
  }, [user]);

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    setLocationReady(true);

    await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
      (newLoc) => {
        setUserLocation({ latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude });
      }
    );
  };

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'devices', user.id, 'location'), (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setWearerLocation({ latitude: data.latitude, longitude: data.longitude });
        setDeviceConnected(true);
      } else { setDeviceConnected(false); }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'users', user.id, 'contacts'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Contact[];
      setContacts(list.slice(0, 3));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.id, 'alerts'), orderBy('timestamp', 'desc'), limit(5));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AlertLog[];
      setAlerts(list);
    });
    return () => unsub();
  }, [user]);

  const handleLogout = async () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  const handleCall = (phone: string) => Linking.openURL(`tel:${phone}`);

  const handleDeleteContact = (contactId: string, contactName: string) => {
    Alert.alert('Remove Contact', `Remove ${contactName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { 
          try { await deleteDoc(doc(db, 'users', user!.id, 'contacts', contactId)); } 
          catch (e) { Alert.alert('Error', 'Failed to remove contact.'); } 
      }},
    ]);
  };

  const centerMap = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.appName, { color: theme.text }]}>Tulong 🚨</Text>
          <View style={styles.deviceRow}>
            <View style={[styles.dot, { backgroundColor: deviceConnected ? theme.success : theme.danger }]} />
            <Text style={[styles.deviceText, { color: theme.subText }]}>
              {deviceConnected ? 'Device connected' : 'Device not found'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: theme.border }]} onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: theme.text }]}>Log out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Map Card */}
        <View style={[styles.mapCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Live Location</Text>
            <TouchableOpacity onPress={centerMap}>
              <Text style={[styles.centerBtn, { color: theme.text }]}>Center</Text>
            </TouchableOpacity>
          </View>

          {locationReady && userLocation ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              userInterfaceStyle={isDark ? 'dark' : 'light'}
              initialRegion={{ ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            >
              <Marker coordinate={userLocation} title="You" pinColor={theme.brandGold} />
              {wearerLocation && <Marker coordinate={wearerLocation} title="Wearer" pinColor={theme.danger} />}
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={{ color: theme.subText }}>Getting location…</Text>
            </View>
          )}
        </View>

        {/* Emergency Contacts */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Emergency Contacts</Text>
            {contacts.length < 3 && (
              <TouchableOpacity 
                style={[styles.miniAddBtn, { backgroundColor: theme.accent }]}
                onPress={() => router.push('/(tabs)/add-contact' as any)}
              >
                <Text style={[styles.miniAddText, { color: isDark ? '#000' : '#FFF' }]}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>
          {contacts.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.subText }]}>No contacts added yet.</Text>
          ) : (
            contacts.map((contact) => (
              <View key={contact.id} style={[styles.contactRow, { borderBottomColor: theme.border }]}>
                <View style={[styles.contactAvatar, { backgroundColor: theme.border }]}>
                  <Text style={[styles.contactInitial, { color: theme.text }]}>{contact.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: theme.text }]}>{contact.name}</Text>
                  <Text style={[styles.contactPhone, { color: theme.subText }]}>{contact.phone}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.callBtn, { backgroundColor: theme.accent }]} 
                  onPress={() => handleCall(contact.phone)}
                >
                  <Text style={[styles.callBtnText, { color: isDark ? '#000' : '#FFF' }]}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteContact(contact.id, contact.name)}>
                  <Text style={[styles.deleteBtnText, { color: theme.danger }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Recent Alerts */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text, padding: 16 }]}>Recent Alerts</Text>
          {alerts.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.subText }]}>No alerts yet.</Text>
          ) : (
            alerts.map((alert) => (
              <View key={alert.id} style={[styles.alertRow, { borderBottomColor: theme.border }]}>
                <View style={[styles.alertIcon, { backgroundColor: theme.border }]}><Text style={{color: theme.text}}>⚠</Text></View>
                <View style={styles.alertInfo}>
                  <Text style={[styles.alertMessage, { color: theme.text }]}>{alert.message}</Text>
                  <Text style={[styles.alertTime, { color: theme.subText }]}>{formatTime(alert.timestamp)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      <PrivacyConsentModal visible={showPrivacy} userId={user?.id ?? ''} onConsent={() => { setShowPrivacy(false); setConsentGiven(true); requestLocation(); }} />
      <SOSModal visible={!!activeAlert} message={activeAlert?.message ?? ''} location={activeAlert?.location} timestamp={activeAlert?.timestamp} onDismiss={dismissAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  appName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  deviceText: { fontSize: 12, fontWeight: '500' },
  logoutBtn: { borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  logoutText: { fontSize: 12, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  mapCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  card: { borderRadius: 12, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  centerBtn: { fontSize: 12, fontWeight: '700' },
  miniAddBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  miniAddText: { fontSize: 12, fontWeight: '700' },
  map: { width: '100%', height: 240 },
  mapPlaceholder: { height: 240, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', paddingBottom: 20 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  contactAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  contactInitial: { fontSize: 14, fontWeight: '800' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '600' },
  contactPhone: { fontSize: 12, marginTop: 1 },
  callBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  callBtnText: { fontSize: 12, fontWeight: '700' },
  deleteBtn: { padding: 8, marginLeft: 4 },
  deleteBtnText: { fontSize: 14, fontWeight: '600' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  alertIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  alertInfo: { flex: 1 },
  alertMessage: { fontSize: 13, fontWeight: '600' },
  alertTime: { fontSize: 11, marginTop: 2 },
});