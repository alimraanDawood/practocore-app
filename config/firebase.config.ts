/**
 * Firebase Configuration for Web
 *
 * To get your web app credentials:
 * 1. Go to Firebase Console: https://console.firebase.google.com/
 * 2. Select your project: practocore-72f49
 * 3. Go to Project Settings (gear icon) > General tab
 * 4. Scroll down to "Your apps" section
 * 5. If you don't have a web app, click "Add app" and select the web icon (</>)
 * 6. Register the app and copy the firebaseConfig object
 * 7. Replace the placeholder values below with your actual values
 */

export const firebaseConfig = {
  apiKey: "AIzaSyBSm3eD990RoE5tNKeIFKfDfZM9fZawVd4",
  authDomain: "practocore-72f49.firebaseapp.com",
  projectId: "practocore-72f49",
  storageBucket: "practocore-72f49.firebasestorage.app",
  messagingSenderId: "488964126042",
  appId: "1:488964126042:web:fce9b12cbfb30f8c6d6f63" // TODO: Replace with your actual web app ID
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
export const vapidKey = "BGzB248hhvoUjphp00DRMy1Ou0QcCjWsvBYszqny7PPjUgPI2EVejp6Aev8ArbFIbuESOnCNxRIPbMFylPphE5c"; // TODO: Replace with your actual VAPID key
