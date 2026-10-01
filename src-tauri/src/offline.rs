//! Offline translation packages — see docs/offline-mode.md.
//!
//! BibleQL publishes each downloadable translation as a gzipped SQLite file
//! (`Translation.offlinePackage`). This module downloads one, verifies it
//! (sha256 of the .gz bytes, then the `application_id` / `user_version`
//! pragmas), installs it under `<app data>/offline/`, and answers the same
//! passage / search / concordance questions the GraphQL API does, shaped like
//! the GraphQL responses so the frontend can swap sources per translation.
//!
//! The download happens here rather than in the webview because the package
//! host sends no CORS headers.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use flate2::read::GzDecoder;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_http::reqwest;
use unicode_normalization::UnicodeNormalization;

/// `PRAGMA application_id` of every package: 0x42514C31, "BQL1".
const APPLICATION_ID: i64 = 0x4251_4C31;
/// Matches the ~20-word window of the server's concordance `context`.
const SNIPPET_TOKENS: i64 = 24;
/// Progress is reported at most this often (bytes), plus once at the end.
const PROGRESS_STEP: u64 = 64 * 1024;

type CmdResult<T> = Result<T, String>;

#[derive(Default)]
struct Inner {
    /// Read-only connections, opened lazily per installed translation.
    conns: Mutex<HashMap<String, Connection>>,
    /// Identifiers whose in-flight download should stop at the next chunk.
    cancelled: Mutex<HashSet<String>>,
}

#[derive(Default, Clone)]
pub struct OfflineState(Arc<Inner>);

// ---------------------------------------------------------------------------
// Wire types (camelCase, mirroring src/types/bible.ts + src/types/offline.ts)

/// Stored next to each database as `<identifier>.json`.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Sidecar {
    sha256: String,
    schema_version: i64,
    size_bytes: u64,
    installed_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledTranslation {
    identifier: String,
    name: String,
    abbrev: String,
    language_code: String,
    language_name: String,
    license_note: String,
    exported_at: String,
    verse_count: i64,
    sha256: String,
    schema_version: i64,
    size_bytes: u64,
    installed_at: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    phase: &'static str,
    received: u64,
    total: Option<u64>,
}

