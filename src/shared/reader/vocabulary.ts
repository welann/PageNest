import type {
  ReaderDictionaryEntry,
  ReaderLearnedLemma
} from "@shared/types/reader";

export interface DictionaryLookupValue {
  definition: string;
  partOfSpeech: string | null;
  note: string | null;
  phonetic: string | null;
  exchange: string | null;
}

export interface VocabularyLookup {
  dictionary: ReadonlyMap<string, DictionaryLookupValue>;
  learnedLemmas: ReadonlySet<string>;
  variantLemmas: ReadonlyMap<string, string>;
}

export interface WordToken {
  surface: string;
  start: number;
  end: number;
}

export interface WordDecision {
  surface: string;
  normalizedSurface: string;
  lemma: string;
  definition: string | null;
  partOfSpeech: string | null;
  note: string | null;
  phonetic: string | null;
  ignored: boolean;
  isLearned: boolean;
}

export interface UnknownWordAggregate {
  lemma: string;
  surfaceForms: string[];
  definition: string | null;
  partOfSpeech: string | null;
  note: string | null;
  phonetic: string | null;
  occurrenceCount: number;
  sampleContext: string;
}

export const WORD_PATTERN = /[A-Za-z]+(?:'[A-Za-z]+)*/g;

const IRREGULAR_LEMMA_MAP = new Map<string, string>([
  ["am", "be"],
  ["are", "be"],
  ["been", "be"],
  ["did", "do"],
  ["does", "do"],
  ["done", "do"],
  ["feet", "foot"],
  ["geese", "goose"],
  ["gone", "go"],
  ["had", "have"],
  ["has", "have"],
  ["men", "man"],
  ["mice", "mouse"],
  ["ran", "run"],
  ["teeth", "tooth"],
  ["was", "be"],
  ["were", "be"],
  ["women", "woman"],
  ["worse", "bad"],
  ["worst", "bad"],
  ["better", "good"],
  ["best", "good"],
  ["children", "child"],
  ["went", "go"]
]);

export function normalizeLemma(value: string) {
  return value.trim().toLowerCase();
}

function shouldSkipSurface(surface: string) {
  const normalized = normalizeLemma(surface);

  return normalized.length === 1 && normalized !== "a" && normalized !== "i";
}

export function createVocabularyLookup(
  dictionaryEntries: ReaderDictionaryEntry[],
  learnedEntries: ReaderLearnedLemma[]
): VocabularyLookup {
  const dictionary = new Map<string, DictionaryLookupValue>();
  const variantLemmas = new Map<string, string>();

  function registerExchangeVariants(lemma: string, exchange: string | null | undefined) {
    if (!exchange) {
      variantLemmas.set(lemma, lemma);
      return;
    }

    let baseLemma = lemma;

    for (const segment of exchange.split("/")) {
      const [code, rawValue] = segment.split(":");
      const value = normalizeLemma(rawValue ?? "");

      if (code === "0" && value) {
        baseLemma = value;
      }
    }

    variantLemmas.set(lemma, baseLemma);

    for (const segment of exchange.split("/")) {
      const [, rawValue] = segment.split(":");
      const value = normalizeLemma(rawValue ?? "");

      if (!value) {
        continue;
      }

      variantLemmas.set(value, baseLemma);
    }
  }

  for (const entry of dictionaryEntries) {
    const lemma = normalizeLemma(entry.lemma);

    dictionary.set(lemma, {
      definition: entry.definition,
      partOfSpeech: entry.partOfSpeech,
      note: entry.note,
      phonetic: entry.phonetic ?? null,
      exchange: entry.exchange ?? null
    });
    registerExchangeVariants(lemma, entry.exchange ?? null);
  }

  const learnedLemmas = new Set(
    learnedEntries.map((entry) => normalizeLemma(entry.lemma))
  );

  return {
    dictionary,
    learnedLemmas,
    variantLemmas
  };
}

export function extractWordTokens(text: string) {
  const tokens: WordToken[] = [];

  for (const match of text.matchAll(WORD_PATTERN)) {
    if (typeof match.index !== "number") {
      continue;
    }

    tokens.push({
      surface: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return tokens;
}

function isLikelyProperNoun(surface: string) {
  if (surface === "I") {
    return false;
  }

  return /^[A-Z][a-z]+(?:'[A-Z]?[a-z]+)?$/.test(surface) || /^[A-Z]{2,}$/.test(surface);
}

function pushCandidate(target: string[], candidate: string | null | undefined) {
  if (!candidate) {
    return;
  }

  const normalized = normalizeLemma(candidate);

  if (!normalized || target.includes(normalized)) {
    return;
  }

  target.push(normalized);
}

function dedupeDoubleConsonant(value: string) {
  return /([b-df-hj-np-tv-z])\1$/.test(value) ? value.slice(0, -1) : value;
}

export function buildLemmaCandidates(surface: string) {
  const lower = normalizeLemma(surface);
  const candidates: string[] = [];
  pushCandidate(candidates, lower);

  if (lower.endsWith("'s") && lower.length > 3) {
    pushCandidate(candidates, lower.slice(0, -2));
  }

  if (lower.endsWith("'") && lower.length > 2) {
    pushCandidate(candidates, lower.slice(0, -1));
  }

  pushCandidate(candidates, IRREGULAR_LEMMA_MAP.get(lower));

  if (lower.endsWith("ies") && lower.length > 4) {
    pushCandidate(candidates, `${lower.slice(0, -3)}y`);
  }

  if (lower.endsWith("ied") && lower.length > 4) {
    pushCandidate(candidates, `${lower.slice(0, -3)}y`);
  }

  if (lower.endsWith("ing") && lower.length > 5) {
    const base = lower.slice(0, -3);
    pushCandidate(candidates, base);
    pushCandidate(candidates, `${base}e`);
    pushCandidate(candidates, dedupeDoubleConsonant(base));
  }

  if (lower.endsWith("ed") && lower.length > 4) {
    const base = lower.slice(0, -2);
    pushCandidate(candidates, base);
    pushCandidate(candidates, `${base}e`);
    pushCandidate(candidates, dedupeDoubleConsonant(base));
  }

  if (lower.endsWith("es") && lower.length > 4) {
    pushCandidate(candidates, lower.slice(0, -2));
  }

  if (lower.endsWith("s") && lower.length > 3) {
    pushCandidate(candidates, lower.slice(0, -1));
  }

  if (lower.endsWith("er") && lower.length > 4) {
    const base = lower.slice(0, -2);
    pushCandidate(candidates, base);
    pushCandidate(candidates, `${base}e`);
    pushCandidate(candidates, dedupeDoubleConsonant(base));
    if (base.endsWith("i")) {
      pushCandidate(candidates, `${base.slice(0, -1)}y`);
    }
  }

  if (lower.endsWith("est") && lower.length > 5) {
    const base = lower.slice(0, -3);
    pushCandidate(candidates, base);
    pushCandidate(candidates, `${base}e`);
    pushCandidate(candidates, dedupeDoubleConsonant(base));
    if (base.endsWith("i")) {
      pushCandidate(candidates, `${base.slice(0, -1)}y`);
    }
  }

  return candidates;
}

export function evaluateWord(surface: string, lookup: VocabularyLookup): WordDecision {
  const normalizedSurface = normalizeLemma(surface);
  const lemmaCandidates = buildLemmaCandidates(normalizedSurface);
  const explicitLemma = lookup.variantLemmas.get(normalizedSurface);

  if (explicitLemma && !lemmaCandidates.includes(explicitLemma)) {
    lemmaCandidates.push(explicitLemma);
  }

  for (const candidate of lemmaCandidates) {
    if (!lookup.learnedLemmas.has(candidate)) {
      continue;
    }

    const dictionaryEntry = lookup.dictionary.get(candidate);

    return {
      surface,
      normalizedSurface,
      lemma: candidate,
      definition: dictionaryEntry?.definition ?? null,
      partOfSpeech: dictionaryEntry?.partOfSpeech ?? null,
      note: dictionaryEntry?.note ?? null,
      phonetic: dictionaryEntry?.phonetic ?? null,
      ignored: false,
      isLearned: true
    };
  }

  for (const candidate of lemmaCandidates) {
    const dictionaryEntry = lookup.dictionary.get(candidate);

    if (!dictionaryEntry) {
      continue;
    }

    return {
      surface,
      normalizedSurface,
      lemma: candidate,
      definition: dictionaryEntry.definition,
      partOfSpeech: dictionaryEntry.partOfSpeech,
      note: dictionaryEntry.note,
      phonetic: dictionaryEntry.phonetic,
      ignored: false,
      isLearned: false
    };
  }

  if (isLikelyProperNoun(surface)) {
    return {
      surface,
      normalizedSurface,
      lemma: normalizedSurface,
      definition: null,
      partOfSpeech: null,
      note: null,
      phonetic: null,
      ignored: true,
      isLearned: false
    };
  }

  return {
    surface,
    normalizedSurface,
    lemma: normalizedSurface,
    definition: lookup.dictionary.get(normalizedSurface)?.definition ?? null,
    partOfSpeech: lookup.dictionary.get(normalizedSurface)?.partOfSpeech ?? null,
    note: lookup.dictionary.get(normalizedSurface)?.note ?? null,
    phonetic: lookup.dictionary.get(normalizedSurface)?.phonetic ?? null,
    ignored: false,
    isLearned: false
  };
}

function buildSampleContext(text: string, start: number, end: number) {
  const contextStart = Math.max(0, start - 48);
  const contextEnd = Math.min(text.length, end + 48);
  return text.slice(contextStart, contextEnd).replace(/\s+/g, " ").trim();
}

export function collectUnknownWords(text: string, lookup: VocabularyLookup) {
  const aggregated = new Map<string, UnknownWordAggregate>();
  const tokens = extractWordTokens(text);

  for (const token of tokens) {
    if (shouldSkipSurface(token.surface)) {
      continue;
    }

    const decision = evaluateWord(token.surface, lookup);

    if (decision.ignored || decision.isLearned) {
      continue;
    }

    const existing = aggregated.get(decision.lemma);

    if (existing) {
      existing.occurrenceCount += 1;
      if (!existing.surfaceForms.includes(token.surface)) {
        existing.surfaceForms.push(token.surface);
      }
      continue;
    }

    aggregated.set(decision.lemma, {
      lemma: decision.lemma,
      surfaceForms: [token.surface],
      definition: decision.definition,
      partOfSpeech: decision.partOfSpeech,
      note: decision.note,
      phonetic: decision.phonetic,
      occurrenceCount: 1,
      sampleContext: buildSampleContext(text, token.start, token.end)
    });
  }

  return Array.from(aggregated.values()).sort((left, right) => {
    if (right.occurrenceCount !== left.occurrenceCount) {
      return right.occurrenceCount - left.occurrenceCount;
    }

    return left.lemma.localeCompare(right.lemma);
  });
}
