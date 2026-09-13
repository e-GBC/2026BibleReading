/**
 * 2026 Bible Reading App - Core Logic
 */

function safeGetLocalStorage(key, defaultVal) {
    try {
        const val = localStorage.getItem(key);
        return val !== null ? val : defaultVal;
    } catch (e) {
        return defaultVal;
    }
}

// State Management
window.appState = {
    currentDate: getTodayGMT8(),
    readingPlan: [],
    parsedBibleZh: {},
    parsedBibleEn: {},
    chapterProgress: {},
    currentLang: safeGetLocalStorage('bible_reading_lang', 'zh'),
    theme: safeGetLocalStorage('bible_reading_theme', 'light'),
    fontSizeIndex: safeGetLocalStorage('bible_reading_font_idx', null) !== null ? parseInt(safeGetLocalStorage('bible_reading_font_idx', '1')) : 1, // Default to 14pt (index 1)
    activeView: 'dashboard',
    currentBook: null,
    currentChapter: null,
    forceSystemVoice: safeGetLocalStorage('bible_reading_force_system', 'false') === 'true'
};

const appState = window.appState;

// --- CONSTANTS ---
const YEAR_START = new Date("2026-01-01T00:00:00+08:00");
const YEAR_END = new Date("2026-12-31T23:59:59+08:00");
const FONT_SIZES = [12, 14, 16, 18, 20, 24];

const BOOK_MAP = {
    "創世記": "創", "出埃及記": "出", "利未記": "利", "民數記": "民", "申命記": "申",
    "約書亞記": "書", "士師記": "士", "路得記": "得", "撒母耳記上": "撒上", "撒母耳記下": "撒下",
    "列王紀上": "王上", "列王紀下": "王下", "歷代志上": "代上", "歷代志下": "代下",
    "以斯拉記": "拉", "尼希米記": "尼", "以斯帖記": "斯", "約伯記": "伯", "詩篇": "詩",
    "箴言": "箴", "傳道書": "傳", "雅歌": "歌", "以賽亞書": "賽", "耶利米書": "耶",
    "耶利米哀歌": "哀", "以西結書": "結", "但以理書": "但", "何西阿書": "何",
    "約珥書": "珥", "阿摩司書": "摩", "俄巴底亞書": "俄", "約拿書": "拿",
    "彌迦書": "彌", "那鴻書": "鴻", "哈巴谷書": "哈", "西番雅書": "番", "哈該書": "該",
    "撒迦利亞書": "亞", "瑪拉基書": "瑪",
    "馬太福音": "太", "馬可福音": "可", "路加福音": "路", "約翰福音": "約", "使徒行傳": "徒",
    "羅馬書": "羅", "哥林多前書": "林前", "哥林多後書": "林後", "加拉太書": "加", "以弗所書": "弗",
    "腓立比書": "腓", "歌羅西書": "西", "帖撒羅尼迦前書": "帖前", "帖撒羅尼迦後書": "帖後",
    "提摩太前書": "提前", "提摩太後書": "提後", "提多書": "多", "腓利門書": "門", "希伯來書": "來",
    "雅各書": "雅", "彼得前書": "彼前", "彼得後書": "彼後", "約翰一書": "約一", "約翰二書": "約二",
    "約翰三書": "約三", "猶大書": "猶", "啟示錄": "啟"
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
    try {
        // Request persistent storage to protect data from mobile eviction
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(() => {});
        }

        await loadData();
        await loadProgress();
        updateTranslations();
        applyLanguageStyle();
        applyTheme();
        applyFontSize();
        renderDashboard();
        switchView('dashboard');

        // New Logic Priority:
        // 1. (Handled by pwa-handler.js) - Stop if in In-App Browser
        // 2. Check for Welcome Guide (First Time / New User)
        const showedGuide = checkFirstTime();

        // 3. If Welcome Guide didn't show, check for Install Prompt
        if (!showedGuide) {
            checkDailyInstallPrompt();
        }

        checkVoicePackStatus();
    } catch (error) {
        console.error("Initialization Failed:", error);
    }
}

// --- DAILY INSTALL PROMPT ---
function checkDailyInstallPrompt() {
    if (window.suppressGuides) return; // Priority 1 blockage

    // 1. Check if already in standalone mode
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    // 2. Check if shown today
    const todayStr = getDateKey(new Date());
    const lastPromptDate = localStorage.getItem('last_install_prompt_date');

    if (lastPromptDate !== todayStr) {
        // Show banner after a short delay
        setTimeout(() => {
            const banner = document.getElementById('install-prompt-banner');
            if (banner) banner.classList.remove('hidden');
        }, 3000);
    }
}

window.closeInstallPrompt = (todayOnly) => {
    const banner = document.getElementById('install-prompt-banner');
    if (banner) banner.classList.add('hidden');

    if (todayOnly) {
        const todayStr = getDateKey(new Date());
        localStorage.setItem('last_install_prompt_date', todayStr);
    }
};

// --- ONBOARDING GUIDE ---
function checkFirstTime() {
    if (window.suppressGuides) return false; // Priority 1 blockage

    const urlParams = new URLSearchParams(window.location.search);
    const forceShow = urlParams.get('showGuide') === 'true';
    const isFinished = localStorage.getItem('bible_reading_guide_finished');
    const totalChapters = Object.keys(appState.chapterProgress).length;

    // Priority 2: Auto show if forced OR (never finished AND progress is 0)
    // We treat totalChapters === 0 as a "Fresh User" indicator
    if (forceShow || (!isFinished && totalChapters === 0)) {
        showGuide();
        return true;
    }
    return false;
}

window.showGuide = () => {
    const modal = document.getElementById('guide-modal');
    if (modal) modal.classList.remove('hidden');
    nextGuidePage(1);
};

window.nextGuidePage = (pageNum) => {
    document.querySelectorAll('.guide-page').forEach(pg => pg.classList.add('hidden'));
    const target = document.getElementById(`guide-page-${pageNum}`);
    if (target) target.classList.remove('hidden');
};

window.finishGuide = () => {
    localStorage.setItem('bible_reading_guide_finished', 'true');
    const modal = document.getElementById('guide-modal');
    if (modal) modal.classList.add('hidden');
};

// --- LANGUAGE HANDLING ---
window.toggleLanguage = () => {
    // Stop audio first to prevent sync issues
    if (appState.isReading) {
        stopAudioReading();
    }

    appState.currentLang = appState.currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('bible_reading_lang', appState.currentLang);

    updateTranslations();
    applyLanguageStyle();
    renderDashboard();

    if (appState.activeView === 'reader' && appState.currentBook && appState.currentChapter) {
        loadScripture(appState.currentBook, appState.currentChapter);
    }
};

function updateTranslations() {
    const t = translations[appState.currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key] && key !== 'catchUpParams') {
            el.innerHTML = t[key];
        }
    });

    const langBtnText = t.langBtn;
    const dashInfo = document.getElementById('lang-toggle-dashboard');
    const readInfo = document.getElementById('lang-toggle-reader');
    if (dashInfo) dashInfo.innerText = langBtnText;
    if (readInfo) readInfo.innerText = langBtnText;
}

function applyLanguageStyle() {
    document.body.classList.toggle('lang-en', appState.currentLang === 'en');
}

function applyTheme() {
    const isDark = appState.theme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);

    let themeLink = document.getElementById('theme-link');
    if (!themeLink) {
        themeLink = document.createElement('link');
        themeLink.id = 'theme-link';
        themeLink.rel = 'stylesheet';
        document.head.appendChild(themeLink);
    }
    themeLink.href = `css/theme-${isDark ? 'dark' : 'light'}.css?v=1.1.23`;
}

