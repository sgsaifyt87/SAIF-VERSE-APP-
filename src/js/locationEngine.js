// path: src/js/locationEngine.js
// context: javascript / locationEngine.js / mobile-android

import { registerPlugin } from '@capacitor/core';

const NativeLocation = registerPlugin('AppLocation');

export class LocationEngine {
  constructor(webhookBridge, profileEngine) {
    this.webhookBridge = webhookBridge;
    this.profileEngine = profileEngine;
    this.currentLocation = null;
    this.listeners = [];
  }

  async init() {
    try {
      const perm = await this.checkPermission();
      if (!perm) {
        await this.requestPermission();
      }

      await this.startTracking();
      await this.refreshCurrentLocation();
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
      // Listen for native verified location updates (from Native GPS driver)
      await NativeLocation.addListener('locationUpdate', (data) => {
        if (data && data.hasLocation) {
          this.currentLocation = data;
          this.notifyListeners(data);
        }
      });

      await NativeLocation.startTracking();
    } catch (e) {
      console.warn('Native tracking listener fallback:', e);
    }
  }

  async refreshCurrentLocation() {
    try {
      const nativeLoc = await NativeLocation.getCurrentLocation();
      if (nativeLoc && nativeLoc.hasLocation) {
        this.currentLocation = nativeLoc;
        this.notifyListeners(nativeLoc);
        return nativeLoc;
      }
    } catch (e) {
      // fallback
    }

    if ('geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = {
              granted: true,
              hasLocation: true,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude || 0,
              accuracy: pos.coords.accuracy || 10,
              googleFormat: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
              googleMapsUrl: `https://www.google.com/maps?q=${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };
            this.currentLocation = loc;
            this.notifyListeners(loc);
            resolve(loc);
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    return null;
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