#[derive(Serialize)]
pub struct Verse {
    verse: i64,
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PassageResult {
    reference: String,
    translation_name: String,
    translation_note: String,
    verses: Vec<Verse>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    book_name: String,
    chapter: i64,
    verse: i64,
    text: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct TestamentCounts {
    old: i64,
    new: i64,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConcordanceEntry {
    surface_forms: Vec<String>,
    total_occurrences: i64,
    verse_count: i64,
    occurrences_by_testament: TestamentCounts,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConcordanceVerseRef {
    book_name: String,
    chapter: i64,
    verse: i64,
}

#[derive(Serialize)]
pub struct ConcordanceHit {
    context: String,
    verse: ConcordanceVerseRef,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageInfo {
    has_next_page: bool,
    end_cursor: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConcordancePage {
    total_count: i64,
    entry: Option<ConcordanceEntry>,
    hits: Vec<ConcordanceHit>,
    page_info: PageInfo,
}

// ---------------------------------------------------------------------------
// Paths + connections

fn offline_dir(app: &AppHandle) -> CmdResult<PathBuf> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("offline");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Identifiers become file names, so only BibleQL's `[a-z0-9-]` shape passes.
fn check_identifier(identifier: &str) -> CmdResult<()> {
    let ok = !identifier.is_empty()
        && identifier.len() <= 64
        && identifier.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if ok {
        Ok(())
    } else {
        Err(format!("Invalid translation identifier: {identifier}"))
    }
}

fn db_path(dir: &Path, identifier: &str) -> PathBuf {
    dir.join(format!("{identifier}.sqlite"))
}

fn sidecar_path(dir: &Path, identifier: &str) -> PathBuf {
    dir.join(format!("{identifier}.json"))
}

fn open_read_only(path: &Path) -> rusqlite::Result<Connection> {
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)
}

impl OfflineState {
    fn with_conn<T>(
        &self,
        dir: &Path,
        identifier: &str,
        f: impl FnOnce(&Connection) -> rusqlite::Result<T>,
    ) -> CmdResult<T> {
        check_identifier(identifier)?;
        let mut conns = self.0.conns.lock().map_err(|e| e.to_string())?;
        if !conns.contains_key(identifier) {
            let path = db_path(dir, identifier);
            if !path.exists() {
                return Err(format!("{identifier} is not downloaded."));
            }
            conns.insert(identifier.to_owned(), open_read_only(&path).map_err(|e| e.to_string())?);
        }
        f(&conns[identifier]).map_err(|e| e.to_string())
    }

    /// Closes the cached connection so the file can be replaced or deleted
    /// (Windows refuses either while it's open).
    fn forget(&self, identifier: &str) {
        if let Ok(mut conns) = self.0.conns.lock() {
            conns.remove(identifier);
        }
    }

    fn is_cancelled(&self, identifier: &str) -> bool {
        self.0.cancelled.lock().map(|c| c.contains(identifier)).unwrap_or(false)
    }

    fn set_cancelled(&self, identifier: &str, on: bool) {
        if let Ok(mut c) = self.0.cancelled.lock() {
            if on {
                c.insert(identifier.to_owned());
            } else {
                c.remove(identifier);
            }
        }
    }
}

fn meta_map(conn: &Connection) -> rusqlite::Result<HashMap<String, String>> {
    let mut stmt = conn.prepare("SELECT key, value FROM meta")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    rows.collect()
}

fn describe(conn: &Connection, identifier: &str, sidecar: Sidecar) -> rusqlite::Result<InstalledTranslation> {
    let mut meta = meta_map(conn)?;
    let mut take = |k: &str| meta.remove(k).unwrap_or_default();
    Ok(InstalledTranslation {
        identifier: identifier.to_owned(),
        name: take("translation_name"),
        abbrev: take("translation_abbrev"),
        language_code: take("language_code"),
        language_name: take("language_name"),
        license_note: take("license_note"),
        exported_at: take("exported_at"),
        verse_count: take("verse_count").parse().unwrap_or(0),
        sha256: sidecar.sha256,
        schema_version: sidecar.schema_version,
        size_bytes: sidecar.size_bytes,
        installed_at: sidecar.installed_at,
    })
}

fn read_sidecar(dir: &Path, identifier: &str) -> Option<Sidecar> {
    let raw = fs::read(sidecar_path(dir, identifier)).ok()?;
    serde_json::from_slice(&raw).ok()
}

// ---------------------------------------------------------------------------
// Package validation

/// Checks a freshly unpacked database is a BibleQL package for `identifier`
/// at `schema_version` before it replaces anything.
fn validate_package(path: &Path, identifier: &str, schema_version: i64) -> CmdResult<()> {
    let conn = open_read_only(path).map_err(|e| format!("The package is not a SQLite database: {e}"))?;
    let app_id: i64 = conn.query_row("PRAGMA application_id", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if app_id != APPLICATION_ID {
        return Err("The package is not a BibleQL offline package.".into());
    }
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if version != schema_version {
        return Err(format!("The package has schema version {version}, expected {schema_version}."));
    }
    let id: Option<String> = conn
        .query_row("SELECT value FROM meta WHERE key = 'translation_identifier'", [], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    if id.as_deref() != Some(identifier) {
        return Err(format!("The package is for {}, not {identifier}.", id.unwrap_or_default()));
    }
    Ok(())
}

fn gunzip(from: &Path, to: &Path) -> io::Result<()> {
    let mut decoder = GzDecoder::new(io::BufReader::new(fs::File::open(from)?));
    let mut out = io::BufWriter::new(fs::File::create(to)?);
    io::copy(&mut decoder, &mut out)?;
    out.flush()?;
    out.into_inner().map_err(|e| e.into_error())?.sync_all()
}

// ---------------------------------------------------------------------------
// Text helpers (pure — unit tested below)

/// Lowercase + strip diacritics — the same folding FTS5's
/// `unicode61 remove_diacritics 2` applies, so counts agree with MATCH.
fn fold(s: &str) -> String {
    s.nfd()
        .filter(|c| !unicode_normalization::char::is_combining_mark(*c))
        .flat_map(char::to_lowercase)
        .collect()
}

/// Word tokens as unicode61 sees them: runs of letters/digits.
fn tokens(s: &str) -> impl Iterator<Item = &str> {
    s.split(|c: char| !c.is_alphanumeric()).filter(|t| !t.is_empty())
}

/// Turns free text into a MATCH expression that can't hit FTS5 syntax:
/// every token is quoted (so `-`, `*`, `NEAR`, `"` are literal) and the
/// tokens are implicitly ANDed. None when nothing searchable is left.
fn fts_query(input: &str) -> Option<String> {
    let parts: Vec<String> = tokens(input).map(|t| format!("\"{}\"", t.replace('"', "\"\""))).collect();
    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" "))
    }
}

/// Counts whole-word occurrences of `folded` in `text`, recording the
/// lowercased spellings seen (first-seen order, no duplicates).
fn count_occurrences(text: &str, folded: &str, forms: &mut Vec<String>) -> i64 {
    let mut n = 0;
    for tok in tokens(text) {
        if fold(tok) == folded {
            n += 1;
            let lower = tok.to_lowercase();
            if !forms.contains(&lower) {
                forms.push(lower);
            }
        }
    }
    n
}

// ---------------------------------------------------------------------------
// Queries (pure over a Connection — unit tested below)

fn query_passage(conn: &Connection, book_code: &str, chapter: i64) -> rusqlite::Result<PassageResult> {
    let book: Option<(i64, String)> = conn
        .query_row("SELECT id, name FROM books WHERE code = ?1", [book_code], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()?;
    let meta = meta_map(conn)?;
    let translation_name = meta.get("translation_name").cloned().unwrap_or_default();
    let translation_note = meta.get("license_note").cloned().unwrap_or_default();
    let Some((book_id, book_name)) = book else {
        return Ok(PassageResult {
            reference: format!("{book_code} {chapter}"),
            translation_name,
            translation_note,
            verses: vec![],
        });
    };
    let mut stmt =
        conn.prepare_cached("SELECT verse, text FROM verses WHERE book_id = ?1 AND chapter = ?2 ORDER BY verse")?;
    let verses = stmt
        .query_map(params![book_id, chapter], |r| Ok(Verse { verse: r.get(0)?, text: r.get(1)? }))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(PassageResult { reference: format!("{book_name} {chapter}"), translation_name, translation_note, verses })
}

fn query_search(conn: &Connection, input: &str, limit: i64) -> rusqlite::Result<Vec<SearchHit>> {
    let Some(expr) = fts_query(input) else { return Ok(vec![]) };
    let mut stmt = conn.prepare_cached(
        "SELECT b.name, v.chapter, v.verse, v.text
           FROM verses_fts f
           JOIN verses v ON v.id = f.rowid
           JOIN books b ON b.id = v.book_id
          WHERE verses_fts MATCH ?1
          ORDER BY f.rank, v.id
          LIMIT ?2",
    )?;
    let hits = stmt.query_map(params![expr, limit], |r| {
        Ok(SearchHit { book_name: r.get(0)?, chapter: r.get(1)?, verse: r.get(2)?, text: r.get(3)? })
    })?;
    hits.collect()
}

fn query_concordance(
    conn: &Connection,
    word: &str,
    first: i64,
    after: Option<&str>,
) -> rusqlite::Result<ConcordancePage> {
    let empty = || ConcordancePage {
        total_count: 0,
        entry: None,
        hits: vec![],
        page_info: PageInfo { has_next_page: false, end_cursor: None },
    };
    // Concordance is per word: the first token is the word.
    let Some(token) = tokens(word).next() else { return Ok(empty()) };
    let folded = fold(token);
    let expr = format!("\"{token}\"");

    let total_count: i64 =
        conn.query_row("SELECT count(*) FROM verses_fts WHERE verses_fts MATCH ?1", [&expr], |r| r.get(0))?;
    if total_count == 0 {
        return Ok(empty());
    }

    // The summary needs every match; only the first page carries it (the
    // UI reads `pages[0].entry`), so later pages skip the scan.
    let entry = if after.is_none() {
        let mut stmt = conn.prepare_cached(
            "SELECT v.text, b.testament
               FROM verses_fts f
               JOIN verses v ON v.id = f.rowid
               JOIN books b ON b.id = v.book_id
              WHERE verses_fts MATCH ?1",
        )?;
        let mut rows = stmt.query([&expr])?;
        let mut forms = Vec::new();
        let (mut total, mut old, mut new) = (0, 0, 0);
        while let Some(row) = rows.next()? {
            let text: String = row.get(0)?;
            let testament: String = row.get(1)?;
            total += count_occurrences(&text, &folded, &mut forms);
            // Matches the server, whose by-testament split counts verses.
            if testament == "OT" {
                old += 1;
            } else {
                new += 1;
            }
        }
        Some(ConcordanceEntry {
            surface_forms: forms,
            total_occurrences: total,
            verse_count: total_count,
            occurrences_by_testament: TestamentCounts { old, new },
        })
    } else {
        None
    };

    let after_id: i64 = after.and_then(|a| a.parse().ok()).unwrap_or(0);
    let mut stmt = conn.prepare_cached(&format!(
        "SELECT v.id, snippet(verses_fts, 0, '<mark>', '</mark>', '', {SNIPPET_TOKENS}), b.name, v.chapter, v.verse
           FROM verses_fts
           JOIN verses v ON v.id = verses_fts.rowid
           JOIN books b ON b.id = v.book_id
          WHERE verses_fts MATCH ?1 AND v.id > ?2
          ORDER BY v.id
          LIMIT ?3"
    ))?;
    let mut rows = stmt.query(params![expr, after_id, first + 1])?;
    let mut hits = Vec::new();
    let mut last_id = None;
    let mut has_next_page = false;
    while let Some(row) = rows.next()? {
        if hits.len() as i64 == first {
            has_next_page = true;
            break;
        }
        last_id = Some(row.get::<_, i64>(0)?);
        hits.push(ConcordanceHit {
            context: row.get(1)?,
            verse: ConcordanceVerseRef { book_name: row.get(2)?, chapter: row.get(3)?, verse: row.get(4)? },
        });
    }
    Ok(ConcordancePage {
        total_count,
        entry,
        hits,
        page_info: PageInfo { has_next_page, end_cursor: last_id.map(|id| id.to_string()) },
    })
}

// ---------------------------------------------------------------------------
// Commands

#[tauri::command]
pub async fn offline_list(app: AppHandle, state: State<'_, OfflineState>) -> CmdResult<Vec<InstalledTranslation>> {
    let dir = offline_dir(&app)?;
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut out = Vec::new();
        for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let Some(identifier) = path.file_stem().and_then(|s| s.to_str()).map(str::to_owned) else { continue };
            let Some(sidecar) = read_sidecar(&dir, &identifier) else { continue };
            // A broken install is skipped rather than failing the whole list.
            if let Ok(t) = state.with_conn(&dir, &identifier, |c| describe(c, &identifier, sidecar)) {
                out.push(t);
            }
        }
        out.sort_by(|a, b| a.identifier.cmp(&b.identifier));
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn offline_install(
    app: AppHandle,
    state: State<'_, OfflineState>,
    identifier: String,
    url: String,
    sha256: String,
    schema_version: i64,
    on_progress: Channel<InstallProgress>,
) -> CmdResult<InstalledTranslation> {
    check_identifier(&identifier)?;
    if !url.starts_with("https://") {
        return Err("Offline packages must be downloaded over https.".into());
    }
    let dir = offline_dir(&app)?;
    let state = state.inner().clone();
    state.set_cancelled(&identifier, false);

    let part = dir.join(format!("{identifier}.part"));
    let tmp = dir.join(format!("{identifier}.sqlite.tmp"));
    let result = install(&state, &dir, &identifier, &url, &sha256, schema_version, &part, &tmp, &on_progress).await;
    let _ = fs::remove_file(&part);
    let _ = fs::remove_file(&tmp);
    state.set_cancelled(&identifier, false);
    result
}

#[allow(clippy::too_many_arguments)]
async fn install(
    state: &OfflineState,
    dir: &Path,
    identifier: &str,
    url: &str,
    expected_sha: &str,
    schema_version: i64,
    part: &Path,
    tmp: &Path,
    on_progress: &Channel<InstallProgress>,
) -> CmdResult<InstalledTranslation> {
    let mut res = reqwest::get(url)
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("The download failed: {e}"))?;
    let total = res.content_length();
    let mut file = io::BufWriter::new(fs::File::create(part).map_err(|e| e.to_string())?);
    let mut hasher = Sha256::new();
    let (mut received, mut reported) = (0u64, 0u64);
    let _ = on_progress.send(InstallProgress { phase: "download", received, total });

    while let Some(chunk) = res.chunk().await.map_err(|e| format!("The download failed: {e}"))? {
        if state.is_cancelled(identifier) {
            return Err("cancelled".into());
        }
        hasher.update(&chunk);
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        if received - reported >= PROGRESS_STEP {
            reported = received;
            let _ = on_progress.send(InstallProgress { phase: "download", received, total });
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);
    let _ = on_progress.send(InstallProgress { phase: "install", received, total });

    let actual = format!("{:x}", hasher.finalize());
    if !actual.eq_ignore_ascii_case(expected_sha) {
        return Err("checksum".into());
    }

    let state = state.clone();
    let (dir, identifier, part, tmp) = (dir.to_owned(), identifier.to_owned(), part.to_owned(), tmp.to_owned());
    let expected_sha = expected_sha.to_lowercase();
    tauri::async_runtime::spawn_blocking(move || {
        gunzip(&part, &tmp).map_err(|e| format!("The package could not be unpacked: {e}"))?;
        validate_package(&tmp, &identifier, schema_version)?;
        state.forget(&identifier);
        fs::rename(&tmp, db_path(&dir, &identifier)).map_err(|e| e.to_string())?;
        let installed_at =
            SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or_default();
        let sidecar = Sidecar { sha256: expected_sha, schema_version, size_bytes: received, installed_at };
        let json = serde_json::to_vec(&sidecar).map_err(|e| e.to_string())?;
        fs::write(sidecar_path(&dir, &identifier), json).map_err(|e| e.to_string())?;
        state.with_conn(&dir, &identifier, |c| describe(c, &identifier, sidecar))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn offline_cancel(state: State<'_, OfflineState>, identifier: String) {
    state.set_cancelled(&identifier, true);
}

#[tauri::command]
pub async fn offline_remove(app: AppHandle, state: State<'_, OfflineState>, identifier: String) -> CmdResult<()> {
    check_identifier(&identifier)?;
    let dir = offline_dir(&app)?;
    state.forget(&identifier);
    // Sidecar first: without it the translation no longer lists as installed.
    for path in [sidecar_path(&dir, &identifier), db_path(&dir, &identifier)] {
        match fs::remove_file(&path) {
            Err(e) if e.kind() != io::ErrorKind::NotFound => return Err(e.to_string()),
            _ => {}
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn offline_passage(
    app: AppHandle,
    state: State<'_, OfflineState>,
    identifier: String,
    book_code: String,
    chapter: i64,
) -> CmdResult<PassageResult> {
    let dir = offline_dir(&app)?;
    state.with_conn(&dir, &identifier, |c| query_passage(c, &book_code, chapter))
}

#[tauri::command]
pub async fn offline_search(
    app: AppHandle,
    state: State<'_, OfflineState>,
    identifier: String,
    query: String,
    limit: i64,
) -> CmdResult<Vec<SearchHit>> {
    let dir = offline_dir(&app)?;
    state.with_conn(&dir, &identifier, |c| query_search(c, &query, limit))
}

#[tauri::command]
pub async fn offline_concordance(
    app: AppHandle,
    state: State<'_, OfflineState>,
    identifier: String,
    word: String,
    first: i64,
    after: Option<String>,
) -> CmdResult<ConcordancePage> {
    let dir = offline_dir(&app)?;
    state.with_conn(&dir, &identifier, |c| query_concordance(c, &word, first, after.as_deref()))
}

// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// A miniature package with the real schema-v1 DDL.
    fn fixture() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            PRAGMA application_id = 1112624177;
            PRAGMA user_version = 1;
            CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE books (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                                testament TEXT NOT NULL, chapters INTEGER NOT NULL);
            CREATE TABLE verses (id INTEGER PRIMARY KEY, book_id INTEGER NOT NULL REFERENCES books(id),
                                 chapter INTEGER NOT NULL, verse INTEGER NOT NULL, text TEXT NOT NULL);
            CREATE UNIQUE INDEX verses_ref ON verses(book_id, chapter, verse);
            CREATE VIRTUAL TABLE verses_fts USING fts5(text, content = 'verses', content_rowid = 'id',
                                                       tokenize = "unicode61 remove_diacritics 2");
            INSERT INTO meta VALUES ('translation_identifier', 'spa-test'), ('translation_name', 'Prueba'),
                                    ('license_note', 'Public Domain'), ('verse_count', '4');
            INSERT INTO books VALUES (1, 'GEN', 'Génesis', 'OT', 50), (43, 'JHN', 'Juan', 'NT', 21);
            INSERT INTO verses VALUES
              (1, 1, 1, 2, 'y el Espíritu de Dios se movía sobre la haz de las aguas'),
              (2, 1, 6, 3, 'No contenderá mi espíritu con el hombre'),
              (3, 43, 3, 5, 'el que no naciere de agua y del Espiritu, espíritu es'),
              (4, 43, 3, 16, 'Porque de tal manera amó Dios al mundo');
            INSERT INTO verses_fts(verses_fts) VALUES ('rebuild');
            "#,
        )
        .unwrap();
        conn
    }

    #[test]
    fn fold_strips_case_and_diacritics() {
        assert_eq!(fold("Espíritu"), "espiritu");
        assert_eq!(fold("ÁNGEL"), "angel");
    }

    #[test]
    fn fts_query_quotes_every_token() {
        assert_eq!(fts_query("espíritu santo").as_deref(), Some("\"espíritu\" \"santo\""));
        assert_eq!(fts_query("NEAR(a b)").as_deref(), Some("\"NEAR\" \"a\" \"b\""));
        assert_eq!(fts_query("-dios* \"amor\"").as_deref(), Some("\"dios\" \"amor\""));
        assert_eq!(fts_query("  ?! "), None);
    }

    #[test]
    fn passage_uses_localized_book_name() {
        let p = query_passage(&fixture(), "JHN", 3).unwrap();
        assert_eq!(p.reference, "Juan 3");
        assert_eq!(p.translation_name, "Prueba");
        assert_eq!(p.translation_note, "Public Domain");
        assert_eq!(p.verses.iter().map(|v| v.verse).collect::<Vec<_>>(), vec![5, 16]);
        assert!(query_passage(&fixture(), "REV", 1).unwrap().verses.is_empty());
    }

    #[test]
    fn search_is_accent_insensitive_and_syntax_safe() {
        let conn = fixture();
        assert_eq!(query_search(&conn, "espiritu", 40).unwrap().len(), 3);
        assert_eq!(query_search(&conn, "Dios mundo", 40).unwrap().len(), 1);
        assert!(query_search(&conn, "\"unbalanced", 40).unwrap().is_empty());
        assert!(query_search(&conn, "   ", 40).unwrap().is_empty());
    }

    #[test]
    fn concordance_summarises_and_pages_by_canonical_id() {
        let conn = fixture();
        let first = query_concordance(&conn, "espiritu", 2, None).unwrap();
        assert_eq!(first.total_count, 3);
        assert_eq!(
            first.entry,
            Some(ConcordanceEntry {
                surface_forms: vec!["espíritu".into(), "espiritu".into()],
                total_occurrences: 4,
                verse_count: 3,
                occurrences_by_testament: TestamentCounts { old: 2, new: 1 },
            })
        );
        assert_eq!(first.hits.len(), 2);
        assert!(first.hits[0].context.contains("<mark>Espíritu</mark>"));
        assert!(first.page_info.has_next_page);
        assert_eq!(first.page_info.end_cursor.as_deref(), Some("2"));

        let second = query_concordance(&conn, "espiritu", 2, Some("2")).unwrap();
        assert!(second.entry.is_none());
        assert_eq!(second.hits.len(), 1);
        assert_eq!(second.hits[0].verse.book_name, "Juan");
        assert!(!second.page_info.has_next_page);

        assert_eq!(query_concordance(&conn, "zzz", 25, None).unwrap().total_count, 0);
    }

    #[test]
    fn identifiers_cannot_escape_the_offline_dir() {
        assert!(check_identifier("spa-rv1909").is_ok());
        assert!(check_identifier("../etc").is_err());
        assert!(check_identifier("").is_err());
    }

    /// Checks a real package against production's answers. Opt-in:
    /// `OFFLINE_PACKAGE=/path/spa-rv1909.sqlite cargo test -- --ignored`
    #[test]
    #[ignore]
    fn real_rv1909_package_matches_the_server() {
        let path = std::env::var("OFFLINE_PACKAGE").expect("set OFFLINE_PACKAGE");
        validate_package(Path::new(&path), "spa-rv1909", 1).unwrap();
        let conn = open_read_only(Path::new(&path)).unwrap();
        assert_eq!(query_passage(&conn, "JHN", 3).unwrap().reference, "Juan 3");
        let page = query_concordance(&conn, "espiritu", 25, None).unwrap();
        let entry = page.entry.unwrap();
        assert_eq!((page.total_count, entry.total_occurrences), (560, 616));
        assert_eq!(entry.occurrences_by_testament, TestamentCounts { old: 241, new: 319 });
        assert_eq!(entry.surface_forms, vec!["espíritu".to_string()]);
    }

    /// Installs a real package over the network into a temp dir, and checks
    /// a corrupted checksum leaves nothing behind. Opt-in:
    /// `OFFLINE_PACKAGE_URL=<url> OFFLINE_PACKAGE_SHA=<sha> cargo test -- --ignored`
    #[test]
    #[ignore]
    fn installs_a_real_package() {
        let url = std::env::var("OFFLINE_PACKAGE_URL").expect("set OFFLINE_PACKAGE_URL");
        let sha = std::env::var("OFFLINE_PACKAGE_SHA").expect("set OFFLINE_PACKAGE_SHA");
        let dir = std::env::temp_dir().join(format!("bibleql-offline-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let state = OfflineState::default();
        let channel: Channel<InstallProgress> = Channel::new(|_| Ok(()));
        let (part, tmp) = (dir.join("eng-kjv.part"), dir.join("eng-kjv.sqlite.tmp"));

        let bad = tauri::async_runtime::block_on(install(
            &state, &dir, "eng-kjv", &url, &"0".repeat(64), 1, &part, &tmp, &channel,
        ));
        assert_eq!(bad.err().as_deref(), Some("checksum"));
        assert!(!db_path(&dir, "eng-kjv").exists());

        let t = tauri::async_runtime::block_on(install(&state, &dir, "eng-kjv", &url, &sha, 1, &part, &tmp, &channel))
            .unwrap();
        assert_eq!((t.name.as_str(), t.verse_count), ("King James Version", 31102));
        let p = state.with_conn(&dir, "eng-kjv", |c| query_passage(c, "JHN", 3)).unwrap();
        assert!(p.verses[15].text.starts_with("For God so loved the world"));
        fs::remove_dir_all(&dir).unwrap();
    }
}
