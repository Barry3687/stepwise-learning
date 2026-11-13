# 循序漸進

給自己使用的大學課本與講義循序教學網站。深色介面，每次學習一個觀念，搭配逐步推導、圖解與基礎題。

- 公開網站 https://barry3687.github.io/stepwise-learning/
- Repository https://github.com/Barry3687/stepwise-learning
- 開發規則 [AGENTS.md](AGENTS.md)

## 目前狀態

已完成深色首頁、逐觀念閱讀介面、選擇題、答錯提示、重試、手動開啟解析、數值誤差判分、瀏覽器進度保存與重設、MathJax 公式，以及 XY、XYZ 投影與一階低通波德圖繪製。

自由推導檢查的前端與本機後端已建立。需設定模型與金鑰後才能進行真實模型檢查，目前未設定與未驗證真實模型呼叫。

依使用者選擇，正式課程等提供教材後加入。公開首頁目前有 0 個章節，tests/fixture.json 是獨立功能驗收資料，正式目錄不包含該章節。尚待正式教材驗算與新對話擴充驗證。

## 本機預覽

在本目錄執行以下指令後開啟 http://localhost:8000 。

```sh
python backend/server.py
```

開啟 http://127.0.0.1:8000 。本機後端只監聽本機位址，會阻擋私人檔案與跨來源 API 請求。

GitHub Pages 可發布靜態網站，AI 檢查需使用已設定的本機後端。公開後端尚未部署，Pages 上會顯示 AI 尚未連接。

## 啟用 AI 推導檢查

在同一個 PowerShell 工作階段設定 GROQ_API_KEY 與 LECTURE_MODEL，再啟動後端。模型填你帳號目前可使用的 Groq 文字模型名稱。不要把真實金鑰存入 Repository 或前端。

```powershell
$env:GROQ_API_KEY = '在本機設定你的金鑰'
$env:LECTURE_MODEL = '你的模型名稱'
python backend/server.py
```

本機啟動後，送出前需勾選資料傳送同意。只傳當前觀念與學生輸入至 Groq，教材內容由後端讀取，瀏覽器不持有金鑰。

API 相容介面參考 https://console.groq.com/docs/openai 。

## 後續新增教材

先請 AI 讀取 AGENTS.md，提供教材與目標章節，確認觀念大綱後製作內容。資料格式與圖表參數見 content/FORMAT.md。更新 content/catalog.json 的章節與穩定觀念 ID，首頁依清單呈現章節。

原始私人教材放入已忽略的 private/materials/。公開範圍確認後再放入可發布的整理內容，API key 由後端密鑰管理。

## 驗收

```sh
node tests/core.test.js
python tests/server_test.py
python tests/preview.py
```

最後一個指令在獨立暫存資料夾建立介面驗收章節，開啟 http://127.0.0.1:8001 。停止程序時移除暫存資料，不改正式 catalog。完整狀態見 TESTING.md。
