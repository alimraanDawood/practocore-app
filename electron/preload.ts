import { contextBridge, ipcRenderer } from 'electron';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const START_NOTIFICATION_SERVICE = 'PUSH_RECEIVER:::START_NOTIFICATION_SERVICE';
const NOTIFICATION_SERVICE_STARTED = 'PUSH_RECEIVER:::NOTIFICATION_SERVICE_STARTED';
const NOTIFICATION_SERVICE_ERROR = 'PUSH_RECEIVER:::NOTIFICATION_SERVICE_ERROR';
const NOTIFICATION_RECEIVED = 'PUSH_RECEIVER:::NOTIFICATION_RECEIVED';
const TOKEN_UPDATED = 'PUSH_RECEIVER:::TOKEN_UPDATED';

contextBridge.exposeInMainWorld('is_desktop', true);
contextBridge.exposeInMainWorld('electronNotifications', {
   initialize: () =>  ipcRenderer.send(START_NOTIFICATION_SERVICE, { appId: '1:488964126042:web:fce9b12cbfb30f8c6d6f63', apiKey: 'AIzaSyCshY1yMuOZdpIKifIiBemzp9EiV5S71kk', projectId: 'practocore-72f49', vapidKey: 'BHkxKUv724JShHnTzaZDBIzlIf6eAmmsVSqMIjZY6LFG4yjEtXnMBUQFwf7eoHM743_x6E8jdVC0i-lfA2UDbAE' }),
    onInitialize: (func : Function) => ipcRenderer.on(NOTIFICATION_SERVICE_STARTED, func),
    onTokenUpdate: (func : Function) => ipcRenderer.on(TOKEN_UPDATED, func),
    onNotificationError: (func : Function) => ipcRenderer.on(NOTIFICATION_SERVICE_ERROR, func),
    onNotificationReceived: (func : Function) => ipcRenderer.on(NOTIFICATION_RECEIVED, func),
});
// Listen for service successfully started
// ipcRenderer.on(NOTIFICATION_SERVICE_STARTED, (_, token) => {
//     console.log('service successfully started', token)
// })
//
// // Handle notification errors
// ipcRenderer.on(NOTIFICATION_SERVICE_ERROR, (_, error) => {
//     console.log('notification error', error)
// })
//
// // Send FCM token to backend
// ipcRenderer.on(TOKEN_UPDATED, (_, token) => {
//     console.log('token updated', token)
// })
//
// // Display notification
// ipcRenderer.on(NOTIFICATION_RECEIVED, (_, serverNotificationPayload) => {
//     // check to see if payload contains a body string, if it doesn't consider it a silent push
//     if (serverNotificationPayload.notification.body){
//         // payload has a body, so show it to the user
//         console.log('display notification', serverNotificationPayload)
//         let myNotification = new Notification(serverNotificationPayload.notification.title, {
//             body: serverNotificationPayload.notification.body
//         })
//
//         myNotification.onclick = () => {
//             console.log('Notification clicked')
//         }
//     } else {
//         // payload has no body, so consider it silent (and just consider the data portion)
//         console.log('do something with the key/value pairs in the data', serverNotificationPayload.data)
//     }
// })
