import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usePrescriptionDraft } from '@/src/features/prescriptions/hooks/use-prescription-draft';
import { prescriptionService } from '@/src/features/prescriptions/services/prescription-service';

type EditableMedication = {
  extractedMedicationId: string | null;
  medicationName: string;
  strength: string;
  dosage: string;
  frequency: string;
  timingInstructions: string;
  duration: string;
  startDate: string;
  notes: string;
  timingSource: 'ocr' | 'suggested' | 'user' | null;
  startDateSource: 'ocr' | 'suggested' | 'user' | null;
};

type SourceBadgeTone = 'detected' | 'suggested' | 'edited';

const DOSAGE_PRESETS = ['1 tab', '2 tabs', '10 mL', '2 puffs'];
const FREQUENCY_PRESETS = ['once daily', 'twice daily', 'three times daily', 'as needed'];
const TIMING_PRESETS = [
  'morning',
  'afternoon',
  'evening',
  'morning and evening',
  'morning, afternoon, and evening',
  'after meals',
  'before bedtime',
];
const DURATION_PRESETS = ['3 Day(s)', '4 Day(s)', '5 Day(s)', '7 Day(s)'];

function formatCodeLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getConfidenceFlagLabel(flag: string) {
  switch (flag) {
    case 'missing_start_date':
      return 'Add a start date before this medication can be scheduled.';
    case 'manual_review_required':
      return 'Review these instructions carefully before saving.';
    case 'ambiguous_frequency':
      return 'Frequency needs clarification.';
    case 'ambiguous_timing':
      return 'Timing instructions need clarification.';
    case 'ambiguous_medication':
      return 'Medication name may be incomplete.';
    case 'ambiguous_strength':
      return 'Strength may be incomplete.';
    case 'ambiguous_dosage':
      return 'Dosage may be incomplete.';
    case 'missing_duration':
      return 'Duration may still need confirmation.';
    case 'handwriting_detected':
      return 'Handwriting was detected, so review should be extra careful.';
    case 'low_ocr_confidence':
      return 'The extracted text may be unreliable.';
    default:
      return formatCodeLabel(flag);
  }
}

function getParsingIssueLabel(issue: string) {
  switch (issue) {
    case 'unsupported_instruction_pattern':
      return 'This instruction pattern may need manual schedule entry.';
    case 'missing_required_field':
      return 'Some required details are still missing.';
    case 'unrecognized_medication':
      return 'Medication name could not be read confidently.';
    case 'unrecognized_strength':
      return 'Strength could not be read confidently.';
    case 'unrecognized_dosage':
      return 'Dosage could not be read confidently.';
    case 'unrecognized_frequency':
      return 'Frequency could not be read confidently.';
    case 'unrecognized_timing':
      return 'Timing instructions could not be read confidently.';
    case 'unrecognized_duration':
      return 'Duration could not be read confidently.';
    default:
      return formatCodeLabel(issue);
  }
}

