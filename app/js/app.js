console.log("App initialized.");

// State Management
const appState = {
    currentDate: new Date(), // Defaults to today
    readingPlan: [],
    // bibleText: {}, // REMOVE: No longer using JSON file
    parsedBible: {}, // NEW: Parsed from Array
    todayPlan: null,

    // Progress Tracking (Granular)
    // { "2026-01-01": [true, true, false], "2026-01-02": [false] }
    // or better: { "Gen.1": true, "Gen.2": true }
    // Actually, "Chapter ID" based tracking is best.
    // Let's use: { "Book_Chapter": true } e.g. "Genesis_1": true
    // BUT we need to map "創_1" to "Genesis_1" or consistent ID.
    // Let's use the ABBREVIATION from bible.js as ID. e.g. "創_1": true.
    chapterProgress: {},

    // Font Size
    fontSizeIndex: 2, // Default 14pt (Index 2 in [10, 12, 14, 16, 17, 18])
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
    "耶利米哀歌": "哀", "以西結書": "結", "但以理書": "但", "荷西亞書": "該", // Wait, Hosea is 何
    "何西阿書": "何", "約珥書": "珥", "阿摩司書": "摩", "俄巴底亞書": "俄", "約拿書": "拿",
    "彌迦書": "彌", "那鴻書": "鴻", "哈巴谷書": "哈", "西番雅書": "番", "哈该書": "該", "哈該書": "該",
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

        // Initial Render
        // Check if we have a saved date provided by 'return to day' or url param?
        // simple start: today.
        renderDashboard();
    } catch (error) {
        console.error("Initialization Failed:", error);
        alert("資料載入失敗，請檢查網路或檔案。");
    }
}

// --- DATA LOADING ---
async function loadData() {
    // 1. Load Reading Plan
    const planRes = await fetch('../data/reading_plan.json');
    appState.readingPlan = await planRes.json();

    // 2. Parse Bible Data (Global 'profiles' array from bible.js)
    if (typeof profiles !== 'undefined') {
        appState.parsedBible = parseBibleArray(profiles);
        console.log("Bible Parsed. Chapters:", Object.keys(appState.parsedBible).length);
    } else {
        throw new Error("bible.js not loaded. 'profiles' is undefined.");
    }
}

// Transform ["創1:1 ...", "創1:2 ..."] into { "創": { "1": { "1": "..." } } }
function parseBibleArray(lines) {
    const bible = {};
    const regex = /^([\u4e00-\u9fa5]+?)(\d+):(\d+)\s+(.*)$/;
    // Matches: [Full, BookAbbr, Chap, Verse, Text]

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
    const saved = localStorage.getItem('bible_reading_progress_v2'); // New key for granular
    if (saved) {
        appState.chapterProgress = JSON.parse(saved);
    } else {
        // Migration logic could go here if needed, but we start fresh or manually migrate
        appState.chapterProgress = {};
    }
}

function saveProgress() {
    localStorage.setItem('bible_reading_progress_v2', JSON.stringify(appState.chapterProgress));
    updateStats();
}

// --- CORE LOGIC ---

// Helper: Format Date Key
function getDateKey(date) {
    return date.toISOString().split('T')[0];
}

