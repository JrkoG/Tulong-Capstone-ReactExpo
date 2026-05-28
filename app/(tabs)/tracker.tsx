import * as Location from "expo-location";
import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import QuickBar from '../../components/QuickBar';

// Official Google Maps Dark Theme JSON Array
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3f4f6" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];

export default function TrackerScreen() {
  const router = useRouter(); 
  const isDark = useColorScheme() === 'dark'; 
  const pathname = usePathname();
  
  const theme = {
    background: isDark ? '#000' : '#fff',
    text: isDark ? '#fff' : '#111',
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
        // Dynamically applies dark skin styling array if system is set to dark theme
        customMapStyle={isDark ? darkMapStyle : []}
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

      {/* --- FLOATING QUICK BAR --- */}
      <QuickBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  quickBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 35 : 20, 
    left: 20,
    right: 20,
    height: 65,
    borderRadius: 32.5,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
});