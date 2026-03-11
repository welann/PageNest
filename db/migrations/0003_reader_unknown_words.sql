CREATE TABLE IF NOT EXISTS reader_unknown_lemmas (
  item_id INTEGER NOT NULL,
  lemma TEXT NOT NULL,
  surface_forms_json TEXT NOT NULL,
  definition TEXT,
  part_of_speech TEXT,
  note TEXT,
  phonetic TEXT,
  sample_context TEXT NOT NULL,
  first_locator TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (item_id, lemma)
);

CREATE INDEX IF NOT EXISTS idx_reader_unknown_lemmas_item_updated
ON reader_unknown_lemmas (item_id, updated_at DESC);
