import { useState, type JSX } from "react";
import { useParams } from "react-router-dom";
import { useAppState } from "../../state/AppStateContext";
import { STR } from "../../data/strings";
import { TranslationCombo } from "./TranslationCombo";
import { OfflineButton } from "./OfflineButton";
import { BookFilter } from "./BookFilter";
import { BookAccordion } from "./BookAccordion";
import styles from "./Sidebar.module.scss";

interface SidebarProps {
  // Rendered inside SidebarDrawer: fill the panel instead of being a fixed
  // column beside the reader.
  inDrawer?: boolean;
  onChapterSelect?: () => void;
}

export function Sidebar({ inDrawer = false, onChapterSelect }: SidebarProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const { bookId = "PSA", chapter: chapterParam } = useParams();
  const chapter = Number(chapterParam) || 1;
  const [bookFilter, setBookFilter] = useState("");

  return (
    <div className={inDrawer ? `${styles.sidebar} ${styles.inDrawer}` : styles.sidebar}>
      <div className={styles.translationBlock}>
        <div className={styles.sectionTitle}>{t.translation}</div>
        <TranslationCombo which="a" />
        <OfflineButton translationId={state.transA} />
        {state.compare && (
          <div className={styles.secondCombo}>
            <TranslationCombo which="b" />
            <OfflineButton translationId={state.transB} />
          </div>
        )}
      </div>

      <div className={styles.filterBlock}>
        <BookFilter value={bookFilter} onChange={setBookFilter} placeholder={t.findBook} />
      </div>

      <BookAccordion
        filter={bookFilter}
        bookId={bookId}
        chapter={chapter}
        locale={state.locale}
        onChapterSelect={onChapterSelect}
      />
    </div>
  );
}
