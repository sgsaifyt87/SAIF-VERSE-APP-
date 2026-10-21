// path: android/app/src/main/java/com/saifyt87/saifverse/MainActivity.java
// context: java / MainActivity.java / android-native / target: mobile-android

package com.saifyt87.saifverse;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsageAnalyticsPlugin.class);
        registerPlugin(NotificationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
