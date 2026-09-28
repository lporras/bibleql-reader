import type { JSX } from "react";
import { Spinner } from "../Spinner";
import { VerseList, type VerseMarking } from "./VerseList";
import styles from "./ReaderColumn.module.scss";

export interface ColumnVerse {
  n: number;
  text: string;
  hl: "on" | "off";
}

export interface ColumnView {
  label: string;
  showLabel: boolean;
  loading: boolean;
  notice: string;
  verses: ColumnVerse[];
}

interface ReaderColumnProps {
  column: ColumnView;
  marking?: VerseMarking;
  bordered?: boolean;
  onSpeakVerse?: (n: number, text: string) => void;
  speakLabel?: string;
  speakingVerse?: number | null;
  isSelected?: (n: number) => boolean;
  onToggleSelect?: (n: number, extend: boolean) => void;
  selectLabel?: string;
}

export function ReaderColumn({
  column,
  marking,
  bordered = false,
  onSpeakVerse,
  speakLabel,
  speakingVerse,
  isSelected,
  onToggleSelect,
  selectLabel
}: ReaderColumnProps): JSX.Element {
  return (
    <div className={bordered ? `${styles.column} ${styles.bordered}` : styles.column}>
      {column.showLabel && <div className={styles.label}>{column.label}</div>}
      {column.loading && (
        <div className={styles.spinnerWrap}>
          <Spinner />
        </div>
      )}
      {column.notice && <div className={styles.notice}>{column.notice}</div>}
      <VerseList
        verses={column.verses}
        marking={marking}
        onSpeakVerse={onSpeakVerse}
        speakLabel={speakLabel}
        speakingVerse={speakingVerse}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        selectLabel={selectLabel}
      />
    </div>
  );
}
