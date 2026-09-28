#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // opener: attribution links go to the user's browser, never an
        // in-app window (Unsplash API guidelines) — see src/lib/externalLinks.ts.
        .plugin(tauri_plugin_opener::init())
        // dialog + fs: the native "Save As" for the Image Creator export.
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // http: only api.anthropic.com goes through Rust — it rejects
        // browser-origin requests. BibleQL and Unsplash both send
        // `access-control-allow-origin: *`, so they use plain `fetch`.
        .plugin(tauri_plugin_http::init())
        // os: `platform()` for the macOS-only frameless title bar.
        .plugin(tauri_plugin_os::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
