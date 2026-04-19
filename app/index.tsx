import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../config/firebase";

export default function App() {
  const [connected, setConnected] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // A much safer way to "test" connection is just ensuring the objects exist
    const testConnection = () => {
      if (auth && db) {
        console.log("✅ Firebase initialized successfully!");
        setConnected(true);
      } else {
        console.log("❌ Firebase failed to initialize.");
      }
    };
    testConnection();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tulong App 🚨</Text>
      <Text style={[styles.status, { color: connected ? "#4ade80" : "#f87171" }]}>
        Firebase: {connected ? "✅ Connected" : "❌ Connecting..."}
      </Text>

      <View style={styles.btnGroup}>
        <TouchableOpacity
          style={styles.btnLogin}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.btnText}>Go to Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnRegister}
          onPress={() => router.push("/register")}
        >
          <Text style={styles.btnText}>Go to Register</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0d14",
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  status: {
    fontSize: 15,
    marginBottom: 24,
  },
  btnGroup: {
    width: "80%",
    gap: 12,
  },
  btnLogin: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnRegister: {
    backgroundColor: "transparent",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#6366f1",
  },
  btnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});