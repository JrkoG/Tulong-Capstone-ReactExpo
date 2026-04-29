import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { getDatabase, onValue, ref } from "firebase/database";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
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

type GroupMember = {
  id: string;
  name: string;
  email: string;
  status: 'Available' | 'Not Available';
  location: { latitude: number; longitude: number } | null;
};

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const { activeAlert, dismissAlert } = useAlertListener(user?.id);
  const router = useRouter();

  const isDark = useColorScheme() === 'dark';

  const mapRef = useRef<MapView>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [userLocation, setUserLocation] = useState<DeviceLocation>(null);
  const [wearerLocation, setWearerLocation] = useState<DeviceLocation>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const theme = {
    background: isDark ? '#000' : '#fff',
    card: isDark ? '#111' : '#f9f9f9',
    text: isDark ? '#fff' : '#111',
    subText: isDark ? '#888' : '#666',
    border: isDark ? '#222' : 'rgba(0,0,0,0.06)',
    accent: isDark ? '#fff' : '#000',
    danger: '#f87171',
    success: '#4ade80',
    brandGold: '#D0A97E',
  };

  // =========================
  // LOCATION FIXED
  // =========================
  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required');
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});

    setUserLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 2,
      },
      (newLoc) => {
        setUserLocation({
          latitude: newLoc.coords.latitude,
          longitude: newLoc.coords.longitude,
        });
      }
    );
  };

  // =========================
  // CONSENT + INIT LOCATION
  // =========================
  useEffect(() => {
    if (!user) return;

    (async () => {
      const consentDoc = await getDoc(
        doc(db, 'users', user.id, 'consent', 'privacy')
      );

      if (consentDoc.exists() && consentDoc.data().consentGiven) {
        setConsentGiven(true);
        requestLocation();
      } else {
        setShowPrivacy(true);
      }
    })();

    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [user]);

  // =========================
  // FIREBASE RTDB (wearer)
  // =========================
  useEffect(() => {
    const rtdb = getDatabase();
    const emergencyRef = ref(rtdb, 'emergency');

    const unsub = onValue(emergencyRef, (snapshot) => {
      const data = snapshot.val();

      if (data?.latitude && data?.longitude) {
        setWearerLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });

        setDeviceConnected(true);
      } else {
        setWearerLocation(null);
        setDeviceConnected(false);
      }
    });

    return () => unsub();
  }, []);

  // =========================
  // CONTACTS
  // =========================
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      collection(db, 'users', user.id, 'contacts'),
      (snap) => {
        setContacts(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Contact[]
        );
      }
    );

    return () => unsub();
  }, [user]);

  // =========================
  // ALERTS
  // =========================
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.id, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsub = onSnapshot(q, (snap) => {
      setAlerts(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AlertLog[]
      );
    });

    return () => unsub();
  }, [user]);

  // =========================
  // GROUP MEMBERS
  // =========================
  useEffect(() => {
    if (!user) return;

    let unsubMembers: (() => void) | null = null;

    const load = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.id));

      if (userDoc.exists() && userDoc.data().groupId) {
        const groupId = userDoc.data().groupId;

        unsubMembers = onSnapshot(
          collection(db, 'groups', groupId, 'members'),
          (snap) => {
            setMembers(
              snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              })) as GroupMember[]
            );
          }
        );
      }
    };

    load();

    return () => {
      if (unsubMembers) unsubMembers();
    };
  }, [user]);

  // =========================
  // MAP CENTER
  // =========================
  const centerMap = () => {
    if (!userLocation) return;

    mapRef.current?.animateToRegion(
      {
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      800
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* MAP */}
      <View style={[styles.mapCard, { borderColor: theme.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>
            Live Location
          </Text>

          <TouchableOpacity onPress={centerMap}>
            <Text style={{ color: theme.text }}>Center</Text>
          </TouchableOpacity>
        </View>

        {userLocation ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={
              Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined
            }
            region={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker coordinate={userLocation} title="You" />
            {wearerLocation && (
              <Marker coordinate={wearerLocation} title="Wearer" />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={{ color: theme.subText }}>
              Waiting for location...
            </Text>
          </View>
        )}
      </View>

      <PrivacyConsentModal
        visible={showPrivacy}
        userId={user?.id ?? ''}
        onConsent={() => {
          setShowPrivacy(false);
          requestLocation();
        }}
      />

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

// =========================
// STYLES
// =========================
const styles = StyleSheet.create({
  container: { flex: 1 },

  mapCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    margin: 16,
  },

  map: {
    width: '100%',
    height: 250,
  },

  mapPlaceholder: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
});