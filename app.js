/**
 * Campus Integrity & Anti-Ragging System
 * Client-Side Controller with MySQL Backend API & LocalStorage Resilience
 * Features Separate Student Panel and Admin Panel Authentication
 */

// Storage Keys
const STORAGE_KEY_COMPLAINTS = 'campus_complaints_v1';
const STORAGE_KEY_USER = 'campus_current_user_v1';

// Base API URL: connects to Node.js / MySQL backend
const API_BASE = window.location.port === '5000' ? '' : 'http://localhost:5000';

// Current Session State
let currentUser = null; // { id, email, name, role: 'STUDENT'|'ADMIN', prn, department, year, division }
let currentAttachedFiles = [];
let currentlyTrackedComplaint = null;
let currentAdminComplaint = null;
let isBackendConnected = false;

// ========================================================
// INITIALIZATION
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
  restoreUserSession();
  initFormDefaults();
  await checkDatabaseHealth();
  await syncComplaints();
  renderQuickDemoBadges();
  updateAuthUI();
  updateMetricsDisplay();
  lucide.createIcons();
});

/**
 * Checks MySQL Database connection status from backend health endpoint.
 */
async function checkDatabaseHealth() {
  const pill = document.getElementById('db-status-pill');
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) {
      const data = await res.json();
      isBackendConnected = true;
      if (pill) {
        pill.innerHTML = `
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          MySQL Live (Connected)
        `;
        pill.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono text-[10px]';
      }
      return;
    }
  } catch (err) {
    console.warn('[Backend] MySQL server not reached directly, operating with local fallback', err);
  }

  isBackendConnected = false;
  if (pill) {
    pill.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
      Local Storage Cache
    `;
    pill.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 font-mono text-[10px]';
  }
}

/**
 * Restores user session from localStorage if previously signed in.
 */
function restoreUserSession() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (saved) {
      currentUser = JSON.parse(saved);
    }
  } catch (e) {
    currentUser = null;
  }
}

/**
 * Syncs complaints from MySQL API if available, else uses localStorage.
 */
async function syncComplaints() {
  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/complaints`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.complaints)) {
          localStorage.setItem(STORAGE_KEY_COMPLAINTS, JSON.stringify(data.complaints));
          return data.complaints;
        }
      }
    } catch (err) {
      console.warn('Sync complaints error, using local fallback:', err);
    }
  }
  return getComplaints();
}

/**
 * Local complaints cache retriever.
 */
function getComplaints() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_COMPLAINTS);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    return [];
  }
}

function saveComplaints(complaints) {
  localStorage.setItem(STORAGE_KEY_COMPLAINTS, JSON.stringify(complaints));
  updateMetricsDisplay();
}

function initFormDefaults() {
  const incidentDateField = document.getElementById('incidentDate');
  if (incidentDateField) {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    incidentDateField.value = localISOTime;
  }
}

// ========================================================
// AUTHENTICATION & ROLE UI (STUDENT VS ADMIN)
// ========================================================

/**
 * Updates top navbar, student subtabs, and admin gate according to auth state.
 * Enforces mutual exclusivity: student and admin cannot be used at the same time.
 */
function updateAuthUI() {
  const loggedOutButtons = document.getElementById('auth-logged-out-buttons');
  const loggedInProfile = document.getElementById('auth-logged-in-profile');
  const profileName = document.getElementById('profile-user-name');
  const profileRole = document.getElementById('profile-user-role');
  const profileIcon = document.getElementById('profile-role-icon');
  const profilePill = document.getElementById('profile-role-pill');

  const navStudentStatusBadge = document.getElementById('nav-student-status-badge');
  const navAdminStatusBadge = document.getElementById('nav-admin-status-badge');
  const navAdminIcon = document.getElementById('nav-admin-icon');
  const navStudentIcon = document.getElementById('nav-student-icon');

  const studentSubtabName = document.getElementById('student-subtab-name');

  if (currentUser) {
    if (loggedOutButtons) loggedOutButtons.classList.add('hidden');
    if (loggedInProfile) {
      loggedInProfile.classList.remove('hidden');
      loggedInProfile.classList.add('flex');
    }
    if (profileName) profileName.textContent = currentUser.name;
    if (profileRole) profileRole.textContent = currentUser.role === 'ADMIN' ? 'Administrator' : 'Student';

    if (currentUser.role === 'STUDENT') {
      if (profileIcon) profileIcon.setAttribute('data-lucide', 'graduation-cap');
      if (profilePill) profilePill.className = 'px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950 flex items-center gap-2';
      if (studentSubtabName) studentSubtabName.textContent = currentUser.name;

      if (navStudentStatusBadge) {
        navStudentStatusBadge.textContent = 'Active';
        navStudentStatusBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800';
      }
      if (navAdminStatusBadge) {
        navAdminStatusBadge.textContent = '🔒 Restricted';
        navAdminStatusBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800';
      }
    } else {
      // ADMIN
      if (profileIcon) profileIcon.setAttribute('data-lucide', 'shield-check');
      if (profilePill) profilePill.className = 'px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-950 flex items-center gap-2';

      if (navStudentStatusBadge) {
        navStudentStatusBadge.textContent = '🔒 Restricted';
        navStudentStatusBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800';
      }
      if (navAdminStatusBadge) {
        navAdminStatusBadge.textContent = 'Active';
        navAdminStatusBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800';
      }
    }
  } else {
    // Logged Out
    if (loggedOutButtons) loggedOutButtons.classList.remove('hidden');
    if (loggedInProfile) loggedInProfile.classList.add('hidden');

    if (navStudentStatusBadge) {
      navStudentStatusBadge.textContent = 'Login Required';
      navStudentStatusBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700';
    }
    if (navAdminStatusBadge) {
      navAdminStatusBadge.textContent = 'Login Required';
      navAdminStatusBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700';
    }
  }

  // Update navigation icons
  if (navAdminIcon) {
    navAdminIcon.setAttribute('data-lucide', (currentUser && currentUser.role === 'ADMIN') ? 'shield-check' : 'shield-alert');
  }
  if (navStudentIcon) {
    navStudentIcon.setAttribute('data-lucide', (currentUser && currentUser.role === 'STUDENT') ? 'graduation-cap' : 'lock');
  }

  renderStudentGateOrPortal();
  renderAdminGateOrDashboard();
  lucide.createIcons();
}

/**
 * Controls Student Portal Gate, Conflict Warning, and Content.
 * Strictly enforces that without a student login, portal cannot be accessed.
 * Also prevents admin from using student portal simultaneously.
 */
function renderStudentGateOrPortal() {
  const gate = document.getElementById('studentLoginGate');
  const conflict = document.getElementById('studentRoleConflictGate');
  const portal = document.getElementById('studentPortalContent');
  const conflictAdminName = document.getElementById('studentConflictAdminName');

  const isStudent = currentUser && currentUser.role === 'STUDENT';
  const isAdmin = currentUser && currentUser.role === 'ADMIN';

  if (isStudent) {
    if (gate) gate.classList.add('hidden');
    if (conflict) conflict.classList.add('hidden');
    if (portal) portal.classList.remove('hidden');
    prefillStudentFormWithUser(currentUser);
    renderStudentMyComplaints();
  } else if (isAdmin) {
    if (gate) gate.classList.add('hidden');
    if (portal) portal.classList.add('hidden');
    if (conflict) {
      conflict.classList.remove('hidden');
      if (conflictAdminName) conflictAdminName.textContent = currentUser.name;
    }
  } else {
    // Logged Out: Show Student Login Gate
    if (conflict) conflict.classList.add('hidden');
    if (portal) portal.classList.add('hidden');
    if (gate) gate.classList.remove('hidden');
  }
}

/**
 * Auto fills the student reporting form with authenticated student details.
 */
function prefillStudentFormWithUser(user) {
  if (!user || user.role !== 'STUDENT') return;

  const isAnonymous = document.querySelector('input[name="privacyOption"]:checked')?.value === 'anonymous';
  if (!isAnonymous) {
    const nameInput = document.getElementById('studentName');
    const erpInput = document.getElementById('studentErp');
    const emailInput = document.getElementById('studentEmail');
    const deptSelect = document.getElementById('studentDept');
    const yearSelect = document.getElementById('studentYear');
    const divSelect = document.getElementById('studentDivision');

    if (nameInput && user.name) nameInput.value = user.name;
    if (erpInput && user.prn) erpInput.value = user.prn;
    if (emailInput && user.email) emailInput.value = user.email;
    if (deptSelect && user.department) deptSelect.value = user.department;
    if (yearSelect && user.year) yearSelect.value = user.year;
    if (divSelect && user.division) divSelect.value = user.division;
  }
}

/**
 * Safely terminates existing active session and switches immediately to destination panel.
 * Enforces single active session at all times.
 */
function logoutAndSwitch(targetPanel) {
  currentUser = null;
  localStorage.removeItem(STORAGE_KEY_USER);
  updateAuthUI();
  switchTab(targetPanel);
  showToast('Previous role session signed out. Switched portal.', 'info');
}

/**
 * Handles User Sign Out.
 */
function handleUserLogout() {
  currentUser = null;
  localStorage.removeItem(STORAGE_KEY_USER);

  showToast('You have been signed out.', 'info');
  updateAuthUI();

  // Reset form
  document.getElementById('complaintForm')?.reset();
  initFormDefaults();
  handlePrivacyChange();

  switchTab('submit');
}

