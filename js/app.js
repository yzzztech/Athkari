/* ═══════════════════════════════════════
   أذكاري — App Logic v2
   ═══════════════════════════════════════ */

const STORAGE_KEY = 'athkari_state';
const STREAK_KEY = 'athkari_streak';
const QURAN_POS_KEY = 'athkari_quran_pos';
const QURAN_BOOKMARKS_KEY = 'athkari_quran_bookmarks';
const QURAN_API = 'https://api.alquran.cloud/v1';
const SURAH_API = 'https://dev.surahapp.com/api/v1';

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
//  QURAN MODULE (Surah App API + 3-tab view)
// ═══════════════════════════════════════════

let quranSurahs = null;
let currentSurah = null;
let currentAyahs = [];
let quranActiveTab = 'reading'; // 'reading' | 'tafsir' | 'eerab'

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
  const madani = [9, 13, 19, 33, 47, 48, 49, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66];
  return madani.includes(num) ? 'مدنية' : 'مكية';
}

function getJuzForSurah(surahNum) {
  // Approximate juz mapping
  const juzMap = {1:1,2:1,3:3,4:4,5:6,6:7,7:8,8:9,9:10,10:11,11:12,12:12,13:13,14:13,15:14,16:14,17:15,18:15,19:16,20:16,21:17,22:17,23:18,24:18,25:19,26:19,27:20,28:20,29:21,30:21,31:21,32:21,33:22,34:22,35:22,36:23,37:23,38:23,39:24,40:24,41:25,42:25,43:25,44:25,45:25,46:26,47:26,48:26,49:26,50:26,51:27,52:27,53:27,54:27,55:27,56:27,57:27,58:28,59:28,60:28,61:28,62:28,63:28,64:28,65:28,66:28,67:29,68:29,69:29,70:29,71:29,72:29,73:29,74:29,75:29,76:29,77:29,78:30,79:30,80:30,81:30,82:30,83:30,84:30,85:30,86:30,87:30,88:30,89:30,90:30,91:30,92:30,93:30,94:30,95:30,96:30,97:30,98:30,99:30,100:30,101:30,102:30,103:30,104:30,105:30,106:30,107:30,108:30,109:30,110:30,111:30,112:30,113:30,114:30};
  return juzMap[surahNum] || 1;
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
            <span class="surah-meta">${s.englishName} · ${s.numberOfAyahs} آية · ${getSurahType(s.number)} · الجزء ${getJuzForSurah(s.number)}</span>
          </span>
          <span class="surah-arrow">←</span>
        </button>
      `).join('')}
    </div>
  `;
}

async function openSurah(surahNum, tab = 'reading') {
  quranActiveTab = tab;
  const container = document.getElementById('azkarList');
  const surahMeta = quranSurahs ? quranSurahs.find(s => s.number === surahNum) : null;

  container.innerHTML = `
    <div class="quran-container">
      <div class="quran-reading-header">
        <button class="back-btn" onclick="renderQuran()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          الفهرس
        </button>
        <div class="quran-surah-title">
          <h2>سورة ${getSurahName(surahNum)}</h2>
          <span class="surah-badge">${getSurahType(surahNum)} · ${surahMeta?.numberOfAyahs || ''} آية · الجزء ${getJuzForSurah(surahNum)}</span>
        </div>
        <div class="quran-toolbar">
          <button class="quran-tool-btn" onclick="saveReadingPos(${surahNum})" title="حفظ الموضع">📍</button>
          <button class="quran-tool-btn" onclick="quranFontSize(-1)">A-</button>
          <button class="quran-tool-btn" onclick="quranFontSize(1)">A+</button>
          <button class="quran-tool-btn" onclick="navigator.share ? navigator.share({title:'سورة ${getSurahName(surahNum)}',url:window.location.href}) : showToast('المشاركة غير مدعومة في هذا المتصفح')" title="مشاركة">📤</button>
        </div>
      </div>
      <div class="quran-tabs" id="quranTabs">
        <button class="quran-tab ${quranActiveTab === 'reading' ? 'active' : ''}" onclick="switchQuranTab(${surahNum}, 'reading')">📖 قراءة</button>
        <button class="quran-tab ${quranActiveTab === 'tafsir' ? 'active' : ''}" onclick="switchQuranTab(${surahNum}, 'tafsir')">📚 تفسير</button>
        <button class="quran-tab ${quranActiveTab === 'eerab' ? 'active' : ''}" onclick="switchQuranTab(${surahNum}, 'eerab')">📝 إعراب</button>
      </div>
      <div class="quran-tab-content" id="quranTabContent">
        <div class="quran-loading">⏳ جارِ تحميل المحتوى...</div>
      </div>
    </div>
  `;

  currentSurah = surahNum;
  if (quranActiveTab === 'reading') await loadReadingTab(surahNum);
  else if (quranActiveTab === 'tafsir') await loadTafsirTab(surahNum);
  else if (quranActiveTab === 'eerab') await loadEerabTab(surahNum);
}

