import { createClient } from 'npm:@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const prescriptionStatusValues = {
  processing: 'processing',
  needsReview: 'needs_review',
  ocrFailed: 'ocr_failed',
} as const;

const parserVersion = 'v4-normalized-fields';

type AnalyzeRequest = {
  prescriptionId: string;
  imagePath?: string;
  mimeType?: string;
  storageBucket?: string;
  useMockData?: boolean;
};

type ParsedMedication = {
  positionIndex: number;
  rawMedicationText: string;
  medicationName: string | null;
  strengthText: string | null;
  dosageText: string | null;
  frequencyText: string | null;
  timingText: string | null;
  durationText: string | null;
  startDateText: string | null;
  notesText: string | null;
  normalizedFields: {
    medicationName: string | null;
    strength: string | null;
    dosage: string | null;
    frequency: string | null;
    timingInstructions: string | null;
    duration: string | null;
    startDate: string | null;
    notes: string | null;
  };
  fieldSources: {
    startDateSource: 'ocr' | 'suggested' | 'user' | null;
    timingSource: 'ocr' | 'suggested' | 'user' | null;
  };
  confidenceFlags: string[];
  parsingIssues: string[];
  reviewStatus: 'pending';
  isScheduleGeneratable: boolean;
};

type ProviderResult = {
  provider: string;
  providerModel: string | null;
  source: 'live' | 'mock';
  rawOcrText: string;
  overallConfidence: number | null;
  handwritingDetected: boolean;
  providerResponse: Record<string, unknown>;
  ocrBlocks: Array<Record<string, unknown>>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function getEnv(name: string) {
  return Deno.env.get(name) ?? '';
}

function requireEnv(name: string) {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createAdminClient() {
  return createClient(
    getEnv('SUPABASE_URL') || requireEnv('SUPABASE_PROJECT_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  );
}

function extractBearerToken(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function normalizeForComparison(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function toTitleCaseWords(value: string) {
  return value
    .split(/\s+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(' ');
}

function createParsingIssueList(...issues: Array<string | null>) {
  return Array.from(new Set(issues.filter(Boolean))) as string[];
}

function createConfidenceFlagList(...flags: Array<string | null>) {
  return Array.from(new Set(flags.filter(Boolean))) as string[];
}

type BoundingBox = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xCenter: number;
  yCenter: number;
};

type NormalizedOcrBlock = {
  id: number;
  content: string;
  polygon: Record<string, unknown> | null;
  bounds: BoundingBox | null;
};

type MedicationRow = {
  medicationName: string[];
  scientificName: string[];
  strength: string[];
  dosage: string[];
  frequency: string[];
  route: string[];
  duration: string[];
  instruction: string[];
};

function extractContentFromBlock(block: Record<string, unknown>) {
  const content = block.content;
  return typeof content === 'string' ? normalizeText(content) : '';
}

function getPolygonVertices(polygon: Record<string, unknown> | null | undefined) {
  if (!polygon) {
    return [];
  }

  const vertices = Array.isArray(polygon.vertices)
    ? polygon.vertices
    : Array.isArray(polygon.normalizedVertices)
      ? polygon.normalizedVertices
      : [];

  return vertices
    .map((vertex) => {
      if (!vertex || typeof vertex !== 'object') {
        return null;
      }

      const x = Number((vertex as { x?: number }).x);
      const y = Number((vertex as { y?: number }).y);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return { x, y };
    })
    .filter((vertex): vertex is { x: number; y: number } => vertex !== null);
}

function getBoundsFromPolygon(polygon: Record<string, unknown> | null | undefined): BoundingBox | null {
  const vertices = getPolygonVertices(polygon);

  if (vertices.length === 0) {
    return null;
  }

  const xValues = vertices.map((vertex) => vertex.x);
  const yValues = vertices.map((vertex) => vertex.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    xCenter: (xMin + xMax) / 2,
    yCenter: (yMin + yMax) / 2,
  };
}

function getOcrLines(rawText: string, ocrBlocks: Array<Record<string, unknown>>) {
  const linesFromBlocks = ocrBlocks.map(extractContentFromBlock).filter(Boolean);

  if (linesFromBlocks.length > 0) {
    return linesFromBlocks;
  }

  return rawText
    .split(/\r?\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function isMedicationSectionHeader(line: string) {
  const value = normalizeForComparison(line);
  return (
    value.includes('medication name') ||
    value.includes('scientific name') ||
    value.includes('ingredient strength') ||
    value.includes('route of admin') ||
    value === 'medication' ||
    value === 'name' ||
    value === 'frequency' ||
    value === 'duration instruction'
  );
}

function isMedicationSectionFooter(line: string) {
  const value = normalizeForComparison(line);
  return value.startsWith('doctor name') || value.startsWith('doctor signature');
}

function isAdministrativeLine(line: string) {
  const value = normalizeForComparison(line);

  return (
    value.startsWith('date:') ||
    value.startsWith('encounter id') ||
    value === 'prescription' ||
    value.startsWith('name:') ||
    value.startsWith('medical record') ||
    value.startsWith('nationality:') ||
    value.startsWith('gender:') ||
    value.startsWith('insurance no') ||
    value.startsWith('insurance company') ||
    value.startsWith('tpa:') ||
    value.startsWith('condition:') ||
    value.startsWith('active allergies') ||
    value.startsWith('pharmacy name') ||
    value.startsWith('doctor name') ||
    value.startsWith('doctor signature') ||
    value === 'oral' ||
    value === 'n/a'
  );
}

function looksLikeMedicationRowStart(line: string) {
  const normalized = normalizeText(line);
  const value = normalizeForComparison(line);

  if (!normalized || isAdministrativeLine(normalized) || isMedicationSectionHeader(normalized)) {
    return false;
  }

  if (value === 'prn') {
    return false;
  }

  return /^[A-Z][A-Z0-9-]{2,}(?:\s+[A-Z0-9-]{2,}){0,2}$/.test(normalized);
}

function extractLeadingMedicationName(line: string) {
  const normalized = normalizeText(line);
  const match = normalized.match(/^([A-Z][A-Z0-9-]{2,}(?:\s+[A-Z0-9-]{2,}){0,2})(?:\s+(.+))?$/);

  if (!match) {
    return null;
  }

  const medicationName = normalizeText(match[1]);

  if (!looksLikeMedicationRowStart(medicationName)) {
    return null;
  }

  return {
    medicationName,
    remainder: normalizeText(match[2] ?? '') || null,
  };
}

function normalizeOcrBlocks(rawText: string, ocrBlocks: Array<Record<string, unknown>>) {
  const normalizedBlocks = ocrBlocks
    .map((block, index) => {
      const content = extractContentFromBlock(block);

      if (!content) {
        return null;
      }

      const polygon =
        block.polygon && typeof block.polygon === 'object'
          ? (block.polygon as Record<string, unknown>)
          : null;

      return {
        id: typeof block.id === 'number' ? block.id : index,
        content,
        polygon,
        bounds: getBoundsFromPolygon(polygon),
      };
    })
    .filter((block): block is NormalizedOcrBlock => block !== null);

  if (normalizedBlocks.length > 0) {
    return normalizedBlocks;
  }

  return rawText
    .split(/\r?\n+/)
    .map((line, index) => normalizeText(line))
    .filter(Boolean)
    .map((content, index) => ({
      id: index,
      content,
      polygon: null,
      bounds: null,
    }));
}

function sortBlocksByGeometry(blocks: NormalizedOcrBlock[]) {
  return [...blocks].sort((left, right) => {
    if (left.bounds && right.bounds) {
      const yDifference = left.bounds.yMin - right.bounds.yMin;

      if (Math.abs(yDifference) > 8) {
        return yDifference;
      }

      return left.bounds.xMin - right.bounds.xMin;
    }

    return left.id - right.id;
  });
}

function joinOrderedValues(values: string[]) {
  return normalizeText(
    values
      .map((value) => normalizeText(value))
      .filter(Boolean)
      .join(' ')
  );
}

function normalizeFrequencyText(value: string | null) {
  if (!value) {
    return null;
  }

  return normalizeText(
    value
      .replace(/^1\s+per\s+day$/i, 'once daily')
      .replace(/^2\s+per\s+day$/i, 'twice daily')
      .replace(/^3\s+per\s+day$/i, 'three times daily')
      .replace(/^1\s+times?\s+per\s+day$/i, 'once daily')
      .replace(/^2\s+times?\s+per\s+day$/i, 'twice daily')
      .replace(/^3\s+times?\s+per\s+day$/i, 'three times daily')
      .replace(/^1\s+time\/daily$/i, 'once daily')
      .replace(/^2\s+time\/daily$/i, 'twice daily')
      .replace(/^3\s+time\/daily$/i, 'three times daily')
  );
}

function normalizeDocumentDate(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizeText(value);
  const isoMatch = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dayFirstMatch = normalized.match(/\b(\d{2})[-/](\d{2})[-/](20\d{2})\b/);

  if (dayFirstMatch) {
    return `${dayFirstMatch[3]}-${dayFirstMatch[2]}-${dayFirstMatch[1]}`;
  }

  return null;
}

function extractDocumentDate(rawText: string, ocrBlocks: Array<Record<string, unknown>> = []) {
  const lines = rawText.split(/\r?\n+/).map((line) => normalizeText(line)).filter(Boolean);
  const normalizedBlocks = sortBlocksByGeometry(normalizeOcrBlocks(rawText, ocrBlocks)).filter(
    (block) => block.bounds
  );

  if (normalizedBlocks.length > 0) {
    const maxY = Math.max(...normalizedBlocks.map((block) => block.bounds?.yMax ?? 0));
    const maxX = Math.max(...normalizedBlocks.map((block) => block.bounds?.xMax ?? 0));
    const topRightCandidates = normalizedBlocks
      .filter(
        (block) =>
          (block.bounds?.yMin ?? 0) <= maxY * 0.25 && (block.bounds?.xCenter ?? 0) >= maxX * 0.55
      )
      .sort((left, right) => {
        const yDifference = (left.bounds?.yMin ?? 0) - (right.bounds?.yMin ?? 0);

        if (Math.abs(yDifference) > 12) {
          return yDifference;
        }

        return (right.bounds?.xMax ?? 0) - (left.bounds?.xMax ?? 0);
      });

    for (const block of topRightCandidates) {
      const blockDate =
        block.content.match(/\bdate\s*:\s*([0-9]{2}[-/][0-9]{2}[-/](?:20)?[0-9]{2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})\b/i) ??
        block.content.match(/\b([0-9]{2}[-/][0-9]{2}[-/](?:20)?[0-9]{2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})\b/i);

      if (blockDate) {
        return normalizeDocumentDate(blockDate[1]);
      }
    }
  }

  for (const line of lines.slice(0, 12)) {
    const directDate = line.match(/\bdate\s*:\s*([0-9]{2}[-/][0-9]{2}[-/](?:20)?[0-9]{2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})\b/i);

    if (directDate) {
      return normalizeDocumentDate(directDate[1]);
    }
  }

  for (const line of lines.slice(0, 12)) {
    const genericDate = line.match(/\b([0-9]{2}[-/][0-9]{2}[-/](?:20)?[0-9]{2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})\b/);

    if (genericDate) {
      return normalizeDocumentDate(genericDate[1]);
    }
  }

  const fullTextDate =
    rawText.match(/\bdate\s*:\s*([0-9]{2}[-/][0-9]{2}[-/](?:20)?[0-9]{2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})\b/i) ??
    rawText.match(/\b([0-9]{2}[-/][0-9]{2}[-/](?:20)?[0-9]{2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})\b/i);

  if (fullTextDate) {
    return normalizeDocumentDate(fullTextDate[1]);
  }

  const fallbackBlocks = normalizedBlocks.sort((left, right) => {
    const yDifference = (left.bounds?.yMin ?? 0) - (right.bounds?.yMin ?? 0);

    if (Math.abs(yDifference) > 20) {
      return yDifference;
    }

    return (right.bounds?.xMax ?? 0) - (left.bounds?.xMax ?? 0);
  });

  for (const block of fallbackBlocks.slice(0, 20)) {
    const blockDate =
      block.content.match(/\bdate\s*:\s*([0-9]{2}[-/][0-9]{2}[-/](?:20)?[0-9]{2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})\b/i) ??
      block.content.match(/\b([0-9]{2}[-/][0-9]{2}[-/](?:20)?[0-9]{2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})\b/i);

    if (blockDate) {
      return normalizeDocumentDate(blockDate[1]);
    }
  }

  return null;
}

function normalizeDurationText(value: string | null) {
  if (!value) {
    return null;
  }

  const match = normalizeText(value).match(/(\d+)\s*(?:day\(s\)|days?)/i);
  return match ? `${match[1]} Day(s)` : null;
}

function extractCanonicalNotes(...values: Array<string | null>) {
  const combined = values.map((value) => normalizeForComparison(value)).join(' ');
  const noteParts = [
    combined.includes('as needed') ? 'as needed' : null,
    /\bprn\b/i.test(combined) ? 'prn' : null,
    /(taper|reduce|decrease|increase)/i.test(combined) ? 'taper' : null,
  ].filter(Boolean);

  return noteParts.length > 0 ? Array.from(new Set(noteParts)).join(', ') : null;
}

function cleanMedicationDisplayName(primaryName: string | null, fullRowText: string) {
  const candidates = [primaryName, fullRowText];

  for (const candidate of candidates) {
    const directMatch = normalizeText(candidate).match(
      /^([A-Z][A-Z0-9-]{2,}(?:\s+[A-Z0-9-]{2,}){0,2})\b/
    );

    if (directMatch) {
      return normalizeText(directMatch[1]);
    }
  }

  return primaryName ? normalizeText(primaryName) : null;
}

function extractBracketedStrengthValues(value: string) {
  return Array.from(value.matchAll(/\[([^\]]+)\]/g)).flatMap((match) =>
    Array.from(
      match[1].matchAll(
        /\d+(?:\.\d+)?(?:\s+\d+)?\s?(?:mg\/ml|mcg\/ml|g\/ml|mg|mcg|g|mL|ml)\b/gi
      )
    ).map((nestedMatch) => normalizeText(nestedMatch[0]))
  );
}

function cleanStrengthValue(primaryStrength: string | null, fullRowText: string) {
  const bracketedValues = [
    ...extractBracketedStrengthValues(normalizeText(primaryStrength)),
    ...extractBracketedStrengthValues(fullRowText),
  ];

  if (bracketedValues.length > 0) {
    return Array.from(new Set(bracketedValues)).join(', ');
  }

  const fallbackMatches = Array.from(
    fullRowText.matchAll(
      /\d+(?:\.\d+)?(?:\s+\d+)?\s?(?:mg\/ml|mcg\/ml|g\/ml|mg|mcg|g|mL|ml)\b/gi
    )
  ).map((match) => normalizeText(match[0]));

  if (fallbackMatches.length > 0) {
    return Array.from(new Set(fallbackMatches)).join(', ');
  }

  return primaryStrength ? normalizeText(primaryStrength) : null;
}

function stripLeakageText(value: string | null) {
  return normalizeText(value)
    .replace(/\b(?:take)\b/gi, '')
    .replace(/\b\d+\s*(?:day\(s\)|days?)\b/gi, '')
    .replace(/\b(?:for)\b/gi, '')
    .replace(/\b(?:once daily|twice daily|three times daily|daily)\b/gi, '')
    .replace(/\b\d+\s+(?:per\s+day|times?\s+per\s+day|time\/daily)\b/gi, '')
    .replace(/\bprn\b/gi, '')
    .replace(/\bas needed\b/gi, '')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCanonicalDosage(...values: Array<string | null>) {
  const dosagePatterns = [
    /\b(?:take\s*)?(\d+(?:\.\d+)?\s?(?:tab|tabs|tablet|tablets|capsule|capsules|puff|puffs|mL|ml))\b/i,
    /\b(\d+(?:\.\d+)?\s?(?:tab|tabs|tablet|tablets|capsule|capsules|puff|puffs|mL|ml))\b/i,
  ];

  for (const value of values) {
    const normalized = normalizeText(value);

    for (const pattern of dosagePatterns) {
      const match = normalized.match(pattern);

      if (match) {
        return normalizeText(match[1]).replace(/\bml\b/i, 'mL');
      }
    }
  }

  return null;
}

function normalizeCanonicalFrequency(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizeForComparison(value);

  if (
    normalized.includes('three times daily') ||
    normalized.includes('3 times daily') ||
    normalized.includes('3 per day') ||
    normalized.includes('3 time/daily')
  ) {
    return 'three times daily';
  }

  if (
    normalized.includes('twice daily') ||
    normalized.includes('2 times daily') ||
    normalized.includes('2 per day') ||
    normalized.includes('2 time/daily')
  ) {
    return 'twice daily';
  }

  if (
    normalized.includes('once daily') ||
    normalized.includes('1 time per day') ||
    normalized.includes('1 per day') ||
    normalized.includes('1 time/daily') ||
    normalized === 'daily'
  ) {
    return 'once daily';
  }

  return normalizeFrequencyText(value);
}

function extractCanonicalFrequency(...values: Array<string | null>) {
  for (const value of values) {
    const normalized = normalizeText(value);
    const match = normalized.match(
      /\b(once daily|twice daily|three times daily|daily|\d+\s+(?:per\s+day|times?\s+per\s+day|time\/daily))\b/i
    );

    if (match) {
      return normalizeCanonicalFrequency(match[1]);
    }
  }

  return null;
}

function extractCanonicalDuration(...values: Array<string | null>) {
  for (const value of values) {
    const normalized = normalizeText(value);
    const match = normalized.match(/\b(?:for\s*)?(\d+\s*(?:day\(s\)|days?))\b/i);

    if (match) {
      return normalizeDurationText(match[1]);
    }
  }

  return null;
}

function suggestTimingInstructions(params: {
  frequencyText: string | null;
  timingText: string | null;
  notesText: string | null;
}) {
  if (params.timingText) {
    return params.timingText;
  }

  const notes = normalizeForComparison(params.notesText);
  const frequency = normalizeForComparison(params.frequencyText);

  if (notes.includes('as needed') || notes.includes('prn')) {
    return null;
  }

  if (/taper|reduce|decrease|increase/.test(frequency)) {
    return null;
  }

  if (frequency.includes('after meals')) {
    return 'after meals';
  }

  if (frequency.includes('before bedtime') || frequency.includes('bedtime')) {
    return 'before bedtime';
  }

  if (
    frequency.includes('three times daily') ||
    frequency.includes('3 times daily') ||
    frequency.includes('3 per day') ||
    frequency.includes('3 time/daily')
  ) {
    return 'morning, afternoon, and evening';
  }

  if (
    frequency.includes('twice daily') ||
    frequency.includes('2 times daily') ||
    frequency.includes('2 per day') ||
    frequency.includes('2 time/daily')
  ) {
    return 'morning and evening';
  }

  if (
    frequency.includes('once daily') ||
    frequency.includes('1 time per day') ||
    frequency.includes('1 per day') ||
    frequency.includes('1 time/daily') ||
    frequency === 'daily'
  ) {
    return 'morning';
  }

  return null;
}

function applyMedicationSuggestions(parsedMedication: ParsedMedication, documentDate: string | null): ParsedMedication {
  const suggestedStartDate = parsedMedication.startDateText ?? parsedMedication.normalizedFields.startDate ?? documentDate;
  const suggestedTiming =
    parsedMedication.timingText ??
    parsedMedication.normalizedFields.timingInstructions ??
    suggestTimingInstructions({
      frequencyText: parsedMedication.frequencyText ?? parsedMedication.normalizedFields.frequency,
      timingText: parsedMedication.timingText ?? parsedMedication.normalizedFields.timingInstructions,
      notesText: parsedMedication.notesText ?? parsedMedication.normalizedFields.notes,
    });

  const startDateSource = parsedMedication.startDateText
    ? ('ocr' as const)
    : suggestedStartDate
      ? ('suggested' as const)
      : null;
  const timingSource = parsedMedication.timingText
    ? ('ocr' as const)
    : suggestedTiming
      ? ('suggested' as const)
      : null;

  return {
    ...parsedMedication,
    normalizedFields: {
      ...parsedMedication.normalizedFields,
      startDate: suggestedStartDate,
      timingInstructions: suggestedTiming,
    },
    fieldSources: {
      startDateSource,
      timingSource,
    },
    confidenceFlags: Array.from(
      new Set(
        parsedMedication.confidenceFlags.filter(
          (flag) =>
            !(flag === 'missing_start_date' && suggestedStartDate) &&
            !(flag === 'ambiguous_timing' && suggestedTiming)
        )
      )
    ),
  };
}

function detectMedicationTableBlocks(rawText: string, ocrBlocks: Array<Record<string, unknown>>) {
  const normalizedBlocks = sortBlocksByGeometry(normalizeOcrBlocks(rawText, ocrBlocks));
  const headerBlocks = normalizedBlocks.filter((block) => isMedicationSectionHeader(block.content));
  const headerBottom =
    headerBlocks.length > 0
      ? Math.max(...headerBlocks.map((block) => block.bounds?.yMax ?? 0))
      : 0;
  const footerTop =
    normalizedBlocks.find((block) => isMedicationSectionFooter(block.content))?.bounds?.yMin ?? Number.POSITIVE_INFINITY;

  return normalizedBlocks.filter((block) => {
    if (isMedicationSectionHeader(block.content) || isAdministrativeLine(block.content)) {
      return false;
    }

    if (!block.bounds) {
      return true;
    }

    return block.bounds.yMin >= headerBottom && block.bounds.yMin < footerTop;
  });
}

function getMedicationRowStarts(blocks: NormalizedOcrBlock[]) {
  return blocks
    .filter(
      (block) =>
        block.bounds &&
        block.bounds.xMin < 190 &&
        Boolean(extractLeadingMedicationName(block.content))
    )
    .sort((left, right) => (left.bounds?.yMin ?? 0) - (right.bounds?.yMin ?? 0));
}

function createEmptyMedicationRow(): MedicationRow {
  return {
    medicationName: [],
    scientificName: [],
    strength: [],
    dosage: [],
    frequency: [],
    route: [],
    duration: [],
    instruction: [],
  };
}

function addBlockToRow(row: MedicationRow, block: NormalizedOcrBlock) {
  const xCenter = block.bounds?.xCenter ?? Number.POSITIVE_INFINITY;
  const xMin = block.bounds?.xMin ?? Number.POSITIVE_INFINITY;

  if (xMin < 190) {
    const leadingMedication = extractLeadingMedicationName(block.content);

    if (leadingMedication) {
      row.medicationName.push(leadingMedication.medicationName);

      if (leadingMedication.remainder) {
        row.scientificName.push(leadingMedication.remainder);
      }

      return;
    }

    row.medicationName.push(block.content);
    return;
  }

  if (xCenter < 430) {
    row.scientificName.push(block.content);
    return;
  }

  if (xCenter < 630) {
    row.strength.push(block.content);
    return;
  }

  if (xCenter < 700) {
    row.dosage.push(block.content);
    return;
  }

  if (xCenter < 820) {
    row.frequency.push(block.content);
    return;
  }

  if (xCenter < 890) {
    row.route.push(block.content);
    return;
  }

  if (xCenter < 990) {
    row.duration.push(block.content);
    return;
  }

  row.instruction.push(block.content);
}

function buildMedicationRows(rawText: string, ocrBlocks: Array<Record<string, unknown>>) {
  const tableBlocks = detectMedicationTableBlocks(rawText, ocrBlocks);
  const rowStarts = getMedicationRowStarts(tableBlocks);

  if (rowStarts.length === 0) {
    return [];
  }

  return rowStarts.map((rowStart, index) => {
    const nextRowStart = rowStarts[index + 1];
    const rowTop = rowStart.bounds?.yMin ?? Number.NEGATIVE_INFINITY;
    const rowBottom = nextRowStart?.bounds?.yMin ?? Number.POSITIVE_INFINITY;
    const rowBlocks = sortBlocksByGeometry(
      tableBlocks.filter((block) => {
        if (!block.bounds) {
          return false;
        }

        return block.bounds.yCenter >= rowTop && block.bounds.yCenter < rowBottom;
      })
    );
    const row = createEmptyMedicationRow();

    for (const block of rowBlocks) {
      addBlockToRow(row, block);
    }

    return row;
  });
}

function buildParsedMedicationFromRow(row: MedicationRow, positionIndex: number): ParsedMedication | null {
  const rawMedicationName = joinOrderedValues(row.medicationName) || null;
  const scientificName = joinOrderedValues(row.scientificName) || null;
  const rawStrengthText = joinOrderedValues(row.strength) || null;
  const rawDosageText = joinOrderedValues(row.dosage) || null;
  const rawFrequencyText = joinOrderedValues(row.frequency) || null;
  const routeText = joinOrderedValues(row.route) || null;
  const rawDurationText = joinOrderedValues(row.duration) || null;
  const instructionText = joinOrderedValues(row.instruction) || null;

  if (!rawMedicationName && !scientificName && !rawStrengthText && !rawDosageText && !rawFrequencyText && !instructionText) {
    return null;
  }

  const rawMedicationText = [
    rawMedicationName,
    scientificName,
    rawStrengthText,
    rawDosageText,
    rawFrequencyText,
    routeText,
    rawDurationText,
    instructionText,
  ]
    .filter(Boolean)
    .join('\n');

  const medicationName = cleanMedicationDisplayName(rawMedicationName, rawMedicationText);
  const strengthText = cleanStrengthValue(rawStrengthText, rawMedicationText);
  const dosageText =
    extractCanonicalDosage(instructionText, rawDosageText, rawStrengthText, rawMedicationText) ??
    (rawDosageText ? stripLeakageText(rawDosageText) || null : null);
  const frequencyText = extractCanonicalFrequency(
    rawFrequencyText,
    instructionText,
    rawDosageText,
    rawDurationText,
    rawMedicationText
  );
  const durationText = extractCanonicalDuration(rawDurationText, instructionText, rawMedicationText);
  const timingText =
    instructionText?.match(/\b(after meals?|before bedtime|morning|afternoon|evening)\b/i)?.[0] ??
    null;
  const startDateText = rawMedicationText.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] ?? null;
  const notesText = extractCanonicalNotes(instructionText, rawDurationText, rawMedicationText);
  const noteParts = notesText ? notesText.split(', ').filter(Boolean) : [];
  const hasFrequency = Boolean(frequencyText || timingText);
  const parsingIssues = createParsingIssueList(
    medicationName ? null : 'unrecognized_medication',
    strengthText ? null : 'unrecognized_strength',
    dosageText ? null : 'unrecognized_dosage',
    hasFrequency ? null : 'unrecognized_frequency',
    durationText ? null : 'unrecognized_duration',
    noteParts.includes('taper') ? 'unsupported_instruction_pattern' : null
  );
  const confidenceFlags = createConfidenceFlagList(
    medicationName ? null : 'ambiguous_medication',
    strengthText ? null : 'ambiguous_strength',
    dosageText ? null : 'ambiguous_dosage',
    hasFrequency ? null : 'ambiguous_frequency',
    durationText ? null : 'missing_duration',
    startDateText ? null : 'missing_start_date',
    noteParts.length > 0 ? 'manual_review_required' : null,
    parsingIssues.length > 0 ? 'manual_review_required' : null
  );
  const isScheduleGeneratable =
    Boolean(medicationName) &&
    hasFrequency &&
    !noteParts.includes('as needed') &&
    !noteParts.includes('prn') &&
    !noteParts.includes('taper');

  return {
    positionIndex,
    rawMedicationText,
    medicationName,
    strengthText,
    dosageText,
    frequencyText,
    timingText: timingText ? normalizeText(timingText) : null,
    durationText,
    startDateText,
    notesText,
    normalizedFields: {
      medicationName,
      strength: strengthText,
      dosage: dosageText,
      frequency: frequencyText ?? (timingText === 'before bedtime' ? 'once daily' : null),
      timingInstructions: timingText ? normalizeText(timingText) : null,
      duration: durationText,
      startDate: startDateText,
      notes: notesText,
    },
    fieldSources: {
      startDateSource: startDateText ? 'ocr' : null,
      timingSource: timingText ? 'ocr' : null,
    },
    confidenceFlags,
    parsingIssues,
    reviewStatus: 'pending',
    isScheduleGeneratable,
  };
}

function detectMedicationCandidates(rawText: string, ocrBlocks: Array<Record<string, unknown>>) {
  const geometryRows = buildMedicationRows(rawText, ocrBlocks);

  if (geometryRows.length > 0) {
    return geometryRows;
  }

  const lineCandidates = getOcrLines(rawText, ocrBlocks);
  const filtered = lineCandidates.filter((candidate) =>
    /(take|tablet|capsule|mg|mcg|ml|daily|hours|bedtime|meal|tabs|puffs|day\(s\))/i.test(candidate)
  );

  return filtered.map((line) => ({
    ...createEmptyMedicationRow(),
    instruction: [line],
  }));
}

function parsePrescriptionText(rawText: string, ocrBlocks: Array<Record<string, unknown>>) {
  return detectMedicationCandidates(rawText, ocrBlocks)
    .map((candidateRow, index) => buildParsedMedicationFromRow(candidateRow, index))
    .filter((medication): medication is ParsedMedication => medication !== null);
}

function base64UrlEncode(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function bytesToBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem: string) {
  const sanitized = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  const decoded = atob(sanitized);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes.buffer;
}

function getGoogleServiceAccountJson() {
  const encoded = getEnv('GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_BASE64');

  if (!encoded) {
    return '';
  }

  return atob(encoded);
}

async function createGoogleAccessToken() {
  const projectId = requireEnv('GOOGLE_DOCUMENT_AI_PROJECT_ID');
  const serviceAccountJson = getGoogleServiceAccountJson();

  if (!serviceAccountJson) {
    throw new Error('Missing required environment variable: GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_BASE64');
  }

  const credentials = JSON.parse(serviceAccountJson) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
    token_uri?: string;
  };

  if (!credentials.client_email || !credentials.private_key || !credentials.token_uri) {
    throw new Error('Google service account JSON is missing required fields.');
  }

  if (credentials.project_id && credentials.project_id !== projectId) {
    throw new Error('Google service account project_id does not match GOOGLE_DOCUMENT_AI_PROJECT_ID.');
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const assertionHeader = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const assertionPayload = base64UrlEncode(
    JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: credentials.token_uri,
      iat,
      exp,
    })
  );
  const unsignedAssertion = `${assertionHeader}.${assertionPayload}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(credentials.private_key),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedAssertion)
  );
  const assertion = `${unsignedAssertion}.${bytesToBase64Url(new Uint8Array(signature))}`;

  const tokenResponse = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Google OAuth token request failed: ${errorText}`);
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
  };

  if (!tokenPayload.access_token) {
    throw new Error('Google OAuth token response did not include an access token.');
  }

  return tokenPayload.access_token;
}

function getTextFromAnchor(
  text: string,
  textAnchor: { textSegments?: Array<{ startIndex?: string; endIndex?: string }> } | undefined
) {
  if (!textAnchor?.textSegments || textAnchor.textSegments.length === 0) {
    return '';
  }

  return textAnchor.textSegments
    .map((segment) => {
      const start = segment.startIndex ? Number(segment.startIndex) : 0;
      const end = segment.endIndex ? Number(segment.endIndex) : 0;
      return text.slice(start, end);
    })
    .join('');
}

function normalizePreservedText(value: string | null | undefined) {
  return value
    ?.replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim() ?? '';
}

async function analyzeWithGoogle(imageBytes: Uint8Array, mimeType: string): Promise<ProviderResult> {
  const projectId = requireEnv('GOOGLE_DOCUMENT_AI_PROJECT_ID');
  const location = requireEnv('GOOGLE_DOCUMENT_AI_LOCATION');
  const processorId = requireEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID');
  const accessToken = await createGoogleAccessToken();
  const processUrl =
    `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;

  const processResponse = await fetch(processUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skipHumanReview: true,
      rawDocument: {
        mimeType: mimeType || 'application/octet-stream',
        content: bytesToBase64(imageBytes),
      },
      fieldMask: 'text,pages.lines,pages.tokens,pages.visualElements',
    }),
  });

  if (!processResponse.ok) {
    const errorText = await processResponse.text();
    throw new Error(`Google Document AI request failed: ${errorText}`);
  }

  const result = (await processResponse.json()) as {
    document?: {
      text?: string;
      textStyles?: Array<Record<string, unknown>>;
      pages?: Array<{
        lines?: Array<{
          layout?: {
            textAnchor?: {
              textSegments?: Array<{ startIndex?: string; endIndex?: string }>;
            };
            boundingPoly?: Record<string, unknown>;
          };
        }>;
      }>;
    };
  };
  const document = result.document ?? {};
  const originalDocumentText = document.text ?? '';
  const rawOcrText = normalizePreservedText(originalDocumentText);

  return {
    provider: 'google-document-ai',
    providerModel: 'ocr-processor',
    source: 'live',
    rawOcrText,
    overallConfidence: null,
    handwritingDetected: false,
    providerResponse: result as Record<string, unknown>,
    ocrBlocks:
      document.pages?.flatMap((page) =>
        (page.lines ?? [])
          .map((line, index) => {
            const content = normalizeText(
              getTextFromAnchor(originalDocumentText, line.layout?.textAnchor)
            );

            if (!content) {
              return null;
            }

            return {
              id: index,
              content,
              polygon: line.layout?.boundingPoly ?? null,
            };
          })
          .filter(Boolean) as Array<Record<string, unknown>>
      ) ?? [],
  };
}

async function pollAzureOperation(operationLocation: string, apiKey: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(operationLocation, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Azure polling failed with status ${response.status}.`);
    }

    const result = await response.json();

    if (result.status === 'succeeded') {
      return result;
    }

    if (result.status === 'failed') {
      throw new Error('Azure OCR analysis failed.');
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error('Azure OCR analysis timed out.');
}

async function analyzeWithAzure(imageBytes: Uint8Array, mimeType: string): Promise<ProviderResult> {
  const endpoint = requireEnv('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT').replace(/\/$/, '');
  const apiKey = requireEnv('AZURE_DOCUMENT_INTELLIGENCE_KEY');
  const analyzeUrl =
    `${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30`;

  const analyzeResponse = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
      'Ocp-Apim-Subscription-Key': apiKey,
    },
    body: imageBytes,
  });

  if (!analyzeResponse.ok) {
    const errorText = await analyzeResponse.text();
    throw new Error(`Azure OCR request failed: ${errorText}`);
  }

  const operationLocation = analyzeResponse.headers.get('operation-location');

  if (!operationLocation) {
    throw new Error('Azure OCR response did not include an operation-location header.');
  }

  const result = await pollAzureOperation(operationLocation, apiKey);
  const analyzeResult = result.analyzeResult ?? {};
  const rawOcrText = normalizePreservedText(analyzeResult.content ?? '');
  const handwritingDetected = Boolean(
    Array.isArray(analyzeResult.styles) &&
      analyzeResult.styles.some((style: Record<string, unknown>) => style.isHandwritten === true)
  );

  return {
    provider: 'azure-document-intelligence',
    providerModel: 'prebuilt-read',
    source: 'live',
    rawOcrText,
    overallConfidence: null,
    handwritingDetected,
    providerResponse: result,
    ocrBlocks:
      analyzeResult.pages?.flatMap((page: Record<string, unknown>) =>
        (page.lines as Array<Record<string, unknown>> | undefined)?.map((line) => ({
          content: line.content,
          polygon: line.polygon ?? null,
        })) ?? []
      ) ?? [],
  };
}

