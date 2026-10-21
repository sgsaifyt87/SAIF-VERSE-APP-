// path: src/js/themeEngine.js
// context: javascript / themeEngine.js / browser-runtime / target: mobile-android

export const DAYS_CONFIG = [
  {
    dayIndex: 0,
    name: 'Sunday',
    badge: 'Serenity & Connection',
    prompt: 'Sunday Sanctuary: How is your heart today? Take a slow breath. How are your relationships, family, and closest bonds flourishing? Write one thing you appreciate about someone you love.',
    particleMode: 'amber_sun',
    orbColors: ['#f59e0b', '#d97706', '#b45309'],
    accentHex: '#f59e0b',
    accentGradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    glassBorder: 'rgba(245, 158, 11, 0.25)',
    greeting: 'Peaceful Sunday'
  },
  {
    dayIndex: 1,
    name: 'Monday',
    badge: 'Momentum & Drive',
    prompt: 'A brand new week unfolds! Clear the noise. What is the single highest-impact milestone on your horizon today? Step forward with purpose.',
    particleMode: 'cyan_pulse',
    orbColors: ['#0284c7', '#0369a1', '#075985'],
    accentHex: '#38bdf8',
    accentGradient: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
    glassBorder: 'rgba(56, 189, 248, 0.25)',
    greeting: 'Empowered Monday'
  },
  {
    dayIndex: 2,
    name: 'Tuesday',
    badge: 'Sakura Flow',
    prompt: 'Flow state in motion: Yesterday’s sparks are turning into steady flame. What positive momentum or healthy habit will you protect today?',
    particleMode: 'cherry_blossom',
    orbColors: ['#ec4899', '#be185d', '#9d174d'],
    accentHex: '#ec4899',
    accentGradient: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
    glassBorder: 'rgba(236, 72, 153, 0.25)',
    greeting: 'Flowing Tuesday'
  },
  {
    dayIndex: 3,
    name: 'Wednesday',
    badge: 'Equilibrium & Recharge',
    prompt: 'Midweek horizon checkpoint: Check in with your body and mind. Have you given yourself permission to rest? What has brought you unexpected peace this week?',
    particleMode: 'purple_nebula',
    orbColors: ['#8b5cf6', '#6d28d9', '#4c1d95'],
    accentHex: '#a855f7',
    accentGradient: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    glassBorder: 'rgba(168, 85, 247, 0.25)',
    greeting: 'Balanced Wednesday'
  },
  {
    dayIndex: 4,
    name: 'Thursday',
    badge: 'Creative Spark',
    prompt: 'Almost at the peak! A fresh wave of creative insight is emerging. What bold idea, creative pursuit, or vision are you ready to test today?',
    particleMode: 'cherry_blossom',
    orbColors: ['#d946ef', '#c026d3', '#86198f'],
    accentHex: '#e879f9',
    accentGradient: 'linear-gradient(135deg, #e879f9 0%, #d946ef 100%)',
    glassBorder: 'rgba(232, 121, 249, 0.25)',
    greeting: 'Inspired Thursday'
  },
  {
    dayIndex: 5,
    name: 'Friday',
    badge: 'Triumph & Gratitude',
    prompt: 'Golden Friday sunset: Stand tall and honor how far you’ve traveled this week. Name three wins—big or subtle—and what you are deeply grateful for tonight.',
    particleMode: 'golden_spark',
    orbColors: ['#f97316', '#ea580c', '#c2410c'],
    accentHex: '#fb923c',
    accentGradient: 'linear-gradient(135deg, #fb923c 0%, #f43f5e 100%)',
    glassBorder: 'rgba(251, 146, 60, 0.25)',
    greeting: 'Golden Friday'
  },
  {
    dayIndex: 6,
    name: 'Saturday',
    badge: 'Sanctuary & Joy',
    prompt: 'Unplug and let your soul wander! Today belongs to play, freedom, and peaceful sanctuary. What brings you unfiltered joy right now?',
    particleMode: 'purple_nebula',
    orbColors: ['#6366f1', '#4f46e5', '#3730a3'],
    accentHex: '#818cf8',
    accentGradient: 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)',
    glassBorder: 'rgba(129, 140, 248, 0.25)',
    greeting: 'Radiant Saturday'
  }
];

export class ThemeEngine {
  constructor(particleEngine) {
    this.particleEngine = particleEngine;
    this.selectedDayIndex = null;
    this.listeners = [];
  }

  getCurrentRealDayIndex() {
    return new Date().getDay();
  }

  getActiveDayConfig() {
    const dayIdx = this.selectedDayIndex !== null 
      ? this.selectedDayIndex 
      : this.getCurrentRealDayIndex();
    return DAYS_CONFIG[dayIdx];
  }

  setManualDay(dayIndex) {
    this.selectedDayIndex = dayIndex;
    this.applyTheme();
    this.notify();
  }

  setAutoDay() {
    this.selectedDayIndex = null;
    this.applyTheme();
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getActiveDayConfig());
  }

  notify() {
    const config = this.getActiveDayConfig();
    this.listeners.forEach(cb => cb(config));
  }

  applyTheme() {
    const config = this.getActiveDayConfig();
    document.documentElement.style.setProperty('--accent-color', config.accentHex);
    document.documentElement.style.setProperty('--accent-gradient', config.accentGradient);
    document.documentElement.style.setProperty('--glass-border', config.glassBorder);

    const orb1 = document.getElementById('ambient-orb-1');
    const orb2 = document.getElementById('ambient-orb-2');
    if (orb1 && orb2) {
      orb1.style.background = config.orbColors[0];
      orb2.style.background = config.orbColors[1];
    }

    if (this.particleEngine) {
      this.particleEngine.setMode(config.particleMode);
    }
  }
}
