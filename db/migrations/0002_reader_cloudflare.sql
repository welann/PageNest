ALTER TABLE reader_library_items ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE reader_library_items ADD COLUMN cover_storage_key TEXT;
ALTER TABLE reader_library_items ADD COLUMN last_exported_at TEXT;

CREATE TABLE IF NOT EXISTS reader_dictionary_entries (
  lemma TEXT PRIMARY KEY NOT NULL,
  definition TEXT NOT NULL,
  part_of_speech TEXT,
  note TEXT,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reader_learned_lemmas (
  lemma TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL,
  learned_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reader_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  item_id INTEGER NOT NULL,
  storage_key TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
