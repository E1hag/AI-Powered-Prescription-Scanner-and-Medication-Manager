import { supabase } from "@/lib/supabase";
import {
  DrugInteractionRecord,
  InteractionSeverity,
  buildIngredientFingerprint,
  checkDrugInteractions,
  getInteractionIngredientsForDose,
  getInteractionIngredientsForDoses,
} from "@/src/features/prescriptions/utils/drug-interactions";

export type DoseStatus = "Pending" | "Taken" | "Missed" | "Snoozed";

export type MedicationDose = {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  time: string;
  instruction: string;
  status: DoseStatus;
  ingredientA?: string | null;
  ingredientB?: string | null;
};

export type MedicationSchedule = {
  id: string;
  createdAt: string;
  doses: MedicationDose[];
};

export type AdherenceHistoryItem = {
  id: string;
  doseId: string;
  medicationName: string;
  time: string;
  action: DoseStatus;
  createdAt: string;
};

export type ReminderItem = {
  id: string;
  doseId: string;
  medicationName: string;
  dosage: string;
  time: string;
  instruction: string;
  isEnabled: boolean;
};

export type MedicalConditionProfile = {
  allergies: string;
  chronicConditions: string;
  notes: string;
};

export type ClinicianAccessRequestStatus =
  | "pending"
  | "approved"
  | "rejected";

export type ClinicianAccessRequest = {
  id: string;
  clinicianId: string;
  patientId: string;
  status: ClinicianAccessRequestStatus;
  requestedAt: string;
  respondedAt: string | null;
  reason: string | null;
};

export type TreatmentNote = {
  id: string;
  clinicianId: string;
  patientId: string;
  noteText: string;
  noteType: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type DrugInteractionResult = DrugInteractionRecord & {
  id: string;
  patientId: string;
  scheduleId: string | null;
  ingredientFingerprint: string | null;
  checkedAt: string | null;
  source: string | null;
  medicationA: string | null;
  medicationB: string | null;
  ingredientA: string | null;
  ingredientB: string | null;
};

export type DrugInteractionRefreshResult = {
  results: DrugInteractionResult[];
  ingredientFingerprint: string;
  checkedAt: string;
  masterInteractionCount: number;
};

type SupabaseScheduleRow = {
  id: string;
  user_id: string | null;
  created_at: string;
  doses: MedicationDose[];
};

type SupabaseHistoryRow = {
  id: string;
  schedule_id: string;
  dose_id: string;
  medication_name: string;
  dose_time: string;
  action: DoseStatus;
  created_at: string;
};

type SupabaseReminderRow = {
  id: string;
  schedule_id: string;
  dose_id: string;
  medication_name: string;
  dosage: string;
  dose_time: string;
  instruction: string;
  is_enabled: boolean;
};

type SupabaseMedicalProfileRow = {
  id: string;
  allergies: string | null;
  chronic_conditions: string | null;
  notes: string | null;
  updated_at: string;
};

type SupabaseClinicianAccessRequestRow = {
  id: string;
  clinician_id: string;
  patient_id: string;
  status: ClinicianAccessRequestStatus;
  requested_at: string;
  responded_at: string | null;
  reason: string | null;
};

type SupabaseTreatmentNoteRow = {
  id: string;
  clinician_id: string;
  patient_id: string;
  note_text: string;
  created_at: string;
  updated_at: string | null;
  note_type: string | null;
};

type SupabaseDrugInteractionResultRow = {
  id: string;
  patient_id: string;
  drug_a: string;
  drug_b: string;
  severity: "low" | "moderate" | "high";
  description: string | null;
  recommendation: string | null;
  checked_at: string | null;
  source: string | null;
  prescription_id: string | null;
  schedule_id: string | null;
  medication_a: string | null;
  medication_b: string | null;
  ingredient_a: string | null;
  ingredient_b: string | null;
  ingredient_fingerprint: string | null;
  master_interaction_id: string | null;
};

function mapClinicianAccessRequest(
  request: SupabaseClinicianAccessRequestRow,
): ClinicianAccessRequest {
  return {
    id: request.id,
    clinicianId: request.clinician_id,
    patientId: request.patient_id,
    status: request.status,
    requestedAt: request.requested_at,
    respondedAt: request.responded_at,
    reason: request.reason,
  };
}

function mapTreatmentNote(note: SupabaseTreatmentNoteRow): TreatmentNote {
  return {
    id: note.id,
    clinicianId: note.clinician_id,
    patientId: note.patient_id,
    noteText: note.note_text,
    noteType: note.note_type,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  };
}

function mapStoredInteractionSeverity(
  severity: SupabaseDrugInteractionResultRow["severity"],
): InteractionSeverity {
  if (severity === "high") {
    return "Severe";
  }

  if (severity === "low") {
    return "Mild";
  }

  return "Moderate";
}

function mapInteractionSeverityToDatabase(severity: InteractionSeverity) {
  if (severity === "Severe") {
    return "high";
  }

  if (severity === "Mild") {
    return "low";
  }

  return "moderate";
}

function mapDrugInteractionResult(
  result: SupabaseDrugInteractionResultRow,
): DrugInteractionResult {
  return {
    id: result.id,
    patientId: result.patient_id,
    scheduleId: result.schedule_id,
    ingredientFingerprint: result.ingredient_fingerprint,
    masterInteractionId: result.master_interaction_id,
    drugA: result.drug_a,
    drugB: result.drug_b,
    severity: mapStoredInteractionSeverity(result.severity),
    description: result.description ?? "",
    recommendation: result.recommendation ?? "",
    checkedAt: result.checked_at,
    source: result.source,
    medicationA: result.medication_a,
    medicationB: result.medication_b,
    ingredientA: result.ingredient_a,
    ingredientB: result.ingredient_b,
  };
}

function getMedicationNameForIngredient(
  doses: MedicationDose[],
  ingredient: string,
) {
  const normalizedIngredient = ingredient.trim().toLowerCase();

  if (!normalizedIngredient) {
    return null;
  }

  const matchingDose = doses.find((dose) => {
    return getInteractionIngredientsForDose(dose).some((doseIngredient) => {
      const normalizedDoseIngredient = doseIngredient.trim().toLowerCase();

      return (
        normalizedDoseIngredient.includes(normalizedIngredient) ||
        normalizedIngredient.includes(normalizedDoseIngredient)
      );
    });
  });

  return matchingDose?.medicationName ?? null;
}

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function getClinicianAccessRequestsForPatient(): Promise<
  ClinicianAccessRequest[]
> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("clinician_access_requests")
    .select("*")
    .eq("patient_id", userId)
    .order("requested_at", {
      ascending: false,
    })
    .returns<SupabaseClinicianAccessRequestRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapClinicianAccessRequest).sort((first, second) => {
    if (first.status === "pending" && second.status !== "pending") {
      return -1;
    }

    if (first.status !== "pending" && second.status === "pending") {
      return 1;
    }

    return (
      new Date(second.requestedAt).getTime() -
      new Date(first.requestedAt).getTime()
    );
  });
}

