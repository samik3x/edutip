// ══════════════════════════════════════════════════════════════
//  TIPOVAČKA — Landing Page JavaScript
// ══════════════════════════════════════════════════════════════

// ── Toast Notifications ──────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Tab Switching ────────────────────────────────────────────
const tabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('.auth-form');
const authError = document.getElementById('authError');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    // Update tabs
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update forms
    forms.forEach(f => f.classList.remove('active'));
    const targetForm = document.getElementById(target === 'login' ? 'loginForm' : 'registerForm');
    targetForm.classList.add('active');

    // Clear error
    hideError();
  });
});

function showError(msg) {
  authError.textContent = msg;
  authError.classList.add('visible');
}

function hideError() {
  authError.classList.remove('visible');
}

// ── Login Form ───────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showError('Vyplňte všetky polia');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Prihlasovanie...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Chyba pri prihlásení');
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Prihlásiť sa';
      return;
    }

    showToast('Prihlásenie úspešné! 🎉', 'success');
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 500);
  } catch (err) {
    showError('Chyba pripojenia k serveru');
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Prihlásiť sa';
  }
});

// ── Register Form ────────────────────────────────────────────
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const meno = document.getElementById('regMeno').value.trim();
  const priezvisko = document.getElementById('regPriezvisko').value.trim();
  const datum_narodenia = document.getElementById('regDatum').value;
  const trieda = document.getElementById('regTrieda').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!meno || !priezvisko || !datum_narodenia || !trieda || !username || !password) {
    showError('Vyplňte všetky polia');
    return;
  }

  if (username.length < 3) {
    showError('Prezývka musí mať aspoň 3 znaky');
    return;
  }

  if (password.length < 4) {
    showError('Heslo musí mať aspoň 4 znaky');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Registrujem...';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, meno, priezvisko, datum_narodenia, trieda })
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Chyba pri registrácii');
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Vytvoriť účet';
      return;
    }

    showToast('Registrácia úspešná! Vitajte 🎉', 'success');
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 500);
  } catch (err) {
    showError('Chyba pripojenia k serveru');
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Vytvoriť účet';
  }
});

// ── Check if already logged in ───────────────────────────────
(async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      window.location.href = '/dashboard';
    }
  } catch (e) {
    // Not logged in, stay on landing page
  }
})();
