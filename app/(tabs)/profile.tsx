import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DoseStatus = "Pending" | "Taken" | "Missed" | "Snoozed";

type ScheduleDose = {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  time: string;
  instruction: string;
  status: DoseStatus;
};

type StoredMedicationSchedule = {
  id: string;
  createdAt: string;
  doses: ScheduleDose[];
};

type ReminderItem = {
  id: string;
  doseId: string;
  medicationName: string;
  dosage: string;
  time: string;
  instruction: string;
  isEnabled: boolean;
};

const MEDCO_SCHEDULE_STORAGE_KEY = "MEDCO_MEDICATION_SCHEDULE";
const MEDCO_REMINDERS_STORAGE_KEY = "MEDCO_DOSE_REMINDERS";
const MEDCO_ADHERENCE_HISTORY_KEY = "MEDCO_ADHERENCE_HISTORY";

const defaultDoses: ScheduleDose[] = [
  {
    id: "default-dose-1",
    medicationId: "default-med-1",
    medicationName: "Amoxicillin",
    dosage: "500mg",
    time: "08:00 AM",
    instruction: "Take after food",
    status: "Pending",
  },
  {
    id: "default-dose-2",
    medicationId: "default-med-2",
    medicationName: "Paracetamol",
    dosage: "1000mg",
    time: "02:00 PM",
    instruction: "Take only if needed for pain or fever",
    status: "Pending",
  },
  {
    id: "default-dose-3",
    medicationId: "default-med-3",
    medicationName: "Vitamin D",
    dosage: "1000 IU",
    time: "08:00 PM",
    instruction: "Take with water",
    status: "Pending",
  },
];

