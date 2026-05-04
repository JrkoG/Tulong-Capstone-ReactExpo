import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';

export default function QuickBar() {
  const router = useRouter();
  const pathname = usePathname();
  const isDark = useColorScheme() === 'dark';

  const theme = {
    brandGold: '#D0A97E',
    inactive: isDark ? '#888' : '#666',
    background: isDark ? '#1A1A1A' : '#FFFFFF',
  };

  const tabs = [
    { name: 'Dashboard', path: '/(tabs)/dashboard', icon: 'grid' },
    { name: 'Group', path: '/(tabs)/group', icon: 'people' },
    { name: 'Tracker', path: '/(tabs)/tracker', icon: 'location' },
  ];

  return (
    <View style={[styles.quickBar, { backgroundColor: theme.background }]}>
      {tabs.map((tab) => {
        const isActive = pathname.includes(tab.path.split('/').pop()!);
        return (
          <TouchableOpacity 
            key={tab.name} 
            onPress={() => router.push(tab.path as any)} 
            style={styles.tabItem}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={24} 
              color={isActive ? theme.brandGold : theme.inactive} 
            />
            <Text style={{ 
              fontSize: 10, 
              color: isActive ? theme.brandGold : theme.inactive,
              fontWeight: isActive ? '700' : '400' 
            }}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
  tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
});