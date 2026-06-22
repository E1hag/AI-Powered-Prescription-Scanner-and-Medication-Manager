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
  refreshDrugInteractionResultsForSchedule,
  saveMedicationScheduleToSupabase,
} from "@/src/services/medcoSupabaseService";

type MedicationConfidence = "High" | "Medium" | "Low";

type MedicationResult = {
  id: string;
  name: string;
  medicationName?: string;
  medication_name?: string;
  dosage: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  instruction?: string;
  ingredientA?: string;
  ingredientB?: string | null;
  ingredient_a?: string;
  ingredient_b?: string | null;
  confidence?: MedicationConfidence;
};

type ScheduleDose = MedicationDose;

type StoredMedicationSchedule = {
  id: string;
  createdAt: string;
  doses: ScheduleDose[];
};

const MEDCO_SCHEDULE_STORAGE_KEY = "MEDCO_MEDICATION_SCHEDULE";

function safeText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function getMedicationName(medication: MedicationResult) {
  return (
    safeText(medication.name).trim() ||
    safeText(medication.medicationName).trim() ||
    safeText(medication.medication_name).trim() ||
    "Unnamed Medication"
  );
}

function getMedicationInstruction(medication: MedicationResult) {
  return (
    safeText(medication.instructions).trim() ||
    safeText(medication.instruction).trim() ||
    "Follow prescription instructions"
  );
}

