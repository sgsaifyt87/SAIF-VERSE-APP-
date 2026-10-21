// path: src/js/analyticsEngine.js
// context: javascript / analyticsEngine.js / bridge / target: mobile-android

export class AnalyticsEngine {
  constructor(webhookBridge, profileEngine) {
    this.webhookBridge = webhookBridge;
    this.profileEngine = profileEngine;
    this.isNative = typeof window !== 'undefined' && 
                    window.Capacitor && 
                    window.Capacitor.isPluginAvailable && 
                    window.Capacitor.isPluginAvailable('UsageAnalytics');
    this.plugin = this.isNative ? window.Capacitor.Plugins.UsageAnalytics : null;
    this.currentDayOffset = 0; // 0 = today, 1 = yesterday, 2 = 2 days ago
    this.lastDispatchedDate = localStorage.getItem('saif_verse_last_analytics_dispatch') || '';
  }

  async checkPermission() {
    if (this.plugin) {
      try {
        const res = await this.plugin.checkPermission();
        return res && res.granted === true;
      } catch (e) {
        console.warn('Error checking usage permission:', e);
      }
    }
    return false;
  }

  async requestPermission() {
    if (this.plugin) {
      try {
        await this.plugin.requestPermission();
        return true;
      } catch (e) {
        console.warn('Error requesting usage permission:', e);
      }
    } else {
      alert('Usage Access settings can only be opened directly on a physical Android device or emulator.');
    }
    return false;
  }

  async fetchUsageData(dayOffset = 0) {
    this.currentDayOffset = dayOffset;

    if (this.plugin) {
      try {
        const hasPerm = await this.checkPermission();
        if (hasPerm) {
          const data = await this.plugin.getUsageData({ dayOffset });
          if (data && data.granted) {
            return data;
          }
        }
      } catch (e) {
        console.warn('Native usage stats error:', e);
      }
    }

    // High-fidelity fallback / simulated data for preview
    return this.getSimulatedUsageData(dayOffset);
  }

