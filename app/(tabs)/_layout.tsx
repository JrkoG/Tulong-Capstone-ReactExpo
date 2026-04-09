import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366f1',
        
        tabBarInactiveTintColor: isDark ? '#666666' : '#999999',

        tabBarStyle: {
          backgroundColor: isDark ? '#0d0d14' : '#FFFFFF',
          borderTopColor: isDark ? '#1f1f2e' : '#E5E5E5', 
          height: 65,
          paddingBottom: 10,
          paddingTop: 5,
          elevation: isDark ? 0 : 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0 : 0.05,
          shadowRadius: 10,
        },

        headerStyle: {
          backgroundColor: isDark ? '#0d0d14' : '#FFFFFF',
          borderBottomWidth: 0, 
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
          href: null, 
          tabBarStyle: { display: 'none' }, 
        }}
      />
      <Tabs.Screen
        name="group"
        options={{
          title: 'Group',
          tabBarIcon: ({ color }) => (
            <Ionicons name="people-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}