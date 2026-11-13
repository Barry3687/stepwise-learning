"use strict";

const progressKey = "lecture-step-by-step:progress:v1";
const chapterList = document.querySelector("#chapter-list");
const chapterNav = document.querySelector("#chapter-nav");
const resetButton = document.querySelector("#reset-progress");
let chapters = [];
let completed = [];
let storageAvailable = true;

try {
  const saved = JSON.parse(localStorage.getItem(progressKey) || "[]");
  completed = Array.isArray(saved) ? saved.filter(id => typeof id === "string") : [];
  const probeKey = progressKey + ":probe";
  localStorage.setItem(probeKey, "1");
  localStorage.removeItem(probeKey);
} catch {
  storageAvailable = false;
  document.querySelector("#storage-note").textContent = "瀏覽器無法保存進度，本次仍可閱讀。";
}

document.querySelector("#menu-toggle").addEventListener("click", event => {
  const open = event.currentTarget.getAttribute("aria-expanded") !== "true";
  event.currentTarget.setAttribute("aria-expanded", String(open));
  document.querySelector("#sidebar").classList.toggle("is-open", open);
});

function showMessage(title, description) {
  const panel = document.createElement("div");
  panel.className = "empty-state";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = description;
  panel.append(heading, text);
  chapterList.replaceChildren(panel);
}

function updateProgress() {
  const ids = new Set(chapters.flatMap(chapter => chapter.concepts.map(concept => concept.id)));
  const count = [...new Set(completed)].filter(id => ids.has(id)).length;
  const bar = document.querySelector("#progress");
  bar.max = Math.max(ids.size, 1);
  bar.value = count;
  document.querySelector("#progress-label").textContent = ids.size
    ? `${count} / ${ids.size} 個觀念已理解`
    : "尚未加入教材";
  resetButton.disabled = count === 0;
}

resetButton.addEventListener("click", () => {
  if (!window.confirm("要重設這個瀏覽器的學習進度嗎？")) return;
  completed = [];
  if (storageAvailable) {
    try {
      localStorage.removeItem(progressKey);
    } catch {
      document.querySelector("#storage-note").textContent = "無法更新瀏覽器中的進度，請檢查儲存設定。";
    }
  }
  updateProgress();
});

async function loadCatalog() {
  try {
    const response = await fetch("content/catalog.json");
    if (!response.ok) throw new Error("無法讀取章節清單");
    const catalog = LectureCore.validateCatalog(await response.json());
    if (catalog.version !== 1 || !Array.isArray(catalog.chapters)) throw new Error("章節格式不正確");
    for (const chapter of catalog.chapters) {
      if (typeof chapter.title !== "string" || typeof chapter.path !== "string" ||
          !Array.isArray(chapter.concepts) || !/^chapters\/[a-z0-9-]+\.html$/.test(chapter.path) ||
          chapter.concepts.some(concept => typeof concept.id !== "string")) {
        throw new Error("章節資料不完整");
      }
    }
    chapters = catalog.chapters;
    document.querySelector("#chapter-count").textContent = `${chapters.length} 個章節`;
    chapterNav.replaceChildren();
    chapterList.replaceChildren();
    if (chapters.length === 0) {
      chapterNav.textContent = "加入教材後，章節會顯示在這裡。";
      showMessage("準備好第一份教材，就能開始。", "請先提供課本或講義，確認第一章的觀念與順序。完成的教學會依序出現在這裡。");
    }
    for (const chapter of chapters) {
      const navLink = document.createElement("a");
      navLink.href = chapter.path;
      navLink.textContent = chapter.title;
      chapterNav.append(navLink);
      const card = document.createElement("a");
      card.className = "chapter-card";
      card.href = chapter.path;
      const title = document.createElement("h3");
      title.textContent = chapter.title;
      const description = document.createElement("p");
      description.textContent = `${chapter.concepts.length} 個觀念 · 循序學習`;
      card.append(title, description);
      chapterList.append(card);
    }
    updateProgress();
  } catch (error) {
    document.querySelector("#chapter-count").textContent = "讀取失敗";
    chapterNav.textContent = "章節暫時無法載入。";
    showMessage("暫時無法載入章節", "請透過 HTTP 預覽或公開網站開啟，確認章節清單已部署後重新整理。");
    console.error(error);
    updateProgress();
  }
}

loadCatalog();
