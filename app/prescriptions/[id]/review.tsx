import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { usePrescriptionDraft } from "@/src/features/prescriptions/hooks/use-prescription-draft";
import { prescriptionService } from "@/src/features/prescriptions/services/prescription-service";
import {
  DrugInteractionRecord,
  findAllDrugInteractions,
} from "@/src/features/prescriptions/utils/drug-interactions";

type MedicationConfidence = "High" | "Medium" | "Low";

type MedicationResult = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  ingredientA: string;
  ingredientB: string;
  confidence: MedicationConfidence;
};

function normalizeMedication(
  rawMedication: any,
  index: number,
): MedicationResult {
  return {
    id: String(rawMedication?.id ?? `med-${index + 1}`),

    name: String(
      rawMedication?.name ??
        rawMedication?.medicationName ??
        rawMedication?.medication_name ??
        "",
    ),

    dosage: String(
      rawMedication?.dosage ??
        rawMedication?.dosageText ??
        rawMedication?.dosage_text ??
        "",
    ),

    frequency: String(
      rawMedication?.frequency ??
        rawMedication?.frequencyText ??
        rawMedication?.frequency_text ??
        "",
    ),

    duration: String(
      rawMedication?.duration ??
        rawMedication?.durationText ??
        rawMedication?.duration_text ??
        "",
    ),

    instructions: String(
      rawMedication?.instructions ??
        rawMedication?.instruction ??
        rawMedication?.instructionText ??
        rawMedication?.instruction_text ??
        "",
    ),

    ingredientA: String(
      rawMedication?.ingredientA ??
        rawMedication?.ingredient_a ??
        rawMedication?.substanceA ??
        rawMedication?.substance_a ??
        "",
    ),

    ingredientB: String(
      rawMedication?.ingredientB ??
        rawMedication?.ingredient_b ??
        rawMedication?.substanceB ??
        rawMedication?.substance_b ??
        "",
    ),

    confidence:
      rawMedication?.confidence === "High" ||
      rawMedication?.confidence === "Medium" ||
      rawMedication?.confidence === "Low"
        ? rawMedication.confidence
        : "High",
  };
}

function capitalizeWord(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildInteractionAlertMessage(
  interactions: DrugInteractionRecord[],
): string {
  return interactions
    .map((interaction, index) => {
      return [
        `${index + 1}. ${capitalizeWord(interaction.drugA)} + ${capitalizeWord(interaction.drugB)}`,
        `Severity: ${interaction.severity}`,
        `Description: ${interaction.description}`,
        `Recommendation: ${interaction.recommendation}`,
      ].join("\n");
    })
    .join("\n\n");
}

function showDrugInteractionAlert(interactions: DrugInteractionRecord[]) {
  Alert.alert(
    interactions.length === 1
      ? "Drug Interaction Detected"
      : `${interactions.length} Drug Interactions Detected`,
    buildInteractionAlertMessage(interactions),
    [{ text: "Dismiss", style: "cancel" }],
  );
}

function getMedicationsFromParams(
  medicationsParam?: string,
): MedicationResult[] {
  if (typeof medicationsParam !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(medicationsParam);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, index) => normalizeMedication(item, index));
    }

    return [];
  } catch {
    return [];
  }
}

