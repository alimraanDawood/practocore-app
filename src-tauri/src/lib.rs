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

// The background notification listener (PocketBase realtime → native OS toast),
// desktop-only.
#[cfg(desktop)]
mod notifications;

/// Tracks whether a *real* quit was requested (the tray "Quit" item), so the
/// window-close handler can tell it apart from the user clicking the window's
/// close button. Without this flag every close — including the deliberate quit —
/// would be intercepted and turned into hide-to-tray, and the app could never
/// actually exit.
#[cfg(desktop)]
#[derive(Default)]
struct TrayState {
    quitting: std::sync::atomic::AtomicBool,
}

/// Show, un-minimise and focus the main window. Used by every "bring the app
/// back" path (tray left-click, the Open menu item, opening settings).
#[cfg(desktop)]
fn show_main(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Build the system-tray icon and its menu.
///
/// The tray is what makes "keep listening in the background" possible: closing
/// the window hides it to the tray (see the CloseRequested handler) rather than
/// quitting, so the webview stays alive and its PocketBase realtime
/// subscription keeps delivering notifications, which the frontend then renders
/// as native OS toasts.
#[cfg(desktop)]
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use std::sync::atomic::Ordering;
    use tauri::{
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
        Emitter, Manager,
    };

    let open_i = MenuItem::with_id(app, "open", "Open PractoCore", true, None::<&str>)?;
    let settings_i = MenuItem::with_id(
        app,
        "settings",
        "Notification settings",
        true,
        None::<&str>,
    )?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_i, &settings_i, &sep, &quit_i])?;

    TrayIconBuilder::with_id("main")
        // Reuse the bundle's window icon so the tray matches the app; avoids
        // shipping a separate tray asset and pulling in image-decode features.
        .icon(app.default_window_icon().cloned().expect("no window icon"))
        .tooltip("PractoCore")
        // Left-click restores the window; the menu is reserved for right-click
        // so a stray left-click doesn't pop a menu the user didn't want.
        .show_menu_on_left_click(false)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "settings" => {
                show_main(app);
                // The frontend listens for this and routes to the notification
                // settings page (utils/notificationRoute + the settings view).
                let _ = app.emit("tray://open-settings", ());
            }
            "quit" => {
                app.state::<TrayState>().quitting.store(true, Ordering::Relaxed);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
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

    builder = builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        // Cross-platform: the frontend calls this plugin's JS bindings to render
        // an OS toast for each incoming notification.
        .plugin(tauri_plugin_notification::init());

    // Autostart, the tray state, and the background notification listener are
    // desktop-only; mobile has none of them.
    #[cfg(desktop)]
    {
        builder = builder
            .manage(TrayState::default())
            .manage(notifications::NotifierState::default())
            .invoke_handler(tauri::generate_handler![
                notifications::start_notification_listener,
                notifications::stop_notification_listener,
            ])
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ));
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            setup_tray(app)?;

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
        // Close-to-tray: intercept the window's close button and hide the window
        // instead of letting the process exit, so the app keeps listening. The
        // tray "Quit" item sets `quitting` first, so a real quit still exits.
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                use std::sync::atomic::Ordering;
                use tauri::Manager;
                let app = window.app_handle();
                if !app.state::<TrayState>().quitting.load(Ordering::Relaxed) {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
