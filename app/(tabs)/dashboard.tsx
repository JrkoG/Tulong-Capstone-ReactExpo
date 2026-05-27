import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Stack, usePathname, useRouter } from 'expo-router';
import { onValue, ref } from "firebase/database";
import { collection, query as fsQuery, getDocs, onSnapshot, where } from 'firebase/firestore';
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
import PrivacyConsentModal from '../../components/PrivacyConsentModal';
import QuickBar from '../../components/QuickBar';
import SOSModal from '../../components/SOSModal';
import { db, rtdb } from '../../config/firebase';
import { useAuth } from '../../context/authContext';
import { useAlertListener } from '../../hooks/useAlertListener';

type Contact = { id: string; name: string; phone: string; };
type AlertLog = { id: string; message: string; timestamp: any; pushNotified?: boolean; };
type DeviceLocation = { latitude: number; longitude: number; } | null;

// Global settings for handling notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 🌟 THE NOTIFICATION FUNCTION IS RIGHT HERE INSIDE THE FILE NOW!
const sendGroupPushNotification = async (groupId: string) => {
  try {
    const usersRef = collection(db, 'users');
    const q = fsQuery(usersRef, where('groupId', '==', groupId));
    const querySnapshot = await getDocs(q);
    
    const tokens: string[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.expoPushToken) tokens.push(data.expoPushToken);
    });

    if (tokens.length === 0) return;

    const PROJECT_ID = "tulong-app-c7aaa";
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

    for (const token of tokens) {
      const payload = {
        message: {
          token: token,
          notification: {
            title: "🚨 EMERGENCY ALERT!",
            body: "The hardware wearable device has triggered a physical SOS button!"
          },
          android: {
            priority: "high",
            notification: { sound: "default", vibrate_timings: ["0s", "0.5s", "0.2s", "0.5s"] }
          },
          apns: { payload: { aps: { sound: "default", badge: 1 } } }
        }
      };

      await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=AIzaSyDeoWrGJvxiLRHhzs8UAesddd6i2iWAp50`
        },
        body: JSON.stringify(payload)
      });
    }
  } catch (err) {
    console.error("FCM Send Error: ", err);
  }
};

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const { activeAlert, dismissAlert } = useAlertListener(user?.id);
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme(); 
  const isDark = colorScheme === 'dark'; 
  
  const [deviceStatus, setDeviceStatus] = useState({ battery: 0, signal: 'Offline', lastSeen: '' });
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<DeviceLocation>(null);
  const [wearerLocation, setWearerLocation] = useState<DeviceLocation>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const HARDCODED_GROUP_ID = "qwi4UVJBinray0ZQm95e";

  const theme = {
    background: isDark ? '#000' : '#fff',
    card: isDark ? '#111' : '#f9f9f9',
    text: isDark ? '#fff' : '#111',
    subText: isDark ? '#888' : '#666',
    border: isDark ? '#222' : 'rgba(0,0,0,0.06)',
    brandGold: '#D0A97E',
  };

  // Live Location Tracker for Guardian's Smartphone
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

  // Telemetry updates from hardware wearable
  useEffect(() => {
    const trackingRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/tracking`); 
    return onValue(trackingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDeviceStatus({
          battery: data.batteryLevel || 0,
          signal: 'Strong',
          lastSeen: data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'Just now'
        });

        if (data.latitude && data.longitude) {
          setWearerLocation({
            latitude: data.latitude,
            longitude: data.longitude,
          });
        }
      }
    });
  }, []);

  // Watch for active database hardware alert changes
  useEffect(() => {
    const alertsRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/alerts`);
    return onValue(alertsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        const latestAlert = list[list.length - 1] as AlertLog;
        
        if (latestAlert && !latestAlert.pushNotified) {
          // Triggers the local inline function perfectly!
          sendGroupPushNotification(HARDCODED_GROUP_ID);
          ref(rtdb, `groups/${HARDCODED_GROUP_ID}/alerts/${latestAlert.id}`).update({ pushNotified: true });
        }

        setAlerts(list.reverse().slice(0, 5) as AlertLog[]);
      }
    });
  }, []);

  // Contacts snapshot mapping
  useEffect(() => {
    if (!user?.id) return;
    return onSnapshot(collection(db, 'users', user.id, 'contacts'), (snap) => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Contact[]);
    });
  }, [user?.id]);

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
              <Ionicons name="cellular" size={20} color={theme.brandGold} />
              <Text style={[styles.indicatorVal, { color: theme.text }]}>{deviceStatus.signal}</Text>
              <Text style={styles.indicatorLabel}>Signal</Text>
            </View>
          </View>
        </View>

        <View style={[styles.mapCard, { borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>Live Tracking</Text>
            <TouchableOpacity 
              onPress={() => wearerLocation && mapRef.current?.animateToRegion({
                ...wearerLocation, 
                latitudeDelta: 0.01, 
                longitudeDelta: 0.01
              })}
            >
              <Text style={{ color: theme.brandGold }}>Center Wearer</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mapContainer}>
            {userLocation ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{ ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
              >
                <Marker coordinate={userLocation} title="You" />
                {wearerLocation && <Marker coordinate={wearerLocation} title="Wearer Device" pinColor="blue" />}
              </MapView>
            ) : (
              <View style={styles.loadingMap}><Text style={{color: theme.subText}}>Acquiring GPS Fix...</Text></View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Emergency Contacts</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/add-contact')} activeOpacity={0.7}>
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
            <Text style={{ color: theme.subText, marginTop: 8 }}>No contacts added.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Alerts</Text>
          {alerts.map(alert => (
            <View key={alert.id} style={[styles.itemCard, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text }}>{alert.message}</Text>
              <Text style={{ color: theme.subText, fontSize: 12 }}>
                {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'Just now'}
              </Text>
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
  mapCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', margin: 16 },
  mapContainer: { height: 250, backgroundColor: '#eee' },
  loadingMap: { height: 250, justifyContent: 'center', alignItems: 'center' },
  map: { width: '100%', height: '100%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  itemCard: { padding: 15, borderRadius: 10, marginBottom: 8, flexDirection: 'column' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { fontSize: 16, fontWeight: '600' },
  healthCard: { margin: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  healthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  healthTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  indicatorRow: { flexDirection: 'row', justifyContent: 'space-around' },
  indicatorItem: { alignItems: 'center' },
  indicatorVal: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  indicatorLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase' },
});