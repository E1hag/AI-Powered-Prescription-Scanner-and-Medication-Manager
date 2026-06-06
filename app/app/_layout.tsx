import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/sign-in" options={{ title: 'Sign In' }} />
        <Stack.Screen name="prescriptions/new" options={{ title: 'New Prescription' }} />
        <Stack.Screen
          name="prescriptions/[id]/processing"
          options={{ title: 'Processing Prescription' }}
        />
        <Stack.Screen
          name="prescriptions/[id]/review"
          options={{ title: 'Review Extraction' }}
        />
        <Stack.Screen
          name="prescriptions/[id]/schedule"
          options={{ title: 'Schedule Preview' }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
