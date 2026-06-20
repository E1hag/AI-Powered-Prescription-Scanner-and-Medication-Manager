import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  checkDrugInteractions,
  DrugInteractionRecord,
} from "@/src/features/prescriptions/utils/drug-interactions";
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

type CheckedMedication = {
  medicationId: string;
  medicationName: string;
  ingredients: string[];
};

const emptySchedule: MedicationSchedule = {
  id: "",
  createdAt: new Date().toISOString(),
  doses: [],
};

function getDoseIngredients(dose: MedicationDose) {
  const ingredients = [dose.ingredientA, dose.ingredientB]
    .map((ingredient) => ingredient?.trim())
    .filter((ingredient): ingredient is string => Boolean(ingredient));

  if (ingredients.length > 0) {
    return ingredients;
  }

  return dose.medicationName.trim() ? [dose.medicationName.trim()] : [];
}

function getSeverityColor(severity: DrugInteractionRecord["severity"]) {
  if (severity === "Severe") {
    return {
      background: "#fee2e2",
      text: "#b91c1c",
      icon: "#dc2626",
    };
  }

  if (severity === "Moderate") {
    return {
      background: "#fef3c7",
      text: "#92400e",
      icon: "#f59e0b",
    };
  }

  return {
    background: "#dbeafe",
    text: "#1d4ed8",
    icon: "#2563eb",
  };
}

