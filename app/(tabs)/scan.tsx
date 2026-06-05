import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type ScanStatus = "idle" | "processing" | "completed";

type ExtractedMedication = {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  confidence: "High" | "Medium" | "Low";
};

const mockExtractedMedications: ExtractedMedication[] = [
  {
    id: 1,
    name: "Amoxicillin",
    dosage: "500mg",
    frequency: "Twice daily",
    duration: "7 days",
    confidence: "High",
  },
  {
    id: 2,
    name: "Paracetamol",
    dosage: "1000mg",
    frequency: "As needed",
    duration: "3 days",
    confidence: "Medium",
  },
  {
    id: 3,
    name: "Vitamin D",
    dosage: "1000 IU",
    frequency: "Once daily",
    duration: "30 days",
    confidence: "High",
  },
];

export default function ScanScreen() {
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [medications, setMedications] = useState<ExtractedMedication[]>([]);
  const [selectedSource, setSelectedSource] = useState<
    "camera" | "gallery" | null
  >(null);

  const startMockScan = (source: "camera" | "gallery") => {
    setSelectedSource(source);
    setScanStatus("processing");
    setMedications([]);

    setTimeout(() => {
      setMedications(mockExtractedMedications);
      setScanStatus("completed");
    }, 1800);
  };

  const updateMedicationField = (
    id: number,
    field: keyof Omit<ExtractedMedication, "id" | "confidence">,
    value: string,
  ) => {
    const updatedMedications = medications.map((medication) => {
      if (medication.id === id) {
        return {
          ...medication,
          [field]: value,
        };
      }

      return medication;
    });

    setMedications(updatedMedications);
  };

  const confirmExtractedData = () => {
    Alert.alert(
      "Prescription Verified",
      "The extracted medication information has been verified and is ready to be used for scheduling.",
    );
  };

  const resetScan = () => {
    setScanStatus("idle");
    setMedications([]);
    setSelectedSource(null);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Prescription Scanner</Text>

      <Text style={styles.pageSubtitle}>
        Capture or upload a prescription image, simulate OCR extraction, and
        verify medication details before scheduling.
      </Text>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={22} color="#1d4ed8" />
        <Text style={styles.infoText}>
          Prototype mode: this screen simulates OCR output using mock extracted
          medication data.
        </Text>
      </View>

      <View style={styles.uploadCard}>
        <View style={styles.uploadIconCircle}>
          <Ionicons name="document-text" size={42} color="#2563eb" />
        </View>

        <Text style={styles.uploadTitle}>Scan Prescription</Text>
        <Text style={styles.uploadSubtitle}>
          Choose a prescription image source to begin OCR processing.
        </Text>

        <View style={styles.sourceButtonRow}>
          <TouchableOpacity
            style={styles.sourceButton}
            onPress={() => startMockScan("camera")}
          >
            <Ionicons name="camera" size={20} color="#ffffff" />
            <Text style={styles.sourceButtonText}>Use Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sourceButton, styles.galleryButton]}
            onPress={() => startMockScan("gallery")}
          >
            <Ionicons name="image" size={20} color="#ffffff" />
            <Text style={styles.sourceButtonText}>Upload Image</Text>
          </TouchableOpacity>
        </View>
      </View>

      {selectedSource && (
        <View style={styles.sourceStatusBox}>
          <Text style={styles.sourceStatusText}>
            Selected source:{" "}
            <Text style={styles.sourceStatusValue}>
              {selectedSource === "camera"
                ? "Camera Capture"
                : "Gallery Upload"}
            </Text>
          </Text>
        </View>
      )}

      {scanStatus === "processing" && (
        <View style={styles.processingCard}>
          <Ionicons name="sync" size={32} color="#2563eb" />
          <Text style={styles.processingTitle}>Processing Prescription...</Text>
          <Text style={styles.processingText}>
            OCR is extracting medicine names, dosages, frequency, and duration.
          </Text>
        </View>
      )}

      {scanStatus === "completed" && (
        <>
          <View style={styles.resultHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Extracted Medication Details
              </Text>
              <Text style={styles.sectionSubtitle}>
                Review and edit the extracted fields before confirming.
              </Text>
            </View>

            <View style={styles.completedBadge}>
              <Text style={styles.completedBadgeText}>OCR Complete</Text>
            </View>
          </View>

          {medications.map((medication) => (
            <View key={medication.id} style={styles.medicationCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.medicationTitle}>
                  Medication {medication.id}
                </Text>

                <View
                  style={[
                    styles.confidenceBadge,
                    medication.confidence === "High" && styles.highConfidence,
                    medication.confidence === "Medium" &&
                      styles.mediumConfidence,
                    medication.confidence === "Low" && styles.lowConfidence,
                  ]}
                >
                  <Text style={styles.confidenceText}>
                    {medication.confidence} Confidence
                  </Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>Medicine Name</Text>
              <TextInput
                style={styles.input}
                value={medication.name}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "name", value)
                }
              />

              <Text style={styles.inputLabel}>Dosage</Text>
              <TextInput
                style={styles.input}
                value={medication.dosage}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "dosage", value)
                }
              />

              <Text style={styles.inputLabel}>Frequency</Text>
              <TextInput
                style={styles.input}
                value={medication.frequency}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "frequency", value)
                }
              />

              <Text style={styles.inputLabel}>Duration</Text>
              <TextInput
                style={styles.input}
                value={medication.duration}
                onChangeText={(value) =>
                  updateMedicationField(medication.id, "duration", value)
                }
              />
            </View>
          ))}

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={confirmExtractedData}
          >
            <Ionicons name="checkmark-circle" size={22} color="#ffffff" />
            <Text style={styles.confirmButtonText}>Confirm Extracted Data</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={resetScan}>
            <Text style={styles.resetButtonText}>
              Scan Another Prescription
            </Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.workflowCard}>
        <Text style={styles.sectionTitle}>MEDCO Scan Workflow</Text>

        <View style={styles.workflowStep}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>
            Capture or upload prescription image
          </Text>
        </View>

        <View style={styles.workflowStep}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>
            Run OCR and extract medication text
          </Text>
        </View>

        <View style={styles.workflowStep}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>
            Verify extracted medication fields
          </Text>
        </View>

        <View style={styles.workflowStep}>
          <Text style={styles.stepNumber}>4</Text>
          <Text style={styles.stepText}>
            Send verified data to schedule builder
          </Text>
        </View>
      </View>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 10,
  },
  pageSubtitle: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: "#dbeafe",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    color: "#1e3a8a",
    fontSize: 14,
    lineHeight: 20,
  },
  uploadCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  uploadIconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  uploadTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0f172a",
  },
  uploadSubtitle: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 20,
  },
  sourceButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  sourceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  galleryButton: {
    backgroundColor: "#0f172a",
  },
  sourceButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
  },
  sourceStatusBox: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  sourceStatusText: {
    color: "#475569",
    fontSize: 14,
  },
  sourceStatusValue: {
    color: "#0f172a",
    fontWeight: "bold",
  },
  processingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    marginBottom: 18,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 10,
  },
  processingText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  resultHeader: {
    marginTop: 8,
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
    lineHeight: 20,
  },
  completedBadge: {
    backgroundColor: "#dcfce7",
    alignSelf: "flex-start",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  completedBadgeText: {
    color: "#166534",
    fontWeight: "bold",
    fontSize: 12,
  },
  medicationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  medicationTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#0f172a",
  },
  confidenceBadge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  highConfidence: {
    backgroundColor: "#dcfce7",
  },
  mediumConfidence: {
    backgroundColor: "#fef3c7",
  },
  lowConfidence: {
    backgroundColor: "#fee2e2",
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0f172a",
  },
  inputLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#0f172a",
    fontSize: 15,
  },
  confirmButton: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  confirmButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
  resetButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  resetButtonText: {
    color: "#64748b",
    fontWeight: "bold",
  },
  workflowCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  workflowStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2563eb",
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 30,
    fontWeight: "bold",
  },
  stepText: {
    flex: 1,
    color: "#475569",
    fontSize: 14,
  },
  bottomSpace: {
    height: 40,
  },
});
