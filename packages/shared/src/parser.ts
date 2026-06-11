import { z } from 'zod';

import { ExtractedMedicationSchema, ParsingIssueCodeSchema } from './prescription';
import { MedicationInstructionDraftSchema, ScheduleDraftSchema } from './schedule';

export const AnalyzePrescriptionRequestSchema = z.object({
  prescriptionId: z.string().uuid(),
  imagePath: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  storageBucket: z.string().min(1).default('prescription-images'),
  useMockData: z.boolean().default(false),
});

export const AnalyzePrescriptionResultSchema = z.object({
  extractionRunId: z.string().uuid(),
  status: z.enum(['completed', 'failed']),
  provider: z.string().min(1),
  source: z.enum(['live', 'mock']),
  rawOcrText: z.string().nullable(),
  documentDate: z.string().date().nullable(),
  medications: z.array(ExtractedMedicationSchema),
  issues: z.array(ParsingIssueCodeSchema).default([]),
  requiresReview: z.boolean(),
});

export const ReviewMedicationDraftInputSchema = z.object({
  prescriptionId: z.string().uuid(),
  extractionRunId: z.string().uuid(),
  medications: z.array(
    z.object({
      extractedMedicationId: z.string().uuid().nullable(),
      normalizedFields: z.object({
        medicationName: z.string().trim().min(1),
        strength: z.string().trim().min(1).nullable(),
        dosage: z.string().trim().min(1).nullable(),
        frequency: z.string().trim().min(1).nullable(),
        timingInstructions: z.string().trim().min(1).nullable(),
        duration: z.string().trim().min(1).nullable(),
        startDate: z.string().trim().min(1).nullable(),
        notes: z.string().trim().min(1).nullable(),
      }),
    })
  ),
});

export const GenerateScheduleDraftInputSchema = z.object({
  prescriptionId: z.string().uuid(),
  userId: z.string().uuid(),
  timezone: z.string().min(1),
  medications: z.array(MedicationInstructionDraftSchema),
});

export const GenerateScheduleDraftResultSchema = z.object({
  schedules: z.array(
    z.object({
      medicationName: z.string().min(1),
      draft: ScheduleDraftSchema,
    })
  ),
});

export const FinalizeScheduleInputSchema = z.object({
  prescriptionId: z.string().uuid(),
  userId: z.string().uuid(),
  schedules: z.array(
    z.object({
      extractedMedicationId: z.string().uuid().nullable(),
      draft: ScheduleDraftSchema,
    })
  ),
});

export type AnalyzePrescriptionRequest = z.infer<typeof AnalyzePrescriptionRequestSchema>;
export type AnalyzePrescriptionResult = z.infer<typeof AnalyzePrescriptionResultSchema>;
export type ReviewMedicationDraftInput = z.infer<typeof ReviewMedicationDraftInputSchema>;
export type GenerateScheduleDraftInput = z.infer<typeof GenerateScheduleDraftInputSchema>;
export type GenerateScheduleDraftResult = z.infer<typeof GenerateScheduleDraftResultSchema>;
export type FinalizeScheduleInput = z.infer<typeof FinalizeScheduleInputSchema>;
