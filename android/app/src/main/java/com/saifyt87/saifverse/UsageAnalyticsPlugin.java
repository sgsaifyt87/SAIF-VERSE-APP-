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

        // 1. Process UsageEvents for exact Unlocks & App Opens with Start-to-End time spans
        UsageEvents events = usm.queryEvents(startTime, endTime);
        List<String> unlockTimestamps = new ArrayList<>();
        Map<String, Integer> appOpenCounts = new HashMap<>();
        Map<String, Long> activeResumedAt = new HashMap<>();
        Map<String, List<String>> appSessionSpans = new HashMap<>();

        long lastUnlockTimestampMs = 0L;

        if (events != null) {
            UsageEvents.Event currentEvent = new UsageEvents.Event();
            while (events.hasNextEvent()) {
                events.getNextEvent(currentEvent);
                int type = currentEvent.getEventType();
                long eventTime = currentEvent.getTimeStamp();
                String pkg = currentEvent.getPackageName();

                // Unlock detection: KEYGUARD_HIDDEN (18), SCREEN_INTERACTIVE (15), or first interaction after wake
                if (type == 18 || type == 15 || type == 16) {
                    if (eventTime - lastUnlockTimestampMs > 5000) { // at least 5s apart
                        lastUnlockTimestampMs = eventTime;
                        unlockTimestamps.add(timeFmt.format(new Date(eventTime)));
                    }
                }

                // App launch / resumed events
                if (type == UsageEvents.Event.ACTIVITY_RESUMED || type == 1) { // 1 = ACTIVITY_RESUMED
                    int count = appOpenCounts.containsKey(pkg) ? appOpenCounts.get(pkg) + 1 : 1;
                    appOpenCounts.put(pkg, count);
                    activeResumedAt.put(pkg, eventTime);

                    if (!appSessionSpans.containsKey(pkg)) {
                        appSessionSpans.put(pkg, new ArrayList<String>());
                    }
                }

                // App paused / backgrounded events
                if (type == UsageEvents.Event.ACTIVITY_PAUSED || type == UsageEvents.Event.ACTIVITY_STOPPED || type == 2) {
                    if (activeResumedAt.containsKey(pkg)) {
                        long startMs = activeResumedAt.remove(pkg);
                        long durMs = Math.max(1000L, eventTime - startMs);
                        String span = timeFmt.format(new Date(startMs)) + " to " + timeFmt.format(new Date(eventTime)) + " (" + formatDuration(durMs) + ")";
                        if (!appSessionSpans.containsKey(pkg)) {
                            appSessionSpans.put(pkg, new ArrayList<String>());
                        }
                        appSessionSpans.get(pkg).add(span);
                    }
                }
            }
        }

        // Close any ongoing active session
        for (Map.Entry<String, Long> entry : activeResumedAt.entrySet()) {
            String pkg = entry.getKey();
            long startMs = entry.getValue();
            long durMs = Math.max(1000L, endTime - startMs);
            String span = timeFmt.format(new Date(startMs)) + " to " + timeFmt.format(new Date(endTime)) + " (" + formatDuration(durMs) + ")";
            if (!appSessionSpans.containsKey(pkg)) {
                appSessionSpans.put(pkg, new ArrayList<String>());
            }
            appSessionSpans.get(pkg).add(span);
        }

        // If unlock events is 0 on emulator, synthesize from session wakeups
        if (unlockTimestamps.isEmpty() && !appSessionSpans.isEmpty()) {
            for (Map.Entry<String, List<String>> entry : appSessionSpans.entrySet()) {
                for (String span : entry.getValue()) {
                    String[] parts = span.split(" to ");
                    if (parts.length > 0 && !unlockTimestamps.contains(parts[0])) {
                        unlockTimestamps.add(parts[0]);
                    }
                }
            }
            Collections.sort(unlockTimestamps);
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

            JSArray sessionsArray = new JSArray();
            if (appSessionSpans.containsKey(pkgName)) {
                for (String s : appSessionSpans.get(pkgName)) {
                    sessionsArray.put(s);
                }
            }
            obj.put("sessionSpans", sessionsArray);

            if (timeMs > 0 || openCount > 0) {
                totalScreenTimeMs += timeMs;
                usedAppList.add(obj);
            } else {
                unusedAppList.add(obj);
            }
        }

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
