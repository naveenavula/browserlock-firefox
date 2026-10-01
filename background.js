/**
 * BrowserLock for Firefox / LibreWolf - Background Script
 * Full browser lockdown with dedicated lock window & in-tab guards
 */

// ============================================================
// STATE
// ============================================================
let state = {
  isLocked: false,
  isSetupComplete: false,
  passwordHash: null,
  securityQuestion: '',
  securityAnswerHash: null,
  failedAttempts: 0,
  quarantineUntil: 0,
  tempUnlockUntil: 0,
  tempUnlockTimer: null,
  settings: {
    lockOnStartup: true,
    autoLockOnIdle: true,
    idleTimeout: 5, // minutes
    quarantineEnabled: true,
    quarantineDuration: 30, // minutes
    maxFailedAttempts: 5,
    showNotification: true,
    enableShortcut: true,
    enableContextMenu: true,
    whitelist: []
  }
};

let lockWindowId = null;

const LOCK_PAGE_URL = browser.runtime.getURL('lock/lock.html');
const SETUP_PAGE_URL = browser.runtime.getURL('setup/setup.html');
const SETTINGS_PAGE_URL = browser.runtime.getURL('settings/settings.html');

// ============================================================
// INITIALIZATION
// ============================================================
async function initialize() {
  try {
    const stored = await browser.storage.local.get(null);

    if (stored.passwordHash) {
      state.isSetupComplete = true;
      state.passwordHash = stored.passwordHash;
      state.securityQuestion = stored.securityQuestion || '';
      state.securityAnswerHash = stored.securityAnswerHash || null;
      state.failedAttempts = stored.failedAttempts || 0;
      state.quarantineUntil = stored.quarantineUntil || 0;

      if (stored.settings) {
        state.settings = { ...state.settings, ...stored.settings };
      }

      if (state.settings.lockOnStartup) {
        await lockBrowser('Browser startup');
      }

      setupIdleDetection();
    } else {
      // First time: open setup page or lock screen
      try {
        await browser.tabs.create({ url: SETUP_PAGE_URL });
      } catch (e) {
        await openLockWindow();
      }
    }

    setupContextMenu();
  } catch (err) {
    console.error('BrowserLock: Initialization error', err);
  }
}

// ============================================================
// LOCK / UNLOCK ENGINE
// ============================================================

/**
 * Open or refocus the dedicated full-screen lock window
 */
async function openLockWindow() {
  if (lockWindowId !== null) {
    try {
      const win = await browser.windows.get(lockWindowId);
      if (win) {
        await browser.windows.update(lockWindowId, {
          focused: true,
          state: 'maximized'
        });
        return;
      }
    } catch (e) {
      lockWindowId = null;
    }
  }

  try {
    // Try creating a clean popup window
    const newWin = await browser.windows.create({
      url: LOCK_PAGE_URL,
      type: 'popup',
      state: 'maximized',
      focused: true
    });
    lockWindowId = newWin.id;
  } catch (e) {
    try {
      // Fallback: regular window
      const newWin = await browser.windows.create({
        url: LOCK_PAGE_URL,
        state: 'maximized',
        focused: true
      });
      lockWindowId = newWin.id;
    } catch (e2) {
      // Fallback: active tab
      try {
        await browser.tabs.create({ url: LOCK_PAGE_URL, active: true });
      } catch (e3) {}
    }
  }
}

/**
 * Close lock window if open
 */
async function closeLockWindow() {
  if (lockWindowId !== null) {
    const wid = lockWindowId;
    lockWindowId = null;
    try {
      await browser.windows.remove(wid);
    } catch (e) {}
  }
}

/**
 * Main lock function
 */
