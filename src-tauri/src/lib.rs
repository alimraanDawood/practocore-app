/// Grant the webview microphone access on Linux.
///
/// Voice mode calls `navigator.mediaDevices.getUserMedia`. WebKitGTK routes
/// that through the `permission-request` signal, and a webview with no handler
/// attached denies by default — the promise rejects with `NotAllowedError` and
/// the user sees "Microphone access was blocked" with no prompt to accept.
///
/// wry (0.54) does not attach one: its whole permission story lives in the
/// Android backend, and `src/webkitgtk` never touches `enable-media-stream` or
/// the signal. So the handler has to be attached here, on the platform webview.
///
/// Only user-media requests are granted. Everything else (geolocation,
/// notifications, DRM) returns `false` so WebKit keeps its default handling
/// rather than being silently auto-approved.
#[cfg(target_os = "linux")]
fn allow_microphone(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    window.with_webview(|webview| {
        use webkit2gtk::glib::prelude::ObjectExt;
        use webkit2gtk::{
            PermissionRequestExt, SettingsExt, UserMediaPermissionRequest, WebViewExt,
        };

        let webview = webview.inner();

        // Belt and braces: the signal handler is the part that was actually
        // denying us, but `enable-media-stream` is what decides whether
        // `navigator.mediaDevices` exists at all, and its default has moved
        // around between WebKitGTK releases.
        if let Some(settings) = WebViewExt::settings(&webview) {
            settings.set_enable_media_stream(true);
            settings.set_enable_media(true);
        }

        webview.connect_permission_request(|_, request| {
            if request.is::<UserMediaPermissionRequest>() {
                request.allow();
                true
            } else {
                false
            }
        });
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    allow_microphone(&window)?;
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
