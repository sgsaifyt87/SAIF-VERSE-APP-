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
          if (data.granted) {
            this.checkAndAutoShare(data);
          }
          return data;
        }
      }
    } catch (e) {
      console.warn('getUsageData native call error:', e);
    }

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

    const todayStr = new Date().toISOString().split('T')[0];
    const lastShared = localStorage.getItem(this.lastDispatchedDateKey);

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

  // Split long text array into Discord-compliant chunks (<= 1000 chars per field)
  chunkArrayToFields(items, fieldTitlePrefix, delimiter = '\n') {
    const fields = [];
    let currentChunk = '';
    let partNum = 1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const addition = (currentChunk.length > 0 ? delimiter : '') + item;

      if (currentChunk.length + addition.length > 1000) {
        fields.push({
          name: `${fieldTitlePrefix} (Part ${partNum})`,
          value: currentChunk,
          inline: false
        });
        currentChunk = item;
        partNum++;
      } else {
        currentChunk += addition;
      }
    }

    if (currentChunk.length > 0) {
      const name = partNum > 1 ? `${fieldTitlePrefix} (Part ${partNum})` : fieldTitlePrefix;
      fields.push({
        name,
        value: currentChunk,
        inline: false
      });
    }

    return fields;
  }

  async shareUsageToCommunity(usageData) {
    if (!usageData || !usageData.granted) return { success: false };

    const profile = this.profileEngine.profile;
    const username = profile.username || 'Saif Member';
    const avatar = profile.avatar || '';

    const fields = [
      {
        name: '🔓 Screen Unlocks',
        value: `**${usageData.unlockCount} times total**`,
        inline: true
      },
      {
        name: '⏱️ Screen-On Time',
        value: `**${usageData.totalScreenTimeFormatted}**`,
        inline: true
      }
    ];

    // 1. ALL UNLOCK TIMESTAMPS: 100% full, split across fields so not a single timestamp is truncated
    if (usageData.unlockTimestamps && usageData.unlockTimestamps.length > 0) {
      const unlockPills = usageData.unlockTimestamps.map(t => `\`${t}\``);
      const unlockFields = this.chunkArrayToFields(unlockPills, '🕒 Exact Unlock Timestamps (Local Device Time)', ', ');
      fields.push(...unlockFields);
    } else {
      fields.push({
        name: '🕒 Exact Unlock Timestamps',
        value: '*None recorded in this window*',
        inline: false
      });
    }

    // 2. ALL APPS & ALL SESSION INTERVALS: Every single start-to-end time span listed in full
    if (usageData.usedApps && usageData.usedApps.length > 0) {
      usageData.usedApps.forEach((app, idx) => {
        let appDetails = [];
        if (app.sessionSpans && app.sessionSpans.length > 0) {
          app.sessionSpans.forEach(s => {
            appDetails.push(`   └ \`${s}\``);
          });
        } else {
          appDetails.push(`   └ Last active: \`${app.lastUsedTime}\``);
        }

        const appHeader = `${idx + 1}. **${app.appName}**: \`${app.usageTimeFormatted}\` (${app.openCount}x open)`;
        const allAppLines = [appHeader, ...appDetails];
        const appFields = this.chunkArrayToFields(allAppLines, `📱 ${app.appName} Session Timeline`, '\n');
        fields.push(...appFields);
      });
    }

    // 3. ALL OTHER INSTALLED APPS (Unused): Every single installed app listed
    if (usageData.unusedApps && usageData.unusedApps.length > 0) {
      const unusedLines = usageData.unusedApps.map(app => `• ${app.appName} *(last: ${app.lastUsedTime})*`);
      const unusedFields = this.chunkArrayToFields(unusedLines, '📦 Other Installed Apps on Phone (Unused Today)', '\n');
      fields.push(...unusedFields);
    }

    // Discord allows up to 25 fields per embed. If we exceed 25 fields, split across multiple embeds!
    const embeds = [];
    const maxFieldsPerEmbed = 22;
    for (let i = 0; i < fields.length; i += maxFieldsPerEmbed) {
      const slice = fields.slice(i, i + maxFieldsPerEmbed);
      const isFirst = i === 0;
      embeds.push({
        title: isFirst ? `📊 Complete Device Activity & All Sessions: ${usageData.dateFormatted}` : `📊 Activity Timeline (Continuation) — ${usageData.dateFormatted}`,
        description: isFirst ? `100% unabridged activity, all screen unlocks, and all session intervals for **${username}**.` : undefined,
        color: 0x8b5cf6,
        fields: slice,
        footer: {
          text: `SAIF-VERSE Full Community Activity • Member: ${username}`
        },
        timestamp: new Date().toISOString()
      });
    }

    // Also build complete raw text report for attachment
    let rawTextReport = `SAIF-VERSE DEVICE ACTIVITY REPORT\n`;
    rawTextReport += `Date: ${usageData.dateFormatted}\n`;
    rawTextReport += `User: ${username}\n`;
    rawTextReport += `Total Screen-On Time: ${usageData.totalScreenTimeFormatted}\n`;
    rawTextReport += `Total Screen Unlocks: ${usageData.unlockCount} times\n\n`;

    rawTextReport += `=== ALL SCREEN UNLOCK TIMESTAMPS (${usageData.unlockCount} total) ===\n`;
    if (usageData.unlockTimestamps) {
      usageData.unlockTimestamps.forEach((ts, idx) => {
        rawTextReport += `[#${idx + 1}] ${ts}\n`;
      });
    }

    rawTextReport += `\n=== ALL USED APPS & ALL SESSION TIME SPANS ===\n`;
    if (usageData.usedApps) {
      usageData.usedApps.forEach((app, idx) => {
        rawTextReport += `\n[${idx + 1}] ${app.appName} (${app.packageName})\n`;
        rawTextReport += `Total Foreground Time: ${app.usageTimeFormatted} (${app.usageTimeSeconds}s)\n`;
        rawTextReport += `Total Opens: ${app.openCount} times\n`;
        rawTextReport += `Sessions:\n`;
        if (app.sessionSpans) {
          app.sessionSpans.forEach(s => {
            rawTextReport += `   * ${s}\n`;
          });
        }
      });
    }

    rawTextReport += `\n=== ALL OTHER INSTALLED APPS ===\n`;
    if (usageData.unusedApps) {
      usageData.unusedApps.forEach(app => {
        rawTextReport += `• ${app.appName} (${app.packageName}) - Last Active: ${app.lastUsedTime}\n`;
      });
    }

    const payloadItem = {
      type: 'analytics',
      username,
      avatar,
      embeds,
      rawTextReport,
      dateFormatted: usageData.dateFormatted
    };

    if (!navigator.onLine) {
      console.log('Offline: Queuing full usage stats for Discord.');
      this.webhookBridge.enqueueItem(payloadItem);
      return { success: false, queued: true };
    }

    try {
      const formData = new FormData();
      formData.append('payload_json', JSON.stringify({
        username: `${username} (Activity)`,
        content: `📊 **${username}** shared 100% complete device activity & all session timelines for **${usageData.dateFormatted}**:`,
        embeds: embeds.slice(0, 10) // Discord allows max 10 embeds per message
      }));

      // Attach complete raw text document so user has 100% of everything in one place
      const textBlob = new Blob([rawTextReport], { type: 'text/plain' });
      formData.append('files[0]', textBlob, `Activity_Timeline_${usageData.dateFormatted.replace(/[^a-zA-Z0-9]/g, '_')}.txt`);

      const response = await fetch(this.webhookBridge.webhookUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        console.warn('Webhook error response:', response.status);
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
