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
    let mut builder = tauri::Builder::default();

    // Single-instance MUST be the first plugin registered, and is desktop-only.
    // Its callback fires in the ORIGINAL process when a second launch happens
    // (e.g. the OS starting a new process to hand off a practocore:// link); the
    // `deep-link` feature forwards that URL into the deep-link plugin, so the
    // empty body here is deliberate — we don't need to do anything extra.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
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

            // On Linux/Windows the practocore:// scheme is not registered with
            // the OS by an installer during development, so register it at
            // runtime. macOS reads the scheme from the bundle's Info.plist and
            // needs no runtime call. Harmless to re-run on an installed app.
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
