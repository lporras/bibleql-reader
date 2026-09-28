import { useEffect, useRef, type JSX, type KeyboardEvent, type MouseEvent } from "react";
import type { ColumnVerse } from "./ReaderColumn";
import { SpeakIcon } from "../icons";
import styles from "./VerseList.module.scss";

interface VerseListProps {
  verses: ColumnVerse[];
  onSpeakVerse?: (n: number, text: string) => void;
  speakLabel?: string;
  speakingVerse?: number | null;
  isSelected?: (n: number) => boolean;
  onToggleSelect?: (n: number, extend: boolean) => void;
  selectLabel?: string;
}

export function VerseList({
  verses,
  onSpeakVerse,
  speakLabel,
  speakingVerse,
  isSelected,
  onToggleSelect,
  selectLabel
}: VerseListProps): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the verse being read in view (block:"nearest" only scrolls when
  // it's actually out of sight, so it never fights the reader).
  useEffect(() => {
    if (speakingVerse == null) return;
    wrapRef.current
      ?.querySelector(`[data-verse="${speakingVerse}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [speakingVerse]);

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
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggleSelect(n, event.shiftKey);
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      {verses.map((v) => {
        const selected = isSelected?.(v.n) ?? false;
        return (
          <p
            key={v.n}
            data-verse={v.n}
            data-hl={v.hl}
            data-sel={selected ? "on" : "off"}
            className={
              onToggleSelect
                ? `${styles.verse} ${styles.selectable}${v.n === speakingVerse ? ` ${styles.speaking}` : ""}`
                : `${styles.verse}${v.n === speakingVerse ? ` ${styles.speaking}` : ""}`
            }
            tabIndex={onToggleSelect ? 0 : undefined}
            role={onToggleSelect ? "checkbox" : undefined}
            aria-checked={onToggleSelect ? selected : undefined}
            aria-label={onToggleSelect && selectLabel ? `${selectLabel} ${v.n}` : undefined}
            onClick={onToggleSelect ? (event) => handleVerseClick(event, v.n) : undefined}
            onKeyDown={onToggleSelect ? (event) => handleVerseKeyDown(event, v.n) : undefined}
          >
            <sup className={styles.verseNumber}>{v.n}</sup>
            {v.text}
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
    </div>
  );
}
