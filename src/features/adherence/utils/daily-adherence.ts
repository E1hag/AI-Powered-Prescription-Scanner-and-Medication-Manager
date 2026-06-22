import {
  AdherenceHistoryItem,
  DoseStatus,
  MedicationDose,
} from "@/src/services/medcoSupabaseService";

export type DoseDisplayStatus = DoseStatus | "Upcoming" | "Due now" | "Late";

export type DailyMedicationDose = MedicationDose & {
  displayStatus: DoseDisplayStatus;
  displayLabel: string;
  snoozedUntil: string | null;
};

const DUE_WINDOW_MINUTES = 30;
const MISSED_AFTER_MINUTES = 120;
const SNOOZE_MINUTES = 30;

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getHistoryDateKey(item: AdherenceHistoryItem) {
  return getLocalDateKey(new Date(item.createdAt));
}

export function getLatestDoseActionsForDate(
  history: AdherenceHistoryItem[],
  dateKey: string,
) {
  const latestActionsByDoseId = new Map<string, AdherenceHistoryItem>();

  history.forEach((item) => {
    if (getHistoryDateKey(item) !== dateKey) {
      return;
    }

    const existingItem = latestActionsByDoseId.get(item.doseId);

    if (
      !existingItem ||
      new Date(item.createdAt).getTime() >
        new Date(existingItem.createdAt).getTime()
    ) {
      latestActionsByDoseId.set(item.doseId, item);
    }
  });

  return latestActionsByDoseId;
}

function getDateForTime(dateKey: string, timeText: string) {
  const timeMatch = timeText
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);

  if (!timeMatch) {
    return null;
  }

  const [, hourText, minuteText = "00", meridiemText] = timeMatch;
  let hour = Number(hourText);
  const minute = Number(minuteText);
  const meridiem = meridiemText.toUpperCase();

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  if (meridiem === "PM" && hour !== 12) {
    hour += 12;
  }

  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }

  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTimeBasedDisplayStatus(
  dose: MedicationDose,
  dateKey: string,
  now: Date,
  effectiveDoseTime?: Date,
): Pick<DailyMedicationDose, "displayStatus" | "displayLabel"> {
  const doseTime = effectiveDoseTime ?? getDateForTime(dateKey, dose.time);

  if (!doseTime || dose.isPrn) {
    return {
      displayStatus: "Pending",
      displayLabel: "Pending",
    };
  }

  const minutesFromDose =
    (now.getTime() - doseTime.getTime()) / (60 * 1000);

  if (minutesFromDose < -DUE_WINDOW_MINUTES) {
    return {
      displayStatus: "Upcoming",
      displayLabel: "Upcoming",
    };
  }

  if (minutesFromDose <= DUE_WINDOW_MINUTES) {
    return {
      displayStatus: "Due now",
      displayLabel: "Due now",
    };
  }

  if (minutesFromDose <= MISSED_AFTER_MINUTES) {
    return {
      displayStatus: "Late",
      displayLabel: "Late",
    };
  }

  return {
    displayStatus: "Missed",
    displayLabel: "Missed",
  };
}

export function applyDoseStatusesForDate(
  doses: MedicationDose[],
  history: AdherenceHistoryItem[],
  dateKey: string,
  now = new Date(),
): DailyMedicationDose[] {
  const latestActionsByDoseId = getLatestDoseActionsForDate(history, dateKey);

  return doses.map((dose) => {
    const latestAction = latestActionsByDoseId.get(dose.id);
    let snoozedUntil: string | null = null;

    if (latestAction?.action === "Taken" || latestAction?.action === "Missed") {
      return {
        ...dose,
        status: latestAction.action,
        displayStatus: latestAction.action,
        displayLabel: latestAction.action,
        snoozedUntil,
      };
    }

    if (latestAction?.action === "Snoozed") {
      const snoozeUntilDate = new Date(latestAction.createdAt);
      snoozeUntilDate.setMinutes(snoozeUntilDate.getMinutes() + SNOOZE_MINUTES);
      snoozedUntil = snoozeUntilDate.toISOString();

      if (now.getTime() < snoozeUntilDate.getTime()) {
        return {
          ...dose,
          status: "Snoozed",
          displayStatus: "Snoozed",
          displayLabel: `Snoozed until ${formatTime(snoozeUntilDate)}`,
          snoozedUntil,
        };
      }

      const snoozedStatus = getTimeBasedDisplayStatus(
        dose,
        dateKey,
        now,
        snoozeUntilDate,
      );

      return {
        ...dose,
        status: "Pending",
        displayStatus: snoozedStatus.displayStatus,
        displayLabel: snoozedStatus.displayLabel,
        snoozedUntil,
      };
    }

    const timeBasedStatus = getTimeBasedDisplayStatus(dose, dateKey, now);

    return {
      ...dose,
      status: "Pending",
      displayStatus: timeBasedStatus.displayStatus,
      displayLabel: timeBasedStatus.displayLabel,
      snoozedUntil,
    };
  });
}

export function getDoseIndicator(dose: MedicationDose) {
  if (dose.isPrn) {
    return "As needed";
  }

  if (
    typeof dose.doseIndex === "number" &&
    typeof dose.totalDailyDoses === "number" &&
    dose.totalDailyDoses > 1
  ) {
    return `Dose ${dose.doseIndex} of ${dose.totalDailyDoses}`;
  }

  return null;
}
