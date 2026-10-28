//! Per-installation BibleQL credentials — see docs/installation-keys.md.
//!
//! Each install registers itself with BibleQL (`registerInstallation`, done
//! by the frontend in src/lib/installation.ts) and gets its own token. This
//! module only keeps the installation id and that token, in the OS
//! credential store: Keychain on iOS, Credential Manager on Windows, the
//! Secret Service on Linux, and Keystore-encrypted SharedPreferences on
//! Android.
//!
//! macOS, and any credential store that can't be reached (a Linux desktop
//! with no Secret Service daemon, say), use a 0600 JSON file in the app
//! data dir instead. Failing instead would make the app register again on every
//! launch, revoking the previous token each time and burning the server's
//! 10-per-hour registration limit.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

const SERVICE: &str = "org.bibleql.reader";
const ID_KEY: &str = "installation_id";
const TOKEN_KEY: &str = "token";
const FALLBACK_FILE: &str = "installation.json";

type CmdResult<T> = Result<T, String>;

/// One secret slot per key. Implemented by the OS credential store and by
/// the fallback file, and by an in-memory map in the tests.
trait SecretStore: Send + Sync {
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

/// macOS gets no store, so it always uses the fallback file. The login
/// keychain ties an item's access to the code signature of the app that
/// created it, and an ad-hoc signed build (no Developer ID) has no stable
/// signature: after every update, macOS would ask for the login password
/// before handing the token back. Revisit once releases are Developer ID
/// signed.
#[cfg(target_os = "macos")]
fn init_native_store() -> keyring_core::Result<()> {
    Err(keyring_core::Error::NotSupportedByStore("macOS keychain".into()))
}

/// Installs this platform's credential store as keyring-core's default.
#[cfg(not(target_os = "macos"))]
fn init_native_store() -> keyring_core::Result<()> {
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

#[derive(Default, Serialize, Deserialize)]
struct FileContents {
    installation_id: Option<String>,
    token: Option<String>,
}

struct FileStore {
    path: PathBuf,
    lock: Mutex<()>,
}

impl FileStore {
    fn new(path: PathBuf) -> Self {
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
}

fn slot<'a>(contents: &'a mut FileContents, key: &str) -> &'a mut Option<String> {
    if key == ID_KEY {
        &mut contents.installation_id
    } else {
        &mut contents.token
    }
}

impl SecretStore for FileStore {
    fn get(&self, key: &str) -> CmdResult<Option<String>> {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        Ok(slot(&mut self.read(), key).clone())
    }

    fn set(&self, key: &str, value: &str) -> CmdResult<()> {
        self.update(|c| *slot(c, key) = Some(value.to_owned()))
    }

    fn delete(&self, key: &str) -> CmdResult<()> {
        self.update(|c| *slot(c, key) = None)
    }
}

/// Owner read/write only, set at creation so the token is never briefly
/// world-readable.
#[cfg(unix)]
fn write_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    let mut file = fs::OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(path)?;
    file.write_all(bytes)
}

#[cfg(not(unix))]
fn write_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    fs::write(path, bytes)
}

// ---------------------------------------------------------------------------
// Logic shared by the commands

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallIdentity {
    installation_id: String,
    token: Option<String>,
}

/// The installation id is generated once and then never changes, so that
/// re-registering revokes this install's old token on the server.
fn identity(store: &dyn SecretStore) -> CmdResult<InstallIdentity> {
    let installation_id = match store.get(ID_KEY)? {
        Some(id) => id,
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            store.set(ID_KEY, &id)?;
            id
        }
    };
    Ok(InstallIdentity { installation_id, token: store.get(TOKEN_KEY)? })
}

/// Which store this run uses, decided on first use: the OS credential store
/// if it initializes and answers a read, the fallback file otherwise.
#[derive(Default)]
pub struct InstallState {
    store: OnceLock<Arc<dyn SecretStore>>,
}

impl InstallState {
    fn store(&self, app: &AppHandle) -> CmdResult<Arc<dyn SecretStore>> {
        if let Some(store) = self.store.get() {
            return Ok(store.clone());
        }
        let keyring_ok = init_native_store().is_ok() && KeyringStore.get(ID_KEY).is_ok();
        let store: Arc<dyn SecretStore> = if keyring_ok {
            Arc::new(KeyringStore)
        } else {
            let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            Arc::new(FileStore::new(dir.join(FALLBACK_FILE)))
        };
        Ok(self.store.get_or_init(|| store).clone())
    }
}

// ---------------------------------------------------------------------------
// Commands
//
// Credential-store calls can block (a Keychain or Secret Service prompt), so
// they run on the blocking pool rather than the main thread.

async fn with_store<T: Send + 'static>(
    app: AppHandle,
    state: State<'_, InstallState>,
    f: impl FnOnce(&dyn SecretStore) -> CmdResult<T> + Send + 'static,
) -> CmdResult<T> {
    let store = state.store(&app)?;
    tauri::async_runtime::spawn_blocking(move || f(store.as_ref()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_install_token(app: AppHandle, state: State<'_, InstallState>) -> CmdResult<InstallIdentity> {
    with_store(app, state, identity).await
}

#[tauri::command]
pub async fn set_install_token(app: AppHandle, state: State<'_, InstallState>, token: String) -> CmdResult<()> {
    with_store(app, state, move |store| store.set(TOKEN_KEY, &token)).await
}

#[tauri::command]
pub async fn clear_install_token(app: AppHandle, state: State<'_, InstallState>) -> CmdResult<()> {
    with_store(app, state, |store| store.delete(TOKEN_KEY)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_path() -> PathBuf {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("bibleql-install-{}-{nanos}", std::process::id())).join(FALLBACK_FILE)
    }

    #[test]
    fn identity_generates_a_stable_uuid() {
        let path = temp_path();
        let store = FileStore::new(path.clone());
        let first = identity(&store).unwrap();
        assert!(uuid::Uuid::parse_str(&first.installation_id).is_ok());
        assert_eq!(first.token, None);
        assert_eq!(identity(&store).unwrap().installation_id, first.installation_id);
        // A fresh store over the same file sees the same id: it survives a relaunch.
        assert_eq!(identity(&FileStore::new(path.clone())).unwrap().installation_id, first.installation_id);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn token_round_trips_and_clears_without_touching_the_id() {
        let path = temp_path();
        let store = FileStore::new(path.clone());
        let id = identity(&store).unwrap().installation_id;
        store.set(TOKEN_KEY, "bql_test_abc").unwrap();
        assert_eq!(identity(&store).unwrap().token.as_deref(), Some("bql_test_abc"));
        store.delete(TOKEN_KEY).unwrap();
        let after = identity(&store).unwrap();
        assert_eq!(after.token, None);
        assert_eq!(after.installation_id, id);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn fallback_file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let path = temp_path();
        FileStore::new(path.clone()).set(TOKEN_KEY, "secret").unwrap();
        assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }
}
