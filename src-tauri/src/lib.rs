mod offline;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // opener: attribution links go to the user's browser, never an
        // in-app window (Unsplash API guidelines) — see src/lib/externalLinks.ts.
        .plugin(tauri_plugin_opener::init())
        // dialog + fs: the native "Save As" for the Image Creator export.
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // http: only api.anthropic.com goes through the plugin's JS API — it
        // rejects browser-origin requests (offline.rs reuses its reqwest). BibleQL and Unsplash both send
        // `access-control-allow-origin: *`, so they use plain `fetch`.
        .plugin(tauri_plugin_http::init())
        // os: `platform()` for the macOS-only frameless title bar.
        .plugin(tauri_plugin_os::init())
        // Offline translation packages: download, verify, and query the
        // downloaded SQLite files. App commands need no capability entry.
        .manage(offline::OfflineState::default())
        .invoke_handler(tauri::generate_handler![
            offline::offline_list,
            offline::offline_install,
            offline::offline_cancel,
            offline::offline_remove,
            offline::offline_passage,
            offline::offline_search,
            offline::offline_concordance
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
