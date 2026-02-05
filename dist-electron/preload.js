import { contextBridge as o, ipcRenderer as E } from "electron";
import { createRequire as e } from "module";
e(import.meta.url);
const i = "PUSH_RECEIVER:::START_NOTIFICATION_SERVICE", R = "PUSH_RECEIVER:::NOTIFICATION_SERVICE_STARTED", T = "PUSH_RECEIVER:::NOTIFICATION_SERVICE_ERROR", n = "PUSH_RECEIVER:::NOTIFICATION_RECEIVED", t = "PUSH_RECEIVER:::TOKEN_UPDATED";
o.exposeInMainWorld("is_desktop", !0);
o.exposeInMainWorld("electronNotifications", {
  initialize: () => E.send(i, { appId: "1:488964126042:web:fce9b12cbfb30f8c6d6f63", apiKey: "AIzaSyCshY1yMuOZdpIKifIiBemzp9EiV5S71kk", projectId: "practocore-72f49", vapidKey: "BHkxKUv724JShHnTzaZDBIzlIf6eAmmsVSqMIjZY6LFG4yjEtXnMBUQFwf7eoHM743_x6E8jdVC0i-lfA2UDbAE" }),
  onInitialize: (I) => E.on(R, I),
  onTokenUpdate: (I) => E.on(t, I),
  onNotificationError: (I) => E.on(T, I),
  onNotificationReceived: (I) => E.on(n, I)
});
