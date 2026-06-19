import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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

function buildReminderItemsFromDoses(
  doses: ScheduleDose[],
  previousReminders: ReminderItem[],
): ReminderItem[] {
  return doses.map((dose) => {
    const previousReminder = previousReminders.find(
      (reminder) => reminder.doseId === dose.id,
    );

    return {
      id: previousReminder?.id ?? `reminder-${dose.id}`,
      doseId: dose.id,
      medicationName: dose.medicationName,
      dosage: dose.dosage,
      time: dose.time,
      instruction: dose.instruction,
      isEnabled: previousReminder?.isEnabled ?? true,
    };
  });
}

export default function DoseRemindersScreen() {
  const [doses, setDoses] = useState<ScheduleDose[]>(defaultDoses);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [hasSavedSchedule, setHasSavedSchedule] = useState(false);
  const [scheduleCreatedAt, setScheduleCreatedAt] = useState<string | null>(
    null,
  );

  const loadDoseReminders = async () => {
    try {
      const savedScheduleRaw = await AsyncStorage.getItem(
        MEDCO_SCHEDULE_STORAGE_KEY,
      );

      const savedRemindersRaw = await AsyncStorage.getItem(
        MEDCO_REMINDERS_STORAGE_KEY,
      );

      const savedReminders: ReminderItem[] = savedRemindersRaw
        ? JSON.parse(savedRemindersRaw)
        : [];

      if (!savedScheduleRaw) {
        const defaultReminderItems = buildReminderItemsFromDoses(
          defaultDoses,
          savedReminders,
        );

        setDoses(defaultDoses);
        setReminders(defaultReminderItems);
        setHasSavedSchedule(false);
        setScheduleCreatedAt(null);

        await AsyncStorage.setItem(
          MEDCO_REMINDERS_STORAGE_KEY,
          JSON.stringify(defaultReminderItems),
        );

        return;
      }

      const savedSchedule = JSON.parse(
        savedScheduleRaw,
      ) as StoredMedicationSchedule;

      if (
        Array.isArray(savedSchedule.doses) &&
        savedSchedule.doses.length > 0
      ) {
        const reminderItems = buildReminderItemsFromDoses(
          savedSchedule.doses,
          savedReminders,
        );

        setDoses(savedSchedule.doses);
        setReminders(reminderItems);
        setHasSavedSchedule(true);
        setScheduleCreatedAt(savedSchedule.createdAt);

        await AsyncStorage.setItem(
          MEDCO_REMINDERS_STORAGE_KEY,
          JSON.stringify(reminderItems),
        );

        return;
      }

      const defaultReminderItems = buildReminderItemsFromDoses(
        defaultDoses,
        savedReminders,
      );

      setDoses(defaultDoses);
      setReminders(defaultReminderItems);
      setHasSavedSchedule(false);
      setScheduleCreatedAt(null);

      await AsyncStorage.setItem(
        MEDCO_REMINDERS_STORAGE_KEY,
        JSON.stringify(defaultReminderItems),
      );
    } catch {
      const defaultReminderItems = buildReminderItemsFromDoses(
        defaultDoses,
        [],
      );

      setDoses(defaultDoses);
      setReminders(defaultReminderItems);
      setHasSavedSchedule(false);
      setScheduleCreatedAt(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDoseReminders();
    }, []),
  );

  const stats = useMemo(() => {
    const enabled = reminders.filter((reminder) => reminder.isEnabled).length;
    const disabled = reminders.filter((reminder) => !reminder.isEnabled).length;

    return {
      total: reminders.length,
      enabled,
      disabled,
      medicines: new Set(doses.map((dose) => dose.medicationId)).size,
    };
  }, [doses, reminders]);

  const upcomingReminder = useMemo(() => {
    const enabledReminders = reminders.filter((reminder) => reminder.isEnabled);

    if (enabledReminders.length > 0) {
      return enabledReminders[0];
    }

    return reminders[0] ?? null;
  }, [reminders]);

  const formatCreatedDate = (isoDate: string | null) => {
    if (!isoDate) {
      return "Demo schedule";
    }

    try {
      const date = new Date(isoDate);

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Saved recently";
    }
  };

  const goBack = () => {
    router.back();
  };

  const goToScanner = () => {
    router.push("/prescriptions/new");
  };

  const goToAdherence = () => {
    router.push("/(tabs)/adherence");
  };

  const toggleReminder = async (reminderId: string) => {
    const updatedReminders = reminders.map((reminder) => {
      if (reminder.id === reminderId) {
        return {
          ...reminder,
          isEnabled: !reminder.isEnabled,
        };
      }

      return reminder;
    });

    setReminders(updatedReminders);

    await AsyncStorage.setItem(
      MEDCO_REMINDERS_STORAGE_KEY,
      JSON.stringify(updatedReminders),
    );
  };

  const enableAllReminders = async () => {
    const updatedReminders = reminders.map((reminder) => {
      return {
        ...reminder,
        isEnabled: true,
      };
    });

    setReminders(updatedReminders);

    await AsyncStorage.setItem(
      MEDCO_REMINDERS_STORAGE_KEY,
      JSON.stringify(updatedReminders),
    );

    Alert.alert(
      "Reminders Enabled",
      "All medication reminders are now active.",
    );
  };

  const disableAllReminders = () => {
    Alert.alert(
      "Disable All Reminders",
      "This will turn off all dose reminders on this device.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Disable",
          style: "destructive",
          onPress: async () => {
            const updatedReminders = reminders.map((reminder) => {
              return {
                ...reminder,
                isEnabled: false,
              };
            });

            setReminders(updatedReminders);

            await AsyncStorage.setItem(
              MEDCO_REMINDERS_STORAGE_KEY,
              JSON.stringify(updatedReminders),
            );
          },
        },
      ],
    );
  };

  const clearReminderSettings = () => {
    Alert.alert(
      "Reset Reminder Settings",
      "This will reset reminder switches to the default active state.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(MEDCO_REMINDERS_STORAGE_KEY);
            loadDoseReminders();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={goBack}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>

        <Pressable style={styles.scanButton} onPress={goToScanner}>
          <Ionicons name="scan" size={17} color="#2563eb" />
          <Text style={styles.scanButtonText}>Scan</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Dose Reminders</Text>

      <Text style={styles.subtitle}>
        Manage reminder alerts for your saved medication schedule.
      </Text>

      {!hasSavedSchedule && (
        <View style={styles.demoCard}>
          <Ionicons name="information-circle" size={22} color="#2563eb" />
          <Text style={styles.demoText}>
            Demo reminders are showing. Scan and save a prescription schedule to
            create reminders from real medication doses.
          </Text>
        </View>
      )}

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryTextBox}>
            <Text style={styles.summaryTitle}>Reminder Summary</Text>
            <Text style={styles.summarySubtitle}>
              {hasSavedSchedule
                ? `Saved ${formatCreatedDate(scheduleCreatedAt)}`
                : "Using demo reminder data"}
            </Text>
          </View>

          <View style={styles.summaryIconCircle}>
            <Ionicons name="alarm" size={27} color="#7c3aed" />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.enabled}</Text>
            <Text style={styles.statLabel}>Enabled</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.disabled}</Text>
            <Text style={styles.statLabel}>Off</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.medicines}</Text>
            <Text style={styles.statLabel}>Meds</Text>
          </View>
        </View>
      </View>

      {upcomingReminder && (
        <View style={styles.nextReminderCard}>
          <View style={styles.nextReminderIcon}>
            <Ionicons name="notifications" size={30} color="#7c3aed" />
          </View>

          <View style={styles.nextReminderTextBox}>
            <Text style={styles.nextReminderLabel}>Next Reminder</Text>
            <Text style={styles.nextReminderName}>
              {upcomingReminder.medicationName}
            </Text>
            <Text style={styles.nextReminderMeta}>
              {upcomingReminder.dosage} • {upcomingReminder.time}
            </Text>
            <Text style={styles.nextReminderInstruction}>
              {upcomingReminder.instruction}
            </Text>
          </View>

          <View
            style={[
              styles.nextReminderStatus,
              upcomingReminder.isEnabled
                ? styles.enabledStatus
                : styles.disabledStatus,
            ]}
          >
            <Text
              style={[
                styles.nextReminderStatusText,
                upcomingReminder.isEnabled
                  ? styles.enabledStatusText
                  : styles.disabledStatusText,
              ]}
            >
              {upcomingReminder.isEnabled ? "On" : "Off"}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.actionRow}>
        <Pressable
          style={styles.primaryActionButton}
          onPress={enableAllReminders}
        >
          <Ionicons name="notifications" size={18} color="#ffffff" />
          <Text style={styles.primaryActionButtonText}>Enable All</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryActionButton}
          onPress={disableAllReminders}
        >
          <Ionicons name="notifications-off" size={18} color="#ef4444" />
          <Text style={styles.secondaryActionButtonText}>Disable All</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Reminder List</Text>

        <Pressable style={styles.trackButton} onPress={goToAdherence}>
          <Ionicons name="bar-chart" size={16} color="#2563eb" />
          <Text style={styles.trackButtonText}>Track</Text>
        </Pressable>
      </View>

      {reminders.map((reminder) => (
        <View key={reminder.id} style={styles.reminderCard}>
          <View style={styles.reminderHeader}>
            <View
              style={[
                styles.reminderIconCircle,
                reminder.isEnabled
                  ? styles.reminderIconEnabled
                  : styles.reminderIconDisabled,
              ]}
            >
              <Ionicons
                name={reminder.isEnabled ? "alarm" : "alarm-outline"}
                size={25}
                color={reminder.isEnabled ? "#7c3aed" : "#94a3b8"}
              />
            </View>

            <View style={styles.reminderTextBox}>
              <Text style={styles.reminderName}>{reminder.medicationName}</Text>
              <Text style={styles.reminderMeta}>
                {reminder.dosage} • {reminder.time}
              </Text>
            </View>

            <Switch
              value={reminder.isEnabled}
              onValueChange={() => toggleReminder(reminder.id)}
              trackColor={{
                false: "#cbd5e1",
                true: "#c4b5fd",
              }}
              thumbColor={reminder.isEnabled ? "#7c3aed" : "#f8fafc"}
            />
          </View>

          <View style={styles.instructionBox}>
            <Ionicons name="document-text-outline" size={17} color="#64748b" />
            <Text style={styles.instructionText}>{reminder.instruction}</Text>
          </View>

          <View style={styles.reminderStatusRow}>
            <View
              style={[
                styles.reminderBadge,
                reminder.isEnabled ? styles.enabledBadge : styles.disabledBadge,
              ]}
            >
              <Ionicons
                name={
                  reminder.isEnabled
                    ? "checkmark-circle"
                    : "close-circle-outline"
                }
                size={15}
                color={reminder.isEnabled ? "#16a34a" : "#64748b"}
              />
              <Text
                style={[
                  styles.reminderBadgeText,
                  reminder.isEnabled
                    ? styles.enabledBadgeText
                    : styles.disabledBadgeText,
                ]}
              >
                {reminder.isEnabled ? "Reminder Active" : "Reminder Off"}
              </Text>
            </View>
          </View>
        </View>
      ))}

      <Pressable style={styles.scanNewButton} onPress={goToScanner}>
        <Ionicons name="scan" size={20} color="#ffffff" />
        <Text style={styles.scanNewButtonText}>Scan New Prescription</Text>
      </Pressable>

      <Pressable style={styles.resetButton} onPress={clearReminderSettings}>
        <Text style={styles.resetButtonText}>Reset Reminder Settings</Text>
      </Pressable>

      <View style={styles.noteCard}>
        <Ionicons name="information-circle" size={20} color="#2563eb" />
        <Text style={styles.noteText}>
          This prototype stores reminder settings locally on this device. Later,
          you can connect this page to real push notifications.
        </Text>
      </View>

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
    paddingTop: 52,
    paddingBottom: 30,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#2563eb",
  },
  title: {
    fontSize: 33,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 23,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 16,
  },
  demoCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  demoText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    color: "#1e40af",
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  summaryTextBox: {
    flex: 1,
    paddingRight: 12,
  },
  summaryTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 13.5,
    color: "#94a3b8",
    fontWeight: "700",
  },
  summaryIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 9,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2563eb",
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#64748b",
    marginTop: 3,
    textAlign: "center",
  },
  nextReminderCard: {
    backgroundColor: "#ede9fe",
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  nextReminderIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#ddd6fe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  nextReminderTextBox: {
    flex: 1,
  },
  nextReminderLabel: {
    fontSize: 13,
    color: "#7c3aed",
    fontWeight: "900",
    marginBottom: 3,
  },
  nextReminderName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  nextReminderMeta: {
    fontSize: 13.5,
    color: "#64748b",
    fontWeight: "700",
    marginTop: 3,
  },
  nextReminderInstruction: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
    marginTop: 5,
  },
  nextReminderStatus: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  enabledStatus: {
    backgroundColor: "#dcfce7",
  },
  disabledStatus: {
    backgroundColor: "#e2e8f0",
  },
  nextReminderStatusText: {
    fontSize: 12,
    fontWeight: "900",
  },
  enabledStatusText: {
    color: "#16a34a",
  },
  disabledStatusText: {
    color: "#64748b",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  primaryActionButton: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primaryActionButtonText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "900",
  },
  secondaryActionButton: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  secondaryActionButtonText: {
    color: "#ef4444",
    fontSize: 14.5,
    fontWeight: "900",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  trackButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 5,
  },
  trackButtonText: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#2563eb",
  },
  reminderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 13,
  },
  reminderIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderIconEnabled: {
    backgroundColor: "#ede9fe",
  },
  reminderIconDisabled: {
    backgroundColor: "#f1f5f9",
  },
  reminderTextBox: {
    flex: 1,
  },
  reminderName: {
    fontSize: 19,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  reminderMeta: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  instructionBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 15,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#475569",
    fontWeight: "600",
  },
  reminderStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  reminderBadge: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  enabledBadge: {
    backgroundColor: "#dcfce7",
  },
  disabledBadge: {
    backgroundColor: "#e2e8f0",
  },
  reminderBadgeText: {
    fontSize: 12.5,
    fontWeight: "900",
  },
  enabledBadgeText: {
    color: "#15803d",
  },
  disabledBadgeText: {
    color: "#64748b",
  },
  scanNewButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 4,
  },
  scanNewButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
  },
  resetButton: {
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  resetButtonText: {
    fontSize: 14.5,
    fontWeight: "900",
    color: "#ef4444",
  },
  noteCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    color: "#1e40af",
    fontWeight: "700",
  },
  bottomSpace: {
    height: 34,
  },
});
