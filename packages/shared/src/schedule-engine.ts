import type { MedicationScheduleEvent, MedicationInstructionDraft, ScheduleDraft, ScheduleDraftItem, ScheduleGenerationIssue } from './schedule';

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function formatDosageText(dosage: string | null) {
  if (!dosage) {
    return 'medication';
  }

  return dosage
    .replace(/\btab\b/gi, 'tablet')
    .replace(/\btabs\b/gi, 'tablets')
    .replace(/\bcap\b/gi, 'capsule')
    .replace(/\bcaps\b/gi, 'capsules');
}

function formatInstructionForLabel(dosage: string | null, label: string) {
  const normalizedLabel = normalizeText(label);
  const dosageText = formatDosageText(dosage);

  if (normalizedLabel === 'morning') {
    return `Take ${dosageText} in the morning`;
  }

  if (normalizedLabel === 'afternoon') {
    return `Take ${dosageText} in the afternoon`;
  }

  if (normalizedLabel === 'evening') {
    return `Take ${dosageText} in the evening`;
  }

  if (normalizedLabel === 'before bedtime') {
    return `Take ${dosageText} before bedtime`;
  }

  if (normalizedLabel === 'after breakfast') {
    return `Take ${dosageText} after breakfast`;
  }

  if (normalizedLabel === 'after lunch') {
    return `Take ${dosageText} after lunch`;
  }

  if (normalizedLabel === 'after dinner') {
    return `Take ${dosageText} after dinner`;
  }

  return `Suggested time for ${dosageText}`;
}

function createIssue(
  code: ScheduleGenerationIssue['code'],
  message: string,
  field: string | null
): ScheduleGenerationIssue {
  return { code, message, field };
}

function parseDurationDays(duration: string | null) {
  if (!duration) return null;

  const match = normalizeText(duration).match(/(\d+)\s+day/);
  return match ? Number(match[1]) : null;
}

function hasExplicitStartDate(startDate: string | null) {
  return Boolean(startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate));
}

export function parseFrequencyText(frequency: string | null, timingInstructions: string | null) {
  const frequencyText = normalizeText(frequency);
  const timingText = normalizeText(timingInstructions);

  if (frequencyText.includes('every 8 hours')) {
    return {
      scheduleType: 'interval' as const,
      intervalHours: 8,
      occurrencesPerDay: null,
    };
  }

  if (
    frequencyText.includes('twice daily') ||
    frequencyText.includes('2 per day') ||
    frequencyText.includes('2 times daily') ||
    frequencyText.includes('two times daily') ||
    frequencyText.includes('2 time/daily')
  ) {
    return {
      scheduleType: 'daily' as const,
      intervalHours: null,
      occurrencesPerDay: 2,
    };
  }

  if (
    frequencyText.includes('three times daily') ||
    frequencyText.includes('3 times daily') ||
    frequencyText.includes('3 per day') ||
    frequencyText.includes('3 time/daily')
  ) {
    return {
      scheduleType: 'daily' as const,
      intervalHours: null,
      occurrencesPerDay: 3,
    };
  }

  if (
    frequencyText.includes('once daily') ||
    frequencyText.includes('1 per day') ||
    frequencyText.includes('1 time per day') ||
    frequencyText.includes('1 time/daily') ||
    frequencyText.includes('daily') ||
    timingText.includes('before bedtime')
  ) {
    return {
      scheduleType: 'daily' as const,
      intervalHours: null,
      occurrencesPerDay: 1,
    };
  }

  return {
    scheduleType: 'manual' as const,
    intervalHours: null,
    occurrencesPerDay: null,
  };
}

