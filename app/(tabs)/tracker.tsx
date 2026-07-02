import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import { onValue, ref, set } from "firebase/database";
import { doc, getDoc } from "firebase/firestore";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import QuickBar from "../../components/QuickBar";
import { db, rtdb } from "../../config/firebase";
import { useAuth } from "../../context/authContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type GroupMember = { id: string; name: string; latitude: number; longitude: number; lastUpdated: number; accuracy?: number };
type WearerDevice = { latitude: number; longitude: number; batteryLevel?: number; lastUpdated?: number } | null;

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const MEMBER_COLORS = ["#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c"];

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
      <Ionicons name="watch-outline" size={16} color="#fff" />
    </View>
  );
}

function MemberMarker({ name, color, isStale }: { name: string; color: string; isStale: boolean }) {
  return (
    <View style={[markerStyles.circle, { backgroundColor: isStale ? "#888" : color, opacity: isStale ? 0.5 : 1 }]}>
      <Text style={markerStyles.initial}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  circle: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", borderWidth: 2.5, borderColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
  initial: { color: "#fff", fontWeight: "800", fontSize: 15 },
  youOuter: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#4285F4", opacity: 0.85, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  youInner: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: "#4285F4" },
});

// Dark map style configuration — makes the map itself look native-dark when
// the app is in dark mode, instead of staying bright white underneath.
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
];

