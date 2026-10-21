// path: src/js/app.js
// context: javascript / app.js / orchestrator / target: mobile-android

import { ParticleEngine } from './particles.js';
import { ThemeEngine, DAYS_CONFIG } from './themeEngine.js';
import { NotesEngine } from './notesEngine.js';
import { ProfileEngine, DEFAULT_AVATAR } from './profileEngine.js';
import { WebhookBridge } from './webhookBridge.js';
import { UpdaterService } from './updaterService.js';

class SaifVerseApp {
  constructor() {
    this.currentTab = 'home';
    this.editingNoteId = null;
    this.selectedAvatar = DEFAULT_AVATAR;

    // Initialize Subsystems
    const canvas = document.getElementById('particle-canvas');
    this.particles = new ParticleEngine(canvas);
    this.themeEngine = new ThemeEngine(this.particles);
    this.webhookBridge = new WebhookBridge();
    this.profileEngine = new ProfileEngine(this.webhookBridge);

    // Initialize notes engine with callback to Discord webhook bridge
    this.notesEngine = new NotesEngine((savedNote, isUpdate) => {
      this.handleNoteSaved(savedNote, isUpdate);
    });

    this.updaterService = new UpdaterService('v1.0.1');

    this.init();
  }

  init() {
    this.particles.start();
    this.themeEngine.applyTheme();
    this.bindDOM();
    this.renderDayCyclePills();
    this.checkBatteryOptimizationStatus();
    this.setupNetworkMonitor();
    this.setupMidnightTimer();

    // Subscribe to state engines
    this.themeEngine.subscribe(config => this.onThemeChanged(config));
    this.notesEngine.subscribe(notes => this.renderNotesList(notes));
    this.profileEngine.subscribe(profile => this.onProfileChanged(profile));

    // Handle App entry welcome and flush queued notes
    setTimeout(() => {
      if (this.profileEngine.profile.isCreated) {
        this.profileEngine.handleAppLaunch(this.themeEngine.getActiveDayConfig());
      } else {
        this.openModal('profile-modal');
      }
    }, 1000);

    // Initial check for updates in background
    setTimeout(() => {
      this.checkUpdatesQuietly();
    }, 2500);
  }

