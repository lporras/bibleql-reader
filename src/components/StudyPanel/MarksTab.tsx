import { useMemo, useState, type JSX } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppState } from "../../state/AppStateContext";
import { useAnnotations } from "../../state/AnnotationsContext";
import { STR } from "../../data/strings";
import { BOOKS } from "../../data/books";
import { bookLabel } from "../../lib/refs";
import type { VerseAnnotation } from "../../types/annotations";
import { NoteIcon, StarIcon, TrashIcon } from "../icons";
import styles from "./MarksTab.module.scss";

interface MarksTabProps {
  active: boolean;
}

const FILTERS = ["all", "favorites", "highlights", "notes"] as const;
type Filter = (typeof FILTERS)[number];

const BOOK_ORDER = new Map(BOOKS.map((book, index) => [book.id, index]));

function matches(mark: VerseAnnotation, filter: Filter): boolean {
  if (filter === "favorites") return mark.favorite;
  if (filter === "highlights") return mark.color !== null;
  if (filter === "notes") return mark.note.trim() !== "";
  return true;
}

export function MarksTab({ active }: MarksTabProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const navigate = useNavigate();
  const { panel = "ai" } = useParams();
  const { annotations, actions } = useAnnotations();
  const [filter, setFilter] = useState<Filter>("all");

  // Canonical order — the same order the sidebar lists books in, so the list
  // reads like a table of contents of everything the reader has marked.
  const rows = useMemo(() => {
    return Object.values(annotations)
      .filter((mark) => matches(mark, filter))
      .sort((a, b) => {
        const byBook = (BOOK_ORDER.get(a.bookId) ?? 0) - (BOOK_ORDER.get(b.bookId) ?? 0);
        if (byBook !== 0) return byBook;
        if (a.chapter !== b.chapter) return a.chapter - b.chapter;
        return a.verse - b.verse;
      });
  }, [annotations, filter]);

  const labels: Record<Filter, string> = {
    all: t.allMarks,
    favorites: t.favorites,
    highlights: t.highlights,
    notes: t.notes
  };

  function open(mark: VerseAnnotation): void {
    navigate(`/read/${mark.bookId}/${mark.chapter}/${panel}?from=${mark.verse}&to=${mark.verse}`);
  }

  return (
    <div className={styles.body} hidden={!active}>
      <div className={styles.filters}>
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.filter}
            data-active={filter === id}
            onClick={() => setFilter(id)}
          >
            {labels[id]}
          </button>
        ))}
      </div>

      <div className={styles.results}>
        {rows.length === 0 && (
          <div className={styles.notice}>{Object.keys(annotations).length === 0 ? t.marksIdle : t.noMarks}</div>
        )}
        {rows.map((mark) => (
          <div key={`${mark.bookId}.${mark.chapter}.${mark.verse}`} className={styles.mark}>
            <div className={styles.markHead}>
              <button type="button" className={styles.markRef} onClick={() => open(mark)}>
                {bookLabel(mark.bookId, state.locale)} {mark.chapter}:{mark.verse}
              </button>
              {mark.color && (
                <span
                  className={styles.dot}
                  style={{ ["--mark-pen" as string]: `var(--hl-${mark.color})` }}
                  aria-label={mark.color}
                />
              )}
              {mark.favorite && (
                <span className={styles.flag} aria-label={t.favorite}>
                  <StarIcon size={12} filled />
                </span>
              )}
              {mark.note && (
                <span className={styles.flag} aria-label={t.note}>
                  <NoteIcon size={12} />
                </span>
              )}
              <span className={styles.spacer} />
              <button
                type="button"
                className={styles.remove}
                title={t.clearMarks}
                aria-label={t.clearMarks}
                onClick={() => actions.clear([mark])}
              >
                <TrashIcon size={13} />
              </button>
            </div>
            {mark.note && <div className={styles.markNote}>{mark.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
