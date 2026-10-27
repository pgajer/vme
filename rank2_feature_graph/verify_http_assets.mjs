// Exercise the real HTTP loader/admission and viewer with local frozen assets.
// DOM/Plotly are stubs: real rendering is checked separately in a browser.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto,createHash} from 'node:crypto';
const args=process.argv.slice(2),usage=`Usage: node rank2_feature_graph/verify_http_assets.mjs /path/to/web/index.html [--hover-only | --audit-layouts]
Default: integration checks only. --audit-layouts additionally scans all saved comb-V3V4-tx layouts.
Requires separately supplied datasets and a built HTTP app. See TESTING.md. Neither mode refits embeddings.`;
if(args.includes('--help')){console.log(usage);process.exit(0)}
const flags=args.filter(x=>x.startsWith('--')),pages=args.filter(x=>!x.startsWith('--'));
assert(flags.every(x=>['--hover-only','--audit-layouts'].includes(x))&&new Set(flags).size===flags.length&&flags.length<=1&&pages.length===1,usage);
const page=path.resolve(pages[0]),auditLayouts=flags.includes('--audit-layouts'),started=performance.now();
assert(fs.existsSync(page),'Built HTTP entry not found: '+page+'; see TESTING.md');
const html=fs.readFileSync(page,'utf8'),match=html.match(/id="vme-http-manifest" type="application\/json">([\s\S]*?)<\/script>/);
assert(match,'Expected a built VME HTTP app with vme-http-manifest; see TESTING.md');
const manifest=JSON.parse(match[1]),base=path.dirname(page);
assert(Object.keys(manifest.datasets||{}).length>=2,'Dataset switching checks require at least two datasets; see TESTING.md');
if(!flags.includes('--hover-only')){
 const required=['comb-V3V4-tx','comb-V4-tx','umb-hmp-2019-panel','zapps-pressmat-v4'];
 const missing=required.filter(id=>!manifest.datasets?.[id]);
 assert(!missing.length,'Integration fixtures missing: '+missing.join(', ')+'. Obtain the matching data package; see TESTING.md.');
 assert(manifest.datasets['comb-V3V4-tx'].deferred?.combDisplay&&manifest.datasets['comb-V3V4-tx'].deferred?.combGraphLayouts,'Integration requires deferred comb-V3V4-tx display and graph-layout assets; see TESTING.md');
}
const read=d=>fs.readFileSync(path.join(base,d.url));
class Element{constructor(id=''){this.id=id;this.value='';this.children=[];this.dataset={};this.style={};this.options=[{value:""},{value:""},{value:""},{value:""}];this.handlers={};this.textContent='';this.disabled=false;this.classList={add(){},remove(){},toggle(){},contains(){return false}}}setAttribute(k,v){this[k]=v}appendChild(c){this.children.push(c)}replaceChildren(){this.children=[]}addEventListener(k,f){this.handlers[k]=f}on(k,f){this.handlers[k]=f}}
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
for(const [id,value] of Object.entries({coverage:'60',dimension:'3',graphScope:'all',sampleEmbedding:'local',scope:'core',search:''}))el(id).value=value;
el('vertexLabels').checked=true;const saved=new Map([['vme-graph-embedding-method-v1','spring']]),errors=[],requests=[];
let gate=null,failURL=null;
const request=async url=>{requests.push(url);if(url===failURL)throw Error("Test-only interrupted asset transfer");if(gate&&gate.urls.has(url))await gate.promise;const bytes=read({url});return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}};
const ctx=vm.createContext({TextDecoder,Uint8Array,crypto:webcrypto,fetch:request,console:{error:e=>errors.push(String(e))},setTimeout,clearTimeout,Blob,URL,atob});
vm.runInContext(fs.readFileSync(new URL('asset_loader.js',import.meta.url),'utf8'),ctx);
vm.runInContext(read(manifest.validator).toString(),ctx);
const loader=ctx.VMEAssetLoader.createLoader(manifest,request);loader.status=()=>{};loader.retry=()=>{};loader.releaseControls=()=>{};
// Exercise the browser's actual admission function, including prepared summaries.
ctx.manifest=manifest;ctx.root=ctx;
loader.validateDataset=vm.runInContext(fs.readFileSync(new URL('asset_loader.js',import.meta.url),'utf8').match(/loader\.validateDataset=(\(value,id\)=>\{[\s\S]*?\n\});/)[1],ctx);
const initial=manifest.seed.default,first=await loader.dataset(initial,p=>loader.validateDataset(p,initial));
ctx.BUNDLE_PACK=loader.mergePack({...manifest.seed,bundles:[],embeddingFamilies:manifest.families},first);ctx.VME_ASSETS=loader;
ctx.document={addEventListener(){},getElementById:el,createElement:()=>new Element(),createElementNS:()=>new Element(),querySelectorAll:()=>[],head:new Element(),body:new Element()};ctx.addEventListener=()=>{};
ctx.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
ctx.Plotly={react:async(id,data,layout)=>{el(id).data=data;el(id).layout=layout},relayout:async(id,update)=>{if(update['scene.camera'])el(id).layout.scene.camera=JSON.parse(JSON.stringify(update['scene.camera']))},Plots:{resize:async()=>{}}};
vm.runInContext(read(manifest.application).toString(),ctx);
const run=s=>vm.runInContext(s,ctx),flush=()=>run('Promise.all([queue,graphQueue])'),clone=x=>JSON.parse(JSON.stringify(x));await flush();
assert.deepEqual([...run('datasetRegistry.keys()')],[initial]);
assert.equal(requests.length,manifest.datasets[initial].parts.length,'Only initial dataset requested');
assert.equal(run('referenceTaxonLabels.size')>0,true,'Shared label dictionary is available without V3V4 data');
const bookmark=clone(await run('captureNamedView()'));ctx.initialView=bookmark;
// Slow first selection cannot override a later selection of the already-loaded dataset.
const other=Object.keys(manifest.datasets).find(id=>id!==initial);let release;gate={urls:new Set(manifest.datasets[other].parts.map(x=>x.url)),promise:new Promise(r=>release=r)};
ctx.other=other;const slow=run('switchDataset(other)');await new Promise(r=>setTimeout(r,10));await run('switchDataset(initialView.dataset)');release();await slow;gate=null;assert.equal(run('META.id'),initial);
const visited=[],optionalChecks={};
for(const id of Object.keys(manifest.datasets)){
 ctx.id=id;await run('switchDataset(id)');await flush();assert.equal(run('META.id'),id);assert.equal(run('graphEmbeddingJobs.size'),0);visited.push(id);
 // Validate installed VALENCIA2 assignments through the actual color/export functions.
 run(`{const asset=valenciaAsset();if(asset){
  const savedMode=el('sampleColorScheme').value,before=JSON.stringify(asset);
  for(const mode of ['valencia2-cst','valencia2-subtype']){
   el('sampleColorScheme').value=mode;
   const sub=mode==='valencia2-subtype',palette=sub?valenciaSubtypeColors:valenciaCstColors;
   for(const record of asset.records){
    const profile=asset.profiles[record.profile],expected=profile[sub?'subCST':'cst'];
    const category=sampleColorCategory(0,record,record.profile);
    if(category.id!==expected||category.color!==palette[expected])throw Error('VALENCIA2 color mapping differs: '+META.id);
   }
  }
  if(valenciaCsv().split('\\r\\n').length!==asset.records.length+2)throw Error('VALENCIA2 export row count differs');
  el('sampleColorScheme').value=savedMode;
  if(JSON.stringify(asset)!==before)throw Error('VALENCIA2 annotations mutated');
 }}`);
 // Preserve the original locale, numeric coercion, rounding and grouping.
 run(`{const values=[0,-0,0.004,0.005,-0.005,1.005,99.999,1000,12345.6789,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER,null,undefined,'', '12.345'];
  for(const g of Object.values(DATA.graphs))for(const e of g.edges)values.push(e.frequency,e.length);
  for(const n of values)if(fmt(n)!==Number(n).toLocaleString(undefined,{maximumFractionDigits:2}))throw Error('Number formatting changed: '+String(n));
 }`);
 // Reused plot text must remain byte-for-byte equal to the uncached formatter
 // for every row, including datasets with no participant mapping.
 run(`{const indices=DATA.samples.ids.map((_,i)=>i),batch=samplePlotHovers(indices);for(let i=0;i<DATA.samples.ids.length;i++){
  const id=DATA.samples.ids[i],r=participantRecordForId(id);
  const expected=r?participantSampleHover(r):compactSampleHover(id,DATA.sampleTopFeatures[i])+valenciaHover(valenciaSampleProfile(i),DATA.records?.[i]?.id)+sampleCstHover(valenciaSampleProfile(i));
  if(samplePlotHover(i)!==expected||batch[i]!==expected)throw Error('Cached sample hover differs: '+META.id+' row '+i);
 }}`);
}
// Coverage affects hover membership even when the underlying DATA identity is unchanged.
run(`{
 const original=el('coverage').value,other=original==='60'?'70':'60';
 const first=samplePlotHover(0),model=samplePlotHoverState();
 el('coverage').value=other;
 const changed=samplePlotHover(0);
 if(samplePlotHoverState()===model||!changed.includes(other+'% merged 2-CST:'))throw Error('Coverage did not invalidate hover membership');
 el('coverage').value=original;
 if(samplePlotHover(0)!==first)throw Error('Coverage hover did not restore');
}`);
if(process.argv.includes('--hover-only')){
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',datasets:visited,checks:['every sample hover matches uncached membership formatting','coverage changes invalidate hover membership','all datasets admitted and switched']},null,2));
 process.exit(0);
}
// Selection must not download participant-only geometry for any dataset.
const deferredURLs=new Set(Object.values(manifest.datasets).flatMap(entry=>Object.values(entry.deferred||{}).flatMap(group=>group.parts.map(p=>p.url))));
assert(!requests.some(url=>deferredURLs.has(url)));
// Sorting uses prepared counts without constructing every trajectory. Full
// details recompute the original algorithm and reject any differing score.
await run('switchDataset("comb-V3V4-tx")');
run(`{
 const original=participantSampleHover;let calls=0;
 participantSampleHover=function(r){calls++;return original(r)};
 try{
  samplePlotHoverCache=null;const first=samplePlotHover(0);
  if(samplePlotHover(0)!==first||samplePlotHovers([0,0]).some(t=>t!==first)||calls!==1)throw Error('Hover text was not reused');
  const data=DATA;DATA={...DATA};samplePlotHovers([0]);DATA=data;
  if(calls!==2||samplePlotHover(0)!==first||calls!==3)throw Error('Population hover cache did not invalidate/restore');
  // Warm the restored context between replacements so each dependency is tested
  // independently; a preceding changed identity cannot mask a missing guard.
  for(const field of ['participants','valencia2','participantPreparation']){
   const bank=BUNDLE_PACK[field];if(!bank?.[META.id]){if(field!=='participantPreparation')throw Error('Missing required hover dependency: '+field);continue}
   const previous=bank[META.id],before=calls;
   bank[META.id]={...previous};
   try{if(samplePlotHovers([0])[0]!==first||calls!==before+1)throw Error('Hover cache ignored '+field)}
   finally{bank[META.id]=previous}
   if(samplePlotHover(0)!==first||calls!==before+2)throw Error('Hover cache did not restore '+field);
  }
 }finally{participantSampleHover=original;samplePlotHoverCache=null}
}`);
optionalChecks.preparedParticipantSummaries=run('!!BUNDLE_PACK.participantPreparation?.[META.id]');
if(optionalChecks.preparedParticipantSummaries){
 // Compare every hover summary with an independent full sort, preserving exact
 // frozen feature-order ties and source composition entries.
 run(`for(const [profile,sparse] of Object.entries(participantData().compositions)){
  const expected=sparse.slice().sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,5);
  const actual=BUNDLE_PACK.participantPreparation[META.id].leadingPositions[profile].map(i=>sparse[i]);
  if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Prepared hover differs from full composition ranking: '+profile);
 }`);
 const hoverPrepared=run('BUNDLE_PACK.participantPreparation[META.id]');
 const preparedHover=run('participantData().records.map(r=>participantSampleHover(r))');
 run('delete BUNDLE_PACK.participantPreparation[META.id]');
 assert.deepEqual([...run('participantData().records.map(r=>participantSampleHover(r))')],[...preparedHover]);
 ctx.hoverPrepared=hoverPrepared;run('BUNDLE_PACK.participantPreparation[META.id]=hoverPrepared');
 const combPart={};for(const part of manifest.datasets['comb-V3V4-tx'].parts)loader.mergePack(combPart,JSON.parse(read(part)));
 combPart.participantPreparation['comb-V3V4-tx']=hoverPrepared;
 const positions=hoverPrepared.leadingPositions,profile=Object.keys(positions).find(p=>positions[p].length>1),goodPositions=positions[profile];
 for(const bad of [goodPositions.slice(1),[-1,...goodPositions.slice(1)],[goodPositions[0],...goodPositions.slice(0,-1)],goodPositions.slice().reverse()]){
  positions[profile]=bad;assert.throws(()=>loader.validateDataset(combPart,'comb-V3V4-tx'),/prepared participant hover/i);
 }
 positions[profile]=goodPositions;
 loader.validateDataset(combPart,'comb-V3V4-tx');


 run('participantSwitchCache={};var originalProfile=participantGeometricSwitchProfile,profileCalls=0;participantGeometricSwitchProfile=(...args)=>{profileCalls++;return originalProfile(...args)}');
 for(const q of run('participantSwitchTargets()')){
  ctx.q=q;const n=run('profileCalls');run('participantSwitchStats(q)');assert.equal(run('profileCalls'),n);
  run('for(const key of participantGroups().keys())participantSwitchStats(q).profiles.get(key)');
 }
 optionalChecks.preparedParticipantCalculations=run('participantSwitchTargets().length*participantGroups().size');
 assert.equal(run('profileCalls'),optionalChecks.preparedParticipantCalculations);
 run('participantGeometricSwitchProfile=originalProfile');
 const q='60';ctx.q=q;
 const good=run('BUNDLE_PACK.participantPreparation[META.id].scores[q]');
 for(const bad of [good.slice(1),[good[0],...good.slice(0,-1)],good.map((row,i)=>i===0?[row[0],-1,row[2]]:row)]){
  ctx.bad=bad;run('BUNDLE_PACK.participantPreparation[META.id].scores[q]=bad;participantSwitchCache={}');
  assert.throws(()=>run('participantSwitchStats(q)'),/prepared participant/i);
 }
 ctx.good=good;run('BUNDLE_PACK.participantPreparation[META.id].scores[q]=good;participantSwitchCache={}');

}
// Lazy materialization must retain every original layout field and observed
// endpoint maximum. Validate against frozen fits and an independent direct scan.
const lazyDisplay=manifest.datasets['comb-V3V4-tx'].deferred.combDisplay;
const eagerKeys=run('new Set(Object.entries(BUNDLE_PACK.combDisplay.contexts).filter(([k])=>JSON.parse(k)[0]==="overview").map(([,v])=>v))');
assert(run('Object.keys(BUNDLE_PACK.combDisplay.fits)').every(k=>eagerKeys.has(k)),'Only population overviews load initially');
const edge=run('current().edges[0].id');ctx.edge=edge;
const edgeKey=run('combDisplayKey("group",activeCohort,Number(el("coverage").value),edge)');
const edgeURL=lazyDisplay.parts[run('BUNDLE_PACK.combDisplay.deferredFits')[edgeKey]].url;
failURL=edgeURL;await run('select(edge)');assert.equal(run('selected'),null,'Failed local load retains previous selection');
assert.equal(run('BUNDLE_PACK.combDisplay.fits')[edgeKey],undefined);
failURL=null;await run('select(edge)');await flush();assert.equal(run('selected'),edge);assert(run('localSelectionFit().coords.length')>0);
const localBookmark=clone(await run('captureNamedView()'));ctx.localBookmark=localBookmark;
await run('clearSelection()');
const vertex=run('current().nodes[0].id');ctx.vertex=vertex;
const vertexKey=run('combDisplayKey("vertex",activeCohort,Number(el("coverage").value),vertex)');
const vertexURL=lazyDisplay.parts[run('BUNDLE_PACK.combDisplay.deferredFits')[vertexKey]].url;
// Chunk grouping can bring every vertex fit in with the selected edge. Evict
// this exact fit and its loader cache to exercise an uncached request reliably.
ctx.vertexKey=vertexKey;run('delete BUNDLE_PACK.combDisplay.fits[vertexKey]');
loader.loaded.delete('fit:comb-V3V4-tx:combDisplay:'+run('BUNDLE_PACK.combDisplay.deferredFits[vertexKey]'));
let releaseLocal;gate={urls:new Set([vertexURL]),promise:new Promise(r=>releaseLocal=r)};
const oldVertex=run('selectVertex(vertex)');await new Promise(r=>setTimeout(r,10));await run('clearSelection()');releaseLocal();await oldVertex;gate=null;
assert.equal(run('selectedVertex'),null,'Clearing selection cancels a pending local view');
ctx.vertexKey=vertexKey;
run('delete BUNDLE_PACK.combDisplay.fits[vertexKey]');loader.loaded.delete('fit:comb-V3V4-tx:combDisplay:'+run('BUNDLE_PACK.combDisplay.deferredFits[vertexKey]'));
gate={urls:new Set([vertexURL]),promise:new Promise(r=>releaseLocal=r)};
const oldCoverageVertex=run('selectVertex(vertex)');await new Promise(r=>setTimeout(r,10));
run('el("coverage").value="70";draw()');releaseLocal();await oldCoverageVertex;gate=null;
assert.equal(run('selectedVertex'),null,'Changing coverage cancels a pending local view');
run('el("coverage").value="60";draw()');
await run('selectVertex(vertex)');await flush();assert.equal(run('selectedVertex'),vertex);
await run('restoreNamedView(initialView)');
ctx.edgeKey=edgeKey;
const edgeChunk=run('sensitivityBaseline.display.deferredFits[edgeKey]');
run('delete sensitivityBaseline.display.fits[edgeKey]');loader.loaded.delete('fit:comb-V3V4-tx:combDisplay:'+edgeChunk);
const beforeRestore=requests.length;
await run('restoreNamedView(localBookmark)');await flush();assert.equal(run('selected'),edge);
assert(requests.slice(beforeRestore).includes(edgeURL),'Named view fetches missing local geometry before restoration');
await run('clearSelection()');
// Non-default settings fetch exact frozen layouts, including spring and 2D.
// A failed lazy transfer is retryable and never falls back to a fitter.
run('graphLayoutMode="proportion";graphProportionStrength=9.75;graphEmbeddingMethod="grip";el("dimension").value="3"');
const graphChunk=run('(()=>{const a=BUNDLE_PACK.combDisplay.graphLayouts;return a.deferredFits[a.contexts[graphLayoutKey(3)]]})()');
failURL=manifest.datasets['comb-V3V4-tx'].deferred.combGraphLayouts.parts[graphChunk].url;
await assert.rejects(run('graphLayoutResult(3);waitGraphEmbedding()'),/interrupted asset transfer/);
assert.equal(run('graphLayoutResult(3).precomputed'),undefined);
failURL=null;run('for(const [key,job] of graphEmbeddingJobs)if(job.error)graphEmbeddingJobs.delete(key)');
await run('graphLayoutResult(3);waitGraphEmbedding()');
assert.equal(run('graphLayoutResult(3).precomputed'),true);
const deferredGraphs=[];
for(const method of ['spring','mds','grip','weighted_grip'])for(const dimension of [2,3]){
 ctx.method=method;ctx.dimension=dimension;
 await run('graphLayoutMode="proportion";graphProportionStrength=9.75;graphEmbeddingMethod=method;el("dimension").value=String(dimension);graphLayoutResult(dimension);waitGraphEmbedding()');
 assert.equal(run('graphLayoutResult(dimension).precomputed'),true);
 assert.equal(run('graphLayoutResult(dimension).preview'),undefined);
 deferredGraphs.push([method,dimension]);
}
const graphBookmark=clone(await run('captureNamedView()'));ctx.graphBookmark=graphBookmark;
await run('restoreNamedView(initialView)');await run('restoreNamedView(graphBookmark)');await flush();
assert.deepEqual(clone(run('captureGraphEmbeddingFit()')),graphBookmark.graphEmbeddingFit);
await run('restoreNamedView(initialView)');
const jointViews=[];
for(const id of ['comb-V3V4-tx','comb-V4-tx','umb-hmp-2019-panel','zapps-pressmat-v4']){
 ctx.id=id;await run('switchDataset(id)');
 // Select an actual participant with a fit that is deferred in this release.
 const key=run(`(()=>{const display=id==='comb-V3V4-tx',asset=display?BUNDLE_PACK.combDisplay:BUNDLE_PACK.subjectEmbeddings;
  for(const [key,rows] of participantGroups()){
   const context=display?combDisplayKey('subject',rows[0].cohort,60,JSON.stringify([rows[0].cohort,rows[0].subject,rows[0].episode??null])):asset.contexts[subjectEmbeddingScope(datasetRegistry.get(id),participantData(),rows[0].cohort,'merged','60',key).context];
   if(Object.hasOwn(asset.deferredFits||{},context)&&!asset.fits[context])return key;
  }throw Error('No deferred participant fixture for '+id)})()`);
 ctx.participantTestKey=key;const beforeRequests=requests.length;
 await run('changeAnalysis(activeCohort,"merged","60");participant.embeddingMode="union"');
 await run('openParticipant(participantTestKey)');await flush();
 assert(requests.length>beforeRequests,'First joint view fetches its prepared fragment');
 assert.equal(el('retrySubjectEmbedding').hidden,true,el('sampleStatus').textContent);
 const view=clone(await run('captureNamedView()'));assert(view.subjectEmbeddingFit);jointViews.push(view);
 const n=requests.length;await run('leaveParticipant()');ctx.jointView=view;await run('restoreNamedView(jointView)');await flush();assert.equal(requests.length,n,'Saved joint view reuses its embedded, validated coordinates');
 assert.deepEqual(clone(run('captureSubjectEmbeddingFit()')),view.subjectEmbeddingFit);
}
await run('leaveParticipant()');await run('switchDataset("comb-V3V4-tx")');
let displayChecks={status:'not-run',reason:'Exhaustive audit requires --audit-layouts'};
if(auditLayouts){
 const {auditSavedLayouts}=await import('./audit_saved_layouts.mjs');
 displayChecks={status:'PASS',...await auditSavedLayouts(run)};
}
const hashes=()=>Object.fromEntries(run('BUNDLE_PACK.bundles').map(b=>[b.dataset.id,createHash('sha256').update(JSON.stringify(b)).digest('hex')]));const before=hashes();
await run('restoreNamedView(initialView)');await flush();assert.equal(run('META.id'),initial);assert.deepEqual(clone(run('captureNamedViewSettings().selection.sampleCamera')),bookmark.selection.sampleCamera);
const populationChecks={rebuiltOnly:run('rebuiltOnlyPopulation()')};
await run('switchDataset("comb-V3V4-tx")');
if(populationChecks.rebuiltOnly){
 assert.equal(run('activeSensitivityMode'),'rebuilt');
 assert.equal(run('recordExtension().records.length'),24465,'Current package retains exactly 24,465 eligible records');
 assert.deepEqual([...run('sensitivityVariants.keys()')],['rebuilt']);
 const comparison=clone(await run('captureNamedView()'));ctx.comparison=comparison;
 assert.equal(comparison.populationComparison,'rebuilt');
 const beforeRejected=requests.length;
 for(const mode of ['baseline','fixed']){
  ctx.rejectedMode=mode;
  await assert.rejects(run('changeSensitivity(rejectedMode)'),/only the rebuilt-reference population/);
  ctx.archivedView={...comparison,populationComparison:mode};
  await assert.rejects(run('restoreNamedView(archivedView)'),/archived VME population|rebuilt-only package/);
  assert.equal(run('activeSensitivityMode'),'rebuilt');
  assert.equal(run('META.id'),'comb-V3V4-tx');
  assert.deepEqual(clone(run('captureNamedViewSettings().selection')),comparison.selection,'Rejected archived views preserve the current selection and cameras');
 }
 assert.equal(requests.length,beforeRejected,'Unavailable populations do not fetch archived assets');
 await run('switchDataset("comb-V4-tx")');await flush();
 assert.equal(run('META.id'),'comb-V4-tx');
 await run('restoreNamedView(comparison)');await flush();
 assert.equal(run('META.id'),'comb-V3V4-tx');
 assert.equal(run('activeSensitivityMode'),'rebuilt');
 assert.equal(run('recordExtension().records.length'),24465);
 populationChecks.archivedViewsRejected=true;
}else{
 await run('ensureSensitivityLoaded("fixed")');assert.deepEqual([...run('sensitivityVariants.keys()')].sort(),['fixed','rebuilt']);
 await run('changeSensitivity("fixed")');await flush();assert.equal(run('activeSensitivityMode'),'fixed');
 const comparison=clone(await run('captureNamedView()'));ctx.comparison=comparison;
 await run('changeSensitivity("rebuilt")');await flush();assert.equal(run('activeSensitivityMode'),'rebuilt');
 await run('restoreNamedView(comparison)');await flush();assert.equal(run('activeSensitivityMode'),'fixed');
 await run('changeSensitivity("baseline")');
}
optionalChecks.bundledNeighborhoods=!!manifest.neighborhoods;
const beforeNeighborhoods=requests.length;
await run('ensureEmbeddingFamiliesLoaded()');
if(optionalChecks.bundledNeighborhoods){
 assert(run('embeddingFamilyRegistry.size>0&&[...embeddingFamilyRegistry.values()].every(f=>f.neighborhoods.length>0)'));
 assert(run('principalAsset===BUNDLE_PACK.principalPaths&&!!principalAsset'),'Principal layer remains available after deferred loading');
}else{
 assert.equal(requests.length,beforeNeighborhoods,'Separate optional neighborhoods do not load into the current population');
 assert.equal(run('embeddingFamilyRegistry.size'),0);
}
assert.deepEqual(hashes(),before,'Admission/restoration does not mutate scientific bundles');
// Pure overviews and core/non-core comparison use the already loaded reference
// population, even when every individual pure-state fit is still deferred.
await run('switchDataset("comb-V3V4-tx")');
const beforePure=requests.length;
await run('changeAnalysis("all","pure","60")');await flush();
assert.equal(run('activeStateMode'),'pure');
assert.equal(requests.length,beforePure,'Pure overview must not fetch unselected local fits');
const purePairs=run('JSON.stringify(DATA.samples.pair)'),pose=clone(run('readCamera("samples")'));
// Independent membership oracle from the frozen core list and source records.
const pureCounts=run(`(()=>{const bundle=datasetRegistry.get(META.id),a=recordExtension(bundle),core=new Set(BUNDLE_PACK.combDisplay.pureCores[el('coverage').value]),indices=a.populations.records.indices;
 const n=indices.filter(i=>core.has(bundle.data.samples.pair[a.records[i].profile])).length;
 return {core:n,nonCore:indices.length-n,total:indices.length};})()`);
