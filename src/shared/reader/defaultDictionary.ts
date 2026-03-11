import type { ReaderDictionaryEntry } from "@shared/types/reader";

export async function loadDefaultDictionaryEntries() {
  const module = await import("@shared/reader/default-ecdict.json");
  return module.default as ReaderDictionaryEntry[];
}
