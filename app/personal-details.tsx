import { useAuthSession } from "@/src/features/auth/hooks/use-auth-session";
import { getAccountDisplay } from "@/src/features/auth/utils/account-display";
import { supabase } from "@/src/lib/supabase";
import {
  getPatientPersonalDetailsFromSupabase,
  savePatientPersonalDetailsToSupabase,
} from "@/src/services/medcoSupabaseService";
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
  emergencyContactName: string;
  emergencyContactPhone: string;
};

const defaultLocalDetails: LocalPersonalDetails = {
  emergencyContactName: "",
  emergencyContactPhone: "",
};

function getMetadataValue(
  user: ReturnType<typeof useAuthSession>["user"],
  key: string,
) {
  const value = user?.user_metadata?.[key];

  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(", ");
  }

  return "";
}

function isValidDateOfBirth(value: string) {
  if (!value.trim()) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return false;
  }

  const date = new Date(`${value.trim()}T00:00:00`);

  return !Number.isNaN(date.getTime());
}

export default function PersonalDetailsScreen() {
  const { user } = useAuthSession();
  const accountDisplay = useMemo(() => getAccountDisplay(user), [user]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState(
    defaultLocalDetails.emergencyContactName,
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    defaultLocalDetails.emergencyContactPhone,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRemoteProfile, setIsLoadingRemoteProfile] = useState(false);

  useEffect(() => {
    setFullName(
      getMetadataValue(user, "full_name") ||
        (user?.email ? user.email.split("@")[0] : ""),
    );
    setEmail(user?.email ?? "");
    setPhone(getMetadataValue(user, "phone"));
    setDateOfBirth(getMetadataValue(user, "date_of_birth"));
    setGender(getMetadataValue(user, "gender"));
    setAllergies(getMetadataValue(user, "allergies"));
    setConditions(getMetadataValue(user, "conditions"));
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

        setEmergencyContactName(savedDetails.emergencyContactName ?? "");
        setEmergencyContactPhone(savedDetails.emergencyContactPhone ?? "");
      } catch {
        if (isMounted) {
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

  useEffect(() => {
    let isMounted = true;

    async function loadRemoteProfile() {
      if (!user) {
        return;
      }

      try {
        setIsLoadingRemoteProfile(true);

        const details = await getPatientPersonalDetailsFromSupabase();

        if (!isMounted || !details) {
          return;
        }

        setFullName(
          details.fullName ||
            getMetadataValue(user, "full_name") ||
            (user.email ? user.email.split("@")[0] : ""),
        );
        setEmail(details.email || user.email || "");
        setPhone(details.phone || getMetadataValue(user, "phone"));
        setDateOfBirth(
          details.dateOfBirth || getMetadataValue(user, "date_of_birth"),
        );
        setGender(details.gender || getMetadataValue(user, "gender"));
        setAllergies(details.allergies || getMetadataValue(user, "allergies"));
        setConditions(
          details.conditions || getMetadataValue(user, "conditions"),
        );
      } catch {
        // If remote profile fails to load, keep metadata/local fallback values.
      } finally {
        if (isMounted) {
          setIsLoadingRemoteProfile(false);
        }
      }
    }

    loadRemoteProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSaveChanges = async () => {
    if (!user) {
      Alert.alert(
        "Not Signed In",
        "Please sign in before editing your details.",
      );
      return;
    }

    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    const trimmedDateOfBirth = dateOfBirth.trim();
    const trimmedGender = gender.trim();
    const trimmedAllergies = allergies.trim();
    const trimmedConditions = conditions.trim();

    if (!trimmedFullName) {
      Alert.alert("Missing Name", "Please enter your full name.");
      return;
    }

    if (!trimmedEmail || !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (!isValidDateOfBirth(trimmedDateOfBirth)) {
      Alert.alert(
        "Invalid Date of Birth",
        "Please use YYYY-MM-DD format, for example 2001-04-25.",
      );
      return;
    }

    try {
      setIsSaving(true);

      const updatePayload: {
        email?: string;
        data: {
          full_name: string;
          phone: string;
          date_of_birth: string | null;
          gender: string | null;
          allergies: string[];
          conditions: string[];
        };
      } = {
        data: {
          full_name: trimmedFullName,
          phone: trimmedPhone,
          date_of_birth: trimmedDateOfBirth || null,
          gender: trimmedGender || null,
          allergies: trimmedAllergies
            .split(/[,;\n]/)
            .map((item) => item.trim())
            .filter(Boolean),
          conditions: trimmedConditions
            .split(/[,;\n]/)
            .map((item) => item.trim())
            .filter(Boolean),
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

      await savePatientPersonalDetailsToSupabase({
        fullName: trimmedFullName,
        email: trimmedEmail,
        phone: trimmedPhone,
        dateOfBirth: trimmedDateOfBirth,
        gender: trimmedGender,
        allergies: trimmedAllergies,
        conditions: trimmedConditions,
      });

      await AsyncStorage.setItem(
        PERSONAL_DETAILS_STORAGE_KEY,
        JSON.stringify({
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
    } catch (error) {
      Alert.alert(
        "Save Failed",
        error instanceof Error
          ? error.message
          : "Unable to save personal details.",
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
          View and update your basic personal, health, and emergency
          information.
        </Text>

        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={48} color={COLORS.blue} />
          </View>

          <Text style={styles.name}>
            {fullName.trim() || accountDisplay.fullName}
          </Text>
          <Text style={styles.email}>
            {email.trim() || accountDisplay.email}
          </Text>

          {isLoadingRemoteProfile ? (
            <Text style={styles.loadingText}>Loading saved profile...</Text>
          ) : null}
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
              <Text style={styles.label}>Date of Birth</Text>
              <View style={styles.smallInputBox}>
                <Ionicons name="calendar-outline" size={20} color="#9AA8BD" />
                <TextInput
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
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
          <Text style={styles.sectionTitle}>Medical Information</Text>

          <EditableTextAreaField
            label="Allergies"
            icon="warning-outline"
            value={allergies}
            onChangeText={setAllergies}
            placeholder="Example: Penicillin, peanuts"
          />

          <EditableTextAreaField
            label="Medical Conditions"
            icon="heart-outline"
            value={conditions}
            onChangeText={setConditions}
            placeholder="Example: Diabetes, asthma"
          />

          <Text style={styles.infoHint}>
            Separate multiple allergies or conditions with commas. These details
            are saved to the patient profile and medical profile records.
          </Text>
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

function EditableTextAreaField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
}: EditableInfoFieldProps) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.textAreaBox}>
        <Ionicons name={icon} size={21} color="#9AA8BD" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          multiline
          textAlignVertical="top"
          style={styles.textAreaInput}
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
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "800",
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
  textAreaBox: {
    minHeight: 104,
    borderWidth: 1.3,
    borderColor: COLORS.border,
    borderRadius: 17,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  textAreaInput: {
    flex: 1,
    minHeight: 76,
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },
  infoHint: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#64748b",
    fontWeight: "700",
    marginTop: -2,
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