async function lockBrowser(reason) {
  state.isLocked = true;
  state.tempUnlockUntil = 0;

  if (state.tempUnlockTimer) {
    clearTimeout(state.tempUnlockTimer);
    state.tempUnlockTimer = null;
  }

  await browser.storage.local.set({ isLocked: true });
  updateIcon(true);

  // 1. Open dedicated full-screen lock window
  await openLockWindow();

  // 2. Broadcast lock message to all tab content scripts (in-tab blackout guard)
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, { action: 'lock' }).catch(() => {});
    }
  } catch (e) {}

  // 3. Safe tab redirect (ignoring privileged about: tabs)
  await redirectTabsSafely();

  // 4. Notification
  if (state.settings.showNotification) {
    try {
      browser.notifications.create('browserlock-locked', {
        type: 'basic',
        iconUrl: browser.runtime.getURL('icons/icon-48.svg'),
        title: 'BrowserLock',
        message: reason ? `Browser locked: ${reason}` : 'Browser is now locked'
      });
    } catch (e) {}
  }

  console.log('BrowserLock: Locked -', reason);
}

/**
 * Main unlock function
 */
async function unlockBrowser() {
  state.isLocked = false;
  state.failedAttempts = 0;

  await browser.storage.local.set({
    isLocked: false,
    failedAttempts: 0
  });

  updateIcon(false);

  // 1. Close lock window
  await closeLockWindow();

  // 2. Broadcast unlock message to all tab content scripts
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, { action: 'unlock' }).catch(() => {});
    }
  } catch (e) {}

  console.log('BrowserLock: Unlocked');
}

async function temporaryUnlock(minutes) {
  await unlockBrowser();

  state.tempUnlockUntil = Date.now() + (minutes * 60 * 1000);
  await browser.storage.local.set({ tempUnlockUntil: state.tempUnlockUntil });

  state.tempUnlockTimer = setTimeout(async () => {
    state.tempUnlockTimer = null;
    await lockBrowser('Temporary unlock expired');
  }, minutes * 60 * 1000);

  console.log(`BrowserLock: Temporary unlock for ${minutes} minutes`);
}

// ============================================================
// TAB & WINDOW MONITORING
// ============================================================

async function redirectTabsSafely() {
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      try {
        if (!tab.url) continue;
        if (tab.url.startsWith('about:')) continue; // Skip privileged pages to avoid errors
        if (isLockPage(tab.url) || isSetupPage(tab.url)) continue;
        if (isWhitelisted(tab.url)) continue;

        if (isSettingsPage(tab.url)) {
          await browser.tabs.update(tab.id, { url: LOCK_PAGE_URL });
        }
      } catch (e) {
        // Ignore single tab errors
      }
    }
  } catch (err) {}
}

function isExtensionPage(url) {
  if (!url) return false;
  return url.startsWith(browser.runtime.getURL(''));
}

function isLockPage(url) {
  if (!url) return false;
  return url.startsWith(LOCK_PAGE_URL);
}

function isSettingsPage(url) {
  if (!url) return false;
  return url.startsWith(SETTINGS_PAGE_URL);
}

function isSetupPage(url) {
  if (!url) return false;
  return url.startsWith(SETUP_PAGE_URL);
}

function isWhitelisted(url) {
  if (!url || !state.settings.whitelist || state.settings.whitelist.length === 0) {
    return false;
  }

  for (const pattern of state.settings.whitelist) {
    try {
      const regexStr = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      const regex = new RegExp('^' + regexStr + '$', 'i');
      if (regex.test(url)) return true;
    } catch (e) {
      if (url.includes(pattern)) return true;
    }
  }
  return false;
}

// Keep lock window focused when locked
browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (state.isLocked && lockWindowId !== null) {
    if (windowId !== lockWindowId && windowId !== browser.windows.WINDOW_ID_NONE) {
      try {
        await browser.windows.update(lockWindowId, { focused: true });
      } catch (e) {}
    }
  }
});

// Reopen lock window if closed while locked
browser.windows.onRemoved.addListener((windowId) => {
  if (windowId === lockWindowId) {
    lockWindowId = null;
    if (state.isLocked) {
      setTimeout(openLockWindow, 200);
    }
  }
});

// Refocus lock window when tabs change
browser.tabs.onActivated.addListener(async () => {
  if (state.isLocked && lockWindowId !== null) {
    try {
      await browser.windows.update(lockWindowId, { focused: true });
    } catch (e) {}
  }
});

