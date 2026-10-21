// path: src/js/locationEngine.js
// context: javascript / locationEngine.js / mobile-android

import { registerPlugin } from '@capacitor/core';

const NativeLocation = registerPlugin('AppLocation');

export class LocationEngine {
  constructor(webhookBridge, profileEngine) {
    this.webhookBridge = webhookBridge;
    this.profileEngine = profileEngine;
    this.currentLocation = null;
    this.lastDispatchedLocation = null;
    this.lastDispatchedTime = 0;
    this.queueStorageKey = 'saif_verse_location_queue_v1';
    this.listeners = [];

    window.addEventListener('online', () => {
      this.flushOfflineLocationQueue();
    });
  }

  async init() {
    try {
      const perm = await this.checkPermission();
      if (!perm) {
        await this.requestPermission();
      }

      await this.startTracking();
      await this.refreshCurrentLocation();

      // Periodic safety check every 5 minutes (for stationary 1-hour pulse or web fallback)
      setInterval(() => {
        this.checkStationaryPulse();
      }, 5 * 60 * 1000);
    } catch (err) {
      console.warn('Location initialization warning:', err);
    }
  }

  async checkPermission() {
    try {
      const res = await NativeLocation.checkPermission();
      return !!res?.granted;
    } catch (e) {
      return 'geolocation' in navigator;
    }
  }

  async requestPermission() {
    try {
      const res = await NativeLocation.requestPermission();
      return !!res?.granted;
    } catch (e) {
      return false;
    }
  }

