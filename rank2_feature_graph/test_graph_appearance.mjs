import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false});return elements.get(id)};
el('graphWidthBySize').checked=true;el('graphEdgeWidth').value='6';el('graphFadeStrength').value='.1';
const graph={nodes:[1,2,3,4].map(id=>({id})),edges:[{id:'a',from:1,to:2,frequency:100},{id:'b',from:2,to:3,frequency:25},{id:'c',from:3,to:4,frequency:1}]};
const lookup=new Map([[1,[0,0,0]],[2,[20,0,0]],[3,[20,20,0]],[4,[0,20,0]]]);
let selected=null;
const c=vm.createContext({el,current:()=>graph,activeEdge:e=>e.id===selected,esc:String,fmt:String,graphLayoutHover:()=>'',console});
vm.runInContext(fs.readFileSync(new URL('view_tools.js',import.meta.url),'utf8'),c);
const run=s=>vm.runInContext(s,c),plain=x=>JSON.parse(JSON.stringify(x));
const before=JSON.stringify({graph,lookup:[...lookup]});
assert.deepEqual(graph.edges.map(e=>c.graphEdgeWidth(e)),[6,3.5,1.5]);
assert.equal(c.graphEdgeWidth(graph.edges[2],true),3.5);
const subset={nodes:graph.nodes.slice(2),edges:[graph.edges[2]]};
assert.equal(c.graphEdgeWidthGroups(subset,()=>false)[0].width,1.5,'Filtering must not rescale a rare state');
const byEdge=traces=>new Map(traces.flatMap(t=>[...new Set(t.customdata.filter(Boolean))].map(id=>[id,{width:t.line.width,coords:t.x.map((x,i)=>[x,t.y[i],t.z[i]]).filter((_,i)=>t.customdata[i]===id)}])));
const initial=byEdge(c.graphEdgeTraces(graph,lookup));
c.restoreGraphWidthSettings({scaled:true,maximum:10});
const wider=byEdge(c.graphEdgeTraces(graph,lookup));
for(const [id,old] of initial){assert.deepEqual(wider.get(id).coords,old.coords);assert(wider.get(id).width>old.width)}
selected='b';const selectedTraces=c.graphEdgeTraces(graph,lookup);assert.equal(byEdge(selectedTraces).get('b').width,7.5);
const clipped=c.graphEdgeTraces(graph,lookup,p=>({x:p[0]*10,y:p[1]*10}));
assert.deepEqual(clipped.map(t=>t.line.width),selectedTraces.map(t=>t.line.width),'Camera clipping preserves edge-group order');
c.restoreGraphWidthSettings({scaled:false,maximum:4});assert.deepEqual(graph.edges.map(e=>c.graphEdgeWidth(e)),[4,4,4]);
assert.equal(c.graphEdgeTraces({nodes:[],edges:[]},lookup).length,0);
for(const bad of [null,0,99,NaN,'bad']){c.restoreGraphWidthSettings({maximum:bad});assert.equal(c.graphWidthSettings().maximum,6)}
c.restoreGraphWidthSettings();assert.deepEqual(plain(c.graphWidthSettings()),{scaled:true,maximum:6});
assert.equal(JSON.stringify({graph,lookup:[...lookup]}),before);
// Exercise the actual camera-trimming path with variable edge-trace counts.
c.graphGeometry=()=>({g:graph,lookup});c.graphScreenPoint=p=>({x:p[0]*10,y:p[1]*10});c.liveViewCamera=()=>({eye:{x:1,y:2,z:3}});c.participant={active:false};
el('dimension').value='3';el('graph3d')._fullLayout={scene:{_scene:{}}};
let trimmed;
c.Plotly={relayout:async()=>{},restyle:async(_,updates,indices)=>{trimmed={updates,indices}}};
el('graph3d').data=c.graphEdgeTraces(graph,lookup);await c.trimGraphEdges();assert.equal(trimmed.indices.length,c.graphEdgeTraces(graph,lookup).length);assert.deepEqual(plain(trimmed.indices),Array.from({length:trimmed.indices.length},(_,i)=>i));
assert.equal(trimmed.updates.line.length,trimmed.indices.length);
console.log('PASS: size-scaled/uniform widths, selection emphasis, full-graph denominator, stable geometry, camera trimming, empty graphs and invalid settings.');

const priorTrim=trimmed;c.restoreGraphWidthSettings({scaled:false,maximum:11});await c.trimGraphEdges();assert.equal(trimmed,priorTrim,'A pending width redraw must not trim an older trace layout');
