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
for(const percent of [25,100,180,300]){
 c.setGraphVertexScale(percent);assert.equal(c.graphVertexScale(),percent);assert.equal(el('graphVertexScaleValue').textContent,percent+'%');
 for(const dimension of [2,3]){
  const base=dimension===2?5:4;
  assert.equal(c.graphNodeSize(1,dimension),base*percent/100);
  assert.equal(c.graphNodeSize(4,dimension)**2/c.graphNodeSize(1,dimension)**2,4,'Marker area stays proportional to degree');
  assert(c.graphNodeSize(0,dimension)>0,'Isolated vertices remain visible');
 }
}
for(const bad of [undefined,null,0,24,301,NaN,'bad']){c.setGraphVertexScale(bad);assert.equal(c.graphVertexScale(),100)}
const smallGap=c.graphEdgeTraces(graph,lookup,p=>({x:p[0]*10,y:p[1]*10})).find(t=>t.customdata.includes('a')).x[0];
c.setGraphVertexScale(200);
const largeGap=c.graphEdgeTraces(graph,lookup,p=>({x:p[0]*10,y:p[1]*10})).find(t=>t.customdata.includes('a')).x[0];
assert(largeGap>smallGap,'Larger vertices increase edge clearance');
c.setGraphVertexScale();assert.equal(c.graphVertexScale(),100,'Older settings preserve the original sizes');

// Sphere meshes retain center, degree area ratios, colors, fading and vertex identity.
c.selectedVertex=2;c.rank3={enabled:false};c.graphNodeLabel=n=>'Vertex '+n.id;
el('graphSpheres').checked=true;el('graphFadeBySize').checked=true;
const spheres=c.graphSphereTraces(graph,lookup,c.graphNodeDegrees(graph),c.graphFadeStyle(graph));
assert.equal(spheres.length,graph.nodes.length);
for(const t of spheres){
 const center=lookup.get(t.meta.graphSphere),degree=c.graphNodeDegrees(graph).get(t.meta.graphSphere),radius=c.graphNodeSize(degree)*c.graphSphereUnit(lookup);
 assert.equal(t.type,'mesh3d');assert.equal(t.opacity,c.graphFadeStyle(graph).node(t.meta.graphSphere));
 assert.equal(t.color,t.meta.graphSphere===2?'#cf6b21':'#d62728');assert(t.customdata.every(id=>id==='vertex:'+t.meta.graphSphere));
 for(let n=0;n<t.x.length;n++)assert(Math.abs(Math.hypot(t.x[n]-center[0],t.y[n]-center[1],t.z[n]-center[2])-radius)<1e-10);
 for(let n=0;n<t.i.length;n++){
  const ids=[t.i[n],t.j[n],t.k[n]];assert(ids.every(i=>i>=0&&i<t.x.length));
  const [a,b,d]=ids.map(i=>[t.x[i]-center[0],t.y[i]-center[1],t.z[i]-center[2]]),u=b.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]);
  const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  assert(normal.reduce((sum,x,i)=>sum+x*a[i],0)>0,'Every triangle has an outward non-degenerate normal');
 }
}
const degrees=c.graphNodeDegrees(graph),project=p=>({x:p[0]*10,y:p[1]*10}),extent=c.graphVertexExtent(1,degrees,lookup,project);
assert(Math.abs(extent-c.graphNodeSize(1)*c.graphSphereUnit(lookup)*10)<1e-9);
assert.equal(c.graphVertexExtent(1,degrees,lookup,p=>({x:p[0]*20,y:p[1]*20})),2*extent,'Sphere picking/gaps grow with zoom');
assert(Math.abs((c.graphVertexExtent(2,degrees,lookup,project)/extent)**2-2)<1e-9);
assert.equal(c.graphSphereTraces({nodes:[],edges:[]},new Map(),new Map(),c.graphFadeStyle(graph)).length,0);
el('graphSpheres').checked=false;el('graphFadeBySize').checked=false;
assert.equal(c.graphVertexExtent(1,degrees,lookup,project),c.graphNodeSize(1),'Flat marker behavior is unchanged');
assert.deepEqual(graph.edges.map(e=>c.graphEdgeWidth(e)),[6,3.5,1.5]);
assert.equal(c.graphEdgeWidth(graph.edges[2],true),3.5);
const subset={nodes:graph.nodes.slice(2),edges:[graph.edges[2]]};
assert.equal(c.graphEdgeWidthGroups(subset,()=>false)[0].width,1.5,'Filtering must not rescale a rare state');
const byEdge=traces=>new Map(traces.flatMap(t=>[...new Set(t.customdata.filter(Boolean))].map(id=>[id,{width:t.line.width,coords:t.x.map((x,i)=>[x,t.y[i],t.z[i]]).filter((_,i)=>t.customdata[i]===id)}])));
const initial=byEdge(c.graphEdgeTraces(graph,lookup));
assert.deepEqual(plain(c.graphColorSettings()),{vertex:'#d62728',edge:'#82a9b9'});
c.restoreGraphColorSettings({vertex:'#AA2233',edge:'#2244AA'});
assert.deepEqual(plain(c.graphColorSettings()),{vertex:'#aa2233',edge:'#2244aa'});
assert.equal(c.graphVertexColor(),'#aa2233');assert.equal(c.graphVertexColor(true),'#cf6b21');
assert.equal(c.graphEdgeColor(true),'#cf6b21');
const recolored=c.graphEdgeTraces(graph,lookup);
assert(recolored.every(t=>t.line.color==='#2244aa'));
for(const [id,old] of initial){assert.deepEqual(byEdge(recolored).get(id).coords,old.coords);assert.equal(byEdge(recolored).get(id).width,old.width)}
el('graphFadeBySize').checked=true;assert(c.graphEdgeTraces(graph,lookup).every(t=>t.line.color.filter(Boolean).every(color=>color==='#2244aa'||color.startsWith('rgba(34,68,170,'))));el('graphFadeBySize').checked=false;
for(const bad of [null,'red','#123','garbage',{}]){c.restoreGraphColorSettings({vertex:bad,edge:bad});assert.deepEqual(plain(c.graphColorSettings()),{vertex:'#d62728',edge:'#82a9b9'})}
c.restoreGraphColorSettings();assert.deepEqual(plain(c.graphColorSettings()),{vertex:'#d62728',edge:'#82a9b9'});

