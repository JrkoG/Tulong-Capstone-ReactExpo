import * as Location from "expo-location";
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import QuickBar from '../../components/QuickBar';

// Dark map style configuration
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
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';

  const theme = {
    background: isDark ? '#000000' : '#ffffff',
    text: isDark ? '#ffffff' : '#111111',
    brandGold: '#D0A97E',
  };

  const [location, setLocation] = useState<any>(null);
  const [wearerLocation, setWearerLocation] = useState<any>(null);
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

  // 2. HARD-CODED WEARER LOCATION
  useEffect(() => {
    setWearerLocation({
      latitude: 14.4589,
      longitude: 120.9603,
    });
    setActive(true);
  }, []);

  if (loading || !location) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.brandGold} />
        <Text style={{ marginTop: 10, color: theme.text }}>Waiting for GPS data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={isDark ? darkMapStyle : []} // Applies dark mode to map
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Marker 
          coordinate={location} 
          title="My Phone" 
          description="Your current location"
        />

        {active && wearerLocation && (
          <Marker
            coordinate={wearerLocation}
            title="Wearer Device"
            description="Emergency Device Location"
            pinColor="blue"
          />
        )}
      </MapView>

      <QuickBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});