  getSimulatedUsageData(dayOffset) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - dayOffset);
    const dateFormatted = targetDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const isToday = dayOffset === 0;
    const unlockCount = isToday ? 18 : 34;
    const screenHours = isToday ? '2h 45m' : '4h 12m';

    const unlockTimestamps = isToday ? [
      '08:15:20 AM', '09:02:11 AM', '09:44:05 AM', '10:30:18 AM',
      '11:15:44 AM', '12:05:30 PM', '01:22:15 PM', '02:40:02 PM',
      '03:55:19 PM', '05:12:40 PM', '06:30:22 PM', '07:45:10 PM'
    ] : [
      '07:30:12 AM', '08:12:45 AM', '09:05:30 AM', '10:20:11 AM',
      '11:45:22 AM', '01:10:05 PM', '02:30:44 PM', '04:15:19 PM',
      '06:05:55 PM', '08:20:33 PM', '10:15:40 PM', '11:45:02 PM'
    ];

    const usedApps = [
      {
        appName: 'SAIF-VERSE',
        packageName: 'com.saifyt87.saifverse',
        usageTimeSeconds: 2700,
        usageTimeFormatted: '45m 00s',
        openCount: 6,
        lastUsedTime: dateFormatted + ' 11:20:00 PM',
        openTimestamps: ['09:02:11 AM', '12:05:30 PM', '03:55:19 PM', '11:20:00 PM']
      },
      {
        appName: 'YouTube',
        packageName: 'com.google.android.youtube',
        usageTimeSeconds: 4200,
        usageTimeFormatted: '1h 10m',
        openCount: 4,
        lastUsedTime: dateFormatted + ' 07:45:10 PM',
        openTimestamps: ['01:22:15 PM', '05:12:40 PM', '07:45:10 PM']
      },
      {
        appName: 'Discord',
        packageName: 'com.discord',
        usageTimeSeconds: 1800,
        usageTimeFormatted: '30m 00s',
        openCount: 8,
        lastUsedTime: dateFormatted + ' 06:30:22 PM',
        openTimestamps: ['10:30:18 AM', '02:40:02 PM', '06:30:22 PM']
      },
      {
        appName: 'Chrome Browser',
        packageName: 'com.android.chrome',
        usageTimeSeconds: 1200,
        usageTimeFormatted: '20m 00s',
        openCount: 3,
        lastUsedTime: dateFormatted + ' 04:15:00 PM',
        openTimestamps: ['09:44:05 AM', '04:15:00 PM']
      }
    ];

    const unusedApps = [
      {
        appName: 'Calculator',
        packageName: 'com.android.calculator2',
        lastUsedTime: 'Oct 19, 2026 02:14:00 PM'
      },
      {
        appName: 'Clock',
        packageName: 'com.android.deskclock',
        lastUsedTime: 'Oct 21, 2026 06:30:00 AM'
      },
      {
        appName: 'Files',
        packageName: 'com.google.android.documentsui',
        lastUsedTime: 'Oct 18, 2026 11:05:00 AM'
      }
    ];

    return {
      granted: false,
      isSimulated: true,
      dayOffset,
      dateFormatted,
      unlockCount,
      unlockTimestamps,
      totalScreenTimeSeconds: isToday ? 9900 : 15120,
      totalScreenTimeFormatted: screenHours,
      usedApps,
      unusedApps
    };
  }

  async shareUsageToCommunity(usageData) {
    const profile = this.profileEngine.profile;
    const username = profile.username || 'Saif Explorer';
    const avatar = profile.avatar || '';

    let topAppsSummary = usageData.usedApps.slice(0, 5).map(app => 
      `• **${app.appName}**: \`${app.usageTimeFormatted}\` (${app.openCount} opens, last at \`${app.lastUsedTime.split(' ').slice(-2).join(' ')}\`)`
    ).join('\n');

    if (!topAppsSummary) {
      topAppsSummary = 'No applications recorded in this window.';
    }

    const unlockTimelinePreview = usageData.unlockTimestamps.slice(0, 8).join(', ') + 
      (usageData.unlockTimestamps.length > 8 ? ` +${usageData.unlockTimestamps.length - 8} more` : '');

    const unusedAppsSummary = usageData.unusedApps.slice(0, 4).map(app => 
      `• ${app.appName} *(last active: ${app.lastUsedTime})*`
    ).join('\n') || 'None';

    const embed = {
      title: `📊 ActionDash Wellbeing: ${usageData.dateFormatted}`,
      description: `**${username}**'s daily device balance & screen habits summary for **${usageData.dateFormatted}**.`,
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
          name: '🕒 Unlock Timestamps (Local Time)',
          value: `\`${unlockTimelinePreview || 'None'}\``,
          inline: false
        },
        {
          name: '🏆 Top Applications Used',
          value: topAppsSummary,
          inline: false
        },
        {
          name: '📦 Other Installed Apps on Device',
          value: unusedAppsSummary,
          inline: false
        }
      ],
      footer: {
        text: `ActionDash Engine • Member: ${username} • SAIF-VERSE`
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
      this.webhookBridge.enqueueItem(payloadItem);
      return { success: false, queued: true };
    }

    try {
      const response = await fetch(this.webhookBridge.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `${username} (ActionDash)`,
          content: `📊 **${username}** shared daily device usage & screen time analytics for **${usageData.dateFormatted}**!`,
          embeds: [embed]
        })
      });

      return { success: response.ok, queued: !response.ok };
    } catch (e) {
      this.webhookBridge.enqueueItem(payloadItem);
      return { success: false, queued: true };
    }
  }

  checkEndOfDayAutoDispatch(usageData) {
    const todayStr = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();

    // Auto-dispatch after 21:00 (9 PM) once per day
    if (hour >= 21 && this.lastDispatchedDate !== todayStr) {
      this.shareUsageToCommunity(usageData).then(res => {
        if (res.success || res.queued) {
          this.lastDispatchedDate = todayStr;
          localStorage.setItem('saif_verse_last_analytics_dispatch', todayStr);
          console.log('Automated end-of-day analytics dispatched to community.');
        }
      });
    }
  }
}
