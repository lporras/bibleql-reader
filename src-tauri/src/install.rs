//! Per-installation BibleQL credentials — see docs/installation-keys.md.
//!
//! Each install registers itself with BibleQL (`registerInstallation`, done
//! by the frontend in src/lib/installation.ts) and gets its own token. This
//! module only keeps the installation id and that token, in secret_store.rs.
//!
//! When the credential store can't be reached they go in a 0600 JSON file in
//! the app data dir instead. Failing instead would make the app register again
//! on every launch, revoking the previous token each time and burning the
//! server's 10-per-hour registration limit.

use std::sync::{Arc, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::secret_store::{select_store, CmdResult, SecretStore, SecretStores};

const ID_KEY: &str = "installation_id";
const TOKEN_KEY: &str = "token";
const FALLBACK_FILE: &str = "installation.json";

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

/// Which store this run uses, decided on first use. The choice can move the
/// fallback file's contents into the credential store, so concurrent first
/// callers wait inside `get_or_init` rather than each running that move.
#[derive(Default)]
pub struct InstallState {
    store: OnceLock<Arc<dyn SecretStore>>,
}

impl InstallState {
    fn store(&self, app: &AppHandle) -> CmdResult<Arc<dyn SecretStore>> {
        if let Some(store) = self.store.get() {
            return Ok(store.clone());
        }
        let stores = app.state::<SecretStores>();
        let file = stores.fallback(app, FALLBACK_FILE)?;
        Ok(self.store.get_or_init(|| select_store(stores.native(), file, &[ID_KEY, TOKEN_KEY])).clone())
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
    use crate::secret_store::FileStore;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    // A counter, not the clock: macOS timestamps tick in microseconds, so tests
    // running in parallel could share a directory and delete it under each other.
    fn temp_path() -> PathBuf {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let n = NEXT.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("bibleql-install-{}-{n}", std::process::id())).join(FALLBACK_FILE)
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
}