assert(pureCounts.core>0&&pureCounts.nonCore>0,'Fixture exercises both sides of the pure-core split');
await run('changePureCoverage(true)');await flush();
assert.equal(run('el("samples").data[0].x.length'),pureCounts.nonCore);
assert.equal(run('el("samples").data[0].marker.color'),'#a8adb2');
await run('changePureCoverage(false)');await flush();
assert.equal(run('el("samples").data[0].x.length'),pureCounts.core);
assert.deepEqual(clone(run('readCamera("samples")')),pose);
assert.equal(run('JSON.stringify(DATA.samples.pair)'),purePairs);
ctx.pureEdge=run('current().edges.find(e=>Object.hasOwn(BUNDLE_PACK.combDisplay.deferredFits,combDisplayKey("group",activeCohort,100,e.id)))?.id');
assert(ctx.pureEdge,'Fixture includes a pure state in a deferred fragment');
// Earlier checks may have loaded this fit. Evict it and its fragment cache
// so selection tests an actual lazy download in either validation mode.
const pureKey=run('combDisplayKey("group",activeCohort,100,pureEdge)');ctx.pureKey=pureKey;
const pureChunk=run('BUNDLE_PACK.combDisplay.deferredFits[pureKey]');
run('delete BUNDLE_PACK.combDisplay.fits[pureKey]');
loader.loaded.delete('fit:comb-V3V4-tx:combDisplay:'+pureChunk);
await run('select(pureEdge)');await flush();
assert.equal(run('selected'),ctx.pureEdge);assert(run('localSelectionFit().coords.length')>0);
ctx.pureBookmark=clone(await run('captureNamedView()'));
run('delete sensitivityBaseline.display.fits[pureKey]');
loader.loaded.delete('fit:comb-V3V4-tx:combDisplay:'+pureChunk);
await run('clearSelection()');
const beforePureRestore=requests.length;await run('restoreNamedView(pureBookmark)');await flush();
assert.equal(run('selected'),ctx.pureEdge);
assert(requests.length>beforePureRestore,'Pure named view restores its 100% catalogue fit');
assert.deepEqual(hashes(),before,'Core/non-core comparison preserves scientific bundles');
// Optional new coordinate banks: representative UI routes, not a layout audit.
for(const fixture of [
 {id:'zapps-pressmat-v4',cohort:'PreSSMat',flag:'zappsMaxNormalized',views:[['all','merged','60','vertex'],['ZAPPS','pure','80','group'],['PreSSMat','merged','100','vertex']]},
 {id:'umb-hmp-2019-panel',cohort:'UMB-HMP',flag:'hmpPanelMaxNormalized',views:[['all','merged','60','vertex'],['all','pure','80','vertex'],['joint-omics','pure','80','group'],['MT','merged','90','vertex'],['qPCR-positive','merged','100','vertex']]},
 {id:'lsvf-v3v4-20241111',cohort:'LSVF',flag:'lsvfMaxNormalized',views:[['all','merged','60','vertex'],['all','pure','80','vertex'],['metabolite','pure','80','group'],['metabolite+immune','merged','100','vertex']]}
]){
 if(!manifest.datasets[fixture.id])continue;
 ctx.maxnormDataset=fixture.id;ctx.maxnormCohort=fixture.cohort;
 await run('switchDataset(maxnormDataset)');await flush();
 optionalChecks[fixture.flag]=!!run('datasetMaxNormalizedAsset()');
 if(!optionalChecks[fixture.flag])continue;
 for(const [cohort,mode,q,kind] of fixture.views){
  Object.assign(ctx,{testCohort:cohort,testMode:mode,testQ:q,testKind:kind});
  await run('changeAnalysis(testCohort,testMode,testQ)');await flush();
  await run('testKind==="vertex"?selectVertex(current().nodes.slice().sort((a,b)=>current().edges.filter(e=>e.from===b.id||e.to===b.id).reduce((n,e)=>n+e.frequency,0)-current().edges.filter(e=>e.from===a.id||e.to===a.id).reduce((n,e)=>n+e.frequency,0))[0].id):select(current().edges.slice().sort((a,b)=>b.frequency-a.frequency)[0].id)');await flush();
  const sampleIds=clone(run('el("samples").data.find(t=>t.meta?.sampleView).ids'));
  const assignment=run('JSON.stringify(DATA.samples.pair)');
  for(const method of ['maxnorm-euclidean','maxnorm-linf']){
   ctx.testMethod=method;await run('changeEmbeddingChoice(testMethod)');await flush();
   assert.equal(run('el("sampleEmbedding").value'),method+'-local');
   assert.deepEqual(clone(run('el("samples").data.find(t=>t.meta?.sampleView).ids')),sampleIds);
   assert.equal(run('JSON.stringify(DATA.samples.pair)'),assignment);
   assert(run('el("sampleTitle").textContent.includes(maxNormalizedMethodLabel())'));
   assert(!run('el("sampleStress").textContent.includes("unavailable")'),run('el("sampleStatus").textContent'));
   const bookmark=clone(await run('captureNamedView()'));ctx.maxnormBookmark=bookmark;
   await run('changeEmbeddingChoice("l1-euclidean")');await flush();
   await run('restoreNamedView(maxnormBookmark)');await flush();
   assert.equal(run('el("sampleEmbedding").value'),method+'-local');
  }
  await run('clearSelection()');await flush();assert.equal(run('el("sampleEmbedding").value'),'maxnorm-linf');
  assert(run('el("sampleTitle").textContent.includes("MDS")'));
  if(cohort==='all'&&mode==='pure')assert.deepEqual(clone(run('maxNormalizedView().profiles')),clone(run('datasetRegistry.get(META.id).data.overviewEmbeddings[el("coverage").value].indices')).sort((a,b)=>a-b));
  if(cohort!=='all'&&mode==='pure')assert(run('el("sampleTitle").textContent.includes("(restricted)")'),'Pure subset title identifies the population restriction');
 }
 await run('changeAnalysis(maxnormCohort,"merged","70")');await flush();
 ctx.maxnormParticipant=run('[...participantGroups()].find(([key,rs])=>rs.length>1&&rs[0].cohort===maxnormCohort)[0]');
 await run('participant.embeddingMode="union";openParticipant(maxnormParticipant)');await flush();
 for(const mode of ['pure','merged']){
  ctx.testMode=mode;await run('changeAnalysis(maxnormCohort,testMode,"70")');await run('participant.embeddingMode="union";openParticipant(maxnormParticipant)');await flush();
  for(const method of ['maxnorm-euclidean','maxnorm-linf']){
   ctx.testMethod=method;await run('changeEmbeddingChoice(testMethod)');await flush();
   assert.equal(el('retrySubjectEmbedding').hidden,true,el('sampleStatus').textContent);
   assert.equal(run('savedSubjectEmbedding(currentSubjectEmbeddingScope()).metric'),method.replace('maxnorm-',''));
   ctx.maxnormJoint=clone(await run('captureNamedView()'));assert(ctx.maxnormJoint.subjectEmbeddingFit,'Joint fixture must use the joint embedding mode');
   await run('changeEmbeddingChoice("l1-euclidean")');await flush();
   assert.equal(run('captureSubjectEmbeddingFit().maxNormalizedRevision'),undefined);
   await run('restoreNamedView(maxnormJoint)');await flush();
   assert.deepEqual(clone(run('captureSubjectEmbeddingFit()')),ctx.maxnormJoint.subjectEmbeddingFit);
  }
 }
 await run('leaveParticipant()');await flush();
 assert.deepEqual(hashes(),before,'Max-normalized method changes preserve original scientific bundles');
}
await run('switchDataset(initialView.dataset)');
const count=requests.length;await run('ensureSensitivityLoaded("rebuilt");ensureEmbeddingFamiliesLoaded()');await run('switchDataset(initialView.dataset)');assert.equal(requests.length,count,'Loaded assets are reused');
assert.deepEqual(errors,[]);
console.log(JSON.stringify({status:'PASS',mode:auditLayouts?'integration-and-layout-audit':'integration',elapsedSeconds:Number(((performance.now()-started)/1000).toFixed(2)),datasets:visited,requests:count,initialRequests:manifest.datasets[initial].parts.length,deferredGraphs,displayChecks,populationChecks,pureCounts,optionalChecks,checks:['eight deferred graph settings and saved geometry restored','all datasets admitted and switched','stale selection suppressed','saved cameras restored','deferred joint fits fetched without refitting and four saved participant views restored','available populations and saved views checked; unavailable populations rejected','shared labels preserved','no scientific bundle mutation','loaded assets reused']},null,2));
