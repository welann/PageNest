import type {
  ReaderBookImportResult,
  ReaderBootstrap,
  ReaderClipboardExportResult,
  ReaderDictionaryImportResult,
  ReaderExportTriggerResult,
  ReaderLatestExportResult,
  ReaderLearnedImportResult,
  ReaderLearnedUpdateResult,
  ReaderProgressUpdateResult,
  ReaderUnknownUpdateResult
} from "@shared/types/reader";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Reader request failed.";

    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function uploadForm<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(path, {
    body: formData,
    method: "POST"
  });

  return parseResponse<T>(response);
}

export async function getReaderBootstrap(signal?: AbortSignal) {
  const response = await fetch(`/api/reader/bootstrap?ts=${Date.now()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    },
    signal
  });

  return parseResponse<ReaderBootstrap>(response);
}

export function getReaderBookFileUrl(bookId: number) {
  return `/api/reader/books/${bookId}/file`;
}

export function importReaderBook(file: File) {
  return uploadForm<ReaderBookImportResult>("/api/reader/books/import", file);
}

export function importReaderDictionary(file: File) {
  return uploadForm<ReaderDictionaryImportResult>("/api/reader/dictionary/import", file);
}

export function importReaderLearnedWords(file: File) {
  return uploadForm<ReaderLearnedImportResult>("/api/reader/learned/import", file);
}

export async function markReaderLearnedLemmas(
  lemmas: string[],
  options?: {
    deleteUnknown?: boolean;
    itemId?: number;
  }
) {
  const response = await fetch("/api/reader/learned", {
    body: JSON.stringify({
      deleteUnknown: options?.deleteUnknown,
      itemId: options?.itemId,
      lemmas
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PUT"
  });

  return parseResponse<ReaderLearnedUpdateResult>(response);
}

export async function saveReaderUnknownLemma(payload: {
  itemId: number;
  lemma: string;
  surfaceForms: string[];
  definition: string | null;
  partOfSpeech: string | null;
  note: string | null;
  phonetic: string | null;
  sampleContext: string;
  firstLocator: string | null;
}) {
  const response = await fetch("/api/reader/unknown", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PUT"
  });

  return parseResponse<ReaderUnknownUpdateResult>(response);
}

export async function updateReaderProgress(payload: {
  itemId: number;
  locator: string;
  progressPercent: number;
}) {
  const response = await fetch("/api/reader/progress", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PUT"
  });

  return parseResponse<ReaderProgressUpdateResult>(response);
}

export async function triggerReaderUnknownWordsExport(bookId: number) {
  const response = await fetch(`/api/reader/books/${bookId}/export-unknown-words`, {
    method: "POST"
  });

  return parseResponse<ReaderExportTriggerResult>(response);
}

export async function getReaderLatestExport(bookId: number) {
  const response = await fetch(`/api/reader/books/${bookId}/exports/latest?ts=${Date.now()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  return parseResponse<ReaderLatestExportResult>(response);
}

export async function copyReaderIncrementalUnknownWords(bookId: number) {
  const response = await fetch(`/api/reader/books/${bookId}/copy-unknown-words`, {
    method: "POST"
  });

  return parseResponse<ReaderClipboardExportResult>(response);
}
