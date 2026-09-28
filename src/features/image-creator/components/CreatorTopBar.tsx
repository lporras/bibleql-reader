import type { JSX } from "react";
import { useNavigate } from "react-router-dom";
import { IS_MAC } from "../../../platform/host";
import { STR, type Locale } from "../../../data/strings";
import { PrevIcon } from "../../../components/icons";
import { canvasForPreset, PRESET_LABELS, SOCIAL_PRESETS } from "../model/presets";
import type { CanvasSettings, ImageCreatorProject } from "../model/types";
import { ExportControls } from "./ExportControls";
import styles from "./CreatorTopBar.module.scss";

interface CreatorTopBarProps {
  locale: Locale;
  project: ImageCreatorProject;
  onChangeCanvas(canvas: CanvasSettings): void;
}

// A slim copy of TitleBar's frameless-window handling (the macOS drag
// region + traffic-light spacer), not a reuse of TitleBar itself — that component is
// wired to reader-specific concerns (ref search, compare/study toggles)
// this route doesn't have.
export function CreatorTopBar({ locale, project, onChangeCanvas }: CreatorTopBarProps): JSX.Element {
  const t = STR[locale];
  const navigate = useNavigate();

  return (
    <div className={styles.bar} data-tauri-drag-region="deep">
      {IS_MAC && <div className={styles.trafficLightsSpacer} />}

      <button type="button" className={styles.backButton} onClick={() => navigate("/")} title={t.creatorBack}>
        <PrevIcon size={13} />
        {t.creatorBack}
      </button>

      <span className={styles.title}>{project.name || t.creatorTitle}</span>

      <div className={styles.right}>
        <label className={styles.presetField}>
          <span>{t.preset}</span>
          <select
            value={project.canvas.preset}
            onChange={(event) => onChangeCanvas(canvasForPreset(event.target.value as CanvasSettings["preset"]))}
          >
            {(Object.keys(SOCIAL_PRESETS) as (keyof typeof SOCIAL_PRESETS)[]).map((preset) => (
              <option key={preset} value={preset}>
                {PRESET_LABELS[preset]}
              </option>
            ))}
          </select>
        </label>

        <span className={styles.divider} />

        <ExportControls locale={locale} project={project} />
      </div>
    </div>
  );
}
