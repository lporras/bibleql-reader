import { Channel, invoke } from "@tauri-apps/api/core";
import type { ConcordancePageResult, PassageResult, SearchHit } from "../types/bible";
import {
  OFFLINE_SCHEMA_VERSION,
  type InstallProgress,
  type InstalledTranslation,
  type OfflinePackageInfo
} from "../types/offline";

// Offline translations: the seam to src-tauri/src/offline.rs, which downloads,
// verifies and queries BibleQL's per-translation SQLite packages. Rust does
// the download because the package host sends no CORS headers, and the
// queries because the packages carry an FTS5 index.
//
// Outside a Tauri shell (`yarn dev` in a browser) nothing is ever installed:
// `list` resolves to [] and every translation keeps reading from GraphQL.
// The E2E suite's stub `__TAURI_INTERNALS__` counts as a shell, so specs can
// answer these commands themselves. Checked per call, never at module scope.
function hasShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface OfflineBible {
  canDownload(): boolean;
  list(): Promise<InstalledTranslation[]>;
  install(
    identifier: string,
    pkg: OfflinePackageInfo,
    onProgress: (progress: InstallProgress) => void
  ): Promise<InstalledTranslation>;
  cancel(identifier: string): Promise<void>;
  remove(identifier: string): Promise<void>;
  passage(identifier: string, bookCode: string, chapter: number): Promise<PassageResult>;
  search(identifier: string, query: string, limit: number): Promise<SearchHit[]>;
  concordance(identifier: string, word: string, first: number, after: string | null): Promise<ConcordancePageResult>;
}

// Rust returns its errors as plain strings; give callers real Errors.
async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export const offlineBible: OfflineBible = {
  canDownload: hasShell,

  async list() {
    if (!hasShell()) return [];
    return (await call<InstalledTranslation[] | null>("offline_list")) ?? [];
  },

  install(identifier, pkg, onProgress) {
    const channel = new Channel<InstallProgress>();
    channel.onmessage = onProgress;
    return call("offline_install", {
      identifier,
      url: pkg.url,
      sha256: pkg.sha256,
      schemaVersion: OFFLINE_SCHEMA_VERSION,
      onProgress: channel
    });
  },

  cancel: (identifier) => call("offline_cancel", { identifier }),
  remove: (identifier) => call("offline_remove", { identifier }),
  passage: (identifier, bookCode, chapter) => call("offline_passage", { identifier, bookCode, chapter }),
  search: (identifier, query, limit) => call("offline_search", { identifier, query, limit }),
  concordance: (identifier, word, first, after) => call("offline_concordance", { identifier, word, first, after })
};
