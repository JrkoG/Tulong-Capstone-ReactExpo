import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import { onValue, ref, set } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [wearerDevice, setWearerDevice] = useState<WearerDevice>(null);
  const [loading, setLoading] = useState(true);

  const HARDCODED_GROUP_ID = "qwi4UVJBinray0ZQm95e";

  const theme = {
    background: isDark ? "#000" : "#fff",
    text: isDark ? "#fff" : "#111",
    card: isDark ? "#1c1c1e" : "#f2f2f7",
    subText: isDark ? "#8e8e93" : "#8e8e93",
    brandGold: "#D0A97E",
  };

  // 🛰️ JOB 1: Broadcast MY live location
  useEffect(() => {
    if (!user?.id) return;

    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLoading(false);
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        async (location) => {
          const accuracy = location.coords.accuracy ?? 999;

          // Ignore very poor GPS fixes
          if (accuracy > 50) {
            console.log(
              `Skipping inaccurate reading (${accuracy.toFixed(0)}m)`,
            );
            return;
          }
          const { latitude, longitude } = location.coords;
          setMyLocation({ latitude, longitude });
          setLoading(false);

          const myLocationRef = ref(
            rtdb,
            `groups/${HARDCODED_GROUP_ID}/members/${user.id}`,
          );
          set(myLocationRef, {
            name: user.email?.split("@")[0] || "Group Member",
            latitude: latitude,
            longitude: longitude,
            accuracy: location.coords.accuracy ?? 999,
            speed: location.coords.speed ?? 0,
            heading: location.coords.heading ?? 0,
            lastUpdated: Date.now(),
          });
        },
      );
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [user?.id]);

  // 📡 JOB 2: Listen to ALL Group Members
  useEffect(() => {
    const membersRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/members`);

    return onValue(membersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const membersList = Object.keys(data)
          .filter((key) => key !== user?.id)
          .map((key) => ({
            id: key,
            ...data[key],
          })) as GroupMember[];

        setGroupMembers(membersList);
      } else {
        setGroupMembers([]);
      }
    });
  }, [user?.id]);

  // 📡 JOB 3: Keep track of Wearer IoT Device
  useEffect(() => {
    const trackingRef = ref(rtdb, `groups/${HARDCODED_GROUP_ID}/tracking`);
    return onValue(trackingRef, (snapshot) => {
      if (snapshot.exists()) {
        setWearerDevice(snapshot.val());
      }
    });
  }, []);

  const centerOnAll = () => {
    if (!myLocation) return;

    const coordsList = [
      myLocation,
      ...groupMembers.map((m) => ({
        latitude: m.latitude,
        longitude: m.longitude,
      })),
      ...(wearerDevice?.latitude
        ? [
            {
              latitude: wearerDevice.latitude,
              longitude: wearerDevice.longitude,
            },
          ]
        : []),
    ];

    mapRef.current?.fitToCoordinates(coordsList, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.brandGold} />
        <Text style={{ color: theme.subText, marginTop: 10 }}>
          Syncing Circle Maps...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 🌟 UPDATED: Custom Top Bar navigation parameters */}
      <Stack.Screen
        options={{
          title: "Circle Tracker",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text, fontWeight: "700" },
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
        }}
      />
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
          <Marker
            coordinate={myLocation}
            title="You"
            description="Your live phone location"
            pinColor="green"
          />

          {wearerDevice?.latitude && wearerDevice?.longitude && (
            <Marker
              coordinate={{
                latitude: wearerDevice.latitude,
                longitude: wearerDevice.longitude,
              }}
              title="Wearer Core Device"
              description={`Battery: ${wearerDevice.batteryLevel || "Unknown"}%`}
              pinColor="blue"
            />
          )}

          {groupMembers.map((member) => (
            <Marker
              key={member.id}
              coordinate={{
                latitude: member.latitude,
                longitude: member.longitude,
              }}
              title={member.name}
              description={`Last seen: ${new Date(member.lastUpdated).toLocaleTimeString()}`}
              pinColor="orange"
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.center}>
          <Text style={{ color: theme.text }}>
            Please enable GPS tracking permissions.
          </Text>
        </View>
      )}

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
