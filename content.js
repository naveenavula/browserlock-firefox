/**
 * BrowserLock - Content Script Guard
 * Injected into web pages to display a lock overlay when browser is locked
 */

(function() {
  'use strict';

  let overlay = null;

  function createOverlay() {
    if (document.getElementById('browserlock-page-guard')) return;

    overlay = document.createElement('div');
    overlay.id = 'browserlock-page-guard';
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: #0a0a1a !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      color: #fff !important;
      user-select: none !important;
      cursor: default !important;
    `;

    overlay.innerHTML = `
      <div style="text-align: center; max-width: 400px; padding: 30px; background: rgba(22, 33, 62, 0.95); border: 1px solid rgba(233, 69, 96, 0.3); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.7);">
        <div style="font-size: 54px; margin-bottom: 16px;">🔒</div>
        <h1 style="font-size: 26px; font-weight: 700; color: #fff; margin: 0 0 10px 0;">BrowserLock</h1>
        <p style="font-size: 14px; color: rgba(255,255,255,0.6); margin: 0 0 24px 0;">This browser is locked. Switch to the lock screen window to unlock.</p>
        <button id="browserlock-focus-btn" style="background: linear-gradient(135deg, #e94560, #c23152); border: none; color: #fff; padding: 12px 24px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;">
          Go to Lock Screen
        </button>
      </div>
    `;

    document.documentElement.appendChild(overlay);

    const btn = document.getElementById('browserlock-focus-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        browser.runtime.sendMessage({ action: 'focusLockWindow' });
      });
    }
  }

  function removeOverlay() {
    const el = document.getElementById('browserlock-page-guard');
    if (el) {
      el.remove();
    }
  }

  // Listen for lock/unlock messages from background
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'lock') {
      createOverlay();
    } else if (message.action === 'unlock') {
      removeOverlay();
    }
  });

  // Check initial state
  browser.runtime.sendMessage({ action: 'getState' }).then((state) => {
    if (state && state.isLocked) {
      createOverlay();
    }
  }).catch(() => {});
})();