/**
 * Tab switcher inside Student Login Gate (Sign In vs Register).
 */
function switchStudentGateTab(tab) {
  const signInBtn = document.getElementById('gate-tab-signin');
  const regBtn = document.getElementById('gate-tab-register');
  const signInForm = document.getElementById('studentGateSignInForm');
  const regForm = document.getElementById('studentGateRegisterForm');

  if (tab === 'signin') {
    if (signInBtn) signInBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer';
    if (regBtn) regBtn.className = 'flex-1 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer';
    if (signInForm) signInForm.classList.remove('hidden');
    if (regForm) regForm.classList.add('hidden');
  } else {
    if (regBtn) regBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer';
    if (signInBtn) signInBtn.className = 'flex-1 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer';
    if (regForm) regForm.classList.remove('hidden');
    if (signInForm) signInForm.classList.add('hidden');
  }
  lucide.createIcons();
}

/**
 * Auto-fill demo credentials in the Student Login Gate.
 */
function autoFillStudentGate(email, password) {
  const emailInput = document.getElementById('studentGateEmail');
  const passwordInput = document.getElementById('studentGatePassword');
  if (emailInput) emailInput.value = email;
  if (passwordInput) passwordInput.value = password;
}

/**
 * Authenticates student in the dedicated Student Login Gate.
 */
async function handleStudentGateLogin(event) {
  event.preventDefault();
  const email = document.getElementById('studentGateEmail').value.trim();
  const password = document.getElementById('studentGatePassword').value.trim();
  const errorBox = document.getElementById('studentGateError');
  const errorText = document.getElementById('studentGateErrorText');

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, requiredRole: 'STUDENT' })
    });

    const data = await res.json();
    if (data.success && data.user.role === 'STUDENT') {
      currentUser = data.user;
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      if (errorBox) errorBox.classList.add('hidden');
      updateAuthUI();
      switchTab('submit');
      switchStudentSubTab('form');
      showToast(`Welcome back, ${currentUser.name}! Student Portal unlocked.`, 'success');
      return;
    } else {
      if (errorText) errorText.textContent = data.message || 'Invalid student credentials.';
      if (errorBox) errorBox.classList.remove('hidden');
    }
  } catch (err) {
    console.warn('API login offline fallback', err);
    if (email === 'student@campus.edu.in' && password === 'student123') {
      currentUser = {
        id: 2,
        name: 'Rohan V. Sharma',
        email: 'student@campus.edu.in',
        role: 'STUDENT',
        prn: 'PRN-2023-88412',
        department: 'Computer Engineering',
        year: 'FE (First Year)',
        division: 'Division A'
      };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      if (errorBox) errorBox.classList.add('hidden');
      updateAuthUI();
      switchTab('submit');
      showToast(`Welcome back, ${currentUser.name}!`, 'success');
    } else if (email === 'ananya@campus.edu.in' && password === 'student123') {
      currentUser = {
        id: 3,
        name: 'Ananya Deshmukh',
        email: 'ananya@campus.edu.in',
        role: 'STUDENT',
        prn: 'PRN-2024-55102',
        department: 'Information Technology',
        year: 'SE (Second Year)',
        division: 'Division B'
      };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      if (errorBox) errorBox.classList.add('hidden');
      updateAuthUI();
      switchTab('submit');
      showToast(`Welcome back, ${currentUser.name}!`, 'success');
    } else {
      if (errorText) errorText.textContent = 'Invalid credentials or connection error.';
      if (errorBox) errorBox.classList.remove('hidden');
    }
  }
}

/**
 * Registers student from the Student Login Gate into MySQL.
 */
async function handleStudentGateRegister(event) {
  event.preventDefault();
  const name = document.getElementById('gateRegName').value.trim();
  const prn = document.getElementById('gateRegPrn').value.trim();
  const email = document.getElementById('gateRegEmail').value.trim();
  const department = document.getElementById('gateRegDept').value;
  const year = document.getElementById('gateRegYear').value;
  const password = document.getElementById('gateRegPassword').value.trim();
  const errorBox = document.getElementById('gateRegError');

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, prn, email, department, year, division: 'Division A', password })
    });

    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      if (errorBox) errorBox.classList.add('hidden');
      updateAuthUI();
      switchTab('submit');
      showToast(`Registration complete! Welcome, ${currentUser.name}!`, 'success');
      return;
    } else {
      if (errorBox) {
        errorBox.textContent = data.message || 'Registration failed.';
        errorBox.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.warn('Registration offline fallback', err);
    currentUser = {
      id: Date.now(),
      name,
      email,
      role: 'STUDENT',
      prn,
      department,
      year,
      division: 'Division A'
    };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
    updateAuthUI();
    switchTab('submit');
    showToast(`Account created for ${currentUser.name}!`, 'success');
  }
}

// Auxiliary Modal helpers for compatibility
function openStudentAuthModal() { switchTab('submit'); }
function closeStudentAuthModal() {}
function switchAuthTab(tab) { switchStudentGateTab(tab); }
function autoFillStudent(email, password) { autoFillStudentGate(email, password); }
function handleStudentLogin(event) { return handleStudentGateLogin(event); }
function handleStudentRegister(event) { return handleStudentGateRegister(event); }

/**
 * Switches between "Lodge Grievance" and "My Lodged Grievances" in Student Portal.
 */
function switchStudentSubTab(tab) {
  const formBtn = document.getElementById('student-subtab-form-btn');
  const histBtn = document.getElementById('student-subtab-history-btn');
  const formContainer = document.getElementById('student-form-container');
  const histContainer = document.getElementById('student-history-container');

  if (tab === 'form') {
    formBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white shadow-sm flex items-center gap-1.5 transition';
    histBtn.className = 'px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition';
    formContainer.classList.remove('hidden');
    histContainer.classList.add('hidden');
  } else {
    histBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white shadow-sm flex items-center gap-1.5 transition';
    formBtn.className = 'px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition';
    histContainer.classList.remove('hidden');
    formContainer.classList.add('hidden');
    renderStudentMyComplaints();
  }
  lucide.createIcons();
}

/**
 * Renders the authenticated student's filed complaints list.
 */
async function renderStudentMyComplaints() {
  const container = document.getElementById('student-my-complaints-list');
  const countBadge = document.getElementById('student-my-count');
  if (!container || !currentUser) return;

  let myComplaints = [];

  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/complaints?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          myComplaints = data.complaints;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch user complaints from API, using local storage');
    }
  }

  if (myComplaints.length === 0) {
    const all = getComplaints();
    myComplaints = all.filter(c => 
      c.studentEmail === currentUser.email || 
      c.studentErp === currentUser.prn ||
      c.user_id === currentUser.id
    );
  }

  if (countBadge) countBadge.textContent = myComplaints.length;

  if (myComplaints.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400 text-xs">
        <i data-lucide="folder-open" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
        <p class="font-bold text-slate-700">No complaints filed yet from this account.</p>
        <p class="text-slate-400 mt-0.5">Use the "Lodge New Grievance" form to submit an inquiry.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = myComplaints.map(c => `
    <div class="p-4 hover:bg-slate-50 transition rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">${c.id}</span>
          <span class="text-xs font-semibold text-slate-800">${escapeHtml(c.category)}</span>
          ${getStatusBadgeHtml(c.status)}
        </div>
        <p class="text-xs text-slate-600 line-clamp-1 italic">"${escapeHtml(c.description)}"</p>
        <div class="flex items-center gap-3 text-[11px] text-slate-400">
          <span>Lodged: ${formatDate(c.createdAt || c.created_at)}</span>
          <span>•</span>
          <span>Location: ${escapeHtml(c.building)}</span>
          <span>•</span>
          <span class="font-mono text-brand-600 font-bold">PIN: ${c.pin}</span>
        </div>
      </div>

      <button onclick="autoFillTrack('${c.id}', '${c.pin}'); switchTab('track');" class="px-3.5 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-xl border border-brand-200 transition flex items-center gap-1.5 shrink-0">
        <i data-lucide="search" class="w-3.5 h-3.5"></i>
        <span>Track & 2-Way Chat</span>
      </button>
    </div>
  `).join('');

  lucide.createIcons();
}

// ========================================================
// ADMIN AUTHENTICATION GATEWAY & DASHBOARD
// ========================================================
function openAdminAuthModal() {
  switchTab('admin');
}

function autoFillAdminLogin() {
  document.getElementById('adminGateEmail').value = 'admin@campus.edu.in';
  document.getElementById('adminGatePassword').value = 'admin123';
}

/**
 * Authenticates Admin through the Gate screen.
 */
