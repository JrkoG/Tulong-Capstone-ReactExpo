import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
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
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { rtdb } from "../../config/firebase";

// ─── Constants ────────────────────────────────────────────────────────────────
const HARDCODED_GROUP_ID = "qwi4UVJBinray0ZQm95e";

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
  const isDark = useColorScheme() === "dark";
  const mapRef = useRef<MapView>(null);

  const [myLocation, setMyLocation] = useState<DeviceLocation>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [wearerDevice, setWearerDevice] = useState<WearerDevice>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

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
        },
      );
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  // ─── Wearer IoT Device ───────────────────────────────────────────────────────
  useEffect(() => {
    const trackingRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/tracking`);
    return onValue(trackingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data?.latitude && data?.longitude) {
          if (data.latitude === 0 && data.longitude === 0) return;
          setWearerDevice({
            latitude: data.latitude,
            longitude: data.longitude,
            batteryLevel: data.batteryLevel,
            lastUpdated: data.lastUpdated,
          });
        }
      }
    });
  }, []);

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
});