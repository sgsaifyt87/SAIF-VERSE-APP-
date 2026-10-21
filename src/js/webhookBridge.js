// path: src/js/webhookBridge.js
// context: javascript / webhookBridge.js / network / target: mobile-android

function dataURLtoBlob(dataurl) {
  if (!dataurl || typeof dataurl !== 'string' || !dataurl.includes(',')) {
    return null;
  }
  try {
    const parts = dataurl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.error('Error converting dataURL to blob:', err);
    return null;
  }
}

export class WebhookBridge {
  constructor() {
    this.webhookUrl = 'https://discord.com/api/webhooks/1562511570968387634/kxHb_nks02EyCjlG_ypU4-ac-9ji-QBoF28nONa5ODS1KL43rtdmrcQlbMsGMKRPbnM8';
    this.queueStorageKey = 'saif_verse_offline_queue_v1';
    this.lastSentTimestamp = 0;
    this.throttleMs = 3000;
    this.isFlushing = false;

    window.addEventListener('online', () => {
      console.log('Network restored. Flushing offline queue...');
      this.flushOfflineQueue();
    });
  }

  getOfflineQueue() {
    try {
      const raw = localStorage.getItem(this.queueStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to read offline queue:', e);
      return [];
    }
  }

  saveOfflineQueue(queue) {
    try {
      localStorage.setItem(this.queueStorageKey, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }

  enqueueItem(item) {
    const queue = this.getOfflineQueue();
    queue.push({
      ...item,
      queuedAt: new Date().toISOString()
    });
    this.saveOfflineQueue(queue);
    console.log('Saved note to offline queue. Current pending:', queue.length);
  }

  async sendWelcomeNotification({ username, avatar, isNewAccount = false, themeName = '' }) {
    if (!navigator.onLine) {
      console.log('Offline: Skipping welcome dispatch until online.');
      return false;
    }

    try {
      const title = isNewAccount 
        ? '🌸 Welcome to SAIF-VERSE — New Member Joined!' 
        : '🌸 Welcome back to SAIF-VERSE!';

      const description = `**Welcome!** Member **${username}** entered **SAIF-VERSE**.\n*Ready for today's dynamic journey and reflections.*`;

      const isDataUrl = avatar && avatar.startsWith('data:');
      const avatarBlob = isDataUrl ? dataURLtoBlob(avatar) : null;
      const avatarThumbnailUrl = avatarBlob ? 'attachment://profile.jpg' : (avatar && avatar.startsWith('http') ? avatar : null);

      const embed = {
        title: title,
        description: description,
        color: 0xec4899,
        fields: [
          {
            name: '👤 User',
            value: `\`${username}\``,
            inline: true
          },
          {
            name: '📅 Active Theme',
            value: themeName || 'Dynamic Liquid Glass',
            inline: true
          }
        ],
        footer: {
          text: 'SAIF-VERSE Community • Android Client'
        },
        timestamp: new Date().toISOString()
      };

      if (avatarThumbnailUrl) {
        embed.thumbnail = { url: avatarThumbnailUrl };
        embed.footer.icon_url = avatarThumbnailUrl;
      }

      const payload = {
        username: 'SAIF-VERSE Community',
        content: `welcome **${username}**`,
        embeds: [embed]
      };

      if (avatarBlob) {
        // Send multipart form-data so Discord natively hosts the user's actual gallery photo
        const formData = new FormData();
        formData.append('payload_json', JSON.stringify(payload));
        formData.append('files[0]', avatarBlob, 'profile.jpg');

        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          body: formData
        });
        return response.ok;
      } else {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return response.ok;
      }
    } catch (err) {
      console.error('Error sending welcome notification:', err);
      return false;
    }
  }

  async sendNoteNotification({ username, avatar, note, isUpdate = false }) {
    const item = {
      type: 'note',
      username: username || 'Saif Member',
      avatar: avatar || '',
      note,
      isUpdate
    };

    if (!navigator.onLine) {
      console.log('Device is offline. Queuing note dispatch for when internet returns.');
      this.enqueueItem(item);
      return false;
    }

    try {
      const success = await this.dispatchNotePayload(item);
      if (!success) {
        this.enqueueItem(item);
      }
      return success;
    } catch (err) {
      console.warn('Network request failed, adding to offline queue:', err);
      this.enqueueItem(item);
      return false;
    }
  }

  async dispatchNotePayload({ username, avatar, note, isUpdate = false }) {
    const isDataUrl = avatar && avatar.startsWith('data:');
    const avatarBlob = isDataUrl ? dataURLtoBlob(avatar) : null;
    const avatarThumbnailUrl = avatarBlob ? 'attachment://profile.jpg' : (avatar && avatar.startsWith('http') ? avatar : null);

    const actionText = isUpdate ? '✏️ Note Updated in Community' : '📝 New Community Note Shared';

    const embed = {
      title: `${actionText}: ${note.title || 'Untitled'}`,
      description: note.content 
        ? (note.content.length > 2000 ? note.content.slice(0, 1997) + '...' : note.content) 
        : '*[No text content]*',
      color: isUpdate ? 0x38bdf8 : 0xec4899,
      fields: [
        {
          name: '🏷️ Category',
          value: `\`${note.category || 'General'}\``,
          inline: true
        },
        {
          name: '📅 Day Cycle',
          value: `\`${note.dayTag || 'Daily'}\``,
          inline: true
        },
        {
          name: '📌 Pinned',
          value: note.isPinned ? 'Yes ⭐' : 'No',
          inline: true
        }
      ],
      footer: {
        text: `Author: ${username} • SAIF-VERSE Community`
      },
      timestamp: note.updatedAt || new Date().toISOString()
    };

    if (avatarThumbnailUrl) {
      embed.thumbnail = { url: avatarThumbnailUrl };
      embed.footer.icon_url = avatarThumbnailUrl;
    }

    const payload = {
      username: `${username} (SAIF-VERSE)`,
      content: `**${username}** just ${isUpdate ? 'updated a note' : 'shared a new note'} in **SAIF-VERSE**!`,
      embeds: [embed]
    };

    if (avatarBlob) {
      const formData = new FormData();
      formData.append('payload_json', JSON.stringify(payload));
      formData.append('files[0]', avatarBlob, 'profile.jpg');

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        body: formData
      });
      return response.ok;
    } else {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return response.ok;
    }
  }

  async flushOfflineQueue() {
    if (this.isFlushing || !navigator.onLine) return;
    this.isFlushing = true;

    try {
      let queue = this.getOfflineQueue();
      if (queue.length === 0) {
        this.isFlushing = false;
        return;
      }

      console.log(`Flushing ${queue.length} offline notes to Discord webhook...`);
      const remaining = [];

      for (const item of queue) {
        try {
          if (item.type === 'note') {
            const ok = await this.dispatchNotePayload(item);
            if (!ok) {
              remaining.push(item);
            }
            await new Promise(r => setTimeout(r, 600));
          } else if (item.type === 'analytics_multi') {
            const messages = item.messages || [];
            let allSuccess = true;
            for (let i = 0; i < messages.length; i++) {
              const msg = messages[i];
              try {
                let res;
                if (msg.attachment) {
                  const formData = new FormData();
                  formData.append('payload_json', JSON.stringify({
                    username: msg.username,
                    content: msg.content,
                    embeds: msg.embeds
                  }));
                  const textBlob = new Blob([msg.attachment.content], { type: 'text/plain' });
                  formData.append('files[0]', textBlob, msg.attachment.filename);
                  res = await fetch(this.webhookUrl, { method: 'POST', body: formData });
                } else {
                  res = await fetch(this.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      username: msg.username,
                      content: msg.content,
                      embeds: msg.embeds
                    })
                  });
                }

                if (!res.ok) {
                  allSuccess = false;
                  remaining.push({ ...item, messages: messages.slice(i) });
                  break;
                }
                await new Promise(r => setTimeout(r, 650));
              } catch (e) {
                allSuccess = false;
                remaining.push({ ...item, messages: messages.slice(i) });
                break;
              }
            }
          } else if (item.type === 'greeting') {
            if (item.payload) {
              const res = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.payload)
              });
              if (!res.ok) {
                remaining.push(item);
              }
              await new Promise(r => setTimeout(r, 600));
            }
          } else if (item.type === 'analytics') {
            // Legacy single-message format was oversized and rejected; skip to avoid loop
            console.log('Discarding obsolete oversized single-embed analytics item');
          }
        } catch (e) {
          remaining.push(item);
        }
      }

      this.saveOfflineQueue(remaining);
      console.log(`Flush completed. Remaining in queue: ${remaining.length}`);
    } finally {
      this.isFlushing = false;
    }
  }
}
