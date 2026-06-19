import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
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

export default function PersonalDetailsScreen() {
  const handleSaveChanges = () => {
    Alert.alert("Saved", "Personal details saved successfully.", [
      {
        text: "OK",
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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

          <Text style={styles.name}>Uthman</Text>
          <Text style={styles.email}>group12prescription@gmail.com</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <InfoField label="Full Name" icon="person-outline" value="Uthman" />

          <InfoField
            label="Email Address"
            icon="mail-outline"
            value="group12prescription@gmail.com"
          />

          <InfoField
            label="Phone Number"
            icon="call-outline"
            value="+971 50 000 0000"
          />

          <View style={styles.twoColumnRow}>
            <View style={styles.halfBox}>
              <Text style={styles.label}>Age</Text>
              <View style={styles.smallInputBox}>
                <Ionicons name="calendar-outline" size={20} color="#9AA8BD" />
                <Text style={styles.inputText}>27</Text>
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
                <Text style={styles.inputText}>Male</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>

          <InfoField
            label="Contact Name"
            icon="people-outline"
            value="Emergency Contact"
          />

          <InfoField
            label="Contact Phone"
            icon="call-outline"
            value="+971 50 111 1111"
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.saveButton}
          onPress={handleSaveChanges}
        >
          <Text style={styles.saveText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

type InfoFieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
};

function InfoField({ label, icon, value }: InfoFieldProps) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputBox}>
        <Ionicons name={icon} size={21} color="#9AA8BD" />
        <Text style={styles.inputText} numberOfLines={2}>
          {value}
        </Text>
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
});
