// path: src/js/profileEngine.js
// context: javascript / profileEngine.js / browser-storage / target: mobile-android

export const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%23ec4899"><circle cx="50" cy="50" r="48" fill="%231e293b" stroke="%23ec4899" stroke-width="3"/><circle cx="50" cy="38" r="18" fill="%23f472b6"/><path d="M22 84c0-16 12-26 28-26s28 10 28 26" fill="%23f472b6"/></svg>';

export class ProfileEngine {
  constructor(webhookBridge) {
    this.storageKey = 'saif_verse_user_profile_v1';
    this.webhookBridge = webhookBridge;
    this.profile = {
      isCreated: false,
      username: '',
      avatar: DEFAULT_AVATAR,
      bio: 'Wanderer in the SAIF-VERSE ✨',
      createdAt: null,
      lastLogin: null
    };
    this.listeners = [];
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        this.profile = JSON.parse(raw);
        if (!this.profile.avatar) {
          this.profile.avatar = DEFAULT_AVATAR;
        }
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
      this.notify();
    } catch (e) {
      console.warn('Storage quota limit reached, compressing profile image...', e);
      try {
        // If quota exceeded, re-compress avatar to lighter thumbnail
        if (this.profile.avatar && this.profile.avatar.length > 50000) {
          this.compressDataUrl(this.profile.avatar, 200, 0.7).then(lightImg => {
            this.profile.avatar = lightImg;
            localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
            this.notify();
          });
        }
      } catch (inner) {
        console.error('Critical storage failure:', inner);
      }
    }
  }

  compressDataUrl(dataUrl, maxDim = 320, quality = 0.8) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.profile);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.profile));
  }

  async processGalleryImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Please select an image file.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.compressDataUrl(e.target.result, 360, 0.82)
          .then(compressed => resolve(compressed))
          .catch(err => reject(err));
      };
      reader.onerror = () => reject(new Error('File reading error.'));
      reader.readAsDataURL(file);
    });
  }

  createOrUpdateProfile({ username, avatar, bio }) {
    const isFirstTime = !this.profile.isCreated;
    this.profile.username = username.trim() || 'Saif Explorer';
    this.profile.avatar = avatar || this.profile.avatar || DEFAULT_AVATAR;
    this.profile.bio = bio ? bio.trim() : 'Wanderer in the SAIF-VERSE ✨';
    this.profile.isCreated = true;
    
    if (isFirstTime) {
      this.profile.createdAt = new Date().toISOString();
    }
    this.profile.lastLogin = new Date().toISOString();
    this.save();

    if (this.webhookBridge) {
      this.webhookBridge.sendWelcomeNotification({
        username: this.profile.username,
        avatar: this.profile.avatar,
        isNewAccount: isFirstTime
      });
      this.webhookBridge.flushOfflineQueue();
    }

    return this.profile;
  }

  handleAppLaunch(activeDayTheme) {
    if (this.profile.isCreated && this.profile.username) {
      this.profile.lastLogin = new Date().toISOString();
      this.save();

      if (this.webhookBridge) {
        this.webhookBridge.sendWelcomeNotification({
          username: this.profile.username,
          avatar: this.profile.avatar,
          isNewAccount: false,
          themeName: activeDayTheme ? activeDayTheme.name : 'Cosmic'
        });
        this.webhookBridge.flushOfflineQueue();
      }
    }
  }
}
