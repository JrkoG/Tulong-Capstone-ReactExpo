import * as Location from 'expo-location';
import {
  AndroidNotificationPriority,
  requestPermissionsAsync,
  scheduleNotificationAsync,
} from 'expo-notifications';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
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
  FlatList,
  KeyboardAvoidingView,
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
  responseStatus?: string;
  location: { latitude: number; longitude: number } | null;
  isCreator: boolean;
};

type Group = {
  id: string;
  name: string;
  wearerId: string;
  wearerName: string;
  joinCode: string;
};

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'text' | 'status_update';
  statusType?: 'responded' | 'on_the_way' | 'arrived' | 'aided';
  timestamp: any;
};

// ─── Quick status messages ─────────────────────────────────────────────────────
const QUICK_STATUSES = [
  { key: 'responded',  icon: '👋', label: 'Responded',    text: 'I have responded to the alert.',           color: '#6366f1' },
  { key: 'on_the_way', icon: '🚗', label: 'On the way',   text: 'I am on the way to the wearer.',           color: '#fb923c' },
  { key: 'arrived',    icon: '📍', label: 'Arrived',       text: 'I have arrived at the wearer\'s location.', color: '#378ADD' },
  { key: 'aided',      icon: '✅', label: 'Wearer aided',  text: 'I have aided the wearer. All clear.',       color: '#4ade80' },
];