type ParsedFrequency = {
  dailyDoseCount: number;
  isPrn: boolean;
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  once: 1,
  two: 2,
  twice: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

function parseDailyDoseCount(medication: MedicationResult): ParsedFrequency {
  const frequencyText = safeText(medication.frequency).toLowerCase();
  const instructionText = getMedicationInstruction(medication).toLowerCase();
  const combinedText = `${frequencyText} ${instructionText}`.trim();

  if (/\b(prn|as needed|when needed|if needed)\b/.test(combinedText)) {
    return {
      dailyDoseCount: 1,
      isPrn: true,
    };
  }

  if (/\b(qid|four times|4\s*(x|times)?\s*(a\s*)?(day|daily|per day))\b/.test(combinedText)) {
    return {
      dailyDoseCount: 4,
      isPrn: false,
    };
  }

  if (/\b(tid|three times|3\s*(x|times)?\s*(a\s*)?(day|daily|per day))\b/.test(combinedText)) {
    return {
      dailyDoseCount: 3,
      isPrn: false,
    };
  }

  if (/\b(bid|bd|twice|two times|2\s*(x|times)?\s*(a\s*)?(day|daily|per day))\b/.test(combinedText)) {
    return {
      dailyDoseCount: 2,
      isPrn: false,
    };
  }

  if (/\b(od|qd|daily|once|one time|1\s*(x|time)?\s*(a\s*)?(day|daily|per day))\b/.test(combinedText)) {
    return {
      dailyDoseCount: 1,
      isPrn: false,
    };
  }

  const numericMatch = combinedText.match(
    /\b([1-6])\s*(?:x|times?|per)?\s*(?:a\s*)?(?:day|daily|per day)\b/,
  );

  if (numericMatch?.[1]) {
    return {
      dailyDoseCount: Math.min(Number(numericMatch[1]), 6),
      isPrn: false,
    };
  }

  const wordMatch = combinedText.match(
    /\b(one|once|two|twice|three|four|five|six)\b.*\b(day|daily|per day)\b/,
  );

  if (wordMatch?.[1] && NUMBER_WORDS[wordMatch[1]]) {
    return {
      dailyDoseCount: NUMBER_WORDS[wordMatch[1]],
      isPrn: false,
    };
  }

  return {
    dailyDoseCount: 1,
    isPrn: false,
  };
}

function getSuggestedDoseTimes(dailyDoseCount: number, isPrn: boolean) {
  if (isPrn) {
    return ["As needed"];
  }

  const count = Math.max(1, Math.min(dailyDoseCount, 6));

  const timeTemplates: Record<number, string[]> = {
    1: ["08:00 AM"],
    2: ["08:00 AM", "08:00 PM"],
    3: ["08:00 AM", "02:00 PM", "08:00 PM"],
    4: ["08:00 AM", "12:00 PM", "04:00 PM", "08:00 PM"],
    5: ["06:00 AM", "10:00 AM", "02:00 PM", "06:00 PM", "10:00 PM"],
    6: [
      "06:00 AM",
      "10:00 AM",
      "02:00 PM",
      "06:00 PM",
      "10:00 PM",
      "02:00 AM",
    ],
  };

  return timeTemplates[count] ?? timeTemplates[1];
}

function normalizeParsedMedication(
  medication: Partial<MedicationResult>,
  index: number,
): MedicationResult {
  const medicationName =
    safeText(medication.name).trim() ||
    safeText(medication.medicationName).trim() ||
    safeText(medication.medication_name).trim();

  return {
    id: safeText(medication.id).trim() || `med-${index + 1}`,
    name: medicationName || `Medication ${index + 1}`,
    medicationName: medicationName || `Medication ${index + 1}`,
    medication_name: medicationName || `Medication ${index + 1}`,
    dosage: safeText(medication.dosage).trim(),
    frequency: safeText(medication.frequency).trim(),
    duration: safeText(medication.duration).trim(),
    instructions: getMedicationInstruction(medication as MedicationResult),
    instruction: getMedicationInstruction(medication as MedicationResult),
    ingredientA:
      safeText(medication.ingredientA).trim() ||
      safeText(medication.ingredient_a).trim(),
    ingredientB:
      safeText(medication.ingredientB).trim() ||
      safeText(medication.ingredient_b).trim() ||
      null,
    ingredient_a:
      safeText(medication.ingredientA).trim() ||
      safeText(medication.ingredient_a).trim(),
    ingredient_b:
      safeText(medication.ingredientB).trim() ||
      safeText(medication.ingredient_b).trim() ||
      null,
    confidence: medication.confidence ?? "High",
  };
}

function buildDefaultSchedule(medications: MedicationResult[]): ScheduleDose[] {
  return medications.flatMap((medication, index) => {
    const medicationName = getMedicationName(medication);
    const dosage = safeText(medication.dosage).trim();
    const instruction = getMedicationInstruction(medication);
    const frequency = safeText(medication.frequency).trim();
    const duration = safeText(medication.duration).trim();
    const parsedFrequency = parseDailyDoseCount(medication);
    const suggestedTimes = getSuggestedDoseTimes(
      parsedFrequency.dailyDoseCount,
      parsedFrequency.isPrn,
    );

    return suggestedTimes.map((time, doseIndex) => ({
      id: `dose-${safeText(medication.id) || index}-${Date.now()}-${doseIndex}`,
      medicationId: safeText(medication.id) || `med-${index + 1}`,
      medicationName,
      dosage,
      time,
      instruction,
      status: "Pending",
      frequency,
      duration,
      doseIndex: doseIndex + 1,
      totalDailyDoses: suggestedTimes.length,
      isPrn: parsedFrequency.isPrn,
      ingredientA:
        safeText(medication.ingredientA).trim() ||
        safeText(medication.ingredient_a).trim() ||
        medicationName,
      ingredientB:
        safeText(medication.ingredientB).trim() ||
        safeText(medication.ingredient_b).trim() ||
        null,
    }));
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
        return parsed.map((item, index) =>
          normalizeParsedMedication(item, index),
        );
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

    const hasMissingName = scheduleDoses.some((dose) => {
      return safeText(dose.medicationName).trim().length === 0;
    });

    if (hasMissingName) {
      Alert.alert(
        "Missing Medication Name",
        "Please make sure every dose has a medication name.",
      );

      return false;
    }

    const hasMissingDosage = scheduleDoses.some((dose) => {
      return safeText(dose.dosage).trim().length === 0;
    });

    if (hasMissingDosage) {
      Alert.alert(
        "Missing Dosage",
        "Please make sure every medication has a dosage.",
      );

      return false;
    }

    const hasMissingTime = scheduleDoses.some((dose) => {
      return safeText(dose.time).trim().length === 0;
    });

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

      const cleanedDoses: ScheduleDose[] = scheduleDoses.map((dose, index) => {
        return {
          ...dose,
          id: safeText(dose.id).trim() || `dose-${Date.now()}-${index}`,
          medicationId:
            safeText(dose.medicationId).trim() || `medication-${index + 1}`,
          medicationName:
            safeText(dose.medicationName).trim() || `Medication ${index + 1}`,
          dosage: safeText(dose.dosage).trim(),
          time: safeText(dose.time).trim(),
          instruction:
            safeText(dose.instruction).trim() ||
            "Follow prescription instructions",
          status: "Pending",
          frequency: safeText(dose.frequency).trim() || null,
          duration: safeText(dose.duration).trim() || null,
          doseIndex:
            typeof dose.doseIndex === "number" ? dose.doseIndex : index + 1,
          totalDailyDoses:
            typeof dose.totalDailyDoses === "number"
              ? dose.totalDailyDoses
              : null,
          isPrn: Boolean(dose.isPrn),
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

      void refreshDrugInteractionResultsForSchedule(savedSchedule).catch(
        (error) => {
          console.log("Drug interaction refresh after schedule save failed:", {
            error,
          });
        },
      );

      Alert.alert(
        "Schedule Saved",
        "The prescription schedule has been saved and is ready for adherence tracking. Drug interaction results will update in the background.",
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
        "Save Failed",
        error instanceof Error
          ? error.message
          : "Unable to save the medication schedule. Please check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addExtraDose = (medication: MedicationResult) => {
    const medicationName = getMedicationName(medication);
    const dosage = safeText(medication.dosage).trim();
    const instruction = getMedicationInstruction(medication);
    const medicationId = safeText(medication.id) || `med-${Date.now()}`;
    const existingDoseCount = scheduleDoses.filter((dose) => {
      return dose.medicationId === medicationId;
    }).length;
    const parsedFrequency = parseDailyDoseCount(medication);
    const targetDoseCount = Math.max(
      existingDoseCount + 1,
      parsedFrequency.dailyDoseCount,
    );
    const suggestedTimes = getSuggestedDoseTimes(
      targetDoseCount,
      parsedFrequency.isPrn,
    );
    const nextTime =
      suggestedTimes[existingDoseCount] ||
      suggestedTimes[suggestedTimes.length - 1] ||
      "08:00 PM";

    const newDose: ScheduleDose = {
      id: `dose-${safeText(medication.id) || Date.now()}-${Date.now()}`,
      medicationId,
      medicationName,
      dosage,
      time: nextTime,
      instruction,
      status: "Pending",
      frequency: safeText(medication.frequency).trim(),
      duration: safeText(medication.duration).trim(),
      doseIndex: existingDoseCount + 1,
      totalDailyDoses: targetDoseCount,
      isPrn: parsedFrequency.isPrn,
      ingredientA:
        safeText(medication.ingredientA).trim() ||
        safeText(medication.ingredient_a).trim() ||
        medicationName,
      ingredientB:
        safeText(medication.ingredientB).trim() ||
        safeText(medication.ingredient_b).trim() ||
        null,
    };

    setScheduleDoses((currentDoses) => {
      return [...currentDoses, newDose].map((dose) => {
        if (dose.medicationId !== medicationId) {
          return dose;
        }

        return {
          ...dose,
          totalDailyDoses: targetDoseCount,
        };
      });
    });
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
          Set dose times before saving the scanned prescription.
        </Text>

        <View style={styles.connectedCard}>
          <View style={styles.connectedIcon}>
            <Ionicons name="cloud-upload" size={18} color="#2563eb" />
          </View>

          <View style={styles.connectedTextBox}>
            <Text style={styles.connectedTitle}>Secure Save Ready</Text>
            <Text style={styles.connectedText}>
              Saving this schedule will store the medication doses securely and
              keep a local copy for quick loading.
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
              <Text style={styles.summaryLabel}>Saved</Text>
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
                <Text style={styles.medicationName}>
                  {safeText(dose.medicationName).trim() ||
                    `Medication ${index + 1}`}
                </Text>
                <Text style={styles.medicationDosage}>
                  {safeText(dose.dosage).trim() || "No dosage"}
                </Text>
                <Text style={styles.doseScheduleMeta}>
                  {dose.isPrn
                    ? "As-needed dose"
                    : `Dose ${dose.doseIndex ?? index + 1} of ${
                        dose.totalDailyDoses ?? 1
                      } today`}
                  {safeText(dose.frequency).trim()
                    ? ` - ${safeText(dose.frequency).trim()}`
                    : ""}
                  {safeText(dose.duration).trim()
                    ? ` for ${safeText(dose.duration).trim()}`
                    : ""}
                </Text>
              </View>

              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Pending</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Dose Time</Text>
            <TextInput
              style={styles.input}
              value={safeText(dose.time)}
              onChangeText={(value) => updateDoseField(dose.id, "time", value)}
              placeholder="Example: 08:00 AM"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Instruction</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={safeText(dose.instruction)}
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

              {parsedMedications.map((medication, index) => (
                <Pressable
                  key={`${medication.id}-${index}`}
                  style={styles.extraDoseButton}
                  onPress={() => addExtraDose(medication)}
                >
                  <Ionicons name="add-circle" size={18} color="#2563eb" />
                  <Text style={styles.extraDoseButtonText}>
                    Add dose for {getMedicationName(medication)}
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
            {isSaving ? "Saving..." : "Save Schedule"}
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
  doseScheduleMeta: {
    fontSize: 12.4,
    color: "#94a3b8",
    fontWeight: "800",
    lineHeight: 17,
    marginTop: 3,
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
