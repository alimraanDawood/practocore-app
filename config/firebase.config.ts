/**
 * Firebase Configuration for Web
 *
 * Project: `practocore` (number 286763366119). Migrated 2026-07-13 off the old,
 * now-deleted `practocore-72f49` project. Values from Firebase console →
 * Project settings → General → Your apps → PractoCore Web.
 */

export const firebaseConfig = {
  apiKey: "AIzaSyAGKffo43bOn50uiIL3pUwwlmLqL0VZplM",
  authDomain: "practocore.firebaseapp.com",
  projectId: "practocore",
  storageBucket: "practocore.firebasestorage.app",
  messagingSenderId: "286763366119",
  appId: "1:286763366119:web:31033600a1710a618a5442"
};

/**
 * VAPID Key (Voluntary Application Server Identification)
 *
 * To get your VAPID key:
 * 1. Go to Firebase Console > Project Settings > Cloud Messaging tab
 * 2. Scroll down to "Web configuration" section
 * 3. Under "Web Push certificates", you'll see your key pair
 * 4. If you don't have one, click "Generate key pair"
 * 5. Copy the "Key pair" value
 * 6. Replace the placeholder below
 */
export const vapidKey = "BMIOiNuO-aqA-ysUxB6zE6CFjOw11joT6e3bDVdLN-Tvyz7d12UbOvA4bQjGKQUIxDS272Edg_JIm40EbZ8BGsY";
