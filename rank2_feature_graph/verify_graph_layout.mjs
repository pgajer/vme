// Real HTTP assets with DOM/Plotly stubs; this does not establish browser rendering.
// Spring preview is explicit. This test never calls an R service or audits all saved layouts.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto,createHash} from 'node:crypto';
const args=process.argv.slice(2),usage='Usage: node rank2_feature_graph/verify_graph_layout.mjs [path/to/index.http.html]\nReads local HTTP assets; no server, rebuild or R fitting required. See TESTING.md.';
if(args.includes('--help')){console.log(usage);process.exit(0)}
assert(args.length<=1&&!args.some(x=>x.startsWith('--')),usage);
const page=path.resolve(args[0]||process.env.EXPLORER_HTML||'index.http.html'),started=performance.now();
assert(fs.existsSync(page),'Built HTTP entry not found: '+page+'; see TESTING.md');
// Reject huge/offline inputs before allocating a JavaScript string.
assert(fs.statSync(page).size<128*1024*1024,'Expected a small built HTTP entry, not the offline export; pass index.http.html or ~/vme/web/index.html');
const html=fs.readFileSync(page,'utf8'),match=html.match(/id="vme-http-manifest" type="application\/json">([\s\S]*?)<\/script>/);
assert(match,'Expected a built HTTP entry with vme-http-manifest; not an offline export or viewer.html');
const manifest=JSON.parse(match[1]),base=path.dirname(page);
for(const id of ['comb-V3V4-tx','comb-V4-tx'])assert(manifest.datasets?.[id],'Required layout fixture missing: '+id);
const read=d=>{assert(/^\/vme-assets\/[a-f0-9]{64}\.(json|js)$/.test(d.url),'Unexpected asset path: '+d.url);return fs.readFileSync(path.join(base,d.url))};
const code=d=>{const bytes=read(d);assert.equal(bytes.length,d.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),d.sha256);return bytes.toString()};
const loaderURL=[...html.matchAll(/<script[^>]+src="([^" ]+)"/g)].at(-1)?.[1];
assert(loaderURL,'HTTP loader script missing');
const loaderSource=code({url:loaderURL,sha256:loaderURL.split('/').at(-1).replace('.js',''),bytes:read({url:loaderURL}).length});
class Element{constructor(id=''){this.id=id;this.value='';this.children=[];this.dataset={};this.style={};this.options=[{value:""},{value:""},{value:""},{value:""}];this.handlers={};this.textContent='';this.disabled=false;this.classList={add(){},remove(){},toggle(){},contains(){return false}}}setAttribute(k,v){this[k]=v}appendChild(c){this.children.push(c)}replaceChildren(){this.children=[]}addEventListener(k,f){this.handlers[k]=f}on(k,f){this.handlers[k]=f}}
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
for(const [id,value] of Object.entries({coverage:'60',dimension:'3',graphScope:'all',sampleEmbedding:'local',scope:'core',search:''}))el(id).value=value;
for(const id of ['unfoldFaces','panelUnfoldFaces'])el(id).parentElement={title:''};
el('vertexLabels').checked=true;const saved=new Map([['vme-graph-embedding-method-v1','spring']]),errors=[],requests=[];

