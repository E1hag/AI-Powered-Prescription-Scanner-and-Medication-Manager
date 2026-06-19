import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

export default function ScanScreen() {
  const openCameraScanner = () => {
    router.push({
      pathname: "/prescriptions/new",
      params: {
        source: "camera",
      },
    });
  };

  const openUploadScanner = () => {
    router.push({
      pathname: "/prescriptions/new",
      params: {
        source: "library",
      },
    });
  };

  const openSampleReview = () => {
    router.push({
      pathname: "/prescriptions/sample-review",
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Prescription Scanner</Text>

        <Text style={styles.subtitle}>
          Choose whether you want to scan a physical prescription using your
          phone camera or upload an existing prescription image from your
          library.
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#2563eb" />

        <Text style={styles.infoText}>
          This scanner is connected to the MEDCO prescription flow. After
          scanning or uploading, the app will continue to extraction, review,
          and medication scheduling.
        </Text>
      </View>

      <View style={styles.scanCard}>
        <View style={styles.scanIconCircle}>
          <Ionicons name="scan" size={40} color="#2563eb" />
        </View>

        <Text style={styles.cardTitle}>Scan Prescription</Text>

        <Text style={styles.cardSubtitle}>
          Select how you want to provide the prescription image.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressedButton,
          ]}
          onPress={openCameraScanner}
        >
          <Ionicons name="camera" size={22} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Use Camera</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.darkButton,
            pressed && styles.pressedButton,
          ]}
          onPress={openUploadScanner}
        >
          <Ionicons name="image" size={22} color="#ffffff" />
          <Text style={styles.darkButtonText}>Upload Prescription</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.sampleButton,
            pressed && styles.pressedButton,
          ]}
          onPress={openSampleReview}
        >
          <Ionicons name="document-text" size={21} color="#2563eb" />
          <Text style={styles.sampleButtonText}>Open Sample Review</Text>
        </Pressable>
      </View>

      <View style={styles.workflowCard}>
        <Text style={styles.workflowTitle}>MEDCO Scan Workflow</Text>

        <View style={styles.workflowStep}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <Text style={styles.stepText}>
            Choose camera scan or upload from library
          </Text>
        </View>

        <View style={styles.workflowStep}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={styles.stepText}>Process prescription information</Text>
        </View>

        <View style={styles.workflowStep}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={styles.stepText}>
            Review extracted medication details
          </Text>
        </View>

        <View style={styles.workflowStep}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>4</Text>
          </View>
          <Text style={styles.stepText}>
            Create medication schedule from reviewed data
          </Text>
        </View>
      </View>

      <View style={styles.warningCard}>
        <Ionicons name="shield-checkmark" size={24} color="#16a34a" />
        <View style={styles.warningTextBox}>
          <Text style={styles.warningTitle}>Privacy Reminder</Text>
          <Text style={styles.warningText}>
            Prescription images should only be used for project testing and
            should not be shared publicly.
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
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 74 : 42,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 22,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "500",
    color: "#748197",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#dbeafe",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  scanCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    paddingVertical: 34,
    paddingHorizontal: 22,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 3,
  },
  scanIconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    marginTop: 12,
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#748197",
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    height: 58,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#ffffff",
  },
  darkButton: {
    width: "100%",
    height: 58,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  darkButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#ffffff",
  },
  sampleButton: {
    width: "100%",
    height: 56,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sampleButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2563eb",
  },
  workflowCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },
  workflowTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  workflowStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
    color: "#475569",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: "#f0fdf4",
    borderRadius: 24,
    padding: 18,
  },
  warningTextBox: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#166534",
  },
  warningText: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: "#64748b",
  },
  pressedButton: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  bottomSpace: {
    height: 40,
  },
});
