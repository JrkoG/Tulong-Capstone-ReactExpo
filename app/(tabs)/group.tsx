import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
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
import { useEffect, useRef, useState } from 'react';
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
    useColorScheme,
} from 'react-native';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/authContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type GroupMember = {
  id: string;
  name: string;
  email: string;
  status: 'Available' | 'Not Available';
  distance: number | null;
  location: { latitude: number; longitude: number } | null;
  lastSeen: any;
  isCreator: boolean;
};

type Group = {
  id: string;
  name: string;
  wearerId: string;
  wearerName: string;
  joinCode: string;
  createdAt: any;
};

// ─── Haversine distance formula ───────────────────────────────────────────────
function getDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Generate random 6-char join code ─────────────────────────────────────────
function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function GroupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const theme = {
    background: isDark ? '#000000' : '#FFFFFF',
    card: isDark ? '#111111' : '#F9F9F9',
    text: isDark ? '#FFFFFF' : '#1C1C1E',
    subText: isDark ? '#888888' : '#666666',
    border: isDark ? '#222222' : 'rgba(0,0,0,0.06)',
    accent: isDark ? '#FFFFFF' : '#000000',
    success: '#4ade80',
    danger: '#f87171',
    warning: '#fb923c',
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading]               = useState(true);
  const [group, setGroup]                   = useState<Group | null>(null);
  const [members, setMembers]               = useState<GroupMember[]>([]);
  const [myStatus, setMyStatus]             = useState<'Available' | 'Not Available'>('Available');
  const [wearerLocation, setWearerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [myLocation, setMyLocation]         = useState<{ latitude: number; longitude: number } | null>(null);
  const [statusLoading, setStatusLoading]   = useState(false);

  // Create group state
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName]   = useState('');
  const [wearerName, setWearerName] = useState('');
  const [creating, setCreating]     = useState(false);

  // Join group state
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining]   = useState(false);

  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  // ── On mount: check if user is already in a group ──────────────────────────
  useEffect(() => {
    if (!user) return;
    checkExistingGroup();
    return () => {
      if (locationWatcher.current) locationWatcher.current.remove();
    };
  }, [user]);

  // ── Check group from user document ────────────────────────────────────────
  const checkExistingGroup = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.id));
      if (userDoc.exists() && userDoc.data().groupId) {
        loadGroup(userDoc.data().groupId);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error('Error checking group:', e);
      setLoading(false);
    }
  };

  // ── Load group and listen to real-time updates ─────────────────────────────
  const loadGroup = (groupId: string) => {
    // Listen to group document
    onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (snap.exists()) {
        setGroup({ id: snap.id, ...snap.data() } as Group);
      }
    });

    // Listen to members subcollection
    onSnapshot(collection(db, 'groups', groupId, 'members'), (snap) => {
      const list: GroupMember[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as GroupMember[];
      setMembers(list);

      // Sync my status
      const me = list.find((m) => m.id === user?.id);
      if (me) setMyStatus(me.status);
    });

    // Listen to wearer location
    onSnapshot(collection(db, 'groups', groupId, 'wearerLocation'), (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setWearerLocation({ latitude: data.latitude, longitude: data.longitude });
      }
    });

    setLoading(false);
    startLocationTracking(groupId);
  };

  // ── Start tracking my location and update Firestore ───────────────────────
  const startLocationTracking = async (groupId: string) => {
    if (!user) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const loc = await Location.getCurrentPositionAsync({});
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setMyLocation(coords);
    updateMyLocation(groupId, coords);

    locationWatcher.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
      (newLoc) => {
        const newCoords = {
          latitude: newLoc.coords.latitude,
          longitude: newLoc.coords.longitude,
        };
        setMyLocation(newCoords);
        updateMyLocation(groupId, newCoords);
      }
    );
  };

  const updateMyLocation = async (
    groupId: string,
    coords: { latitude: number; longitude: number }
  ) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'groups', groupId, 'members', user.id), {
        location: coords,
        lastSeen: serverTimestamp(),
      });
    } catch (e) {
      console.error('Location update failed:', e);
    }
  };

  // ── Create group ───────────────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    if (!groupName.trim() || !wearerName.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (!user) return;

    try {
      setCreating(true);
      const code = generateCode();

      // Create the group document
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: groupName.trim(),
        wearerName: wearerName.trim(),
        wearerId: user.id,
        joinCode: code,
        createdBy: user.id,
        createdAt: serverTimestamp(),
      });

      // Add creator as first member
      await setDoc(doc(db, 'groups', groupRef.id, 'members', user.id), {
        userId: user.id,
        name: user.email?.split('@')[0] ?? 'Guardian',
        email: user.email,
        status: 'Available',
        distance: null,
        location: null,
        lastSeen: serverTimestamp(),
        isCreator: true,
      });

      // Save groupId to user's own document — no separate collection needed
      await updateDoc(doc(db, 'users', user.id), {
        groupId: groupRef.id,
      });

      setShowCreate(false);
      setGroupName('');
      setWearerName('');
      loadGroup(groupRef.id);
    } catch (e) {
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // ── Join group ─────────────────────────────────────────────────────────────
  const handleJoinGroup = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Missing code', 'Please enter a join code.');
      return;
    }
    if (!user) return;

    try {
      setJoining(true);

      // Find group by join code
      const groupQuery = query(
        collection(db, 'groups'),
        where('joinCode', '==', joinCode.trim().toUpperCase())
      );
      const groupSnap = await getDocs(groupQuery);

      if (groupSnap.empty) {
        Alert.alert('Not found', 'No group found with that code. Check and try again.');
        setJoining(false);
        return;
      }

      const groupDoc = groupSnap.docs[0];
      const groupId = groupDoc.id;

      // Check if already a member
      const existingMember = await getDoc(doc(db, 'groups', groupId, 'members', user.id));
      if (existingMember.exists()) {
        Alert.alert('Already joined', 'You are already a member of this group.');
        setJoining(false);
        loadGroup(groupId);
        return;
      }

      // Add as member
      await setDoc(doc(db, 'groups', groupId, 'members', user.id), {
        userId: user.id,
        name: user.email?.split('@')[0] ?? 'Guardian',
        email: user.email,
        status: 'Available',
        distance: null,
        location: null,
        lastSeen: serverTimestamp(),
        isCreator: false,
      });

      // Save groupId directly to user's document
      await updateDoc(doc(db, 'users', user.id), {
        groupId: groupId,
      });

      setShowJoin(false);
      setJoinCode('');
      loadGroup(groupId);
    } catch (e) {
      Alert.alert('Error', 'Failed to join group. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  // ── Toggle status ──────────────────────────────────────────────────────────
  const handleToggleStatus = async () => {
    if (!user || !group) return;
    const newStatus = myStatus === 'Available' ? 'Not Available' : 'Available';
    try {
      setStatusLoading(true);
      await updateDoc(doc(db, 'groups', group.id, 'members', user.id), {
        status: newStatus,
      });
      setMyStatus(newStatus);
    } catch (e) {
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setStatusLoading(false);
    }
  };

  // ── Distance calculation ───────────────────────────────────────────────────
  const getDistance = (member: GroupMember): string => {
    if (!wearerLocation || !member.location) return '— km';
    const km = getDistanceKm(
      wearerLocation.latitude, wearerLocation.longitude,
      member.location.latitude, member.location.longitude
    );
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  // ── Render: Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  // ── Render: No group yet ───────────────────────────────────────────────────
  if (!group) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Guardian Group</Text>
        </View>

        <ScrollView contentContainerStyle={styles.noGroupContent}>
          <Text style={styles.noGroupIcon}>👥</Text>
          <Text style={[styles.noGroupTitle, { color: theme.text }]}>No group yet</Text>
          <Text style={[styles.noGroupSub, { color: theme.subText }]}>
            Create a group for the wearer or join an existing one with a code.
          </Text>

          {showCreate ? (
            <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.formTitle, { color: theme.text }]}>Create Group</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                placeholder="Group name (e.g. Juan's Guardians)"
                placeholderTextColor={theme.subText}
                value={groupName}
                onChangeText={setGroupName}
              />
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                placeholder="Wearer's name"
                placeholderTextColor={theme.subText}
                value={wearerName}
                onChangeText={setWearerName}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                onPress={handleCreateGroup}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color={isDark ? '#000' : '#fff'} size="small" />
                  : <Text style={[styles.primaryBtnText, { color: isDark ? '#000' : '#fff' }]}>Create Group</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={[styles.cancelText, { color: theme.subText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>

          ) : showJoin ? (
            <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.formTitle, { color: theme.text }]}>Join Group</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                placeholder="Enter 6-character code"
                placeholderTextColor={theme.subText}
                value={joinCode}
                onChangeText={setJoinCode}
                autoCapitalize="characters"
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                onPress={handleJoinGroup}
                disabled={joining}
              >
                {joining
                  ? <ActivityIndicator color={isDark ? '#000' : '#fff'} size="small" />
                  : <Text style={[styles.primaryBtnText, { color: isDark ? '#000' : '#fff' }]}>Join Group</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowJoin(false)}>
                <Text style={[styles.cancelText, { color: theme.subText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>

          ) : (
            <View style={styles.btnGroup}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                onPress={() => setShowCreate(true)}
              >
                <Text style={[styles.primaryBtnText, { color: isDark ? '#000' : '#fff' }]}>
                  Create a Group
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outlineBtn, { borderColor: theme.border }]}
                onPress={() => setShowJoin(true)}
              >
                <Text style={[styles.outlineBtnText, { color: theme.text }]}>
                  Join with Code
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Render: Group exists ───────────────────────────────────────────────────
  const availableCount = members.filter(m => m.status === 'Available').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.pageTitle, { color: theme.text }]}>{group.name}</Text>
          <Text style={[styles.pageSubtitle, { color: theme.subText }]}>
            Wearer: {group.wearerName}
          </Text>
        </View>
        <View style={[styles.codeBadge, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.codeLabel, { color: theme.subText }]}>Code</Text>
          <Text style={[styles.codeValue, { color: theme.text }]}>{group.joinCode}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* My status card */}
        <View style={[styles.myStatusCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View>
            <Text style={[styles.myStatusLabel, { color: theme.subText }]}>My Status</Text>
            <Text style={[styles.myStatusValue, {
              color: myStatus === 'Available' ? theme.success : theme.danger
            }]}>
              {myStatus}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              {
                backgroundColor: myStatus === 'Available'
                  ? 'rgba(248,113,113,0.1)'
                  : 'rgba(74,222,128,0.1)',
                borderColor: myStatus === 'Available' ? theme.danger : theme.success,
              }
            ]}
            onPress={handleToggleStatus}
            disabled={statusLoading}
          >
            {statusLoading
              ? <ActivityIndicator size="small" color={myStatus === 'Available' ? theme.danger : theme.success} />
              : <Text style={{
                  color: myStatus === 'Available' ? theme.danger : theme.success,
                  fontSize: 13,
                  fontWeight: '700',
                }}>
                  {myStatus === 'Available' ? 'Set Unavailable' : 'Set Available'}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Summary row */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.summaryNum, { color: theme.text }]}>{members.length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.subText }]}>Guardians</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.summaryNum, { color: theme.success }]}>{availableCount}</Text>
            <Text style={[styles.summaryLabel, { color: theme.subText }]}>Available</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.summaryNum, { color: theme.danger }]}>{members.length - availableCount}</Text>
            <Text style={[styles.summaryLabel, { color: theme.subText }]}>Unavailable</Text>
          </View>
        </View>

        {/* Members list */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Guardians</Text>
          {members.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.subText }]}>No members yet.</Text>
          ) : (
            members.map((member) => (
              <View key={member.id} style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                <View style={[styles.avatar, {
                  backgroundColor: member.status === 'Available'
                    ? 'rgba(74,222,128,0.1)'
                    : 'rgba(248,113,113,0.1)'
                }]}>
                  <Text style={[styles.avatarInitial, { color: theme.text }]}>
                    {(member.name ?? member.email ?? '?').charAt(0).toUpperCase()}
                  </Text>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: member.status === 'Available' ? theme.success : theme.danger }
                  ]} />
                </View>

                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: theme.text }]}>
                    {member.name ?? member.email}
                    {member.id === user?.id ? ' (You)' : ''}
                  </Text>
                  <Text style={[styles.memberStatus, {
                    color: member.status === 'Available' ? theme.success : theme.danger
                  }]}>
                    {member.status}
                  </Text>
                </View>

                <View style={styles.distanceWrap}>
                  <Text style={[styles.distanceValue, { color: theme.text }]}>
                    {getDistance(member)}
                  </Text>
                  <Text style={[styles.distanceLabel, { color: theme.subText }]}>
                    from wearer
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Wearer location status */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16 }]}>
          <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 8 }]}>
            Wearer Location
          </Text>
          {wearerLocation ? (
            <Text style={[styles.locationText, { color: theme.subText }]}>
              {wearerLocation.latitude.toFixed(5)}, {wearerLocation.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={[styles.locationText, { color: theme.danger }]}>
              Wearer location not available
            </Text>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  codeBadge: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 70,
  },
  codeLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  codeValue: { fontSize: 18, fontWeight: '900', letterSpacing: 2, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  noGroupContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  noGroupIcon: { fontSize: 64, marginBottom: 8 },
  noGroupTitle: { fontSize: 22, fontWeight: '800' },
  noGroupSub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  btnGroup: { width: '100%', gap: 12, marginTop: 8 },
  primaryBtn: { width: '100%', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },
  outlineBtn: { width: '100%', paddingVertical: 15, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  outlineBtnText: { fontSize: 15, fontWeight: '700' },
  formCard: { width: '100%', padding: 20, borderRadius: 16, borderWidth: 1, gap: 12 },
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  cancelText: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  myStatusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  myStatusLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  myStatusValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  summaryNum: { fontSize: 24, fontWeight: '900' },
  summaryLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  sectionTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', padding: 16, paddingBottom: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', padding: 20 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarInitial: { fontSize: 16, fontWeight: '800' },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: 'white',
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberStatus: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  distanceWrap: { alignItems: 'flex-end' },
  distanceValue: { fontSize: 15, fontWeight: '800' },
  distanceLabel: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  locationText: { fontSize: 13, lineHeight: 20 },
});