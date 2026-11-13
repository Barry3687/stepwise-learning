"use strict";
const fs = require("node:fs");
const path = require("node:path");
const core = require("../assets/js/core.js");
const projectRoot = path.resolve(__dirname, "..");

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function chapterEntry(lesson) {
  return {
    id: lesson.id, title: lesson.title, path: `chapters/${lesson.id}.html`,
    concepts: lesson.concepts.map(concept => ({ id: concept.id, title: concept.title }))
  };
}

function checkImages(root, lesson) {
  for (const concept of lesson.concepts) {
    for (const section of concept.sections) {
      for (const block of section.blocks) {
        if (block.type !== "image") continue;
        const image = path.resolve(root, block.src);
        const imageRoot = path.resolve(root, "assets/images") + path.sep;
        if (!fs.existsSync(image) || !fs.realpathSync(image).startsWith(imageRoot)) throw Error(`找不到專案圖片：${block.src}`);
      }
    }
  }
}

function checkProject(root = projectRoot) {
  const catalog = core.validateCatalog(readJSON(path.join(root, "content/catalog.json")));
  for (const chapter of catalog.chapters) {
    const lesson = core.validateLesson(readJSON(path.join(root, "content", chapter.id, "lesson.json")), chapter);
    if (!lesson.concepts.length) throw Error(`章節缺少觀念：${chapter.id}`);
    const page = fs.readFileSync(path.join(root, chapter.path), "utf8");
    if (!page.includes(`data-chapter="${chapter.id}"`)) throw Error(`章節頁面未指定正確識別碼：${chapter.path}`);
    checkImages(root, lesson);
  }
  return catalog;
}

function addChapter(file, root = projectRoot) {
  root = path.resolve(root);
  const lockPath = path.join(root, ".chapter-write.lock");
  const lock = fs.openSync(lockPath, "wx");
  let stage;
  const created = [];
  try {
    const catalog = checkProject(root);
    const lesson = readJSON(file);
    if (!lesson || !Array.isArray(lesson.concepts)) throw Error("教學資料需包含 concepts 陣列。");
    const entry = chapterEntry(lesson);
    const next = core.validateCatalog({ ...catalog, chapters: [...catalog.chapters, entry] });
    core.validateLesson(lesson, entry);
    if (!lesson.concepts.length) throw Error("請至少加入一個完整觀念。");
    checkImages(root, lesson);
    const destination = path.join(root, "content", lesson.id);
    const page = path.join(root, entry.path);
    if (fs.existsSync(destination) || fs.existsSync(page)) throw Error("章節檔案已存在，請先核對既有內容與識別碼。");
    const template = fs.readFileSync(path.join(root, "chapters/lesson.html"), "utf8");
    if (!template.includes("<body>")) throw Error("共用章節模板缺少 body 標記。");
    stage = fs.mkdtempSync(path.join(root, ".chapter-stage-"));
    const stagedContent = path.join(stage, lesson.id);
    fs.mkdirSync(stagedContent);
    fs.writeFileSync(path.join(stagedContent, "lesson.json"), JSON.stringify(lesson, null, 2) + "\n");
    fs.writeFileSync(path.join(stagedContent, "sources.json"), JSON.stringify(lesson.sources, null, 2) + "\n");
    fs.writeFileSync(path.join(stage, "page.html"), template.replace("<body>", `<body data-chapter="${lesson.id}">`));
    fs.writeFileSync(path.join(stage, "catalog.json"), JSON.stringify(next, null, 2) + "\n");
    fs.renameSync(stagedContent, destination);
    created.push(destination);
    fs.renameSync(path.join(stage, "page.html"), page);
    created.push(page);
    // 目錄最後才切換，新增章節未就緒時不會出現在首頁。
    fs.renameSync(path.join(stage, "catalog.json"), path.join(root, "content/catalog.json"));
    return entry;
  } catch (error) {
    for (const file of created.reverse()) {
      if (!file.startsWith(root + path.sep)) throw Error("回復路徑超出專案範圍。");
      fs.rmSync(file, { recursive: true, force: true });
    }
    throw error;
  } finally {
    if (stage) {
      if (path.dirname(stage) !== root || !path.basename(stage).startsWith(".chapter-stage-")) throw Error("暫存路徑錯誤。");
      fs.rmSync(stage, { recursive: true, force: true });
    }
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}

if (require.main === module) {
  try {
    const [command, file] = process.argv.slice(2);
    if (command === "check" && !file) {
      const catalog = checkProject();
      console.log(`檢查通過：${catalog.chapters.length} 個章節，頁面、題目、來源與圖片路徑一致。`);
    } else if (command === "add" && file) {
      const entry = addChapter(path.resolve(file));
      console.log(`已新增 ${entry.title}，共 ${entry.concepts.length} 個觀念。首頁及章節導覽已連結。`);
      console.log("請在瀏覽器驗收教學內容後，再同步到 GitHub。");
    } else throw Error("用法：node scripts/chapters.js check 或 node scripts/chapters.js add 教學資料.json");
  } catch (error) {
    console.error(error.code === "EEXIST" ? "章節正在寫入或已有同名檔案，請確認後再試。" : error.message);
    process.exitCode = 1;
  }
}

module.exports = { addChapter, checkProject };