export function parseTimingText(timingInstructions: string | null) {
  const timingText = normalizeText(timingInstructions);
  const anchorLabels: string[] = [];
  const anchorTimes: string[] = [];

  const pushAnchor = (label: string, time: string) => {
    if (!anchorLabels.includes(label)) {
      anchorLabels.push(label);
      anchorTimes.push(time);
    }
  };

  if (timingText.includes('before bedtime') || timingText.includes('bedtime')) {
    return {
      anchorType: 'bedtime' as const,
      defaultTimes: ['21:00'],
      labels: ['Before bedtime'],
    };
  }

  if (timingText.includes('after meals')) {
    return {
      anchorType: 'after_meal' as const,
      defaultTimes: ['08:30', '13:00', '19:30'],
      labels: ['After breakfast', 'After lunch', 'After dinner'],
    };
  }

  if (timingText.includes('morning')) {
    pushAnchor('Morning', '08:00');
  }

  if (timingText.includes('afternoon') || timingText.includes('lunch') || timingText.includes('noon')) {
    pushAnchor('Afternoon', '14:00');
  }

  if (timingText.includes('evening') || timingText.includes('dinner')) {
    pushAnchor('Evening', '20:00');
  }

  if (anchorLabels.length > 0) {
    return {
      anchorType: 'custom_time' as const,
      defaultTimes: anchorTimes,
      labels: anchorLabels,
    };
  }

  return {
    anchorType: 'custom_time' as const,
    defaultTimes: ['08:00', '14:00', '20:00'],
    labels: ['Dose 1', 'Dose 2', 'Dose 3'],
  };
}

function buildDailyItems(
  medication: MedicationInstructionDraft,
  occurrencesPerDay: number,
  anchorType: ScheduleDraftItem['anchorType'],
  labels: string[],
  times: string[]
) {
  return Array.from({ length: occurrencesPerDay }, (_, index) => ({
    label: labels[index] ?? `Dose ${index + 1}`,
    anchorType,
    time: times[index] ?? null,
    intervalHours: null,
    instructions: formatInstructionForLabel(medication.dosage, labels[index] ?? `Dose ${index + 1}`),
  }));
}

function buildIntervalItems(medication: MedicationInstructionDraft, intervalHours: number) {
  const dosageText = formatDosageText(medication.dosage);

  return [
    {
      label: `Every ${intervalHours} hours`,
      anchorType: 'interval' as const,
      time: null,
      intervalHours,
      instructions: `Take ${dosageText} every ${intervalHours} hours`,
    },
  ];
}

export function buildScheduleDraft(medication: MedicationInstructionDraft): ScheduleDraft {
  const issues: ScheduleGenerationIssue[] = [];
  const notes = normalizeText(medication.notes);
  const frequency = parseFrequencyText(medication.frequency, medication.timingInstructions);
  const timing = parseTimingText(medication.timingInstructions);

  if (notes.includes('as needed')) {
    issues.push(
      createIssue(
        'ambiguous_instruction',
        'As-needed instructions cannot be auto-scheduled safely.',
        'notes'
      )
    );
  }

  if (/taper|reduce|decrease|increase/.test(normalizeText(medication.notes) || normalizeText(medication.frequency))) {
    issues.push(
      createIssue(
        'unsupported_taper',
        'Tapering instructions need a manual schedule build in v1.',
        'frequency'
      )
    );
  }

  if (!hasExplicitStartDate(medication.startDate)) {
    issues.push(
      createIssue(
        'missing_start_date',
        'Start date must be confirmed before saving this schedule.',
        'startDate'
      )
    );
  }

  if (frequency.scheduleType === 'manual') {
    issues.push(
      createIssue(
        'unsupported_frequency',
        'This instruction pattern is not supported for auto-generation yet.',
        'frequency'
      )
    );
  }

  if (
    frequency.scheduleType === 'daily' &&
    frequency.occurrencesPerDay === 1 &&
    timing.anchorType === 'after_meal'
  ) {
    issues.push(
      createIssue(
        'missing_time_anchor',
        'After-meal timing needs a specific meal selection before save.',
        'timingInstructions'
      )
    );
  }

  let items: ScheduleDraftItem[] = [];

  if (issues.length === 0 || issues.every((issue) => issue.code === 'missing_start_date')) {
    if (frequency.scheduleType === 'interval' && frequency.intervalHours) {
      items = buildIntervalItems(medication, frequency.intervalHours);
      issues.push(
        createIssue(
          'manual_confirmation_required',
          'Interval schedules need a user-confirmed start time before activation.',
          'timingInstructions'
        )
      );
    }

    if (frequency.scheduleType === 'daily' && frequency.occurrencesPerDay) {
      const fallbackLabels =
        frequency.occurrencesPerDay === 1
          ? ['Dose 1']
          : frequency.occurrencesPerDay === 2
            ? ['Morning', 'Evening']
            : ['Morning', 'Afternoon', 'Evening'];

      const fallbackTimes =
        frequency.occurrencesPerDay === 1
          ? ['08:00']
          : frequency.occurrencesPerDay === 2
            ? ['08:00', '20:00']
            : ['08:00', '14:00', '20:00'];
      const hasCompleteTimingSet =
        timing.labels.length >= frequency.occurrencesPerDay &&
        timing.defaultTimes.length >= frequency.occurrencesPerDay;

      const labels = hasCompleteTimingSet
        ? Array.from({ length: frequency.occurrencesPerDay }, (_, index) =>
            timing.labels[index] ?? fallbackLabels[index] ?? `Dose ${index + 1}`
          )
        : fallbackLabels;

      const times = hasCompleteTimingSet
        ? Array.from({ length: frequency.occurrencesPerDay }, (_, index) =>
            timing.defaultTimes[index] ?? fallbackTimes[index] ?? null
          )
        : fallbackTimes;

      items = buildDailyItems(
        medication,
        frequency.occurrencesPerDay,
        timing.anchorType,
        labels,
        times
      );

      if (!medication.timingInstructions) {
        issues.push(
          createIssue(
            'manual_confirmation_required',
            notes.includes('prn') || notes.includes('as needed')
              ? 'This medication is marked as as-needed (PRN), so the suggested times should be confirmed before save.'
              : 'These suggested times should be confirmed before save.',
            'timingInstructions'
          )
        );
      }
    }
  }

  return {
    medicationName: medication.medicationName,
    extractedMedicationId: medication.extractedMedicationId,
    items,
    issues,
    requiresUserConfirmation: true,
  };
}

