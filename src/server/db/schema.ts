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
  format: text("format").notNull(),
  storageKey: text("storage_key").notNull(),
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

