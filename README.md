# 懷恩堂編年式讀經 APP (GBC 2026 Chronological Bible Reading)

這是一個專為 2026 年設計的編年式讀經追蹤工具。

## 系統介紹
- **側邊欄 (Dashboard)**: 顯示日期導航、月度與年度進度條、以及當日的讀經進度。
- **閱讀器 (Reader)**: 整合經文顯示，支援字體縮放與自動標記完成。
- **資料管理**: 提供進度代碼匯出與匯入功能 (`GBC2026BibleReading_progress.json`)。

## 目錄結構
- `/app`: 網頁程式碼 (HTML, CSS, JS)。
- `/data`: 讀經計畫與經文數據。
- `/scripts`: 資料解析工具。

## 如何部署至 GitHub Pages
1. 在 GitHub 上建立一個新的儲存庫 (Repository)。
2. 將此資料夾內的所有內容上傳至該儲存庫。
3. 進入儲存庫的 **Settings > Pages**。
4. 在 **Build and deployment** 下，選取 `main` 分支作為來源。
5. 部署完成後，您的應用程式網址為：
   `https://<您的 GitHub 帳號>.github.io/<儲存庫名稱>/`

## 開發工具
- 使用 Vanilla JS / CSS / HTML。
- 資料來源: Excel 讀經進度表。
