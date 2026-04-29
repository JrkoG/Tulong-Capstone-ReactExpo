import * as Location from "expo-location";
import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { rtdb } from "../../config/firebase";

export default function TrackerScreen() {
  const [location, setLocation] = useState<any>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);

  // 🔥 1. GPS (YOUR PHONE LOCATION)
  useEffect(() => {
    let subscription: Location.LocationSubscription;

    const startGPS = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      console.log("GPS permission:", status);

      if (status !== "granted") {
        setLoading(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({});

      setLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      setLoading(false);

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 2,
        },
        (loc) => {
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      );
    };

    startGPS();

    return () => {
      subscription?.remove();
    };
  }, []);

  // 🔥 2. FIREBASE (WEARER / EMERGENCY DEVICE)
  useEffect(() => {
    const emergencyRef = ref(rtdb, "emergency");

    const unsub = onValue(emergencyRef, (snapshot) => {
      const data = snapshot.val();

      if (data?.latitude && data?.longitude) {
        setActive(!!data.status);
      }
    });

    return () => unsub();
  }, []);

  // 🔴 LOADING STATE
  if (loading || !location) {
    return (
      <View style={styles.center}>
        <Text>Waiting for GPS data...</Text>
      </View>
    );
  }

  // 🔵 MAP
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={{
          ...location,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* YOUR LOCATION */}
        <Marker coordinate={location} title="You" />

        {/* EMERGENCY */}
        {active && (
          <Marker
            coordinate={location}
            title="🚨 Emergency Active"
            pinColor="red"
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});