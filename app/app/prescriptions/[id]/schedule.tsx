import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { validateScheduleDraft } from '@scanner/shared';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScheduleDraft } from '@/src/features/prescriptions/hooks/use-schedule-draft';
import { prescriptionService } from '@/src/features/prescriptions/services/prescription-service';

function formatIssueTitle(code: string, medicationName: string) {
  switch (code) {
    case 'missing_start_date':
      return 'Start date needed';
    case 'ambiguous_instruction':
      return 'Instruction needs clarification';
    case 'unsupported_frequency':
      return 'Schedule pattern not supported yet';
    case 'unsupported_taper':
      return 'Manual taper schedule needed';
    case 'missing_time_anchor':
      return 'Timing still needs one more detail';
    case 'manual_confirmation_required':
      return medicationName.toLowerCase().includes('maxigesic')
        ? 'Confirm these suggested PRN times'
        : 'Confirm the suggested times';
    default:
      return code
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
}

function formatScheduleIntro(label: string) {
  const normalizedLabel = label.trim().toLowerCase();

  if (/^dose\s+\d+$/.test(normalizedLabel)) {
    return 'Suggested time';
  }

  return label;
}

function formatScheduleDescription(instructions: string) {
  return instructions.replace(/^Suggested time for\s+/i, 'Suggested time for taking ');
}

function getCardStatus(schedule: ReturnType<typeof useScheduleDraft>['data'][number]) {
  const hasManualConfirmation = schedule.issues.some((issue) => issue.code === 'manual_confirmation_required');
  const hasBlockingIssue = schedule.issues.some((issue) => issue.code !== 'manual_confirmation_required');

  if (hasBlockingIssue) {
    return {
      label: 'Needs changes',
      tone: 'warning' as const,
    };
  }

  if (hasManualConfirmation) {
    return {
      label: 'Needs confirmation',
      tone: 'warning' as const,
    };
  }

  return {
    label: 'Ready to save',
    tone: 'success' as const,
  };
}

function getSaveSuccessMessage(source: 'supabase' | 'local') {
  return source === 'supabase'
    ? 'Schedules saved to your account.'
    : 'Schedules saved on this device for now.';
}

export default function SchedulePreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useScheduleDraft(id);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<{
    type: 'idle' | 'error' | 'success';
    message: string | null;
  }>({
    type: 'idle',
    message: null,
  });
  const invalidSchedules = useMemo(
    () => data.filter((schedule) => !validateScheduleDraft(schedule).isValid),
    [data]
  );
  const readyCount = useMemo(
    () =>
      data.filter((schedule) =>
        schedule.issues.every((issue) => issue.code === 'manual_confirmation_required')
      ).length,
    [data]
  );
  const confirmationCount = useMemo(
    () =>
      data.filter((schedule) =>
        schedule.issues.some((issue) => issue.code === 'manual_confirmation_required')
      ).length,
    [data]
  );

  async function confirmSchedules() {
    setIsSaving(true);
    setSaveState({
      type: 'idle',
      message: null,
    });

    try {
      const result = await prescriptionService.finalizeSchedules(id);
      setSaveState({
        type: 'success',
        message: getSaveSuccessMessage(result.source),
      });
    } catch (saveError) {
      setSaveState({
        type: 'error',
        message:
          saveError instanceof Error
            ? saveError.message
            : 'Unable to finalize schedules right now.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Building schedule preview…</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>{error}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.eyebrow}>Schedule step</ThemedText>
        <ThemedText type="title">Schedule Preview</ThemedText>
        <ThemedText>
          Review the suggested dose times before saving. Anything unclear stays blocked until you
          fix it in the review step.
        </ThemedText>
      </View>

      <View style={[styles.card, styles.summaryCard]}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryCopy}>
            <ThemedText type="subtitle">Draft summary</ThemedText>
            <ThemedText>
              This preview turns the reviewed prescription into a daily plan. Suggested times stay
              editable and PRN items stay confirmation-gated.
            </ThemedText>
          </View>
          <View style={styles.summaryChips}>
            <InfoPill label={`${readyCount} ready`} tone="success" />
            <InfoPill label={`${confirmationCount} to confirm`} tone="warning" />
          </View>
        </View>
      </View>

      {data.map((schedule) => (
        <View
          key={schedule.extractedMedicationId ?? schedule.medicationName}
          style={[
            styles.card,
            styles.scheduleCard,
            schedule.issues.some((issue) => issue.code !== 'manual_confirmation_required')
              ? styles.scheduleCardWarning
              : null,
          ]}>
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              {schedule.medicationName}
            </ThemedText>
            <InfoPill {...getCardStatus(schedule)} />
          </View>

          {schedule.items.length > 0 ? (
            schedule.items.map((item) => (
              <View
                key={`${schedule.medicationName}-${item.label}`}
                style={styles.itemRow}>
                <ThemedText type="defaultSemiBold">{formatScheduleIntro(item.label)}</ThemedText>
                <ThemedText style={styles.itemMeta}>
                  {item.time ? `${item.time}` : 'Time still needs confirmation'}
                </ThemedText>
                <ThemedText>
                  {formatScheduleDescription(item.instructions)}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText>No schedule has been generated for this medication yet.</ThemedText>
          )}

          {schedule.issues.map((issue) => (
            <View key={`${schedule.medicationName}-${issue.code}`} style={styles.issue}>
              <ThemedText type="defaultSemiBold">
                {formatIssueTitle(issue.code, schedule.medicationName)}
              </ThemedText>
              <ThemedText>{issue.message}</ThemedText>
            </View>
          ))}

          <ThemedText>
            End date: {schedule.endDate ?? 'Waiting for enough information'}
          </ThemedText>
        </View>
      ))}

      {invalidSchedules.length > 0 ? (
        <View style={styles.warningCard}>
          <ThemedText type="defaultSemiBold">Before you can save</ThemedText>
          <ThemedText>
            Go back and update {invalidSchedules.map((schedule) => schedule.medicationName).join(', ')}.
            The most common fixes are adding a start date or clarifying instructions like
            "as needed."
          </ThemedText>
        </View>
      ) : null}

      {saveState.message ? (
        <View
          style={saveState.type === 'success' ? styles.successCard : styles.warningCard}>
          <ThemedText>{saveState.message}</ThemedText>
        </View>
      ) : null}

      <Pressable
        style={[
          styles.primaryAction,
          (invalidSchedules.length > 0 || isSaving || saveState.type === 'success') &&
            styles.primaryActionDisabled,
        ]}
        onPress={confirmSchedules}
        disabled={invalidSchedules.length > 0 || isSaving || saveState.type === 'success'}>
        <ThemedText type="defaultSemiBold" style={styles.primaryActionText}>
          {saveState.type === 'success'
            ? 'Schedules Saved'
            : isSaving
              ? 'Saving schedules…'
              : invalidSchedules.length > 0
                ? 'Fix issues before saving'
                : 'Confirm and save schedules'}
        </ThemedText>
      </Pressable>
    </ScrollView>
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
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(58, 122, 87, 0.12)',
    backgroundColor: 'rgba(10, 30, 18, 0.92)',
  },
  scheduleCard: {
    gap: 14,
  },
  scheduleCardWarning: {
    borderColor: 'rgba(163, 62, 43, 0.22)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
  },
  itemRow: {
    gap: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  itemMeta: {
    opacity: 0.68,
  },
  issue: {
    gap: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(163, 62, 43, 0.12)',
  },
  warningCard: {
    gap: 8,
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(163, 62, 43, 0.12)',
  },
  successCard: {
    gap: 8,
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(58, 122, 87, 0.12)',
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
  primaryAction: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: '#3A7A57',
  },
  primaryActionDisabled: {
    opacity: 0.55,
  },
  primaryActionText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

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
