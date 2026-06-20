/* ═══════════════════════════════════════
   أذكاري — App Logic v3 (Native Mobile)
   ═══════════════════════════════════════ */

const STORAGE_KEY = 'athkari_state';
const STREAK_KEY = 'athkari_streak';
const QURAN_POS_KEY = 'athkari_quran_pos';
const QURAN_BOOKMARKS_KEY = 'athkari_quran_bookmarks';
const QURAN_API = 'https://api.alquran.cloud/v1';
const SURAH_API = 'https://dev.surahapp.com/api/v1';

// ─── State ──────────────────────────────
const state = {
  activeTab: 'azkar',       // 'azkar' | 'quran' | 'prayer' | 'more'
  azkarCategory: null,       // active azkar category ID
  theme: 'light',
  completed: {},
  counters: {},
  streaks: {},
  quranPos: null,
  quranBookmarks: [],
  quranView: 'list',        // 'list' | 'reading' | 'bookmarks'
  quranActiveTab: 'reading' // reading|tafsir|eerab
};

let quranSurahs = null;
let currentSurah = null;
let currentAyahs = [];

// ─── Init ────────────────────────────────
function init() {
  loadState();
  loadStreaks();
  loadQuranBookmarks();
  applyTheme();
  setupEventListeners();
  navigateTo('azkar');
  updateStreakDisplay();
}

// ─── Persistence ─────────────────────────
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
  } catch(e) { state.quranBookmarks = []; }
}

function saveQuranBookmarks() {
  localStorage.setItem(QURAN_BOOKMARKS_KEY, JSON.stringify(state.quranBookmarks));
}

