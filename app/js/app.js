console.log("App initialized.");

// State Management
const appState = {
    currentDate: new Date(), // Defaults to today
    readingPlan: [],
    parsedBible: {},
    todayPlan: null,
    chapterProgress: {},

    // UI State
    fontSizeIndex: 2, // Default 14pt (Index 2 in [10, 12, 14, 16, 17, 18])
    activeView: 'dashboard' // 'dashboard' or 'reader'
};

// --- CONSTANTS ---
const YEAR_START = new Date("2026-01-01");
const YEAR_END = new Date("2026-12-31");
const FONT_SIZES = [10, 12, 14, 16, 17, 18];

// Mapping: Full Name (Reading Plan) -> Abbreviation (Bible.js)
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
        renderDashboard();

        // Initial View State
        switchView('dashboard');
    } catch (error) {
        console.error("Initialization Failed:", error);
        alert("資料載入失敗，請檢查網路或檔案。");
    }
}

// --- VIEW MANAGER ---
// Replaces old scrolling logic with clean View Switching for Mobile
window.switchView = (viewName) => {
    appState.activeView = viewName;
    document.body.classList.remove('view-dashboard', 'view-reader');
    document.body.classList.add(`view-${viewName}`);

    // Always scroll to top when switching
    window.scrollTo(0, 0);
};

// Legacy stub to prevent errors if html calls it
window.setViewMode = () => { };


// --- DATA LOADING ---
async function loadData() {
    const planRes = await fetch('../data/reading_plan.json');
    appState.readingPlan = await planRes.json();

    if (typeof profiles !== 'undefined') {
        appState.parsedBible = parseBibleArray(profiles);
    } else {
        throw new Error("bible.js not loaded. 'profiles' is undefined.");
    }
}

function parseBibleArray(lines) {
    const bible = {};
    const regex = /^([\u4e00-\u9fa5]+?)(\d+):(\d+)\s+(.*)$/;
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
    return date.toISOString().split('T')[0];
}

