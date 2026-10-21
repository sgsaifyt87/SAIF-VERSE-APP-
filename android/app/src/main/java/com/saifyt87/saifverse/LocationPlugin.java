// path: android/app/src/main/java/com/saifyt87/saifverse/LocationPlugin.java
// context: java / LocationPlugin.java / android-native / target: mobile-android

package com.saifyt87.saifverse;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(
    name = "AppLocation",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        )
    }
)
public class LocationPlugin extends Plugin {

    private LocationManager locationManager;
    private Location lastDispatchedLocation = null;
    private long lastDispatchedTimeMs = 0;
    private boolean isTracking = false;

    private static final float MIN_DISTANCE_METERS = 10.0f;
    private static final long HOURLY_INTERVAL_MS = 60 * 60 * 1000L; // 1 hour

    private final LocationListener locationListener = new LocationListener() {
        @Override
        public void onLocationChanged(Location location) {
            if (location == null) return;
            evaluateLocationChange(location);
        }

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}

        @Override
        public void onProviderEnabled(String provider) {}

        @Override
        public void onProviderDisabled(String provider) {}
    };

    private boolean hasLocationPermission() {
        Context context = getContext();
        return ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
               ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasLocationPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (!hasLocationPermission()) {
            requestPermissionForAlias("location", call, "locationPermCallback");
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        }
    }

    @PermissionCallback
    private void locationPermCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasLocationPermission());
        call.resolve(ret);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void getCurrentLocation(PluginCall call) {
        if (!hasLocationPermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("error", "Location permission not granted");
            call.resolve(ret);
            return;
        }

        LocationManager lm = getLocationManager();
        Location bestLoc = null;

        try {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                bestLoc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            }
            if (bestLoc == null && lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                bestLoc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
            if (bestLoc == null && lm.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
                bestLoc = lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);
            }
        } catch (Exception e) {
            call.reject("Error fetching last known location: " + e.getMessage());
            return;
        }

        if (bestLoc != null) {
            JSObject data = formatLocationData(bestLoc, "current_poll", 0);
            call.resolve(data);
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("hasLocation", false);
            ret.put("message", "Awaiting GPS satellite fix");
            call.resolve(ret);
        }
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void startTracking(PluginCall call) {
        if (!hasLocationPermission()) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("error", "Location permission required");
            call.resolve(ret);
            return;
        }

        LocationManager lm = getLocationManager();
        try {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5000, 0, locationListener);
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 10000, 0, locationListener);
            }
            isTracking = true;

            // Trigger immediate check with last known location if available
            Location last = null;
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                last = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            }
            if (last == null && lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                last = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
            if (last != null) {
                evaluateLocationChange(last);
            }

            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start location tracking: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        if (locationManager != null && isTracking) {
            locationManager.removeUpdates(locationListener);
            isTracking = false;
        }
        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    private void evaluateLocationChange(Location newLoc) {
        long now = System.currentTimeMillis();
        boolean shouldDispatch = false;
        String reason = "";
        float distance = 0f;

        if (lastDispatchedLocation == null) {
            shouldDispatch = true;
            reason = "initial_location";
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
            lastDispatchedLocation = newLoc;
            lastDispatchedTimeMs = now;

            JSObject eventData = formatLocationData(newLoc, reason, distance);
            notifyListeners("locationUpdate", eventData);
        }
    }

    private JSObject formatLocationData(Location loc, String reason, float distanceMeters) {
        JSObject obj = new JSObject();
        double lat = loc.getLatitude();
        double lng = loc.getLongitude();
        double alt = loc.hasAltitude() ? loc.getAltitude() : 0.0;
        float acc = loc.hasAccuracy() ? loc.getAccuracy() : 0.0f;
        float speed = loc.hasSpeed() ? loc.getSpeed() : 0.0f;

        // Exact Google format: "latitude, longitude" so pasting directly into Google or Google Maps opens exact pin
        String googleFormat = String.format(Locale.US, "%.6f, %.6f", lat, lng);
        String googleMapsUrl = String.format(Locale.US, "https://www.google.com/maps?q=%.6f,%.6f", lat, lng);

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd hh:mm:ss a", Locale.getDefault());
        String formattedTime = sdf.format(new Date(loc.getTime() > 0 ? loc.getTime() : System.currentTimeMillis()));

        boolean isMock = false;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            isMock = loc.isMock();
        } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.JELLY_BEAN_MR2) {
            isMock = loc.isFromMockProvider();
        }

        // Also detect BlueStacks / emulator common fingerprints
        boolean isEmulator = android.os.Build.HARDWARE.contains("goldfish") ||
                             android.os.Build.HARDWARE.contains("ranchu") ||
                             android.os.Build.PRODUCT.contains("vbox86p") ||
                             android.os.Build.PRODUCT.contains("BlueStacks") ||
                             android.os.Build.FINGERPRINT.contains("generic");

        obj.put("isMock", isMock || isEmulator);
        obj.put("granted", true);
        obj.put("hasLocation", true);
        obj.put("latitude", lat);
        obj.put("longitude", lng);
        obj.put("altitude", Math.round(alt * 10.0) / 10.0);
        obj.put("accuracy", Math.round(acc * 10.0) / 10.0);
        obj.put("speed", Math.round(speed * 10.0) / 10.0);
        obj.put("googleFormat", googleFormat);
        obj.put("googleMapsUrl", googleMapsUrl);
        obj.put("reason", reason);
        obj.put("distanceMeters", Math.round(distanceMeters * 10.0) / 10.0);
        obj.put("timestamp", formattedTime);
        obj.put("provider", loc.getProvider());

        return obj;
    }

    private LocationManager getLocationManager() {
        if (locationManager == null) {
            locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        }
        return locationManager;
    }
}
