// ══════════════════════════════════════════════════════════════
//  TIPOVAČKA — Dashboard JavaScript (EduPage & Admin Engine)
// ══════════════════════════════════════════════════════════════

let currentUser = null;
let allEdupageSubjects = [];
let allPredmetyList = [];

// ── Toast Notifications ──────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── API Helper ───────────────────────────────────────────────
async function api(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    const data = await res.json();
    if (res.status === 401) {
      window.location.href = '/';
      return null;
    }
    if (!res.ok) {
      showToast(data.error || 'Chyba', 'error');
      return null;
    }
    return data;
  } catch (err) {
    showToast('Chyba pripojenia k serveru', 'error');
    return null;
  }
}

// ── Utilities ────────────────────────────────────────────────
function getInitials(meno, priezvisko) {
  return ((meno && meno[0]) || '') + ((priezvisko && priezvisko[0]) || '');
}

function getGradeColor(grade) {
  const colors = { 1: '#10b981', 2: '#06b6d4', 3: '#f59e0b', 4: '#f97316', 5: '#ef4444' };
  return colors[grade] || '#7c3aed';
}

function getGradeClass(grade) {
  return `grade-${grade}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[2])}. ${parseInt(parts[1])}. ${parts[0]}`;
  }
  const d = new Date(dateStr);
  return d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

// ── Modal Helper ─────────────────────────────────────────────
window.openModal = function(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
};

window.closeModal = function(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('visible');
    document.body.style.overflow = '';
  }
};

// ── Initialize App ───────────────────────────────────────────
async function init() {
  currentUser = await api('/api/auth/me');
  if (!currentUser) return;

  updateUserInfo();

  // Load basic components
  await Promise.all([
    loadStats(),
    loadEdupageSubjects(),
    loadPredmetyRaw()
  ]);

  setupNavigation();
  setupSidebar();
  setupAdminTabs();
  setupAdminForms();
  setupTicketForm();
  setupSearch();
  setupLogout();
}

// ── Update User Info ─────────────────────────────────────────
function updateUserInfo() {
  const initials = getInitials(currentUser.meno, currentUser.priezvisko);

  // Sidebar mini
  document.getElementById('miniAvatar').textContent = initials;
  document.getElementById('miniAvatar').style.background = currentUser.avatar_color || '#7c3aed';
  document.getElementById('miniName').textContent = `${currentUser.meno} ${currentUser.priezvisko}`;
  document.getElementById('miniClass').textContent = `${currentUser.trieda} · Skupina ${currentUser.skupina || 1}`;

  // Admin visibility
  const navAdmin = document.getElementById('navAdmin');
  const navTickety = document.getElementById('navTickety');
  const btnQuick = document.getElementById('btnQuickCreatePisomka');
  if (currentUser.is_admin) {
    if (navAdmin) navAdmin.style.display = 'flex';
    if (navTickety) navTickety.style.display = 'flex';
    if (btnQuick) btnQuick.style.display = 'inline-flex';
  } else {
    if (navAdmin) navAdmin.style.display = 'none';
    if (navTickety) navTickety.style.display = 'none';
    if (btnQuick) btnQuick.style.display = 'none';
  }

  // Profile Section
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileAvatar').style.background = currentUser.avatar_color || '#7c3aed';
  document.getElementById('profileName').textContent = `${currentUser.meno} ${currentUser.priezvisko}`;
  document.getElementById('profileUsername').textContent = `@${currentUser.username}${currentUser.is_admin ? ' (👑 Admin)' : ''}`;
  document.getElementById('profileTrieda').textContent = currentUser.trieda;
  document.getElementById('profileSkupina').textContent = `Skupina ${currentUser.skupina || 1}`;
  document.getElementById('profileDatum').textContent = formatDate(currentUser.datum_narodenia);
  document.getElementById('profileBody').textContent = `${currentUser.body} bodov`;
  document.getElementById('profileCreated').textContent = formatDate(currentUser.created_at);
}

// ── Stats ────────────────────────────────────────────────────
async function loadStats() {
  const stats = await api('/api/stats');
  if (!stats) return;

  animateCounter('statMyTips', stats.myTipy);
  animateCounter('statCorrect', stats.myCorrect);
  animateCounter('statPoints', stats.myPoints);
  animateCounter('statUsers', stats.totalUsers);
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const steps = 25;
  const inc = target / steps;
  const timer = setInterval(() => {
    current += inc;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.round(current);
  }, 25);
}

// ── Load Raw Predmety ────────────────────────────────────────
async function loadPredmetyRaw() {
  allPredmetyList = await api('/api/predmety') || [];
  populateSubjectDropdowns();
}

function populateSubjectDropdowns() {
  const select = document.getElementById('newPisomkaPredmet');
  if (!select) return;
  select.innerHTML = '<option value="">Vyber predmet...</option>';
  allPredmetyList.forEach(p => {
    select.innerHTML += `<option value="${p.id}" data-groups="${p.has_groups}">${p.nazov} ${p.ucitel ? '(' + p.ucitel + ')' : ''}</option>`;
  });
}

window.handlePredmetChangeInCreate = function(predmetId) {
  const select = document.getElementById('newPisomkaPredmet');
  const selOption = select.options[select.selectedIndex];
  const hasGroups = selOption && selOption.getAttribute('data-groups') === '1';
  const skupinaSelect = document.getElementById('newPisomkaSkupina');

  if (hasGroups) {
    skupinaSelect.innerHTML = `
      <option value="1">Skupina 1</option>
      <option value="2">Skupina 2</option>
      <option value="0">Celá trieda (obe skupiny)</option>
    `;
  } else {
    skupinaSelect.innerHTML = `
      <option value="0">Celá trieda (nedelený predmet)</option>
    `;
  }
};

// ── EDUPAGE STYLE SUBJECTS LIST ──────────────────────────────
async function loadEdupageSubjects() {
  const container = document.getElementById('edupageList');
  allEdupageSubjects = await api('/api/predmety/edupage') || [];
  renderEdupageSubjects(allEdupageSubjects);
}

