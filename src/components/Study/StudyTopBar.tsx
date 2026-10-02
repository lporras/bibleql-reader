import { useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { IS_MAC } from "../../platform/host";
import { getPlatform } from "../../platform";
import { readLastLocation } from "../../state/persist";
import { renderStudyPdf, studyPdfFilename } from "../../lib/pdf/studyPdf";
import { STR, type Locale } from "../../data/strings";
import type { Study } from "../../types/study";
import { DownloadIcon, PrevIcon, StudyIcon } from "../icons";
import styles from "./StudyTopBar.module.scss";

interface StudyTopBarProps {
  locale: Locale;
  study: Study | null;
  aiOpen: boolean;
  onToggleAi(): void;
}

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "error" };

// Same frameless-window handling as CreatorTopBar (drag region + macOS
// traffic-light spacer), for the same reason: TitleBar is wired to reader
// concerns this route doesn't have.
export function StudyTopBar({ locale, study, aiOpen, onToggleAi }: StudyTopBarProps): JSX.Element {
  const t = STR[locale];
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function backToReader(): void {
    const last = readLastLocation();
    navigate(last ? `/read/${last.bookId}/${last.chapter}/study` : "/");
  }

  async function exportPdf(): Promise<void> {
    if (!study) return;
    setStatus({ kind: "busy" });
    try {
      const data = renderStudyPdf(study, locale);
      const result = await getPlatform().saveDocument({
        data,
        suggestedName: studyPdfFilename(study.title, t.untitledStudy),
        mimeType: "application/pdf"
      });
      setStatus(result.canceled ? { kind: "idle" } : { kind: "done" });
    } catch {
      setStatus({ kind: "error" });
    }
  }

  return (
    <div className={styles.bar} data-tauri-drag-region="deep">
      {IS_MAC && <div className={styles.trafficLightsSpacer} />}

      <button type="button" className={styles.button} onClick={backToReader} title={t.backToReader}>
        <PrevIcon size={13} />
        {t.backToReader}
      </button>

      <span className={styles.title}>{study ? study.title || t.untitledStudy : t.studies}</span>

      <div className={styles.right}>
        {status.kind === "done" && <span className={styles.statusOk}>{t.exported}</span>}
        {status.kind === "error" && <span className={styles.statusError}>{t.exportError}</span>}
        <button
          type="button"
          className={styles.button}
          data-active={aiOpen}
          onClick={onToggleAi}
          title={t.assistant}
        >
          <StudyIcon size={14} />
          <span>{t.assistant}</span>
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={exportPdf}
          disabled={!study || status.kind === "busy"}
          title={t.exportPdf}
        >
          <DownloadIcon size={14} />
          {status.kind === "busy" ? t.exporting : t.exportPdf}
        </button>
      </div>
    </div>
  );
}
