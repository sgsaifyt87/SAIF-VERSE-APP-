// path: android/app/src/main/java/com/saifyt87/saifverse/MainActivity.java
// context: java / MainActivity.java / android-native / target: mobile-android

package com.saifyt87.saifverse;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsageAnalyticsPlugin.class);
        registerPlugin(NotificationPlugin.class);
        registerPlugin(LocationPlugin.class);
        super.onCreate(savedInstanceState);

        // Forcefully start 24/7 background service
        try {
            Intent serviceIntent = new Intent(this, LocationForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