function applyFontSize() {
    const style = document.getElementById('font-size-style') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'font-size-style' }));
    style.innerHTML = `.reader-content p { font-size: ${FONT_SIZES[appState.fontSizeIndex]}pt !important; }`;
}

// --- VIEW MANAGER ---
window.switchView = (viewName) => {
    appState.activeView = viewName;
    document.body.classList.remove('view-dashboard', 'view-reader');
    document.body.classList.add(`view-${viewName}`);
    window.scrollTo(0, 0);

    // Stop audio if returning to dashboard
    if (viewName === 'dashboard' && appState.isReading) {
        stopAudioReading();
    }
};

// --- DATA LOADING ---
async function loadData() {
    const planRes = await fetch('../data/reading_plan.json');
    appState.readingPlan = await planRes.json();

    if (typeof profiles !== 'undefined') appState.parsedBibleZh = parseBibleArray(profiles);
    if (typeof profiles_en !== 'undefined') appState.parsedBibleEn = parseBibleArray(profiles_en);
}

function parseBibleArray(lines) {
    const bible = {};
    const regex = /^(.+?)(\d+):(\d+)\s+(.*)$/;
    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const [_, book, chap, verse, text] = match;
            if (!bible[book]) bible[book] = {};
            if (!bible[book][chap]) bible[book][chap] = {};
            bible[book][chap][verse] = text;
        }
    });
    return bible;
}

// --- DUAL-LAYER STORAGE (IndexedDB + LocalStorage with Auto-Repair) ---
const IDB_NAME = 'GBC_BibleReading_DB';
const IDB_VERSION = 1;
const IDB_STORE = 'reading_progress';

function openProgressDB() {
    return new Promise((resolve) => {
        if (!window.indexedDB) return resolve(null);
        const timer = setTimeout(() => resolve(null), 1500);
        try {
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
            };
            req.onsuccess = (e) => {
                clearTimeout(timer);
                resolve(e.target.result);
            };
            req.onerror = () => {
                clearTimeout(timer);
                resolve(null);
            };
            req.onblocked = () => {
                clearTimeout(timer);
                resolve(null);
            };
        } catch (e) {
            clearTimeout(timer);
            resolve(null);
        }
    });
}

async function getProgressFromIDB() {
    try {
        const db = await openProgressDB();
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const req = store.get('chapterProgress');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

async function saveProgressToIDB(data) {
    try {
        const db = await openProgressDB();
        if (!db) return;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put(data, 'chapterProgress');
    } catch (e) {
        console.warn('[Storage] IDB write failed:', e);
    }
}

async function loadProgress() {
    let loadedFromLS = false;
    try {
        const saved = localStorage.getItem('bible_reading_progress_v2');
        if (saved) {
            appState.chapterProgress = JSON.parse(saved);
            loadedFromLS = true;
        }
    } catch (e) {
        console.warn('[Storage] localStorage read failed:', e);
    }

    // Secondary recovery & sync with IndexedDB
    try {
        const idbData = await getProgressFromIDB();
        if (idbData && typeof idbData === 'object') {
            const idbKeys = Object.keys(idbData).length;
            const lsKeys = Object.keys(appState.chapterProgress || {}).length;
            if (idbKeys > lsKeys) {
                console.log(`[Storage] Restored progress from IndexedDB (${idbKeys} chapters)`);
                appState.chapterProgress = Object.assign({}, idbData, appState.chapterProgress);
                try {
                    localStorage.setItem('bible_reading_progress_v2', JSON.stringify(appState.chapterProgress));
                } catch (err) {}
                updateStats();
                renderDashboard();
            } else if (lsKeys > 0 && idbKeys === 0) {
                saveProgressToIDB(appState.chapterProgress);
            }
        } else if (loadedFromLS && Object.keys(appState.chapterProgress || {}).length > 0) {
            saveProgressToIDB(appState.chapterProgress);
        }
    } catch (e) {
        console.warn('[Storage] IDB sync error:', e);
    }
}

function saveProgress() {
    try {
        localStorage.setItem('bible_reading_progress_v2', JSON.stringify(appState.chapterProgress));
    } catch (e) {
        console.warn('[Storage] localStorage save failed (quota or restricted):', e);
    }
    saveProgressToIDB(appState.chapterProgress);
    updateStats();
    checkGoalReached();
}

/**
 * [New Analytics] Check if user has reached the latest reading goal (up to today)
 */
function checkGoalReached() {
    try {
        const todayStr = getDateKey(getTodayGMT8());
        const pastAndTodayPlans = appState.readingPlan.filter(p => p.date <= todayStr);
        if (pastAndTodayPlans.length === 0) return;

        let allFinished = true;
        for (const p of pastAndTodayPlans) {
            if (Array.isArray(p.chapters)) {
                for (const ch of p.chapters) {
                    const key = `${BOOK_MAP[p.book] || p.book}_${ch}`;
                    if (!appState.chapterProgress[key]) {
                        allFinished = false;
                        break;
                    }
                }
            }
            if (!allFinished) break;
        }

        if (allFinished) {
            const lastGoalReachedDate = safeGetLocalStorage('last_goal_reached_date', null);
            if (lastGoalReachedDate !== todayStr) {
                sendGaEvent('goal_reached', { 'goal_date': todayStr });
                try {
                    localStorage.setItem('last_goal_reached_date', todayStr);
                } catch (e) {}
            }
        }
    } catch (err) {
        console.warn('checkGoalReached non-fatal error:', err);
    }
}

/**
 * [New Analytics] Helper to send GA events safely
 */
function sendGaEvent(name, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', name, params);
    }
}

function saveSettings() {
    localStorage.setItem('bible_reading_theme', appState.theme);
    localStorage.setItem('bible_reading_font_idx', appState.fontSizeIndex);
    localStorage.setItem('bible_reading_lang', appState.currentLang);
    localStorage.setItem('bible_reading_force_system', appState.forceSystemVoice);
}

// --- WAKE LOCK & MEDIA SESSION ---
let wakeLock = null;

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.warn('Wake Lock request failed:', err);
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
}

function updateMediaSession(book, chapter) {
    if ('mediaSession' in navigator) {
        const t = translations[appState.currentLang];
        const displayBook = appState.currentLang === 'en' ? (appState.readingPlan.find(p => p.book === book)?.book_en || book) : book;
        
        navigator.mediaSession.metadata = new MediaMetadata({
            title: `${displayBook} ${chapter}`,
            artist: t.appTitle,
            album: '2026 Bible Reading',
            artwork: [
                { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }
            ]
        });

        navigator.mediaSession.setActionHandler('stop', stopAudioReading);
        navigator.mediaSession.setActionHandler('pause', stopAudioReading);
    }
}

// --- CORE LOGIC ---
function getDateKey(date) {
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const tw = new Date(utc + (3600000 * 8));
    const y = tw.getFullYear();
    const m = String(tw.getMonth() + 1).padStart(2, '0');
    const d = String(tw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getTodayGMT8() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 8));
}

function getPlanForDate(dateStr) {
    const entries = appState.readingPlan.filter(p => p.date === dateStr);
    if (!entries.length) return null;

    const lang = appState.currentLang;
    const descField = lang === 'en' ? 'description_en' : 'description';
    const titles = [...new Set(entries.map(e => e[descField] || e.description))];
    const items = [];

    entries.forEach(e => {
        if (Array.isArray(e.chapters)) {
            e.chapters.forEach(ch => {
                items.push({ book: e.book, book_en: e.book_en, chapter: ch });
            });
        }
    });
    return { date: dateStr, titles, items };
}

