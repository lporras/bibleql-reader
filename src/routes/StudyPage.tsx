import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAppState } from "../state/AppStateContext";
import { useStudies } from "../state/StudiesContext";
import { byRecent } from "../state/study";
import { useViewportWidth } from "../hooks/useViewportWidth";
import { STR } from "../data/strings";
import { StudyTopBar } from "../components/Study/StudyTopBar";
import { StudyList } from "../components/Study/StudyList";
import { StudyEditor, type StudyEditorHandle } from "../components/Study/StudyEditor";
import { PassageCard } from "../components/Study/PassageCard";
import { AIAssistant } from "../components/StudyPanel/AIAssistant";
import { KeyDialog } from "../components/KeyDialog";
import type { StudyPassage } from "../types/study";
import styles from "./StudyPage.module.scss";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// `/study` on its own: open the study "Add to study" is feeding, else the
// most recently edited one, else start a fresh one.
export function StudyRedirect(): JSX.Element | null {
  const { state } = useAppState();
  const { studies, active, actions } = useStudies();
  const navigate = useNavigate();
  const target = active ?? byRecent(studies)[0] ?? null;
  // StrictMode runs effects twice in dev; without this it creates two studies.
  const created = useRef(false);

  useEffect(() => {
    if (target || created.current) return;
    created.current = true;
    navigate(`/study/${actions.create(STR[state.locale].untitledStudy)}`, { replace: true });
  }, [target, actions, navigate, state.locale]);

  return target ? <Navigate to={`/study/${target.id}`} replace /> : null;
}

// Where a study is written: title, rich-text notes, the collected passages,
// with the assistant alongside. Like the reader, every child pulls its own
// state; this route only lays them out.
export function StudyPage(): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { studies, active, actions } = useStudies();
  const study = studies.find((s) => s.id === id) ?? null;
  const editorRef = useRef<StudyEditorHandle>(null);

  const vw = useViewportWidth();
  const [aiOpen, setAiOpen] = useState(() => vw >= 1000);
  const showList = vw >= 1100;
  const showAi = aiOpen && vw >= 760;

  // The study being written is the one "Add to study" should feed — so that
  // jumping to the reader from here and adding verses lands them back here.
  useEffect(() => {
    if (study && active?.id !== study.id) actions.setActive(study.id);
  }, [study, active, actions]);

  const studyId = study?.id;
  const onBodyChange = useCallback(
    (html: string) => {
      if (studyId) actions.update(studyId, { descriptionHtml: html });
    },
    [studyId, actions]
  );

  function insertPassage(passage: StudyPassage, reference: string): void {
    const body = passage.text ? `<p>${escapeHtml(passage.text)}</p>` : "";
    editorRef.current?.insertHtml(`<blockquote>${body}<p><strong>${escapeHtml(reference)}</strong></p></blockquote><p></p>`);
  }

  return (
    <div className={styles.shell}>
      <StudyTopBar locale={state.locale} study={study} aiOpen={showAi} onToggleAi={() => setAiOpen(!showAi)} />
      <div className={styles.body}>
        {showList && <StudyList locale={state.locale} currentId={study?.id ?? null} />}

        <main className={styles.page}>
          {!study ? (
            <div className={styles.column}>
              <p className={styles.notice}>{t.studyNotFound}</p>
            </div>
          ) : (
            <div className={styles.column}>
              {!showList && studies.length > 1 && (
                <select className={styles.switcher} value={study.id} onChange={(event) => navigate(`/study/${event.target.value}`)}>
                  {byRecent(studies).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || t.untitledStudy}
                    </option>
                  ))}
                </select>
              )}
              <input
                className={styles.title}
                value={study.title}
                placeholder={t.studyTitlePlaceholder}
                aria-label={t.studyTitlePlaceholder}
                onChange={(event) => actions.update(study.id, { title: event.target.value })}
              />
              <StudyEditor
                key={study.id}
                ref={editorRef}
                initialHtml={study.descriptionHtml}
                placeholder={t.studyBodyPlaceholder}
                labels={t}
                onChange={onBodyChange}
              />

              <section className={styles.passages} aria-label={t.passages}>
                <h2 className={styles.sectionLabel}>{t.passages}</h2>
                {study.passages.length === 0 && <p className={styles.notice}>{t.studyIdle}</p>}
                {study.passages.map((p, i) => (
                  <PassageCard
                    key={p.id}
                    studyId={study.id}
                    passage={p}
                    isFirst={i === 0}
                    isLast={i === study.passages.length - 1}
                    onInsert={insertPassage}
                  />
                ))}
              </section>
            </div>
          )}
        </main>

        {showAi && (
          <aside className={styles.assistant} aria-label={t.assistant}>
            <AIAssistant active studyTitle={study?.title} suggestions={[t.ss1, t.ss2, t.ss3]} />
          </aside>
        )}
      </div>
      {state.keyDialogOpen && <KeyDialog />}
    </div>
  );
}