// Enforce lock on new tabs
browser.tabs.onCreated.addListener(async (tab) => {
  if (state.isLocked) {
    if (lockWindowId !== null) {
      try {
        await browser.windows.update(lockWindowId, { focused: true });
      } catch (e) {}
    }
  }
});

// ============================================================
// IDLE DETECTION
// ============================================================
function setupIdleDetection() {
  if (state.settings.autoLockOnIdle) {
    browser.idle.setDetectionInterval(state.settings.idleTimeout * 60);
    browser.idle.onStateChanged.addListener(handleIdleStateChange);
  }
}

function handleIdleStateChange(newState) {
  if (newState === 'idle' || newState === 'locked') {
    if (state.settings.autoLockOnIdle && !state.isLocked) {
      lockBrowser('Idle timeout');
    }
  }
}

// ============================================================
// QUARANTINE MODE
// ============================================================
async function handleFailedAttempt() {
  state.failedAttempts++;
  await browser.storage.local.set({ failedAttempts: state.failedAttempts });

  if (state.settings.quarantineEnabled &&
      state.failedAttempts >= state.settings.maxFailedAttempts) {
    const quarantineDuration = state.settings.quarantineDuration * 60 * 1000;
    state.quarantineUntil = Date.now() + quarantineDuration;
    await browser.storage.local.set({ quarantineUntil: state.quarantineUntil });

    return {
      quarantined: true,
      quarantineUntil: state.quarantineUntil,
      message: `Too many failed attempts. Locked for ${state.settings.quarantineDuration} minutes.`
    };
  }

  return {
    quarantined: false,
    attemptsLeft: state.settings.maxFailedAttempts - state.failedAttempts,
    message: `Wrong password. ${state.settings.maxFailedAttempts - state.failedAttempts} attempts remaining.`
  };
}

// ============================================================
// ICON MANAGEMENT
// ============================================================
function updateIcon(locked) {
  if (locked) {
    browser.browserAction.setBadgeText({ text: '🔒' });
    browser.browserAction.setBadgeBackgroundColor({ color: '#e94560' });
  } else {
    browser.browserAction.setBadgeText({ text: '' });
  }
}

// ============================================================
// CONTEXT MENU & SHORTCUTS
// ============================================================
function setupContextMenu() {
  browser.contextMenus.removeAll().then(() => {
    if (state.settings.enableContextMenu) {
      browser.contextMenus.create({
        id: 'browserlock-lock',
        title: 'Lock Browser',
        contexts: ['all']
      });
    }
  });
}

browser.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'browserlock-lock') {
    lockBrowser('Manual lock (context menu)');
  }
});

browser.commands.onCommand.addListener((command) => {
  if (command === 'lock-browser' && state.settings.enableShortcut) {
    lockBrowser('Manual lock (keyboard shortcut)');
  }
});

