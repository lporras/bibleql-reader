import { useState, type JSX } from "react";
import { STR, type Locale } from "../../../data/strings";
import { getPlatform } from "../../../platform";
import { renderProject, type ExportFormat } from "../rendering/renderProject";
import { buildExportFilename } from "../lib/filename";
import type { ImageCreatorProject } from "../model/types";
import styles from "./ExportControls.module.scss";

interface ExportControlsProps {
  locale: Locale;
  project: ImageCreatorProject;
}

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "done"; message: string } | { kind: "error"; message: string };

export function ExportControls({ locale, project }: ExportControlsProps): JSX.Element {
  const t = STR[locale];
  const [format, setFormat] = useState<ExportFormat>("png");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSave(): Promise<void> {
    setStatus({ kind: "busy" });
    try {
      const blob = await renderProject(project, { format });
      const data = new Uint8Array(await blob.arrayBuffer());
      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const suggestedName = buildExportFilename(project, format === "png" ? "png" : "jpg");
      const result = await getPlatform().saveImage({ data, suggestedName, mimeType });
      setStatus(result.canceled ? { kind: "idle" } : { kind: "done", message: t.saved });
    } catch {
      setStatus({ kind: "error", message: t.saveError });
    }
  }

  async function handleCopy(): Promise<void> {
    setStatus({ kind: "busy" });
    try {
      // Clipboard images are always PNG here regardless of the export
      // format picker — pasteable clipboard image formats are much more
      // narrowly supported than save-to-disk formats, and PNG is safe
      // everywhere.
      const blob = await renderProject(project, { format: "png" });
      const data = new Uint8Array(await blob.arrayBuffer());
      await getPlatform().copyImageToClipboard(data, "image/png");
      setStatus({ kind: "done", message: t.copied });
    } catch {
      setStatus({ kind: "error", message: t.copyError });
    }
  }

  const busy = status.kind === "busy";

  return (
    <div className={styles.wrap} data-tauri-drag-region="false">
      <label className={styles.formatField}>
        <span>{t.format}</span>
        <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
        </select>
      </label>

      <button type="button" className={styles.button} onClick={handleCopy} disabled={busy}>
        {t.copyImage}
      </button>

      <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={busy}>
        {busy ? t.saving : t.saveImage}
      </button>

      {(status.kind === "done" || status.kind === "error") && (
        <span className={status.kind === "error" ? styles.statusError : styles.statusOk}>{status.message}</span>
      )}
    </div>
  );
}
