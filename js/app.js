/* ═══════════════════════════════════════
   أذكاري — App Logic v2
   ═══════════════════════════════════════ */

const STORAGE_KEY = 'athkari_state';
const STREAK_KEY = 'athkari_streak';
const QURAN_POS_KEY = 'athkari_quran_pos';
const QURAN_BOOKMARKS_KEY = 'athkari_quran_bookmarks';
const QURAN_API = 'https://api.alquran.cloud/v1';

// ─── State ──────────────────────────────
const state = {
  activeCategory: null,
  theme: 'light',
  completed: {},
  counters: {},
  streaks: {},
  quranPos: null,        // { surah, ayah }
  quranBookmarks: [],    // [{ surah, ayah, text, note }]
};

// ─── Init ───────────────────────────────
function init() {
  loadState();
  loadStreaks();
  applyTheme();
  renderTabs();
  setupEventListeners();
  updateStreakDisplay();

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
      state.quranPos = saved.quranPos || null;
    }
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme: state.theme,
      completed: state.completed,
      counters: state.counters,
      quranPos: state.quranPos,
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
  const keys = Object.keys(state.streaks).sort().slice(-90);
  const trimmed = {};
  keys.forEach(k => trimmed[k] = true);
  state.streaks = trimmed;
  localStorage.setItem(STREAK_KEY, JSON.stringify(trimmed));
  updateStreakDisplay();
}

function loadQuranBookmarks() {
  try {
    const raw = localStorage.getItem(QURAN_BOOKMARKS_KEY);
    if (raw) state.quranBookmarks = JSON.parse(raw);
  } catch(e) {}
}

function saveQuranBookmarks() {
  localStorage.setItem(QURAN_BOOKMARKS_KEY, JSON.stringify(state.quranBookmarks));
}

