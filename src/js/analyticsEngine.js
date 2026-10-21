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
      const res = await this.shareUsageToCommunity(usageData);
      if (res && res.success) {
        localStorage.setItem(this.lastDispatchedDateKey, todayStr);
        localStorage.setItem('saif_verse_last_synced_time', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    }
  }

  async triggerDailyAutoSync() {
    const hasPerm = await this.checkPermission();
    if (hasPerm) {
      const data = await this.fetchUsageData(0);
      if (data && data.granted) {
        await this.checkAndAutoShare(data);
      }
    }
  }

  startBackgroundAutoSync(intervalMinutes = 20) {
    // Initial sync check after 15 seconds
    setTimeout(() => this.triggerDailyAutoSync(), 15000);

    // Periodic check every intervalMinutes
    setInterval(() => {
      this.triggerDailyAutoSync();
    }, intervalMinutes * 60 * 1000);
  }

  // Split long text array into Discord-compliant chunks (<= 950 chars per field)
  chunkArrayToFields(items, fieldTitlePrefix, delimiter = '\n', maxChunkLen = 950) {
    const fields = [];
    let currentChunk = '';
    let partNum = 1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const addition = (currentChunk.length > 0 ? delimiter : '') + item;

      if (currentChunk.length + addition.length > maxChunkLen) {
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

  buildRawTextReport(usageData, username) {
    let rawTextReport = `SAIF-VERSE DEVICE ACTIVITY REPORT\n`;
    rawTextReport += `Date: ${usageData.dateFormatted}\n`;
    rawTextReport += `User: ${username}\n`;
    rawTextReport += `Total Screen-On Time: ${usageData.totalScreenTimeFormatted}\n`;
    rawTextReport += `Total Screen Unlocks: ${usageData.unlockCount} times\n\n`;

    rawTextReport += `=== ALL SCREEN UNLOCK TIMESTAMPS (${usageData.unlockCount} total) ===\n`;
    if (usageData.unlockTimestamps && usageData.unlockTimestamps.length > 0) {
      usageData.unlockTimestamps.forEach((ts, idx) => {
        rawTextReport += `[#${idx + 1}] ${ts}\n`;
      });
    } else {
      rawTextReport += `None recorded in this window\n`;
    }

    rawTextReport += `\n=== ALL USED APPS & ALL SESSION TIME SPANS ===\n`;
    if (usageData.usedApps && usageData.usedApps.length > 0) {
      usageData.usedApps.forEach((app, idx) => {
        rawTextReport += `\n[${idx + 1}] ${app.appName} (${app.packageName})\n`;
        rawTextReport += `Total Foreground Time: ${app.usageTimeFormatted} (${app.usageTimeSeconds}s)\n`;
        rawTextReport += `Total Opens: ${app.openCount} times\n`;
        rawTextReport += `Sessions:\n`;
        if (app.sessionSpans && app.sessionSpans.length > 0) {
          app.sessionSpans.forEach(s => {
            rawTextReport += `   * ${s}\n`;
          });
        } else {
          rawTextReport += `   * Last active: ${app.lastUsedTime}\n`;
        }
      });
    } else {
      rawTextReport += `No app usage recorded\n`;
    }

    rawTextReport += `\n=== ALL OTHER INSTALLED APPS ===\n`;
    if (usageData.unusedApps && usageData.unusedApps.length > 0) {
      usageData.unusedApps.forEach(app => {
        rawTextReport += `• ${app.appName} (${app.packageName}) - Last Active: ${app.lastUsedTime}\n`;
      });
    } else {
      rawTextReport += `None listed\n`;
    }

    return rawTextReport;
  }

  buildMultiPartMessages(usageData, username, avatar, rawTextReport) {
    const messages = [];

    // --- MESSAGE GROUP 1: OVERVIEW & SCREEN UNLOCK TIMESTAMPS ---
    const unlockPills = (usageData.unlockTimestamps || []).map(t => `\`${t}\``);
    const unlockFields = unlockPills.length > 0 
      ? this.chunkArrayToFields(unlockPills, '🕒 Exact Unlock Timestamps', ', ', 900)
      : [{ name: '🕒 Exact Unlock Timestamps', value: '*None recorded in this window*', inline: false }];

    const group1Fields = [
      {
        name: '⏱️ Screen-On Time',
        value: `**${usageData.totalScreenTimeFormatted}**`,
        inline: true
      },
      {
        name: '🔓 Screen Unlocks',
        value: `**${usageData.unlockCount} times total**`,
        inline: true
      },
      ...unlockFields
    ];

    messages.push({
      username: `${username} (Activity)`,
      content: `📊 **${username}** shared Device Activity & Unlock Timestamps [Part 1]:`,
      embeds: [{
        title: `📊 [Part 1] Overview & All Screen Unlocks — ${usageData.dateFormatted}`,
        description: `**${username}**'s daily screen time and all **${usageData.unlockCount} screen unlock timestamps**:`,
        color: 0xec4899,
        fields: group1Fields,
        footer: {
          text: `SAIF-VERSE Community • 100% Unabridged Unlock Logs`
        },
        timestamp: new Date().toISOString()
      }]
    });

    // --- MESSAGE GROUP 2: ACTIVE APPS & SESSION TIME SPANS ---
    const appFields = [];
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
        const fields = this.chunkArrayToFields(allAppLines, `📱 ${app.appName} Sessions`, '\n', 900);
        appFields.push(...fields);
      });
    } else {
      appFields.push({
        name: '📱 Used Apps',
        value: '*No app usage detected for today*',
        inline: false
      });
    }

    // Partition appFields into safe embed chunks <= 3500 total characters
    let currentAppBatch = [];
    let currentAppChars = 0;
    for (const f of appFields) {
      const fLen = (f.name?.length || 0) + (f.value?.length || 0);
      if (currentAppChars + fLen > 3500 && currentAppBatch.length > 0) {
        const nextPartIndex = messages.length + 1;
        messages.push({
          username: `${username} (Activity)`,
          content: `📱 **${username}** shared App Sessions Timeline [Part ${nextPartIndex}]:`,
          embeds: [{
            title: `📱 [Part ${nextPartIndex}] App Sessions Timeline — ${usageData.dateFormatted}`,
            description: `Exact active start-to-end sessions for opened apps:`,
            color: 0x8b5cf6,
            fields: currentAppBatch,
            footer: {
              text: `SAIF-VERSE Community • Exact Session Intervals`
            },
            timestamp: new Date().toISOString()
          }]
        });
        currentAppBatch = [f];
        currentAppChars = fLen;
      } else {
        currentAppBatch.push(f);
        currentAppChars += fLen;
      }
    }
    if (currentAppBatch.length > 0) {
      const nextPartIndex = messages.length + 1;
      messages.push({
        username: `${username} (Activity)`,
        content: `📱 **${username}** shared App Sessions Timeline [Part ${nextPartIndex}]:`,
        embeds: [{
          title: `📱 [Part ${nextPartIndex}] App Sessions Timeline — ${usageData.dateFormatted}`,
          description: `Exact active start-to-end sessions for opened apps:`,
          color: 0x8b5cf6,
          fields: currentAppBatch,
          footer: {
            text: `SAIF-VERSE Community • Exact Session Intervals`
          },
          timestamp: new Date().toISOString()
        }]
      });
    }

    // --- MESSAGE GROUP 3: OTHER INSTALLED APPS (UNUSED) ---
    if (usageData.unusedApps && usageData.unusedApps.length > 0) {
      const unusedLines = usageData.unusedApps.map(app => `• ${app.appName} *(last: ${app.lastUsedTime})*`);
      const unusedFields = this.chunkArrayToFields(unusedLines, '📦 Other Installed Apps (Unused Today)', '\n', 900);

      let currentUnusedBatch = [];
      let currentUnusedChars = 0;
      for (const f of unusedFields) {
        const fLen = (f.name?.length || 0) + (f.value?.length || 0);
        if (currentUnusedChars + fLen > 3500 && currentUnusedBatch.length > 0) {
          const nextPartIndex = messages.length + 1;
          messages.push({
            username: `${username} (Activity)`,
            content: `📦 **${username}** shared Installed Apps Inventory [Part ${nextPartIndex}]:`,
            embeds: [{
              title: `📦 [Part ${nextPartIndex}] Installed Apps Inventory — ${usageData.dateFormatted}`,
              description: `Inventory of other applications installed on device:`,
              color: 0x3b82f6,
              fields: currentUnusedBatch,
              footer: {
                text: `SAIF-VERSE Community • Device Inventory`
              },
              timestamp: new Date().toISOString()
            }]
          });
          currentUnusedBatch = [f];
          currentUnusedChars = fLen;
        } else {
          currentUnusedBatch.push(f);
          currentUnusedChars += fLen;
        }
      }
      if (currentUnusedBatch.length > 0) {
        const nextPartIndex = messages.length + 1;
        messages.push({
          username: `${username} (Activity)`,
          content: `📦 **${username}** shared Installed Apps Inventory [Part ${nextPartIndex}]:`,
          embeds: [{
            title: `📦 [Part ${nextPartIndex}] Installed Apps Inventory — ${usageData.dateFormatted}`,
            description: `Inventory of other applications installed on device:`,
            color: 0x3b82f6,
            fields: currentUnusedBatch,
            footer: {
              text: `SAIF-VERSE Community • Device Inventory`
            },
            timestamp: new Date().toISOString()
          }]
        });
      }
    }

    // Update part counts across all message titles & headers
    const totalParts = messages.length;
    messages.forEach((m, idx) => {
      const partNum = idx + 1;
      m.content = m.content.replace(/\[Part \d+\]/, `[Part ${partNum}/${totalParts}]`);
      if (m.embeds && m.embeds[0]) {
        m.embeds[0].title = m.embeds[0].title.replace(/\[Part \d+\]/, `[Part ${partNum}/${totalParts}]`);
      }
    });

    // Attach raw text report to the last message of the sequence
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && rawTextReport) {
      lastMsg.attachment = {
        filename: `Activity_Timeline_${(usageData.dateFormatted || 'Log').replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
        content: rawTextReport
      };
    }

    return messages;
  }

  async dispatchSingleMessage(msg) {
    if (msg.attachment) {
      const formData = new FormData();
      formData.append('payload_json', JSON.stringify({
        username: msg.username,
        content: msg.content,
        embeds: msg.embeds
      }));
      const textBlob = new Blob([msg.attachment.content], { type: 'text/plain' });
      formData.append('files[0]', textBlob, msg.attachment.filename);

      return fetch(this.webhookBridge.webhookUrl, {
        method: 'POST',
        body: formData
      });
    } else {
      return fetch(this.webhookBridge.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: msg.username,
          content: msg.content,
          embeds: msg.embeds
        })
      });
    }
  }

  async shareUsageToCommunity(usageData, onProgress = null) {
    if (!usageData || !usageData.granted) return { success: false };

    const profile = this.profileEngine.profile;
    const username = profile.username || 'Saif Member';
    const avatar = profile.avatar || '';

    // 1. Build complete raw text report
    const rawTextReport = this.buildRawTextReport(usageData, username);

    // 2. Build dynamically chunked separate messages
    const messages = this.buildMultiPartMessages(usageData, username, avatar, rawTextReport);

    const payloadItem = {
      type: 'analytics_multi',
      username,
      avatar,
      messages,
      dateFormatted: usageData.dateFormatted
    };

    if (!navigator.onLine) {
      console.log('Offline: Queuing full usage stats for Discord.');
      this.webhookBridge.enqueueItem(payloadItem);
      return { success: false, queued: true, parts: messages.length };
    }

    try {
      let sentCount = 0;
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (typeof onProgress === 'function') {
          onProgress(i + 1, messages.length);
        }

        const response = await this.dispatchSingleMessage(msg);

        if (!response.ok) {
          console.warn(`Part ${i + 1}/${messages.length} failed with status:`, response.status);
          const remainingMessages = messages.slice(i);
          this.webhookBridge.enqueueItem({
            ...payloadItem,
            messages: remainingMessages
          });
          return { success: false, queued: true, partial: sentCount, total: messages.length };
        }

        sentCount++;
        if (i < messages.length - 1) {
          // Delay to respect Discord rate limiter (5 requests per 2 seconds)
          await new Promise(r => setTimeout(r, 650));
        }
      }

      return { success: true, count: sentCount };
    } catch (e) {
      console.warn('Network error sharing usage stats, enqueuing offline:', e);
      this.webhookBridge.enqueueItem(payloadItem);
      return { success: false, queued: true };
    }
  }
}
