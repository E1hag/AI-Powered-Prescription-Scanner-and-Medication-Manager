import { supabase } from "@/src/lib/supabase";

export type InteractionSeverity = "Mild" | "Moderate" | "Severe";

export type DrugInteractionRecord = {
  masterInteractionId?: string | null;
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  description: string;
  recommendation: string;
};

export type InteractionMedicationDose = {
  medicationName: string;
  ingredientA?: string | null;
  ingredientB?: string | null;
};

export type DrugInteractionCheckResult = {
  interactions: DrugInteractionRecord[];
  checkedIngredientCount: number;
  masterInteractionCount: number;
};

type DrugInteractionMasterRow = Record<string, unknown>;

const DRUG_INTERACTION_MASTER_TABLES = [
  "drug_interactions_master",
  "drug_interaction_master",
  "drug-interaction_master",
  "drug-interactions_master",
];

const MASTER_PAGE_SIZE = 1000;
const MASTER_MAX_ROWS = 50000;

const DRUG_A_COLUMNS = [
  "drug_a",
  "drugA",
  "drug1",
  "drug_1",
  "drug1_name",
  "drug_1_name",
  "drug_one",
  "drug_one_name",
  "ingredient_a",
  "ingredientA",
  "generic_a",
  "genericA",
  "generic1",
  "generic_1",
  "generic_name_a",
  "genericNameA",
  "active_ingredient_a",
  "activeIngredientA",
  "active_substance_a",
  "medication_a",
  "medicationA",
  "medicine_a",
  "medicineA",
  "substance_a",
  "substanceA",
  "name_a",
  "drug_name",
  "drug",
  "Drug A",
  "Drug 1",
  "Drug1",
  "drug 1",
];

const DRUG_B_COLUMNS = [
  "drug_b",
  "drugB",
  "drug2",
  "drug_2",
  "drug2_name",
  "drug_2_name",
  "drug_two",
  "drug_two_name",
  "ingredient_b",
  "ingredientB",
  "generic_b",
  "genericB",
  "generic2",
  "generic_2",
  "generic_name_b",
  "genericNameB",
  "active_ingredient_b",
  "activeIngredientB",
  "active_substance_b",
  "medication_b",
  "medicationB",
  "medicine_b",
  "medicineB",
  "substance_b",
  "substanceB",
  "name_b",
  "interacting_drug",
  "interactingDrug",
  "interacting_drug_name",
  "interacts_with",
  "contraindicated_drug",
  "Drug B",
  "Drug 2",
  "Drug2",
  "drug 2",
];

const SEVERITY_COLUMNS = [
  "severity",
  "Severity",
  "risk_level",
  "riskLevel",
  "level",
  "Level",
  "interaction_severity",
  "classification",
  "Classification",
];

const DESCRIPTION_COLUMNS = [
  "description",
  "Description",
  "interaction",
  "Interaction",
  "interaction_description",
  "interactionDescription",
  "effect",
  "Effect",
  "clinical_effect",
  "details",
  "Details",
  "mechanism",
];

const RECOMMENDATION_COLUMNS = [
  "recommendation",
  "Recommendation",
  "management",
  "Management",
  "advice",
  "Advice",
  "action",
  "Action",
  "clinical_management",
  "clinicalManagement",
  "precaution",
  "Precaution",
];

function normalizeIngredientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getInteractionIngredientsForDose(
  dose: InteractionMedicationDose,
) {
  const ingredients = [dose.ingredientA, dose.ingredientB]
    .map((ingredient) => ingredient?.trim())
    .filter((ingredient): ingredient is string => Boolean(ingredient));

  if (ingredients.length > 0) {
    return ingredients;
  }

  return dose.medicationName.trim() ? [dose.medicationName.trim()] : [];
}

export function getInteractionIngredientsForDoses(
  doses: InteractionMedicationDose[],
) {
  return doses.flatMap(getInteractionIngredientsForDose);
}

export function buildIngredientFingerprint(ingredientNames: string[]) {
  return Array.from(
    new Set(
      ingredientNames
        .map(normalizeIngredientName)
        .filter((name) => name.length > 0),
    ),
  )
    .sort()
    .join("|");
}

