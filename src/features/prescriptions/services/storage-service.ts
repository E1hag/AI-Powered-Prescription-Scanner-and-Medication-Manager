import { supabase } from "@/src/lib/supabase";

export type UploadPrescriptionImageResult = {
  path: string;
  publicUrl: string;
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

export const storageService = {
  async uploadPrescriptionImage(
    imageUri: string,
  ): Promise<UploadPrescriptionImageResult> {
    try {
      const extension = getFileExtension(imageUri);
      const mimeType = getMimeType(extension);
      const fileName = `prescription-${Date.now()}.${extension}`;
      const filePath = `prescriptions/${fileName}`;

      const response = await fetch(imageUri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from("prescription-images")
        .upload(filePath, blob, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        console.log("Supabase image upload error:", error.message);

        return {
          path: filePath,
          publicUrl: imageUri,
        };
      }

      const { data } = supabase.storage
        .from("prescription-images")
        .getPublicUrl(filePath);

      return {
        path: filePath,
        publicUrl: data.publicUrl,
      };
    } catch (error) {
      console.log("Storage upload error:", error);

      return {
        path: `local/prescription-${Date.now()}.jpg`,
        publicUrl: imageUri,
      };
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
