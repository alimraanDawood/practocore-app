//! Background notification listener.
//!
//! Runs entirely in Rust, independent of the webview. It holds a PocketBase
//! realtime (SSE) connection to the `Notifications` collection using the
//! signed-in user's token (handed over from the frontend) and renders each
//! incoming notification as a native OS toast. Because it lives in the Tauri
//! process — kept alive by the tray — it keeps delivering while the window is
//! closed and does not depend on the webview's JS running.
//!
//! PocketBase realtime protocol:
//!   1. GET  /api/realtime  → SSE; first frame `event: PB_CONNECT` carries a
//!      `clientId`.
//!   2. POST /api/realtime  with `{clientId, subscriptions:["Notifications/*"]}`
//!      and the user's token as the Authorization header. The topic MUST carry a
//!      record suffix (`/*` = whole collection); PB matches subscriber topics
//!      against `collection/recordId` patterns, so a bare `"Notifications"` gets
//!      a 200 but is never routed any events. The server applies the collection's
//!      viewRule with that token, so we only receive this user's notifications.
//!   3. Events stream back with the event name set to the *topic* —
//!      `event: Notifications/*` — and `data: {action, record}`.

use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Duration;

use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use serde_json::{json, Value};
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;

/// Holds the running listener task so a new start can replace it and a sign-out
/// can abort it.
#[derive(Default)]
pub struct NotifierState {
    handle: Mutex<Option<JoinHandle<()>>>,
}

/// Start (or restart) the background listener with a fresh token. Called by the
/// frontend on sign-in and on every token refresh; aborting any prior task means
/// a refreshed token cleanly replaces the old connection.
#[tauri::command]
pub fn start_notification_listener(
    app: AppHandle,
    state: State<'_, NotifierState>,
    base_url: String,
    token: String,
) {
    let mut guard = state.handle.lock().unwrap();
    if let Some(existing) = guard.take() {
        existing.abort();
    }
    let app_for_task = app.clone();
    let handle = tauri::async_runtime::spawn(async move {
        run_listener(app_for_task, base_url, token).await;
    });
    *guard = Some(handle);
    log::info!("[notifier] listener started");
}

/// Stop the listener (sign-out).
#[tauri::command]
pub fn stop_notification_listener(state: State<'_, NotifierState>) {
    if let Some(existing) = state.handle.lock().unwrap().take() {
        existing.abort();
        log::info!("[notifier] listener stopped");
    }
}

/// Reconnect loop with exponential backoff. The task is aborted (not signalled)
/// on stop/replace, so it simply ends at the next await point.
async fn run_listener(app: AppHandle, base_url: String, token: String) {
    let base = base_url.trim_end_matches('/').to_string();
    let mut backoff = 1u64;
    loop {
        match run_connection(&app, &base, &token).await {
            Ok(()) => {
                log::info!("[notifier] realtime stream closed; reconnecting");
                backoff = 1;
            }
            Err(e) => log::warn!("[notifier] connection error: {e}"),
        }
        tokio::time::sleep(Duration::from_secs(backoff)).await;
        backoff = (backoff * 2).min(30);
    }
}

async fn run_connection(app: &AppHandle, base: &str, token: &str) -> Result<(), String> {
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("{base}/api/realtime"))
        .header(reqwest::header::ACCEPT, "text/event-stream")
        .send()
        .await
        .map_err(|e| format!("connect: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("connect status {}", resp.status()));
    }

    let mut stream = resp.bytes_stream().eventsource();
    // Dedup within a connection: a fresh notification can arrive as a `create`
    // and then, when a backend hook updates the row right after insert, again as
    // an `update`. We toast on the first unread sighting and skip the rest. PB
    // realtime only pushes live events (no replay), so a per-connection set is
    // enough and reconnects won't re-toast old items.
    let mut seen: HashSet<String> = HashSet::new();

    while let Some(event) = stream.next().await {
        let event = event.map_err(|e| format!("stream: {e}"))?;
        match event.event.as_str() {
            "PB_CONNECT" => {
                let client_id = serde_json::from_str::<Value>(&event.data)
                    .ok()
                    .and_then(|v| v["clientId"].as_str().map(String::from))
                    .ok_or("PB_CONNECT missing clientId")?;

                let sub = client
                    .post(format!("{base}/api/realtime"))
                    .header(reqwest::header::AUTHORIZATION, token)
                    .json(&json!({ "clientId": client_id, "subscriptions": ["Notifications/*"] }))
                    .send()
                    .await
                    .map_err(|e| format!("subscribe: {e}"))?;
                if !sub.status().is_success() {
                    // A 401/403 here means the token expired; ending the
                    // connection lets the frontend push a refreshed token via a
                    // new start_notification_listener call.
                    return Err(format!("subscribe status {}", sub.status()));
                }
                log::info!("[notifier] subscribed to Notifications realtime");
            }
            // PB names the SSE event after the subscribed topic, so this is
            // "Notifications/*" (the topic we sent), not a bare "Notifications".
            "Notifications/*" => {
                let payload: Value = match serde_json::from_str(&event.data) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                if payload["action"].as_str() == Some("delete") {
                    continue;
                }
                let record = &payload["record"];
                if record["read"].as_bool() == Some(true) {
                    continue; // ignore mark-as-read updates
                }
                let id = record["id"].as_str().unwrap_or("").to_string();
                if id.is_empty() || !seen.insert(id) {
                    continue;
                }
                let title = record["title"].as_str().unwrap_or("PractoCore");
                let body = record["body"].as_str().unwrap_or("");
                if let Err(e) = app.notification().builder().title(title).body(body).show() {
                    log::warn!("[notifier] failed to show notification: {e}");
                }
            }
            _ => {}
        }
    }
    Ok(())
}
