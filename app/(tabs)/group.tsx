import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack } from "expo-router";
import {
  limitToLast,
  onValue,
  push,
  query,
  ref,
  update,
} from "firebase/database";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
} from "react-native";
import GuardianActionSheet from "../../components/GuardianActionSheet";
import QuickBar from "../../components/QuickBar";
import { db, rtdb } from "../../config/firebase";
import { useAuth } from "../../context/authContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type GroupMember = {
  id: string;
  name: string;
  email: string;
  status: "Available" | "Not Available";
  location: { latitude: number; longitude: number } | null;
  lastSeen: any;
};

type Group = {
  id: string;
  name: string;
  wearerName: string;
  joinCode: string;
  wearerId: string;
};

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type: "text" | "status";
  status?: "responded" | "on_the_way" | "arrived" | "aided";
};

// ─── Constants ────────────────────────────────────────────────────────────────
// Quick replies change based on whether there's an active emergency
const EMERGENCY_QUICK_REPLIES = [
  "On my way 🚗",
  "I'm nearby 📍",
  "Call ambulance? 🚑",
  "Need backup here",
  "Wearer is safe ✅",
];

const NORMAL_QUICK_REPLIES = [
  "Hello everyone 👋",
  "Everything okay?",
  "Checking in 🔍",
  "Need anything?",
  "All good here ✅",
];

const STATUS_CHAT_MESSAGES: Record<string, string> = {
  responded: "👋 has responded to the alert",
  on_the_way: "🚗 is on the way to the wearer",
  arrived: "📍 has arrived at the wearer's location",
  aided: "✅ has aided the wearer — situation under control",
};

const STATUS_COLORS: Record<string, string> = {
  responded: "#6366f1",
  on_the_way: "#fb923c",
  arrived: "#6366f1",
  aided: "#4ade80",
};

