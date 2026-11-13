"use strict";
const core = window.LectureCore;
let savedProgress;
try { savedProgress = core.storage(localStorage); }
catch { savedProgress = core.storage(null); }
const target = document.querySelector("#lesson-content");
let lesson;
let catalog;
let currentIndex = 0;
let renderToken = 0;
const drafts = new Map();

function element(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}
function button(text, callback, className = "action-button") {
  const result = element("button", text, className);
  result.type = "button";
  result.addEventListener("click", callback);
  return result;
}
async function getJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error("找不到教材或章節資料");
  return response.json();
}
function refreshProgress() {
  const ids = lesson.concepts.map(c => c.id);
  const count = ids.filter(id => savedProgress.completed.includes(id)).length;
  document.querySelector("#progress").max = Math.max(ids.length, 1);
  document.querySelector("#progress").value = count;
  document.querySelector("#progress-label").textContent = `${count} / ${ids.length} 個觀念已理解`;
  document.querySelector("#reset-progress").disabled = !savedProgress.completed.length;
  if (!savedProgress.available) document.querySelector("#storage-note").textContent = "瀏覽器無法保存進度，本次仍可閱讀。";
  const nav = document.querySelector("#concept-nav");
  nav.replaceChildren();
  lesson.concepts.forEach((concept, index) => {
    const item = element("a", `${savedProgress.completed.includes(concept.id) ? "✓ " : ""}${index + 1}. ${concept.title}`);
    item.href = `#${concept.id}`;
    if (index === currentIndex) item.setAttribute("aria-current", "step");
    nav.append(item);
  });
}
function renderBlock(block, host) {
  if (block.type === "text") host.append(element("p", block.text));
  if (block.type === "formula") host.append(element("div", `\\[${block.text}\\]`, "formula"));
  if (block.type === "image" || block.type === "diagram") {
    const figure = element("figure", undefined, "lesson-figure");
    if (block.type === "image") {
      const image = element("img");
      image.src = "../" + block.src; image.alt = block.alt;
      image.addEventListener("error", () => { figure.replaceChildren(element("p", "圖片無法載入，請查看圖說或回報此教材問題。")); });
      figure.append(image);
    } else {
      try { figure.append(LectureFigures.render(block)); }
      catch (error) { figure.append(element("p", `圖表待修正：${error.message}`)); }
    }
    figure.append(element("figcaption", block.caption || block.alt || "依本觀念資料繪製"));
    host.append(figure);
  }
}
function addReview(concept, host) {
  const panel = element("section", undefined, "review-panel");
  panel.append(element("h2", "檢查我的解題過程"));
  const input = element("textarea");
  input.id = "derivation"; input.rows = 6; input.maxLength = 6000;
  input.placeholder = "寫下你的想法、計算步驟或 LaTeX 公式…";
  input.value = drafts.get(concept.id) || "";
  input.addEventListener("input", () => drafts.set(concept.id, input.value));
  const label = element("label", "你的解題過程"); label.htmlFor = input.id;
  const consentLabel = element("label", undefined, "consent");
  const consent = element("input"); consent.type = "checkbox";
  consentLabel.append(consent, document.createTextNode("同意將本題、相關教材節錄與我的輸入交給後端設定的模型服務檢查。"));
  const result = element("div", undefined, "feedback"); result.setAttribute("role", "status");
  const status = element("p", "正在確認 AI 服務…", "fine-print");
  const send = button("請 AI 檢查", async () => {
    if (!input.value.trim()) { result.textContent = "請先輸入你的解題過程。"; return; }
    if (!consent.checked) { result.textContent = "請先確認資料傳送說明。"; return; }
    send.disabled = true; result.textContent = "正在檢查，請保留這個頁面…";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 65000);
      let response;
      try {
        response = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ chapter: lesson.id, concept: concept.id, answer: input.value }) });
      } finally { clearTimeout(timer); }
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "AI 服務暫時無法使用");
      result.textContent = `AI 回饋（請配合教材核對）\n\n${data.feedback}`;
    } catch (error) {
      result.textContent = error.name === "AbortError" ? "等待逾時。輸入已保留，可以稍後重試。" : `檢查失敗：${error.message}。輸入已保留。`;
    } finally { send.disabled = false; }
  });
  send.disabled = true;
  fetch("/api/status").then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      send.disabled = !data.enabled;
      status.textContent = data.enabled ? "AI 檢查已啟用。請只輸入解題內容。" : "AI 檢查尚未啟用，需在本機後端設定金鑰與模型。";
    }).catch(() => { status.textContent = "此網站尚未連接 AI 後端，仍可閱讀教材、作答與查看解析。"; });
  panel.append(label, input, consentLabel, send, status, result); host.append(panel);
}
function renderConcept() {
  const token = ++renderToken;
  const concept = lesson.concepts[currentIndex];
  if (window.MathJax?.typesetClear) window.MathJax.typesetClear([target]);
  target.replaceChildren();
  target.append(element("p", `觀念 ${currentIndex + 1} / ${lesson.concepts.length}`, "eyebrow"), element("h1", concept.title));
  document.title = `${concept.title} · 循序漸進`;
  if (concept.goal) target.append(element("p", concept.goal, "lead"));
  target.append(element("p", `先備知識：${(concept.prerequisites || []).join("、") || "教材指定的基礎知識"}`, "source-note"));
  for (const section of concept.sections) {
    const area = element("section", undefined, "teaching-section");
    area.append(element("h2", section.title));
    area.append(element("span", section.origin || "教材整理", "origin-tag"));
    section.blocks.forEach(block => renderBlock(block, area));
    target.append(area);
  }
  const sourcePanel = element("details", undefined, "sources");
  sourcePanel.append(element("summary", "本觀念的教材來源"));
  for (const source of lesson.sources.filter(source => concept.sources.includes(source.id))) {
    sourcePanel.append(element("p", [source.title, source.author, source.edition, source.section, source.pages && `頁碼 ${source.pages}`, source.pdfPages && `PDF 第 ${source.pdfPages} 頁`].filter(Boolean).join(" · ")));
    if (source.url && /^https?:\/\//.test(source.url)) {
      const link = element("a", "查看來源"); link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; sourcePanel.append(link);
    }
  }
  target.append(sourcePanel);
  const quiz = element("section", undefined, "quiz-panel");
  quiz.append(element("p", "自編練習 · 檢驗剛才的觀念", "eyebrow"), element("h2", "換你試試看"));
  const form = element("form");
  const fieldset = element("fieldset"); fieldset.append(element("legend", concept.quiz.prompt));
  concept.quiz.options.forEach((option, i) => {
    const label = element("label", undefined, "option");
    const radio = element("input"); radio.type = "radio"; radio.name = "answer"; radio.value = String(i); radio.required = true;
    label.append(radio, document.createTextNode(`${String.fromCharCode(65 + i)}. ${option}`)); fieldset.append(label);
  });
  const feedback = element("p", "先選一個答案，再確認你的理解。", "feedback"); feedback.setAttribute("role", "status");
  const submit = element("button", "確認答案", "action-button"); submit.type = "submit";
  const solution = element("div", undefined, "solution"); solution.hidden = true;
  const show = button("查看完整解析", () => { solution.hidden = false; continueButton.disabled = false; renderMath(solution); }, "secondary-button"); show.disabled = true;
  solution.append(element("h3", `正確答案：${String.fromCharCode(65 + concept.quiz.answer)}`));
  concept.quiz.explanations.forEach((explanation, i) => solution.append(element("p", `${String.fromCharCode(65 + i)}. ${explanation}`)));
  form.append(fieldset, submit, show);
  form.addEventListener("submit", event => {
    event.preventDefault();
    const selected = new FormData(form).get("answer");
    if (selected === null) return;
    show.disabled = false;
    const correct = Number(selected) === concept.quiz.answer;
    feedback.textContent = correct ? "答對了！確認理解後，可以繼續下一個觀念。" : `再想想看。提示：${concept.quiz.hint}`;
    feedback.classList.toggle("correct", correct);
    if (correct) continueButton.disabled = false;
    submit.textContent = "再確認一次";
  });
  quiz.append(form, feedback, solution); target.append(quiz);
  if (concept.numeric) {
    const n = concept.numeric;
    const numeric = element("section", undefined, "quiz-panel"); numeric.append(element("h2", "數值練習"));
    const nform = element("form"); const number = element("input"); number.type = "text"; number.inputMode = "decimal"; number.id = "numeric-answer";
    const nlabel = element("label", `${n.prompt}（單位 ${n.unit || "無"}，容許誤差 ±${n.tolerance}）`); nlabel.htmlFor = number.id;
    const nresult = element("p"); nresult.setAttribute("role", "status");
    const nsubmit = element("button", "核對數值", "secondary-button"); nsubmit.type = "submit";
    nform.append(nlabel, number, nsubmit); numeric.append(nform, nresult);
    nform.addEventListener("submit", e => { e.preventDefault(); const correct = core.checkNumeric(number.value, n.answer, n.tolerance); nresult.textContent = correct === null ? "請輸入有限的數字，單位不需輸入。" : correct ? "數值正確。" : "數值還不一致，請檢查單位、代入與計算。"; });
    target.append(numeric);
  }
  addReview(concept, target);
  const controls = element("div", undefined, "lesson-controls");
  const previous = button("← 上一個觀念", () => navigate(currentIndex - 1), "secondary-button"); previous.disabled = currentIndex === 0;
  const continueButton = button(currentIndex === lesson.concepts.length - 1 ? "我已理解，完成本章 ✓" : "我已理解，下一個觀念 →", () => {
    savedProgress.complete(concept.id); refreshProgress();
    if (currentIndex + 1 < lesson.concepts.length) navigate(currentIndex + 1);
    else {
      continueButton.textContent = "本章已完成 ✓";
      const nextChapter = catalog.chapters[catalog.chapters.findIndex(c => c.id === lesson.id) + 1];
      if (nextChapter && !controls.querySelector("a")) {
        const link = element("a", "前往下一章 →", "action-button"); link.href = "../" + nextChapter.path; controls.append(link);
      }
    }
  });
  continueButton.disabled = !savedProgress.completed.includes(concept.id);
  controls.append(previous, continueButton); target.append(controls);
  refreshProgress();
  renderMath(target, token);
}
function renderMath(host, token = renderToken) {
  if (!window.MathJax?.typesetPromise) return;
  window.MathJax.startup.promise.then(() => {
    if (token === renderToken && host.isConnected) return window.MathJax.typesetPromise([host]);
  }).catch(() => {});
}
function navigate(index) { location.hash = lesson.concepts[index].id; }
function selectHash() {
  const index = lesson.concepts.findIndex(c => `#${c.id}` === location.hash);
  currentIndex = index >= 0 ? index : 0;
  renderConcept();
  window.scrollTo({ top: 0, behavior: "auto" });
}
document.querySelector("#menu-toggle").addEventListener("click", e => {
  const open = e.currentTarget.getAttribute("aria-expanded") !== "true";
  e.currentTarget.setAttribute("aria-expanded", String(open)); document.querySelector("#sidebar").classList.toggle("is-open", open);
});
document.querySelector("#reset-progress").addEventListener("click", () => {
  if (confirm("要重設這個瀏覽器的全部學習進度嗎？")) { savedProgress.reset(); renderConcept(); }
});
(async () => {
  try {
    catalog = core.validateCatalog(await getJSON("../content/catalog.json"));
    const chapter = catalog.chapters.find(c => c.id === document.body.dataset.chapter);
    if (!chapter) throw Error("這個章節尚未加入教材。請先回首頁查看已開放的章節。");
    lesson = core.validateLesson(await getJSON(`../content/${chapter.id}/lesson.json`), chapter);
    if (!lesson.concepts.length) throw Error("本章尚未加入觀念。");
    document.querySelector("#chapter-name").textContent = chapter.title;
    window.MathJax = { tex: { inlineMath: [["\\(", "\\)"]], displayMath: [["\\[", "\\]"]] }, options: { enableMenu: false }, startup: { typeset: false } };
    const script = document.createElement("script"); script.src = "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js";
    script.addEventListener("load", () => renderMath(target));
    script.addEventListener("error", () => target.prepend(element("p", "公式排版服務暫時無法載入，以下保留原始 LaTeX 公式。", "source-note")));
    document.head.append(script);
    window.addEventListener("hashchange", selectHash); selectHash();
  } catch (error) {
    target.replaceChildren(element("h1", "教材準備中"), element("p", error.message));
    document.querySelector("#progress-label").textContent = "尚未開放";
    document.querySelector("#reset-progress").disabled = true;
  }
})();