function readString(row: DrugInteractionMasterRow, columnNames: string[]) {
  for (const columnName of columnNames) {
    const value = row[columnName];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function normalizeSeverity(value: string): InteractionSeverity {
  const normalizedValue = normalizeIngredientName(value);

  if (
    normalizedValue.includes("severe") ||
    normalizedValue.includes("major") ||
    normalizedValue.includes("high") ||
    normalizedValue.includes("contraindicated")
  ) {
    return "Severe";
  }

  if (
    normalizedValue.includes("mild") ||
    normalizedValue.includes("minor") ||
    normalizedValue.includes("low")
  ) {
    return "Mild";
  }

  return "Moderate";
}

function mapMasterRowToInteraction(
  row: DrugInteractionMasterRow,
): DrugInteractionRecord | null {
  const drugA = readString(row, DRUG_A_COLUMNS);
  const drugB = readString(row, DRUG_B_COLUMNS);

  if (!drugA || !drugB) {
    return null;
  }

  return {
    masterInteractionId: readString(row, ["id"]) || null,
    drugA,
    drugB,
    severity: normalizeSeverity(readString(row, SEVERITY_COLUMNS)),
    description:
      readString(row, DESCRIPTION_COLUMNS) ||
      `${drugA} may interact with ${drugB}.`,
    recommendation:
      readString(row, RECOMMENDATION_COLUMNS) ||
      "Confirm this combination with a doctor or pharmacist before continuing.",
  };
}

async function getDrugInteractionMaster() {
  const errors: string[] = [];

  for (const tableName of DRUG_INTERACTION_MASTER_TABLES) {
    const rows: DrugInteractionMasterRow[] = [];
    let from = 0;
    let tableError: string | null = null;

    while (from < MASTER_MAX_ROWS) {
      const to = from + MASTER_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .range(from, to)
        .returns<DrugInteractionMasterRow[]>();

      if (error) {
        tableError = error.message;
        break;
      }

      rows.push(...data);

      if (data.length < MASTER_PAGE_SIZE) {
        break;
      }

      from += MASTER_PAGE_SIZE;
    }

    if (!tableError) {
      return rows
        .map(mapMasterRowToInteraction)
        .filter(
          (interaction): interaction is DrugInteractionRecord =>
            interaction !== null,
        );
    }

    errors.push(`${tableName}: ${tableError}`);
  }

  throw new Error(
    `Unable to read drug interaction master table. Tried ${DRUG_INTERACTION_MASTER_TABLES.join(
      ", ",
    )}. ${errors.join(" | ")}`,
  );
}

function findDrugInteraction(
  ingredientA: string,
  ingredientB: string,
  interactionMaster: DrugInteractionRecord[],
): DrugInteractionRecord | null {
  const a = normalizeIngredientName(ingredientA);
  const b = normalizeIngredientName(ingredientB);

  if (!a || !b || a === b) {
    return null;
  }

  return (
    interactionMaster.find((entry) => {
      const entryA = normalizeIngredientName(entry.drugA);
      const entryB = normalizeIngredientName(entry.drugB);

      const matches = (left: string, right: string) => {
        return left.includes(right) || right.includes(left);
      };

      return (
        (matches(a, entryA) && matches(b, entryB)) ||
        (matches(a, entryB) && matches(b, entryA))
      );
    }) ?? null
  );
}

export async function checkDrugInteractions(
  ingredientNames: string[],
): Promise<DrugInteractionCheckResult> {
  const uniqueNames = Array.from(
    new Set(
      ingredientNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  );

  const foundInteractions: DrugInteractionRecord[] = [];
  const interactionMaster = await getDrugInteractionMaster();

  for (let i = 0; i < uniqueNames.length; i += 1) {
    for (let j = i + 1; j < uniqueNames.length; j += 1) {
      const interaction = findDrugInteraction(
        uniqueNames[i],
        uniqueNames[j],
        interactionMaster,
      );

      if (interaction) {
        foundInteractions.push({
          ...interaction,
          drugA: uniqueNames[i],
          drugB: uniqueNames[j],
        });
      }
    }
  }

  return {
    interactions: foundInteractions,
    checkedIngredientCount: uniqueNames.length,
    masterInteractionCount: interactionMaster.length,
  };
}

export async function findAllDrugInteractions(
  ingredientNames: string[],
): Promise<DrugInteractionRecord[]> {
  const result = await checkDrugInteractions(ingredientNames);

  return result.interactions;
}
