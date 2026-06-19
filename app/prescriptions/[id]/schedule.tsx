import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  MedicationDose,
  saveMedicationScheduleToSupabase,
} from "@/src/services/medcoSupabaseService";

type MedicationConfidence = "High" | "Medium" | "Low";

type MedicationResult = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  confidence: MedicationConfidence;
};

type ScheduleDose = MedicationDose;

type StoredMedicationSchedule = {
  id: string;
  createdAt: string;
  doses: ScheduleDose[];
};

const MEDCO_SCHEDULE_STORAGE_KEY = "MEDCO_MEDICATION_SCHEDULE";

function buildDefaultSchedule(medications: MedicationResult[]): ScheduleDose[] {
  const defaultTimes = ["08:00 AM", "02:00 PM", "08:00 PM", "10:00 PM"];

  return medications.map((medication, index) => {
    return {
      id: `dose-${medication.id}-${Date.now()}-${index}`,
      medicationId: medication.id,
      medicationName: medication.name,
      dosage: medication.dosage,
      time: defaultTimes[index] ?? "08:00 AM",
      instruction:
        medication.instructions || "Follow prescription instructions",
      status: "Pending",
    };
  });
}

export default function SchedulePrescriptionScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    imageUri?: string;
    source?: string;
    medications?: string;
  }>();

  const parsedMedications = useMemo(() => {
    if (typeof params.medications !== "string") {
      return [];
    }

    try {
      const parsed = JSON.parse(params.medications);

      if (Array.isArray(parsed)) {
        return parsed as MedicationResult[];
      }

      return [];
    } catch {
      return [];
    }
  }, [params.medications]);

  const [scheduleDoses, setScheduleDoses] = useState<ScheduleDose[]>(
    buildDefaultSchedule(parsedMedications),
  );

  const [isSaving, setIsSaving] = useState(false);

  const updateDoseField = (
    doseId: string,
    field: keyof Pick<ScheduleDose, "time" | "instruction">,
    value: string,
  ) => {
    setScheduleDoses((currentDoses) =>
      currentDoses.map((dose) => {
        if (dose.id === doseId) {
          return {
            ...dose,
            [field]: value,
          };
        }

        return dose;
      }),
    );
  };

  const validateSchedule = () => {
    if (scheduleDoses.length === 0) {
      Alert.alert(
        "No Medications Found",
        "No extracted medications were found. Please go back and review the prescription extraction.",
      );

      return false;
    }

    const hasMissingName = scheduleDoses.some(
      (dose) => dose.medicationName.trim().length === 0,
    );

    if (hasMissingName) {
      Alert.alert(
        "Missing Medication Name",
        "Please make sure every dose has a medication name.",
      );

      return false;
    }

    const hasMissingDosage = scheduleDoses.some(
      (dose) => dose.dosage.trim().length === 0,
    );

    if (hasMissingDosage) {
      Alert.alert(
        "Missing Dosage",
        "Please make sure every medication has a dosage.",
      );

      return false;
    }

    const hasMissingTime = scheduleDoses.some(
      (dose) => dose.time.trim().length === 0,
    );

    if (hasMissingTime) {
      Alert.alert(
        "Missing Dose Time",
        "Please make sure every medication has a dose time before saving.",
      );

      return false;
    }

    return true;
  };

  const saveSchedule = async () => {
    if (!validateSchedule()) {
      return;
    }

    try {
      setIsSaving(true);

      const cleanedDoses: ScheduleDose[] = scheduleDoses.map((dose) => {
        return {
          ...dose,
          medicationName: dose.medicationName.trim(),
          dosage: dose.dosage.trim(),
          time: dose.time.trim(),
          instruction:
            dose.instruction.trim() || "Follow prescription instructions",
          status: "Pending",
        };
      });

      const savedSchedule =
        await saveMedicationScheduleToSupabase(cleanedDoses);

      const localSchedule: StoredMedicationSchedule = {
        id: savedSchedule.id,
        createdAt: savedSchedule.createdAt,
        doses: savedSchedule.doses,
      };

      await AsyncStorage.setItem(
        MEDCO_SCHEDULE_STORAGE_KEY,
        JSON.stringify(localSchedule),
      );

      Alert.alert(
        "Schedule Saved",
        "The prescription schedule has been saved to Supabase and is ready for adherence tracking.",
        [
          {
            text: "Go to Adherence",
            onPress: () => router.replace("/(tabs)/adherence"),
          },
          {
            text: "Go Home",
            onPress: () => router.replace("/(tabs)"),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "Supabase Save Failed",
        error instanceof Error
          ? error.message
          : "Unable to save the medication schedule to Supabase. Please check your Supabase tables, RLS policies, and .env values.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addExtraDose = (medication: MedicationResult) => {
    const newDose: ScheduleDose = {
      id: `dose-${medication.id}-${Date.now()}`,
      medicationId: medication.id,
      medicationName: medication.name,
      dosage: medication.dosage,
      time: "08:00 PM",
      instruction:
        medication.instructions || "Follow prescription instructions",
      status: "Pending",
    };

    setScheduleDoses((currentDoses) => [...currentDoses, newDose]);
  };

  const removeDose = (doseId: string) => {
    if (scheduleDoses.length === 1) {
      Alert.alert(
        "Cannot Remove",
        "At least one dose must remain in the schedule.",
      );

      return;
    }

    setScheduleDoses((currentDoses) =>
      currentDoses.filter((dose) => dose.id !== doseId),
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={23} color="#0f172a" />
        </Pressable>

        <Text style={styles.title}>Create Schedule</Text>

        <Text style={styles.subtitle}>
          Set dose times before saving the scanned prescription to Supabase.
        </Text>

        <View style={styles.connectedCard}>
          <View style={styles.connectedIcon}>
            <Ionicons name="cloud-upload" size={18} color="#2563eb" />
          </View>

          <View style={styles.connectedTextBox}>
            <Text style={styles.connectedTitle}>Supabase Connected</Text>
            <Text style={styles.connectedText}>
              Saving this schedule will store the medication doses in the live
              Supabase database and keep a local copy for quick loading.
            </Text>
          </View>
        </View>

        {scheduleDoses.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle" size={26} color="#ef4444" />
            <Text style={styles.emptyTitle}>No medications found</Text>
            <Text style={styles.emptyText}>
              Go back to the review page and make sure at least one medication
              is added before creating a schedule.
            </Text>
          </View>
        )}

        {scheduleDoses.length > 0 && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Ionicons name="medical" size={21} color="#16a34a" />
              <Text style={styles.summaryNumber}>
                {parsedMedications.length}
              </Text>
              <Text style={styles.summaryLabel}>Medicines</Text>
            </View>

            <View style={styles.summaryCard}>
              <Ionicons name="alarm" size={21} color="#7c3aed" />
              <Text style={styles.summaryNumber}>{scheduleDoses.length}</Text>
              <Text style={styles.summaryLabel}>Doses</Text>
            </View>

            <View style={styles.summaryCard}>
              <Ionicons name="cloud-done" size={21} color="#2563eb" />
              <Text style={styles.summaryNumberSmall}>Live</Text>
              <Text style={styles.summaryLabel}>Supabase</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Medication Schedule</Text>

        {scheduleDoses.map((dose, index) => (
          <View key={dose.id} style={styles.doseCard}>
            <View style={styles.doseHeader}>
              <View style={styles.doseNumberCircle}>
                <Text style={styles.doseNumberText}>{index + 1}</Text>
              </View>

              <View style={styles.doseHeaderTextBox}>
                <Text style={styles.medicationName}>{dose.medicationName}</Text>
                <Text style={styles.medicationDosage}>{dose.dosage}</Text>
              </View>

              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Pending</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Dose Time</Text>
            <TextInput
              style={styles.input}
              value={dose.time}
              onChangeText={(value) => updateDoseField(dose.id, "time", value)}
              placeholder="Example: 08:00 AM"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Instruction</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={dose.instruction}
              onChangeText={(value) =>
                updateDoseField(dose.id, "instruction", value)
              }
              placeholder="Example: Take after food"
              placeholderTextColor="#94a3b8"
              multiline
            />

            <View style={styles.doseActionsRow}>
              <Pressable
                style={styles.removeDoseButton}
                onPress={() => removeDose(dose.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={styles.removeDoseButtonText}>Remove Dose</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {parsedMedications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Add More Doses</Text>

            <View style={styles.extraDoseCard}>
              <Text style={styles.extraDoseText}>
                Add another dose if the prescription requires more than one dose
                per day.
              </Text>

              {parsedMedications.map((medication) => (
                <Pressable
                  key={medication.id}
                  style={styles.extraDoseButton}
                  onPress={() => addExtraDose(medication)}
                >
                  <Ionicons name="add-circle" size={18} color="#2563eb" />
                  <Text style={styles.extraDoseButtonText}>
                    Add dose for {medication.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Pressable
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveSchedule}
          disabled={isSaving}
        >
          <Ionicons name="cloud-upload" size={18} color="#ffffff" />
          <Text style={styles.saveButtonText}>
            {isSaving ? "Saving to Supabase..." : "Save Schedule to Supabase"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.backToReviewButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backToReviewButtonText}>Back to Review</Text>
        </Pressable>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 28,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748b",
    marginBottom: 16,
  },
  connectedCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 14,
  },
  connectedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  connectedTextBox: {
    flex: 1,
  },
  connectedTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1e3a8a",
    marginBottom: 4,
  },
  connectedText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "#1e40af",
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#fee2e2",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#991b1b",
    marginTop: 8,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#991b1b",
    fontWeight: "600",
    textAlign: "center",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    minHeight: 96,
    backgroundColor: "#ffffff",
    borderRadius: 17,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryNumber: {
    fontSize: 19,
    fontWeight: "900",
    color: "#0f172a",
    marginTop: 6,
  },
  summaryNumberSmall: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0f172a",
    marginTop: 6,
  },
  summaryLabel: {
    fontSize: 12.5,
    color: "#64748b",
    fontWeight: "800",
    marginTop: 3,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 12,
  },
  doseCard: {
    backgroundColor: "#ffffff",
    borderRadius: 21,
    padding: 15,
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  doseHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
    gap: 10,
  },
  doseNumberCircle: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  doseNumberText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  doseHeaderTextBox: {
    flex: 1,
  },
  medicationName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0f172a",
  },
  medicationDosage: {
    fontSize: 13.5,
    color: "#64748b",
    fontWeight: "700",
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: "#e2e8f0",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  pendingBadgeText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "900",
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 13,
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "600",
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top",
    lineHeight: 21,
  },
  doseActionsRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  removeDoseButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 6,
  },
  removeDoseButtonText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "900",
  },
  extraDoseCard: {
    backgroundColor: "#ffffff",
    borderRadius: 21,
    padding: 15,
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  extraDoseText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 12,
  },
  extraDoseButton: {
    minHeight: 45,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    marginTop: 9,
    gap: 8,
  },
  extraDoseButtonText: {
    flex: 1,
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "900",
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  saveButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  saveButtonText: {
    fontSize: 15.5,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
  },
  backToReviewButton: {
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  backToReviewButtonText: {
    fontSize: 14.5,
    fontWeight: "900",
    color: "#64748b",
  },
  bottomSpace: {
    height: 36,
  },
});
