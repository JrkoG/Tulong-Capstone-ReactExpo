<<<<<<< HEAD
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import {
=======
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as TaskManager from "expo-task-manager";
import { onValue, push, ref, set, update } from "firebase/database";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
<<<<<<< HEAD
  View,
  useColorScheme
} from 'react-native';
import QuickBar from '../../components/QuickBar';
import { auth } from '../../config/firebase';
=======
  useColorScheme,
  View,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import PrivacyConsentModal from "../../components/PrivacyConsentModal";
import QuickBar from "../../components/QuickBar";
import SOSModal from "../../components/SOSModal";
import { auth, db, rtdb } from "../../config/firebase";
import { useAuth } from "../../context/authContext";
import { useAlertListener } from "../../hooks/useAlertListener";

// ─── Types ────────────────────────────────────────────────────────────────────
type Contact = { id: string; name: string; phone: string };
type AlertLog = {
  id: string;
  message: string;
  timestamp: any;
  pushNotified?: boolean;
  latitude?: number;
  longitude?: number;
  // Guardian response fields — written by group.tsx handleStatusUpdate
  currentStatus?: "responded" | "on_the_way" | "arrived" | "aided";
  lastResponderName?: string;
  lastResponderId?: string;
  lastUpdateAt?: string;
  triggeredBy?: string;
};
type DeviceLocation = { latitude: number; longitude: number; accuracy?: number } | null;
type GroupMember = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lastUpdated: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const LOCATION_TASK_NAME = "background-location-task";
const HARDCODED_GROUP_ID = "qwi4UVJBinray0ZQm95e";
const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const MEMBER_COLORS = ["#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c"];

// ─── Background Task ──────────────────────────────────────────────────────────
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("Background Location Error:", error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (location) {
      const { latitude, longitude } = location.coords;
      try {
        const currentUser = auth.currentUser;
        if (currentUser?.uid) {
          const myLocationRef = ref(
            rtdb,
            `groups/${HARDCODED_GROUP_ID}/members/${currentUser.uid}`,
          );
          await update(myLocationRef, {
            latitude,
            longitude,
            accuracy: location.coords.accuracy ?? 999,
            speed: location.coords.speed ?? 0,
            heading: location.coords.heading ?? 0,
            lastUpdated: Date.now(),
          });
        }
      } catch (dbErr) {
        // Silently ignore errors in background thread context
      }
    }
  }
});
>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a

// ─── Notifications ────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Custom Map Markers ───────────────────────────────────────────────────────
function YouMarker() {
  return (
    <View style={markerStyles.youOuter}>
      <View style={markerStyles.youInner} />
    </View>
  );
}

function WearerMarker() {
  return (
    <View style={[markerStyles.circle, { backgroundColor: "#D0A97E" }]}>
      <Ionicons name="watch-outline" size={13} color="#fff" />
    </View>
  );
}