async function respondToClinicianAccessRequest(
  requestId: string,
  status: ClinicianAccessRequestStatus,
) {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Please sign in before responding to clinician requests.");
  }

  const { data, error } = await supabase
    .from("clinician_access_requests")
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("patient_id", userId)
    .select("*")
    .single<SupabaseClinicianAccessRequestRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapClinicianAccessRequest(data);
}

export async function approveClinicianAccessRequest(requestId: string) {
  return respondToClinicianAccessRequest(requestId, "approved");
}

export async function denyClinicianAccessRequest(requestId: string) {
  return respondToClinicianAccessRequest(requestId, "rejected");
}

export async function getTreatmentNotesForPatient(): Promise<TreatmentNote[]> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("treatment_notes")
    .select("*")
    .eq("patient_id", userId)
    .order("created_at", {
      ascending: false,
    })
    .returns<SupabaseTreatmentNoteRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapTreatmentNote);
}

export async function saveMedicationScheduleToSupabase(
  doses: MedicationDose[],
): Promise<MedicationSchedule> {
  const userId = await getCurrentUserId();

  const scheduleToInsert = {
    user_id: userId,
    doses,
  };

  const { data, error } = await supabase
    .from("medco_medication_schedules")
    .insert(scheduleToInsert)
    .select("*")
    .single<SupabaseScheduleRow>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    createdAt: data.created_at,
    doses: data.doses,
  };
}

export async function getLatestMedicationScheduleFromSupabase(): Promise<MedicationSchedule | null> {
  const userId = await getCurrentUserId();

  let query = supabase
    .from("medco_medication_schedules")
    .select("*")
    .order("created_at", {
      ascending: false,
    })
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.maybeSingle<SupabaseScheduleRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    createdAt: data.created_at,
    doses: data.doses,
  };
}

export async function getDrugInteractionResultsForSchedule(
  scheduleId: string,
): Promise<DrugInteractionResult[]> {
  const userId = await getCurrentUserId();

  if (!userId || !scheduleId) {
    return [];
  }

  const { data, error } = await supabase
    .from("drug_interaction_results")
    .select("*")
    .eq("patient_id", userId)
    .eq("schedule_id", scheduleId)
    .order("checked_at", {
      ascending: false,
    })
    .returns<SupabaseDrugInteractionResultRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapDrugInteractionResult);
}

