import {
  AdherenceHistoryItem,
  MedicationDose,
} from "@/src/services/medcoSupabaseService";

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

export function applyDoseStatusesForDate(
  doses: MedicationDose[],
  history: AdherenceHistoryItem[],
  dateKey: string,
) {
  const latestActionsByDoseId = getLatestDoseActionsForDate(history, dateKey);

  return doses.map((dose) => {
    const latestAction = latestActionsByDoseId.get(dose.id);

    return {
      ...dose,
      status: latestAction?.action ?? "Pending",
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