const request=async url=>{requests.push(url);assert(!url.startsWith('/api/'),'Layout test must not call a live fitting service: '+url);const bytes=read({url});return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}};
const ctx=vm.createContext({TextDecoder,Uint8Array,crypto:webcrypto,fetch:request,console:{error:e=>errors.push(String(e))},setTimeout,clearTimeout,Blob,URL,atob});
vm.runInContext(loaderSource,ctx);vm.runInContext(code(manifest.validator),ctx);
const loader=ctx.VMEAssetLoader.createLoader(manifest,request);loader.status=()=>{};loader.retry=()=>{};loader.releaseControls=()=>{};
ctx.manifest=manifest;ctx.root=ctx;
const admission=loaderSource.match(/loader\.validateDataset=(\(value,id\)=>\{[\s\S]*?\n\});/);
assert(admission,'HTTP dataset admission function missing');loader.validateDataset=vm.runInContext(admission[1],ctx);
const initial=manifest.seed.default,first=await loader.dataset(initial,p=>loader.validateDataset(p,initial));
ctx.BUNDLE_PACK=loader.mergePack({...manifest.seed,bundles:[],embeddingFamilies:manifest.families},first);ctx.VME_ASSETS=loader;
ctx.document={addEventListener(){},getElementById:el,createElement:()=>new Element(),createElementNS:()=>new Element(),querySelectorAll:()=>[],head:new Element(),body:new Element()};ctx.addEventListener=()=>{};
ctx.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
ctx.Plotly={react:async(id,data,layout)=>{el(id).data=data;el(id).layout=layout},relayout:async(id,update)=>{if(update['scene.camera'])el(id).layout.scene.camera=JSON.parse(JSON.stringify(update['scene.camera']))},Plots:{resize:async()=>{}}};
vm.runInContext(code(manifest.application),ctx);
const run=s=>vm.runInContext(s,ctx),flush=()=>run('Promise.all([queue,graphQueue])'),clone=x=>JSON.parse(JSON.stringify(x));await flush();
const preference=key=>saved.get('vme-dataset-panels-v1:'+encodeURIComponent(run('META.id'))+':'+key);
const datasets=Object.keys(manifest.datasets);
for(const id of datasets){ctx.id=id;await run('switchDataset(id)');await flush()}
// Hash each admitted scientific bundle separately; lazy fit loading can add caches
// to BUNDLE_PACK without changing any of these frozen data/assignment bundles.
const hashes=()=>Object.fromEntries(run('BUNDLE_PACK.bundles').map(b=>[b.dataset.id,createHash('sha256').update(JSON.stringify(b)).digest('hex')]));
const before=hashes();
// Explicit cohort fixture, independent of the app startup dataset.
await run('switchDataset("comb-V4-tx")');await run('changeAnalysis("ZAPPS","merged","60")');await flush();
// Synthetic realizable graphs distinguish target fitting from simple coordinate scaling.
for(const d of [2,3]){
 ctx.d=d;
 const fit=run('springGraphLayout([{id:0},{id:1},{id:2},{id:3}], [{from:0,to:1,target:1},{from:1,to:2,target:3}],new Map([[0,[0,0,0]],[1,[2,1,0]],[2,[4,-1,1]],[3,[0,0,0]]]),d)');
 assert(fit.relativeRms<.02);assert([...fit.lookup.values()].flat().every(Number.isFinite));
}
const sampleBefore=clone(el('samples').data),selectionBefore=clone(run('selectionSnapshot()'));
ctx.camera={eye:{x:2,y:-1,z:.8},center:{x:.1,y:.2,z:-.1},up:{x:0,y:0,z:1},projection:{type:'perspective'}};
el('graph3d').layout.scene.camera=ctx.camera;
el('graphEdgeLengths').value='proportion';el('graphEdgeLengths').onchange();await flush();
assert.equal(preference('vme-graph-layout-v1'),'proportion');assert.deepEqual(clone(el('samples').data),sampleBefore);
assert.equal(run('selected'),selectionBefore.selected);assert.equal(run('selectedVertex'),selectionBefore.selectedVertex);
assert.deepEqual(clone(run('readCamera("graph3d")')),ctx.camera);
// Strength changes preserve the live pose and all sample data, including rapid input.
for(const strength of [0,2,8.5,10,4]){
 el('graphProportionStrength').value=String(strength);el('graphProportionStrength').oninput();el('graphProportionStrength').onchange();await flush();
 assert.equal(run('graphProportionStrength'),strength);assert.equal(preference('vme-graph-proportion-strength-v1'),String(strength));
 assert.deepEqual(clone(el('samples').data),sampleBefore);assert.deepEqual(clone(run('readCamera("graph3d")')),ctx.camera);
 assert.equal(Math.max(...run('graphLayoutResult(3).edges.map(e=>e.target)')),1+strength);
}
run('setGraphProportionStrength(0)');const zero=clone([...run('graphLayoutResult(3).lookup')]);
run('setGraphLayoutMode("equal")');assert.deepEqual(clone([...run('graphLayoutResult(3).lookup')]),zero);assert(el('graphProportionStrength').disabled);
assert.equal(run('setGraphProportionStrength(11)'),false);assert.equal(run('setGraphProportionStrength(null)'),false);assert.equal(run('setGraphProportionStrength(.1)'),false);
run('setGraphLayoutMode("proportion");setGraphProportionStrength(4)');
// Capture flushes a pending slider update so the saved geometry and strength agree.
el('graphProportionStrength').value='2';el('graphProportionStrength').oninput();ctx.strengthView=clone(await run('captureNamedView()'));
assert.equal(ctx.strengthView.graphProportionStrength,2);assert.equal(run('graphStrengthTimer'),null);
run('setGraphProportionStrength(8)');await run('restoreNamedView(strengthView)');await flush();assert.equal(run('graphProportionStrength'),2);
ctx.oldStrength=clone(ctx.strengthView);delete ctx.oldStrength.graphProportionStrength;await run('restoreNamedView(oldStrength)');await flush();assert.equal(run('graphProportionStrength'),4);
for(const strength of [null,'4',NaN,Infinity,-1,11,.1]){ctx.badStrength={...ctx.strengthView,graphProportionStrength:strength};await assert.rejects(run('restoreNamedView(badStrength)'))}
const fullCounts=run('graphLayoutResult(3)');
assert.equal(fullCounts.total,run('analysisExtension().records.length'));
assert(fullCounts.total>run('populationSize()'));
const independent=new Map();for(const r of run('analysisExtension().records')){const id=run('analysisExtension().merged[el("coverage").value].pairs')[r.profile];independent.set(id,(independent.get(id)||0)+1)}
for(const e of fullCounts.edges){assert.equal(e.count,independent.get(e.id));assert(e.target>=1&&e.target<=5);assert.equal(e.proportion,e.count/fullCounts.total)}
const largest=fullCounts.edges.reduce((a,b)=>a.count>b.count?a:b);assert.equal(largest.target,5);
const keys=clone([...fullCounts.lookup]);
await run('changeAnalysis("PreSSMat","merged","60")');await flush();assert.deepEqual(clone([...run('graphLayoutResult(3)').lookup]),keys);
run('selectVertex(current().nodes[0].id);el("graphScope").value="incident";graph()');await flush();assert.deepEqual(clone([...run('graphLayoutResult(3)').lookup]),keys);
ctx.bookmark=clone(await run('captureNamedView()'));assert.equal(ctx.bookmark.graphLayout,'proportion');
run('setGraphLayoutMode("equal")');await run('restoreNamedView(bookmark)');assert.equal(run('graphLayoutMode'),'proportion');
ctx.legacy=clone(ctx.bookmark);delete ctx.legacy.graphLayout;await run('restoreNamedView(legacy)');assert.equal(run('graphLayoutMode'),'reference');
ctx.bad={...ctx.bookmark,graphLayout:'bad'};await assert.rejects(run('restoreNamedView(bad)'));
for(const dataset of run('[...datasetRegistry.keys()]')){
 await run(`switchDataset(${JSON.stringify(dataset)})`);await flush();
 for(const mode of ['equal','proportion']){
  run(`setGraphLayoutMode('${mode}');positions();graph()`);await flush();
  for(const d of [2,3]){
   const fit=run(`graphLayoutResult(${d})`);assert([...fit.lookup.values()].flat().every(Number.isFinite));assert(Number.isFinite(fit.relativeRms));
   assert(fit.edges.every(e=>mode==='equal'?e.target===1:e.target>=1&&e.target<=5));
  }
 }
 run('setGraphLayoutMode("reference");graph()');await flush();
 assert.deepEqual(clone([...run('graphLayoutCoordinates()')].map(e=>e[1])),clone(run('DATA.coords3d[el("coverage").value]')));
}
// Dense coverage exercises bounded caching and difficult equal-length constraints.
await run('switchDataset("comb-V3V4-tx")');await run('changeAnalysis(activeCohort,"pure","100")');await flush();run('setGraphLayoutMode("equal")');
const dense=run('graphLayoutResult(3)');assert.equal(dense.edges.length,run('current().edges.length'),'Dense graph follows the installed reference, not the retired population');assert(dense.edges.length>100,'Dense fixture must contain more than 100 edges');assert([...dense.lookup.values()].flat().every(Number.isFinite));
// Use a reference without a packaged R fit for this context, so the portable
// snapshot itself (rather than a deferred supplied fit) must satisfy restoration.
await run('switchDataset("comb-V4-tx")');await run('changeAnalysis("ZAPPS","merged","60")');await flush();
// Portable graph snapshots restore without a live R service (actual solver tests are in Python).
run('setGraphLayoutMode("proportion");setGraphProportionStrength(2);setGraphEmbeddingMethod("spring")');
const portableFit=run('graphLayoutResult(3)');
assert(!run('BUNDLE_PACK.combDisplay?.graphLayouts?.contexts?.[graphLayoutKey(3,"weighted_grip")]'),'Portable fixture must not have a supplied R fit');
ctx.portable={method:'weighted_grip',dimension:3,nodes:portableFit.nodes.map(n=>n.id),coords:clone([...portableFit.lookup.values()]),relativeRms:portableFit.relativeRms,geodesicNormalizedRmse:.2,runtimeId:'a'.repeat(64)};
run('setGraphEmbeddingMethod("weighted_grip");restoreGraphEmbeddingFit({graphEmbeddingFit:portable})');
ctx.portableView=clone(await run('captureNamedView()'));
assert.equal(ctx.portableView.graphEmbeddingMethod,'weighted_grip');assert.deepEqual(ctx.portableView.graphEmbeddingFit.coords,ctx.portable.coords);
run('setGraphEmbeddingMethod("spring");graphLayoutCache.clear()');await run('restoreNamedView(portableView)');await flush();
assert.deepEqual(clone(run('graphLayoutResult(3).coords')),ctx.portable.coords);
for(const mutate of [v=>v.graphEmbeddingMethod='bad',v=>v.graphEmbeddingFit.coords[0][0]=NaN,v=>v.graphEmbeddingFit.nodes.pop(),v=>v.graphEmbeddingFit.dimension=2,v=>v.graphEmbeddingFit.runtimeId='bad']){
 ctx.invalidFit=clone(ctx.portableView);mutate(ctx.invalidFit);await assert.rejects(run('restoreNamedView(invalidFit)'));
}
assert.deepEqual(hashes(),before,'Frozen scientific bundles are unchanged');assert.deepEqual(errors,[]);assert(!requests.some(url=>url.startsWith('/api/')),'No fitting-service requests, including failed attempts');
console.log('PASS: unit/proportional targets, whole-dataset record counts, deterministic cohort-independent layouts, finite dense geometry, unchanged samples/bundles, cameras, persistence and named-view compatibility.');

console.log(JSON.stringify({status:'PASS',page,datasets,assetRequests:requests.length,elapsedSeconds:Number(((performance.now()-started)/1000).toFixed(2)),denseEdges:dense.edges.length,liveFittingRequests:0,exhaustiveAudit:false},null,2));
