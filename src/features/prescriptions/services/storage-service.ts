import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "@/src/lib/supabase";

export type UploadPrescriptionImageResult = {
  path: string;
  publicUrl: string;
  mimeType: string;
};

function getFileExtension(uri: string) {
  const cleanUri = uri.split("?")[0];
  const parts = cleanUri.split(".");
  const extension = parts[parts.length - 1];

  if (!extension || extension.length > 5) {
    return "jpg";
  }

  return extension.toLowerCase();
}

function getMimeType(extension: string) {
  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "heic") {
    return "image/heic";
  }

  return "image/jpeg";
}

function getStorageErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    const parts = [
      errorRecord.message,
      errorRecord.error,
      errorRecord.statusCode,
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

  return fallbackMessage;
}

function base64ToArrayBuffer(base64: string) {
  const cleanBase64 = base64.replace(/\s/g, "");
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const outputLength =
    Math.floor((cleanBase64.length * 3) / 4) -
    (cleanBase64.endsWith("==") ? 2 : cleanBase64.endsWith("=") ? 1 : 0);
  const bytes = new Uint8Array(outputLength);
  let buffer = 0;
  let bits = 0;
  let byteIndex = 0;

  for (const character of cleanBase64) {
    if (character === "=") {
      break;
    }

    const value = alphabet.indexOf(character);

    if (value < 0) {
      continue;
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex] = (buffer >> bits) & 0xff;
      byteIndex += 1;
    }
  }

  return bytes.buffer;
}

export const storageService = {
  async uploadPrescriptionImage(
    imageUri: string,
  ): Promise<UploadPrescriptionImageResult> {
    try {
      const extension = getFileExtension(imageUri);
      const mimeType = getMimeType(extension);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please sign in before uploading a prescription image.");
      }

      const fileName = `prescription-${Date.now()}.${extension}`;
      const filePath = `${user.id}/prescriptions/${fileName}`;

      const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: "base64",
      });
      const imageBytes = base64ToArrayBuffer(imageBase64);

      if (imageBytes.byteLength === 0) {
        throw new Error("The selected prescription image is empty.");
      }

      const { error } = await supabase.storage
        .from("prescription-images")
        .upload(filePath, imageBytes, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        console.log("Supabase image upload error:", error.message);
        throw new Error(
          getStorageErrorMessage(
            error,
            "Unable to upload the prescription image.",
          ),
        );
      }

      const { data } = supabase.storage
        .from("prescription-images")
        .getPublicUrl(filePath);

      return {
        path: filePath,
        publicUrl: data.publicUrl,
        mimeType,
      };
    } catch (error) {
      console.log("Storage upload error:", error);
      throw new Error(
        getStorageErrorMessage(
          error,
          "Unable to upload the prescription image.",
        ),
      );
    }
  },

  async getPublicUrl(path: string) {
    try {
      const { data } = supabase.storage
        .from("prescription-images")
        .getPublicUrl(path);

      return data.publicUrl;
    } catch (error) {
      console.log("Get public URL error:", error);
      return "";
    }
  },

  async deletePrescriptionImage(path: string) {
    try {
      const { error } = await supabase.storage
        .from("prescription-images")
        .remove([path]);

      if (error) {
        console.log("Delete image error:", error.message);
      }

      return {
        error,
      };
    } catch (error) {
      console.log("Delete image exception:", error);

      return {
        error,
      };
    }
  },
};
