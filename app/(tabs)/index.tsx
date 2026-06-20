import { useAuthSession } from "@/src/features/auth/hooks/use-auth-session";
import { getAccountDisplay } from "@/src/features/auth/utils/account-display";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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

const MEDCO_SCHEDULE_STORAGE_KEY = "MEDCO_MEDICATION_SCHEDULE";

const defaultDoses: ScheduleDose[] = [
  {
    id: "default-dose-1",
    medicationId: "default-med-1",
    medicationName: "Amoxicillin",
    dosage: "500mg",
    time: "08:00 AM",
    instruction: "Take after food",
    status: "Taken",
  },
  {
    id: "default-dose-2",
    medicationId: "default-med-2",
    medicationName: "Paracetamol",
    dosage: "1000mg",
    time: "02:00 PM",
    instruction: "Take only if needed for pain or fever",
    status: "Taken",
  },
  {
    id: "default-dose-3",
    medicationId: "default-med-3",
    medicationName: "Vitamin D",
    dosage: "1000 IU",
    time: "08:00 PM",
    instruction: "Take with water",
    status: "Missed",
  },
];

export default function HomeScreen() {
  const { user } = useAuthSession();
  const [doses, setDoses] = useState<ScheduleDose[]>(defaultDoses);
  const [hasSavedSchedule, setHasSavedSchedule] = useState(false);
  const accountDisplay = useMemo(() => getAccountDisplay(user), [user]);

  const loadSavedSchedule = async () => {
    try {
      const savedScheduleRaw = await AsyncStorage.getItem(
        MEDCO_SCHEDULE_STORAGE_KEY,
      );

      if (!savedScheduleRaw) {
        setDoses(defaultDoses);
        setHasSavedSchedule(false);
        return;
      }

      const savedSchedule = JSON.parse(
        savedScheduleRaw,
      ) as StoredMedicationSchedule;

      if (
        Array.isArray(savedSchedule.doses) &&
        savedSchedule.doses.length > 0
      ) {
        setDoses(savedSchedule.doses);
        setHasSavedSchedule(true);
      } else {
        setDoses(defaultDoses);
        setHasSavedSchedule(false);
      }
    } catch {
      setDoses(defaultDoses);
      setHasSavedSchedule(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSavedSchedule();
    }, []),
  );

  const stats = useMemo(() => {
    const taken = doses.filter((dose) => dose.status === "Taken").length;
    const missed = doses.filter((dose) => dose.status === "Missed").length;
    const pending = doses.filter((dose) => dose.status === "Pending").length;
    const snoozed = doses.filter((dose) => dose.status === "Snoozed").length;

    return {
      taken,
      missed,
      pending,
      snoozed,
      reminders: doses.length,
    };
  }, [doses]);

  const nextDose = useMemo(() => {
    const pendingDose = doses.find((dose) => dose.status === "Pending");

    if (pendingDose) {
      return pendingDose;
    }

    return doses[0] ?? null;
  }, [doses]);

  const goToScanner = () => {
    router.push("/prescriptions/new");
  };

  const goToCurrentMedications = () => {
    router.push("/current-medications");
  };

  const goToDoseReminders = () => {
    router.push("/dose-reminders");
  };

  const goToDrugSafety = () => {
    router.push("/medical-conditions");
  };

  const goToAdherence = () => {
    router.push("/(tabs)/adherence");
  };

  const goToProfile = () => {
    router.push({
      pathname: "/(tabs)/profile",
      params: {
        scrollTo: "actions",
      },
    });
  };

  const getStatusStyle = (status: DoseStatus) => {
    if (status === "Taken") {
      return {
        badge: styles.takenBadge,
        text: styles.takenBadgeText,
        icon: "checkmark-circle" as const,
        iconColor: "#16a34a",
      };
    }

    if (status === "Missed") {
      return {
        badge: styles.missedBadge,
        text: styles.missedBadgeText,
        icon: "close-circle" as const,
        iconColor: "#dc2626",
      };
    }

    if (status === "Snoozed") {
      return {
        badge: styles.snoozedBadge,
        text: styles.snoozedBadgeText,
        icon: "time" as const,
        iconColor: "#f59e0b",
      };
    }

    return {
      badge: styles.upcomingBadge,
      text: styles.upcomingBadgeText,
      icon: "time-outline" as const,
      iconColor: "#2563eb",
    };
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextBox}>
          <Text style={styles.greeting}>Hello, {accountDisplay.fullName} 👋</Text>
          <Text style={styles.subtitle}>
            Stay on track with your medications today.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open dose reminders"
          style={styles.bellButton}
          onPress={goToDoseReminders}
        >
          <Ionicons name="notifications-outline" size={26} color="#0f172a" />
        </Pressable>
      </View>

      {nextDose ? (
        <View style={styles.nextDoseCard}>
          <View style={styles.nextDoseLeft}>
            <Text style={styles.nextDoseLabel}>Next Dose</Text>
            <Text style={styles.nextDoseName}>{nextDose.medicationName}</Text>

            <View style={styles.nextDoseMetaRow}>
              <Ionicons name="link-outline" size={17} color="#64748b" />
              <Text style={styles.nextDoseMeta}>{nextDose.dosage}</Text>

              <Ionicons name="restaurant-outline" size={17} color="#64748b" />
              <Text style={styles.nextDoseMeta}>{nextDose.instruction}</Text>
            </View>

            <View style={styles.nextDoseTimeRow}>
              <Ionicons name="time-outline" size={20} color="#2563eb" />
              <Text style={styles.nextDoseTime}>{nextDose.time}</Text>
            </View>
          </View>

          <View style={styles.nextDoseCircle}>
            <Text style={styles.nextDoseCircleText}>
              {nextDose.status === "Pending" ? "Next" : "Done"}
            </Text>
            <Ionicons
              name={
                nextDose.status === "Pending"
                  ? "alarm-outline"
                  : "checkmark-circle"
              }
              size={38}
              color={nextDose.status === "Pending" ? "#2563eb" : "#16a34a"}
            />
          </View>
        </View>
      ) : (
        <View style={styles.allGoodCard}>
          <Ionicons name="checkmark-circle" size={38} color="#16a34a" />
          <Text style={styles.allGoodText}>All doses completed for today!</Text>
        </View>
      )}

      {!hasSavedSchedule && (
        <View style={styles.demoNoticeCard}>
          <Ionicons name="information-circle" size={20} color="#2563eb" />
          <Text style={styles.demoNoticeText}>
            Demo data is showing. Scan and save a prescription schedule to show
            your own medication doses here.
          </Text>
        </View>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all app actions"
          onPress={goToProfile}
        >
          <Text style={styles.viewLink}>View All</Text>
        </Pressable>
      </View>

      <View style={styles.quickActionsRow}>
        <Pressable style={styles.quickActionCard} onPress={goToScanner}>
          <View style={[styles.quickIconBox, styles.blueIconBox]}>
            <Ionicons name="document-text" size={30} color="#2563eb" />
          </View>
          <Text style={styles.quickActionText}>Scan Prescription</Text>
        </Pressable>

        <Pressable
          style={styles.quickActionCard}
          onPress={goToCurrentMedications}
        >
          <View style={[styles.quickIconBox, styles.greenIconBox]}>
            <Ionicons name="medical" size={31} color="#16a34a" />
          </View>
          <Text style={styles.quickActionText}>My Meds</Text>
        </Pressable>

        <Pressable style={styles.quickActionCard} onPress={goToDoseReminders}>
          <View style={[styles.quickIconBox, styles.purpleIconBox]}>
            <Ionicons name="alarm" size={30} color="#7c3aed" />
          </View>
          <Text style={styles.quickActionText}>Dose Reminder</Text>
        </Pressable>

        <Pressable style={styles.quickActionCard} onPress={goToDrugSafety}>
          <View style={[styles.quickIconBox, styles.yellowIconBox]}>
            <Ionicons name="warning" size={30} color="#f59e0b" />
          </View>
          <Text style={styles.quickActionText}>Drug Safety</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Today&apos;s Overview</Text>
        <Pressable onPress={goToAdherence}>
          <Text style={styles.viewLink}>View Calendar ›</Text>
        </Pressable>
      </View>

      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, styles.takenOverviewCard]}>
          <Ionicons name="checkmark-circle" size={29} color="#16a34a" />
          <Text style={[styles.overviewNumber, styles.takenText]}>
            {stats.taken}
          </Text>
          <Text style={[styles.overviewLabel, styles.takenText]}>Taken</Text>
        </View>

        <View style={[styles.overviewCard, styles.missedOverviewCard]}>
          <Ionicons name="close-circle" size={29} color="#dc2626" />
          <Text style={[styles.overviewNumber, styles.missedText]}>
            {stats.missed}
          </Text>
          <Text style={[styles.overviewLabel, styles.missedText]}>Missed</Text>
        </View>

        <View style={[styles.overviewCard, styles.pendingOverviewCard]}>
          <Ionicons name="time" size={29} color="#f59e0b" />
          <Text style={[styles.overviewNumber, styles.pendingText]}>
            {stats.pending}
          </Text>
          <Text style={[styles.overviewLabel, styles.pendingText]}>
            Pending
          </Text>
        </View>

        <View style={[styles.overviewCard, styles.reminderOverviewCard]}>
          <Ionicons name="notifications" size={29} color="#7c3aed" />
          <Text style={[styles.overviewNumber, styles.reminderText]}>
            {stats.reminders}
          </Text>
          <Text style={[styles.overviewLabel, styles.reminderText]}>
            Reminders
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Today&apos;s Schedule</Text>
        <Pressable onPress={goToAdherence}>
          <Text style={styles.viewLink}>View Full</Text>
        </Pressable>
      </View>

      <View style={styles.scheduleCard}>
        {doses.slice(0, 3).map((dose) => {
          const statusStyle = getStatusStyle(dose.status);

          return (
            <View key={dose.id} style={styles.scheduleRow}>
              <View style={styles.timeBox}>
                <Text
                  style={[
                    styles.scheduleTime,
                    dose.status === "Missed" && styles.missedScheduleTime,
                  ]}
                >
                  {dose.time}
                </Text>
              </View>

              <View style={styles.timelineBox}>
                <View
                  style={[
                    styles.timelineDot,
                    dose.status === "Missed" && styles.timelineDotMissed,
                  ]}
                />
                <View style={styles.timelineLine} />
              </View>

              <View style={styles.scheduleTextBox}>
                <Text style={styles.scheduleName}>{dose.medicationName}</Text>
                <Text style={styles.scheduleMeta}>
                  {dose.dosage} • {dose.instruction}
                </Text>
              </View>

              <View style={[styles.statusBadge, statusStyle.badge]}>
                <Text style={[styles.statusBadgeText, statusStyle.text]}>
                  {dose.status === "Pending" ? "Upcoming" : dose.status}
                </Text>
                <Ionicons
                  name={statusStyle.icon}
                  size={15}
                  color={statusStyle.iconColor}
                />
              </View>
            </View>
          );
        })}

        <Pressable style={styles.addMedicationButton} onPress={goToScanner}>
          <Ionicons name="add" size={24} color="#16a34a" />
          <Text style={styles.addMedicationText}>Add Medication</Text>
        </Pressable>
      </View>

      <Pressable style={styles.safetyCard} onPress={goToDrugSafety}>
        <View style={styles.safetyIconCircle}>
          <Ionicons name="shield-checkmark" size={34} color="#16a34a" />
        </View>

        <View style={styles.safetyTextBox}>
          <Text style={styles.safetyTitle}>All Good!</Text>
          <Text style={styles.safetySubtitle}>
            No potential drug interactions found in your current medications.
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
      </Pressable>

      <View style={styles.bottomSpace} />
    </ScrollView>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 26,
  },
  headerTextBox: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 7,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    color: "#94a3b8",
    fontWeight: "600",
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    flexShrink: 0,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  nextDoseCard: {
    backgroundColor: "#eef2ff",
    borderRadius: 24,
    padding: 19,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  nextDoseLeft: {
    flex: 1,
    paddingRight: 10,
  },
  nextDoseLabel: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2563eb",
    marginBottom: 9,
  },
  nextDoseName: {
    fontSize: 25,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 10,
  },
  nextDoseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 11,
  },
  nextDoseMeta: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "700",
    marginRight: 6,
  },
  nextDoseTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nextDoseTime: {
    fontSize: 18,
    color: "#2563eb",
    fontWeight: "900",
  },
  nextDoseCircle: {
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 9,
    borderColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
  },
  nextDoseCircleText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 3,
  },
  allGoodCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  allGoodText: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    color: "#166534",
  },
  demoNoticeCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginBottom: 20,
  },
  demoNoticeText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#1e40af",
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 13,
    marginTop: 4,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  viewLink: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2563eb",
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 25,
  },
  quickActionCard: {
    flex: 1,
    minHeight: 127,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  quickIconBox: {
    width: 57,
    height: 57,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 11,
  },
  blueIconBox: {
    backgroundColor: "#dbeafe",
  },
  greenIconBox: {
    backgroundColor: "#dcfce7",
  },
  purpleIconBox: {
    backgroundColor: "#ede9fe",
  },
  yellowIconBox: {
    backgroundColor: "#fef3c7",
  },
  quickActionText: {
    fontSize: 13,
    lineHeight: 17,
    color: "#0f172a",
    fontWeight: "900",
    textAlign: "center",
  },
  overviewRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 25,
  },
  overviewCard: {
    flex: 1,
    minHeight: 101,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  takenOverviewCard: {
    backgroundColor: "#dcfce7",
  },
  missedOverviewCard: {
    backgroundColor: "#fee2e2",
  },
  pendingOverviewCard: {
    backgroundColor: "#fef3c7",
  },
  reminderOverviewCard: {
    backgroundColor: "#ede9fe",
  },
  overviewNumber: {
    fontSize: 30,
    fontWeight: "900",
    marginTop: 6,
  },
  overviewLabel: {
    fontSize: 12.5,
    fontWeight: "900",
  },
  takenText: {
    color: "#16a34a",
  },
  missedText: {
    color: "#dc2626",
  },
  pendingText: {
    color: "#f59e0b",
  },
  reminderText: {
    color: "#7c3aed",
  },
  scheduleCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 15,
    marginBottom: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 17,
  },
  timeBox: {
    width: 83,
    paddingTop: 4,
  },
  scheduleTime: {
    fontSize: 15,
    color: "#16a34a",
    fontWeight: "900",
  },
  missedScheduleTime: {
    color: "#dc2626",
  },
  timelineBox: {
    width: 22,
    alignItems: "center",
    paddingTop: 6,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#16a34a",
  },
  timelineDotMissed: {
    backgroundColor: "#dc2626",
  },
  timelineLine: {
    width: 2,
    height: 45,
    backgroundColor: "#e2e8f0",
    marginTop: 4,
  },
  scheduleTextBox: {
    flex: 1,
    paddingRight: 7,
  },
  scheduleName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  scheduleMeta: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "#94a3b8",
    fontWeight: "700",
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  takenBadge: {
    backgroundColor: "#dcfce7",
  },
  takenBadgeText: {
    color: "#15803d",
  },
  missedBadge: {
    backgroundColor: "#fee2e2",
  },
  missedBadgeText: {
    color: "#dc2626",
  },
  snoozedBadge: {
    backgroundColor: "#fef3c7",
  },
  snoozedBadgeText: {
    color: "#b45309",
  },
  upcomingBadge: {
    backgroundColor: "#dbeafe",
  },
  upcomingBadgeText: {
    color: "#2563eb",
  },
  addMedicationButton: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 15,
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addMedicationText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#16a34a",
  },
  safetyCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  safetyIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  safetyTextBox: {
    flex: 1,
  },
  safetyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  safetySubtitle: {
    fontSize: 14,
    lineHeight: 19,
    color: "#64748b",
    fontWeight: "700",
  },
  bottomSpace: {
    height: 28,
  },
});
