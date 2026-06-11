import {
  buildScheduleDrafts,
  inferScheduleEndDate,
  materializeScheduleEvents,
  normalizeMedicationInput,
  validateScheduleDraft,
  type AnalyzePrescriptionResult,
  type ExtractedMedication,
  type MedicationInstructionDraft,
  type MedicationSchedule,
  type MedicationScheduleEvent,
  type PrescriptionStatus,
  type ScheduleDraft,
} from '@scanner/shared';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import { storageService } from '@/src/features/prescriptions/services/storage-service';

const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001';

type ReviewDraft = {
  prescriptionId: string;
  extractionRunId: string;
  rawOcrText: string;
  documentDate: string | null;
  medications: ExtractedMedication[];
  source: 'supabase' | 'local';
};

type PrescriptionDraftResult = {
  id: string;
  status: PrescriptionStatus;
  source: 'supabase' | 'local';
};

type PrescriptionRecord = {
  id: string;
  userId: string;
  status: PrescriptionStatus;
  activeExtractionRunId: string | null;
  rawOcrText: string | null;
  reviewRequired: boolean;
  handwritingDetected: boolean;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExtractionRunRecord = {
  id: string;
  prescriptionId: string;
  provider: string;
  providerModel: string | null;
  parserVersion: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  rawOcrText: string | null;
  overallConfidence: number | null;
  issues: string[];
  providerResponse: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
};

type SchedulePreview = ScheduleDraft & {
  endDate: string | null;
};

const localStore = {
  prescriptions: new Map<string, PrescriptionRecord>(),
  extractionRuns: new Map<string, ExtractionRunRecord>(),
  extractedMedications: new Map<string, ExtractedMedication[]>(),
  schedules: new Map<string, MedicationSchedule[]>(),
  scheduleEvents: new Map<string, MedicationScheduleEvent[]>(),
};

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

function buildMockMedicationSeed(prescriptionId: string, extractionRunId: string, createdAt: string) {
  const amoxicillin: ExtractedMedication = {
    id: createUuid(),
    prescriptionId,
    extractionRunId,
    positionIndex: 0,
    rawMedicationText: 'Amoxicillin 500 mg - take 1 capsule twice daily after meals for 5 days',
    strengthText: '500 mg',
    dosageText: '1 capsule',
    frequencyText: 'twice daily',
    timingText: 'after meals',
    durationText: 'for 5 days',
    startDateText: null,
    notesText: null,
    normalizedFields: {
      medicationName: 'Amoxicillin',
      strength: '500 mg',
      dosage: '1 capsule',
      frequency: 'twice daily',
      timingInstructions: 'after meals',
      duration: '5 days',
      startDate: null,
      notes: null,
    },
    fieldSources: {
      startDateSource: null,
      timingSource: 'ocr',
    },
    confidenceFlags: ['missing_start_date', 'manual_review_required'],
    parsingIssues: ['missing_required_field'],
    reviewStatus: 'pending',
    isScheduleGeneratable: true,
    createdAt,
  };

  const paracetamol: ExtractedMedication = {
    id: createUuid(),
    prescriptionId,
    extractionRunId,
    positionIndex: 1,
    rawMedicationText: 'Paracetamol 500 mg - take 1 tablet before bedtime as needed',
    strengthText: '500 mg',
    dosageText: '1 tablet',
    frequencyText: 'before bedtime',
    timingText: 'before bedtime',
    durationText: null,
    startDateText: null,
    notesText: 'as needed',
    normalizedFields: {
      medicationName: 'Paracetamol',
      strength: '500 mg',
      dosage: '1 tablet',
      frequency: 'once daily',
      timingInstructions: 'before bedtime',
      duration: null,
      startDate: null,
      notes: 'as needed',
    },
    fieldSources: {
      startDateSource: null,
      timingSource: 'ocr',
    },
    confidenceFlags: ['manual_review_required'],
    parsingIssues: ['unsupported_instruction_pattern'],
    reviewStatus: 'pending',
    isScheduleGeneratable: false,
    createdAt,
  };

  return {
    rawOcrText:
      'Amoxicillin 500 mg - take 1 capsule twice daily after meals for 5 days. Paracetamol 500 mg - take 1 tablet before bedtime as needed.',
    medications: [amoxicillin, paracetamol],
  };
}

function mapMedicationToInstructionDraft(medication: ExtractedMedication): MedicationInstructionDraft {
  return normalizeMedicationInput({
    extractedMedicationId: medication.id,
    medicationName: medication.normalizedFields.medicationName ?? 'Unresolved medication',
    strength: medication.normalizedFields.strength,
    dosage: medication.normalizedFields.dosage,
    frequency: medication.normalizedFields.frequency,
    timingInstructions: medication.normalizedFields.timingInstructions,
    duration: medication.normalizedFields.duration,
    startDate: medication.normalizedFields.startDate,
    notes: medication.normalizedFields.notes,
    fieldSources: medication.fieldSources,
  });
}

function mapDbMedication(row: Record<string, any>): ExtractedMedication {
  return {
    id: row.id,
    prescriptionId: row.prescription_id,
    extractionRunId: row.extraction_run_id,
    positionIndex: row.position_index,
    rawMedicationText: row.raw_medication_text,
    strengthText: row.strength_text,
    dosageText: row.dosage_text,
    frequencyText: row.frequency_text,
    timingText: row.timing_text,
    durationText: row.duration_text,
    startDateText: row.start_date_text,
    notesText: row.notes_text,
    normalizedFields: {
      medicationName: row.normalized_fields?.medicationName ?? row.medication_name ?? null,
      strength: row.normalized_fields?.strength ?? row.strength_text ?? null,
      dosage: row.normalized_fields?.dosage ?? row.dosage_text ?? null,
      frequency: row.normalized_fields?.frequency ?? row.frequency_text ?? null,
      timingInstructions: row.normalized_fields?.timingInstructions ?? row.timing_text ?? null,
      duration: row.normalized_fields?.duration ?? row.duration_text ?? null,
      startDate: row.normalized_fields?.startDate ?? row.start_date_text ?? null,
      notes: row.normalized_fields?.notes ?? row.notes_text ?? null,
    },
    fieldSources: {
      startDateSource: row.normalized_fields?.fieldSources?.startDateSource ?? (row.start_date_text ? 'ocr' : null),
      timingSource: row.normalized_fields?.fieldSources?.timingSource ?? (row.timing_text ? 'ocr' : null),
    },
    confidenceFlags: row.confidence_flags ?? [],
    parsingIssues: row.parsing_issues ?? [],
    reviewStatus: row.review_status,
    isScheduleGeneratable: row.is_schedule_generatable,
    createdAt: row.created_at,
  };
}

function toDbNormalizedFields(medication: MedicationInstructionDraft) {
  return {
    medicationName: medication.medicationName,
    strength: medication.strength,
    dosage: medication.dosage,
    frequency: medication.frequency,
    timingInstructions: medication.timingInstructions,
    duration: medication.duration,
    startDate: medication.startDate,
    notes: medication.notes,
    fieldSources: {
      startDateSource: medication.fieldSources?.startDateSource ?? (medication.startDate ? 'user' : null),
      timingSource: medication.fieldSources?.timingSource ?? (medication.timingInstructions ? 'user' : null),
    },
  };
}

function extractDocumentDate(rawOcrText: string) {
  const dateMatch =
    rawOcrText.match(/\bDate\s*:\s*(\d{2})[-/](\d{2})[-/](20\d{2})\b/i) ??
    rawOcrText.match(/\bDate\s*:\s*(20\d{2})-(\d{2})-(\d{2})\b/i) ??
    rawOcrText.match(/\b(\d{2})[-/](\d{2})[-/](20\d{2})\b/) ??
    rawOcrText.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);

  if (!dateMatch) {
    return null;
  }

  if (dateMatch[3] && dateMatch[1]?.length === 2) {
    return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
}

function suggestTimingInstructions(medication: ExtractedMedication) {
  const existingTiming = medication.normalizedFields.timingInstructions ?? medication.timingText;

  if (existingTiming) {
    return existingTiming;
  }

  const frequency = (medication.normalizedFields.frequency ?? medication.frequencyText ?? '').trim().toLowerCase();
  const notes = (medication.normalizedFields.notes ?? medication.notesText ?? '').trim().toLowerCase();

  if (!frequency || notes.includes('as needed') || notes.includes('prn') || /taper|reduce|decrease|increase/.test(frequency)) {
    return null;
  }

  if (frequency.includes('after meals')) return 'after meals';
  if (frequency.includes('before bedtime') || frequency.includes('bedtime')) return 'before bedtime';
  if (frequency.includes('three times daily') || frequency.includes('3 times daily') || frequency.includes('3 per day') || frequency.includes('3 time/daily')) {
    return 'morning, afternoon, and evening';
  }
  if (frequency.includes('twice daily') || frequency.includes('2 times daily') || frequency.includes('2 per day') || frequency.includes('2 time/daily')) {
    return 'morning and evening';
  }
  if (frequency.includes('once daily') || frequency.includes('1 time per day') || frequency.includes('1 per day') || frequency.includes('1 time/daily') || frequency === 'daily') {
    return 'morning';
  }

  return null;
}

function applyReviewSuggestions(medications: ExtractedMedication[], documentDate: string | null) {
  return medications.map((medication) => {
    const suggestedStartDate = medication.normalizedFields.startDate ?? medication.startDateText ?? documentDate;
    const suggestedTiming = suggestTimingInstructions(medication);
    const startDateSource =
      medication.fieldSources.startDateSource ??
      (medication.startDateText ? 'ocr' : suggestedStartDate ? 'suggested' : null);
    const timingSource =
      medication.fieldSources.timingSource ??
      (medication.timingText ? 'ocr' : suggestedTiming ? 'suggested' : null);

    return {
      ...medication,
      normalizedFields: {
        ...medication.normalizedFields,
        startDate: suggestedStartDate,
        timingInstructions: suggestedTiming,
      },
      fieldSources: {
        startDateSource,
        timingSource,
      },
      confidenceFlags: medication.confidenceFlags.filter(
        (flag) => !(flag === 'missing_start_date' && suggestedStartDate)
      ),
    };
  });
}

function buildSchedulePreview(medications: ExtractedMedication[]): SchedulePreview[] {
  return buildScheduleDrafts(medications.map(mapMedicationToInstructionDraft)).map((draft) => {
    const matchingMedication = medications.find(
      (medication) => medication.id === draft.extractedMedicationId
    );

    return {
      ...draft,
      endDate: inferScheduleEndDate(
        matchingMedication?.normalizedFields.startDate ?? null,
        matchingMedication?.normalizedFields.duration ?? null
      ),
    };
  });
}

function assertFinalizeableSchedules(schedulePreviews: SchedulePreview[]) {
  const invalidSchedules = schedulePreviews.filter(
    (schedule) => !validateScheduleDraft(schedule).isValid
  );

  if (invalidSchedules.length > 0) {
    const medicationNames = invalidSchedules.map((schedule) => schedule.medicationName).join(', ');
    throw new Error(`Review is still incomplete for: ${medicationNames}.`);
  }
}

async function getSupabaseUserId() {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

async function requireSupabaseUserId() {
  const userId = await getSupabaseUserId();

  if (!userId) {
    throw new Error('A signed-in user is required for Supabase persistence.');
  }

  return userId;
}

async function resolveFunctionInvokeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Supabase OCR invocation failed.';
  }

  const response = (error as Error & { context?: Response }).context;

  if (!response) {
    return error.message || 'Supabase OCR invocation failed.';
  }

  try {
    const payload = await response.clone().json();

    if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
      return payload.error;
    }

    return JSON.stringify(payload);
  } catch {
    try {
      const text = await response.clone().text();
      return text || error.message || 'Supabase OCR invocation failed.';
    } catch {
      return error.message || 'Supabase OCR invocation failed.';
    }
  }
}