// ─── Streak Display ─────────────────────
function updateStreakDisplay() {
  const streakEl = document.getElementById('streakDisplay');
  if (!streakEl) return;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Count consecutive days
  let streak = 0;
  const d = new Date();
  while (state.streaks[d.toISOString().split('T')[0]]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  if (state.streaks[today] || state.streaks[yesterday]) {
    streakEl.innerHTML = `🔥 ${streak}`;
    streakEl.style.display = 'inline';
  } else {
    streakEl.style.display = 'none';
  }
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
  container.innerHTML = AZKAR_DATA.categories.map((cat, i) => `
    <button class="cat-tab cat-${cat.id} ${cat.id === state.activeCategory ? 'active' : ''}"
            data-cat="${cat.id}" style="--tab-index: ${i}">
      ${cat.icon} ${cat.name}
    </button>
  `).join('');

  // Add Quran tab
  const quranActive = state.activeCategory === 'quran';
  container.innerHTML += `
    <button class="cat-tab cat-quran ${quranActive ? 'active' : ''}"
            data-cat="quran" style="--tab-index: ${AZKAR_DATA.categories.length}">
      📖 المصحف
    </button>
  `;

  const activeTab = container.querySelector('.cat-tab.active');
  if (activeTab) {
    activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

// ─── Set Active Category ────────────────
function setActiveCategory(catId) {
  state.activeCategory = catId;
  renderTabs();
  document.getElementById('emptyState').style.display = 'none';

  if (catId === 'quran') {
    renderQuran();
    document.getElementById('progressSection').style.display = 'none';
  } else {
    document.getElementById('progressSection').style.display = 'flex';
    renderAzkar(catId);
  }
}

// ─── Render Azkar ───────────────────────
function renderAzkar(catId) {
  const container = document.getElementById('azkarList');
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
    const isSingle = target === 1;

    html += `
      <div class="zikr-card ${isCompleted ? 'completed' : ''}" data-key="${key}" data-count="${target}">
        <div class="completed-check">✓</div>
        <div class="zikr-text">${z.text}</div>
        <div class="zikr-source">📖 ${z.source}</div>
        <div class="zikr-footer">
          <div class="zikr-actions">
            ${isSingle ? `
              <button class="check-btn ${isCompleted ? 'checked' : ''}" onclick="toggleSingle('${key}')" aria-label="أتممت">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${isCompleted ? '3' : '2'}"><path d="M20 6L9 17l-5-5"/></svg>
              </button>
            ` : `
              <button class="counter-btn" onclick="decrement('${key}', ${target})" aria-label="ناقص">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/></svg>
              </button>
              <span class="counter-count">${current}/${target}</span>
              <button class="counter-btn" onclick="increment('${key}', ${target})" aria-label="زائد" ${current < target ? 'data-auto="true"' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            `}
          </div>
          ${z.when || z.fadl || z.meaning ? `
            <button class="expand-btn" onclick="toggleExpand(this, '${key}')" aria-label="تفاصيل">
              <span>فضـل الـذكـر</span>
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

  // "Complete all" button
  const allDone = cat.azkar.every(z => state.completed[`${catId}-${z.id}`]);
  html += `
    <button class="complete-all-btn ${allDone ? 'all-done' : ''}" onclick="completeAll('${catId}')">
      ${allDone ? '✅ أتممت جميع الأذكار — بارك الله فيك' : '✓ أتممت الكل'}
    </button>
  `;

  container.innerHTML = html;
  updateProgress(cat);
}

// ─── Counter Logic ──────────────────────
function toggleSingle(key) {
  if (state.completed[key]) {
    delete state.completed[key];
    delete state.counters[key];
  } else {
    state.completed[key] = true;
    state.counters[key] = 1;
    saveStreak();
    showToast('✓ أتممت الذكر');
    // Haptic feedback if available
    if (navigator.vibrate) navigator.vibrate(30);
  }
  updateCard(key);
  updateProgressForCurrent();
  saveState();
}

function increment(key, target) {
  const current = (state.counters[key] || 0) + 1;
  if (current >= target) {
    state.counters[key] = target;
    state.completed[key] = true;
    saveStreak();
    showToast('✓ أتممت الذكر');
    if (navigator.vibrate) navigator.vibrate([20, 50, 20]);
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

function completeAll(catId) {
  const cat = AZKAR_DATA.categories.find(c => c.id === catId);
  if (!cat) return;

  const allDone = cat.azkar.every(z => state.completed[`${catId}-${z.id}`]);

  if (allDone) {
    // Undo all
    cat.azkar.forEach(z => {
      const key = `${catId}-${z.id}`;
      delete state.completed[key];
      delete state.counters[key];
    });
    showToast('تم إلغاء الإتمام');
  } else {
    cat.azkar.forEach(z => {
      const key = `${catId}-${z.id}`;
      state.counters[key] = z.count;
      state.completed[key] = true;
    });
    saveStreak();
    showToast('✓ بارك الله فيك — أتممت جميع الأذكار');
  }
  renderAzkar(catId);
  saveState();
}

function updateCard(key) {
  const card = document.querySelector(`[data-key="${key}"]`);
  if (!card) return;
  const target = parseInt(card.dataset.count);
  const current = state.counters[key] || 0;
  const isCompleted = state.completed[key];
  const isSingle = target === 1;

  card.classList.toggle('completed', isCompleted);

  if (isSingle) {
    const checkBtn = card.querySelector('.check-btn');
    if (checkBtn) checkBtn.classList.toggle('checked', isCompleted);
  } else {
    const countEl = card.querySelector('.counter-count');
    if (countEl) countEl.textContent = `${current}/${target}`;
  }
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

// ─── Arabic Normalization ───────────────
function normalizeArabic(str) {
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove diacritics
    .replace(/[\u0621-\u0623\u0625-\u0626]/g, '\u0627') // Normalize alef variants
    .replace(/\u0624/g, '\u0648') // Waw with hamza → waw
    .replace(/\u0626/g, '\u064A') // Yeh with hamza → yeh
    .replace(/\u0629/g, '\u0647') // Teh marbuta → heh
    .replace(/\u0649/g, '\u064A') // Alef maksura → yeh
    .toLowerCase();
}

// ─── Search ─────────────────────────────
function setupSearch() {
  const overlay = document.getElementById('searchOverlay');
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  const searchIndex = [];
  AZKAR_DATA.categories.forEach(cat => {
    cat.azkar.forEach(z => {
      searchIndex.push({
        catId: cat.id,
        catName: cat.name,
        catIcon: cat.icon,
        id: z.id,
        text: z.text,
        textNormalized: normalizeArabic(z.text),
        source: z.source,
        when: z.when || '',
        whenNormalized: normalizeArabic(z.when || ''),
        fadl: z.fadl || '',
        fadlNormalized: normalizeArabic(z.fadl || ''),
      });
    });
  });

  function openSearch() {
    overlay.classList.add('active');
    input.value = '';
    input.focus();
    results.innerHTML = '<div class="search-hint">اكتب للبحث في الأذكار...</div>';
  }

  function closeSearch() {
    overlay.classList.remove('active');
  }

  function highlightText(text, query) {
    if (!query) return escapeHTML(text);
    const q = normalizeArabic(query);
    const t = normalizeArabic(text);
    const idx = t.indexOf(q);
    if (idx === -1) return escapeHTML(text);
    // Find the matching segment in original text
    let result = '';
    let ti = 0;
    for (let i = 0; i < text.length && ti < t.length; i++) {
      const norm = normalizeArabic(text[i]);
      if (norm) {
        if (ti >= idx && ti < idx + q.length) {
          result += '<mark>' + text[i] + '</mark>';
        } else {
          result += text[i];
        }
        ti++;
      } else {
        result += text[i];
      }
    }
    return result;
  }

  function doSearch(query) {
    if (!query.trim()) {
      results.innerHTML = '<div class="search-hint">اكتب للبحث في الأذكار...</div>';
      return;
    }
    const q = normalizeArabic(query);

    const matches = searchIndex.filter(item =>
      item.textNormalized.includes(q) ||
      item.source.includes(query.toLowerCase()) ||
      item.whenNormalized.includes(q) ||
      item.fadlNormalized.includes(q) ||
      item.catName.includes(query)
    ).slice(0, 20);

    if (matches.length === 0) {
      results.innerHTML = '<div class="search-no-results">لا توجد نتائج</div>';
      return;
    }

    results.innerHTML = matches.map(m => `
      <div class="search-result-item" onclick="navigateToSearchResult('${m.catId}', ${m.id})">
        <div class="sr-text">${highlightText(truncateText(m.text, 80), query)}</div>
        <div class="sr-cat">${m.catIcon} ${m.catName} — ${m.source}</div>
      </div>
    `).join('');
  }

  document.getElementById('searchBtn').addEventListener('click', openSearch);
  input.addEventListener('input', e => doSearch(e.target.value));
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeSearch();
  });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape') closeSearch();
  });
}

function navigateToSearchResult(catId, zikrId) {
  document.getElementById('searchOverlay').classList.remove('active');
  setActiveCategory(catId);
  setTimeout(() => {
    const card = document.querySelector(`[data-key="${catId}-${zikrId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.boxShadow = '0 0 0 3px var(--primary)';
      setTimeout(() => card.style.boxShadow = '', 2500);
    }
  }, 300);
}

function truncateText(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ═══════════════════════════════════════════
//  QURAN MODULE
// ═══════════════════════════════════════════

let quranSurahs = null;
let currentSurah = null;
let currentAyahs = [];

async function renderQuran() {
  loadQuranBookmarks();
  const container = document.getElementById('azkarList');

  container.innerHTML = `
    <div class="quran-container">
      <div class="quran-nav-bar">
        <div class="quran-nav-left">
          ${state.quranPos ? `
            <button class="quran-resume-btn" onclick="resumeQuran()">
              📍 متابعة — سورة ${getSurahName(state.quranPos.surah)} ${state.quranPos.ayah}
            </button>
          ` : ''}
        </div>
        <button class="quran-bookmarks-btn" onclick="showBookmarks()" title="الإشارات المرجعية">
          📑 <span id="bookmarkCount">${state.quranBookmarks.length || ''}</span>
        </button>
      </div>
      ${!quranSurahs ? '<div class="quran-loading">⏳ جارِ تحميل المصحف...</div>' : renderSurahList()}
    </div>
  `;

  if (!quranSurahs) {
    try {
      const res = await fetch(`${QURAN_API}/surah`);
      const data = await res.json();
      quranSurahs = data.data;
      container.querySelector('.quran-container').innerHTML = `
        <div class="quran-nav-bar">
          ${state.quranPos ? `
            <button class="quran-resume-btn" onclick="resumeQuran()">
              📍 متابعة — سورة ${getSurahName(state.quranPos.surah)} ${state.quranPos.ayah}
            </button>
          ` : ''}
          <button class="quran-bookmarks-btn" onclick="showBookmarks()" title="الإشارات المرجعية">
            📑 <span id="bookmarkCount">${state.quranBookmarks.length || ''}</span>
          </button>
        </div>
        ${renderSurahList()}
      `;
    } catch(e) {
      container.innerHTML = '<div class="quran-error">❌ تعذّر تحميل المصحف. تأكد من اتصالك بالإنترنت.</div>';
    }
  }
}

function getSurahName(num) {
  const surahNames = {
    1: 'الفاتحة', 2: 'البقرة', 3: 'آل عمران', 4: 'النساء', 5: 'المائدة',
    6: 'الأنعام', 7: 'الأعراف', 8: 'الأنفال', 9: 'التوبة', 10: 'يونس',
    11: 'هود', 12: 'يوسف', 13: 'الرعد', 14: 'إبراهيم', 15: 'الحجر',
    16: 'النحل', 17: 'الإسراء', 18: 'الكهف', 19: 'مريم', 20: 'طه',
    21: 'الأنبياء', 22: 'الحج', 23: 'المؤمنون', 24: 'النور', 25: 'الفرقان',
    26: 'الشعراء', 27: 'النمل', 28: 'القصص', 29: 'العنكبوت', 30: 'الروم',
    31: 'لقمان', 32: 'السجدة', 33: 'الأحزاب', 34: 'سبأ', 35: 'فاطر',
    36: 'يس', 37: 'الصافات', 38: 'ص', 39: 'الزمر', 40: 'غافر',
    41: 'فصلت', 42: 'الشورى', 43: 'الزخرف', 44: 'الدخان', 45: 'الجاثية',
    46: 'الأحقاف', 47: 'محمد', 48: 'الفتح', 49: 'الحجرات', 50: 'ق',
    51: 'الذاريات', 52: 'الطور', 53: 'النجم', 54: 'القمر', 55: 'الرحمن',
    56: 'الواقعة', 57: 'الحديد', 58: 'المجادلة', 59: 'الحشر', 60: 'الممتحنة',
    61: 'الصف', 62: 'الجمعة', 63: 'المنافقون', 64: 'التغابن', 65: 'الطلاق',
    66: 'التحريم', 67: 'الملك', 68: 'القلم', 69: 'الحاقة', 70: 'المعارج',
    71: 'نوح', 72: 'الجن', 73: 'المزمل', 74: 'المدثر', 75: 'القيامة',
    76: 'الإنسان', 77: 'المرسلات', 78: 'النبأ', 79: 'النازعات', 80: 'عبس',
    81: 'التكوير', 82: 'الانفطار', 83: 'المطففين', 84: 'الانشقاق', 85: 'البروج',
    86: 'الطارق', 87: 'الأعلى', 88: 'الغاشية', 89: 'الفجر', 90: 'البلد',
    91: 'الشمس', 92: 'الليل', 93: 'الضحى', 94: 'الشرح', 95: 'التين',
    96: 'العلق', 97: 'القدر', 98: 'البينة', 99: 'الزلزلة', 100: 'العاديات',
    101: 'القارعة', 102: 'التكاثر', 103: 'العصر', 104: 'الهمزة', 105: 'الفيل',
    106: 'قريش', 107: 'الماعون', 108: 'الكوثر', 109: 'الكافرون', 110: 'النصر',
    111: 'المسد', 112: 'الإخلاص', 113: 'الفلق', 114: 'الناس'
  };
  return surahNames[num] || `سورة ${num}`;
}

function getSurahType(num) {
  // Makki: 1-8, 10-12, 14-18, 20-32, 34-46, 50-56, 67-114
  // Madani: 9, 13, 19, 33, 47-49, 57-66
  const madani = [9, 13, 19, 33, 47, 48, 49, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66];
  return madani.includes(num) ? 'مدنية' : 'مكية';
}

function renderSurahList() {
  if (!quranSurahs) return '';

  return `
    <div class="surah-list-header">
      <h3>فهرس السور</h3>
    </div>
    <div class="surah-grid">
      ${quranSurahs.map(s => `
        <button class="surah-card" onclick="openSurah(${s.number})">
          <span class="surah-number">${s.number}</span>
          <span class="surah-info">
            <span class="surah-name">${s.name}</span>
            <span class="surah-meta">${s.englishName} · ${s.numberOfAyahs} آية · ${getSurahType(s.number)}</span>
          </span>
          <span class="surah-arrow">←</span>
        </button>
      `).join('')}
    </div>
  `;
}

async function openSurah(surahNum) {
  const container = document.getElementById('azkarList');
  container.innerHTML = `
    <div class="quran-container">
      <div class="quran-reading-header">
        <button class="back-btn" onclick="renderQuran()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          الفهرس
        </button>
        <div class="quran-surah-title">
          <h2>سورة ${getSurahName(surahNum)}</h2>
          <span class="surah-badge">${getSurahType(surahNum)} · ${quranSurahs ? quranSurahs.find(s => s.number === surahNum)?.numberOfAyahs : ''} آية</span>
        </div>
        <div class="quran-toolbar">
          <button class="quran-tool-btn" onclick="saveReadingPos(${surahNum})" title="حفظ الموضع">📍</button>
          <button class="quran-tool-btn" onclick="quranFontSize(-1)">A-</button>
          <button class="quran-tool-btn" onclick="quranFontSize(1)">A+</button>
        </div>
      </div>
      <div class="quran-loading">⏳ جارِ تحميل الآيات...</div>
    </div>
  `;

  try {
    const res = await fetch(`${QURAN_API}/surah/${surahNum}`);
    const data = await res.json();
    currentSurah = surahNum;
    currentAyahs = data.data.ayahs;

    let ayahsHTML = '<div class="quran-ayahs" id="quranAyahs">';
    data.data.ayahs.forEach(ayah => {
      const isBookmarked = state.quranBookmarks.some(b => b.surah === surahNum && b.ayah === ayah.numberInSurah);
      ayahsHTML += `
        <div class="quran-ayah" id="ayah-${ayah.numberInSurah}" data-surah="${surahNum}" data-ayah="${ayah.numberInSurah}">
          <div class="ayah-controls">
            <button class="ayah-bookmark ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark(${surahNum}, ${ayah.numberInSurah}, '${escapeHTML(ayah.text).replace(/'/g, "\\'")}')" title="${isBookmarked ? 'إلغاء الإشارة' : 'إضافة إشارة'}">
              ${isBookmarked ? '🔖' : '🏷️'}
            </button>
            <span class="ayah-number">${ayah.numberInSurah}</span>
          </div>
          <div class="ayah-text">${ayah.text}</div>
        </div>
      `;
    });
    ayahsHTML += '</div>';

    container.querySelector('.quran-loading').outerHTML = ayahsHTML;

    // Auto-scroll to saved position
    if (state.quranPos && state.quranPos.surah === surahNum) {
      setTimeout(() => {
        const target = document.getElementById(`ayah-${state.quranPos.ayah}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }

    // Save current reading position
    saveReadingPos(surahNum, 1);

  } catch(e) {
    container.querySelector('.quran-loading').outerHTML = '<div class="quran-error">❌ تعذّر تحميل الآيات. تأكد من اتصالك بالإنترنت.</div>';
  }
}

function saveReadingPos(surah, ayah) {
  if (!ayah) {
    // Save at current scroll position
    const ayahs = document.querySelectorAll('.quran-ayah');
    let closest = { surah: currentSurah, ayah: 1 };
    ayahs.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight / 2) {
        closest.ayah = parseInt(el.dataset.ayah);
      }
    });
    state.quranPos = closest;
  } else {
    state.quranPos = { surah, ayah };
  }
  saveState();
  showToast('📍 تم حفظ موضع القراءة');
}

