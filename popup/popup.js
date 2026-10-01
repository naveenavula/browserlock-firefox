/**
 * BrowserLock - Popup Script
 */

(function() {
  'use strict';

  // Views
  const setupRequired = document.getElementById('setupRequired');
  const unlockedView = document.getElementById('unlockedView');
  const lockedView = document.getElementById('lockedView');

  // Buttons
  const openSetupBtn = document.getElementById('openSetupBtn');
  const lockBtn = document.getElementById('lockBtn');
  const settingsLink = document.getElementById('settingsLink');

  // Temp unlock
  const tempUnlockInfo = document.getElementById('tempUnlockInfo');
  const tempTimer = document.getElementById('tempTimer');
  const tempBtns = document.querySelectorAll('.temp-btn');

  let timerInterval = null;

  // ============================================================
  // INITIALIZATION
  // ============================================================
  async function init() {
    try {
      const state = await browser.runtime.sendMessage({ action: 'getState' });

      if (!state.isSetupComplete) {
        showView('setup');
        return;
      }

      if (state.isLocked) {
        showView('locked');
      } else {
        showView('unlocked');

        // Check for temporary unlock
        if (state.tempUnlockUntil && state.tempUnlockUntil > Date.now()) {
          showTempUnlockTimer(state.tempUnlockUntil);
        }
      }
    } catch (err) {
      console.error('Popup init error:', err);
    }
  }

  function showView(view) {
    setupRequired.classList.add('hidden');
    unlockedView.classList.add('hidden');
    lockedView.classList.add('hidden');

    switch (view) {
      case 'setup':
        setupRequired.classList.remove('hidden');
        break;
      case 'unlocked':
        unlockedView.classList.remove('hidden');
        break;
      case 'locked':
        lockedView.classList.remove('hidden');
        break;
    }
  }

  function showTempUnlockTimer(until) {
    tempUnlockInfo.classList.remove('hidden');

    function update() {
      const remaining = Math.max(0, until - Date.now());
      if (remaining <= 0) {
        clearInterval(timerInterval);
        window.close();
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      tempTimer.textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    update();
    timerInterval = setInterval(update, 1000);
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  openSetupBtn.addEventListener('click', async () => {
    await browser.runtime.sendMessage({ action: 'lock' });
    window.close();
  });

  lockBtn.addEventListener('click', async () => {
    await browser.runtime.sendMessage({ action: 'lock' });
    showView('locked');
    setTimeout(() => {
      window.close();
    }, 150);
  });

  lockedView.addEventListener('click', async () => {
    await browser.runtime.sendMessage({ action: 'focusLockWindow' });
  });

  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
    window.close();
  });

  // Temporary unlock buttons
  tempBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const minutes = parseInt(btn.dataset.minutes);
      const state = await browser.runtime.sendMessage({ action: 'getState' });

      if (!state.isLocked) {
        await browser.runtime.sendMessage({
          action: 'setTempUnlock',
          minutes: minutes
        });

        showTempUnlockTimer(Date.now() + (minutes * 60 * 1000));
      }
    });
  });

  // Initialize
  init();
})();
