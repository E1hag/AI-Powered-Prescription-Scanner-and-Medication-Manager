import { isSupabaseConfigured, supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      nextErrors.fullName = "Full name is required";
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = "Invalid email format";
    }

    if (!phone.trim()) {
      nextErrors.phone = "Phone number is required";
    } else if (!/^[0-9]{8,15}$/.test(phone)) {
      nextErrors.phone = "Phone number must be 8 to 15 digits";
    }

    if (!password) {
      nextErrors.password = "Password is required";
    } else if (password.length < 10) {
      nextErrors.password = "Password must be at least 10 characters";
    } else if (!/[A-Z]/.test(password)) {
      nextErrors.password = "Password must include at least one uppercase letter";
    } else if (!/[a-z]/.test(password)) {
      nextErrors.password = "Password must include at least one lowercase letter";
    } else if (!/[0-9]/.test(password)) {
      nextErrors.password = "Password must include at least one number";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const signUp = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        "Supabase Not Configured",
        "Please check your .env file. Your Supabase URL or anon key is missing or invalid.",
      );
      return;
    }

    if (!validate()) return;

    try {
      setIsLoading(true);
      setErrors({});

      const trimmedEmail = email.trim().toLowerCase();
      const trimmedFullName = fullName.trim();
      const trimmedPhone = phone.trim();

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedFullName,
            phone: trimmedPhone,
          },
        },
      });

      if (error) {
        setErrors({ general: error.message });
        return;
      }

      if (data.session) {
        router.replace("/(tabs)");
        return;
      }

      Alert.alert(
        "Check Your Email",
        "We sent you a confirmation link. Please verify your email, then sign in.",
      );
      router.replace("/login");
    } catch (error) {
      setErrors({
        general:
          error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoCircle}>
          <Ionicons name="medical" size={62} color="#2563eb" />
        </View>

        <Text style={styles.appName}>MEDCO</Text>

        <Text style={styles.subtitle}>
          Create your account to start tracking medications and prescriptions.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Account</Text>

          <Text style={styles.cardSubtitle}>
            Sign up to use live backend features.
          </Text>

          {errors.general ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{errors.general}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputBox}>
            <Ionicons name="person-outline" size={22} color="#94a3b8" />
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />
          </View>
          {errors.fullName ? (
            <Text style={styles.error}>{errors.fullName}</Text>
          ) : null}

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputBox}>
            <Ionicons name="mail-outline" size={22} color="#94a3b8" />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>
          {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputBox}>
            <Ionicons name="call-outline" size={22} color="#94a3b8" />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>
          {errors.phone ? <Text style={styles.error}>{errors.phone}</Text> : null}

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputBox}>
            <Ionicons name="lock-closed-outline" size={22} color="#94a3b8" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!isPasswordVisible}
              style={styles.input}
            />
            <TouchableOpacity
              onPress={() => setIsPasswordVisible((current) => !current)}
            >
              <Ionicons
                name={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
                size={22}
                color="#64748b"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.passwordHint}>
            At least 10 characters, with an uppercase letter, a lowercase
            letter, and a number.
          </Text>
          {errors.password ? (
            <Text style={styles.error}>{errors.password}</Text>
          ) : null}

          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputBox}>
            <Ionicons name="lock-closed-outline" size={22} color="#94a3b8" />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!isPasswordVisible}
              style={styles.input}
            />
          </View>
          {errors.confirmPassword ? (
            <Text style={styles.error}>{errors.confirmPassword}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.signInButton}
            onPress={signUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.signInButtonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchLink}
            onPress={() => router.replace("/login")}
            disabled={isLoading}
          >
            <Text style={styles.switchLinkText}>
              Already have an account? Login
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  appName: {
    fontSize: 38,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 24,
    marginTop: 10,
    marginBottom: 30,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 22,
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 8,
  },
  inputBox: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#0f172a",
    marginLeft: 10,
  },
  passwordHint: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 6,
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorBoxText: {
    color: "#b91c1c",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  signInButton: {
    height: 62,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  signInButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  switchLink: {
    alignItems: "center",
    marginTop: 18,
  },
  switchLinkText: {
    color: "#2563eb",
    fontSize: 15,
    fontWeight: "700",
  },
  bottomSpace: {
    height: 50,
  },
});
