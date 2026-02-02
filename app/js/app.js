console.log("App initialized.");

// State Management
const appState = {
    currentDate: (() => {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        return new Date(utc + (3600000 * 8));
    })(),
    readingPlan: [],
    parsedBibleZh: {},
    parsedBibleEn: {},
    todayPlan: null,
    chapterProgress: {},
    currentLang: localStorage.getItem('bible_reading_lang') || 'zh', // 'zh' or 'en'
    fontSizeIndex: 2,
    activeView: 'dashboard',
    currentBook: null, // Added for reload context
    currentChapter: null // Added for reload context
};

// --- CONSTANTS ---
const YEAR_START = new Date("2026-01-01");
const YEAR_END = new Date("2026-12-31");
const FONT_SIZES = [10, 12, 14, 16, 17, 18];

// Mapping (Chinese -> Abbreviation / English Name)
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
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

async function initApp() {
    try {
        await loadData();
        loadProgress();

        // Add Header Return Button for Mobile if needed (View state handling)
        checkMobileHeader();

        // Apply Language
        updateTranslations();
        applyLanguageStyle();

        renderDashboard();

        // Initial View State
        switchView('dashboard');
    } catch (error) {
        console.error("Initialization Failed:", error);
        alert(appState.currentLang === 'zh' ? "資料載入失敗" : "Data load failed");
    }
}

// --- LANGUAGE HANDLING ---
window.toggleLanguage = () => {
    appState.currentLang = appState.currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('bible_reading_lang', appState.currentLang);

    updateTranslations();
    applyLanguageStyle();
    renderDashboard();

    // If in reader view, force reload to update content language
    if (appState.activeView === 'reader') {
        const titleEl = document.querySelector('.chapter-title');
        // Reload scripture if context exists
        if (appState.currentBook && appState.currentChapter) {
            loadScripture(appState.currentBook, appState.currentChapter);
        } else {
            titleEl.textContent = translations[appState.currentLang].readerTitleDefault;
            const ph = document.querySelector('.placeholder-text');
            if (ph) ph.innerText = translations[appState.currentLang].readerPlaceholder;
        }
    }
};

function updateTranslations() {
    const t = translations[appState.currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (key === 'catchUpParams') return; // Handled dynamically
            el.innerText = t[key];
        }
    });

    // Toggle Buttons Text
    const langBtnText = t.langBtn;
    const dashInfo = document.getElementById('lang-toggle-dashboard');
    const readInfo = document.getElementById('lang-toggle-reader');
    if (dashInfo) dashInfo.innerText = langBtnText;
    if (readInfo) readInfo.innerText = langBtnText;
}

function applyLanguageStyle() {
    if (appState.currentLang === 'en') {
        document.body.classList.add('lang-en');
    } else {
        document.body.classList.remove('lang-en');
    }
}

// --- VIEW MANAGER ---
window.switchView = (viewName) => {
    appState.activeView = viewName;
    document.body.classList.remove('view-dashboard', 'view-reader');
    document.body.classList.add(`view-${viewName}`);
    window.scrollTo(0, 0);
};

function checkMobileHeader() {
    const readerHeader = document.querySelector('.reader-header');
    if (readerHeader && !document.getElementById('mobile-return-btn')) {
        // Handled by static HTML
    }
}

// --- DATA LOADING ---
async function loadData() {
    const planRes = await fetch('../data/reading_plan.json');
    appState.readingPlan = await planRes.json();

    if (typeof profiles !== 'undefined') {
        appState.parsedBibleZh = parseBibleArray(profiles);
    }

    if (typeof profiles_en !== 'undefined') {
        appState.parsedBibleEn = parseBibleArray(profiles_en);
    }
}

function parseBibleArray(lines) {
    const bible = {};
    const regex = /^(.+?)(\d+):(\d+)\s+(.*)$/;

    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const [_, book, chap, verse, text] = match;
            const cleanBook = book;

            if (!bible[cleanBook]) bible[cleanBook] = {};
            if (!bible[cleanBook][chap]) bible[cleanBook][chap] = {};
            bible[cleanBook][chap][verse] = text;
        }
    });
    return bible;
}

function loadProgress() {
    const saved = localStorage.getItem('bible_reading_progress_v2');
    if (saved) {
        appState.chapterProgress = JSON.parse(saved);
    }
}

function saveProgress() {
    localStorage.setItem('bible_reading_progress_v2', JSON.stringify(appState.chapterProgress));
    updateStats();
}

// --- CORE LOGIC ---
function getDateKey(date) {
    // Force GMT+8 Date String (YYYY-MM-DD)
    // Create new Date object adjusted to GMT+8
    const offset = 8 * 60; // Minutes
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const twDate = new Date(utc + (3600000 * 8));
    return twDate.toISOString().split('T')[0];
}

function getTodayGMT8() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 8));
}

function getPlanForDate(dateStr) {
    const entries = appState.readingPlan.filter(p => p.date === dateStr);
    if (!entries || entries.length === 0) return null;

    // Choose description language
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
    if (btn) {
        if (current !== today) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    }
}

