use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tauri::async_runtime::spawn;
use tauri::{AppHandle, Manager, State, Emitter};
use tokio::time::{sleep, Duration};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
  .manage(Mutex::new(SetupState {
            frontend_task: false,
            backend_task: false,
        }))
    .manage(Arc::new(Mutex::new(NotificationScheduler::new())))
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![
        set_complete,
        show_login_window,
        login_complete,
        schedule_notification,
        cancel_notification,
        cancel_notifications,
        get_pending_notifications,
        clear_all_notifications
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Start notification scheduler
      let scheduler = app.state::<Arc<Mutex<NotificationScheduler>>>();
      let scheduler_arc = Arc::clone(&scheduler.inner());
      let app_handle = app.handle().clone();
      spawn(async move {
          notification_scheduler_loop(scheduler_arc, app_handle).await;
      });

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
    let _ = main_window.eval("window.location.replace('/')");
    main_window.show().unwrap();
    Ok(())
}

// Notification structures
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ScheduledNotification {
    id: i32,
    title: String,
    body: String,
    #[serde(rename = "scheduleAt")]
    schedule_at: i64, // Unix timestamp in milliseconds
    extra: Option<serde_json::Value>,
}

struct NotificationScheduler {
    notifications: HashMap<i32, ScheduledNotification>,
}

impl NotificationScheduler {
    fn new() -> Self {
        Self {
            notifications: HashMap::new(),
        }
    }

    fn add(&mut self, notification: ScheduledNotification) {
        self.notifications.insert(notification.id, notification);
    }

    fn remove(&mut self, id: i32) -> Option<ScheduledNotification> {
        self.notifications.remove(&id)
    }

    fn get_pending(&self) -> Vec<ScheduledNotification> {
        let now = chrono::Utc::now().timestamp_millis();
        self.notifications
            .values()
            .filter(|n| n.schedule_at > now)
            .cloned()
            .collect()
    }

    fn get_due(&mut self) -> Vec<ScheduledNotification> {
        let now = chrono::Utc::now().timestamp_millis();
        let due_ids: Vec<i32> = self.notifications
            .iter()
            .filter(|(_, n)| n.schedule_at <= now)
            .map(|(id, _)| *id)
            .collect();

        due_ids
            .into_iter()
            .filter_map(|id| self.remove(id))
            .collect()
    }

    fn clear(&mut self) {
        self.notifications.clear();
    }
}

// Notification scheduler background loop
async fn notification_scheduler_loop(
    scheduler: Arc<Mutex<NotificationScheduler>>,
    app: AppHandle,
) {
    loop {
        // Check every 10 seconds for due notifications
        sleep(Duration::from_secs(10)).await;

        let due_notifications = {
            let mut scheduler = scheduler.lock().unwrap();
            scheduler.get_due()
        };

        for notification in due_notifications {
            // Send notification using notify-rust (backend for tauri-plugin-notification)
            use tauri_plugin_notification::NotificationExt;

            if let Err(e) = app.notification()
                .builder()
                .title(&notification.title)
                .body(&notification.body)
                .show() {
                log::error!("Failed to show notification: {:?}", e);
            }

            // Emit event to frontend for in-app handling
            if let Err(e) = app.emit("notification-received", &notification) {
                log::error!("Failed to emit notification event: {:?}", e);
            }
        }
    }
}

// Tauri commands for notification management
#[tauri::command]
async fn schedule_notification(
    scheduler: State<'_, Arc<Mutex<NotificationScheduler>>>,
    notification: ScheduledNotification,
) -> Result<(), String> {
    let mut scheduler = scheduler.lock().unwrap();
    scheduler.add(notification);
    Ok(())
}

#[tauri::command]
async fn cancel_notification(
    scheduler: State<'_, Arc<Mutex<NotificationScheduler>>>,
    id: i32,
) -> Result<(), String> {
    let mut scheduler = scheduler.lock().unwrap();
    scheduler.remove(id);
    Ok(())
}

#[tauri::command]
async fn cancel_notifications(
    scheduler: State<'_, Arc<Mutex<NotificationScheduler>>>,
    ids: Vec<i32>,
) -> Result<(), String> {
    let mut scheduler = scheduler.lock().unwrap();
    for id in ids {
        scheduler.remove(id);
    }
    Ok(())
}

#[tauri::command]
async fn get_pending_notifications(
    scheduler: State<'_, Arc<Mutex<NotificationScheduler>>>,
) -> Result<Vec<ScheduledNotification>, String> {
    let scheduler = scheduler.lock().unwrap();
    Ok(scheduler.get_pending())
}

#[tauri::command]
async fn clear_all_notifications(
    scheduler: State<'_, Arc<Mutex<NotificationScheduler>>>,
) -> Result<(), String> {
    let mut scheduler = scheduler.lock().unwrap();
    scheduler.clear();
    Ok(())
}