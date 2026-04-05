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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/authContext';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { login } = useAuth();

  const theme = {
    background: isDark ? '#000000' : '#FFFFFF', 
    topAccent: isDark ? '#1C222E' : '#F2F2F7', 
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

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      triggerShake();
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await login({ id: userCredential.user.uid, email: userCredential.user.email || "" });
      }
    } catch (e: any) {
      setError("Invalid email or password.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.backgroundWrapper} pointerEvents="none">
        <View style={[styles.topRect, { backgroundColor: theme.topAccent }]} />
        <View style={[styles.triangleDown, { borderBottomColor: theme.topAccent }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 40, paddingBottom: 60 },
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

            {/* LOGIN TITLE: Pushed lower into the gray area circle */}
            <Text style={[styles.mainTitle, { color: theme.text }]}>Login</Text>

            <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={[styles.label, { color: theme.text }]}>Email</Text>
              <TextInput
                style={[styles.underlinedInput, { color: theme.text, borderBottomColor: theme.border }]}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                // REMOVED example suggestion placeholder
              />

              <View style={[styles.labelRow, { marginTop: 24 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                <TouchableOpacity>
                  <Text style={[styles.forgotText, { color: theme.text }]}>Forgot?</Text>
                </TouchableOpacity>
              </View>
              
              <View style={[styles.inputWrapper, { borderBottomColor: theme.border }]}>
                <TextInput
                  style={[styles.passwordInput, { color: theme.text }]}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={theme.placeholder} 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                onPress={handleLogin} 
                disabled={loading} 
                style={[styles.loginBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
              >
                {loading ? (
                  <ActivityIndicator color={isDark ? "#000" : "#FFF"} />
                ) : (
                  <Text style={[styles.loginBtnText, { color: isDark ? '#000' : '#FFF' }]}>Log In</Text>
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
                <Text style={{ color: theme.placeholder }}>Don't have account? </Text>
                <Link href="/register" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>Create now</Text>
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
  backgroundWrapper: {
    position: 'absolute',
    top: 0,
    width: width,
    height: height,
    alignItems: 'center',
    zIndex: 0,
  },
  topRect: { width: width, height: 280 },
  triangleDown: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: width / 2,
    borderRightWidth: width / 2,
    borderBottomWidth: 60,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '180deg' }],
  },
  scrollContent: { paddingHorizontal: 32, flexGrow: 1 },
  logoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 14, 
    marginBottom: 50 
  },
  logoBox: { width: 44, height: 44, borderWidth: 2, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  brandName: { fontSize: 22, fontWeight: '900' },
  brandSub: { fontSize: 12, fontWeight: '500' },
  mainTitle: { 
    fontSize: 32, 
    fontWeight: '800', 
    textAlign: 'center', 
    marginBottom: 105 // Lowered from 90 to place it deeper in the gray circle area
  },
  form: { 
    width: '100%', 
    zIndex: 10,
    marginTop: 40 
  },
  label: { fontSize: 12, fontWeight: '600' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  forgotText: { fontSize: 12, fontWeight: '600' },
  underlinedInput: { borderBottomWidth: 1, height: 45, fontSize: 16, marginTop: 4, paddingBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, height: 45, marginTop: 4 },
  passwordInput: { flex: 1, fontSize: 16, paddingBottom: 8 },
  loginBtn: { height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  loginBtnText: { fontSize: 16, fontWeight: '700' },
  divider: { alignItems: 'center', marginVertical: 25 },
  dividerText: { fontSize: 12 },
  socialRow: { flexDirection: 'row', justifyContent: 'center' },
  socialBtnSingle: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, height: 52, borderRadius: 8, borderWidth: 1 },
  socialBtnText: { fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  errorBox: { backgroundColor: 'rgba(255,0,0,0.05)', padding: 12, borderRadius: 8, marginBottom: 15 },
  errorText: { color: '#FF4444', textAlign: 'center', fontSize: 13 }
});