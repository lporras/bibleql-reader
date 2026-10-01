import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useOfflineDownloads } from "../../state/OfflineDownloadsContext";
import { useOfflineInstalled } from "../../queries/useOfflineInstalled";
import { useOfflineAvailability } from "../../queries/useOfflineAvailability";
import { offlineBible } from "../../platform/offline";
import { formatBytes, installErrorKind, offlineStatus, progressPercent } from "../../lib/offline";
import { fillTemplate } from "../../lib/format";
import { STR } from "../../data/strings";
import { CloseIcon, DownloadIcon, OfflineReadyIcon, TrashIcon } from "../icons";
import { Spinner } from "../Spinner";
import styles from "./OfflineButton.module.scss";

interface OfflineButtonProps {
  translationId: string;
  /** "row" sits under a translation picker; "icon" is the compact
   * title-bar form used when the sidebar is folded away. */
  variant?: "row" | "icon";
}

// Download / progress / installed control for one translation. Renders
// nothing outside a Tauri shell, or when BibleQL publishes no package for
// the translation and none is installed.
export function OfflineButton({ translationId, variant = "row" }: OfflineButtonProps): JSX.Element | null {
  const { state } = useAppState();
  const t = STR[state.locale];
  const { byId } = useOfflineInstalled();
  const availability = useOfflineAvailability();
  const { downloads, download, cancel, remove, dismiss } = useOfflineDownloads();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent): void {
      if (!wrapRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (!offlineBible.canDownload()) return null;

  const installed = byId.get(translationId);
  const info = availability.get(translationId);
  const pkg = info?.offlineDownloadable ? info.offlinePackage : null;
  const status = offlineStatus(installed, info);
  const job = downloads[translationId];
  const compact = variant === "icon";

  let body: JSX.Element | null = null;

  if (job?.status === "downloading") {
    const installing = job.progress?.phase === "install";
    const pct = job.progress ? progressPercent(job.progress) : null;
    const label = installing
      ? t.offlineInstalling
      : fillTemplate(t.offlineDownloading, { p: pct === null ? "" : `${pct}%` }).trim();
    body = (
      <button
        type="button"
        className={styles.trigger}
        data-state="downloading"
        onClick={() => !installing && cancel(translationId)}
        title={installing ? label : `${label} — ${t.offlineCancel}`}
        aria-label={installing ? label : `${label} — ${t.offlineCancel}`}
      >
        <span
          className={styles.ring}
          data-indeterminate={installing || pct === null}
          style={{ "--p": `${pct ?? 0}%` } as CSSProperties}
        />
        {!compact && <span className={styles.label}>{label}</span>}
      </button>
    );
  } else if (job?.status === "removing") {
    body = (
      <button type="button" className={styles.trigger} disabled title={t.offlineRemoving}>
        <Spinner />
        {!compact && <span className={styles.label}>{t.offlineRemoving}</span>}
      </button>
    );
  } else if (job?.status === "error") {
    const message = installErrorKind(job.message) === "checksum" ? t.offlineChecksum : job.message;
    body = compact ? (
      <button
        type="button"
        className={styles.trigger}
        data-state="error"
        title={message}
        aria-label={message}
        onClick={() => (pkg ? download(translationId, pkg) : dismiss(translationId))}
      >
        <DownloadIcon size={14} />
      </button>
    ) : (
      <div className={styles.error} role="alert">
        <span className={styles.errorText}>{message}</span>
        {pkg && (
          <button type="button" className={styles.link} onClick={() => download(translationId, pkg)}>
            {t.offlineRetry}
          </button>
        )}
        <button type="button" className={styles.dismiss} onClick={() => dismiss(translationId)} aria-label={t.close}>
          <CloseIcon size={11} />
        </button>
      </div>
    );
  } else if (status === "available" && pkg) {
    const label = fillTemplate(t.offlineDownload, { s: formatBytes(pkg.sizeBytes) });
    body = (
      <button
        type="button"
        className={styles.trigger}
        data-state="available"
        onClick={() => download(translationId, pkg)}
        title={label}
        aria-label={label}
      >
        <DownloadIcon size={14} />
        {!compact && <span className={styles.label}>{label}</span>}
      </button>
    );
  } else if (installed && (status === "installed" || status === "update")) {
    const label = status === "update" ? t.offlineUpdate : t.offlineAvailable;
    body = (
      <>
        <button
          type="button"
          className={styles.trigger}
          data-state={status}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          title={label}
          aria-label={label}
        >
          <OfflineReadyIcon size={14} />
          {!compact && <span className={styles.label}>{label}</span>}
          {status === "update" && <span className={styles.dot} />}
        </button>
        {menuOpen && (
          <div className={styles.menu} role="menu">
            <div className={styles.menuInfo}>
              <div className={styles.menuTitle}>{installed.name || translationId}</div>
              <div className={styles.menuNote}>
                {fillTemplate(t.offlineVerses, { n: installed.verseCount.toLocaleString(state.locale) })}
                {installed.licenseNote ? ` · ${installed.licenseNote}` : ""}
              </div>
            </div>
            {status === "update" && pkg && (
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  void download(translationId, pkg);
                }}
              >
                <DownloadIcon size={13} />
                {fillTemplate(t.offlineUpdateAction, { s: formatBytes(pkg.sizeBytes) })}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                setMenuOpen(false);
                void remove(translationId);
              }}
            >
              <TrashIcon size={13} />
              {t.offlineRemove}
            </button>
          </div>
        )}
      </>
    );
  }

  if (!body) return null;
  return (
    <div ref={wrapRef} className={styles.wrap} data-variant={variant}>
      {body}
    </div>
  );
}