export async function refreshDrugInteractionResultsForSchedule(
  schedule: MedicationSchedule,
): Promise<DrugInteractionRefreshResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Please sign in before checking drug interactions.");
  }

  const ingredients = getInteractionIngredientsForDoses(schedule.doses);
  const ingredientFingerprint = buildIngredientFingerprint(ingredients);
  const checkedAt = new Date().toISOString();
  const checkResult = await checkDrugInteractions(ingredients);

  const { error: deleteError } = await supabase
    .from("drug_interaction_results")
    .delete()
    .eq("patient_id", userId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (checkResult.interactions.length === 0) {
    return {
      results: [],
      ingredientFingerprint,
      checkedAt,
      masterInteractionCount: checkResult.masterInteractionCount,
    };
  }

  const rowsToInsert = checkResult.interactions.map((interaction) => {
    return {
      patient_id: userId,
      schedule_id: schedule.id,
      ingredient_fingerprint: ingredientFingerprint,
      master_interaction_id: interaction.masterInteractionId ?? null,
      drug_a: interaction.drugA,
      drug_b: interaction.drugB,
      severity: mapInteractionSeverityToDatabase(interaction.severity),
      description: interaction.description,
      recommendation: interaction.recommendation,
      checked_at: checkedAt,
      source: "drug_interactions_master",
      prescription_id: null,
      medication_a: getMedicationNameForIngredient(schedule.doses, interaction.drugA),
      medication_b: getMedicationNameForIngredient(schedule.doses, interaction.drugB),
      ingredient_a: interaction.drugA,
      ingredient_b: interaction.drugB,
    };
  });

  const { data, error: insertError } = await supabase
    .from("drug_interaction_results")
    .insert(rowsToInsert)
    .select("*")
    .returns<SupabaseDrugInteractionResultRow[]>();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    results: data.map(mapDrugInteractionResult),
    ingredientFingerprint,
    checkedAt,
    masterInteractionCount: checkResult.masterInteractionCount,
  };
}

export async function updateMedicationScheduleDosesInSupabase(
  scheduleId: string,
  doses: MedicationDose[],
): Promise<MedicationSchedule> {
  const { data, error } = await supabase
    .from("medco_medication_schedules")
    .update({
      doses,
    })
    .eq("id", scheduleId)
    .select("*")
    .single<SupabaseScheduleRow>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    createdAt: data.created_at,
    doses: data.doses,
  };
}

export async function saveAdherenceHistoryToSupabase(
  scheduleId: string,
  item: AdherenceHistoryItem,
) {
  const { error } = await supabase.from("medco_adherence_history").insert({
    id: item.id,
    schedule_id: scheduleId,
    dose_id: item.doseId,
    medication_name: item.medicationName,
    dose_time: item.time,
    action: item.action,
    created_at: item.createdAt,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getAdherenceHistoryFromSupabase(
  scheduleId: string,
): Promise<AdherenceHistoryItem[]> {
  const { data, error } = await supabase
    .from("medco_adherence_history")
    .select("*")
    .eq("schedule_id", scheduleId)
    .order("created_at", {
      ascending: false,
    })
    .returns<SupabaseHistoryRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map((item) => {
    return {
      id: item.id,
      doseId: item.dose_id,
      medicationName: item.medication_name,
      time: item.dose_time,
      action: item.action,
      createdAt: item.created_at,
    };
  });
}

export async function saveRemindersToSupabase(
  scheduleId: string,
  reminders: ReminderItem[],
) {
  const { error: deleteError } = await supabase
    .from("medco_dose_reminders")
    .delete()
    .eq("schedule_id", scheduleId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const reminderRows = reminders.map((reminder) => {
    return {
      id: reminder.id,
      schedule_id: scheduleId,
      dose_id: reminder.doseId,
      medication_name: reminder.medicationName,
      dosage: reminder.dosage,
      dose_time: reminder.time,
      instruction: reminder.instruction,
      is_enabled: reminder.isEnabled,
    };
  });

  const { error: insertError } = await supabase
    .from("medco_dose_reminders")
    .insert(reminderRows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function getRemindersFromSupabase(
  scheduleId: string,
): Promise<ReminderItem[]> {
  const { data, error } = await supabase
    .from("medco_dose_reminders")
    .select("*")
    .eq("schedule_id", scheduleId)
    .returns<SupabaseReminderRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map((reminder) => {
    return {
      id: reminder.id,
      doseId: reminder.dose_id,
      medicationName: reminder.medication_name,
      dosage: reminder.dosage,
      time: reminder.dose_time,
      instruction: reminder.instruction,
      isEnabled: reminder.is_enabled,
    };
  });
}

export async function saveMedicalConditionProfileToSupabase(
  profile: MedicalConditionProfile,
) {
  const userId = await getCurrentUserId();

  const profileToSave = {
    user_id: userId,
    allergies: profile.allergies,
    chronic_conditions: profile.chronicConditions,
    notes: profile.notes,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("medco_medical_profiles")
    .upsert(profileToSave, {
      onConflict: "user_id",
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getMedicalConditionProfileFromSupabase(): Promise<MedicalConditionProfile> {
  const userId = await getCurrentUserId();

  let query = supabase.from("medco_medical_profiles").select("*").limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.maybeSingle<SupabaseMedicalProfileRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return {
      allergies: "",
      chronicConditions: "",
      notes: "",
    };
  }

  return {
    allergies: data.allergies ?? "",
    chronicConditions: data.chronic_conditions ?? "",
    notes: data.notes ?? "",
  };
}
