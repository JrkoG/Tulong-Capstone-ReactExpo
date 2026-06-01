import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack, usePathname, useRouter } from "expo-router";
import { limitToLast, onValue, query, ref, update } from "firebase/database";
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

// --- Types ---
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

// --- Haversine Distance Formula ---
function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radius of the earth in km
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

export default function GroupScreen() {
  const { user } = useAuth();
  const isDark = useColorScheme() === "dark";
  const router = useRouter();
  const pathname = usePathname();

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

  const alertButtonPaddingBottom = Platform.OS === "android" ? 220 : 140;
  const renderAlertButtonInScroll = Platform.OS === "android";
  const renderAlertButtonAtBottom = Platform.OS === "ios";

  // State
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [wearerLocation, setWearerLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [myStatus, setMyStatus] = useState<"Available" | "Not Available">(
    "Available",
  );
  const [statusLoading, setStatusLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [wearerName, setWearerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [activeAlert, setActiveAlert] = useState<any>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  // 1. Fetch User's Group on mount
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
    };
  }, [user?.id]);

  const setupGroupListeners = (groupId: string) => {
    // A. Listen to Group Document (Firestore)
    onSnapshot(doc(db, "groups", groupId), (snap) => {
      if (snap.exists()) {
        setGroup({ id: snap.id, ...snap.data() } as Group);
      }
    });

    // B. Listen to Members (Firestore)
    onSnapshot(collection(db, "groups", groupId, "members"), (snap) => {
      const list = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as GroupMember,
      );
      setMembers(list);
      const me = list.find((m) => m.id === user?.id);
      if (me) setMyStatus(me.status);
    });

    setLoading(false);
    startMyGuardianTracking(groupId);
  };

  // C. Listen to IoT Device Location (Realtime Database)
  useEffect(() => {
    if (!group?.id) return;

    const groupLogsRef = ref(rtdb, `gpslogs/${group.id}`);
    const latestLocationQuery = query(groupLogsRef, limitToLast(1));

    const unsubscribe = onValue(latestLocationQuery, (snapshot) => {
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();

          // 🔄 FIXED: Checked using uppercase 'Latitude' and 'Longitude' to match Arduino
          if (
            data &&
            data.latitude !== undefined &&
            data.longitude !== undefined
          ) {
            if (data.latitude === 0 && data.longitude === 0) return; // Drop invalid data

            setWearerLocation({
              latitude: Number(data.latitude),
              longitude: Number(data.longitude),
            });
          }
        });
      } else {
        console.log("No GPS logs found for group:", group.id);
      }
    });

    return () => unsubscribe();
  }, [group?.id]);

  // D. Listen to Active Alerts (Realtime Database)
  useEffect(() => {
    if (!group?.id) return;

    const alertsQuery = query(
      ref(rtdb, `groups/${group.id}/alerts`),
      limitToLast(1),
    );
    const unsubscribe = onValue(alertsQuery, (snapshot) => {
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          const alertId = childSnapshot.key;

          if (data.status !== "resolved" && data.status !== "aided") {
            setActiveAlert({ id: alertId, ...data });
          } else {
            setActiveAlert(null);
          }
        });
      } else {
        setActiveAlert(null);
      }
    });

    return () => unsubscribe();
  }, [group?.id]);

  // Handle the Guardian's selection from the Action Sheet
  const handleStatusUpdate = async (
    status: "responded" | "on_the_way" | "arrived" | "aided",
  ) => {
    if (!activeAlert?.id || !group?.id) return;
    setIsUpdatingStatus(true);

    try {
      const alertRef = ref(rtdb, `groups/${group.id}/alerts/${activeAlert.id}`);
      await update(alertRef, {
        currentStatus: status,
        lastResponderName: user?.email?.split("@")[0] || "A Guardian",
        lastUpdateAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsUpdatingStatus(false);
      setShowActionSheet(false);
    }
  };

  // 🛰️ D. High-Accuracy Tracking for Guardian's Distance Computations
  const startMyGuardianTracking = async (groupId: string) => {
    if (!user?.id) return;

    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") return;

    // Upgraded tracking params matching navigation logic to keep metric streaming smooth
    locationWatcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000, // Update location calculation every 2 seconds
        distanceInterval: 1, // Recalculate distance every 1 meter moved
      },
      async (newLoc) => {
        const accuracy = newLoc.coords.accuracy ?? 999;

        // Ignore very poor GPS fixes
        if (accuracy > 50) {
          console.log(`Skipping inaccurate reading (${accuracy.toFixed(0)}m)`);
          return;
        }

        const coords = {
          latitude: newLoc.coords.latitude,
          longitude: newLoc.coords.longitude,
        };

        console.log("Guardian Location:", {
          ...coords,
          accuracy,
          speed: newLoc.coords.speed,
          heading: newLoc.coords.heading,
        });

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
  // --- Actions ---
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
        wearerName: wearerName,
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
      Alert.alert("Success", `Group created! Arduino Device ID: ${deviceId}`);
    } catch (error) {
      Alert.alert("Error", "Could not create group.");
    }
    Platform.OS === "ios" ? null : setActionLoading(false);
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
    } catch (error) {
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
    } catch (e) {
      Alert.alert("Error", "Failed to update status.");
    } finally {
      setStatusLoading(false);
    }
  };

  // 🎯 COMPUTATION ENGINE: Evaluates real-time distance separation metrics
  const getDistanceText = (member: GroupMember): string => {
    if (!wearerLocation) return "Waiting GPS...";
    if (!member.location) return "Locating...";

    const km = getDistanceKm(
      wearerLocation.latitude,
      wearerLocation.longitude,
      member.location.latitude,
      member.location.longitude,
    );

    // Smooth readable formatting formatting switcher (meters vs kilometers)
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(2)}km`; // Provides exact 2-decimal tracking accuracy
  };

  // --- Render ---
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

      <View
        style={[styles.header, { paddingTop: Platform.OS === "ios" ? 60 : 40 }]}
      >
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {group ? group.name : "Guardian Group"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: alertButtonPaddingBottom },
        ]}
      >
        {!group ? (
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
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border },
                  ]}
                  placeholder="Group Name"
                  placeholderTextColor={theme.subText}
                  value={groupName}
                  onChangeText={setGroupName}
                />
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border },
                  ]}
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
                  <Text
                    style={{
                      color: theme.subText,
                      marginTop: 15,
                      textAlign: "center",
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.form}>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border },
                  ]}
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
                  <Text
                    style={{
                      color: theme.subText,
                      marginTop: 15,
                      textAlign: "center",
                    }}
                  >
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
              style={[
                styles.myStatusCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View>
                <Text
                  style={{
                    color: theme.subText,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  MY STATUS
                </Text>
                <Text
                  style={{
                    color:
                      myStatus === "Available" ? theme.success : theme.danger,
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
                  {
                    borderColor:
                      myStatus === "Available" ? theme.danger : theme.success,
                  },
                ]}
                onPress={handleToggleStatus}
                disabled={statusLoading}
              >
                {statusLoading ? (
                  <ActivityIndicator size="small" color={theme.brandGold} />
                ) : (
                  <Text
                    style={{
                      color:
                        myStatus === "Available" ? theme.danger : theme.success,
                      fontWeight: "700",
                    }}
                  >
                    Set {myStatus === "Available" ? "Unavailable" : "Available"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* IoT Wearable Location Status */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.text, paddingBottom: 5 },
                ]}
              >
                IoT Wearable Location
              </Text>
              {wearerLocation ? (
                <Text
                  style={{
                    color: theme.success,
                    paddingHorizontal: 16,
                    paddingBottom: 16,
                  }}
                >
                  ● Signal Active ({wearerLocation.latitude.toFixed(4)},{" "}
                  {wearerLocation.longitude.toFixed(4)})
                </Text>
              ) : (
                <Text
                  style={{
                    color: theme.danger,
                    paddingHorizontal: 16,
                    paddingBottom: 16,
                  }}
                >
                  Device not sending data yet
                </Text>
              )}
            </View>

            {/* Member List */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingRight: 16,
                }}
              >
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Guardians
                </Text>
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
                        color:
                          member.status === "Available"
                            ? theme.success
                            : theme.danger,
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      ● {member.status}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        color: theme.text,
                        fontWeight: "800",
                        fontSize: 16,
                      }}
                    >
                      {getDistanceText(member)}
                    </Text>
                    <Text style={{ color: theme.subText, fontSize: 10 }}>
                      from wearer
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
        {activeAlert && renderAlertButtonInScroll && (
          <View style={styles.alertButtonRelativeContainer}>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => setShowActionSheet(true)}
            >
              <Text style={styles.alertButtonText}>
                I'm Responding to Alert
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {activeAlert && renderAlertButtonAtBottom && (
        <View style={styles.alertButtonContainer}>
          <TouchableOpacity
            style={styles.alertButton}
            onPress={() => setShowActionSheet(true)}
          >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: "800" },
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
  alertButtonContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: Platform.OS === "ios" ? 110 : 20,
    zIndex: 10,
  },
  alertButtonRelativeContainer: {
    padding: 20,
    paddingBottom: 0,
  },
  alertButton: {
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  alertButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});
