import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { db, rtdb } from "../../config/firebase";
import { useAuth } from "../../context/authContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
} | null;

type WearerDevice = {
  latitude: number;
  longitude: number;
  batteryLevel?: number;
  lastUpdated?: number;
} | null;

// ─── Module-level location cache ──────────────────────────────────────────────
// Lives OUTSIDE the component so it survives remounts (tab switches). GPS
// needs a moment to "warm up" on every fresh watchPositionAsync call, which
// caused the map to briefly flicker/show a loading state each time this
// screen remounted. By caching the last known position and wearer location
// here, a remount can render immediately with the last-known state while a
// fresh GPS fix comes in quietly in the background.
let _lastKnownMyLocation: DeviceLocation = null;
let _lastKnownAccuracy: number | null = null;
let _lastKnownWearerDevice: WearerDevice = null;

// ─── Custom Markers ───────────────────────────────────────────────────────────
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
  youOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4285F4",
    opacity: 0.9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  youInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: "#fff",
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function TrackWearerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isDark = useColorScheme() === "dark";
  const mapRef = useRef<MapView>(null);

  // Initialized from the module-level cache (if any) so a remount shows the
  // last-known state immediately instead of a blank map / loading spinner.
  const [myLocation, setMyLocation] = useState<DeviceLocation>(_lastKnownMyLocation);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(_lastKnownAccuracy);
  const [wearerDevice, setWearerDevice] = useState<WearerDevice>(_lastKnownWearerDevice);
  // Skip the full-screen loading spinner if we already have a cached
  // position from a previous mount this session.
  const [loading, setLoading] = useState(_lastKnownMyLocation === null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // The real hardware device ID, resolved from the user's group in Firestore.
  const [wearerId, setWearerId] = useState<string | null>(null);

  const theme = {
    background: isDark ? "#000" : "#fff",
    card: isDark ? "#1c1c1e" : "#f2f2f7",
    text: isDark ? "#fff" : "#111",
    subText: isDark ? "#8e8e93" : "#8e8e93",
    brandGold: "#D0A97E",
    border: isDark ? "#333" : "rgba(0,0,0,0.08)",
  };

  // ─── My Location ─────────────────────────────────────────────────────────────
  useEffect(() => {
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
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (location) => {
          const { latitude, longitude, accuracy } = location.coords;
          setMyLocation({ latitude, longitude, accuracy: accuracy ?? 999 });
          setLocationAccuracy(accuracy ?? null);
          setLoading(false);

          // Keep the module-level cache current so the NEXT remount of this
          // screen starts from this fresh position instead of stale data.
          _lastKnownMyLocation = { latitude, longitude, accuracy: accuracy ?? 999 };
          _lastKnownAccuracy = accuracy ?? null;
        },
      );
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  // ─── Resolve the user's hardware device ID ───────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const fetchGroup = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.id));
        const gId = userDoc.exists() ? userDoc.data().groupId : null;
        if (!gId) return;

        const groupDoc = await getDoc(doc(db, "groups", gId));
        if (groupDoc.exists()) {
          setWearerId(groupDoc.data().wearerId ?? null);
        }
      } catch (e) {
        console.error("Error resolving device:", e);
      }
    };
    fetchGroup();
  }, [user?.id]);

  // ─── Wearer IoT Device ───────────────────────────────────────────────────────
  // Reads devices/{wearerId}/latest — the actual path the ESP32 writes to.
  // lat/lng can arrive as empty strings "" before the device gets a GPS fix,
  // so Number(...) + truthy check guards against plotting a false (0,0).
  useEffect(() => {
    if (!wearerId) return;
    const latestRef = ref(rtdb, `devices/${wearerId}/latest`);
    return onValue(latestRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (lat && lng) {
        const wearerData = {
          latitude: lat,
          longitude: lng,
          batteryLevel: data.batteryLevel,
          lastUpdated: data.serverTime,
        };
        setWearerDevice(wearerData);
        _lastKnownWearerDevice = wearerData; // cache for the next remount
      }
    });
  }, [wearerId]);

  // ─── Fit both markers in view ─────────────────────────────────────────────
  const fitBothInView = () => {
    if (!myLocation) return;
    const coords = [
      { latitude: myLocation.latitude, longitude: myLocation.longitude },
      ...(wearerDevice?.latitude
        ? [{ latitude: wearerDevice.latitude, longitude: wearerDevice.longitude }]
        : []),
    ];
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 100, right: 60, bottom: 100, left: 60 },
      animated: true,
    });
  };

  // Opens the native Maps app with turn-by-turn directions to the wearer.
  // Hands off to Apple Maps (iOS) or Google Maps app (Android) — no Directions
  // API billing required. Falls back to the Google Maps web URL if the native
  // scheme fails to open (e.g. no maps app installed).
  const openDirections = () => {
    if (!wearerDevice?.latitude || !wearerDevice?.longitude) {
      Alert.alert("No Location", "Wearer's location is not available yet.");
      return;
    }
    const { latitude, longitude } = wearerDevice;
    const nativeUrl = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
    });
    const webFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    Linking.openURL(nativeUrl!).catch(() => {
      Linking.openURL(webFallbackUrl).catch(() => {
        Alert.alert("Error", "Could not open Maps for directions.");
      });
    });
  };

  const formatLastSeen = (ts?: number) => {
    if (!ts) return "Unknown";
    const diffMin = Math.round((Date.now() - ts) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin === 1) return "1 min ago";
    return `${diffMin} min ago`;
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <ActivityIndicator size="large" color={theme.brandGold} />
        <Text style={{ color: theme.subText, marginTop: 12 }}>
          Acquiring GPS signal...
        </Text>
      </View>
    );
  }

  // ─── Permission denied ────────────────────────────────────────────────────
  if (permissionDenied) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingHorizontal: 32 }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        {/* Back button */}
        <TouchableOpacity style={styles.backBtnAbsolute} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Ionicons name="location-outline" size={60} color={theme.brandGold} />
        <Text style={[styles.permissionTitle, { color: theme.text }]}>
          Location Required
        </Text>
        <Text style={[styles.permissionSub, { color: theme.subText }]}>
          CARE needs location permission to show your position relative to the wearer.
        </Text>
        <TouchableOpacity
          style={[styles.openSettingsBtn, { backgroundColor: theme.brandGold }]}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.openSettingsBtnText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Main view ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ── Top bar ── */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Platform.OS === "ios" ? 60 : 40,
            backgroundColor: theme.background,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.topBarTitle, { color: theme.text }]}>Track Wearer</Text>
          {/* Accuracy pill */}
          {locationAccuracy !== null && (
            <View style={styles.accuracyPill}>
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
              <Text style={styles.accuracyText}>
                {locationAccuracy <= 40
                  ? `±${Math.round(locationAccuracy)}m`
                  : "Getting fix..."}
              </Text>
            </View>
          )}
        </View>

        {/* Fit both in view button */}
        <TouchableOpacity
          style={styles.fitBtn}
          onPress={fitBothInView}
          activeOpacity={0.7}
        >
          <Ionicons name="scan-outline" size={22} color={theme.brandGold} />
        </TouchableOpacity>
      </View>

      {/* ── Map ── */}
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
          onMapReady={fitBothInView}
        >
          {/* Accuracy halo circle for phone */}
          {locationAccuracy !== null && (
            <Circle
              center={{
                latitude: myLocation.latitude,
                longitude: myLocation.longitude,
              }}
              radius={locationAccuracy}
              strokeColor="rgba(66, 133, 244, 0.4)"
              fillColor="rgba(66, 133, 244, 0.12)"
              strokeWidth={1.5}
            />
          )}

          {/* Phone marker */}
          <Marker
            coordinate={{
              latitude: myLocation.latitude,
              longitude: myLocation.longitude,
            }}
            title="You"
            description="Your current location"
            anchor={{ x: 0.5, y: 0.5 }}
            collapsable={false}
          >
            <YouMarker />
          </Marker>

          {/* Wearer marker + accuracy halo */}
          {wearerDevice?.latitude && wearerDevice?.longitude && (
            <>
              <Circle
                center={{
                  latitude: wearerDevice.latitude,
                  longitude: wearerDevice.longitude,
                }}
                radius={20}
                strokeColor="rgba(208, 169, 126, 0.5)"
                fillColor="rgba(208, 169, 126, 0.15)"
                strokeWidth={1.5}
              />
              <Marker
                coordinate={{
                  latitude: wearerDevice.latitude,
                  longitude: wearerDevice.longitude,
                }}
                title="Wearer"
                description={`Last seen: ${formatLastSeen(wearerDevice.lastUpdated)} · Battery: ${wearerDevice.batteryLevel ?? "Unknown"}%`}
                anchor={{ x: 0.5, y: 0.5 }}
                collapsable={false}
              >
                <WearerMarker />
              </Marker>
            </>
          )}
        </MapView>
      ) : (
        <View style={styles.center}>
          <Text style={{ color: theme.text }}>Enable GPS to track location.</Text>
        </View>
      )}

      {/* ── Bottom info card ── */}
      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: theme.card,
            bottom: Platform.OS === "ios" ? 40 : 24,
          },
        ]}
      >
        {/* Phone row */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIcon, { backgroundColor: "rgba(66,133,244,0.15)" }]}>
            <Ionicons name="phone-portrait-outline" size={16} color="#4285F4" />
          </View>
          <View style={styles.infoText}>
            <Text style={[styles.infoLabel, { color: theme.subText }]}>Your Phone</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {myLocation
                ? `${myLocation.latitude.toFixed(5)}, ${myLocation.longitude.toFixed(5)}`
                : "Locating..."}
            </Text>
          </View>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: myLocation ? "#4ade80" : "#888" },
            ]}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Wearer row */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIcon, { backgroundColor: "rgba(208,169,126,0.15)" }]}>
            <Ionicons name="watch-outline" size={16} color="#D0A97E" />
          </View>
          <View style={styles.infoText}>
            <Text style={[styles.infoLabel, { color: theme.subText }]}>Wearer Device</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {wearerDevice
                ? `${wearerDevice.latitude.toFixed(5)}, ${wearerDevice.longitude.toFixed(5)}`
                : "No signal yet"}
            </Text>
            {wearerDevice?.lastUpdated && (
              <Text style={[styles.infoSub, { color: theme.subText }]}>
                Last seen {formatLastSeen(wearerDevice.lastUpdated)}
                {wearerDevice.batteryLevel !== undefined
                  ? ` · 🔋 ${wearerDevice.batteryLevel}%`
                  : ""}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: wearerDevice ? "#D0A97E" : "#888" },
            ]}
          />
        </View>

        {/* Get Directions — only shown once the wearer's location is known */}
        {wearerDevice && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <TouchableOpacity
              style={[styles.directionsBtn, { backgroundColor: theme.brandGold }]}
              onPress={openDirections}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.directionsBtnText}>Get Directions to Wearer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  backBtnAbsolute: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 16,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  topBarCenter: { flex: 1, alignItems: "center", gap: 4 },
  topBarTitle: { fontSize: 17, fontWeight: "700" },
  accuracyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(128,128,128,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  accuracyDot: { width: 7, height: 7, borderRadius: 3.5 },
  accuracyText: { fontSize: 11, color: "#888", fontWeight: "600" },
  fitBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },

  // Permission denied
  permissionTitle: { fontSize: 20, fontWeight: "700", marginTop: 16, textAlign: "center" },
  permissionSub: { fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 22 },
  openSettingsBtn: {
    marginTop: 24,
    height: 52,
    paddingHorizontal: 32,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  openSettingsBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // Bottom info card
  infoCard: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  infoValue: { fontSize: 13, fontWeight: "600", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  infoSub: { fontSize: 11 },
  statusDot: { width: 9, height: 9, borderRadius: 4.5 },
  divider: { height: 1, marginVertical: 2 },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 6,
  },
  directionsBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});