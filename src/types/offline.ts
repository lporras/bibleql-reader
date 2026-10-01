// Offline translation packages — BibleQL's `Translation.offlinePackage` and
// the shapes src-tauri/src/offline.rs sends back over `invoke`.

/** Package schema this app reads. Must match the Rust side's validation. */
export const OFFLINE_SCHEMA_VERSION = 1;

export interface OfflinePackageInfo {
  url: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface OfflineAvailability {
  identifier: string;
  offlineDownloadable: boolean;
  offlinePackage: OfflinePackageInfo | null;
}

export interface InstalledTranslation {
  identifier: string;
  name: string;
  abbrev: string;
  languageCode: string;
  languageName: string;
  licenseNote: string;
  exportedAt: string;
  verseCount: number;
  sha256: string;
  schemaVersion: number;
  sizeBytes: number;
  installedAt: number;
}

export interface InstallProgress {
  phase: "download" | "install";
  received: number;
  total: number | null;
}