// Helper: Get plan for Date
// Updated for Multi-Book aggregation
function getPlanForDate(dateStr) {
    const entries = appState.readingPlan.filter(p => p.date === dateStr);
    if (!entries || entries.length === 0) return null;

    // Aggregate descriptions and chapters
    // Structure: 
    // { 
    //   date: "...", 
    //   titles: ["Title 1", "Title 2" (unique)], 
    //   items: [ { book: "Gen", chapter: 1 }, { book: "Matt", chapter: 5 } ] 
    // }

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

// Navigation
window.changeDay = (offset) => {
    const newDate = new Date(appState.currentDate);
    newDate.setDate(newDate.getDate() + offset);

    // Clamp Date
    if (newDate < YEAR_START) return;
    if (newDate > YEAR_END) return;

    appState.currentDate = newDate;

    // Check if "Return to Today" is needed
    checkReturnButton();

    renderDashboard();
};

window.changeMonth = (offset) => {
    const newDate = new Date(appState.currentDate);
    newDate.setMonth(newDate.getMonth() + offset);

    // Clamp Date logic needs care: if Jan 31 -> Feb 28
    // Also clamp year
    if (newDate < YEAR_START) {
        newDate.setTime(YEAR_START.getTime());
    } else if (newDate > YEAR_END) {
        newDate.setTime(YEAR_END.getTime());
    }

    appState.currentDate = newDate;
    checkReturnButton();
    renderDashboard();
};

window.goToToday = () => {
    appState.currentDate = new Date(); // Reset to actual today
    checkReturnButton();
    renderDashboard();
};

function checkReturnButton() {
    const today = new Date().toISOString().split('T')[0];
    const current = getDateKey(appState.currentDate);

    const btn = document.getElementById('btn-return-today');
    if (current !== today) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}


// Toggle Chapter Progress
window.toggleChapter = (book, chapter) => {
    const abbr = BOOK_MAP[book] || book;
    const key = `${abbr}_${chapter}`;

    if (appState.chapterProgress[key]) {
        delete appState.chapterProgress[key];
    } else {
        appState.chapterProgress[key] = true;
    }

    saveProgress();
    renderDashboard(); // Re-render to update circles and progress
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

    // 1. Render Description (Title) at TOP
    let html = ``;

    // Titles - Show ONLY the first one
    if (plan.titles.length > 0) {
        html += `<div class="titles-container" style="margin-bottom: 20px;">`;
        html += `<h2>${plan.titles[0]}</h2>`;
        html += `</div>`;
    }

    // 2. Render Chapter Grid
    // Group by Book for visual clarity
    // e.g. Gen: 1, 2, 3 | Matt: 5, 6

    // Group items by book
    const grouped = {};
    plan.items.forEach(item => {
        if (!grouped[item.book]) grouped[item.book] = [];
        grouped[item.book].push(item.chapter);
    });

    html += `<div class="chapters-area">`;

    for (const [bookName, chapters] of Object.entries(grouped)) {
        const abbr = BOOK_MAP[bookName] || bookName; // Use Abbr for ID

        html += `<div class="book-group" style="margin-bottom: 15px;">`;
        html += `<h3 style="color: var(--primary-color); border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px;">${bookName}</h3>`;
        html += `<div class="chapter-grid">`;

        chapters.forEach(ch => {
            const key = `${abbr}_${ch}`;
            const isDone = appState.chapterProgress[key];

            html += `
                <div class="chapter-circle ${isDone ? 'done' : ''}" 
                     onclick="toggleChapter('${bookName}', ${ch})">
                    ${ch}
                </div>
            `;
        });

        html += `</div></div>`;
    }
    html += `</div>`;

    // Add "Start Reading" button at bottom of card
    const firstItem = plan.items[0];
    if (firstItem) {
        html += `
            <div style="margin-top: 20px;">
                <button class="btn-primary" onclick="loadScripture('${firstItem.book}', ${firstItem.chapter})">
                    📖 開始閱讀
                </button>
            </div>
        `;
    }

    contentDiv.innerHTML = html;

    // Check catch up
    renderCatchUp();
    updateStats();
}

// --- READER LOGIC ---

window.loadScripture = (bookName, chapter) => {
    const abbr = BOOK_MAP[bookName];
    if (!abbr) {
        alert(`找不到書卷代碼：${bookName}`);
        return;
    }

    // Load Text from Parsed Bible
    const bookData = appState.parsedBible[abbr];
    if (!bookData || !bookData[chapter]) {
        // Try fallback or alert
        document.querySelector('.reader-content').innerHTML = `<p>經文載入失敗 (${abbr} ${chapter})</p>`;
        return;
    }

    const verses = bookData[chapter];

    // Render
    let html = ``;
    for (const [vNum, text] of Object.entries(verses)) {
        html += `<p><span class="verse-num">${chapter}:${vNum}</span> ${text}</p>`;
    }

    document.querySelector('.reader-content').innerHTML = html;
    document.querySelector('.chapter-title').textContent = `${bookName} 第 ${chapter} 章`;

    // Setup Nav Buttons
    renderReaderNav(bookName, chapter);

    // Scroll to top
    document.querySelector('.reader-scroll-area').scrollTop = 0;
};

function renderReaderNav(currentBook, currentChapter) { // currentBook is Full Name
    const navDiv = document.querySelector('.reader-nav');
    navDiv.classList.remove('hidden');

    // Calculate Next/Prev
    // We need the FULL LIST of chapters in order to know what's next.
    // Simplifying: Just use the Plan's sequence? 
    // OR iterate the readingPlan to find current [Book, Chapter] and get next.

    // Let's use the Plan Sequence for "Next Reading".
    // Flatten the whole year plan? Expensive.

    // Better: We just need "Next Chapter" in logical bible order? 
    // User typically wants to read *Today's* chapters.
    // If I am at Gen 1, next is Gen 2.
    // If today is Gen 1, 2, 3. And I finish Gen 3. Next?
    // Maybe "Finish".

    // Let's implement smart "Next Button":
    // 1. Find the index of this chapter in *Today's Plan*.
    // 2. If it has a next item in today's plan, go there.
    // 3. If it is the last item, show "Mark Done" or "Home".

    const dateStr = getDateKey(appState.currentDate);
    const plan = getPlanForDate(dateStr);

    if (!plan) return;

    const currentIndex = plan.items.findIndex(i => i.book === currentBook && i.chapter === currentChapter);

    let html = ``;

    // Prev
    if (currentIndex > 0) {
        const prev = plan.items[currentIndex - 1];
        html += `<button class="btn-secondary" onclick="loadScripture('${prev.book}', ${prev.chapter})">◀ 上一章</button>`;
    } else {
        html += `<div></div>`; // Spacer
    }

    // Next
    if (currentIndex < plan.items.length - 1) {
        const next = plan.items[currentIndex + 1];
        html += `<button class="btn-primary" onclick="finishAndNext('${currentBook}', ${currentChapter}, '${next.book}', ${next.chapter})">下一章 ▶</button>`;
    } else {
        // Last chapter of the day
        html += `<button class="btn-primary" onclick="finishAndHome('${currentBook}', ${currentChapter})">完成今日 ✅</button>`;
    }

    navDiv.innerHTML = html;
}

window.finishAndNext = (cBook, cChap, nBook, nChap) => {
    // Mark current done
    toggleChapter(cBook, cChap); // This toggles, so if already done, it undoes. 
    // We should safely set to TRUE.
    const abbr = BOOK_MAP[cBook];
    appState.chapterProgress[`${abbr}_${cChap}`] = true;
    saveProgress();

    // Go next
    loadScripture(nBook, nChap);
    renderDashboard(); // Update sidebar
};

window.finishAndHome = (cBook, cChap) => {
    const abbr = BOOK_MAP[cBook];
    appState.chapterProgress[`${abbr}_${cChap}`] = true;
    saveProgress();
    renderDashboard();

    alert("今日進度已完成！");
};


// --- STATS & UTILS ---
function updateStats() {
    // 1. Annual Stats
    const completedCount = Object.keys(appState.chapterProgress).length;
    const totalChapters = 1189; // Fixed Bible Total
    const annualPercent = Math.round((completedCount / totalChapters) * 100);

    document.querySelector('.annual-progress .progress-bar').style.width = `${annualPercent}%`;
    document.querySelector('.annual-progress .annual-text').textContent = `累積完成 ${completedCount} / ${totalChapters} 章`;

    // 2. Monthly Stats
    // Filter plan for current VIEWING month
    const viewDate = appState.currentDate;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth(); // 0-11

    // Get all dates in this month
    // Iterate plan entries
    let monthTotal = 0;
    let monthDone = 0;

    // Naive iteration over plan (Optimization: we could index by month)
    appState.readingPlan.forEach(p => {
        const d = new Date(p.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
            // Count chapters in this day
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
    container.innerHTML = ''; // Clear
    container.classList.add('hidden');

    // Find first day with uncompleted chapters
    // Iterate from Jan 1 to Yesterday
    const start = new Date(YEAR_START);
    const end = new Date();
    end.setDate(end.getDate() - 1); // Yesterday

    let earliestUnreadDate = null;

    // We need to iterate dates.
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = getDateKey(d);
        const plan = getPlanForDate(dateStr); // Reuse helper
        if (!plan) continue;

        // Check if all chapters are done
        let allDone = true;
        for (const item of plan.items) {
            const key = `${BOOK_MAP[item.book]}_${item.chapter}`;
            if (!appState.chapterProgress[key]) {
                allDone = false;
                break;
            }
        }

        if (!allDone) {
            earliestUnreadDate = dateStr;
            break; // Found earliest
        }
    }

    if (earliestUnreadDate) {
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="info-banner">
                <span>您有未完成的進度 (${earliestUnreadDate})</span>
                <button class="btn-primary" onclick="goToDate('${earliestUnreadDate}')">補讀</button>
            </div>
        `;
    }
}

window.goToDate = (dateStr) => {
    appState.currentDate = new Date(dateStr);
    checkReturnButton();
    renderDashboard();
};

window.toggleFontSize = () => {
    appState.fontSizeIndex = (appState.fontSizeIndex + 1) % FONT_SIZES.length;
    const size = FONT_SIZES[appState.fontSizeIndex];
    document.documentElement.style.setProperty('--reader-font-size', `${size}pt`);
};


// Export/Import (Keep existing logic simple)
window.exportData = () => {
    const data = JSON.stringify(appState.chapterProgress);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GBC2026BibleReading_progress.json`;
    a.click();
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
                alert("匯入失敗");
            }
        };
        reader.readAsText(file);
    };
    input.click();
};
