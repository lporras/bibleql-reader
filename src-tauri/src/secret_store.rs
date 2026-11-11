//! Where the app's secrets live — see docs/installation-keys.md.
//!
//! The OS credential store where it can be reached: Keychain on macOS and iOS,
//! Credential Manager on Windows, the Secret Service on Linux, and
//! Keystore-encrypted SharedPreferences on Android. Anywhere else (a Linux
//! desktop with no Secret Service daemon, say) a 0600 JSON file in the app data
//! dir stands in, one per consumer.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use tauri::{AppHandle, Manager};

const SERVICE: &str = "org.bibleql.reader";

pub type CmdResult<T> = Result<T, String>;

/// One secret slot per key. Implemented by the OS credential store and by
/// the fallback file, and by an in-memory map in the tests.
pub trait SecretStore: Send + Sync {
    fn get(&self, key: &str) -> CmdResult<Option<String>>;
    fn set(&self, key: &str, value: &str) -> CmdResult<()>;
    fn delete(&self, key: &str) -> CmdResult<()>;
}

// ---------------------------------------------------------------------------
// OS credential store

struct KeyringStore;

impl SecretStore for KeyringStore {
    fn get(&self, key: &str) -> CmdResult<Option<String>> {
        match keyring_core::Entry::new(SERVICE, key).and_then(|e| e.get_password()) {
            Ok(value) => Ok(Some(value)),
            Err(keyring_core::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    fn set(&self, key: &str, value: &str) -> CmdResult<()> {
        keyring_core::Entry::new(SERVICE, key)
            .and_then(|e| e.set_password(value))
            .map_err(|e| e.to_string())
    }

    fn delete(&self, key: &str) -> CmdResult<()> {
        match keyring_core::Entry::new(SERVICE, key).and_then(|e| e.delete_credential()) {
            Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

/// Debug builds on macOS use the fallback file. The login keychain ties an
/// item's access to the code signature of the app that created it, and an
/// unsigned dev build has no stable signature: every rebuild would ask for the
/// login password. Release builds are Developer ID signed, so they don't
/// (docs/macos-signing.md).
#[cfg(all(target_os = "macos", debug_assertions))]
fn init_native_store() -> keyring_core::Result<()> {
    Err(keyring_core::Error::NotSupportedByStore("macOS keychain in a debug build".into()))
}

/// Installs this platform's credential store as keyring-core's default.
#[cfg(not(all(target_os = "macos", debug_assertions)))]
fn init_native_store() -> keyring_core::Result<()> {
    #[cfg(target_os = "macos")]
    keyring_core::set_default_store(apple_native_keyring_store::keychain::Store::new()?);
    #[cfg(target_os = "ios")]
    keyring_core::set_default_store(apple_native_keyring_store::protected::Store::new()?);
    #[cfg(target_os = "windows")]
    keyring_core::set_default_store(windows_native_keyring_store::Store::new()?);
    #[cfg(target_os = "linux")]
    keyring_core::set_default_store(zbus_secret_service_keyring_store::Store::new()?);
    // Needs ndk-context, which Tauri's Android runtime initializes.
    #[cfg(target_os = "android")]
    keyring_core::set_default_store(android_native_keyring_store::Store::new()?);
    Ok(())
}

// ---------------------------------------------------------------------------
// Fallback file

/// Values are optional because installation.json has always been written with
/// `"token": null` before registration. A file that failed to parse would read
/// as empty, and an empty one means registering again.
type FileContents = BTreeMap<String, Option<String>>;

pub struct FileStore {
    path: PathBuf,
    lock: Mutex<()>,
}

impl FileStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path, lock: Mutex::new(()) }
    }

    fn read(&self) -> FileContents {
        fs::read(&self.path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default()
    }

    fn write(&self, contents: &FileContents) -> CmdResult<()> {
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_vec(contents).map_err(|e| e.to_string())?;
        write_private(&self.path, &json).map_err(|e| e.to_string())
    }

    fn update(&self, f: impl FnOnce(&mut FileContents)) -> CmdResult<()> {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        let mut contents = self.read();
        f(&mut contents);
        self.write(&contents)
    }

    fn remove(&self) -> CmdResult<()> {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        match fs::remove_file(&self.path) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
            _ => Ok(()),
        }
    }
}

impl SecretStore for FileStore {
    fn get(&self, key: &str) -> CmdResult<Option<String>> {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        Ok(self.read().remove(key).flatten())
    }

    fn set(&self, key: &str, value: &str) -> CmdResult<()> {
        self.update(|c| {
            c.insert(key.to_owned(), Some(value.to_owned()));
        })
    }

    fn delete(&self, key: &str) -> CmdResult<()> {
        self.update(|c| {
            c.remove(key);
        })
    }
}

/// Replaces the file in one step, so a crash mid-write can't lose a secret
/// that has already been rotated on the server.
fn write_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut temp = path.as_os_str().to_owned();
    temp.push(".tmp");
    let temp = PathBuf::from(temp);
    write_temp(&temp, bytes)?;
    fs::rename(&temp, path)
}

/// Owner read/write only, set at creation so the secret is never briefly
/// world-readable.
#[cfg(unix)]
fn write_temp(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    let mut file = fs::OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

#[cfg(not(unix))]
fn write_temp(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    fs::write(path, bytes)
}

// ---------------------------------------------------------------------------
// Choosing a store

/// Moves `keys` from the fallback file into the store, whole or not at all.
///
/// A file with anything in it always wins over what the store holds: it is only
/// written on a run where the store couldn't be used, so it is the newer copy
/// (or the only one, on the first run after moving a platform off the file).
///
/// On any failure the file stays and stays authoritative. That includes failing
/// to delete it, or a later run would overwrite newer values with its old ones.
fn migrate(store: &dyn SecretStore, file: &FileStore, keys: &[&str]) -> CmdResult<()> {
    let values = keys.iter().map(|key| file.get(key)).collect::<CmdResult<Vec<_>>>()?;
    if values.iter().all(Option::is_none) {
        return Ok(());
    }
    for (key, value) in keys.iter().zip(&values) {
        match value {
            Some(value) => store.set(key, value)?,
            None => store.delete(key)?,
        }
    }
    for (key, value) in keys.iter().zip(&values) {
        if store.get(key)? != *value {
            return Err(format!("{key} didn't read back from the credential store"));
        }
    }
    file.remove()
}

/// The store this consumer should use for the rest of the run: `native` if it
/// answers a read and takes over anything left in `file`, `file` otherwise.
/// `keys[0]` is the key probed. Falling back rather than failing matters: without
/// storage the app would lose its credentials on every launch.
pub fn select_store(native: Option<Arc<dyn SecretStore>>, file: Arc<FileStore>, keys: &[&str]) -> Arc<dyn SecretStore> {
    if let Some(native) = native {
        if native.get(keys[0]).is_ok() && migrate(native.as_ref(), &file, keys).is_ok() {
            return native;
        }
    }
    file
}

/// `select_store` for a record kept with `write_record`, whose chunk keys aren't
/// known up front. The same rules apply: the file wins, and stays until the
/// record has read back from the store.
pub fn select_record_store(native: Option<Arc<dyn SecretStore>>, file: Arc<FileStore>, name: &str) -> Arc<dyn SecretStore> {
    if let Some(native) = native {
        let pointer = pointer_key(name);
        if native.get(&pointer).is_ok() && migrate_record(native.as_ref(), &file, name).is_ok() {
            return native;
        }
    }
    file
}

fn migrate_record(store: &dyn SecretStore, file: &FileStore, name: &str) -> CmdResult<()> {
    let Some(value) = read_record(file, name)? else {
        return Ok(());
    };
    write_record(store, name, &value)?;
    if read_record(store, name)?.as_deref() != Some(value.as_str()) {
        return Err(format!("{name} didn't read back from the credential store"));
    }
    file.remove()
}

/// keyring-core's default store is process-wide, so it is set up once here and
/// shared by everything that keeps secrets.
#[derive(Default)]
pub struct SecretStores {
    native: OnceLock<bool>,
}

impl SecretStores {
    pub fn native(&self) -> Option<Arc<dyn SecretStore>> {
        let available = *self.native.get_or_init(|| init_native_store().is_ok());
        available.then(|| Arc::new(KeyringStore) as Arc<dyn SecretStore>)
    }

    pub fn fallback(&self, app: &AppHandle, file_name: &str) -> CmdResult<Arc<FileStore>> {
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        Ok(Arc::new(FileStore::new(dir.join(file_name))))
    }
}

// ---------------------------------------------------------------------------
// Records too big for one slot

// Windows Credential Manager refuses a secret over 2560 bytes, and may hold it
// as UTF-16. A chunk stays under the limit in either encoding.
const CHUNK_BYTES: usize = 2400;

fn chunks(value: &str) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut size = 0;
    for c in value.chars() {
        let cost = c.len_utf8().max(c.len_utf16() * 2);
        if size + cost > CHUNK_BYTES {
            chunks.push(std::mem::take(&mut current));
            size = 0;
        }
        current.push(c);
        size += cost;
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

fn pointer_key(name: &str) -> String {
    format!("{name}.gen")
}

fn chunk_key(name: &str, generation: u64, index: usize) -> String {
    format!("{name}.{generation}.{index}")
}

/// `(generation, chunk count)` of the committed record, if any.
fn read_pointer(store: &dyn SecretStore, name: &str) -> CmdResult<Option<(u64, usize)>> {
    let Some(pointer) = store.get(&pointer_key(name))? else {
        return Ok(None);
    };
    pointer
        .split_once(':')
        .and_then(|(generation, count)| Some((generation.parse().ok()?, count.parse().ok()?)))
        .map(Some)
        .ok_or_else(|| format!("{name}: unreadable record pointer"))
}

/// Best effort: the pointer has already moved, so these can't be read again.
fn delete_chunks(store: &dyn SecretStore, name: &str, generation: u64, count: usize) {
    for index in 0..count {
        let _ = store.delete(&chunk_key(name, generation, index));
    }
}

/// Writes a record of any size. The new chunks go in under a new generation and
/// only the final pointer write commits them, so a failure part-way leaves the
/// previous record intact. That matters for a refresh token, where the old one
/// stops working the moment the server rotates it.
pub fn write_record(store: &dyn SecretStore, name: &str, value: &str) -> CmdResult<()> {
    let previous = read_pointer(store, name)?;
    let generation = previous.map_or(0, |(generation, _)| generation + 1);
    let parts = chunks(value);
    for (index, part) in parts.iter().enumerate() {
        store.set(&chunk_key(name, generation, index), part)?;
    }
    store.set(&pointer_key(name), &format!("{generation}:{}", parts.len()))?;
    if let Some((generation, count)) = previous {
        delete_chunks(store, name, generation, count);
    }
    Ok(())
}

pub fn read_record(store: &dyn SecretStore, name: &str) -> CmdResult<Option<String>> {
    let Some((generation, count)) = read_pointer(store, name)? else {
        return Ok(None);
    };
    let mut value = String::new();
    for index in 0..count {
        let part = store.get(&chunk_key(name, generation, index))?;
        value.push_str(&part.ok_or_else(|| format!("{name}: missing chunk {index}"))?);
    }
    Ok(Some(value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicU64, Ordering};

    const ID: &str = "installation_id";
    const TOKEN: &str = "token";
    const KEYS: [&str; 2] = [ID, TOKEN];

    // A counter, not the clock: macOS timestamps tick in microseconds, so tests
    // running in parallel could share a directory and delete it under each other.
    fn temp_path() -> PathBuf {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let n = NEXT.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("bibleql-secrets-{}-{n}", std::process::id())).join("secrets.json")
    }

    /// A file holding exactly `json`, the way an older release left it.
    fn file_with(json: &str) -> Arc<FileStore> {
        let path = temp_path();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, json).unwrap();
        Arc::new(FileStore::new(path))
    }

    fn cleanup(file: &FileStore) {
        let _ = fs::remove_dir_all(file.path.parent().unwrap());
    }

    /// An in-memory store whose operations can be made to fail.
    #[derive(Default)]
    struct MemoryStore {
        values: Mutex<HashMap<String, String>>,
        fail_get: bool,
        /// Fail every `set` once this many have succeeded.
        sets_allowed: Option<usize>,
        sets: Mutex<usize>,
        /// Store something other than what was asked.
        corrupt_writes: bool,
    }

    impl MemoryStore {
        fn value(&self, key: &str) -> Option<String> {
            self.values.lock().unwrap().get(key).cloned()
        }
        fn seed(&self, key: &str, value: &str) {
            self.values.lock().unwrap().insert(key.to_owned(), value.to_owned());
        }
        fn len(&self) -> usize {
            self.values.lock().unwrap().len()
        }
    }

    impl SecretStore for MemoryStore {
        fn get(&self, key: &str) -> CmdResult<Option<String>> {
            if self.fail_get {
                return Err("locked".into());
            }
            Ok(self.value(key))
        }
        fn set(&self, key: &str, value: &str) -> CmdResult<()> {
            let mut sets = self.sets.lock().unwrap();
            if self.sets_allowed.is_some_and(|allowed| *sets >= allowed) {
                return Err("store is full".into());
            }
            *sets += 1;
            let stored = if self.corrupt_writes { "garbage" } else { value };
            self.seed(key, stored);
            Ok(())
        }
        fn delete(&self, key: &str) -> CmdResult<()> {
            self.values.lock().unwrap().remove(key);
            Ok(())
        }
    }

    fn select(native: &Arc<MemoryStore>, file: &Arc<FileStore>) -> Arc<dyn SecretStore> {
        select_store(Some(native.clone() as Arc<dyn SecretStore>), file.clone(), &KEYS)
    }

    // -- The file ------------------------------------------------------------

    #[test]
    fn reads_the_file_older_releases_wrote() {
        let file = file_with(r#"{"installation_id":"abc","token":"bql_live_1"}"#);
        assert_eq!(file.get(ID).unwrap().as_deref(), Some("abc"));
        assert_eq!(file.get(TOKEN).unwrap().as_deref(), Some("bql_live_1"));
        cleanup(&file);
    }

    #[test]
    fn reads_a_null_token_from_before_registration() {
        let file = file_with(r#"{"installation_id":"abc","token":null}"#);
        assert_eq!(file.get(ID).unwrap().as_deref(), Some("abc"));
        assert_eq!(file.get(TOKEN).unwrap(), None);
        cleanup(&file);
    }

    // The old store sent every key but the id to `token`, so anything else kept
    // here would have overwritten the BibleQL token.
    #[test]
    fn other_keys_do_not_touch_the_token() {
        let file = file_with(r#"{"installation_id":"abc","token":"bql_live_1"}"#);
        file.set("chatgpt.gen", "0:1").unwrap();
        file.delete("chatgpt.gen").unwrap();
        assert_eq!(file.get(TOKEN).unwrap().as_deref(), Some("bql_live_1"));
        assert_eq!(file.get(ID).unwrap().as_deref(), Some("abc"));
        cleanup(&file);
    }

    #[test]
    fn writing_leaves_no_temp_file_behind() {
        let path = temp_path();
        let file = FileStore::new(path.clone());
        file.set(TOKEN, "secret").unwrap();
        let names: Vec<_> = fs::read_dir(path.parent().unwrap()).unwrap().map(|e| e.unwrap().file_name()).collect();
        assert_eq!(names, vec![path.file_name().unwrap().to_owned()]);
        cleanup(&file);
    }

    #[cfg(unix)]
    #[test]
    fn fallback_file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let path = temp_path();
        let file = FileStore::new(path.clone());
        file.set(TOKEN, "secret").unwrap();
        assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        // Replacing the file must not widen it.
        file.set(TOKEN, "secret2").unwrap();
        assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        cleanup(&file);
    }

    // -- Choosing and migrating ----------------------------------------------

    #[test]
    fn migration_moves_the_identity_and_deletes_the_file() {
        let native = Arc::new(MemoryStore::default());
        let file = file_with(r#"{"installation_id":"abc","token":"bql_live_1"}"#);

        let chosen = select(&native, &file);

        assert_eq!(chosen.get(ID).unwrap().as_deref(), Some("abc"));
        assert_eq!(chosen.get(TOKEN).unwrap().as_deref(), Some("bql_live_1"));
        assert_eq!(native.value(TOKEN).as_deref(), Some("bql_live_1"));
        assert!(!file.path.exists());
        cleanup(&file);
    }

    #[test]
    fn migration_keeps_an_id_that_has_no_token_yet() {
        let native = Arc::new(MemoryStore::default());
        let file = file_with(r#"{"installation_id":"abc","token":null}"#);

        select(&native, &file);

        assert_eq!(native.value(ID).as_deref(), Some("abc"));
        assert_eq!(native.value(TOKEN), None);
        assert!(!file.path.exists());
        cleanup(&file);
    }

    // What the store holds is older: entries left by a build from before the
    // file, or by a run before the store became unavailable.
    #[test]
    fn the_file_wins_over_stale_store_entries() {
        let native = Arc::new(MemoryStore::default());
        native.seed(ID, "old-id");
        native.seed(TOKEN, "old-token");
        let file = file_with(r#"{"installation_id":"new-id","token":null}"#);

        select(&native, &file);

        assert_eq!(native.value(ID).as_deref(), Some("new-id"));
        assert_eq!(native.value(TOKEN), None, "a stale token must not pair with a new id");
        cleanup(&file);
    }

    #[test]
    fn with_no_file_the_store_is_used_and_untouched() {
        let native = Arc::new(MemoryStore::default());
        native.seed(ID, "abc");
        native.seed(TOKEN, "bql_live_1");
        let file = Arc::new(FileStore::new(temp_path()));

        let chosen = select(&native, &file);

        assert_eq!(chosen.get(TOKEN).unwrap().as_deref(), Some("bql_live_1"));
        assert_eq!(native.value(ID).as_deref(), Some("abc"));
        assert_eq!(*native.sets.lock().unwrap(), 0);
    }

    #[test]
    fn a_failed_write_keeps_using_the_file_and_retries_next_run() {
        let failing = Arc::new(MemoryStore { sets_allowed: Some(1), ..Default::default() });
        let file = file_with(r#"{"installation_id":"abc","token":"bql_live_1"}"#);

        let chosen = select(&failing, &file);

        assert_eq!(chosen.get(TOKEN).unwrap().as_deref(), Some("bql_live_1"));
        assert!(file.path.exists());

        // Next launch, the store works again: nothing was lost, the half-written
        // copy is replaced.
        let working = Arc::new(MemoryStore::default());
        working.seed(ID, "abc");
        let chosen = select(&working, &file);
        assert_eq!(chosen.get(TOKEN).unwrap().as_deref(), Some("bql_live_1"));
        assert_eq!(working.value(TOKEN).as_deref(), Some("bql_live_1"));
        assert!(!file.path.exists());
        cleanup(&file);
    }

    #[test]
    fn a_failed_read_back_keeps_using_the_file() {
        let native = Arc::new(MemoryStore { corrupt_writes: true, ..Default::default() });
        let file = file_with(r#"{"installation_id":"abc","token":"bql_live_1"}"#);

        let chosen = select(&native, &file);

        assert_eq!(chosen.get(TOKEN).unwrap().as_deref(), Some("bql_live_1"));
        assert!(file.path.exists());
        cleanup(&file);
    }

    #[test]
    fn a_store_that_cannot_be_read_is_not_migrated_to() {
        let native = Arc::new(MemoryStore { fail_get: true, ..Default::default() });
        let file = file_with(r#"{"installation_id":"abc","token":"bql_live_1"}"#);

        let chosen = select(&native, &file);

        assert_eq!(chosen.get(ID).unwrap().as_deref(), Some("abc"));
        assert_eq!(native.len(), 0);
        assert!(file.path.exists());
        cleanup(&file);
    }

    #[test]
    fn no_store_at_all_uses_the_file() {
        let file = file_with(r#"{"installation_id":"abc","token":"bql_live_1"}"#);
        let chosen = select_store(None, file.clone(), &KEYS);
        assert_eq!(chosen.get(TOKEN).unwrap().as_deref(), Some("bql_live_1"));
        assert!(file.path.exists());
        cleanup(&file);
    }

    // -- Records -------------------------------------------------------------

    #[test]
    fn a_record_round_trips_at_any_size() {
        let store = MemoryStore::default();
        for value in ["", "short", &"x".repeat(CHUNK_BYTES), &"é𝄞a".repeat(5000)] {
            write_record(&store, "chatgpt", value).unwrap();
            assert_eq!(read_record(&store, "chatgpt").unwrap().as_deref(), Some(value));
        }
    }

    #[test]
    fn no_chunk_exceeds_the_windows_limit_in_either_encoding() {
        for part in chunks(&"é𝄞a".repeat(5000)) {
            assert!(part.len() <= 2560);
            assert!(part.encode_utf16().count() * 2 <= 2560);
        }
    }

    #[test]
    fn replacing_a_record_leaves_no_old_chunks() {
        let store = MemoryStore::default();
        write_record(&store, "chatgpt", &"a".repeat(CHUNK_BYTES * 3)).unwrap();
        write_record(&store, "chatgpt", "b").unwrap();
        // The pointer and the one chunk.
        assert_eq!(store.len(), 2);
    }

    #[test]
    fn a_failed_write_leaves_the_previous_record_readable() {
        let store = MemoryStore { sets_allowed: Some(3), ..Default::default() };
        write_record(&store, "chatgpt", "old").unwrap(); // 2 sets: chunk, pointer.

        // One more chunk gets in, then the store fails before the pointer moves.
        assert!(write_record(&store, "chatgpt", &"n".repeat(CHUNK_BYTES * 2)).is_err());

        assert_eq!(read_record(&store, "chatgpt").unwrap().as_deref(), Some("old"));
    }

    #[test]
    fn a_stale_generation_left_by_a_crash_is_overwritten() {
        let store = MemoryStore::default();
        write_record(&store, "chatgpt", "committed").unwrap();
        store.seed("chatgpt.1.0", "from an attempt that never committed");

        write_record(&store, "chatgpt", "next").unwrap();

        assert_eq!(read_record(&store, "chatgpt").unwrap().as_deref(), Some("next"));
    }

    #[test]
    fn a_missing_chunk_is_an_error_not_a_signed_out_account() {
        let store = MemoryStore::default();
        write_record(&store, "chatgpt", "value").unwrap();
        store.delete("chatgpt.0.0").unwrap();
        assert!(read_record(&store, "chatgpt").is_err());
    }

    #[test]
    fn records_do_not_disturb_other_keys() {
        let store = MemoryStore::default();
        store.seed(TOKEN, "bql_live_1");
        write_record(&store, "chatgpt", "value").unwrap();
        write_record(&store, "chatgpt", "value2").unwrap();
        assert_eq!(store.value(TOKEN).as_deref(), Some("bql_live_1"));
    }

    // -- Choosing a store for a record ---------------------------------------

    fn select_record(native: &Arc<MemoryStore>, file: &Arc<FileStore>) -> Arc<dyn SecretStore> {
        select_record_store(Some(native.clone() as Arc<dyn SecretStore>), file.clone(), "chatgpt")
    }

    fn file_with_record(value: &str) -> Arc<FileStore> {
        let file = Arc::new(FileStore::new(temp_path()));
        write_record(file.as_ref(), "chatgpt", value).unwrap();
        file
    }

    #[test]
    fn a_record_moves_from_the_file_to_the_store_whole() {
        let value = "r".repeat(CHUNK_BYTES * 3);
        let native = Arc::new(MemoryStore::default());
        let file = file_with_record(&value);

        let chosen = select_record(&native, &file);

        assert_eq!(read_record(chosen.as_ref(), "chatgpt").unwrap().as_deref(), Some(value.as_str()));
        assert_eq!(read_record(native.as_ref(), "chatgpt").unwrap().as_deref(), Some(value.as_str()));
        assert!(!file.path.exists());
        cleanup(&file);
    }

    #[test]
    fn a_record_in_the_file_replaces_an_older_one_in_the_store() {
        let native = Arc::new(MemoryStore::default());
        write_record(native.as_ref(), "chatgpt", "older").unwrap();
        let file = file_with_record("newer");

        select_record(&native, &file);

        assert_eq!(read_record(native.as_ref(), "chatgpt").unwrap().as_deref(), Some("newer"));
        cleanup(&file);
    }

    #[test]
    fn a_failed_record_move_keeps_using_the_file() {
        let native = Arc::new(MemoryStore { sets_allowed: Some(1), ..Default::default() });
        let file = file_with_record(&"r".repeat(CHUNK_BYTES * 3));

        let chosen = select_record(&native, &file);

        assert!(file.path.exists());
        assert_eq!(read_record(chosen.as_ref(), "chatgpt").unwrap().map(|v| v.len()), Some(CHUNK_BYTES * 3));
        assert_eq!(read_record(native.as_ref(), "chatgpt").unwrap(), None);
        cleanup(&file);
    }

    #[test]
    fn with_no_record_in_the_file_the_store_is_used_untouched() {
        let native = Arc::new(MemoryStore::default());
        write_record(native.as_ref(), "chatgpt", "kept").unwrap();
        let sets = *native.sets.lock().unwrap();
        let file = Arc::new(FileStore::new(temp_path()));

        let chosen = select_record(&native, &file);

        assert_eq!(read_record(chosen.as_ref(), "chatgpt").unwrap().as_deref(), Some("kept"));
        assert_eq!(*native.sets.lock().unwrap(), sets);
    }
}
