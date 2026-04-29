import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/authContext';

type GroupMember = {
  id: string;
  name: string;
  email: string;
  status: 'Available' | 'Not Available';
};

export default function GroupScreen() {
  const { user } = useAuth();
  const isDark = useColorScheme() === 'dark';

  // Theme configuration
  const theme = {
    background: isDark ? '#000' : '#fff',
    text: isDark ? '#fff' : '#111',
    subText: isDark ? '#888' : '#666',
    card: isDark ? '#111' : '#f9f9f9',
    border: isDark ? '#222' : 'rgba(0,0,0,0.06)',
    brandGold: '#D0A97E',
  };

  // State
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [wearerName, setWearerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Fetch User's Group ID
  useEffect(() => {
    if (!user?.id) return;
    const fetchUserGroup = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists() && userDoc.data().groupId) {
          setGroupId(userDoc.data().groupId);
        }
      } catch (e) {
        console.error("Error fetching group:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchUserGroup();
  }, [user?.id]);

  // 2. Listen to Members
  useEffect(() => {
    if (!groupId) return;
    const q = query(collection(db, 'groups', groupId, 'members'));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupMember)));
    });
    return () => unsub();
  }, [groupId]);

  // 3. Create Group Logic
  const handleCreateGroup = async () => {
    if (!groupName || !wearerName || !user?.id) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setActionLoading(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: groupName,
        wearerName: wearerName,
        joinCode: code,
        createdBy: user.id,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'groups', groupRef.id, 'members', user.id), {
        name: user.email?.split('@')[0] || 'Guardian',
        email: user.email,
        status: 'Available',
        lastSeen: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', user.id), { groupId: groupRef.id });
      setGroupId(groupRef.id);
      Alert.alert("Success", `Group created! Join Code: ${code}`);
    } catch (error) {
      Alert.alert("Error", "Could not create group. Check Firebase rules.");
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Join Group Logic
  const handleJoinGroup = async () => {
    if (!joinCode || !user?.id) {
      Alert.alert("Error", "Please enter a join code");
      return;
    }
    setActionLoading(true);
    try {
      const q = query(collection(db, 'groups'), where('joinCode', '==', joinCode.toUpperCase().trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert("Error", "Invalid code");
        return;
      }

      const foundId = snap.docs[0].id;
      await setDoc(doc(db, 'groups', foundId, 'members', user.id), {
        name: user.email?.split('@')[0] || 'Guardian',
        email: user.email,
        status: 'Available',
        lastSeen: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', user.id), { groupId: foundId });
      setGroupId(foundId);
    } catch (error) {
      Alert.alert("Error", "Failed to join group");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.brandGold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Guardian Group</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!groupId ? (
          <View style={styles.noGroupContainer}>
            <Ionicons name="people-outline" size={80} color={theme.brandGold} />
            <Text style={[styles.noGroupText, { color: theme.text }]}>Manage Your Group</Text>

            {!showCreate && !showJoin ? (
              <View style={{ width: '100%', gap: 12 }}>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowCreate(true)}>
                  <Text style={styles.btnText}>Create New Group</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowJoin(true)}>
                  <Text style={[styles.btnText, { color: theme.brandGold }]}>Join Existing Group</Text>
                </TouchableOpacity>
              </View>
            ) : showCreate ? (
              <View style={styles.form}>
                <TextInput 
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]} 
                  placeholder="Group Name" 
                  placeholderTextColor={theme.subText}
                  value={groupName}
                  onChangeText={setGroupName}
                />
                <TextInput 
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]} 
                  placeholder="Wearer Name" 
                  placeholderTextColor={theme.subText}
                  value={wearerName}
                  onChangeText={setWearerName}
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateGroup} disabled={actionLoading}>
                  {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirm & Create</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowCreate(false)}>
                  <Text style={{ color: theme.subText, marginTop: 15, textAlign: 'center' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.form}>
                <TextInput 
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]} 
                  placeholder="Enter 6-digit Code" 
                  placeholderTextColor={theme.subText}
                  autoCapitalize="characters"
                  value={joinCode}
                  onChangeText={setJoinCode}
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleJoinGroup} disabled={actionLoading}>
                  {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Join Group</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowJoin(false)}>
                  <Text style={{ color: theme.subText, marginTop: 15, textAlign: 'center' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Members</Text>
            {members.map(member => (
              <View key={member.id} style={[styles.memberCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.memberName, { color: theme.text }]}>{member.name}</Text>
                <Text style={{ color: member.status === 'Available' ? '#4ade80' : '#f87171' }}>● {member.status}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  scroll: { padding: 20 },
  noGroupContainer: { alignItems: 'center', marginTop: 20 },
  noGroupText: { fontSize: 18, fontWeight: '600', marginVertical: 20 },
  primaryBtn: { backgroundColor: '#D0A97E', padding: 18, borderRadius: 12, width: '100%', alignItems: 'center' },
  secondaryBtn: { borderWidth: 2, borderColor: '#D0A97E', padding: 18, borderRadius: 12, width: '100%', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  form: { width: '100%' },
  input: { width: '100%', borderWidth: 1, padding: 15, borderRadius: 12, marginBottom: 12, fontSize: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 15 },
  memberCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { fontSize: 16, fontWeight: '600' }
});