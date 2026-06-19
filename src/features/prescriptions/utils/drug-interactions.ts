export type InteractionSeverity = "Mild" | "Moderate" | "Severe";

export type DrugInteractionRecord = {
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  description: string;
  recommendation: string;
};

// Curated, well-documented interactions only. Not exhaustive - extend as needed.
const KNOWN_DRUG_INTERACTIONS: DrugInteractionRecord[] = [
  {
    drugA: "warfarin",
    drugB: "ibuprofen",
    severity: "Severe",
    description:
      "Combining warfarin with ibuprofen significantly increases the risk of gastrointestinal bleeding and can amplify warfarin's blood-thinning effect.",
    recommendation:
      "Avoid this combination if possible. Contact the prescribing doctor before taking both medications together.",
  },
  {
    drugA: "warfarin",
    drugB: "aspirin",
    severity: "Severe",
    description:
      "Aspirin combined with warfarin substantially raises the risk of serious bleeding, including gastrointestinal and intracranial bleeding.",
    recommendation:
      "This combination should only be used under close medical supervision. Contact a doctor before continuing.",
  },
  {
    drugA: "warfarin",
    drugB: "azithromycin",
    severity: "Moderate",
    description:
      "Azithromycin may enhance the anticoagulant effect of warfarin, increasing bleeding risk.",
    recommendation:
      "Monitor INR closely if both medications are required together.",
  },
  {
    drugA: "aspirin",
    drugB: "ibuprofen",
    severity: "Moderate",
    description:
      "Ibuprofen can interfere with aspirin's heart-protective (antiplatelet) effect and increases the risk of stomach irritation and bleeding.",
    recommendation:
      "Separate dosing times if both are necessary, and confirm with a pharmacist or doctor.",
  },
  {
    drugA: "lisinopril",
    drugB: "ibuprofen",
    severity: "Moderate",
    description:
      "NSAIDs like ibuprofen can reduce the blood-pressure-lowering effect of ACE inhibitors such as lisinopril and may impair kidney function.",
    recommendation:
      "Monitor blood pressure and kidney function; use the lowest effective NSAID dose for the shortest duration.",
  },
  {
    drugA: "sertraline",
    drugB: "ibuprofen",
    severity: "Moderate",
    description:
      "Combining an SSRI like sertraline with ibuprofen increases the risk of gastrointestinal bleeding.",
    recommendation:
      "Use with caution; consider a gastroprotective agent if long-term use is needed.",
  },
  {
    drugA: "clarithromycin",
    drugB: "simvastatin",
    severity: "Severe",
    description:
      "Clarithromycin inhibits the metabolism of simvastatin, raising statin levels and the risk of muscle damage (rhabdomyolysis).",
    recommendation:
      "Avoid combining; the statin may need to be paused during clarithromycin treatment.",
  },
  {
    drugA: "metformin",
    drugB: "ibuprofen",
    severity: "Mild",
    description:
      "NSAIDs can affect kidney function, which may indirectly affect metformin clearance and increase the risk of lactic acidosis in rare cases.",
    recommendation:
      "Use occasional NSAID doses cautiously; avoid prolonged NSAID use without medical advice.",
  },
];

function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase();
}

export function findDrugInteraction(
  ingredientA: string,
  ingredientB: string,
): DrugInteractionRecord | null {
  const a = normalizeIngredientName(ingredientA);
  const b = normalizeIngredientName(ingredientB);

  if (!a || !b || a === b) {
    return null;
  }

  return (
    KNOWN_DRUG_INTERACTIONS.find((entry) => {
      const entryA = normalizeIngredientName(entry.drugA);
      const entryB = normalizeIngredientName(entry.drugB);

      return (
        (a.includes(entryA) && b.includes(entryB)) ||
        (a.includes(entryB) && b.includes(entryA))
      );
    }) ?? null
  );
}

export function findAllDrugInteractions(
  ingredientNames: string[],
): DrugInteractionRecord[] {
  const uniqueNames = Array.from(
    new Set(
      ingredientNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  );

  const foundInteractions: DrugInteractionRecord[] = [];

  for (let i = 0; i < uniqueNames.length; i += 1) {
    for (let j = i + 1; j < uniqueNames.length; j += 1) {
      const interaction = findDrugInteraction(uniqueNames[i], uniqueNames[j]);

      if (interaction) {
        foundInteractions.push({
          ...interaction,
          drugA: uniqueNames[i],
          drugB: uniqueNames[j],
        });
      }
    }
  }

  return foundInteractions;
}