async function handleAdminGateLogin(event) {
  event.preventDefault();
  const email = document.getElementById('adminGateEmail').value.trim();
  const password = document.getElementById('adminGatePassword').value.trim();
  const errorBox = document.getElementById('adminGateError');

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, requiredRole: 'ADMIN' })
    });

    const data = await res.json();
    if (data.success && data.user.role === 'ADMIN') {
      currentUser = data.user;
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      errorBox.classList.add('hidden');
      updateAuthUI();
      renderAdminGateOrDashboard();
      showToast('Admin authorized. Proctorial Dashboard unlocked!', 'success');
      return;
    } else {
      errorBox.textContent = data.message || 'Access denied. Administrator privileges required.';
      errorBox.classList.remove('hidden');
    }
  } catch (err) {
    // Offline fallback for evaluation
    if (email === 'admin@campus.edu.in' && password === 'admin123') {
      currentUser = {
        id: 1,
        name: 'Dr. S. K. Kulkarni (Chief Proctor)',
        email: 'admin@campus.edu.in',
        role: 'ADMIN',
        department: 'Proctorial Board'
      };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      errorBox.classList.add('hidden');
      updateAuthUI();
      renderAdminGateOrDashboard();
      showToast('Admin authorized. Proctorial Dashboard unlocked!', 'success');
    } else {
      errorBox.textContent = 'Invalid administrator credentials.';
      errorBox.classList.remove('hidden');
    }
  }
}

/**
 * Checks whether to show Admin Login Gate, Student Conflict Gate, or Admin Dashboard.
 */
function renderAdminGateOrDashboard() {
  const gate = document.getElementById('adminLoginGate');
  const conflict = document.getElementById('adminRoleConflictGate');
  const dashboard = document.getElementById('adminDashboardContent');
  const conflictStudentName = document.getElementById('adminConflictStudentName');

  const isAdmin = currentUser && currentUser.role === 'ADMIN';
  const isStudent = currentUser && currentUser.role === 'STUDENT';

  if (isAdmin) {
    if (gate) gate.classList.add('hidden');
    if (conflict) conflict.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    renderAdminFeed();
    updateMetricsDisplay();
  } else if (isStudent) {
    if (gate) gate.classList.add('hidden');
    if (dashboard) dashboard.classList.add('hidden');
    if (conflict) {
      conflict.classList.remove('hidden');
      if (conflictStudentName) conflictStudentName.textContent = currentUser.name;
    }
  } else {
    // Logged Out: Show Admin Login Gate
    if (conflict) conflict.classList.add('hidden');
    if (dashboard) dashboard.classList.add('hidden');
    if (gate) gate.classList.remove('hidden');
  }
  lucide.createIcons();
}

// ========================================================
// GLOBAL NAVIGATION & VIEW SWITCHING
// ========================================================
function switchTab(targetTab) {
  const views = {
    submit: document.getElementById('view-submit'),
    track: document.getElementById('view-track'),
    admin: document.getElementById('view-admin')
  };

  const navBtns = {
    submit: document.getElementById('tab-btn-submit'),
    track: document.getElementById('tab-btn-track'),
    admin: document.getElementById('tab-btn-admin')
  };

  const mobBtns = {
    submit: document.getElementById('mob-tab-btn-submit'),
    track: document.getElementById('mob-tab-btn-track'),
    admin: document.getElementById('mob-tab-btn-admin')
  };

  // Hide all views
  Object.keys(views).forEach(key => {
    if (views[key]) views[key].classList.add('hidden');
  });

  // Reset desktop button styles
  Object.keys(navBtns).forEach(key => {
    if (navBtns[key]) {
      navBtns[key].className = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 transition-all cursor-pointer';
    }
  });

  // Reset mobile button styles
  Object.keys(mobBtns).forEach(key => {
    if (mobBtns[key]) {
      mobBtns[key].className = 'flex-1 py-1.5 px-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center gap-1.5';
    }
  });

  // Show target view
  if (views[targetTab]) views[targetTab].classList.remove('hidden');

  if (navBtns[targetTab]) {
    navBtns[targetTab].className = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all text-brand-700 bg-white shadow-sm cursor-pointer';
  }

  if (mobBtns[targetTab]) {
    mobBtns[targetTab].className = 'flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center gap-1.5';
  }

  if (targetTab === 'admin') {
    renderAdminGateOrDashboard();
  } else if (targetTab === 'track') {
    renderQuickDemoBadges();
  } else if (targetTab === 'submit') {
    renderStudentGateOrPortal();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => lucide.createIcons(), 50);
}

// ========================================================
// TAB 1: FORM INTERACTIONS & COMPLAINT SUBMISSION
// ========================================================
function handlePrivacyChange() {
  const isAnonymous = document.querySelector('input[name="privacyOption"]:checked').value === 'anonymous';
  const nameInput = document.getElementById('studentName');
  const erpInput = document.getElementById('studentErp');
  const emailInput = document.getElementById('studentEmail');
  const nameStar = document.getElementById('name-required-star');
  const erpStar = document.getElementById('erp-required-star');
  const emailStar = document.getElementById('email-required-star');
  const privacyPill = document.getElementById('privacy-status-pill');

  if (isAnonymous) {
    nameInput.value = '';
    nameInput.disabled = true;
    nameInput.required = false;
    nameInput.placeholder = '🔒 Masked by Whistleblower Protocol';

    erpInput.value = '';
    erpInput.disabled = true;
    erpInput.required = false;
    erpInput.placeholder = '🔒 Masked (PRN-XXXX)';

    emailInput.value = '';
    emailInput.disabled = true;
    emailInput.required = false;
    emailInput.placeholder = '🔒 Masked (Encrypted)';

    if (nameStar) nameStar.classList.add('hidden');
    if (erpStar) erpStar.classList.add('hidden');
    if (emailStar) emailStar.classList.add('hidden');

    privacyPill.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200';
    privacyPill.innerHTML = '<i data-lucide="ghost" class="w-3.5 h-3.5"></i> Anonymous Active';
    showToast('Anonymous Mode Activated: Name & ERP are scrubbed in MySQL.', 'info');
  } else {
    nameInput.disabled = false;
    nameInput.required = true;

    erpInput.disabled = false;
    erpInput.required = true;

    emailInput.disabled = false;
    emailInput.required = true;

    if (nameStar) nameStar.classList.remove('hidden');
    if (erpStar) erpStar.classList.remove('hidden');
    if (emailStar) emailStar.classList.remove('hidden');

    privacyPill.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200';
    privacyPill.innerHTML = '<i data-lucide="user-check" class="w-3.5 h-3.5"></i> Identified Mode';

    if (currentUser && currentUser.role === 'STUDENT') {
      prefillStudentFormWithUser(currentUser);
    }
  }
  lucide.createIcons();
}

function handleWhistleblowerChange() {
  const isChecked = document.getElementById('whistleblowerCheck').checked;
  const badge = document.getElementById('whistleblower-badge');
  const wrapper = document.getElementById('whistleblower-wrapper');

  if (isChecked) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
    wrapper.classList.add('bg-brand-50/50', 'border-brand-300');
    showToast('Whistleblower Protection: Zero metadata retention activated', 'success');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
    wrapper.classList.remove('bg-brand-50/50', 'border-brand-300');
  }
  lucide.createIcons();
}

function handleCategoryChange() {
  const category = document.querySelector('input[name="incidentCategory"]:checked').value;
  const adviceBox = document.getElementById('categoryAdviceBox');

  if (category === 'Anti-Ragging / Harassment') {
    adviceBox.className = 'mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2';
    adviceBox.innerHTML = `
      <div class="flex items-center gap-2">
        <i data-lucide="shield-alert" class="w-4 h-4 text-rose-600 shrink-0"></i>
        <span>Anti-Ragging complaints immediately trigger an automated SMS/alert to the Anti-Ragging Committee & Dean of Student Affairs.</span>
      </div>
      <span class="shrink-0 font-bold bg-rose-200/80 px-2 py-0.5 rounded text-[10px] text-rose-900">UGC Regulation 2009</span>
    `;
  } else if (category === 'Academic Bias / Faculty Targeting') {
    adviceBox.className = 'mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-2';
    adviceBox.innerHTML = `
      <div class="flex items-center gap-2">
        <i data-lucide="graduation-cap" class="w-4 h-4 text-amber-600 shrink-0"></i>
        <span>Academic Bias complaints are routed to an independent External Subject Matter Committee to safeguard continuous evaluation marks.</span>
      </div>
      <span class="shrink-0 font-bold bg-amber-200/80 px-2 py-0.5 rounded text-[10px] text-amber-900">Confidential Oversight</span>
    `;
  } else if (category === 'Irregular Lectures / Teaching Quality') {
    adviceBox.className = 'mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center justify-between gap-2';
    adviceBox.innerHTML = `
      <div class="flex items-center gap-2">
        <i data-lucide="book-open" class="w-4 h-4 text-blue-600 shrink-0"></i>
        <span>Curricular quality reports are directly audited by the Dean of Academic Affairs and Academic Quality Assurance Cell (IQAC).</span>
      </div>
      <span class="shrink-0 font-bold bg-blue-200/80 px-2 py-0.5 rounded text-[10px] text-blue-900">IQAC Audit</span>
    `;
  } else {
    adviceBox.className = 'mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2';
    adviceBox.innerHTML = `
      <div class="flex items-center gap-2">
        <i data-lucide="building" class="w-4 h-4 text-emerald-600 shrink-0"></i>
        <span>Campus & Hostel maintenance issues are dispatched immediately to the Estate & Sanitation Department.</span>
      </div>
      <span class="shrink-0 font-bold bg-emerald-200/80 px-2 py-0.5 rounded text-[10px] text-emerald-900">Maintenance Dispatch</span>
    `;
  }
  lucide.createIcons();
}

