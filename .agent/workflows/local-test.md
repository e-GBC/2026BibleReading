---
description: 啟動或是重新啟動 Bible Reading App 的本機測試伺服器並提供連結
---

因為您關機後伺服器會自動停止，以下是幫您整理好的 VS Code 啟動流程，您可以直接照著做：

🚀 啟動測試伺服器流程
1. **開啟終端機 (Terminal)**：
   在 VS Code 中按下快捷鍵 Ctrl + ` (鍵盤左上角)，或是從選單選擇 終端機 -> 新終端機。
2. **確認資料夾位置**：
   請確保終端機左側的路徑顯示為 .../012.BibleReading。
   (如果不在這個資料夾，請在終端機輸入：`cd c:\Antigravity\000.Practice\012.BibleReading`)
3. **輸入啟動指令**：
   請複製並貼上以下指令後按回車 (Enter)：
// turbo
```powershell
npx -y http-server . -p 8080
```
4. **開啟網頁**：
   看到顯示 Available on: http://127.0.0.1:8080 後，就可以點擊下方連結：
   http://localhost:8080/
