import { z } from 'zod';

export const prescriptionStatuses = [
  'draft',
  'processing',
  'needs_review',
  'ocr_failed',
  'ready_for_schedule',
  'finalized',
] as const;

export const extractionRunStatuses = [
  'queued',
  'processing',
  'completed',
  'failed',
] as const;

export const reviewStatuses = [
  'pending',
  'reviewed',
  'confirmed',
  'rejected',
] as const;

export const confidenceFlags = [
  'low_ocr_confidence',
  'ambiguous_medication',
  'ambiguous_strength',
  'ambiguous_dosage',
  'ambiguous_frequency',
  'ambiguous_timing',
  'missing_duration',
  'missing_start_date',
  'handwriting_detected',
  'manual_review_required',
] as const;

export const parsingIssueCodes = [
  'unrecognized_medication',
  'unrecognized_strength',
  'unrecognized_dosage',
  'unrecognized_frequency',
  'unrecognized_timing',
  'unrecognized_duration',
  'missing_required_field',
  'unsupported_instruction_pattern',
] as const;

export const medicationFieldSources = ['ocr', 'suggested', 'user'] as const;

export type PrescriptionStatus = (typeof prescriptionStatuses)[number];
export type ExtractionRunStatus = (typeof extractionRunStatuses)[number];
export type ReviewStatus = (typeof reviewStatuses)[number];
export type ConfidenceFlag = (typeof confidenceFlags)[number];
export type ParsingIssueCode = (typeof parsingIssueCodes)[number];
export type MedicationFieldSource = (typeof medicationFieldSources)[number];

export const PrescriptionStatusSchema = z.enum(prescriptionStatuses);
export const ExtractionRunStatusSchema = z.enum(extractionRunStatuses);
export const ReviewStatusSchema = z.enum(reviewStatuses);
export const ConfidenceFlagSchema = z.enum(confidenceFlags);
export const ParsingIssueCodeSchema = z.enum(parsingIssueCodes);
export const MedicationFieldSourceSchema = z.enum(medicationFieldSources);

export const MedicationFieldSourcesSchema = z.object({
  startDateSource: MedicationFieldSourceSchema.nullable(),
  timingSource: MedicationFieldSourceSchema.nullable(),
});

export const NormalizedMedicationFieldsSchema = z.object({
  medicationName: z.string().trim().min(1).nullable(),
  strength: z.string().trim().min(1).nullable(),
  dosage: z.string().trim().min(1).nullable(),
  frequency: z.string().trim().min(1).nullable(),
  timingInstructions: z.string().trim().min(1).nullable(),
  duration: z.string().trim().min(1).nullable(),
  startDate: z.string().trim().min(1).nullable(),
  notes: z.string().trim().min(1).nullable(),
});

export const PrescriptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: PrescriptionStatusSchema,
  activeExtractionRunId: z.string().uuid().nullable(),
  rawOcrText: z.string().nullable(),
  reviewRequired: z.boolean(),
  handwritingDetected: z.boolean().default(false),
  finalizedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PrescriptionImageSchema = z.object({
  id: z.string().uuid(),
  prescriptionId: z.string().uuid(),
  storagePath: z.string().min(1),
  mimeType: z.string().min(1),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  fileSizeBytes: z.number().int().nonnegative().nullable(),
  sha256: z.string().min(1).nullable(),
  isOriginal: z.boolean().default(true),
  captureSource: z.enum(['camera', 'gallery', 'upload']),
  preprocessMeta: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
});

export const ExtractionRunSchema = z.object({
  id: z.string().uuid(),
  prescriptionId: z.string().uuid(),
  provider: z.string().min(1),
  providerModel: z.string().min(1).nullable(),
  parserVersion: z.string().min(1),
  status: ExtractionRunStatusSchema,
  rawOcrText: z.string().nullable(),
  overallConfidence: z.number().min(0).max(1).nullable(),
  issues: z.array(ParsingIssueCodeSchema).default([]),
  providerResponse: z.record(z.string(), z.unknown()).nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failureCode: z.string().min(1).nullable(),
  failureMessage: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
});

export const ExtractedMedicationSchema = z.object({
  id: z.string().uuid(),
  prescriptionId: z.string().uuid(),
  extractionRunId: z.string().uuid(),
  positionIndex: z.number().int().nonnegative(),
  rawMedicationText: z.string().min(1),
  strengthText: z.string().nullable(),
  dosageText: z.string().nullable(),
  frequencyText: z.string().nullable(),
  timingText: z.string().nullable(),
  durationText: z.string().nullable(),
  startDateText: z.string().nullable(),
  notesText: z.string().nullable(),
  normalizedFields: NormalizedMedicationFieldsSchema,
  fieldSources: MedicationFieldSourcesSchema.default({
    startDateSource: null,
    timingSource: null,
  }),
  confidenceFlags: z.array(ConfidenceFlagSchema).default([]),
  parsingIssues: z.array(ParsingIssueCodeSchema).default([]),
  reviewStatus: ReviewStatusSchema,
  isScheduleGeneratable: z.boolean(),
  createdAt: z.string().datetime(),
});

export const ParsingReviewSchema = z.object({
  id: z.string().uuid(),
  prescriptionId: z.string().uuid(),
  extractionRunId: z.string().uuid(),
  reviewedBy: z.string().uuid(),
  status: ReviewStatusSchema,
  fieldEdits: z.record(z.string(), z.unknown()).default({}),
  issueResolutions: z.record(z.string(), z.unknown()).default({}),
  submittedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type NormalizedMedicationFields = z.infer<typeof NormalizedMedicationFieldsSchema>;
export type Prescription = z.infer<typeof PrescriptionSchema>;
export type PrescriptionImage = z.infer<typeof PrescriptionImageSchema>;
export type ExtractionRun = z.infer<typeof ExtractionRunSchema>;
export type ExtractedMedication = z.infer<typeof ExtractedMedicationSchema>;
export type ParsingReview = z.infer<typeof ParsingReviewSchema>;