// ─── Haversine ────────────────────────────────────────────────────────────────
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function formatTime(ts: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(ts: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GroupScreen() {
  const { user } = useAuth();
  const isDark = useColorScheme() === 'dark';

  const theme = {
    background: isDark ? '#000000' : '#FFFFFF',
    card:       isDark ? '#111111' : '#F9F9F9',
    text:       isDark ? '#FFFFFF' : '#1C1C1E',
    subText:    isDark ? '#888888' : '#666666',
    border:     isDark ? '#222222' : 'rgba(0,0,0,0.06)',
    accent:     isDark ? '#FFFFFF' : '#000000',
    bubble:     isDark ? '#1C1C1E' : '#F2F2F7',
    myBubble:   '#6366f1',
    success:    '#4ade80',
    danger:     '#f87171',
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading]               = useState(true);
  const [group, setGroup]                   = useState<Group | null>(null);
  const [members, setMembers]               = useState<GroupMember[]>([]);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [myStatus, setMyStatus]             = useState<'Available' | 'Not Available'>('Available');
  const [wearerLocation, setWearerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [inputText, setInputText]           = useState('');
  const [sending, setSending]               = useState(false);
  const [statusLoading, setStatusLoading]   = useState(false);
  const [showQuickStatus, setShowQuickStatus] = useState(false);

  // Create / Join state
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin]     = useState(false);
  const [groupName, setGroupName]   = useState('');
  const [wearerName, setWearerName] = useState('');
  const [joinCode, setJoinCode]     = useState('');
  const [creating, setCreating]     = useState(false);
  const [joining, setJoining]       = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  const myName = user?.email?.split('@')[0] ?? 'Guardian';

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    requestPermissionsAsync();
    checkExistingGroup();
    return () => { if (locationWatcher.current) locationWatcher.current.remove(); };
  }, [user]);

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
      setLoading(false);
    }
  };

  const loadGroup = (groupId: string) => {
    // Group doc
    onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (snap.exists()) setGroup({ id: snap.id, ...snap.data() } as Group);
    });

    // Members
    onSnapshot(collection(db, 'groups', groupId, 'members'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as GroupMember[];
      setMembers(list);
      const me = list.find(m => m.id === user?.id);
      if (me) setMyStatus(me.status);
    });

    // Wearer location
    onSnapshot(collection(db, 'groups', groupId, 'wearerLocation'), (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0].data();
        setWearerLocation({ latitude: d.latitude, longitude: d.longitude });
      }
    });

    // Messages — ordered oldest first for chat display
    const q = query(
      collection(db, 'groups', groupId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );
    onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(list);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    setLoading(false);
    startLocationTracking(groupId);
  };

  const startLocationTracking = async (groupId: string) => {
    if (!user) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const loc = await Location.getCurrentPositionAsync({});
    updateMyLocation(groupId, { latitude: loc.coords.latitude, longitude: loc.coords.longitude });

    locationWatcher.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
      (newLoc) => updateMyLocation(groupId, {
        latitude: newLoc.coords.latitude,
        longitude: newLoc.coords.longitude,
      })
    );
  };

  const updateMyLocation = async (groupId: string, coords: { latitude: number; longitude: number }) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'groups', groupId, 'members', user.id), {
        location: coords,
        lastSeen: serverTimestamp(),
      });
    } catch (e) {}
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
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: groupName.trim(),
        wearerName: wearerName.trim(),
        wearerId: user.id,
        joinCode: code,
        createdBy: user.id,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'groups', groupRef.id, 'members', user.id), {
        userId: user.id,
        name: myName,
        email: user.email,
        status: 'Available',
        responseStatus: null,
        location: null,
        lastSeen: serverTimestamp(),
        isCreator: true,
      });
      await updateDoc(doc(db, 'users', user.id), { groupId: groupRef.id });

      // Welcome message
      await addDoc(collection(db, 'groups', groupRef.id, 'messages'), {
        senderId: 'system',
        senderName: 'Tulong',
        text: `Group "${groupName.trim()}" created. Share the code ${code} with other guardians.`,
        type: 'text',
        timestamp: serverTimestamp(),
      });

      setShowCreate(false);
      setGroupName('');
      setWearerName('');
      loadGroup(groupRef.id);
    } catch (e) {
      Alert.alert('Error', 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  // ── Join group ─────────────────────────────────────────────────────────────
  const handleJoinGroup = async () => {
    if (!joinCode.trim()) { Alert.alert('Missing code', 'Enter a join code.'); return; }
    if (!user) return;
    try {
      setJoining(true);
      const groupQuery = query(collection(db, 'groups'), where('joinCode', '==', joinCode.trim().toUpperCase()));
      const groupSnap = await getDocs(groupQuery);
      if (groupSnap.empty) {
        Alert.alert('Not found', 'No group found with that code.');
        setJoining(false);
        return;
      }
      const groupDoc = groupSnap.docs[0];
      const groupId = groupDoc.id;

      const existing = await getDoc(doc(db, 'groups', groupId, 'members', user.id));
      if (existing.exists()) {
        setJoining(false);
        loadGroup(groupId);
        return;
      }

      await setDoc(doc(db, 'groups', groupId, 'members', user.id), {
        userId: user.id,
        name: myName,
        email: user.email,
        status: 'Available',
        responseStatus: null,
        location: null,
        lastSeen: serverTimestamp(),
        isCreator: false,
      });
      await updateDoc(doc(db, 'users', user.id), { groupId });

      // Join message
      await addDoc(collection(db, 'groups', groupId, 'messages'), {
        senderId: 'system',
        senderName: 'Tulong',
        text: `${myName} joined the group.`,
        type: 'text',
        timestamp: serverTimestamp(),
      });

      setShowJoin(false);
      setJoinCode('');
      loadGroup(groupId);
    } catch (e) {
      Alert.alert('Error', 'Failed to join group.');
    } finally {
      setJoining(false);
    }
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputText.trim() || !group || !user) return;
    const text = inputText.trim();
    setInputText('');
    try {
      setSending(true);
      await addDoc(collection(db, 'groups', group.id, 'messages'), {
        senderId: user.id,
        senderName: myName,
        text,
        type: 'text',
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // ── Send quick status ──────────────────────────────────────────────────────
  const handleQuickStatus = async (statusKey: string) => {
    if (!group || !user) return;
    const qs = QUICK_STATUSES.find(s => s.key === statusKey);
    if (!qs) return;

    setShowQuickStatus(false);

    try {
      setSending(true);

      // 1. Send as a chat message (type: status_update)
      await addDoc(collection(db, 'groups', group.id, 'messages'), {
        senderId: user.id,
        senderName: myName,
        text: qs.text,
        type: 'status_update',
        statusType: qs.key,
        timestamp: serverTimestamp(),
      });

      // 2. Update member's responseStatus in the group
      await updateDoc(doc(db, 'groups', group.id, 'members', user.id), {
        responseStatus: qs.key,
        lastResponse: serverTimestamp(),
      });

      // 3. Notify other guardians via push notification
      await scheduleNotificationAsync({
        content: {
          title: `${qs.icon} ${myName} — ${qs.label}`,
          body: qs.text,
          sound: true,
          ...(Platform.OS === 'android' && {
            priority: AndroidNotificationPriority.HIGH,
          }),
        },
        trigger: null,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to send status.');
    } finally {
      setSending(false);
    }
  };

  // ── Toggle availability status ─────────────────────────────────────────────
  const handleToggleStatus = async () => {
    if (!user || !group) return;
    const newStatus = myStatus === 'Available' ? 'Not Available' : 'Available';
    try {
      setStatusLoading(true);
      await updateDoc(doc(db, 'groups', group.id, 'members', user.id), { status: newStatus });

      // Also post a system message in chat
      await addDoc(collection(db, 'groups', group.id, 'messages'), {
        senderId: 'system',
        senderName: 'Tulong',
        text: `${myName} is now ${newStatus}.`,
        type: 'text',
        timestamp: serverTimestamp(),
      });

      setMyStatus(newStatus);
    } catch (e) {
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setStatusLoading(false);
    }
  };

  // ── Render message bubble ──────────────────────────────────────────────────
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === user?.id;
    const isSystem = item.senderId === 'system';
    const prevMsg = index > 0 ? messages[index - 1] : null;

    // Date separator
    const showDate = !prevMsg ||
      (item.timestamp && prevMsg.timestamp &&
        formatDate(item.timestamp) !== formatDate(prevMsg.timestamp));

    const qs = item.type === 'status_update'
      ? QUICK_STATUSES.find(s => s.key === item.statusType)
      : null;

    return (
      <View>
        {showDate && item.timestamp && (
          <View style={styles.dateSeparator}>
            <Text style={[styles.dateText, { color: theme.subText }]}>
              {formatDate(item.timestamp)}
            </Text>
          </View>
        )}

        {isSystem ? (
          <View style={styles.systemMsg}>
            <Text style={[styles.systemText, { color: theme.subText }]}>{item.text}</Text>
          </View>
        ) : (
          <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
            {!isMe && (
              <View style={[styles.avatar, { backgroundColor: theme.border }]}>
                <Text style={[styles.avatarText, { color: theme.text }]}>
                  {item.senderName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={[styles.msgGroup, isMe && styles.msgGroupMe]}>
              {!isMe && (
                <Text style={[styles.senderName, { color: theme.subText }]}>
                  {item.senderName}
                </Text>
              )}
              <View style={[
                styles.bubble,
                isMe
                  ? [styles.bubbleMe, { backgroundColor: theme.myBubble }]
                  : [styles.bubbleThem, { backgroundColor: theme.bubble }],
                qs && { borderWidth: 1, borderColor: qs.color + '55' },
              ]}>
                {qs && (
                  <View style={[styles.statusTag, { backgroundColor: qs.color + '22' }]}>
                    <Text style={{ fontSize: 12 }}>{qs.icon}</Text>
                    <Text style={[styles.statusTagText, { color: qs.color }]}>{qs.label}</Text>
                  </View>
                )}
                <Text style={[
                  styles.bubbleText,
                  { color: isMe ? '#ffffff' : theme.text }
                ]}>
                  {item.text}
                </Text>
                <Text style={[
                  styles.timeText,
                  { color: isMe ? 'rgba(255,255,255,0.5)' : theme.subText }
                ]}>
                  {formatTime(item.timestamp)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  // ── No group ───────────────────────────────────────────────────────────────
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
            Create a group for the wearer or join one with a code.
          </Text>

          {showCreate ? (
            <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.formTitle, { color: theme.text }]}>Create Group</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                placeholder="Group name"
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
                <Text style={[styles.primaryBtnText, { color: isDark ? '#000' : '#fff' }]}>Create a Group</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outlineBtn, { borderColor: theme.border }]}
                onPress={() => setShowJoin(true)}
              >
                <Text style={[styles.outlineBtnText, { color: theme.text }]}>Join with Code</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Group screen ───────────────────────────────────────────────────────────
  const availableCount = members.filter(m => m.status === 'Available').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: theme.text }]} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={[styles.pageSubtitle, { color: theme.subText }]}>
            {availableCount}/{members.length} available · Wearer: {group.wearerName}
          </Text>
        </View>
        <View style={[styles.codeBadge, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.codeLabel, { color: theme.subText }]}>Code</Text>
          <Text style={[styles.codeValue, { color: theme.text }]}>{group.joinCode}</Text>
        </View>
      </View>

      {/* Members strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.membersStrip, { borderBottomColor: theme.border }]}
        contentContainerStyle={styles.membersStripContent}
      >
        {members.map((member) => {
          const qs = QUICK_STATUSES.find(s => s.key === member.responseStatus);
          return (
            <View key={member.id} style={styles.memberChip}>
              <View style={[styles.chipAvatar, {
                backgroundColor: member.status === 'Available'
                  ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                borderColor: member.status === 'Available' ? theme.success : theme.danger,
              }]}>
                <Text style={[styles.chipInitial, { color: theme.text }]}>
                  {member.name.charAt(0).toUpperCase()}
                </Text>
                {qs && (
                  <View style={styles.responseIndicator}>
                    <Text style={{ fontSize: 8 }}>{qs.icon}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.chipName, { color: theme.subText }]} numberOfLines={1}>
                {member.id === user?.id ? 'You' : member.name}
              </Text>
              <Text style={[styles.chipDist, { color: theme.subText }]}>
                {wearerLocation && member.location
                  ? getDistanceKm(wearerLocation.latitude, wearerLocation.longitude, member.location.latitude, member.location.longitude)
                  : '—'
                }
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* My status toggle */}
      <View style={[styles.statusBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusDot, { backgroundColor: myStatus === 'Available' ? theme.success : theme.danger }]} />
          <Text style={[styles.statusText, { color: theme.text }]}>
            {myStatus === 'Available' ? 'You are available' : 'You are unavailable'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.togglePill, {
            backgroundColor: myStatus === 'Available' ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)',
            borderColor: myStatus === 'Available' ? theme.danger : theme.success,
          }]}
          onPress={handleToggleStatus}
          disabled={statusLoading}
        >
          {statusLoading
            ? <ActivityIndicator size="small" color={myStatus === 'Available' ? theme.danger : theme.success} />
            : <Text style={{ fontSize: 12, fontWeight: '700', color: myStatus === 'Available' ? theme.danger : theme.success }}>
                {myStatus === 'Available' ? 'Set Unavailable' : 'Set Available'}
              </Text>
          }
        </TouchableOpacity>
      </View>

      {/* Quick status row */}
      {showQuickStatus && (
        <View style={[styles.quickStatusBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickStatusContent}>
            {QUICK_STATUSES.map((qs) => (
              <TouchableOpacity
                key={qs.key}
                style={[styles.quickBtn, { borderColor: qs.color + '66', backgroundColor: qs.color + '11' }]}
                onPress={() => handleQuickStatus(qs.key)}
                disabled={sending}
              >
                <Text style={{ fontSize: 16 }}>{qs.icon}</Text>
                <Text style={[styles.quickBtnText, { color: qs.color }]}>{qs.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Chat messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
              <Text style={[styles.emptyChatText, { color: theme.subText }]}>
                No messages yet. Say something!
              </Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          {/* Quick status toggle */}
          <TouchableOpacity
            style={[styles.quickStatusToggle, {
              backgroundColor: showQuickStatus ? 'rgba(99,102,241,0.15)' : theme.card,
              borderColor: showQuickStatus ? '#6366f1' : theme.border,
            }]}
            onPress={() => setShowQuickStatus(!showQuickStatus)}
          >
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            style={[styles.textInput, { color: theme.text, backgroundColor: theme.bubble }]}
            placeholder="Message..."
            placeholderTextColor={theme.subText}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />

          {/* Send button */}
          <TouchableOpacity
            style={[styles.sendBtn, {
              backgroundColor: inputText.trim() ? '#6366f1' : theme.card,
              opacity: inputText.trim() ? 1 : 0.5,
            }]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendIcon}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  pageTitle:    { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  codeBadge:    { alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 1, minWidth: 60 },
  codeLabel:    { fontSize: 9, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  codeValue:    { fontSize: 16, fontWeight: '900', letterSpacing: 2 },

  // Members strip
  membersStrip:        { maxHeight: 90, borderBottomWidth: 1 },
  membersStripContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 12, flexDirection: 'row' },
  memberChip:          { alignItems: 'center', width: 56 },
  chipAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, position: 'relative',
  },
  chipInitial:         { fontSize: 16, fontWeight: '800' },
  responseIndicator: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#1C1C2E',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipName:  { fontSize: 10, fontWeight: '500', marginTop: 4, textAlign: 'center' },
  chipDist:  { fontSize: 9, fontWeight: '600', marginTop: 1 },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statusLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
  statusText:  { fontSize: 13, fontWeight: '600' },
  togglePill:  { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 },

  // Quick status
  quickStatusBar:     { borderBottomWidth: 1 },
  quickStatusContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  quickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 20, borderWidth: 1,
  },
  quickBtnText: { fontSize: 12, fontWeight: '700' },

  // Messages
  messageList: { paddingHorizontal: 12, paddingVertical: 16, gap: 4 },
  dateSeparator: { alignItems: 'center', marginVertical: 12 },
  dateText:      { fontSize: 11, fontWeight: '600' },
  systemMsg:     { alignItems: 'center', marginVertical: 6 },
  systemText:    { fontSize: 11, fontStyle: 'italic' },
  msgRow:        { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 2 },
  msgRowMe:      { flexDirection: 'row-reverse' },
  avatar:        { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText:    { fontSize: 12, fontWeight: '700' },
  msgGroup:      { maxWidth: '75%' },
  msgGroupMe:    { alignItems: 'flex-end' },
  senderName:    { fontSize: 11, fontWeight: '600', marginBottom: 3, marginLeft: 12 },
  bubble: {
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    paddingBottom: 6, gap: 4,
  },
  bubbleMe:   { borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4 },
  statusTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusTagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  timeText:   { fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  emptyChat:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyChatText: { fontSize: 14, textAlign: 'center' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, gap: 8,
  },
  quickStatusToggle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  textInput: {
    flex: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, maxHeight: 100,
  },
  sendBtn:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#ffffff', fontSize: 18, fontWeight: '700' },

  // No group
  noGroupContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  noGroupIcon:    { fontSize: 64, marginBottom: 8 },
  noGroupTitle:   { fontSize: 22, fontWeight: '800' },
  noGroupSub:     { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  btnGroup:       { width: '100%', gap: 12, marginTop: 8 },
  primaryBtn:     { width: '100%', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },
  outlineBtn:     { width: '100%', paddingVertical: 15, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  outlineBtnText: { fontSize: 15, fontWeight: '700' },
  formCard:       { width: '100%', padding: 20, borderRadius: 16, borderWidth: 1, gap: 12 },
  formTitle:      { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  input:          { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  cancelText:     { fontSize: 13, textAlign: 'center', marginTop: 4 },
});