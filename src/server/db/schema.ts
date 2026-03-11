import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const favorites = sqliteTable("favorites", {
  slug: text("slug").primaryKey(),
  createdAt: text("created_at").notNull()
});

export const moduleUsage = sqliteTable("module_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull(),
  summary: text("summary").notNull(),
  lastOpenedAt: text("last_opened_at").notNull()
});

export const readerLibraryItems = sqliteTable("reader_library_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  author: text("author").notNull(),
  language: text("language").notNull().default("en"),
  format: text("format").notNull(),
  storageKey: text("storage_key").notNull(),
  coverStorageKey: text("cover_storage_key"),
  lastExportedAt: text("last_exported_at"),
  createdAt: text("created_at").notNull()
});

export const readerProgress = sqliteTable("reader_progress", {
  itemId: integer("item_id").primaryKey(),
  locator: text("locator").notNull(),
  progressPercent: integer("progress_percent").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const readerNotes = sqliteTable("reader_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").notNull(),
  excerpt: text("excerpt").notNull(),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull()
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const readerDictionaryEntries = sqliteTable("reader_dictionary_entries", {
  lemma: text("lemma").primaryKey(),
  definition: text("definition").notNull(),
  partOfSpeech: text("part_of_speech"),
  note: text("note"),
  source: text("source").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const readerLearnedLemmas = sqliteTable("reader_learned_lemmas", {
  lemma: text("lemma").primaryKey(),
  source: text("source").notNull(),
  learnedAt: text("learned_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const readerUnknownLemmas = sqliteTable("reader_unknown_lemmas", {
  itemId: integer("item_id").notNull(),
  lemma: text("lemma").notNull(),
  surfaceFormsJson: text("surface_forms_json").notNull(),
  definition: text("definition"),
  partOfSpeech: text("part_of_speech"),
  note: text("note"),
  phonetic: text("phonetic"),
  sampleContext: text("sample_context").notNull(),
  firstLocator: text("first_locator"),
  source: text("source").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const readerExports = sqliteTable("reader_exports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").notNull(),
  storageKey: text("storage_key"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at")
});
