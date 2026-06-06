import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthSession } from '@/src/features/auth/hooks/use-auth-session';
import { prescriptionService } from '@/src/features/prescriptions/services/prescription-service';
import { storageService } from '@/src/features/prescriptions/services/storage-service';

export default function NewPrescriptionScreen() {
  const { isConfigured, isLoading, user } = useAuthSession();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<{
    source: 'supabase' | 'local';
    captureSource: 'camera' | 'gallery';
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePickFromLibrary() {
    if (isConfigured && !isLoading && !user) {
      setError('Sign in first so the image and schedule save to your real Supabase project.');
      router.push('/auth/sign-in');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Photo library permission is required to upload a prescription image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    await createDraftAndUpload(result.assets[0], 'gallery');
  }

  async function handleCapturePhoto() {
    if (isConfigured && !isLoading && !user) {
      setError('Sign in first so the image and schedule save to your real Supabase project.');
      router.push('/auth/sign-in');
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setError('Camera permission is required to capture a prescription image.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    await createDraftAndUpload(result.assets[0], 'camera');
  }

  async function createDraftAndUpload(
    asset: ImagePicker.ImagePickerAsset,
    captureSource: 'camera' | 'gallery'
  ) {
    setIsSubmitting(true);
    setError(null);

    try {
      const draft = await prescriptionService.createDraft();
      const uploadedImage = await storageService.uploadPrescriptionImage({
        prescriptionId: draft.id,
        asset,
        captureSource,
      });

      setSelectedImageUri(asset.uri);
      setUploadMeta({
        source: uploadedImage.source,
        captureSource: uploadedImage.captureSource,
      });

      router.push(`/prescriptions/${draft.id}/processing`);
    } catch {
      setError('Unable to create the prescription draft and upload the image.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">New Prescription</ThemedText>
        <ThemedText>
          Capture or upload a prescription image to start the review and schedule flow.
        </ThemedText>
      </View>

      {isConfigured && !isLoading && !user ? (
        <View style={styles.warningCard}>
          <ThemedText type="defaultSemiBold">Sign in required for backend save</ThemedText>
          <ThemedText>
            Supabase is configured, but there is no active signed-in user. Sign in first so this
            flow uses the real backend instead of the local fallback.
          </ThemedText>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/auth/sign-in')}>
            <ThemedText type="defaultSemiBold">Open Sign In</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {isConfigured && isLoading ? (
        <View style={styles.previewCard}>
          <ThemedText type="defaultSemiBold">Checking your saved session…</ThemedText>
          <ThemedText>
            If you were already signed in, the prescription flow will continue once the session is
            restored.
          </ThemedText>
        </View>
      ) : null}

      <Pressable
        style={[
          styles.primaryButton,
          (isConfigured && !isLoading && !user) || isLoading ? styles.buttonDisabled : undefined,
        ]}
        onPress={handleCapturePhoto}
        disabled={isSubmitting || (isConfigured && !isLoading && !user) || isLoading}>
        <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
          {isSubmitting ? 'Preparing upload…' : 'Capture Prescription Photo'}
        </ThemedText>
      </Pressable>

      <Pressable
        style={[
          styles.secondaryButton,
          (isConfigured && !isLoading && !user) || isLoading ? styles.buttonDisabled : undefined,
        ]}
        onPress={handlePickFromLibrary}
        disabled={isSubmitting || (isConfigured && !isLoading && !user) || isLoading}>
        <ThemedText type="defaultSemiBold">Choose From Library</ThemedText>
      </Pressable>

      {selectedImageUri ? (
        <View style={styles.previewCard}>
          <ThemedText type="subtitle">Selected image</ThemedText>
          <Image source={{ uri: selectedImageUri }} style={styles.previewImage} contentFit="cover" />
          <ThemedText>{uploadMeta?.captureSource === 'camera' ? 'Captured with camera' : 'Chosen from library'}</ThemedText>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <ThemedText>{error}</ThemedText>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 20,
    padding: 20,
  },
  header: {
    gap: 10,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#3A7A57',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(58, 122, 87, 0.12)',
  },
  previewCard: {
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(24, 46, 34, 0.08)',
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#D7E6DA',
  },
  errorCard: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(163, 62, 43, 0.12)',
  },
  warningCard: {
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(163, 62, 43, 0.12)',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
