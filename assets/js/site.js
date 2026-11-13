"use strict";

const chapterList = document.querySelector("#chapter-list");
const chapterNav = document.querySelector("#chapter-nav");
const resetButton = document.querySelector("#reset-progress");
let chapters = [];
let progressState;
try { progressState = LectureCore.storage(localStorage); }
catch { progressState = LectureCore.storage(null); }

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
  const count = progressState.completed.filter(id => ids.has(id)).length;
  const bar = document.querySelector("#progress");
  bar.max = Math.max(ids.size, 1);
  bar.value = count;
  document.querySelector("#progress-label").textContent = ids.size
    ? `${count} / ${ids.size} 個觀念已理解`
    : "尚未加入教材";
  resetButton.disabled = count === 0;
  if (!progressState.available) document.querySelector("#storage-note").textContent = "瀏覽器無法保存進度，本次仍可閱讀。";
  const resume = LectureCore.resumeConcept(chapters, progressState.completed, progressState.lastId);
  const link = document.querySelector("#resume-learning");
  link.hidden = !resume;
  if (resume) {
    link.href = `${resume.chapter.path}#${resume.concept.id}`;
    link.textContent = `${progressState.lastId ? "接續學習" : "開始學習"}：${resume.concept.title} →`;
  }
}

resetButton.addEventListener("click", () => {
  if (!window.confirm("要重設這個瀏覽器的學習進度嗎？")) return;
  progressState.reset();
  updateProgress();
});

async function loadCatalog() {
  try {
    const response = await fetch("content/catalog.json");
    if (!response.ok) throw new Error("無法讀取章節清單");
    const catalog = LectureCore.validateCatalog(await response.json());
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
      const count = chapter.concepts.filter(concept => progressState.completed.includes(concept.id)).length;
      description.textContent = `${chapter.concepts.length} 個觀念 · 已理解 ${count} 個`;
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