export default function TrackerScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const mapRef = useRef<MapView>(null);

  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [wearerDevice, setWearerDevice] = useState<WearerDevice>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const isMovingRef = useRef(false);
  const lastBroadcastedCoords = useRef<{ latitude: number; longitude: number; accuracy?: number } | null>(null);

  // The real group + hardware device ID, resolved from Firestore.
  const [groupId, setGroupId] = useState<string | null>(null);
  const [wearerId, setWearerId] = useState<string | null>(null);

  const theme = {
    background: isDark ? "#000" : "#fff",
    text: isDark ? "#fff" : "#111",
    card: isDark ? "#1c1c1e" : "#f2f2f7",
    subText: isDark ? "#8e8e93" : "#8e8e93",
    brandGold: "#D0A97E",
    warning: "#f59e0b",
  };

  const screenOptions = {
    title: "Circle Tracker",
    headerShown: true,
    headerStyle: { backgroundColor: theme.background },
    headerTitleStyle: { color: theme.text, fontWeight: "700" as const },
    headerShadowVisible: false,
    headerLeft: () => (
      <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 16, paddingVertical: 4 }} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </TouchableOpacity>
    ),
  };

  // ─── JOB 0: Resolve the user's real group + hardware device ID ──────────────
  useEffect(() => {
    if (!user?.id) return;
    const fetchGroup = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.id));
        const gId = userDoc.exists() ? userDoc.data().groupId : null;
        if (!gId) return;
        setGroupId(gId);

        const groupDoc = await getDoc(doc(db, "groups", gId));
        if (groupDoc.exists()) {
          setWearerId(groupDoc.data().wearerId ?? null);
        }
      } catch (e) {
        console.error("Error resolving group/device:", e);
      }
    };
    fetchGroup();
  }, [user?.id]);

  // ─── JOB 1: Broadcast MY live location ──────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !groupId) return;
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: isMovingRef.current ? 3000 : 15000,
          distanceInterval: isMovingRef.current ? 5 : 20,
        },
        (location) => {
          const { latitude, longitude, accuracy, speed } = location.coords;
          const currentAccuracy = accuracy ?? 999;
          const currentSpeed = speed ?? 0;

          setMyLocation({ latitude, longitude });
          setLocationAccuracy(currentAccuracy);
          setLoading(false);
          isMovingRef.current = currentSpeed > 0.5;

          if (currentAccuracy <= 35) {
            let shouldUpdate = true;

            if (lastBroadcastedCoords.current) {
              const latDiff = Math.abs(lastBroadcastedCoords.current.latitude - latitude);
              const lngDiff = Math.abs(lastBroadcastedCoords.current.longitude - longitude);

              if (latDiff < 0.00008 && lngDiff < 0.00008) {
                shouldUpdate = false;
              }
            }

            if (shouldUpdate) {
              lastBroadcastedCoords.current = { latitude, longitude, accuracy: currentAccuracy };
              const myLocationRef = ref(rtdb, `groups/${groupId}/members/${user.id}`);
              set(myLocationRef, {
                name: user.email?.split("@")[0] || "Group Member",
                latitude,
                longitude,
                accuracy: currentAccuracy,
                speed: currentSpeed,
                heading: location.coords.heading ?? 0,
                lastUpdated: Date.now(),
              });
            }
          }
        },
      );
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [user?.id, groupId]);

  // ─── JOB 2: Listen to ALL Group Members ─────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    const membersRef = ref(rtdb, `groups/${groupId}/members`);
    return onValue(membersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const membersList = Object.keys(data).filter((key) => key !== user?.id).map((key) => ({ id: key, ...data[key] })) as GroupMember[];
        setGroupMembers(membersList);
      } else {
        setGroupMembers([]);
      }
    });
  }, [user?.id, groupId]);

  // ─── JOB 3: Wearer IoT Device ───────────────────────────────────────────────
  // Reads devices/{wearerId}/latest — the actual path the ESP32 writes to.
  // Field names match the sketch: lat/lng, batteryLevel may be absent since
  // the sample JSON in the sketch doesn't include it (only deviceStatus does).
  useEffect(() => {
    if (!wearerId) return;
    const latestRef = ref(rtdb, `devices/${wearerId}/latest`);
    return onValue(latestRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (lat && lng) {
        setWearerDevice({
          latitude: lat,
          longitude: lng,
          batteryLevel: data.batteryLevel,
          lastUpdated: data.serverTime,
        });
      }
    });
  }, [wearerId]);

  const isStale = (lastUpdated: number) => Date.now() - lastUpdated > STALE_THRESHOLD_MS;
  const getMemberColor = (index: number) => MEMBER_COLORS[index % MEMBER_COLORS.length];
  const formatLastSeen = (lastUpdated: number) => {
    const diffMin = Math.round((Date.now() - lastUpdated) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin === 1) return "1 min ago";
    return `${diffMin} min ago`;
  };

  const centerOnAll = () => {
    if (!myLocation) return;
    const coordsList = [
      myLocation,
      ...groupMembers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
      ...(wearerDevice?.latitude ? [{ latitude: wearerDevice.latitude, longitude: wearerDevice.longitude }] : []),
    ];
    mapRef.current?.fitToCoordinates(coordsList, { edgePadding: { top: 80, right: 50, bottom: 120, left: 50 }, animated: true });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={screenOptions} />
        <ActivityIndicator size="large" color={theme.brandGold} />
        <Text style={{ color: theme.subText, marginTop: 10 }}>Syncing Circle Maps...</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingHorizontal: 32 }]}>
        <Stack.Screen options={screenOptions} />
        <Ionicons name="location-outline" size={60} color={theme.brandGold} />
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700", marginTop: 16, textAlign: "center" }}>Location Access Required</Text>
        <Text style={{ color: theme.subText, marginTop: 8, textAlign: "center", lineHeight: 22 }}>CARE needs location permission to show your position on the map and keep your circle updated in real time.</Text>
        <TouchableOpacity style={[styles.permissionBtn, { backgroundColor: theme.brandGold }]} onPress={() => Linking.openSettings()}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={screenOptions} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {myLocation ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={isDark ? darkMapStyle : []}
          initialRegion={{
            latitude: myLocation.latitude,
            longitude: myLocation.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
        >
          {/* Dynamic Accuracy Uncertainty Halo (Simulates Google Maps / Life360 Indoor UI) */}
          {locationAccuracy !== null && (
            <Circle
              center={myLocation}
              radius={locationAccuracy}
              strokeColor="rgba(66, 133, 244, 0.4)"
              fillColor="rgba(66, 133, 244, 0.12)"
              strokeWidth={1.5}
            />
          )}

          <Marker coordinate={myLocation} title="You" description="Your live location" anchor={{ x: 0.5, y: 0.5 }}>
            <View collapsable={true}><YouMarker /></View>
          </Marker>

          {wearerDevice?.latitude && wearerDevice?.longitude && (
            <>
              {/* Fixed approximate range halo — the wearable hardware doesn't
                  report a real GPS accuracy value, so this is a flat 20m
                  visual indicator rather than a measured uncertainty radius. */}
              <Circle
                center={{ latitude: wearerDevice.latitude, longitude: wearerDevice.longitude }}
                radius={20}
                strokeColor="rgba(208, 169, 126, 0.5)"
                fillColor="rgba(208, 169, 126, 0.15)"
                strokeWidth={1.5}
              />
              <Marker coordinate={{ latitude: wearerDevice.latitude, longitude: wearerDevice.longitude }} title="Wearer Device" description={`Battery: ${wearerDevice.batteryLevel ?? "Unknown"}%`} anchor={{ x: 0.5, y: 0.5 }}>
                <View collapsable={true}><WearerMarker /></View>
              </Marker>
            </>
          )}

          {groupMembers.map((member, index) => (
            <Fragment key={member.id}>
              {/* Only show halo when accuracy is poor — avoids visual clutter
                  when a member has a precise fix */}
              {member.accuracy && member.accuracy > 20 && (
                <Circle
                  center={{ latitude: member.latitude, longitude: member.longitude }}
                  radius={member.accuracy}
                  strokeColor={getMemberColor(index) + "66"}
                  fillColor={getMemberColor(index) + "1A"}
                  strokeWidth={1}
                />
              )}
              <Marker
                coordinate={{ latitude: member.latitude, longitude: member.longitude }}
                title={member.name}
                description={isStale(member.lastUpdated) ? `⚠️ Last seen ${formatLastSeen(member.lastUpdated)}` : `Updated ${new Date(member.lastUpdated).toLocaleTimeString()}`}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View collapsable={true}>
                  <MemberMarker name={member.name} color={getMemberColor(index)} isStale={isStale(member.lastUpdated)} />
                </View>
              </Marker>
            </Fragment>
          ))}
        </MapView>
      ) : (
        <View style={styles.center}><Text style={{ color: theme.text }}>Please enable GPS tracking permissions.</Text></View>
      )}

      {locationAccuracy !== null && locationAccuracy > 40 && (
        <View style={[styles.accuracyBanner, { backgroundColor: theme.warning }]}>
          <Ionicons name="warning-outline" size={15} color="#fff" />
          <Text style={styles.accuracyBannerText}>Getting GPS fix... ({Math.round(locationAccuracy)}m)</Text>
        </View>
      )}

      <View style={[styles.legend, { backgroundColor: theme.card }]}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#4285F4" }]} /><Text style={[styles.legendLabel, { color: theme.subText }]}>You</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#D0A97E" }]} /><Text style={[styles.legendLabel, { color: theme.subText }]}>Wearer</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#4ade80" }]} /><Text style={[styles.legendLabel, { color: theme.subText }]}>Members</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#888" }]} /><Text style={[styles.legendLabel, { color: theme.subText }]}>Stale</Text></View>
      </View>

      <View style={styles.hudContainer}>
        <TouchableOpacity style={[styles.hudButton, { backgroundColor: theme.card }]} onPress={centerOnAll}>
          <Ionicons name="locate" size={24} color={theme.brandGold} />
          <Text style={[styles.hudText, { color: theme.text }]}>Recenter Circle</Text>
        </TouchableOpacity>
      </View>

      <QuickBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  permissionBtn: { marginTop: 24, height: 52, paddingHorizontal: 32, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  accuracyBanner: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 16 },
  accuracyBannerText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  legend: { position: "absolute", top: 12, right: 12, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, gap: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, fontWeight: "600" },
  // Bumped from 40/20 to 110/80 so the floating button sits above QuickBar
  // instead of overlapping it (matches the offset pattern used in group.tsx).
  hudContainer: { position: "absolute", bottom: Platform.OS === "ios" ? 110 : 80, left: 20, right: 20, alignItems: "center" },
  hudButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 30, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  hudText: { fontWeight: "700", fontSize: 15 },
});