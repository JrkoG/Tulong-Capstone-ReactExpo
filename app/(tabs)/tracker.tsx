import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

export default function TrackerScreen() {
  const [location, setLocation] = useState<any>(null);
  const [wearerLocation, setWearerLocation] = useState<any>(null); // State for the wearer
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. GPS (YOUR PHONE LOCATION)
  useEffect(() => {
    let subscription: Location.LocationSubscription;

    const startGPS = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
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
    return () => subscription?.remove();
  }, []);

  // 🔥 2. HARD-CODED WEARER LOCATION (MOCK DATA)
  useEffect(() => {
    // This overrides the Firebase data for testing
    // Change these numbers to whatever location you want to test!
    const mockLat = 14.4589; // Example: Manila
    const mockLng = 120.9603;

    setWearerLocation({
      latitude: mockLat,
      longitude: mockLng,
    });
    setActive(true); // Force the marker to be visible
    
    /* // Commented out the real Firebase logic while testing
    const emergencyRef = ref(rtdb, "emergency");
    const unsub = onValue(emergencyRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.latitude && data?.longitude) {
        setWearerLocation({ latitude: data.latitude, longitude: data.longitude });
        setActive(true);
      }
    });
    return () => unsub(); 
    */
  }, []);

  if (loading || !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D0A97E" />
        <Text style={{ marginTop: 10 }}>Waiting for GPS data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05, // Slightly zoomed out to see both markers
          longitudeDelta: 0.05,
        }}
      >
        {/* YOUR LOCATION (Phone) */}
        <Marker 
          coordinate={location} 
          title="My Phone" 
          description="Your current location"
        />

        {/* WEARER LOCATION (Mocked Hardware) */}
        {active && wearerLocation && (
          <Marker
            coordinate={wearerLocation}
            title="Wearer Device"
            description="Emergency Device Location"
            pinColor="blue" // Blue for the wearer
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});