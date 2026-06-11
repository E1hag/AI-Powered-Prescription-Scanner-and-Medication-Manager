import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width - 40;

type DoseStatus = "pending" | "taken" | "missed" | "snoozed";

type MedicationSchedule = {
  scheduleId: string;
  drugName: string;
  dosage: string;
  instructions: string;
  scheduledTime: string;
  status: DoseStatus;
  doseEventId?: string;
};

type DoseLog = {
  id: string;
  medicationName: string;
  status: DoseStatus;
  time: string;
  date: string;
};

const defaultSchedules: MedicationSchedule[] = [
  {
    scheduleId: "default-1",
    drugName: "Amoxicillin",
    dosage: "500mg",
    scheduledTime: "08:00 AM",
    instructions: "Take after food",
    status: "pending",
  },
  {
    scheduleId: "default-2",
    drugName: "Paracetamol",
    dosage: "1000mg",
    scheduledTime: "02:00 PM",
    instructions: "Take only if needed for pain or fever",
    status: "pending",
  },
  {
    scheduleId: "default-3",
    drugName: "Vitamin D",
    dosage: "1000 IU",
    scheduledTime: "08:00 PM",
    instructions: "Take with water",
    status: "pending",
  },
];

const isDoseLocked = (status: DoseStatus): boolean => {
  return status === "taken" || status === "missed";
};

