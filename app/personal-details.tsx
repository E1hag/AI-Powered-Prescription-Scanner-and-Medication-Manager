import { useAuthSession } from "@/src/features/auth/hooks/use-auth-session";
import { getAccountDisplay } from "@/src/features/auth/utils/account-display";
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
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

const COLORS = {
  bg: "#F4F7FB",
  card: "#FFFFFF",
  text: "#0F172A",
  subText: "#8A97AA",
  blue: "#2563EB",
  lightBlue: "#DBEAFE",
  green: "#16A34A",
  lightGreen: "#DCFCE7",
  border: "#E5EAF2",
};

const PERSONAL_DETAILS_STORAGE_KEY = "MEDCO_PERSONAL_DETAILS";

type LocalPersonalDetails = {
  age: string;
  gender: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

const defaultLocalDetails: LocalPersonalDetails = {
  age: "",
  gender: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
};

function getMetadataValue(user: ReturnType<typeof useAuthSession>["user"], key: string) {
  const value = user?.user_metadata?.[key];

  return typeof value === "string" ? value.trim() : "";
}

export default function PersonalDetailsScreen() {
  const { user } = useAuthSession();
  const accountDisplay = useMemo(() => getAccountDisplay(user), [user]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState(defaultLocalDetails.age);
  const [gender, setGender] = useState(defaultLocalDetails.gender);
  const [emergencyContactName, setEmergencyContactName] = useState(
    defaultLocalDetails.emergencyContactName,
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    defaultLocalDetails.emergencyContactPhone,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFullName(
      getMetadataValue(user, "full_name") ||
        (user?.email ? user.email.split("@")[0] : ""),
    );
    setEmail(user?.email ?? "");
    setPhone(getMetadataValue(user, "phone"));
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    async function loadLocalDetails() {
      try {
        const savedDetailsRaw = await AsyncStorage.getItem(
          PERSONAL_DETAILS_STORAGE_KEY,
        );

        if (!savedDetailsRaw || !isMounted) {
          return;
        }

        const savedDetails = JSON.parse(
          savedDetailsRaw,
        ) as Partial<LocalPersonalDetails>;

        setAge(savedDetails.age ?? "");
        setGender(savedDetails.gender ?? "");
        setEmergencyContactName(savedDetails.emergencyContactName ?? "");
        setEmergencyContactPhone(savedDetails.emergencyContactPhone ?? "");
      } catch {
        if (isMounted) {
          setAge(defaultLocalDetails.age);
          setGender(defaultLocalDetails.gender);
          setEmergencyContactName(defaultLocalDetails.emergencyContactName);
          setEmergencyContactPhone(defaultLocalDetails.emergencyContactPhone);
        }
      }
    }

    loadLocalDetails();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveChanges = async () => {
    if (!user) {
      Alert.alert("Not Signed In", "Please sign in before editing your details.");
      return;
    }

    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedFullName) {
      Alert.alert("Missing Name", "Please enter your full name.");
      return;
    }

    if (!trimmedEmail || !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    try {
      setIsSaving(true);

      const updatePayload: {
        email?: string;
        data: {
          full_name: string;
          phone: string;
        };
      } = {
        data: {
          full_name: trimmedFullName,
          phone: trimmedPhone,
        },
      };

      if (trimmedEmail !== user.email) {
        updatePayload.email = trimmedEmail;
      }

      const { error } = await supabase.auth.updateUser(updatePayload);

      if (error) {
        Alert.alert("Save Failed", error.message);
        return;
      }

      await AsyncStorage.setItem(
        PERSONAL_DETAILS_STORAGE_KEY,
        JSON.stringify({
          age: age.trim(),
          gender: gender.trim(),
          emergencyContactName: emergencyContactName.trim(),
          emergencyContactPhone: emergencyContactPhone.trim(),
        } satisfies LocalPersonalDetails),
      );

      Alert.alert(
        "Saved",
        trimmedEmail !== user.email
          ? "Personal details saved. Please check your email to confirm the address change."
          : "Personal details saved successfully.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Personal Details</Text>
        <Text style={styles.subtitle}>
          View your basic personal and emergency information.
        </Text>

        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={48} color={COLORS.blue} />
          </View>

          <Text style={styles.name}>{fullName.trim() || accountDisplay.fullName}</Text>
          <Text style={styles.email}>{email.trim() || accountDisplay.email}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <EditableInfoField
            label="Full Name"
            icon="person-outline"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
          />

          <EditableInfoField
            label="Email Address"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email address"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <EditableInfoField
            label="Phone Number"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />

          <View style={styles.twoColumnRow}>
            <View style={styles.halfBox}>
              <Text style={styles.label}>Age</Text>
              <View style={styles.smallInputBox}>
                <Ionicons name="calendar-outline" size={20} color="#9AA8BD" />
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  placeholder="Age"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  style={styles.smallInputText}
                />
              </View>
            </View>

            <View style={styles.halfBox}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.smallInputBox}>
                <Ionicons
                  name="male-female-outline"
                  size={20}
                  color="#9AA8BD"
                />
                <TextInput
                  value={gender}
                  onChangeText={setGender}
                  placeholder="Gender"
                  placeholderTextColor="#94a3b8"
                  style={styles.smallInputText}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>

          <EditableInfoField
            label="Contact Name"
            icon="people-outline"
            value={emergencyContactName}
            onChangeText={setEmergencyContactName}
            placeholder="Enter emergency contact"
          />

          <EditableInfoField
            label="Contact Phone"
            icon="call-outline"
            value={emergencyContactPhone}
            onChangeText={setEmergencyContactPhone}
            placeholder="Enter emergency phone"
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.saveButton, isSaving && styles.disabledButton]}
          onPress={handleSaveChanges}
          disabled={isSaving}
        >
          <Text style={styles.saveText}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type EditableInfoFieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

function EditableInfoField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: EditableInfoFieldProps) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputBox}>
        <Ionicons name={icon} size={21} color="#9AA8BD" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={styles.inputText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingTop: 72,
    paddingHorizontal: 22,
    paddingBottom: 115,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 27,
    color: COLORS.subText,
    fontWeight: "500",
    marginBottom: 22,
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: "center",
    marginBottom: 22,
  },
  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: COLORS.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  name: {
    fontSize: 29,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },
  email: {
    marginTop: 6,
    fontSize: 16,
    color: "#718096",
    fontWeight: "500",
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 22,
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 18,
  },
  fieldWrapper: {
    marginBottom: 17,
  },
  label: {
    fontSize: 15,
    fontWeight: "900",
    color: "#334155",
    marginBottom: 8,
  },
  inputBox: {
    minHeight: 58,
    borderWidth: 1.3,
    borderColor: COLORS.border,
    borderRadius: 17,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  inputText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    minHeight: 56,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 12,
  },
  halfBox: {
    flex: 1,
  },
  smallInputBox: {
    height: 58,
    borderWidth: 1.3,
    borderColor: COLORS.border,
    borderRadius: 17,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  smallInputText: {
    flex: 1,
    height: 56,
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.blue,
    height: 56,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
});
