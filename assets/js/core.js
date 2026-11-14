(function (scope) {
  "use strict";
  const KEY = "lecture-step-by-step:progress:v1";
  function validateCatalog(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.chapters)) throw Error("章節清單格式錯誤");
    const ids = new Set();
    for (const chapter of data.chapters) {
      if (!/^ch\d{2}-[a-z0-9-]+$/.test(chapter.id) || typeof chapter.title !== "string" ||
          chapter.path !== `chapters/${chapter.id}.html` || !Array.isArray(chapter.concepts)) throw Error("章節資料不完整");
      if (ids.has(chapter.id)) throw Error("重複章節");
      ids.add(chapter.id);
      for (const concept of chapter.concepts) {
        if (!concept || !new RegExp(`^${chapter.id.slice(0, 4)}-c\\d{2}$`).test(concept.id) || typeof concept.title !== "string" || !concept.title.trim() || ids.has(concept.id)) throw Error("觀念識別碼或標題錯誤");
        ids.add(concept.id);
      }
    }
    return data;
  }
  function validateLesson(data, chapter) {
    if (!data || data.id !== chapter.id || data.title !== chapter.title || !Array.isArray(data.concepts) || !Array.isArray(data.sources)) throw Error("章節內容格式錯誤");
    if (data.concepts.length !== chapter.concepts.length) throw Error("觀念數量不一致");
    const sourceIds = new Set(data.sources.map(source => source.id));
    if (sourceIds.size !== data.sources.length || data.sources.some(source => !source.id || typeof source.title !== "string" || !source.title.trim())) throw Error("教材來源缺少名稱或識別碼重複");
    for (const [index, concept] of data.concepts.entries()) {
      const q = concept.quiz;
      if (concept.id !== chapter.concepts[index].id || concept.title !== chapter.concepts[index].title ||
          !Array.isArray(concept.sections) || !concept.sections.length ||
          !Array.isArray(concept.sources) || !concept.sources.length || concept.sources.some(id => !sourceIds.has(id)) ||
          !q || typeof q.prompt !== "string" || !Array.isArray(q.options) || q.options.length !== 4 ||
          q.options.some(value => typeof value !== "string") || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3 ||
          typeof q.hint !== "string" || !Array.isArray(q.explanations) || q.explanations.length !== 4 ||
          q.explanations.some(value => typeof value !== "string")) throw Error("觀念、來源或題目資料錯誤");
      for (const section of concept.sections) {
        if (typeof section.title !== "string" || !Array.isArray(section.blocks)) throw Error("教學區塊不完整");
        for (const block of section.blocks) {
          if (!["text", "formula", "image", "diagram"].includes(block.type)) throw Error("未知教學區塊");
          if (["text", "formula"].includes(block.type) && typeof block.text !== "string") throw Error("缺少文字或公式");
          if (block.type === "image" && (!/^assets\/images\/[a-zA-Z0-9_./-]+\.(svg|png|jpg|jpeg|webp)$/.test(block.src) || block.src.includes("..") || !block.alt)) throw Error("圖片路徑或替代文字錯誤");
          if (block.type === "diagram") validateDiagram(block);
        }
      }
      if (concept.numeric) {
        const n = concept.numeric;
        if (typeof n.prompt !== "string" || !Number.isFinite(n.answer) || !Number.isFinite(n.tolerance) || n.tolerance < 0) throw Error("數值題格式錯誤");
      }
    }
    return data;
  }
  function validateDiagram(block) {
    if (block.kind === "bode" && Number.isFinite(block.cutoff) && block.cutoff > 0 && Number.isFinite(block.gain) && block.gain > 0 && ["Hz", "rad/s"].includes(block.unit)) return;
    if (block.kind === "vector" && [block.vector, block.onto].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) && block.onto.some(x => x !== 0)) return;
    if (block.kind === "xy" && typeof block.xLabel === "string" && block.xLabel.trim() && typeof block.yLabel === "string" && block.yLabel.trim() &&
        Array.isArray(block.points) && block.points.length >= 2 && block.points.every((p, i) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && (i === 0 || p[0] > block.points[i - 1][0]))) return;
    throw Error("圖表資料或座標單位不完整");
  }
  function resumeConcept(chapters, completed, lastId) {
    const entries = chapters.flatMap(chapter => chapter.concepts.map(concept => ({ chapter, concept })));
    const last = entries.find(entry => entry.concept.id === lastId);
    if (last && !completed.includes(lastId)) return last;
    return entries.find(entry => entry.chapter === last?.chapter && !completed.includes(entry.concept.id)) ||
      entries.find(entry => !completed.includes(entry.concept.id)) || last || entries[0] || null;
  }
  function checkNumeric(raw, answer, tolerance) {
    const text = String(raw).trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
    const value = Number(text);
    if (!Number.isFinite(value)) return null;
    return Math.abs(value - answer) <= tolerance + Number.EPSILON * Math.max(1, Math.abs(answer));
  }
  function bode(omega, cutoff, gain = 1) {
    if (!(omega > 0 && cutoff > 0 && gain > 0)) throw Error("頻率與增益必須大於零");
    const ratio = omega / cutoff;
    return { magnitude: 20 * Math.log10(gain) - 10 * Math.log10(1 + ratio * ratio), phase: -Math.atan(ratio) * 180 / Math.PI };
  }
  function projectVector(vector, onto) {
    const denominator = onto.reduce((sum, x) => sum + x * x, 0);
    if (!denominator) throw Error("投影目標必須是非零向量");
    const scale = vector.reduce((sum, x, i) => sum + x * onto[i], 0) / denominator;
    return onto.map(x => x * scale);
  }
  function planeProjections([x, y, z]) {
    return { XY: [x, y, 0], XZ: [x, 0, z], YZ: [0, y, z] };
  }
  function projectSpace([x, y, z]) {
    const elevation = Math.asin(1 / Math.sqrt(3));
    return [Math.SQRT1_2 * (y - x), Math.sin(elevation) * Math.SQRT1_2 * (x + y) - Math.cos(elevation) * z];
  }
  function storage(storageObject) {
    let available = true;
    let completed = [];
    let lastId = null;
    try {
      const saved = JSON.parse(storageObject.getItem(KEY) || "[]");
      completed = Array.isArray(saved) ? [...new Set(saved.filter(id => typeof id === "string"))] : [];
      lastId = storageObject.getItem(KEY + ":last") || null;
      storageObject.setItem(KEY + ":probe", "1");
      storageObject.removeItem(KEY + ":probe");
    } catch { available = false; }
    return {
      get available() { return available; },
      get completed() { return [...completed]; },
      get lastId() { return lastId; },
      visit(id) {
        lastId = id;
        try { storageObject.setItem(KEY + ":last", id); } catch { available = false; }
      },
      complete(id) {
        completed = [...new Set([...completed, id])];
        try { storageObject.setItem(KEY, JSON.stringify(completed)); } catch { available = false; }
      },
      reset() {
        completed = [];
        lastId = null;
        try { storageObject.removeItem(KEY); storageObject.removeItem(KEY + ":last"); } catch { available = false; }
      }
    };
  }
  scope.LectureCore = { validateCatalog, validateLesson, checkNumeric, bode, projectVector, planeProjections, projectSpace, resumeConcept, storage };
  if (typeof module !== "undefined") module.exports = scope.LectureCore;
})(typeof window === "undefined" ? globalThis : window);
