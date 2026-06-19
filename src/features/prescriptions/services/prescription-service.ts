import { supabase } from "@/src/lib/supabase";
import { storageService } from "./storage-service";

export type PrescriptionStatus =
  | "draft"
  | "uploaded"
  | "processing"
  | "processed"
  | "reviewed"
  | "scheduled"
  | "failed";

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
  return {
    id: String(row.id ?? `med-${index + 1}`),
    medicationName: String(row.medication_name ?? ""),
    dosage: String(row.dosage_text ?? row.dosage ?? ""),
    frequency: String(row.frequency_text ?? row.frequency ?? ""),
    duration: String(row.duration_text ?? row.duration ?? ""),
    instructions: String(row.instruction_text ?? row.instructions ?? ""),
    ingredientA: String(row.ingredient_a ?? ""),
    ingredientB: row.ingredient_b ? String(row.ingredient_b) : null,
    time: "08:00 AM",
  };
}

function createFallbackMedications(): ScheduleDose[] {
  return [
    {
      id: "1",
      medicationName: "Amoxicillin",
      dosage: "500mg",
      frequency: "Twice daily",
      duration: "7 days",
      instructions: "Take after food",
      ingredientA: "Amoxicillin",
      ingredientB: null,
      time: "08:00 AM",
    },
    {
      id: "2",
      medicationName: "MAXIGESIC",
      dosage: "2 tabs",
      frequency: "3 per day",
      duration: "4 days",
      instructions: "Take only if needed for pain or fever",
      ingredientA: "Ibuprofen",
      ingredientB: "Paracetamol",
      time: "02:00 PM",
    },
    {
      id: "3",
      medicationName: "DYMISTA",
      dosage: "2 puffs",
      frequency: "2 per day",
      duration: "5 days",
      instructions: "Use as directed",
      ingredientA: "Azelastine Hydrochloride",
      ingredientB: "Fluticasone Propionate",
      time: "08:00 PM",
    },
  ];
}

export const prescriptionService = {
  async createPrescription(input: CreatePrescriptionInput = {}) {
    try {
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
        image_url: uploadedImageUrl,
        image_path: uploadedImagePath,
        status: input.status ?? "uploaded",
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
          data: {
            id,
            image_url: null,
            image_path: null,
            status: "processed",
            extracted_text: null,
            extracted_medications: createFallbackMedications(),
          } as Prescription,
          error: null,
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
            : createFallbackMedications();

      return {
        prescription,
        medications,
      };
    } catch (error) {
      console.log("Get review draft error:", error);

      return {
        prescription: null,
        medications: createFallbackMedications(),
      };
    }
  },

  async updatePrescription(id: string, input: UpdatePrescriptionInput) {
    try {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (input.status) {
        updatePayload.status = input.status;
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

  async processPrescription(id: string) {
    try {
      const mockMedications: ScheduleDose[] = [
        {
          id: "1",
          medicationName: "Amoxicillin",
          dosage: "500mg",
          frequency: "Twice daily",
          duration: "7 days",
          instructions: "Take after food",
          ingredientA: "Amoxicillin",
          ingredientB: null,
          time: "08:00 AM",
        },
        {
          id: "2",
          medicationName: "MAXIGESIC",
          dosage: "2 tabs",
          frequency: "3 per day",
          duration: "4 days",
          instructions: "Take only if needed for pain or fever",
          ingredientA: "Ibuprofen",
          ingredientB: "Paracetamol",
          time: "02:00 PM",
        },
        {
          id: "3",
          medicationName: "DYMISTA",
          dosage: "2 puffs",
          frequency: "2 per day",
          duration: "5 days",
          instructions: "Use as directed",
          ingredientA: "Azelastine Hydrochloride",
          ingredientB: "Fluticasone Propionate",
          time: "08:00 PM",
        },
      ];

      return await this.updatePrescription(id, {
        status: "processed",
        extractedText:
          "Amoxicillin 500mg twice daily after food. MAXIGESIC contains Ibuprofen and Paracetamol. DYMISTA contains Azelastine Hydrochloride and Fluticasone Propionate.",
        extractedMedications: mockMedications,
      });
    } catch (error) {
      console.log("Process prescription error:", error);

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
