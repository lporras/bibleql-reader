import { describe, expect, it } from "vitest";
import {
  formatBytes,
  installErrorKind,
  mergeInstalled,
  offlineStatus,
  pickTranslationSource,
  progressPercent
} from "./offline";
import type { TranslationSummary } from "../types/bible";
import type { InstalledTranslation, OfflineAvailability } from "../types/offline";

const installed = (identifier: string, sha256 = "abc"): InstalledTranslation => ({
  identifier,
  name: "King James Version",
  abbrev: "KJV",
  languageCode: "eng",
  languageName: "English",
  licenseNote: "Public Domain",
  exportedAt: "2026-10-01T02:29:13Z",
  verseCount: 31102,
  sha256,
  schemaVersion: 1,
  sizeBytes: 3404184,
  installedAt: 0
});

const available = (identifier: string, sha256 = "abc"): OfflineAvailability => ({
  identifier,
  offlineDownloadable: true,
  offlinePackage: { url: "https://example.org/p.sqlite.gz", sha256, sizeBytes: 3404184, updatedAt: "" }
});

const summary = (identifier: string): TranslationSummary => ({
  identifier,
  name: identifier,
  language: "eng",
  note: "",
  concordanceIndexedAt: null
});

describe("offlineStatus", () => {
  it("offers a download only when BibleQL publishes a package", () => {
    expect(offlineStatus(undefined, available("eng-kjv"))).toBe("available");
    expect(offlineStatus(undefined, { identifier: "eng-niv", offlineDownloadable: false, offlinePackage: null })).toBe(
      "unavailable"
    );
    expect(offlineStatus(undefined, undefined)).toBe("unavailable");
  });

  it("flags an update when the published checksum differs", () => {
    expect(offlineStatus(installed("eng-kjv", "abc"), available("eng-kjv", "ABC"))).toBe("installed");
    expect(offlineStatus(installed("eng-kjv", "abc"), available("eng-kjv", "def"))).toBe("update");
  });

  it("keeps an installed translation installed when BibleQL is unreachable", () => {
    expect(offlineStatus(installed("eng-kjv"), undefined)).toBe("installed");
  });
});

describe("formatBytes / progressPercent", () => {
  it("formats package sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3404184)).toBe("3.2 MB");
  });

  it("reports whole percents, or null without a total", () => {
    expect(progressPercent({ phase: "download", received: 50, total: 200 })).toBe(25);
    expect(progressPercent({ phase: "download", received: 300, total: 200 })).toBe(100);
    expect(progressPercent({ phase: "download", received: 50, total: null })).toBeNull();
  });
});

describe("installErrorKind", () => {
  it("recognises the Rust side's sentinels", () => {
    expect(installErrorKind("cancelled")).toBe("cancelled");
    expect(installErrorKind("checksum")).toBe("checksum");
    expect(installErrorKind("The download failed: 404")).toBe("other");
  });
});

describe("translation list sources", () => {
  it("prefers live, then cached, then fallback", () => {
    const live = [summary("eng-web")];
    const cached = [summary("eng-kjv")];
    const fallback = [summary("spa-rv1909")];
    expect(pickTranslationSource(live, cached, fallback)).toBe(live);
    expect(pickTranslationSource([], cached, fallback)).toBe(cached);
    expect(pickTranslationSource(undefined, [], fallback)).toBe(fallback);
  });

  it("adds installed translations the list doesn't know", () => {
    const source = [summary("eng-web")];
    expect(mergeInstalled(source, [])).toBe(source);
    expect(mergeInstalled(source, [installed("eng-web")])).toBe(source);
    const merged = mergeInstalled(source, [installed("eng-kjv")]);
    expect(merged.map((t) => t.identifier)).toEqual(["eng-web", "eng-kjv"]);
    expect(merged[1]).toMatchObject({ name: "King James Version", note: "Public Domain" });
  });
});