export default function ProfileScreen() {
  const [doses, setDoses] = useState<ScheduleDose[]>(defaultDoses);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [hasSavedSchedule, setHasSavedSchedule] = useState(false);
  const [scheduleCreatedAt, setScheduleCreatedAt] = useState<string | null>(
    null,
  );

  const loadProfileData = async () => {
    try {
      const savedScheduleRaw = await AsyncStorage.getItem(
        MEDCO_SCHEDULE_STORAGE_KEY,
      );

      if (savedScheduleRaw) {
        const savedSchedule = JSON.parse(
          savedScheduleRaw,
        ) as StoredMedicationSchedule;

        if (
          Array.isArray(savedSchedule.doses) &&
          savedSchedule.doses.length > 0
        ) {
          setDoses(savedSchedule.doses);
          setHasSavedSchedule(true);
          setScheduleCreatedAt(savedSchedule.createdAt);
        } else {
          setDoses(defaultDoses);
          setHasSavedSchedule(false);
          setScheduleCreatedAt(null);
        }
      } else {
        setDoses(defaultDoses);
        setHasSavedSchedule(false);
        setScheduleCreatedAt(null);
      }

      const savedRemindersRaw = await AsyncStorage.getItem(
        MEDCO_REMINDERS_STORAGE_KEY,
      );

      if (savedRemindersRaw) {
        const savedReminders = JSON.parse(savedRemindersRaw) as ReminderItem[];

        if (Array.isArray(savedReminders)) {
          setReminders(savedReminders);
        } else {
          setReminders([]);
        }
      } else {
        setReminders([]);
      }
    } catch {
      setDoses(defaultDoses);
      setReminders([]);
      setHasSavedSchedule(false);
      setScheduleCreatedAt(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, []),
  );

  const profileStats = useMemo(() => {
    const uniqueMedicationIds = new Set(doses.map((dose) => dose.medicationId));

    const taken = doses.filter((dose) => dose.status === "Taken").length;
    const missed = doses.filter((dose) => dose.status === "Missed").length;
    const pending = doses.filter((dose) => dose.status === "Pending").length;
    const snoozed = doses.filter((dose) => dose.status === "Snoozed").length;

    const completed = taken + missed;
    const adherencePercentage =
      completed === 0 ? 0 : Math.round((taken / completed) * 100);

    const enabledReminders = reminders.filter(
      (reminder) => reminder.isEnabled,
    ).length;

    return {
      medications: uniqueMedicationIds.size,
      totalDoses: doses.length,
      taken,
      missed,
      pending,
      snoozed,
      adherencePercentage,
      enabledReminders,
    };
  }, [doses, reminders]);

  const formatCreatedDate = (isoDate: string | null) => {
    if (!isoDate) {
      return "No scanned schedule saved yet";
    }

    try {
      const date = new Date(isoDate);

      return `Last schedule saved ${date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } catch {
      return "Schedule saved recently";
    }
  };

  const goToPersonalDetails = () => {
    router.push("/personal-details");
  };

  const goToCurrentMedications = () => {
    router.push("/current-medications");
  };

  const goToDoseReminders = () => {
    router.push("/dose-reminders");
  };

  const goToMedicalConditions = () => {
    router.push("/medical-conditions");
  };

  const goToScanner = () => {
    router.push("/prescriptions/new");
  };

  const goToAdherence = () => {
    router.push("/(tabs)/adherence");
  };

  const clearAllLocalData = () => {
    Alert.alert(
      "Clear MEDCO Data",
      "This will remove the saved medication schedule, reminders, and adherence history from this device.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(MEDCO_SCHEDULE_STORAGE_KEY);
            await AsyncStorage.removeItem(MEDCO_REMINDERS_STORAGE_KEY);
            await AsyncStorage.removeItem(MEDCO_ADHERENCE_HISTORY_KEY);

            setDoses(defaultDoses);
            setReminders([]);
            setHasSavedSchedule(false);
            setScheduleCreatedAt(null);
          },
        },
      ],
    );
  };

  const signOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => router.replace("/login"),
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Profile</Text>

      <Text style={styles.subtitle}>
        Manage your personal information, medications, reminders, and MEDCO app
        settings.
      </Text>

      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>UT</Text>
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.name}>Uthman Tijjani</Text>
          <Text style={styles.email}>uthman@example.com</Text>
          <Text style={styles.scheduleStatus}>
            {formatCreatedDate(scheduleCreatedAt)}
          </Text>
        </View>

        <Pressable style={styles.editButton} onPress={goToPersonalDetails}>
          <Ionicons name="create-outline" size={20} color="#2563eb" />
        </Pressable>
      </View>

      {!hasSavedSchedule && (
        <View style={styles.noticeCard}>
          <Ionicons name="information-circle" size={22} color="#2563eb" />
          <Text style={styles.noticeText}>
            Demo profile counts are showing. Scan and save a prescription
            schedule to display real medication and adherence data here.
          </Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <Pressable style={styles.statCard} onPress={goToCurrentMedications}>
          <View style={[styles.statIconCircle, styles.greenCircle]}>
            <Ionicons name="medical" size={24} color="#16a34a" />
          </View>
          <Text style={styles.statNumber}>{profileStats.medications}</Text>
          <Text style={styles.statLabel}>Medications</Text>
        </Pressable>

        <Pressable style={styles.statCard} onPress={goToDoseReminders}>
          <View style={[styles.statIconCircle, styles.purpleCircle]}>
            <Ionicons name="alarm" size={24} color="#7c3aed" />
          </View>
          <Text style={styles.statNumber}>
            {profileStats.enabledReminders || profileStats.totalDoses}
          </Text>
          <Text style={styles.statLabel}>Reminders</Text>
        </Pressable>

        <Pressable style={styles.statCard} onPress={goToAdherence}>
          <View style={[styles.statIconCircle, styles.blueCircle]}>
            <Ionicons name="bar-chart" size={24} color="#2563eb" />
          </View>
          <Text style={styles.statNumber}>
            {profileStats.adherencePercentage === 0
              ? "--"
              : `${profileStats.adherencePercentage}%`}
          </Text>
          <Text style={styles.statLabel}>Adherence</Text>
        </Pressable>
      </View>

      <View style={styles.healthSummaryCard}>
        <View style={styles.healthHeader}>
          <View>
            <Text style={styles.healthTitle}>Today&apos;s Health Summary</Text>
            <Text style={styles.healthSubtitle}>
              Medication progress based on saved schedule
            </Text>
          </View>

          <View style={styles.healthIconCircle}>
            <Ionicons name="heart" size={26} color="#ef4444" />
          </View>
        </View>

        <View style={styles.healthStatsRow}>
          <View style={styles.healthStatBox}>
            <Text style={[styles.healthStatNumber, styles.takenText]}>
              {profileStats.taken}
            </Text>
            <Text style={styles.healthStatLabel}>Taken</Text>
          </View>

          <View style={styles.healthStatBox}>
            <Text style={[styles.healthStatNumber, styles.pendingText]}>
              {profileStats.pending}
            </Text>
            <Text style={styles.healthStatLabel}>Pending</Text>
          </View>

          <View style={styles.healthStatBox}>
            <Text style={[styles.healthStatNumber, styles.missedText]}>
              {profileStats.missed}
            </Text>
            <Text style={styles.healthStatLabel}>Missed</Text>
          </View>

          <View style={styles.healthStatBox}>
            <Text style={[styles.healthStatNumber, styles.snoozedText]}>
              {profileStats.snoozed}
            </Text>
            <Text style={styles.healthStatLabel}>Snoozed</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Medical Profile</Text>

      <View style={styles.menuCard}>
        <ProfileMenuItem
          icon="person"
          iconColor="#2563eb"
          iconBackground="#dbeafe"
          title="Personal Details"
          subtitle="Name, age, gender, and basic information"
          onPress={goToPersonalDetails}
        />

        <ProfileMenuItem
          icon="medical"
          iconColor="#16a34a"
          iconBackground="#dcfce7"
          title="Current Medications"
          subtitle="View medicines saved from scanned prescriptions"
          onPress={goToCurrentMedications}
        />

        <ProfileMenuItem
          icon="alarm"
          iconColor="#7c3aed"
          iconBackground="#ede9fe"
          title="Dose Reminders"
          subtitle="Manage medication reminder settings"
          onPress={goToDoseReminders}
        />

        <ProfileMenuItem
          icon="warning"
          iconColor="#f59e0b"
          iconBackground="#fef3c7"
          title="Medical Conditions"
          subtitle="Allergies, conditions, and drug safety notes"
          onPress={goToMedicalConditions}
          isLast
        />
      </View>

      <Text style={styles.sectionTitle}>Scanner & Adherence</Text>

      <View style={styles.menuCard}>
        <ProfileMenuItem
          icon="scan"
          iconColor="#2563eb"
          iconBackground="#dbeafe"
          title="Scan New Prescription"
          subtitle="Upload a prescription and create a medication schedule"
          onPress={goToScanner}
        />

        <ProfileMenuItem
          icon="bar-chart"
          iconColor="#16a34a"
          iconBackground="#dcfce7"
          title="Adherence Tracking"
          subtitle="Track Taken, Missed, Snoozed, and Pending doses"
          onPress={goToAdherence}
          isLast
        />
      </View>

      <Text style={styles.sectionTitle}>Settings</Text>

      <View style={styles.menuCard}>
        <ProfileMenuItem
          icon="notifications"
          iconColor="#2563eb"
          iconBackground="#dbeafe"
          title="Notifications"
          subtitle="Manage app notification preferences"
          onPress={goToDoseReminders}
        />

        <ProfileMenuItem
          icon="shield-checkmark"
          iconColor="#16a34a"
          iconBackground="#dcfce7"
          title="Privacy & Security"
          subtitle="Local data and app privacy settings"
          onPress={() =>
            Alert.alert(
              "Privacy & Security",
              "This prototype stores medication data locally on this device using AsyncStorage.",
            )
          }
        />

        <ProfileMenuItem
          icon="trash"
          iconColor="#ef4444"
          iconBackground="#fee2e2"
          title="Clear Local MEDCO Data"
          subtitle="Remove saved schedule, reminders, and history"
          onPress={clearAllLocalData}
          isLast
        />
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

type ProfileMenuItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
};

function ProfileMenuItem({
  icon,
  iconColor,
  iconBackground,
  title,
  subtitle,
  onPress,
  isLast = false,
}: ProfileMenuItemProps) {
  return (
    <Pressable
      style={[styles.menuItem, isLast && styles.menuItemLast]}
      onPress={onPress}
    >
      <View
        style={[
          styles.menuIconCircle,
          {
            backgroundColor: iconBackground,
          },
        ]}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>

      <View style={styles.menuTextBox}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={22} color="#cbd5e1" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 34,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 23,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 18,
  },
  profileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#ffffff",
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  email: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 4,
  },
  scheduleStatus: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#94a3b8",
  },
  editButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  noticeCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    color: "#1e40af",
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    minHeight: 118,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  greenCircle: {
    backgroundColor: "#dcfce7",
  },
  purpleCircle: {
    backgroundColor: "#ede9fe",
  },
  blueCircle: {
    backgroundColor: "#dbeafe",
  },
  statNumber: {
    fontSize: 23,
    fontWeight: "900",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#64748b",
    textAlign: "center",
    marginTop: 2,
  },
  healthSummaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    marginBottom: 22,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  healthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  healthTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  healthSubtitle: {
    fontSize: 13.5,
    color: "#94a3b8",
    fontWeight: "700",
  },
  healthIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  healthStatsRow: {
    flexDirection: "row",
    gap: 9,
  },
  healthStatBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  healthStatNumber: {
    fontSize: 22,
    fontWeight: "900",
  },
  healthStatLabel: {
    fontSize: 11.5,
    color: "#64748b",
    fontWeight: "800",
    marginTop: 3,
    textAlign: "center",
  },
  takenText: {
    color: "#16a34a",
  },
  pendingText: {
    color: "#2563eb",
  },
  missedText: {
    color: "#ef4444",
  },
  snoozedText: {
    color: "#f59e0b",
  },
  sectionTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 12,
    marginTop: 4,
  },
  menuCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingVertical: 4,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuTextBox: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  menuSubtitle: {
    fontSize: 13.2,
    lineHeight: 18,
    color: "#64748b",
    fontWeight: "600",
  },
  signOutButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ef4444",
  },
  bottomSpace: {
    height: 34,
  },
});
