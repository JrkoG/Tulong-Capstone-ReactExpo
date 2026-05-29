import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Stack, usePathname, useRouter } from 'expo-router';
import { onValue, push, ref, set, update } from "firebase/database";
import { collection, query as fsQuery, getDocs, onSnapshot, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
type AlertLog = { id: string; message: string; timestamp: any; pushNotified?: boolean; latitude?: number; longitude?: number; };
type DeviceLocation = { latitude: number; longitude: number; } | null;

type GroupMember = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lastUpdated: number;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
            body: "An SOS panic alert has been triggered!"
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
  
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [currentModalAlert, setCurrentModalAlert] = useState<AlertLog | null>(null);

  const HARDCODED_GROUP_ID = "qwi4UVJBinray0ZQm95e";

  const theme = {
    background: isDark ? '#000' : '#fff',
    card: isDark ? '#111' : '#f9f9f9',
    text: isDark ? '#fff' : '#111',
    subText: isDark ? '#888' : '#666',
    border: isDark ? '#222' : 'rgba(0,0,0,0.06)',
    brandGold: '#D0A97E',
  };

  const handleManualSOS = () => {
    Alert.alert(
      "Confirm Emergency",
      "Are you sure you want to broadcast a manual SOS to the entire group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "TRIGGER",
          style: "destructive",
          onPress: async () => {
            if (isSending) return;
            setIsSending(true);
            try {
              const alertsRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/alerts`);
              
              await push(alertsRef, {
                message: `Manual App SOS triggered by ${user?.email || 'Guardian'}`,
                timestamp: Date.now(),
                pushNotified: false,
                latitude: null, 
                longitude: null
              });
              
              Alert.alert("Success", "Emergency broadcast sent successfully!");
            } catch (error) {
              console.error("Failed to append RTDB Alert node:", error);
              Alert.alert("Error", "Failed to connect to database server.");
            } finally {
              setIsSending(false);
            }
          }
        }
      ]
    );
  };

  // 🛰️ JOB 1: Continuous Mobile Phone Location Tracker
  useEffect(() => {
    if (!user?.id) return;
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, 
          distanceInterval: 10, 
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          setUserLocation({ latitude, longitude });

          const myLocationRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/members/${user.id}`);
          set(myLocationRef, {
            name: user.email?.split('@')[0] || "Group Member",
            latitude,
            longitude,
            lastUpdated: Date.now(),
          });
        }
      );
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [user?.id]);

  // 📡 JOB 2: Listen to Circle Members Live Status Feed
  useEffect(() => {
    const membersRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/members`);
    
    return onValue(membersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const membersList = Object.keys(data)
          .filter(key => key !== user?.id) 
          .map(key => ({ id: key, ...data[key] })) as GroupMember[];
          
        setGroupMembers(membersList);
      } else {
        setGroupMembers([]);
      }
    });
  }, [user?.id]);

  // 🛰️ JOB 3: Listen to Continuous Wearable Device Path (Live Tracking Loop)
  useEffect(() => {
    const trackingRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/tracking`); 
    return onValue(trackingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDeviceStatus({
          battery: data.batteryLevel || 100, 
          signal: 'Strong',
          lastSeen: data.lastUpdated || data.serverTime ? new Date(data.lastUpdated || data.serverTime).toLocaleTimeString() : 'Just now'
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

  // 🚨 JOB 4: Upgraded Alerts and SOS Tracker Mapping Listener
  useEffect(() => {
    const alertsRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/alerts`);
    return onValue(alertsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Map elements out into an indexable array structure seamlessly
        const list = Object.keys(data).map(key => {
          const item = data[key];
          return {
            id: key,
            message: item.message || (item.reason === "button" ? "Hardware Emergency Button Pressed!" : item.reason) || "SOS Emergency Triggered",
            timestamp: item.timestamp || item.serverTime || Date.now(),
            pushNotified: item.pushNotified || false,
            // 🎯 Fallback check handles both .latitude and .lat key layouts seamlessly
            latitude: item.latitude !== undefined ? item.latitude : item.lat,
            longitude: item.longitude !== undefined ? item.longitude : item.lng,
          };
        });
        
        const latestAlert = list[list.length - 1] as AlertLog;
        
        // Show modal popup window if data entry happened within the last 3 minutes
        const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
        const alertTime = typeof latestAlert.timestamp === 'number' ? latestAlert.timestamp : Date.now();
        
        if (latestAlert && alertTime > threeMinutesAgo) {
          setCurrentModalAlert(latestAlert);
        }
        
        if (latestAlert && !latestAlert.pushNotified) {
          sendGroupPushNotification(HARDCODED_GROUP_ID);
          update(ref(rtdb, `groups/${HARDCODED_GROUP_ID}/alerts/${latestAlert.id}`), { pushNotified: true });
        }

        setAlerts([...list].reverse().slice(0, 5) as AlertLog[]);
      }
    });
  }, []);

  // 👥 JOB 5: Emergency Contacts Listener
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
            <Text style={[styles.healthTitle, { color: theme.text }]}>Wearable Status</Text>
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

        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.sosButton, isSending && { opacity: 0.6 }]} 
            onPress={handleManualSOS}
            disabled={isSending}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle" size={26} color="#fff" />
            <Text style={styles.sosButtonText}>
              {isSending ? "SENDING SOS..." : "TRIGGER APP SOS ALERT"}
            </Text>
          </TouchableOpacity>
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
                <Marker coordinate={userLocation} title="You" pinColor="green" />
                {wearerLocation && <Marker coordinate={wearerLocation} title="Wearer Device" pinColor="blue" />}
                {groupMembers.map((member) => (
                  <Marker
                    key={member.id}
                    coordinate={{ latitude: member.latitude, longitude: member.longitude }}
                    title={member.name}
                    pinColor="orange"
                  />
                ))}
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
      
      <SOSModal 
        visible={!!currentModalAlert} 
        message={currentModalAlert?.message ?? ''} 
        timestamp={currentModalAlert?.timestamp}
        location={currentModalAlert?.latitude && currentModalAlert?.longitude ? {
          latitude: currentModalAlert.latitude,
          longitude: currentModalAlert.longitude
        } : undefined}
        onDismiss={() => setCurrentModalAlert(null)} 
      />
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
  sosButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  sosButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});