window.toggleChapter = (book, chapter) => {
    const abbr = BOOK_MAP[book] || book;
    const key = `${abbr}_${chapter}`;
    if (appState.chapterProgress[key]) delete appState.chapterProgress[key];
    else appState.chapterProgress[key] = true;
    saveProgress();
    renderDashboard();
};

// --- RENDERING ---
function renderDashboard() {
    const t = translations[appState.currentLang];
    const dateStr = getDateKey(appState.currentDate);
    document.querySelector('.date-display').textContent = dateStr;
    const container = document.getElementById('today-card');
    const contentDiv = container.querySelector('.card-content');
    const plan = getPlanForDate(dateStr);

    if (!plan) {
        contentDiv.innerHTML = `<h2>${t.noProgress}</h2>`;
        return;
    }

    let html = ``;
    if (plan.titles.length > 0) {
        html += `<div class="titles-container" style="margin-bottom: 20px;"><h2>${plan.titles[0]}</h2></div>`;
    }

    const grouped = {};
    plan.items.forEach(item => {
        if (!grouped[item.book]) grouped[item.book] = {
            name: appState.currentLang === 'en' ? (item.book_en || item.book) : item.book,
            chapters: [],
            origBook: item.book
        };
        grouped[item.book].chapters.push(item.chapter);
    });

    html += `<div class="chapters-area">`;
    for (const [_, group] of Object.entries(grouped)) {
        const { name, chapters, origBook } = group;
        const abbr = BOOK_MAP[origBook] || origBook;

        html += `<div class="book-group" style="margin-bottom: 15px;">`;
        html += `<h3 style="color: var(--primary-color); border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px;">${name}</h3>`;
        html += `<div class="chapter-grid">`;
        chapters.forEach(ch => {
            const key = `${abbr}_${ch}`;
            const isDone = appState.chapterProgress[key];
            // We pass origBook (Chinese name) for ID consistency key logic, but user sees translated name
            html += `<div class="chapter-circle ${isDone ? 'done' : ''}" onclick="toggleChapter('${origBook}', ${ch})">${ch}</div>`;
        });
        html += `</div></div>`;
    }
    html += `</div>`;

    const firstItem = plan.items[0];
    if (firstItem) {
        const btnText = t.startReading;
        html += `<div style="margin-top: 20px;"><button class="btn-primary" onclick="loadScripture('${firstItem.book}', ${firstItem.chapter})">${btnText}</button></div>`;
    }
    contentDiv.innerHTML = html;

    renderCatchUp();
    updateStats();
}

function renderCatchUp() {
    const container = document.getElementById('catch-up-container') || document.getElementById('info-banner-container');
    if (!container) return;

    container.innerHTML = '';
    container.classList.add('hidden');
    const start = new Date(YEAR_START);
    const end = new Date();
    end.setDate(end.getDate() - 1); // Yesterday
    let earliestUnreadDate = null;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = getDateKey(d);
        // Find plan entries for date
        const entries = appState.readingPlan.filter(p => p.date === dateStr);
        if (!entries.length) continue;

        let allDone = true;
        entries.forEach(e => {
            if (e.chapters) e.chapters.forEach(ch => {
                const key = `${BOOK_MAP[e.book]}_${ch}`;
                if (!appState.chapterProgress[key]) allDone = false;
            });
        });

        if (!allDone) { earliestUnreadDate = dateStr; break; }
    }

    if (earliestUnreadDate) {
        const t = translations[appState.currentLang];
        // t.catchUpParams = ["You have unread plans", "Catch up"]
        const [msg, btn] = t.catchUpParams;
        container.classList.remove('hidden');
        container.innerHTML = `<div class="info-banner"><span>${msg} (${earliestUnreadDate})</span><button class="btn-primary" onclick="goToDate('${earliestUnreadDate}')">${btn}</button></div>`;
    }
}

// --- READER LOGIC ---
// Modified to support EN
window.loadScripture = (bookNameZh, chapter) => {
    // bookNameZh is always the Chinese Key from reading_plan.json "book" field.
    const t = translations[appState.currentLang];
    const abbr = BOOK_MAP[bookNameZh];
    if (!abbr) return alert(`找不到書卷代碼：${bookNameZh}`);

    let bookData, displayName;

    if (appState.currentLang === 'en') {
        const entry = appState.readingPlan.find(p => p.book === bookNameZh);
        const bookNameEn = entry ? entry.book_en : bookNameZh;

        bookData = appState.parsedBibleEn[bookNameEn];
        displayName = `${bookNameEn} Chapter ${chapter}`;

        if (!bookData) {
            document.querySelector('.reader-content').innerHTML = `<p>English text not found for ${bookNameEn}</p>`;
            return;
        }

    } else {
        bookData = appState.parsedBibleZh[abbr];
        displayName = `${bookNameZh} 第 ${chapter} 章`;
    }

    if (!bookData || !bookData[chapter]) {
        document.querySelector('.reader-content').innerHTML = `<p>經文載入失敗 (${displayName})</p>`;
        return;
    }

    const verses = bookData[chapter];
    let html = ``;
    for (const [vNum, text] of Object.entries(verses)) {
        html += `<p><span class="verse-num">${chapter}:${vNum}</span> ${text}</p>`;
    }
    document.querySelector('.reader-content').innerHTML = html;
    document.querySelector('.chapter-title').textContent = displayName;

    // Store current reading context for reload
    appState.currentBook = bookNameZh;
    appState.currentChapter = chapter;

    renderReaderNav(bookNameZh, chapter);

    switchView('reader');
};

