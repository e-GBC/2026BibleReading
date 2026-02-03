/**
 * pwa-handler.js
 * Modular PWA logic for "Add to Home Screen"
 */

let deferredPrompt;

// 1. Detect Environment
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
const isInAppBrowser = /Line|FBAN|FBAV/i.test(navigator.userAgent);

document.addEventListener('DOMContentLoaded', () => {
    initPWALogic();
});

function initPWALogic() {
    // Hide buttons if already installed
    if (isStandalone) {
        document.querySelectorAll('[data-i18n="shortcutBtn"]').forEach(el => el.classList.add('hidden'));
        return;
    }

    // Handle In-App Browsers (LINE/FB)
    if (isInAppBrowser) {
        showInAppBrowserOverlay();
    }

    // Catch Android/Desktop Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        console.log('PWA: beforeinstallprompt captured');
    });
}

/**
 * Main function triggered by clicking the "Add to Home Screen" link/button
 */
window.createShortcut = () => {
    if (isIOS) {
        showIOSGuide();
    } else if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
            }
            deferredPrompt = null;
        });
    } else {
        // Fallback or generic message for Android/Chrome if prompt not yet available
        alert(navigator.language.startsWith('zh')
            ? "請選擇瀏覽器選單中的「安裝應用程式」或「加入主畫面」。"
            : "Please select 'Install App' or 'Add to Home Screen' from your browser menu.");
    }
};

// --- UI COMPONENTS (OVERLAYS) ---

function showInAppBrowserOverlay() {
    const overlay = document.createElement('div');
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 9999; color: white;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 20px; text-align: center; font-size: 1.5rem; line-height: 1.5;
    `;
    overlay.innerHTML = `
        <div style="background: #2196F3; padding: 20px; border-radius: 15px; border: 2px solid white;">
            <p>检测到您正在使用 LINE 或 Facebook 浏览器</p>
            <p style="font-size: 1.2rem; margin-top: 10px;">請點擊右上角 [...] 並選擇<b>「使用預設瀏覽器開啟」</b><br>(iOS 請用 Safari / Android 請用 Chrome)</p>
            <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 20px; padding: 10px 20px; border-radius: 10px; border: none; background: white; color: #2196F3; font-weight: bold; font-size: 1.2rem;">我知道了</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

function showIOSGuide() {
    const overlay = document.createElement('div');
    overlay.id = 'pwa-ios-guide';
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 9999; color: white;
        display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
        padding: 20px; font-family: sans-serif;
    `;

    overlay.innerHTML = `
        <div style="background: white; color: #333; width: 100%; max-width: 400px; border-radius: 20px 20px 0 0; padding: 30px; position: relative; animation: slideUp 0.5s ease-out;">
            <button onclick="document.getElementById('pwa-ios-guide').remove()" style="position: absolute; right: 15px; top: 15px; background: none; border: none; font-size: 24px;">×</button>
            <h2 style="margin-top: 0; text-align: center;">加入主畫面教學</h2>
            
            <div style="margin: 25px 0;">
                <p style="font-size: 1.2rem; display: flex; align-items: center;">
                    <span style="background: #2196F3; color: white; border-radius: 50%; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px;">1</span>
                    點選下方導覽列的「分享」圖示
                </p>
                <div style="text-align: center; margin-top: 10px;">
                    <svg width="40" height="40" viewBox="0 0 50 50" fill="#2196F3"><path d="M30,15V10h-10v5h-5v25h20V15H30z M25,12.5c1.4,0,2.5,1.1,2.5,2.5S26.4,17.5,25,17.5s-2.5-1.1-2.5-2.5S23.6,12.5,25,12.5z M32,37H18V18h14V37z"/><rect x="23.5" y="22" width="3" height="10" fill="#2196F3"/><polygon points="25,18 20,23 30,23" fill="#2196F3"/></svg>
                </div>
            </div>

            <div style="margin: 25px 0;">
                <p style="font-size: 1.2rem; display: flex; align-items: center;">
                    <span style="background: #2196F3; color: white; border-radius: 50%; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px;">2</span>
                    向下捲動並點選「加入主畫面」
                </p>
                <div style="text-align: center; margin-top: 10px;">
                    <div style="display: inline-flex; align-items: center; border: 1px solid #ddd; padding: 10px 20px; border-radius: 10px; background: #f9f9f9;">
                        <span style="font-size: 24px; margin-right: 10px;">✚</span>
                        <span style="font-weight: bold;">加入主畫面</span>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 20px;">
                <div style="display: inline-block; animation: bounce 2s infinite;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="#2196F3"><path d="M7 10l5 5 5-5z"/></svg>
                </div>
            </div>
        </div>
        <style>
            @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            @keyframes bounce { 0%, 20%, 50%, 80%, 100% {transform: translateY(0);} 40% {transform: translateY(10px);} 60% {transform: translateY(5px);} }
        </style>
    `;
    document.body.appendChild(overlay);
}
