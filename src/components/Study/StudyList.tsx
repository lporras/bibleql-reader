import { useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { useStudies } from "../../state/StudiesContext";
import { byRecent } from "../../state/study";
import { fillTemplate } from "../../lib/format";
import { STR, type Locale } from "../../data/strings";
import { PlusIcon, TrashIcon } from "../icons";
import styles from "./StudyList.module.scss";

interface StudyListProps {
  locale: Locale;
  currentId: string | null;
}

export function StudyList({ locale, currentId }: StudyListProps): JSX.Element {
  const t = STR[locale];
  const navigate = useNavigate();
  const { studies, actions } = useStudies();
  // Deleting a whole sermon can't be undone, and the webview has no
  // confirm() dialog — so the first click arms the button, the second deletes.
  const [armed, setArmed] = useState<string | null>(null);
  const dateFmt = new Intl.DateTimeFormat(locale === "es" ? "es" : "en", { dateStyle: "medium" });

  function createStudy(): void {
    navigate(`/study/${actions.create(t.untitledStudy)}`);
  }

  function remove(id: string): void {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    const next = byRecent(studies).find((s) => s.id !== id);
    actions.remove(id);
    if (id === currentId) navigate(next ? `/study/${next.id}` : "/study", { replace: true });
  }

  return (
    <nav className={styles.list} aria-label={t.studies}>
      <div className={styles.header}>
        <span className={styles.label}>{t.studies}</span>
        <button type="button" className={styles.newButton} onClick={createStudy} title={t.newStudy} aria-label={t.newStudy}>
          <PlusIcon size={13} />
        </button>
      </div>
      <div className={styles.items}>
        {byRecent(studies).map((s) => (
          <div key={s.id} className={styles.item} data-current={s.id === currentId ? "yes" : "no"} onMouseLeave={() => setArmed(null)}>
            <button type="button" className={styles.open} onClick={() => navigate(`/study/${s.id}`)}>
              <span className={styles.itemTitle}>{s.title || t.untitledStudy}</span>
              <span className={styles.itemMeta}>
                {dateFmt.format(s.updatedAt)} · {fillTemplate(t.passagesN, { n: String(s.passages.length) })}
              </span>
            </button>
            <button
              type="button"
              className={styles.remove}
              data-armed={armed === s.id ? "yes" : "no"}
              onClick={() => remove(s.id)}
              title={armed === s.id ? t.confirmDelete : t.deleteStudy}
              aria-label={armed === s.id ? t.confirmDelete : t.deleteStudy}
            >
              <TrashIcon size={13} />
              {armed === s.id && <span>{t.confirmDelete}</span>}
            </button>
          </div>
        ))}
      </div>
    </nav>
  );
}