function buildMockProviderResult(): ProviderResult {
  const rawOcrText =
    'Amoxicillin 500 mg - take 1 capsule twice daily after meals for 5 days.\nParacetamol 500 mg - take 1 tablet before bedtime as needed.';

  return {
    provider: 'mock-seeded',
    providerModel: 'fixture-v1',
    source: 'mock',
    rawOcrText,
    overallConfidence: 0.84,
    handwritingDetected: false,
    providerResponse: {
      seeded: true,
    },
    ocrBlocks: rawOcrText.split('\n').map((content, index) => ({
      id: index,
      content,
    })),
  };
}

async function resolveProviderResult(params: {
  imageBytes?: Uint8Array;
  mimeType?: string;
  useMockData: boolean;
}) {
  const googleConfigured =
    Boolean(getEnv('GOOGLE_DOCUMENT_AI_PROJECT_ID')) &&
    Boolean(getEnv('GOOGLE_DOCUMENT_AI_LOCATION')) &&
    Boolean(getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID')) &&
    Boolean(getEnv('GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_BASE64'));
  const azureConfigured =
    Boolean(getEnv('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')) &&
    Boolean(getEnv('AZURE_DOCUMENT_INTELLIGENCE_KEY'));

  if (!params.useMockData && params.imageBytes && googleConfigured) {
    return analyzeWithGoogle(params.imageBytes, params.mimeType ?? 'application/octet-stream');
  }

  if (!params.useMockData && params.imageBytes && azureConfigured) {
    return analyzeWithAzure(params.imageBytes, params.mimeType ?? 'application/octet-stream');
  }

  return buildMockProviderResult();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const admin = createAdminClient();
  let payload: AnalyzeRequest | null = null;

  try {
    payload = (await request.json()) as AnalyzeRequest;
    const accessToken = extractBearerToken(request);

    if (!accessToken) {
      return jsonResponse({ error: 'Authorization is required.' }, 401);
    }

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonResponse({ error: 'Unable to resolve the current user.' }, 401);
    }

    if (!payload.prescriptionId) {
      return jsonResponse({ error: 'prescriptionId is required.' }, 400);
    }

    const storageBucket = payload.storageBucket || 'prescription-images';
    const useMockData = Boolean(payload.useMockData || !payload.imagePath);
    const startedAt = new Date().toISOString();
    const googleConfigured =
      Boolean(getEnv('GOOGLE_DOCUMENT_AI_PROJECT_ID')) &&
      Boolean(getEnv('GOOGLE_DOCUMENT_AI_LOCATION')) &&
      Boolean(getEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID')) &&
      Boolean(getEnv('GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_BASE64'));
    const preferredProvider = useMockData
      ? 'mock-seeded'
      : googleConfigured
        ? 'google-document-ai'
        : 'azure-document-intelligence';
    const preferredProviderModel = useMockData
      ? 'fixture-v1'
      : googleConfigured
        ? 'ocr-processor'
        : 'prebuilt-read';

    const { data: prescription, error: prescriptionError } = await admin
      .from('prescriptions')
      .select('id')
      .eq('id', payload.prescriptionId)
      .eq('user_id', user.id)
      .single();

    if (prescriptionError || !prescription) {
      return jsonResponse({ error: 'Prescription not found.' }, 404);
    }

    const { data: extractionRun, error: extractionRunError } = await admin
      .from('extraction_runs')
      .insert({
        prescription_id: payload.prescriptionId,
        provider: preferredProvider,
        provider_model: preferredProviderModel,
        parser_version: parserVersion,
        status: 'processing',
        started_at: startedAt,
      })
      .select('id')
      .single();

    if (extractionRunError || !extractionRun) {
      throw extractionRunError ?? new Error('Failed to create extraction run.');
    }

    const extractionRunId = extractionRun.id as string;

    await admin
      .from('prescriptions')
      .update({
        status: prescriptionStatusValues.processing,
        active_extraction_run_id: extractionRunId,
        review_required: true,
      })
      .eq('id', payload.prescriptionId);

    let imageBytes: Uint8Array | undefined;

    if (!useMockData && payload.imagePath) {
      const { data: imageFile, error: imageError } = await admin.storage
        .from(storageBucket)
        .download(payload.imagePath);

      if (imageError || !imageFile) {
        throw imageError ?? new Error('Unable to download prescription image from storage.');
      }

      imageBytes = new Uint8Array(await imageFile.arrayBuffer());
    }

    const providerResult = await resolveProviderResult({
      imageBytes,
      mimeType: payload.mimeType,
      useMockData,
    });

    const documentDate = extractDocumentDate(providerResult.rawOcrText, providerResult.ocrBlocks);
    const parsedMedications = parsePrescriptionText(providerResult.rawOcrText, providerResult.ocrBlocks).map(
      (medication) => applyMedicationSuggestions(medication, documentDate)
    );
    const aggregateIssues = Array.from(
      new Set(parsedMedications.flatMap((medication) => medication.parsingIssues))
    );
    const completedAt = new Date().toISOString();

    const { error: medicationInsertError } = await admin.from('extracted_medications').insert(
      parsedMedications.map((medication) => ({
        prescription_id: payload.prescriptionId,
        extraction_run_id: extractionRunId,
        position_index: medication.positionIndex,
        raw_medication_text: medication.rawMedicationText,
        medication_name: medication.medicationName,
        strength_text: medication.strengthText,
        dosage_text: medication.dosageText,
        frequency_text: medication.frequencyText,
        timing_text: medication.timingText,
        duration_text: medication.durationText,
        start_date_text: medication.startDateText,
        notes_text: medication.notesText,
        normalized_fields: medication.normalizedFields,
        confidence_flags: medication.confidenceFlags,
        parsing_issues: medication.parsingIssues,
        review_status: medication.reviewStatus,
        is_schedule_generatable: medication.isScheduleGeneratable,
      }))
    );

    if (medicationInsertError) {
      throw medicationInsertError;
    }

    const { error: extractionUpdateError } = await admin
      .from('extraction_runs')
      .update({
        provider: providerResult.provider,
        provider_model: providerResult.providerModel,
        status: 'completed',
        raw_ocr_text: providerResult.rawOcrText,
        overall_confidence: providerResult.overallConfidence,
        issues: aggregateIssues,
        provider_response: {
          ...providerResult.providerResponse,
          documentDate,
        },
        ocr_blocks: providerResult.ocrBlocks,
        completed_at: completedAt,
      })
      .eq('id', extractionRunId);

    if (extractionUpdateError) {
      throw extractionUpdateError;
    }

    const { error: prescriptionUpdateError } = await admin
      .from('prescriptions')
      .update({
        status: prescriptionStatusValues.needsReview,
        raw_ocr_text: providerResult.rawOcrText,
        handwriting_detected: providerResult.handwritingDetected,
        review_required: true,
        active_extraction_run_id: extractionRunId,
      })
      .eq('id', payload.prescriptionId);

    if (prescriptionUpdateError) {
      throw prescriptionUpdateError;
    }

    return jsonResponse({
      extractionRunId,
      status: 'completed',
      provider: providerResult.provider,
      source: providerResult.source,
      rawOcrText: providerResult.rawOcrText,
      documentDate,
      medications: parsedMedications.map((medication) => ({
        id: crypto.randomUUID(),
        prescriptionId: payload.prescriptionId,
        extractionRunId,
        positionIndex: medication.positionIndex,
        rawMedicationText: medication.rawMedicationText,
        strengthText: medication.strengthText,
        dosageText: medication.dosageText,
        frequencyText: medication.frequencyText,
        timingText: medication.timingText,
        durationText: medication.durationText,
        startDateText: medication.startDateText,
        notesText: medication.notesText,
        normalizedFields: medication.normalizedFields,
        fieldSources: medication.fieldSources,
        confidenceFlags: medication.confidenceFlags,
        parsingIssues: medication.parsingIssues,
        reviewStatus: medication.reviewStatus,
        isScheduleGeneratable: medication.isScheduleGeneratable,
        createdAt: completedAt,
      })),
      issues: aggregateIssues,
      requiresReview: true,
    });
  } catch (error) {
    if (payload?.prescriptionId) {
      try {
        const { data: latestRun } = await admin
          .from('extraction_runs')
          .select('id')
          .eq('prescription_id', payload.prescriptionId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestRun?.id) {
          await admin
            .from('extraction_runs')
            .update({
              status: 'failed',
              failure_code: 'analysis_failed',
              failure_message: error instanceof Error ? error.message : 'Unknown analysis error.',
              completed_at: new Date().toISOString(),
            })
            .eq('id', latestRun.id);
        }

        await admin
          .from('prescriptions')
          .update({
            status: prescriptionStatusValues.ocrFailed,
            review_required: true,
          })
          .eq('id', payload.prescriptionId);
      } catch {
        // Keep the original function error as the primary failure signal.
      }
    }

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Prescription analysis failed.',
      },
      500
    );
  }
});
