import type { ExtractorBootstrap, ExtractorDocumentSummary } from "@shared/types/extractor";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Extractor request failed.";

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

export async function getExtractorBootstrap(signal?: AbortSignal) {
  const response = await fetch(`/api/extractor/bootstrap?ts=${Date.now()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    },
    signal
  });

  return parseResponse<ExtractorBootstrap>(response);
}

export async function importExtractorDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/extractor/library/import", {
    body: formData,
    method: "POST"
  });

  return parseResponse<{ document: ExtractorDocumentSummary }>(response);
}
