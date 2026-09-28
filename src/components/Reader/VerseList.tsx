import { useEffect, useLayoutEffect, useRef, useState, type JSX, type KeyboardEvent, type MouseEvent } from "react";
import type { ColumnVerse } from "./ReaderColumn";
import { VerseActions } from "./VerseActions";
import { NoteIcon, SpeakIcon, StarIcon } from "../icons";
import type { VerseAnnotation, VerseRef } from "../../types/annotations";
import styles from "./VerseList.module.scss";

// Favorites / highlights / notes for this chapter. Marks are painted in every
// column (they're keyed by book/chapter/verse, not translation); the floating
// toolbar only appears in the column that owns the verse selection.
export interface VerseMarking {
  bookId: string;
  chapter: number;
  marks: Map<number, VerseAnnotation>;
  onEditNote(verse: number): void;
  onCopy(verses: number[]): void;
  onCreateImage(): void;
  onDone(): void;
}

interface VerseListProps {
  verses: ColumnVerse[];
  marking?: VerseMarking;
  onSpeakVerse?: (n: number, text: string) => void;
  speakLabel?: string;
  speakingVerse?: number | null;
  isSelected?: (n: number) => boolean;
  onToggleSelect?: (n: number, extend: boolean) => void;
  selectLabel?: string;
}

interface Anchor {
  top: number;
  above: boolean;
}

// Below this the toolbar wouldn't fit over the verse, so it flips underneath.
const TOOLBAR_CLEARANCE = 76;

export function VerseList({
  verses,
  marking,
  onSpeakVerse,
  speakLabel,
  speakingVerse,
  isSelected,
  onToggleSelect,
  selectLabel
}: VerseListProps): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const selected = isSelected ? verses.filter((v) => isSelected(v.n)).map((v) => v.n) : [];
  const selectedKey = selected.join(",");

  // Keep the verse being read in view (block:"nearest" only scrolls when
  // it's actually out of sight, so it never fights the reader).
  useEffect(() => {
    if (speakingVerse == null) return;
    wrapRef.current
      ?.querySelector(`[data-verse="${speakingVerse}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [speakingVerse]);

  // Park the floating toolbar against the selection. Measured from the DOM
  // rather than guessed, so it lands correctly however the verses wrapped —
  // `.wrap` is the positioned ancestor, so offsetTop is already relative to it.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const numbers = selectedKey ? selectedKey.split(",") : [];
    if (!marking || !numbers.length || !wrap) {
      setAnchor(null);
      return;
    }
    const first = wrap.querySelector<HTMLElement>(`[data-verse="${numbers[0]}"]`);
    const last = wrap.querySelector<HTMLElement>(`[data-verse="${numbers[numbers.length - 1]}"]`);
    if (!first || !last) {
      setAnchor(null);
      return;
    }
    const next: Anchor =
      first.offsetTop >= TOOLBAR_CLEARANCE
        ? { top: first.offsetTop, above: true }
        : { top: last.offsetTop + last.offsetHeight, above: false };
    // Reuse the previous object when nothing moved, so re-renders that don't
    // move the selection don't re-render the toolbar.
    setAnchor((prev) => (prev && prev.top === next.top && prev.above === next.above ? prev : next));
  }, [selectedKey, verses, marking]);

  // Clicking anywhere on the verse toggles it — no separate checkbox. A
  // plain click only fires on mouseup, so by then a text-selection drag
  // (or a double-click that selected a word) has already populated
  // window.getSelection(); bail in that case so selecting/copying verse
  // text still works exactly as before. Shift-click is the one exception:
  // the browser's own shift-click-to-extend-selection behavior fires
  // first (extending from wherever the caret last was, possibly a
  // previous verse) and leaves a real, if unwanted, text selection — but
  // shift-click is unambiguously "extend the verse range" here, so toggle
  // regardless and then clear the incidental native selection it made.
  function handleVerseClick(event: MouseEvent<HTMLParagraphElement>, n: number): void {
    if (!onToggleSelect) return;
    if (!event.shiftKey && window.getSelection()?.toString()) return;
    onToggleSelect(n, event.shiftKey);
    if (event.shiftKey) window.getSelection()?.removeAllRanges();
  }

  function handleVerseKeyDown(event: KeyboardEvent<HTMLParagraphElement>, n: number): void {
    if (!onToggleSelect) return;
    // Enter/Space on a button inside the verse (note, listen) is that
    // button's own activation, not a verse toggle.
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggleSelect(n, event.shiftKey);
  }

  const selectedRefs: VerseRef[] = marking
    ? selected.map((verse) => ({ bookId: marking.bookId, chapter: marking.chapter, verse }))
    : [];

  return (
    <div ref={wrapRef} className={styles.wrap}>
      {verses.map((v) => {
        const verseSelected = isSelected?.(v.n) ?? false;
        const mark = marking?.marks.get(v.n);
        return (
          <p
            key={v.n}
            data-verse={v.n}
            data-hl={v.hl}
            data-sel={verseSelected ? "on" : "off"}
            data-mark={mark?.color ?? undefined}
            className={
              onToggleSelect
                ? `${styles.verse} ${styles.selectable}${v.n === speakingVerse ? ` ${styles.speaking}` : ""}`
                : `${styles.verse}${v.n === speakingVerse ? ` ${styles.speaking}` : ""}`
            }
            tabIndex={onToggleSelect ? 0 : undefined}
            role={onToggleSelect ? "checkbox" : undefined}
            aria-checked={onToggleSelect ? verseSelected : undefined}
            aria-label={onToggleSelect && selectLabel ? `${selectLabel} ${v.n}` : undefined}
            onClick={onToggleSelect ? (event) => handleVerseClick(event, v.n) : undefined}
            onKeyDown={onToggleSelect ? (event) => handleVerseKeyDown(event, v.n) : undefined}
          >
            <sup className={styles.verseNumber}>{v.n}</sup>
            {v.text}
            {mark?.favorite && (
              <span className={styles.favoriteBadge} aria-hidden="true">
                <StarIcon size={13} filled />
              </span>
            )}
            {mark?.note && marking && (
              <button
                type="button"
                className={styles.noteBadge}
                title={mark.note}
                onClick={(event) => {
                  event.stopPropagation();
                  marking.onEditNote(v.n);
                }}
              >
                <NoteIcon size={13} />
              </button>
            )}
            {onSpeakVerse && (
              <button
                type="button"
                className={styles.verseSpeak}
                title={speakLabel}
                aria-label={speakLabel ? `${speakLabel} ${v.n}` : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  onSpeakVerse(v.n, v.text);
                }}
              >
                <SpeakIcon size={12} />
              </button>
            )}
          </p>
        );
      })}

      {marking && anchor && selectedRefs.length > 0 && (
        <VerseActions
          refs={selectedRefs}
          top={anchor.top}
          above={anchor.above}
          onEditNote={() => marking.onEditNote(selected[0])}
          onCopy={() => marking.onCopy(selected)}
          onCreateImage={marking.onCreateImage}
          onDone={marking.onDone}
        />
      )}
    </div>
  );
}
