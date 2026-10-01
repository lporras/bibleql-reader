import type { TranslationSummary } from "../types/bible";
import type { InstallProgress, InstalledTranslation, OfflineAvailability } from "../types/offline";

export type OfflineStatus = "unavailable" | "available" | "installed" | "update";

// What the download control should offer for one translation. An installed
// translation stays "installed" even when BibleQL can't be reached (no
// package info), so it remains removable offline.
export function offlineStatus(
  installed: InstalledTranslation | undefined,
  availability: OfflineAvailability | undefined
): OfflineStatus {
  const pkg = availability?.offlineDownloadable ? availability.offlinePackage : null;
  if (installed) return pkg && pkg.sha256.toLowerCase() !== installed.sha256.toLowerCase() ? "update" : "installed";
  return pkg ? "available" : "unavailable";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Whole-number percent, or null while the total size is unknown. */
export function progressPercent(progress: InstallProgress): number | null {
  if (!progress.total) return null;
  return Math.min(100, Math.floor((progress.received / progress.total) * 100));
}

export type InstallErrorKind = "cancelled" | "checksum" | "other";

// offline.rs signals these two with bare sentinel strings so the UI can
// word them per locale; anything else is shown as-is.
export function installErrorKind(message: string): InstallErrorKind {
  if (message === "cancelled") return "cancelled";
  if (message === "checksum") return "checksum";
  return "other";
}

// Downloaded translations must stay pickable when the translations list came
// from the cache or the bundled fallback and doesn't mention them.
export function mergeInstalled(source: TranslationSummary[], installed: InstalledTranslation[]): TranslationSummary[] {
  const known = new Set(source.map((t) => t.identifier));
  const extra = installed
    .filter((t) => !known.has(t.identifier))
    .map((t) => ({
      identifier: t.identifier,
      name: t.name || t.identifier,
      language: t.languageCode,
      note: t.licenseNote,
      concordanceIndexedAt: t.exportedAt || null
    }));
  return extra.length ? [...source, ...extra] : source;
}

/** The live list when there is one, else the last one seen, else the bundled fallback. */
export function pickTranslationSource(
  live: TranslationSummary[] | undefined,
  cached: TranslationSummary[],
  fallback: TranslationSummary[]
): TranslationSummary[] {
  if (live && live.length) return live;
  if (cached.length) return cached;
  return fallback;
}
