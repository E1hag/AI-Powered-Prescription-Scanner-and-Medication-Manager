import { supabase } from "@/src/lib/supabase";
import { storageService } from "./storage-service";

export type PrescriptionStatus =
  | "draft"
  | "uploaded"
  | "processing"
  | "processed"
  | "needs_review"
  | "ready_for_schedule"
  | "reviewed"
  | "scheduled"
  | "failed"
  | "ocr_failed"
  | "finalized";

export type ScheduleDose = {
  id: string;
  medicationName: string;
  dosage: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  ingredientA?: string;
  ingredientB?: string | null;
  time?: string;
};

export type ScheduleDraft = {
  prescriptionId: string;
  doses: ScheduleDose[];
};

export type Prescription = {
  id: string;
  image_url?: string | null;
  image_path?: string | null;
  status: PrescriptionStatus;
  extracted_text?: string | null;
  extracted_medications?: ScheduleDose[] | null;
  created_at?: string;
  updated_at?: string;
};

export type ReviewDraft = {
  prescription: Prescription | null;
  medications: ScheduleDose[];
};

export type CreatePrescriptionInput = {
  imageUri?: string;
  imageUrl?: string;
  status?: PrescriptionStatus;
  source?: "camera" | "library" | "upload";
};

export type UpdatePrescriptionInput = {
  status?: PrescriptionStatus;
  extractedText?: string;
  extractedMedications?: ScheduleDose[];
  imageUrl?: string;
  imagePath?: string;
};

function createLocalPrescriptionId() {
  return `prescription-${Date.now()}`;
}

function isSupabaseConfigured() {
  return Boolean(supabase);
}

function mapWritablePrescriptionStatus(status: PrescriptionStatus) {
  const statusMap: Partial<Record<PrescriptionStatus, string>> = {
    uploaded: "draft",
    processed: "needs_review",
    reviewed: "ready_for_schedule",
    scheduled: "finalized",
    failed: "ocr_failed",
  };

  return statusMap[status] ?? status;
}

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNormalizedField(row: any, fieldName: string) {
  const normalizedFields = row?.normalized_fields;

  if (!normalizedFields || typeof normalizedFields !== "object") {
    return "";
  }

  return getText((normalizedFields as Record<string, unknown>)[fieldName]);
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
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

  return fallbackMessage;
}

async function getFunctionErrorMessage(error: unknown) {
  const fallbackMessage =
    getErrorMessage(error, "Prescription analysis failed.");
  const context = (error as { context?: unknown } | null)?.context;

  if (
    context &&
    typeof context === "object" &&
    "clone" in context &&
    typeof context.clone === "function"
  ) {
    try {
      const response = (context as Response).clone();
      const body = await response.json();

      if (
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        return body.error;
      }
    } catch {
      return fallbackMessage;
    }
  }

  return fallbackMessage;
}