/**
 * [BIBLE-V61] Centralized title formatting to handle "Psalms" (篇) vs "Chapters" (章)
 */
function formatChapterTitle(book, chapter) {
    if (appState.currentLang === 'en') {
        const entry = appState.readingPlan.find(p => p.book === book);
        const bookNameEn = entry ? entry.book_en : book;
        return `${bookNameEn} Chapter ${chapter}`;
    }
    const unit = (book === '詩篇' || book === 'Psalms') ? '篇' : '章';
    return `${book} 第 ${chapter} ${unit}`;
}

window.changeDay = (offset) => {
    const newDate = new Date(appState.currentDate);
    newDate.setDate(newDate.getDate() + offset);
    if (newDate < YEAR_START || newDate > YEAR_END) return;
    appState.currentDate = newDate;
    checkReturnButton();
    renderDashboard();
};

window.changeMonth = (offset) => {
    const newDate = new Date(appState.currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    if (newDate < YEAR_START) newDate.setTime(YEAR_START.getTime());
    else if (newDate > YEAR_END) newDate.setTime(YEAR_END.getTime());
    appState.currentDate = newDate;
    checkReturnButton();
    renderDashboard();
};

window.goToToday = () => {
    appState.currentDate = getTodayGMT8();
    checkReturnButton();
    renderDashboard();
};

window.goToDate = (dateStr) => {
    appState.currentDate = new Date(dateStr);
    checkReturnButton();
    renderDashboard();
    window.scrollTo(0, 0);
};

function checkReturnButton() {
    const today = getDateKey(getTodayGMT8());
    const current = getDateKey(appState.currentDate);
    const btn = document.getElementById('btn-return-today');
    if (btn) btn.classList.toggle('hidden', current === today);
}

window.toggleChapter = (book, chapter) => {
    const abbr = BOOK_MAP[book] || book;
    const key = `${abbr}_${chapter}`;
    if (appState.chapterProgress[key]) {
        delete appState.chapterProgress[key];
    } else {
        appState.chapterProgress[key] = true;
        // Tracking: Manual circle click
        sendGaEvent('chapter_completed', { 
            'book': book, 
            'chapter': chapter, 
            'method': 'circle_click' 
        });
    }
    saveProgress();
    renderDashboard();
};

// --- RENDERING ---
function renderDashboard() {
    const t = translations[appState.currentLang];
    const dateStr = getDateKey(appState.currentDate);
    document.querySelector('.date-display').textContent = dateStr;
    const contentDiv = document.querySelector('#today-card .card-content');
    const plan = getPlanForDate(dateStr);

    if (!plan) {
        contentDiv.innerHTML = `<h2>${t.noProgress}</h2>`;
        return;
    }

    // UI Layout: Flush header contains the Description (Title).
    // Original book name display is restored to h3.
    // In English mode, show the description but keep it concise.
    const isEn = appState.currentLang === 'en';
    const grouped = {};
    plan.items.forEach(item => {
        if (!grouped[item.book]) grouped[item.book] = {
            name: isEn ? (item.book_en || item.book) : item.book,
            chapters: [],
            origBook: item.book
        };
        grouped[item.book].chapters.push(item.chapter);
    });

    const groups = Object.values(grouped);
    let html = '';

    // Always render the flush header for Description
    if (plan.titles.length > 0) {
        let titleText = plan.titles[0];
        // If it's English and the title is too long (like "Genesis Chapters 1-3"), 
        // we keep it as provided in JSON but ensure CSS handles potential overflow.
        html += `<div class="titles-container"><h2>${titleText}</h2></div>`;
    }

    html += `<div class="chapters-area">`;
    groups.forEach((group) => {
        const { name, chapters, origBook } = group;
        const abbr = BOOK_MAP[origBook] || origBook;
        html += `<div class="book-group">`;

        // Restore: Book name always as h3 below the blue header
        html += `<h3>${name}</h3>`;

        html += `<div class="chapter-grid">`;
        chapters.forEach(ch => {
            const isDone = appState.chapterProgress[`${abbr}_${ch}`];
            html += `<div class="chapter-circle ${isDone ? 'done' : ''}" onclick="toggleChapter('${origBook}', ${ch})">${ch}</div>`;
        });
        html += `</div></div>`;
    });
    html += `</div>`;

    if (plan.items[0]) {
        const firstUnread = plan.items.find(item => !appState.chapterProgress[`${BOOK_MAP[item.book]}_${item.chapter}`]);
        const targetItem = firstUnread || plan.items[0];
        html += `<div style="padding-bottom: 20px;"><button class="btn-primary" onclick="loadScripture('${targetItem.book}', ${targetItem.chapter})">📖 ${t.startReading}</button></div>`;
    }
    contentDiv.innerHTML = html;

    // Update Month Navigation Labels to actual month names
    const prevMonthBtn = document.querySelector('[onclick="changeMonth(-1)"]');
    const nextMonthBtn = document.querySelector('[onclick="changeMonth(1)"]');
    if (prevMonthBtn && nextMonthBtn) {
        const currentDate = appState.currentDate;
        const prevMonthDate = new Date(currentDate);
        prevMonthDate.setMonth(currentDate.getMonth() - 1);
        const nextMonthDate = new Date(currentDate);
        nextMonthDate.setMonth(currentDate.getMonth() + 1);

        const prevMonthLabel = t.months[prevMonthDate.getMonth()];
        const nextMonthLabel = t.months[nextMonthDate.getMonth()];

        prevMonthBtn.innerText = `◀ ${prevMonthLabel}`;
        nextMonthBtn.innerText = `${nextMonthLabel} ▶`;
    }

    renderCatchUp();
    updateStats();
}

function renderCatchUp() {
    const container = document.getElementById('catch-up-container');
    if (!container) return;

    container.innerHTML = '';
    const start = new Date(YEAR_START);
    const end = getTodayGMT8();
    end.setDate(end.getDate() - 1);

    let earliestUnreadDate = null;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = getDateKey(d);
        const entries = appState.readingPlan.filter(p => p.date === dateStr);
        if (!entries.length) continue;

        let allDone = true;
        entries.forEach(e => {
            if (e.chapters) e.chapters.forEach(ch => {
                if (!appState.chapterProgress[`${BOOK_MAP[e.book]}_${ch}`]) allDone = false;
            });
        });

        if (!allDone) { earliestUnreadDate = dateStr; break; }
    }

    if (earliestUnreadDate) {
        const t = translations[appState.currentLang];
        // Improved centering for multi-line on mobile
        container.innerHTML = `
            <div class="catch-up-banner" onclick="goToDate('${earliestUnreadDate}')">
                <span style="text-align: center; width: 100%;">⚡ ${t.catchUpParams[0]}<br>(${earliestUnreadDate})</span>
            </div>
        `;
    }
}

// --- READER LOGIC ---
window.loadScripture = (bookNameZh, chapter) => {
    const t = translations[appState.currentLang];
    const abbr = BOOK_MAP[bookNameZh];
    let bookData, displayName;

    displayName = formatChapterTitle(bookNameZh, chapter);
    if (appState.currentLang === 'en') {
        const entry = appState.readingPlan.find(p => p.book === bookNameZh);
        const bookNameEn = entry ? entry.book_en : bookNameZh;
        bookData = appState.parsedBibleEn[bookNameEn];
    } else {
        bookData = appState.parsedBibleZh[abbr];
    }

    const verses = bookData[chapter];
    let html = Object.entries(verses).map(([vNum, text]) => {
        const verseKey = `v-${abbr}-${chapter}-${vNum}`;
        return `<p id="${verseKey}"><span class="verse-num" onclick="skipToVerse('${bookNameZh}', ${chapter}, ${vNum}, event)">${chapter}:${vNum}</span> <span class="verse-text">${text}</span></p>`;
    }).join('');
    document.querySelector('.reader-content').innerHTML = `
        <div class="reader-chapter-title-secondary">${displayName}</div>
        ${html}
    `;
    // Header title remains static as "Bible Reading / 經文閱讀"
    // document.querySelector('.chapter-title').textContent = displayName;

    appState.currentBook = bookNameZh;
    appState.currentChapter = chapter;
    renderReaderNav(bookNameZh, chapter);
    switchView('reader');
    updateAudioBtn();
};

