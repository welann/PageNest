import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useSetActiveSidebarSlot } from "@components/shell/moduleShell";
import { Button } from "@components/ui/button";
import { ReaderSidebarPanel } from "@modules/ebook-reader/ReaderSidebar";
import { ReaderViewport } from "@modules/ebook-reader/ReaderViewport";
import {
  createVocabularyLookup,
  evaluateWord,
  type UnknownWordAggregate
} from "@shared/reader/vocabulary";
import { loadDefaultDictionaryEntries } from "@shared/reader/defaultDictionary";
import type {
  ReaderBookSummary,
  ReaderBootstrap,
  ReaderDictionaryEntry,
  ReaderExportSummary
} from "@shared/types/reader";
import { formatRelativeTime } from "@shared/utils/format";
import {
  copyReaderIncrementalUnknownWords,
  getReaderBootstrap,
  importReaderBook,
  importReaderDictionary,
  importReaderLearnedWords,
  markReaderLearnedLemmas,
  saveReaderUnknownLemma,
  triggerReaderUnknownWordsExport,
  updateReaderProgress
} from "@services/api/reader";

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

function replaceLatestExport(
  current: ReaderExportSummary[],
  nextRecord: ReaderExportSummary
) {
  return [
    nextRecord,
    ...current.filter((record) => record.itemId !== nextRecord.itemId)
  ];
}

function insertOrReplaceBook(
  current: ReaderBookSummary[],
  nextBook: ReaderBookSummary
) {
  return [
    nextBook,
    ...current.filter((book) => book.id !== nextBook.id)
  ];
}

