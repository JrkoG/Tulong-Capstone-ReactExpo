import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native'; // Added View for layout flexibility

export default function TabsLayout() {
  // 1. This detects the phone's current theme (light or dark)
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        // The active icon color (Your Indigo/Purple)
        tabBarActiveTintColor: '#6366f1',
        
        // The inactive icon color
        tabBarInactiveTintColor: isDark ? '#666666' : '#999999',

        // 2. SMART TAB BAR COLORING
        tabBarStyle: {
          backgroundColor: isDark ? '#0d0d14' : '#FFFFFF', // Your dark vs Pure White
          borderTopColor: isDark ? '#1f1f2e' : '#E5E5E5', // Subtle divider line
          height: 65,
          paddingBottom: 10,
          paddingTop: 5,
          // UI Suggestion: Add a subtle shadow for Light Mode to give it depth
          elevation: isDark ? 0 : 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0 : 0.05,
          shadowRadius: 10,
        },

        // 3. SMART HEADER COLORING
        headerStyle: {
          backgroundColor: isDark ? '#0d0d14' : '#FFFFFF',
          borderBottomWidth: 0, // Makes it look cleaner/seamless
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          color: isDark ? '#FFFFFF' : '#1A1A1E',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-contact"
        options={{
          href: null, // Hides it from the tab bar
          tabBarStyle: { display: 'none' }, // Hides bar when on this screen
        }}
      />
    </Tabs>
  );
}