function renderReaderNav(currentBookZh, currentChapter) {
    const navDiv = document.querySelector('.reader-nav');
    navDiv.classList.remove('hidden');
    const plan = getPlanForDate(getDateKey(appState.currentDate));
    if (!plan) return;

    const currentIndex = plan.items.findIndex(i => i.book === currentBookZh && i.chapter === currentChapter);
    const t = translations[appState.currentLang];
    let html = currentIndex > 0 ? `<button class="btn-secondary" onclick="loadScripture('${plan.items[currentIndex - 1].book}', ${plan.items[currentIndex - 1].chapter})">◀ ${t.navPrev}</button>` : '<div></div>';

    if (currentIndex < plan.items.length - 1) {
        const next = plan.items[currentIndex + 1];
        html += `<button class="btn-primary" onclick="finishAndNext('${currentBookZh}', ${currentChapter}, '${next.book}', ${next.chapter})">${t.navNext} ▶</button>`;
    } else {
        html += `<button class="btn-primary" onclick="finishAndHome('${currentBookZh}', ${currentChapter})">${t.navFinish} ✅</button>`;
    }
    navDiv.innerHTML = html;
}

window.finishAndNext = (cBook, cChap, nBook, nChap) => {
    appState.chapterProgress[`${BOOK_MAP[cBook] || cBook}_${cChap}`] = true;
    // Tracking: Manual reader navigation
    sendGaEvent('chapter_completed', { 
        'book': cBook, 
        'chapter': cChap, 
        'method': 'reader_next' 
    });
    saveProgress();
    loadScripture(nBook, nChap);
    renderDashboard();
};