for(const [strength,widths] of [[.05,[6,5.5,5]],[.5,[6,3.5,1.5]],[1,[6,2.5,1]],[2,[6,1.5,1]]]){
 c.restoreGraphWidthSettings({scaled:true,maximum:6,strength});
 assert.deepEqual(graph.edges.map(e=>c.graphEdgeWidth(e)),widths,'Strength changes size contrast, retaining the maximum and minimum');
 const changed=byEdge(c.graphEdgeTraces(graph,lookup));
 for(const [id,old] of initial)assert.deepEqual(changed.get(id).coords,old.coords,'Strength preserves coordinates');
 assert.equal(c.graphEdgeWidthGroups(subset,()=>false)[0].width,widths[2],'Strength still uses the full-graph denominator');
 assert.equal(el('graphWidthStrengthControl').hidden,false);
}
for(const bad of [null,0,-1,2.1,NaN,'bad']){c.restoreGraphWidthSettings({strength:bad});assert.equal(c.graphWidthSettings().strength,.5)}
c.restoreGraphWidthSettings({scaled:false,maximum:6,strength:2});assert.deepEqual(graph.edges.map(e=>c.graphEdgeWidth(e)),[6,6,6]);assert.equal(el('graphWidthStrengthControl').hidden,true);
c.restoreGraphWidthSettings({scaled:true,maximum:6});assert.equal(c.graphWidthSettings().strength,.5,'Older named views keep square-root scaling');