function resumeQuran() {
  if (state.quranPos) {
    openSurah(state.quranPos.surah);
  }
}

function toggleBookmark(surah, ayah, text) {
  const idx = state.quranBookmarks.findIndex(b => b.surah === surah && b.ayah === ayah);

  if (idx >= 0) {
    state.quranBookmarks.splice(idx, 1);
    showToast('تم إلغاء الإشارة المرجعية');
  } else {
    state.quranBookmarks.push({ surah, ayah, text, addedAt: Date.now() });
    state.quranBookmarks.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
    showToast('🔖 تمت الإشارة المرجعية');
    if (navigator.vibrate) navigator.vibrate(20);
  }

  saveQuranBookmarks();
  updateBookmarkButton(surah, ayah);
}

function updateBookmarkButton(surah, ayah) {
  const btn = document.querySelector(`#ayah-${ayah} .ayah-bookmark`);
  if (!btn) return;
  const isBookmarked = state.quranBookmarks.some(b => b.surah === surah && b.ayah === ayah);
  btn.classList.toggle('bookmarked', isBookmarked);
  btn.textContent = isBookmarked ? '🔖' : '🏷️';
  btn.title = isBookmarked ? 'إلغاء الإشارة' : 'إضافة إشارة';
}

function showBookmarks() {
  const container = document.getElementById('azkarList');

  if (state.quranBookmarks.length === 0) {
    container.innerHTML = `
      <div class="quran-container">
        <div class="quran-reading-header">
          <button class="back-btn" onclick="renderQuran()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
            الفهرس
          </button>
          <div class="quran-surah-title"><h2>الإشارات المرجعية</h2></div>
        </div>
        <div class="quran-empty">لا توجد إشارات مرجعية. اضغط 🏷️ بجانب أي آية لإضافتها.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="quran-container">
      <div class="quran-reading-header">
        <button class="back-btn" onclick="renderQuran()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          الفهرس
        </button>
        <div class="quran-surah-title"><h2>الإشارات المرجعية</h2></div>
      </div>
      <div class="bookmarks-list">
        ${state.quranBookmarks.map((b, i) => `
          <div class="bookmark-item" onclick="openSurah(${b.surah}); setTimeout(() => document.getElementById('ayah-${b.ayah}')?.scrollIntoView({behavior:'smooth',block:'center'}), 500)">
            <span class="bookmark-ref">📖 ${getSurahName(b.surah)} — آية ${b.ayah}</span>
            <span class="bookmark-text">${truncateText(b.text, 60)}</span>
            <button class="bookmark-delete" onclick="event.stopPropagation(); toggleBookmark(${b.surah}, ${b.ayah}); showBookmarks()">✕</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function quranFontSize(delta) {
  const ayahsEl = document.getElementById('quranAyahs');
  if (!ayahsEl) return;
  const current = parseFloat(getComputedStyle(ayahsEl).fontSize) || 22;
  ayahsEl.style.fontSize = (current + delta * 2) + 'px';
}

// ═══════════════════════════════════════════
//  Event Listeners
// ═══════════════════════════════════════════

function setupEventListeners() {
  document.getElementById('categoryTabs').addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    setActiveCategory(tab.dataset.cat);
  });

  // Touch swipe for category tabs
  let touchStartX = 0;
  const tabsEl = document.getElementById('categoryTabs');
  tabsEl.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  tabsEl.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      tabsEl.scrollBy({ left: diff * 2, behavior: 'smooth' });
    }
  });

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  setupSearch();

  // Scroll-based reading position save for Quran
  let quranScrollTimer;
  document.addEventListener('scroll', () => {
    if (state.activeCategory === 'quran' && currentSurah) {
      clearTimeout(quranScrollTimer);
      quranScrollTimer = setTimeout(() => saveReadingPos(currentSurah), 2000);
    }
  }, { passive: true });
}

// ─── Boot ───────────────────────────────
document.addEventListener('DOMContentLoaded', init);
