import { useEffect, useState, type JSX } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useAnnotations } from "../../state/AnnotationsContext";
import { STR } from "../../data/strings";
import { HIGHLIGHT_COLORS, verseKey, type HighlightColor, type VerseRef } from "../../types/annotations";
import { ChevronRightIcon, CopyIcon, HighlightIcon, ImageIcon, MoreIcon, NoteIcon, StarIcon, TrashIcon } from "../icons";
import styles from "./VerseActions.module.scss";

interface VerseActionsProps {
  refs: VerseRef[];
  // Placement within the verse column, resolved by VerseList from the DOM.
  top: number;
  above: boolean;
  onEditNote(): void;
  onCopy(): void;
  onCreateImage(): void;
  onDone(): void;
}

type Popover = "none" | "colors" | "more";

export function VerseActions({ refs, top, above, onEditNote, onCopy, onCreateImage, onDone }: VerseActionsProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const { annotations, actions } = useAnnotations();
  const [popover, setPopover] = useState<Popover>("none");

  const marks = refs.map((ref) => annotations[verseKey(ref)]);
  const allFavorite = marks.every((m) => m?.favorite);
  // With a mixed selection there is no single current color, so no swatch reads
  // as active — picking one applies it to the whole range.
  const colors = new Set(marks.map((m) => m?.color ?? null));
  const currentColor = colors.size === 1 ? [...colors][0] : null;
  const hasAnyMark = marks.some((m) => m);
  const singleRef = refs.length === 1 ? refs[0] : null;
  const noteText = singleRef ? (annotations[verseKey(singleRef)]?.note ?? "") : "";

  // A new selection starts with both popovers closed.
  useEffect(() => {
    setPopover("none");
  }, [refs.map(verseKey).join(",")]);

  function pickColor(color: HighlightColor): void {
    actions.setColor(refs, currentColor === color ? null : color);
    setPopover("none");
  }

  return (
    <div
      data-verse-actions
      data-above={above ? "yes" : "no"}
      className={styles.root}
      style={{ top, transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)" }}
    >
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.action}
          data-on={noteText ? "yes" : "no"}
          onClick={onEditNote}
          // A note belongs to one verse; a range would have nowhere to put it.
          disabled={!singleRef}
          title={!singleRef ? undefined : noteText ? t.editNote : t.addNote}
        >
          <NoteIcon size={17} />
          <span>{noteText ? t.editNote : t.addNote}</span>
        </button>

        <span className={styles.divider} />

        <button
          type="button"
          className={styles.action}
          data-on={allFavorite ? "yes" : "no"}
          onClick={() => actions.toggleFavorite(refs)}
          title={allFavorite ? t.unfavorite : t.favorite}
        >
          <StarIcon size={17} filled={allFavorite} />
          <span>{t.favorite}</span>
        </button>

        <span className={styles.divider} />

        <button
          type="button"
          className={`${styles.action} ${styles.withChevron}`}
          data-on={currentColor ? "yes" : "no"}
          onClick={() => setPopover(popover === "colors" ? "none" : "colors")}
          aria-expanded={popover === "colors"}
          title={t.highlight}
        >
          <HighlightIcon size={17} />
          <span>{t.highlight}</span>
          <span className={styles.chevron}>
            <ChevronRightIcon size={10} />
          </span>
        </button>

        <span className={styles.divider} />

        <button type="button" className={styles.action} onClick={onCreateImage} title={t.createImage}>
          <ImageIcon size={17} />
          <span>{t.createImage}</span>
        </button>

        <span className={styles.divider} />

        <button
          type="button"
          className={styles.action}
          onClick={() => setPopover(popover === "more" ? "none" : "more")}
          aria-expanded={popover === "more"}
          title={t.moreActions}
        >
          <MoreIcon size={17} />
          <span>{t.moreActions}</span>
        </button>
      </div>

      {popover === "colors" && (
        <div className={`${styles.popover} ${styles.colorPopover}`}>
          <div className={styles.popoverTitle}>{t.highlightColor}</div>
          <div className={styles.swatches}>
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={styles.swatch}
                style={{ ["--mark-pen" as string]: `var(--hl-${color})` }}
                data-on={currentColor === color ? "yes" : "no"}
                aria-label={color}
                onClick={() => pickColor(color)}
              />
            ))}
          </div>
          <div className={styles.popoverSeparator} />
          <button
            type="button"
            className={styles.popoverItem}
            disabled={!currentColor && colors.size === 1}
            onClick={() => {
              actions.setColor(refs, null);
              setPopover("none");
            }}
          >
            <TrashIcon size={15} />
            {t.removeHighlight}
          </button>
        </div>
      )}

      {popover === "more" && (
        <div className={`${styles.popover} ${styles.morePopover}`}>
          <button
            type="button"
            className={styles.popoverItem}
            onClick={() => {
              onCopy();
              setPopover("none");
            }}
          >
            <CopyIcon size={15} />
            {t.copyVerse}
          </button>
          <button
            type="button"
            className={styles.popoverItem}
            disabled={!hasAnyMark}
            onClick={() => {
              actions.clear(refs);
              setPopover("none");
              onDone();
            }}
          >
            <TrashIcon size={15} />
            {t.clearMarks}
          </button>
        </div>
      )}
    </div>
  );
}
