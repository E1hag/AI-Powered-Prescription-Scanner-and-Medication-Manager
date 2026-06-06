import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

function WelcomeAction({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'primary' | 'secondary';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionButton, tone === 'primary' ? styles.primaryAction : styles.secondaryAction]}>
      <ThemedText
        type="defaultSemiBold"
        style={[styles.actionText, tone === 'primary' ? styles.primaryActionText : null]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function HomeScreen() {
  function openNextScreen() {
    router.push('/prescriptions/new');
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText style={styles.eyebrow}>Hello</ThemedText>
        <ThemedText style={styles.brand}>MEDCO</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Welcome to your prescription companion.
        </ThemedText>
        <ThemedText style={styles.body}>
          Review medications, understand schedules, and move through the prescription flow with
          confidence.
        </ThemedText>

        <View style={styles.actions}>
          <WelcomeAction label="Register" tone="primary" onPress={openNextScreen} />
          <WelcomeAction label="Login" tone="secondary" onPress={openNextScreen} />
        </View>

        <ThemedText style={styles.footnote}>
          For now, both buttons continue into the app flow while the full account system is being
          completed.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#151718',
  },
  content: {
    gap: 14,
  },
  eyebrow: {
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    opacity: 0.72,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 3.4,
    color: '#7CC896',
  },
  title: {
    fontSize: 34,
    lineHeight: 44,
  },
  body: {
    fontSize: 18,
    lineHeight: 30,
    opacity: 0.84,
    maxWidth: 340,
  },
  actions: {
    gap: 12,
    marginTop: 18,
  },
  actionButton: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 18,
  },
  primaryAction: {
    backgroundColor: '#4A9667',
  },
  secondaryAction: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(124, 200, 150, 0.14)',
  },
  actionText: {
    textAlign: 'center',
    fontSize: 18,
  },
  primaryActionText: {
    color: '#FFFFFF',
  },
  footnote: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.56,
    maxWidth: 340,
  },
});
