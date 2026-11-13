"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { addChapter, checkProject } = require("../scripts/chapters.js");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "lecture-import-check-"));
try {
  fs.mkdirSync(path.join(root, "content"));
  fs.mkdirSync(path.join(root, "chapters"));
  fs.copyFileSync(path.join(__dirname, "../chapters/lesson.html"), path.join(root, "chapters/lesson.html"));
  const catalogFile = path.join(root, "content/catalog.json");
  fs.writeFileSync(catalogFile, JSON.stringify({ version: 1, chapters: [] }));
  const file = path.join(__dirname, "fixture.json");
  addChapter(file, root);
  assert.equal(checkProject(root).chapters.length, 1);
  const originalCatalog = fs.readFileSync(catalogFile, "utf8");
  assert.throws(() => addChapter(file, root));
  assert.equal(fs.readFileSync(catalogFile, "utf8"), originalCatalog);
  const second = JSON.parse(fs.readFileSync(file, "utf8"));
  second.id = "ch98-interface-check";
  second.concepts.forEach((concept, i) => { concept.id = `ch98-c0${i + 1}`; });
  const secondFile = path.join(root, "second.json");
  fs.writeFileSync(secondFile, JSON.stringify(second));
  const rename = fs.renameSync;
  fs.renameSync = function (from, to) {
    if (to === catalogFile) throw Error("simulated catalog write failure");
    return rename(from, to);
  };
  try { assert.throws(() => addChapter(secondFile, root), /simulated/); }
  finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(catalogFile, "utf8"), originalCatalog);
  assert.equal(fs.existsSync(path.join(root, "content", second.id)), false);
  assert.equal(fs.existsSync(path.join(root, "chapters", second.id + ".html")), false);
  fs.writeFileSync(path.join(root, ".chapter-write.lock"), "other writer");
  assert.throws(() => addChapter(secondFile, root), /EEXIST/);
  assert.equal(fs.readFileSync(path.join(root, ".chapter-write.lock"), "utf8"), "other writer");
  console.log("PASS: add chapter, duplicate protection, failed-write rollback and concurrent writer lock");
} finally {
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("lecture-import-check-")) throw Error("Unexpected test directory");
  fs.rmSync(root, { recursive: true, force: true });
}