window.finishAndHome = (cBook, cChap) => {
    appState.chapterProgress[`${BOOK_MAP[cBook] || cBook}_${cChap}`] = true;
    // Tracking: Manual reader finish
    sendGaEvent('chapter_completed', { 
        'book': cBook, 
        'chapter': cChap, 
        'method': 'reader_finish' 
    });
    saveProgress();
    
    // [New Logic] Catch-up Skip: If marked date < today, jump to next day directly
    const todayStr = getDateKey(getTodayGMT8());
    const currentStr = getDateKey(appState.currentDate);

    if (currentStr < todayStr) {
        const nextDate = new Date(appState.currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        if (nextDate <= YEAR_END) {
            appState.currentDate = nextDate;
            checkReturnButton();
            const nextPlan = getPlanForDate(getDateKey(nextDate));
            if (nextPlan && nextPlan.items.length > 0) {
                // Auto-load next day's first chapter to keep reading momentum
                loadScripture(nextPlan.items[0].book, nextPlan.items[0].chapter);
                renderDashboard();
                return;
            }
        }
    }

    renderDashboard();
    alert(translations[appState.currentLang].congratsBody);
    switchView('dashboard');
};

window.markAllPastDone = () => {
    const todayStr = getDateKey(getTodayGMT8());
    const unreadPlans = appState.readingPlan.filter(p => p.date < todayStr);
    let count = 0;

    unreadPlans.forEach(p => {
        if (Array.isArray(p.chapters)) {
            p.chapters.forEach(ch => {
                const key = `${BOOK_MAP[p.book]}_${ch}`;
                if (!appState.chapterProgress[key]) {
                    appState.chapterProgress[key] = true;
                    count++;
                }
            });
        }
    });

    if (count > 0) {
        const msg = translations[appState.currentLang].confirmMarkAll.replace('%n', count);
        if (confirm(msg)) {
            saveProgress();
            renderDashboard();
        }
    }
};

// --- STATS ---
function updateStats() {
    const t = translations[appState.currentLang];
    const totalChapters = 1189;
    const completedCount = Object.keys(appState.chapterProgress).length;
    const annualPercent = (completedCount / totalChapters) * 100;

    document.querySelector('.annual-progress .progress-bar').style.width = `${Math.round(annualPercent)}%`;
    document.querySelector('.annual-progress .annual-text').textContent =
        `${t.totalProgress} ${completedCount} / ${totalChapters} ${t.chapterUnit} ( ${annualPercent.toFixed(2)}% )`;

    const viewDate = appState.currentDate;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    let monthTotal = 0, monthDone = 0;

    appState.readingPlan.forEach(p => {
        const d = new Date(p.date);
        if (d.getFullYear() === year && d.getMonth() === month && Array.isArray(p.chapters)) {
            p.chapters.forEach(ch => {
                monthTotal++;
                if (appState.chapterProgress[`${BOOK_MAP[p.book]}_${ch}`]) monthDone++;
            });
        }
    });

    const monthPercent = monthTotal > 0 ? (monthDone / monthTotal) * 100 : 0;
    document.querySelector('#monthly-bar').style.width = `${Math.round(monthPercent)}%`;

    // Unified Progress Display
    const progressText = appState.currentLang === 'en' ? "Progress" : "完成";
    document.querySelector('.monthly-text').textContent =
        `${t.months[month]} ${progressText} ${monthDone} / ${monthTotal} ${t.chapterUnit} ( ${Math.round(monthPercent)}% )`;

    // Update Button Icon & Text
    const monthBtn = document.getElementById('month-complete-btn');
    if (monthBtn) {
        const today = getTodayGMT8();
        const todayStr = getDateKey(today);
        const isViewingCurrentMonth = (viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth());

        let unreadUpToToday = 0;
        appState.readingPlan.forEach(p => {
            if (p.date <= todayStr && Array.isArray(p.chapters)) {
                p.chapters.forEach(ch => {
                    if (!appState.chapterProgress[`${BOOK_MAP[p.book]}_${ch}`]) unreadUpToToday++;
                });
            }
        });

        const isFinished = monthDone === monthTotal && monthTotal > 0;

        monthBtn.classList.remove('hidden');
        if (isFinished) {
            // Mode: Clear (100% Done)
            monthBtn.textContent = "✖️ " + t.clearProgress;
            monthBtn.dataset.mode = 'clear';
            monthBtn.style.background = '#95a5a6'; // Gray for clear
        } else if (isViewingCurrentMonth) {
            if (unreadUpToToday > 0) {
                // Mode: Catchup (Current Month, Unread exists)
                monthBtn.textContent = "⬜ " + t.catchUpToToday;
                monthBtn.dataset.mode = 'catchup';
                monthBtn.style.background = ''; // Default orange
            } else {
                // Caught up up to today! Show "Clear Progress" instead of hiding
                monthBtn.textContent = "✖️ " + t.clearProgress;
                monthBtn.dataset.mode = 'clear';
                monthBtn.style.background = '#95a5a6'; // Gray for clear
            }
        } else {
            // Mode: Month Complete (Previous/Future Months, Unread exists)
            monthBtn.textContent = "⬜ " + t.monthComplete;
            monthBtn.dataset.mode = 'month';
            monthBtn.style.background = ''; // Default orange
        }
    }

    // Toggle Visibility of "Mark All Past Done" Tool
    const todayStr = getDateKey(getTodayGMT8());
    const hasUnreadPast = appState.readingPlan.some(p => {
        if (p.date < todayStr && Array.isArray(p.chapters)) {
            return p.chapters.some(ch => !appState.chapterProgress[`${BOOK_MAP[p.book]}_${ch}`]);
        }
        return false;
    });

    const completeBtn = document.getElementById('tool-complete-all');
    if (completeBtn) {
        completeBtn.classList.toggle('hidden', !hasUnreadPast);
    }

    // Ensure Summary button is visible
    const summaryBtn = document.getElementById('summary-btn');
    if (summaryBtn) summaryBtn.classList.remove('hidden');
}

window.completeMonth = () => {
    const viewDate = appState.currentDate;
    const month = viewDate.getMonth();
    const year = viewDate.getFullYear();
    const t = translations[appState.currentLang];
    const monthBtn = document.getElementById('month-complete-btn');
    const mode = monthBtn ? monthBtn.dataset.mode : 'month';

    if (mode === 'catchup') {
        const todayStr = getDateKey(getTodayGMT8());
        const pastAndTodayPlans = appState.readingPlan.filter(p => p.date <= todayStr);
        let unreadCount = 0;
        pastAndTodayPlans.forEach(p => p.chapters?.forEach(ch => {
            if (!appState.chapterProgress[`${BOOK_MAP[p.book]}_${ch}`]) unreadCount++;
        }));

        if (unreadCount > 0) {
            if (confirm(t.confirmMarkAll.replace('%n', unreadCount))) {
                pastAndTodayPlans.forEach(p => p.chapters?.forEach(ch => {
                    appState.chapterProgress[`${BOOK_MAP[p.book]}_${ch}`] = true;
                }));
                saveProgress();
                renderDashboard();
                alert(t.markMonthSuccess.replace('%n', unreadCount));
            }
        }
    } else if (mode === 'clear') {
        const today = getTodayGMT8();
        const todayStr = getDateKey(today);
        const isViewingCurrentMonth = (viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth());

        // Calculate month completion for the viewed month
        let monthTotal = 0, monthDone = 0;
        const monthPlans = appState.readingPlan.filter(p => {
            const d = new Date(p.date);
            const match = d.getFullYear() === year && d.getMonth() === month;
            if (match && Array.isArray(p.chapters)) {
                p.chapters.forEach(ch => {
                    monthTotal++;
                    if (appState.chapterProgress[`${BOOK_MAP[p.book]}_${ch}`]) monthDone++;
                });
            }
            return match;
        });
        const isFinished = monthDone === monthTotal && monthTotal > 0;

        // If current month and not fully finished, only clear up to today
        if (isViewingCurrentMonth && !isFinished) {
            if (confirm(t.confirmClearMonth)) {
                monthPlans.forEach(p => {
                    if (p.date <= todayStr && Array.isArray(p.chapters)) {
                        p.chapters.forEach(ch => delete appState.chapterProgress[`${BOOK_MAP[p.book]}_${ch}`]);
                    }
                });
                saveProgress();
                renderDashboard();
                alert(t.monthCleared.replace('%m', t.months[month]));
            }
        } else {
            // Clear the entire viewed month
            if (confirm(t.confirmClearMonth)) {
                monthPlans.forEach(p => p.chapters?.forEach(ch => delete appState.chapterProgress[`${BOOK_MAP[p.book]}_${ch}`]));
                saveProgress();
                renderDashboard();
                alert(t.monthCleared.replace('%m', t.months[month]));
            }
        }
    } else {
        // Mode: Month (Complete the viewed month)
        const monthPlans = appState.readingPlan.filter(p => {
            const d = new Date(p.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });

        let unreadKeys = [];
        monthPlans.forEach(p => p.chapters?.forEach(ch => {
            const key = `${BOOK_MAP[p.book]}_${ch}`;
            if (!appState.chapterProgress[key]) unreadKeys.push(key);
        }));

        if (unreadKeys.length > 0) {
            const count = unreadKeys.length;
            if (confirm(t.confirmMarkMonth.replace('%n', count))) {
                unreadKeys.forEach(key => appState.chapterProgress[key] = true);
                saveProgress();
                renderDashboard();
                alert(t.markMonthSuccess.replace('%n', count));
            }
        }
    }
};

// --- DATA TOOLS ---
window.exportData = async () => {
    const d = new Date();
    const fileName = `GBC2026_Progress_${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    const exportObj = {
        progress: appState.chapterProgress,
        settings: {
            theme: appState.theme,
            fontIdx: appState.fontSizeIndex,
            lang: appState.currentLang
        }
    };
    const jsonStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // 1. Mobile Web Share API (native iOS / Android file share sheet)
    if (navigator.canShare) {
        try {
            const file = new File([blob], fileName, { type: 'application/json' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: '懷恩堂讀經進度存檔',
                    text: '2026 懷恩堂讀經進度備份檔案'
                });
                showToast("存檔已送出！");
                return;
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
        }
    }

    // 2. Desktop Fallback
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 1000);
    showToast("存檔備份已下載！");
};

window.diagnoseStorage = () => {
    let lsStatus = '正常';
    try {
        localStorage.setItem('__gbc_test__', '1');
        if (localStorage.getItem('__gbc_test__') !== '1') lsStatus = '讀取異常';
        localStorage.removeItem('__gbc_test__');
    } catch (e) {
        lsStatus = '遭系統鎖定唯讀或空間滿載 (' + e.name + ')';
    }

    const completed = Object.keys(appState.chapterProgress || {}).length;
    let report = `【讀經存檔狀態診斷】\n\n`;
    report += `📱 目前打勾章數：${completed} 章\n`;
    report += `💾 LocalStorage 快取：${lsStatus === '正常' ? '✅ 正常可讀寫' : '❌ ' + lsStatus}\n`;
    report += `🗄️ IndexedDB 持久庫：${window.indexedDB ? '✅ 支援並啟用' : '❌ 不支援'}\n\n`;

    if (lsStatus !== '正常') {
        report += `⚠️ 檢測到手機先前儲存容量滿載，導致瀏覽器將儲存區鎖定為唯讀狀態，無法寫入新進度。\n\n`;
    } else {
        report += `✅ 目前系統運作正常，點選章節皆會自動存檔保護！\n\n`;
    }

    report += `----------------------------\n`;
    report += `🔧【手機手動修復指南】\n`;
    report += `若發生打勾無法存檔或遭鎖定：\n\n`;
    report += `📱 iPhone (Safari)：\n`;
    report += `請打開手機「設定」>「Safari」>「進階」>「網站資料」，找到 github.io 往左滑點「刪除」，重新點開 APP 即可徹底解除手機系統鎖定！\n\n`;
    report += `🤖 Android (Chrome)：\n`;
    report += `請於網址列左側點「設定/鎖頭圖示」>「網站設定」>「清除資料並重設」，重新開啟即可恢復！`;

    alert(report);
};

window.importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.progress) {
                    appState.chapterProgress = data.progress;
                    if (data.settings) {
                        if (data.settings.theme) localStorage.setItem('bible_reading_theme', data.settings.theme);
                        if (data.settings.fontIdx !== undefined) localStorage.setItem('bible_reading_font_idx', data.settings.fontIdx);
                        if (data.settings.lang) localStorage.setItem('bible_reading_lang', data.settings.lang);
                    }
                } else {
                    appState.chapterProgress = data;
                }
                saveProgress();
                alert(translations[appState.currentLang].importSuccess);
                location.reload();
            } catch (err) {
                alert(translations[appState.currentLang].importError);
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

window.toggleFontSize = () => {
    appState.fontSizeIndex = (appState.fontSizeIndex + 1) % FONT_SIZES.length;
    applyFontSize();
    saveSettings();
    showToast(`${FONT_SIZES[appState.fontSizeIndex]}pt`);
};

// --- TOOL SHEET ---
window.toggleTools = () => {
    const overlay = document.getElementById('tools-overlay');
    const sheet = document.getElementById('tools-sheet');
    if (!overlay || !sheet) return;

    const isHidden = sheet.classList.contains('hidden');
    if (isHidden) {
        // [V55] Conditional tool item visibility
        const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
        const installBtn = document.getElementById('tool-install-app');
        if (installBtn) installBtn.classList.toggle('hidden', isStandalone);

        const todayStr = getDateKey(getTodayGMT8());
        const hasUnreadPast = appState.readingPlan.some(p => {
            if (p.date < todayStr && Array.isArray(p.chapters)) {
                return p.chapters.some(ch => !appState.chapterProgress[`${BOOK_MAP[p.book]}_${ch}`]);
            }
            return false;
        });
        const completeBtn = document.getElementById('tool-complete-all');
        if (completeBtn) completeBtn.classList.toggle('hidden', !hasUnreadPast);

        openTools();
    } else {
        overlay.classList.add('hidden');
        sheet.classList.add('hidden');
        document.body.style.overflow = '';
    }
};

window.openTools = () => {
    const overlay = document.getElementById('tools-overlay');
    const sheet = document.getElementById('tools-sheet');
    if (overlay && sheet) {
        overlay.classList.remove('hidden');
        sheet.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
};

window.forceUpdateApp = async () => {
    const isEn = appState.currentLang === 'en';
    showToast(isEn ? "Updating to v1.1.26..." : "正在為您更新至 v1.1.26 並清除快取...");

    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        } catch (e) {}
    }
    if ('caches' in window) {
        try {
            const names = await caches.keys();
            for (let name of names) {
                await caches.delete(name);
            }
        } catch (e) {}
    }
    setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('reload', Date.now().toString());
        window.location.replace(url.toString());
    }, 1000);
};

window.clearAppCache = window.forceUpdateApp;

function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.style = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); color: white; padding: 12px 24px;
            border-radius: 50px; z-index: 10000; font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 4000);
}

// --- AUDIO READING (AI VOICE) ---
appState.isReading = false;
let audioTimer = null;
let ttsEngine = null;
let ttsModule = null;
let audioCtx = null;
let audioSource = null;
let isTtsInitializing = false;
let aiVoiceFailedPermanently = localStorage.getItem('bible_tts_skip_ai') === 'true';

async function initTtsEngine() {
    if (appState.forceSystemVoice) return false; // Option A: Force system voice
    if (ttsEngine) return true;
    if (aiVoiceFailedPermanently) return false;
    if (isTtsInitializing) return false;
    isTtsInitializing = true;

    // --- [CHECK CODE: BIBLE-V47-UIUX-REFINEMENT] ---
    console.log('[TTS-INIT] Starting initialization. Check Code: BIBLE-V47-UIUX-REFINEMENT');
    updateAudioBtn(false, true); // Loading state
    showToast(appState.currentLang === 'en' ? "Initializing AI Voice..." : "正在啟動 AI 語音引擎...");

    try {
        // Load Transformers.js dynamically
        console.log('[TTS-INIT] Loading Transformers.js from CDN...');
        const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');

        // Configure Transformers.js environment
        env.allowLocalModels = false;
        env.useCustomCache = true;

        console.log('[TTS-INIT] Loading pipeline (text-to-speech: Xenova/mms-tts-zho)...');
        ttsEngine = await pipeline('text-to-speech', 'Xenova/mms-tts-zho', {
            progress_callback: (p) => {
                if (p.status === 'progress') {
                    const percent = Math.round((p.loaded / (p.total || 50000000)) * 100);
                    showToast(appState.currentLang === 'zh' ? `正在啟動 AI 讀經... ${percent}%` : `Loading AI Voice... ${percent}%`);
                }
            }
        });

        console.log('Transformers.js TTS Engine initialized successfully');
        showToast(appState.currentLang === 'en' ? "AI Voice Ready" : "語音引擎啟動完成");
        isTtsInitializing = false;
        return true;
    } catch (err) {
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
            aiVoiceFailedPermanently = true;
            localStorage.setItem('bible_tts_skip_ai', 'true');
            console.warn('[TTS-INIT] AI Voice blocked (401). Fallback saved to storage to avoid future errors.');
        } else {
            console.error('Transformers.js Initialization Error:', err);
        }
        showToast(appState.currentLang === 'en' ? "Using High-Quality System Voice" : "切換至高品質系統語音...");
        isTtsInitializing = false;
        return false;
    }
}

function playAudioBuffer(samples, sampleRate, onEnd) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const buffer = audioCtx.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);

    if (audioSource) {
        try { audioSource.stop(); } catch (e) { }
    }

    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = buffer;

    // [V36] EQ: Bass Boost (Low Shelf Filter) for richer voice
    const bassBoost = audioCtx.createBiquadFilter();
    bassBoost.type = 'lowshelf';
    bassBoost.frequency.value = 200; // Frequencies below 200Hz
    bassBoost.gain.value = 6;       // 6dB boost

    audioSource.connect(bassBoost);
    bassBoost.connect(audioCtx.destination);

    audioSource.onended = onEnd;
    audioSource.start();
}

window.toggleAudioReading = async () => {
    console.log('[USER-ACTION] Toggle Audio Reading. Check Code: BIBLE-V47-UIUX-REFINEMENT');
    if (appState.isReading) {
        stopAudioReading();
    } else {
        appState.isReading = true;
        updateAudioBtn();
        // [V23] Status Notification
        if (appState.forceSystemVoice) {
            showToast("正在使用系統穩定語音模式");
        } else {
            showToast("正在嘗試啟動 AI 高品質語音...");
        }
        startReadingCurrentChapter();
    }
};


window.checkVoicePackStatus = async () => {
    const btn = document.getElementById('tool-download-voice');
    if (!btn) return;
    // [V35] Default to hidden because we use System/Transformers logic
    btn.style.display = 'none';
};

window.downloadVoicePack = async () => {
    const isZh = appState.currentLang === 'zh';
    showToast(isZh ? "AI 語音功能已優化，無需額外下載。" : "AI Voice is optimized, no extra download needed.");
};

function stopAudioReading() {
    appState.isReading = false;

    // Stop Web Speech API
    window.speechSynthesis.cancel();

    // Stop Sherpa-ONNX Audio
    if (audioSource) {
        try { audioSource.stop(); } catch (e) { }
        audioSource = null;
    }

    if (audioTimer) clearTimeout(audioTimer);

    // Clear Any Verse Highlights
    document.querySelectorAll('.verse-highlight').forEach(el => el.classList.remove('verse-highlight'));

    releaseWakeLock(); // Release lock when audio stops
    updateAudioBtn();
}

function updateAudioBtn(isWaiting = false, isLoading = false) {
    const btn = document.getElementById('btn-audio-reading');
    if (!btn) return;
    const t = translations[appState.currentLang];

    if (isLoading) {
        btn.textContent = '...';
        btn.style.background = '#dfe6e9';
    } else if (isWaiting) {
        btn.textContent = t.audioWait;
        btn.style.background = '#ffeaa7';
    } else if (appState.isReading) {
        btn.textContent = t.audioStop;
        btn.style.background = '#ff7675';
        btn.style.color = 'white';
    } else {
        btn.textContent = t.audioPlay;
        btn.style.background = '#f0f0f0';
        btn.style.color = '';
    }
}

async function startReadingCurrentChapter() {
    if (!appState.isReading) return;

    requestWakeLock(); // Option C: Prevent screen sleep
    
    // 1. Prepare Content
    const isEn = appState.currentLang === 'en';
    const book = appState.currentBook;
    const chapter = appState.currentChapter;
    const abbr = BOOK_MAP[book];

    let bookData;
    let displayName = formatChapterTitle(book, chapter);
    if (isEn) {
        const entry = appState.readingPlan.find(p => p.book === book);
        const bookNameEn = entry ? entry.book_en : book;
        bookData = appState.parsedBibleEn[bookNameEn];
    } else {
        bookData = appState.parsedBibleZh[abbr];
    }

    if (!bookData || !bookData[chapter]) {
        stopAudioReading();
        return;
    }

    const verses = bookData[chapter];
    const cleanVerses = Object.values(verses).join(' ');
    const fullTextToRead = isEn ? `${displayName}. ${cleanVerses}` : `${displayName}。 ${cleanVerses}`;
    
    updateMediaSession(book, chapter); // Option C: Background playback stability
    // console.log(`[TTS-PREPARE] Text length: ${fullTextToRead.length}, Lang: ${appState.currentLang}`);

    // 2. Use Sherpa-ONNX for Chinese voice, Fallback to Web Speech for English
    if (!isEn) {
        const ok = await initTtsEngine();
        if (!ok) {
            // Fallback to Web Speech API if Sherpa fails
            readWithWebSpeech(fullTextToRead, 'zh-TW');
            return;
        }

        // Generate and Play in chunks to prevent memory/timeout issues for long chapters
        try {
            // Option B: Finer chunking (split by more punctuation to keep chunks small)
            const chunks = fullTextToRead.split(/([。！?？；\n,，：:])/).reduce((acc, part, i) => {
                if (i % 2 === 0) acc.push(part);
                else if (acc.length > 0) acc[acc.length - 1] += part;
                return acc;
            }, []).filter(s => s.trim().length > 0);

            let chunkIdx = 0;
            const playSequentially = async () => {
                if (!appState.isReading || chunkIdx >= chunks.length) {
                    if (chunkIdx >= chunks.length) handleReadingEnd();
                    return;
                }

                const chunk = chunks[chunkIdx];
                try {
                    const output = await ttsEngine(chunk, {
                        length_scale: 1.0, // Natural reading speed (was 0.5 causing unintelligible 2x compression)
                        noise_scale: 0.667,
                        noise_scale_w: 0.8
                    });

                    playAudioBuffer(output.audio, output.sampling_rate, () => {
                        // Clear memory references
                        output.audio = null; 
                        chunkIdx++;
                        playSequentially();
                    });

                    // Update highlighting
                    highlightVerseByText(chunk);
                } catch (e) {
                    console.error('AI Chunk Generation error:', e);
                    // Fallback remaining text to system voice
                    const remaining = chunks.slice(chunkIdx).join('');
                    readWithWebSpeech(remaining, 'zh-TW');
                }
            };

            playSequentially();
        } catch (err) {
            console.error('TTS Initialization/Splitting error:', err);
            readWithWebSpeech(fullTextToRead, 'zh-TW');
        }
    } else {
        readWithWebSpeech(fullTextToRead, 'en-US');
    }
}

let speechChunks = [];
let voiceQueueIndex = 0;
let lastMatchedVerseIdx = 0; // Prevent jumping back
let currentUtterance = null;
let systemVoices = [];

function loadSystemVoices() {
    if ('speechSynthesis' in window) {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) systemVoices = v;
    }
}
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadSystemVoices;
    loadSystemVoices();
}

function readWithWebSpeech(text, lang) {
    // Split by more punctuation
    speechChunks = text.split(/([.。\n!！?？;；,，:：])/).reduce((acc, part, i) => {
        if (i % 2 === 0) acc.push(part);
        else if (acc.length > 0) acc[acc.length - 1] += part;
        return acc;
    }, []).filter(s => s.trim().length > 0);

    voiceQueueIndex = 0;
    lastMatchedVerseIdx = 0; // Reset tracking
    window.speechSynthesis.cancel();
    setTimeout(() => playNextChunk(lang), 300);
}

function playNextChunk(lang) {
    if (!appState.isReading || voiceQueueIndex >= speechChunks.length) {
        handleReadingEnd();
        return;
    }

    const chunkText = speechChunks[voiceQueueIndex];
    currentUtterance = new SpeechSynthesisUtterance(chunkText);
    const isZh = lang.startsWith('zh');
    currentUtterance.lang = isZh ? 'zh-TW' : (lang === 'en-US' ? 'en-US' : lang);

    const availableVoices = (window.speechSynthesis.getVoices().length > 0) ? window.speechSynthesis.getVoices() : systemVoices;
    let selectedVoice = null;

    if (isZh) {
        // High-quality Taiwanese Traditional Chinese voices
        const twKeywords = ['美佳', 'Meijia', 'Hanhan', 'Yating', 'Google 國語', '臺灣', 'Taiwan', 'zh-TW', 'zh_TW'];
        selectedVoice = availableVoices.find(v => (v.lang === 'zh-TW' || v.lang === 'zh_TW' || v.lang === 'cmn-Hant-TW') && twKeywords.some(k => v.name.includes(k))) ||
            availableVoices.find(v => v.lang === 'zh-TW' || v.lang === 'zh_TW' || v.lang === 'cmn-Hant-TW') ||
            availableVoices.find(v => v.lang.startsWith('zh') && twKeywords.some(k => v.name.includes(k))) ||
            availableVoices.find(v => v.lang.startsWith('zh'));
    } else {
        const enKeywords = ['Samantha', 'Zira', 'Google US English', 'en-US'];
        selectedVoice = availableVoices.find(v => v.lang.startsWith('en') && enKeywords.some(k => v.name.includes(k))) ||
            availableVoices.find(v => v.lang.startsWith('en'));
    }

    if (selectedVoice) currentUtterance.voice = selectedVoice;

    // Natural clarity parameters (rate: 0.95, pitch: 1.0)
    currentUtterance.rate = 0.95;
    currentUtterance.pitch = 1.0;

    currentUtterance.onend = () => {
        voiceQueueIndex++;
        currentUtterance = null;
        if (appState.isReading) playNextChunk(lang);
    };

    currentUtterance.onerror = (e) => {
        if (e.error === 'interrupted') return;
        console.error('[TTS-FALLBACK] Chunk error:', e);
        stopAudioReading();
    };

    window.speechSynthesis.speak(currentUtterance);
    highlightVerseByText(chunkText);
}

function highlightVerseByText(text) {
    const reader = document.querySelector('.reader-content');
    if (!reader) return;

    const cleanChunk = text.trim().replace(/[.,!?:;，。！？：；\s]/g, '');
    if (cleanChunk.length < 2) return;

    const verseElements = Array.from(reader.querySelectorAll('p'));

    // Search forward from the last matched verse to prevent jumping backwards
    let matchIdx = -1;
    for (let i = lastMatchedVerseIdx; i < verseElements.length; i++) {
        const verseText = (verseElements[i].querySelector('.verse-text')?.textContent || '').replace(/[.,!?:;，。！？：；\s]/g, '');
        if (verseText.includes(cleanChunk.substring(0, 15)) || cleanChunk.includes(verseText.substring(0, 15))) {
            matchIdx = i;
            break;
        }
    }

    if (matchIdx !== -1) {
        lastMatchedVerseIdx = matchIdx; // Update progress
        const match = verseElements[matchIdx];
        reader.querySelectorAll('.verse-highlight').forEach(el => el.classList.remove('verse-highlight'));
        match.classList.add('verse-highlight');
        match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

window.skipToVerse = (book, chapter, vNum, event) => {
    if (event) event.stopPropagation();
    console.log(`[USER-ACTION] Skip to Verse: ${book} ${chapter}:${vNum}`);

    if (!appState.isReading) {
        appState.isReading = true;
        updateAudioBtn();
    }

    stopSpeechEngines(); // Custom helper to stop all

    const isEn = appState.currentLang === 'en';
    const abbr = BOOK_MAP[book];
    const bookData = isEn ? appState.parsedBibleEn[appState.readingPlan.find(p => p.book === book).book_en] : appState.parsedBibleZh[abbr];
    const verses = bookData[chapter];

    // Get text starting from this verse
    const remainingVerses = Object.entries(verses)
        .filter(([num]) => parseInt(num) >= vNum)
        .map(([_, text]) => text)
        .join(' ');

    const displayName = formatChapterTitle(book, chapter);
    const fullText = (vNum === 1) ?
        (`${displayName}. ${remainingVerses}`) :
        remainingVerses;

    if (isEn) {
        readWithWebSpeech(fullText, 'en-US');
    } else {
        // AI Voice skip (re-init if needed or just use fallback for simplicity of 'skip')
        // For now, let's use Web Speech for instant skip feedback, or refactor startReading if needed.
        readWithWebSpeech(fullText, 'zh-TW');
    }
};

function stopSpeechEngines() {
    window.speechSynthesis.cancel();
    if (audioSource) { try { audioSource.stop(); } catch (e) { } audioSource = null; }
    if (audioTimer) clearTimeout(audioTimer);
}

function handleReadingEnd() {
    if (!appState.isReading) return;
    const next = findNextChapterToday();
    if (next) {
        updateAudioBtn(true);
        audioTimer = setTimeout(() => {
            finishAndNext(appState.currentBook, appState.currentChapter, next.book, next.chapter);
            setTimeout(() => startReadingCurrentChapter(), 500);
        }, 5000);
    } else {
        // Auto-finish today's progress after 5s if last chapter
        updateAudioBtn(true);
        showToast(appState.currentLang === 'en' ? "Daily plan finished! Completing..." : "今日進度已讀完，即將自動完成...");
        audioTimer = setTimeout(() => {
            const cBook = appState.currentBook;
            const cChap = appState.currentChapter;
            appState.chapterProgress[`${BOOK_MAP[cBook] || cBook}_${cChap}`] = true;
            // Tracking: Auto-finish after audio
            sendGaEvent('chapter_completed', { 
                'book': cBook, 
                'chapter': cChap, 
                'method': 'audio_auto_finish' 
            });
            saveProgress();
            renderDashboard();
            stopAudioReading();
            alert(translations[appState.currentLang].congratsBody);
            switchView('dashboard');
        }, 5000);
    }
}

function findNextChapterToday() {
    const dateStr = getDateKey(appState.currentDate);
    const plan = getPlanForDate(dateStr);
    if (!plan) return null;

    const currentIndex = plan.items.findIndex(i => i.book === appState.currentBook && i.chapter === appState.currentChapter);
    if (currentIndex >= 0 && currentIndex < plan.items.length - 1) {
        return plan.items[currentIndex + 1];
    }
    return null;
}



// --- APPEARANCE SETTINGS ---
window.showAppearanceSettings = () => {
    appState.tempTheme = appState.theme;
    appState.tempFontIdx = appState.fontSizeIndex;
    appState.tempLang = appState.currentLang;

    document.getElementById('theme-toggle').checked = appState.tempTheme === 'dark';
    document.getElementById('lang-toggle-setting').checked = appState.tempLang === 'en';
    document.getElementById('force-system-voice-toggle').checked = appState.forceSystemVoice;

    applyTheme(); // Ensure initial state is correct
    updateAppearancePreview();

    document.getElementById('appearance-overlay').classList.remove('hidden');
    document.getElementById('tools-sheet').classList.add('hidden');
    document.getElementById('tools-overlay').classList.add('hidden');
};

window.closeAppearanceSettings = () => {
    // Restore original values from storage if closing without saving
    appState.theme = localStorage.getItem('bible_reading_theme') || 'light';
    appState.currentLang = localStorage.getItem('bible_reading_lang') || 'zh';
    appState.fontSizeIndex = localStorage.getItem('bible_reading_font_idx') !== null ? parseInt(localStorage.getItem('bible_reading_font_idx')) : 1;

    applyTheme();
    updateTranslations();
    applyLanguageStyle();
    applyFontSize();
    renderDashboard();

    if (appState.activeView === 'reader' && appState.currentBook) {
        loadScripture(appState.currentBook, appState.currentChapter);
    }

    const overlay = document.getElementById('appearance-overlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
};

window.previewTheme = () => {
    appState.theme = document.getElementById('theme-toggle').checked ? 'dark' : 'light';
    appState.tempTheme = appState.theme; // Keep temp in sync if needed
    applyTheme();
};

window.previewLang = () => {
    const isEn = document.getElementById('lang-toggle-setting').checked;
    appState.currentLang = isEn ? 'en' : 'zh';
    appState.tempLang = appState.currentLang;

    updateTranslations();
    applyLanguageStyle();
    renderDashboard();

    if (appState.activeView === 'reader' && appState.currentBook) {
        loadScripture(appState.currentBook, appState.currentChapter);
    }
};

window.changeFontSizeLevel = (offset) => {
    const newIdx = appState.tempFontIdx + offset;
    if (newIdx >= 0 && newIdx < FONT_SIZES.length) {
        appState.tempFontIdx = newIdx;
        updateAppearancePreview();
    }
};

function updateAppearancePreview() {
    const preview = document.getElementById('font-size-preview');
    if (preview) {
        const size = FONT_SIZES[appState.tempFontIdx];
        preview.style.fontSize = `${size}pt`;
        preview.innerText = `${size}pt - Aa`;
    }
}


window.resetAppearance = () => {
    appState.theme = 'light';
    appState.currentLang = 'zh';
    appState.fontSizeIndex = 1; // Default 14pt

    // Sync temp values
    appState.tempTheme = 'light';
    appState.tempLang = 'zh';
    appState.tempFontIdx = 1;

    document.getElementById('theme-toggle').checked = false;
    document.getElementById('lang-toggle-setting').checked = false;

    applyTheme();
    updateTranslations();
    applyLanguageStyle();
    applyFontSize();
    renderDashboard();
    updateAppearancePreview();

    document.getElementById('force-system-voice-toggle').checked = false;
    appState.forceSystemVoice = false;

    if (appState.activeView === 'reader' && appState.currentBook) {
        loadScripture(appState.currentBook, appState.currentChapter);
    }
};

window.saveAppearance = () => {
    appState.theme = appState.tempTheme;
    appState.fontSizeIndex = appState.tempFontIdx;
    appState.forceSystemVoice = document.getElementById('force-system-voice-toggle').checked;

    const langChanged = appState.currentLang !== appState.tempLang;
    appState.currentLang = appState.tempLang;

    applyTheme();
    applyFontSize();
    saveSettings();

    if (langChanged) {
        updateTranslations();
        applyLanguageStyle();
        renderDashboard();
        // If reader is active, reload content to reflect language change
        if (appState.activeView === 'reader' && appState.currentBook) {
            loadScripture(appState.currentBook, appState.currentChapter);
        }
    }

    closeAppearanceSettings();
    showToast(appState.currentLang === 'en' ? "Settings saved!" : "設定已儲存！");
};

