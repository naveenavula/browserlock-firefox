/**
 * BrowserLock - Setup Script
 */

(function() {
  'use strict';

  // Steps
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const successView = document.getElementById('successView');

  // Step indicators
  const step1Dot = document.getElementById('step1Dot');
  const step2Dot = document.getElementById('step2Dot');

  // Step 1 elements
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const strengthFill = document.getElementById('strengthFill');
  const strengthText = document.getElementById('strengthText');
  const step1Error = document.getElementById('step1Error');
  const nextBtn = document.getElementById('nextBtn');

  // Step 2 elements
  const securityQuestion = document.getElementById('securityQuestion');
  const customQuestionGroup = document.getElementById('customQuestionGroup');
  const customQuestion = document.getElementById('customQuestion');
  const securityAnswer = document.getElementById('securityAnswer');
  const step2Error = document.getElementById('step2Error');
  const backBtn = document.getElementById('backBtn');
  const completeBtn = document.getElementById('completeBtn');

  let selectedPassword = '';

  // ============================================================
  // PASSWORD STRENGTH
  // ============================================================
  function checkStrength(pwd) {
    let score = 0;
    if (pwd.length >= 4) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    const levels = [
      { color: '#ff4444', text: 'Too short', width: '0%' },
      { color: '#ff6b6b', text: 'Weak', width: '20%' },
      { color: '#ffa726', text: 'Fair', width: '40%' },
      { color: '#ffee58', text: 'Good', width: '60%' },
      { color: '#66bb6a', text: 'Strong', width: '80%' },
      { color: '#4ade80', text: 'Very Strong', width: '100%' }
    ];

    const level = levels[Math.min(score, levels.length - 1)];
    strengthFill.style.width = level.width;
    strengthFill.style.background = level.color;
    strengthText.textContent = pwd.length > 0 ? level.text : '';
    strengthText.style.color = level.color;
  }

  password.addEventListener('input', () => {
    checkStrength(password.value);
  });

  // ============================================================
  // STEP NAVIGATION
  // ============================================================
  function goToStep(step) {
    step1.classList.add('hidden');
    step2.classList.add('hidden');
    successView.classList.add('hidden');

    step1Dot.classList.remove('active', 'done');
    step2Dot.classList.remove('active', 'done');

    switch (step) {
      case 1:
        step1.classList.remove('hidden');
        step1Dot.classList.add('active');
        break;
      case 2:
        step2.classList.remove('hidden');
        step1Dot.classList.add('done');
        step2Dot.classList.add('active');
        break;
      case 3:
        successView.classList.remove('hidden');
        step1Dot.classList.add('done');
        step2Dot.classList.add('done');
        break;
    }
  }

  // ============================================================
  // STEP 1: PASSWORD
  // ============================================================
  nextBtn.addEventListener('click', () => {
    const pwd = password.value;
    const confirm = confirmPassword.value;

    if (pwd.length < 4) {
      step1Error.textContent = 'Password must be at least 4 characters.';
      return;
    }

    if (pwd !== confirm) {
      step1Error.textContent = 'Passwords do not match.';
      return;
    }

    step1Error.textContent = '';
    selectedPassword = pwd;
    goToStep(2);
  });

  // Handle Enter key
  confirmPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nextBtn.click();
  });

  password.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmPassword.focus();
  });

  // ============================================================
  // STEP 2: SECURITY QUESTION
  // ============================================================
  securityQuestion.addEventListener('change', () => {
    if (securityQuestion.value === 'custom') {
      customQuestionGroup.classList.remove('hidden');
      customQuestion.focus();
    } else {
      customQuestionGroup.classList.add('hidden');
    }
  });

  backBtn.addEventListener('click', () => {
    goToStep(1);
  });

  completeBtn.addEventListener('click', async () => {
    let question = securityQuestion.value;
    if (question === 'custom') {
      question = customQuestion.value.trim();
    }

    if (!question) {
      step2Error.textContent = 'Please select or enter a security question.';
      return;
    }

    const answer = securityAnswer.value.trim();
    if (!answer) {
      step2Error.textContent = 'Please enter an answer.';
      return;
    }

    step2Error.textContent = '';
    completeBtn.disabled = true;
    completeBtn.textContent = 'Setting up...';

    try {
      const response = await browser.runtime.sendMessage({
        action: 'setupComplete',
        password: selectedPassword,
        securityQuestion: question,
        securityAnswer: answer
      });

      if (response.success) {
        goToStep(3);

        // Clean up password from memory
        selectedPassword = '';
        password.value = '';
        confirmPassword.value = '';
        securityAnswer.value = '';
      } else {
        step2Error.textContent = response.message || 'Setup failed. Please try again.';
      }
    } catch (err) {
      step2Error.textContent = 'An error occurred. Please try again.';
    }

    completeBtn.disabled = false;
    completeBtn.textContent = 'Complete Setup';
  });

  // Initialize
  goToStep(1);
})();
