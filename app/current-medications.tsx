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
  MedicationDose,
  MedicationSchedule,
  getLatestMedicationScheduleFromSupabase,
} from "@/src/services/medcoSupabaseService";

const MEDCO_SCHEDULE_STORAGE_KEY = "MEDCO_MEDICATION_SCHEDULE";

type StoredMedicationSchedule = {
  id: string;
  createdAt: string;
  doses: MedicationDose[];
};

type MedicationGroup = {
  medicationId: string;
  medicationName: string;
  dosage: string;
  doseTimes: string[];
  instructions: string[];
  statuses: string[];
};

const emptySchedule: MedicationSchedule = {
  id: "",
  createdAt: new Date().toISOString(),
  doses: [],
};

export default function CurrentMedicationsScreen() {
  const [schedule, setSchedule] = useState<MedicationSchedule>(emptySchedule);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedFromCache, setLoadedFromCache] = useState(false);

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

  const loadLocalBackup = async () => {
    const savedScheduleRaw = await AsyncStorage.getItem(
      MEDCO_SCHEDULE_STORAGE_KEY,
    );

    if (!savedScheduleRaw) {
      setSchedule(emptySchedule);
      setLoadedFromCache(false);
      return;
    }

    const savedSchedule = JSON.parse(
      savedScheduleRaw,
    ) as StoredMedicationSchedule;

    if (!Array.isArray(savedSchedule.doses)) {
      setSchedule(emptySchedule);
      setLoadedFromCache(false);
      return;
    }

    setSchedule({
      id: savedSchedule.id,
      createdAt: savedSchedule.createdAt,
      doses: savedSchedule.doses,
    });

    setLoadedFromCache(true);
  };

  const loadCurrentMedications = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      setLoadedFromCache(false);

      const latestSchedule = await getLatestMedicationScheduleFromSupabase();

      if (!latestSchedule) {
        setSchedule(emptySchedule);
        setLoadedFromCache(false);
        return;
      }

      setSchedule(latestSchedule);
      await cacheScheduleLocally(latestSchedule);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load medications.";

      setLoadError(message);

      try {
        await loadLocalBackup();
      } catch {
        setSchedule(emptySchedule);
        setLoadedFromCache(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCurrentMedications();
    }, []),
  );

  const medicationGroups = useMemo(() => {
    const groupedMap = new Map<string, MedicationGroup>();

    schedule.doses.forEach((dose) => {
      const existingGroup = groupedMap.get(dose.medicationId);

      if (existingGroup) {
        if (!existingGroup.doseTimes.includes(dose.time)) {
          existingGroup.doseTimes.push(dose.time);
        }

        if (!existingGroup.instructions.includes(dose.instruction)) {
          existingGroup.instructions.push(dose.instruction);
        }

        if (!existingGroup.statuses.includes(dose.status)) {
          existingGroup.statuses.push(dose.status);
        }

        return;
      }

      groupedMap.set(dose.medicationId, {
        medicationId: dose.medicationId,
        medicationName: dose.medicationName,
        dosage: dose.dosage,
        doseTimes: [dose.time],
        instructions: [dose.instruction],
        statuses: [dose.status],
      });
    });

    return Array.from(groupedMap.values());
  }, [schedule.doses]);

  const summary = useMemo(() => {
    const totalMedications = medicationGroups.length;
    const totalDoses = schedule.doses.length;
    const pendingDoses = schedule.doses.filter(
      (dose) => dose.status === "Pending",
    ).length;
    const completedDoses = schedule.doses.filter(
      (dose) => dose.status === "Taken" || dose.status === "Missed",
    ).length;

    return {
      totalMedications,
      totalDoses,
      pendingDoses,
      completedDoses,
    };
  }, [medicationGroups.length, schedule.doses]);

  const formatCreatedDate = () => {
    if (!schedule.id) {
      return "No prescription schedule saved yet";
    }

    try {
      const date = new Date(schedule.createdAt);

      return `Saved ${date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
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

  const refreshMedications = () => {
    loadCurrentMedications();
  };

  const showMedicationDetails = (medication: MedicationGroup) => {
    Alert.alert(
      medication.medicationName,
      `Dosage: ${medication.dosage}\n\nDose times: ${medication.doseTimes.join(
        ", ",
      )}\n\nInstructions: ${medication.instructions.join(
        " • ",
      )}\n\nStatuses: ${medication.statuses.join(", ")}`,
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading current medications...</Text>
      </View>
    );
  }

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

        <Pressable style={styles.refreshButton} onPress={refreshMedications}>
          <Ionicons name="refresh" size={17} color="#2563eb" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Current Medications</Text>

      <Text style={styles.subtitle}>
        View medications saved from your prescription schedule.
      </Text>

      {loadError && (
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={22} color="#f59e0b" />
          <Text style={styles.warningText}>
            Load warning: {loadError}.{" "}
            {loadedFromCache
              ? "Showing locally cached schedule."
              : "No local backup was found."}
          </Text>
        </View>
      )}

      {schedule.id && (
        <View style={styles.liveCard}>
          <View style={styles.liveIconCircle}>
            <Ionicons name="cloud-done" size={24} color="#2563eb" />
          </View>

          <View style={styles.liveTextBox}>
            <Text style={styles.liveTitle}>
              {loadedFromCache
                ? "Local Backup Loaded"
                : "Saved Medication Data"}
            </Text>
            <Text style={styles.liveText}>{formatCreatedDate()}</Text>
          </View>
        </View>
      )}

      {!schedule.id && (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="medical" size={38} color="#2563eb" />
          </View>

          <Text style={styles.emptyTitle}>No Medications Saved Yet</Text>

          <Text style={styles.emptyText}>
            Scan a prescription, review the extracted medication details, then
            save the schedule. The medications will appear here after saving.
          </Text>

          <Pressable style={styles.primaryButton} onPress={goToScanner}>
            <Ionicons name="scan" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Scan Prescription</Text>
          </Pressable>
        </View>
      )}

      {schedule.id && (
        <>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Ionicons name="medical" size={24} color="#16a34a" />
              <Text style={styles.summaryNumber}>
                {summary.totalMedications}
              </Text>
              <Text style={styles.summaryLabel}>Medications</Text>
            </View>

            <View style={styles.summaryCard}>
              <Ionicons name="alarm" size={24} color="#7c3aed" />
              <Text style={styles.summaryNumber}>{summary.totalDoses}</Text>
              <Text style={styles.summaryLabel}>Doses</Text>
            </View>

            <View style={styles.summaryCard}>
              <Ionicons name="time" size={24} color="#f59e0b" />
              <Text style={styles.summaryNumber}>{summary.pendingDoses}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Medication List</Text>

            <Pressable style={styles.adherenceButton} onPress={goToAdherence}>
              <Ionicons name="bar-chart" size={16} color="#2563eb" />
              <Text style={styles.adherenceButtonText}>Adherence</Text>
            </Pressable>
          </View>

          {medicationGroups.map((medication) => (
            <Pressable
              key={medication.medicationId}
              style={styles.medicationCard}
              onPress={() => showMedicationDetails(medication)}
            >
              <View style={styles.medicationHeader}>
                <View style={styles.medicationIconCircle}>
                  <Ionicons name="medical" size={24} color="#16a34a" />
                </View>

                <View style={styles.medicationHeaderText}>
                  <Text style={styles.medicationName}>
                    {medication.medicationName}
                  </Text>
                  <Text style={styles.medicationDosage}>
                    {medication.dosage}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={22} color="#cbd5e1" />
              </View>

              <View style={styles.medicationInfoBox}>
                <View style={styles.infoRow}>
                  <Ionicons name="time" size={17} color="#2563eb" />
                  <Text style={styles.infoText}>
                    {medication.doseTimes.join(", ")}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="document-text" size={17} color="#64748b" />
                  <Text style={styles.infoText}>
                    {medication.instructions.join(" • ")}
                  </Text>
                </View>
              </View>

              <View style={styles.statusRow}>
                {medication.statuses.map((status) => (
                  <View key={status} style={styles.statusChip}>
                    <Text style={styles.statusChipText}>{status}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          ))}

          <Pressable style={styles.primaryButton} onPress={goToScanner}>
            <Ionicons name="add-circle" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>
              Scan Another Prescription
            </Text>
          </Pressable>
        </>
      )}

      <View style={styles.noteCard}>
        <Ionicons name="information-circle" size={20} color="#2563eb" />
        <Text style={styles.noteText}>
          This screen does not show demo medication data. It only shows
          medications from your saved schedule or a local backup if loading
          fails.
        </Text>
      </View>

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
    lineHeight: 22,
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
    paddingTop: 52,
    paddingBottom: 30,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  refreshButtonText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "900",
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
  warningCard: {
    backgroundColor: "#fef3c7",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 13.3,
    lineHeight: 19,
    color: "#92400e",
    fontWeight: "700",
  },
  liveCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 14,
  },
  liveIconCircle: {
    width: 43,
    height: 43,
    borderRadius: 21.5,
    backgroundColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  liveTextBox: {
    flex: 1,
  },
  liveTitle: {
    fontSize: 16.5,
    fontWeight: "900",
    color: "#1e3a8a",
    marginBottom: 3,
  },
  liveText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "#1e40af",
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
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
  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    minHeight: 104,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
    marginTop: 6,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748b",
    marginTop: 2,
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
  },
  adherenceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#eff6ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  adherenceButtonText: {
    color: "#2563eb",
    fontSize: 13.5,
    fontWeight: "900",
  },
  medicationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 15,
    marginBottom: 13,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  medicationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 12,
  },
  medicationIconCircle: {
    width: 49,
    height: 49,
    borderRadius: 24.5,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  medicationHeaderText: {
    flex: 1,
  },
  medicationName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
  },
  medicationDosage: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
    marginTop: 3,
  },
  medicationInfoBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#475569",
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
  statusChip: {
    backgroundColor: "#eff6ff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusChipText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "900",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15.5,
    fontWeight: "900",
    textAlign: "center",
  },
  noteCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 13.2,
    lineHeight: 19,
    color: "#1e40af",
    fontWeight: "700",
  },
  bottomSpace: {
    height: 34,
  },
});
