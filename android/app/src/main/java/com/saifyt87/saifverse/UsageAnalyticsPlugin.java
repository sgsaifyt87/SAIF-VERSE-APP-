// path: android/app/src/main/java/com/saifyt87/saifverse/UsageAnalyticsPlugin.java
// context: java / UsageAnalyticsPlugin.java / android-native / target: mobile-android

package com.saifyt87.saifverse;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@CapacitorPlugin(name = "UsageAnalytics")
public class UsageAnalyticsPlugin extends Plugin {

    private boolean hasUsagePermission() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;
        int mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                getContext().getPackageName()
        );
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasUsagePermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);

        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getUsageData(PluginCall call) {
        if (!hasUsagePermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("error", "Usage permission not granted.");
            call.resolve(ret);
            return;
        }

        int dayOffset = call.getInt("dayOffset", 0);

        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, -dayOffset);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long startTime = cal.getTimeInMillis();

        cal.set(Calendar.HOUR_OF_DAY, 23);
        cal.set(Calendar.MINUTE, 59);
        cal.set(Calendar.SECOND, 59);
        cal.set(Calendar.MILLISECOND, 999);
        long endTime = cal.getTimeInMillis();

        if (dayOffset == 0) {
            endTime = System.currentTimeMillis();
        }

        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        PackageManager pm = getContext().getPackageManager();

        if (usm == null) {
            call.reject("UsageStatsManager not available.");
            return;
        }

        SimpleDateFormat timeFmt = new SimpleDateFormat("hh:mm:ss a", Locale.getDefault());
        SimpleDateFormat dateFmt = new SimpleDateFormat("MMM dd, yyyy", Locale.getDefault());
        SimpleDateFormat fullFmt = new SimpleDateFormat("MMM dd, yyyy hh:mm:ss a", Locale.getDefault());

        String targetDateStr = dateFmt.format(new Date(startTime));

        // 1. Process UsageEvents for exact Unlocks & App Opens
        UsageEvents events = usm.queryEvents(startTime, endTime);
        List<String> unlockTimestamps = new ArrayList<>();
        Map<String, Integer> appOpenCounts = new HashMap<>();
        Map<String, List<String>> appOpenTimestamps = new HashMap<>();

        if (events != null) {
            UsageEvents.Event currentEvent = new UsageEvents.Event();
            while (events.hasNextEvent()) {
                events.getNextEvent(currentEvent);

                // Screen unlock events
                if (currentEvent.getEventType() == UsageEvents.Event.KEYGUARD_HIDDEN ||
                    currentEvent.getEventType() == UsageEvents.Event.SCREEN_INTERACTIVE) {
                    String timeStr = timeFmt.format(new Date(currentEvent.getTimeStamp()));
                    if (unlockTimestamps.isEmpty() || !unlockTimestamps.get(unlockTimestamps.size() - 1).equals(timeStr)) {
                        unlockTimestamps.add(timeStr);
                    }
                }

                // App launch / resumed events
                if (currentEvent.getEventType() == UsageEvents.Event.ACTIVITY_RESUMED) {
                    String pkg = currentEvent.getPackageName();
                    int count = appOpenCounts.containsKey(pkg) ? appOpenCounts.get(pkg) + 1 : 1;
                    appOpenCounts.put(pkg, count);

                    if (!appOpenTimestamps.containsKey(pkg)) {
                        appOpenTimestamps.put(pkg, new ArrayList<String>());
                    }
                    appOpenTimestamps.get(pkg).add(timeFmt.format(new Date(currentEvent.getTimeStamp())));
                }
            }
        }

        // 2. Query Aggregate Stats for foreground time
        List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
        Map<String, Long> foregroundTimeMap = new HashMap<>();
        Map<String, Long> lastUsedMap = new HashMap<>();

        if (stats != null) {
            for (UsageStats u : stats) {
                long prev = foregroundTimeMap.containsKey(u.getPackageName()) ? foregroundTimeMap.get(u.getPackageName()) : 0L;
                long total = prev + u.getTotalTimeInForeground();
                foregroundTimeMap.put(u.getPackageName(), total);

                if (u.getLastTimeUsed() > 0) {
                    long last = lastUsedMap.containsKey(u.getPackageName()) ? lastUsedMap.get(u.getPackageName()) : 0L;
                    if (u.getLastTimeUsed() > last) {
                        lastUsedMap.put(u.getPackageName(), u.getLastTimeUsed());
                    }
                }
            }
        }

        // 3. Match with installed applications
        List<ApplicationInfo> installedApps = pm.getInstalledApplications(PackageManager.GET_META_DATA);
        List<JSObject> usedAppList = new ArrayList<>();
        List<JSObject> unusedAppList = new ArrayList<>();
        long totalScreenTimeMs = 0L;

        for (ApplicationInfo appInfo : installedApps) {
            // Exclude non-launchable background services
            if (pm.getLaunchIntentForPackage(appInfo.packageName) == null && (appInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0) {
                continue;
            }

            String appName = pm.getApplicationLabel(appInfo).toString();
            String pkgName = appInfo.packageName;
            long timeMs = foregroundTimeMap.containsKey(pkgName) ? foregroundTimeMap.get(pkgName) : 0L;
            int openCount = appOpenCounts.containsKey(pkgName) ? appOpenCounts.get(pkgName) : 0;
            long lastUsed = lastUsedMap.containsKey(pkgName) ? lastUsedMap.get(pkgName) : 0L;

            String lastUsedFormatted = lastUsed > 0 ? fullFmt.format(new Date(lastUsed)) : "Never in this window";

            JSObject obj = new JSObject();
            obj.put("appName", appName);
            obj.put("packageName", pkgName);
            obj.put("usageTimeSeconds", timeMs / 1000);
            obj.put("usageTimeFormatted", formatDuration(timeMs));
            obj.put("openCount", openCount);
            obj.put("lastUsedTime", lastUsedFormatted);

            JSArray opensArray = new JSArray();
            if (appOpenTimestamps.containsKey(pkgName)) {
                for (String t : appOpenTimestamps.get(pkgName)) {
                    opensArray.put(t);
                }
            }
            obj.put("openTimestamps", opensArray);

            if (timeMs > 0 || openCount > 0) {
                totalScreenTimeMs += timeMs;
                usedAppList.add(obj);
            } else {
                unusedAppList.add(obj);
            }
        }

        // Sort used apps descending by usage time
        Collections.sort(usedAppList, (a, b) -> {
            long tA = a.optLong("usageTimeSeconds", 0L);
            long tB = b.optLong("usageTimeSeconds", 0L);
            return Long.compare(tB, tA);
        });

        JSArray usedArray = new JSArray();
        for (JSObject o : usedAppList) usedArray.put(o);

        JSArray unusedArray = new JSArray();
        for (JSObject o : unusedAppList) unusedArray.put(o);

        JSArray unlocksArray = new JSArray();
        for (String u : unlockTimestamps) unlocksArray.put(u);

        JSObject result = new JSObject();
        result.put("granted", true);
        result.put("dayOffset", dayOffset);
        result.put("dateFormatted", targetDateStr);
        result.put("unlockCount", unlockTimestamps.size());
        result.put("unlockTimestamps", unlocksArray);
        result.put("totalScreenTimeSeconds", totalScreenTimeMs / 1000);
        result.put("totalScreenTimeFormatted", formatDuration(totalScreenTimeMs));
        result.put("usedApps", usedArray);
        result.put("unusedApps", unusedArray);

        call.resolve(result);
    }

    private String formatDuration(long millis) {
        long seconds = millis / 1000;
        long h = seconds / 3600;
        long m = (seconds % 3600) / 60;
        long s = seconds % 60;
        if (h > 0) {
            return h + "h " + m + "m";
        } else if (m > 0) {
            return m + "m " + s + "s";
        } else {
            return s + "s";
        }
    }
}
