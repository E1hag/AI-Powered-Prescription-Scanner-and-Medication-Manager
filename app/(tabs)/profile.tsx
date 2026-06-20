import { useAuthSession } from "@/src/features/auth/hooks/use-auth-session";
import { getAccountDisplay } from "@/src/features/auth/utils/account-display";
import { supabase } from "@/src/lib/supabase";
import {
  ClinicianAccessRequest,
  ClinicianAccessRequestStatus,
  TreatmentNote,
  approveClinicianAccessRequest,
  denyClinicianAccessRequest,
  getClinicianAccessRequestsForPatient,
  getTreatmentNotesForPatient,
} from "@/src/services/medcoSupabaseService";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DoseStatus = "Pending" | "Taken" | "Missed" | "Snoozed";

type ScheduleDose = {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  time: string;
  instruction: string;
  status: DoseStatus;
};

type StoredMedicationSchedule = {
  id: string;
  createdAt: string;
  doses: ScheduleDose[];
};

type ReminderItem = {
  id: string;
  doseId: string;
  medicationName: string;
  dosage: string;
  time: string;
  instruction: string;
  isEnabled: boolean;
};

const MEDCO_SCHEDULE_STORAGE_KEY = "MEDCO_MEDICATION_SCHEDULE";
const MEDCO_REMINDERS_STORAGE_KEY = "MEDCO_DOSE_REMINDERS";
const MEDCO_ADHERENCE_HISTORY_KEY = "MEDCO_ADHERENCE_HISTORY";

const defaultDoses: ScheduleDose[] = [
  {
    id: "default-dose-1",
    medicationId: "default-med-1",
    medicationName: "Amoxicillin",
    dosage: "500mg",
    time: "08:00 AM",
    instruction: "Take after food",
    status: "Pending",
  },
  {
    id: "default-dose-2",
    medicationId: "default-med-2",
    medicationName: "Paracetamol",
    dosage: "1000mg",
    time: "02:00 PM",
    instruction: "Take only if needed for pain or fever",
    status: "Pending",
  },
  {
    id: "default-dose-3",
    medicationId: "default-med-3",
    medicationName: "Vitamin D",
    dosage: "1000 IU",
    time: "08:00 PM",
    instruction: "Take with water",
    status: "Pending",
  },
];

