import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useAnnotations } from "../../state/AnnotationsContext";
import { STR } from "../../data/strings";
import { bookLabel } from "../../lib/refs";
import { verseKey, type VerseRef } from "../../types/annotations";
import styles from "./NoteDialog.module.scss";

interface NoteDialogProps {
  verseRef: VerseRef;
  verseText: string;
  onClose(): void;
}

export function NoteDialog({ verseRef, verseText, onClose }: NoteDialogProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const { annotations, actions } = useAnnotations();
  const existing = annotations[verseKey(verseRef)]?.note ?? "";
  const [draft, setDraft] = useState(existing);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
    areaRef.current?.setSelectionRange(existing.length, existing.length);
    // Opening on a different verse re-seeds the draft from that verse's note.
  }, [existing.length]);

  function save(): void {
    actions.setNote(verseRef, draft.trim());
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    // Enter alone stays a newline — notes are prose, not a one-line field.
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  }

  const reference = `${bookLabel(verseRef.bookId, state.locale)} ${verseRef.chapter}:${verseRef.verse}`;

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.dialog} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.reference}>{reference}</div>
        <p className={styles.excerpt}>{verseText}</p>
        <textarea
          ref={areaRef}
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.notePlaceholder}
          rows={7}
        />
        <div className={styles.actions}>
          {existing && (
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => {
                actions.setNote(verseRef, "");
                onClose();
              }}
            >
              {t.deleteNote}
            </button>
          )}
          <span className={styles.spacer} />
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" className={styles.saveButton} onClick={save}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
