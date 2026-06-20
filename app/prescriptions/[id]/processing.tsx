import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { prescriptionService } from "@/src/features/prescriptions/services/prescription-service";

type ProcessingStepStatus = "waiting" | "active" | "done" | "error";

type ProcessingStep = {
  id: number;
  title: string;
  description: string;
  status: ProcessingStepStatus;
};

function getProcessingErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    const parts = [
      errorRecord.message,
      errorRecord.details,
      errorRecord.hint,
      errorRecord.code,
    ].filter((part): part is string => {
      return typeof part === "string" && part.trim().length > 0;
    });

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Unable to process the prescription. Please try again.";
}

export default function ProcessingPrescriptionScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    imageUri?: string;
    source?: string;
  }>();

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

  const [isProcessing, setIsProcessing] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);

  const [steps, setSteps] = useState<ProcessingStep[]>([
    {
      id: 1,
      title: "Preparing Image",
      description: "Checking the uploaded prescription image.",
      status: "active",
    },
    {
      id: 2,
      title: "Extracting Text",
      description: "Reading medicine names, dosages, and instructions.",
      status: "waiting",
    },
    {
      id: 3,
      title: "Detecting Medications",
      description: "Finding medication ingredients and dosage details.",
      status: "waiting",
    },
    {
      id: 4,
      title: "Preparing Review",
      description: "Sending extracted data to the review screen.",
      status: "waiting",
    },
  ]);

  const updateStepStatus = (stepId: number, status: ProcessingStepStatus) => {
    setSteps((currentSteps) =>
      currentSteps.map((step) => {
        if (step.id === stepId) {
          return {
            ...step,
            status,
          };
        }

        return step;
      }),
    );
  };

  const completeStepAndStartNext = (completedStepId: number) => {
    updateStepStatus(completedStepId, "done");

    if (completedStepId < 4) {
      updateStepStatus(completedStepId + 1, "active");
    }
  };

  const processPrescription = async () => {
    if (!imageUri) {
      setIsProcessing(false);
      setHasError(true);
      updateStepStatus(1, "error");

      Alert.alert(
        "Missing Image",
        "No prescription image was received. Please go back and upload the prescription again.",
      );

      return;
    }

    try {
      setIsProcessing(true);
      setHasError(false);
      setProgressPercent(0);

      await wait(500);
      setProgressPercent(25);
      completeStepAndStartNext(1);

      const reviewDraft = await prescriptionService.analyzePrescriptionImage({
        imageUri,
        source: source === "camera" ? "camera" : "library",
      });

      setProgressPercent(70);
      completeStepAndStartNext(2);

      await wait(300);
      setProgressPercent(90);
      completeStepAndStartNext(3);

      await wait(300);
      setProgressPercent(100);
      completeStepAndStartNext(4);

      await wait(500);

      const prescriptionId = reviewDraft.prescription?.id ?? "new";

      router.replace({
        pathname: "/prescriptions/[id]/review",
        params: {
          id: prescriptionId,
          imageUri,
          source,
          medications: JSON.stringify(reviewDraft.medications),
        },
      });
    } catch (error) {
      setIsProcessing(false);
      setHasError(true);

      setSteps((currentSteps) =>
        currentSteps.map((step) => {
          if (step.status === "active") {
            return {
              ...step,
              status: "error",
            };
          }

          return step;
        }),
      );

      Alert.alert(
        "Processing Failed",
        getProcessingErrorMessage(error),
      );
    }
  };

  const retryProcessing = () => {
    setSteps([
      {
        id: 1,
        title: "Preparing Image",
        description: "Checking the uploaded prescription image.",
        status: "active",
      },
      {
        id: 2,
        title: "Extracting Text",
        description: "Reading medicine names, dosages, and instructions.",
        status: "waiting",
      },
      {
        id: 3,
        title: "Detecting Medications",
        description: "Finding medication ingredients and dosage details.",
        status: "waiting",
      },
      {
        id: 4,
        title: "Preparing Review",
        description: "Sending extracted data to the review screen.",
        status: "waiting",
      },
    ]);

    processPrescription();
  };

  useEffect(() => {
    processPrescription();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="#0f172a" />
      </Pressable>

      <Text style={styles.title}>Processing</Text>

      <Text style={styles.subtitle}>
        MEDCO is extracting medication information from your prescription.
      </Text>

      <View style={styles.previewCard}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.emptyPreview}>
            <Ionicons name="document-text" size={38} color="#2563eb" />
          </View>
        )}

        <View style={styles.previewTextBox}>
          <Text style={styles.previewTitle}>Prescription Image</Text>
          <Text style={styles.previewText}>
            Source: {source === "camera" ? "Camera Capture" : "Photo Library"}
          </Text>
        </View>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.progressTitle}>
              {hasError ? "Processing Failed" : "Extracting Details"}
            </Text>
            <Text style={styles.progressSubtitle}>
              {hasError
                ? "Please retry the processing step."
                : "Please wait while MEDCO prepares the review screen."}
            </Text>
          </View>

          <View style={styles.progressCircle}>
            {isProcessing && !hasError ? (
              <ActivityIndicator color="#2563eb" />
            ) : hasError ? (
              <Ionicons name="close" size={24} color="#dc2626" />
            ) : (
              <Ionicons name="checkmark" size={24} color="#16a34a" />
            )}
          </View>
        </View>

        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
              },
            ]}
          />
        </View>

        <Text style={styles.progressPercent}>{progressPercent}% complete</Text>
      </View>

      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>Processing Steps</Text>

        {steps.map((step) => (
          <View key={step.id} style={styles.stepRow}>
            <View
              style={[
                styles.stepIcon,
                step.status === "active" && styles.stepIconActive,
                step.status === "done" && styles.stepIconDone,
                step.status === "error" && styles.stepIconError,
              ]}
            >
              {step.status === "done" ? (
                <Ionicons name="checkmark" size={17} color="#ffffff" />
              ) : step.status === "active" ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : step.status === "error" ? (
                <Ionicons name="close" size={17} color="#ffffff" />
              ) : (
                <Text style={styles.stepNumber}>{step.id}</Text>
              )}
            </View>

            <View style={styles.stepTextBox}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {hasError && (
        <Pressable style={styles.retryButton} onPress={retryProcessing}>
          <Ionicons name="refresh" size={18} color="#ffffff" />
          <Text style={styles.retryButtonText}>Retry Processing</Text>
        </Pressable>
      )}

      <View style={styles.noteCard}>
        <Ionicons name="information-circle" size={20} color="#2563eb" />
        <Text style={styles.noteText}>
          This step prepares extracted medication details for review. You can
          edit the results on the next screen before creating the schedule.
        </Text>
      </View>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

const styles = StyleSheet.create({
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
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  previewImage: {
    width: 78,
    height: 78,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
  },
  emptyPreview: {
    width: 78,
    height: 78,
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
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  previewText: {
    fontSize: 13.5,
    color: "#64748b",
    fontWeight: "600",
  },
  progressCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1e3a8a",
    marginBottom: 4,
  },
  progressSubtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "#1e40af",
    fontWeight: "600",
  },
  progressCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  progressBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#bfdbfe",
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e40af",
  },
  stepsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  stepsTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepIconActive: {
    backgroundColor: "#2563eb",
  },
  stepIconDone: {
    backgroundColor: "#16a34a",
  },
  stepIconError: {
    backgroundColor: "#dc2626",
  },
  stepNumber: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  stepTextBox: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  stepDescription: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "#64748b",
    fontWeight: "600",
  },
  retryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
  },
  noteCard: {
    backgroundColor: "#ffffff",
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
    color: "#475569",
    fontWeight: "600",
  },
  bottomSpace: {
    height: 34,
  },
});