export default function ProfileScreen() {
  const { user } = useAuthSession();
  const { scrollTo } = useLocalSearchParams<{ scrollTo?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const actionsSectionYRef = useRef<number | null>(null);
  const [doses, setDoses] = useState<ScheduleDose[]>(defaultDoses);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [hasSavedSchedule, setHasSavedSchedule] = useState(false);
  const [scheduleCreatedAt, setScheduleCreatedAt] = useState<string | null>(
    null,
  );
  const [accessRequests, setAccessRequests] = useState<
    ClinicianAccessRequest[]
  >([]);
  const [isLoadingAccessRequests, setIsLoadingAccessRequests] = useState(false);
  const [accessRequestError, setAccessRequestError] = useState<string | null>(
    null,
  );
  const [updatingAccessRequestId, setUpdatingAccessRequestId] = useState<
    string | null
  >(null);
  const [treatmentNotes, setTreatmentNotes] = useState<TreatmentNote[]>([]);
  const [isLoadingTreatmentNotes, setIsLoadingTreatmentNotes] = useState(false);
  const [treatmentNotesError, setTreatmentNotesError] = useState<string | null>(
    null,
  );
  const accountDisplay = useMemo(() => getAccountDisplay(user), [user]);

  const loadProfileData = useCallback(async () => {
    try {
      const savedScheduleRaw = await AsyncStorage.getItem(
        MEDCO_SCHEDULE_STORAGE_KEY,
      );

      if (savedScheduleRaw) {
        const savedSchedule = JSON.parse(
          savedScheduleRaw,
        ) as StoredMedicationSchedule;

        if (
          Array.isArray(savedSchedule.doses) &&
          savedSchedule.doses.length > 0
        ) {
          setDoses(savedSchedule.doses);
          setHasSavedSchedule(true);
          setScheduleCreatedAt(savedSchedule.createdAt);
        } else {
          setDoses(defaultDoses);
          setHasSavedSchedule(false);
          setScheduleCreatedAt(null);
        }
      } else {
        setDoses(defaultDoses);
        setHasSavedSchedule(false);
        setScheduleCreatedAt(null);
      }

      const savedRemindersRaw = await AsyncStorage.getItem(
        MEDCO_REMINDERS_STORAGE_KEY,
      );

      if (savedRemindersRaw) {
        const savedReminders = JSON.parse(savedRemindersRaw) as ReminderItem[];

        if (Array.isArray(savedReminders)) {
          setReminders(savedReminders);
        } else {
          setReminders([]);
        }
      } else {
        setReminders([]);
      }
    } catch {
      setDoses(defaultDoses);
      setReminders([]);
      setHasSavedSchedule(false);
      setScheduleCreatedAt(null);
    }
  }, []);

  const loadClinicianAccessRequests = useCallback(async () => {
    if (!user) {
      setAccessRequests([]);
      setAccessRequestError(null);
      return;
    }

    try {
      setIsLoadingAccessRequests(true);
      setAccessRequestError(null);

      const requests = await getClinicianAccessRequestsForPatient();
      setAccessRequests(requests);
    } catch (error) {
      setAccessRequestError(
        error instanceof Error
          ? error.message
          : "Unable to load clinician access requests.",
      );
      setAccessRequests([]);
    } finally {
      setIsLoadingAccessRequests(false);
    }
  }, [user]);

  const loadTreatmentNotes = useCallback(async () => {
    if (!user) {
      setTreatmentNotes([]);
      setTreatmentNotesError(null);
      return;
    }

    try {
      setIsLoadingTreatmentNotes(true);
      setTreatmentNotesError(null);

      const notes = await getTreatmentNotesForPatient();
      setTreatmentNotes(notes);
    } catch (error) {
      setTreatmentNotesError(
        error instanceof Error
          ? error.message
          : "Unable to load treatment notes.",
      );
      setTreatmentNotes([]);
    } finally {
      setIsLoadingTreatmentNotes(false);
    }
  }, [user]);

  const scrollToActionsSection = useCallback((delayMs = 80) => {
    setTimeout(() => {
      if (actionsSectionYRef.current === null) {
        return;
      }

      scrollViewRef.current?.scrollTo({
        y: Math.max(actionsSectionYRef.current - 12, 0),
        animated: true,
      });
    }, delayMs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
      loadClinicianAccessRequests();
      loadTreatmentNotes();

      if (scrollTo === "actions") {
        scrollToActionsSection();
        scrollToActionsSection(350);
      }
    }, [
      loadClinicianAccessRequests,
      loadProfileData,
      loadTreatmentNotes,
      scrollTo,
      scrollToActionsSection,
    ]),
  );

  const profileStats = useMemo(() => {
    const uniqueMedicationIds = new Set(doses.map((dose) => dose.medicationId));

    const taken = doses.filter((dose) => dose.status === "Taken").length;
    const missed = doses.filter((dose) => dose.status === "Missed").length;
    const pending = doses.filter((dose) => dose.status === "Pending").length;
    const snoozed = doses.filter((dose) => dose.status === "Snoozed").length;

    const completed = taken + missed;
    const adherencePercentage =
      completed === 0 ? 0 : Math.round((taken / completed) * 100);

    const enabledReminders = reminders.filter(
      (reminder) => reminder.isEnabled,
    ).length;

    return {
      medications: uniqueMedicationIds.size,
      totalDoses: doses.length,
      taken,
      missed,
      pending,
      snoozed,
      adherencePercentage,
      enabledReminders,
    };
  }, [doses, reminders]);

  const formatCreatedDate = (isoDate: string | null) => {
    if (!isoDate) {
      return "No scanned schedule saved yet";
    }

    try {
      const date = new Date(isoDate);

      return `Last schedule saved ${date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } catch {
      return "Schedule saved recently";
    }
  };

  const formatAccessRequestDate = (isoDate: string | null) => {
    if (!isoDate) {
      return "No response recorded";
    }

    try {
      return new Date(isoDate).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  };

  const wasUpdatedAfterCreation = (note: TreatmentNote) => {
    if (!note.updatedAt) {
      return false;
    }

    return Math.abs(
      new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime(),
    ) > 1000;
  };

  const handleActionsSectionLayout = (event: LayoutChangeEvent) => {
    actionsSectionYRef.current = event.nativeEvent.layout.y;

    if (scrollTo === "actions") {
      scrollToActionsSection(40);
    }
  };

  const shortenClinicianId = (clinicianId: string) => {
    if (clinicianId.length <= 12) {
      return clinicianId;
    }

    return `${clinicianId.slice(0, 8)}...${clinicianId.slice(-4)}`;
  };

  const getAccessStatusStyles = (status: ClinicianAccessRequestStatus) => {
    if (status === "approved") {
      return {
        badge: styles.accessApprovedBadge,
        text: styles.accessApprovedText,
        icon: "checkmark-circle" as const,
        iconColor: "#16a34a",
      };
    }

    if (status === "rejected") {
      return {
        badge: styles.accessRejectedBadge,
        text: styles.accessRejectedText,
        icon: "close-circle" as const,
        iconColor: "#dc2626",
      };
    }

    return {
      badge: styles.accessPendingBadge,
      text: styles.accessPendingText,
      icon: "time" as const,
      iconColor: "#f59e0b",
    };
  };

  const formatAccessStatus = (status: ClinicianAccessRequestStatus) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const respondToAccessRequest = (
    request: ClinicianAccessRequest,
    nextStatus: "approved" | "rejected",
  ) => {
    const isApproval = nextStatus === "approved";

    Alert.alert(
      isApproval ? "Approve Request" : "Deny Request",
      isApproval
        ? "This clinician will be able to read your adherence schedule and history."
        : "This clinician will not be able to access your adherence logs.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: isApproval ? "Approve" : "Deny",
          style: isApproval ? "default" : "destructive",
          onPress: async () => {
            try {
              setUpdatingAccessRequestId(request.id);

              if (isApproval) {
                await approveClinicianAccessRequest(request.id);
              } else {
                await denyClinicianAccessRequest(request.id);
              }

              await loadClinicianAccessRequests();
            } catch (error) {
              Alert.alert(
                "Request Update Failed",
                error instanceof Error
                  ? error.message
                  : "Unable to update the clinician access request.",
              );
            } finally {
              setUpdatingAccessRequestId(null);
            }
          },
        },
      ],
    );
  };

  const goToPersonalDetails = () => {
    router.push("/personal-details");
  };

  const goToCurrentMedications = () => {
    router.push("/current-medications");
  };

  const goToDoseReminders = () => {
    router.push("/dose-reminders");
  };

  const goToMedicalConditions = () => {
    router.push("/medical-conditions");
  };

  const goToDrugInteractions = () => {
    router.push("/drug-interactions");
  };

  const goToScanner = () => {
    router.push("/prescriptions/new");
  };

  const goToAdherence = () => {
    router.push("/(tabs)/adherence");
  };

  const clearAllLocalData = () => {
    Alert.alert(
      "Clear MEDCO Data",
      "This will remove the saved medication schedule, reminders, and adherence history from this device.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(MEDCO_SCHEDULE_STORAGE_KEY);
            await AsyncStorage.removeItem(MEDCO_REMINDERS_STORAGE_KEY);
            await AsyncStorage.removeItem(MEDCO_ADHERENCE_HISTORY_KEY);

            setDoses(defaultDoses);
            setReminders([]);
            setHasSavedSchedule(false);
            setScheduleCreatedAt(null);
          },
        },
      ],
    );
  };

  const signOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.auth.signOut();

          if (error) {
            Alert.alert("Sign Out Failed", error.message);
            return;
          }

          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Profile</Text>

      <Text style={styles.subtitle}>
        Manage your personal information, medications, reminders, and MEDCO app
        settings.
      </Text>

      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{accountDisplay.initials}</Text>
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.name}>{accountDisplay.fullName}</Text>
          <Text style={styles.email}>{accountDisplay.email}</Text>
          <Text style={styles.scheduleStatus}>
            {formatCreatedDate(scheduleCreatedAt)}
          </Text>
        </View>

        <Pressable style={styles.editButton} onPress={goToPersonalDetails}>
          <Ionicons name="create-outline" size={20} color="#2563eb" />
        </Pressable>
      </View>

      {!hasSavedSchedule && (
        <View style={styles.noticeCard}>
          <Ionicons name="information-circle" size={22} color="#2563eb" />
          <Text style={styles.noticeText}>
            Demo profile counts are showing. Scan and save a prescription
            schedule to display real medication and adherence data here.
          </Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <Pressable style={styles.statCard} onPress={goToCurrentMedications}>
          <View style={[styles.statIconCircle, styles.greenCircle]}>
            <Ionicons name="medical" size={24} color="#16a34a" />
          </View>
          <Text style={styles.statNumber}>{profileStats.medications}</Text>
          <Text style={styles.statLabel}>Medications</Text>
        </Pressable>

        <Pressable style={styles.statCard} onPress={goToDoseReminders}>
          <View style={[styles.statIconCircle, styles.purpleCircle]}>
            <Ionicons name="alarm" size={24} color="#7c3aed" />
          </View>
          <Text style={styles.statNumber}>
            {profileStats.enabledReminders || profileStats.totalDoses}
          </Text>
          <Text style={styles.statLabel}>Reminders</Text>
        </Pressable>

        <Pressable style={styles.statCard} onPress={goToAdherence}>
          <View style={[styles.statIconCircle, styles.blueCircle]}>
            <Ionicons name="bar-chart" size={24} color="#2563eb" />
          </View>
          <Text style={styles.statNumber}>
            {profileStats.adherencePercentage === 0
              ? "--"
              : `${profileStats.adherencePercentage}%`}
          </Text>
          <Text style={styles.statLabel}>Adherence</Text>
        </Pressable>
      </View>

      <View style={styles.healthSummaryCard}>
        <View style={styles.healthHeader}>
          <View>
            <Text style={styles.healthTitle}>Today&apos;s Health Summary</Text>
            <Text style={styles.healthSubtitle}>
              Medication progress based on saved schedule
            </Text>
          </View>

          <View style={styles.healthIconCircle}>
            <Ionicons name="heart" size={26} color="#ef4444" />
          </View>
        </View>

        <View style={styles.healthStatsRow}>
          <View style={styles.healthStatBox}>
            <Text style={[styles.healthStatNumber, styles.takenText]}>
              {profileStats.taken}
            </Text>
            <Text style={styles.healthStatLabel}>Taken</Text>
          </View>

          <View style={styles.healthStatBox}>
            <Text style={[styles.healthStatNumber, styles.pendingText]}>
              {profileStats.pending}
            </Text>
            <Text style={styles.healthStatLabel}>Pending</Text>
          </View>

          <View style={styles.healthStatBox}>
            <Text style={[styles.healthStatNumber, styles.missedText]}>
              {profileStats.missed}
            </Text>
            <Text style={styles.healthStatLabel}>Missed</Text>
          </View>

          <View style={styles.healthStatBox}>
            <Text style={[styles.healthStatNumber, styles.snoozedText]}>
              {profileStats.snoozed}
            </Text>
            <Text style={styles.healthStatLabel}>Snoozed</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Clinician Access Requests</Text>

      <View style={styles.accessRequestsCard}>
        {isLoadingAccessRequests ? (
          <View style={styles.accessLoadingRow}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.accessLoadingText}>Loading requests...</Text>
          </View>
        ) : null}

        {accessRequestError ? (
          <View style={styles.accessErrorBox}>
            <Ionicons name="warning" size={20} color="#b45309" />
            <Text style={styles.accessErrorText}>{accessRequestError}</Text>
          </View>
        ) : null}

        {!isLoadingAccessRequests &&
        !accessRequestError &&
        accessRequests.length === 0 ? (
          <View style={styles.emptyAccessBox}>
            <Ionicons name="shield-checkmark" size={30} color="#94a3b8" />
            <Text style={styles.emptyAccessTitle}>
              No clinician access requests.
            </Text>
            <Text style={styles.emptyAccessText}>
              Requests from clinicians will appear here for your approval.
            </Text>
          </View>
        ) : null}

        {accessRequests.map((request) => {
          const statusStyle = getAccessStatusStyles(request.status);
          const isUpdating = updatingAccessRequestId === request.id;

          return (
            <View key={request.id} style={styles.accessRequestItem}>
              <View style={styles.accessRequestHeader}>
                <View style={styles.accessClinicianIcon}>
                  <Ionicons
                    name={statusStyle.icon}
                    size={22}
                    color={statusStyle.iconColor}
                  />
                </View>

                <View style={styles.accessRequestTextBox}>
                  <Text style={styles.accessClinicianName}>
                    Clinician {shortenClinicianId(request.clinicianId)}
                  </Text>
                  <Text style={styles.accessRequestedAt}>
                    Requested {formatAccessRequestDate(request.requestedAt)}
                  </Text>
                </View>

                <View style={[styles.accessStatusBadge, statusStyle.badge]}>
                  <Text style={[styles.accessStatusText, statusStyle.text]}>
                    {formatAccessStatus(request.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.accessReason}>
                {request.reason?.trim() || "No reason provided."}
              </Text>

              {request.respondedAt ? (
                <Text style={styles.accessRespondedAt}>
                  Responded {formatAccessRequestDate(request.respondedAt)}
                </Text>
              ) : null}

              {request.status === "pending" ? (
                <View style={styles.accessActionsRow}>
                  <Pressable
                    style={[
                      styles.accessActionButton,
                      styles.denyAccessButton,
                      isUpdating && styles.disabledButton,
                    ]}
                    onPress={() => respondToAccessRequest(request, "rejected")}
                    disabled={isUpdating}
                  >
                    <Text style={styles.denyAccessText}>
                      {isUpdating ? "Updating..." : "Deny"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.accessActionButton,
                      styles.approveAccessButton,
                      isUpdating && styles.disabledButton,
                    ]}
                    onPress={() => respondToAccessRequest(request, "approved")}
                    disabled={isUpdating}
                  >
                    <Text style={styles.approveAccessText}>
                      {isUpdating ? "Updating..." : "Approve"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Treatment Notes</Text>

      <View style={styles.treatmentNotesCard}>
        {isLoadingTreatmentNotes ? (
          <View style={styles.accessLoadingRow}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.accessLoadingText}>Loading notes...</Text>
          </View>
        ) : null}

        {treatmentNotesError ? (
          <View style={styles.accessErrorBox}>
            <Ionicons name="warning" size={20} color="#b45309" />
            <Text style={styles.accessErrorText}>{treatmentNotesError}</Text>
          </View>
        ) : null}

        {!isLoadingTreatmentNotes &&
        !treatmentNotesError &&
        treatmentNotes.length === 0 ? (
          <View style={styles.emptyAccessBox}>
            <Ionicons name="document-text-outline" size={30} color="#94a3b8" />
            <Text style={styles.emptyAccessTitle}>No treatment notes.</Text>
            <Text style={styles.emptyAccessText}>
              Notes from approved clinicians will appear here.
            </Text>
          </View>
        ) : null}

        {treatmentNotes.map((note) => {
          return (
            <View key={note.id} style={styles.treatmentNoteItem}>
              <View style={styles.treatmentNoteHeader}>
                <View style={styles.treatmentNoteIcon}>
                  <Ionicons
                    name="clipboard-outline"
                    size={22}
                    color="#2563eb"
                  />
                </View>

                <View style={styles.treatmentNoteHeaderText}>
                  <Text style={styles.treatmentNoteType}>
                    {note.noteType?.trim() || "Treatment Note"}
                  </Text>
                  <Text style={styles.treatmentNoteMeta}>
                    Clinician {shortenClinicianId(note.clinicianId)}
                  </Text>
                </View>
              </View>

              <Text style={styles.treatmentNoteText}>{note.noteText}</Text>

              <Text style={styles.treatmentNoteDate}>
                Created {formatAccessRequestDate(note.createdAt)}
                {wasUpdatedAfterCreation(note)
                  ? ` • Updated ${formatAccessRequestDate(note.updatedAt)}`
                  : ""}
              </Text>
            </View>
          );
        })}
      </View>

      <Text
        style={styles.sectionTitle}
        onLayout={handleActionsSectionLayout}
      >
        Medical Profile
      </Text>

      <View style={styles.menuCard}>
        <ProfileMenuItem
          icon="person"
          iconColor="#2563eb"
          iconBackground="#dbeafe"
          title="Personal Details"
          subtitle="Name, age, gender, and basic information"
          onPress={goToPersonalDetails}
        />

        <ProfileMenuItem
          icon="medical"
          iconColor="#16a34a"
          iconBackground="#dcfce7"
          title="Current Medications"
          subtitle="View medicines saved from scanned prescriptions"
          onPress={goToCurrentMedications}
        />

        <ProfileMenuItem
          icon="alarm"
          iconColor="#7c3aed"
          iconBackground="#ede9fe"
          title="Dose Reminders"
          subtitle="Manage medication reminder settings"
          onPress={goToDoseReminders}
        />

        <ProfileMenuItem
          icon="git-compare"
          iconColor="#dc2626"
          iconBackground="#fee2e2"
          title="Drug Interactions"
          subtitle="Recalculate interactions from saved medicines"
          onPress={goToDrugInteractions}
        />

        <ProfileMenuItem
          icon="warning"
          iconColor="#f59e0b"
          iconBackground="#fef3c7"
          title="Medical Conditions"
          subtitle="Allergies, conditions, and drug safety notes"
          onPress={goToMedicalConditions}
          isLast
        />
      </View>

      <Text style={styles.sectionTitle}>Scanner & Adherence</Text>

      <View style={styles.menuCard}>
        <ProfileMenuItem
          icon="scan"
          iconColor="#2563eb"
          iconBackground="#dbeafe"
          title="Scan New Prescription"
          subtitle="Upload a prescription and create a medication schedule"
          onPress={goToScanner}
        />

        <ProfileMenuItem
          icon="bar-chart"
          iconColor="#16a34a"
          iconBackground="#dcfce7"
          title="Adherence Tracking"
          subtitle="Track Taken, Missed, Snoozed, and Pending doses"
          onPress={goToAdherence}
          isLast
        />
      </View>

      <Text style={styles.sectionTitle}>Settings</Text>

      <View style={styles.menuCard}>
        <ProfileMenuItem
          icon="notifications"
          iconColor="#2563eb"
          iconBackground="#dbeafe"
          title="Notifications"
          subtitle="Manage app notification preferences"
          onPress={goToDoseReminders}
        />

        <ProfileMenuItem
          icon="shield-checkmark"
          iconColor="#16a34a"
          iconBackground="#dcfce7"
          title="Privacy & Security"
          subtitle="Local data and app privacy settings"
          onPress={() =>
            Alert.alert(
              "Privacy & Security",
              "This prototype stores medication data locally on this device using AsyncStorage.",
            )
          }
        />

        <ProfileMenuItem
          icon="trash"
          iconColor="#ef4444"
          iconBackground="#fee2e2"
          title="Clear Local MEDCO Data"
          subtitle="Remove saved schedule, reminders, and history"
          onPress={clearAllLocalData}
          isLast
        />
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

type ProfileMenuItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
};

function ProfileMenuItem({
  icon,
  iconColor,
  iconBackground,
  title,
  subtitle,
  onPress,
  isLast = false,
}: ProfileMenuItemProps) {
  return (
    <Pressable
      style={[styles.menuItem, isLast && styles.menuItemLast]}
      onPress={onPress}
    >
      <View
        style={[
          styles.menuIconCircle,
          {
            backgroundColor: iconBackground,
          },
        ]}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>

      <View style={styles.menuTextBox}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={22} color="#cbd5e1" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 34,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 23,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 18,
  },
  profileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#ffffff",
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  email: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 4,
  },
  scheduleStatus: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#94a3b8",
  },
  editButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  noticeCard: {
    backgroundColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    color: "#1e40af",
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    minHeight: 118,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  greenCircle: {
    backgroundColor: "#dcfce7",
  },
  purpleCircle: {
    backgroundColor: "#ede9fe",
  },
  blueCircle: {
    backgroundColor: "#dbeafe",
  },
  statNumber: {
    fontSize: 23,
    fontWeight: "900",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#64748b",
    textAlign: "center",
    marginTop: 2,
  },
  healthSummaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    marginBottom: 22,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  healthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  healthTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  healthSubtitle: {
    fontSize: 13.5,
    color: "#94a3b8",
    fontWeight: "700",
  },
  healthIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  healthStatsRow: {
    flexDirection: "row",
    gap: 9,
  },
  healthStatBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  healthStatNumber: {
    fontSize: 22,
    fontWeight: "900",
  },
  healthStatLabel: {
    fontSize: 11.5,
    color: "#64748b",
    fontWeight: "800",
    marginTop: 3,
    textAlign: "center",
  },
  takenText: {
    color: "#16a34a",
  },
  pendingText: {
    color: "#2563eb",
  },
  missedText: {
    color: "#ef4444",
  },
  snoozedText: {
    color: "#f59e0b",
  },
  sectionTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 12,
    marginTop: 4,
  },
  menuCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingVertical: 4,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  accessRequestsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 14,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  treatmentNotesCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 14,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  accessLoadingRow: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  accessLoadingText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748b",
  },
  accessErrorBox: {
    backgroundColor: "#fef3c7",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  accessErrorText: {
    flex: 1,
    fontSize: 13.3,
    lineHeight: 19,
    color: "#92400e",
    fontWeight: "700",
  },
  emptyAccessBox: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  emptyAccessTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#334155",
    marginTop: 10,
    textAlign: "center",
  },
  emptyAccessText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 5,
  },
  accessRequestItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 13,
  },
  accessRequestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  accessClinicianIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  accessRequestTextBox: {
    flex: 1,
  },
  accessClinicianName: {
    fontSize: 15.5,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  accessRequestedAt: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#94a3b8",
  },
  accessStatusBadge: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  accessStatusText: {
    fontSize: 12,
    fontWeight: "900",
  },
  accessPendingBadge: {
    backgroundColor: "#fef3c7",
  },
  accessPendingText: {
    color: "#b45309",
  },
  accessApprovedBadge: {
    backgroundColor: "#dcfce7",
  },
  accessApprovedText: {
    color: "#15803d",
  },
  accessRejectedBadge: {
    backgroundColor: "#fee2e2",
  },
  accessRejectedText: {
    color: "#dc2626",
  },
  accessReason: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#475569",
    fontWeight: "700",
    marginTop: 10,
  },
  accessRespondedAt: {
    fontSize: 12.5,
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 6,
  },
  accessActionsRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },
  accessActionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  denyAccessButton: {
    backgroundColor: "#fee2e2",
  },
  denyAccessText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "900",
  },
  approveAccessButton: {
    backgroundColor: "#16a34a",
  },
  approveAccessText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  treatmentNoteItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 13,
  },
  treatmentNoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  treatmentNoteIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  treatmentNoteHeaderText: {
    flex: 1,
  },
  treatmentNoteType: {
    fontSize: 15.5,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  treatmentNoteMeta: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#94a3b8",
  },
  treatmentNoteText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#334155",
    fontWeight: "700",
  },
  treatmentNoteDate: {
    fontSize: 12.5,
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 9,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuTextBox: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  menuSubtitle: {
    fontSize: 13.2,
    lineHeight: 18,
    color: "#64748b",
    fontWeight: "600",
  },
  signOutButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ef4444",
  },
  disabledButton: {
    opacity: 0.6,
  },
  bottomSpace: {
    height: 34,
  },
});
