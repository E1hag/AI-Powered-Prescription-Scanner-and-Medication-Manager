import type { ImagePickerAsset } from 'expo-image-picker';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

const LOCAL_IMAGE_PREFIX = 'local-image://';

type UploadSource = 'camera' | 'gallery';

export type UploadedPrescriptionImage = {
  id: string;
  storagePath: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  captureSource: UploadSource;
  source: 'supabase' | 'local';
};

type LocalPrescriptionImageRecord = UploadedPrescriptionImage & {
  prescriptionId: string;
  localUri: string;
  createdAt: string;
};

const localImageStore = new Map<string, LocalPrescriptionImageRecord[]>();

function createUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function createTimestamp() {
  return new Date().toISOString();
}

function inferMimeType(asset: ImagePickerAsset) {
  if (asset.mimeType) {
    return asset.mimeType;
  }

  const lowerUri = asset.uri.toLowerCase();

  if (lowerUri.endsWith('.png')) return 'image/png';
  if (lowerUri.endsWith('.webp')) return 'image/webp';
  if (lowerUri.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

function inferFileExtension(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

async function requireSupabaseUserId() {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('A signed-in user is required for image upload.');
  }

  return user.id;
}

async function uploadToSupabase(params: {
  prescriptionId: string;
  asset: ImagePickerAsset;
  captureSource: UploadSource;
}): Promise<UploadedPrescriptionImage> {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const userId = await requireSupabaseUserId();
  const mimeType = inferMimeType(params.asset);
  const extension = inferFileExtension(mimeType);
  const imageId = createUuid();
  const storagePath = `${userId}/${params.prescriptionId}/${imageId}.${extension}`;

  const response = await fetch(params.asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('prescription-images')
    .upload(storagePath, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { error: insertError } = await supabase.from('prescription_images').insert({
    id: imageId,
    prescription_id: params.prescriptionId,
    storage_path: storagePath,
    mime_type: mimeType,
    width: params.asset.width ?? null,
    height: params.asset.height ?? null,
    file_size_bytes: params.asset.fileSize ?? null,
    capture_source: params.captureSource,
    preprocess_meta: {
      originalFileName: params.asset.fileName ?? null,
    },
  });

  if (insertError) {
    throw insertError;
  }

  return {
    id: imageId,
    storagePath,
    mimeType,
    width: params.asset.width ?? null,
    height: params.asset.height ?? null,
    fileSizeBytes: params.asset.fileSize ?? null,
    captureSource: params.captureSource,
    source: 'supabase',
  };
}

function saveToLocalStore(params: {
  prescriptionId: string;
  asset: ImagePickerAsset;
  captureSource: UploadSource;
}): UploadedPrescriptionImage {
  const mimeType = inferMimeType(params.asset);
  const imageId = createUuid();
  const record: LocalPrescriptionImageRecord = {
    id: imageId,
    prescriptionId: params.prescriptionId,
    storagePath: `${LOCAL_IMAGE_PREFIX}${imageId}`,
    localUri: params.asset.uri,
    mimeType,
    width: params.asset.width ?? null,
    height: params.asset.height ?? null,
    fileSizeBytes: params.asset.fileSize ?? null,
    captureSource: params.captureSource,
    source: 'local',
    createdAt: createTimestamp(),
  };

  const existing = localImageStore.get(params.prescriptionId) ?? [];
  localImageStore.set(params.prescriptionId, [...existing, record]);

  return {
    id: record.id,
    storagePath: record.storagePath,
    mimeType: record.mimeType,
    width: record.width,
    height: record.height,
    fileSizeBytes: record.fileSizeBytes,
    captureSource: record.captureSource,
    source: 'local',
  };
}

export const storageService = {
  async uploadPrescriptionImage(params: {
    prescriptionId: string;
    asset: ImagePickerAsset;
    captureSource: UploadSource;
  }) {
    if (isSupabaseConfigured && supabase) {
      try {
        return await uploadToSupabase(params);
      } catch {
        return saveToLocalStore(params);
      }
    }

    return saveToLocalStore(params);
  },

  getLatestLocalImage(prescriptionId: string) {
    const images = localImageStore.get(prescriptionId) ?? [];
    return images.at(-1) ?? null;
  },
};
