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

使用者操作步驟見 [新增章節](https://barry3687.github.io/stepwise-learning/getting-started.html)。提供教材與章節範圍給專案中的 AI，先讀 AGENTS.md，確認大綱後製作教學資料，執行工具加入網站，再驗收與發布。

```sh
node scripts/chapters.js add "你的教學資料.json"
node scripts/chapters.js check
```

資料格式與圖表參數見 content/FORMAT.md。工具會建立頁面與來源檔並更新 catalog，首頁及章節導覽依清單呈現。現有章節修改後執行 check，確認頁面、題目與圖片路徑一致。網站目前尚無直接上傳 PDF 自動生成課程的介面。

首頁可接續最後閱讀位置，章節卡片顯示已理解的觀念數量。章節頁內切換觀念時保留選項、提示、數值輸入及推導草稿；這些作答內容只在該頁的當次使用期間保留，重新整理後仍保存完成進度與最後位置。

原始私人教材放入已忽略的 private/materials/。公開範圍確認後再放入可發布的整理內容，API key 由後端密鑰管理。

## 驗收

```sh
node tests/core.test.js
node tests/chapters.test.js
python tests/server_test.py
python tests/preview.py
```

最後一個指令在獨立暫存資料夾建立介面驗收章節，開啟 http://127.0.0.1:8001 。停止程序時移除暫存資料，不改正式 catalog。完整狀態見 TESTING.md。


## 講義上傳、座標探索與算式批改

首頁與章節上方的「講義與資料上傳區」支援拖曳或選檔。TXT/MD 直接預覽；PNG/JPG 顯示圖片；PDF 提供瀏覽器預覽。檔案只留當頁記憶體，不自動儲存或上傳 GitHub。PDF/DOCX 的文字解析與 AI 整理需要本機後端。PDF 請提供可選字的 100 頁內節錄，掃描版請改成清楚的圖片；DOCX 解析不保留排版或公式物件，務必對照原稿。

從專案資料夾執行：

```powershell
python -m pip install -r backend/requirements.txt
$env:GROQ_API_KEY="你的金鑰"
$env:LECTURE_MODEL="你可用的文字模型識別碼"
$env:LECTURE_VISION_MODEL="你可用且支援圖片的模型識別碼"
python backend/server.py --port 8000
```

瀏覽 http://127.0.0.1:8000 。金鑰只在目前程序環境；不要把真正的金鑰寫入程式或提交。模型需在你的供應商帳號可用，未設定時網站會明確提示。公開 GitHub Pages 沒有此 Python 後端，仍可閱讀、作答、預覽檔案及使用座標工具。

座標探索可輸入 XYZ；電磁學章節在 lesson.json 或 concept 設 `subject: "electromagnetics"`，上傳講義則由使用者勾選電磁學，才啟用圓柱／球面轉換。所有模式繪製相同物理點，採物理學 θ 自 +Z、φ 自 +X 朝 +Y 的定義。

章節的 AI 作答區可貼上、拖曳或選擇算式截圖。選擇題答案、文字與圖片一起送出，需勾選資料傳送同意；圖片會縮至最長邊 1600 像素。移除圖片不影響文字與原有選擇題判分。AI 整理產生的內容仍是草稿，核對後再使用原本章節匯入流程。
