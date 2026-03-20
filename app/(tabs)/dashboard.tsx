import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import SOSModal from '../../components/SOSModal';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/authContext';
import { useAlertListener } from '../../hooks/useAlertListener';

// ─── Types ────────────────────────────────────────────────────────────────────
type Contact = {
  id: string;
  name: string;
  phone: string;
};

type AlertLog = {
  id: string;
  message: string;
  timestamp: any;
};

type DeviceLocation = {
  latitude: number;
  longitude: number;
} | null;

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const { activeAlert, dismissAlert } = useAlertListener(user?.id);
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [userLocation, setUserLocation]     = useState<DeviceLocation>(null);
  const [wearerLocation, setWearerLocation] = useState<DeviceLocation>(null);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [contacts, setContacts]             = useState<Contact[]>([]);
  const [alerts, setAlerts]                 = useState<AlertLog[]>([]);
  const [locationReady, setLocationReady]   = useState(false);
  const mapRef = useRef<MapView>(null);

  // ── Get phone user's location ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setLocationReady(true);

      // Watch location for updates
      await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        (newLoc) => {
          setUserLocation({
            latitude: newLoc.coords.latitude,
            longitude: newLoc.coords.longitude,
          });
        }
      );
    })();
  }, []);

  // ── Listen to wearer's location from Firestore ─────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, 'devices', user.id, 'location'),
      (snap) => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setWearerLocation({ latitude: data.latitude, longitude: data.longitude });
          setDeviceConnected(true);
        } else {
          setDeviceConnected(false);
        }
      }
    );
    return () => unsub();
  }, [user]);

  // ── Listen to emergency contacts from Firestore ────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, 'users', user.id, 'contacts'),
      (snap) => {
        const list: Contact[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Contact[];
        setContacts(list.slice(0, 3));
      }
    );
    return () => unsub();
  }, [user]);

  // ── Listen to recent alerts from Firestore ─────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.id, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: AlertLog[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AlertLog[];
      setAlerts(list);
    });
    return () => unsub();
  }, [user]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleDeleteContact = (contactId: string, contactName: string) => {
  Alert.alert(
    'Remove Contact',
    `Are you sure you want to remove ${contactName} from your emergency contacts?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', user!.id, 'contacts', contactId));
          } catch (e) {
            Alert.alert('Error', 'Failed to remove contact. Please try again.');
          }
        },
      },
    ]
  );
};

  const centerMap = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 800);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appName}>Tulong 🚨</Text>
          <View style={styles.deviceRow}>
            <View style={[styles.dot, { backgroundColor: deviceConnected ? '#4ade80' : '#f87171' }]} />
            <Text style={styles.deviceText}>
              {deviceConnected ? 'Device connected' : 'Device not found'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Map */}
        <View style={styles.mapCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Location</Text>
            <TouchableOpacity onPress={centerMap}>
              <Text style={styles.centerBtn}>Center</Text>
            </TouchableOpacity>
          </View>

          {locationReady && userLocation ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation={false}
              showsMyLocationButton={false}
            >
              {/* Phone user marker */}
              <Marker
                coordinate={userLocation}
                title="You"
                description="Your current location"
                pinColor="#6366f1"
              />

              {/* Wearer marker */}
              {wearerLocation && (
                <Marker
                  coordinate={wearerLocation}
                  title="Wearer"
                  description="Device location"
                  pinColor="#f87171"
                />
              )}
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>Getting location…</Text>
            </View>
          )}

          {/* Map legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#6366f1' }]} />
              <Text style={styles.legendText}>You</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f87171' }]} />
              <Text style={styles.legendText}>Wearer</Text>
            </View>
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            {contacts.length < 3 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/add-contact' as any)}>
                <Text style={styles.addBtn}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {contacts.length === 0 ? (
            <Text style={styles.emptyText}>No contacts added yet. Add up to 3 contacts.</Text>
          ) : (
            contacts.map((contact) => (
              <View key={contact.id} style={styles.contactRow}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactInitial}>
                    {contact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                </View>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => handleCall(contact.phone)}
                >
                  <Text style={styles.callBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteContact(contact.id, contact.name)}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Recent Alerts */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Alerts</Text>

          {alerts.length === 0 ? (
            <Text style={styles.emptyText}>No alerts yet.</Text>
          ) : (
            alerts.map((alert) => (
              <View key={alert.id} style={styles.alertRow}>
                <View style={styles.alertIcon}>
                  <Text style={{ fontSize: 14 }}>⚠</Text>
                </View>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  <Text style={styles.alertTime}>{formatTime(alert.timestamp)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>
      <SOSModal
        visible={!!activeAlert}
        message={activeAlert?.message ?? ''}
        location={activeAlert?.location}
       timestamp={activeAlert?.timestamp}
        onDismiss={dismissAlert}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d14',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  appName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  logoutBtn: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  logoutText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  mapCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  centerBtn: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '500',
  },
  addBtn: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '500',
  },
  map: {
    width: '100%',
    height: 260,
  },
  mapPlaceholder: {
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitial: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '700',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  contactPhone: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  callBtn: {
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  callBtnText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(251,146,60,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertInfo: {
    flex: 1,
  },
  alertMessage: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  alertTime: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
  width: 30,
  height: 30,
  borderRadius: 8,
  backgroundColor: 'rgba(248,113,113,0.1)',
  borderWidth: 1,
  borderColor: 'rgba(248,113,113,0.25)',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 6,
  },
  deleteBtnText: {
  color: '#f87171',
  fontSize: 12,
  fontWeight: '700',
  },
});