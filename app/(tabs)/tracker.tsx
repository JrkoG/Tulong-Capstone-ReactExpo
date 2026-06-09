import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import { onValue, ref, set } from "firebase/database";
import { useEffect, useRef, useState } from "react";
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
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { rtdb } from "../../config/firebase";
import { useAuth } from "../../context/authContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type GroupMember = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lastUpdated: number;
};

type WearerDevice = {
  latitude: number;
  longitude: number;
  batteryLevel?: number;
  lastUpdated?: number;
} | null;

// ─── Constants ────────────────────────────────────────────────────────────────
const HARDCODED_GROUP_ID = "qwi4UVJBinray0ZQm95e";
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const MEMBER_COLORS = ["#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c"];

// ─── Custom Markers ───────────────────────────────────────────────────────────

// Pulsing blue dot — like Google Maps "You are here"
function YouMarker() {
  return (
    <View style={markerStyles.youOuter}>
      <View style={markerStyles.youInner} />
    </View>
  );
}

// Gold icon for the IoT wearable device
function WearerMarker() {
  return (
    <View style={[markerStyles.circle, { backgroundColor: "#D0A97E" }]}>
      <Ionicons name="watch-outline" size={16} color="#fff" />
    </View>
  );
}

// Circular avatar with member initial — grayed out if location is stale
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  initial: { color: "#fff", fontWeight: "800", fontSize: 15 },
  youOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    // Solid color required on Android — rgba transparency causes custom markers to drop
    backgroundColor: "#4285F4",
    opacity: 0.85,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  youInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: "#4285F4",
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function TrackerScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const mapRef = useRef<MapView>(null);

  const [myLocation, setMyLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [wearerDevice, setWearerDevice] = useState<WearerDevice>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Track movement via ref to avoid recreating the subscription on every speed change
  const isMovingRef = useRef(false);

  const theme = {
    background: isDark ? "#000" : "#fff",
    text: isDark ? "#fff" : "#111",
    card: isDark ? "#1c1c1e" : "#f2f2f7",
    subText: isDark ? "#8e8e93" : "#8e8e93",
    brandGold: "#D0A97E",
    warning: "#f59e0b",
  };

  // ─── Header options (shared across states) ──────────────────────────────────
  const screenOptions = {
    title: "Circle Tracker",
    headerShown: true,
    headerStyle: { backgroundColor: theme.background },
    headerTitleStyle: { color: theme.text, fontWeight: "700" as const },
    headerShadowVisible: false,
    headerLeft: () => (
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ paddingRight: 16, paddingVertical: 4 }}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </TouchableOpacity>
    ),
  };

  // ─── JOB 1: Broadcast MY live location ──────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
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
          // Highest = raw GPS only, no road-snapping navigation bias
          accuracy: Location.Accuracy.Highest,
          // Adaptive: 3s when moving, 15s when still — saves battery
          timeInterval: isMovingRef.current ? 3000 : 15000,
          distanceInterval: isMovingRef.current ? 5 : 20,
        },
        (location) => {
          const { latitude, longitude, accuracy, speed } = location.coords;
          const currentAccuracy = accuracy ?? 999;
          const currentSpeed = speed ?? 0;

          // ✅ ALWAYS update local state — user sees their position immediately
          // even during GPS warm-up (first 10–20 sec when accuracy is 50–200m)
          setMyLocation({ latitude, longitude });
          setLocationAccuracy(currentAccuracy);
          setLoading(false);

          // Update movement tracking ref (no re-render needed)
          isMovingRef.current = currentSpeed > 0.5; // > 0.5 m/s ≈ walking speed

          // ✅ Only broadcast to RTDB when fix is good (≤50m)
          // Prevents jittery positions for other group members
          if (currentAccuracy <= 50) {
            const myLocationRef = ref(
              rtdb,
              `groups/${HARDCODED_GROUP_ID}/members/${user.id}`,
            );
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
        },
      );
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [user?.id]);

  // ─── JOB 2: Listen to ALL Group Members ─────────────────────────────────────
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

  // ─── JOB 3: Wearer IoT Device ───────────────────────────────────────────────
  useEffect(() => {
    const trackingRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/tracking`);
    return onValue(trackingRef, (snapshot) => {
      if (snapshot.exists()) setWearerDevice(snapshot.val());
    });
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const isStale = (lastUpdated: number) =>
    Date.now() - lastUpdated > STALE_THRESHOLD_MS;

  const getMemberColor = (index: number) =>
    MEMBER_COLORS[index % MEMBER_COLORS.length];

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
      ...(wearerDevice?.latitude
        ? [{ latitude: wearerDevice.latitude, longitude: wearerDevice.longitude }]
        : []),
    ];
    mapRef.current?.fitToCoordinates(coordsList, {
      edgePadding: { top: 80, right: 50, bottom: 120, left: 50 },
      animated: true,
    });
  };

  // ─── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={screenOptions} />
        <ActivityIndicator size="large" color={theme.brandGold} />
        <Text style={{ color: theme.subText, marginTop: 10 }}>
          Syncing Circle Maps...
        </Text>
      </View>
    );
  }

  // ─── Permission denied state ──────────────────────────────────────────────────
  if (permissionDenied) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: theme.background, paddingHorizontal: 32 },
        ]}
      >
        <Stack.Screen options={screenOptions} />
        <Ionicons name="location-outline" size={60} color={theme.brandGold} />
        <Text
          style={{
            color: theme.text,
            fontSize: 18,
            fontWeight: "700",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          Location Access Required
        </Text>
        <Text
          style={{
            color: theme.subText,
            marginTop: 8,
            textAlign: "center",
            lineHeight: 22,
          }}
        >
          CARE needs location permission to show your position on the map and
          keep your circle updated in real time.
        </Text>
        <TouchableOpacity
          style={[styles.permissionBtn, { backgroundColor: theme.brandGold }]}
          onPress={() => Linking.openSettings()}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            Open Settings
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Main map view ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={screenOptions} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {myLocation ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: myLocation.latitude,
            longitude: myLocation.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
        >
          {/* My location — blue dot style */}
          <Marker
            coordinate={myLocation}
            title="You"
            description="Your live location"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={true}
          >
            {/* collapsable={false} required on Android to prevent custom view being dropped */}
            <View collapsable={true}>
              <YouMarker />
            </View>
          </Marker>

          {/* Wearer IoT device */}
          {wearerDevice?.latitude && wearerDevice?.longitude && (
            <Marker
              coordinate={{
                latitude: wearerDevice.latitude,
                longitude: wearerDevice.longitude,
              }}
              title="Wearer Device"
              description={`Battery: ${wearerDevice.batteryLevel ?? "Unknown"}%`}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={true}
            >
              <View collapsable={true}>
                <WearerMarker />
              </View>
            </Marker>
          )}

          {/* Group members with avatar initials */}
          {groupMembers.map((member, index) => (
            <Marker
              key={member.id}
              coordinate={{
                latitude: member.latitude,
                longitude: member.longitude,
              }}
              title={member.name}
              description={
                isStale(member.lastUpdated)
                  ? `⚠️ Last seen ${formatLastSeen(member.lastUpdated)}`
                  : `Updated ${new Date(member.lastUpdated).toLocaleTimeString()}`
              }
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={true}
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
        <View style={styles.center}>
          <Text style={{ color: theme.text }}>
            Please enable GPS tracking permissions.
          </Text>
        </View>
      )}

      {/* GPS accuracy warning banner — shown while getting a fix */}
      {locationAccuracy !== null && locationAccuracy > 50 && (
        <View style={[styles.accuracyBanner, { backgroundColor: theme.warning }]}>
          <Ionicons name="warning-outline" size={15} color="#fff" />
          <Text style={styles.accuracyBannerText}>
            Getting GPS fix... ({Math.round(locationAccuracy)}m)
          </Text>
        </View>
      )}

      {/* Map legend */}
      <View style={[styles.legend, { backgroundColor: theme.card }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#4285F4" }]} />
          <Text style={[styles.legendLabel, { color: theme.subText }]}>You</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#D0A97E" }]} />
          <Text style={[styles.legendLabel, { color: theme.subText }]}>Wearer</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#4ade80" }]} />
          <Text style={[styles.legendLabel, { color: theme.subText }]}>Members</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#888" }]} />
          <Text style={[styles.legendLabel, { color: theme.subText }]}>Stale</Text>
        </View>
      </View>

      {/* Recenter HUD button */}
      <View style={styles.hudContainer}>
        <TouchableOpacity
          style={[styles.hudButton, { backgroundColor: theme.card }]}
          onPress={centerOnAll}
        >
          <Ionicons name="locate" size={24} color={theme.brandGold} />
          <Text style={[styles.hudText, { color: theme.text }]}>
            Recenter Circle
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  permissionBtn: {
    marginTop: 24,
    height: 52,
    paddingHorizontal: 32,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  // Amber banner at the top of the map during GPS warm-up
  accuracyBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  accuracyBannerText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  // Compact legend card in top-right
  legend: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, fontWeight: "600" },
  hudContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 40 : 20,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  hudButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  hudText: { fontWeight: "700", fontSize: 15 },
});