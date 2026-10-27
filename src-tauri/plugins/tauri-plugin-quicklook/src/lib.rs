// Quick Look: Apple's in-app document viewer (pages, zoom, markup, print,
// share — and "Open in Preview" from its share button). iOS has no
// documented way to open a file in another app's viewer, so after a study
// PDF is saved, src/platform/tauri.ts shows it here instead of calling the
// opener plugin, whose open_path on iOS is a UIApplication.open that does
// nothing for a file. On every other platform the command just errors; the
// frontend only invokes it on iOS.

use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
use tauri::Manager;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_quicklook);

#[cfg(target_os = "ios")]
struct QuickLook<R: Runtime>(tauri::plugin::PluginHandle<R>);

#[cfg(target_os = "ios")]
#[derive(serde::Serialize)]
struct PreviewArgs {
    path: String,
}

/// `path` is what the save dialog returned: a `file://` URL on iOS.
#[tauri::command]
async fn preview<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        app.state::<QuickLook<R>>()
            .0
            .run_mobile_plugin::<()>("preview", PreviewArgs { path })
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = (app, path);
        Err("Quick Look is only available on iOS".into())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("quicklook")
        .invoke_handler(tauri::generate_handler![preview])
        .setup(|_app, _api| {
            #[cfg(target_os = "ios")]
            {
                let handle = _api.register_ios_plugin(init_plugin_quicklook)?;
                _app.manage(QuickLook(handle));
            }
            Ok(())
        })
        .build()
}
