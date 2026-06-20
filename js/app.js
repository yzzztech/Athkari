/* ═══════════════════════════════════════
   أَذْكُر — App Logic
   ═══════════════════════════════════════ */

const STORAGE_KEY = 'adhkur_state';
const STREAK_KEY = 'adhkur_streak';

// ─── State ──────────────────────────────
const state = {
  activeCategory: null,
  theme: 'light',
  completed: {},    // { "catId-zikrId": true }
  counters: {},     // { "catId-zikrId": current }
  streaks: {},      // { YYYY-MM-DD: true }
};

// ─── Init ───────────────────────────────
function init() {
  loadState();
  loadStreaks();
  applyTheme();
  renderTabs();
  setupEventListeners();

  // Default to morning
  const defaultCat = AZKAR_DATA.categories[0].id;
  setActiveCategory(defaultCat);
}

// ─── State Persistence ──────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state.theme = saved.theme || 'light';
      state.completed = saved.completed || {};
      state.counters = saved.counters || {};
    }
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme: state.theme,
      completed: state.completed,
      counters: state.counters,
    }));
  } catch(e) {}
}

function loadStreaks() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) state.streaks = JSON.parse(raw);
  } catch(e) {}
}

function saveStreak() {
  const today = new Date().toISOString().split('T')[0];
  state.streaks[today] = true;
  // Keep last 90 days
  const keys = Object.keys(state.streaks).sort().slice(-90);
  const trimmed = {};
  keys.forEach(k => trimmed[k] = true);
  state.streaks = trimmed;
  localStorage.setItem(STREAK_KEY, JSON.stringify(trimmed));
}

// ─── Theme ───────────────────────────────
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveState();
}

