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

type MedicationGroup = {
  medicationId: string;
  medicationName: string;
  dosage: string;
  instructions: string[];
  doseTimes: string[];
  statuses: DoseStatus[];
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

export default function CurrentMedicationsScreen() {
  const [doses, setDoses] = useState<ScheduleDose[]>(defaultDoses);
  const [hasSavedSchedule, setHasSavedSchedule] = useState(false);
  const [scheduleCreatedAt, setScheduleCreatedAt] = useState<string | null>(
    null,
  );

  const loadMedicationSchedule = async () => {
    try {
      const savedScheduleRaw = await AsyncStorage.getItem(
        MEDCO_SCHEDULE_STORAGE_KEY,
      );

      if (!savedScheduleRaw) {
        setDoses(defaultDoses);
        setHasSavedSchedule(false);
        setScheduleCreatedAt(null);
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
        setScheduleCreatedAt(savedSchedule.createdAt);
        return;
      }

      setDoses(defaultDoses);
      setHasSavedSchedule(false);
      setScheduleCreatedAt(null);
    } catch {
      setDoses(defaultDoses);
      setHasSavedSchedule(false);
      setScheduleCreatedAt(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMedicationSchedule();
    }, []),
  );

  const groupedMedications = useMemo(() => {
    const groupedMap = new Map<string, MedicationGroup>();

    doses.forEach((dose) => {
      const existingGroup = groupedMap.get(dose.medicationId);

      if (existingGroup) {
        existingGroup.doseTimes.push(dose.time);
        existingGroup.statuses.push(dose.status);

        if (!existingGroup.instructions.includes(dose.instruction)) {
          existingGroup.instructions.push(dose.instruction);
        }

        return;
      }

      groupedMap.set(dose.medicationId, {
        medicationId: dose.medicationId,
        medicationName: dose.medicationName,
        dosage: dose.dosage,
        instructions: [dose.instruction],
        doseTimes: [dose.time],
        statuses: [dose.status],
      });
    });

    return Array.from(groupedMap.values());
  }, [doses]);

  const stats = useMemo(() => {
    const totalMedicines = groupedMedications.length;
    const totalDoses = doses.length;
    const pending = doses.filter((dose) => dose.status === "Pending").length;
    const completed = doses.filter(
      (dose) => dose.status === "Taken" || dose.status === "Missed",
    ).length;

    return {
      totalMedicines,
      totalDoses,
      pending,
      completed,
    };
  }, [doses, groupedMedications]);

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

  const clearSavedSchedule = () => {
    Alert.alert(
      "Clear Medication List",
      "This will remove the saved scanned medication schedule from this device.",
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
            setDoses(defaultDoses);
            setHasSavedSchedule(false);
            setScheduleCreatedAt(null);
          },
        },
      ],
    );
  };

  const getStatusSummary = (statuses: DoseStatus[]) => {
    const taken = statuses.filter((status) => status === "Taken").length;
    const missed = statuses.filter((status) => status === "Missed").length;
    const snoozed = statuses.filter((status) => status === "Snoozed").length;
    const pending = statuses.filter((status) => status === "Pending").length;

    if (pending === statuses.length) {
      return "Pending";
    }

    if (taken > 0 && missed === 0 && snoozed === 0 && pending === 0) {
      return "Taken";
    }

    if (missed > 0) {
      return "Needs Review";
    }

    if (snoozed > 0) {
      return "Snoozed";
    }

    return "Active";
  };

  const getStatusBadgeStyle = (statusSummary: string) => {
    if (statusSummary === "Taken") {
      return {
        badge: styles.takenBadge,
        text: styles.takenBadgeText,
        icon: "checkmark-circle" as const,
        iconColor: "#16a34a",
      };
    }

    if (statusSummary === "Needs Review") {
      return {
        badge: styles.missedBadge,
        text: styles.missedBadgeText,
        icon: "alert-circle" as const,
        iconColor: "#dc2626",
      };
    }

    if (statusSummary === "Snoozed") {
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
      iconColor: "#2563eb",
    };
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

        <Pressable style={styles.scanTopButton} onPress={goToScanner}>
          <Ionicons name="scan" size={17} color="#2563eb" />
          <Text style={styles.scanTopButtonText}>Scan</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Current Medications</Text>

      <Text style={styles.subtitle}>
        View medications saved from your scanned prescription schedule.
      </Text>

      {!hasSavedSchedule && (
        <View style={styles.demoCard}>
          <Ionicons name="information-circle" size={22} color="#2563eb" />
          <Text style={styles.demoText}>
            Demo medications are showing. Scan and save a prescription schedule
            to display your real medication list here.
          </Text>
        </View>
      )}

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryTitle}>Medication Summary</Text>
            <Text style={styles.summarySubtitle}>
              {hasSavedSchedule
                ? `Saved ${formatCreatedDate(scheduleCreatedAt)}`
                : "Using demo data"}
            </Text>
          </View>

          <View style={styles.summaryIconCircle}>
            <Ionicons name="medical" size={26} color="#16a34a" />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.totalMedicines}</Text>
            <Text style={styles.statLabel}>Medicines</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.totalDoses}</Text>
            <Text style={styles.statLabel}>Doses</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Medication List</Text>

        <Pressable style={styles.addButton} onPress={goToScanner}>
          <Ionicons name="add" size={18} color="#2563eb" />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {groupedMedications.map((medication) => {
        const statusSummary = getStatusSummary(medication.statuses);
        const statusStyle = getStatusBadgeStyle(statusSummary);

        return (
          <View key={medication.medicationId} style={styles.medicationCard}>
            <View style={styles.medicationHeader}>
              <View style={styles.medicationIconCircle}>
                <Ionicons name="medical" size={25} color="#16a34a" />
              </View>

              <View style={styles.medicationHeaderTextBox}>
                <Text style={styles.medicationName}>
                  {medication.medicationName}
                </Text>

                <Text style={styles.medicationDosage}>{medication.dosage}</Text>
              </View>

              <View style={[styles.statusBadge, statusStyle.badge]}>
                <Text style={[styles.statusBadgeText, statusStyle.text]}>
                  {statusSummary}
                </Text>
                <Ionicons
                  name={statusStyle.icon}
                  size={15}
                  color={statusStyle.iconColor}
                />
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="time-outline" size={18} color="#2563eb" />
              </View>

              <View style={styles.detailTextBox}>
                <Text style={styles.detailLabel}>Dose Times</Text>
                <Text style={styles.detailText}>
                  {medication.doseTimes.join(", ")}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#7c3aed"
                />
              </View>

              <View style={styles.detailTextBox}>
                <Text style={styles.detailLabel}>Instructions</Text>
                <Text style={styles.detailText}>
                  {medication.instructions.join(" • ")}
                </Text>
              </View>
            </View>

            <View style={styles.cardActionsRow}>
              <Pressable style={styles.actionButton} onPress={goToAdherence}>
                <Ionicons name="bar-chart" size={17} color="#2563eb" />
                <Text style={styles.actionButtonText}>Track</Text>
              </Pressable>

              <Pressable style={styles.actionButton} onPress={goToScanner}>
                <Ionicons name="create-outline" size={17} color="#2563eb" />
                <Text style={styles.actionButtonText}>Update</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <Pressable style={styles.scanNewButton} onPress={goToScanner}>
        <Ionicons name="scan" size={20} color="#ffffff" />
        <Text style={styles.scanNewButtonText}>Scan New Prescription</Text>
      </Pressable>

      {hasSavedSchedule && (
        <Pressable style={styles.clearButton} onPress={clearSavedSchedule}>
          <Text style={styles.clearButtonText}>Clear Saved Medications</Text>
        </Pressable>
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
  scanTopButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
  },
  scanTopButtonText: {
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
    marginBottom: 22,
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
    backgroundColor: "#dcfce7",
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
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  addButtonText: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#2563eb",
  },
  medicationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  medicationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 16,
  },
  medicationIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  medicationHeaderTextBox: {
    flex: 1,
  },
  medicationName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  medicationDosage: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
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
  pendingBadge: {
    backgroundColor: "#dbeafe",
  },
  pendingBadgeText: {
    color: "#2563eb",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 13,
  },
  detailIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  detailTextBox: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#334155",
    marginBottom: 3,
  },
  detailText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "#64748b",
    fontWeight: "600",
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#eff6ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#2563eb",
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
  clearButton: {
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 14.5,
    fontWeight: "900",
    color: "#ef4444",
  },
  bottomSpace: {
    height: 34,
  },
});
