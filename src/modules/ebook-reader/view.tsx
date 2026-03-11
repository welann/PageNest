import { startTransition, useEffect, useMemo, useState } from "react";

import { Pill } from "@components/ui/Pill";
import { ReaderViewport } from "@modules/ebook-reader/ReaderViewport";
import styles from "@modules/ebook-reader/view.module.css";
import {
  createVocabularyLookup,
  evaluateWord,
  type UnknownWordAggregate
} from "@shared/reader/vocabulary";
import { loadDefaultDictionaryEntries } from "@shared/reader/defaultDictionary";
import type { ReaderBootstrap, ReaderExportSummary } from "@shared/types/reader";
import { formatRelativeTime } from "@shared/utils/format";
import {
  getReaderBootstrap,
  importReaderBook,
  importReaderDictionary,
  importReaderLearnedWords,
  markReaderLearnedLemmas,
  saveReaderUnknownLemma,
  triggerReaderUnknownWordsExport,
  updateReaderProgress
} from "@services/api/reader";

interface UploadCardProps {
  accept: string;
  busy: boolean;
  buttonLabel: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
  onUpload: () => void;
  title: string;
}

const emptyBootstrap: ReaderBootstrap = {
  books: [],
  dictionary: [],
  learnedLemmas: [],
  savedUnknownLemmas: [],
  latestExports: [],
  infrastructure: {
    d1: false,
    r2: false,
    mode: "loading"
  }
};

function UploadCard({
  accept,
  busy,
  buttonLabel,
  description,
  file,
  onChange,
  onUpload,
  title
}: UploadCardProps) {
  return (
    <article className={styles.uploadCard}>
      <div className="section-heading">
        <Pill tone="muted">Import</Pill>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <label className={styles.fileField}>
        <span>Select file</span>
        <input
          accept={accept}
          onChange={(event) => {
            onChange(event.target.files?.[0] ?? null);
          }}
          type="file"
        />
      </label>
      <div className={styles.uploadFooter}>
        <small>{file ? file.name : "No file selected"}</small>
        <button
          className="button button-primary"
          disabled={!file || busy}
          onClick={onUpload}
          type="button"
        >
          {busy ? "Uploading…" : buttonLabel}
        </button>
      </div>
    </article>
  );
}

function replaceLatestExport(
  current: ReaderExportSummary[],
  nextRecord: ReaderExportSummary
) {
  return [
    nextRecord,
    ...current.filter((record) => record.itemId !== nextRecord.itemId)
  ];
}

function replaceSavedUnknown(
  current: ReaderBootstrap["savedUnknownLemmas"],
  nextRecord: ReaderBootstrap["savedUnknownLemmas"][number]
) {
  return [
    nextRecord,
    ...current.filter(
      (record) =>
        !(record.itemId === nextRecord.itemId && record.lemma === nextRecord.lemma)
    )
  ];
}

function mergeLearnedLemmas(
  current: ReaderBootstrap["learnedLemmas"],
  nextRecords: ReaderBootstrap["learnedLemmas"]
) {
  const merged = new Map(current.map((record) => [record.lemma, record]));

  for (const record of nextRecords) {
    merged.set(record.lemma, record);
  }

  return Array.from(merged.values()).sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || left.lemma.localeCompare(right.lemma)
  );
}