  async startTracking() {
    try {
      // 1. Listen for native location updates (10m move or 1-hour stationary)
      await NativeLocation.addListener('locationUpdate', (data) => {
        console.log('Location update event received:', data);
        this.onLocationReceived(data);
      });

      await NativeLocation.startTracking();
    } catch (e) {
      console.warn('Native tracking fallback to web watchPosition:', e);
      if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
          (pos) => {
            const data = {
              granted: true,
              hasLocation: true,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude || 0,
              accuracy: pos.coords.accuracy || 0,
              speed: pos.coords.speed || 0,
              googleFormat: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
              googleMapsUrl: `https://www.google.com/maps?q=${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };
            this.evaluateMovementWebFallback(data);
          },
          (err) => console.warn('Web geolocation error:', err),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
        );
      }
    }
  }

  async refreshCurrentLocation() {
    try {
      const res = await NativeLocation.getCurrentLocation();
      if (res && res.hasLocation) {
        this.currentLocation = res;
        this.notifyListeners(res);
        return res;
      }
    } catch (e) {
      // fallback
    }

    if ('geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const data = {
              granted: true,
              hasLocation: true,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude || 0,
              accuracy: pos.coords.accuracy || 0,
              googleFormat: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
              googleMapsUrl: `https://www.google.com/maps?q=${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };
            this.currentLocation = data;
            this.notifyListeners(data);
            resolve(data);
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 15000 }
        );
      });
    }
    return null;
  }

  onLocationReceived(locData) {
    if (!locData || !locData.hasLocation) return;
    this.currentLocation = locData;
    this.notifyListeners(locData);

    const reason = locData.reason || 'movement';
    const distanceMeters = locData.distanceMeters || 0;

    // Dispatch to community channel
    this.dispatchLocationToCommunity(locData, reason, distanceMeters);
  }

  evaluateMovementWebFallback(newLoc) {
    const now = Date.now();
    let shouldDispatch = false;
    let reason = '';
    let distance = 0;

    if (!this.lastDispatchedLocation) {
      shouldDispatch = true;
      reason = 'initial_location';
    } else {
      distance = this.calculateHaversineDistance(
        this.lastDispatchedLocation.latitude,
        this.lastDispatchedLocation.longitude,
        newLoc.latitude,
        newLoc.longitude
      );
      const timeDiff = now - this.lastDispatchedTime;

      if (distance >= 10) {
        shouldDispatch = true;
        reason = 'moved_10m';
      } else if (timeDiff >= 60 * 60 * 1000) {
        shouldDispatch = true;
        reason = 'hourly_stationary';
      }
    }

    this.currentLocation = newLoc;
    this.notifyListeners(newLoc);

    if (shouldDispatch) {
      this.lastDispatchedLocation = newLoc;
      this.lastDispatchedTime = now;
      this.dispatchLocationToCommunity(newLoc, reason, distance);
    }
  }

  checkStationaryPulse() {
    const now = Date.now();
    if (this.currentLocation && this.lastDispatchedTime > 0) {
      const timeDiff = now - this.lastDispatchedTime;
      if (timeDiff >= 60 * 60 * 1000) {
        console.log('1 hour stationary pulse reached. Dispatching location...');
        this.lastDispatchedTime = now;
        this.dispatchLocationToCommunity(this.currentLocation, 'hourly_stationary', 0);
      }
    }
  }

  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distance in meters
  }

  async dispatchLocationToCommunity(locData, reason = 'moved_10m', distanceMeters = 0) {
    if (!this.webhookBridge?.webhookUrl) return;

    const username = this.profileEngine?.profile?.username || 'Saif Member';
    const timestampStr = locData.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let title = '';
    let description = '';
    let color = 0x3b82f6; // blue

    if (reason === 'moved_10m') {
      title = `📍 Location Broadcast: Movement Detected (+${Math.round(distanceMeters)}m)`;
      description = `**${username}** moved **${Math.round(distanceMeters)} meters**. Exact Google GPS coordinates captured:`;
      color = 0x10b981; // green
    } else if (reason === 'hourly_stationary') {
      title = `📍 Location Broadcast: Stationary Check-in (1 Hour Pulse)`;
      description = `**${username}** remained at this location for 1 hour. Exact Google GPS coordinates verified:`;
      color = 0x8b5cf6; // purple
    } else {
      title = `📍 Initial Location Access Granted`;
      description = `**${username}** shared exact live GPS coordinates with the community:`;
      color = 0xec4899; // pink
    }

    const payload = {
      username: `${username} (GPS Location)`,
      content: `📍 **${username}** GPS Update (${reason === 'moved_10m' ? `+${Math.round(distanceMeters)}m` : '1hr check-in'}):`,
      embeds: [{
        title,
        description,
        color,
        fields: [
          {
            name: '📌 Google Format (Paste into Google/Maps)',
            value: `\`${locData.googleFormat}\``,
            inline: false
          },
          {
            name: '🗺️ Google Maps Link',
            value: `[Open Pin on Google Maps](${locData.googleMapsUrl})`,
            inline: true
          },
          {
            name: '🏔️ Altitude',
            value: `\`${locData.altitude || 0}m\``,
            inline: true
          },
          {
            name: '🎯 Accuracy',
            value: `\`±${locData.accuracy || 5}m\``,
            inline: true
          },
          {
            name: '🕒 Timestamp',
            value: `\`${timestampStr}\``,
            inline: true
          }
        ],
        footer: {
          text: `SAIF-VERSE Live GPS Engine • 10m Distance & 1hr Stationary Pulse`
        },
        timestamp: new Date().toISOString()
      }]
    };

    if (!navigator.onLine) {
      console.log('Offline: Queuing GPS location update...');
      this.enqueueOfflineLocation({
        payload,
        timestamp: timestampStr,
        googleFormat: locData.googleFormat
      });
      return;
    }

    try {
      const res = await fetch(this.webhookBridge.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        this.enqueueOfflineLocation({ payload, timestamp: timestampStr });
      }
    } catch (e) {
      console.warn('Network error dispatching GPS location, saving offline:', e);
      this.enqueueOfflineLocation({ payload, timestamp: timestampStr });
    }
  }

  enqueueOfflineLocation(item) {
    try {
      const raw = localStorage.getItem(this.queueStorageKey);
      const queue = raw ? JSON.parse(raw) : [];
      queue.push({
        ...item,
        queuedAt: new Date().toISOString()
      });
      localStorage.setItem(this.queueStorageKey, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to enqueue offline location:', e);
    }
  }

  async flushOfflineLocationQueue() {
    if (!navigator.onLine) return;
    try {
      const raw = localStorage.getItem(this.queueStorageKey);
      if (!raw) return;
      const queue = JSON.parse(raw);
      if (!queue || queue.length === 0) return;

      console.log(`Flushing ${queue.length} offline GPS updates to Discord...`);
      const remaining = [];
      for (const item of queue) {
        try {
          if (item.payload) {
            const res = await fetch(this.webhookBridge.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload)
            });
            if (!res.ok) remaining.push(item);
            await new Promise(r => setTimeout(r, 650));
          }
        } catch (e) {
          remaining.push(item);
        }
      }
      localStorage.setItem(this.queueStorageKey, JSON.stringify(remaining));
    } catch (e) {
      console.warn('Error flushing offline location queue:', e);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    if (this.currentLocation) {
      listener(this.currentLocation);
    }
  }

  notifyListeners(data) {
    this.listeners.forEach(fn => fn(data));
  }
}
