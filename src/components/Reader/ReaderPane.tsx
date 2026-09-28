import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAppState } from "../../state/AppStateContext";
import { chapterMarks, useAnnotations } from "../../state/AnnotationsContext";
import { usePassage } from "../../queries/usePassage";
import { HAS_BIBLEQL_KEY } from "../../lib/graphql";
import { useFocusVerse } from "../../hooks/useFocusVerse";
import { useSpeech } from "../../hooks/useSpeech";
import { useVerseSelection } from "../../hooks/useVerseSelection";
import { bookLabel, stepChapter } from "../../lib/refs";
import { encodeVerses } from "../../lib/verseRanges";
import { fillTemplate } from "../../lib/format";
import { copyText } from "../../lib/clipboard";
import { STR } from "../../data/strings";
import { SAMPLE } from "../../data/sample";
import { NextIcon, PrevIcon, SpeakIcon, StopIcon } from "../icons";
import { ReaderColumn, type ColumnView } from "./ReaderColumn";
import { NoteDialog } from "./NoteDialog";
import type { VerseMarking } from "./VerseList";
import styles from "./ReaderPane.module.scss";

interface ReaderPaneProps {
  compareEff: boolean;
}

export function ReaderPane({ compareEff }: ReaderPaneProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const navigate = useNavigate();
  const { bookId = "PSA", chapter: chapterParam, panel = "ai" } = useParams();
  const chapter = Number(chapterParam) || 1;
  const [searchParams] = useSearchParams();
  const fromVerse = searchParams.get("from") ? Number(searchParams.get("from")) : null;
  const toVerse = searchParams.get("to") ? Number(searchParams.get("to")) : fromVerse;
  const noKey = !HAS_BIBLEQL_KEY;

  const passageA = usePassage("a", state.transA, bookId, chapter);
  const passageB = usePassage("b", state.transB, bookId, chapter, state.compare);

  const colA: ColumnView = useMemo(() => {
    if (noKey) {
      return {
        label: `${bookLabel("PSA", state.locale)} 23 · ${state.locale === "es" ? "RV1909" : "WEB"}`,
        showLabel: true,
        loading: false,
        notice: t.noKey,
        verses: SAMPLE[state.locale].map((text, i) => ({ n: i + 1, text, hl: "off" as const }))
      };
    }
    const verses = (passageA.data?.verses ?? []).map((v) => ({
      n: v.verse,
      text: v.text,
      hl:
        fromVerse !== null && v.verse >= fromVerse && v.verse <= (toVerse ?? fromVerse)
          ? ("on" as const)
          : ("off" as const)
    }));
    return {
      label: passageA.data?.translationName || state.transA,
      showLabel: compareEff,
      loading: passageA.isLoading,
      notice: passageA.error?.message ?? "",
      verses
    };
  }, [noKey, passageA.data, passageA.isLoading, passageA.error, fromVerse, toVerse, compareEff, state.transA, state.locale, t.noKey]);

  const colB: ColumnView = useMemo(() => {
    // Faithful quirk: with no API key, the original only ever built a
    // sample/notice fallback for column A — column B just stays blank.
    if (noKey) return { label: state.transB, showLabel: true, loading: false, notice: "", verses: [] };
    const verses = (passageB.data?.verses ?? []).map((v) => ({
      n: v.verse,
      text: v.text,
      hl:
        fromVerse !== null && v.verse >= fromVerse && v.verse <= (toVerse ?? fromVerse)
          ? ("on" as const)
          : ("off" as const)
    }));
    return {
      label: passageB.data?.translationName || state.transB,
      showLabel: true,
      loading: passageB.isLoading,
      notice: passageB.error?.message ?? "",
      verses
    };
  }, [noKey, passageB.data, passageB.isLoading, passageB.error, fromVerse, toVerse, state.transB]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useFocusVerse(scrollRef, fromVerse, passageA.dataUpdatedAt);

  // Read-aloud via the OS voices (Web Speech API — no keys, works offline
  // with the sample chapter).
  // One utterance is queued per verse so the verse being read can be
  // highlighted as the voice moves down the chapter.
  const {
    speaking,
    activeVerse,
    supported: speechSupported,
    speakChapter,
    speakVerse,
    stop: stopSpeech
  } = useSpeech(state.locale);
  const canListen = speechSupported && colA.verses.length > 0;

  // Don't keep reading a chapter the user already left.
  useEffect(() => {
    stopSpeech();
  }, [bookId, chapter, stopSpeech]);

  function toggleListen(): void {
    if (speaking) stopSpeech();
    else speakChapter(colA.verses);
  }

  function goStep(dir: 1 | -1): void {
    const next = stepChapter(bookId, chapter, dir);
    if (!next) return;
    navigate(`/read/${next.bookId}/${next.chapter}/${panel}`);
  }

  // Multi-verse selection for "Create Image" — scoped to column A, since a
  // handed-off passage only ever has one translation (spec's BibleSource).
  const verseSelection = useVerseSelection(bookId, chapter);
  const clearSelection = verseSelection.clear;
  const selectedVerses = verseSelection.selected;
  const createImage = useCallback(() => {
    const v = encodeVerses(selectedVerses);
    navigate(`/create?t=${encodeURIComponent(state.transA)}&b=${encodeURIComponent(bookId)}&c=${chapter}&v=${encodeURIComponent(v)}`);
  }, [selectedVerses, navigate, state.transA, bookId, chapter]);

  // Favorites / highlights / notes act on that same selection, through the
  // floating toolbar VerseList parks next to it. Marks are keyed by
  // book-chapter-verse only, so both compare columns paint the same set — a
  // verse highlighted in one translation stays highlighted in the other.
  const { annotations } = useAnnotations();
  const marks = useMemo(() => chapterMarks(annotations, bookId, chapter), [annotations, bookId, chapter]);
  const [noteTarget, setNoteTarget] = useState<{ verse: number; text: string } | null>(null);

  const textOf = useCallback((verse: number) => colA.verses.find((v) => v.n === verse)?.text ?? "", [colA]);

  const copyVerses = useCallback(
    (numbers: number[]) => {
      const body = numbers.map((n) => `${n} ${textOf(n)}`.trim()).join(" ");
      const span = numbers.length > 1 ? `${numbers[0]}-${numbers[numbers.length - 1]}` : `${numbers[0]}`;
      copyText(`${bookLabel(bookId, state.locale)} ${chapter}:${span} — ${body}`);
      clearSelection();
    },
    [textOf, bookId, chapter, state.locale, clearSelection]
  );

  const marking: VerseMarking = useMemo(
    () => ({
      bookId,
      chapter,
      marks,
      onEditNote: (verse) => setNoteTarget({ verse, text: textOf(verse) }),
      onCopy: copyVerses,
      onCreateImage: createImage,
      onDone: clearSelection
    }),
    [bookId, chapter, marks, textOf, copyVerses, createImage, clearSelection]
  );


  const headingRef = `${bookLabel(bookId, state.locale)} ${chapter}`;
  const headingNote = compareEff
    ? ""
    : (passageA.data?.translationName ?? "") + (passageA.data?.translationNote ? ` · ${passageA.data.translationNote}` : "");

  return (
    <div className={styles.pane}>
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.headingRef}>{headingRef}</span>
          <span className={styles.headingNote}>{headingNote}</span>
        </div>
        {verseSelection.count > 0 && (
          <div className={styles.selectionBar}>
            <span className={styles.selectionCount}>{fillTemplate(t.selectedCount, { n: String(verseSelection.count) })}</span>
            <button type="button" className={styles.selectionClear} onClick={verseSelection.clear}>
              {t.clearSelection}
            </button>
          </div>
        )}
        <div className={styles.navButtons}>
          <button
            type="button"
            className={styles.navButton}
            onClick={toggleListen}
            title={speaking ? t.stop : t.listen}
            aria-label={speaking ? t.stop : t.listen}
            aria-pressed={speaking}
            disabled={!canListen && !speaking}
          >
            {speaking ? <StopIcon /> : <SpeakIcon />}
          </button>
          <button type="button" className={styles.navButton} onClick={() => goStep(-1)} title={t.prev}>
            <PrevIcon />
          </button>
          <button type="button" className={styles.navButton} onClick={() => goStep(1)} title={t.next}>
            <NextIcon />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className={styles.scrollArea}>
        <div className={styles.columns}>
          <ReaderColumn
            column={colA}
            marking={marking}
            onSpeakVerse={speakVerse}
            speakLabel={t.listenVerse}
            speakingVerse={activeVerse}
            isSelected={verseSelection.isSelected}
            onToggleSelect={verseSelection.toggle}
            selectLabel={t.createImage}
          />
          {compareEff && (
            <ReaderColumn
              column={colB}
              marking={marking}
              bordered
              onSpeakVerse={speakVerse}
              speakLabel={t.listenVerse}
              speakingVerse={activeVerse}
            />
          )}
        </div>
      </div>

      {noteTarget && (
        <NoteDialog
          verseRef={{ bookId, chapter, verse: noteTarget.verse }}
          verseText={noteTarget.text}
          onClose={() => {
            setNoteTarget(null);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}
