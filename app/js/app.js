/**
 * 2026 Bible Reading App - Core Logic
 */

// State Management
window.appState = {
    currentDate: (() => {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        return new Date(utc + (3600000 * 8)); // Default to GMT+8
    })(),
    readingPlan: [],
    parsedBibleZh: {},
    parsedBibleEn: {},
    chapterProgress: {},
    currentLang: localStorage.getItem('bible_reading_lang') || 'zh',
    fontSizeIndex: 2,
    activeView: 'dashboard',
    currentBook: null,
    currentChapter: null
};

const appState = window.appState;

// --- CONSTANTS ---
const YEAR_START = new Date("2026-01-01");
const YEAR_END = new Date("2026-12-31");
const FONT_SIZES = [10, 12, 14, 16, 17, 18];

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
        await loadData();
        loadProgress();
        updateTranslations();
        applyLanguageStyle();
        renderDashboard();
        switchView('dashboard');
    } catch (error) {
        console.error("Initialization Failed:", error);
    }
}

// --- LANGUAGE HANDLING ---
window.toggleLanguage = () => {
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
            el.innerText = t[key];
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

// --- VIEW MANAGER ---
window.switchView = (viewName) => {
    appState.activeView = viewName;
    document.body.classList.remove('view-dashboard', 'view-reader');
    document.body.classList.add(`view-${viewName}`);
    window.scrollTo(0, 0);
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

function loadProgress() {
    const saved = localStorage.getItem('bible_reading_progress_v2');
    if (saved) appState.chapterProgress = JSON.parse(saved);
}

function saveProgress() {
    localStorage.setItem('bible_reading_progress_v2', JSON.stringify(appState.chapterProgress));
    updateStats();
}

// --- CORE LOGIC ---
function getDateKey(date) {
    const offset = 8 * 60;
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const twDate = new Date(utc + (offset * 60000));
    return twDate.toISOString().split('T')[0];
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
    const contentDiv = document.querySelector('#today-card .card-content');
    const plan = getPlanForDate(dateStr);

    if (!plan) {
        contentDiv.innerHTML = `<h2>${t.noProgress}</h2>`;
        return;
    }

    let html = plan.titles.length > 0 ? `<div class="titles-container"><h2>${plan.titles[0]}</h2></div>` : '';
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
    for (const group of Object.values(grouped)) {
        const { name, chapters, origBook } = group;
        const abbr = BOOK_MAP[origBook] || origBook;
        html += `<div class="book-group">`;
        html += `<h3>${name}</h3>`;
        html += `<div class="chapter-grid">`;
        chapters.forEach(ch => {
            const isDone = appState.chapterProgress[`${abbr}_${ch}`];
            html += `<div class="chapter-circle ${isDone ? 'done' : ''}" onclick="toggleChapter('${origBook}', ${ch})">${ch}</div>`;
        });
        html += `</div></div>`;
    }
    html += `</div>`;

    if (plan.items[0]) {
        html += `<div style="margin-top: 20px;"><button class="btn-primary" onclick="loadScripture('${plan.items[0].book}', ${plan.items[0].chapter})">${t.startReading}</button></div>`;
    }
    contentDiv.innerHTML = html;

    renderCatchUp();
    updateStats();
}

function renderCatchUp() {
    const container = document.getElementById('catch-up-container');
    if (!container) return;

    container.innerHTML = '';
    container.classList.add('hidden');
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
        const [msg, btn] = t.catchUpParams;
        container.classList.remove('hidden');
        container.innerHTML = `<div class="info-banner"><span>${msg} (${earliestUnreadDate})</span><button class="btn-primary" onclick="goToDate('${earliestUnreadDate}')">${btn}</button></div>`;
    }
}

// --- READER LOGIC ---
window.loadScripture = (bookNameZh, chapter) => {
    const t = translations[appState.currentLang];
    const abbr = BOOK_MAP[bookNameZh];
    let bookData, displayName;

    if (appState.currentLang === 'en') {
        const entry = appState.readingPlan.find(p => p.book === bookNameZh);
        const bookNameEn = entry ? entry.book_en : bookNameZh;
        bookData = appState.parsedBibleEn[bookNameEn];
        displayName = `${bookNameEn} Chapter ${chapter}`;
    } else {
        bookData = appState.parsedBibleZh[abbr];
        displayName = `${bookNameZh} 第 ${chapter} 章`;
    }

    if (!bookData || !bookData[chapter]) {
        document.querySelector('.reader-content').innerHTML = `<p>經文載入失敗 (${displayName})</p>`;
        return;
    }

    const verses = bookData[chapter];
    let html = Object.entries(verses).map(([vNum, text]) => `<p><span class="verse-num">${chapter}:${vNum}</span> ${text}</p>`).join('');
    document.querySelector('.reader-content').innerHTML = html;
    document.querySelector('.chapter-title').textContent = displayName;

    appState.currentBook = bookNameZh;
    appState.currentChapter = chapter;
    renderReaderNav(bookNameZh, chapter);
    switchView('reader');
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
    appState.chapterProgress[`${BOOK_MAP[cBook]}_${cChap}`] = true;
    saveProgress();
    loadScripture(nBook, nChap);
    renderDashboard();
};

window.finishAndHome = (cBook, cChap) => {
    appState.chapterProgress[`${BOOK_MAP[cBook]}_${cChap}`] = true;
    saveProgress();
    renderDashboard();
    alert(translations[appState.currentLang].congratsBody);
    switchView('dashboard');
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
    document.querySelector('.monthly-text').textContent =
        `${t.months[month]}: ${t.monthFinish || "Month Completion"} ${monthDone} / ${monthTotal} ${t.chapterUnit} ( ${Math.round(monthPercent)}% )`;
}

window.completeMonth = () => {
    const viewDate = appState.currentDate;
    const month = viewDate.getMonth();
    const year = viewDate.getFullYear();
    const t = translations[appState.currentLang];
    const monthPlans = appState.readingPlan.filter(p => {
        const d = new Date(p.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    let unreadKeys = [];
    monthPlans.forEach(p => p.chapters?.forEach(ch => {
        const key = `${BOOK_MAP[p.book]}_${ch}`;
        if (!appState.chapterProgress[key]) unreadKeys.push(key);
    }));

    if (unreadKeys.length === 0) {
        if (confirm(t.confirmClearMonth)) {
            monthPlans.forEach(p => p.chapters?.forEach(ch => delete appState.chapterProgress[`${BOOK_MAP[p.book]}_${ch}`]));
            saveProgress();
            renderDashboard();
            alert(t.monthCleared.replace('%m', t.months[month]));
        }
    } else {
        const count = unreadKeys.length;
        if (confirm(t.confirmMarkMonth.replace('%n', count))) {
            unreadKeys.forEach(key => appState.chapterProgress[key] = true);
            saveProgress();
            renderDashboard();
            alert(t.markMonthSuccess.replace('%n', count));
        }
    }
};

// --- DATA TOOLS ---
window.exportData = () => {
    const d = new Date();
    const fileName = `GBC2026_Progress_${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    const blob = new Blob([JSON.stringify(appState.chapterProgress)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
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
                appState.chapterProgress = JSON.parse(event.target.result);
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
    const style = document.getElementById('font-size-style') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'font-size-style' }));
    style.innerHTML = `.reader-content p { font-size: ${FONT_SIZES[appState.fontSizeIndex]}pt !important; }`;
};
