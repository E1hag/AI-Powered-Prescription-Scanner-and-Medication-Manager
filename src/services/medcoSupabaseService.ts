import { supabase } from "@/lib/supabase";

export type DoseStatus = "Pending" | "Taken" | "Missed" | "Snoozed";

export type MedicationDose = {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  time: string;
  instruction: string;
  status: DoseStatus;
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

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
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
