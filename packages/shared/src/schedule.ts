import { z } from 'zod';

import { MedicationFieldSourcesSchema } from './prescription';

export const MedicationInstructionDraftSchema = z.object({
  extractedMedicationId: z.string().uuid().nullable(),
  medicationName: z.string().trim().min(1),
  strength: z.string().trim().min(1).nullable(),
  dosage: z.string().trim().min(1).nullable(),
  frequency: z.string().trim().min(1).nullable(),
  timingInstructions: z.string().trim().min(1).nullable(),
  duration: z.string().trim().min(1).nullable(),
  startDate: z.string().trim().min(1).nullable(),
  notes: z.string().trim().min(1).nullable(),
  fieldSources: MedicationFieldSourcesSchema.optional(),
});

export const scheduleStatuses = [
  'draft',
  'ready_for_confirmation',
  'confirmed',
  'active',
  'archived',
] as const;

export const scheduleAnchorTypes = [
  'custom_time',
  'morning',
  'noon',
  'evening',
  'bedtime',
  'after_meal',
  'before_meal',
  'interval',
] as const;

export const scheduleGenerationIssueCodes = [
  'missing_start_date',
  'missing_time_anchor',
  'unsupported_frequency',
  'unsupported_taper',
  'ambiguous_instruction',
  'manual_confirmation_required',
] as const;

export type ScheduleStatus = (typeof scheduleStatuses)[number];
export type ScheduleAnchorType = (typeof scheduleAnchorTypes)[number];
export type ScheduleGenerationIssueCode = (typeof scheduleGenerationIssueCodes)[number];

export const ScheduleStatusSchema = z.enum(scheduleStatuses);
export const ScheduleAnchorTypeSchema = z.enum(scheduleAnchorTypes);
export const ScheduleGenerationIssueCodeSchema = z.enum(scheduleGenerationIssueCodes);

export const ScheduleGenerationIssueSchema = z.object({
  code: ScheduleGenerationIssueCodeSchema,
  message: z.string().min(1),
  field: z.string().min(1).nullable(),
});

export const ScheduleDraftItemSchema = z.object({
  label: z.string().min(1),
  anchorType: ScheduleAnchorTypeSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  intervalHours: z.number().int().positive().nullable(),
  instructions: z.string().min(1),
});

export const MedicationScheduleSchema = z.object({
  id: z.string().uuid(),
  prescriptionId: z.string().uuid(),
  extractedMedicationId: z.string().uuid().nullable(),
  userId: z.string().uuid(),
  status: ScheduleStatusSchema,
  source: z.enum(['manual', 'ocr_reviewed']),
  timezone: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date().nullable(),
  scheduleType: z.enum(['daily', 'interval', 'contextual', 'manual']),
  instructionsSnapshot: z.record(z.string(), z.unknown()),
  scheduleConfig: z.record(z.string(), z.unknown()),
  requiresConfirmation: z.boolean(),
  confirmedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const MedicationScheduleEventSchema = z.object({
  id: z.string().uuid(),
  scheduleId: z.string().uuid(),
  eventDate: z.string().date(),
  eventDateTime: z.string().datetime(),
  sequenceNo: z.number().int().nonnegative(),
  anchorType: ScheduleAnchorTypeSchema,
  isGenerated: z.boolean(),
  generationSource: z.enum(['schedule_engine', 'manual']),
  createdAt: z.string().datetime(),
});

export const ScheduleDraftSchema = z.object({
  medicationName: z.string().min(1),
  extractedMedicationId: z.string().uuid().nullable(),
  items: z.array(ScheduleDraftItemSchema),
  issues: z.array(ScheduleGenerationIssueSchema).default([]),
  requiresUserConfirmation: z.boolean(),
});

export type MedicationInstructionDraft = z.infer<typeof MedicationInstructionDraftSchema>;
export type ScheduleGenerationIssue = z.infer<typeof ScheduleGenerationIssueSchema>;
export type ScheduleDraftItem = z.infer<typeof ScheduleDraftItemSchema>;
export type MedicationSchedule = z.infer<typeof MedicationScheduleSchema>;
export type MedicationScheduleEvent = z.infer<typeof MedicationScheduleEventSchema>;
export type ScheduleDraft = z.infer<typeof ScheduleDraftSchema>;