function getPlanForDate(dateStr) {
    const entries = appState.readingPlan.filter(p => p.date === dateStr);
    if (!entries || entries.length === 0) return null;
    const titles = [...new Set(entries.map(e => e.description))];
    const items = [];
    entries.forEach(e => {
        if (Array.isArray(e.chapters)) {
            e.chapters.forEach(ch => {
                items.push({ book: e.book, chapter: ch });
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
    appState.currentDate = new Date();
    checkReturnButton();
    renderDashboard();
};

function checkReturnButton() {
    const today = new Date().toISOString().split('T')[0];
    const current = getDateKey(appState.currentDate);
    const btn = document.getElementById('btn-return-today');
    if (current !== today) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
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
    const dateStr = getDateKey(appState.currentDate);
    document.querySelector('.date-display').textContent = dateStr;
    const container = document.getElementById('today-card');
    const contentDiv = container.querySelector('.card-content');
    const plan = getPlanForDate(dateStr);

    if (!plan) {
        contentDiv.innerHTML = `<h2>無今日進度</h2><p>請選擇其他日期</p>`;
        return;
    }

    let html = ``;
    if (plan.titles.length > 0) {
        html += `<div class="titles-container" style="margin-bottom: 20px;"><h2>${plan.titles[0]}</h2></div>`;
    }

    const grouped = {};
    plan.items.forEach(item => {
        if (!grouped[item.book]) grouped[item.book] = [];
        grouped[item.book].push(item.chapter);
    });

    html += `<div class="chapters-area">`;
    for (const [bookName, chapters] of Object.entries(grouped)) {
        const abbr = BOOK_MAP[bookName] || bookName;
        html += `<div class="book-group" style="margin-bottom: 15px;">`;
        html += `<h3 style="color: var(--primary-color); border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px;">${bookName}</h3>`;
        html += `<div class="chapter-grid">`;
        chapters.forEach(ch => {
            const key = `${abbr}_${ch}`;
            const isDone = appState.chapterProgress[key];
            html += `<div class="chapter-circle ${isDone ? 'done' : ''}" onclick="toggleChapter('${bookName}', ${ch})">${ch}</div>`;
        });
        html += `</div></div>`;
    }
    html += `</div>`;

    const firstItem = plan.items[0];
    if (firstItem) {
        html += `<div style="margin-top: 20px;"><button class="btn-primary" onclick="loadScripture('${firstItem.book}', ${firstItem.chapter})">📖 開始閱讀</button></div>`;
    }
    contentDiv.innerHTML = html;

    renderCatchUp();
    updateStats();
}

// --- READER LOGIC ---
window.loadScripture = (bookName, chapter) => {
    const abbr = BOOK_MAP[bookName];
    if (!abbr) return alert(`找不到書卷代碼：${bookName}`);
    const bookData = appState.parsedBible[abbr];
    if (!bookData || !bookData[chapter]) {
        document.querySelector('.reader-content').innerHTML = `<p>經文載入失敗 (${abbr} ${chapter})</p>`;
        return;
    }

    const verses = bookData[chapter];
    let html = ``;
    for (const [vNum, text] of Object.entries(verses)) {
        html += `<p><span class="verse-num">${chapter}:${vNum}</span> ${text}</p>`;
    }
    document.querySelector('.reader-content').innerHTML = html;
    document.querySelector('.chapter-title').textContent = `${bookName} 第 ${chapter} 章`;
    renderReaderNav(bookName, chapter);

    // Switch View
    switchView('reader');
};

function renderReaderNav(currentBook, currentChapter) {
    const navDiv = document.querySelector('.reader-nav');
    navDiv.classList.remove('hidden');
    const dateStr = getDateKey(appState.currentDate);
    const plan = getPlanForDate(dateStr);
    if (!plan) return;

    const currentIndex = plan.items.findIndex(i => i.book === currentBook && i.chapter === currentChapter);
    let html = ``;

    // Return to Dashboard Button Logic (for Header) is static in HTML, calls switchView('dashboard')

    if (currentIndex > 0) {
        const prev = plan.items[currentIndex - 1];
        html += `<button class="btn-secondary" onclick="loadScripture('${prev.book}', ${prev.chapter})">◀ 上一章</button>`;
    } else html += `<div></div>`;

    if (currentIndex < plan.items.length - 1) {
        const next = plan.items[currentIndex + 1];
        html += `<button class="btn-primary" onclick="finishAndNext('${currentBook}', ${currentChapter}, '${next.book}', ${next.chapter})">下一章 ▶</button>`;
    } else {
        html += `<button class="btn-primary" onclick="finishAndHome('${currentBook}', ${currentChapter})">完成今日 ✅</button>`;
    }
    navDiv.innerHTML = html;
}

window.finishAndNext = (cBook, cChap, nBook, nChap) => {
    const abbr = BOOK_MAP[cBook];
    appState.chapterProgress[`${abbr}_${cChap}`] = true;
    saveProgress();
    loadScripture(nBook, nChap); // This will keep us in Reader View and scroll top
    renderDashboard();
};

window.finishAndHome = (cBook, cChap) => {
    const abbr = BOOK_MAP[cBook];
    appState.chapterProgress[`${abbr}_${cChap}`] = true;
    saveProgress();
    renderDashboard();

    alert("今日進度已完成！");
    switchView('dashboard');
};

// --- STATS & UTILS ---
function updateStats() {
    const completedCount = Object.keys(appState.chapterProgress).length;
    const totalChapters = 1189;
    const annualPercent = Math.round((completedCount / totalChapters) * 100);
    document.querySelector('.annual-progress .progress-bar').style.width = `${annualPercent}%`;
    document.querySelector('.annual-progress .annual-text').textContent = `累積完成 ${completedCount} / ${totalChapters} 章`;

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
    if (monthText) monthText.textContent = `${month + 1}月: 完成 ${monthDone} / ${monthTotal} 章`;
}

function renderCatchUp() {
    const container = document.getElementById('catch-up-container');
    container.innerHTML = '';
    container.classList.add('hidden');
    const start = new Date(YEAR_START);
    const end = new Date();
    end.setDate(end.getDate() - 1);
    let earliestUnreadDate = null;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = getDateKey(d);
        const plan = getPlanForDate(dateStr);
        if (!plan) continue;
        let allDone = true;
        for (const item of plan.items) {
            const key = `${BOOK_MAP[item.book]}_${item.chapter}`;
            if (!appState.chapterProgress[key]) { allDone = false; break; }
        }
        if (!allDone) { earliestUnreadDate = dateStr; break; }
    }

    if (earliestUnreadDate) {
        container.classList.remove('hidden');
        container.innerHTML = `<div class="info-banner"><span>您有未完成的進度 (${earliestUnreadDate})</span><button class="btn-primary" onclick="goToDate('${earliestUnreadDate}')">補讀</button></div>`;
    }
}

window.goToDate = (dateStr) => {
    appState.currentDate = new Date(dateStr);
    checkReturnButton();
    renderDashboard();
    // switchView is not needed as we assume we are already in dashboard or want to stay there
};

window.toggleFontSize = () => {
    appState.fontSizeIndex = (appState.fontSizeIndex + 1) % FONT_SIZES.length;
    const size = FONT_SIZES[appState.fontSizeIndex];
    document.documentElement.style.setProperty('--reader-font-size', `${size}pt`);
};

// --- DATA MANAGEMENT ---
window.exportData = () => {
    const data = JSON.stringify(appState.chapterProgress);

    // Attempt download
    try {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GBC2026BibleReading_progress.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Download failed", e);
        prompt("手機板匯出請全選並複製以下代碼，並存在記事本中：", data);
    }
};

window.importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            try {
                appState.chapterProgress = JSON.parse(event.target.result);
                saveProgress();
                alert("匯入成功！");
                location.reload();
            } catch (err) {
                // Fallback for past manual code strings if user just paste? 
                // No, just stay simple.
                alert("匯入失敗，請確認檔案格式正確。");
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

window.completeMonth = () => {
    const viewDate = appState.currentDate;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    if (!confirm(`確定要將 ${month + 1} 月的所有進度標記為已完成嗎？`)) return;

    appState.readingPlan.forEach(p => {
        const d = new Date(p.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
            if (Array.isArray(p.chapters)) {
                p.chapters.forEach(ch => {
                    const key = `${BOOK_MAP[p.book]}_${ch}`;
                    appState.chapterProgress[key] = true;
                });
            }
        }
    });

    saveProgress();
    renderDashboard();
    alert(`${month + 1} 月進度已全部標記完成！`);
};
