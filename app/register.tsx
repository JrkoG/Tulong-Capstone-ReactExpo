import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading] = useState(false);
  const [error, setError] = useState("");
  const [success] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.5)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const blob1X = useRef(new Animated.Value(0)).current;
  const blob1Y = useRef(new Animated.Value(0)).current;
  const blob2X = useRef(new Animated.Value(0)).current;
  const blob2Y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(blob1X, {
            toValue: 20,
            duration: 8000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(blob1Y, {
            toValue: 30,
            duration: 8000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(blob1X, {
            toValue: 0,
            duration: 8000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(blob1Y, {
            toValue: 0,
            duration: 8000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(blob2X, {
            toValue: -15,
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(blob2Y, {
            toValue: 20,
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(blob2X, {
            toValue: 0,
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(blob2Y, {
            toValue: 0,
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();
  }, []);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleRegister = () => {
    setError("");
    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      triggerShake();
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      triggerShake();
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      triggerShake();
      return;
    }

  // Password strength indicator
  const getPasswordStrength = () => {
    if (password.length === 0) return null;
    if (password.length < 6)
      return { label: "Weak", color: "#f87171", width: "30%" };
    if (password.length < 10)
      return { label: "Fair", color: "#fb923c", width: "60%" };
    return { label: "Strong", color: "#4ade80", width: "100%" };
  };
  const strength = getPasswordStrength();

  return (
    <View style={styles.container}>
      {/* Ambient blobs */}
      <Animated.View
        style={[
          styles.blob1,
          { transform: [{ translateX: blob1X }, { translateY: blob1Y }] },
        ]}
      />
      <Animated.View
        style={[
          styles.blob2,
          { transform: [{ translateX: blob2X }, { translateY: blob2Y }] },
        ]}
      />

      {/* Success overlay */}
      {success && (
        <Animated.View
          style={[styles.successOverlay, { opacity: successAnim }]}
        >
          <Animated.View style={{ transform: [{ scale: successScale }] }}>
            <LinearGradient
              colors={["#6366f1", "#ec4899"]}
              style={styles.successIconGrad}
            >
              <Text style={styles.successCheck}>✓</Text>
            </LinearGradient>
          </Animated.View>
          <Text style={styles.successTitle}>ACCOUNT CREATED</Text>
          <Text style={styles.successSub}>Welcome aboard! Redirecting…</Text>
        </Animated.View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View
            style={{
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            }}
          >
            <LinearGradient
              colors={["#6366f1", "#ec4899"]}
              style={styles.logoMark}
            >
              <Text style={styles.logoIcon}>⬡</Text>
            </LinearGradient>
            <Text style={styles.welcomeLabel}>Get started</Text>
            <Text style={styles.titleLine}>CREATE</Text>
            <Text style={styles.titleLineAccent}>YOUR</Text>
            <Text style={styles.titleLine}>ACCOUNT</Text>
            <Text style={styles.subtitle}>
              Join thousands of users.{"\n"}It only takes a minute.
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View
            style={{
              marginTop: 40,
              opacity: formAnim,
              transform: [
                {
                  translateY: formAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            }}
          >
            {/* Error */}
            {error ? (
              <Animated.View
                style={[
                  styles.errorBox,
                  { transform: [{ translateX: shakeAnim }] },
                ]}
              >
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View
                style={[
                  styles.inputWrapper,
                  nameFocused && styles.inputWrapperFocused,
                ]}
              >
                <Text
                  style={[
                    styles.inputIcon,
                    nameFocused && styles.inputIconFocused,
                  ]}
                >
                  👤
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  autoCapitalize="words"
                  autoCorrect={false}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                />
              </View>
            </View>

            {/* Email */}
            <View style={[styles.fieldGroup, { marginTop: 16 }]}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View
                style={[
                  styles.inputWrapper,
                  emailFocused && styles.inputWrapperFocused,
                ]}
              >
                <Text
                  style={[
                    styles.inputIcon,
                    emailFocused && styles.inputIconFocused,
                  ]}
                >
                  ✉
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* Password */}
            <View style={[styles.fieldGroup, { marginTop: 16 }]}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View
                style={[
                  styles.inputWrapper,
                  passwordFocused && styles.inputWrapperFocused,
                ]}
              >
                <Text
                  style={[
                    styles.inputIcon,
                    passwordFocused && styles.inputIconFocused,
                  ]}
                >
                  🔒
                </Text>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>
                    {showPassword ? "🙈" : "👁️"}
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Password strength bar */}
              {strength && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthTrack}>
                    <View
                      style={[
                        styles.strengthFill,
                        {
                          width: strength.width as any,
                          backgroundColor: strength.color,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.strengthLabel, { color: strength.color }]}
                  >
                    {strength.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Confirm Password */}
            <View style={[styles.fieldGroup, { marginTop: 16 }]}>
              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <View
                style={[
                  styles.inputWrapper,
                  confirmFocused && styles.inputWrapperFocused,
                ]}
              >
                <Text
                  style={[
                    styles.inputIcon,
                    confirmFocused && styles.inputIconFocused,
                  ]}
                >
                  🔒
                </Text>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder="Re-enter password"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirm(!showConfirm)}
                >
                  <Text style={styles.eyeIcon}>
                    {showConfirm ? "🙈" : "👁️"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Terms note */}
            <Text style={styles.termsText}>
              By creating an account you agree to our{" "}
              <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>

            {/* Register button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
              style={{ marginTop: 8 }}
            >
              <LinearGradient
                colors={["#6366f1", "#8b5cf6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.btnText}>Create Account</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons */}
            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                <Text style={styles.socialBtnText}>G Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                <Text style={styles.socialBtnText}>🍎 Apple</Text>
              </TouchableOpacity>
            </View>

            {/* Login link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>Sign in</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d14",
    maxWidth: Platform.select({ web: 480, default: undefined }),
    width: "100%",
    alignSelf: "center",
  },
  blob1: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(99,102,241,0.18)",
    top: -80,
    right: -60,
  },
  blob2: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(236,72,153,0.12)",
    bottom: 100,
    left: -40,
  },
  scroll: {
    paddingHorizontal: 32,
    flexGrow: 1,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logoIcon: {
    color: "#fff",
    fontSize: 26,
  },
  welcomeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6366f1",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  titleLine: {
    fontSize: 52,
    fontWeight: "900",
    color: "#ffffff",
    lineHeight: 54,
    letterSpacing: 1,
  },
  titleLineAccent: {
    fontSize: 52,
    fontWeight: "900",
    color: "#6366f1",
    lineHeight: 54,
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 14,
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "300",
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.2)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
  },
  inputWrapperFocused: {
    borderColor: "rgba(99,102,241,0.5)",
    backgroundColor: "rgba(99,102,241,0.07)",
  },
  inputIcon: {
    paddingLeft: 16,
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
  },
  inputIconFocused: {
    color: "#6366f1",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 15, android: 12, web: 15 }),
    fontSize: 15,
    color: "#ffffff",
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    padding: 6,
  },
  eyeIcon: {
    fontSize: 16,
  },
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  strengthTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    minWidth: 40,
    textAlign: "right",
  },
  termsText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    lineHeight: 18,
    marginTop: 16,
    marginBottom: 4,
  },
  termsLink: {
    color: "#6366f1",
    fontWeight: "500",
  },
  btnPrimary: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  btnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 28,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  dividerText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    fontWeight: "500",
    letterSpacing: 1,
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  socialBtnText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  footerText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
  },
  footerLink: {
    color: "#6366f1",
    fontSize: 13,
    fontWeight: "500",
  },
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: "#0d0d14",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  successIconGrad: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 12,
  },
  successCheck: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "700",
  },
  successTitle: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 3,
    marginTop: 8,
  },
  successSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
})
};