c.restoreGraphWidthSettings({scaled:true,maximum:10});
const wider=byEdge(c.graphEdgeTraces(graph,lookup));
for(const [id,old] of initial){assert.deepEqual(wider.get(id).coords,old.coords);assert(wider.get(id).width>old.width)}
selected='b';const selectedTraces=c.graphEdgeTraces(graph,lookup);assert.equal(byEdge(selectedTraces).get('b').width,7.5);
const clipped=c.graphEdgeTraces(graph,lookup,p=>({x:p[0]*10,y:p[1]*10}));
assert.deepEqual(clipped.map(t=>t.line.width),selectedTraces.map(t=>t.line.width),'Camera clipping preserves edge-group order');
c.restoreGraphWidthSettings({scaled:false,maximum:4});assert.deepEqual(graph.edges.map(e=>c.graphEdgeWidth(e)),[4,4,4]);
assert.equal(c.graphEdgeTraces({nodes:[],edges:[]},lookup).length,0);
for(const bad of [null,0,99,NaN,'bad']){c.restoreGraphWidthSettings({maximum:bad});assert.equal(c.graphWidthSettings().maximum,6)}
c.restoreGraphWidthSettings();assert.deepEqual(plain(c.graphWidthSettings()),{scaled:true,maximum:6,strength:.5});
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
// Lighting changes target only sphere materials, retaining geometry, colors and other traces.
c.restoreSphereLighting('graph');c.restoreSphereLighting('sample');
assert.deepEqual(plain(c.sphereLightingSettings('graph')),{ambient:85,highlights:18});
assert.deepEqual(plain(c.vertexSphereLighting('sample')),{ambient:.85,diffuse:.35,specular:.18,roughness:.6,fresnel:0});
for(const invalid of [null,'',NaN,Infinity,-1,101,'bad']){
 c.restoreSphereLighting('graph',{ambient:invalid,highlights:invalid});
 assert.deepEqual(plain(c.sphereLightingSettings('graph')),{ambient:85,highlights:18});
}
for(const invalid of [null,{}, {ambient:NaN,highlights:18},{ambient:50,highlights:101}])assert.throws(()=>c.validateSphereLighting(invalid),/lighting/);
c.validateSphereLighting(undefined);c.validateSphereLighting({ambient:0,highlights:100});
el('graphSpheres').checked=true;el('sampleReferenceSpheres').checked=true;el('sampleReferenceSpheres').disabled=false;
c.restoreSphereLighting('graph',{ambient:30,highlights:75});
assert.deepEqual(plain(c.sphereLightingSettings('sample')),{ambient:85,highlights:18},'Panels are independent');
const references=[{type:'mesh3d',meta:{referenceSphere:true},x:[1,2],color:'red',opacity:.5},{meta:{sampleView:'v'},x:[3,4],marker:{color:'blue'}},{meta:{participant:true},x:[5]}];
el('samples').data=references;el('graph3d').data=[spheres[0],{meta:{graphEdges:true},x:[9]}];
const immutable=JSON.stringify({references,graph:el('graph3d').data});let lightingUpdate;
c.Plotly.restyle=async(plot,updates,indices)=>{lightingUpdate={plot,updates,indices}};
await c.updateSphereLighting('graph');
assert.equal(lightingUpdate.plot,el('graph3d'));assert.deepEqual(plain(lightingUpdate.indices),[0]);assert.equal(lightingUpdate.updates.lighting[0].ambient,.3);assert.equal(lightingUpdate.updates.lighting[0].specular,.75);
c.restoreSphereLighting('sample',{ambient:0,highlights:100});await c.updateSphereLighting('sample');
assert.equal(lightingUpdate.plot,el('samples'));assert.deepEqual(plain(lightingUpdate.indices),[0]);assert.equal(lightingUpdate.updates.lighting[0].specular,1);
assert.equal(JSON.stringify({references,graph:el('graph3d').data}),immutable);
el('sampleReferenceSpheres').checked=false;c.syncSphereLightingControls('sample');assert.equal(el('sampleReferenceSphereAmbient').disabled,true);
el('graphSpheres').checked=false;c.syncSphereLightingControls('graph');assert.equal(el('graphSphereHighlights').disabled,true);
// 2D shading uses the same settings and produces valid gradient stops at both extremes.
el('graphSpheres').checked=true;let stops=[];c.node=(tag,attrs)=>{if(tag==='stop')stops.push(attrs);return {}};
for(const ambient of [0,85,100])for(const highlights of [0,18,100]){
 c.restoreSphereLighting('graph',{ambient,highlights});stops=[];c.graphSphereGradients({});assert.equal(stops.length,8);
 for(const stop of stops)assert(stop['stop-color'].match(/\d+/g).every(v=>Number(v)>=0&&Number(v)<=255));
}
console.log('PASS: independent saved lighting defaults, invalid values, sphere-only material updates, unchanged geometry and samples, disabled flat controls and 2D gradient extremes.');

