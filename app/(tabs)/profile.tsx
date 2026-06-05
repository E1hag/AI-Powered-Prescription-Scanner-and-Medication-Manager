import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ProfileStats = {
  totalTaken: number;
  totalMissed: number;
  totalSnoozed: number;
  overallAdherence: string;
  email: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setIsLoggedIn(false);
        setIsLoaded(true);
        return;
      }

      setIsLoggedIn(true);
      const email = session.user.email || "Unknown";

      const { data, error } = await supabase
        .from("dose_logs")
        .select("status")
        .eq("user_id", session.user.id);

      if (error) {
        console.log("Profile stats error:", error);
        setIsLoaded(true);
        return;
      }

      const logs = data || [];
      const totalTaken = logs.filter((l) => l.status === "Taken").length;
      const totalMissed = logs.filter((l) => l.status === "Missed").length;
      const totalSnoozed = logs.filter((l) => l.status === "Snoozed").length;
      const decided = totalTaken + totalMissed;
      const overallAdherence =
        decided === 0
          ? "No data yet"
          : Math.round((totalTaken / decided) * 100) + "%";

      setStats({
        totalTaken,
        totalMissed,
        totalSnoozed,
        overallAdherence,
        email,
      });
    } catch (error) {
      console.log("Load profile error:", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View style={styles.notLoggedInContainer}>
        <Text style={styles.notLoggedInIcon}>👤</Text>
        <Text style={styles.notLoggedInTitle}>Not Signed In</Text>
        <Text style={styles.notLoggedInSubtitle}>
          Sign in to view your profile and adherence statistics.
        </Text>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {stats?.email?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <Text style={styles.emailText}>{stats?.email}</Text>
        <Text style={styles.roleText}>MEDCO Patient Account</Text>
      </View>

      <Text style={styles.sectionTitle}>Overall Adherence Summary</Text>

      <View style={styles.adherenceHighlight}>
        <Text style={styles.adherenceLabel}>Overall Adherence Rate</Text>
        <Text style={styles.adherenceValue}>{stats?.overallAdherence}</Text>
        <Text style={styles.adherenceNote}>
          Based on all recorded dose actions
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.takenCard]}>
          <Text style={styles.statNumber}>{stats?.totalTaken}</Text>
          <Text style={styles.statLabel}>Total Taken</Text>
        </View>

        <View style={[styles.statCard, styles.missedCard]}>
          <Text style={styles.statNumber}>{stats?.totalMissed}</Text>
          <Text style={styles.statLabel}>Total Missed</Text>
        </View>

        <View style={[styles.statCard, styles.snoozedCard]}>
          <Text style={styles.statNumber}>{stats?.totalSnoozed}</Text>
          <Text style={styles.statLabel}>Total Snoozed</Text>
        </View>

        <View style={[styles.statCard, styles.totalCard]}>
          <Text style={styles.statNumber}>
            {(stats?.totalTaken || 0) +
              (stats?.totalMissed || 0) +
              (stats?.totalSnoozed || 0)}
          </Text>
          <Text style={styles.statLabel}>Total Logged</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>App Information</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Name</Text>
          <Text style={styles.infoValue}>MEDCO</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>SWE499B Prototype</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>University</Text>
          <Text style={styles.infoValue}>Abu Dhabi University</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Backend</Text>
          <Text style={styles.infoValue}>Supabase ✓</Text>
        </View>
      </View>

      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerTitle}>⚠️ Medical Disclaimer</Text>
        <Text style={styles.disclaimerText}>
          MEDCO is an educational prototype developed as part of a Software
          Engineering capstone project at Abu Dhabi University. It is not a
          licensed medical device and should not replace professional medical
          advice, diagnosis, or treatment.
        </Text>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#475569",
  },
  notLoggedInContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 32,
  },
  notLoggedInIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  notLoggedInTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 10,
  },
  notLoggedInSubtitle: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  signInButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  signInButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 28,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#2563eb",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
  },
  emailText: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  roleText: {
    fontSize: 14,
    color: "#64748b",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 12,
    marginTop: 8,
  },
  adherenceHighlight: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  adherenceLabel: {
    fontSize: 14,
    color: "#1e3a8a",
    fontWeight: "600",
  },
  adherenceValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#1d4ed8",
    marginTop: 6,
    marginBottom: 4,
  },
  adherenceNote: {
    fontSize: 12,
    color: "#3b82f6",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    width: "47%",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  takenCard: {
    backgroundColor: "#dcfce7",
  },
  missedCard: {
    backgroundColor: "#fee2e2",
  },
  snoozedCard: {
    backgroundColor: "#fef3c7",
  },
  totalCard: {
    backgroundColor: "#e0e7ff",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 13,
    color: "#475569",
    marginTop: 4,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: "#475569",
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  disclaimerCard: {
    backgroundColor: "#fef3c7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#92400e",
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 13,
    color: "#92400e",
    lineHeight: 20,
  },
  signOutButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  signOutButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  bottomSpace: {
    height: 40,
  },
});