// ─── Haversine Distance Formula ───────────────────────────────────────────────
function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Message Bubble Component ─────────────────────────────────────────────────
function MessageBubble({
  message,
  userId,
  brandGold,
}: {
  message: ChatMessage;
  userId?: string;
  brandGold: string;
}) {
  const isMe = message.senderId === userId;
  const isSystem = message.type === "status";

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // System/status messages — centered colored pill
  if (isSystem) {
    const color = STATUS_COLORS[message.status ?? "responded"] ?? "#888";
    return (
      <View style={bubbleStyles.systemRow}>
        <View style={[bubbleStyles.systemPill, { borderColor: color + "44" }]}>
          <Text style={[bubbleStyles.systemText, { color }]}>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[bubbleStyles.row, isMe ? bubbleStyles.rowRight : bubbleStyles.rowLeft]}
    >
      {/* Avatar — only shown for other members */}
      {!isMe && (
        <View style={[bubbleStyles.avatar, { backgroundColor: brandGold + "33" }]}>
          <Text style={[bubbleStyles.avatarText, { color: brandGold }]}>
            {message.senderName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={bubbleStyles.bubbleGroup}>
        {/* Sender name — only for other members */}
        {!isMe && (
          <Text style={bubbleStyles.senderName}>{message.senderName}</Text>
        )}
        <View
          style={[
            bubbleStyles.bubble,
            isMe
              ? [bubbleStyles.myBubble, { backgroundColor: brandGold }]
              : bubbleStyles.theirBubble,
          ]}
        >
          <Text
            style={[
              bubbleStyles.bubbleText,
              isMe ? bubbleStyles.myBubbleText : bubbleStyles.theirBubbleText,
            ]}
          >
            {message.text}
          </Text>
        </View>
        <Text
          style={[
            bubbleStyles.timestamp,
            isMe ? { textAlign: "right" } : { textAlign: "left" },
          ]}
        >
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 4, paddingHorizontal: 16, gap: 8 },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    flexShrink: 0,
  },
  avatarText: { fontSize: 13, fontWeight: "700" },
  bubbleGroup: { maxWidth: "75%", gap: 2 },
  senderName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#888",
    marginLeft: 4,
    marginBottom: 2,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myBubble: { borderBottomRightRadius: 4 },
  theirBubble: {
    backgroundColor: "#1c1c1e",
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  myBubbleText: { color: "#fff" },
  theirBubbleText: { color: "#fff" },
  timestamp: { fontSize: 10, color: "#666", marginHorizontal: 4 },
  systemRow: {
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  systemPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  systemText: { fontSize: 12, fontWeight: "600", textAlign: "center" },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function GroupScreen() {
  const { user } = useAuth();
  const isDark = useColorScheme() === "dark";

  const theme = {
    background: isDark ? "#000" : "#fff",
    text: isDark ? "#fff" : "#111",
    subText: isDark ? "#888" : "#666",
    card: isDark ? "#111" : "#f9f9f9",
    border: isDark ? "#222" : "rgba(0,0,0,0.06)",
    brandGold: "#D0A97E",
    success: "#4ade80",
    danger: "#f87171",
  };

  // ─── State ─────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [wearerLocation, setWearerLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [myStatus, setMyStatus] = useState<"Available" | "Not Available">("Available");
  const [statusLoading, setStatusLoading] = useState(false);

  // Group create/join
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [wearerName, setWearerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Alerts
  const [activeAlert, setActiveAlert] = useState<any>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Chat
  const [activeTab, setActiveTab] = useState<"group" | "chat">("group");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState(Date.now());

  // Toast notification — shown to the guardian who just submitted their status
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX: Store Firestore unsubscribers to prevent memory leak
  const groupUnsubsRef = useRef<(() => void)[]>([]);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  // Unread badge count — messages from others since user last viewed chat
  const unreadCount = messages.filter(
    (m) => m.timestamp > lastSeenTimestamp && m.senderId !== user?.id,
  ).length;

  // Clear unread when user opens chat tab
  useEffect(() => {
    if (activeTab === "chat") {
      setLastSeenTimestamp(Date.now());
    }
  }, [activeTab]);

  // ─── Effect 1: Fetch Group on mount ────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const fetchUserGroup = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.id));
        if (userDoc.exists() && userDoc.data().groupId) {
          setupGroupListeners(userDoc.data().groupId);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Error fetching group:", e);
        setLoading(false);
      }
    };

    fetchUserGroup();

    return () => {
      if (locationWatcher.current) locationWatcher.current.remove();
      groupUnsubsRef.current.forEach((unsub) => unsub());
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [user?.id]);

  // FIX: setupGroupListeners now stores unsubscribers so they can be cleaned up
  const setupGroupListeners = (groupId: string) => {
    // Clean up any previous listeners before setting new ones
    groupUnsubsRef.current.forEach((unsub) => unsub());

    const unsubGroup = onSnapshot(doc(db, "groups", groupId), (snap) => {
      if (snap.exists()) {
        setGroup({ id: snap.id, ...snap.data() } as Group);
      }
    });

    const unsubMembers = onSnapshot(
      collection(db, "groups", groupId, "members"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupMember);
        setMembers(list);
        const me = list.find((m) => m.id === user?.id);
        if (me) setMyStatus(me.status);
      },
    );

    groupUnsubsRef.current = [unsubGroup, unsubMembers];
    setLoading(false);
    startMyGuardianTracking(groupId);
  };

  // ─── Effect 2: IoT Wearer Location ─────────────────────────────────────────
  useEffect(() => {
    if (!group?.id) return;
    const latestLocationQuery = query(
      ref(rtdb, `gpslogs/${group.id}`),
      limitToLast(1),
    );
    return onValue(latestLocationQuery, (snapshot) => {
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const data = child.val();
          if (data?.latitude !== undefined && data?.longitude !== undefined) {
            if (data.latitude === 0 && data.longitude === 0) return;
            setWearerLocation({
              latitude: Number(data.latitude),
              longitude: Number(data.longitude),
            });
          }
        });
      }
    });
  }, [group?.id]);

  // ─── Effect 3: Active Alerts ────────────────────────────────────────────────
  useEffect(() => {
    if (!group?.id) return;
    const alertsQuery = query(
      ref(rtdb, `groups/${group.id}/alerts`),
      limitToLast(1),
    );
    return onValue(alertsQuery, (snapshot) => {
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const data = child.val();
          if (data.status !== "resolved" && data.status !== "aided") {
            setActiveAlert({ id: child.key, ...data });
          } else {
            setActiveAlert(null);
          }
        });
      } else {
        setActiveAlert(null);
      }
    });
  }, [group?.id]);

  // ─── Effect 4: Chat Messages ────────────────────────────────────────────────
  useEffect(() => {
    if (!group?.id) return;
    const chatQuery = query(
      ref(rtdb, `groups/${group.id}/chat`),
      limitToLast(60),
    );
    return onValue(chatQuery, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data)
          .map((key) => ({ id: key, ...data[key] } as ChatMessage))
          // Newest first — correct for inverted FlatList
          .sort((a, b) => b.timestamp - a.timestamp);
        setMessages(list);
      } else {
        setMessages([]);
      }
    });
  }, [group?.id]);

  // ─── Guardian Location Tracking ────────────────────────────────────────────
  const startMyGuardianTracking = async (groupId: string) => {
    if (!user?.id) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    locationWatcher.current = await Location.watchPositionAsync(
      {
        // FIX: Highest avoids road-snapping bias from BestForNavigation
        accuracy: Location.Accuracy.Highest,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      async (newLoc) => {
        const accuracy = newLoc.coords.accuracy ?? 999;
        if (accuracy > 50) return;

        const coords = {
          latitude: newLoc.coords.latitude,
          longitude: newLoc.coords.longitude,
        };

        try {
          await updateDoc(doc(db, "groups", groupId, "members", user.id), {
            location: coords,
            accuracy,
            speed: newLoc.coords.speed ?? 0,
            heading: newLoc.coords.heading ?? 0,
            lastSeen: serverTimestamp(),
          });
        } catch (e) {
          console.log("Location update error", e);
        }
      },
    );
  };

  // ─── Send Chat Message ──────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !group?.id || !user?.id) return;

    setChatText("");
    setSendingMessage(true);
    try {
      await push(ref(rtdb, `groups/${group.id}/chat`), {
        senderId: user.id,
        senderName: user.email?.split("@")[0] || "Guardian",
        text: trimmed,
        timestamp: Date.now(),
        type: "text",
      });
    } catch (e) {
      Alert.alert("Error", "Could not send message.");
    } finally {
      setSendingMessage(false);
    }
  };

  // Posts an automatic status message to chat when a guardian uses the action sheet
  const postStatusToChat = async (
    status: "responded" | "on_the_way" | "arrived" | "aided",
  ) => {
    if (!group?.id) return;
    const name = user?.email?.split("@")[0] || "A Guardian";
    const text = `${name} ${STATUS_CHAT_MESSAGES[status]}`;
    try {
      await push(ref(rtdb, `groups/${group.id}/chat`), {
        senderId: "system",
        senderName: "System",
        text,
        timestamp: Date.now(),
        type: "status",
        status,
      });
    } catch (_) {
      // Fail silently — status update already went through
    }
  };

  // ─── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (message: string) => {
    // Clear any existing timer so rapid calls don't stack
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToastMessage(message);
    setToastVisible(true);

    // Slide up
    toastAnim.setValue(0);
    Animated.spring(toastAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    // Auto-dismiss after 3 seconds
    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setToastVisible(false));
    }, 3000);
  };

  // ─── Guardian Status Update (Action Sheet) ──────────────────────────────────
  const handleStatusUpdate = async (
    status: "responded" | "on_the_way" | "arrived" | "aided",
  ) => {
    // Guard against double-fire from fast double-taps. TouchableOpacity's
    // `disabled` prop can lag one render behind a rapid double-tap, letting
    // onPress fire twice before React applies the disabled state — this was
    // causing duplicate "has responded to the alert" messages in chat.
    if (!activeAlert?.id || !group?.id || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await update(ref(rtdb, `groups/${group.id}/alerts/${activeAlert.id}`), {
        currentStatus: status,
        lastResponderName: user?.email?.split("@")[0] || "A Guardian",
        lastResponderId: user?.id ?? null,
        lastUpdateAt: new Date().toISOString(),
      });
      await postStatusToChat(status);

      // Show toast to the responder — they don't get the modal, they get this instead
      const statusLabels: Record<string, string> = {
        responded: "Response sent to all guardians ✅",
        on_the_way: "Guardians notified you're on the way 🚗",
        arrived: "Guardians notified you've arrived 📍",
        aided: "Guardians notified wearer has been aided ✅",
      };
      showToast(statusLabels[status] ?? "Status sent to guardians");
    } catch (error) {
      console.error("Failed to update status:", error);
      Alert.alert("Error", "Failed to send your status. Please try again.");
    } finally {
      setIsUpdatingStatus(false);
      setShowActionSheet(false);
    }
  };

  // ─── Create / Join Group ────────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    if (!groupName || !wearerName || !user?.id) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setActionLoading(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const deviceId = "DEVICE_" + code;
      const groupRef = await addDoc(collection(db, "groups"), {
        name: groupName,
        wearerName,
        joinCode: code,
        wearerId: deviceId,
        createdBy: user.id,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "groups", groupRef.id, "members", user.id), {
        name: user.email?.split("@")[0] || "Guardian",
        email: user.email,
        status: "Available",
        location: null,
        lastSeen: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.id), { groupId: groupRef.id });
      setupGroupListeners(groupRef.id);
      Alert.alert("Success", `Group created! Device ID: ${deviceId}`);
    } catch {
      Alert.alert("Error", "Could not create group.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinCode || !user?.id) {
      Alert.alert("Error", "Please enter a code");
      return;
    }
    setActionLoading(true);
    try {
      const q = query(
        collection(db, "groups"),
        where("joinCode", "==", joinCode.toUpperCase().trim()),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert("Error", "Invalid code");
        return;
      }
      const foundId = snap.docs[0].id;
      await setDoc(doc(db, "groups", foundId, "members", user.id), {
        name: user.email?.split("@")[0] || "Guardian",
        email: user.email,
        status: "Available",
        location: null,
        lastSeen: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.id), { groupId: foundId });
      setupGroupListeners(foundId);
    } catch {
      Alert.alert("Error", "Failed to join group");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user?.id || !group?.id) return;
    const newStatus = myStatus === "Available" ? "Not Available" : "Available";
    try {
      setStatusLoading(true);
      await updateDoc(doc(db, "groups", group.id, "members", user.id), {
        status: newStatus,
      });
      setMyStatus(newStatus);
    } catch {
      Alert.alert("Error", "Failed to update status.");
    } finally {
      setStatusLoading(false);
    }
  };

  const getDistanceText = (member: GroupMember): string => {
    if (!wearerLocation) return "Waiting GPS...";
    if (!member.location) return "Locating...";
    const km = getDistanceKm(
      wearerLocation.latitude,
      wearerLocation.longitude,
      member.location.latitude,
      member.location.longitude,
    );
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(2)}km`;
  };

  // ─── Loading State ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.brandGold} />
      </View>
    );
  }

  const quickReplies = activeAlert ? EMERGENCY_QUICK_REPLIES : NORMAL_QUICK_REPLIES;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "ios" ? 60 : 40, borderBottomColor: theme.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {group ? group.name : "Guardian Group"}
        </Text>

        {/* Tab switcher — only shown when in a group */}
        {group && (
          <View style={[styles.tabBar, { backgroundColor: theme.card }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "group" && { backgroundColor: theme.brandGold },
              ]}
              onPress={() => setActiveTab("group")}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={activeTab === "group" ? "#fff" : theme.subText}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === "group" ? "#fff" : theme.subText },
                ]}
              >
                Group
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "chat" && { backgroundColor: theme.brandGold },
              ]}
              onPress={() => setActiveTab("chat")}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={16}
                color={activeTab === "chat" ? "#fff" : theme.subText}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === "chat" ? "#fff" : theme.subText },
                ]}
              >
                Chat
              </Text>
              {/* Unread badge */}
              {unreadCount > 0 && activeTab !== "chat" && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── GROUP TAB ── */}
      {activeTab === "group" && (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            // Extra bottom padding when alert button is visible
            { paddingBottom: activeAlert ? 160 : 100 },
          ]}
        >
          {!group ? (
            // No group — show create/join UI
            <View style={styles.noGroupContainer}>
              <Ionicons name="people-outline" size={80} color={theme.brandGold} />
              <Text style={[styles.noGroupText, { color: theme.text }]}>
                Manage Your Group
              </Text>

              {!showCreate && !showJoin ? (
                <View style={{ width: "100%", gap: 12 }}>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => setShowCreate(true)}
                  >
                    <Text style={styles.btnText}>Create New Group</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setShowJoin(true)}
                  >
                    <Text style={[styles.btnText, { color: theme.brandGold }]}>
                      Join Existing Group
                    </Text>
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
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleCreateGroup}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>Confirm & Create</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowCreate(false)}>
                    <Text style={{ color: theme.subText, marginTop: 15, textAlign: "center" }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.form}>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    placeholder="Enter Code"
                    placeholderTextColor={theme.subText}
                    autoCapitalize="characters"
                    value={joinCode}
                    onChangeText={setJoinCode}
                  />
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleJoinGroup}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>Join Group</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowJoin(false)}>
                    <Text style={{ color: theme.subText, marginTop: 15, textAlign: "center" }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {/* My Status Card */}
              <View
                style={[styles.myStatusCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <View>
                  <Text style={{ color: theme.subText, fontSize: 12, fontWeight: "600" }}>
                    MY STATUS
                  </Text>
                  <Text
                    style={{
                      color: myStatus === "Available" ? theme.success : theme.danger,
                      fontSize: 18,
                      fontWeight: "800",
                      marginTop: 4,
                    }}
                  >
                    {myStatus}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    { borderColor: myStatus === "Available" ? theme.danger : theme.success },
                  ]}
                  onPress={handleToggleStatus}
                  disabled={statusLoading}
                >
                  {statusLoading ? (
                    <ActivityIndicator size="small" color={theme.brandGold} />
                  ) : (
                    <Text
                      style={{
                        color: myStatus === "Available" ? theme.danger : theme.success,
                        fontWeight: "700",
                      }}
                    >
                      Set {myStatus === "Available" ? "Unavailable" : "Available"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* IoT Wearable Location */}
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text, paddingBottom: 5 }]}>
                  IoT Wearable Location
                </Text>
                {wearerLocation ? (
                  <Text style={{ color: theme.success, paddingHorizontal: 16, paddingBottom: 16 }}>
                    ● Signal Active ({wearerLocation.latitude.toFixed(4)},{" "}
                    {wearerLocation.longitude.toFixed(4)})
                  </Text>
                ) : (
                  <Text style={{ color: theme.danger, paddingHorizontal: 16, paddingBottom: 16 }}>
                    Device not sending data yet
                  </Text>
                )}
              </View>

              {/* Guardians List */}
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 16 }}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Guardians</Text>
                  <Text style={{ color: theme.subText, fontSize: 12 }}>
                    Join Code:{" "}
                    <Text style={{ color: theme.brandGold, fontWeight: "800" }}>
                      {group.joinCode}
                    </Text>
                  </Text>
                </View>
                {members.map((member) => (
                  <View
                    key={member.id}
                    style={[styles.memberRow, { borderTopColor: theme.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: theme.text }]}>
                        {member.name} {member.id === user?.id && "(You)"}
                      </Text>
                      <Text
                        style={{
                          color: member.status === "Available" ? theme.success : theme.danger,
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        ● {member.status}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16 }}>
                        {getDistanceText(member)}
                      </Text>
                      <Text style={{ color: theme.subText, fontSize: 10 }}>from wearer</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── CHAT TAB ── */}
      {activeTab === "chat" && (
        <>
          {group ? (
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  userId={user?.id}
                  brandGold={theme.brandGold}
                />
              )}
              inverted
              contentContainerStyle={styles.chatList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <Ionicons name="chatbubbles-outline" size={48} color={theme.subText} />
                  <Text style={{ color: theme.subText, marginTop: 12, textAlign: "center" }}>
                    No messages yet.{"\n"}Say hello to your circle!
                  </Text>
                </View>
              }
            />
          ) : (
            <View style={styles.center}>
              <Text style={{ color: theme.subText }}>Join a group to start chatting.</Text>
            </View>
          )}

          {/* Chat Input Bar */}
          {group && (
            <View style={[styles.chatInputArea, { borderTopColor: theme.border }]}>
              {/* Quick reply chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickRepliesRow}
              >
                {quickReplies.map((reply) => (
                  <TouchableOpacity
                    key={reply}
                    style={[
                      styles.quickReplyChip,
                      {
                        borderColor: activeAlert
                          ? theme.danger + "66"
                          : theme.brandGold + "66",
                        backgroundColor: activeAlert
                          ? "rgba(248,113,113,0.08)"
                          : "rgba(208,169,126,0.08)",
                      },
                    ]}
                    onPress={() => sendMessage(reply)}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: activeAlert ? theme.danger : theme.brandGold,
                      }}
                    >
                      {reply}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Text input + send */}
              <View style={[styles.inputRow, { backgroundColor: theme.card }]}>
                <TextInput
                  style={[styles.chatInput, { color: theme.text }]}
                  value={chatText}
                  onChangeText={setChatText}
                  placeholder="Message your circle..."
                  placeholderTextColor={theme.subText}
                  multiline
                  maxLength={500}
                  returnKeyType="send"
                  onSubmitEditing={() => sendMessage(chatText)}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: theme.brandGold,
                      opacity: chatText.trim() ? 1 : 0.4,
                    },
                  ]}
                  onPress={() => sendMessage(chatText)}
                  disabled={!chatText.trim() || sendingMessage}
                >
                  {sendingMessage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}

      {/* ── "I'm Responding" Alert Button (Group tab only) ── */}
      {/* RECOMMENDATION: Keep this button prominent and separate from chat.
          The red bottom button gives instant one-tap access in emergencies.
          The action sheet selection automatically posts to chat as a system message
          so all guardians see a log of who is responding and what they're doing. */}
      {activeAlert && activeTab === "group" && (
        <View style={styles.alertButtonContainer}>
          <TouchableOpacity
            style={styles.alertButton}
            onPress={() => setShowActionSheet(true)}
          >
            <Ionicons name="alert-circle" size={20} color="#fff" />
            <Text style={styles.alertButtonText}>I'm Responding to Alert</Text>
          </TouchableOpacity>
        </View>
      )}

      <GuardianActionSheet
        visible={showActionSheet}
        responding={isUpdatingStatus}
        onSelect={handleStatusUpdate}
        onClose={() => setShowActionSheet(false)}
      />

      <QuickBar />

      {/* ── Toast notification — shown to the responder after picking a status ── */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: "800" },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabText: { fontSize: 13, fontWeight: "700" },
  badge: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  // Group tab
  scroll: { padding: 20 },
  noGroupContainer: { alignItems: "center", marginTop: 20 },
  noGroupText: { fontSize: 18, fontWeight: "600", marginVertical: 20 },
  primaryBtn: {
    backgroundColor: "#D0A97E",
    padding: 18,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: "#D0A97E",
    padding: 18,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  form: { width: "100%" },
  input: {
    width: "100%",
    borderWidth: 1,
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  myStatusCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    padding: 16,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
  },
  memberName: { fontSize: 16, fontWeight: "600" },

  // Chat tab
  chatList: {
    paddingVertical: 12,
    // inverted FlatList needs flexGrow so empty state centers
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  chatInputArea: {
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 90 : 70, // sit above QuickBar
  },
  quickRepliesRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  quickReplyChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  // Alert button
  alertButtonContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: Platform.OS === "ios" ? 110 : 80,
    zIndex: 10,
  },
  alertButton: {
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  alertButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  // Toast — shown to the responder after picking a guardian status
  toast: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 120 : 90,
    left: 24,
    right: 24,
    backgroundColor: "#1c1c1e",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
});