# 新增正式教材

先讀 AGENTS.md，取得使用者教材、公開範圍並確認大綱。

## 建議流程

先依下面格式整理成教學 JSON，再執行新增工具。圖片先放進 assets/images/ 的章節資料夾。

```sh
node scripts/chapters.js add "你的教學資料.json"
node scripts/chapters.js check
```

工具會檢查資料、來源、題目與圖片，建立章節頁、lesson.json、來源副本 sources.json，再更新 catalog.json。已有同名章節會停止，寫入失敗會回復本輪新增檔案。它負責整合資料，教學是否正確仍須依教材驗收。

lesson.json 的 sources 是網頁使用的來源資料；sources.json 是匯入時建立的可讀副本，之後修改來源時請同步維護。

## 手動維護的檔案對應

1. 在 catalog.json 加入章節 id、title、path、concepts。章節 ID 例如 ch01-vectors，path 為 chapters/ch01-vectors.html。
2. 複製 chapters/lesson.html 至章節 path，在 body 加上 data-chapter="ch01-vectors"。
3. 在 content/ch01-vectors/lesson.json 儲存以下結構。來源資料填實際教材，不沿用測試資料。
4. 填入完整教學後驗算題目與圖表，檢查首頁、導覽與前後觀念。

```json
{
  "id": "ch01-vectors",
  "title": "實際章節名稱",
  "sources": [{"id":"s1","title":"實際教材名稱","author":"作者","edition":"版本","section":"章節","pages":"頁碼","pdfPages":"PDF 頁次"}],
  "concepts": [{
    "id":"ch01-c01",
    "title":"實際觀念名稱",
    "goal":"學習目標",
    "prerequisites":["已學的先備知識"],
    "sources":["s1"],
    "sections":[{"title":"用途與直覺","origin":"教材整理","blocks":[{"type":"text","text":"依教材填寫完整說明"}]}],
    "quiz":{"prompt":"自編題目","options":["A","B","C","D"],"answer":0,"hint":"提示","explanations":["A 的理由","B 的問題","C 的問題","D 的問題"]}
  }]
}
```

觀念的 sections 可依教學流程增列，blocks 可包含 text、formula、image、diagram。文字以純文字及行內 LaTeX 表示，完整公式使用 formula 區塊，text 放 LaTeX 內容。

image 使用 src（以 assets/images/ 開頭）、alt、caption。diagram 使用以下參數，另加 caption。

- XY，kind="xy"，title、xLabel、yLabel 與 points（有限數值的 [x,y] 陣列）。用單調 X 座標取樣，依公式計算，刻度與曲線自動繪出。
- 一階低通波德圖，kind="bode"，cutoff（正值）、gain（正值）、unit（Hz 或 rad/s）。只適用 G(s)=K/(1+s/ωc)。其他系統另行繪圖，勿錯用此圖。
- XYZ 投影，kind="vector"，vector 與 onto 為三維有限數值陣列，onto 不可為零。

可選 numeric 題包含 prompt、answer、tolerance（絕對誤差）與 unit。

catalog 的 concepts 必須與 lesson 的 id、title 及順序完全相同。根目錄首頁由 catalog 自動生成，章節側欄由 lesson 自動生成。

文字、公式、圖片的教材／補充來源以 origin 與 sources 說明。sections 必須具備教學目標要求的實際內容，通過格式驗證不代表教學已正確。
