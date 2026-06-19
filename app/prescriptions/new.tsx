import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
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

type UploadSource = "camera" | "library";

type UploadMeta = {
  source: UploadSource;
  uri: string;
};

export default function NewPrescriptionScreen() {
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<UploadMeta | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);

  const openCamera = async () => {
    try {
      setIsPickingImage(true);

      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please allow camera access to scan a prescription.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const uri = result.assets[0].uri;

      setSelectedImageUri(uri);
      setUploadMeta({
        source: "camera",
        uri,
      });
    } catch (error) {
      Alert.alert(
        "Camera Error",
        error instanceof Error
          ? error.message
          : "Unable to open camera. If you are using the simulator, use Upload Prescription instead. If you are using a real iPhone, check camera permission.",
      );
    } finally {
      setIsPickingImage(false);
    }
  };

  const openImageLibrary = async () => {
    try {
      setIsPickingImage(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo Permission Required",
          "Please allow photo library access to upload a prescription image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const uri = result.assets[0].uri;

      setSelectedImageUri(uri);
      setUploadMeta({
        source: "library",
        uri,
      });
    } catch (error) {
      Alert.alert(
        "Upload Error",
        error instanceof Error
          ? error.message
          : "Unable to upload image. Please try again.",
      );
    } finally {
      setIsPickingImage(false);
    }
  };

  const startProcessing = () => {
    if (!uploadMeta || !selectedImageUri) {
      Alert.alert(
        "No Prescription Selected",
        "Please capture or upload a prescription image first.",
      );
      return;
    }

    router.push({
      pathname: "/prescriptions/[id]/processing",
      params: {
        id: "new",
        imageUri: uploadMeta.uri,
        source: uploadMeta.source,
      },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="#0f172a" />
      </Pressable>

      <Text style={styles.title}>New Prescription</Text>

      <Text style={styles.subtitle}>
        Capture or upload a prescription image to start the review and schedule
        flow.
      </Text>

      <View style={styles.infoCard}>
        <View style={styles.infoIconCircle}>
          <Ionicons name="information-circle" size={18} color="#2563eb" />
        </View>

        <View style={styles.infoTextBox}>
          <Text style={styles.infoTitle}>Scanner Connected</Text>
          <Text style={styles.infoText}>
            This scanner is connected to the MEDCO prescription flow. After
            uploading, the app will continue to extraction, review, and
            scheduling.
          </Text>
        </View>
      </View>

      <View style={styles.realPhoneCard}>
        <View style={styles.realPhoneIconCircle}>
          <Ionicons name="phone-portrait-outline" size={17} color="#166534" />
        </View>

        <View style={styles.infoTextBox}>
          <Text style={styles.realPhoneTitle}>Camera Ready</Text>
          <Text style={styles.realPhoneText}>
            On a real iPhone, you can use the camera. On the iOS simulator, use
            Upload Prescription instead.
          </Text>
        </View>
      </View>

      <View style={styles.uploadCard}>
        <View style={styles.uploadIconCircle}>
          {selectedImageUri ? (
            <Image source={{ uri: selectedImageUri }} style={styles.preview} />
          ) : (
            <Ionicons name="document-text" size={34} color="#2563eb" />
          )}
        </View>

        <Text style={styles.uploadTitle}>Prescription Image</Text>

        <Text style={styles.uploadSubtitle}>
          Take a clear photo or choose an image from your library.
        </Text>

        <Pressable
          style={styles.cameraButton}
          onPress={openCamera}
          disabled={isPickingImage}
        >
          {isPickingImage ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="camera" size={18} color="#ffffff" />
              <Text style={styles.cameraButtonText}>
                Capture Prescription Photo
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={styles.libraryButton}
          onPress={openImageLibrary}
          disabled={isPickingImage}
        >
          <Ionicons name="image" size={18} color="#2563eb" />
          <Text style={styles.libraryButtonText}>Upload Prescription</Text>
        </Pressable>
      </View>

      {selectedImageUri && uploadMeta && (
        <View style={styles.selectedCard}>
          <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
          <View style={styles.selectedTextBox}>
            <Text style={styles.selectedTitle}>Prescription Selected</Text>
            <Text style={styles.selectedText}>
              Source:{" "}
              {uploadMeta.source === "camera"
                ? "Camera Capture"
                : "Photo Library"}
            </Text>
          </View>
        </View>
      )}

      <Pressable
        style={[
          styles.startButton,
          !selectedImageUri && styles.startButtonDisabled,
        ]}
        onPress={startProcessing}
      >
        <Ionicons name="scan" size={18} color="#ffffff" />
        <Text style={styles.startButtonText}>Start Processing</Text>
      </Pressable>

      <View style={styles.workflowCard}>
        <Text style={styles.workflowTitle}>How MEDCO Scan Works</Text>

        <View style={styles.workflowStep}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <Text style={styles.stepText}>
            Upload or capture the prescription image.
          </Text>
        </View>

        <View style={styles.workflowStep}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={styles.stepText}>
            MEDCO extracts medication details from the image.
          </Text>
        </View>

        <View style={styles.workflowStep}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={styles.stepText}>
            Review the extracted data and create a schedule.
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
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#dbeafe",
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  infoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  infoTextBox: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1e3a8a",
    marginBottom: 3,
  },
  infoText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#1e40af",
    fontWeight: "600",
  },
  realPhoneCard: {
    flexDirection: "row",
    backgroundColor: "#dcfce7",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  realPhoneIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  realPhoneTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#166534",
    marginBottom: 3,
  },
  realPhoneText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#166534",
    fontWeight: "600",
  },
  uploadCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  uploadIconCircle: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    overflow: "hidden",
  },
  preview: {
    width: 94,
    height: 94,
    borderRadius: 47,
  },
  uploadTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 6,
  },
  uploadSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  cameraButton: {
    width: "100%",
    height: 52,
    borderRadius: 15,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginBottom: 10,
  },
  cameraButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#ffffff",
  },
  libraryButton: {
    width: "100%",
    height: 50,
    borderRadius: 15,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  libraryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2563eb",
  },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  selectedTextBox: {
    marginLeft: 10,
    flex: 1,
  },
  selectedTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#166534",
  },
  selectedText: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "600",
    marginTop: 2,
  },
  startButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginBottom: 14,
  },
  startButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
  },
  workflowCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  workflowTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 14,
  },
  workflowStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ffffff",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
    fontWeight: "600",
  },
  bottomSpace: {
    height: 36,
  },
});