export default function EbookReaderView() {
  const [bootstrap, setBootstrap] = useState<ReaderBootstrap>(emptyBootstrap);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingAction, setPendingAction] = useState<
    | "book"
    | "dictionary"
    | "learned"
    | "export"
    | "mark-learned"
    | "mark-page-learned"
    | "save-unknown"
    | null
  >(null);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [currentPageWords, setCurrentPageWords] = useState<UnknownWordAggregate[]>([]);
  const [selectedWord, setSelectedWord] = useState<UnknownWordAggregate | null>(null);
  const [defaultDictionaryEntries, setDefaultDictionaryEntries] = useState<
    ReaderBootstrap["dictionary"]
  >([]);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [dictionaryFile, setDictionaryFile] = useState<File | null>(null);
  const [learnedFile, setLearnedFile] = useState<File | null>(null);

  const lookup = useMemo(
    () =>
      createVocabularyLookup(
        [...defaultDictionaryEntries, ...bootstrap.dictionary],
        bootstrap.learnedLemmas
      ),
    [bootstrap.dictionary, bootstrap.learnedLemmas, defaultDictionaryEntries]
  );
  const epubBooks = useMemo(
    () => bootstrap.books.filter((book) => book.format.toLowerCase() === "epub"),
    [bootstrap.books]
  );

  const selectedBook = useMemo(
    () => epubBooks.find((book) => book.id === selectedBookId) ?? null,
    [epubBooks, selectedBookId]
  );

  const latestExportByBookId = useMemo(
    () => new Map(bootstrap.latestExports.map((record) => [record.itemId, record])),
    [bootstrap.latestExports]
  );
  const savedUnknownByBookId = useMemo(() => {
    const grouped = new Map<number, ReaderBootstrap["savedUnknownLemmas"]>();

    for (const record of bootstrap.savedUnknownLemmas) {
      const group = grouped.get(record.itemId);

      if (group) {
        group.push(record);
        continue;
      }

      grouped.set(record.itemId, [record]);
    }

    return grouped;
  }, [bootstrap.savedUnknownLemmas]);

  const selectedBookExport = selectedBook
    ? latestExportByBookId.get(selectedBook.id) ?? null
    : null;
  const selectedBookSavedUnknowns = selectedBook
    ? savedUnknownByBookId.get(selectedBook.id) ?? []
    : [];
  const selectedBookSavedUnknownSet = useMemo(
    () => new Set(selectedBookSavedUnknowns.map((entry) => entry.lemma)),
    [selectedBookSavedUnknowns]
  );
  const selectedWordIsSavedUnknown = selectedWord
    ? selectedBookSavedUnknownSet.has(selectedWord.lemma)
    : false;

  async function loadBootstrap(signal?: AbortSignal) {
    try {
      const snapshot = await getReaderBootstrap(signal);

      if (signal?.aborted) {
        return;
      }

      startTransition(() => {
        setBootstrap(snapshot);
        setStatus("ready");
        setErrorMessage("");
      });
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      startTransition(() => {
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Reader module bootstrap failed."
        );
      });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadBootstrap(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultDictionary() {
      try {
        const entries = await loadDefaultDictionaryEntries();

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setDefaultDictionaryEntries(entries);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setNotice(
          error instanceof Error
            ? `Default dictionary failed to load: ${error.message}`
            : "Default dictionary failed to load."
        );
      }
    }

    void loadDefaultDictionary();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!epubBooks.length) {
      setSelectedBookId(null);
      return;
    }

    if (selectedBookId && epubBooks.some((book) => book.id === selectedBookId)) {
      return;
    }

    setSelectedBookId(epubBooks[0].id);
  }, [epubBooks, selectedBookId]);

  useEffect(() => {
    if (!selectedWord) {
      return;
    }

    const nextSelectedWord = currentPageWords.find(
      (word) => word.lemma === selectedWord.lemma
    );

    if (nextSelectedWord) {
      setSelectedWord(nextSelectedWord);
    }
  }, [currentPageWords, selectedWord]);

  async function handleBookImport() {
    if (!bookFile) {
      return;
    }

    setPendingAction("book");
    setNotice("");

    try {
      const result = await importReaderBook(bookFile);
      await loadBootstrap();
      startTransition(() => {
        setSelectedBookId(result.book.id);
        setBookFile(null);
        setNotice(`Imported ${result.book.title} into Cloudflare R2 and D1.`);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "EPUB import failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDictionaryImport() {
    if (!dictionaryFile) {
      return;
    }

    setPendingAction("dictionary");
    setNotice("");

    try {
      const result = await importReaderDictionary(dictionaryFile);
      await loadBootstrap();
      startTransition(() => {
        setDictionaryFile(null);
        setNotice(`Imported ${result.imported} dictionary entries from ${result.source}.`);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Dictionary import failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleLearnedImport() {
    if (!learnedFile) {
      return;
    }

    setPendingAction("learned");
    setNotice("");

    try {
      const result = await importReaderLearnedWords(learnedFile);
      await loadBootstrap();
      startTransition(() => {
        setLearnedFile(null);
        setNotice(`Imported ${result.imported} learned lemmas from ${result.source}.`);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Learned words import failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleProgressChange(payload: {
    itemId: number;
    locator: string;
    progressPercent: number;
  }) {
    try {
      const result = await updateReaderProgress(payload);

      startTransition(() => {
        setBootstrap((current) => ({
          ...current,
          books: current.books.map((book) =>
            book.id === payload.itemId
              ? {
                  ...book,
                  progress: result.progress
                }
              : book
          )
        }));
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Progress sync failed.");
    }
  }

  function handleInlineWordSelect(lemma: string, surface: string) {
    const currentWord = currentPageWords.find((word) => word.lemma === lemma);

    if (currentWord) {
      setSelectedWord(currentWord);
      return;
    }

    const decision = evaluateWord(surface, lookup);

    setSelectedWord({
      lemma,
      surfaceForms: [surface],
      definition: decision.definition,
      partOfSpeech: decision.partOfSpeech,
      note: decision.note,
      phonetic: decision.phonetic,
      occurrenceCount: 1,
      sampleContext: surface
    });
  }

  async function handleMarkLearned() {
    if (!selectedWord) {
      return;
    }

    setPendingAction("mark-learned");
    setNotice("");

    try {
      const result = await markReaderLearnedLemmas([selectedWord.lemma]);
      const learnedSet = new Set(result.learned.map((entry) => entry.lemma));

      startTransition(() => {
        setBootstrap((current) => ({
          ...current,
          learnedLemmas: mergeLearnedLemmas(current.learnedLemmas, result.learned),
          savedUnknownLemmas: current.savedUnknownLemmas.filter(
            (entry) => !learnedSet.has(entry.lemma)
          )
        }));
        setSelectedWord(null);
        setNotice(`${selectedWord.lemma} is now stored as learned in D1.`);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Updating learned words failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMarkCurrentPageLearned() {
    const lemmas = Array.from(new Set(currentPageWords.map((word) => word.lemma)));

    if (!lemmas.length) {
      return;
    }

    setPendingAction("mark-page-learned");
    setNotice("");

    try {
      const result = await markReaderLearnedLemmas(lemmas);
      const learnedSet = new Set(result.learned.map((entry) => entry.lemma));

      startTransition(() => {
        setBootstrap((current) => ({
          ...current,
          learnedLemmas: mergeLearnedLemmas(current.learnedLemmas, result.learned),
          savedUnknownLemmas: current.savedUnknownLemmas.filter(
            (entry) => !learnedSet.has(entry.lemma)
          )
        }));
        setSelectedWord((current) =>
          current && learnedSet.has(current.lemma) ? null : current
        );
        setNotice(`Stored ${result.learned.length} current-page lemmas as learned in D1.`);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Bulk learned update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveUnknownWord() {
    if (!selectedBook || !selectedWord) {
      return;
    }

    setPendingAction("save-unknown");
    setNotice("");

    try {
      const result = await saveReaderUnknownLemma({
        itemId: selectedBook.id,
        lemma: selectedWord.lemma,
        surfaceForms: selectedWord.surfaceForms,
        definition: selectedWord.definition,
        partOfSpeech: selectedWord.partOfSpeech,
        note: selectedWord.note,
        phonetic: selectedWord.phonetic,
        sampleContext: selectedWord.sampleContext,
        firstLocator: selectedBook.progress?.locator ?? null
      });

      startTransition(() => {
        setBootstrap((current) => ({
          ...current,
          savedUnknownLemmas: replaceSavedUnknown(current.savedUnknownLemmas, result.unknown)
        }));
        setNotice(`${result.unknown.lemma} is now stored in your unknown-word list.`);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Saving unknown word failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleExportUnknownWords() {
    if (!selectedBook) {
      return;
    }

    setPendingAction("export");
    setNotice("");

    try {
      const result = await triggerReaderUnknownWordsExport(selectedBook.id);

      startTransition(() => {
        setBootstrap((current) => ({
          ...current,
          books: current.books.map((book) =>
            book.id === selectedBook.id
              ? {
                  ...book,
                  lastExportedAt:
                    result.exportRecord.completedAt ?? book.lastExportedAt
                }
              : book
          ),
          latestExports: replaceLatestExport(current.latestExports, result.exportRecord)
        }));
        setNotice("Unknown-word CSV exported to Cloudflare R2.");
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className={styles.page}>
      <section className="panel panel-hero">
        <div className="section-heading">
          <Pill tone="accent">EPUB Reader</Pill>
          <h2>英文小说阅读和词汇追踪全部保存在 Cloudflare。</h2>
          <p>
            EPUB 原文件和导出 CSV 放在 R2，已学词和阅读进度写入 D1。
            默认词典来自 ECDICT 的高频词子集，自定义导入词典会在客户端覆盖默认释义。
          </p>
        </div>
        <div className="hero-summary">
          <div>
            <span className="metric-label">Books</span>
            <strong>{epubBooks.length}</strong>
          </div>
          <div>
            <span className="metric-label">Dictionary</span>
            <strong>{defaultDictionaryEntries.length + bootstrap.dictionary.length}</strong>
          </div>
          <div>
            <span className="metric-label">Learned</span>
            <strong>{bootstrap.learnedLemmas.length}</strong>
          </div>
          <div>
            <span className="metric-label">Current page unknown</span>
            <strong>{currentPageWords.length}</strong>
          </div>
          <div>
            <span className="metric-label">Saved unknown</span>
            <strong>{bootstrap.savedUnknownLemmas.length}</strong>
          </div>
        </div>
      </section>

      {notice ? (
        <section className={`panel ${styles.noticePanel}`}>
          <strong>{notice}</strong>
        </section>
      ) : null}

      {status === "error" ? (
        <section className={`panel ${styles.errorPanel}`}>
          <div className="section-heading">
            <Pill tone="muted">Cloudflare Required</Pill>
            <h2>Reader bootstrap failed</h2>
            <p>{errorMessage}</p>
          </div>
          <div className={styles.errorActions}>
            <button
              className="button button-primary"
              onClick={() => {
                setStatus("loading");
                void loadBootstrap();
              }}
              type="button"
            >
              Retry
            </button>
          </div>
        </section>
      ) : null}

      <section className={styles.uploadGrid}>
        <UploadCard
          accept=".epub,application/epub+zip"
          busy={pendingAction === "book"}
          buttonLabel="Import EPUB"
          description="Upload a reflowable English EPUB. Metadata is read from the archive and the source file is stored in R2."
          file={bookFile}
          onChange={setBookFile}
          onUpload={() => {
            void handleBookImport();
          }}
          title="Book Import"
        />
        <UploadCard
          accept=".json,.csv,text/csv,application/json"
          busy={pendingAction === "dictionary"}
          buttonLabel="Import Dictionary"
          description="Support CSV or JSON with at least lemma and definition. Imported entries override the built-in ECDICT default dictionary."
          file={dictionaryFile}
          onChange={setDictionaryFile}
          onUpload={() => {
            void handleDictionaryImport();
          }}
          title="Dictionary Import"
        />
        <UploadCard
          accept=".json,.csv,text/csv,application/json"
          busy={pendingAction === "learned"}
          buttonLabel="Import Learned Words"
          description="Preload your learned lemmas from CSV or JSON. Future marks during reading are persisted back to D1."
          file={learnedFile}
          onChange={setLearnedFile}
          onUpload={() => {
            void handleLearnedImport();
          }}
          title="Learned Lemmas"
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <Pill tone="muted">Library</Pill>
          <h2>Cloudflare book shelf</h2>
          <p>
            Select an EPUB to open its R2-backed file and continue from the latest CFI stored in D1.
          </p>
        </div>
        <div className={styles.libraryGrid}>
          {epubBooks.length ? (
            epubBooks.map((book) => (
              <button
                key={book.id}
                className={`${styles.libraryCard} ${
                  selectedBook?.id === book.id ? styles.libraryCardSelected : ""
                }`}
                onClick={() => {
                  setSelectedBookId(book.id);
                  setSelectedWord(null);
                }}
                type="button"
              >
                <div className={styles.libraryCardHeader}>
                  <div>
                    <strong>{book.title}</strong>
                    <p>{book.author}</p>
                  </div>
                  <Pill>{book.format}</Pill>
                </div>
                <div className={styles.libraryMeta}>
                  <span>{book.language.toUpperCase()}</span>
                  <span>
                    {book.progress
                      ? `${book.progress.progressPercent}% · ${formatRelativeTime(book.progress.updatedAt)}`
                      : "Not started"}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className={styles.libraryEmpty}>
              <strong>No EPUBs available.</strong>
              <p>Import one English EPUB above. Existing PDF seed items are not rendered in this module.</p>
            </div>
          )}
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.readerColumn}>
          <div className="panel">
            <div className="section-heading">
              <Pill tone="muted">Read</Pill>
              <h2>Paginated reading surface</h2>
              <p>
                Unknown words are re-evaluated on every page turn against the latest D1 snapshot.
                If this page is mostly familiar, use the bulk action to mark the whole page as learned.
              </p>
            </div>
            <div className={styles.readerActions}>
              <button
                className="button"
                disabled={!selectedBook || !currentPageWords.length || pendingAction === "mark-page-learned"}
                onClick={() => {
                  void handleMarkCurrentPageLearned();
                }}
                type="button"
              >
                {pendingAction === "mark-page-learned"
                  ? "Saving page…"
                  : "Mark current page as learned"}
              </button>
              <span>
                {currentPageWords.length
                  ? `${currentPageWords.length} current-page unknown lemmas will be stored as learned in D1.`
                  : "No current-page unknown lemmas to batch-mark right now."}
              </span>
            </div>

            {status === "loading" && !bootstrap.books.length ? (
              <div className={styles.emptyState}>Loading Cloudflare reader snapshot…</div>
            ) : null}

            {selectedBook ? (
              <ReaderViewport
                key={selectedBook.id}
                book={selectedBook}
                lookup={lookup}
                onProgressChange={handleProgressChange}
                onVisibleWordsChange={setCurrentPageWords}
                onWordSelect={handleInlineWordSelect}
              />
            ) : (
              <div className={styles.emptyState}>
                Import a book, then select it from the shelf to start reading.
              </div>
            )}
          </div>
        </div>

        <aside className={styles.sidebarColumn}>
          <section className="panel">
            <div className="section-heading">
              <Pill tone="muted">Selection</Pill>
              <h2>Definition panel</h2>
              <p>
                Click a highlighted word in the page, or select an English word in the book text.
                Then decide whether to mark it learned or save it to your unknown list.
              </p>
            </div>
            {selectedWord ? (
              <div className={styles.definitionCard}>
                <div className={styles.definitionHeader}>
                  <div>
                    <strong>{selectedWord.lemma}</strong>
                    <p>{selectedWord.surfaceForms.join(", ")}</p>
                    {selectedWord.phonetic ? (
                      <p className={styles.phonetic}>/{selectedWord.phonetic}/</p>
                    ) : null}
                  </div>
                  {selectedWord.partOfSpeech ? <Pill>{selectedWord.partOfSpeech}</Pill> : null}
                </div>
                <p className={styles.definitionText}>
                  {selectedWord.definition ?? "词典未收录"}
                </p>
                {selectedWord.note ? <p className={styles.definitionNote}>{selectedWord.note}</p> : null}
                <p className={styles.sampleText}>{selectedWord.sampleContext}</p>
                <div className={styles.definitionActions}>
                  <button
                    className="button"
                    disabled={
                      !selectedBook ||
                      selectedWordIsSavedUnknown ||
                      pendingAction === "save-unknown"
                    }
                    onClick={() => {
                      void handleSaveUnknownWord();
                    }}
                    type="button"
                  >
                    {selectedWordIsSavedUnknown
                      ? "Already in unknown list"
                      : pendingAction === "save-unknown"
                        ? "Saving…"
                        : "Save to unknown list"}
                  </button>
                  <button
                    className="button button-primary"
                    disabled={pendingAction === "mark-learned"}
                    onClick={() => {
                      void handleMarkLearned();
                    }}
                    type="button"
                  >
                    {pendingAction === "mark-learned" ? "Saving…" : "Mark as learned"}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                Select a word in the reader to inspect its meaning.
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <Pill tone="muted">Export</Pill>
              <h2>Current book CSV</h2>
              <p>
                Export the unknown words you explicitly saved from the sidebar. The CSV is generated on the server, stored in R2, and remains downloadable later.
              </p>
            </div>
            <div className={styles.exportCard}>
              <div className={styles.exportMeta}>
                <span>Selected book</span>
                <strong>{selectedBook?.title ?? "None selected"}</strong>
              </div>
              <div className={styles.exportMeta}>
                <span>Saved unknown words</span>
                <strong>{selectedBook ? selectedBookSavedUnknowns.length : 0}</strong>
              </div>
              <div className={styles.exportMeta}>
                <span>Latest export</span>
                <strong>
                  {selectedBookExport?.completedAt
                    ? formatRelativeTime(selectedBookExport.completedAt)
                    : "Not exported yet"}
                </strong>
              </div>
              <div className={styles.exportActions}>
                <button
                  className="button button-primary"
                  disabled={!selectedBook || pendingAction === "export"}
                  onClick={() => {
                    void handleExportUnknownWords();
                  }}
                  type="button"
                >
                  {pendingAction === "export" ? "Exporting…" : "Export saved unknown words"}
                </button>
                {selectedBookExport?.downloadUrl ? (
                  <a className="button" href={selectedBookExport.downloadUrl}>
                    Download latest CSV
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
