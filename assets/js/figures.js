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
  function line(svg, x1, y1, x2, y2, color = "#888888", dash = "") {
    svg.append(node("line", { x1, y1, x2, y2, stroke: color, "stroke-dasharray": dash, "stroke-width": 1.5 }));
  }
  function label(svg, x, y, text, anchor = "middle", fontSize = 14.4) {
    svg.append(node("text", { x, y, fill: "#eeeeee", "font-size": fontSize, "text-anchor": anchor }, text));
  }
  function plot(svg, points, color = "#eeeeee") {
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
      line(svg, px, 65, px, 250, "#333333");
      line(svg, px, 345, px, 500, "#333333");
      label(svg, px, 273, (spec.cutoff * 10 ** exponent).toPrecision(3));
      label(svg, px, 523, (spec.cutoff * 10 ** exponent).toPrecision(3));
    }
    for (const db of [0, -10, -20, -30, -40]) {
      line(svg, 75, magY(gainDB + db), 635, magY(gainDB + db), "#333333");
      label(svg, 64, magY(gainDB + db) + 4, (gainDB + db).toFixed(1), "end");
    }
    for (const deg of [0, -45, -90]) {
      line(svg, 75, phaseY(deg), 635, phaseY(deg), "#333333");
      label(svg, 64, phaseY(deg) + 4, String(deg), "end");
    }
    const magnitudes = [], phases = [];
    for (let i = 0; i <= 160; i++) {
      const exponent = -2 + i / 40;
      const result = LectureCore.bode(spec.cutoff * 10 ** exponent, spec.cutoff, spec.gain);
      magnitudes.push([x(exponent), magY(result.magnitude)]);
      phases.push([x(exponent), phaseY(result.phase)]);
    }
    plot(svg, magnitudes); plot(svg, phases, "#cccccc");
    line(svg, x(0), 65, x(0), 250, "#aaaaaa", "5 4");
    line(svg, x(0), 345, x(0), 500, "#aaaaaa", "5 4");
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
    const items = [[spec.vector, "a", "#eeeeee"], [spec.onto, "b", "#aaaaaa"], [projection, "proj_b(a)", "#cccccc"]];
    const bounds = [0, 1, 2].map(axis => [Math.min(0, ...items.map(([v]) => v[axis])), Math.max(extent * 1.3, ...items.map(([v]) => v[axis]))]);
    const planes = [["XY", 0, 1, "#eeeeee"], ["XZ", 0, 2, "#aaaaaa"], ["YZ", 1, 2, "#cccccc"]];
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
        svg.append(node("circle", { cx: p[0], cy: p[1], r: 2, fill: "#111111", stroke: color, "stroke-width": .9 }));
      }
    }
    for (let axis = 0; axis < 3; axis++) {
      const end = [0, 0, 0]; end[axis] = extent * 1.7;
      const negative = [0, 0, 0]; negative[axis] = -extent * .4;
      const p = project(end), n = project(negative);
      line(svg, ...n, ...origin, "#888888", "3 5");
      svg.append(node("line", { x1: origin[0], y1: origin[1], x2: p[0], y2: p[1], stroke: "#bbbbbb", "stroke-width": 1, "marker-end": `url(#${markerId})` }));
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
      line(svg, x(vx), 60, x(vx), 260, "#333333");
      line(svg, 75, y(vy), 605, y(vy), "#333333");
      label(svg, x(vx), 280, Number(vx.toPrecision(3)).toString());
      label(svg, 65, y(vy) + 4, Number(vy.toPrecision(3)).toString(), "end");
    }
    line(svg, 75, y(0), 605, y(0)); line(svg, x(0), 60, x(0), 260);
    plot(svg, spec.points.map(p => [x(p[0]), y(p[1])]));
    label(svg, 340, 314, spec.xLabel); label(svg, 75, 30, spec.yLabel, "start");
    return svg;
  }
  function coordinateDiagram(point, system = "cartesian") {
    if (!Array.isArray(point) || point.length !== 3 || point.some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) throw Error("請輸入範圍內的有限座標");
    const [x,y,z] = point, extent = Math.max(1, ...point.map(Math.abs));
    const project = v => { const p = LectureCore.projectSpace(v); return [340 + p[0]*105/extent, 265 + p[1]*105/extent]; };
    const svg = canvas("立體卡氏座標與分量投影", `目標點 (${point.join(", ")})，X 左下、Y 右下、Z 向上。虛線標示 x、y、z 分量。`, Math.max(375, project(point)[1] + 30));
    const origin=project([0,0,0]), p=project(point), foot=project([x,y,0]);
    const defs=node("defs"), id=`point-arrow-${++serial}`;
    const marker=node("marker",{id,viewBox:"0 0 8 8",refX:7,refY:4,markerWidth:6,markerHeight:6,markerUnits:"userSpaceOnUse",orient:"auto"});
    marker.append(node("path",{d:"M0 1L7 4L0 7Z",fill:"#ddd"}));defs.append(marker);svg.append(defs);
    [[0,1,"XY"],[0,2,"XZ"],[1,2,"YZ"]].forEach(([a,b,name])=>{
      const lo=point.map(v=>Math.min(0,v)), hi=point.map(v=>Math.max(extent*1.15,v));
      const corners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{const q=[0,0,0];q[a]=u?hi[a]:lo[a];q[b]=v?hi[b]:lo[b];return project(q);});
      svg.append(node("polygon",{points:corners.map(q=>q.join(",")).join(" "),fill:"#ccc","fill-opacity":.035,stroke:"#777","stroke-opacity":.3,"stroke-width":.7}));
    });
    ["X","Y","Z"].forEach((name,axis)=>{
      const end=[0,0,0];end[axis]=extent*1.65;const q=project(end);
      const neg=[0,0,0];neg[axis]=-extent*1.1;line(svg,...project(neg),...origin,"#555","3 5");
      svg.append(node("line",{x1:origin[0],y1:origin[1],x2:q[0],y2:q[1],stroke:"#bbb","stroke-width":1,"marker-end":`url(#${id})`}));
      label(svg,q[0]+(axis===0?-12:12),q[1],name);
    });
    const segments=[[p,foot,`z₁ = ${z}`],[foot,project([x,0,0]),`y₁ = ${y}`],[foot,project([0,y,0]),`x₁ = ${x}`]];
    segments.forEach(([a,b,name],i)=>{
      if(Math.hypot(a[0]-b[0],a[1]-b[1])>.1){line(svg,...a,...b,"#eee","4 5"); label(svg,(a[0]+b[0])/2+(i===0?18:0),(a[1]+b[1])/2+(i===0?0:18),name,"middle",10);}
    });
    [[x,0,z],[0,y,z]].forEach(v=>line(svg,...p,...project(v),"#777","2 6"));
    svg.append(node("circle",{cx:foot[0],cy:foot[1],r:3,fill:"#161616",stroke:"#ddd"}));
    svg.append(node("circle",{cx:p[0],cy:p[1],r:5,fill:"#fff",stroke:"#888","stroke-width":3}));
    label(svg,p[0]+12,p[1]-14,`(${point.join(", ")})`,"start");label(svg,origin[0]+12,origin[1]+18,"O");
    const rho=Math.hypot(x,y), r=Math.hypot(x,y,z), phi=rho?Math.atan2(y,x)*180/Math.PI:null, theta=r?Math.acos(Math.max(-1,Math.min(1,z/r)))*180/Math.PI:null;
    const deg=v=>v===null?"未定義":`${Number(v.toFixed(2))}°`;
    let caption=`卡氏座標 (x, y, z) = (${point.join(", ")})`;
    if(system==="cylindrical")caption=`圓柱座標：ρ = ${rho.toFixed(3)}，φ = ${deg(phi)}，z = ${z}`;
    if(system==="spherical")caption=`球面座標：r = ${r.toFixed(3)}，θ = ${deg(theta)}，φ = ${deg(phi)}`;
    const description = svg.querySelector("desc");
    description.textContent += ` ${caption}。φ 自 +X 朝 +Y；θ 自 +Z 測量，角度單位：度。等角投影示意，實際長度與夾角以座標計算。`;
    if(system!=="cartesian" && rho>0){
      const arc=[];const angle=Math.atan2(y,x);for(let i=0;i<=36;i++)arc.push(project([rho*Math.cos(angle*i/36),rho*Math.sin(angle*i/36),0]));plot(svg,arc,"#aaa");
      line(svg,...origin,...foot,"#aaa","2 4");
    }
    if(system==="spherical" && r>0){
      line(svg,...origin,...p,"#ddd");
      const arc=[], angle=theta*Math.PI/180, az=rho?Math.atan2(y,x):0;
      for(let i=0;i<=36;i++){const t=angle*i/36;arc.push(project([r*Math.sin(t)*Math.cos(az),r*Math.sin(t)*Math.sin(az),r*Math.cos(t)]));}plot(svg,arc,"#888");
    }
    return svg;
  }
  return { coordinateDiagram, render(spec) {
    if (spec.kind === "bode") return bodeDiagram(spec);
    if (spec.kind === "vector") return vectorDiagram(spec);
    if (spec.kind === "xy") return xyDiagram(spec);
    throw Error("未支援的圖解格式");
  } };
})();
