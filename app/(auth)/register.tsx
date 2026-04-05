import { Link, Stack } from "expo-router";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from "react-native";

import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../context/authContext';

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { login } = useAuth();

  const theme = {
    background: isDark ? '#000000' : '#FFFFFF', 
    text: isDark ? '#FFFFFF' : '#1C1C1E',
    border: isDark ? '#333333' : 'rgba(0,0,0,0.1)',
    placeholder: isDark ? '#666666' : '#A0A0A5',
    brandGold: '#D0A97E',
  };

  const contentAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleRegister = async () => {
    setError("");
    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        name,
        email,
        createdAt: serverTimestamp(),
        role: "user",
      });

      await login({ id: uid, email });
    } catch (e: any) {
      setError(e.message || "Registration failed.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 60, paddingBottom: 60 },
          ]}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: contentAnim }}>
            
            <View style={styles.logoRow}>
              <View style={[styles.logoBox, { borderColor: theme.brandGold }]}>
                <Ionicons name="location-sharp" size={24} color={theme.brandGold} />
              </View>
              <View>
                <Text style={[styles.brandName, { color: theme.text }]}>Tulong</Text>
                <Text style={[styles.brandSub, { color: theme.placeholder }]}>Community Safety</Text>
              </View>
            </View>

            <Text style={[styles.mainTitle, { color: theme.text }]}>Create Account</Text>

            <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
              <TextInput
                style={[styles.typingInput, { color: theme.text, borderBottomColor: theme.border }]}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                placeholder="" 
              />

              <Text style={[styles.label, { color: theme.text, marginTop: 24 }]}>Email Address</Text>
              <TextInput
                style={[styles.typingInput, { color: theme.text, borderBottomColor: theme.border }]}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="" 
              />

              <Text style={[styles.label, { color: theme.text, marginTop: 24 }]}>Password</Text>
              <View style={[styles.inputWrapper, { borderBottomColor: theme.border }]}>
                <TextInput
                  style={[styles.passwordTypingInput, { color: theme.text }]}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="" 
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIconContainer}>
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={theme.placeholder} 
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: theme.text, marginTop: 24 }]}>Confirm Password</Text>
              <View style={[styles.inputWrapper, { borderBottomColor: theme.border }]}>
                <TextInput
                  style={[styles.passwordTypingInput, { color: theme.text }]}
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="" 
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIconContainer}>
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={theme.placeholder} 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                onPress={handleRegister} 
                disabled={loading} 
                style={[styles.registerBtn, { backgroundColor: isDark ? '#FFFFFF' : '#FFFFFF' }]}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={[styles.registerBtnText, { color: '#000' }]}>Create now</Text>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <Text style={[styles.dividerText, { color: theme.placeholder }]}>Or continue with</Text>
              </View>

              <View style={styles.socialRow}>
                <TouchableOpacity style={[styles.socialBtnSingle, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <Image 
                    source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1200px-Google_%22G%22_logo.svg.png' }} 
                    style={{ width: 22, height: 22 }} 
                  />
                  <Text style={[styles.socialBtnText, { color: theme.text }]}>Google</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={{ color: theme.placeholder }}>Already have an account? </Text>
                <Link href="/login" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>Sign in</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 32, flexGrow: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 40 },
  logoBox: { width: 44, height: 44, borderWidth: 2, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  brandName: { fontSize: 22, fontWeight: '900' },
  brandSub: { fontSize: 12, fontWeight: '500' },
  mainTitle: { fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 30 },
  form: { width: '100%' },
  label: { fontSize: 12, fontWeight: '700' },
  
  // UPDATED TYPING FONT TO MATCH LOGIN SCREEN
  typingInput: { 
    borderBottomWidth: 1, 
    height: 50, 
    fontSize: 17, 
    marginTop: 4, 
    paddingBottom: 8,
    fontWeight: '500', 
    letterSpacing: 0.5 
  },
  inputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    height: 50, 
    marginTop: 4 
  },
  passwordTypingInput: { 
    flex: 1, 
    fontSize: 17, 
    paddingBottom: 8,
    fontWeight: '500',
    letterSpacing: 0.5
  },
  eyeIconContainer: { paddingLeft: 10, paddingBottom: 8 },

  registerBtn: { height: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  registerBtnText: { fontSize: 16, fontWeight: '700' },
  divider: { alignItems: 'center', marginVertical: 25 },
  dividerText: { fontSize: 12 },
  socialRow: { flexDirection: 'row', justifyContent: 'center' },
  socialBtnSingle: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, height: 52, borderRadius: 8, borderWidth: 1 },
  socialBtnText: { fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  errorBox: { backgroundColor: 'rgba(255,0,0,0.05)', padding: 12, borderRadius: 8, marginBottom: 15 },
  errorText: { color: '#FF4444', textAlign: 'center', fontSize: 13 }
});