export default function DrugInteractionsScreen() {
  const [schedule, setSchedule] = useState<MedicationSchedule>(emptySchedule);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<DrugInteractionRecord[]>([]);
  const [masterInteractionCount, setMasterInteractionCount] = useState(0);
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  const cacheScheduleLocally = useCallback(async (latestSchedule: MedicationSchedule) => {
    const localSchedule: StoredMedicationSchedule = {
      id: latestSchedule.id,
      createdAt: latestSchedule.createdAt,
      doses: latestSchedule.doses,
    };

    await AsyncStorage.setItem(
      MEDCO_SCHEDULE_STORAGE_KEY,
      JSON.stringify(localSchedule),
    );
  }, []);

  const loadLocalBackup = useCallback(async (): Promise<MedicationSchedule | null> => {
    const savedScheduleRaw = await AsyncStorage.getItem(
      MEDCO_SCHEDULE_STORAGE_KEY,
    );

    if (!savedScheduleRaw) {
      setSchedule(emptySchedule);
      setLoadedFromCache(false);
      return null;
    }

    const savedSchedule = JSON.parse(
      savedScheduleRaw,
    ) as StoredMedicationSchedule;

    if (!Array.isArray(savedSchedule.doses)) {
      setSchedule(emptySchedule);
      setLoadedFromCache(false);
      return null;
    }

    const backupSchedule = {
      id: savedSchedule.id,
      createdAt: savedSchedule.createdAt,
      doses: savedSchedule.doses,
    };

    setSchedule(backupSchedule);
    setLoadedFromCache(true);

    return backupSchedule;
  }, []);

  const checkInteractionsForDoses = useCallback(async (doses: MedicationDose[]) => {
    try {
      setInteractionError(null);

      const ingredients = doses.flatMap(getDoseIngredients);
      const result = await checkDrugInteractions(ingredients);

      setInteractions(result.interactions);
      setMasterInteractionCount(result.masterInteractionCount);
    } catch (error) {
      setInteractions([]);
      setMasterInteractionCount(0);
      setInteractionError(
        error instanceof Error
          ? error.message
          : "Unable to read the drug interaction master list.",
      );
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      setInteractionError(null);
      setLoadedFromCache(false);

      const latestSchedule = await getLatestMedicationScheduleFromSupabase();

      if (!latestSchedule) {
        setSchedule(emptySchedule);
        setInteractions([]);
        setMasterInteractionCount(0);
        setLoadedFromCache(false);
        return;
      }

      setSchedule(latestSchedule);
      await cacheScheduleLocally(latestSchedule);
      await checkInteractionsForDoses(latestSchedule.doses);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load saved medications.";

      setLoadError(message);

      try {
        const backupSchedule = await loadLocalBackup();

        if (backupSchedule) {
          await checkInteractionsForDoses(backupSchedule.doses);
        } else {
          setInteractions([]);
          setMasterInteractionCount(0);
        }
      } catch {
        setSchedule(emptySchedule);
        setInteractions([]);
        setMasterInteractionCount(0);
        setLoadedFromCache(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [cacheScheduleLocally, checkInteractionsForDoses, loadLocalBackup]);

  useFocusEffect(
    useCallback(() => {
      loadSchedule();
    }, [loadSchedule]),
  );

  const checkedMedications = useMemo(() => {
    const grouped = new Map<string, CheckedMedication>();

    schedule.doses.forEach((dose) => {
      const ingredients = getDoseIngredients(dose);
      const existing = grouped.get(dose.medicationId);

      if (existing) {
        ingredients.forEach((ingredient) => {
          if (!existing.ingredients.includes(ingredient)) {
            existing.ingredients.push(ingredient);
          }
        });
        return;
      }

      grouped.set(dose.medicationId, {
        medicationId: dose.medicationId,
        medicationName: dose.medicationName,
        ingredients,
      });
    });

    return Array.from(grouped.values());
  }, [schedule.doses]);

  const checkedIngredients = useMemo(() => {
    return checkedMedications.flatMap((medication) => medication.ingredients);
  }, [checkedMedications]);

  const goBack = () => {
    router.back();
  };

  const goToScanner = () => {
    router.push("/prescriptions/new");
  };

  const refreshInteractions = () => {
    loadSchedule();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>
          Recalculating drug interactions...
        </Text>
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

        <Pressable style={styles.refreshButton} onPress={refreshInteractions}>
          <Ionicons name="refresh" size={17} color="#2563eb" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Drug Interactions</Text>

      <Text style={styles.subtitle}>
        Recalculates possible interactions from your saved medicines using the
        live interaction master list.
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

      {interactionError && (
        <View style={styles.warningCard}>
          <Ionicons name="alert-circle" size={22} color="#dc2626" />
          <Text style={styles.warningText}>
            Interaction check unavailable: {interactionError}
          </Text>
        </View>
      )}

      {!schedule.id && (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="git-compare" size={38} color="#2563eb" />
          </View>

          <Text style={styles.emptyTitle}>No Saved Medicines Yet</Text>
          <Text style={styles.emptyText}>
            Scan a prescription, review the extracted ingredients, and save a
            schedule before checking interactions.
          </Text>

          <Pressable style={styles.primaryButton} onPress={goToScanner}>
            <Ionicons name="scan" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Scan Prescription</Text>
          </Pressable>
        </View>
      )}

      {schedule.id && (
        <>
          <View
            style={[
              styles.summaryCard,
              (interactionError || interactions.length > 0) &&
                styles.summaryWarningCard,
            ]}
          >
            <View
              style={[
                styles.summaryIconCircle,
                (interactionError || interactions.length > 0) &&
                  styles.summaryWarningIconCircle,
              ]}
            >
              <Ionicons
                name={
                  interactionError || interactions.length > 0
                    ? "warning"
                    : "shield-checkmark"
                }
                size={32}
                color={
                  interactionError || interactions.length > 0
                    ? "#f59e0b"
                    : "#16a34a"
                }
              />
            </View>

            <View style={styles.summaryTextBox}>
              <Text style={styles.summaryTitle}>
                {interactionError
                  ? "Interaction Check Unavailable"
                  : interactions.length > 0
                    ? `${interactions.length} Interaction${
                        interactions.length === 1 ? "" : "s"
                      } Found`
                  : "No Known Interactions Found"}
              </Text>
              <Text style={styles.summaryText}>
                Checked {checkedIngredients.length} ingredient
                {checkedIngredients.length === 1 ? "" : "s"} from{" "}
                {checkedMedications.length} saved medicine
                {checkedMedications.length === 1 ? "" : "s"} against{" "}
                {masterInteractionCount} master interaction
                {masterInteractionCount === 1 ? "" : "s"}.
              </Text>
            </View>
          </View>

          {interactions.length > 0 ? (
            <View style={styles.interactionsList}>
              {interactions.map((interaction) => {
                const severityStyle = getSeverityColor(interaction.severity);

                return (
                  <View
                    key={`${interaction.drugA}-${interaction.drugB}`}
                    style={styles.interactionCard}
                  >
                    <View style={styles.interactionHeader}>
                      <View
                        style={[
                          styles.interactionIconCircle,
                          {
                            backgroundColor: severityStyle.background,
                          },
                        ]}
                      >
                        <Ionicons
                          name="alert-circle"
                          size={24}
                          color={severityStyle.icon}
                        />
                      </View>

                      <View style={styles.interactionHeaderText}>
                        <Text style={styles.interactionTitle}>
                          {interaction.drugA} + {interaction.drugB}
                        </Text>
                        <View
                          style={[
                            styles.severityBadge,
                            {
                              backgroundColor: severityStyle.background,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.severityText,
                              {
                                color: severityStyle.text,
                              },
                            ]}
                          >
                            {interaction.severity}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.interactionDescription}>
                      {interaction.description}
                    </Text>

                    <View style={styles.recommendationBox}>
                      <Text style={styles.recommendationLabel}>
                        Recommendation
                      </Text>
                      <Text style={styles.recommendationText}>
                        {interaction.recommendation}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : !interactionError ? (
            <View style={styles.noInteractionCard}>
              <Ionicons name="checkmark-circle" size={30} color="#16a34a" />
              <Text style={styles.noInteractionTitle}>All Clear</Text>
              <Text style={styles.noInteractionText}>
                No matches were found in the interaction master list for the
                saved medicines.
              </Text>
            </View>
          ) : null}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Checked Medicines</Text>
          </View>

          <View style={styles.medicationsCard}>
            {checkedMedications.map((medication) => (
              <View key={medication.medicationId} style={styles.medicationRow}>
                <View style={styles.medicationIconCircle}>
                  <Ionicons name="medical" size={20} color="#2563eb" />
                </View>

                <View style={styles.medicationTextBox}>
                  <Text style={styles.medicationName}>
                    {medication.medicationName}
                  </Text>
                  <Text style={styles.medicationMeta}>
                    {medication.ingredients.join(", ") ||
                      "No ingredient available"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={styles.noteCard}>
        <Ionicons name="information-circle" size={20} color="#2563eb" />
        <Text style={styles.noteText}>
          This is a basic safety check from the saved interaction master list.
          Always confirm medication safety with a doctor or pharmacist.
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
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#64748b",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 18,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
  },
  summaryCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 16,
  },
  summaryWarningCard: {
    backgroundColor: "#fff7ed",
  },
  summaryIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryWarningIconCircle: {
    backgroundColor: "#fef3c7",
  },
  summaryTextBox: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 5,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
    fontWeight: "700",
  },
  interactionsList: {
    gap: 12,
    marginBottom: 18,
  },
  interactionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 15,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  interactionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 12,
  },
  interactionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  interactionHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  interactionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 7,
  },
  severityBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  severityText: {
    fontSize: 12,
    fontWeight: "900",
  },
  interactionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
    fontWeight: "700",
    marginBottom: 12,
  },
  recommendationBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 12,
  },
  recommendationLabel: {
    fontSize: 12.5,
    color: "#2563eb",
    fontWeight: "900",
    marginBottom: 5,
  },
  recommendationText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#475569",
    fontWeight: "700",
  },
  noInteractionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    marginBottom: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  noInteractionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginTop: 9,
    marginBottom: 6,
  },
  noInteractionText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
    fontWeight: "700",
    textAlign: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
  },
  medicationsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  medicationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
  },
  medicationIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  medicationTextBox: {
    flex: 1,
    minWidth: 0,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  medicationMeta: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "#64748b",
    fontWeight: "700",
  },
  noteCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  noteText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#1e40af",
    fontWeight: "700",
  },
  bottomSpace: {
    height: 30,
  },
});
