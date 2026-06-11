import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { prescriptionService } from '@/src/features/prescriptions/services/prescription-service';

export default function ProcessingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [source, setSource] = useState<'supabase' | 'local' | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{
    analysisSource: 'live' | 'mock';
    provider: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    prescriptionService
      .startAnalysis(id)
      .then((result) => {
        if (!isMounted) return;
        setSource(result.source);
        setAnalysisMeta({
          analysisSource: result.analysisSource,
          provider: result.provider,
        });
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        const message = error instanceof Error && error.message ? error.message : 'The prescription analysis step could not be prepared.';
        setError(message);
        setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Processing Prescription</ThemedText>
        <ThemedText>
          This screen represents the OCR step. The live provider call will land here after the
          Supabase Edge Function is wired in.
        </ThemedText>
      </View>

      <View style={styles.card}>
        <ThemedText type="defaultSemiBold">Prescription ID</ThemedText>
        <ThemedText>{id}</ThemedText>
      </View>

      <View style={styles.card}>
        <ThemedText type="defaultSemiBold">Current analysis status</ThemedText>
        <ThemedText>
          {status === 'loading' && 'Preparing extraction data…'}
          {status === 'ready' &&
            `Extraction complete. Review is required before schedule generation. Source: ${source}. OCR mode: ${analysisMeta?.analysisSource ?? 'unknown'}. Provider: ${analysisMeta?.provider ?? 'unknown'}.`}
          {status === 'error' && error}
        </ThemedText>
      </View>

      {status === 'ready' ? (
        <Link href={`/prescriptions/${id}/review`} style={styles.primaryAction}>
          <ThemedText type="defaultSemiBold" style={styles.primaryActionText}>
            Open Review
          </ThemedText>
        </Link>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 20,
    padding: 20,
  },
  header: {
    gap: 10,
  },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(24, 46, 34, 0.08)',
  },
  primaryAction: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#3A7A57',
  },
  primaryActionText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