function mergeDictionaryEntries(
  current: ReaderDictionaryEntry[],
  nextEntries: ReaderDictionaryEntry[]
) {
  const merged = new Map(current.map((entry) => [entry.lemma, entry]));

  for (const entry of nextEntries) {
    merged.set(entry.lemma, entry);
  }

  return Array.from(merged.values()).sort((left, right) =>
    left.lemma.localeCompare(right.lemma)
  );
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

function triggerFileDialog(input: HTMLInputElement | null) {
  input?.click();
}

export default function EbookReaderView() {
  const setActiveSidebarSlot = useSetActiveSidebarSlot();
  const [bootstrap, setBootstrap] = useState<ReaderBootstrap>(emptyBootstrap);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<
    | "book"
    | "dictionary"
    | "learned"
    | "export"
    | "copy-export"
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
  const [bookFileName, setBookFileName] = useState("");
  const [dictionaryFileName, setDictionaryFileName] = useState("");
  const [learnedFileName, setLearnedFileName] = useState("");

  const bookInputRef = useRef<HTMLInputElement | null>(null);
  const dictionaryInputRef = useRef<HTMLInputElement | null>(null);
  const learnedInputRef = useRef<HTMLInputElement | null>(null);

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
  const bulkMarkablePageWords = useMemo(
    () =>
      currentPageWords.filter((word) => !selectedBookSavedUnknownSet.has(word.lemma)),
    [currentPageWords, selectedBookSavedUnknownSet]
  );
  const selectedWordIsSavedUnknown = selectedWord
    ? selectedBookSavedUnknownSet.has(selectedWord.lemma)
    : false;
  const sourceReady = bootstrap.infrastructure.d1 && bootstrap.infrastructure.r2;

  async function loadBootstrap(signal?: AbortSignal) {
    try {
      const snapshot = await getReaderBootstrap(signal);

      if (signal?.aborted) {
        return;
      }

      setBootstrap(snapshot);
      setStatus("ready");
      setErrorMessage("");
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Reader module bootstrap failed."
      );
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

        setDefaultDictionaryEntries(entries);
      } catch (error) {
        if (cancelled) {
          return;
        }

        toast.error(
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

  async function handleBookImport(file: File | null) {
    if (!file) {
      return;
    }

    setPendingAction("book");
    setBookFileName(file.name);

    try {
      const result = await importReaderBook(file);
      setBootstrap((current) => ({
        ...current,
        books: insertOrReplaceBook(current.books, result.book)
      }));
      setSelectedBookId(result.book.id);
      setCurrentPageWords([]);
      setSelectedWord(null);
      setStatus("ready");
      setErrorMessage("");
      toast.success(`Imported ${result.book.title} into Cloudflare R2 and D1.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "EPUB import failed.");
    } finally {
      setPendingAction(null);
      if (bookInputRef.current) {
        bookInputRef.current.value = "";
      }
    }
  }

  async function handleDictionaryImport(file: File | null) {
    if (!file) {
      return;
    }

    setPendingAction("dictionary");
    setDictionaryFileName(file.name);

    try {
      const result = await importReaderDictionary(file);
      setBootstrap((current) => ({
        ...current,
        dictionary: mergeDictionaryEntries(current.dictionary, result.entries)
      }));
      toast.success(`Imported ${result.imported} dictionary entries from ${result.source}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dictionary import failed.");
    } finally {
      setPendingAction(null);
      if (dictionaryInputRef.current) {
        dictionaryInputRef.current.value = "";
      }
    }
  }

  async function handleLearnedImport(file: File | null) {
    if (!file) {
      return;
    }

    setPendingAction("learned");
    setLearnedFileName(file.name);

    try {
      const result = await importReaderLearnedWords(file);
      const learnedSet = new Set(result.learned.map((entry) => entry.lemma));

      setBootstrap((current) => ({
        ...current,
        learnedLemmas: mergeLearnedLemmas(current.learnedLemmas, result.learned),
        savedUnknownLemmas: current.savedUnknownLemmas.filter(
          (entry) => !learnedSet.has(entry.lemma)
        )
      }));
      setCurrentPageWords((current) =>
        current.filter((word) => !learnedSet.has(word.lemma))
      );
      setSelectedWord((current) =>
        current && learnedSet.has(current.lemma) ? null : current
      );
      toast.success(`Imported ${result.imported} learned lemmas from ${result.source}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Learned words import failed.");
    } finally {
      setPendingAction(null);
      if (learnedInputRef.current) {
        learnedInputRef.current.value = "";
      }
    }
  }

  async function handleProgressChange(payload: {
    itemId: number;
    locator: string;
    progressPercent: number;
  }) {
    try {
      const result = await updateReaderProgress(payload);

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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Progress sync failed.");
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

    try {
      const result = await markReaderLearnedLemmas([selectedWord.lemma], {
        deleteUnknown: true,
        itemId: selectedBook?.id
      });
      const learnedSet = new Set(result.learned.map((entry) => entry.lemma));

      setBootstrap((current) => ({
        ...current,
        learnedLemmas: mergeLearnedLemmas(current.learnedLemmas, result.learned),
        savedUnknownLemmas: current.savedUnknownLemmas.filter(
          (entry) => !learnedSet.has(entry.lemma)
        )
      }));
      setCurrentPageWords((current) =>
        current.filter((word) => !learnedSet.has(word.lemma))
      );
      setSelectedWord(null);
      toast.success(`${selectedWord.lemma} is now stored as learned in D1.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Updating learned words failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMarkCurrentPageLearned() {
    const lemmas = Array.from(new Set(bulkMarkablePageWords.map((word) => word.lemma)));

    if (!lemmas.length) {
      return;
    }

    setPendingAction("mark-page-learned");

    try {
      const result = await markReaderLearnedLemmas(lemmas, {
        deleteUnknown: false
      });
      const learnedSet = new Set(result.learned.map((entry) => entry.lemma));

      setBootstrap((current) => ({
        ...current,
        learnedLemmas: mergeLearnedLemmas(current.learnedLemmas, result.learned)
      }));
      setCurrentPageWords((current) =>
        current.filter((word) => !learnedSet.has(word.lemma))
      );
      setSelectedWord((current) =>
        current && learnedSet.has(current.lemma) ? null : current
      );
      toast.success(`Stored ${result.learned.length} current-page lemmas as learned in D1.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk learned update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveUnknownWord() {
    if (!selectedBook || !selectedWord) {
      return;
    }

    setPendingAction("save-unknown");

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

      setBootstrap((current) => ({
        ...current,
        savedUnknownLemmas: replaceSavedUnknown(current.savedUnknownLemmas, result.unknown)
      }));
      toast.success(`${result.unknown.lemma} is now stored in your unknown-word list.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saving unknown word failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleExportUnknownWords() {
    if (!selectedBook) {
      return;
    }

    setPendingAction("export");

    try {
      const result = await triggerReaderUnknownWordsExport(selectedBook.id);

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
      toast.success("Unknown-word CSV exported to Cloudflare R2.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCopyUnknownWords() {
    if (!selectedBook) {
      return;
    }

    setPendingAction("copy-export");

    try {
      const result = await copyReaderIncrementalUnknownWords(selectedBook.id);

      setBootstrap((current) => ({
        ...current,
        books: current.books.map((book) =>
          book.id === selectedBook.id
            ? {
                ...book,
                lastClipboardExportedAt: result.cursorUpdatedAt
              }
            : book
        )
      }));

      if (result.exportedCount > 0) {
        await navigator.clipboard.writeText(result.text);
        toast.success(`Copied ${result.exportedCount} new unknown words to clipboard.`);
      } else {
        toast.success("No new unknown words since the last clipboard export.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Copying incremental unknown words failed."
      );
    } finally {
      setPendingAction(null);
    }
  }

  const currentBookTitle = selectedBook?.title ?? "Reader Desk";
  const currentProgressPercent = selectedBook?.progress?.progressPercent ?? 0;
  const latestExportLabel = selectedBookExport?.completedAt
    ? formatRelativeTime(selectedBookExport.completedAt)
    : "Not exported";
  const clipboardExportLabel = selectedBook?.lastClipboardExportedAt
    ? formatRelativeTime(selectedBook.lastClipboardExportedAt)
    : "Not copied";
  const openBookImport = useCallback(() => {
    triggerFileDialog(bookInputRef.current);
  }, []);
  const openDictionaryImport = useCallback(() => {
    triggerFileDialog(dictionaryInputRef.current);
  }, []);
  const openLearnedImport = useCallback(() => {
    triggerFileDialog(learnedInputRef.current);
  }, []);
  const runExportCsv = useCallback(() => {
    void handleExportUnknownWords();
  }, [selectedBook, pendingAction, bootstrap.latestExports]);
  const runCopyUnknownWords = useCallback(() => {
    void handleCopyUnknownWords();
  }, [selectedBook, pendingAction, selectedBookSavedUnknowns.length]);
  const runMarkCurrentPageLearned = useCallback(() => {
    void handleMarkCurrentPageLearned();
  }, [bulkMarkablePageWords, pendingAction]);
  const runSaveUnknownWord = useCallback(() => {
    void handleSaveUnknownWord();
  }, [selectedBook, selectedWord, pendingAction]);
  const runMarkLearned = useCallback(() => {
    void handleMarkLearned();
  }, [selectedBook, selectedWord, pendingAction]);

  const sidebarSlot = useMemo(
    () => ({
      moduleSlug: "ebook-reader",
      title: "Ebook Reader",
      description: "当前阅读会话的词义、统计与导入导出命令。",
      panel: (
        <ReaderSidebarPanel
          bookFileName={bookFileName}
          clipboardExportDisabled={
            !selectedBook ||
            !selectedBookSavedUnknowns.length ||
            pendingAction === "copy-export"
          }
          clipboardExportLabel={clipboardExportLabel}
          currentBookTitle={currentBookTitle}
          currentProgressPercent={currentProgressPercent}
          dictionaryFileName={dictionaryFileName}
          exportDisabled={!selectedBook || pendingAction === "export"}
          exportUrl={selectedBookExport?.downloadUrl ?? null}
          latestExportLabel={latestExportLabel}
          learnedFileName={learnedFileName}
          learnedWordCount={bootstrap.learnedLemmas.length.toLocaleString()}
          libraryCount={epubBooks.length}
          pendingAction={pendingAction}
          savedUnknownCount={bootstrap.savedUnknownLemmas.length.toLocaleString()}
          selectedBookSavedUnknownCount={selectedBookSavedUnknowns.length}
          selectedWord={selectedWord}
          selectedWordIsSavedUnknown={selectedWordIsSavedUnknown}
          sourceMode={bootstrap.infrastructure.mode}
          sourceReady={sourceReady}
          visibleUnknownCount={currentPageWords.length}
          onCopyUnknownWords={runCopyUnknownWords}
          onExportCsv={runExportCsv}
          onImportBook={openBookImport}
          onImportDictionary={openDictionaryImport}
          onImportLearned={openLearnedImport}
          onMarkLearned={runMarkLearned}
          onSaveUnknownWord={runSaveUnknownWord}
        />
      )
    }),
    [
      bookFileName,
      bootstrap.infrastructure.mode,
      bootstrap.learnedLemmas.length,
      bootstrap.savedUnknownLemmas.length,
      clipboardExportLabel,
      currentBookTitle,
      currentPageWords.length,
      currentProgressPercent,
      dictionaryFileName,
      epubBooks.length,
      latestExportLabel,
      learnedFileName,
      openBookImport,
      openDictionaryImport,
      openLearnedImport,
      pendingAction,
      runCopyUnknownWords,
      runExportCsv,
      runMarkCurrentPageLearned,
      runMarkLearned,
      runSaveUnknownWord,
      selectedBook,
      selectedBookExport,
      selectedBookSavedUnknowns.length,
      selectedWord,
      selectedWordIsSavedUnknown,
      sourceReady
    ]
  );

  useEffect(() => {
    setActiveSidebarSlot(sidebarSlot);

    return () => {
      setActiveSidebarSlot(null);
    };
  }, [setActiveSidebarSlot, sidebarSlot]);

  return (
    <div className="grid gap-3">
      <input
        accept=".epub,application/epub+zip"
        className="sr-only"
        onChange={(event) => {
          void handleBookImport(event.target.files?.[0] ?? null);
        }}
        ref={bookInputRef}
        type="file"
      />
      <input
        accept=".json,.csv,text/csv,application/json"
        className="sr-only"
        onChange={(event) => {
          void handleDictionaryImport(event.target.files?.[0] ?? null);
        }}
        ref={dictionaryInputRef}
        type="file"
      />
      <input
        accept=".json,.csv,text/csv,application/json"
        className="sr-only"
        onChange={(event) => {
          void handleLearnedImport(event.target.files?.[0] ?? null);
        }}
        ref={learnedInputRef}
        type="file"
      />

      {status === "error" ? (
        <section className="rounded-[1rem] border border-[#d7dce5] bg-white px-4 py-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7b8596]">
            Cloudflare Required
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#1f2a37]">Reader bootstrap failed</h2>
          <p className="mt-2 text-sm leading-6 text-[#6f7b8f]">{errorMessage}</p>
          <div className="mt-4">
            <Button
              onClick={() => {
                setStatus("loading");
                void loadBootstrap();
              }}
            >
              Retry
            </Button>
          </div>
        </section>
      ) : null}

      {status === "loading" && !bootstrap.books.length ? (
        <section className="rounded-[1rem] border border-[#d9dee5] bg-white px-4 py-5 text-sm text-[#6f7b8f]">
          Loading Cloudflare reader snapshot...
        </section>
      ) : null}

      {selectedBook ? (
        <ReaderViewport
          key={selectedBook.id}
          book={selectedBook}
          lookup={lookup}
          onProgressChange={handleProgressChange}
          toolbarSupplement={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-[#7b8596]">
                Book
              </label>
              <select
                className="h-9 min-w-[13rem] rounded-[0.7rem] border border-[#d9dee5] bg-white px-3 text-sm text-[#1f2a37] outline-none"
                disabled={!epubBooks.length}
                onChange={(event) => {
                  setSelectedBookId(Number(event.target.value));
                  setSelectedWord(null);
                }}
                value={selectedBookId ?? ""}
              >
                {epubBooks.length ? (
                  epubBooks.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))
                ) : (
                  <option value="">No EPUB available</option>
                )}
              </select>
              <Button
                className="rounded-[0.7rem] border-[#d7dceb] bg-[#f7f9fc] hover:bg-[#eef3f8]"
                disabled={
                  !selectedBook ||
                  !bulkMarkablePageWords.length ||
                  pendingAction === "mark-page-learned"
                }
                onClick={runMarkCurrentPageLearned}
                size="sm"
                variant="outline"
              >
                {pendingAction === "mark-page-learned"
                  ? "保存中..."
                  : `标记本页已学 (${bulkMarkablePageWords.length})`}
              </Button>
            </div>
          }
          onVisibleWordsChange={setCurrentPageWords}
          onWordSelect={handleInlineWordSelect}
        />
      ) : (
        <section className="rounded-[1rem] border border-[#d9dee5] bg-white px-4 py-10 text-center text-sm text-[#6f7b8f]">
          Import a book, then select it from the shelf to start reading.
        </section>
      )}
    </div>
  );
}
