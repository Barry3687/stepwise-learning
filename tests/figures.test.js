"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../assets/js/core.js');
function element(name){return {name,attrs:{},children:[],setAttribute(k,v){this.attrs[k]=String(v);},append(...nodes){this.children.push(...nodes);},querySelector(name){return this.children.find(n=>n.name===name);}};}
const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/figures.js'),'utf8'),{window,LectureCore:core,document:{createElementNS(_ns,name){return element(name);}}});
const walk=node=>[node,...node.children.flatMap(walk)];
for(const point of [[2,1,2],[-2,1,-3],[0,0,0],[0,0,2]]){
  for(const mode of ['cartesian','cylindrical','spherical']){
    const nodes=walk(window.LectureFigures.coordinateDiagram(point,mode));
    assert(nodes.every(n=>!Object.values(n.attrs).some(v=>/NaN|Infinity/.test(v))));
    assert(nodes.some(n=>n.name==='circle'&&n.attrs.r==='5'));
    const text=nodes.filter(n=>n.name==='text'||n.name==='desc').map(n=>n.textContent).join(' ');
    if(point.every(v=>v===0)&&mode==='spherical')assert(text.includes('未定義'));
  }
}
const nodes=walk(window.LectureFigures.coordinateDiagram([2,1,2]));
const dashed=nodes.filter(n=>n.name==='line'&&n.attrs['stroke-dasharray']==='4 5');
assert.equal(dashed.length,3);
assert.equal(dashed[0].attrs.x1,dashed[0].attrs.x2);
const x=core.projectSpace([1,0,0]), y=core.projectSpace([0,1,0]);
assert(Math.abs(Math.atan2(x[1],-x[0])*180/Math.PI-30)<1e-10);
assert(Math.abs(Math.atan2(y[1],y[0])*180/Math.PI-30)<1e-10);
assert.throws(()=>window.LectureFigures.coordinateDiagram([NaN,1,2]));
console.log('PASS: three projection segments, vertical Z drop, 30 degree axes, negative/zero coordinates and singular angles');