// ─── Render Tabs ────────────────────────
function renderTabs() {
  const container = document.getElementById('categoryTabs');
  container.innerHTML = AZKAR_DATA.categories.map(cat => `
    <button class="cat-tab ${cat.id === state.activeCategory ? 'active' : ''}"
            data-cat="${cat.id}">
      ${cat.icon} ${cat.name}
    </button>
  `).join('');

  // Scroll active into view
  const activeTab = container.querySelector('.cat-tab.active');
  if (activeTab) {
    activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

// ─── Set Active Category ────────────────
function setActiveCategory(catId) {
  state.activeCategory = catId;
  renderTabs();
  renderAzkar(catId);
  document.getElementById('emptyState').style.display = 'none';
}

// ─── Render Azkar ───────────────────────
function renderAzkar(catId) {
  const container = document.getElementById('azkarList');
  const emptyState = document.getElementById('emptyState');
  const cat = AZKAR_DATA.categories.find(c => c.id === catId);
  if (!cat) return;

  let html = `
    <div class="category-header">
      <h2>${cat.icon} ${cat.name}</h2>
      <p class="time-hint">${cat.time}</p>
    </div>
  `;

  cat.azkar.forEach(z => {
    const key = `${catId}-${z.id}`;
    const current = state.counters[key] || 0;
    const target = z.count;
    const isCompleted = state.completed[key] || false;

    html += `
      <div class="zikr-card ${isCompleted ? 'completed' : ''}" data-key="${key}" data-count="${target}">
        <div class="completed-check">✓</div>
        <div class="zikr-text">${z.text}</div>
        <div class="zikr-source">📖 ${z.source}</div>
        <div class="zikr-footer">
          <div class="zikr-actions">
            <button class="counter-btn" onclick="decrement('${key}', ${target})" aria-label="ناقص">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/></svg>
            </button>
            <span class="counter-count">${current}/${target}</span>
            <button class="counter-btn" onclick="increment('${key}', ${target})" aria-label="زائد">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
          ${z.when || z.fadl || z.meaning ? `
            <button class="expand-btn" onclick="toggleExpand(this, '${key}')" aria-label="تفاصيل">
              <span>لماذا؟</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          ` : ''}
        </div>
        ${z.when || z.fadl || z.meaning ? `
          <div class="expand-panel" id="expand-${key}">
            <div class="expand-inner">
              ${z.when ? `<div class="expand-row"><span class="expand-label">✦ متى يُقال</span><span class="expand-value">${z.when}</span></div>` : ''}
              ${z.fadl ? `<div class="expand-row"><span class="expand-label">🌟 فضله</span><span class="expand-value">${z.fadl}</span></div>` : ''}
              ${z.meaning ? `<div class="expand-row"><span class="expand-label">📝 معاني</span><span class="expand-value">${z.meaning}</span></div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
  emptyState.style.display = 'none';
  updateProgress(cat);
}

// ─── Counter Logic ──────────────────────
function increment(key, target) {
  const current = (state.counters[key] || 0) + 1;
  if (current >= target) {
    state.counters[key] = target;
    state.completed[key] = true;
    saveStreak();
    showToast('✓ أتممت الذكر');
  } else {
    state.counters[key] = current;
  }
  updateCard(key);
  updateProgressForCurrent();
  saveState();
}

function decrement(key, target) {
  const current = Math.max(0, (state.counters[key] || 0) - 1);
  state.counters[key] = current;
  if (current < target) {
    delete state.completed[key];
  }
  updateCard(key);
  updateProgressForCurrent();
  saveState();
}

function updateCard(key) {
  const card = document.querySelector(`[data-key="${key}"]`);
  if (!card) return;
  const target = parseInt(card.dataset.count);
  const current = state.counters[key] || 0;
  const isCompleted = state.completed[key];

  card.classList.toggle('completed', isCompleted);
  const countEl = card.querySelector('.counter-count');
  if (countEl) countEl.textContent = `${current}/${target}`;
}

function updateProgressForCurrent() {
  const cat = AZKAR_DATA.categories.find(c => c.id === state.activeCategory);
  if (cat) updateProgress(cat);
}

function updateProgress(cat) {
  const total = cat.azkar.length;
  const done = cat.azkar.filter(z => state.completed[`${cat.id}-${z.id}`]).length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('progressText').textContent = `${done}/${total}`;
}

// ─── Expand Panel ───────────────────────
function toggleExpand(btn, key) {
  const panel = document.getElementById(`expand-${key}`);
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open');
  btn.classList.toggle('expanded');
}

// ─── Toast ──────────────────────────────
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ─── Search ─────────────────────────────
function setupSearch() {
  const overlay = document.getElementById('searchOverlay');
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  // Build search index
  const searchIndex = [];
  AZKAR_DATA.categories.forEach(cat => {
    cat.azkar.forEach(z => {
      searchIndex.push({
        catId: cat.id,
        catName: cat.name,
        catIcon: cat.icon,
        id: z.id,
        text: z.text,
        source: z.source,
        when: z.when || '',
        fadl: z.fadl || '',
      });
    });
  });

  function openSearch() {
    overlay.classList.add('active');
    input.value = '';
    input.focus();
    results.innerHTML = '';
  }

  function closeSearch() {
    overlay.classList.remove('active');
  }

  function doSearch(query) {
    if (!query.trim()) {
      results.innerHTML = '';
      return;
    }
    const q = query.toLowerCase();
    const matches = searchIndex.filter(item =>
      item.text.includes(q) ||
      item.source.includes(q) ||
      item.when.includes(q) ||
      item.fadl.includes(q) ||
      item.catName.includes(q)
    ).slice(0, 20);

    if (matches.length === 0) {
      results.innerHTML = '<div class="search-no-results">لا توجد نتائج</div>';
      return;
    }

    results.innerHTML = matches.map(m => `
      <div class="search-result-item" onclick="navigateToSearchResult('${m.catId}', ${m.id})">
        <div class="sr-text">${truncateText(m.text, 80)}</div>
        <div class="sr-cat">${m.catIcon} ${m.catName} — ${m.source}</div>
      </div>
    `).join('');
  }

  document.getElementById('searchBtn').addEventListener('click', openSearch);
  input.addEventListener('input', e => doSearch(e.target.value));
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeSearch();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape') {
      closeSearch();
    }
  });
}

function navigateToSearchResult(catId, zikrId) {
  document.getElementById('searchOverlay').classList.remove('active');
  setActiveCategory(catId);
  // Scroll to specific zikr
  setTimeout(() => {
    const card = document.querySelector(`[data-key="${catId}-${zikrId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.boxShadow = '0 0 0 3px var(--primary)';
      setTimeout(() => card.style.boxShadow = '', 2000);
    }
  }, 300);
}

function truncateText(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

// ─── Event Listeners ────────────────────
function setupEventListeners() {
  // Category tabs
  document.getElementById('categoryTabs').addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    const catId = tab.dataset.cat;
    setActiveCategory(catId);
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Search
  setupSearch();
}

// ─── Boot ───────────────────────────────
document.addEventListener('DOMContentLoaded', init);
