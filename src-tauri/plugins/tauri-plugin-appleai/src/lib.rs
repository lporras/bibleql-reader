// Apple Intelligence: the on-device model behind Apple's Foundation Models
// framework (iOS/iPadOS/macOS 26+), as a third provider for the AI Assistant.
// The Swift that talks to it lives in core/ and is shared by two thin adapters:
//
// - iOS: ios/, an ordinary Tauri mobile plugin (as plugins/tauri-plugin-quicklook).
// - macOS: macos/, C functions linked in by build.rs, since desktop Tauri has no
//   Swift plugin host. The callbacks below turn them into a Channel.
//
// Everywhere else, and on an OS older than 26, `availability` says
// "unsupportedOS" and the frontend never offers the provider. The model runs on
// the device: nothing here makes a network request. See docs/apple-intelligence.md.

use serde_json::Value;
use tauri::{
    ipc::Channel,
    plugin::{Builder, TauriPlugin},
    AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
use tauri::Manager;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_appleai);

#[cfg(target_os = "ios")]
struct AppleAi<R: Runtime>(tauri::plugin::PluginHandle<R>);

#[cfg(target_os = "ios")]
#[derive(serde::Serialize)]
struct AvailabilityArgs {
    locale: String,
}

#[cfg(target_os = "ios")]
#[derive(serde::Deserialize)]
struct AvailabilityReply {
    status: String,
}

#[cfg(target_os = "ios")]
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RespondArgs {
    instructions: String,
    prompt: String,
    on_event: Channel<Value>,
}

/// Whether the model can answer in `locale` ("en", "es"): `available`, or why not.
#[tauri::command]
async fn availability<R: Runtime>(app: AppHandle<R>, locale: String) -> Result<String, String> {
    #[cfg(target_os = "ios")]
    {
        app.state::<AppleAi<R>>()
            .0
            .run_mobile_plugin::<AvailabilityReply>("availability", AvailabilityArgs { locale })
            .map(|reply| reply.status)
            .map_err(|e| e.to_string())
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        macos::availability(&locale)
    }
    #[cfg(not(any(target_os = "ios", target_os = "macos")))]
    {
        let _ = (app, locale);
        Ok("unsupportedOS".into())
    }
}

/// Starts one reply and returns; its events arrive on `on_event`, ending with
/// exactly one `completed` or `failed`.
#[tauri::command]
async fn respond<R: Runtime>(
    app: AppHandle<R>,
    instructions: String,
    prompt: String,
    on_event: Channel<Value>,
) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        app.state::<AppleAi<R>>()
            .0
            .run_mobile_plugin::<()>(
                "respond",
                RespondArgs {
                    instructions,
                    prompt,
                    on_event,
                },
            )
            .map_err(|e| e.to_string())
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        macos::respond(&instructions, &prompt, on_event)
    }
    #[cfg(not(any(target_os = "ios", target_os = "macos")))]
    {
        let _ = (app, instructions, prompt, on_event);
        Err("unsupportedOS".into())
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use serde_json::{json, Value};
    use std::ffi::{c_char, c_void, CStr, CString};
    use tauri::ipc::Channel;

    type Callback = extern "C" fn(*mut c_void, *const c_char);

    // macos/Sources/AppleAIMac/Bridge.swift
    extern "C" {
        fn appleai_availability(locale: *const c_char, context: *mut c_void, callback: Callback);
        fn appleai_respond(
            instructions: *const c_char,
            prompt: *const c_char,
            context: *mut c_void,
            callback: Callback,
        );
    }

    fn c_string(text: &str) -> Result<CString, String> {
        CString::new(text).map_err(|_| "invalid_input".to_string())
    }

    /// `context` is the `String` that `availability` is waiting to fill.
    extern "C" fn write_status(context: *mut c_void, text: *const c_char) {
        // SAFETY: Swift calls this synchronously, inside appleai_availability,
        // with the pointer passed below and a valid C string.
        unsafe {
            *(context as *mut String) = CStr::from_ptr(text).to_string_lossy().into_owned();
        }
    }

    pub fn availability(locale: &str) -> Result<String, String> {
        let locale = c_string(locale)?;
        let mut status = String::new();
        // SAFETY: `status` outlives the call, and the callback runs before it returns.
        unsafe {
            appleai_availability(
                locale.as_ptr(),
                &mut status as *mut String as *mut c_void,
                write_status,
            )
        };
        Ok(status)
    }

    /// `context` is a boxed Channel, owned by the reply until its final event.
    extern "C" fn forward_event(context: *mut c_void, text: *const c_char) {
        // SAFETY: `context` came from Box::into_raw in `respond` and is freed
        // only here, on the final event, which the Swift side sends exactly once
        // and last. `text` is a valid C string for the duration of the call.
        unsafe {
            let raw = CStr::from_ptr(text).to_string_lossy();
            let event: Value = serde_json::from_str(&raw)
                .unwrap_or_else(|_| json!({ "type": "failed", "code": "unknown" }));
            let last = matches!(event["type"].as_str(), Some("completed" | "failed"));
            let channel = context as *mut Channel<Value>;
            let _ = (*channel).send(event);
            if last {
                drop(Box::from_raw(channel));
            }
        }
    }

    pub fn respond(instructions: &str, prompt: &str, on_event: Channel<Value>) -> Result<(), String> {
        let instructions = c_string(instructions)?;
        let prompt = c_string(prompt)?;
        let context = Box::into_raw(Box::new(on_event)) as *mut c_void;
        // SAFETY: the strings are copied before appleai_respond returns, and
        // `context` stays alive until forward_event frees it.
        unsafe { appleai_respond(instructions.as_ptr(), prompt.as_ptr(), context, forward_event) };
        Ok(())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("appleai")
        .invoke_handler(tauri::generate_handler![availability, respond])
        .setup(|_app, _api| {
            #[cfg(target_os = "ios")]
            {
                let handle = _api.register_ios_plugin(init_plugin_appleai)?;
                _app.manage(AppleAi(handle));
            }
            Ok(())
        })
        .build()
}
