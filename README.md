# SAIF-VERSE 🌸

An ultra-modern, aesthetic Android mobile application featuring **Liquid Glassmorphism**, dynamic **7-day atmospheric cycle**, physics-driven **Live Cherry Blossom (Sakura)** particle engine, personal reflective journaling/notes, user profile personalization, automated GitHub release updates, and Discord welcome notifications.

---

## 📱 Features

### 1. 🌌 Liquid Glassmorphism Design
- Full-screen frosted glass panels with specular highlight reflections.
- Dynamic glowing ambient light orbs responding to the current day.
- Ultra-fluid 60fps micro-animations and responsive mobile touch gestures.

### 2. 📅 Dynamic 7-Day Thematic Cycle
Every single day of the week carries its own distinct atmosphere, prompt, and live particle system:
- **Sunday**: Serene Amber Sun • *"Sunday reflection: How are you feeling today? Everything was good? How about your relationship and personal connections?"*
- **Monday**: Electric Cyan Drive • *"A brand new week unfolds! What is the single most important goal or ambition you are determined to conquer?"*
- **Tuesday**: Sakura Flow • *"Momentum is taking shape! What positive progress did you spark yesterday that you want to carry forward today?"*
- **Wednesday**: Balanced Violet Nebula • *"Midweek horizon check! How is your energy holding up? What has brought you unexpected peace or clarity this week?"*
- **Thursday**: Creative Spark • *"Almost at the summit! What creative idea, project, or personal aspiration has been whispering to you lately?"*
- **Friday**: Golden Sunset Triumph • *"Golden Friday sunset! Celebrate a victory from this week, big or small. What made you smile or feel proud?"*
- **Saturday**: Midnight Starlight Sanctuary • *"Unplug and let your soul breathe! What adventure, restful habit, or guilty pleasure are you embracing today?"*

*Includes a day selector pill slider allowing instant previewing of any day's mood, plus an `Auto` button to sync with real-world time.*

### 3. 🌸 Live Cherry Blossom (Sakura) Particle Engine
- Hardware-accelerated 2D Canvas engine running independent flutter dynamics.
- Petal flutter with 3D rotation projection, wind turbulence, and mass simulation.
- Interactive touch wind gusts (dragging/swiping generates natural breeze).
- Multi-mode support: Sakura petals, amber sun motes, cyan velocity pulses, purple nebula dust, and golden sparks.

### 4. 📓 Liquid Glass Notes Engine
- Create, edit, pin, tag, and search thoughts & daily reflections.
- One-tap prompt answering (pre-fills today's prompt into a new note).
- Persistent local offline storage.

### 5. 👤 Profile & Identity System
- Set your Display Name, Bio, and Profile Picture.
- Preset anime/aesthetic avatars + custom image URL support.
- Profile showcase card with glowing glass halo and cherry blossom shower.

### 6. 🌐 Discord Welcome Webhook Bridge
- Integrated with Discord webhook:
  `https://discord.com/api/webhooks/1562511570968387634/...`
- Automatically dispatches a rich embed to Discord with:
  - User's Display Name
  - User's Profile Picture (as thumbnail & author avatar)
  - Welcome greeting message
  - Active day theme & timestamp
- Fires on account creation and every time the user enters the app (with anti-burst throttle).

### 7. 🚀 GitHub Release Auto-Updater
- Automatically checks `https://github.com/sgsaifyt87/SAIF-VERSE-APP-` for new releases.
- Compares version tags (`v1.0.0` vs latest).
- Shows release changelog and provides direct one-tap APK download button.

---

## 🛠️ Project Structure
```
SAIF-VERSE/
├── android/                    # Native Android Studio / Gradle Project
│   ├── app/
│   │   ├── src/main/AndroidManifest.xml
│   │   └── src/main/assets/public/   # Synced web assets
│   └── gradlew.bat
├── src/
│   ├── js/
│   │   ├── app.js             # Main orchestrator & UI logic
│   │   ├── particles.js       # Live Cherry Blossom canvas physics
│   │   ├── themeEngine.js     # 7-day state machine & prompts
│   │   ├── notesEngine.js     # Local notes CRUD & search
│   │   ├── profileEngine.js   # User profile management
│   │   ├── webhookBridge.js   # Discord welcome webhook integration
│   │   └── updaterService.js  # GitHub release version checker
│   └── styles/
│       └── main.css           # Liquid glassmorphism & Tailwind CSS
├── dist/                      # Production compiled assets
├── capacitor.config.json      # Mobile shell configuration
├── vite.config.js             # Fast build bundler
└── package.json
```

---

## ⚡ Development & Build Commands

### Test in Web Browser
```bash
npm run dev
```

### Build Web Bundle
```bash
npm run build
```

### Sync to Android
```bash
npm run cap:sync
```

### Build Android APK
```bash
cd android
./gradlew assembleDebug
```
The compiled APK will be generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`
