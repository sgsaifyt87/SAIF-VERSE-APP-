// path: android/app/src/main/java/com/saifyt87/saifverse/NotificationPlugin.java
// context: java / NotificationPlugin.java / android-native / target: mobile-android

package com.saifyt87.saifverse;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "AppNotification",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class NotificationPlugin extends Plugin {

    private static final String CHANNEL_ID = "saif_verse_daily_alerts";
    private static final String CHANNEL_NAME = "SAIF-VERSE Daily & System Notifications";
    private static final String CHANNEL_DESC = "Morning, evening, night greetings, and update alerts for SAIF-VERSE.";

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
                if (existing == null) {
                    NotificationChannel channel = new NotificationChannel(
                            CHANNEL_ID,
                            CHANNEL_NAME,
                            NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription(CHANNEL_DESC);
                    channel.enableLights(true);
                    channel.setLightColor(Color.MAGENTA);
                    channel.enableVibration(true);
                    manager.createNotificationChannel(channel);
                }
            }
        }
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean granted = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            granted = granted && (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationPermCallback");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void notificationPermCallback(PluginCall call) {
        boolean granted = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void showNotification(PluginCall call) {
        try {
            createNotificationChannel();

            String title = call.getString("title", "SAIF-VERSE");
            String body = call.getString("body", "Daily message from SAIF-VERSE ✨");
            int notifId = call.getInt("id", (int) System.currentTimeMillis());

            Intent intent = new Intent(getContext(), MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(getContext(), notifId, intent, pendingFlags);

            int smallIcon = getContext().getApplicationInfo().icon;
            if (smallIcon == 0) {
                smallIcon = android.R.drawable.ic_dialog_info;
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                    .setSmallIcon(smallIcon)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(getContext());
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    JSObject ret = new JSObject();
                    ret.put("shown", false);
                    ret.put("error", "POST_NOTIFICATIONS permission not granted");
                    call.resolve(ret);
                    return;
                }
            }

            notificationManager.notify(notifId, builder.build());

            JSObject ret = new JSObject();
            ret.put("shown", true);
            ret.put("id", notifId);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to display notification: " + e.getMessage(), e);
        }
    }
}
