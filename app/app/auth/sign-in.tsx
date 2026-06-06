import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthSession } from '@/src/features/auth/hooks/use-auth-session';
import { authService } from '@/src/features/auth/services/auth-service';

export default function SignInScreen() {
  const { isConfigured, isLoading, user } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setIsSubmitting(true);
    setError(null);

    try {
      await authService.signInWithPassword(email.trim(), password);
      router.back();
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : 'Unable to sign in with Supabase right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    setError(null);

    try {
      await authService.signOut();
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : 'Unable to sign out right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Supabase Sign In</ThemedText>
        <ThemedText>
          This is a minimal development sign-in screen so the app can save prescription data to
          the real backend instead of falling back to local-only storage.
        </ThemedText>
      </View>

      {!isConfigured ? (
        <View style={styles.warningCard}>
          <ThemedText type="defaultSemiBold">Supabase is not configured</ThemedText>
          <ThemedText>
            Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the Expo app
            environment before trying to sign in.
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.card}>
        <ThemedText type="subtitle">Current status</ThemedText>
        <ThemedText>
          {isLoading
            ? 'Checking your saved session…'
            : user
              ? `Signed in as ${user.email ?? user.id}`
              : 'No active Supabase user session'}
        </ThemedText>
      </View>

      <View style={styles.card}>
        <ThemedText type="defaultSemiBold">Email</ThemedText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          style={styles.input}
        />

        <ThemedText type="defaultSemiBold">Password</ThemedText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          style={styles.input}
        />
      </View>

      {error ? (
        <View style={styles.warningCard}>
          <ThemedText>{error}</ThemedText>
        </View>
      ) : null}

      {user ? (
        <View style={styles.actionStack}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/prescriptions/new')}
            disabled={isSubmitting}>
            <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
              Continue to MEDCO
            </ThemedText>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleSignOut}
            disabled={isSubmitting}>
            <ThemedText type="defaultSemiBold">
              {isSubmitting ? 'Signing out…' : 'Sign Out'}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.primaryButton, !isConfigured && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={isSubmitting || !isConfigured}>
          <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 18,
    padding: 20,
  },
  header: {
    gap: 10,
  },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(58, 122, 87, 0.08)',
  },
  warningCard: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(163, 62, 43, 0.12)',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(58, 122, 87, 0.24)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  actionStack: {
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#3A7A57',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(58, 122, 87, 0.12)',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
