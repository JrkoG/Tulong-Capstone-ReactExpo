import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/authContext';

export default function Index() {
  const { user, isLoadingAuth } = useAuth();

  // Wait for Firebase to resolve any persisted session before redirecting.
  // Without this, a logged-in user could get bounced to /login during the
  // brief window before onAuthStateChanged fires for the first time.
  if (isLoadingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={user ? '/(tabs)/dashboard' : '/(auth)/login'} />;
}