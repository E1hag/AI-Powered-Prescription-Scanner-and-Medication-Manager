import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#f8fafc",
          },
        }}
      >
        <Stack.Screen name="index" />

        <Stack.Screen name="login" />

        <Stack.Screen name="modal" options={{ presentation: "modal" }} />

        <Stack.Screen name="personal-details" />

        <Stack.Screen name="medical-conditions" />

        <Stack.Screen name="current-medications" />

        <Stack.Screen name="dose-reminders" />

        <Stack.Screen name="prescriptions/new" />

        <Stack.Screen name="prescriptions/[id]/processing" />

        <Stack.Screen name="prescriptions/[id]/review" />

        <Stack.Screen name="prescriptions/[id]/schedule" />

        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
