/**
 * BrowserLock - Settings Script
 */

(function() {
  'use strict';

  // Auth
  const authOverlay = document.getElementById('authOverlay');
  const authPassword = document.getElementById('authPassword');
  const authBtn = document.getElementById('authBtn');
  const authError = document.getElementById('authError');

  // Settings content
  const settingsContent = document.getElementById('settingsContent');
  const saveStatus = document.getElementById('saveStatus');

  // Password
  const newPassword = document.getElementById('newPassword');
  const confirmNewPassword = document.getElementById('confirmNewPassword');

  // Security Question
  const currentQuestion = document.getElementById('currentQuestion');
  const newSecurityQuestion = document.getElementById('newSecurityQuestion');
  const newSecurityAnswer = document.getElementById('newSecurityAnswer');

  // Lock Behavior
  const lockOnStartup = document.getElementById('lockOnStartup');
  const autoLockOnIdle = document.getElementById('autoLockOnIdle');
  const idleTimeout = document.getElementById('idleTimeout');
  const idleTimeoutRow = document.getElementById('idleTimeoutRow');

  // Security
  const quarantineEnabled = document.getElementById('quarantineEnabled');
  const showNotification = document.getElementById('showNotification');
  const enableShortcut = document.getElementById('enableShortcut');
  const enableContextMenu = document.getElementById('enableContextMenu');

  // Whitelist
  const whitelistInput = document.getElementById('whitelistInput');
  const addWhitelistBtn = document.getElementById('addWhitelistBtn');
  const whitelistList = document.getElementById('whitelistList');
  const emptyWhitelist = document.getElementById('emptyWhitelist');

  // Import/Export
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');

  // Save
  const saveBtn = document.getElementById('saveBtn');

  let authenticatedPassword = '';
  let currentWhitelist = [];

  // ============================================================
  // AUTHENTICATION
  // ============================================================
  authBtn.addEventListener('click', authenticate);
  authPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authenticate();
  });

  async function authenticate() {
    const password = authPassword.value.trim();
    if (!password) {
      authError.textContent = 'Please enter your password.';
      return;
    }

    authBtn.disabled = true;

    try {
      // Test password by attempting to get settings with verification
      const response = await browser.runtime.sendMessage({
        action: 'saveSettings',
        currentPassword: password,
        settings: {} // Empty - just testing auth
      });

      if (response.success) {
        authenticatedPassword = password;
        authOverlay.style.display = 'none';
        settingsContent.classList.remove('hidden');
        loadSettings();
      } else {
        authError.textContent = response.message || 'Incorrect password.';
      }
    } catch (err) {
      authError.textContent = 'An error occurred.';
    }

    authBtn.disabled = false;
  }

  // ============================================================
  // LOAD SETTINGS
  // ============================================================
  async function loadSettings() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getSettings' });
      const settings = response.settings;

      // Security Question
      currentQuestion.textContent = response.securityQuestion || '-';

      // Lock Behavior
      lockOnStartup.checked = settings.lockOnStartup !== false;
      autoLockOnIdle.checked = settings.autoLockOnIdle !== false;
      idleTimeout.value = String(settings.idleTimeout || 5);
      updateIdleTimeoutVisibility();

      // Security
      quarantineEnabled.checked = settings.quarantineEnabled !== false;
      showNotification.checked = settings.showNotification !== false;
      enableShortcut.checked = settings.enableShortcut !== false;
      enableContextMenu.checked = settings.enableContextMenu !== false;

      // Whitelist
      currentWhitelist = settings.whitelist || [];
      renderWhitelist();

    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  // ============================================================
  // IDLE TIMEOUT VISIBILITY
  // ============================================================
  function updateIdleTimeoutVisibility() {
    idleTimeoutRow.style.opacity = autoLockOnIdle.checked ? '1' : '0.4';
    idleTimeoutRow.style.pointerEvents = autoLockOnIdle.checked ? 'auto' : 'none';
  }

  autoLockOnIdle.addEventListener('change', updateIdleTimeoutVisibility);

  // ============================================================
  // WHITELIST
  // ============================================================
  function renderWhitelist() {
    // Clear existing items (except the empty message)
    const items = whitelistList.querySelectorAll('.whitelist-item');
    items.forEach(item => item.remove());

    if (currentWhitelist.length === 0) {
      emptyWhitelist.classList.remove('hidden');
    } else {
      emptyWhitelist.classList.add('hidden');
      currentWhitelist.forEach((url, index) => {
        const item = document.createElement('div');
        item.className = 'whitelist-item';
        item.innerHTML = `
          <span>${escapeHtml(url)}</span>
          <button class="whitelist-remove" data-index="${index}" title="Remove">×</button>
        `;
        whitelistList.appendChild(item);
      });
    }

    // Attach remove handlers
    whitelistList.querySelectorAll('.whitelist-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        currentWhitelist.splice(index, 1);
        renderWhitelist();
      });
    });
  }

  addWhitelistBtn.addEventListener('click', () => {
    const url = whitelistInput.value.trim();
    if (!url) return;

    if (!currentWhitelist.includes(url)) {
      currentWhitelist.push(url);
      renderWhitelist();
    }
    whitelistInput.value = '';
  });

  whitelistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWhitelistBtn.click();
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================
  // SAVE SETTINGS
  // ============================================================
  saveBtn.addEventListener('click', async () => {
    // Validate password change
    if (newPassword.value && newPassword.value !== confirmNewPassword.value) {
      showSaveStatus('Passwords do not match!', '#ff6b6b');
      return;
    }

    if (newPassword.value && newPassword.value.length < 4) {
      showSaveStatus('Password must be at least 4 characters!', '#ff6b6b');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const message = {
        action: 'saveSettings',
        currentPassword: authenticatedPassword,
        settings: {
          lockOnStartup: lockOnStartup.checked,
          autoLockOnIdle: autoLockOnIdle.checked,
          idleTimeout: parseInt(idleTimeout.value),
          quarantineEnabled: quarantineEnabled.checked,
          showNotification: showNotification.checked,
          enableShortcut: enableShortcut.checked,
          enableContextMenu: enableContextMenu.checked,
          whitelist: currentWhitelist
        }
      };

      // Add new password if provided
      if (newPassword.value) {
        message.newPassword = newPassword.value;
        authenticatedPassword = newPassword.value; // Update for future saves
      }

      // Add security question if provided
      if (newSecurityQuestion.value.trim()) {
        message.securityQuestion = newSecurityQuestion.value.trim();
      }

      if (newSecurityAnswer.value.trim()) {
        message.securityAnswer = newSecurityAnswer.value.trim();
      }

      const response = await browser.runtime.sendMessage(message);

      if (response.success) {
        showSaveStatus('✓ Settings saved successfully!', '#4ade80');

        // Clear sensitive fields
        newPassword.value = '';
        confirmNewPassword.value = '';
        newSecurityQuestion.value = '';
        newSecurityAnswer.value = '';

        // Reload to reflect changes
        loadSettings();
      } else {
        showSaveStatus(response.message || 'Failed to save settings', '#ff6b6b');
      }
    } catch (err) {
      showSaveStatus('An error occurred while saving', '#ff6b6b');
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Settings';
  });

  function showSaveStatus(text, color) {
    saveStatus.textContent = text;
    saveStatus.style.color = color;
    saveStatus.classList.add('visible');

    setTimeout(() => {
      saveStatus.classList.remove('visible');
    }, 3000);
  }

  // ============================================================
  // IMPORT / EXPORT
  // ============================================================
  exportBtn.addEventListener('click', async () => {
    try {
      const response = await browser.runtime.sendMessage({ action: 'exportSettings' });
      const data = JSON.stringify(response, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'browserlock-settings.json';
      a.click();

      URL.revokeObjectURL(url);
      showSaveStatus('✓ Settings exported!', '#4ade80');
    } catch (err) {
      showSaveStatus('Export failed', '#ff6b6b');
    }
  });

  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.settings) {
        const response = await browser.runtime.sendMessage({
          action: 'importSettings',
          settings: data.settings
        });

        if (response.success) {
          showSaveStatus('✓ Settings imported!', '#4ade80');
          loadSettings();
        } else {
          showSaveStatus(response.message || 'Import failed', '#ff6b6b');
        }
      } else {
        showSaveStatus('Invalid settings file', '#ff6b6b');
      }
    } catch (err) {
      showSaveStatus('Failed to parse settings file', '#ff6b6b');
    }

    importFile.value = '';
  });

})();
