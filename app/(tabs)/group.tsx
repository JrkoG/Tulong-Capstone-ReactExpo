import { collection, doc, getDoc, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme
} from 'react-native';
import { db } from '../../config/firebase'; // Ensure rtdb is imported
import { useAuth } from '../../context/authContext';

type GroupMember = {
  id: string;
  name: string;
  email: string;
  status: 'Available' | 'Not Available';
  location: { latitude: number; longitude: number } | null;
};

export default function GroupScreen() {
  const { user } = useAuth();
  const isDark = useColorScheme() === 'dark';
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const theme = {
    background: isDark ? '#000' : '#fff',
    text: isDark ? '#fff' : '#111',
    card: isDark ? '#111' : '#f9f9f9',
    border: isDark ? '#222' : 'rgba(0,0,0,0.06)',
  };

  // 1. Fetch User's Group ID
  useEffect(() => {
    if (!user?.id) return;

    const fetchUserGroup = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
          setGroupId(userDoc.data().groupId || null);
        }
      } catch (e) {
        console.error("Error fetching group ID:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchUserGroup();
  }, [user?.id]);

  // 2. Listen to Group Members (Firestore)
  useEffect(() => {
    if (!user?.id || !groupId) return;

    const q = query(collection(db, 'groups', groupId, 'members'));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as GroupMember[]);
    }, (err) => {
      console.log("Group listener permission error:", err);
    });

    return () => unsub();
  }, [user?.id, groupId]);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>My Group</Text>
      <ScrollView contentContainerStyle={styles.scroll}>
        {members.length > 0 ? (
          members.map(member => (
            <View key={member.id} style={[styles.memberCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.memberName, { color: theme.text }]}>{member.name}</Text>
              <Text style={{ color: member.status === 'Available' ? '#4ade80' : '#f87171' }}>
                ● {member.status}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.noGroup}>
            <Text style={{ color: theme.text }}>You are not in a group yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', marginLeft: 20, marginBottom: 20 },
  scroll: { paddingHorizontal: 20 },
  memberCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  memberName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  noGroup: { alignItems: 'center', marginTop: 100 }
});