function getSourceBadgeLabel(source: SourceBadgeTone) {
  switch (source) {
    case 'detected':
      return 'Detected';
    case 'suggested':
      return 'Suggested';
    case 'edited':
      return 'Edited';
  }
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function hasPrnNote(value: string) {
  return /\b(prn|as needed)\b/i.test(value);
}

function deriveTimingSuggestion(frequency: string, notes: string) {
  if (hasPrnNote(notes)) {
    return null;
  }

  switch (normalizeValue(frequency)) {
    case 'once daily':
      return 'morning';
    case 'twice daily':
      return 'morning and evening';
    case 'three times daily':
      return 'morning, afternoon, and evening';
    default:
      return null;
  }
}

export default function ReviewPrescriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = usePrescriptionDraft(id);
  const [editableMedications, setEditableMedications] = useState<EditableMedication[]>([]);
  const [reviewDocumentDate, setReviewDocumentDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRawTextExpanded, setIsRawTextExpanded] = useState(false);
  const [expandedSecondaryNotes, setExpandedSecondaryNotes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) {
      return;
    }

    setEditableMedications(
      data.medications.map((medication) => ({
        extractedMedicationId: medication.id,
        medicationName: medication.normalizedFields.medicationName ?? '',
        strength: medication.normalizedFields.strength ?? '',
        dosage: medication.normalizedFields.dosage ?? '',
        frequency: medication.normalizedFields.frequency ?? '',
        timingInstructions: medication.normalizedFields.timingInstructions ?? '',
        duration: medication.normalizedFields.duration ?? '',
        startDate: medication.normalizedFields.startDate ?? data.documentDate ?? '',
        notes: medication.normalizedFields.notes ?? '',
        timingSource: medication.fieldSources.timingSource,
        startDateSource:
          medication.fieldSources.startDateSource ??
          (medication.normalizedFields.startDate || medication.startDateText
            ? null
            : data.documentDate
              ? 'suggested'
              : null),
      }))
    );
    setReviewDocumentDate(data.documentDate ?? '');
  }, [data]);

  function updateReviewDocumentDate(value: string) {
    const previousDocumentDate = reviewDocumentDate.trim();
    const nextDocumentDate = value.trim();

    setReviewDocumentDate(value);
    setEditableMedications((current) =>
      current.map((medication) => {
        if (medication.startDateSource === 'ocr') {
          return medication;
        }

        const shouldSyncStartDate =
          !medication.startDate.trim() ||
          (previousDocumentDate.length > 0 &&
            medication.startDate.trim() === previousDocumentDate &&
            (medication.startDateSource === 'suggested' || medication.startDateSource === 'user'));

        if (!shouldSyncStartDate) {
          return medication;
        }

        return {
          ...medication,
          startDate: nextDocumentDate,
          startDateSource: nextDocumentDate ? 'user' : null,
        };
      })
    );
  }

  function updateMedicationField(
    extractedMedicationId: string | null,
    field: keyof EditableMedication,
    value: string
  ) {
    setEditableMedications((current) =>
      current.map((medication) =>
        medication.extractedMedicationId === extractedMedicationId
          ? {
              ...medication,
              ...(field === 'timingInstructions'
                ? {
                    timingInstructions: value,
                    timingSource: value.trim() ? 'user' : null,
                  }
                : field === 'startDate'
                  ? {
                      startDate: value,
                      startDateSource: value.trim() ? 'user' : null,
                    }
                  : {
                      [field]: value,
                    }),
            }
          : medication
      )
    );
  }

  function applyMedicationPatch(
    extractedMedicationId: string | null,
    patch: Partial<EditableMedication>
  ) {
    setEditableMedications((current) =>
      current.map((medication) =>
        medication.extractedMedicationId === extractedMedicationId
          ? {
              ...medication,
              ...patch,
            }
          : medication
      )
    );
  }

  function applyDosagePreset(extractedMedicationId: string | null, value: string) {
    applyMedicationPatch(extractedMedicationId, { dosage: value });
  }

  function applyDurationPreset(extractedMedicationId: string | null, value: string) {
    applyMedicationPatch(extractedMedicationId, { duration: value });
  }

  function applyTimingPreset(extractedMedicationId: string | null, value: string) {
    applyMedicationPatch(extractedMedicationId, {
      timingInstructions: value,
      timingSource: 'user',
    });
  }

  function applyFrequencyPreset(extractedMedicationId: string | null, value: string) {
    setEditableMedications((current) =>
      current.map((medication) => {
        if (medication.extractedMedicationId !== extractedMedicationId) {
          return medication;
        }

        if (value === 'as needed') {
          return {
            ...medication,
            notes: hasPrnNote(medication.notes) ? medication.notes : 'prn',
            timingInstructions: '',
            timingSource: null,
          };
        }

        const suggestedTiming = deriveTimingSuggestion(value, medication.notes);
        const shouldRefreshTiming =
          !medication.timingInstructions.trim() || medication.timingSource === 'suggested';

        return {
          ...medication,
          frequency: value,
          ...(shouldRefreshTiming && suggestedTiming
            ? {
                timingInstructions: suggestedTiming,
                timingSource: 'suggested' as const,
              }
            : {}),
        };
      })
    );
  }

  function clearMedicationField(
    extractedMedicationId: string | null,
    field: keyof EditableMedication
  ) {
    setEditableMedications((current) =>
      current.map((medication) => {
        if (medication.extractedMedicationId !== extractedMedicationId) {
          return medication;
        }

        if (field === 'timingInstructions') {
          return {
            ...medication,
            timingInstructions: '',
            timingSource: null,
          };
        }

        if (field === 'startDate') {
          return {
            ...medication,
            startDate: '',
            startDateSource: null,
          };
        }

        return {
          ...medication,
          [field]: '',
        };
      })
    );
  }

  function useSuggestedTiming(extractedMedicationId: string | null, frequency: string, notes: string) {
    const suggestion = deriveTimingSuggestion(frequency, notes);

    if (!suggestion) {
      return;
    }

    applyMedicationPatch(extractedMedicationId, {
      timingInstructions: suggestion,
      timingSource: 'suggested',
    });
  }

  function usePrescriptionDate(extractedMedicationId: string | null) {
    const trimmedDate = reviewDocumentDate.trim();

    if (!trimmedDate) {
      return;
    }

    applyMedicationPatch(extractedMedicationId, {
      startDate: trimmedDate,
      startDateSource: 'suggested',
    });
  }

  function togglePrn(extractedMedicationId: string | null) {
    setEditableMedications((current) =>
      current.map((medication) => {
        if (medication.extractedMedicationId !== extractedMedicationId) {
          return medication;
        }

        if (hasPrnNote(medication.notes)) {
          return {
            ...medication,
            notes: '',
          };
        }

        return {
          ...medication,
          notes: 'prn',
          timingInstructions: '',
          timingSource: null,
        };
      })
    );
  }

  function applyTimingToSimilar(
    extractedMedicationId: string | null,
    timingInstructions: string,
    frequency: string,
    notes: string
  ) {
    if (!timingInstructions.trim() || !frequency.trim() || hasPrnNote(notes)) {
      return;
    }

    setEditableMedications((current) =>
      current.map((medication) => {
        if (medication.extractedMedicationId === extractedMedicationId) {
          return medication;
        }

        const sameFrequency = normalizeValue(medication.frequency) === normalizeValue(frequency);
        const canReceiveTiming =
          sameFrequency &&
          !hasPrnNote(medication.notes) &&
          (!medication.timingInstructions.trim() || medication.timingSource === 'suggested');

        if (!canReceiveTiming) {
          return medication;
        }

        return {
          ...medication,
          timingInstructions,
          timingSource: 'user',
        };
      })
    );
  }

  function applyPrescriptionDateToMissing() {
    const trimmedDate = reviewDocumentDate.trim();

    if (!trimmedDate) {
      return;
    }

    setEditableMedications((current) =>
      current.map((medication) =>
        medication.startDate.trim()
          ? medication
          : {
              ...medication,
              startDate: trimmedDate,
              startDateSource: 'user',
            }
      )
    );
  }

  function toggleSecondaryNotes(medicationId: string) {
    setExpandedSecondaryNotes((current) => ({
      ...current,
      [medicationId]: !current[medicationId],
    }));
  }

  async function saveReview() {
    if (!data) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const trimmedDate = reviewDocumentDate.trim();
      const medicationsForSave = editableMedications.map((medication) =>
        medication.startDate.trim() || !trimmedDate
          ? medication
          : {
              ...medication,
              startDate: trimmedDate,
              startDateSource: 'user' as const,
            }
      );

      setEditableMedications(medicationsForSave);

      await prescriptionService.updateReviewedMedications({
        prescriptionId: data.prescriptionId,
        extractionRunId: data.extractionRunId,
        medications: medicationsForSave.map((medication) => ({
          extractedMedicationId: medication.extractedMedicationId,
          medicationName: medication.medicationName,
          strength: medication.strength || null,
          dosage: medication.dosage || null,
          frequency: medication.frequency || null,
          timingInstructions: medication.timingInstructions || null,
          duration: medication.duration || null,
          startDate: medication.startDate || null,
          notes: medication.notes || null,
          fieldSources: {
            timingSource: medication.timingSource,
            startDateSource: medication.startDateSource,
          },
        })),
      });

      router.push(`/prescriptions/${id}/schedule`);
    } catch {
      setSaveError('Unable to save the medication review. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Loading extracted medications…</ThemedText>
      </ThemedView>
    );
  }

  if (error || !data) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>{error ?? 'Prescription review data is unavailable.'}</ThemedText>
      </ThemedView>
    );
  }

  const canApplyPrescriptionDate =
    reviewDocumentDate.trim().length > 0 &&
    editableMedications.some((medication) => !medication.startDate.trim());
  const missingStartDateCount = editableMedications.filter(
    (medication) => !medication.startDate.trim()
  ).length;
  const suggestedTimingCount = editableMedications.filter(
    (medication) => medication.timingSource === 'suggested'
  ).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.eyebrow}>Review step</ThemedText>
        <ThemedText type="title">Review Extraction</ThemedText>
        <ThemedText>
          Check the extracted details, correct anything unclear, and confirm the information before
          building the schedule.
        </ThemedText>
      </View>

      <View style={[styles.card, styles.summaryCard]}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryCopy}>
            <ThemedText type="subtitle">Review source</ThemedText>
            <ThemedText>
          {data.source === 'supabase'
            ? 'Saved in your account and ready to review.'
            : 'Stored only on this device for now.'}
            </ThemedText>
          </View>
          <View style={styles.summaryChips}>
            <InfoPill
              label={data.source === 'supabase' ? 'Account-backed' : 'Device-only'}
              tone={data.source === 'supabase' ? 'success' : 'neutral'}
            />
            <InfoPill
              label={`${editableMedications.length} meds`}
              tone="neutral"
            />
          </View>
        </View>
        <View style={styles.metaList}>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Timing suggestions</ThemedText>
            <ThemedText style={styles.metaValue}>
              {suggestedTimingCount > 0
                ? `${suggestedTimingCount} ready to review`
                : 'No suggestions needed'}
            </ThemedText>
          </View>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Missing start dates</ThemedText>
            <ThemedText style={styles.metaValue}>
              {missingStartDateCount > 0 ? `${missingStartDateCount} still blank` : 'All set'}
            </ThemedText>
          </View>
        </View>
        {data.documentDate ? (
          <View style={styles.detectedBanner}>
            <ThemedText style={styles.detectedBannerTitle}>Prescription date detected</ThemedText>
            <ThemedText>{data.documentDate}</ThemedText>
          </View>
        ) : null}
      </View>

      <View style={[styles.card, styles.dateCard]}>
        <View style={styles.dateHeader}>
          <View style={styles.summaryCopy}>
            <ThemedText type="subtitle">Prescription date</ThemedText>
            <ThemedText>
          Enter the prescription date once here. It can fill any medication start dates that are
          still missing.
            </ThemedText>
          </View>
          <InfoPill
            label={
              reviewDocumentDate.trim()
                ? 'Ready to apply'
                : data.documentDate
                  ? 'Detected'
                  : 'Needs input'
            }
            tone={reviewDocumentDate.trim() ? 'success' : data.documentDate ? 'neutral' : 'warning'}
          />
        </View>
        <TextInput
          value={reviewDocumentDate}
          onChangeText={updateReviewDocumentDate}
          style={styles.input}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <ThemedText style={styles.helperText}>
          {canApplyPrescriptionDate
            ? `Apply this once to ${missingStartDateCount} medication${
                missingStartDateCount === 1 ? '' : 's'
              } that still need a start date.`
            : 'Missing medication start dates will fill automatically when you save review.'}
        </ThemedText>
        <Pressable
          style={[
            styles.secondaryAction,
            !canApplyPrescriptionDate ? styles.secondaryActionDisabled : null,
          ]}
          onPress={applyPrescriptionDateToMissing}
          disabled={!canApplyPrescriptionDate}
        >
          <ThemedText type="defaultSemiBold" style={styles.secondaryActionText}>
            Apply To Missing Start Dates
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Pressable style={styles.collapsibleHeader} onPress={() => setIsRawTextExpanded((current) => !current)}>
          <View style={styles.summaryCopy}>
            <ThemedText type="subtitle">Extracted text</ThemedText>
            <ThemedText style={styles.helperText}>
              Keep this collapsed unless you need to compare the OCR output directly.
            </ThemedText>
          </View>
          <InfoPill label={isRawTextExpanded ? 'Hide' : 'Show'} tone="neutral" />
        </Pressable>
        {isRawTextExpanded ? (
          <ThemedText>
            {data.rawOcrText || 'No text was extracted yet. You can still fill in the details below.'}
          </ThemedText>
        ) : null}
      </View>

      {data.medications.map((medication, index) => {
        const editableMedication = editableMedications[index];

        if (!editableMedication) {
          return null;
        }

        const originalMedicationName = medication.normalizedFields.medicationName ?? '';
        const originalStrength = medication.normalizedFields.strength ?? '';
        const originalDosage = medication.normalizedFields.dosage ?? '';
        const originalFrequency = medication.normalizedFields.frequency ?? '';
        const originalTimingInstructions = medication.normalizedFields.timingInstructions ?? '';
        const originalDuration = medication.normalizedFields.duration ?? '';
        const originalStartDate = medication.normalizedFields.startDate ?? data.documentDate ?? '';
        const originalNotes = medication.normalizedFields.notes ?? '';
        const suggestedTiming = deriveTimingSuggestion(
          editableMedication.frequency,
          editableMedication.notes
        );
        const canUseSuggestedTiming =
          !!suggestedTiming &&
          normalizeValue(editableMedication.timingInstructions) !== normalizeValue(suggestedTiming);
        const canUsePrescriptionDateForMedication =
          reviewDocumentDate.trim().length > 0 &&
          editableMedication.startDate.trim() !== reviewDocumentDate.trim();
        const isEditedMedication =
          editableMedication.medicationName.trim() !== originalMedicationName.trim() ||
          editableMedication.strength.trim() !== originalStrength.trim() ||
          editableMedication.dosage.trim() !== originalDosage.trim() ||
          editableMedication.frequency.trim() !== originalFrequency.trim() ||
          editableMedication.duration.trim() !== originalDuration.trim() ||
          editableMedication.notes.trim() !== originalNotes.trim() ||
          editableMedication.timingInstructions.trim() !== originalTimingInstructions.trim() ||
          editableMedication.startDate.trim() !== originalStartDate.trim();
        const visibleWarnings = medication.confidenceFlags.filter(
          (flag) => flag !== 'manual_review_required'
        );
        const hasSecondaryNotes = medication.confidenceFlags.includes('manual_review_required');
        const isSecondaryExpanded = expandedSecondaryNotes[medication.id] ?? false;

        const getFieldSource = (
          currentValue: string,
          originalValue: string,
          sourceHint?: EditableMedication['timingSource']
        ): SourceBadgeTone | null => {
          const normalizedCurrent = currentValue.trim();
          const normalizedOriginal = originalValue.trim();

          if (!normalizedCurrent) {
            return null;
          }

          if (normalizedCurrent !== normalizedOriginal) {
            return 'edited';
          }

          if (sourceHint === 'suggested') {
            return 'suggested';
          }

          return 'detected';
        };

        return (
          <View
            key={medication.id}
            style={[
              styles.card,
              styles.medicationCard,
              visibleWarnings.length > 0 ? styles.medicationCardWarning : null,
            ]}>
            <View style={styles.cardHeader}>
              <View style={styles.medicationTitleRow}>
                <ThemedText type="subtitle" style={styles.medicationTitle}>
                  {medication.normalizedFields.medicationName ?? 'Unresolved medication'}
                </ThemedText>
                <InfoPill
                  label={visibleWarnings.length > 0 ? 'Needs review' : 'Ready'}
                  tone={visibleWarnings.length > 0 ? 'warning' : 'success'}
                />
              </View>
              <View style={styles.chipRow}>
                <SourceBadge tone="detected" />
                {editableMedication.timingSource === 'suggested' ? (
                  <SourceBadge tone="suggested" />
                ) : null}
                {isEditedMedication ? (
                  <SourceBadge tone="edited" />
                ) : null}
              </View>
            </View>

            {visibleWarnings.length > 0 ? (
              <View style={styles.infoSection}>
                <ThemedText type="defaultSemiBold">Needs attention</ThemedText>
                {visibleWarnings.map((flag) => (
                  <View key={`${medication.id}-${flag}`} style={styles.infoBadge}>
                    <ThemedText>{getConfidenceFlagLabel(flag)}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {medication.parsingIssues.length > 0 || hasSecondaryNotes ? (
              <View style={styles.secondaryNotesSection}>
                <Pressable
                  style={styles.collapsibleHeader}
                  onPress={() => toggleSecondaryNotes(medication.id)}>
                  <View style={styles.summaryCopy}>
                    <ThemedText type="defaultSemiBold">Secondary notes</ThemedText>
                    <ThemedText style={styles.helperText}>
                      Lower-priority parsing notes and confirmation reminders.
                    </ThemedText>
                  </View>
                  <InfoPill label={isSecondaryExpanded ? 'Hide' : 'Show'} tone="neutral" />
                </Pressable>
                {isSecondaryExpanded ? (
                  <View style={styles.secondaryNotesList}>
                    {hasSecondaryNotes ? (
                      <ThemedText style={styles.secondaryNoteText}>
                        {getConfidenceFlagLabel('manual_review_required')}
                      </ThemedText>
                    ) : null}
                    {medication.parsingIssues.map((issue) => (
                      <ThemedText key={`${medication.id}-${issue}`} style={styles.secondaryNoteText}>
                        {getParsingIssueLabel(issue)}
                      </ThemedText>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <FieldLabel
              label="Medication name"
              source={getFieldSource(
                editableMedication.medicationName,
                originalMedicationName
              )}
            />
            <TextInput
              value={editableMedication.medicationName}
              onChangeText={(value) =>
                updateMedicationField(medication.id, 'medicationName', value)
              }
              style={styles.input}
              placeholder="Medication name"
            />
            <FieldLabel
              label="Strength"
              source={getFieldSource(editableMedication.strength, originalStrength)}
            />
            <TextInput
              value={editableMedication.strength}
              onChangeText={(value) => updateMedicationField(medication.id, 'strength', value)}
              style={styles.input}
              placeholder="500 mg"
            />
            <FieldLabel
              label="Dosage"
              source={getFieldSource(editableMedication.dosage, originalDosage)}
            />
            <TextInput
              value={editableMedication.dosage}
              onChangeText={(value) => updateMedicationField(medication.id, 'dosage', value)}
              style={styles.input}
              placeholder="1 capsule"
            />
            <QuickEditRow>
              {DOSAGE_PRESETS.map((preset) => (
                <QuickEditChip
                  key={`${medication.id}-dosage-${preset}`}
                  label={preset}
                  active={normalizeValue(editableMedication.dosage) === normalizeValue(preset)}
                  onPress={() => applyDosagePreset(medication.id, preset)}
                />
              ))}
            </QuickEditRow>
            <FieldActionsRow>
              <InlineAction label="Clear" onPress={() => clearMedicationField(medication.id, 'dosage')} />
            </FieldActionsRow>
            <FieldLabel
              label="Frequency"
              source={getFieldSource(editableMedication.frequency, originalFrequency)}
            />
            <TextInput
              value={editableMedication.frequency}
              onChangeText={(value) => updateMedicationField(medication.id, 'frequency', value)}
              style={styles.input}
              placeholder="twice daily"
            />
            <QuickEditRow>
              {FREQUENCY_PRESETS.map((preset) => (
                <QuickEditChip
                  key={`${medication.id}-frequency-${preset}`}
                  label={preset === 'as needed' ? 'PRN / As needed' : preset}
                  active={
                    preset === 'as needed'
                      ? hasPrnNote(editableMedication.notes)
                      : normalizeValue(editableMedication.frequency) === normalizeValue(preset)
                  }
                  tone={preset === 'as needed' ? 'warning' : 'neutral'}
                  onPress={() => applyFrequencyPreset(medication.id, preset)}
                />
              ))}
            </QuickEditRow>
            <FieldActionsRow>
              <InlineAction label="Clear" onPress={() => clearMedicationField(medication.id, 'frequency')} />
            </FieldActionsRow>
            <FieldLabel
              label="Timing instructions"
              source={getFieldSource(
                editableMedication.timingInstructions,
                originalTimingInstructions,
                editableMedication.timingSource
              )}
            />
            {editableMedication.timingSource === 'suggested' ? (
              <ThemedText style={styles.suggestionText}>
                Suggested from the medication frequency. You can keep it or edit it.
              </ThemedText>
            ) : null}
            <TextInput
              value={editableMedication.timingInstructions}
              onChangeText={(value) =>
                updateMedicationField(medication.id, 'timingInstructions', value)
              }
              style={styles.input}
              placeholder="after meals"
            />
            <QuickEditRow>
              {TIMING_PRESETS.map((preset) => (
                <QuickEditChip
                  key={`${medication.id}-timing-${preset}`}
                  label={preset}
                  active={
                    normalizeValue(editableMedication.timingInstructions) === normalizeValue(preset)
                  }
                  onPress={() => applyTimingPreset(medication.id, preset)}
                />
              ))}
            </QuickEditRow>
            <FieldActionsRow>
              {canUseSuggestedTiming ? (
                <InlineAction
                  label="Use suggestion"
                  onPress={() =>
                    useSuggestedTiming(
                      medication.id,
                      editableMedication.frequency,
                      editableMedication.notes
                    )
                  }
                />
              ) : null}
              <InlineAction
                label="Apply to similar"
                onPress={() =>
                  applyTimingToSimilar(
                    medication.id,
                    editableMedication.timingInstructions,
                    editableMedication.frequency,
                    editableMedication.notes
                  )
                }
                disabled={
                  !editableMedication.timingInstructions.trim() ||
                  !editableMedication.frequency.trim() ||
                  hasPrnNote(editableMedication.notes)
                }
              />
              <InlineAction
                label="Clear"
                onPress={() => clearMedicationField(medication.id, 'timingInstructions')}
              />
            </FieldActionsRow>
            <FieldLabel
              label="Duration"
              source={getFieldSource(editableMedication.duration, originalDuration)}
            />
            <TextInput
              value={editableMedication.duration}
              onChangeText={(value) => updateMedicationField(medication.id, 'duration', value)}
              style={styles.input}
              placeholder="5 days"
            />
            <QuickEditRow>
              {DURATION_PRESETS.map((preset) => (
                <QuickEditChip
                  key={`${medication.id}-duration-${preset}`}
                  label={preset}
                  active={normalizeValue(editableMedication.duration) === normalizeValue(preset)}
                  onPress={() => applyDurationPreset(medication.id, preset)}
                />
              ))}
            </QuickEditRow>
            <FieldActionsRow>
              <InlineAction label="Clear" onPress={() => clearMedicationField(medication.id, 'duration')} />
            </FieldActionsRow>
            <FieldLabel
              label="Start date"
              source={getFieldSource(
                editableMedication.startDate,
                originalStartDate,
                editableMedication.startDateSource
              )}
            />
            {editableMedication.startDateSource === 'suggested' ? (
              <ThemedText style={styles.suggestionText}>
                Suggested from the prescription date{data.documentDate ? ` (${data.documentDate})` : ''}.
              </ThemedText>
            ) : null}
            <TextInput
              value={editableMedication.startDate}
              onChangeText={(value) => updateMedicationField(medication.id, 'startDate', value)}
              style={styles.input}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <FieldActionsRow>
              <InlineAction
                label="Use prescription date"
                onPress={() => usePrescriptionDate(medication.id)}
                disabled={!canUsePrescriptionDateForMedication}
              />
              <InlineAction label="Clear" onPress={() => clearMedicationField(medication.id, 'startDate')} />
            </FieldActionsRow>
            <FieldLabel
              label="Notes"
              source={getFieldSource(editableMedication.notes, originalNotes)}
            />
            <TextInput
              value={editableMedication.notes}
              onChangeText={(value) => updateMedicationField(medication.id, 'notes', value)}
              style={[styles.input, styles.notesInput]}
              placeholder="Optional notes"
              multiline
            />
            <QuickEditRow>
              <QuickEditChip
                label="PRN / As needed"
                active={hasPrnNote(editableMedication.notes)}
                tone="warning"
                onPress={() => togglePrn(medication.id)}
              />
            </QuickEditRow>
            <FieldActionsRow>
              <InlineAction label="Clear" onPress={() => clearMedicationField(medication.id, 'notes')} />
            </FieldActionsRow>
          </View>
        );
      })}

      {saveError ? (
        <View style={styles.errorCard}>
          <ThemedText>{saveError}</ThemedText>
        </View>
      ) : null}

      <Pressable style={styles.primaryAction} onPress={saveReview} disabled={isSaving}>
        <ThemedText type="defaultSemiBold" style={styles.primaryActionText}>
          {isSaving ? 'Saving review…' : 'Save Review And Preview Schedule'}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function SourceBadge({ tone }: { tone: SourceBadgeTone }) {
  return (
    <View
      style={[
        styles.sourceBadge,
        tone === 'detected'
          ? styles.detectedBadge
          : tone === 'suggested'
            ? styles.suggestedBadge
            : styles.editedBadge,
      ]}>
      <ThemedText style={styles.sourceBadgeText}>{getSourceBadgeLabel(tone)}</ThemedText>
    </View>
  );
}

function InfoPill({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  return (
    <View
      style={[
        styles.infoPill,
        tone === 'success'
          ? styles.infoPillSuccess
          : tone === 'warning'
            ? styles.infoPillWarning
            : styles.infoPillNeutral,
      ]}>
      <ThemedText style={styles.infoPillText}>{label}</ThemedText>
    </View>
  );
}

function FieldLabel({
  label,
  source,
}: {
  label: string;
  source?: SourceBadgeTone | null;
}) {
  return (
    <View style={styles.fieldHeader}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      {source ? <SourceBadge tone={source} /> : null}
    </View>
  );
}

function QuickEditRow({ children }: { children: ReactNode }) {
  return <View style={styles.quickEditRow}>{children}</View>;
}

function QuickEditChip({
  label,
  active,
  tone = 'neutral',
  onPress,
}: {
  label: string;
  active: boolean;
  tone?: 'neutral' | 'warning';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.quickEditChip,
        active ? styles.quickEditChipActive : null,
        tone === 'warning' ? styles.quickEditChipWarning : null,
      ]}>
      <ThemedText style={[styles.quickEditChipText, active ? styles.quickEditChipTextActive : null]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function FieldActionsRow({ children }: { children: ReactNode }) {
  return <View style={styles.fieldActionsRow}>{children}</View>;
}

function InlineAction({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.inlineAction, disabled ? styles.inlineActionDisabled : null]}>
      <ThemedText style={styles.inlineActionText}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    padding: 20,
    paddingBottom: 36,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    gap: 12,
    paddingTop: 4,
  },
  eyebrow: {
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    opacity: 0.62,
    fontSize: 12,
  },
  card: {
    gap: 10,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(58, 122, 87, 0.12)',
    backgroundColor: 'rgba(10, 30, 18, 0.92)',
  },
  summaryCard: {
    gap: 14,
  },
  summaryHeader: {
    gap: 12,
  },
  summaryCopy: {
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'flex-start',
  },
  metaList: {
    gap: 10,
    paddingTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  metaLabel: {
    opacity: 0.7,
  },
  metaValue: {
    fontWeight: '600',
  },
  detectedBanner: {
    gap: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(58, 122, 87, 0.12)',
  },
  detectedBannerTitle: {
    fontWeight: '700',
  },
  dateCard: {
    gap: 12,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  helperText: {
    opacity: 0.7,
    lineHeight: 20,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  medicationCard: {
    gap: 12,
  },
  medicationCardWarning: {
    borderColor: 'rgba(163, 62, 43, 0.22)',
  },
  cardHeader: {
    gap: 10,
  },
  medicationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  medicationTitle: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  detectedBadge: {
    backgroundColor: 'rgba(58, 122, 87, 0.12)',
  },
  suggestedBadge: {
    backgroundColor: 'rgba(199, 146, 32, 0.14)',
  },
  editedBadge: {
    backgroundColor: 'rgba(43, 101, 163, 0.14)',
  },
  sourceBadgeText: {
    fontSize: 12,
    opacity: 0.92,
  },
  infoPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  infoPillSuccess: {
    backgroundColor: 'rgba(58, 122, 87, 0.18)',
  },
  infoPillWarning: {
    backgroundColor: 'rgba(163, 62, 43, 0.18)',
  },
  infoPillNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryAction: {
    marginTop: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(58, 122, 87, 0.14)',
  },
  secondaryActionDisabled: {
    opacity: 0.45,
  },
  secondaryActionText: {
    textAlign: 'center',
  },
  primaryAction: {
    marginTop: 4,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: '#3A7A57',
  },
  primaryActionText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(58, 122, 87, 0.24)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 17,
  },
  notesInput: {
    minHeight: 98,
    textAlignVertical: 'top',
  },
  quickEditRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -2,
  },
  quickEditChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(58, 122, 87, 0.12)',
  },
  quickEditChipActive: {
    backgroundColor: 'rgba(58, 122, 87, 0.22)',
    borderColor: 'rgba(92, 173, 122, 0.36)',
  },
  quickEditChipWarning: {
    borderColor: 'rgba(163, 62, 43, 0.18)',
  },
  quickEditChipText: {
    fontSize: 13,
    opacity: 0.9,
  },
  quickEditChipTextActive: {
    fontWeight: '700',
  },
  fieldActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: -2,
  },
  inlineAction: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  inlineActionDisabled: {
    opacity: 0.4,
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.86,
  },
  suggestionText: {
    opacity: 0.72,
    lineHeight: 20,
  },
  infoSection: {
    gap: 8,
    marginTop: 4,
  },
  infoBadge: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(163, 62, 43, 0.12)',
  },
  secondaryNotesSection: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(58, 122, 87, 0.06)',
  },
  secondaryNotesList: {
    gap: 8,
  },
  secondaryNoteText: {
    opacity: 0.76,
    lineHeight: 20,
  },
  errorCard: {
    gap: 8,
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(163, 62, 43, 0.12)',
  },
});
