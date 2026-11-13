"use strict";
window.LectureFigures = (() => {
  const NS = "http://www.w3.org/2000/svg";
  let serial = 0;
  function node(name, attrs, text) {
    const item = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs || {})) item.setAttribute(key, value);
    if (text !== undefined) item.textContent = text;
    return item;
  }
  function canvas(title, description, height = 330) {
    const id = `figure-${++serial}`;
    const svg = node("svg", { viewBox: `0 0 680 ${height}`, role: "img", "aria-labelledby": `${id}-title ${id}-desc` });
    svg.append(node("title", { id: id + "-title" }, title), node("desc", { id: id + "-desc" }, description));
    return svg;
  }
  function line(svg, x1, y1, x2, y2, color = "#7185a0", dash = "") {
    svg.append(node("line", { x1, y1, x2, y2, stroke: color, "stroke-dasharray": dash, "stroke-width": 1.5 }));
  }
  function label(svg, x, y, text, anchor = "middle") {
    svg.append(node("text", { x, y, fill: "#dbeafe", "font-size": 12, "text-anchor": anchor }, text));
  }
  function plot(svg, points, color = "#8dbbff") {
    svg.append(node("polyline", { points: points.map(p => p.join(",")).join(" "), fill: "none", stroke: color, "stroke-width": 2.5 }));
  }
  function bodeDiagram(spec) {
    if (!Number.isFinite(spec.cutoff) || spec.cutoff <= 0 || !["Hz", "rad/s"].includes(spec.unit) ||
        !Number.isFinite(spec.gain) || spec.gain <= 0) throw Error("波德圖參數錯誤");
    const svg = canvas("一階低通系統波德圖", `截止頻率 ${spec.cutoff} ${spec.unit}，增益 ${spec.gain}。藍線為實際計算，虛線標示截止頻率。`, 570);
    const gainDB = 20 * Math.log10(spec.gain);
    const frequencyName = spec.unit === "rad/s" ? "ωc" : "fc";
    const x = exponent => 75 + (exponent + 2) * 140;
    const magY = db => 70 + (gainDB + 5 - db) * 3.6;
    const phaseY = degrees => 350 + (-degrees) * 1.6;
    for (let exponent = -2; exponent <= 2; exponent++) {
      const px = x(exponent);
      line(svg, px, 65, px, 250, "#334155");
      line(svg, px, 345, px, 500, "#334155");
      label(svg, px, 273, (spec.cutoff * 10 ** exponent).toPrecision(3));
      label(svg, px, 523, (spec.cutoff * 10 ** exponent).toPrecision(3));
    }
    for (const db of [0, -10, -20, -30, -40]) {
      line(svg, 75, magY(gainDB + db), 635, magY(gainDB + db), "#334155");
      label(svg, 64, magY(gainDB + db) + 4, (gainDB + db).toFixed(1), "end");
    }
    for (const deg of [0, -45, -90]) {
      line(svg, 75, phaseY(deg), 635, phaseY(deg), "#334155");
      label(svg, 64, phaseY(deg) + 4, String(deg), "end");
    }
    const magnitudes = [], phases = [];
    for (let i = 0; i <= 160; i++) {
      const exponent = -2 + i / 40;
      const result = LectureCore.bode(spec.cutoff * 10 ** exponent, spec.cutoff, spec.gain);
      magnitudes.push([x(exponent), magY(result.magnitude)]);
      phases.push([x(exponent), phaseY(result.phase)]);
    }
    plot(svg, magnitudes); plot(svg, phases, "#8fe0bf");
    line(svg, x(0), 65, x(0), 250, "#f4c77f", "5 4");
    line(svg, x(0), 345, x(0), 500, "#f4c77f", "5 4");
    label(svg, 75, 35, "幅值（dB）", "start");
    label(svg, 75, 320, "相位（°）", "start");
    label(svg, 390, 115, `${frequencyName}：相對直流增益 −3.01 dB`, "start");
    label(svg, 390, 415, `${frequencyName}：−45°`, "start");
    label(svg, 350, 558, `頻率（${spec.unit}，對數刻度）`);
    return svg;
  }
  function vectorDiagram(spec) {
    const vectors = [spec.vector, spec.onto];
    if (vectors.some(v => !Array.isArray(v) || v.length !== 3 || v.some(x => !Number.isFinite(x)))) throw Error("空間圖需要兩個三維向量");
    const projection = LectureCore.projectVector(spec.vector, spec.onto);
    const extent = Math.max(1, ...vectors.flat().map(Math.abs), ...projection.map(Math.abs));
    const scale = 110 / extent;
    const project = vector => {
      const [x, y] = LectureCore.projectSpace(vector);
      return [340 + scale * x, 305 + scale * y];
    };
    const svg = canvas("XYZ 向量與三平面投影", `向量 a = ${spec.vector.join(", ")}，方向 b = ${spec.onto.join(", ")}，proj_b(a) = ${projection.map(v => v.toFixed(2)).join(", ")}。X 向左下、Y 向右下、Z 向上。每個向量端點以虛線投影至 XY、XZ、YZ 平面。正交投影示意，畫面角度不代表實際空間夾角。`, 540);
    const defs = node("defs");
    const markerId = `arrow-${++serial}`;
    const marker = node("marker", { id: markerId, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, markerUnits: "userSpaceOnUse", orient: "auto" });
    marker.append(node("path", { d: "M 0 1 L 7 4 L 0 7 z", fill: "context-stroke" }));
    defs.append(marker); svg.append(defs);
    const origin = project([0, 0, 0]);
    const items = [[spec.vector, "a", "#8dbbff"], [spec.onto, "b", "#f4c77f"], [projection, "proj_b(a)", "#8fe0bf"]];
    const bounds = [0, 1, 2].map(axis => [Math.min(0, ...items.map(([v]) => v[axis])), Math.max(extent * 1.3, ...items.map(([v]) => v[axis]))]);
    const planes = [["XY", 0, 1, "#8dbbff"], ["XZ", 0, 2, "#b8a5ee"], ["YZ", 1, 2, "#8fe0bf"]];
    for (const [name, first, second, color] of planes) {
      const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => {
        const v = [0, 0, 0]; v[first] = bounds[first][a]; v[second] = bounds[second][b]; return v;
      });
      svg.append(node("polygon", { points: corners.map(v => project(v).join(",")).join(" "), fill: color, "fill-opacity": .045, stroke: color, "stroke-opacity": .22, "stroke-width": .7 }));
      for (let i = 1; i <= 3; i++) {
        for (const [a, b] of [[first, second], [second, first]]) {
          const from = [0, 0, 0], to = [0, 0, 0];
          from[a] = to[a] = bounds[a][0] + (bounds[a][1] - bounds[a][0]) * i / 4;
          from[b] = bounds[b][0]; to[b] = bounds[b][1];
          const p = project(from), q = project(to);
          svg.append(node("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: color, "stroke-width": .5, "stroke-opacity": .14 }));
        }
      }
      const center = corners.reduce((sum, v) => sum.map((x, i) => x + v[i] / 4), [0, 0, 0]);
      const position = project(center);
      label(svg, position[0], position[1] + 8, `${name} 平面`);
    }
    for (const [v, , color] of items) {
      const endpoint = project(v);
      for (const foot of Object.values(LectureCore.planeProjections(v))) {
        const p = project(foot);
        if (Math.hypot(endpoint[0] - p[0], endpoint[1] - p[1]) > .1) {
          svg.append(node("line", { x1: endpoint[0], y1: endpoint[1], x2: p[0], y2: p[1], stroke: color, "stroke-width": 1, "stroke-dasharray": "4 5", "stroke-opacity": .75 }));
        }
        if (Math.hypot(p[0] - origin[0], p[1] - origin[1]) > .1) {
          svg.append(node("line", { x1: origin[0], y1: origin[1], x2: p[0], y2: p[1], stroke: color, "stroke-width": .8, "stroke-dasharray": "3 5", "stroke-opacity": .38 }));
        }
        svg.append(node("circle", { cx: p[0], cy: p[1], r: 2, fill: "#131d2d", stroke: color, "stroke-width": .9 }));
      }
    }
    for (let axis = 0; axis < 3; axis++) {
      const end = [0, 0, 0]; end[axis] = extent * 1.7;
      const negative = [0, 0, 0]; negative[axis] = -extent * .4;
      const p = project(end), n = project(negative);
      line(svg, ...n, ...origin, "#7185a0", "3 5");
      svg.append(node("line", { x1: origin[0], y1: origin[1], x2: p[0], y2: p[1], stroke: "#9cacc2", "stroke-width": 1, "marker-end": `url(#${markerId})` }));
      label(svg, p[0] + (axis === 0 ? -14 : 12), p[1], ["X", "Y", "Z"][axis]);
    }
    label(svg, origin[0] + 12, origin[1] + 18, "O");
    items.forEach(([v, name, color], index) => {
      const p = project(v);
      if (Math.hypot(p[0] - origin[0], p[1] - origin[1]) > .1) {
        svg.append(node("line", { x1: origin[0], y1: origin[1], x2: p[0], y2: p[1], stroke: color, "stroke-width": 1.7, "stroke-linecap": "round", "marker-end": `url(#${markerId})` }));
        label(svg, p[0] + (index === 0 ? 10 : -10), p[1] + (index === 1 ? -12 : -10), name, index === 0 ? "start" : "end");
      }
      const y = 445 + index * 23;
      line(svg, 42, y - 4, 62, y - 4, color);
      label(svg, 72, y, `${name} = (${v.map(x => Number(x.toFixed(3))).join(", ")})`, "start");
    });
    label(svg, 638, 449, "虛線：向量端點至三個座標平面的投影", "end");
    label(svg, 638, 476, "X 左下 · Y 右下 · Z 向上", "end");
    label(svg, 340, 525, "正交投影示意 · 空間長度與夾角以實際座標計算為準");
    return svg;
  }
  function xyDiagram(spec) {
    if (!Array.isArray(spec.points) || spec.points.length < 2 || spec.points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v)))) throw Error("XY 圖需要有限的座標點");
    const xs = spec.points.map(p => p[0]), ys = spec.points.map(p => p[1]);
    const xmin = Math.min(0, ...xs), xmax = Math.max(0, ...xs), ymin = Math.min(0, ...ys), ymax = Math.max(0, ...ys);
    const dx = xmax - xmin || 1, dy = ymax - ymin || 1;
    const x = value => 75 + (value - xmin) / dx * 530;
    const y = value => 260 - (value - ymin) / dy * 200;
    const svg = canvas(spec.title || "XY 座標圖", `${spec.xLabel} 對 ${spec.yLabel}，依提供的離散資料點連線。`);
    for (let i = 0; i <= 4; i++) {
      const vx = xmin + dx * i / 4, vy = ymin + dy * i / 4;
      line(svg, x(vx), 60, x(vx), 260, "#334155");
      line(svg, 75, y(vy), 605, y(vy), "#334155");
      label(svg, x(vx), 280, Number(vx.toPrecision(3)).toString());
      label(svg, 65, y(vy) + 4, Number(vy.toPrecision(3)).toString(), "end");
    }
    line(svg, 75, y(0), 605, y(0)); line(svg, x(0), 60, x(0), 260);
    plot(svg, spec.points.map(p => [x(p[0]), y(p[1])]));
    label(svg, 340, 314, spec.xLabel); label(svg, 75, 30, spec.yLabel, "start");
    return svg;
  }
  return { render(spec) {
    if (spec.kind === "bode") return bodeDiagram(spec);
    if (spec.kind === "vector") return vectorDiagram(spec);
    if (spec.kind === "xy") return xyDiagram(spec);
    throw Error("未支援的圖解格式");
  } };
})();