function renderEdupageSubjects(subjects) {
  const container = document.getElementById('edupageList');
  if (!container) return;

  if (subjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <p class="empty-state-text">Žiadne predmety nenájdené</p>
      </div>
    `;
    return;
  }

  container.innerHTML = subjects.map(s => {
    const hasPisomky = s.pisomky && s.pisomky.length > 0;
    const activeCount = hasPisomky ? s.pisomky.filter(p => p.stav === 'active').length : 0;

    return `
      <div class="edupage-row ${activeCount > 0 ? 'has-active' : ''}" id="subj-row-${s.id}">
        <div class="edupage-header" onclick="toggleEdupageRow(${s.id})">
          <div class="edupage-title-box">
            <div class="edupage-expand-btn">▶</div>
            <div>
              <div class="edupage-subj-name">${s.nazov}</div>
            </div>
          </div>
          <div class="edupage-meta-right">
            ${s.has_groups ? `<span class="badge-groups-tag">2 skupiny</span>` : ''}
            ${activeCount > 0 ? `
              <span class="badge-pill" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4);">
                🔥 ${activeCount} ${activeCount === 1 ? 'písomka' : 'písomky'}
              </span>
            ` : '<span style="font-size:0.8rem; color:var(--text-muted);">Žiadne písomky</span>'}
          </div>
        </div>

        <div class="edupage-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <strong style="font-size:0.9rem; color:var(--text-secondary);">Písomky a tipovačky k predmetu:</strong>
            ${currentUser.is_admin ? `
              <button class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem;" onclick="openCreatePisomkaModal(${s.id})">
                ➕ Pridať písomku
              </button>
            ` : ''}
          </div>

          ${hasPisomky ? `
            <div class="pisomky-list">
              ${s.pisomky.map(p => `
                <div class="pisomka-card">
                  <div class="pisomka-info">
                    <h4>${p.nazov}</h4>
                    <div class="pisomka-meta">
                      <span>📅 ${formatDate(p.datum)}</span>
                      <span>👥 Trieda ${p.trieda} ${p.skupina > 0 ? `(Skupina ${p.skupina})` : '(Celá trieda)'}</span>
                      <span>🎯 Tipov: ${p.pocet_tipov || 0}</span>
                      <span>${p.stav === 'active' ? '<span style="color:#10b981;">🟢 Otvorené tipovanie</span>' : '<span style="color:#888;">🏁 Vyhodnotená</span>'}</span>
                    </div>
                    ${p.popis ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">${p.popis}</div>` : ''}
                  </div>
                  <div class="pisomka-actions">
                    <button class="btn btn-primary" style="padding:8px 14px; font-size:0.85rem;" onclick="openPisomkaTipModal(${p.id})">
                      <span>${p.stav === 'active' ? '🎯 Tipovať na spolužiakov' : '📊 Pozrieť tipy & výsledky'}</span>
                    </button>
                    ${currentUser.is_admin ? `
                      <button class="btn" style="padding:8px 12px; font-size:0.85rem; background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);" onclick="openEvaluateModal(${p.id})">
                        📝 Vyhodnotiť
                      </button>
                      <button class="btn" style="padding:8px 10px; font-size:0.85rem; background:rgba(244,63,94,0.1); color:#f43f5e; border:1px solid rgba(244,63,94,0.2);" onclick="deletePisomka(${p.id})">
                        🗑️
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <p style="font-size:0.85rem; color:var(--text-muted); padding:10px 0;">
              K tomuto predmetu zatiaľ nie je vypísaná žiadna písomka.
            </p>
          `}
        </div>
      </div>
    `;
  }).join('');
}

window.toggleEdupageRow = function(id) {
  const row = document.getElementById(`subj-row-${id}`);
  if (row) {
    row.classList.toggle('open');
  }
};

// ── Filter Subjects ──────────────────────────────────────────
function setupSearch() {
  const searchInput = document.getElementById('searchSubjects');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    const filtered = allEdupageSubjects.filter(s =>
      s.nazov.toLowerCase().includes(q) ||
      (s.ucitel && s.ucitel.toLowerCase().includes(q))
    );
    renderEdupageSubjects(filtered);
  });
}

window.filterSubjects = function(type, btn) {
  document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');

  let filtered = allEdupageSubjects;
  if (type === 'with_tests') {
    filtered = allEdupageSubjects.filter(s => s.pisomky && s.pisomky.length > 0);
  } else if (type === 'groups') {
    filtered = allEdupageSubjects.filter(s => s.has_groups === 1);
  }
  renderEdupageSubjects(filtered);
};

// ── TIPPING ON CLASSMATES MODAL ──────────────────────────────
let currentPisomkaDetail = null;

window.openPisomkaTipModal = async function(pisomkaId) {
  openModal('pisomkaTipModal');
  const list = document.getElementById('pisomkaStudentsList');
  const reportBox = document.getElementById('myGradeReportContainer');
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Načítavam spolužiakov...</p></div>';

  const data = await api(`/api/pisomky/${pisomkaId}`);
  if (!data) return;

  currentPisomkaDetail = data;

  const { pisomka, students, is_student, moja_nahlasena_znamka, moja_skutocna_znamka } = data;
  document.getElementById('modalPisomkaTitle').textContent = pisomka.nazov;
  document.getElementById('modalPisomkaSub').textContent = `${pisomka.predmet_nazov} · ${formatDate(pisomka.datum)} · Trieda ${pisomka.trieda} ${pisomka.skupina > 0 ? '(Skupina ' + pisomka.skupina + ')' : ''}`;

  const isResolved = pisomka.stav === 'resolved';

  // Študentský report vlastnej známky
  if (reportBox) {
    if (is_student) {
      if (isResolved) {
        reportBox.innerHTML = `
          <div class="student-grade-box">
            <div class="student-grade-box-header">
              <span class="student-grade-title">🎓 Tvoja oficiálna známka z písomky</span>
              <span class="student-grade-badge confirmed">✅ Potvrdené adminom</span>
            </div>
            <div style="font-size:1.05rem; font-weight:700; margin-top:6px; display:flex; align-items:center; gap:8px;">
              Výsledná známka: <span class="grade-badge-sm ${getGradeClass(moja_skutocna_znamka)}">${moja_skutocna_znamka || '-'}</span>
            </div>
          </div>
        `;
      } else {
        reportBox.innerHTML = `
          <div class="student-grade-box">
            <div class="student-grade-box-header">
              <span class="student-grade-title">📝 Akú známku si dostal z tejto písomky?</span>
              <span class="student-grade-badge ${moja_nahlasena_znamka ? 'pending' : 'none'}" id="myReportStatusBadge">
                ${moja_nahlasena_znamka ? '⏳ Nahlásené: Známka ' + moja_nahlasena_znamka : 'Zatiaľ nenahlásené'}
              </span>
            </div>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:10px;">
              Zadaj známku, ktorú si dostal. Admin ju po overení jedným kliknutím potvrdí a vyhodnotí tipy:
            </p>
            <div class="my-grade-btn-row" id="myGradeBtnRow">
              ${[1, 2, 3, 4, 5].map(g => `
                <button
                  type="button"
                  class="my-grade-choice-btn ${moja_nahlasena_znamka === g ? 'selected' : ''}"
                  data-grade="${g}"
                  onclick="nahlasitMojeZnamku(${pisomka.id}, ${g}, this)">
                  ${g}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }
    } else {
      reportBox.innerHTML = '';
    }
  }

  if (students.length === 0) {
    list.innerHTML = '<div class="empty-state"><p class="empty-state-text">V tejto triede a skupine nie sú žiadni žiaci.</p></div>';
    return;
  }

  list.innerHTML = students.map(s => {
    return `
      <div class="tipping-student-item ${s.is_self ? 'self' : ''}">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="user-mini-avatar" style="background:${s.avatar_color || '#7c3aed'};">
            ${getInitials(s.meno, s.priezvisko)}
          </div>
          <div>
            <strong>${s.meno} ${s.priezvisko}</strong>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">Skupina ${s.skupina || 1}</span>
            ${s.is_self ? '<span style="font-size:0.75rem; color:#f59e0b; margin-left:4px;">(Ty)</span>' : ''}
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          ${s.is_self ? `
            <span style="font-size:0.8rem; color:var(--text-muted);">
              ${s.nahlasena_znamka ? `Nahlásil si: <strong style="color:#06b6d4;">${s.nahlasena_znamka}</strong>` : 'Sám na seba netipuješ'}
            </span>
          ` : isResolved ? `
            <div style="display:flex; align-items:center; gap:6px;">
              <span>Tvoj tip: <strong class="grade-badge-sm ${getGradeClass(s.moj_tip)}">${s.moj_tip || '-'}</strong></span>
              <span>→ Realita: <strong class="grade-badge-sm ${getGradeClass(s.skutocna_znamka)}">${s.skutocna_znamka || '-'}</strong></span>
              <span style="font-weight:700; color:${s.ziskane_body > 0 ? '#10b981' : '#f43f5e'};">
                ${s.ziskane_body > 0 ? `+${s.ziskane_body}b ✅` : '0b ❌'}
              </span>
            </div>
          ` : `
            <div class="grade-btn-group" id="grade-group-${s.id}">
              ${[1, 2, 3, 4, 5].map(g => `
                <button
                  class="grade-tip-btn ${s.moj_tip === g ? 'selected' : ''}"
                  data-grade="${g}"
                  onclick="submitTipForStudent(${pisomka.id}, ${s.id}, ${g}, this)">
                  ${g}
                </button>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
};

window.nahlasitMojeZnamku = async function(pisomkaId, grade, btn) {
  const row = document.getElementById('myGradeBtnRow');
  if (row) {
    row.querySelectorAll('.my-grade-choice-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  const badge = document.getElementById('myReportStatusBadge');
  if (badge) {
    badge.className = 'student-grade-badge pending';
    badge.textContent = `⏳ Nahlásené: Známka ${grade}`;
  }

  const res = await api(`/api/pisomky/${pisomkaId}/nahlasit-znamku`, {
    method: 'POST',
    body: JSON.stringify({ znamka: grade })
  });

  if (res) {
    showToast(res.message || `Známka ${grade} bola nahlásená! 👍`, 'success');
  }
};

window.submitTipForStudent = async function(pisomkaId, targetUserId, grade, btn) {
  // Visually select immediately
  const group = document.getElementById(`grade-group-${targetUserId}`);
  if (group) {
    group.querySelectorAll('.grade-tip-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  const res = await api('/api/tipy/pisomka', {
    method: 'POST',
    body: JSON.stringify({
      pisomka_id: pisomkaId,
      target_user_id: targetUserId,
      predpovedana_znamka: grade
    })
  });

  if (res) {
    showToast(`Tip na známku ${grade} bol uložený! 🎯`, 'success');
    loadStats();
  }
};

// ── ADMIN: EVALUATE MODAL ────────────────────────────────────
let currentEvalPisomkaId = null;

window.openEvaluateModal = async function(pisomkaId) {
  currentEvalPisomkaId = pisomkaId;
  openModal('evaluateModal');
  const list = document.getElementById('evalStudentsList');
  const bannerContainer = document.getElementById('evalStatusBannerContainer');
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Načítavam zoznam žiakov...</p></div>';

  const data = await api(`/api/pisomky/${pisomkaId}`);
  if (!data) return;

  const { pisomka, students } = data;
  document.getElementById('evalModalTitle').textContent = `Vyhodnotiť: ${pisomka.nazov}`;
  document.getElementById('evalModalSub').textContent = `${pisomka.predmet_nazov} · Trieda ${pisomka.trieda}`;

  const nahlasenychCount = students.filter(s => s.nahlasena_znamka !== null).length;
  const totalCount = students.length;
  const allReported = totalCount > 0 && nahlasenychCount === totalCount;

  if (bannerContainer) {
    bannerContainer.innerHTML = `
      <div class="eval-summary-banner">
        <div>
          <span>📊 <strong>Nahlásené známky od žiakov:</strong> </span>
          <span style="font-weight:700; color:${allReported ? '#10b981' : nahlasenychCount > 0 ? '#f59e0b' : 'var(--text-muted)'};">
            ${nahlasenychCount} z ${totalCount} (${totalCount > 0 ? Math.round((nahlasenychCount / totalCount) * 100) : 0}%)
          </span>
          ${allReported ? '<span style="color:#10b981; margin-left:6px; font-weight:600;">🎉 Všetci žiaci nahlásili!</span>' : ''}
        </div>
        ${nahlasenychCount > 0 ? `
          <button type="button" class="btn" style="padding:4px 8px; font-size:0.75rem; background:rgba(124,58,237,0.2); color:#a78bfa; border:1px solid rgba(124,58,237,0.4);" onclick="fillReportedGradesInEval()">
            ⚡ Predvyplniť nahlásené
          </button>
        ` : ''}
      </div>
    `;
  }

  list.innerHTML = students.map(s => {
    const selectedGrade = s.skutocna_znamka || s.nahlasena_znamka || '';
    return `
      <div class="tipping-student-item">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="user-mini-avatar" style="background:${s.avatar_color || '#7c3aed'};">
            ${getInitials(s.meno, s.priezvisko)}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:6px;">
              <strong>${s.meno} ${s.priezvisko}</strong>
              ${s.nahlasena_znamka ? `
                <span class="badge-pill" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); font-size:0.75rem; padding:2px 6px;">
                  Nahlásil: ${s.nahlasena_znamka}
                </span>
              ` : '<span style="color:var(--text-muted); font-size:0.75rem;">(Nenahlásil)</span>'}
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">Skupina ${s.skupina || 1}</div>
          </div>
        </div>
        <div>
          <select class="form-select eval-grade-select" data-student-id="${s.id}" data-nahlasena="${s.nahlasena_znamka || ''}" style="padding:6px 12px; width:130px;">
            <option value="">Bez známky</option>
            <option value="1" ${selectedGrade == 1 ? 'selected' : ''}>1 (Výborný)</option>
            <option value="2" ${selectedGrade == 2 ? 'selected' : ''}>2 (Chválitebný)</option>
            <option value="3" ${selectedGrade == 3 ? 'selected' : ''}>3 (Dobrý)</option>
            <option value="4" ${selectedGrade == 4 ? 'selected' : ''}>4 (Dostatočný)</option>
            <option value="5" ${selectedGrade == 5 ? 'selected' : ''}>5 (Nedostatočný)</option>
          </select>
        </div>
      </div>
    `;
  }).join('');
};

window.fillReportedGradesInEval = function() {
  document.querySelectorAll('.eval-grade-select').forEach(sel => {
    const nahlasena = sel.dataset.nahlasena;
    if (nahlasena) {
      sel.value = nahlasena;
    }
  });
  showToast('Predvyplnené nahlásené známky žiakov! ⚡', 'info');
};

document.getElementById('btnSubmitEvaluation').addEventListener('click', async () => {
  if (!currentEvalPisomkaId) return;

  const selects = document.querySelectorAll('.eval-grade-select');
  const vysledky = [];

  selects.forEach(sel => {
    const student_id = parseInt(sel.dataset.studentId);
    const znamka = parseInt(sel.value);
    if (znamka >= 1 && znamka <= 5) {
      vysledky.push({ student_id, znamka });
    }
  });

  if (vysledky.length === 0) {
    showToast('Zadaj aspoň jednu známku pre žiaka', 'error');
    return;
  }

  const res = await api(`/api/admin/pisomky/${currentEvalPisomkaId}/vyhodnotit`, {
    method: 'POST',
    body: JSON.stringify({ vysledky })
  });

  if (res) {
    showToast(res.message, 'success');
    closeModal('evaluateModal');
    loadEdupageSubjects();
    loadStats();
    loadAdminPisomky();
  }
});

// ── ADMIN: CREATE PISOMKA MODAL ──────────────────────────────
window.openCreatePisomkaModal = async function(predmetId = null) {
  if (!allPredmetyList || allPredmetyList.length === 0) {
    await loadPredmetyRaw();
  } else {
    populateSubjectDropdowns();
  }

  const select = document.getElementById('newPisomkaPredmet');
  if (predmetId && select) {
    select.value = predmetId;
    handlePredmetChangeInCreate(predmetId);
  }

  // Pre-fill today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('newPisomkaDatum').value = today;

  openModal('createPisomkaModal');
};

document.getElementById('createPisomkaForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const predmet_id = parseInt(document.getElementById('newPisomkaPredmet').value);
  const trieda = document.getElementById('newPisomkaTrieda').value.trim();
  const skupina = parseInt(document.getElementById('newPisomkaSkupina').value);
  const nazov = document.getElementById('newPisomkaNazov').value.trim();
  const datum = document.getElementById('newPisomkaDatum').value;
  const popis = document.getElementById('newPisomkaPopis').value.trim();

  if (!predmet_id || !trieda || !nazov || !datum) {
    showToast('Vyplňte všetky povinné polia', 'error');
    return;
  }

  const res = await api('/api/admin/pisomky', {
    method: 'POST',
    body: JSON.stringify({ predmet_id, trieda, skupina, nazov, datum, popis })
  });

  if (res) {
    showToast(res.message || 'Písomka vytvorená! 🚀', 'success');
    closeModal('createPisomkaModal');
    document.getElementById('createPisomkaForm').reset();
    loadEdupageSubjects();
    loadAdminPisomky();
    loadAdminStats();
  }
});

window.deletePisomka = async function(id) {
  if (!confirm('Naozaj chcete zmazať túto písomku a všetky jej tipy?')) return;
  const res = await api(`/api/admin/pisomky/${id}`, { method: 'DELETE' });
  if (res) {
    showToast('Písomka zmazaná', 'success');
    loadEdupageSubjects();
    loadAdminPisomky();
    loadAdminStats();
  }
};

// ── ADMIN: SUBJECTS MANAGEMENT ───────────────────────────────
window.openAddSubjectModal = function() {
  document.getElementById('addSubjectForm').reset();
  openModal('addSubjectModal');
};

document.getElementById('addSubjectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nazov = document.getElementById('newSubjectNazov').value.trim();
  const ucitel = document.getElementById('newSubjectUcitel').value.trim();
  const has_groups = document.getElementById('newSubjectGroups').checked ? 1 : 0;

  const res = await api('/api/admin/predmety', {
    method: 'POST',
    body: JSON.stringify({ nazov, ucitel, has_groups })
  });

  if (res) {
    showToast('Predmet pridaný! 📚', 'success');
    closeModal('addSubjectModal');
    loadPredmetyRaw();
    loadEdupageSubjects();
    loadAdminSubjects();
    loadAdminStats();
  }
});

window.deleteSubject = async function(id, nazov) {
  if (!confirm(`Naozaj zmazať predmet "${nazov}"?`)) return;
  const res = await api(`/api/admin/predmety/${id}`, { method: 'DELETE' });
  if (res) {
    showToast('Predmet zmazaný', 'success');
    loadPredmetyRaw();
    loadEdupageSubjects();
    loadAdminSubjects();
    loadAdminStats();
  }
};

// ── ADMIN PANEL TABS & SUBVIEWS ──────────────────────────────
function setupAdminTabs() {
  const tabPisomkyBtn = document.getElementById('adminTabPisomkyBtn');
  const tabClassesBtn = document.getElementById('adminTabClassesBtn');
  const tabSubjectsBtn = document.getElementById('adminTabSubjectsBtn');
  const tabTicketyBtn = document.getElementById('adminTabTicketyBtn');

  const viewPisomky = document.getElementById('adminViewPisomky');
  const viewClasses = document.getElementById('adminViewClasses');
  const viewSubjects = document.getElementById('adminViewSubjects');
  const viewTickety = document.getElementById('adminViewTickety');

  if (!tabPisomkyBtn) return;

  function resetAdminTabs() {
    tabPisomkyBtn.classList.remove('active');
    tabClassesBtn.classList.remove('active');
    tabSubjectsBtn.classList.remove('active');
    if (tabTicketyBtn) tabTicketyBtn.classList.remove('active');

    viewPisomky.style.display = 'none';
    viewClasses.style.display = 'none';
    viewSubjects.style.display = 'none';
    if (viewTickety) viewTickety.style.display = 'none';
  }

  tabPisomkyBtn.addEventListener('click', () => {
    resetAdminTabs();
    tabPisomkyBtn.classList.add('active');
    viewPisomky.style.display = 'block';
    loadAdminPisomky();
  });

  tabClassesBtn.addEventListener('click', () => {
    resetAdminTabs();
    tabClassesBtn.classList.add('active');
    viewClasses.style.display = 'block';
    loadAdminClasses();
  });

  tabSubjectsBtn.addEventListener('click', () => {
    resetAdminTabs();
    tabSubjectsBtn.classList.add('active');
    viewSubjects.style.display = 'block';
    loadAdminSubjects();
  });

  if (tabTicketyBtn) {
    tabTicketyBtn.addEventListener('click', () => {
      resetAdminTabs();
      tabTicketyBtn.classList.add('active');
      viewTickety.style.display = 'block';
      loadAdminTickets();
    });
  }
}

function setupAdminForms() {}

async function loadAdminStats() {
  const stats = await api('/api/admin/stats');
  if (!stats) return;

  document.getElementById('adminStatUsers').textContent = stats.totalUsers;
  document.getElementById('adminStatPredmety').textContent = stats.totalPredmety;
  document.getElementById('adminStatPisomky').textContent = stats.activePisomky;
  document.getElementById('adminStatTipy').textContent = stats.totalTipy;

  const pendingEl = document.getElementById('adminStatPendingTickets');
  if (pendingEl) pendingEl.textContent = stats.pendingTickety || 0;

  const tabTicketyBtn = document.getElementById('adminTabTicketyBtn');
  if (tabTicketyBtn) {
    tabTicketyBtn.innerHTML = `🎫 Žiadosti Žiakov ${stats.pendingTickety > 0 ? '<span class="badge-pill" style="background:#f59e0b; color:#000; font-size:0.7rem; padding:2px 6px; margin-left:4px;">' + stats.pendingTickety + '</span>' : ''}`;
  }
}

// Admin: Load Pisomky
async function loadAdminPisomky() {
  const container = document.getElementById('adminPisomkyList');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Načítavam...</p></div>';

  const allPisomky = await api('/api/admin/pisomky') || [];

  if (allPisomky.length === 0) {
    container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Zatiaľ nie sú vytvorené žiadne písomky.</p></div>';
    return;
  }

  container.innerHTML = allPisomky.map(p => {
    const isAllReported = p.pocet_ziakov > 0 && p.pocet_nahlasenych >= p.pocet_ziakov;
    const isPartial = p.pocet_nahlasenych > 0 && !isAllReported;

    return `
      <div class="pisomka-card">
        <div class="pisomka-info">
          <h4>${p.nazov}</h4>
          <div class="pisomka-meta">
            <span>📚 ${p.predmet_nazov}</span>
            <span>📅 ${formatDate(p.datum)}</span>
            <span>👥 Trieda ${p.trieda} (Skupina ${p.skupina || 'Celá'})</span>
            <span>🎯 ${p.pocet_tipov || 0} tipov</span>
            <span>${p.stav === 'active' ? '<span style="color:#10b981;">🟢 Otvorené tipovanie</span>' : '<span style="color:#888;">🏁 Vyhodnotená</span>'}</span>
            ${p.stav === 'active' ? `
              <span class="badge-pill" style="${isAllReported ? 'background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4);' : isPartial ? 'background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid rgba(245,158,11,0.4);' : 'background:rgba(255,255,255,0.06); color:var(--text-muted);'} font-size:0.75rem;">
                ${isAllReported ? '🎉 Všetci žiaci nahlásili známky (' + p.pocet_nahlasenych + '/' + p.pocet_ziakov + ')' :
                  isPartial ? '⏳ Nahlásené známky: ' + p.pocet_nahlasenych + '/' + p.pocet_ziakov :
                  '📝 Nahlásených známok: 0/' + (p.pocet_ziakov || 0)}
              </span>
            ` : ''}
          </div>
        </div>
        <div class="pisomka-actions">
          <button class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem;" onclick="openEvaluateModal(${p.id})">
            ${isAllReported ? '⚡ Skontrolovať & Vyhodnotiť' : '📝 Zadať známky & Vyhodnotiť'}
          </button>
          <button class="btn" style="padding:6px 10px; font-size:0.8rem; background:rgba(244,63,94,0.15); color:#f43f5e; border:1px solid rgba(244,63,94,0.3);" onclick="deletePisomka(${p.id})">
            Zmazať
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Admin: Load Classes & Groups (Accordion)
async function loadAdminClasses() {
  const container = document.getElementById('adminClassesContainer');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Načítavam triedy a skupiny...</p></div>';

  const classesMap = await api('/api/admin/users/by-class') || {};
  const classNames = Object.keys(classesMap);

  if (classNames.length === 0) {
    container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Žiadni žiaci v databáze.</p></div>';
    return;
  }

  container.innerHTML = classNames.map(cls => {
    const data = classesMap[cls];
    const sk1 = data.skupina1 || [];
    const sk2 = data.skupina2 || [];
    const totalCount = sk1.length + sk2.length;
    const isOpen = totalCount > 0;

    return `
      <div class="class-accordion" id="class-box-${cls}">
        <div class="class-accordion-header" onclick="toggleClassBox('${cls}')" style="cursor:pointer;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.1rem; font-weight:700;">🏫 Trieda ${cls}</span>
            <span class="chip" style="font-size:0.75rem; padding:3px 8px; ${totalCount > 0 ? 'background:rgba(124,58,237,0.2); color:#a78bfa; border-color:rgba(124,58,237,0.4);' : ''}">
              ${totalCount} ${totalCount === 1 ? 'žiak' : (totalCount >= 2 && totalCount <= 4) ? 'žiaci' : 'žiakov'}
            </span>
          </div>
          <span style="font-size:0.85rem; color:var(--text-secondary);" id="class-arrow-${cls}">${isOpen ? '▲ Zbaliť' : '▼ Rozbaliť'}</span>
        </div>

        <div class="class-accordion-body" id="class-body-${cls}" style="display: ${isOpen ? 'grid' : 'none'};">
          ${totalCount === 0 ? `
            <div style="grid-column: 1 / -1; padding: 14px; color: var(--text-muted); font-size: 0.85rem; text-align: center; background: rgba(255,255,255,0.01); border-radius: var(--radius-sm);">
              V triede ${cls} zatiaľ nie sú registrovaní žiadni žiaci. Noví žiaci sa môžu do nej zaregistrovať.
            </div>
          ` : `
            <!-- Skupina 1 Column -->
            <div class="group-column">
              <div class="group-column-header">
                <span style="color:#06b6d4;">🟦 Skupina 1 (${sk1.length} žiakov)</span>
              </div>
              ${sk1.length === 0 ? '<p style="font-size:0.8rem; color:var(--text-muted);">Prázdna skupina</p>' : ''}
              ${sk1.map(u => `
                <div class="group-student-card">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div class="user-mini-avatar" style="width:28px; height:28px; font-size:0.75rem; background:${u.avatar_color || '#7c3aed'};">
                      ${getInitials(u.meno, u.priezvisko)}
                    </div>
                    <div>
                      <strong>${u.meno} ${u.priezvisko}</strong>
                      ${u.is_admin ? '<span style="color:#ec4899; font-size:0.7rem; font-weight:700;"> 👑</span>' : ''}
                    </div>
                  </div>
                  <div style="display:flex; align-items:center;">
                    <button class="btn" style="padding:4px 8px; font-size:0.75rem; background:rgba(6,182,212,0.15); color:#06b6d4; border:1px solid rgba(6,182,212,0.3);" onclick="moveUserGroup(${u.id}, 2)">
                      Presunúť do Sk. 2 ➔
                    </button>
                    ${u.id !== currentUser.id ? `
                      <button class="btn" style="padding:4px 7px; font-size:0.75rem; background:rgba(244,63,94,0.15); color:#f43f5e; border:1px solid rgba(244,63,94,0.3); margin-left:4px;" onclick="adminDeleteUser(${u.id}, '${u.meno} ${u.priezvisko}')" title="Zmazať používateľa">
                        🗑️
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Skupina 2 Column -->
            <div class="group-column">
              <div class="group-column-header">
                <span style="color:#10b981;">🟩 Skupina 2 (${sk2.length} žiakov)</span>
              </div>
              ${sk2.length === 0 ? '<p style="font-size:0.8rem; color:var(--text-muted);">Prázdna skupina</p>' : ''}
              ${sk2.map(u => `
                <div class="group-student-card">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div class="user-mini-avatar" style="width:28px; height:28px; font-size:0.75rem; background:${u.avatar_color || '#7c3aed'};">
                      ${getInitials(u.meno, u.priezvisko)}
                    </div>
                    <div>
                      <strong>${u.meno} ${u.priezvisko}</strong>
                      ${u.is_admin ? '<span style="color:#ec4899; font-size:0.7rem; font-weight:700;"> 👑</span>' : ''}
                    </div>
                  </div>
                  <div style="display:flex; align-items:center;">
                    <button class="btn" style="padding:4px 8px; font-size:0.75rem; background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);" onclick="moveUserGroup(${u.id}, 1)">
                      ⬅ Presunúť do Sk. 1
                    </button>
                    ${u.id !== currentUser.id ? `
                      <button class="btn" style="padding:4px 7px; font-size:0.75rem; background:rgba(244,63,94,0.15); color:#f43f5e; border:1px solid rgba(244,63,94,0.3); margin-left:4px;" onclick="adminDeleteUser(${u.id}, '${u.meno} ${u.priezvisko}')" title="Zmazať používateľa">
                        🗑️
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

window.toggleClassBox = function(cls) {
  const body = document.getElementById(`class-body-${cls}`);
  const arrow = document.getElementById(`class-arrow-${cls}`);
  if (body) {
    const isClosed = body.style.display === 'none';
    body.style.display = isClosed ? 'grid' : 'none';
    if (arrow) arrow.textContent = isClosed ? '▲ Zbaliť' : '▼ Rozbaliť';
  }
};

window.adminDeleteUser = async function(userId, name) {
  if (!confirm(`Naozaj chcete natrvalo zmazať žiaka ${name}?`)) return;
  const res = await api(`/api/admin/users/${userId}`, { method: 'DELETE' });
  if (res) {
    showToast(res.message || 'Žiak bol zmazaný', 'success');
    loadAdminClasses();
    loadAdminStats();
    loadStats();
  }
};

window.moveUserGroup = async function(userId, targetGroup) {
  const res = await api(`/api/admin/users/${userId}/skupina`, {
    method: 'PUT',
    body: JSON.stringify({ skupina: targetGroup })
  });

  if (res) {
    showToast(res.message, 'success');
    loadAdminClasses();
    if (userId === currentUser.id) {
      currentUser.skupina = targetGroup;
      updateUserInfo();
    }
  }
};

// Admin: Load Subjects Table
async function loadAdminSubjects() {
  const table = document.getElementById('adminSubjectsTable');
  table.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Načítavam...</p></div>';

  const predmety = await api('/api/predmety') || [];

  table.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:0.9rem; text-align:left;">
        <thead>
          <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); font-size:0.8rem; text-transform:uppercase;">
            <th style="padding:10px 14px;">Predmet</th>
            <th style="padding:10px 14px;">Učiteľ</th>
            <th style="padding:10px 14px;">Skupiny</th>
            <th style="padding:10px 14px; text-align:right;">Akcie</th>
          </tr>
        </thead>
        <tbody>
          ${predmety.map(p => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
              <td style="padding:10px 14px; font-weight:600;">${p.nazov}</td>
              <td style="padding:10px 14px; color:var(--text-secondary);">${p.ucitel || '-'}</td>
              <td style="padding:10px 14px;">
                ${p.has_groups ? '<span class="badge-groups-tag">2 skupiny</span>' : '<span style="color:var(--text-muted); font-size:0.8rem;">Celá trieda</span>'}
              </td>
              <td style="padding:10px 14px; text-align:right;">
                <button onclick="deleteSubject(${p.id}, '${p.nazov}')" class="btn" style="padding:4px 8px; font-size:0.75rem; background:rgba(244,63,94,0.15); color:#f43f5e; border:1px solid rgba(244,63,94,0.3);">
                  Zmazať
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── MY TIPS SECTION ──────────────────────────────────────────
async function loadMyTips() {
  const container = document.getElementById('myTipsList');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Načítavam...</p></div>';

  const tips = await api('/api/tipy/moje') || [];

  if (tips.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <p class="empty-state-text">Zatiaľ nemáš žiadne tipy. Choď do sekcie "Tipovať predmety"!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tips.map(tip => {
    const hasResult = tip.skutocna_znamka !== null;
    const isCorrect = hasResult && tip.predpovedana_znamka === tip.skutocna_znamka;
    const isClose = hasResult && Math.abs(tip.predpovedana_znamka - tip.skutocna_znamka) === 1;

    return `
      <div class="tip-card">
        <div class="tip-card-avatar" style="background:${tip.target_avatar_color || '#7c3aed'};">
          ${getInitials(tip.target_meno, tip.target_priezvisko)}
        </div>
        <div class="tip-card-info">
          <div class="tip-card-name">${tip.target_meno} ${tip.target_priezvisko} (${tip.target_trieda})</div>
          <div class="tip-card-detail">📚 ${tip.predmet_nazov} · <em>${tip.pisomka_nazov}</em> (${formatDate(tip.pisomka_datum)})</div>
        </div>
        <div class="tip-card-grade">
          <span>Tip: <span class="grade-badge-sm ${getGradeClass(tip.predpovedana_znamka)}">${tip.predpovedana_znamka}</span></span>
          ${hasResult ? `
            <span class="tip-card-arrow">→</span>
            <span>Realita: <span class="grade-badge-sm ${getGradeClass(tip.skutocna_znamka)}">${tip.skutocna_znamka}</span></span>
            <span style="font-weight:700; color:${isCorrect ? '#10b981' : isClose ? '#f59e0b' : '#f43f5e'}; margin-left:4px;">
              ${isCorrect ? '+3b 🎯' : isClose ? '+1b 🟡' : '0b ❌'}
            </span>
          ` : '<span style="color:var(--text-muted); font-size:0.8rem; margin-left:6px;">Čaká na vyhodnotenie ⏳</span>'}
        </div>
      </div>
    `;
  }).join('');
}

// ── LEADERBOARD SECTION ──────────────────────────────────────
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Načítavam...</p></div>';

  const data = await api('/api/rebricek') || [];
  if (data.length === 0) {
    container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Rebríček je prázdny</p></div>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];

  container.innerHTML = `
    <div class="leaderboard-header">
      <div>#</div>
      <div>Žiak</div>
      <div style="text-align:center">Tipy</div>
      <div style="text-align:center">Správne</div>
      <div style="text-align:center">Body</div>
    </div>
    ${data.map((user, i) => `
      <div class="leaderboard-row ${user.id === currentUser.id ? 'current-user' : ''}">
        <div class="rank ${i < 3 ? 'rank-' + (i + 1) : ''}">
          ${i < 3 ? medals[i] : i + 1}
        </div>
        <div class="lb-user">
          <div class="lb-avatar" style="background:${user.avatar_color || '#7c3aed'};">
            ${getInitials(user.meno, user.priezvisko)}
          </div>
          <div>
            <div class="lb-name">${user.meno} ${user.priezvisko}</div>
            <div class="lb-class">Trieda ${user.trieda} (Sk. ${user.skupina || 1})</div>
          </div>
        </div>
        <div class="lb-tips">${user.pocet_tipov || 0}</div>
        <div class="lb-correct">${user.spravne_tipy || 0}</div>
        <div class="lb-points">
          <span class="lb-points-value">${user.body || 0}</span>
        </div>
      </div>
    `).join('')}
  `;
}

// ── TICKET SYSTÉM (ŽIADOSTI ŽIAKOV & ADMIN SPRACOVANIE) ───────
window.handleTicketTypeChange = function(type) {
  const classGroup = document.getElementById('ticketClassGroup');
  const groupGroup = document.getElementById('ticketGroupGroup');

  if (type === 'skupina') {
    classGroup.style.display = 'none';
    groupGroup.style.display = 'block';
  } else if (type === 'trieda') {
    classGroup.style.display = 'block';
    groupGroup.style.display = 'none';
  } else if (type === 'trieda_aj_skupina') {
    classGroup.style.display = 'block';
    groupGroup.style.display = 'block';
  } else {
    classGroup.style.display = 'none';
    groupGroup.style.display = 'none';
  }
};

function setupTicketForm() {
  const form = document.getElementById('newTicketForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const typ = document.getElementById('ticketTyp').value;
    const pozadovana_trieda = document.getElementById('ticketPozadovanaTrieda').value;
    const pozadovana_skupina = document.getElementById('ticketPozadovanaSkupina').value;
    const sprava = document.getElementById('ticketSprava').value.trim();

    if (!sprava) {
      showToast('Zadaj dôvod alebo správu k žiadosti', 'error');
      return;
    }

    const res = await api('/api/tickety', {
      method: 'POST',
      body: JSON.stringify({ typ, pozadovana_trieda, pozadovana_skupina, sprava })
    });

    if (res) {
      showToast(res.message || 'Žiadosť odoslaná! 🎫', 'success');
      form.reset();
      handleTicketTypeChange('skupina');
      loadMyTickets();
    }
  });
}

async function loadMyTickets() {
  const container = document.getElementById('myTicketsContainer');
  if (!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Načítavam žiadosti...</p></div>';

  const tickets = await api('/api/tickety/moje') || [];
  if (tickets.length === 0) {
    container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Zatiaľ si neodoslal žiadnu žiadosť.</p></div>';
    return;
  }

  container.innerHTML = tickets.map(t => {
    const isPending = t.stav === 'pending';
    const isApproved = t.stav === 'approved';
    const statusBadge = isPending
      ? '<span class="badge-pill" style="background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid rgba(245,158,11,0.4);">🟡 Čaká na posúdenie</span>'
      : isApproved
      ? '<span class="badge-pill" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4);">🟢 Schválené</span>'
      : '<span class="badge-pill" style="background:rgba(244,63,94,0.2); color:#f43f5e; border:1px solid rgba(244,63,94,0.4);">🔴 Zamietnuté</span>';

    return `
      <div class="tip-card" style="display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <strong style="font-size:0.95rem;">${t.typ === 'skupina' ? 'Zmena skupiny' : t.typ === 'trieda' ? 'Zmena triedy' : t.typ === 'trieda_aj_skupina' ? 'Zmena triedy aj skupiny' : 'Iná žiadosť'}</strong>
          ${statusBadge}
        </div>
        <div style="font-size:0.85rem; color:var(--text-secondary);">
          ${t.pozadovana_trieda ? `<span>Požadovaná trieda: <strong>${t.pozadovana_trieda}</strong></span> ` : ''}
          ${t.pozadovana_skupina ? `<span>Požadovaná skupina: <strong>Skupina ${t.pozadovana_skupina}</strong></span>` : ''}
        </div>
        <div style="font-size:0.85rem; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:6px; width:100%; border:1px solid var(--border);">
          „${t.sprava}“
        </div>
        ${t.odpoved_admina ? `
          <div style="font-size:0.8rem; color:${isApproved ? '#10b981' : '#f43f5e'};">
            <strong>Odpoveď admina:</strong> ${t.odpoved_admina}
          </div>
        ` : ''}
        <div style="font-size:0.75rem; color:var(--text-muted); align-self:flex-end;">
          ${formatDate(t.created_at)}
        </div>
      </div>
    `;
  }).join('');
}

// Admin: Load all tickets
async function loadAdminTickets() {
  const container = document.getElementById('adminTicketsContainer');
  if (!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Načítavam žiadosti...</p></div>';

  const tickets = await api('/api/admin/tickety') || [];
  if (tickets.length === 0) {
    container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Žiadne žiadosti od žiakov.</p></div>';
    return;
  }

  container.innerHTML = tickets.map(t => {
    const isPending = t.stav === 'pending';
    const isApproved = t.stav === 'approved';

    return `
      <div class="tip-card" style="display:flex; flex-direction:column; gap:10px; border-left: 3px solid ${isPending ? '#f59e0b' : isApproved ? '#10b981' : '#f43f5e'};">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="user-mini-avatar" style="width:32px; height:32px; font-size:0.8rem; background:${t.avatar_color || '#7c3aed'};">
              ${getInitials(t.meno, t.priezvisko)}
            </div>
            <div>
              <strong>${t.meno} ${t.priezvisko}</strong> (@${t.username})
              <div style="font-size:0.75rem; color:var(--text-secondary);">Aktuálne: Trieda ${t.aktualna_trieda || '-'}, Skupina ${t.aktualna_skupina || 1}</div>
            </div>
          </div>
          <div>
            ${isPending ? '<span class="badge-pill" style="background:#f59e0b; color:#000;">⏳ Čaká na posúdenie</span>'
              : isApproved ? '<span class="badge-pill" style="background:#10b981; color:#fff;">✅ Schválené</span>'
              : '<span class="badge-pill" style="background:#f43f5e; color:#fff;">❌ Zamietnuté</span>'}
          </div>
        </div>

        <div style="font-size:0.9rem; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:6px; border:1px solid var(--border);">
          <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">
            Požiadavka: ${t.typ === 'skupina' ? 'Zmena skupiny' : t.typ === 'trieda' ? 'Zmena triedy' : t.typ === 'trieda_aj_skupina' ? 'Zmena triedy aj skupiny' : 'Iná žiadosť'}
            ${t.pozadovana_trieda ? ` ➔ Trieda ${t.pozadovana_trieda}` : ''}
            ${t.pozadovana_skupina ? ` ➔ Skupina ${t.pozadovana_skupina}` : ''}
          </div>
          <div style="color:var(--text-secondary); font-size:0.85rem;">Dôvod žiaka: „${t.sprava}“</div>
        </div>

        ${t.odpoved_admina ? `
          <div style="font-size:0.8rem; color:${isApproved ? '#10b981' : '#f43f5e'};">
            <strong>Odpoveď admina:</strong> ${t.odpoved_admina}
          </div>
        ` : ''}

        ${isPending ? `
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
            <button class="btn btn-primary" style="padding:6px 14px; font-size:0.8rem;" onclick="approveTicket(${t.id})">
              ✅ Schváliť a vykonať zmenu
            </button>
            <button class="btn" style="padding:6px 12px; font-size:0.8rem; background:rgba(244,63,94,0.15); color:#f43f5e; border:1px solid rgba(244,63,94,0.3);" onclick="rejectTicket(${t.id})">
              ❌ Zamietnuť
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

window.approveTicket = async function(id) {
  const odpoved = prompt('Voliteľná správa pre žiaka (alebo nechaj predvolenú):', 'Žiadosť bola schválená a zmena vykonaná ✅');
  if (odpoved === null) return;

  const res = await api(`/api/admin/tickety/${id}/approve`, {
    method: 'PUT',
    body: JSON.stringify({ odpoved })
  });

  if (res) {
    showToast(res.message, 'success');
    loadAdminTickets();
    loadAdminStats();
    loadAdminClasses();
  }
};

window.rejectTicket = async function(id) {
  const odpoved = prompt('Dôvod zamietnutia žiadosti pre žiaka:', 'Bohužiaľ, z kapacitných dôvodov nie je možné žiadosť schváliť.');
  if (odpoved === null) return;

  const res = await api(`/api/admin/tickety/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ odpoved })
  });

  if (res) {
    showToast('Žiadosť bola zamietnutá', 'info');
    loadAdminTickets();
    loadAdminStats();
  }
};

// ── NAVIGATION ───────────────────────────────────────────────
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.content-section');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = item.dataset.section;

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      sections.forEach(s => s.classList.remove('active'));
      const targetSection = document.getElementById(`section-${sectionId}`);
      if (targetSection) targetSection.classList.add('active');

      switch (sectionId) {
        case 'overview':
          loadStats();
          break;
        case 'tipovanie':
          loadEdupageSubjects();
          break;
        case 'moje-tipy':
          loadMyTips();
          break;
        case 'rebricek':
          loadLeaderboard();
          break;
        case 'profil':
          updateUserInfo();
          break;
        case 'tickety':
          if (!currentUser.is_admin) {
            showToast('Táto sekcia je zatiaľ dostupná iba pre administrátorov', 'info');
            document.querySelector('[data-section="overview"]').click();
            return;
          }
          loadMyTickets();
          break;
        case 'admin':
          loadAdminStats();
          loadAdminPisomky();
          break;
      }

      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarToggle = document.getElementById('sidebarToggle');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => sidebar.classList.remove('open'));
  }
}

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  });
}

// ── Start on Load ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