export default function ReviewPrescriptionScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    imageUri?: string;
    source?: string;
    medications?: string;
  }>();

  const prescriptionId = useMemo(() => {
    if (typeof params.id === "string" && params.id.trim().length > 0) {
      return params.id;
    }

    return "new";
  }, [params.id]);

  const imageUri = useMemo(() => {
    if (typeof params.imageUri === "string") {
      return params.imageUri;
    }

    return "";
  }, [params.imageUri]);

  const source = useMemo(() => {
    if (typeof params.source === "string") {
      return params.source;
    }

    return "library";
  }, [params.source]);

  const medicationsFromParams = useMemo(() => {
    return getMedicationsFromParams(params.medications);
  }, [params.medications]);

  const shouldLoadFromSupabase =
    medicationsFromParams.length === 0 && prescriptionId !== "new";

  const {
    data: reviewDraft,
    isLoading: isDraftLoading,
    error: draftError,
  } = usePrescriptionDraft(shouldLoadFromSupabase ? prescriptionId : "");

  const [medications, setMedications] = useState<MedicationResult[]>(
    medicationsFromParams.length > 0 ? medicationsFromParams : [],
  );

  const [isSaving, setIsSaving] = useState(false);

  const hasCheckedInteractionsRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    if (hasCheckedInteractionsRef.current) {
      return () => {
        isMounted = false;
      };
    }

    if (isDraftLoading || medications.length === 0) {
      return () => {
        isMounted = false;
      };
    }

    hasCheckedInteractionsRef.current = true;

    const checkInteractions = async () => {
      try {
        const allIngredients = medications.flatMap((medication) => [
          medication.ingredientA,
          medication.ingredientB,
        ]);

        const interactions = await findAllDrugInteractions(allIngredients);

        if (isMounted && interactions.length > 0) {
          showDrugInteractionAlert(interactions);
        }
      } catch (error) {
        console.log("Drug interaction check error:", error);
      }
    };

    checkInteractions();

    return () => {
      isMounted = false;
    };
  }, [medications, isDraftLoading]);

  useEffect(() => {
    if (medicationsFromParams.length > 0) {
      setMedications(medicationsFromParams);
      return;
    }

    if (!shouldLoadFromSupabase) {
      setMedications([]);
      return;
    }

    if (reviewDraft?.medications && reviewDraft.medications.length > 0) {
      const normalized = reviewDraft.medications.map((item, index) =>
        normalizeMedication(item, index),
      );

      setMedications(normalized);
    }
  }, [medicationsFromParams, reviewDraft, shouldLoadFromSupabase]);

  const updateMedicationField = (
    medicationId: string,
    field: keyof Omit<MedicationResult, "id" | "confidence">,
    value: string,
  ) => {
    setMedications((currentMedications) =>
      currentMedications.map((medication) => {
        if (medication.id === medicationId) {
          return {
            ...medication,
            [field]: value,
          };
        }

        return medication;
      }),
    );
  };

  const removeMedication = (medicationId: string) => {
    if (medications.length === 1) {
      Alert.alert(
        "Cannot Remove",
        "At least one medication must remain before creating a schedule.",
      );
      return;
    }

    setMedications((currentMedications) =>
      currentMedications.filter((medication) => medication.id !== medicationId),
    );
  };

  const addMedication = () => {
    const newMedication: MedicationResult = {
      id: `med-${Date.now()}`,
      name: "",
      dosage: "",
      frequency: "",
      duration: "",
      instructions: "",
      ingredientA: "",
      ingredientB: "",
      confidence: "Low",
    };

    setMedications((currentMedications) => [
      ...currentMedications,
      newMedication,
    ]);
  };

  const validateMedications = () => {
    const hasEmptyRequiredField = medications.some((medication) => {
      return (
        medication.name.trim().length === 0 ||
        medication.dosage.trim().length === 0 ||
        medication.frequency.trim().length === 0 ||
        medication.ingredientA.trim().length === 0
      );
    });

    if (hasEmptyRequiredField) {
      Alert.alert(
        "Missing Medication Details",
        "Please make sure every medication has a medicine name, dosage, frequency, and Ingredient A before continuing.",
      );

      return false;
    }

    return true;
  };

  const continueToSchedule = async () => {
    if (!validateMedications()) {
      return;
    }

    try {
      setIsSaving(true);

      const reviewedMedications = medications.map((medication) => ({
        id: medication.id,
        medicationName: medication.name.trim(),
        dosage: medication.dosage.trim(),
        frequency: medication.frequency.trim(),
        duration: medication.duration.trim(),
        instructions: medication.instructions.trim(),
        ingredientA: medication.ingredientA.trim(),
        ingredientB:
          medication.ingredientB.trim().length > 0
            ? medication.ingredientB.trim()
            : null,
        time: "08:00 AM",
      }));

      if (prescriptionId !== "new") {
        await prescriptionService.updatePrescription(prescriptionId, {
          status: "reviewed",
          extractedMedications: reviewedMedications,
        });
      }

      router.push({
        pathname: "/prescriptions/[id]/schedule",
        params: {
          id: prescriptionId,
          imageUri,
          source,
          medications: JSON.stringify(reviewedMedications),
        },
      });
    } catch (error) {
      console.log("Continue to schedule error:", error);

      Alert.alert(
        "Unable to Continue",
        "Something went wrong while saving the reviewed medication details.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getConfidenceStyle = (confidence: MedicationConfidence) => {
    if (confidence === "High") {
      return styles.highConfidenceBadge;
    }

    if (confidence === "Medium") {
      return styles.mediumConfidenceBadge;
    }

    return styles.lowConfidenceBadge;
  };

  const getConfidenceTextStyle = (confidence: MedicationConfidence) => {
    if (confidence === "High") {
      return styles.highConfidenceText;
    }

    if (confidence === "Medium") {
      return styles.mediumConfidenceText;
    }

    return styles.lowConfidenceText;
  };

  const isLoadingRealData = shouldLoadFromSupabase && isDraftLoading;

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
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>

        <Text style={styles.title}>Review Details</Text>

        <Text style={styles.subtitle}>
          Check the extracted medication information. You can edit anything
          before creating the schedule.
        </Text>

        <View style={styles.previewCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.emptyPreview}>
              <Ionicons name="document-text" size={32} color="#2563eb" />
            </View>
          )}

          <View style={styles.previewTextBox}>
            <Text style={styles.previewTitle}>Prescription Image</Text>
            <Text style={styles.previewText}>
              Source: {source === "camera" ? "Camera Capture" : "Photo Library"}
            </Text>
          </View>
        </View>

        {draftError ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning" size={18} color="#b45309" />
            <Text style={styles.errorText}>
              Could not load the extracted prescription details. Showing
              available local data.
            </Text>
          </View>
        ) : null}

        <View style={styles.noticeCard}>
          <View style={styles.noticeIcon}>
            <Ionicons name="create" size={18} color="#2563eb" />
          </View>

          <Text style={styles.noticeText}>
            Review carefully. OCR results can make mistakes, especially with
            handwriting or unclear images. Ingredient A and Ingredient B are
            used for drug interaction checking.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Extracted Medications</Text>

          <Pressable style={styles.addSmallButton} onPress={addMedication}>
            <Ionicons name="add" size={18} color="#2563eb" />
            <Text style={styles.addSmallButtonText}>Add</Text>
          </Pressable>
        </View>

        {isLoadingRealData ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>
              Loading extracted medications...
            </Text>
          </View>
        ) : null}

        {!isLoadingRealData && medications.length === 0 ? (
          <View style={styles.loadingCard}>
            <Ionicons name="document-text" size={28} color="#2563eb" />
            <Text style={styles.loadingText}>
              No extracted medications found for this prescription.
            </Text>
          </View>
        ) : null}

        {!isLoadingRealData &&
          medications.map((medication, index) => (
            <View key={medication.id} style={styles.medicationCard}>
              <View style={styles.medicationHeader}>
                <View>
                  <Text style={styles.medicationNumber}>
                    Medication {index + 1}
                  </Text>
                  <Text style={styles.medicationHint}>
                    Edit the fields if needed.
                  </Text>
                </View>

                <View style={styles.headerRight}>
                  <View
                    style={[
                      styles.confidenceBadge,
                      getConfidenceStyle(medication.confidence),
                    ]}
                  >
                    <Text
                      style={[
                        styles.confidenceText,
                        getConfidenceTextStyle(medication.confidence),
                      ]}
                    >
                      {medication.confidence}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => removeMedication(medication.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.inputLabel}>Medicine Name</Text>
              <TextInput
                style={styles.input}
                value={medication.name}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "name", value)
                }
                placeholder="Example: MAXIGESIC"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Ingredient A / Substance 1</Text>
              <TextInput
                style={styles.input}
                value={medication.ingredientA}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "ingredientA", value)
                }
                placeholder="Example: Ibuprofen"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>
                Ingredient B / Substance 2 Optional
              </Text>
              <TextInput
                style={styles.input}
                value={medication.ingredientB}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "ingredientB", value)
                }
                placeholder="Example: Paracetamol"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Dosage</Text>
              <TextInput
                style={styles.input}
                value={medication.dosage}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "dosage", value)
                }
                placeholder="Example: 500mg"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Frequency</Text>
              <TextInput
                style={styles.input}
                value={medication.frequency}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "frequency", value)
                }
                placeholder="Example: Twice daily"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Duration</Text>
              <TextInput
                style={styles.input}
                value={medication.duration}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "duration", value)
                }
                placeholder="Example: 7 days"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Instructions</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={medication.instructions}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "instructions", value)
                }
                placeholder="Example: Take after food"
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
          ))}

        <Pressable style={styles.addButton} onPress={addMedication}>
          <Ionicons name="add-circle" size={20} color="#2563eb" />
          <Text style={styles.addButtonText}>Add Another Medication</Text>
        </Pressable>

        <Pressable
          style={[
            styles.continueButton,
            isSaving && styles.continueButtonDisabled,
          ]}
          onPress={continueToSchedule}
          disabled={isSaving || isLoadingRealData}
        >
          <Ionicons name="calendar" size={19} color="#ffffff" />
          <Text style={styles.continueButtonText}>
            {isSaving
              ? "Saving Reviewed Details..."
              : "Continue to Medication Schedule"}
          </Text>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 31,
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
  previewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  previewImage: {
    width: 74,
    height: 74,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
  },
  emptyPreview: {
    width: 74,
    height: 74,
    borderRadius: 18,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  previewTextBox: {
    flex: 1,
    marginLeft: 12,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  previewText: {
    fontSize: 13.5,
    color: "#64748b",
    fontWeight: "600",
  },
  noticeCard: {
    flexDirection: "row",
    backgroundColor: "#fef3c7",
    borderRadius: 18,
    padding: 13,
    marginBottom: 18,
  },
  noticeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fde68a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#92400e",
    fontWeight: "600",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: "#92400e",
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
  },
  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    gap: 10,
  },
  loadingText: {
    color: "#64748b",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
  },
  addSmallButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 999,
    gap: 4,
  },
  addSmallButtonText: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "900",
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
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  medicationNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  medicationHint: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  confidenceBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  highConfidenceBadge: {
    backgroundColor: "#dcfce7",
  },
  mediumConfidenceBadge: {
    backgroundColor: "#fef3c7",
  },
  lowConfidenceBadge: {
    backgroundColor: "#fee2e2",
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "900",
  },
  highConfidenceText: {
    color: "#15803d",
  },
  mediumConfidenceText: {
    color: "#b45309",
  },
  lowConfidenceText: {
    color: "#dc2626",
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 6,
    marginTop: 9,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "600",
  },
  multilineInput: {
    minHeight: 76,
    textAlignVertical: "top",
    lineHeight: 21,
  },
  addButton: {
    height: 50,
    borderRadius: 15,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2563eb",
  },
  continueButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 14,
  },
  continueButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  continueButtonText: {
    fontSize: 15.5,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
  },
  bottomSpace: {
    height: 36,
  },
});
