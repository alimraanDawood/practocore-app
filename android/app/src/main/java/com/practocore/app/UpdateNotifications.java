package com.practocore.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
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
 */
@CapacitorPlugin(name = "UpdateNotifications")
public class UpdateNotifications extends Plugin {

    private static final String CHANNEL_ID = "app_updates";
    // Checking and downloading share an id so the progress notification
    // replaces the checking one in place rather than stacking a second entry.
    private static final int PROGRESS_ID = 4101;
    private static final int READY_ID = 4102;

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        // IMPORTANCE_LOW: these appear in the shade without sound or a heads-up
        // banner. An update is information, not an interruption.
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Application updates",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Progress and status of PractoCore updates.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private NotificationCompat.Builder base(String title, String text) {
        ensureChannel();
        return new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
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
        post(PROGRESS_ID, base("Checking for updates", "PractoCore")
            .setProgress(0, 0, true)
            .setOngoing(true)
            .build());
        call.resolve();
    }

    @PluginMethod
    public void progress(PluginCall call) {
        int percent = call.getInt("percent", 0);
        post(PROGRESS_ID, base("Downloading update", percent + "%")
            .setProgress(100, percent, false)
            .setOngoing(true)
            .build());
        call.resolve();
    }

    @PluginMethod
    public void ready(PluginCall call) {
        String version = call.getString("version", "");
        cancel(PROGRESS_ID);
        // Deliberately not ongoing: the user must be able to dismiss it. The
        // update applies on the next cold start whether or not this is visible.
        post(READY_ID, base("Update ready", "Close and reopen PractoCore to apply it.")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(
                "Version " + version + " is downloaded. Fully close PractoCore and open it again to apply it — leaving it in the background is not enough."))
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
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

    private void cancel(int id) {
        NotificationManagerCompat.from(getContext()).cancel(id);
    }
}