async function switchQuranTab(surahNum, tab) {
  quranActiveTab = tab;
  document.querySelectorAll('.quran-tab').forEach(t => t.classList.remove('active'));
  event?.target?.classList.add('active');
  document.getElementById('quranTabContent').innerHTML = '<div class="quran-loading">⏳ جارِ تحميل المحتوى...</div>';

  if (tab === 'reading') await loadReadingTab(surahNum);
  else if (tab === 'tafsir') await loadTafsirTab(surahNum);
  else if (tab === 'eerab') await loadEerabTab(surahNum);
}

async function loadReadingTab(surahNum) {
  const content = document.getElementById('quranTabContent');

  try {
    const res = await fetch(`${QURAN_API}/surah/${surahNum}`);
    const data = await res.json();
    currentAyahs = data.data.ayahs;

    let html = '<div class="quran-ayahs" id="quranAyahs">';
    data.data.ayahs.forEach(ayah => {
      const isBookmarked = state.quranBookmarks.some(b => b.surah === surahNum && b.ayah === ayah.numberInSurah);
      html += `
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
    html += '</div>';
    content.innerHTML = html;

    if (state.quranPos && state.quranPos.surah === surahNum) {
      setTimeout(() => {
        const target = document.getElementById(`ayah-${state.quranPos.ayah}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
    saveReadingPos(surahNum, 1);

  } catch(e) {
    content.innerHTML = '<div class="quran-error">❌ تعذّر تحميل الآيات.</div>';
  }
}

function cleanApiText(text) {
  return text
    .replace(/¥/g, '')        // Remove Surah API section marker
    .replace(/¬/g, '')        // Remove Surah API note marker
    .replace(/\\r\\n/g, '\n') // Convert escaped newlines
    .replace(/\r\n/g, '\n')   // Convert Windows newlines
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .trim();
}

async function loadTafsirTab(surahNum) {
  const content = document.getElementById('quranTabContent');
  content.innerHTML = '<div class="quran-loading">⏳ جارِ تحميل التفسير من تفسير ابن كثير...</div>';

  try {
    const ayahCount = quranSurahs?.find(s => s.number === surahNum)?.numberOfAyahs || 7;
    let html = '<div class="quran-ayahs tafsir-view" id="quranAyahs">';

    for (let a = 1; a <= ayahCount; a++) {
      try {
        const tafsirRes = await fetch(`${SURAH_API}/aya/tafsir-katheer/${surahNum}/${a}`);
        const tafsirData = await tafsirRes.json();

        const ayahRes = await fetch(`${QURAN_API}/ayah/${surahNum}/${a}`);
        const ayahData = await ayahRes.json();
        const ayahText = ayahData.data?.text || '';
        const tafsirText = tafsirData.content ? cleanApiText(tafsirData.content) : '';

        html += `
          <div class="quran-ayah tafsir-ayah" id="ayah-${a}">
            <div class="ayah-controls">
              <span class="ayah-number">${a}</span>
            </div>
            <div class="ayah-text">${ayahText}</div>
            ${tafsirText ? `<div class="tafsir-content">${tafsirText}</div>` : ''}
          </div>
        `;
      } catch(e) {
        html += `<div class="quran-ayah"><span class="ayah-number">${a}</span><div class="quran-error-sm">تعذّر تحميل التفسير</div></div>`;
      }
    }
    html += '</div>';
    content.innerHTML = html;

  } catch(e) {
    content.innerHTML = '<div class="quran-error">❌ تعذّر تحميل التفسير.</div>';
  }
}

async function loadEerabTab(surahNum) {
  const content = document.getElementById('quranTabContent');
  content.innerHTML = '<div class="quran-loading">⏳ جارِ تحميل الإعراب...</div>';

  try {
    const ayahCount = quranSurahs?.find(s => s.number === surahNum)?.numberOfAyahs || 7;
    let html = '<div class="quran-ayahs eerab-view" id="quranAyahs">';

    for (let a = 1; a <= ayahCount; a++) {
      try {
        const eerabRes = await fetch(`${SURAH_API}/aya/eerab-aya/${surahNum}/${a}`);
        const eerabData = await eerabRes.json();
        const eerabText = eerabData.content ? cleanApiText(eerabData.content) : '';

        html += `
          <div class="quran-ayah eerab-ayah" id="ayah-${a}">
            <div class="ayah-controls">
              <span class="ayah-number">${a}</span>
            </div>
            <div class="ayah-text">${eerabData.aya_text || ''}</div>
            ${eerabText ? `<div class="eerab-content"><pre>${eerabText}</pre></div>` : ''}
          </div>
        `;
      } catch(e) {
        html += `<div class="quran-ayah"><span class="ayah-number">${a}</span><div class="quran-error-sm">تعذّر تحميل الإعراب</div></div>`;
      }
    }
    html += '</div>';
    content.innerHTML = html;

  } catch(e) {
    content.innerHTML = '<div class="quran-error">❌ تعذّر تحميل الإعراب.</div>';
  }
}

function saveReadingPos(surah, ayah) {
  if (!ayah) {
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