  showToast(message, type = 'normal') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-12 left-1/2 -translate-x-1/2 z-50 flex flex-col space-y-2 pointer-events-none w-11/12 max-w-sm';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const border = type === 'success' ? 'border-emerald-500/40 bg-emerald-950/80' : 'border-pink-500/40 bg-slate-900/90';
    toast.className = `p-3 rounded-2xl glass-card border ${border} text-xs text-white text-center shadow-2xl backdrop-blur-xl transition-all duration-300 transform -translate-y-2 opacity-0`;
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('-translate-y-2', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => toast.remove(), 350);
    }, 2800);
  }

  setupMidnightTimer() {
    let lastDay = new Date().getDay();
    setInterval(() => {
      const currentDay = new Date().getDay();
      if (currentDay !== lastDay) {
        lastDay = currentDay;
        if (this.themeEngine.selectedDayIndex === null) {
          this.themeEngine.applyTheme();
          this.renderDayCyclePills();
          this.showToast('🌅 Midnight transition: Welcome to a new day!', 'success');
        }
      }
    }, 30000);
  }

  bindDOM() {
    // Navigation Tabs
    const tabs = ['home', 'notes', 'profile', 'updates'];
    tabs.forEach(tab => {
      const btn = document.getElementById(`nav-${tab}`);
      if (btn) {
        btn.addEventListener('click', () => this.switchTab(tab));
      }
    });

    // Quick Prompt Answer Button
    const btnAnswerPrompt = document.getElementById('btn-answer-prompt');
    if (btnAnswerPrompt) {
      btnAnswerPrompt.addEventListener('click', () => {
        const config = this.themeEngine.getActiveDayConfig();
        this.openNoteEditor({
          title: `${config.name} Reflection`,
          content: `Reflecting on: "${config.prompt}"\n\n`,
          dayTag: config.name,
          category: 'Reflection'
        });
      });
    }

    // New Note FAB
    const fabNewNote = document.getElementById('fab-new-note');
    if (fabNewNote) {
      fabNewNote.addEventListener('click', () => {
        const config = this.themeEngine.getActiveDayConfig();
        this.openNoteEditor({
          title: '',
          content: '',
          dayTag: config.name,
          category: 'Thoughts'
        });
      });
    }

    // Note Search Input
    const searchInput = document.getElementById('notes-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const filtered = this.notesEngine.searchNotes(e.target.value);
        this.renderNotesList(filtered);
      });
    }

    // Save Note Modal
    const btnSaveNote = document.getElementById('btn-save-note');
    if (btnSaveNote) {
      btnSaveNote.addEventListener('click', () => this.handleSaveNote());
    }

    // Close Note Modal
    const btnCloseNoteModal = document.getElementById('btn-close-note-modal');
    if (btnCloseNoteModal) {
      btnCloseNoteModal.addEventListener('click', () => this.closeModal('note-editor-modal'));
    }

    // Profile Edit Button
    const btnEditProfile = document.getElementById('btn-edit-profile');
    if (btnEditProfile) {
      btnEditProfile.addEventListener('click', () => this.openModal('profile-modal'));
    }

    // Save Profile Button
    const btnSaveProfile = document.getElementById('btn-save-profile');
    if (btnSaveProfile) {
      btnSaveProfile.addEventListener('click', () => this.handleSaveProfile());
    }

    // Close Profile Modal
    const btnCloseProfileModal = document.getElementById('btn-close-profile-modal');
    if (btnCloseProfileModal) {
      btnCloseProfileModal.addEventListener('click', () => this.closeModal('profile-modal'));
    }

    // Gallery Photo Pickers
    const fileInput = document.getElementById('input-profile-gallery-file');
    const triggerBtn = document.getElementById('btn-trigger-gallery-pick');
    const avatarContainer = document.getElementById('avatar-preview-container');

    if (triggerBtn && fileInput) {
      triggerBtn.addEventListener('click', () => fileInput.click());
    }
    if (avatarContainer && fileInput) {
      avatarContainer.addEventListener('click', () => fileInput.click());
    }
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          try {
            const base64Img = await this.profileEngine.processGalleryImage(file);
            this.selectedAvatar = base64Img;
            this.updateAvatarPreview(base64Img);
            this.showToast('Photo selected from gallery ✨');
          } catch (err) {
            alert(err.message || 'Error processing selected photo.');
          }
        }
      });
    }

    // Battery Optimization Banner Button
    const btnBattery = document.getElementById('btn-enable-battery-opt');
    if (btnBattery) {
      btnBattery.addEventListener('click', () => {
        localStorage.setItem('saif_verse_battery_whitelisted', 'true');
        const banner = document.getElementById('battery-banner');
        if (banner) banner.classList.add('hidden');
        this.showToast('⚡ Always active background enabled.', 'success');
      });
    }

    // Check for Updates Button
    const btnCheckUpdate = document.getElementById('btn-manual-check-update');
    if (btnCheckUpdate) {
      btnCheckUpdate.addEventListener('click', () => this.handleManualCheckUpdate());
    }

    // Day Mode: Real Auto vs Manual switch
    const btnAutoDay = document.getElementById('btn-auto-day');
    if (btnAutoDay) {
      btnAutoDay.addEventListener('click', () => {
        this.themeEngine.setAutoDay();
        this.renderDayCyclePills();
        this.showToast('📅 Synced to real calendar time.');
      });
    }
  }

  setupNetworkMonitor() {
    const updateNetworkUI = () => {
      const syncPill = document.getElementById('sync-status-pill');
      const queueBadge = document.getElementById('offline-queue-badge');
      const queue = this.webhookBridge.getOfflineQueue();

      if (!navigator.onLine) {
        if (syncPill) {
          syncPill.textContent = 'Offline Mode';
          syncPill.classList.remove('hidden');
        }
        if (queueBadge) {
          queueBadge.textContent = `${queue.length} Queued`;
          queueBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300';
        }
      } else {
        if (syncPill) syncPill.classList.add('hidden');
        if (queueBadge) {
          queueBadge.textContent = 'Connected';
          queueBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300';
        }
      }
    };

    window.addEventListener('online', () => {
      updateNetworkUI();
      this.showToast('🌐 Internet restored! Syncing queued notes...', 'success');
      this.webhookBridge.flushOfflineQueue();
    });

    window.addEventListener('offline', () => {
      updateNetworkUI();
      this.showToast('⚠️ Offline: Notes will queue safely.');
    });

    updateNetworkUI();
  }

  checkBatteryOptimizationStatus() {
    const isWhitelisted = localStorage.getItem('saif_verse_battery_whitelisted');
    const banner = document.getElementById('battery-banner');
    if (!isWhitelisted && banner) {
      banner.classList.remove('hidden');
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    const views = ['home', 'notes', 'profile', 'updates'];
    views.forEach(v => {
      const viewEl = document.getElementById(`view-${v}`);
      const navBtn = document.getElementById(`nav-${v}`);
      if (viewEl) {
        if (v === tabName) {
          viewEl.classList.remove('hidden');
          viewEl.classList.add('flex');
        } else {
          viewEl.classList.add('hidden');
          viewEl.classList.remove('flex');
        }
      }
      if (navBtn) {
        if (v === tabName) {
          navBtn.classList.add('text-white', 'scale-110');
          navBtn.classList.remove('text-gray-400');
        } else {
          navBtn.classList.remove('text-white', 'scale-110');
          navBtn.classList.add('text-gray-400');
        }
      }
    });

    if (tabName === 'profile') {
      this.particles.setMode('cherry_blossom');
    } else {
      this.particles.setMode(this.themeEngine.getActiveDayConfig().particleMode);
    }
  }

  renderDayCyclePills() {
    const container = document.getElementById('day-pills-container');
    if (!container) return;

    container.innerHTML = '';
    const activeIdx = this.themeEngine.selectedDayIndex !== null 
      ? this.themeEngine.selectedDayIndex 
      : this.themeEngine.getCurrentRealDayIndex();

    DAYS_CONFIG.forEach((d, i) => {
      const isSelected = activeIdx === i;
      const isTodayReal = new Date().getDay() === i;

      const pill = document.createElement('button');
      pill.className = `px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center space-x-1.5 border ${
        isSelected
          ? 'bg-white/20 border-white/40 text-white shadow-lg shadow-pink-500/10'
          : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
      }`;
      pill.innerHTML = `
        <span>${d.name.slice(0, 3)}</span>
        ${isTodayReal ? '<span class="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse"></span>' : ''}
      `;

      pill.addEventListener('click', () => {
        this.themeEngine.setManualDay(i);
        this.renderDayCyclePills();
      });

      container.appendChild(pill);
    });
  }

  onThemeChanged(config) {
    const greetingEl = document.getElementById('home-greeting');
    const dayNameEl = document.getElementById('home-day-name');
    const badgeEl = document.getElementById('home-day-badge');
    const promptTextEl = document.getElementById('home-prompt-text');

    if (greetingEl) greetingEl.textContent = config.greeting;
    if (dayNameEl) dayNameEl.textContent = config.name;
    if (badgeEl) badgeEl.textContent = config.badge;
    if (promptTextEl) promptTextEl.textContent = `"${config.prompt}"`;
  }

  onProfileChanged(profile) {
    const nameEls = document.querySelectorAll('.user-display-name');
    const bioEls = document.querySelectorAll('.user-bio-text');
    const avatarEls = document.querySelectorAll('.user-avatar-img');

    nameEls.forEach(el => el.textContent = profile.username || 'Welcome, Creator');
    bioEls.forEach(el => el.textContent = profile.bio);
    avatarEls.forEach(el => {
      el.src = profile.avatar || DEFAULT_AVATAR;
    });

    const inputName = document.getElementById('input-profile-username');
    const inputBio = document.getElementById('input-profile-bio');
    if (inputName) inputName.value = profile.username || '';
    if (inputBio) inputBio.value = profile.bio || '';
    this.selectedAvatar = profile.avatar || DEFAULT_AVATAR;
    this.updateAvatarPreview(this.selectedAvatar);
  }

  updateAvatarPreview(url) {
    const preview = document.getElementById('profile-edit-avatar-preview');
    if (preview) preview.src = url;
  }

  handleSaveProfile() {
    const inputName = document.getElementById('input-profile-username');
    const inputBio = document.getElementById('input-profile-bio');

    const username = inputName ? inputName.value.trim() : '';
    const bio = inputBio ? inputBio.value.trim() : '';

    if (!username) {
      alert('Please enter your name to customize your SAIF-VERSE experience!');
      return;
    }

    this.profileEngine.createOrUpdateProfile({
      username,
      bio,
      avatar: this.selectedAvatar
    });

    this.closeModal('profile-modal');
    this.showToast('🌸 Profile saved & identity synchronized!', 'success');
  }

  openNoteEditor(noteData = null) {
    this.editingNoteId = noteData && noteData.id ? noteData.id : null;
    const titleInput = document.getElementById('input-note-title');
    const contentInput = document.getElementById('input-note-content');
    const categorySelect = document.getElementById('select-note-category');

    if (titleInput) titleInput.value = noteData ? noteData.title : '';
    if (contentInput) contentInput.value = noteData ? noteData.content : '';
    if (categorySelect) categorySelect.value = noteData && noteData.category ? noteData.category : 'Thoughts';

    this.openModal('note-editor-modal');
  }

  handleSaveNote() {
    const titleInput = document.getElementById('input-note-title');
    const contentInput = document.getElementById('input-note-content');
    const categorySelect = document.getElementById('select-note-category');

    const title = titleInput ? titleInput.value.trim() : '';
    const content = contentInput ? contentInput.value.trim() : '';
    const category = categorySelect ? categorySelect.value : 'Thoughts';

    if (!title && !content) {
      alert('Please enter a note title or content.');
      return;
    }

    if (this.editingNoteId) {
      this.notesEngine.updateNote(this.editingNoteId, { title, content, category });
      this.showToast('✏️ Note updated and synced!', 'success');
    } else {
      const config = this.themeEngine.getActiveDayConfig();
      this.notesEngine.createNote({
        title,
        content,
        dayTag: config.name,
        category
      });
      this.showToast('📝 Note published to Discord community!', 'success');
    }

    this.closeModal('note-editor-modal');
  }

  handleNoteSaved(savedNote, isUpdate) {
    const profile = this.profileEngine.profile;
    this.webhookBridge.sendNoteNotification({
      username: profile.username || 'Saif Explorer',
      avatar: profile.avatar || DEFAULT_AVATAR,
      note: savedNote,
      isUpdate
    });
  }

  renderNotesList(notes) {
    const container = document.getElementById('notes-grid-container');
    const emptyState = document.getElementById('notes-empty-state');
    const countBadge = document.getElementById('notes-total-count');

    if (countBadge) countBadge.textContent = notes.length;
    if (!container) return;

    if (notes.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    container.innerHTML = '';

    notes.forEach(note => {
      const card = document.createElement('div');
      card.className = 'glass-card p-4 relative flex flex-col justify-between group';
      
      const formattedDate = new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-white/10 text-white/80 border border-white/10">
              ${note.dayTag || 'Daily'} • ${note.category || 'General'}
            </span>
            <button class="btn-pin-note text-white/50 hover:text-yellow-400 transition-colors p-1" data-id="${note.id}">
              ${note.isPinned ? '★' : '☆'}
            </button>
          </div>
          <h3 class="font-bold text-base text-white/95 leading-tight mb-1 line-clamp-1">${note.title}</h3>
          <p class="text-xs text-white/70 line-clamp-3 leading-relaxed whitespace-pre-wrap">${note.content}</p>
        </div>
        <div class="flex items-center justify-between mt-3 pt-2 border-t border-white/10 text-[10px] text-white/50">
          <span>${formattedDate}</span>
          <div class="flex items-center space-x-2">
            <button class="btn-edit-note text-white/70 hover:text-pink-400 p-1" data-id="${note.id}">
              Edit
            </button>
            <button class="btn-delete-note text-white/50 hover:text-red-400 p-1" data-id="${note.id}">
              Delete
            </button>
          </div>
        </div>
      `;

      const btnPin = card.querySelector('.btn-pin-note');
      btnPin.addEventListener('click', (e) => {
        e.stopPropagation();
        this.notesEngine.togglePin(note.id);
      });

      const btnEdit = card.querySelector('.btn-edit-note');
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openNoteEditor(note);
      });

      const btnDelete = card.querySelector('.btn-delete-note');
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${note.title}"?`)) {
          this.notesEngine.deleteNote(note.id);
          this.showToast('🗑️ Note removed');
        }
      });

      card.addEventListener('click', () => {
        this.openNoteEditor(note);
      });

      container.appendChild(card);
    });
  }

  async checkUpdatesQuietly() {
    const res = await this.updaterService.checkForUpdates();
    const updateDot = document.getElementById('nav-update-dot');
    if (updateDot) {
      if (res.hasUpdate) {
        updateDot.classList.remove('hidden');
      } else {
        updateDot.classList.add('hidden');
      }
    }
  }

  async handleManualCheckUpdate() {
    const statusText = document.getElementById('update-status-text');
    const updateCard = document.getElementById('update-result-card');
    const downloadBtn = document.getElementById('btn-download-update');

    if (statusText) {
      statusText.textContent = 'Checking GitHub releases...';
      statusText.className = 'text-[11px] text-center text-white/60 italic';
    }

    const res = await this.updaterService.checkForUpdates();

    if (res.hasUpdate) {
      if (statusText) {
        statusText.textContent = `⚡ New update found: ${res.latestVersion}`;
        statusText.className = 'text-xs text-center text-pink-400 font-bold';
      }

      if (updateCard) {
        updateCard.classList.remove('hidden');
        const changelogEl = document.getElementById('update-changelog-text');
        if (changelogEl) changelogEl.textContent = res.changelog || 'New enhancements and updates available.';
      }

      if (downloadBtn) {
        downloadBtn.classList.remove('hidden');
        downloadBtn.onclick = () => {
          this.showToast('🚀 Starting APK download...', 'success');
          this.updaterService.downloadUpdate(res.downloadUrl);
        };
      }
    } else {
      if (statusText) {
        statusText.textContent = `✨ You are on the latest version (${res.currentVersion}). Everything is up to date!`;
        statusText.className = 'text-xs text-center text-emerald-400 font-semibold';
      }

      if (updateCard) {
        updateCard.classList.add('hidden');
      }
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }
}

// Bootstrap on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  window.saifVerse = new SaifVerseApp();
});