function renderReaderNav(currentBookZh, currentChapter) {
    const navDiv = document.querySelector('.reader-nav');
    navDiv.classList.remove('hidden');
    const dateStr = getDateKey(appState.currentDate);
    const plan = getPlanForDate(dateStr);
    if (!plan) return;

    const currentIndex = plan.items.findIndex(i => i.book === currentBookZh && i.chapter === currentChapter);
    let html = ``;
    const t = translations[appState.currentLang];

    if (currentIndex > 0) {
        const prev = plan.items[currentIndex - 1];
        html += `<button class="btn-secondary" onclick="loadScripture('${prev.book}', ${prev.chapter})">◀ ${t.navPrev}</button>`;
    } else html += `<div></div>`;

    if (currentIndex < plan.items.length - 1) {
        const next = plan.items[currentIndex + 1];
        html += `<button class="btn-primary" onclick="finishAndNext('${currentBookZh}', ${currentChapter}, '${next.book}', ${next.chapter})">${t.navNext} ▶</button>`;
    } else {
        html += `<button class="btn-primary" onclick="finishAndHome('${currentBookZh}', ${currentChapter})">${t.navFinish} ✅</button>`;
    }
    navDiv.innerHTML = html;
}

window.finishAndNext = (cBook, cChap, nBook, nChap) => {
    const abbr = BOOK_MAP[cBook];
    appState.chapterProgress[`${abbr}_${cChap}`] = true;
    saveProgress();
    loadScripture(nBook, nChap);
    renderDashboard();
};

window.finishAndHome = (cBook, cChap) => {
    const abbr = BOOK_MAP[cBook];
    appState.chapterProgress[`${abbr}_${cChap}`] = true;
    saveProgress();
    renderDashboard();
    const t = translations[appState.currentLang];
    alert(t.congratsBody);
    switchView('dashboard');
};

// --- STATS & UTILS ---
function updateStats() {
    const t = translations[appState.currentLang];
    const completedCount = Object.keys(appState.chapterProgress).length;
    const totalChapters = 1189;
    const annualPercent = Math.round((completedCount / totalChapters) * 100);
    document.querySelector('.annual-progress .progress-bar').style.width = `${annualPercent}%`;

    const annualTextEl = document.querySelector('.annual-progress .annual-text');
    if (annualTextEl) {
        annualTextEl.textContent = `${t.totalProgress} ${completedCount} / ${totalChapters} ${t.chapterUnit}`;
    }

    // Month Stats logic
    const viewDate = appState.currentDate;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    let monthTotal = 0;
    let monthDone = 0;

    appState.readingPlan.forEach(p => {
        const d = new Date(p.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
            if (Array.isArray(p.chapters)) {
                p.chapters.forEach(ch => {
                    monthTotal++;
                    const key = `${BOOK_MAP[p.book]}_${ch}`;
                    if (appState.chapterProgress[key]) monthDone++;
                });
            }
        }
    });

    const monthPercent = monthTotal > 0 ? Math.round((monthDone / monthTotal) * 100) : 0;
    const monthElem = document.querySelector('#monthly-bar');
    if (monthElem) monthElem.style.width = `${monthPercent}%`;

    const monthText = document.querySelector('.monthly-text');
    if (monthText) {
        // use t.months array
        const monthName = t.months[month];
        const finishText = t.monthFinish || "Month Completion";
        monthText.textContent = `${monthName}: ${finishText} ${monthDone} / ${monthTotal} ${t.chapterUnit}`;
    }
}

// File Export/Import Logic
window.exportData = () => {
    const dataStr = JSON.stringify(appState.chapterProgress);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    // Generate Filename: GBC2026BibleReading_progress_YYMMDD
    const d = new Date();
    const yy = d.getFullYear().toString().slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const fileName = `GBC2026BibleReading_progress_${yy}${mm}${dd}.json`;

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
                // Simple validation
                if (typeof data === 'object') {
                    appState.chapterProgress = data;
                    saveProgress();
                    alert(translations[appState.currentLang].importSuccess);
                    location.reload();
                } else {
                    throw new Error('Invalid JSON');
                }
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
    const newSize = FONT_SIZES[appState.fontSizeIndex];
    const style = document.createElement('style');
    style.innerHTML = `.reader-content p { font-size: ${newSize}pt !important; }`;
    document.head.appendChild(style);
};
