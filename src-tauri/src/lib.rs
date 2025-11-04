use std::sync::Mutex;
use tauri::async_runtime::spawn;
use tauri::{AppHandle, Manager, State};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
  .manage(Mutex::new(SetupState {
            frontend_task: false,
            backend_task: false,
        }))
    .invoke_handler(tauri::generate_handler![set_complete, show_login_window, login_complete])  
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

struct SetupState {
    frontend_task: bool,
    backend_task: bool,
}

#[tauri::command]
async fn set_complete(
    app: AppHandle,
    state: State<'_, Mutex<SetupState>>,
    task: String,
) -> Result<(), ()> {
    // Lock the state without write access
    let mut state_lock = state.lock().unwrap();
    match task.as_str() {
      "frontend" => state_lock.frontend_task = true,
      "backend" => state_lock.backend_task = true,
      _ => panic!("invalid task completed!"),
    }
    
    // Check if both tasks are completed
    if state_lock.frontend_task {
        // Setup is complete, we can close the splashscreen
        // and unhide the main window!
        let splash_window = app.get_webview_window("splashscreen").unwrap();
        let main_window = app.get_webview_window("main").unwrap();
        splash_window.close().unwrap();
        main_window.show().unwrap();
    }
    Ok(())
}

#[tauri::command]
async fn show_login_window(app: AppHandle) -> Result<(), ()> {
    // Close splashscreen and show login window
    let splash_window = app.get_webview_window("splashscreen").unwrap();
    let login_window = app.get_webview_window("login").unwrap();
    splash_window.close().unwrap();
    login_window.show().unwrap();
    Ok(())
}

#[tauri::command]
async fn login_complete(app: AppHandle) -> Result<(), ()> {
    // Close login window and show main window
    let login_window = app.get_webview_window("login").unwrap();
    let main_window = app.get_webview_window("main").unwrap();
    login_window.close().unwrap();
    main_window.eval("window.location.replace('/')");
    main_window.show().unwrap();
    Ok(())
}