async function createSupabaseDraft(userId: string): Promise<PrescriptionDraftResult> {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const { data, error } = await supabase
    .from('prescriptions')
    .insert({
      user_id: userId,
      status: 'draft',
      review_required: true,
      source_type: 'upload',
    })
    .select('id, status')
    .single();

  if (error) {
    throw error;
  }

  const timestamp = createTimestamp();
  localStore.prescriptions.set(data.id, {
    id: data.id,
    userId,
    status: data.status,
    activeExtractionRunId: null,
    rawOcrText: null,
    reviewRequired: true,
    handwritingDetected: false,
    finalizedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return {
    id: data.id,
    status: data.status,
    source: 'supabase',
  };
}

async function triggerSupabaseAnalysis(prescriptionId: string) {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const { data: existingRun, error: existingRunError } = await supabase
    .from('extraction_runs')
    .select('id, provider, provider_model, status')
    .eq('prescription_id', prescriptionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRunError) {
    throw existingRunError;
  }

  if (existingRun?.id && existingRun.status !== 'failed') {
    return {
      extractionRunId: existingRun.id,
      analysisSource: existingRun.provider === 'mock-seeded' ? ('mock' as const) : ('live' as const),
      provider: existingRun.provider,
    };
  }

  const { data: imageRow, error: imageError } = await supabase
    .from('prescription_images')
    .select('storage_path, mime_type')
    .eq('prescription_id', prescriptionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (imageError) {
    throw imageError;
  }

  const localImage = storageService.getLatestLocalImage(prescriptionId);

  if (!imageRow?.storage_path && localImage) {
    return {
      extractionRunId: ensureLocalMockExtraction(prescriptionId),
      analysisSource: 'mock' as const,
      provider: 'local-fallback',
      fallbackSource: 'local' as const,
    };
  }

  const useMockData = !imageRow?.storage_path;
  const { data, error } = await supabase.functions.invoke<AnalyzePrescriptionResult>(
    'analyze-prescription',
    {
      body: {
        prescriptionId,
        storageBucket: 'prescription-images',
        imagePath: imageRow?.storage_path,
        mimeType: imageRow?.mime_type,
        useMockData,
      },
    }
  );

  if (error) {
    if (useMockData) {
      return {
        extractionRunId: ensureLocalMockExtraction(prescriptionId),
        analysisSource: 'mock' as const,
        provider: 'local-fallback',
        fallbackSource: 'local' as const,
      };
    }

    throw new Error(await resolveFunctionInvokeErrorMessage(error));
  }

  if (!data) {
    throw new Error('Prescription analysis returned no data.');
  }

  return {
    extractionRunId: data.extractionRunId,
    analysisSource: data.source,
    provider: data.provider,
    fallbackSource: 'supabase' as const,
  };
}

function createLocalDraft(): PrescriptionDraftResult {
  const id = createUuid();
  const timestamp = createTimestamp();

  localStore.prescriptions.set(id, {
    id,
    userId: LOCAL_USER_ID,
    status: 'draft',
    activeExtractionRunId: null,
    rawOcrText: null,
    reviewRequired: true,
    handwritingDetected: false,
    finalizedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return {
    id,
    status: 'draft',
    source: 'local',
  };
}

function ensureLocalMockExtraction(prescriptionId: string) {
  const existingPrescription = localStore.prescriptions.get(prescriptionId);

  if (!existingPrescription) {
    throw new Error('Local prescription draft was not found.');
  }

  if (existingPrescription.activeExtractionRunId) {
    return existingPrescription.activeExtractionRunId;
  }

  const extractionRunId = createUuid();
  const createdAt = createTimestamp();
  const extractionSeed = buildMockMedicationSeed(prescriptionId, extractionRunId, createdAt);

  localStore.extractionRuns.set(extractionRunId, {
    id: extractionRunId,
    prescriptionId,
    provider: 'mock-seeded',
    providerModel: 'fixture-v1',
    parserVersion: 'v1',
    status: 'completed',
    rawOcrText: extractionSeed.rawOcrText,
    overallConfidence: 0.84,
    issues: ['missing_required_field', 'unsupported_instruction_pattern'],
    providerResponse: {
      seeded: true,
    },
    startedAt: createdAt,
    completedAt: createdAt,
    failureCode: null,
    failureMessage: null,
    createdAt,
  });

  localStore.extractedMedications.set(extractionRunId, extractionSeed.medications);
  localStore.prescriptions.set(prescriptionId, {
    ...existingPrescription,
    status: 'needs_review',
    activeExtractionRunId: extractionRunId,
    rawOcrText: extractionSeed.rawOcrText,
    updatedAt: createdAt,
  });

  return extractionRunId;
}

async function updateSupabaseReviewedMedications(params: {
  prescriptionId: string;
  extractionRunId: string;
  medications: MedicationInstructionDraft[];
}) {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const userId = await requireSupabaseUserId();
  const submittedAt = createTimestamp();

  const { error: reviewInsertError } = await supabase.from('parsing_reviews').insert({
    prescription_id: params.prescriptionId,
    extraction_run_id: params.extractionRunId,
    reviewed_by: userId,
    status: 'reviewed',
    field_edits: {
      medications: params.medications.map((medication) => ({
        extractedMedicationId: medication.extractedMedicationId,
        normalizedFields: toDbNormalizedFields(medication),
      })),
    },
    submitted_at: submittedAt,
  });

  if (reviewInsertError) {
    throw reviewInsertError;
  }

  for (const medication of params.medications) {
    if (!medication.extractedMedicationId) {
      continue;
    }

    const preview = buildScheduleDrafts([medication])[0];

    const { error } = await supabase
      .from('extracted_medications')
      .update({
        medication_name: medication.medicationName,
        strength_text: medication.strength,
        dosage_text: medication.dosage,
        frequency_text: medication.frequency,
        timing_text: medication.timingInstructions,
        duration_text: medication.duration,
        start_date_text: medication.startDate,
        notes_text: medication.notes,
        normalized_fields: toDbNormalizedFields(medication),
        review_status: 'reviewed',
        is_schedule_generatable: preview.items.length > 0,
      })
      .eq('id', medication.extractedMedicationId)
      .eq('prescription_id', params.prescriptionId);

    if (error) {
      throw error;
    }
  }

  const { error: prescriptionError } = await supabase
    .from('prescriptions')
    .update({
      status: 'ready_for_schedule',
      review_required: false,
    })
    .eq('id', params.prescriptionId)
    .eq('user_id', userId);

  if (prescriptionError) {
    throw prescriptionError;
  }
}

function updateLocalReviewedMedications(params: {
  prescriptionId: string;
  extractionRunId: string;
  medications: MedicationInstructionDraft[];
}) {
  const storedMedications = localStore.extractedMedications.get(params.extractionRunId) ?? [];
  const updatedAt = createTimestamp();

  const updated = storedMedications.map((storedMedication) => {
    const editedMedication = params.medications.find(
      (medication) => medication.extractedMedicationId === storedMedication.id
    );

    if (!editedMedication) {
      return storedMedication;
    }

    const preview = buildScheduleDrafts([editedMedication])[0];

    return {
      ...storedMedication,
      strengthText: editedMedication.strength,
      dosageText: editedMedication.dosage,
      frequencyText: editedMedication.frequency,
      timingText: editedMedication.timingInstructions,
      durationText: editedMedication.duration,
      startDateText: editedMedication.startDate,
      notesText: editedMedication.notes,
      normalizedFields: toDbNormalizedFields(editedMedication),
      reviewStatus: 'reviewed',
      isScheduleGeneratable: preview.items.length > 0,
      createdAt: updatedAt,
    };
  });

  localStore.extractedMedications.set(params.extractionRunId, updated);

  const existingPrescription = localStore.prescriptions.get(params.prescriptionId);

  if (existingPrescription) {
    localStore.prescriptions.set(params.prescriptionId, {
      ...existingPrescription,
      status: 'ready_for_schedule',
      reviewRequired: false,
      updatedAt,
    });
  }
}

async function finalizeSupabaseSchedules(params: {
  prescriptionId: string;
  schedules: SchedulePreview[];
  medications: ExtractedMedication[];
}) {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const userId = await requireSupabaseUserId();
  const timestamp = createTimestamp();
  const { data: existingSchedules, error: existingSchedulesError } = await supabase
    .from('medication_schedules')
    .select('id')
    .eq('prescription_id', params.prescriptionId)
    .eq('user_id', userId);

  if (existingSchedulesError) {
    throw existingSchedulesError;
  }

  const existingScheduleIds = (existingSchedules ?? []).map((schedule) => schedule.id);

  if (existingScheduleIds.length > 0) {
    const { error: deleteEventsError } = await supabase
      .from('medication_schedule_events')
      .delete()
      .in('schedule_id', existingScheduleIds);

    if (deleteEventsError) {
      throw deleteEventsError;
    }
  }

  const { error: deleteSchedulesError } = await supabase
    .from('medication_schedules')
    .delete()
    .eq('prescription_id', params.prescriptionId)
    .eq('user_id', userId);

  if (deleteSchedulesError) {
    throw deleteSchedulesError;
  }

  for (const schedulePreview of params.schedules) {
    const matchingMedication = params.medications.find(
      (medication) => medication.id === schedulePreview.extractedMedicationId
    );

    const startDate = matchingMedication?.normalizedFields.startDate;

    if (!startDate) {
      throw new Error(`Start date is missing for ${schedulePreview.medicationName}.`);
    }

    const scheduleId = createUuid();
    const endDate =
      schedulePreview.endDate ??
      inferScheduleEndDate(startDate, matchingMedication?.normalizedFields.duration ?? null);

    const scheduleRow = {
      id: scheduleId,
      prescription_id: params.prescriptionId,
      extracted_medication_id: schedulePreview.extractedMedicationId,
      user_id: userId,
      status: 'active',
      source: 'ocr_reviewed',
      timezone: 'Asia/Dubai',
      start_date: startDate,
      end_date: endDate,
      schedule_type: schedulePreview.items.some((item) => item.anchorType === 'interval')
        ? 'interval'
        : 'daily',
      instructions_snapshot: {
        medicationName: schedulePreview.medicationName,
        items: schedulePreview.items,
      },
      schedule_config: {
        issues: schedulePreview.issues,
      },
      requires_confirmation: false,
      confirmed_at: timestamp,
    } as const;

    const { error: scheduleInsertError } = await supabase
      .from('medication_schedules')
      .insert(scheduleRow);

    if (scheduleInsertError) {
      throw scheduleInsertError;
    }

    const events = materializeScheduleEvents({
      scheduleId,
      draft: schedulePreview,
      startDate,
      endDate,
    });

    if (events.length > 0) {
      const { error: eventInsertError } = await supabase.from('medication_schedule_events').insert(
        events.map((event) => ({
          schedule_id: event.scheduleId,
          event_date: event.eventDate,
          event_datetime: event.eventDateTime,
          sequence_no: event.sequenceNo,
          anchor_type: event.anchorType,
          is_generated: event.isGenerated,
          generation_source: event.generationSource,
        }))
      );

      if (eventInsertError) {
        throw eventInsertError;
      }
    }
  }

  const { error: prescriptionError } = await supabase
    .from('prescriptions')
    .update({
      status: 'finalized',
      finalized_at: timestamp,
      review_required: false,
    })
    .eq('id', params.prescriptionId)
    .eq('user_id', userId);

  if (prescriptionError) {
    throw prescriptionError;
  }
}

function finalizeLocalSchedules(params: {
  prescriptionId: string;
  schedules: SchedulePreview[];
  medications: ExtractedMedication[];
}) {
  const timestamp = createTimestamp();
  const scheduleRecords: MedicationSchedule[] = [];
  const scheduleEvents: MedicationScheduleEvent[] = [];

  for (const schedulePreview of params.schedules) {
    const matchingMedication = params.medications.find(
      (medication) => medication.id === schedulePreview.extractedMedicationId
    );

    const startDate = matchingMedication?.normalizedFields.startDate;

    if (!startDate) {
      throw new Error(`Start date is missing for ${schedulePreview.medicationName}.`);
    }

    const scheduleId = createUuid();
    const endDate =
      schedulePreview.endDate ??
      inferScheduleEndDate(startDate, matchingMedication?.normalizedFields.duration ?? null);

    scheduleRecords.push({
      id: scheduleId,
      prescriptionId: params.prescriptionId,
      extractedMedicationId: schedulePreview.extractedMedicationId,
      userId: LOCAL_USER_ID,
      status: 'active',
      source: 'ocr_reviewed',
      timezone: 'Asia/Dubai',
      startDate,
      endDate,
      scheduleType: schedulePreview.items.some((item) => item.anchorType === 'interval')
        ? 'interval'
        : 'daily',
      instructionsSnapshot: {
        medicationName: schedulePreview.medicationName,
        items: schedulePreview.items,
      },
      scheduleConfig: {
        issues: schedulePreview.issues,
      },
      requiresConfirmation: false,
      confirmedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const events = materializeScheduleEvents({
      scheduleId,
      draft: schedulePreview,
      startDate,
      endDate,
    }).map((event) => ({
      id: createUuid(),
      scheduleId: event.scheduleId,
      eventDate: event.eventDate,
      eventDateTime: event.eventDateTime,
      sequenceNo: event.sequenceNo,
      anchorType: event.anchorType,
      isGenerated: event.isGenerated,
      generationSource: event.generationSource,
      createdAt: timestamp,
    }));

    scheduleEvents.push(...events);
  }

  localStore.schedules.set(params.prescriptionId, scheduleRecords);
  localStore.scheduleEvents.set(params.prescriptionId, scheduleEvents);

  const existingPrescription = localStore.prescriptions.get(params.prescriptionId);

  if (existingPrescription) {
    localStore.prescriptions.set(params.prescriptionId, {
      ...existingPrescription,
      status: 'finalized',
      finalizedAt: timestamp,
      reviewRequired: false,
      updatedAt: timestamp,
    });
  }
}

export const prescriptionService = {
  async createDraft(): Promise<PrescriptionDraftResult> {
    if (isSupabaseConfigured) {
      const userId = await getSupabaseUserId();

      if (userId) {
        return createSupabaseDraft(userId);
      }
    }

    return createLocalDraft();
  },

  async startAnalysis(prescriptionId: string) {
    if (isSupabaseConfigured) {
      const userId = await getSupabaseUserId();

      if (userId) {
        const result = await triggerSupabaseAnalysis(prescriptionId);
        return {
          extractionRunId: result.extractionRunId,
          source: result.fallbackSource ?? ('supabase' as const),
          analysisSource: result.analysisSource,
          provider: result.provider,
        };
      }
    }

    return {
      extractionRunId: ensureLocalMockExtraction(prescriptionId),
      source: 'local' as const,
      analysisSource: 'mock' as const,
      provider: 'local-fallback',
    };
  },

  async getReviewDraft(prescriptionId: string): Promise<ReviewDraft> {
    if (isSupabaseConfigured) {
      const userId = await getSupabaseUserId();

      if (userId && supabase) {
        const analysis = await triggerSupabaseAnalysis(prescriptionId);
        const extractionRunId = analysis.extractionRunId;

        if (analysis.fallbackSource === 'local') {
          const prescription = localStore.prescriptions.get(prescriptionId);
          const medications = localStore.extractedMedications.get(extractionRunId) ?? [];

          if (!prescription) {
            throw new Error('Local prescription draft was not found.');
          }

          return {
            prescriptionId,
            extractionRunId,
            rawOcrText: prescription.rawOcrText ?? '',
            documentDate: extractDocumentDate(prescription.rawOcrText ?? ''),
            medications: applyReviewSuggestions(
              medications,
              extractDocumentDate(prescription.rawOcrText ?? '')
            ),
            source: 'local',
          };
        }

        const [
          { data: prescription, error: prescriptionError },
          { data: medications, error: medicationsError },
          { data: extractionRun, error: extractionRunError },
        ] =
          await Promise.all([
            supabase
              .from('prescriptions')
              .select('id, raw_ocr_text')
              .eq('id', prescriptionId)
              .eq('user_id', userId)
              .single(),
            supabase
              .from('extracted_medications')
              .select('*')
              .eq('prescription_id', prescriptionId)
              .eq('extraction_run_id', extractionRunId)
              .order('position_index', { ascending: true }),
            supabase
              .from('extraction_runs')
              .select('provider_response')
              .eq('id', extractionRunId)
              .maybeSingle(),
          ]);

        if (prescriptionError) {
          throw prescriptionError;
        }

        if (medicationsError) {
          throw medicationsError;
        }

        if (extractionRunError) {
          throw extractionRunError;
        }

        const documentDate =
          extractionRun?.provider_response &&
          typeof extractionRun.provider_response === 'object' &&
          'documentDate' in extractionRun.provider_response &&
          typeof extractionRun.provider_response.documentDate === 'string'
            ? extractionRun.provider_response.documentDate
            : extractDocumentDate(prescription.raw_ocr_text ?? '');
        const mappedMedications = (medications ?? []).map(mapDbMedication);

        return {
          prescriptionId,
          extractionRunId,
          rawOcrText: prescription.raw_ocr_text ?? '',
          documentDate,
          medications: applyReviewSuggestions(mappedMedications, documentDate),
          source: 'supabase',
        };
      }
    }

    const extractionRunId = ensureLocalMockExtraction(prescriptionId);
    const prescription = localStore.prescriptions.get(prescriptionId);
    const medications = localStore.extractedMedications.get(extractionRunId) ?? [];

    if (!prescription) {
      throw new Error('Local prescription draft was not found.');
    }

    return {
      prescriptionId,
      extractionRunId,
      rawOcrText: prescription.rawOcrText ?? '',
      documentDate: extractDocumentDate(prescription.rawOcrText ?? ''),
      medications: applyReviewSuggestions(
        medications,
        extractDocumentDate(prescription.rawOcrText ?? '')
      ),
      source: 'local',
    };
  },

  async getSchedulePreview(prescriptionId: string): Promise<SchedulePreview[]> {
    const reviewDraft = await this.getReviewDraft(prescriptionId);
    return buildSchedulePreview(reviewDraft.medications);
  },

  async updateReviewedMedications(params: {
    prescriptionId: string;
    extractionRunId: string;
    medications: MedicationInstructionDraft[];
  }) {
    const normalizedMedications = params.medications.map(normalizeMedicationInput);

    if (isSupabaseConfigured) {
      const userId = await getSupabaseUserId();

      if (userId) {
        await updateSupabaseReviewedMedications({
          ...params,
          medications: normalizedMedications,
        });
        return { source: 'supabase' as const };
      }
    }

    updateLocalReviewedMedications({
      ...params,
      medications: normalizedMedications,
    });
    return { source: 'local' as const };
  },

  async finalizeSchedules(prescriptionId: string) {
    const reviewDraft = await this.getReviewDraft(prescriptionId);
    const schedulePreview = buildSchedulePreview(reviewDraft.medications);

    assertFinalizeableSchedules(schedulePreview);

    if (isSupabaseConfigured) {
      const userId = await getSupabaseUserId();

      if (userId) {
        await finalizeSupabaseSchedules({
          prescriptionId,
          schedules: schedulePreview,
          medications: reviewDraft.medications,
        });
        return { source: 'supabase' as const };
      }
    }

    finalizeLocalSchedules({
      prescriptionId,
      schedules: schedulePreview,
      medications: reviewDraft.medications,
    });
    return { source: 'local' as const };
  },
};