function MemberMarker({
  name,
  color,
  isStale,
}: {
  name: string;
  color: string;
  isStale: boolean;
}) {
  return (
    <View
      style={[
        markerStyles.circle,
        { backgroundColor: isStale ? "#888" : color, opacity: isStale ? 0.5 : 1 },
      ]}
    >
      <Text style={markerStyles.initial}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  initial: { color: "#fff", fontWeight: "800", fontSize: 12 },
  youOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4285F4",
    opacity: 0.85,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  youInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#4285F4",
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
<<<<<<< HEAD
  
  // SMART THEME: Automatically follows system settings (Light/Dark)
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
=======
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [deviceStatus, setDeviceStatus] = useState({
    battery: 0,
    signal: "Offline",
    lastSeen: "",
  });
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<DeviceLocation>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [wearerLocation, setWearerLocation] = useState<DeviceLocation>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [currentModalAlert, setCurrentModalAlert] = useState<AlertLog | null>(null);

  // Track movement state and last broadcasted coords to prevent jitter
  const isMovingRef = useRef(false);
  const lastBroadcastedCoords = useRef<DeviceLocation>(null);
>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a

  // THEME COLORS
  const theme = {
<<<<<<< HEAD
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
=======
    background: isDark ? "#000" : "#fff",
    card: isDark ? "#111" : "#f9f9f9",
    text: isDark ? "#fff" : "#111",
    subText: isDark ? "#888" : "#666",
    border: isDark ? "#222" : "rgba(0,0,0,0.06)",
    brandGold: "#D0A97E",
    warning: "#f59e0b",
  };

  const handleManualSOS = () => {
    Alert.alert(
      "Confirm Emergency",
      "Are you sure you want to notify all guardians with an SOS alert?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "NOTIFY",
          style: "destructive",
          onPress: async () => {
            if (isSending) return;
            setIsSending(true);
            try {
              const alertsRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/alerts`);
              await push(alertsRef, {
                message: `Manual App SOS triggered by ${user?.email || "Guardian"}`,
                timestamp: Date.now(),
                pushNotified: false,
                latitude: null,
                longitude: null,
                // Store sender ID so they don't receive their own SOSModal popup
                triggeredBy: user?.id ?? null,
              });
              Alert.alert("Success", "Guardians have been notified!");
            } catch (error) {
              console.error("Failed to append RTDB Alert node:", error);
              Alert.alert("Error", "Failed to connect to database server.");
            } finally {
              setIsSending(false);
            }
          },
        },
      ],
    );
  };

  // ─── JOB 1: Foreground + Background Location Tracking ────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    let locationSubscription: Location.LocationSubscription | null = null;

    const setupLiveTracking = async () => {
      const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
      if (foreStatus !== "granted") return;

      const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backStatus !== "granted") {
        console.warn("Background permission missing — tracking pauses when minimized.");
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          // BestForNavigation uses WiFi/Cell fusion — better for indoor vicinity tracking
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (location) => {
          const { latitude, longitude, accuracy, speed } = location.coords;
          const currentAccuracy = accuracy ?? 999;
          const currentSpeed = speed ?? 0;

          // Always update local map immediately
          setUserLocation({ latitude, longitude });
          setLocationAccuracy(currentAccuracy);
          isMovingRef.current = currentSpeed > 0.5;

          // Enterprise Logic: Only update database if signal is reliable (≤35m)
          if (currentAccuracy <= 35) {
            let shouldUpdate = true;

            if (lastBroadcastedCoords.current) {
              const latDiff = Math.abs(lastBroadcastedCoords.current.latitude - latitude);
              const lngDiff = Math.abs(lastBroadcastedCoords.current.longitude - longitude);
              
              // Anti-jitter: If moved less than ~8 meters, skip RTDB update
              if (latDiff < 0.00008 && lngDiff < 0.00008) {
                shouldUpdate = false;
              }
            }

            if (shouldUpdate) {
              lastBroadcastedCoords.current = { latitude, longitude, accuracy: currentAccuracy };
              
              const myLocationRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/members/${user.id}`);
              set(myLocationRef, {
                name: user.email?.split("@")[0] || "Group Member",
                latitude,
                longitude,
                accuracy: currentAccuracy,
                lastUpdated: Date.now(),
              });
            }
          }
        },
      );

      if (backStatus === "granted") {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 10, // Slightly higher to save battery while precise
          deferredUpdatesInterval: 5000,
          deferredUpdatesDistance: 10,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "CARE Security Active",
            notificationBody: "Live tracking is protecting your family circle.",
            notificationColor: "#D0A97E",
          },
          pausesLocationUpdatesAutomatically: false, // Prevents OS suspension
        });
      }
    };

    setupLiveTracking();

    return () => {
      if (locationSubscription) locationSubscription.remove();
      Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).then(
        (hasStarted) => {
          if (hasStarted) Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        },
      );
    };
  }, [user?.id]);

  // ─── JOB 2: Group Members Live Feed ─────────────────────────────────────────
  useEffect(() => {
    const membersRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/members`);
    return onValue(membersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const membersList = Object.keys(data)
          .filter((key) => key !== user?.id)
          .map((key) => ({ id: key, ...data[key] })) as GroupMember[];
        setGroupMembers(membersList);
      } else {
        setGroupMembers([]);
      }
    });
  }, [user?.id]);

  // ─── JOB 3: Wearable Device Status ───────────────────────────────────────────
  useEffect(() => {
    const trackingRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/tracking`);
    return onValue(trackingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDeviceStatus({
          battery: data.batteryLevel || 100,
          signal: "Strong",
          lastSeen:
            data.lastUpdated || data.serverTime
              ? new Date(data.lastUpdated || data.serverTime).toLocaleTimeString()
              : "Just now",
        });
        if (data.latitude && data.longitude) {
          if (data.latitude === 0 && data.longitude === 0) return;
          setWearerLocation({ latitude: data.latitude, longitude: data.longitude });
        }
      }
    });
  }, []);

  // ─── JOB 4: Alerts Listener ───────────────────────────────────────────────────
  useEffect(() => {
    const alertsRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/alerts`);
    return onValue(alertsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map((key) => {
          const item = data[key];
          return {
            id: key,
            message:
              item.message ||
              (item.reason === "button" ? "Hardware Emergency Button Pressed!" : item.reason) ||
              "SOS Emergency Triggered",
            timestamp: item.timestamp || item.serverTime || Date.now(),
            pushNotified: item.pushNotified || false,
            latitude: item.latitude !== undefined ? item.latitude : item.lat,
            longitude: item.longitude !== undefined ? item.longitude : item.lng,
            currentStatus: item.currentStatus,
            lastResponderName: item.lastResponderName,
            lastResponderId: item.lastResponderId,
            lastUpdateAt: item.lastUpdateAt,
            triggeredBy: item.triggeredBy,
          };
        });

        const latestAlert = list[list.length - 1] as AlertLog;
        const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
        const alertTime =
          typeof latestAlert.timestamp === "number"
            ? latestAlert.timestamp
            : Date.now();

        if (latestAlert && alertTime > threeMinutesAgo) {
          // Don't show SOSModal to the person who triggered the alert — they already know
          if (latestAlert.triggeredBy !== user?.id) {
            setCurrentModalAlert(latestAlert);
          }
        }

        setAlerts([...list].reverse().slice(0, 5) as AlertLog[]);
      }
    });
  }, []);

  // ─── JOB 5: Emergency Contacts ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    return onSnapshot(collection(db, "users", user.id, "contacts"), (snap) => {
      setContacts(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Contact[]);
    });
  }, [user?.id]);

  const isStale = (lastUpdated: number) => Date.now() - lastUpdated > STALE_THRESHOLD_MS;
  const getMemberColor = (index: number) => MEMBER_COLORS[index % MEMBER_COLORS.length];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 60 : 40 }]}>
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
>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a
            </View>
          </View>
        </View>

<<<<<<< HEAD
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
=======
        <View style={styles.section}>
          <View style={styles.buttonRow}>
            {/* Left: Notify Guardians (renamed from TRIGGER APP SOS ALERT) */}
            <TouchableOpacity
              style={[styles.sosButton, isSending && { opacity: 0.6 }]}
              onPress={handleManualSOS}
              disabled={isSending}
              activeOpacity={0.8}
            >
              <Ionicons name="alert-circle" size={20} color="#fff" />
              <Text style={styles.sosButtonText}>
                {isSending ? "Sending..." : "Notify Guardians"}
              </Text>
            </TouchableOpacity>

            {/* Right: Track Wearer */}
            <TouchableOpacity
              style={styles.trackButton}
              onPress={() => router.push("/track-wearer")}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.trackButtonText}>Track Wearer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.mapCard, { borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={{ color: theme.text, fontWeight: "700" }}>Live Tracking</Text>
            <View style={styles.mapHeaderRight}>
              {locationAccuracy !== null && (
                <View style={styles.accuracyBadge}>
                  <View
                    style={[
                      styles.accuracyDot,
                      {
                        backgroundColor:
                          locationAccuracy <= 15
                            ? "#4ade80"
                            : locationAccuracy <= 40
                              ? "#f59e0b"
                              : "#f87171",
                      },
                    ]}
                  />
                  <Text style={{ color: theme.subText, fontSize: 11 }}>
                    {locationAccuracy <= 40 ? `±${Math.round(locationAccuracy)}m` : "Getting fix..."}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() =>
                  wearerLocation &&
                  mapRef.current?.animateToRegion({
                    ...wearerLocation,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  })
                }
              >
                <Text style={{ color: theme.brandGold }}>Center Wearer</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mapContainer}>
            {userLocation ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  ...userLocation,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                {/* Uncertainty Radius Circle Mapping */}
                {locationAccuracy !== null && (
                  <Circle
                    center={userLocation}
                    radius={locationAccuracy}
                    strokeColor="rgba(66, 133, 244, 0.4)"
                    fillColor="rgba(66, 133, 244, 0.12)"
                    strokeWidth={1.5}
                  />
                )}

                <Marker coordinate={userLocation} title="You" anchor={{ x: 0.5, y: 0.5 }}>
                  <View collapsable={true}><YouMarker /></View>
                </Marker>

                {wearerLocation && (
                  <Marker coordinate={wearerLocation} title="Wearer Device" anchor={{ x: 0.5, y: 0.5 }}>
                    <View collapsable={true}><WearerMarker /></View>
                  </Marker>
                )}

                {groupMembers.map((member, index) => (
                  <Marker
                    key={member.id}
                    coordinate={{ latitude: member.latitude, longitude: member.longitude }}
                    title={member.name}
                    description={
                      isStale(member.lastUpdated)
                        ? `⚠️ Location may be outdated`
                        : `Updated ${new Date(member.lastUpdated).toLocaleTimeString()}`
                    }
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View collapsable={true}>
                      <MemberMarker
                        name={member.name}
                        color={getMemberColor(index)}
                        isStale={isStale(member.lastUpdated)}
                      />
                    </View>
                  </Marker>
                ))}
              </MapView>
            ) : (
              <View style={styles.loadingMap}>
                <ActivityIndicator color={theme.brandGold} />
                <Text style={{ color: theme.subText, marginTop: 8 }}>Acquiring GPS Fix...</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Emergency Contacts</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push("/add-contact")} activeOpacity={0.7}>
              <Ionicons name="add-circle" size={24} color={theme.brandGold} />
              <Text style={[styles.addButtonText, { color: theme.brandGold }]}>Add</Text>
            </TouchableOpacity>
          </View>
          {contacts.length > 0 ? (
            contacts.map((contact) => (
              <View key={contact.id} style={[styles.itemCard, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>{contact.name}</Text>
                <Text style={{ color: theme.subText }}>{contact.phone}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.subText, marginTop: 8 }}>No contacts added.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Alerts</Text>
          {alerts.map((alert) => (
            <View key={alert.id} style={[styles.itemCard, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text }}>{alert.message}</Text>
              <Text style={{ color: theme.subText, fontSize: 12 }}>
                {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : "Just now"}
              </Text>
            </View>
          ))}
>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a
        </View>
      </ScrollView>

      <QuickBar />
<<<<<<< HEAD
    </SafeAreaView>
=======

      <PrivacyConsentModal visible={showPrivacy} userId={user?.id ?? ""} onConsent={() => setShowPrivacy(false)} />
      <SOSModal
        visible={!!currentModalAlert}
        message={currentModalAlert?.message ?? ""}
        timestamp={currentModalAlert?.timestamp}
        location={
          currentModalAlert?.latitude && currentModalAlert?.longitude
            ? { latitude: currentModalAlert.latitude, longitude: currentModalAlert.longitude }
            : undefined
        }
        onDismiss={() => setCurrentModalAlert(null)}
      />
    </View>
>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
<<<<<<< HEAD
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
=======
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: "800" },
  logoutBtn: { padding: 5 },
  mapCard: { borderWidth: 1, borderRadius: 12, overflow: "hidden", margin: 16 },
  mapContainer: { height: 250, backgroundColor: "#eee" },
  loadingMap: { height: 250, justifyContent: "center", alignItems: "center" },
  map: { width: "100%", height: "100%" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  mapHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  accuracyBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  accuracyDot: { width: 7, height: 7, borderRadius: 3.5 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  itemCard: { padding: 15, borderRadius: 10, marginBottom: 8, flexDirection: "column" },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  addButtonText: { fontSize: 16, fontWeight: "600" },
  healthCard: { margin: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  healthHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  healthTitle: { fontSize: 14, fontWeight: "700", textTransform: "uppercase" },
  indicatorRow: { flexDirection: "row", justifyContent: "space-around" },
  indicatorItem: { alignItems: "center" },
  indicatorVal: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  indicatorLabel: { fontSize: 10, color: "#888", textTransform: "uppercase" },
  buttonRow: { flexDirection: "row", gap: 10 },
  sosButton: { flex: 1, backgroundColor: "#ef4444", paddingVertical: 16, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, shadowColor: "#ef4444", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  sosButtonText: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  trackButton: { flex: 1, backgroundColor: "#D0A97E", paddingVertical: 16, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, shadowColor: "#D0A97E", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  trackButtonText: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
>>>>>>> 440591b6c2cbb438a22b44e13ba267368c7fc93a
});