export function buildScheduleDrafts(medications: MedicationInstructionDraft[]) {
  return medications.map((medication) => buildScheduleDraft(medication));
}

export function validateScheduleDraft(draft: ScheduleDraft) {
  return {
    isValid:
      draft.items.length > 0 &&
      draft.items.every((item) => item.time) &&
      draft.issues.every((issue) => issue.code === 'manual_confirmation_required'),
    issues: draft.issues,
  };
}

export function materializeScheduleEvents(params: {
  scheduleId: string;
  draft: ScheduleDraft;
  startDate: string;
  endDate?: string | null;
}): Omit<MedicationScheduleEvent, 'id' | 'createdAt'>[] {
  const startDate = new Date(`${params.startDate}T00:00:00.000Z`);
  const endDate = params.endDate
    ? new Date(`${params.endDate}T00:00:00.000Z`)
    : new Date(startDate);

  const totalDays =
    Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return Array.from({ length: Math.max(totalDays, 1) }, (_, dayIndex) =>
    params.draft.items.flatMap((item, itemIndex) => {
      if (!item.time) {
        return [];
      }

      const eventDate = new Date(startDate);
      eventDate.setUTCDate(eventDate.getUTCDate() + dayIndex);
      const [hours, minutes] = item.time.split(':').map(Number);
      eventDate.setUTCHours(hours, minutes, 0, 0);

      return [
        {
          scheduleId: params.scheduleId,
          eventDate: eventDate.toISOString().slice(0, 10),
          eventDateTime: eventDate.toISOString(),
          sequenceNo: dayIndex * params.draft.items.length + itemIndex,
          anchorType: item.anchorType,
          isGenerated: true,
          generationSource: 'schedule_engine' as const,
        },
      ];
    })
  ).flat();
}

export function normalizeMedicationInput(medication: MedicationInstructionDraft): MedicationInstructionDraft {
  return {
    ...medication,
    medicationName: medication.medicationName.trim(),
    strength: medication.strength?.trim() || null,
    dosage: medication.dosage?.trim() || null,
    frequency: medication.frequency?.trim() || null,
    timingInstructions: medication.timingInstructions?.trim() || null,
    duration: medication.duration?.trim() || null,
    startDate: medication.startDate?.trim() || null,
    notes: medication.notes?.trim() || null,
    fieldSources: medication.fieldSources,
  };
}

export function inferScheduleEndDate(startDate: string | null, duration: string | null) {
  if (!startDate || !hasExplicitStartDate(startDate)) return null;

  const durationDays = parseDurationDays(duration);

  if (!durationDays) return null;

  const endDate = new Date(`${startDate}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + durationDays - 1);
  return endDate.toISOString().slice(0, 10);
}
