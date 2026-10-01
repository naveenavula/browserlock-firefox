/**
 * BrowserLock - Lock Screen Script
 */

(function() {
  'use strict';

  // Elements
  const passwordInput = document.getElementById('passwordInput');
  const unlockBtn = document.getElementById('unlockBtn');
  const errorMessage = document.getElementById('errorMessage');
  const lockCard = document.getElementById('lockCard');
  const lockSubtitle = document.getElementById('lockSubtitle');
  const togglePassword = document.getElementById('togglePassword');
  const forgotLink = document.getElementById('forgotLink');

  // Views
  const setupForm = document.getElementById('setupForm');
  const unlockForm = document.getElementById('unlockForm');
  const quarantineView = document.getElementById('quarantineView');
  const recoveryForm = document.getElementById('recoveryForm');
  const quarantineTimer = document.getElementById('quarantineTimer');

  // Setup form elements
  const setupNewPassword = document.getElementById('setupNewPassword');
  const setupConfirmPassword = document.getElementById('setupConfirmPassword');
  const setupSecurityQuestion = document.getElementById('setupSecurityQuestion');
  const setupSecurityAnswer = document.getElementById('setupSecurityAnswer');
  const setupSubmitBtn = document.getElementById('setupSubmitBtn');
  const setupError = document.getElementById('setupError');

  // Recovery elements
  const securityQuestionText = document.getElementById('securityQuestionText');
  const securityAnswer = document.getElementById('securityAnswer');
  const newPassword = document.getElementById('newPassword');
  const confirmNewPassword = document.getElementById('confirmNewPassword');
  const resetBtn = document.getElementById('resetBtn');
  const recoveryError = document.getElementById('recoveryError');
  const backToLogin = document.getElementById('backToLogin');

  let quarantineInterval = null;

  // ============================================================
  // INITIALIZATION
  // ============================================================
  async function init() {
    try {
      const state = await browser.runtime.sendMessage({ action: 'getState' });

      // If setup is not complete, show setup form directly
      if (!state.isSetupComplete) {
        showSetup();
        return;
      }

      // Check quarantine
      if (state.quarantineUntil && state.quarantineUntil > Date.now()) {
        showQuarantine(state.quarantineUntil);
        return;
      }

      // Normal locked view
      showLogin();
      passwordInput.focus();
    } catch (e) {
      console.error('Lock screen init error:', e);
    }
  }

  function showSetup() {
    unlockForm.classList.add('hidden');
    quarantineView.classList.add('hidden');
    recoveryForm.classList.add('hidden');
    setupForm.classList.remove('hidden');
    lockSubtitle.textContent = 'Set up master password to lock browser';
    setupNewPassword.focus();
  }

  // ============================================================
  // SETUP SUBMIT
  // ============================================================
  setupSubmitBtn.addEventListener('click', async () => {
    const pwd = setupNewPassword.value.trim();
    const confirm = setupConfirmPassword.value.trim();
    const question = setupSecurityQuestion.value.trim() || 'What is your favorite color?';
    const answer = setupSecurityAnswer.value.trim() || 'blue';

    if (pwd.length < 4) {
      setupError.textContent = 'Password must be at least 4 characters.';
      return;
    }

    if (pwd !== confirm) {
      setupError.textContent = 'Passwords do not match.';
      return;
    }

    setupSubmitBtn.disabled = true;
    setupSubmitBtn.textContent = 'Setting up & Locking...';

    try {
      const response = await browser.runtime.sendMessage({
        action: 'setupComplete',
        password: pwd,
        securityQuestion: question,
        securityAnswer: answer
      });

      if (response.success) {
        setupForm.classList.add('hidden');
        showLogin();
        showError('Setup complete! Browser is now locked.');
        errorMessage.style.color = '#4ade80';
      } else {
        setupError.textContent = response.message || 'Setup failed.';
      }
    } catch (e) {
      setupError.textContent = 'An error occurred during setup.';
    }

    setupSubmitBtn.disabled = false;
    setupSubmitBtn.textContent = 'Set Password & Lock';
  });

  setupConfirmPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') setupSubmitBtn.click();
  });

  // ============================================================
  // UNLOCK
  // ============================================================
  async function attemptUnlock() {
    const password = passwordInput.value.trim();

    if (!password) {
      showError('Please enter your password');
      shakeCard();
      return;
    }

    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Unlocking...';

    try {
      const response = await browser.runtime.sendMessage({
        action: 'unlock',
        password: password
      });

      if (response.success) {
        lockCard.style.transform = 'scale(0.95)';
        lockCard.style.opacity = '0';
        setTimeout(() => {
          window.close();
        }, 200);
      } else if (response.quarantined) {
        showQuarantine(response.quarantineUntil);
      } else {
        showError(response.message || 'Incorrect password');
        shakeCard();
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (err) {
      showError('An error occurred. Please try again.');
    }

    unlockBtn.disabled = false;
    unlockBtn.textContent = 'Unlock';
  }

  // ============================================================
  // QUARANTINE
  // ============================================================
  function showQuarantine(until) {
    setupForm.classList.add('hidden');
    unlockForm.classList.add('hidden');
    recoveryForm.classList.add('hidden');
    quarantineView.classList.remove('hidden');
    lockSubtitle.textContent = 'Security lockout active';

    updateQuarantineTimer(until);
    quarantineInterval = setInterval(() => {
      updateQuarantineTimer(until);
    }, 1000);
  }

  function updateQuarantineTimer(until) {
    const remaining = Math.max(0, until - Date.now());

    if (remaining <= 0) {
      clearInterval(quarantineInterval);
      window.location.reload();
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    quarantineTimer.textContent =
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // ============================================================
  // PASSWORD RECOVERY
  // ============================================================
  async function showRecovery() {
    const state = await browser.runtime.sendMessage({ action: 'getState' });

    if (state.securityQuestion) {
      securityQuestionText.textContent = `"${state.securityQuestion}"`;
    } else {
      securityQuestionText.textContent = 'No security question set.';
    }

    setupForm.classList.add('hidden');
    unlockForm.classList.add('hidden');
    quarantineView.classList.add('hidden');
    recoveryForm.classList.remove('hidden');
    lockSubtitle.textContent = 'Reset your password';
    securityAnswer.focus();
  }

  function showLogin() {
    setupForm.classList.add('hidden');
    recoveryForm.classList.add('hidden');
    quarantineView.classList.add('hidden');
    unlockForm.classList.remove('hidden');
    lockSubtitle.textContent = 'Enter your password to unlock';
    recoveryError.textContent = '';
    passwordInput.focus();
  }

  async function resetPassword() {
    const answer = securityAnswer.value.trim();
    const newPwd = newPassword.value;
    const confirmPwd = confirmNewPassword.value;

    if (!answer) {
      recoveryError.textContent = 'Please enter your security answer.';
      return;
    }

    if (newPwd.length < 4) {
      recoveryError.textContent = 'New password must be at least 4 characters.';
      return;
    }

    if (newPwd !== confirmPwd) {
      recoveryError.textContent = 'Passwords do not match.';
      return;
    }

    resetBtn.disabled = true;
    resetBtn.textContent = 'Resetting...';

    try {
      const response = await browser.runtime.sendMessage({
        action: 'resetPassword',
        securityAnswer: answer,
        newPassword: newPwd
      });

      if (response.success) {
        recoveryError.textContent = '';
        securityAnswer.value = '';
        newPassword.value = '';
        confirmNewPassword.value = '';

        showLogin();
        showError('Password reset successful. Please login with your new password.');
        errorMessage.style.color = '#4ade80';
      } else {
        recoveryError.textContent = response.message || 'Reset failed. Check your answer.';
      }
    } catch (err) {
      recoveryError.textContent = 'An error occurred.';
    }

    resetBtn.disabled = false;
    resetBtn.textContent = 'Reset Password';
  }

  // ============================================================
  // UI HELPERS
  // ============================================================
  function showError(msg) {
    errorMessage.textContent = msg;
    if (!errorMessage.style.color || errorMessage.style.color === 'rgb(74, 222, 128)') {
      errorMessage.style.color = '#ff6b6b';
    }
  }

  function shakeCard() {
    lockCard.classList.add('shake');
    setTimeout(() => lockCard.classList.remove('shake'), 600);
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  unlockBtn.addEventListener('click', attemptUnlock);

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      attemptUnlock();
    }
  });

  togglePassword.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
  });

  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    showRecovery();
  });

  backToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    showLogin();
  });

  resetBtn.addEventListener('click', resetPassword);

  // Initialize
  init();
})();
