import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { db } from "../config/firebase";

export default function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "alerts"));
        console.log("✅ Firebase connected! Docs found:", querySnapshot.size);
        setConnected(true);
      } catch (error) {
        console.log("❌ Firebase error:", error);
      }
    };
    testConnection();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 24 }}>Tulong App 🚨</Text>
      <Text style={{ color: connected ? "green" : "red" }}>
        Firebase: {connected ? "✅ Connected" : "❌ Connecting..."}
      </Text>
    </View>
  );
}