// Exercise the real pointer handlers: a named label must beat a nearby sphere
// and Plotly's WebGL pick, without turning a rotation gesture into a selection.
const viewer=fs.readFileSync(new URL('viewer.html',import.meta.url),'utf8');
const binding=viewer.slice(viewer.indexOf("if(!bound3d){const target=el('graph3d')"),viewer.indexOf("bound3d=true}")+"bound3d=true}".length);
assert(binding.includes("pointerup"));
const events=new Map(),timers=[],picks=[];
let hitLabel='vertex:172',hitVertex=99;
const pointerContext=vm.createContext({
 el:id=>id==='graph3d'?{on:(name,fn)=>events.set(name,fn),addEventListener:(name,fn)=>events.set(name,fn)}:{value:'3'},
 graphLabelAtPointer:()=>hitLabel,graphVertexAtPointer:()=>hitVertex,
 datasetKey:()=> 'zapps-pressmat-v4',pickGraphItem:id=>picks.push(id),
 setTimeout:fn=>timers.push(fn),console
});
vm.runInContext('let bound3d=false,graphRevision=1;'+binding,pointerContext);
const fire=(name,extra={})=>events.get(name)({button:0,pointerId:1,clientX:100,clientY:100,...extra});
const flush=()=>{while(timers.length)timers.shift()()};
const plotPick=id=>events.get('plotly_click')({points:[{customdata:id}]});
fire('pointerdown');plotPick('vertex:99');plotPick('vertex:88');fire('pointerup');
assert.deepEqual(picks,[],'Selection waits for pointer release and camera handling');flush();
assert.deepEqual(picks,['vertex:172'],'The clicked label overrides nearby markers and WebGL picks exactly once');
fire('pointerdown');fire('pointermove',{clientX:108});fire('pointerup',{clientX:108});flush();
assert.equal(picks.length,1,'Dragging from a label rotates without selecting');
fire('pointerdown');fire('pointercancel');fire('pointerup');flush();assert.equal(picks.length,1);
hitLabel=null;fire('pointerdown');plotPick('edge-a');fire('pointerup');flush();assert.equal(picks.at(-1),'vertex:99','Direct marker clicks retain priority over edges');
hitVertex=undefined;fire('pointerdown');plotPick('edge-a');fire('pointerup');flush();assert.equal(picks.at(-1),'edge-a','Edge clicks remain available');
hitLabel='vertex:172';fire('pointerdown');hitLabel='vertex:88';hitVertex=99;fire('pointerup');flush();assert.equal(picks.at(-1),'vertex:99','Moving between labels does not select the old label');
const count=picks.length;
fire('pointerdown');fire('pointerup');vm.runInContext('++graphRevision',pointerContext);flush();assert.equal(picks.length,count,'A replaced graph invalidates pending picks');
fire('pointerdown',{ctrlKey:true});fire('pointerup');flush();assert.equal(picks.length,count,'Modified gestures do not select');
console.log('PASS: exact graph-label selection, nearby-marker conflicts, single dispatch, drag/cancel protection, direct markers, edges and stale graph picks.');

// Overlapping labels resolve from the actual SVG event target, never from the
// reverse order of annotation bounding boxes. Names, not label text, carry IDs.
el('vertexLabels').checked=true;
const annotation={getAttribute:()=> '0'};
el('graph3d').contains=g=>g===annotation;
el('graph3d').layout={scene:{annotations:[{name:'vertex:172'},{name:'vertex:99'}]}};
assert.equal(c.graphLabelAtPointer(100,100,{closest:()=>annotation}),'vertex:172');
assert.equal(c.graphLabelAtPointer(100,100,{closest:()=>null}),null,'Canvas clicks do not guess a label');
assert.equal(c.graphLabelAtPointer(100,100,{closest:()=>({getAttribute:()=> '1'})}),null,'Other panels cannot supply a graph label');
el('vertexLabels').checked=false;
assert.equal(c.graphLabelAtPointer(100,100,{closest:()=>annotation}),null);
assert(viewer.includes("name:'vertex:'+n.id,opacity:fade.node(n.id),showarrow:false,captureevents:true"),'Graph annotations capture their own pointer targets');
console.log('PASS: overlapping annotations use their own SVG target and reject unrelated or hidden labels.');

