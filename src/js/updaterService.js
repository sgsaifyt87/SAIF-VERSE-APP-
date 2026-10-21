// path: src/js/updaterService.js
// context: javascript / updaterService.js / network / target: mobile-android

export class UpdaterService {
  constructor(currentVersion = 'v1.0.0') {
    this.currentVersion = currentVersion;
    this.repoOwner = 'sgsaifyt87';
    this.repoName = 'SAIF-VERSE-APP-';
    this.repoUrl = `https://github.com/${this.repoOwner}/${this.repoName}`;
    this.rawVersionUrl = `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/main/version.json?t=${Date.now()}`;
    this.apiUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
    this.latestRelease = null;
    this.isChecking = false;
    this.notificationService = null;
    this.lastNotifiedVersion = null;
  }

  setNotificationService(service) {
    this.notificationService = service;
  }

  startBackgroundUpdateMonitor(intervalMinutes = 15) {
    // Initial check after 10 seconds
    setTimeout(() => this.runBackgroundUpdateCheck(), 10000);

    // Periodic check
    setInterval(() => {
      this.runBackgroundUpdateCheck();
    }, intervalMinutes * 60 * 1000);
  }

  async runBackgroundUpdateCheck() {
    try {
      const res = await this.checkForUpdates();
      if (res.hasUpdate && res.latestVersion) {
        if (this.lastNotifiedVersion !== res.latestVersion) {
          this.lastNotifiedVersion = res.latestVersion;
          if (this.notificationService) {
            await this.notificationService.notifyUpdateAvailable(res.latestVersion);
          }
        }
      }
    } catch (e) {
      console.warn('Background update check failed:', e);
    }
  }

  cleanVersion(v) {
    return (v || '').trim().replace(/^v/i, '');
  }

  isNewer(remote, local) {
    const rParts = this.cleanVersion(remote).split('.').map(Number);
    const lParts = this.cleanVersion(local).split('.').map(Number);
    for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
      const r = rParts[i] || 0;
      const l = lParts[i] || 0;
      if (r > l) return true;
      if (r < l) return false;
    }
    return false;
  }

  async checkForUpdates() {
    this.isChecking = true;
    try {
      // 1. Primary check: raw version.json directly from GitHub main branch
      try {
        const rawRes = await fetch(this.rawVersionUrl, { cache: 'no-store' });
        if (rawRes.ok) {
          const versionData = await rawRes.json();
          const remoteVer = versionData.version || '1.0.0';
          const hasUpdate = this.isNewer(remoteVer, this.currentVersion);

          return {
            hasUpdate,
            currentVersion: this.currentVersion,
            latestVersion: `v${this.cleanVersion(remoteVer)}`,
            releaseName: versionData.title || `SAIF-VERSE Update v${remoteVer}`,
            releaseUrl: `${this.repoUrl}`,
            downloadUrl: versionData.downloadUrl || `${this.repoUrl}/raw/main/SAIF-VERSE-v${remoteVer}.apk`,
            changelog: versionData.changelog || 'Performance improvements, new daily reflections, and visual refinements.'
          };
        }
      } catch (rawErr) {
        console.warn('version.json fetch check error:', rawErr);
      }

      // 2. Secondary fallback check: GitHub Releases API
      const res = await fetch(this.apiUrl, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        const latestTag = data.tag_name || data.name || this.currentVersion;
        const hasUpdate = this.isNewer(latestTag, this.currentVersion);

        let apkAsset = null;
        if (data.assets && data.assets.length > 0) {
          apkAsset = data.assets.find(a => a.name.endsWith('.apk') || a.name.includes('saif-verse'));
        }

        const downloadUrl = apkAsset ? apkAsset.browser_download_url : data.html_url;

        return {
          hasUpdate,
          currentVersion: this.currentVersion,
          latestVersion: latestTag,
          releaseName: data.name || latestTag,
          releaseUrl: data.html_url,
          downloadUrl,
          publishedAt: data.published_at,
          changelog: data.body || 'No release notes provided.'
        };
      }

      // Default: current build is up to date
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion,
        releaseUrl: `${this.repoUrl}`,
        downloadUrl: null,
        changelog: null
      };
    } catch (err) {
      console.warn('Updater exception:', err);
      return {
        hasUpdate: false,
        error: true,
        currentVersion: this.currentVersion,
        message: 'Could not connect to update server.',
        releaseUrl: this.repoUrl,
        downloadUrl: null
      };
    } finally {
      this.isChecking = false;
    }
  }

  downloadUpdate(downloadUrl) {
    if (!downloadUrl) return;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