// ============================================================
// MESSAGE HANDLING
// ============================================================
browser.runtime.onMessage.addListener((message, sender) => {
  return handleMessage(message, sender);
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'getState':
      return {
        isLocked: state.isLocked,
        isSetupComplete: state.isSetupComplete,
        tempUnlockUntil: state.tempUnlockUntil,
        quarantineUntil: state.quarantineUntil,
        failedAttempts: state.failedAttempts,
        maxFailedAttempts: state.settings.maxFailedAttempts,
        securityQuestion: state.securityQuestion
      };

    case 'focusLockWindow':
      await openLockWindow();
      return { success: true };

    case 'lock':
      await lockBrowser('Manual lock');
      return { success: true };

    case 'unlock': {
      if (state.quarantineUntil > Date.now()) {
        return {
          success: false,
          quarantined: true,
          quarantineUntil: state.quarantineUntil,
          message: 'Browser is in quarantine mode.'
        };
      }

      const isValid = await CryptoUtils.verifyPassword(message.password, state.passwordHash);
      if (isValid) {
        await unlockBrowser();
        return { success: true };
      } else {
        const result = await handleFailedAttempt();
        return { success: false, ...result };
      }
    }

    case 'temporaryUnlock': {
      if (state.quarantineUntil > Date.now()) {
        return {
          success: false,
          quarantined: true,
          quarantineUntil: state.quarantineUntil
        };
      }

      const isValid = await CryptoUtils.verifyPassword(message.password, state.passwordHash);
      if (isValid) {
        await temporaryUnlock(message.minutes);
        return { success: true };
      } else {
        const result = await handleFailedAttempt();
        return { success: false, ...result };
      }
    }

    case 'setTempUnlock': {
      if (!state.isLocked) {
        state.tempUnlockUntil = Date.now() + (message.minutes * 60 * 1000);
        await browser.storage.local.set({ tempUnlockUntil: state.tempUnlockUntil });

        if (state.tempUnlockTimer) {
          clearTimeout(state.tempUnlockTimer);
        }
        state.tempUnlockTimer = setTimeout(async () => {
          state.tempUnlockTimer = null;
          await lockBrowser('Temporary unlock expired');
        }, message.minutes * 60 * 1000);

        return { success: true };
      }
      return { success: false, message: 'Browser is locked.' };
    }

    case 'resetPassword': {
      const answerValid = await CryptoUtils.verifyPassword(
        message.securityAnswer.toLowerCase().trim(),
        state.securityAnswerHash
      );
      if (answerValid) {
        const newHash = await CryptoUtils.sha256(message.newPassword);
        state.passwordHash = newHash;
        state.failedAttempts = 0;
        state.quarantineUntil = 0;

        await browser.storage.local.set({
          passwordHash: newHash,
          failedAttempts: 0,
          quarantineUntil: 0
        });

        return { success: true };
      } else {
        return { success: false, message: 'Security answer is incorrect.' };
      }
    }

    case 'setupComplete': {
      const hash = await CryptoUtils.sha256(message.password);
      const answerHash = await CryptoUtils.sha256(message.securityAnswer.toLowerCase().trim());

      state.isSetupComplete = true;
      state.passwordHash = hash;
      state.securityQuestion = message.securityQuestion;
      state.securityAnswerHash = answerHash;

      await browser.storage.local.set({
        passwordHash: hash,
        securityQuestion: message.securityQuestion,
        securityAnswerHash: answerHash,
        settings: state.settings
      });

      await lockBrowser('Initial setup complete');
      return { success: true };
    }

    case 'getSettings':
      return {
        settings: state.settings,
        securityQuestion: state.securityQuestion
      };

    case 'saveSettings': {
      const isValid = await CryptoUtils.verifyPassword(message.currentPassword, state.passwordHash);
      if (!isValid) {
        return { success: false, message: 'Current password is incorrect.' };
      }

      if (message.newPassword) {
        const newHash = await CryptoUtils.sha256(message.newPassword);
        state.passwordHash = newHash;
        await browser.storage.local.set({ passwordHash: newHash });
      }

      if (message.securityQuestion) {
        state.securityQuestion = message.securityQuestion;
        await browser.storage.local.set({ securityQuestion: message.securityQuestion });
      }

      if (message.securityAnswer) {
        const answerHash = await CryptoUtils.sha256(message.securityAnswer.toLowerCase().trim());
        state.securityAnswerHash = answerHash;
        await browser.storage.local.set({ securityAnswerHash: answerHash });
      }

      if (message.settings) {
        state.settings = { ...state.settings, ...message.settings };
        await browser.storage.local.set({ settings: state.settings });

        browser.idle.onStateChanged.removeListener(handleIdleStateChange);
        setupIdleDetection();
        setupContextMenu();
      }

      return { success: true };
    }

    case 'exportSettings':
      return {
        settings: state.settings,
        securityQuestion: state.securityQuestion
      };

    case 'importSettings': {
      if (message.settings) {
        state.settings = { ...state.settings, ...message.settings };
        await browser.storage.local.set({ settings: state.settings });

        browser.idle.onStateChanged.removeListener(handleIdleStateChange);
        setupIdleDetection();
        setupContextMenu();

        return { success: true };
      }
      return { success: false, message: 'No settings provided.' };
    }

    default:
      return { error: 'Unknown action' };
  }
}

// Start
initialize();
