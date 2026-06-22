import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AdherenceHistoryItem,
  DoseStatus,
  MedicationDose,
  MedicationSchedule,
  getAdherenceHistoryFromSupabase,
  getLatestMedicationScheduleFromSupabase,
  saveAdherenceHistoryToSupabase,
  updateMedicationScheduleDosesInSupabase,
} from "@/src/services/medcoSupabaseService";

const MEDCO_SCHEDULE_STORAGE_KEY = "MEDCO_MEDICATION_SCHEDULE";
const MEDCO_ADHERENCE_HISTORY_KEY = "MEDCO_ADHERENCE_HISTORY";

type StoredMedicationSchedule = {
  id: string;
  createdAt: string;
  doses: MedicationDose[];
};

const emptySchedule: MedicationSchedule = {
  id: "",
  createdAt: new Date().toISOString(),
  doses: [],
};

function getDoseIndicator(dose: MedicationDose) {
  if (dose.isPrn) {
    return "As needed";
  }

  if (
    typeof dose.doseIndex === "number" &&
    typeof dose.totalDailyDoses === "number" &&
    dose.totalDailyDoses > 1
  ) {
    return `Dose ${dose.doseIndex} of ${dose.totalDailyDoses}`;
  }

  return null;
}

export default function AdherenceScreen() {
  const [schedule, setSchedule] = useState<MedicationSchedule>(emptySchedule);
  const [history, setHistory] = useState<AdherenceHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingDoseId, setIsUpdatingDoseId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const cacheScheduleLocally = async (latestSchedule: MedicationSchedule) => {
    const localSchedule: StoredMedicationSchedule = {
      id: latestSchedule.id,
      createdAt: latestSchedule.createdAt,
      doses: latestSchedule.doses,
    };

    await AsyncStorage.setItem(
      MEDCO_SCHEDULE_STORAGE_KEY,
      JSON.stringify(localSchedule),
    );
  };

  const cacheHistoryLocally = async (latestHistory: AdherenceHistoryItem[]) => {
    await AsyncStorage.setItem(
      MEDCO_ADHERENCE_HISTORY_KEY,
      JSON.stringify(latestHistory),
    );
  };

  const loadLocalBackup = async () => {
    const savedScheduleRaw = await AsyncStorage.getItem(
      MEDCO_SCHEDULE_STORAGE_KEY,
    );

    const savedHistoryRaw = await AsyncStorage.getItem(
      MEDCO_ADHERENCE_HISTORY_KEY,
    );

    if (savedScheduleRaw) {
      const savedSchedule = JSON.parse(
        savedScheduleRaw,
      ) as StoredMedicationSchedule;

      if (Array.isArray(savedSchedule.doses)) {
        setSchedule({
          id: savedSchedule.id,
          createdAt: savedSchedule.createdAt,
          doses: savedSchedule.doses,
        });
      }
    }

    if (savedHistoryRaw) {
      const savedHistory = JSON.parse(
        savedHistoryRaw,
      ) as AdherenceHistoryItem[];

      if (Array.isArray(savedHistory)) {
        setHistory(savedHistory);
      }
    }
  };

  const loadAdherenceData = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const latestSchedule = await getLatestMedicationScheduleFromSupabase();

      if (!latestSchedule) {
        setSchedule(emptySchedule);
        setHistory([]);
        return;
      }

      setSchedule(latestSchedule);
      await cacheScheduleLocally(latestSchedule);

      const latestHistory = await getAdherenceHistoryFromSupabase(
        latestSchedule.id,
      );

      setHistory(latestHistory);
      await cacheHistoryLocally(latestHistory);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load adherence data.";

      setLoadError(message);

      try {
        await loadLocalBackup();
      } catch {
        setSchedule(emptySchedule);
        setHistory([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAdherenceData();
    }, []),
  );

  const stats = useMemo(() => {
    const taken = schedule.doses.filter(
      (dose) => dose.status === "Taken",
    ).length;
    const missed = schedule.doses.filter(
      (dose) => dose.status === "Missed",
    ).length;
    const snoozed = schedule.doses.filter(
      (dose) => dose.status === "Snoozed",
    ).length;
    const pending = schedule.doses.filter(
      (dose) => dose.status === "Pending",
    ).length;

    const completed = taken + missed;
    const adherencePercentage =
      completed === 0 ? null : Math.round((taken / completed) * 100);

    return {
      taken,
      missed,
      snoozed,
      pending,
      total: schedule.doses.length,
      completed,
      adherencePercentage,
    };
  }, [schedule.doses]);

  const weeklyAdherence = useMemo(() => {
    const today = new Date();
    const days = [];

    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);

      const dayName = date.toLocaleDateString([], {
        weekday: "short",
      });

      const dateKey = date.toISOString().split("T")[0];

      const actionsForDay = history.filter((item) => {
        return item.createdAt.startsWith(dateKey);
      });

      const takenForDay = actionsForDay.filter(
        (item) => item.action === "Taken",
      ).length;

      const missedForDay = actionsForDay.filter(
        (item) => item.action === "Missed",
      ).length;

      const completedForDay = takenForDay + missedForDay;

      const percentage =
        completedForDay === 0
          ? 0
          : Math.round((takenForDay / completedForDay) * 100);

      days.push({
        dayName,
        percentage,
      });
    }

    return days;
  }, [history]);

  const updateDoseStatus = async (doseId: string, nextStatus: DoseStatus) => {
    if (!schedule.id) {
      Alert.alert(
        "No Schedule Found",
        "Please scan and save a prescription schedule first.",
      );
      return;
    }

    try {
      setIsUpdatingDoseId(doseId);

      const updatedDoses = schedule.doses.map((dose) => {
        if (dose.id === doseId) {
          return {
            ...dose,
            status: nextStatus,
          };
        }

        return dose;
      });

      const updatedSchedule = await updateMedicationScheduleDosesInSupabase(
        schedule.id,
        updatedDoses,
      );

      const selectedDose = updatedDoses.find((dose) => dose.id === doseId);

      if (!selectedDose) {
        throw new Error("Selected dose was not found.");
      }

      const historyItem: AdherenceHistoryItem = {
        id: `history-${doseId}-${Date.now()}`,
        doseId: selectedDose.id,
        medicationName: selectedDose.medicationName,
        time: selectedDose.time,
        action: nextStatus,
        createdAt: new Date().toISOString(),
      };

      await saveAdherenceHistoryToSupabase(schedule.id, historyItem);

      const updatedHistory = [historyItem, ...history];

      setSchedule(updatedSchedule);
      setHistory(updatedHistory);

      await cacheScheduleLocally(updatedSchedule);
      await cacheHistoryLocally(updatedHistory);
    } catch (error) {
      Alert.alert(
        "Update Failed",
        error instanceof Error
          ? error.message
          : "Unable to update the dose status.",
      );
    } finally {
      setIsUpdatingDoseId(null);
    }
  };

  const confirmDoseAction = (dose: MedicationDose, nextStatus: DoseStatus) => {
    const actionText =
      nextStatus === "Taken"
        ? "mark this dose as Taken"
        : nextStatus === "Missed"
          ? "mark this dose as Missed"
          : nextStatus === "Snoozed"
            ? "snooze this dose"
            : "set this dose as Pending";

    Alert.alert("Confirm Dose Action", `Do you want to ${actionText}?`, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Confirm",
        onPress: () => updateDoseStatus(dose.id, nextStatus),
      },
    ]);
  };

  const resetScheduleStatuses = () => {
    if (!schedule.id) {
      Alert.alert(
        "No Schedule Found",
        "Please scan and save a prescription schedule first.",
      );
      return;
    }

    Alert.alert(
      "Reset Today's Doses",
      "This will set all current doses back to Pending.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              setIsUpdatingDoseId("reset-all");

              const resetDoses = schedule.doses.map((dose) => {
                return {
                  ...dose,
                  status: "Pending" as DoseStatus,
                };
              });

              const updatedSchedule =
                await updateMedicationScheduleDosesInSupabase(
                  schedule.id,
                  resetDoses,
                );

              setSchedule(updatedSchedule);
              await cacheScheduleLocally(updatedSchedule);
            } catch (error) {
              Alert.alert(
                "Reset Failed",
                error instanceof Error
                  ? error.message
                  : "Unable to reset the schedule.",
              );
            } finally {
              setIsUpdatingDoseId(null);
            }
          },
        },
      ],
    );
  };

  const goToScanner = () => {
    router.push("/prescriptions/new");
  };

  const goToCurrentMedications = () => {
    router.push("/current-medications");
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
      badge: styles.pendingBadge,
      text: styles.pendingBadgeText,
      icon: "ellipse-outline" as const,
      iconColor: "#64748b",
    };
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading adherence data...</Text>
      </View>
    );
  }

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

        <Pressable style={styles.scanButton} onPress={goToScanner}>
          <Ionicons name="scan" size={17} color="#2563eb" />
          <Text style={styles.scanButtonText}>Scan</Text>
        </Pressable>
      </View>

      {loadError && (
        <View style={styles.errorCard}>
          <Ionicons name="warning" size={22} color="#f59e0b" />
          <Text style={styles.errorText}>
            Load warning: {loadError}. Showing local cached data if available.
          </Text>
        </View>
      )}

      {!schedule.id && (
        <View style={styles.emptyScheduleCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="document-text" size={34} color="#2563eb" />
          </View>

          <Text style={styles.emptyTitle}>No Saved Schedule Yet</Text>

          <Text style={styles.emptyText}>
            Scan a prescription, review the extracted medicines, create a
            schedule, and save it.
          </Text>

          <Pressable style={styles.emptyButton} onPress={goToScanner}>
            <Ionicons name="scan" size={20} color="#ffffff" />
            <Text style={styles.emptyButtonText}>Scan Prescription</Text>
          </Pressable>
        </View>
      )}

      {schedule.id && (
        <>
          <View style={styles.liveCard}>
            <View style={styles.liveIconCircle}>
              <Ionicons name="cloud-done" size={24} color="#2563eb" />
            </View>

            <View style={styles.liveTextBox}>
              <Text style={styles.liveTitle}>Saved Medication Data</Text>
              <Text style={styles.liveText}>
                This page is reading and updating the latest saved medication
                schedule.
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.takenStatCard]}>
              <Ionicons name="checkmark-circle" size={26} color="#16a34a" />
              <Text style={[styles.statNumber, styles.takenText]}>
                {stats.taken}
              </Text>
              <Text style={styles.statLabel}>Taken</Text>
            </View>

            <View style={[styles.statCard, styles.missedStatCard]}>
              <Ionicons name="close-circle" size={26} color="#dc2626" />
              <Text style={[styles.statNumber, styles.missedText]}>
                {stats.missed}
              </Text>
              <Text style={styles.statLabel}>Missed</Text>
            </View>

            <View style={[styles.statCard, styles.snoozedStatCard]}>
              <Ionicons name="time" size={26} color="#f59e0b" />
              <Text style={[styles.statNumber, styles.snoozedText]}>
                {stats.snoozed}
              </Text>
              <Text style={styles.statLabel}>Snoozed</Text>
            </View>

            <View style={[styles.statCard, styles.pendingStatCard]}>
              <Ionicons name="notifications" size={26} color="#7c3aed" />
              <Text style={[styles.statNumber, styles.pendingText]}>
                {stats.pending}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          <View style={styles.adherenceCard}>
            <View style={styles.adherenceTextBox}>
              <Text style={styles.adherenceTitle}>Today&apos;s Adherence</Text>

              <Text style={styles.adherenceSubtitle}>
                {stats.adherencePercentage === null
                  ? "Your day is just starting 🌅"
                  : `${stats.completed} completed dose action${
                      stats.completed === 1 ? "" : "s"
                    } recorded`}
              </Text>
            </View>

            <View style={styles.adherenceCircle}>
              <Text style={styles.adherencePercentage}>
                {stats.adherencePercentage === null
                  ? "--"
                  : `${stats.adherencePercentage}%`}
              </Text>
            </View>
          </View>

          <View style={styles.weeklyCard}>
            <View style={styles.weeklyHeader}>
              <Ionicons name="bar-chart" size={26} color="#2563eb" />
              <View>
                <Text style={styles.weeklyTitle}>Weekly Adherence</Text>
                <Text style={styles.weeklySubtitle}>Last 7 days progress</Text>
              </View>
            </View>

            <View style={styles.chartBox}>
              {weeklyAdherence.map((day) => (
                <View key={day.dayName} style={styles.chartItem}>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBarFill,
                        {
                          height: `${Math.max(day.percentage, 4)}%`,
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.chartPercentage}>{day.percentage}%</Text>
                  <Text style={styles.chartDay}>{day.dayName}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.weeklyNote}>
              Days without completed dose actions show 0%.
            </Text>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Today&apos;s Medication Schedule
            </Text>

            <Pressable
              style={styles.medicationsButton}
              onPress={goToCurrentMedications}
            >
              <Ionicons name="medical" size={16} color="#2563eb" />
              <Text style={styles.medicationsButtonText}>Meds</Text>
            </Pressable>
          </View>

          {schedule.doses.map((dose) => {
            const statusStyle = getStatusStyle(dose.status);
            const isUpdating =
              isUpdatingDoseId === dose.id || isUpdatingDoseId === "reset-all";
            const doseIndicator = getDoseIndicator(dose);

            return (
              <View key={dose.id} style={styles.doseCard}>
                <View style={styles.doseHeader}>
                  <View style={styles.doseInfoBox}>
                    <Text style={styles.doseName}>{dose.medicationName}</Text>
                    <Text style={styles.doseMeta}>
                      {dose.dosage} • {dose.time}
                    </Text>
                    {doseIndicator ? (
                      <Text style={styles.doseIndicator}>
                        {doseIndicator}
                        {dose.frequency ? ` • ${dose.frequency}` : ""}
                      </Text>
                    ) : null}
                    <Text style={styles.doseInstruction}>
                      {dose.instruction}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, statusStyle.badge]}>
                    <Text style={[styles.statusBadgeText, statusStyle.text]}>
                      {dose.status}
                    </Text>
                    <Ionicons
                      name={statusStyle.icon}
                      size={15}
                      color={statusStyle.iconColor}
                    />
                  </View>
                </View>

                <View style={styles.doseActionsRow}>
                  <Pressable
                    style={[
                      styles.doseActionButton,
                      styles.takenButton,
                      isUpdating && styles.disabledButton,
                    ]}
                    onPress={() => confirmDoseAction(dose, "Taken")}
                    disabled={isUpdating}
                  >
                    <Text style={styles.doseActionButtonText}>Taken</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.doseActionButton,
                      styles.missedButton,
                      isUpdating && styles.disabledButton,
                    ]}
                    onPress={() => confirmDoseAction(dose, "Missed")}
                    disabled={isUpdating}
                  >
                    <Text style={styles.doseActionButtonText}>Missed</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.doseActionButton,
                      styles.snoozeButton,
                      isUpdating && styles.disabledButton,
                    ]}
                    onPress={() => confirmDoseAction(dose, "Snoozed")}
                    disabled={isUpdating}
                  >
                    <Text style={styles.doseActionButtonText}>Snooze</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <Text style={styles.sectionTitle}>Adherence History</Text>

          {history.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <Ionicons
                name="document-text-outline"
                size={30}
                color="#94a3b8"
              />
              <Text style={styles.emptyHistoryText}>
                No adherence actions recorded yet.
              </Text>
            </View>
          ) : (
            history.map((item) => {
              const statusStyle = getStatusStyle(item.action);

              return (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyIconCircle}>
                    <Ionicons
                      name={statusStyle.icon}
                      size={22}
                      color={statusStyle.iconColor}
                    />
                  </View>

                  <View style={styles.historyTextBox}>
                    <Text style={styles.historyTitle}>
                      {item.medicationName}
                    </Text>
                    <Text style={styles.historySubtitle}>
                      {item.action} • {item.time}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          <Pressable
            style={[
              styles.resetButton,
              isUpdatingDoseId === "reset-all" && styles.disabledButton,
            ]}
            onPress={resetScheduleStatuses}
            disabled={isUpdatingDoseId === "reset-all"}
          >
            <Ionicons name="refresh" size={18} color="#ef4444" />
            <Text style={styles.resetButtonText}>
              {isUpdatingDoseId === "reset-all"
                ? "Resetting..."
                : "Reset Today's Doses"}
            </Text>
          </Pressable>
        </>
      )}

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "800",
    color: "#64748b",
    textAlign: "center",
  },
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
    marginBottom: 16,
  },
  headerTextBox: {
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 7,
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 23,
    color: "#64748b",
    fontWeight: "600",
  },
  scanButton: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 999,
  },
  scanButtonText: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#2563eb",
  },
  errorCard: {
    backgroundColor: "#fef3c7",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 13.3,
    lineHeight: 19,
    color: "#92400e",
    fontWeight: "700",
  },
  emptyScheduleCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 7,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 18,
  },
  emptyButton: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    gap: 8,
  },
  emptyButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  liveCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  liveIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  liveTextBox: {
    flex: 1,
  },
  liveTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1e3a8a",
    marginBottom: 3,
  },
  liveText: {
    fontSize: 13.2,
    lineHeight: 19,
    color: "#1e40af",
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minHeight: 105,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
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
    fontSize: 26,
    fontWeight: "900",
    marginTop: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748b",
    marginTop: 2,
    textAlign: "center",
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
    backgroundColor: "#e0e7ff",
    borderRadius: 22,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  adherenceTextBox: {
    flex: 1,
  },
  adherenceTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2563eb",
    marginBottom: 7,
  },
  adherenceSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
    fontWeight: "700",
  },
  adherenceCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  adherencePercentage: {
    fontSize: 21,
    fontWeight: "900",
    color: "#2563eb",
  },
  weeklyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  weeklyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  weeklyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
  },
  weeklySubtitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: 2,
  },
  chartBox: {
    height: 150,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingTop: 10,
  },
  chartItem: {
    flex: 1,
    alignItems: "center",
  },
  chartBarTrack: {
    width: 18,
    height: 100,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartBarFill: {
    width: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 999,
  },
  chartPercentage: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    marginTop: 6,
  },
  chartDay: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    marginTop: 3,
  },
  weeklyNote: {
    fontSize: 12.5,
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 12,
    marginTop: 4,
  },
  medicationsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 5,
  },
  medicationsButtonText: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#2563eb",
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
    marginBottom: 14,
  },
  doseInfoBox: {
    flex: 1,
  },
  doseName: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  doseMeta: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 8,
  },
  doseIndicator: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#2563eb",
    marginTop: -3,
    marginBottom: 7,
  },
  doseInstruction: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
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
  pendingBadge: {
    backgroundColor: "#e2e8f0",
  },
  pendingBadgeText: {
    color: "#334155",
  },
  doseActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  doseActionButton: {
    flex: 1,
    minHeight: 47,
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
  doseActionButtonText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  emptyHistoryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    marginBottom: 14,
  },
  emptyHistoryText: {
    fontSize: 14.5,
    color: "#64748b",
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  historyCard: {
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
  historyIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  historyTextBox: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
  },
  historySubtitle: {
    fontSize: 13.5,
    color: "#64748b",
    fontWeight: "700",
    marginTop: 3,
  },
  historyDate: {
    fontSize: 12.5,
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 3,
  },
  resetButton: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 14.5,
    fontWeight: "900",
    color: "#ef4444",
  },
  bottomSpace: {
    height: 34,
  },
});
