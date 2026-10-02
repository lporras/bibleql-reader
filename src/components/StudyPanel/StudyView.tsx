import type { JSX } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../state/AppStateContext";
import { useStudies } from "../../state/StudiesContext";
import { byRecent } from "../../state/study";
import { fillTemplate } from "../../lib/format";
import { STR } from "../../data/strings";
import { PassageCard } from "../Study/PassageCard";
import { PlusIcon } from "../icons";
import styles from "./StudyView.module.scss";

interface StudyViewProps {
  active: boolean;
}

// The reader-side view of the current study: which study "Add to study"
// feeds, and what's been collected so far. Writing the study itself happens
// on the study page (routes/StudyPage.tsx) — this tab is for gathering
// while reading.
export function StudyView({ active }: StudyViewProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const navigate = useNavigate();
  const { studies, active: study, actions } = useStudies();

  function createAndOpen(): void {
    const id = actions.create(t.untitledStudy);
    navigate(`/study/${id}`);
  }

  return (
    <div className={styles.body} hidden={!active}>
      <div className={styles.header}>
        {studies.length > 0 ? (
          <label className={styles.picker}>
            <span className={styles.pickerLabel}>{t.currentStudy}</span>
            <select value={study?.id ?? ""} onChange={(event) => actions.setActive(event.target.value)}>
              {!study && <option value="">—</option>}
              {byRecent(studies).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || t.untitledStudy}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className={styles.spacer} />
        )}
        <button type="button" className={styles.newButton} onClick={createAndOpen} title={t.newStudy}>
          <PlusIcon size={13} />
          <span>{t.newStudy}</span>
        </button>
      </div>

      <div className={styles.content}>
        {!study ? (
          <p className={styles.notice}>{t.studyIdle}</p>
        ) : (
          <>
            <button type="button" className={styles.title} onClick={() => navigate(`/study/${study.id}`)}>
              {study.title || t.untitledStudy}
            </button>
            <div className={styles.meta}>
              <span>{fillTemplate(t.passagesN, { n: String(study.passages.length) })}</span>
              <button type="button" className={styles.openButton} onClick={() => navigate(`/study/${study.id}`)}>
                {t.openStudy}
              </button>
            </div>
            {study.passages.length === 0 && <p className={styles.notice}>{t.studyIdle}</p>}
            {study.passages.map((p) => (
              <PassageCard key={p.id} studyId={study.id} passage={p} compact />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
