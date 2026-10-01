# BrowserLock for Firefox

A Firefox extension that locks your browser with a password to protect your privacy and data from unauthorized access.

## Features

- 🔐 **Password Protection** — Lock your browser behind a master password
- 🚀 **Startup Lock** — Automatically lock when Firefox opens
- ⏱️ **Auto-Lock on Idle** — Lock after configurable inactivity period (1–60 min)
- 🛡️ **Quarantine Mode** — 30-minute lockout after 5 failed password attempts
- 🔑 **Password Recovery** — Recover via security question
- 📋 **URL Whitelist** — Allow specific sites to bypass the lock
- ⏳ **Temporary Unlock** — Timed unlock (15 min, 30 min, 1 hour, 2 hours)
- ⌨️ **Keyboard Shortcut** — Lock with Alt+L
- 🖱️ **Context Menu** — Right-click "Lock Browser" option
- ⚙️ **Full Settings Page** — Customize all behaviors
- 📤 **Import/Export** — Backup and restore settings
- 🎨 **Dark Theme UI** — Polished, modern dark interface

## Installation (Temporary Add-on)

1. Open Firefox and navigate to `about:debugging`
2. Click **"This Firefox"** in the left sidebar
3. Click **"Load Temporary Add-on…"**
4. Select the `manifest.json` file from this directory
5. The extension will be installed and the setup wizard will open

## Installation (Permanent)

To install permanently, package the extension as an `.xpi` file:

```bash
cd browserlock-firefox
zip -r browserlock.xpi *
```

Then install via `about:addons` > gear icon > "Install Add-on From File…"

> **Note:** For unsigned extensions, you need Firefox Developer Edition or Nightly with `xpinstall.signatures.required` set to `false` in `about:config`.

## Usage

1. **First Launch**: Complete the setup wizard to create your password and security question
2. **Lock**: Click the toolbar icon → "Lock Now", use Alt+L, or right-click → "Lock Browser"
3. **Unlock**: Enter your password on the lock screen
4. **Temporary Unlock**: Use the popup menu to set a timed unlock period
5. **Settings**: Click the toolbar icon → Settings, or go to `about:addons` → BrowserLock → Preferences

## File Structure

```
browserlock-firefox/
├── manifest.json           # Extension manifest (MV2)
├── background.js           # Core lock/unlock logic
├── popup/                  # Toolbar popup
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── lock/                   # Full-page lock screen
│   ├── lock.html
│   ├── lock.css
│   └── lock.js
├── settings/               # Options/settings page
│   ├── settings.html
│   ├── settings.css
│   └── settings.js
├── setup/                  # First-time setup wizard
│   ├── setup.html
│   ├── setup.css
│   └── setup.js
├── utils/
│   └── crypto.js           # SHA-256 hashing utility
├── icons/                  # Extension icons (SVG)
│   ├── icon-16.svg
│   ├── icon-32.svg
│   ├── icon-48.svg
│   └── icon-128.svg
└── README.md
```

## Security

- Passwords are hashed with SHA-256 (Web Crypto API) — never stored in plaintext
- Rate limiting via quarantine mode prevents brute-force attacks
- All settings require password authentication to modify

> **Important**: Browser extensions provide convenience-level security. For maximum protection, also use your OS lock screen.

## License

MIT
