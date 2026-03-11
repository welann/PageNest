import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { ReaderSidebar } from "@modules/ebook-reader/ReaderSidebar";
import { ReaderViewport } from "@modules/ebook-reader/ReaderViewport";
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

  async function handleBookImport(file: File | null) {
    if (!file) {
      return;
    }

    setPendingAction("book");
    setNotice("");
    setBookFileName(file.name);

    try {
      const result = await importReaderBook(file);
      await loadBootstrap();
      startTransition(() => {
        setSelectedBookId(result.book.id);
        setSelectedWord(null);
        setNotice(`Imported ${result.book.title} into Cloudflare R2 and D1.`);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "EPUB import failed.");
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
    setNotice("");
    setDictionaryFileName(file.name);

    try {
      const result = await importReaderDictionary(file);
      await loadBootstrap();
      startTransition(() => {
        setNotice(`Imported ${result.imported} dictionary entries from ${result.source}.`);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Dictionary import failed.");
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
    setNotice("");
    setLearnedFileName(file.name);

    try {
      const result = await importReaderLearnedWords(file);
      await loadBootstrap();
      startTransition(() => {
        setNotice(`Imported ${result.imported} learned lemmas from ${result.source}.`);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Learned words import failed.");
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

  const selectionSummary = selectedWord
    ? `${selectedWord.lemma} · ${selectedWord.occurrenceCount} 次出现`
    : "点击正文单词即时刷新";

  const infrastructureSummary = [
    {
      label: "Books",
      value: String(epubBooks.length)
    },
    {
      label: "Learned words",
      value: bootstrap.learnedLemmas.length.toLocaleString()
    },
    {
      label: "Unknown list",
      value: bootstrap.savedUnknownLemmas.length.toLocaleString()
    },
    {
      label: "Mode",
      value: bootstrap.infrastructure.mode
    }
  ];

  const currentBookTitle = selectedBook?.title ?? "Reader Desk";
  const currentProgressPercent = selectedBook?.progress?.progressPercent ?? 0;
  const latestExportLabel = selectedBookExport?.completedAt
    ? formatRelativeTime(selectedBookExport.completedAt)
    : "Not exported";

  return (
    <div className="grid gap-3 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-4">
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

      <ReaderSidebar
        bookFileName={bookFileName}
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
        visibleUnknownCount={currentPageWords.length}
        onExportCsv={() => {
          void handleExportUnknownWords();
        }}
        onImportBook={() => {
          triggerFileDialog(bookInputRef.current);
        }}
        onImportDictionary={() => {
          triggerFileDialog(dictionaryInputRef.current);
        }}
        onImportLearned={() => {
          triggerFileDialog(learnedInputRef.current);
        }}
      />

      <div className="grid gap-3 lg:gap-4">
        {notice ? (
          <section className="rounded-[0.9rem] border border-[#d7e0ee] bg-[#f8fafd] px-4 py-3 text-sm text-[#4d607d]">
            {notice}
          </section>
        ) : null}

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

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
          <div className="grid gap-3">
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
                      className="rounded-[0.65rem]"
                      disabled={
                        !selectedBook ||
                        !currentPageWords.length ||
                        pendingAction === "mark-page-learned"
                      }
                      onClick={() => {
                        void handleMarkCurrentPageLearned();
                      }}
                      size="sm"
                      variant="outline"
                    >
                      {pendingAction === "mark-page-learned"
                        ? "保存中..."
                        : `标记本页已学 (${currentPageWords.length})`}
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

          <aside className="grid gap-3 xl:sticky xl:top-4 xl:self-start">
            <section
              className="scroll-mt-4 rounded-[0.95rem] border border-[#d9dee5] bg-white p-4"
              id="word-detail"
            >
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7b8596]">
                Word Detail
              </p>
              {selectedWord ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <h2 className="font-serif text-[2.4rem] leading-[0.92] tracking-[-0.04em] text-[#1f2a37]">
                      {selectedWord.lemma}
                    </h2>
                    <p className="mt-1 text-xs text-[#6f7b8f]">
                      {selectedWord.phonetic ? `/${selectedWord.phonetic}/ · ` : ""}
                      {selectedWord.partOfSpeech ?? "word"}
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-[#303846]">
                    {selectedWord.definition ?? "词典未收录"}
                  </p>
                  {selectedWord.note ? (
                    <div className="rounded-[0.7rem] border border-[#dce3ee] bg-[#f7f9fc] px-3 py-2 text-xs leading-5 text-[#5f6b7d]">
                      {selectedWord.note}
                    </div>
                  ) : null}
                  <div className="rounded-[0.7rem] border border-[#dce3ee] bg-[#f7f9fc] px-3 py-2 text-xs leading-5 text-[#5f6b7d]">
                    {selectedWord.sampleContext}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className="rounded-[0.65rem]"
                      disabled={
                        !selectedBook ||
                        selectedWordIsSavedUnknown ||
                        pendingAction === "save-unknown"
                      }
                      onClick={() => {
                        void handleSaveUnknownWord();
                      }}
                      size="sm"
                      variant="outline"
                    >
                      {selectedWordIsSavedUnknown
                        ? "已在未学列表"
                        : pendingAction === "save-unknown"
                          ? "保存中..."
                          : "收入未学词"}
                    </Button>
                    <Button
                      className="rounded-[0.65rem] bg-[#111215] text-white hover:bg-[#20242c]"
                      disabled={pendingAction === "mark-learned"}
                      onClick={() => {
                        void handleMarkLearned();
                      }}
                      size="sm"
                    >
                      {pendingAction === "mark-learned" ? "保存中..." : "标记已学"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-[0.8rem] border border-[#dce3ee] bg-[#f8fafd] px-3 py-4 text-sm leading-6 text-[#6f7b8f]">
                  Click a highlighted word in the book, or select a single English word in the text.
                </div>
              )}
            </section>

            <section className="rounded-[0.85rem] border border-[#d7e0ee] bg-[#f8fafd] p-4">
              <p className="text-sm text-[#4d607d]">释义面板已固定 · {selectionSummary}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-[#6f7b8f]">
                <span>本页未学词</span>
                <span>{currentPageWords.length}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-[#6f7b8f]">
                <span>当前书目已保存</span>
                <span>{selectedBookSavedUnknowns.length}</span>
              </div>
            </section>

            <section
              className="scroll-mt-4 rounded-[0.95rem] border border-[#d9dee5] bg-white p-4"
              id="reading-status"
            >
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7b8596]">
                Reading Status
              </p>
              <div className="mt-3 grid gap-2 text-sm text-[#2f3746]">
                {infrastructureSummary.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span className="text-[#6f7b8f]">{item.label}</span>
                    <span>{item.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#6f7b8f]">Latest export</span>
                  <span>{latestExportLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#6f7b8f]">Reader source</span>
                  <Badge className="border-[#d9dee5] bg-[#f8fafd] text-[#4d607d]" variant="outline">
                    {bootstrap.infrastructure.d1 && bootstrap.infrastructure.r2
                      ? "Cloudflare"
                      : "Fallback"}
                  </Badge>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