function mapPrescriptionRow(row: any): Prescription {
  return {
    id: row.id,
    image_url: row.image_url ?? null,
    image_path: row.image_path ?? null,
    status: row.status ?? "draft",
    extracted_text: row.extracted_text ?? null,
    extracted_medications: row.extracted_medications ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapExtractedMedicationRow(row: any, index: number): ScheduleDose {
  const medicationName =
    getText(row.medication_name) ||
    getNormalizedField(row, "medicationName") ||
    `Medication ${index + 1}`;
  const dosage =
    getText(row.dosage_text) ||
    getNormalizedField(row, "dosage") ||
    getText(row.strength_text) ||
    getNormalizedField(row, "strength");
  const instructions =
    getText(row.notes_text) ||
    getNormalizedField(row, "notes") ||
    getText(row.timing_text) ||
    getNormalizedField(row, "timingInstructions");

  return {
    id: String(row.id ?? `med-${index + 1}`),
    medicationName,
    dosage,
    frequency:
      getText(row.frequency_text) ||
      getNormalizedField(row, "frequency") ||
      getText(row.frequency),
    duration:
      getText(row.duration_text) ||
      getNormalizedField(row, "duration") ||
      getText(row.duration),
    instructions,
    ingredientA: getText(row.ingredient_a) || medicationName,
    ingredientB: row.ingredient_b ? String(row.ingredient_b) : null,
    time: "08:00 AM",
  };
}

export const prescriptionService = {
  async createPrescription(input: CreatePrescriptionInput = {}) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please sign in before creating a prescription.");
      }

      let uploadedImageUrl = input.imageUrl ?? null;
      let uploadedImagePath: string | null = null;

      if (input.imageUri) {
        const uploadResult = await storageService.uploadPrescriptionImage(
          input.imageUri,
        );

        uploadedImageUrl = uploadResult.publicUrl;
        uploadedImagePath = uploadResult.path;
      }

      const insertPayload = {
        user_id: user.id,
        patient_id: user.id,
        source_type: input.source ?? "upload",
        status: mapWritablePrescriptionStatus(input.status ?? "draft"),
      };

      const { data, error } = await supabase
        .from("prescriptions")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) {
        console.log("Supabase create prescription error:", error.message);

        return {
          data: {
            id: createLocalPrescriptionId(),
            image_url: uploadedImageUrl,
            image_path: uploadedImagePath,
            status: input.status ?? "uploaded",
          } as Prescription,
          error: null,
        };
      }

      return {
        data: mapPrescriptionRow(data),
        error: null,
      };
    } catch (error) {
      console.log("Create prescription error:", error);

      return {
        data: {
          id: createLocalPrescriptionId(),
          image_url: input.imageUrl ?? null,
          image_path: null,
          status: input.status ?? "uploaded",
        } as Prescription,
        error: null,
      };
    }
  },

  async analyzePrescriptionImage(input: {
    imageUri: string;
    source?: "camera" | "library" | "upload";
  }): Promise<ReviewDraft> {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      throw new Error("Please sign in before scanning a prescription.");
    }

    const sourceType = input.source ?? "upload";
    const uploadResult = await storageService.uploadPrescriptionImage(
      input.imageUri,
    );

    if (uploadResult.path.startsWith("local/")) {
      throw new Error("Unable to upload the prescription image.");
    }

    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .insert({
        user_id: session.user.id,
        patient_id: session.user.id,
        status: "draft",
        source_type: sourceType,
      })
      .select("*")
      .single();

    if (prescriptionError || !prescription) {
      throw new Error(
        getErrorMessage(
          prescriptionError,
          "Unable to create prescription.",
        ),
      );
    }

    const { error: imageError } = await supabase
      .from("prescription_images")
      .insert({
        prescription_id: prescription.id,
        storage_path: uploadResult.path,
        mime_type: uploadResult.mimeType,
        capture_source: sourceType === "library" ? "gallery" : sourceType,
      });

    if (imageError) {
      throw new Error(
        getErrorMessage(
          imageError,
          "Unable to save prescription image metadata.",
        ),
      );
    }

    const { data: analysisResult, error: analysisError } =
      await supabase.functions.invoke("analyze-prescription", {
        body: {
          prescriptionId: prescription.id,
          imagePath: uploadResult.path,
          mimeType: uploadResult.mimeType,
          storageBucket: "prescription-images",
          useMockData: false,
        },
      });

    if (analysisError) {
      throw new Error(await getFunctionErrorMessage(analysisError));
    }

    if (
      analysisResult &&
      typeof analysisResult === "object" &&
      "error" in analysisResult
    ) {
      throw new Error(String(analysisResult.error));
    }

    const analysisData = analysisResult as
      | { source?: string; provider?: string }
      | null;

    if (
      analysisData?.source === "mock" ||
      analysisData?.provider === "mock-seeded"
    ) {
      throw new Error(
        "Live prescription analysis is not configured. Please configure Google Document AI for the scanner.",
      );
    }

    const reviewDraft = await this.getReviewDraft(prescription.id);

    return {
      prescription: reviewDraft.prescription ?? mapPrescriptionRow(prescription),
      medications: reviewDraft.medications,
    };
  },

  async getPrescriptionById(id: string) {
    try {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.log("Supabase get prescription error:", error.message);

        return {
          data: null,
          error,
        };
      }

      return {
        data: mapPrescriptionRow(data),
        error: null,
      };
    } catch (error) {
      console.log("Get prescription error:", error);

      return {
        data: null,
        error,
      };
    }
  },

  async getReviewDraft(prescriptionId: string): Promise<ReviewDraft> {
    try {
      const prescriptionResult = await this.getPrescriptionById(prescriptionId);
      const prescription = prescriptionResult.data;

      const { data: medicationRows, error: medicationError } = await supabase
        .from("extracted_medications")
        .select("*")
        .eq("prescription_id", prescriptionId)
        .order("position_index", { ascending: true });

      if (medicationError) {
        console.log(
          "Supabase get extracted medications error:",
          medicationError.message,
        );
      }

      const medications =
        medicationRows && medicationRows.length > 0
          ? medicationRows.map((row, index) =>
              mapExtractedMedicationRow(row, index),
            )
          : prescription?.extracted_medications &&
              prescription.extracted_medications.length > 0
            ? prescription.extracted_medications
            : [];

      return {
        prescription,
        medications,
      };
    } catch (error) {
      console.log("Get review draft error:", error);

      return {
        prescription: null,
        medications: [],
      };
    }
  },

  async updatePrescription(id: string, input: UpdatePrescriptionInput) {
    try {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (input.status) {
        updatePayload.status = mapWritablePrescriptionStatus(input.status);
      }

      if (input.extractedText !== undefined) {
        updatePayload.extracted_text = input.extractedText;
      }

      if (input.extractedMedications !== undefined) {
        updatePayload.extracted_medications = input.extractedMedications;
      }

      if (input.imageUrl !== undefined) {
        updatePayload.image_url = input.imageUrl;
      }

      if (input.imagePath !== undefined) {
        updatePayload.image_path = input.imagePath;
      }

      const { data, error } = await supabase
        .from("prescriptions")
        .update(updatePayload)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        console.log("Supabase update prescription error:", error.message);

        return {
          data: {
            id,
            image_url: input.imageUrl ?? null,
            image_path: input.imagePath ?? null,
            status: input.status ?? "processed",
            extracted_text: input.extractedText ?? null,
            extracted_medications: input.extractedMedications ?? null,
          } as Prescription,
          error: null,
        };
      }

      return {
        data: mapPrescriptionRow(data),
        error: null,
      };
    } catch (error) {
      console.log("Update prescription error:", error);

      return {
        data: null,
        error,
      };
    }
  },

  async saveSchedule(draft: ScheduleDraft) {
    try {
      const today = new Date().toISOString().split("T")[0];

      const rowsToInsert = draft.doses.map((dose) => ({
        prescription_id: draft.prescriptionId,
        medication_name: dose.medicationName,
        dosage: dose.dosage,
        scheduled_time: dose.time ?? "08:00 AM",
        instructions: dose.instructions ?? "",
        status: "pending",
        schedule_date: today,
      }));

      const { data, error } = await supabase
        .from("medication_schedules")
        .insert(rowsToInsert)
        .select("*");

      if (error) {
        console.log("Supabase save schedule error:", error.message);

        return {
          data: rowsToInsert,
          error: null,
        };
      }

      await this.updatePrescription(draft.prescriptionId, {
        status: "scheduled",
      });

      return {
        data,
        error: null,
      };
    } catch (error) {
      console.log("Save schedule error:", error);

      return {
        data: null,
        error,
      };
    }
  },
};

export { isSupabaseConfigured };
