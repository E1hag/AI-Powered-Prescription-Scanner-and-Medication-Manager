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

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const signIn = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        "Supabase Not Configured",
        "Please check your .env file. Your Supabase URL or anon key is missing or invalid.",
      );
      return;
    }

    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Details", "Please enter both email and password.");
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert(
        "Login Failed",
        error instanceof Error ? error.message : "Something went wrong.",
      );
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
          Medication reminder, prescription scanning, chatbot guidance, and
          adherence tracking.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>

          <Text style={styles.cardSubtitle}>
            Sign in to continue using live backend features.
          </Text>

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

          <TouchableOpacity
            style={styles.signInButton}
            onPress={signIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchLink}
            onPress={() => router.replace("/register")}
            disabled={isLoading}
          >
            <Text style={styles.switchLinkText}>
              Don&apos;t have an account? Sign Up
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.warningBox}>
          <Ionicons name="alert-circle" size={22} color="#b45309" />
          <Text style={styles.warningText}>
            MEDCO provides general medication support only and does not replace
            professional medical advice.
          </Text>
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
    paddingTop: 78,
  },
  logoCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 26,
  },
  appName: {
    fontSize: 42,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 28,
    marginTop: 12,
    marginBottom: 40,
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
    fontSize: 30,
    fontWeight: "900",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 23,
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
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#0f172a",
    marginLeft: 10,
  },
  signInButton: {
    height: 62,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
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
  warningBox: {
    backgroundColor: "#fef3c7",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 28,
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#92400e",
    fontWeight: "700",
  },
  bottomSpace: {
    height: 50,
  },
});