// ─── Streak Display ──────────────────────
function updateStreakDisplay() {
  const el = document.getElementById('streakDisplay');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  let streak = 0;
  const d = new Date();
  while (state.streaks[d.toISOString().split('T')[0]]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  if (streak > 0) {
    el.innerHTML = `🔥 ${streak}`;
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
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

// ─── Navigation ──────────────────────────
function navigateTo(tab) {
  state.activeTab = tab;
  state.quranView = 'list'; // reset quran view

  // Update tab bar
  document.querySelectorAll('.tab-bar-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tab);
  });

  // Update header & sub-header
  const subHeader = document.getElementById('subHeader');
  const headerTitle = document.getElementById('headerTitle');
  const backBtn = document.getElementById('backBtn');

  subHeader.style.display = 'none';
  backBtn.onclick = null;

  switch (tab) {
    case 'azkar':
      headerTitle.textContent = 'أذكاري';
      renderAzkarTab();
      break;
    case 'quran':
      headerTitle.textContent = 'المصحف';
      renderQuranTab();
      break;
    case 'prayer':
      headerTitle.textContent = 'الصلاة';
      renderPrayerTab();
      break;
    case 'more':
      headerTitle.textContent = 'المزيد';
      renderMoreTab();
      break;
  }

  // Scroll main content to top
  document.getElementById('mainContent').scrollTop = 0;
}

// ─── Sub-header back navigation ──────────
function showSubHeader(title, backFn) {
  const subHeader = document.getElementById('subHeader');
  subHeader.style.display = 'flex';
  document.getElementById('subHeaderTitle').textContent = title;
  const backBtn = document.getElementById('backBtn');
  backBtn.onclick = () => {
    if (state.activeTab === 'quran') {
      state.quranView = 'list';
      renderQuranTab();
    }
    backFn();
  };
}

function hideSubHeader() {
  document.getElementById('subHeader').style.display = 'none';
}

// ═══════════════════════════════════════════
//  AZKAR TAB
// ═══════════════════════════════════════════

function renderAzkarTab() {
  const main = document.getElementById('mainContent');
  const cats = AZKAR_DATA.categories.filter(c => c.id !== 'prayer');

  if (!state.azkarCategory) state.azkarCategory = cats[0].id;

  let html = `
    <div class="category-tabs-wrapper">
      <nav class="category-tabs" id="categoryTabs">
        ${cats.map((cat, i) => `
          <button class="cat-tab cat-${cat.id} ${cat.id === state.azkarCategory ? 'active' : ''}"
                  data-cat="${cat.id}">
            ${cat.icon} ${cat.name}
          </button>
        `).join('')}
      </nav>
    </div>
    <div class="progress-section" id="progressSection">
      <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
      <span class="progress-text" id="progressText">٠/٠</span>
    </div>
    <div id="azkarContent"></div>
    <div class="empty-state" id="emptyState" style="display:none">
      <div class="empty-icon">📿</div>
      <p>اختر قسماً من الأعلى لبدء قراءة أذكارك</p>
    </div>
  `;

  main.innerHTML = html;
  renderAzkarContent(state.azkarCategory);
}

function renderAzkarContent(catId) {
  state.azkarCategory = catId;
  const cat = AZKAR_DATA.categories.find(c => c.id === catId);
  const azkar = cat.azkar || [];

  // Update category tabs
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.cat === catId);
  });
  // Scroll active tab into view
  const activeTab = document.querySelector('.cat-tab.active');
  if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  // Update progress
  const completed = azkar.filter(z => state.completed[z.id]).length;
  document.getElementById('progressFill').style.width = azkar.length ? (completed / azkar.length * 100) + '%' : '0%';
  document.getElementById('progressText').textContent = `${completed}/${azkar.length}`;

  // Render azkar
  const content = document.getElementById('azkarContent');
  if (!azkar.length) {
    content.innerHTML = '<div class="empty-state"><p>لا توجد أذكار في هذا القسم</p></div>';
    return;
  }

  const count = state.counters[catId] || 0;
  if (count > 0) saveStreak();

  content.innerHTML = azkar.map(z => {
    const zCount = state.counters[z.id] || 0;
    const done = state.completed[z.id];
    const max = z.count || 1;
    return `
      <div class="zikr-card ${done ? 'completed' : ''}" data-zikr="${z.id}">
        <span class="completed-check">✅</span>
        <div class="zikr-text">${renderMD(z.text)}</div>
        ${z.benefit ? `<div style="font-size:0.8125rem;color:var(--text-tertiary);text-align:center;margin-bottom:8px">${renderMD(z.benefit)}</div>` : ''}
        <div class="zikr-footer">
          <button class="counter-btn" onclick="decrementZikr('${z.id}')">−</button>
          <span class="counter-count">${zCount}/${max}</span>
          <button class="counter-btn" onclick="incrementZikr('${z.id}', ${max})">+</button>
          ${z.extended ? `<button class="expand-btn" onclick="toggleZikrExpand(this, '${z.id}')">▼</button>` : ''}
        </div>
        ${z.extended ? `<div class="zikr-extended" id="extended-${z.id}" style="display:none;margin-top:8px;padding:10px;background:var(--bg-grouped);border-radius:8px;font-size:0.875rem;color:var(--text-secondary);text-align:center">${renderMD(z.extended)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function incrementZikr(zikrId, max) {
  state.counters[zikrId] = (state.counters[zikrId] || 0) + 1;
  if (state.counters[zikrId] >= max) {
    state.counters[zikrId] = max;
    state.completed[zikrId] = true;
    if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
    showToast('✅ تم');
  } else {
    if (navigator.vibrate) navigator.vibrate(10);
  }
  saveState();
  saveStreak();
  renderAzkarContent(state.azkarCategory);
}

function decrementZikr(zikrId) {
  if (!state.counters[zikrId] || state.counters[zikrId] <= 0) return;
  state.counters[zikrId]--;
  if (state.completed[zikrId]) {
    state.completed[zikrId] = false;
  }
  saveState();
  renderAzkarContent(state.azkarCategory);
}

function toggleZikrExpand(btn, zikrId) {
  const el = document.getElementById('extended-' + zikrId);
  if (!el) return;
  const show = el.style.display === 'none';
  el.style.display = show ? 'block' : 'none';
  btn.textContent = show ? '▲' : '▼';
}

// ═══════════════════════════════════════════
//  QURAN TAB
// ═══════════════════════════════════════════

async function renderQuranTab() {
  const main = document.getElementById('mainContent');
  hideSubHeader();

  if (state.quranView === 'bookmarks') { showBookmarks(); return; }
  if (state.quranView === 'reading' && currentSurah) {
    // Already in reading view — re-render
    await openSurah(currentSurah, true);
    return;
  }

  // Default: surah list
  state.quranView = 'list';
  main.innerHTML = `
    <div class="quran-container">
      <div class="quran-nav-bar">
        <div class="quran-nav-left">
          ${state.quranPos ? `
            <button class="quran-resume-btn" onclick="resumeQuran()">
              📍 متابعة — ${getSurahName(state.quranPos.surah)} ${state.quranPos.ayah}
            </button>
          ` : ''}
        </div>
        <button class="quran-bookmarks-btn" onclick="showBookmarks()" title="الإشارات المرجعية">
          📑 ${state.quranBookmarks.length || ''}
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
      renderQuranTab();
    } catch(e) {
      main.innerHTML = '<div class="quran-error">❌ تعذّر تحميل المصحف. تأكد من اتصالك بالإنترنت.</div>';
    }
  }
}

function renderSurahList() {
  return `
    <div class="surah-list-header"><h3>فهرس سور القرآن الكريم</h3></div>
    <div class="surah-grid">
      ${quranSurahs.map(s => `
        <div class="surah-card" onclick="openSurah(${s.number})">
          <span class="surah-number">${s.number}</span>
          <div class="surah-info">
            <span class="surah-name">${s.name}</span>
            <span class="surah-meta">${s.englishName} · ${getSurahType(s.number)} · ${s.numberOfAyahs} آية</span>
          </div>
          <span class="surah-arrow" style="color:var(--text-tertiary);font-size:0.75rem">←</span>
        </div>
      `).join('')}
    </div>
  `;
}

function getSurahName(num) {
  const names = {1:'الفاتحة',2:'البقرة',3:'آل عمران',4:'النساء',5:'المائدة',6:'الأنعام',7:'الأعراف',8:'الأنفال',9:'التوبة',10:'يونس',11:'هود',12:'يوسف',13:'الرعد',14:'إبراهيم',15:'الحجر',16:'النحل',17:'الإسراء',18:'الكهف',19:'مريم',20:'طه',21:'الأنبياء',22:'الحج',23:'المؤمنون',24:'النور',25:'الفرقان',26:'الشعراء',27:'النمل',28:'القصص',29:'العنكبوت',30:'الروم',31:'لقمان',32:'السجدة',33:'الأحزاب',34:'سبأ',35:'فاطر',36:'يس',37:'الصافات',38:'ص',39:'الزمر',40:'غافر',41:'فصلت',42:'الشورى',43:'الزخرف',44:'الدخان',45:'الجاثية',46:'الأحقاف',47:'محمد',48:'الفتح',49:'الحجرات',50:'ق',51:'الذاريات',52:'الطور',53:'النجم',54:'القمر',55:'الرحمن',56:'الواقعة',57:'الحديد',58:'المجادلة',59:'الحشر',60:'الممتحنة',61:'الصف',62:'الجمعة',63:'المنافقون',64:'التغابن',65:'الطلاق',66:'التحريم',67:'الملك',68:'القلم',69:'الحاقة',70:'المعارج',71:'نوح',72:'الجن',73:'المزمل',74:'المدثر',75:'القيامة',76:'الإنسان',77:'المرسلات',78:'النبأ',79:'النازعات',80:'عبس',81:'التكوير',82:'الانفطار',83:'المطففين',84:'الانشقاق',85:'البروج',86:'الطارق',87:'الأعلى',88:'الغاشية',89:'الفجر',90:'البلد',91:'الشمس',92:'الليل',93:'الضحى',94:'الشرح',95:'التين',96:'العلق',97:'القدر',98:'البينة',99:'الزلزلة',100:'العاديات',101:'القارعة',102:'التكاثر',103:'العصر',104:'الهمزة',105:'الفيل',106:'قريش',107:'الماعون',108:'الكوثر',109:'الكافرون',110:'النصر',111:'المسد',112:'الإخلاص',113:'الفلق',114:'الناس'};
  return names[num] || `سورة ${num}`;
}

function getSurahType(num) {
  const madani = [2,3,4,5,8,9,13,19,22,24,33,47,48,49,57,58,59,60,61,62,63,64,65,66,76,98,110];
  return madani.includes(num) ? 'مدنية' : 'مكية';
}

async function openSurah(surahNum, silent) {
  state.quranView = 'reading';
  currentSurah = surahNum;
  state.quranActiveTab = state.quranActiveTab || 'reading';

  const main = document.getElementById('mainContent');
  const surah = quranSurahs?.find(s => s.number === surahNum);

  showSubHeader(`سورة ${getSurahName(surahNum)}`, () => {
    state.quranView = 'list';
    renderQuranTab();
  });

  document.getElementById('subHeaderTitle').textContent = `سورة ${getSurahName(surahNum)}`;

  main.innerHTML = `
    <div class="quran-container">
      <div class="quran-reading-header">
        <div class="quran-surah-title">
          <h2>${getSurahName(surahNum)} <span class="surah-type-badge">${getSurahType(surahNum)} · ${surah?.numberOfAyahs || ''} آية</span></h2>
        </div>
        <div class="quran-font-controls">
          <button class="quran-font-btn" onclick="quranFontSize(-1)">A−</button>
          <button class="quran-font-btn" onclick="quranFontSize(1)">A+</button>
        </div>
      </div>
      <div class="quran-tabs">
        <button class="quran-tab ${state.quranActiveTab === 'reading' ? 'active' : ''}" onclick="switchQuranTab(${surahNum},'reading')">📖 قراءة</button>
        <button class="quran-tab ${state.quranActiveTab === 'tafsir' ? 'active' : ''}" onclick="switchQuranTab(${surahNum},'tafsir')">📚 تفسير</button>
        <button class="quran-tab ${state.quranActiveTab === 'eerab' ? 'active' : ''}" onclick="switchQuranTab(${surahNum},'eerab')">🔤 إعراب</button>
      </div>
      <div id="quranTabContent"></div>
    </div>
  `;

  if (state.quranActiveTab === 'reading') await loadReadingTab(surahNum);
  else if (state.quranActiveTab === 'tafsir') await loadTafsirTab(surahNum);
  else if (state.quranActiveTab === 'eerab') await loadEerabTab(surahNum);
}

async function switchQuranTab(surahNum, tab) {
  state.quranActiveTab = tab;
  document.querySelectorAll('.quran-tab').forEach(t => t.classList.remove('active'));
  event?.target?.classList.add('active');
  const content = document.getElementById('quranTabContent');
  if (content) content.innerHTML = '<div class="quran-loading">⏳ جارِ تحميل المحتوى...</div>';

  if (tab === 'reading') await loadReadingTab(surahNum);
  else if (tab === 'tafsir') await loadTafsirTab(surahNum);
  else if (tab === 'eerab') await loadEerabTab(surahNum);
}

async function loadReadingTab(surahNum) {
  const content = document.getElementById('quranTabContent');
  if (!content) return;

  try {
    const res = await fetch(`${QURAN_API}/surah/${surahNum}`);
    const data = await res.json();
    currentAyahs = data.data.ayahs;

    let html = '<div class="quran-ayahs" id="quranAyahs">';
    data.data.ayahs.forEach(ayah => {
      const isBookmarked = state.quranBookmarks.some(b => b.surah === surahNum && b.ayah === ayah.numberInSurah);
      html += `
        <div class="quran-ayah ${state.quranPos && state.quranPos.surah === surahNum && state.quranPos.ayah === ayah.numberInSurah ? 'highlight' : ''}"
             id="ayah-${surahNum}-${ayah.numberInSurah}"
             data-surah="${surahNum}" data-ayah="${ayah.numberInSurah}">
          <div class="ayah-controls">
            <button class="ayah-bookmark ${isBookmarked ? 'bookmarked' : ''}"
                    data-surah="${surahNum}" data-ayah="${ayah.numberInSurah}"
                    title="${isBookmarked ? 'إلغاء الإشارة' : 'إضافة إشارة'}">
              ${isBookmarked ? '🔖' : '🏷️'}
            </button>
            <span class="ayah-number">${ayah.numberInSurah}</span>
          </div>
          <div class="ayah-text">${ayah.text}</div>
        </div>`;
    });
    html += '</div>';
    content.innerHTML = html;

    // Scroll to position
    if (state.quranPos && state.quranPos.surah === surahNum) {
      setTimeout(() => {
        const target = document.getElementById(`ayah-${surahNum}-${state.quranPos.ayah}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  } catch(e) {
    content.innerHTML = '<div class="quran-error">❌ تعذّر تحميل الآيات.</div>';
  }
}

function cleanApiText(text) {
  return text
    .replace(/¥/g, '')
    .replace(/¬/g, '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function loadTafsirTab(surahNum) {
  const content = document.getElementById('quranTabContent');
  if (!content) return;
  content.innerHTML = '<div class="quran-loading">⏳ جارِ تحميل التفسير من تفسير ابن كثير...</div>';

  try {
    const ayahCount = quranSurahs?.find(s => s.number === surahNum)?.numberOfAyahs || 7;
    let html = '<div class="quran-ayahs tafsir-view">';

    for (let a = 1; a <= ayahCount; a++) {
      try {
        const tafsirRes = await fetch(`${SURAH_API}/aya/tafsir-katheer/${surahNum}/${a}`);
        const tafsirData = await tafsirRes.json();
        const ayahRes = await fetch(`${QURAN_API}/ayah/${surahNum}/${a}`);
        const ayahData = await ayahRes.json();
        const ayahText = ayahData.data?.text || '';
        const tafsirText = tafsirData.content ? cleanApiText(tafsirData.content) : '';

        html += `
          <div class="quran-ayah tafsir-ayah" id="ayah-${surahNum}-${a}">
            <div class="ayah-controls"><span class="ayah-number">${a}</span></div>
            <div class="ayah-text">${ayahText}</div>
            ${tafsirText ? `<div class="tafsir-content">${renderMD(tafsirText)}</div>` : ''}
          </div>`;
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
  if (!content) return;
  content.innerHTML = '<div class="quran-loading">⏳ جارِ تحميل الإعراب...</div>';

  try {
    const res = await fetch(`${QURAN_API}/surah/${surahNum}`);
    const data = await res.json();
    currentAyahs = data.data.ayahs;

    let html = '<div class="quran-ayahs">';
    for (const ayah of data.data.ayahs) {
      const words = ayah.text.split(' ');
      html += `<div class="quran-ayah" id="ayah-${surahNum}-${ayah.numberInSurah}">
        <div class="ayah-controls"><span class="ayah-number">${ayah.numberInSurah}</span></div>
        <div class="ayah-text">`;
      words.forEach((word, wi) => {
        html += `<span class="eerab-word" onclick="toggleEerab(this,${surahNum},${ayah.numberInSurah},${wi+1})">${word}<span class="eerab-detail"></span></span>`;
      });
      html += `</div></div>`;
    }
    html += '</div>';
    content.innerHTML = html;
  } catch(e) {
    content.innerHTML = '<div class="quran-error">❌ تعذّر تحميل الإعراب.</div>';
  }
}

async function toggleEerab(el, surah, ayah, wordNum) {
  const detail = el.querySelector('.eerab-detail');
  if (el.classList.contains('active')) {
    el.classList.remove('active');
    detail.textContent = '';
    return;
  }

  document.querySelectorAll('.eerab-word.active').forEach(w => w.classList.remove('active'));

  if (detail.textContent) {
    el.classList.add('active');
    return;
  }

  detail.textContent = '⏳';
  el.classList.add('active');

  try {
    const res = await fetch(`${SURAH_API}/word/irab/${surah}/${ayah}/${wordNum}`);
    const data = await res.json();
    const irabText = typeof data === 'string' ? data : (data.content || data.irab || JSON.stringify(data));
    detail.textContent = irabText.replace(/[¥¬]/g, '').trim() || 'لا يوجد إعراب';
  } catch(e) {
    detail.textContent = 'تعذّر تحميل الإعراب';
  }
}

// ─── Quran Bookmarks ─────────────────────
function toggleBookmark(surah, ayah) {
  const idx = state.quranBookmarks.findIndex(b => b.surah === surah && b.ayah === ayah);
  if (idx >= 0) {
    state.quranBookmarks.splice(idx, 1);
    showToast('تم إلغاء الإشارة المرجعية');
  } else {
    // Find the ayah text
    let text = '';
    const ayahEl = document.getElementById(`ayah-${surah}-${ayah}`);
    if (ayahEl) {
      const textEl = ayahEl.querySelector('.ayah-text');
      if (textEl) text = textEl.textContent.trim();
    }
    state.quranBookmarks.push({ surah, ayah, text, addedAt: Date.now() });
    state.quranBookmarks.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
    showToast('🔖 تمت الإشارة المرجعية');
    if (navigator.vibrate) navigator.vibrate(20);
  }
  saveQuranBookmarks();
  updateBookmarkUI(surah, ayah);
}

function updateBookmarkUI(surah, ayah) {
  const btn = document.querySelector(`#ayah-${surah}-${ayah} .ayah-bookmark`);
  if (!btn) return;
  const isBookmarked = state.quranBookmarks.some(b => b.surah === surah && b.ayah === ayah);
  btn.classList.toggle('bookmarked', isBookmarked);
  btn.textContent = isBookmarked ? '🔖' : '🏷️';
  btn.title = isBookmarked ? 'إلغاء الإشارة' : 'إضافة إشارة';
}

function resumeQuran() {
  if (state.quranPos) {
    openSurah(state.quranPos.surah);
  }
}

function showBookmarks() {
  state.quranView = 'bookmarks';
  showSubHeader('الإشارات المرجعية', () => {
    state.quranView = 'list';
    renderQuranTab();
  });

  const main = document.getElementById('mainContent');
  if (state.quranBookmarks.length === 0) {
    main.innerHTML = '<div class="quran-empty">لا توجد إشارات مرجعية. اضغط 🏷️ بجانب أي آية لإضافتها.</div>';
    return;
  }

  main.innerHTML = `
    <div class="bookmarks-list">
      ${state.quranBookmarks.map(b => `
        <div class="bookmark-item" onclick="openSurah(${b.surah});setTimeout(()=>{const el=document.getElementById('ayah-${b.surah}-${b.ayah}');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},500)">
          <span class="bookmark-ref">📖 ${getSurahName(b.surah)} — آية ${b.ayah}</span>
          <span class="bookmark-text">${truncateText(b.text, 60)}</span>
          <button class="bookmark-delete" onclick="event.stopPropagation();toggleBookmark(${b.surah},${b.ayah});showBookmarks()">✕</button>
        </div>
      `).join('')}
    </div>
  `;
}

function saveReadingPos(surah, ayah) {
  state.quranPos = { surah, ayah };
  saveState();
}

function quranFontSize(delta) {
  const el = document.getElementById('quranAyahs');
  if (!el) return;
  const current = parseFloat(getComputedStyle(el).fontSize) || 22;
  el.style.fontSize = (current + delta * 2) + 'px';
}

// ═══════════════════════════════════════════
//  PRAYER TAB
// ═══════════════════════════════════════════

function renderPrayerTab() {
  const main = document.getElementById('mainContent');
  hideSubHeader();
  const cat = AZKAR_DATA.categories.find(c => c.id === 'prayer');

  let html = `<div class="category-header"><h2>${cat?.icon || '🕌'} ${cat?.name || 'كيفية الصلاة'}</h2><p class="time-hint">${cat?.time || ''}</p></div>`;

  // Prayer steps
  html += '<div class="prayer-steps">';
  (AZKAR_DATA.prayerSteps || []).forEach(s => {
    html += `
      <div class="prayer-step">
        <div class="prayer-step-number">${s.step}</div>
        <div class="prayer-step-content">
          <h3 class="prayer-step-title">${s.title}</h3>
          <p class="prayer-step-desc">${renderMD(s.desc)}</p>
          ${s.zikr ? `<div class="prayer-step-zikr">${renderMD(s.zikr)}</div>` : ''}
        </div>
      </div>`;
  });
  html += '</div>';

  // Prayer info sections
  const PI = AZKAR_DATA.prayerInfo;
  if (PI) {
    // Obligatory prayers
    if (PI.fard && PI.fard.prayers) {
      html += `<div class="prayer-table-section"><h3>${PI.fard.title || 'الصلوات المفروضة'}</h3>`;
      PI.fard.prayers.forEach(p => {
        html += `
          <div class="prayer-card" onclick="this.classList.toggle('expanded')">
            <div class="prayer-card-header">
              <span class="prayer-card-name">🕌 ${p.name}</span>
              <span class="prayer-card-count">${p.rakaat} ركعات</span>
            </div>
            <div class="prayer-card-desc">${p.sunnah || ''} · ${p.time || ''}</div>
            <div class="prayer-card-detail">${p.sunnah ? '<p>' + p.sunnah + '</p>' : ''}${p.time ? '<p>الوقت: ' + p.time + '</p>' : ''}</div>
          </div>`;
      });
      html += '</div>';
    }

    // Sunnah prayers
    if (PI.sunan && PI.sunan.prayers) {
      html += `<div class="prayer-table-section"><h3>${PI.sunan.title || 'السنن الرواتب'}</h3>`;
      if (PI.sunan.desc) html += `<p style="padding:0 16px 8px;font-size:0.75rem;color:var(--text-tertiary)">${PI.sunan.desc}</p>`;
      PI.sunan.prayers.forEach(p => {
        html += `
          <div class="prayer-card" onclick="this.classList.toggle('expanded')">
            <div class="prayer-card-header">
              <span class="prayer-card-name">☀️ ${p.name}</span>
              <span class="prayer-card-count">${p.rakaat} ركعات</span>
            </div>
            <div class="prayer-card-desc">${p.note || ''}</div>
            <div class="prayer-card-detail">${p.note || ''}</div>
          </div>`;
      });
      html += '</div>';
    }

    // Additional prayers (witr, duha, tahajjud, etc.)
    const extraKeys = ['witr','duha','tahajjud','tarawih','istikhara','tawbah','hajah','tasabeeh','eid','kusoof','istisqa','janaza','tahiyat_masjid','wudu'];
    const extraPrayers = extraKeys.map(k => PI[k]).filter(Boolean);
    if (extraPrayers.length) {
      html += '<div class="prayer-table-section"><h3>صلوات إضافية</h3>';
      extraPrayers.forEach(p => {
        const detailParts = [];
        if (p.note) detailParts.push('<p>' + p.note + '</p>');
        if (p.zikr) detailParts.push('<p><strong>الذكر/الدعاء:</strong><br>' + renderMD(p.zikr) + '</p>');
        if (p.fadl) detailParts.push('<p><strong>الفضل:</strong> ' + p.fadl + '</p>');
        html += `
          <div class="prayer-card" onclick="this.classList.toggle('expanded')">
            <div class="prayer-card-header">
              <span class="prayer-card-name">🕌 ${p.title || p.name || ''}</span>
              <span class="prayer-card-count">${typeof p.rakaat === 'number' ? p.rakaat + ' ركعات' : (p.rakaat || '')}</span>
            </div>
            <div class="prayer-card-desc">${p.desc || ''}</div>
            <div class="prayer-card-detail">${detailParts.join('')}</div>
          </div>`;
      });
      html += '</div>';
    }
  }

  main.innerHTML = html;
}

// ═══════════════════════════════════════════
//  MORE TAB
// ═══════════════════════════════════════════

function renderMoreTab() {
  const main = document.getElementById('mainContent');
  hideSubHeader();

  main.innerHTML = `
    <div class="grouped-section">
      <div class="grouped-header">المظهر</div>
      <div class="grouped-list">
        <div class="grouped-item" onclick="toggleTheme();renderMoreTab();haptic()">
          <span class="grouped-item-title">${state.theme === 'dark' ? '🌙' : '☀️'} الوضع ${state.theme === 'dark' ? 'الليلي' : 'النهاري'}</span>
          <span class="settings-value">اضغط للتغيير</span>
        </div>
      </div>
    </div>

    <div class="grouped-section">
      <div class="grouped-header">المصحف</div>
      <div class="grouped-list">
        <div class="grouped-item" onclick="navigateTo('quran');state.quranView='bookmarks';showBookmarks()">
          <span class="grouped-item-title">📑 الإشارات المرجعية</span>
          <span class="settings-value">${state.quranBookmarks.length} إشارة</span>
        </div>
        <div class="grouped-item" onclick="navigateTo('quran');resumeQuran()">
          <span class="grouped-item-title">📍 آخر موضع قراءة</span>
          <span class="settings-value">${state.quranPos ? getSurahName(state.quranPos.surah) + ' ' + state.quranPos.ayah : '—'}</span>
        </div>
      </div>
    </div>

    <div class="grouped-section">
      <div class="grouped-header">عن التطبيق</div>
      <div class="grouped-list">
        <div class="grouped-item">
          <span class="grouped-item-title">📿 أذكاري v3.0</span>
          <span class="grouped-item-subtitle">تطبيق أذكار يومية ومصحف ودليل الصلاة</span>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function truncateText(text, max) {
  if (!text) return '';
  return text.length > max ? text.substring(0, max) + '...' : text;
}

function renderMD(text) {
  if (!text) return '';
  let html = text;
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  if (!html.startsWith('<')) html = '<p>' + html + '</p>';
  return html;
}

function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ═══════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════

function setupEventListeners() {
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    toggleTheme();
    haptic();
  });

  // Tab bar navigation
  document.getElementById('tabBar').addEventListener('click', e => {
    const item = e.target.closest('.tab-bar-item');
    if (!item) return;
    haptic();
    navigateTo(item.dataset.tab);
  });

  // Category tabs (delegated on main content)
  document.getElementById('mainContent').addEventListener('click', e => {
    const catTab = e.target.closest('.cat-tab');
    if (catTab && catTab.dataset.cat) {
      haptic();
      renderAzkarContent(catTab.dataset.cat);
    }

    // Bookmark button (event delegation)
    const bookmarkBtn = e.target.closest('.ayah-bookmark');
    if (bookmarkBtn) {
      const surah = parseInt(bookmarkBtn.dataset.surah);
      const ayah = parseInt(bookmarkBtn.dataset.ayah);
      if (surah && ayah) {
        e.stopPropagation();
        toggleBookmark(surah, ayah);
      }
    }
  });

  // Swipe between tabs
  let touchStartX = 0;
  let touchStartY = 0;
  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Only swipe if horizontal movement > vertical
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const tabs = ['azkar', 'quran', 'prayer', 'more'];
      const currentIdx = tabs.indexOf(state.activeTab);
      if (dx < -40 && currentIdx < tabs.length - 1) {
        // Swipe left (RTL: next tab)
        navigateTo(tabs[currentIdx + 1]);
      } else if (dx > 40 && currentIdx > 0) {
        // Swipe right (RTL: previous tab)
        navigateTo(tabs[currentIdx - 1]);
      }
    }
  });

  // Save reading position on scroll
  document.getElementById('mainContent').addEventListener('scroll', () => {
    if (state.activeTab !== 'quran' || state.quranView !== 'reading') return;
    const ayahs = document.querySelectorAll('.quran-ayah');
    let closest = null;
    let closestDist = Infinity;
    const viewTop = document.getElementById('mainContent').scrollTop + 100;
    ayahs.forEach(el => {
      const dist = Math.abs(el.offsetTop - viewTop);
      if (dist < closestDist) {
        closestDist = dist;
        closest = el;
      }
    });
    if (closest) {
      const surah = parseInt(closest.dataset.surah);
      const ayah = parseInt(closest.dataset.ayah);
      if (surah && ayah) saveReadingPos(surah, ayah);
    }
  }, { passive: true });

  // Keyboard shortcut for theme
  document.addEventListener('keydown', e => {
    if (e.key === 't' && e.metaKey) {
      e.preventDefault();
      toggleTheme();
    }
  });
}

// ─── Boot ─────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