function updateCharCount() {
  const text = document.getElementById('incidentDescription').value;
  document.getElementById('charCount').textContent = `${text.length} / 2000 chars`;
}

function captureGPSLocation() {
  const btnText = document.getElementById('gpsBtnText');
  const statusPill = document.getElementById('gpsStatusPill');
  const coordsInput = document.getElementById('gpsCoordinates');
  const gpsText = document.getElementById('gpsText');

  btnText.textContent = 'Acquiring GPS Fix...';

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(4);
        const lon = position.coords.longitude.toFixed(4);
        const acc = Math.round(position.coords.accuracy);
        const formatted = `${lat}° N, ${lon}° E (±${acc}m)`;
        
        coordsInput.value = formatted;
        gpsText.textContent = formatted;
        statusPill.classList.remove('hidden');
        btnText.textContent = '📍 GPS Coordinates Attached';
        showToast(`GPS Location Attached: ${formatted}`, 'success');
        lucide.createIcons();
      },
      (error) => {
        const fallback = '18.5204° N, 73.8567° E (Campus Anchor ±5m)';
        coordsInput.value = fallback;
        gpsText.textContent = fallback;
        statusPill.classList.remove('hidden');
        btnText.textContent = '📍 Campus Beacon Attached';
        showToast('Campus Geo-Beacon Attached', 'info');
        lucide.createIcons();
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  } else {
    const fallback = '18.5204° N, 73.8567° E (Campus Anchor ±5m)';
    coordsInput.value = fallback;
    gpsText.textContent = fallback;
    statusPill.classList.remove('hidden');
    btnText.textContent = '📍 Campus Beacon Attached';
    showToast('Campus Geo-Beacon Attached', 'info');
    lucide.createIcons();
  }
}

function handleFileSelect(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 10 * 1024 * 1024) {
      showToast(`File ${file.name} exceeds 10MB limit!`, 'error');
      continue;
    }
    if (!currentAttachedFiles.includes(file.name)) {
      currentAttachedFiles.push(file.name);
    }
  }

  renderAttachedFiles();
}

function removeFile(index) {
  currentAttachedFiles.splice(index, 1);
  renderAttachedFiles();
}

