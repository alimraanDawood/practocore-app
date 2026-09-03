package com.practocore.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * OS notifications for the over-the-air update lifecycle.
 *
 * The Capgo plugin posts no notifications of its own — it emits JavaScript
 * listener events and nothing else — and @capacitor/local-notifications cannot
 * render a progress bar, because its API has no equivalent of
 * NotificationCompat.Builder#setProgress. So the progress notification has to
 * be built here.
 *
 * Downloads run through WorkManager as an ordinary Worker rather than a
 * foreground service, so nothing else is already showing a notification for
 * this work and there is no ownership conflict.
 *
 * Two channels, because the states differ in what they ask of the user.
 * Progress is commentary and stays silent; "ready" is the one state that goes
 * unserved unless the user acts, so it is allowed to make a sound once. A user
 * who finds the latter too talkative can silence it without also losing the
 * former, which a single channel would not allow.
 */
@CapacitorPlugin(name = "UpdateNotifications")
public class UpdateNotifications extends Plugin {

    private static final String PROGRESS_CHANNEL_ID = "app_updates";
    private static final String READY_CHANNEL_ID = "app_update_ready";
    // Checking and downloading share an id so the progress notification
    // replaces the checking one in place rather than stacking a second entry.
    private static final int PROGRESS_ID = 4101;
    private static final int READY_ID = 4102;
    // A check against a fast server resolves in well under a second. Posting
    // and immediately clearing leaves nothing a person could see, so the
    // outcome lingers briefly under its own timeout instead.
    private static final long SETTLED_TIMEOUT_MS = 6000;

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (manager == null) return;

        if (manager.getNotificationChannel(PROGRESS_CHANNEL_ID) == null) {
            // IMPORTANCE_LOW: no sound and no heads-up banner. Checking and
            // downloading happen on their own and ask nothing of the user.
            NotificationChannel progress = new NotificationChannel(
                PROGRESS_CHANNEL_ID,
                "Update progress",
                NotificationManager.IMPORTANCE_LOW
            );
            progress.setDescription("Checking for and downloading PractoCore updates.");
            progress.setShowBadge(false);
            manager.createNotificationChannel(progress);
        }

        if (manager.getNotificationChannel(READY_CHANNEL_ID) == null) {
            // IMPORTANCE_DEFAULT: a downloaded update installs only once the
            // user restarts the app. Left silent it is missed, and the update
            // it announces is never applied.
            NotificationChannel ready = new NotificationChannel(
                READY_CHANNEL_ID,
                "Update ready to install",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            ready.setDescription("Tells you when a downloaded update needs a restart to apply.");
            ready.setShowBadge(true);
            manager.createNotificationChannel(ready);
        }
    }

    private NotificationCompat.Builder base(String channelId, String title, String text) {
        ensureChannels();
        return new NotificationCompat.Builder(getContext(), channelId)
            // The app's own mark, so the status bar entry is identifiable as
            // PractoCore rather than the stock download arrow every app shares.
            .setSmallIcon(R.drawable.ic_stat_practocore)
            .setContentTitle(title)
            .setContentText(text)
            .setOnlyAlertOnce(true);
    }

    /** Opens the app when the notification is tapped. */
    private PendingIntent openApp() {
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(getContext(), 0, intent, flags);
    }

    private void post(int id, Notification notification) {
        // On Android 13+ a missing POST_NOTIFICATIONS grant makes notify a
        // no-op that throws; updates must never crash the app over a
        // notification the user declined.
        try {
            NotificationManagerCompat.from(getContext()).notify(id, notification);
        } catch (SecurityException ignored) {}
    }

    @PluginMethod
    public void checking(PluginCall call) {
        post(PROGRESS_ID, base(PROGRESS_CHANNEL_ID, "Checking for updates", "PractoCore")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setProgress(0, 0, true)
            .setOngoing(true)
            .build());
        call.resolve();
    }

    @PluginMethod
    public void progress(PluginCall call) {
        int percent = call.getInt("percent", 0);
        post(PROGRESS_ID, base(PROGRESS_CHANNEL_ID, "Downloading update", percent + "%")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setProgress(100, percent, false)
            .setOngoing(true)
            .build());
        call.resolve();
    }

    /**
     * The outcome of a check that ends without a download — "up to date", or a
     * failure. Replaces the spinner in place and dismisses itself, so a check
     * always visibly resolves rather than flickering out of existence.
     */
    @PluginMethod
    public void settled(PluginCall call) {
        String text = call.getString("text", "");
        post(PROGRESS_ID, base(PROGRESS_CHANNEL_ID, "Update check", text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(false)
            .setAutoCancel(true)
            .setTimeoutAfter(SETTLED_TIMEOUT_MS)
            .setContentIntent(openApp())
            .build());
        call.resolve();
    }

    @PluginMethod
    public void ready(PluginCall call) {
        String version = call.getString("version", "");
        cancel(PROGRESS_ID);
        // Deliberately not ongoing: the user must be able to dismiss it. The
        // update applies on the next launch whether or not this is visible.
        post(READY_ID, base(READY_CHANNEL_ID, "Update ready", "Close and reopen PractoCore to apply it.")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(
                "Version " + version + " is downloaded. Close PractoCore and open it again to apply it."))
            .setContentIntent(openApp())
            .setAutoCancel(true)
            .build());
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        cancel(PROGRESS_ID);
        JSObject result = new JSObject();
        result.put("cleared", true);
        call.resolve(result);
    }

    /**
     * Withdraws the "update ready" notice once the update has actually been
     * applied. Without this it outlives the thing it describes and asks the
     * user to restart for an update they are already running.
     */
    @PluginMethod
    public void applied(PluginCall call) {
        cancel(READY_ID);
        call.resolve();
    }

    private void cancel(int id) {
        NotificationManagerCompat.from(getContext()).cancel(id);
    }
}
