import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location'; // Used for fetching live userLocation
import { Stack, usePathname, useRouter } from 'expo-router';
import { limitToLast, onValue, query, ref } from "firebase/database";
import {
  collection,
  doc,
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import QuickBar from '../../components/QuickBar';

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
  const pathname = usePathname();
  const colorScheme = useColorScheme(); 
  const isDark = colorScheme === 'dark'; 
  const [deviceStatus, setDeviceStatus] = useState({ battery: 0, signal: 'Offline', lastSeen: '' });
  const [groupId, setGroupId] = useState<string | null>(null);
  const [latestResponse, setLatestResponse] = useState<any>(null);

  const mapRef = useRef<MapView>(null);

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

  // ─── 1. NEW: FETCH LIVE GPS FOR USER LOCATION ───
  useEffect(() => {
    let subscription: Location.LocationSubscription;

    const startTrackingUser = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // Get initial position safely
      const current = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      // Stream updates to state
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        (loc) => {
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      );
    };

    startTrackingUser();
    return () => subscription?.remove();
  }, []);

  // ─── 2. NEW: SET WEARER INITIAL LOCATION PREVIEW ───
  useEffect(() => {
    setWearerLocation({
      latitude: 14.4589,
      longitude: 120.9603,
    });
  }, []);

  // ─── RESTORED LISTENERS ───
  useEffect(() => {
    if (!user?.id) return;
    const deviceRef = ref(rtdb, `users/${user.id}/device_health`); 
    return onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDeviceStatus({
          battery: data.battery || 0,
          signal: data.online ? 'Strong' : 'Weak',
          lastSeen: data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Unknown'
        });
      }
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

  useEffect(() => {
    if (!user?.id) return;
    const fetchGroup = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.id));
      if (userDoc.exists()) setGroupId(userDoc.data().groupId);
    };
    fetchGroup();
  }, [user?.id]);

  useEffect(() => {
    if (!groupId) return;
    
    const responseRef = query(ref(rtdb, `groups/${groupId}/alerts`), limitToLast(1));
    
    return onValue(responseRef, (snapshot) => {
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          setLatestResponse(child.val());
        });
      }
    });
  }, [groupId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} /> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Dashboard</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* DEVICE HEALTH SECTION */}
        <View style={[styles.healthCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.healthHeader}>
            <Text style={[styles.healthTitle, { color: theme.text }]}>Wearable Health</Text>
            <Text style={{ color: theme.subText, fontSize: 10 }}>Last synced: {deviceStatus.lastSeen}</Text>
          </View>
          
          <View style={styles.indicatorRow}>
            <View style={styles.indicatorItem}>
              <Ionicons 
                name={deviceStatus.battery > 20 ? "battery-charging" : "battery-dead"} 
                size={20} 
                color={deviceStatus.battery > 20 ? "#4ade80" : "#f87171"} 
              />
              <Text style={[styles.indicatorVal, { color: theme.text }]}>{deviceStatus.battery}%</Text>
              <Text style={styles.indicatorLabel}>Battery</Text>
            </View>

            <View style={styles.indicatorItem}>
              <Ionicons 
                name="cellular" 
                size={20} 
                color={deviceStatus.signal === 'Strong' ? theme.brandGold : theme.subText} 
              />
              <Text style={[styles.indicatorVal, { color: theme.text }]}>{deviceStatus.signal}</Text>
              <Text style={styles.indicatorLabel}>Signal</Text>
            </View>
          </View>
        </View>

        {/* MAP SECTION */}
        <View style={[styles.mapCard, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]}>
          <View style={styles.sectionHeader}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>Live Tracking</Text>
            <TouchableOpacity onPress={() => mapRef.current?.animateToRegion({...userLocation!, latitudeDelta: 0.01, longitudeDelta: 0.01})}>
              <Text style={{ color: theme.brandGold }}>Center</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mapContainer}>
            {userLocation ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                scrollEnabled={true} // Prevents card tracking from fighting page scrolling mechanics
                zoomEnabled={true}
                initialRegion={{ ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
              >
                <Marker coordinate={userLocation} title="You" />
                {wearerLocation && <Marker coordinate={wearerLocation} title="Wearer" pinColor="blue" />}
              </MapView>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: theme.subText, fontSize: 12 }}>Locating device...</Text>
              </View>
            )}
          </View>
        </View>

        {/* EMERGENCY CONTACTS SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Emergency Contacts</Text>
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={() => router.push('/add-contact')} 
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={24} color={theme.brandGold} />
              <Text style={[styles.addButtonText, { color: theme.brandGold }]}>Add</Text>
            </TouchableOpacity>
          </View>

          {contacts.length > 0 ? (
            contacts.map(contact => (
              <View key={contact.id} style={[styles.itemCard, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{contact.name}</Text>
                <Text style={{ color: theme.subText }}>{contact.phone}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.subText, marginLeft: 0, marginTop: 8 }}>
              No contacts added.
            </Text>
          )}
        </View>

        {/* GUARDIAN SUMMARY SECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Guardian Summary</Text>
          <View style={[styles.itemCard, { 
            backgroundColor: theme.card, 
            borderLeftWidth: 4, 
            borderLeftColor: latestResponse?.status === 'active' ? '#fb923c' : '#4ade80' 
          }]}>
            {latestResponse ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.summaryIconCircle}>
                  <Text style={{ fontSize: 20 }}>
                    {latestResponse.currentStatus === 'on_the_way' ? '🚗' : 
                      latestResponse.currentStatus === 'arrived' ? '📍' : '✅'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>
                    {latestResponse.lastResponderName || "Waiting for response..."}
                  </Text>
                  <Text style={{ color: theme.subText, fontSize: 12 }}>
                    Status: {latestResponse.currentStatus?.replace('_', ' ') || "No active alerts"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/group')}>
                  <Ionicons name="chevron-forward" size={20} color={theme.brandGold} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ color: theme.subText }}>No recent guardian activity.</Text>
            )}
          </View>
        </View>

        {/* RECENT ALERTS SECTION */}
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

      <QuickBar />

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
  mapCard: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16, // Changed to marginHorizontal to match spacing of your health card perfectly
    marginBottom: 16,
  },
  mapContainer: {
    width: '100%',
    height: 180,        
    borderRadius: 12,
    overflow: 'hidden', 
  },
  map: {
    width: '100%',
    height: '100%',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  itemCard: { padding: 15, borderRadius: 10, marginBottom: 8, flexDirection: 'column' },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, 
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  healthCard: { margin: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  healthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  healthTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  indicatorRow: { flexDirection: 'row', justifyContent: 'space-around' },
  indicatorItem: { alignItems: 'center' },
  indicatorVal: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  indicatorLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase' },
  summaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});