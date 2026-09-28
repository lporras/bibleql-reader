import { useState, type JSX } from "react";
import { useParams } from "react-router-dom";
import { useAppState } from "../../state/AppStateContext";
import { STR } from "../../data/strings";
import { TranslationCombo } from "./TranslationCombo";
import { BookFilter } from "./BookFilter";
import { BookAccordion } from "./BookAccordion";
import styles from "./Sidebar.module.scss";

export function Sidebar(): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const { bookId = "PSA", chapter: chapterParam } = useParams();
  const chapter = Number(chapterParam) || 1;
  const [bookFilter, setBookFilter] = useState("");

  return (
    <div className={styles.sidebar}>
      <div className={styles.translationBlock}>
        <div className={styles.sectionTitle}>{t.translation}</div>
        <TranslationCombo which="a" />
        {state.compare && (
          <div className={styles.secondCombo}>
            <TranslationCombo which="b" />
          </div>
        )}
      </div>

      <div className={styles.filterBlock}>
        <BookFilter value={bookFilter} onChange={setBookFilter} placeholder={t.findBook} />
      </div>

      <BookAccordion filter={bookFilter} bookId={bookId} chapter={chapter} locale={state.locale} />
    </div>
  );
}
