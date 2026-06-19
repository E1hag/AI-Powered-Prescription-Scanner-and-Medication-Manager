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

type AdherenceAction = {
  id: string;
  doseId: string;
  medicationName: string;
  time: string;
  action: DoseStatus;
  createdAt: string;
};

const MEDCO_SCHEDULE_STORAGE_KEY = "MEDCO_MEDICATION_SCHEDULE";
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

export default function AdherenceScreen() {
  const [doses, setDoses] = useState<ScheduleDose[]>(defaultDoses);
  const [history, setHistory] = useState<AdherenceAction[]>([]);
  const [scheduleCreatedAt, setScheduleCreatedAt] = useState<string | null>(
    null,
  );

  const loadScheduleAndHistory = async () => {
    try {
      const savedScheduleRaw = await AsyncStorage.getItem(
        MEDCO_SCHEDULE_STORAGE_KEY,
      );

      if (savedScheduleRaw) {
        const savedSchedule = JSON.parse(
          savedScheduleRaw,
        ) as StoredMedicationSchedule;

        if (Array.isArray(savedSchedule.doses)) {
          setDoses(savedSchedule.doses);
          setScheduleCreatedAt(savedSchedule.createdAt);
        }
      } else {
        setDoses(defaultDoses);
        setScheduleCreatedAt(null);
      }

      const savedHistoryRaw = await AsyncStorage.getItem(
        MEDCO_ADHERENCE_HISTORY_KEY,
      );

      if (savedHistoryRaw) {
        const savedHistory = JSON.parse(savedHistoryRaw) as AdherenceAction[];

        if (Array.isArray(savedHistory)) {
          setHistory(savedHistory);
        }
      } else {
        setHistory([]);
      }
    } catch {
      setDoses(defaultDoses);
      setHistory([]);
      setScheduleCreatedAt(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadScheduleAndHistory();
    }, []),
  );

  const stats = useMemo(() => {
    const taken = doses.filter((dose) => dose.status === "Taken").length;
    const missed = doses.filter((dose) => dose.status === "Missed").length;
    const snoozed = doses.filter((dose) => dose.status === "Snoozed").length;
    const pending = doses.filter((dose) => dose.status === "Pending").length;

    const completed = taken + missed;
    const adherencePercentage =
      completed === 0 ? 0 : Math.round((taken / completed) * 100);

    return {
      taken,
      missed,
      snoozed,
      pending,
      total: doses.length,
      adherencePercentage,
    };
  }, [doses]);

  const updateDoseStatus = async (doseId: string, newStatus: DoseStatus) => {
    try {
      const selectedDose = doses.find((dose) => dose.id === doseId);

      if (!selectedDose) {
        Alert.alert("Dose Not Found", "Unable to update this medication dose.");
        return;
      }

      const updatedDoses = doses.map((dose) => {
        if (dose.id === doseId) {
          return {
            ...dose,
            status: newStatus,
          };
        }

        return dose;
      });

      setDoses(updatedDoses);

      const updatedSchedule: StoredMedicationSchedule = {
        id: scheduleCreatedAt
          ? `schedule-${scheduleCreatedAt}`
          : `schedule-${Date.now()}`,
        createdAt: scheduleCreatedAt ?? new Date().toISOString(),
        doses: updatedDoses,
      };

      await AsyncStorage.setItem(
        MEDCO_SCHEDULE_STORAGE_KEY,
        JSON.stringify(updatedSchedule),
      );

      const newHistoryItem: AdherenceAction = {
        id: `history-${Date.now()}`,
        doseId: selectedDose.id,
        medicationName: selectedDose.medicationName,
        time: selectedDose.time,
        action: newStatus,
        createdAt: new Date().toISOString(),
      };

      const updatedHistory = [newHistoryItem, ...history];
      setHistory(updatedHistory);

      await AsyncStorage.setItem(
        MEDCO_ADHERENCE_HISTORY_KEY,
        JSON.stringify(updatedHistory),
      );
    } catch {
      Alert.alert(
        "Update Failed",
        "Unable to update adherence status. Please try again.",
      );
    }
  };

  const clearSchedule = () => {
    Alert.alert(
      "Clear Schedule",
      "This will remove the saved prescription schedule and adherence history from this device.",
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
            await AsyncStorage.removeItem(MEDCO_ADHERENCE_HISTORY_KEY);
            setDoses(defaultDoses);
            setHistory([]);
            setScheduleCreatedAt(null);
          },
        },
      ],
    );
  };

  const goToScanner = () => {
    router.push("/prescriptions/new");
  };

  const formatDateTime = (isoDate: string) => {
    try {
      const date = new Date(isoDate);

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  };

  const getStatusColor = (status: DoseStatus) => {
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
      badge: styles.pendingBadge,
      text: styles.pendingBadgeText,
      icon: "ellipse-outline" as const,
      iconColor: "#64748b",
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
          <Text style={styles.title}>Adherence</Text>
          <Text style={styles.subtitle}>
            Track doses, view progress, and monitor your medication history.
          </Text>
        </View>

        <Pressable style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.takenStatCard]}>
          <Ionicons name="checkmark-circle" size={28} color="#16a34a" />
          <Text style={[styles.statNumber, styles.takenText]}>
            {stats.taken}
          </Text>
          <Text style={[styles.statLabel, styles.takenText]}>Taken</Text>
        </View>

        <View style={[styles.statCard, styles.missedStatCard]}>
          <Ionicons name="close-circle" size={28} color="#dc2626" />
          <Text style={[styles.statNumber, styles.missedText]}>
            {stats.missed}
          </Text>
          <Text style={[styles.statLabel, styles.missedText]}>Missed</Text>
        </View>

        <View style={[styles.statCard, styles.snoozedStatCard]}>
          <Ionicons name="time" size={28} color="#f59e0b" />
          <Text style={[styles.statNumber, styles.snoozedText]}>
            {stats.snoozed}
          </Text>
          <Text style={[styles.statLabel, styles.snoozedText]}>Snoozed</Text>
        </View>

        <View style={[styles.statCard, styles.pendingStatCard]}>
          <Ionicons name="alarm" size={28} color="#7c3aed" />
          <Text style={[styles.statNumber, styles.pendingText]}>
            {stats.pending}
          </Text>
          <Text style={[styles.statLabel, styles.pendingText]}>Pending</Text>
        </View>
      </View>

      <View style={styles.adherenceCard}>
        <View style={styles.adherenceTextBox}>
          <Text style={styles.adherenceTitle}>Today&apos;s Adherence</Text>
          <Text style={styles.adherenceSubtitle}>
            {stats.total === 0
              ? "No doses recorded yet."
              : stats.taken === 0 && stats.missed === 0
                ? "Your day is just starting 🌅"
                : `${stats.taken} of ${stats.taken + stats.missed} completed doses taken.`}
          </Text>
        </View>

        <View style={styles.adherenceCircle}>
          <Text style={styles.adherencePercent}>
            {stats.taken === 0 && stats.missed === 0
              ? "--"
              : `${stats.adherencePercentage}%`}
          </Text>
        </View>
      </View>

      <View style={styles.weeklyCard}>
        <View style={styles.weeklyHeader}>
          <Ionicons name="bar-chart" size={30} color="#2563eb" />
          <View>
            <Text style={styles.weeklyTitle}>Weekly Adherence</Text>
            <Text style={styles.weeklySubtitle}>Last 7 days progress</Text>
          </View>
        </View>

        <View style={styles.chartBox}>
          {["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"].map((day) => (
            <View key={day} style={styles.chartColumn}>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBarFill,
                    {
                      height:
                        stats.taken === 0 && stats.missed === 0
                          ? 4
                          : Math.max(stats.adherencePercentage, 8),
                    },
                  ]}
                />
              </View>
              <Text style={styles.chartValue}>
                {stats.taken === 0 && stats.missed === 0
                  ? "0"
                  : `${stats.adherencePercentage}`}
              </Text>
              <Text style={styles.chartDay}>{day}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.weeklyNote}>
          Days without recorded doses are shown as 0%.
        </Text>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          Today&apos;s Medication Schedule
        </Text>

        <Pressable style={styles.scanButton} onPress={goToScanner}>
          <Ionicons name="scan" size={16} color="#2563eb" />
          <Text style={styles.scanButtonText}>Scan</Text>
        </Pressable>
      </View>

      {doses.map((dose) => {
        const statusStyle = getStatusColor(dose.status);

        return (
          <View key={dose.id} style={styles.doseCard}>
            <View style={styles.doseHeader}>
              <View style={styles.doseTextBox}>
                <Text style={styles.doseName}>{dose.medicationName}</Text>
                <Text style={styles.doseMeta}>
                  {dose.dosage} • {dose.time}
                </Text>
                <Text style={styles.doseInstruction}>{dose.instruction}</Text>
              </View>

              <View style={[styles.statusBadge, statusStyle.badge]}>
                <Text style={[styles.statusBadgeText, statusStyle.text]}>
                  {dose.status}
                </Text>
                <Ionicons
                  name={statusStyle.icon}
                  size={16}
                  color={statusStyle.iconColor}
                />
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionButton, styles.takenButton]}
                onPress={() => updateDoseStatus(dose.id, "Taken")}
              >
                <Text style={styles.actionButtonText}>Taken</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.missedButton]}
                onPress={() => updateDoseStatus(dose.id, "Missed")}
              >
                <Text style={styles.actionButtonText}>Missed</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.snoozeButton]}
                onPress={() => updateDoseStatus(dose.id, "Snoozed")}
              >
                <Text style={styles.actionButtonText}>Snooze</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <View style={styles.historyHeaderRow}>
        <Text style={styles.sectionTitle}>Adherence History</Text>

        <Pressable style={styles.clearButton} onPress={clearSchedule}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyHistoryCard}>
          <Ionicons name="document-text-outline" size={34} color="#94a3b8" />
          <Text style={styles.emptyHistoryText}>
            No adherence actions recorded yet.
          </Text>
        </View>
      ) : (
        history.map((item) => {
          const statusStyle = getStatusColor(item.action);

          return (
            <View key={item.id} style={styles.historyItem}>
              <View style={[styles.historyIconBox, statusStyle.badge]}>
                <Ionicons
                  name={statusStyle.icon}
                  size={20}
                  color={statusStyle.iconColor}
                />
              </View>

              <View style={styles.historyTextBox}>
                <Text style={styles.historyTitle}>{item.medicationName}</Text>
                <Text style={styles.historySubtitle}>
                  {item.action} • {item.time}
                </Text>
              </View>

              <Text style={styles.historyDate}>
                {formatDateTime(item.createdAt)}
              </Text>
            </View>
          );
        })
      )}

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
    paddingTop: 54,
    paddingBottom: 34,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  headerTextBox: {
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748b",
  },
  signOutButton: {
    backgroundColor: "#fee2e2",
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginTop: 3,
  },
  signOutText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "900",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  takenStatCard: {
    backgroundColor: "#dcfce7",
  },
  missedStatCard: {
    backgroundColor: "#fee2e2",
  },
  snoozedStatCard: {
    backgroundColor: "#fef3c7",
  },
  pendingStatCard: {
    backgroundColor: "#ede9fe",
  },
  statNumber: {
    fontSize: 33,
    fontWeight: "900",
    marginTop: 7,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "900",
  },
  takenText: {
    color: "#16a34a",
  },
  missedText: {
    color: "#dc2626",
  },
  snoozedText: {
    color: "#f59e0b",
  },
  pendingText: {
    color: "#7c3aed",
  },
  adherenceCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  adherenceTextBox: {
    flex: 1,
    paddingRight: 12,
  },
  adherenceTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1e40af",
    marginBottom: 7,
  },
  adherenceSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
    fontWeight: "600",
  },
  adherenceCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  adherencePercent: {
    fontSize: 24,
    fontWeight: "900",
    color: "#2563eb",
  },
  weeklyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 22,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  weeklyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  weeklyTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
  },
  weeklySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 2,
  },
  chartBox: {
    height: 128,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 6,
  },
  chartColumn: {
    alignItems: "center",
    width: 36,
  },
  chartBarTrack: {
    width: 10,
    height: 72,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartBarFill: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  chartValue: {
    fontSize: 12,
    color: "#93c5fd",
    fontWeight: "900",
    marginTop: 5,
  },
  chartDay: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "800",
    marginTop: 4,
  },
  weeklyNote: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  scanButton: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  scanButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "900",
  },
  doseCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  doseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 16,
  },
  doseTextBox: {
    flex: 1,
  },
  doseName: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  doseMeta: {
    fontSize: 15,
    color: "#64748b",
    fontWeight: "700",
    marginBottom: 8,
  },
  doseInstruction: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusBadgeText: {
    fontSize: 12.5,
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
  pendingBadge: {
    backgroundColor: "#e2e8f0",
  },
  pendingBadgeText: {
    color: "#334155",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  takenButton: {
    backgroundColor: "#16a34a",
  },
  missedButton: {
    backgroundColor: "#dc2626",
  },
  snoozeButton: {
    backgroundColor: "#f59e0b",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  historyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 14,
  },
  clearButton: {
    backgroundColor: "#fef2f2",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  clearButtonText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "900",
  },
  emptyHistoryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyHistoryText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  historyItem: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  historyIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  historyTextBox: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 15.5,
    fontWeight: "900",
    color: "#0f172a",
  },
  historySubtitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
    marginTop: 2,
  },
  historyDate: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "800",
  },
  bottomSpace: {
    height: 34,
  },
});