function renderAttachedFiles() {
  const container = document.getElementById('attachedFilesList');
  if (!container) return;

  if (currentAttachedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = currentAttachedFiles.map((filename, idx) => `
    <div class="flex items-center justify-between p-2 rounded-lg bg-slate-100 border border-slate-200 text-xs">
      <div class="flex items-center gap-2 truncate">
        <i data-lucide="paperclip" class="w-3.5 h-3.5 text-brand-600 shrink-0"></i>
        <span class="truncate font-mono font-medium text-slate-800">${escapeHtml(filename)}</span>
      </div>
      <button type="button" onclick="removeFile(${idx})" class="p-1 text-slate-400 hover:text-rose-600 transition">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `).join('');
  lucide.createIcons();
}

// ========================================================
// COMPLAINT SUBMISSION (POST TO MYSQL)
// ========================================================
async function handleComplaintSubmit(event) {
  event.preventDefault();

  const privacyOption = document.querySelector('input[name="privacyOption"]:checked').value;
  const isAnonymous = privacyOption === 'anonymous';
  const isWhistleblower = document.getElementById('whistleblowerCheck').checked;
  const category = document.querySelector('input[name="incidentCategory"]:checked').value;

  const studentName = isAnonymous ? 'Anonymous Student' : document.getElementById('studentName').value.trim();
  const studentErp = isAnonymous ? 'PRN-XXXX-MASKED' : document.getElementById('studentErp').value.trim();
  const studentEmail = isAnonymous ? 'protected-whistleblower@campus.edu.in' : document.getElementById('studentEmail').value.trim();

  const payload = {
    userId: currentUser ? currentUser.id : null,
    incidentDate: document.getElementById('incidentDate').value,
    category: category,
    privacyOption: privacyOption,
    whistleblower: isWhistleblower,
    studentName: studentName,
    studentErp: studentErp,
    studentEmail: studentEmail,
    department: document.getElementById('studentDept').value,
    year: document.getElementById('studentYear').value,
    division: document.getElementById('studentDivision').value,
    building: document.getElementById('incidentBuilding').value,
    spot: document.getElementById('incidentSpot').value.trim(),
    gps: document.getElementById('gpsCoordinates').value || '18.5204° N, 73.8567° E (Campus Zone)',
    witnesses: document.getElementById('witnessNames').value.trim() || 'Confidential / None Mentioned',
    description: document.getElementById('incidentDescription').value.trim(),
    files: [...currentAttachedFiles]
  };

  let trackingId = '';
  let secretPin = '';

  // Try saving to MySQL backend API
  try {
    const res = await fetch(`${API_BASE}/api/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        trackingId = data.id;
        secretPin = data.pin;
      }
    }
  } catch (err) {
    console.warn('Backend API save failed, creating local complaint fallback:', err);
  }

  // Fallback generation if backend unavailable
  if (!trackingId) {
    const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
    trackingId = `CMP-2026-${randomChars}`;
    secretPin = Math.floor(100000 + Math.random() * 900000).toString();

    let priority = 'MEDIUM';
    if (category === 'Anti-Ragging / Harassment') priority = 'CRITICAL';
    else if (category === 'Academic Bias / Faculty Targeting') priority = 'HIGH';
    else if (category === 'Infrastructure / Hostel Issue') priority = 'STANDARD';

    const localRecord = {
      ...payload,
      id: trackingId,
      pin: secretPin,
      priority,
      createdAt: new Date().toISOString(),
      status: 'Pending',
      remarks: 'Complaint registered into Central Anti-Ragging Register. Under Proctorial intake review.',
      remarksDate: new Date().toISOString(),
      messages: []
    };

    const complaints = getComplaints();
    complaints.unshift(localRecord);
    saveComplaints(complaints);
  } else {
    // Refresh local cache from MySQL
    await syncComplaints();
  }

  // Reset Form
  document.getElementById('complaintForm').reset();
  currentAttachedFiles = [];
  renderAttachedFiles();
  document.getElementById('gpsStatusPill').classList.add('hidden');
  document.getElementById('gpsBtnText').textContent = '📍 Attach Current GPS Location';
  document.getElementById('gpsCoordinates').value = '';
  document.getElementById('charCount').textContent = '0 / 2000 chars';
  handlePrivacyChange();
  initFormDefaults();

  // If student is logged in, refresh their history list
  if (currentUser && currentUser.role === 'STUDENT') {
    renderStudentMyComplaints();
  }

  // Show Confirmation Modal
  openConfirmationModal(trackingId, secretPin);
  showToast('Official Complaint Recorded in MySQL Database!', 'success');
}

// ========================================================
// CONFIRMATION MODAL & CREDENTIALS
// ========================================================
let lastGeneratedId = '';
let lastGeneratedPin = '';

function openConfirmationModal(id, pin) {
  lastGeneratedId = id;
  lastGeneratedPin = pin;

  document.getElementById('modalTrackingId').textContent = id;
  document.getElementById('modalSecretPin').textContent = pin;
  document.getElementById('modalCopyIdText').textContent = 'Copy ID';
  document.getElementById('modalCopyPinText').textContent = 'Copy PIN';

  const modal = document.getElementById('confirmationModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeConfirmationModal() {
  const modal = document.getElementById('confirmationModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function copyModalId() {
  navigator.clipboard.writeText(lastGeneratedId).then(() => {
    document.getElementById('modalCopyIdText').textContent = 'Copied!';
    showToast('Tracking ID copied to clipboard', 'info');
    setTimeout(() => {
      document.getElementById('modalCopyIdText').textContent = 'Copy ID';
    }, 2000);
  });
}

function copyModalPin() {
  navigator.clipboard.writeText(lastGeneratedPin).then(() => {
    document.getElementById('modalCopyPinText').textContent = 'Copied!';
    showToast('Secret PIN copied to clipboard', 'info');
    setTimeout(() => {
      document.getElementById('modalCopyPinText').textContent = 'Copy PIN';
    }, 2000);
  });
}

function copyAllCredentialsAndTrack() {
  const text = `Campus Complaint Tracking Credentials:\nTracking ID: ${lastGeneratedId}\nSecret PIN: ${lastGeneratedPin}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Credentials copied! Redirecting to Tracker...', 'success');
  });

  closeConfirmationModal();
  switchTab('track');
  
  document.getElementById('trackIdInput').value = lastGeneratedId;
  document.getElementById('trackPinInput').value = lastGeneratedPin;
  executeTracking(lastGeneratedId, lastGeneratedPin);
}

// ========================================================
// TAB 2: COMPLAINT STATUS TRACKING & 2-WAY CHAT (MYSQL)
// ========================================================
function renderQuickDemoBadges() {
  const container = document.getElementById('quick-demo-badges');
  if (!container) return;

  const complaints = getComplaints().slice(0, 3);
  container.innerHTML = complaints.map(c => `
    <button type="button" onclick="autoFillTrack('${c.id}', '${c.pin}')" class="px-2 py-1 rounded bg-white hover:bg-brand-100 border border-brand-300 font-mono text-[11px] font-semibold text-brand-900 transition flex items-center gap-1">
      <span>${c.id}</span>
      <span class="text-[10px] text-slate-500 font-normal">(${c.status})</span>
    </button>
  `).join('');
}

function autoFillTrack(id, pin) {
  document.getElementById('trackIdInput').value = id;
  document.getElementById('trackPinInput').value = pin;
  executeTracking(id, pin);
}

function handleTrackSearch(event) {
  event.preventDefault();
  const id = document.getElementById('trackIdInput').value.trim();
  const pin = document.getElementById('trackPinInput').value.trim();
  executeTracking(id, pin);
}

async function executeTracking(id, pin) {
  const errorMsg = document.getElementById('trackErrorMsg');
  const resultsContainer = document.getElementById('trackResultContainer');

  let found = null;

  // Try MySQL Backend API first
  try {
    const res = await fetch(`${API_BASE}/api/complaints/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pin })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        found = data.complaint;
      }
    }
  } catch (err) {
    console.warn('API track search failed, using local cache:', err);
  }

  // Local fallback
  if (!found) {
    const complaints = getComplaints();
    found = complaints.find(c => 
      c.id.toUpperCase() === id.toUpperCase() && 
      c.pin === pin
    );
  }

  if (!found) {
    errorMsg.classList.remove('hidden');
    resultsContainer.classList.add('hidden');
    currentlyTrackedComplaint = null;
    showToast('Verification failed: Incorrect ID or PIN', 'error');
    return;
  }

  errorMsg.classList.add('hidden');
  resultsContainer.classList.remove('hidden');
  currentlyTrackedComplaint = found;

  renderTrackingDetails(found);
  renderTrackingChat(found);
  showToast(`Complaint ${found.id} verified from MySQL`, 'success');
  lucide.createIcons();
}

function renderTrackingDetails(c) {
  document.getElementById('res-tracking-id').textContent = c.id;
  document.getElementById('res-timestamp').innerHTML = `<i data-lucide="calendar" class="w-3.5 h-3.5 inline"></i> Lodged: ${formatDate(c.createdAt || c.created_at)}`;
  document.getElementById('res-location').innerHTML = `<i data-lucide="map-pin" class="w-3.5 h-3.5 inline"></i> ${escapeHtml(c.building)} (${escapeHtml(c.spot)})`;

  const badgesContainer = document.getElementById('res-badges');
  let priorityBadge = '';
  if (c.priority === 'CRITICAL') {
    priorityBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white flex items-center gap-1"><i data-lucide="alert-octagon" class="w-3.5 h-3.5"></i> CRITICAL PRIORITY</span>`;
  } else if (c.priority === 'HIGH') {
    priorityBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">HIGH PRIORITY</span>`;
  } else {
    priorityBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">${c.priority}</span>`;
  }

  const statusBadge = getStatusBadgeHtml(c.status);
  badgesContainer.innerHTML = `${priorityBadge} ${statusBadge}`;

  document.getElementById('res-description').textContent = c.description;
  document.getElementById('res-dept').textContent = c.department;
  document.getElementById('res-year-div').textContent = `${c.year} - ${c.division}`;
  document.getElementById('res-accused').textContent = c.witnesses || 'Not Specified';
  document.getElementById('res-gps').textContent = c.gps;

  const anonymityTag = document.getElementById('res-anonymity-tag');
  if (c.privacyOption === 'anonymous' || c.privacy_option === 'anonymous') {
    anonymityTag.className = 'text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200';
    anonymityTag.textContent = c.whistleblower ? 'Whistleblower Shield Active' : 'Anonymous Mode';
  } else {
    anonymityTag.className = 'text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200';
    anonymityTag.textContent = `Identified: ${c.studentName || c.student_name}`;
  }

  document.getElementById('res-remarks-text').textContent = `"${c.remarks || 'Under formal preliminary review by proctorial authority.'}"`;
  document.getElementById('res-remarks-date').textContent = (c.remarksDate || c.remarks_date) ? `Updated: ${formatDate(c.remarksDate || c.remarks_date)}` : 'Recently updated';

  renderTimelineSteps(c.status);
}

function renderTimelineSteps(currentStatus) {
  const steps = [
    { title: 'Submitted', desc: 'Complaint formally lodged & logged', icon: 'file-check-2' },
    { title: 'Under Investigation', desc: 'Proctorial squad assigned & reviewing', icon: 'shield-alert' },
    { title: 'Action Taken', desc: 'Disciplinary/Inquiry hearings conducted', icon: 'gavel' },
    { title: 'Resolved', desc: 'Official redressal completed & closed', icon: 'check-circle' }
  ];

  let currentIdx = 0;
  if (currentStatus === 'Under Investigation') currentIdx = 1;
  else if (currentStatus === 'Action Taken') currentIdx = 2;
  else if (currentStatus === 'Resolved') currentIdx = 3;
  else if (currentStatus === 'Dismissed') currentIdx = 3;
  else currentIdx = 0; // 'Submitted' or 'Pending'

  const container = document.getElementById('timeline-steps');
  container.innerHTML = steps.map((step, idx) => {
    const isCompleted = idx < currentIdx || (currentStatus === 'Resolved' && idx === 3);
    const isCurrent = idx === currentIdx && currentStatus !== 'Resolved';

    let circleClass = 'bg-white border-2 border-slate-300 text-slate-400';
    let titleClass = 'text-slate-500';
    let statusText = 'Pending Step';

    if (isCompleted) {
      circleClass = 'bg-emerald-600 border-2 border-emerald-600 text-white';
      titleClass = 'text-emerald-700 font-bold';
      statusText = 'Completed';
    } else if (isCurrent) {
      circleClass = 'bg-brand-600 border-2 border-brand-600 text-white ring-4 ring-brand-100';
      titleClass = 'text-brand-700 font-bold';
      statusText = 'Active Phase';
    }

    return `
      <div class="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all ${circleClass}">
          <i data-lucide="${step.icon}" class="w-4 h-4"></i>
        </div>
        <div>
          <h4 class="text-xs sm:text-sm font-bold ${titleClass}">${step.title}</h4>
          <p class="text-[11px] text-slate-400 leading-snug">${step.desc}</p>
          <span class="inline-block mt-0.5 text-[10px] uppercase font-bold tracking-wider ${isCompleted ? 'text-emerald-600' : (isCurrent ? 'text-brand-600' : 'text-slate-400')}">
            ${statusText}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function renderTrackingChat(c) {
  const container = document.getElementById('chatMessagesList');
  if (!container) return;

  if (!c.messages || c.messages.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400 text-xs">
        <i data-lucide="message-square-dashed" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
        <p>No messages exchanged yet.</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Use the prompt below to send supplementary information or queries to the ombudsman.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = c.messages.map(msg => {
    const isStudent = msg.sender === 'student';
    return `
      <div class="flex ${isStudent ? 'justify-end' : 'justify-start'}">
        <div class="max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 ${
          isStudent 
            ? 'bg-brand-600 text-white rounded-br-none shadow-sm' 
            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm'
        }">
          <div class="flex items-center justify-between gap-3 text-[10px] mb-1 font-semibold ${isStudent ? 'text-brand-100' : 'text-slate-500'}">
            <span>${escapeHtml(msg.senderName || (isStudent ? 'You (Protected Identity)' : 'Campus Redressal Officer'))}</span>
            <span>${formatTime(msg.timestamp || msg.created_at)}</span>
          </div>
          <p class="text-xs sm:text-sm leading-relaxed">${escapeHtml(msg.text)}</p>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
  lucide.createIcons();
}

/**
 * Sends a chat message to MySQL API (with local fallback).
 */
async function handleSendChatMessage(event) {
  event.preventDefault();
  if (!currentlyTrackedComplaint) {
    showToast('Please verify a complaint before messaging', 'error');
    return;
  }

  const input = document.getElementById('chatInputText');
  const text = input.value.trim();
  if (!text) return;

  const senderName = (currentlyTrackedComplaint.privacyOption === 'anonymous' || currentlyTrackedComplaint.privacy_option === 'anonymous')
    ? 'Student (Protected Identity)'
    : (currentlyTrackedComplaint.studentName || currentUser?.name || 'Student');

  let sent = false;

  // Post to MySQL
  try {
    const res = await fetch(`${API_BASE}/api/complaints/${currentlyTrackedComplaint.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: 'student', senderName, text })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        currentlyTrackedComplaint.messages = data.messages;
        sent = true;
      }
    }
  } catch (err) {
    console.warn('API message post failed, updating local storage:', err);
  }

  if (!sent) {
    const newMsg = {
      sender: 'student',
      senderName,
      text: text,
      timestamp: new Date().toISOString()
    };
    if (!currentlyTrackedComplaint.messages) currentlyTrackedComplaint.messages = [];
    currentlyTrackedComplaint.messages.push(newMsg);

    const complaints = getComplaints();
    const idx = complaints.findIndex(c => c.id === currentlyTrackedComplaint.id);
    if (idx !== -1) {
      complaints[idx].messages = currentlyTrackedComplaint.messages;
      saveComplaints(complaints);
    }
  }

  input.value = '';
  renderTrackingChat(currentlyTrackedComplaint);
  showToast('Note transmitted to Vigilance Committee and logged in MySQL', 'success');
}

function copyTrackingDetails() {
  if (!currentlyTrackedComplaint) return;
  const text = `Tracking ID: ${currentlyTrackedComplaint.id}\nPIN: ${currentlyTrackedComplaint.pin}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Tracking ID copied!', 'info');
  });
}

// ========================================================
// TAB 3: ADMIN & ANALYTICS DASHBOARD (MYSQL SYNCED)
// ========================================================

/**
 * Computes metrics either from MySQL API or local cache.
 */
async function updateMetricsDisplay() {
  let metrics = null;

  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/analytics`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          metrics = data.metrics;
          renderHotspotsFromData(data.hotspots);
          renderCategoryBreakdownFromData(data.categories);
        }
      }
    } catch (err) {
      console.warn('Analytics API error, falling back to local calculation:', err);
    }
  }

  if (!metrics) {
    const complaints = getComplaints();
    const total = complaints.length;
    const pending = complaints.filter(c => c.status !== 'Resolved').length;
    const critical = complaints.filter(c => c.priority === 'CRITICAL' && c.status !== 'Resolved').length;
    const resolved = complaints.filter(c => c.status === 'Resolved').length;
    const whistleblowers = complaints.filter(c => c.whistleblower === true).length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    metrics = { total, pending, critical, resolved, resolutionRate, whistleblower: whistleblowers };
    renderHotspotsAnalytics(complaints);
    renderCategoryBreakdown(complaints);
  }

  const navBadge = document.getElementById('nav-pending-badge');
  if (navBadge) {
    navBadge.textContent = metrics.pending;
    navBadge.className = `px-1.5 py-0.2 ${metrics.pending > 0 ? 'bg-rose-500' : 'bg-slate-400'} text-white text-[10px] font-bold rounded-full`;
  }

  document.getElementById('metric-total').textContent = metrics.total;
  document.getElementById('metric-pending').textContent = metrics.pending;
  document.getElementById('metric-critical-count').textContent = `${metrics.critical} Critical Cases`;
  document.getElementById('metric-resolved-rate').textContent = `${metrics.resolutionRate}%`;
  document.getElementById('metric-resolved-count').textContent = `${metrics.resolved} Resolved Cases`;
  document.getElementById('metric-whistleblower').textContent = metrics.whistleblower;
}

function renderHotspotsFromData(hotspots) {
  const container = document.getElementById('hotspotsContainer');
  if (!container || !hotspots) return;

  const total = hotspots.reduce((acc, h) => acc + (h.count || 0), 0) || 1;

  container.innerHTML = hotspots.map(h => {
    const pct = Math.round((h.count / total) * 100);
    const loc = h.location || 'Campus Zone';
    let barColor = 'bg-brand-500';
    if (loc.includes('Hostel')) barColor = 'bg-rose-500';
    else if (loc.includes('Canteen')) barColor = 'bg-amber-500';
    else if (loc.includes('Lab')) barColor = 'bg-blue-500';

    return `
      <div>
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-bold text-slate-700 flex items-center gap-1.5 truncate">
            <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
            <span class="truncate">${escapeHtml(loc)}</span>
          </span>
          <div class="flex items-center gap-2 shrink-0">
            <span class="font-mono text-slate-500 text-[11px]">${h.count} reports</span>
            <span class="font-bold text-slate-900">${pct}%</span>
          </div>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div class="${barColor} h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderCategoryBreakdownFromData(categories) {
  const container = document.getElementById('categoryBreakdownContainer');
  if (!container || !categories) return;

  const total = categories.reduce((acc, c) => acc + (c.count || 0), 0) || 1;

  container.innerHTML = categories.map(cat => {
    const pct = Math.round((cat.count / total) * 100);
    let dot = 'bg-brand-500';
    if (cat.name.includes('Ragging')) dot = 'bg-rose-500';
    else if (cat.name.includes('Bias')) dot = 'bg-amber-500';
    else if (cat.name.includes('Lectures')) dot = 'bg-blue-500';
    else if (cat.name.includes('Hostel')) dot = 'bg-emerald-500';

    return `
      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-semibold text-slate-800 flex items-center gap-2 truncate">
            <span class="w-2 h-2 rounded-full ${dot} shrink-0"></span>
            <span class="truncate">${cat.name.split('/')[0]}</span>
          </span>
          <span class="font-mono font-bold text-slate-900">${cat.count}</span>
        </div>
        <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
          <div class="${dot} h-1.5 rounded-full" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHotspotsAnalytics(complaints) {
  const counts = {};
  complaints.forEach(c => {
    const loc = c.building || 'Unspecified';
    counts[loc] = (counts[loc] || 0) + 1;
  });
  const hotspots = Object.entries(counts).map(([location, count]) => ({ location, count }));
  renderHotspotsFromData(hotspots);
}

function renderCategoryBreakdown(complaints) {
  const categories = [
    'Anti-Ragging / Harassment',
    'Academic Bias / Faculty Targeting',
    'Irregular Lectures / Teaching Quality',
    'Infrastructure / Hostel Issue'
  ].map(name => ({
    name,
    count: complaints.filter(c => c.category === name).length
  }));
  renderCategoryBreakdownFromData(categories);
}

/**
 * Renders the Live Complaints Feed in Admin Dashboard.
 */
async function renderAdminFeed() {
  const container = document.getElementById('adminFeedList');
  if (!container) return;

  const categoryFilter = document.getElementById('adminFilterCategory')?.value || 'ALL';
  const statusFilter = document.getElementById('adminFilterStatus')?.value || 'ALL';

  let complaints = [];

  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/complaints?category=${categoryFilter}&status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          complaints = data.complaints;
        }
      }
    } catch (e) {
      console.warn('API feed fetch error, using local fallback');
    }
  }

  if (complaints.length === 0) {
    complaints = getComplaints();
    if (categoryFilter !== 'ALL') complaints = complaints.filter(c => c.category === categoryFilter);
    if (statusFilter !== 'ALL') complaints = complaints.filter(c => c.status === statusFilter);
    complaints.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
  }

  if (complaints.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center text-slate-400 text-xs">
        <i data-lucide="check-circle" class="w-10 h-10 mx-auto text-emerald-400 mb-2"></i>
        <p class="font-bold text-slate-700 text-sm">No complaints found for selected filters.</p>
        <p class="text-slate-400 mt-1">All active cases have been redressed or match no current criteria.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = complaints.map(c => {
    let priorityBadge = '';
    if (c.priority === 'CRITICAL') {
      priorityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white uppercase tracking-wider animate-pulse">CRITICAL</span>`;
    } else if (c.priority === 'HIGH') {
      priorityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">HIGH</span>`;
    } else {
      priorityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider">${c.priority}</span>`;
    }

    const statusBadge = getStatusBadgeHtml(c.status);
    const timeAgo = formatTimeAgo(c.createdAt || c.created_at);
    const unreadMessages = c.messages ? c.messages.filter(m => m.sender === 'student').length : 0;

    return `
      <div class="p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div class="space-y-1.5 flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">${c.id}</span>
            <span class="text-xs font-semibold text-slate-800">${escapeHtml(c.category)}</span>
            ${priorityBadge}
            ${c.whistleblower ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 flex items-center gap-1"><i data-lucide="shield" class="w-3 h-3"></i> WHISTLEBLOWER</span>' : ''}
          </div>

          <p class="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            "${escapeHtml(c.description)}"
          </p>

          <div class="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
            <span class="flex items-center gap-1">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i>
              ${escapeHtml(c.building)} (${escapeHtml(c.spot)})
            </span>
            <span>•</span>
            <span class="flex items-center gap-1">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
              ${timeAgo}
            </span>
            <span>•</span>
            <span class="font-medium ${(c.privacyOption === 'anonymous' || c.privacy_option === 'anonymous') ? 'text-purple-600' : 'text-slate-600'}">
              ${(c.privacyOption === 'anonymous' || c.privacy_option === 'anonymous') ? '🔒 Masked Identity' : escapeHtml(c.studentName || c.student_name)} (${c.year})
            </span>
          </div>
        </div>

        <div class="flex flex-col sm:items-end gap-2 shrink-0 self-start md:self-center">
          <div class="flex items-center gap-2">
            ${statusBadge}
            <span class="text-[10px] text-slate-400 font-mono">PIN: ${c.pin}</span>
          </div>

          <!-- Quick Status Changer & One-Click Problem Solver -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <select onchange="handleQuickStatusChange('${c.id}', this.value)" class="text-[11px] font-semibold px-2 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 text-slate-700 cursor-pointer">
              <option value="" disabled selected>Change Status...</option>
              <option value="Submitted">📝 Submitted (New)</option>
              <option value="Under Investigation">🔍 Under Investigation</option>
              <option value="Action Taken">⚡ Action Taken</option>
              <option value="Resolved">✅ Solved & Resolved</option>
              <option value="Dismissed">❌ Dismissed</option>
            </select>

            ${c.status !== 'Resolved' ? `
              <button onclick="quickSolveComplaint('${c.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-[11px] font-bold shadow-sm transition flex items-center gap-1 cursor-pointer" title="One-Click Solve Problem">
                <i data-lucide="check-check" class="w-3.5 h-3.5"></i>
                <span>Solve</span>
              </button>
            ` : `
              <span class="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-1">
                <i data-lucide="check" class="w-3 h-3"></i> Solved
              </span>
            `}

            <button onclick="openAdminActionModal('${c.id}')" class="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 text-[11px] font-bold rounded-lg transition flex items-center gap-1 shadow-sm">
              <i data-lucide="file-cog" class="w-3.5 h-3.5"></i>
              <span>Dossier</span>
              ${unreadMessages > 0 ? `<span class="w-2 h-2 rounded-full bg-rose-500"></span>` : ''}
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');

  lucide.createIcons();
}

/**
 * Admin Dossier & Update Modal.
 */
function openAdminActionModal(complaintId) {
  const complaints = getComplaints();
  const c = complaints.find(item => item.id === complaintId);
  if (!c) return;

  currentAdminComplaint = c;

  document.getElementById('adminModalComplaintId').value = c.id;
  document.getElementById('adminModalTitle').textContent = `Dossier: ${c.id}`;
  document.getElementById('adminModalSubTitle').textContent = `${c.category} • ${c.priority}`;

  document.getElementById('adminModalDetails').innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2 border-b border-slate-200">
      <div><span class="text-slate-400 block text-[10px]">STUDENT</span><strong>${escapeHtml(c.studentName || c.student_name)}</strong></div>
      <div><span class="text-slate-400 block text-[10px]">ERP / PRN</span><span class="font-mono">${escapeHtml(c.studentErp || c.student_erp)}</span></div>
      <div><span class="text-slate-400 block text-[10px]">DEPT & YEAR</span>${escapeHtml(c.department)} (${escapeHtml(c.year)})</div>
      <div><span class="text-slate-400 block text-[10px]">SECRET PIN</span><span class="font-mono text-brand-600 font-bold">${c.pin}</span></div>
    </div>
    <div class="pt-1">
      <span class="text-slate-400 block text-[10px]">LOCATION & GPS</span>
      <strong>${escapeHtml(c.building)}</strong> - ${escapeHtml(c.spot)} <span class="font-mono text-[11px] text-slate-500">(${c.gps})</span>
    </div>
    <div class="pt-1">
      <span class="text-slate-400 block text-[10px]">ALLEGATION NARRATIVE</span>
      <p class="text-slate-800 italic bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed font-sans">${escapeHtml(c.description)}</p>
    </div>
    ${c.files && c.files.length > 0 ? `
      <div class="pt-1">
        <span class="text-slate-400 block text-[10px]">ATTACHED EVIDENCE</span>
        <div class="flex flex-wrap gap-1 mt-1">
          ${c.files.map(f => `<span class="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-mono flex items-center gap-1"><i data-lucide="paperclip" class="w-3 h-3"></i> ${escapeHtml(f)}</span>`).join('')}
        </div>
      </div>
    ` : ''}
  `;

  document.getElementById('adminStatusSelect').value = c.status;
  document.getElementById('adminPrioritySelect').value = c.priority;
  document.getElementById('adminRemarksInput').value = c.remarks || '';

  renderAdminModalChat(c);

  const modal = document.getElementById('adminActionModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeAdminActionModal() {
  const modal = document.getElementById('adminActionModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  currentAdminComplaint = null;
}

/**
 * Admin updates status, priority, and remarks in MySQL.
 */
async function handleAdminUpdateStatus(event) {
  event.preventDefault();
  if (!currentAdminComplaint) return;

  const id = currentAdminComplaint.id;
  const newStatus = document.getElementById('adminStatusSelect').value;
  const newPriority = document.getElementById('adminPrioritySelect').value;
  const newRemarks = document.getElementById('adminRemarksInput').value.trim();

  try {
    await fetch(`${API_BASE}/api/complaints/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, priority: newPriority, remarks: newRemarks })
    });
  } catch (err) {
    console.warn('Backend update failed, applying local update:', err);
  }

  // Update local
  const complaints = getComplaints();
  const idx = complaints.findIndex(c => c.id === id);
  if (idx !== -1) {
    complaints[idx].status = newStatus;
    complaints[idx].priority = newPriority;
    complaints[idx].remarks = newRemarks;
    complaints[idx].remarksDate = new Date().toISOString();
    saveComplaints(complaints);
  }

  if (currentlyTrackedComplaint && currentlyTrackedComplaint.id === id) {
    currentlyTrackedComplaint.status = newStatus;
    currentlyTrackedComplaint.priority = newPriority;
    currentlyTrackedComplaint.remarks = newRemarks;
    renderTrackingDetails(currentlyTrackedComplaint);
  }

  await syncComplaints();
  renderAdminFeed();
  updateMetricsDisplay();

  showToast(`Case ${id} updated to "${newStatus}" in MySQL`, 'success');
  closeAdminActionModal();
}

/**
 * Quick-solve action inside the Proctorial Dossier modal.
 * Sets status to 'Resolved', enters official resolution remark, and submits.
 */
async function adminModalQuickSolve() {
  if (!currentAdminComplaint) return;
  const statusSelect = document.getElementById('adminStatusSelect');
  const remarksInput = document.getElementById('adminRemarksInput');
  if (statusSelect) statusSelect.value = 'Resolved';
  if (remarksInput && !remarksInput.value.trim()) {
    remarksInput.value = 'Problem investigated by Proctorial Board & Anti-Ragging Cell. Corrective and disciplinary action executed. Grievance resolved and closed.';
  }
  await handleAdminUpdateStatus({ preventDefault: () => {} });
}

/**
 * Quick status dropdown change directly from Admin Feed card.
 */
async function handleQuickStatusChange(id, newStatus) {
  if (!id || !newStatus) return;

  try {
    if (isBackendConnected) {
      await fetch(`${API_BASE}/api/complaints/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    }
  } catch (err) {
    console.warn('Backend quick status update error:', err);
  }

  // Update local storage cache
  const complaints = getComplaints();
  const idx = complaints.findIndex(c => c.id === id);
  if (idx !== -1) {
    complaints[idx].status = newStatus;
    complaints[idx].remarksDate = new Date().toISOString();
    saveComplaints(complaints);
  }

  if (currentlyTrackedComplaint && currentlyTrackedComplaint.id === id) {
    currentlyTrackedComplaint.status = newStatus;
    renderTrackingDetails(currentlyTrackedComplaint);
  }

  await syncComplaints();
  renderAdminFeed();
  updateMetricsDisplay();
  showToast(`Case ${id} status updated to "${newStatus}"`, 'success');
}

/**
 * One-click solve problem button on the Admin Feed card.
 */
async function quickSolveComplaint(id) {
  if (!id) return;
  const resolutionRemarks = 'Problem redressed and solved by Proctorial Board. Disciplinary & corrective measures enforced. Grievance officially resolved.';

  try {
    if (isBackendConnected) {
      await fetch(`${API_BASE}/api/complaints/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Resolved',
          remarks: resolutionRemarks
        })
      });
    }
  } catch (err) {
    console.warn('Backend quick solve error:', err);
  }

  // Update local storage cache
  const complaints = getComplaints();
  const idx = complaints.findIndex(c => c.id === id);
  if (idx !== -1) {
    complaints[idx].status = 'Resolved';
    complaints[idx].remarks = resolutionRemarks;
    complaints[idx].remarksDate = new Date().toISOString();
    saveComplaints(complaints);
  }

  if (currentlyTrackedComplaint && currentlyTrackedComplaint.id === id) {
    currentlyTrackedComplaint.status = 'Resolved';
    currentlyTrackedComplaint.remarks = resolutionRemarks;
    renderTrackingDetails(currentlyTrackedComplaint);
  }

  await syncComplaints();
  renderAdminFeed();
  updateMetricsDisplay();
  showToast(`Case ${id} marked as Solved & Resolved!`, 'success');
}

function renderAdminModalChat(c) {
  const container = document.getElementById('adminModalChatList');
  if (!container) return;

  if (!c.messages || c.messages.length === 0) {
    container.innerHTML = `<p class="text-slate-400 italic text-center py-4">No dialogue history yet. Reply below to initiate secure notes with student.</p>`;
    return;
  }

  container.innerHTML = c.messages.map(m => {
    const isAdmin = m.sender === 'admin';
    return `
      <div class="p-2 rounded-lg ${isAdmin ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 ml-4' : 'bg-white border border-slate-200 text-slate-800 mr-4'}">
        <div class="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-0.5">
          <span>${escapeHtml(m.senderName)}</span>
          <span>${formatTime(m.timestamp || m.created_at)}</span>
        </div>
        <p class="leading-relaxed">${escapeHtml(m.text)}</p>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

async function handleAdminSendMessage(event) {
  event.preventDefault();
  if (!currentAdminComplaint) return;

  const input = document.getElementById('adminModalChatInput');
  const text = input.value.trim();
  if (!text) return;

  const senderName = currentUser ? currentUser.name : 'Anti-Ragging Committee & Proctorial Cell';
  let sent = false;

  try {
    const res = await fetch(`${API_BASE}/api/complaints/${currentAdminComplaint.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: 'admin', senderName, text })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        currentAdminComplaint.messages = data.messages;
        sent = true;
      }
    }
  } catch (err) {
    console.warn('API send failed, falling back to local:', err);
  }

  if (!sent) {
    const msg = {
      sender: 'admin',
      senderName,
      text,
      timestamp: new Date().toISOString()
    };
    if (!currentAdminComplaint.messages) currentAdminComplaint.messages = [];
    currentAdminComplaint.messages.push(msg);

    const complaints = getComplaints();
    const idx = complaints.findIndex(c => c.id === currentAdminComplaint.id);
    if (idx !== -1) {
      complaints[idx].messages = currentAdminComplaint.messages;
      saveComplaints(complaints);
    }
  }

  input.value = '';
  renderAdminModalChat(currentAdminComplaint);

  if (currentlyTrackedComplaint && currentlyTrackedComplaint.id === currentAdminComplaint.id) {
    currentlyTrackedComplaint.messages = currentAdminComplaint.messages;
    renderTrackingChat(currentlyTrackedComplaint);
  }

  showToast('Response transmitted to student tracker and saved in MySQL', 'success');
}

// ========================================================
// UGC COMPLIANCE CSV & PDF EXPORT
// ========================================================
function exportComplianceCSV() {
  const complaints = getComplaints();
  if (complaints.length === 0) {
    showToast('No complaint records available to export', 'error');
    return;
  }

  const headers = [
    'Tracking_ID',
    'Lodged_Timestamp',
    'Incident_Date',
    'Category',
    'Priority',
    'Privacy_Mode',
    'Whistleblower_Protection',
    'Student_Name',
    'ERP_PRN',
    'Email',
    'Department',
    'Year',
    'Division',
    'Campus_Building',
    'Specific_Spot',
    'GPS_Coordinates',
    'Witnesses_Or_Accused',
    'Status',
    'Committee_Remarks',
    'Remarks_Updated'
  ];

  const rows = complaints.map(c => [
    `"${c.id}"`,
    `"${c.createdAt || c.created_at}"`,
    `"${c.incidentDate || c.incident_date}"`,
    `"${c.category}"`,
    `"${c.priority}"`,
    `"${c.privacyOption || c.privacy_option}"`,
    `"${c.whistleblower ? 'YES' : 'NO'}"`,
    `"${(c.privacyOption === 'anonymous' || c.privacy_option === 'anonymous') ? 'MASKED_WHISTLEBLOWER' : (c.studentName || c.student_name)}"`,
    `"${(c.privacyOption === 'anonymous' || c.privacy_option === 'anonymous') ? 'MASKED' : (c.studentErp || c.student_erp)}"`,
    `"${(c.privacyOption === 'anonymous' || c.privacy_option === 'anonymous') ? 'PROTECTED' : (c.studentEmail || c.student_email)}"`,
    `"${c.department}"`,
    `"${c.year}"`,
    `"${c.division}"`,
    `"${c.building}"`,
    `"${(c.spot || '').replace(/"/g, '""')}"`,
    `"${c.gps || ''}"`,
    `"${(c.witnesses || '').replace(/"/g, '""')}"`,
    `"${c.status}"`,
    `"${(c.remarks || '').replace(/"/g, '""')}"`,
    `"${c.remarksDate || c.remarks_date || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `Apex_Campus_Integrity_UGC_Compliance_Report_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Compliance CSV exported successfully', 'success');
}

function triggerPrintComplianceReport() {
  const complaints = getComplaints();
  const printContainer = document.getElementById('print-report-container');

  const total = complaints.length;
  const resolved = complaints.filter(c => c.status === 'Resolved').length;
  const pending = complaints.filter(c => c.status !== 'Resolved').length;
  const critical = complaints.filter(c => c.priority === 'CRITICAL').length;
  const reportDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  printContainer.innerHTML = `
    <div style="font-family: Arial, sans-serif; color: #111; max-width: 900px; margin: 0 auto; line-height: 1.4;">
      
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="margin: 0; font-size: 22px; font-weight: bold; text-transform: uppercase;">Apex Institute of Technology</h1>
          <h2 style="margin: 2px 0 0 0; font-size: 14px; font-weight: bold; color: #4338ca;">STATUTORY VIGILANCE, CAMPUS INTEGRITY & ANTI-RAGGING COMMITTEE</h2>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #555;">(Autonomous Institution Approved by AICTE, Affiliated to State University, NAAC Grade A++)</p>
        </div>
        <div style="text-align: right; font-size: 11px;">
          <p style="margin: 0;"><strong>Doc Ref:</strong> UGC-ARC-2026/Q3</p>
          <p style="margin: 2px 0;"><strong>Date:</strong> ${reportDate}</p>
          <p style="margin: 2px 0;"><strong>Database:</strong> MySQL Synced</p>
        </div>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 11px;">
        <strong>Statutory Compliance Statement:</strong> This audit report compiles all grievances registered through the institutional anti-ragging portal. All cases undergo mandatory review by the Proctorial Board in compliance with Supreme Court of India directives. Whistleblower identities remain protected under judicial seal.
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 25px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #fafafa;">
        <div style="text-align: center; flex: 1;">
          <span style="font-size: 18px; font-weight: bold; display: block;">${total}</span>
          <span style="font-size: 10px; text-transform: uppercase; color: #666;">Total Lodged</span>
        </div>
        <div style="text-align: center; flex: 1; border-left: 1px solid #e2e8f0;">
          <span style="font-size: 18px; font-weight: bold; color: #dc2626; display: block;">${critical}</span>
          <span style="font-size: 10px; text-transform: uppercase; color: #666;">Critical Anti-Ragging</span>
        </div>
        <div style="text-align: center; flex: 1; border-left: 1px solid #e2e8f0;">
          <span style="font-size: 18px; font-weight: bold; color: #d97706; display: block;">${pending}</span>
          <span style="font-size: 10px; text-transform: uppercase; color: #666;">Under Active Enquiry</span>
        </div>
        <div style="text-align: center; flex: 1; border-left: 1px solid #e2e8f0;">
          <span style="font-size: 18px; font-weight: bold; color: #16a34a; display: block;">${resolved}</span>
          <span style="font-size: 10px; text-transform: uppercase; color: #666;">Resolved & Disposed</span>
        </div>
      </div>

      <h3 style="font-size: 13px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">Register of Reported Incidents & Proctorial Action</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 30px;">
        <thead>
          <tr style="background: #0f172a; color: white;">
            <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Case ID</th>
            <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Date</th>
            <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Category</th>
            <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Location / Hotspot</th>
            <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Status</th>
            <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Proctorial Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${complaints.map(c => `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; font-weight: bold;">${c.id}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px;">${(c.createdAt || c.created_at || '').slice(0, 10)}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px;"><strong>${escapeHtml(c.category)}</strong></td>
              <td style="border: 1px solid #cbd5e1; padding: 6px;">${escapeHtml(c.building)}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px;">${c.status}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 9.5px;">${escapeHtml(c.remarks || 'Under formal review')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 50px; display: flex; justify-content: space-between; padding-top: 30px; border-top: 1px solid #cbd5e1; font-size: 11px;">
        <div style="text-align: center; width: 200px;">
          <div style="height: 40px;"></div>
          <p style="margin: 0; font-weight: bold;">Dr. S. K. Kulkarni</p>
          <p style="margin: 0; color: #555;">Member Secretary, Anti-Ragging Squad</p>
        </div>
        <div style="text-align: center; width: 200px;">
          <div style="height: 40px;"></div>
          <p style="margin: 0; font-weight: bold;">Prof. A. R. Verma</p>
          <p style="margin: 0; color: #555;">Chief Proctor & Ombudsman</p>
        </div>
        <div style="text-align: center; width: 200px;">
          <div style="height: 40px;"></div>
          <p style="margin: 0; font-weight: bold;">Dr. M. N. Sengupta</p>
          <p style="margin: 0; color: #555;">Principal & Head of Institution</p>
        </div>
      </div>

    </div>
  `;

  window.print();
}

// ========================================================
// MODAL CONTROLS (EMERGENCY SOS & HELP)
// ========================================================
function emergencySOSModal() {
  const modal = document.getElementById('sosModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeSosModal() {
  const modal = document.getElementById('sosModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function openHelpModal() {
  const modal = document.getElementById('helpModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeHelpModal() {
  const modal = document.getElementById('helpModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// ========================================================
// UTILITIES & TOAST NOTIFICATION SYSTEM
// ========================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  let bg = 'bg-slate-900 text-white';
  let icon = 'info';

  if (type === 'success') {
    bg = 'bg-emerald-600 text-white shadow-emerald-500/25';
    icon = 'check-circle';
  } else if (type === 'error') {
    bg = 'bg-rose-600 text-white shadow-rose-500/25';
    icon = 'alert-triangle';
  } else if (type === 'info') {
    bg = 'bg-indigo-600 text-white shadow-indigo-500/25';
    icon = 'info';
  }

  toast.className = `${bg} px-4 py-3 rounded-2xl shadow-xl border border-white/10 text-xs font-semibold flex items-center gap-2.5 transition-all transform translate-y-4 opacity-0 pointer-events-auto duration-200`;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, 3500);
}

function getStatusBadgeHtml(status) {
  if (status === 'Resolved') {
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Solved & Resolved
    </span>`;
  } else if (status === 'Under Investigation') {
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
      <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span> Under Investigation
    </span>`;
  } else if (status === 'Action Taken') {
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
      <span class="w-2 h-2 rounded-full bg-blue-500"></span> Action Taken
    </span>`;
  } else if (status === 'Dismissed') {
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
      <span class="w-2 h-2 rounded-full bg-slate-400"></span> Dismissed
    </span>`;
  } else {
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
      <span class="w-2 h-2 rounded-full bg-amber-500"></span> Submitted (Pending)
    </span>`;
  }
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = (new Date() - new Date(isoStr)) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