// Plotly can retarget pointer release to the scene canvas. Its native annotation
// click arrives after pointerup but before the deferred graph selection.
hitLabel=null;hitVertex=99;
fire('pointerdown');plotPick('edge-a');fire('pointerup');
events.get('plotly_clickannotation')({subplotId:'scene',annotation:{name:'vertex:172'}});
const priorPicks=picks.length;flush();
assert.equal(picks.length,priorPicks+1);assert.equal(picks.at(-1),'vertex:172','Native annotation identity overrides a retargeted canvas release');
fire('pointerdown');fire('pointermove',{clientX:110});fire('pointerup',{clientX:110});
events.get('plotly_clickannotation')({subplotId:'scene',annotation:{name:'vertex:88'}});flush();assert.equal(picks.length,priorPicks+1,'A dragged annotation cannot select');
console.log('PASS: native annotation click overrides retargeted pointer release without duplicate selection.');

assert(!viewer.includes('#graph3d .annotation-scene *{pointer-events:none'), 'Graph label CSS must allow native annotation events');

// Realistic crowding, including more labels than a narrow panel can hold.
const packedInput=Array.from({length:65},(_,id)=>({id,x:120+(id%5)*8,y:170+Math.floor(id/5)*3,width:110+(id%4)*12,height:19,radius:3,priority:id===64?1000000:65-id}));
const packedBefore=JSON.stringify(packedInput),bounds={x:6,y:20,width:258,height:354};
function checkPacked(result,limits){
 const rows=[...result.values()];
 for(const a of rows){
  assert(a.x>=limits.x&&a.y>=limits.y&&a.x+a.width<=limits.x+limits.width+1e-8&&a.y+a.height<=limits.y+limits.height+1e-8,'Names remain inside the panel');
  for(const b of rows)if(a!==b)assert(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'Visible labels never overlap');
 }
}
const packed=c.placeGraphLabels(packedInput,bounds);checkPacked(packed,bounds);
assert(packed.has(64),'Selected vertex has first claim on available space');assert(packed.size<65&&packed.size>10);
assert.deepEqual(plain([...c.placeGraphLabels(packedInput,bounds)]),plain([...packed]),'Stable input produces a stable layout');
assert.equal(JSON.stringify(packedInput),packedBefore,'Layout never mutates coordinates or membership');
const roomy={x:0,y:0,width:1200,height:800},expanded=c.placeGraphLabels(packedInput,roomy);checkPacked(expanded,roomy);assert.equal(expanded.size,65,'Larger panels recover all labels');
const obstacle={x:130,y:170,radius:20},avoiding=c.placeGraphLabels(packedInput,bounds,[obstacle]);checkPacked(avoiding,bounds);
for(const r of avoiding.values())assert(Math.hypot(obstacle.x-Math.max(r.x,Math.min(r.x+r.width,obstacle.x)),obstacle.y-Math.max(r.y,Math.min(r.y+r.height,obstacle.y)))>=22,'Labels avoid vertex markers');
assert.equal(c.placeGraphLabels([],bounds).size,0);assert.equal(c.placeGraphLabels([{id:1,x:0,y:0,width:500,height:20}],bounds).size,0);
console.log(`PASS: collision-free bounded layout (${packed.size}/65 crowded, 65/65 expanded), selected-label priority, stable coordinates and vertex clearance.`);
// Plotly updates move only annotations; their original world coordinates and IDs stay intact.
c.graphLabelFont={size:12,family:'Arial'};c.graphNodeLabelVisible=()=>true;c.selectedVertex=2;
c.graphScreenPoint=p=>({x:50+p[0]*5,y:60+p[1]*5,z:0});
el('vertexLabels').checked=true;el('graphSpheres').checked=false;
el('graph3d').getBoundingClientRect=()=>({left:0,top:0,width:500,height:400});
el('graph3d').layout={scene:{annotations:graph.nodes.map(n=>({name:'vertex:'+n.id,x:n.id,y:0,z:0}))}};
const originalAnnotations=JSON.stringify(el('graph3d').layout.scene.annotations);
const labelUpdates=c.graphSphereLabelUpdates(graph,lookup,c.graphNodeDegrees(graph));
assert.equal(JSON.stringify(el('graph3d').layout.scene.annotations),originalAnnotations);
assert.equal(labelUpdates['scene.annotations[1].visible'],true);
assert(Number.isFinite(labelUpdates['scene.annotations[1].ax']));assert(Number.isFinite(labelUpdates['scene.annotations[1].ay']));
assert.equal(labelUpdates['scene.annotations[1].arrowhead'],0);
assert(!Object.keys(labelUpdates).some(k=>/\.(x|y|z|name)$/.test(k)));
console.log('PASS: label placement retains graph coordinates and annotation identity for picking and export.');
