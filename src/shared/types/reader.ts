export interface ReaderBookProgress {
  locator: string;
  progressPercent: number;
  updatedAt: string;
}

export interface ReaderBookSummary {
  id: number;
  title: string;
  author: string;
  language: string;
  format: string;
  storageKey: string;
  coverStorageKey: string | null;
  createdAt: string;
  lastExportedAt: string | null;
  lastClipboardExportedAt: string | null;
  progress: ReaderBookProgress | null;
}

export interface ReaderDictionaryEntry {
  lemma: string;
  definition: string;
  partOfSpeech: string | null;
  note: string | null;
  phonetic?: string | null;
  exchange?: string | null;
  source: string;
  updatedAt: string;
}

export interface ReaderLearnedLemma {
  lemma: string;
  source: string;
  learnedAt: string;
  updatedAt: string;
}

export interface ReaderUnknownLemma {
  itemId: number;
  lemma: string;
  surfaceForms: string[];
  definition: string | null;
  partOfSpeech: string | null;
  note: string | null;
  phonetic: string | null;
  sampleContext: string;
  firstLocator: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReaderExportSummary {
  id: number;
  itemId: number;
  status: "pending" | "complete";
  storageKey: string | null;
  createdAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
  fileName: string | null;
}

export interface ReaderBootstrap {
  books: ReaderBookSummary[];
  dictionary: ReaderDictionaryEntry[];
  learnedLemmas: ReaderLearnedLemma[];
  savedUnknownLemmas: ReaderUnknownLemma[];
  latestExports: ReaderExportSummary[];
  infrastructure: {
    d1: boolean;
    r2: boolean;
    mode: string;
  };
}

export interface ReaderImportResult {
  imported: number;
  source: string;
}

export interface ReaderDictionaryImportResult extends ReaderImportResult {
  entries: ReaderDictionaryEntry[];
}

export interface ReaderLearnedImportResult extends ReaderImportResult {
  learned: ReaderLearnedLemma[];
}

export interface ReaderBookImportResult {
  book: ReaderBookSummary;
}

export interface ReaderProgressUpdateResult {
  progress: ReaderBookProgress;
}

export interface ReaderLearnedUpdateResult {
  learned: ReaderLearnedLemma[];
}

export interface ReaderUnknownUpdateResult {
  unknown: ReaderUnknownLemma;
}

export interface ReaderExportTriggerResult {
  exportRecord: ReaderExportSummary;
}

export interface ReaderLatestExportResult {
  exportRecord: ReaderExportSummary | null;
}

export interface ReaderClipboardExportResult {
  cursorUpdatedAt: string;
  exportedCount: number;
  previousCursorAt: string | null;
  text: string;
}
