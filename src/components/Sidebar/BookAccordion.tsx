import { useState, type JSX } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NEW_TESTAMENT_BOOKS, OLD_TESTAMENT_BOOKS } from "../../data/books";
import { STR, type Locale } from "../../data/strings";
import type { Book } from "../../types/bible";
import { ChevronRightIcon } from "../icons";
import { ChapterGrid } from "./ChapterGrid";
import styles from "./BookAccordion.module.scss";

interface BookAccordionProps {
  filter: string;
  bookId: string;
  chapter: number;
  locale: Locale;
}

export function BookAccordion({ filter, bookId, chapter, locale }: BookAccordionProps): JSX.Element {
  const t = STR[locale];
  const navigate = useNavigate();
  const { panel = "ai" } = useParams();
  const [openOld, setOpenOld] = useState(true);
  const [openNew, setOpenNew] = useState(true);

  const q = filter.trim().toLowerCase();
  const matches = (b: Book): boolean => !q || b.nameEn.toLowerCase().includes(q) || b.nameEs.toLowerCase().includes(q);

  const sections = [
    {
      key: "old",
      label: t.oldTestament,
      books: OLD_TESTAMENT_BOOKS.filter(matches),
      open: !!q || openOld,
      onToggle: () => setOpenOld((v) => !v)
    },
    {
      key: "new",
      label: t.newTestament,
      books: NEW_TESTAMENT_BOOKS.filter(matches),
      open: !!q || openNew,
      onToggle: () => setOpenNew((v) => !v)
    }
  ].filter((sec) => sec.books.length > 0);

  function selectBook(id: string, targetChapter: number): void {
    navigate(`/read/${id}/${targetChapter}/${panel}`);
  }

  return (
    <div className={styles.list}>
      {sections.map((sec) => (
        <div key={sec.key} className={styles.section}>
          <button type="button" className={styles.sectionHeader} onClick={sec.onToggle}>
            <ChevronRightIcon className={styles.chevron} data-chev={sec.open ? "open" : "shut"} />
            <span className={styles.sectionLabel}>{sec.label}</span>
            <span className={styles.sectionCount}>{sec.books.length}</span>
          </button>
          {sec.open && (
            <div className={styles.books}>
              {sec.books.map((b) => {
                const active = b.id === bookId;
                return (
                  <div key={b.id}>
                    <button
                      type="button"
                      className={styles.bookButton}
                      data-active={active}
                      onClick={() => selectBook(b.id, active ? chapter : 1)}
                    >
                      <span>{locale === "es" ? b.nameEs : b.nameEn}</span>
                      <span className={styles.bookChapters}>{b.chapters}</span>
                    </button>
                    {active && (
                      <ChapterGrid chapterCount={b.chapters} activeChapter={chapter} onSelect={(n) => selectBook(b.id, n)} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
