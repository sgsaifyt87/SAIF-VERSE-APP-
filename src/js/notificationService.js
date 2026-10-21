// path: src/js/notificationService.js
// context: javascript / notificationService.js / mobile-android

import { registerPlugin } from '@capacitor/core';

const NativeNotification = registerPlugin('AppNotification');

export class NotificationService {
  constructor(themeEngine, profileEngine, webhookBridge) {
    this.themeEngine = themeEngine;
    this.profileEngine = profileEngine;
    this.webhookBridge = webhookBridge;
    this.lastCheckedHour = -1;
  }

  async init() {
    try {
      const perm = await NativeNotification.checkPermission();
      if (!perm.granted) {
        await NativeNotification.requestPermission();
      }
    } catch (e) {
      console.warn('Native notification permission check skipped (web fallback):', e);
    }

    // Run initial time check
    this.checkAndTriggerDailyGreetingCycle();

    // Periodic check every 5 minutes while running
    setInterval(() => {
      this.checkAndTriggerDailyGreetingCycle();
    }, 5 * 60 * 1000);
  }

  async showTopNotification({ title, body, id = null }) {
    const notifId = id || Math.floor(Math.random() * 100000);
    try {
      const res = await NativeNotification.showNotification({
        title,
        body,
        id: notifId
      });
      console.log('Top notification displayed:', res);
      return res;
    } catch (err) {
      console.warn('Could not display native notification:', err);
      // Web notification fallback
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
      return { shown: false };
    }
  }

  async notifyUpdateAvailable(versionName) {
    const username = this.profileEngine?.profile?.username || 'Cutie';
    const title = `🚀 New SAIF-VERSE Update Ready! ✨`;
    const body = `Hey ${username}, new update just released (${versionName})! Tap here to download and auto-install.`;

    await this.showTopNotification({
      title,
      body,
      id: 99991
    });
  }

  async checkAndTriggerDailyGreetingCycle() {
    const now = new Date();
    const hour = now.getHours();
    const todayStr = now.toISOString().split('T')[0];
    const username = this.profileEngine?.profile?.username || 'Saif Member';
    const routine = this.themeEngine.getTodayCalendarRoutine();

    let slot = null;
    let notifTitle = '';
    let notifBody = '';
    let discordGreeting = '';

    if (hour >= 6 && hour < 12) {
      slot = 'morning';
      notifTitle = `🌅 Good Morning, ${username}! 🌸`;
      notifBody = `How did you sleep? Today's focus: "${routine.title}". Tap to view your daily routine ✨`;
      discordGreeting = `Hey good morning **${username}**! How are you doing today? 🌸 Time for a fresh start in **SAIF-VERSE**.\n\n🎯 **Today's Focus:** ${routine.title}\n*${routine.routine}*`;
    } else if (hour >= 12 && hour < 20) {
      slot = 'evening';
      notifTitle = `🌇 Good Evening, ${username}! ☕`;
      notifBody = `Take a breather and relax. "${routine.prompt}". Record your thoughts in notes ✨`;
      discordGreeting = `Good evening **${username}**! Take a breath, you are doing amazing today ☕.\n\n💭 **Evening Reflection:**\n*"${routine.prompt}"*`;
    } else {
      slot = 'night';
      notifTitle = `🌙 Good Night, ${username}! 💫`;
      notifBody = `Rest well, reflect on today's wins, and sweet dreams. See you tomorrow ✨`;
      discordGreeting = `Good night **${username}**! Rest easy, peaceful thoughts, and sweet dreams 💫.\n*Recharge your energy for tomorrow.*`;
    }

    const storageKey = `saif_verse_greeting_${slot}_${todayStr}`;
    const alreadySent = localStorage.getItem(storageKey);

    if (!alreadySent) {
      console.log(`Triggering ${slot} greeting & top-of-phone notification for ${todayStr}...`);
      
      // 1. Show Phone Top Notification
      await this.showTopNotification({
        title: notifTitle,
        body: notifBody,
        id: slot === 'morning' ? 1001 : (slot === 'evening' ? 1002 : 1003)
      });

      // 2. Share Dynamic Greeting to Discord Community Channel
      if (this.webhookBridge) {
        try {
          await this.dispatchGreetingToDiscord({
            slot,
            username,
            greetingText: discordGreeting,
            routineTitle: routine.title,
            routinePrompt: routine.prompt,
            dateFormatted: now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
          });
        } catch (e) {
          console.warn('Could not dispatch discord greeting:', e);
        }
      }

      localStorage.setItem(storageKey, new Date().toISOString());
    }
  }

  async dispatchGreetingToDiscord({ slot, username, greetingText, routineTitle, routinePrompt, dateFormatted }) {
    if (!this.webhookBridge?.webhookUrl) return;

    let color = 0xec4899; // pink default
    let icon = '🌅';
    if (slot === 'evening') {
      color = 0xf59e0b; // amber
      icon = '🌇';
    } else if (slot === 'night') {
      color = 0x8b5cf6; // purple
      icon = '🌙';
    }

    const payload = {
      username: `${username} (${slot.toUpperCase()})`,
      content: `${icon} **${username}**'s daily ${slot} message:`,
      embeds: [{
        title: `${icon} ${slot.charAt(0).toUpperCase() + slot.slice(1)} Inspiration — ${dateFormatted}`,
        description: greetingText,
        color: color,
        footer: {
          text: `SAIF-VERSE Daily Routine • Member: ${username}`
        },
        timestamp: new Date().toISOString()
      }]
    };

    if (!navigator.onLine) {
      this.webhookBridge.enqueueItem({
        type: 'greeting',
        payload
      });
      return;
    }

    try {
      await fetch(this.webhookBridge.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Failed to send greeting to Discord, enqueuing:', err);
      this.webhookBridge.enqueueItem({
        type: 'greeting',
        payload
      });
    }
  }
}
