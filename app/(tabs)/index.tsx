import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

type DoseStatus =
  | "pending"
  | "taken"
  | "missed"
  | "snoozed"
  | "Pending"
  | "Taken"
  | "Missed"
  | "Snoozed";

type Medication = {
  id: number;
  name: string;
  dosage: string;
  time: string;
  instructions: string;
  status: DoseStatus;
};

const MEDICATIONS_STORAGE_KEY = "medco_medications_v2";

const defaultMedications: Medication[] = [
  {
    id: 1,
    name: "Amoxicillin",
    dosage: "500mg",
    time: "08:00 AM",
    instructions: "Take after food",
    status: "Taken",
  },
  {
    id: 2,
    name: "Paracetamol",
    dosage: "1000mg",
    time: "02:00 PM",
    instructions: "Take only if needed for pain or fever",
    status: "Taken",
  },
  {
    id: 3,
    name: "Vitamin D",
    dosage: "1000 IU",
    time: "08:00 PM",
    instructions: "Take with water",
    status: "Missed",
  },
];

const normalizeStatus = (status: DoseStatus): string => {
  return status.toLowerCase();
};

const parseTimeToMinutes = (timeStr: string): number => {
  const parts = timeStr.split(" ");
  const period = parts[1];
  const timeParts = parts[0].split(":");

  let hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

const getMinutesUntil = (timeStr: string): number => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return parseTimeToMinutes(timeStr) - currentMinutes;
};

