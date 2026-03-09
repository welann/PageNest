CREATE TABLE IF NOT EXISTS favorites (
  slug TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS module_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT NOT NULL,
  last_opened_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reader_library_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  format TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reader_progress (
  item_id INTEGER PRIMARY KEY NOT NULL,
  locator TEXT NOT NULL,
  progress_percent INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reader_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  item_id INTEGER NOT NULL,
  excerpt TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO module_usage (id, slug, summary, last_opened_at)
VALUES
  (1, 'ebook-reader', '继续阅读《Designing Data-Intensive Applications》', '2026-03-09T11:40:00.000Z'),
  (2, 'paper-desk', '整理一篇 PDF 的摘录和标签', '2026-03-09T10:20:00.000Z'),
  (3, 'subtitle-workbench', '检查一个字幕片段的断句', '2026-03-09T08:15:00.000Z');

INSERT OR IGNORE INTO favorites (slug, created_at)
VALUES
  ('ebook-reader', '2026-03-09T08:15:00.000Z'),
  ('paper-desk', '2026-03-09T09:15:00.000Z');

INSERT OR IGNORE INTO reader_library_items (id, title, author, format, storage_key, created_at)
VALUES
  (1, 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'epub', 'library/ddia.epub', '2026-03-09T08:10:00.000Z'),
  (2, 'The Nature of Code', 'Daniel Shiffman', 'pdf', 'library/nature-of-code.pdf', '2026-03-09T08:11:00.000Z');

INSERT OR IGNORE INTO reader_notes (id, item_id, excerpt, note, created_at)
VALUES
  (1, 1, 'Caching is simple until it is not.', '做一个关于缓存失效的模块笔记。', '2026-03-09T08:30:00.000Z'),
  (2, 2, 'Complex systems need good observability.', '和字幕工作台的日志面板可以共享设计。', '2026-03-09T08:50:00.000Z');
