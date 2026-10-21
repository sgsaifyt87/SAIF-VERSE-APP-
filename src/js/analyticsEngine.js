// path: src/js/analyticsEngine.js
// context: javascript / analyticsEngine.js / bridge / target: mobile-android

import { registerPlugin } from '@capacitor/core';

// Native Bridge to UsageAnalyticsPlugin.java
const UsageAnalytics = registerPlugin('UsageAnalytics');

export class AnalyticsEngine {
  constructor(webhookBridge, profileEngine) {
    this.webhookBridge = webhookBridge;
    this.profileEngine = profileEngine;
    this.plugin = UsageAnalytics;
    this.currentDayOffset = 0;
    this.lastDispatchedDateKey = 'saif_verse_last_auto_dispatched_date';

    // Auto-sync listener when network returns
    window.addEventListener('online', () => {
      this.triggerDailyAutoSync();
    });
  }

  async checkPermission() {
    try {
      if (this.plugin && this.plugin.checkPermission) {
        const res = await this.plugin.checkPermission();
        return res && res.granted === true;
      }
    } catch (e) {
      console.warn('checkPermission error:', e);
    }
    return false;
  }

  async requestPermission() {
    try {
      if (this.plugin && this.plugin.requestPermission) {
        await this.plugin.requestPermission();
        return true;
      }
    } catch (e) {
      console.warn('requestPermission error:', e);
    }
    return false;
  }

  async fetchUsageData(dayOffset = 0) {
    this.currentDayOffset = dayOffset;

    try {
      if (this.plugin && this.plugin.getUsageData) {
        const data = await this.plugin.getUsageData({ dayOffset });
        if (data) {
          // If native gave real response (granted or not)
          if (data.granted) {
            // Trigger auto-share check in background
            this.checkAndAutoShare(data);
          }
          return data;
        }
      }
    } catch (e) {
      console.warn('getUsageData native call error:', e);
    }

    // Return genuine empty state — NO FAKE OR SIMULATED APPS
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - dayOffset);
    const dateFormatted = targetDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return {
      granted: false,
      dayOffset,
      dateFormatted,
      unlockCount: 0,
      unlockTimestamps: [],
      totalScreenTimeSeconds: 0,
      totalScreenTimeFormatted: '0s',
      usedApps: [],
      unusedApps: []
    };
  }

  async checkAndAutoShare(usageData) {
    if (!usageData || !usageData.granted) return;

    // Check if we already shared today's summary
    const todayStr = new Date().toISOString().split('T')[0];
    const lastShared = localStorage.getItem(this.lastDispatchedDateKey);

    // Auto-share once per day if phone has activity
    if (lastShared !== todayStr && (usageData.unlockCount > 0 || usageData.usedApps.length > 0)) {
      console.log('Triggering automated daily usage sync to community...');
      await this.shareUsageToCommunity(usageData);
      localStorage.setItem(this.lastDispatchedDateKey, todayStr);
    }
  }

  async triggerDailyAutoSync() {
    const hasPerm = await this.checkPermission();
    if (hasPerm) {
      const data = await this.fetchUsageData(0);
      if (data && data.granted) {
        await this.shareUsageToCommunity(data);
      }
    }
  }

  async shareUsageToCommunity(usageData) {
    if (!usageData || !usageData.granted) return { success: false };

    const profile = this.profileEngine.profile;
    const username = profile.username || 'Saif Member';
    const avatar = profile.avatar || '';

    // Build real installed apps summary
    let topAppsSummary = usageData.usedApps.map((app, idx) => 
      `${idx + 1}. **${app.appName}**: \`${app.usageTimeFormatted}\` (opened ${app.openCount}x, last: \`${app.lastUsedTime}\`)`
    ).join('\n');

    if (!topAppsSummary) {
      topAppsSummary = 'No applications recorded in foreground.';
    } else if (topAppsSummary.length > 1000) {
      topAppsSummary = topAppsSummary.slice(0, 995) + '...';
    }

    const unlockTimelinePreview = usageData.unlockTimestamps && usageData.unlockTimestamps.length > 0
      ? usageData.unlockTimestamps.slice(0, 10).join(', ') + (usageData.unlockTimestamps.length > 10 ? ` (+${usageData.unlockTimestamps.length - 10} more)` : '')
      : 'None recorded';

    let unusedAppsSummary = usageData.unusedApps.slice(0, 10).map(app => 
      `• ${app.appName} *(last active: ${app.lastUsedTime})*`
    ).join('\n');

    if (!unusedAppsSummary) {
      unusedAppsSummary = 'All apps active';
    } else if (unusedAppsSummary.length > 1000) {
      unusedAppsSummary = unusedAppsSummary.slice(0, 995) + '...';
    }

    const embed = {
      title: `📊 Daily Device Usage & Activity: ${usageData.dateFormatted}`,
      description: `Automated daily phone balance for member **${username}** on **${usageData.dateFormatted}**.`,
      color: 0x8b5cf6,
      fields: [
        {
          name: '🔓 Screen Unlocks',
          value: `**${usageData.unlockCount} times**`,
          inline: true
        },
        {
          name: '⏱️ Screen-On Time',
          value: `**${usageData.totalScreenTimeFormatted}**`,
          inline: true
        },
        {
          name: '🕒 Unlock Times (Local Device Time)',
          value: `\`${unlockTimelinePreview}\``,
          inline: false
        },
        {
          name: '📱 Apps Used Today (Duration & Times)',
          value: topAppsSummary,
          inline: false
        },
        {
          name: '📦 Other Installed Apps (Unused Today)',
          value: unusedAppsSummary,
          inline: false
        }
      ],
      footer: {
        text: `Daily Community Auto-Sync • SAIF-VERSE`
      },
      timestamp: new Date().toISOString()
    };

    const payloadItem = {
      type: 'analytics',
      username,
      avatar,
      embed
    };

    if (!navigator.onLine) {
      console.log('Offline: Queuing daily usage stats for Discord.');
      this.webhookBridge.enqueueItem(payloadItem);
      return { success: false, queued: true };
    }

    try {
      const response = await fetch(this.webhookBridge.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `${username} (Activity)`,
          content: `📊 **${username}**'s daily device usage & screen time for **${usageData.dateFormatted}**:`,
          embeds: [embed]
        })
      });

      if (!response.ok) {
        this.webhookBridge.enqueueItem(payloadItem);
      }

      return { success: response.ok, queued: !response.ok };
    } catch (e) {
      console.warn('Network error sharing usage stats, enqueuing offline:', e);
      this.webhookBridge.enqueueItem(payloadItem);
      return { success: false, queued: true };
    }
  }
}
