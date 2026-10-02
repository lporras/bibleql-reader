import { useEffect, type JSX } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppState } from "../../state/AppStateContext";
import { useStudies } from "../../state/StudiesContext";
import { passageReference } from "../../state/study";
import { usePassage } from "../../queries/usePassage";
import { STR } from "../../data/strings";
import type { StudyPassage } from "../../types/study";
import { ArrowDownIcon, ArrowUpIcon, BookOpenIcon, QuoteIcon, TrashIcon } from "../icons";
import styles from "./PassageCard.module.scss";

interface PassageCardProps {
  studyId: string;
  passage: StudyPassage;
  /** The reader panel's narrow list: clamped text, open + remove only. */
  compact?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onInsert?(passage: StudyPassage, reference: string): void;
}

function textFor(verses: { verse: number; text: string }[], wanted: number[]): string {
  const keep = new Set(wanted);
  return verses
    .filter((v) => !wanted.length || keep.has(v.verse))
    .map((v) => v.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function PassageCard({ studyId, passage, compact = false, isFirst, isLast, onInsert }: PassageCardProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const navigate = useNavigate();
  const { panel } = useParams();
  const { actions } = useStudies();
  const reference = passageReference(passage, state.locale);

  // A passage the assistant recommended arrives as a bare reference. Fetch
  // its chapter (shared cache with the reader) and snapshot the text into
  // the study once, so it's there for the PDF and for offline reading.
  const needsText = !passage.text;
  const chapter = usePassage("a", passage.translationId, passage.bookId, passage.chapter, needsText);
  useEffect(() => {
    if (!needsText || !chapter.data) return;
    const text = textFor(chapter.data.verses, passage.verses);
    if (text) actions.setPassageText(studyId, passage.id, text);
  }, [needsText, chapter.data, passage.verses, passage.id, studyId, actions]);

  function openInReader(): void {
    const from = passage.verses[0];
    const to = passage.verses[passage.verses.length - 1];
    // From the study page there's no panel in the URL; land on the Study tab
    // so the way back to the study is right there.
    const qs = from ? `?from=${from}&to=${to}` : "";
    navigate(`/read/${passage.bookId}/${passage.chapter}/${panel ?? "study"}${qs}`);
  }

  return (
    <div className={compact ? `${styles.card} ${styles.compact}` : styles.card} data-passage={passage.id}>
      <div className={styles.head}>
        <button type="button" className={styles.ref} onClick={openInReader} title={t.openInReader}>
          {reference}
        </button>
        <span className={styles.translation}>{passage.translationId}</span>
        <span className={styles.spacer} />
        {!compact && (
          <>
            <button type="button" className={styles.tool} onClick={openInReader} title={t.openInReader} aria-label={t.openInReader}>
              <BookOpenIcon size={14} />
            </button>
            {onInsert && (
              <button
                type="button"
                className={styles.tool}
                onClick={() => onInsert(passage, reference)}
                title={t.insertIntoNotes}
                aria-label={t.insertIntoNotes}
                // Keep the editor's caret: a mousedown here would blur it first.
                onMouseDown={(event) => event.preventDefault()}
              >
                <QuoteIcon size={13} />
              </button>
            )}
            <button
              type="button"
              className={styles.tool}
              onClick={() => actions.movePassage(studyId, passage.id, -1)}
              disabled={isFirst}
              title={t.moveUp}
              aria-label={t.moveUp}
            >
              <ArrowUpIcon size={14} />
            </button>
            <button
              type="button"
              className={styles.tool}
              onClick={() => actions.movePassage(studyId, passage.id, 1)}
              disabled={isLast}
              title={t.moveDown}
              aria-label={t.moveDown}
            >
              <ArrowDownIcon size={14} />
            </button>
          </>
        )}
        <button
          type="button"
          className={`${styles.tool} ${styles.remove}`}
          onClick={() => actions.removePassage(studyId, passage.id)}
          title={t.removePassage}
          aria-label={t.removePassage}
        >
          <TrashIcon size={14} />
        </button>
      </div>
      {passage.text ? (
        <p className={styles.text}>{passage.text}</p>
      ) : (
        chapter.isFetching && <p className={styles.pending}>{t.textPending}</p>
      )}
      {passage.why && !compact && (
        <p className={styles.why} title={t.fromAssistant}>
          {passage.why}
        </p>
      )}
    </div>
  );
}
