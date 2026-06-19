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
  TextInput,
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

type MedicalConditionProfile = {
  allergies: string;
  chronicConditions: string;
  notes: string;
};

type MedicationGroup = {
  medicationId: string;
  medicationName: string;
  dosage: string;
  instructions: string[];
};

const MEDCO_SCHEDULE_STORAGE_KEY = "MEDCO_MEDICATION_SCHEDULE";
const MEDCO_MEDICAL_CONDITIONS_KEY = "MEDCO_MEDICAL_CONDITIONS";

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

const defaultMedicalProfile: MedicalConditionProfile = {
  allergies: "",
  chronicConditions: "",
  notes: "",
};

export default function MedicalConditionsScreen() {
  const [doses, setDoses] = useState<ScheduleDose[]>(defaultDoses);
  const [hasSavedSchedule, setHasSavedSchedule] = useState(false);
  const [medicalProfile, setMedicalProfile] = useState<MedicalConditionProfile>(
    defaultMedicalProfile,
  );
  const [isSaving, setIsSaving] = useState(false);

  const loadMedicalData = async () => {
    try {
      const savedScheduleRaw = await AsyncStorage.getItem(
        MEDCO_SCHEDULE_STORAGE_KEY,
      );

      if (savedScheduleRaw) {
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
      } else {
        setDoses(defaultDoses);
        setHasSavedSchedule(false);
      }

      const savedProfileRaw = await AsyncStorage.getItem(
        MEDCO_MEDICAL_CONDITIONS_KEY,
      );

      if (savedProfileRaw) {
        const savedProfile = JSON.parse(
          savedProfileRaw,
        ) as MedicalConditionProfile;

        setMedicalProfile({
          allergies: savedProfile.allergies ?? "",
          chronicConditions: savedProfile.chronicConditions ?? "",
          notes: savedProfile.notes ?? "",
        });
      } else {
        setMedicalProfile(defaultMedicalProfile);
      }
    } catch {
      setDoses(defaultDoses);
      setHasSavedSchedule(false);
      setMedicalProfile(defaultMedicalProfile);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMedicalData();
    }, []),
  );

  const groupedMedications = useMemo(() => {
    const groupedMap = new Map<string, MedicationGroup>();

    doses.forEach((dose) => {
      const existingGroup = groupedMap.get(dose.medicationId);

      if (existingGroup) {
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
      });
    });

    return Array.from(groupedMap.values());
  }, [doses]);

  const safetySummary = useMemo(() => {
    const allergies = medicalProfile.allergies.trim().toLowerCase();
    const conditions = medicalProfile.chronicConditions.trim().toLowerCase();

    const warningItems: string[] = [];

    groupedMedications.forEach((medication) => {
      const medicationName = medication.medicationName.toLowerCase();

      if (allergies && medicationName.includes("amoxicillin")) {
        if (
          allergies.includes("penicillin") ||
          allergies.includes("amoxicillin")
        ) {
          warningItems.push(
            "Possible allergy concern: Amoxicillin may be unsafe if the patient has penicillin/amoxicillin allergy.",
          );
        }
      }

      if (
        conditions.includes("liver") &&
        medicationName.includes("paracetamol")
      ) {
        warningItems.push(
          "Possible condition concern: Paracetamol should be used carefully for patients with liver problems.",
        );
      }

      if (
        conditions.includes("kidney") &&
        medicationName.includes("ibuprofen")
      ) {
        warningItems.push(
          "Possible condition concern: Ibuprofen should be used carefully for patients with kidney problems.",
        );
      }
    });

    if (warningItems.length === 0) {
      return {
        status: "All Good",
        level: "Low",
        message:
          "No obvious local safety warning was detected from the saved profile and medication list.",
        warnings: [],
      };
    }

    return {
      status: "Review Needed",
      level: "Medium",
      message:
        "MEDCO found possible safety notes. Please review them carefully and confirm with a healthcare professional.",
      warnings: warningItems,
    };
  }, [groupedMedications, medicalProfile]);

  const updateMedicalField = (
    field: keyof MedicalConditionProfile,
    value: string,
  ) => {
    setMedicalProfile((currentProfile) => {
      return {
        ...currentProfile,
        [field]: value,
      };
    });
  };

  const saveMedicalProfile = async () => {
    try {
      setIsSaving(true);

      const cleanedProfile: MedicalConditionProfile = {
        allergies: medicalProfile.allergies.trim(),
        chronicConditions: medicalProfile.chronicConditions.trim(),
        notes: medicalProfile.notes.trim(),
      };

      await AsyncStorage.setItem(
        MEDCO_MEDICAL_CONDITIONS_KEY,
        JSON.stringify(cleanedProfile),
      );

      setMedicalProfile(cleanedProfile);

      Alert.alert(
        "Medical Profile Saved",
        "Your medical conditions and allergy notes have been saved locally.",
      );
    } catch {
      Alert.alert(
        "Save Failed",
        "Unable to save medical condition information. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const clearMedicalProfile = () => {
    Alert.alert(
      "Clear Medical Profile",
      "This will remove saved allergies, conditions, and safety notes from this device.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(MEDCO_MEDICAL_CONDITIONS_KEY);
            setMedicalProfile(defaultMedicalProfile);
          },
        },
      ],
    );
  };

  const goBack = () => {
    router.back();
  };

  const goToScanner = () => {
    router.push("/prescriptions/new");
  };

  const goToCurrentMedications = () => {
    router.push("/current-medications");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
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

      <Text style={styles.title}>Medical Conditions</Text>

      <Text style={styles.subtitle}>
        Save allergies and medical notes so MEDCO can show basic safety warnings
        for your scanned medications.
      </Text>

      {!hasSavedSchedule && (
        <View style={styles.demoCard}>
          <Ionicons name="information-circle" size={22} color="#2563eb" />
          <Text style={styles.demoText}>
            Demo medications are showing. Scan and save a prescription schedule
            to check safety against real saved medicines.
          </Text>
        </View>
      )}

      <View
        style={[
          styles.safetyCard,
          safetySummary.level === "Medium" && styles.warningSafetyCard,
        ]}
      >
        <View
          style={[
            styles.safetyIconCircle,
            safetySummary.level === "Medium" && styles.warningIconCircle,
          ]}
        >
          <Ionicons
            name={
              safetySummary.level === "Medium" ? "warning" : "shield-checkmark"
            }
            size={32}
            color={safetySummary.level === "Medium" ? "#f59e0b" : "#16a34a"}
          />
        </View>

        <View style={styles.safetyTextBox}>
          <Text style={styles.safetyStatus}>{safetySummary.status}</Text>
          <Text style={styles.safetyMessage}>{safetySummary.message}</Text>
        </View>
      </View>

      {safetySummary.warnings.length > 0 && (
        <View style={styles.warningListCard}>
          <Text style={styles.warningListTitle}>Safety Warnings</Text>

          {safetySummary.warnings.map((warning) => (
            <View key={warning} style={styles.warningItem}>
              <Ionicons name="alert-circle" size={18} color="#f59e0b" />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Saved Medications</Text>

        <Pressable
          style={styles.medicationsButton}
          onPress={goToCurrentMedications}
        >
          <Ionicons name="medical" size={16} color="#2563eb" />
          <Text style={styles.medicationsButtonText}>View</Text>
        </Pressable>
      </View>

      <View style={styles.medicationsCard}>
        {groupedMedications.map((medication) => (
          <View key={medication.medicationId} style={styles.medicationRow}>
            <View style={styles.medicationIcon}>
              <Ionicons name="medical" size={20} color="#16a34a" />
            </View>

            <View style={styles.medicationTextBox}>
              <Text style={styles.medicationName}>
                {medication.medicationName}
              </Text>
              <Text style={styles.medicationMeta}>
                {medication.dosage} • {medication.instructions.join(" • ")}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Allergy & Condition Profile</Text>

      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Known Allergies</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={medicalProfile.allergies}
          onChangeText={(value) => updateMedicalField("allergies", value)}
          placeholder="Example: Penicillin, Amoxicillin, Aspirin"
          placeholderTextColor="#94a3b8"
          multiline
        />

        <Text style={styles.inputLabel}>Chronic Conditions</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={medicalProfile.chronicConditions}
          onChangeText={(value) =>
            updateMedicalField("chronicConditions", value)
          }
          placeholder="Example: Diabetes, asthma, kidney disease, liver disease"
          placeholderTextColor="#94a3b8"
          multiline
        />

        <Text style={styles.inputLabel}>Additional Medical Notes</Text>
        <TextInput
          style={[styles.input, styles.largeMultilineInput]}
          value={medicalProfile.notes}
          onChangeText={(value) => updateMedicalField("notes", value)}
          placeholder="Example: Patient should avoid medicines that cause drowsiness."
          placeholderTextColor="#94a3b8"
          multiline
        />
      </View>

      <Pressable
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={saveMedicalProfile}
        disabled={isSaving}
      >
        <Ionicons name="save" size={19} color="#ffffff" />
        <Text style={styles.saveButtonText}>
          {isSaving ? "Saving..." : "Save Medical Profile"}
        </Text>
      </Pressable>

      <Pressable style={styles.clearButton} onPress={clearMedicalProfile}>
        <Text style={styles.clearButtonText}>Clear Medical Profile</Text>
      </Pressable>

      <View style={styles.noteCard}>
        <Ionicons name="information-circle" size={20} color="#2563eb" />
        <Text style={styles.noteText}>
          This prototype provides simple safety hints only. It does not replace
          medical advice from a doctor or pharmacist.
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
  safetyCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  warningSafetyCard: {
    backgroundColor: "#fef3c7",
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
  warningIconCircle: {
    backgroundColor: "#fde68a",
  },
  safetyTextBox: {
    flex: 1,
  },
  safetyStatus: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 5,
  },
  safetyMessage: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#475569",
    fontWeight: "700",
  },
  warningListCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 15,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  warningListTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 10,
  },
  warningItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 9,
  },
  warningText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    color: "#92400e",
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 12,
    marginTop: 6,
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
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  medicationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  medicationTextBox: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16.5,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  medicationMeta: {
    fontSize: 13.2,
    lineHeight: 19,
    color: "#64748b",
    fontWeight: "600",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#334155",
    marginBottom: 7,
    marginTop: 8,
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
    minHeight: 78,
    textAlignVertical: "top",
    lineHeight: 21,
  },
  largeMultilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
    lineHeight: 21,
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  saveButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  saveButtonText: {
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
    marginBottom: 10,
  },
  clearButtonText: {
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
