import type { JSX } from "react";
import styles from "./ChapterGrid.module.scss";

interface ChapterGridProps {
  chapterCount: number;
  activeChapter: number;
  onSelect: (chapter: number) => void;
}

export function ChapterGrid({ chapterCount, activeChapter, onSelect }: ChapterGridProps): JSX.Element {
  const chapters = Array.from({ length: chapterCount }, (_, i) => i + 1);
  return (
    <div className={styles.grid}>
      {chapters.map((n) => (
        <button
          key={n}
          type="button"
          className={styles.chapter}
          data-active={n === activeChapter}
          onClick={() => onSelect(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