const CircularStatus = ({
  status,
  minutes,
}: {
  status: string;
  minutes: number;
}) => {
  const size = 82;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const isDone = status === "taken";
  const isMissed = status === "missed";

  const absMinutes = Math.abs(minutes);
  const progress = Math.max(0, Math.min(absMinutes / 120, 1));
  const strokeDashoffset = circumference - progress * circumference;

  const strokeColor = isDone ? "#16a34a" : isMissed ? "#dc2626" : "#2563eb";

  return (
    <View style={styles.circularContainer}>
      <Svg width={size} height={size}>
        <Circle
          stroke="#e2e8f0"
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={strokeColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={isDone || isMissed ? 0 : strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      <View style={styles.circularTextContainer}>
        {isDone ? (
          <>
            <Text style={styles.circularSmallText}>Done</Text>
            <Ionicons name="checkmark-circle" size={31} color="#16a34a" />
          </>
        ) : isMissed ? (
          <>
            <Text style={styles.circularSmallText}>Missed</Text>
            <Ionicons name="close-circle" size={31} color="#dc2626" />
          </>
        ) : (
          <>
            <Text style={styles.circularSmallText}>
              {minutes < 0 ? "Over" : "In"}
            </Text>
            <Text style={styles.circularNumber}>
              {absMinutes < 60 ? absMinutes : Math.floor(absMinutes / 60)}
            </Text>
            <Text style={styles.circularUnit}>
              {absMinutes < 60 ? "min" : "hr"}
            </Text>
          </>
        )}
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const [medications, setMedications] =
    useState<Medication[]>(defaultMedications);
  const [userName, setUserName] = useState("Uthman");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem(MEDICATIONS_STORAGE_KEY);

      if (saved) {
        setMedications(JSON.parse(saved));
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .single();

        if (profile?.full_name) {
          setUserName(profile.full_name.split(" ")[0]);
        } else if (session.user.email) {
          setUserName(session.user.email.split("@")[0]);
        }
      }
    } catch (error) {
      console.log("Home load error:", error);
    }
  };

  const getNextDose = (): Medication | null => {
    const pending = medications.filter(
      (medication) => normalizeStatus(medication.status) === "pending",
    );

    if (pending.length === 0) {
      return medications[0] || null;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const futurePending = pending
      .map((medication) => ({
        ...medication,
        totalMinutes: parseTimeToMinutes(medication.time),
      }))
      .filter((medication) => medication.totalMinutes > currentMinutes)
      .sort((a, b) => a.totalMinutes - b.totalMinutes);

    if (futurePending.length > 0) {
      return futurePending[0];
    }

    return pending[0];
  };

  const getTimeStatus = (timeStr: string, status: DoseStatus): string => {
    const normalStatus = normalizeStatus(status);

    if (normalStatus === "taken") return "Taken";
    if (normalStatus === "missed") return "Missed";
    if (normalStatus === "snoozed") return "Snoozed";

    const minutesUntil = getMinutesUntil(timeStr);

    if (minutesUntil <= 0) return "Overdue";
    if (minutesUntil <= 60) return "Upcoming";
    return "Pending";
  };

  const getStatusColors = (timeStr: string, status: DoseStatus) => {
    const normalStatus = normalizeStatus(status);

    if (normalStatus === "taken") {
      return {
        color: "#16a34a",
        background: "#dcfce7",
        icon: "checkmark-circle" as const,
      };
    }

    if (normalStatus === "missed") {
      return {
        color: "#dc2626",
        background: "#fee2e2",
        icon: "close-circle" as const,
      };
    }

    if (normalStatus === "snoozed") {
      return {
        color: "#f59e0b",
        background: "#fef3c7",
        icon: "time" as const,
      };
    }

    const minutesUntil = getMinutesUntil(timeStr);

    if (minutesUntil <= 60) {
      return {
        color: "#2563eb",
        background: "#dbeafe",
        icon: "time" as const,
      };
    }

    return {
      color: "#64748b",
      background: "#f1f5f9",
      icon: "ellipse-outline" as const,
    };
  };

  const takenCount = medications.filter(
    (medication) => normalizeStatus(medication.status) === "taken",
  ).length;

  const missedCount = medications.filter(
    (medication) => normalizeStatus(medication.status) === "missed",
  ).length;

  const pendingCount = medications.filter(
    (medication) => normalizeStatus(medication.status) === "pending",
  ).length;

  const nextDose = getNextDose();
  const nextDoseStatus = nextDose
    ? normalizeStatus(nextDose.status)
    : "pending";
  const minutesUntilNext = nextDose ? getMinutesUntil(nextDose.time) : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {userName} 👋</Text>
          <Text style={styles.subtitle}>
            Stay on track with your{"\n"}medications today.
          </Text>
        </View>

        <TouchableOpacity style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={24} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {nextDose && (
        <View style={styles.nextDoseCard}>
          <View style={styles.nextDoseLeft}>
            <Text style={styles.nextDoseLabel}>Next Dose</Text>

            <Text style={styles.nextDoseName}>
              {nextDose.name}
              {"\n"}
              {nextDose.dosage}
            </Text>

            <View style={styles.nextDoseInfoRow}>
              <Ionicons name="link-outline" size={14} color="#64748b" />
              <Text style={styles.nextDoseInfo}> 1 Capsule</Text>

              <Ionicons
                name="restaurant-outline"
                size={14}
                color="#64748b"
                style={styles.foodIcon}
              />
              <Text style={styles.nextDoseInfo}> {nextDose.instructions}</Text>
            </View>

            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={17} color="#2563eb" />
              <Text style={styles.nextDoseTime}> {nextDose.time}</Text>
            </View>
          </View>

          <CircularStatus status={nextDoseStatus} minutes={minutesUntilNext} />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity>
          <Text style={styles.viewText}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => router.push("/(tabs)/scan")}
        >
          <View style={[styles.quickIconBox, { backgroundColor: "#dbeafe" }]}>
            <Ionicons name="document-text" size={25} color="#2563eb" />
          </View>
          <Text style={styles.quickText}>Scan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => router.push("/(tabs)/adherence")}
        >
          <View style={[styles.quickIconBox, { backgroundColor: "#dcfce7" }]}>
            <Ionicons name="medical" size={25} color="#16a34a" />
          </View>
          <Text style={styles.quickText}>Meds</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => router.push("/(tabs)/adherence")}
        >
          <View style={[styles.quickIconBox, { backgroundColor: "#ede9fe" }]}>
            <Ionicons name="alarm" size={25} color="#7c3aed" />
          </View>
          <Text style={styles.quickText}>Reminder</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => router.push("/(tabs)/chatbot")}
        >
          <View style={[styles.quickIconBox, { backgroundColor: "#fef3c7" }]}>
            <Ionicons name="warning" size={25} color="#f59e0b" />
          </View>
          <Text style={styles.quickText}>Safety</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today&apos;s Overview</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/adherence")}>
          <Text style={styles.viewText}>View Calendar ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { backgroundColor: "#dcfce7" }]}>
          <Ionicons name="checkmark-circle" size={23} color="#16a34a" />
          <Text style={[styles.overviewNumber, { color: "#16a34a" }]}>
            {takenCount}
          </Text>
          <Text style={[styles.overviewLabel, { color: "#16a34a" }]}>
            Taken
          </Text>
        </View>

        <View style={[styles.overviewCard, { backgroundColor: "#fee2e2" }]}>
          <Ionicons name="close-circle" size={23} color="#dc2626" />
          <Text style={[styles.overviewNumber, { color: "#dc2626" }]}>
            {missedCount}
          </Text>
          <Text style={[styles.overviewLabel, { color: "#dc2626" }]}>
            Missed
          </Text>
        </View>

        <View style={[styles.overviewCard, { backgroundColor: "#fef3c7" }]}>
          <Ionicons name="time" size={23} color="#f59e0b" />
          <Text style={[styles.overviewNumber, { color: "#f59e0b" }]}>
            {pendingCount}
          </Text>
          <Text style={[styles.overviewLabel, { color: "#f59e0b" }]}>
            Pending
          </Text>
        </View>

        <View style={[styles.overviewCard, { backgroundColor: "#ede9fe" }]}>
          <Ionicons name="notifications" size={23} color="#7c3aed" />
          <Text style={[styles.overviewNumber, { color: "#7c3aed" }]}>
            {medications.length}
          </Text>
          <Text style={[styles.overviewLabel, { color: "#7c3aed" }]}>
            Reminders
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today&apos;s Schedule</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/adherence")}>
          <Text style={styles.viewText}>View Full</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scheduleCard}>
        {medications.map((medication, index) => {
          const statusColors = getStatusColors(
            medication.time,
            medication.status,
          );
          const isLast = index === medications.length - 1;

          return (
            <View key={medication.id}>
              <View style={styles.scheduleRow}>
                <View style={styles.scheduleTimeCol}>
                  <Text
                    style={[styles.scheduleTime, { color: statusColors.color }]}
                  >
                    {medication.time}
                  </Text>
                </View>

                <View style={styles.timelineCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      { backgroundColor: statusColors.color },
                    ]}
                  />
                  {!isLast && <View style={styles.timelineLine} />}
                </View>

                <View style={styles.medicationInfo}>
                  <Text style={styles.medicationName}>
                    {medication.name} {medication.dosage}
                  </Text>
                  <Text style={styles.medicationDetails}>
                    1 Tablet • {medication.instructions}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColors.background },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: statusColors.color },
                    ]}
                  >
                    {getTimeStatus(medication.time, medication.status)}
                  </Text>
                  <Ionicons
                    name={statusColors.icon}
                    size={15}
                    color={statusColors.color}
                  />
                </View>
              </View>

              {!isLast && <View style={styles.scheduleSpacer} />}
            </View>
          );
        })}

        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={18} color="#16a34a" />
          <Text style={styles.addButtonText}>Add Medication</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.interactionCard}
        onPress={() => router.push("/(tabs)/chatbot")}
      >
        <View style={styles.interactionLeft}>
          <View style={styles.interactionIconBox}>
            <Ionicons name="shield-checkmark" size={26} color="#16a34a" />
          </View>

          <View style={styles.interactionTextContainer}>
            <Text style={styles.interactionTitle}>All Good!</Text>
            <Text style={styles.interactionSubtitle}>
              No potential drug interactions found in your current medications.
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={21} color="#94a3b8" />
      </TouchableOpacity>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
    paddingHorizontal: 20,
  },

  header: {
    marginTop: 46,
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    fontSize: 29,
    fontWeight: "bold",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 18,
    color: "#94a3b8",
    lineHeight: 27,
  },
  bellButton: {
    marginTop: 12,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  nextDoseCard: {
    backgroundColor: "#eef2ff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nextDoseLeft: {
    flex: 1,
    paddingRight: 10,
  },
  nextDoseLabel: {
    color: "#2563eb",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 8,
  },
  nextDoseName: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 31,
    marginBottom: 10,
  },
  nextDoseInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  nextDoseInfo: {
    fontSize: 15,
    color: "#64748b",
  },
  foodIcon: {
    marginLeft: 10,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nextDoseTime: {
    color: "#2563eb",
    fontSize: 22,
    fontWeight: "bold",
  },

  circularContainer: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
  },
  circularTextContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  circularSmallText: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 2,
  },
  circularNumber: {
    fontSize: 23,
    color: "#0f172a",
    fontWeight: "bold",
    lineHeight: 26,
  },
  circularUnit: {
    fontSize: 11,
    color: "#64748b",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0f172a",
  },
  viewText: {
    color: "#2563eb",
    fontSize: 18,
    fontWeight: "700",
  },

  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 26,
  },
  quickActionCard: {
    flex: 1,
    height: 126,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  quickIconBox: {
    width: 58,
    height: 58,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  quickText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "center",
  },

  overviewRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 26,
  },
  overviewCard: {
    flex: 1,
    height: 102,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewNumber: {
    fontSize: 31,
    fontWeight: "bold",
    marginTop: 4,
  },
  overviewLabel: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 1,
  },

  scheduleCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scheduleTimeCol: {
    width: 82,
  },
  scheduleTime: {
    fontSize: 17,
    fontWeight: "bold",
  },
  timelineCol: {
    width: 23,
    alignItems: "center",
    marginRight: 10,
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    height: 40,
    backgroundColor: "#e2e8f0",
    marginTop: 4,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
  },
  medicationDetails: {
    marginTop: 2,
    fontSize: 15,
    color: "#94a3b8",
    lineHeight: 20,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusBadgeText: {
    fontSize: 15,
    fontWeight: "bold",
  },
  scheduleSpacer: {
    height: 13,
  },
  addButton: {
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  addButtonText: {
    color: "#16a34a",
    fontSize: 17,
    fontWeight: "bold",
  },

  interactionCard: {
    backgroundColor: "#ecfdf5",
    borderRadius: 24,
    padding: 17,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  interactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 13,
  },
  interactionIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  interactionTextContainer: {
    flex: 1,
  },
  interactionTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#0f172a",
  },
  interactionSubtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 19,
    marginTop: 2,
  },

  bottomSpace: {
    height: 28,
  },
});