const capitalizeStatus = (status: DoseStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function AdherenceScreen() {
  const router = useRouter();
  const [schedules, setSchedules] =
    useState<MedicationSchedule[]>(defaultSchedules);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState("");
  const [usingTeamData, setUsingTeamData] = useState(false);

  const initScreen = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUserId(session.user.id);
        await loadMedicationSchedules(session.user.id);
        await loadDoseHistory(session.user.id);
      }
    } catch (error) {
      console.log("Init error:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    initScreen();
  }, [initScreen]);

  const loadMedicationSchedules = async (uid: string) => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("medication_schedules")
        .select(
          `
          id,
          scheduled_time,
          medications (
            drug_name,
            dosage,
            instructions
          )
        `,
        )
        .eq("patient_id", uid)
        .eq("is_active", true)
        .lte("start_date", today);

      if (error || !data || data.length === 0) {
        console.log("No schedules found, using defaults");
        setUsingTeamData(false);
        return;
      }

      const todayStart = today + "T00:00:00";
      const todayEnd = today + "T23:59:59";

      const { data: todayEvents } = await supabase
        .from("dose_events")
        .select("*")
        .eq("patient_id", uid)
        .gte("scheduled_datetime", todayStart)
        .lte("scheduled_datetime", todayEnd);

      const formattedSchedules: MedicationSchedule[] = data.map((row: any) => {
        const existingEvent = (todayEvents || []).find(
          (e: any) => e.schedule_id === row.id,
        );

        const timeStr = row.scheduled_time
          ? new Date("1970-01-01T" + row.scheduled_time).toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
              },
            )
          : "08:00 AM";

        return {
          scheduleId: row.id,
          drugName: row.medications?.drug_name || "Unknown",
          dosage: row.medications?.dosage || "",
          instructions: row.medications?.instructions || "",
          scheduledTime: timeStr,
          status: (existingEvent?.status as DoseStatus) || "pending",
          doseEventId: existingEvent?.id,
        };
      });

      setSchedules(formattedSchedules);
      setUsingTeamData(true);
    } catch (error) {
      console.log("Load schedules error:", error);
    }
  };

  const loadDoseHistory = async (uid: string) => {
    try {
      setSyncStatus("Syncing...");

      const { data, error } = await supabase
        .from("dose_events")
        .select(
          `
          id,
          status,
          responded_at,
          scheduled_datetime,
          medication_schedules (
            medications (
              drug_name
            )
          )
        `,
        )
        .eq("patient_id", uid)
        .order("responded_at", { ascending: false })
        .limit(100);

      if (error) {
        setSyncStatus("Sync failed");
        console.log("Load history error:", error);
        return;
      }

      const formattedLogs: DoseLog[] = (data || []).map((row: any) => {
        const logDate = new Date(row.responded_at || row.scheduled_datetime);
        return {
          id: row.id,
          medicationName:
            row.medication_schedules?.medications?.drug_name || "Unknown",
          status: row.status as DoseStatus,
          time: logDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          date: row.responded_at || row.scheduled_datetime,
        };
      });

      setLogs(formattedLogs);
      setSyncStatus("Synced ✓");
      setTimeout(() => setSyncStatus(""), 3000);
    } catch (error) {
      setSyncStatus("Sync failed");
      console.log("Load history error:", error);
    }
  };

  const updateDoseStatus = async (
    scheduleId: string,
    newStatus: DoseStatus,
  ) => {
    const selectedSchedule = schedules.find((s) => s.scheduleId === scheduleId);
    if (!selectedSchedule) return;
    if (isDoseLocked(selectedSchedule.status)) return;

    const updatedSchedules = schedules.map((s) =>
      s.scheduleId === scheduleId ? { ...s, status: newStatus } : s,
    );
    setSchedules(updatedSchedules);

    const now = new Date();
    const newLog: DoseLog = {
      id: Date.now().toString(),
      medicationName: selectedSchedule.drugName,
      status: newStatus,
      time: now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      date: now.toISOString(),
    };
    setLogs((prev) => [newLog, ...prev]);

    if (userId && usingTeamData) {
      try {
        setSyncStatus("Saving...");

        const { error } = await supabase.from("dose_events").insert({
          schedule_id: scheduleId,
          patient_id: userId,
          scheduled_datetime: now.toISOString(),
          status: newStatus,
          responded_at: now.toISOString(),
        });

        if (error) {
          setSyncStatus("Save failed");
          console.log("Insert dose event error:", error);
        } else {
          setSyncStatus("Saved ✓");
          setTimeout(() => setSyncStatus(""), 3000);
        }
      } catch (error) {
        setSyncStatus("Save failed");
        console.log("Supabase error:", error);
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const getWeeklyAdherenceData = () => {
    const labels: string[] = [];
    const data: number[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();

      const dayLogs = logs.filter(
        (log) => new Date(log.date).toDateString() === dateStr,
      );

      const taken = dayLogs.filter((l) => l.status === "taken").length;
      const missed = dayLogs.filter((l) => l.status === "missed").length;
      const decided = taken + missed;
      const percentage =
        decided === 0 ? 0 : Math.round((taken / decided) * 100);

      labels.push(dayNames[date.getDay()]);
      data.push(percentage);
    }

    return { labels, data };
  };

  const getTodaySummaryMessage = () => {
    const taken = schedules.filter((s) => s.status === "taken").length;
    const missed = schedules.filter((s) => s.status === "missed").length;
    const decided = taken + missed;

    if (decided === 0) return "Your day is just starting 🌅";
    const percent = Math.round((taken / decided) * 100);
    if (percent === 100) return "Excellent! All doses taken today 🎉";
    if (percent >= 50) return "Good progress, keep it up 💪";
    return "Try to stay on track today ⚠️";
  };

  const takenCount = schedules.filter((s) => s.status === "taken").length;
  const missedCount = schedules.filter((s) => s.status === "missed").length;
  const snoozedCount = schedules.filter((s) => s.status === "snoozed").length;
  const pendingCount = schedules.filter((s) => s.status === "pending").length;

  const decidedCount = takenCount + missedCount;
  const adherenceDisplay =
    decidedCount === 0 || takenCount === 0
      ? "--"
      : Math.round((takenCount / decidedCount) * 100) + "%";

  const weeklyData = getWeeklyAdherenceData();

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading adherence data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.pageTitle}>MEDCO Adherence Tracking</Text>
        {userId ? (
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.pageSubtitle}>
        {"Track today's medication doses and view your adherence history."}
      </Text>

      {userId ? (
        syncStatus !== "" && (
          <View style={styles.syncBanner}>
            <Text style={styles.syncText}>
              🔗 Connected to cloud — {syncStatus}
            </Text>
          </View>
        )
      ) : (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            ⚠️ Sign in to save your adherence data to the cloud
          </Text>
        </View>
      )}

      {usingTeamData && (
        <View style={styles.teamDataBanner}>
          <Text style={styles.teamDataText}>
            📋 Schedule loaded from your prescription
          </Text>
        </View>
      )}

      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{takenCount}</Text>
          <Text style={styles.summaryLabel}>Taken</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{missedCount}</Text>
          <Text style={styles.summaryLabel}>Missed</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{snoozedCount}</Text>
          <Text style={styles.summaryLabel}>Snoozed</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.adherenceBox}>
        <Text style={styles.adherenceTitle}>{"Today's Adherence"}</Text>
        <Text style={styles.adherencePercentage}>{adherenceDisplay}</Text>
        <Text style={styles.adherenceNote}>{getTodaySummaryMessage()}</Text>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>📊 Weekly Adherence (Last 7 Days)</Text>
        <Text style={styles.chartSubtitle}>
          Percentage of doses taken each day
        </Text>

        <BarChart
          data={{
            labels: weeklyData.labels,
            datasets: [{ data: weeklyData.data }],
          }}
          width={screenWidth - 32}
          height={180}
          yAxisSuffix="%"
          yAxisLabel=""
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
            labelColor: () => "#64748b",
            style: { borderRadius: 12 },
            barPercentage: 0.6,
            propsForBackgroundLines: {
              stroke: "#e2e8f0",
              strokeDasharray: "",
            },
          }}
          style={{ borderRadius: 12, marginTop: 8 }}
          showValuesOnTopOfBars
          fromZero
          withInnerLines
        />

        <Text style={styles.chartNote}>
          * Days with no recorded doses show 0%
        </Text>
      </View>

      <Text style={styles.sectionTitle}>{"Today's Medication Schedule"}</Text>

      {schedules.map((schedule) => {
        const locked = isDoseLocked(schedule.status);

        return (
          <View
            key={schedule.scheduleId}
            style={[
              styles.medicationCard,
              locked && styles.medicationCardLocked,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.medicationInfo}>
                <Text style={styles.medicationName}>{schedule.drugName}</Text>
                <Text style={styles.medicationDosage}>
                  {schedule.dosage} • {schedule.scheduledTime}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  schedule.status === "pending" && styles.pendingBadge,
                  schedule.status === "taken" && styles.takenBadge,
                  schedule.status === "missed" && styles.missedBadge,
                  schedule.status === "snoozed" && styles.snoozedBadge,
                ]}
              >
                <Text style={styles.statusText}>
                  {capitalizeStatus(schedule.status)}
                </Text>
              </View>
            </View>

            <Text style={styles.instructions}>{schedule.instructions}</Text>

            {locked ? (
              <View style={styles.lockedRow}>
                <Text style={styles.lockedIcon}>
                  {schedule.status === "taken" ? "✅" : "❌"}
                </Text>
                <Text style={styles.lockedText}>
                  Dose recorded as {capitalizeStatus(schedule.status)}
                </Text>
              </View>
            ) : (
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.takenButton]}
                  onPress={() => updateDoseStatus(schedule.scheduleId, "taken")}
                >
                  <Text style={styles.buttonText}>Taken</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.missedButton]}
                  onPress={() =>
                    updateDoseStatus(schedule.scheduleId, "missed")
                  }
                >
                  <Text style={styles.buttonText}>Missed</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.snoozedButton]}
                  onPress={() =>
                    updateDoseStatus(schedule.scheduleId, "snoozed")
                  }
                >
                  <Text style={styles.buttonText}>Snooze</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Adherence History</Text>

      {logs.length === 0 ? (
        <View style={styles.emptyHistoryBox}>
          <Text style={styles.emptyHistoryText}>
            No adherence actions recorded yet.
          </Text>
        </View>
      ) : (
        logs.map((log) => {
          const logDate = new Date(log.date);
          const dateLabel = logDate.toLocaleDateString("en", {
            month: "short",
            day: "numeric",
          });
          const displayTime = `${dateLabel} • ${log.time}`;

          return (
            <View key={log.id} style={styles.historyCard}>
              <View>
                <Text style={styles.historyMedication}>
                  {log.medicationName}
                </Text>
                <Text style={styles.historyTime}>{displayTime}</Text>
              </View>

              <Text
                style={[
                  styles.historyStatus,
                  log.status === "taken" && styles.historyTaken,
                  log.status === "missed" && styles.historyMissed,
                  log.status === "snoozed" && styles.historySnoozed,
                ]}
              >
                {capitalizeStatus(log.status)}
              </Text>
            </View>
          );
        })
      )}

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
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0f172a",
    flex: 1,
  },
  signOutText: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "600",
  },
  signInText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "600",
  },
  pageSubtitle: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 22,
  },
  syncBanner: {
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  syncText: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "600",
  },
  offlineBanner: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  offlineText: {
    fontSize: 13,
    color: "#92400e",
  },
  teamDataBanner: {
    backgroundColor: "#ede9fe",
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  teamDataText: {
    fontSize: 13,
    color: "#5b21b6",
    fontWeight: "600",
  },
  summaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    width: "47%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryNumber: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#2563eb",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#475569",
    marginTop: 4,
  },
  adherenceBox: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  adherenceTitle: {
    fontSize: 16,
    color: "#1e3a8a",
    fontWeight: "600",
  },
  adherencePercentage: {
    fontSize: 36,
    color: "#1d4ed8",
    fontWeight: "bold",
    marginTop: 6,
  },
  adherenceNote: {
    fontSize: 13,
    color: "#1e40af",
    marginTop: 6,
  },
  chartCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#0f172a",
  },
  chartSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  chartNote: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 14,
  },
  medicationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  medicationCardLocked: {
    backgroundColor: "#f8fafc",
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#0f172a",
  },
  medicationDosage: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  instructions: {
    fontSize: 14,
    color: "#475569",
    marginTop: 12,
    marginBottom: 14,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  pendingBadge: { backgroundColor: "#e2e8f0" },
  takenBadge: { backgroundColor: "#dcfce7" },
  missedBadge: { backgroundColor: "#fee2e2" },
  snoozedBadge: { backgroundColor: "#fef3c7" },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  takenButton: { backgroundColor: "#16a34a" },
  missedButton: { backgroundColor: "#dc2626" },
  snoozedButton: { backgroundColor: "#f59e0b" },
  buttonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 10,
  },
  lockedIcon: {
    fontSize: 18,
  },
  lockedText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  emptyHistoryBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    alignItems: "center",
  },
  emptyHistoryText: {
    fontSize: 14,
    color: "#64748b",
  },
  historyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  historyMedication: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
  },
  historyTime: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  historyStatus: {
    fontSize: 13,
    fontWeight: "bold",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  historyTaken: { backgroundColor: "#dcfce7", color: "#166534" },
  historyMissed: { backgroundColor: "#fee2e2", color: "#991b1b" },
  historySnoozed: { backgroundColor: "#fef3c7", color: "#92400e" },
  bottomSpace: { height: 40 },
});
