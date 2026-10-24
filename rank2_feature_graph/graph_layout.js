// Display-only graph layouts. Frozen graph/sample coordinates are never modified.
const graphLayoutLabels={reference:'Saved reference',equal:'Equal targets (1)',proportion:'State proportion (scaled)'};
const graphLayoutCache=new Map(),graphLayoutPreference='vme-graph-layout-v1';
let graphLayoutMode='proportion',graphProportionStrength=4,graphStrengthTimer=null;
const graphStrengthPreference='vme-graph-proportion-strength-v1';
const graphEmbeddingLabels={spring:'Spring preview',mds:'Metric MDS (SGD)',grip:'GRIP (hop hierarchy)',weighted_grip:'Weighted GRIP'};
let graphEmbeddingMethod='weighted_grip';
const graphEmbeddingJobs=new Map(),graphMethodPreference='vme-graph-embedding-method-v1';
function cacheGraphLayout(key,fit){
 if(!graphLayoutCache.has(key)&&graphLayoutCache.size>=32)graphLayoutCache.delete(graphLayoutCache.keys().next().value);
 graphLayoutCache.set(key,fit);
}
function graphLayoutKey(dimension,method=graphEmbeddingMethod){
 const bundle=datasetRegistry.get(META.id);
 return [META.id,META.revision,bundle.cohortAnalysis?.combDisplay&&!bundle.cohortAnalysis?.eligibility&&activeStateMode==='pure'?undefined:bundle.cohortAnalysis?.revision,activeStateMode,el('coverage').value,graphLayoutMode,graphLayoutMode==='proportion'?graphProportionStrength:0,dimension,method,'springs-v1-600'].join('|');
}
function setGraphEmbeddingMethod(method,persist=false){
 if(!Object.hasOwn(graphEmbeddingLabels,method))return false;
 graphEmbeddingMethod=method;syncGraphStrengthControl();
 if(persist)try{(typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).setItem(graphMethodPreference,method)}catch{}
 return true;
}
function scheduleGraphEmbedding(key,input,dimension){
 if(graphEmbeddingJobs.has(key)){const previous=graphEmbeddingJobs.get(key);if(previous.fit)cacheGraphLayout(key,previous.fit);return;}
 const method=graphEmbeddingMethod,initial=dimension===3?input.coords3d:new Map(input.nodes.map(n=>[n.id,[n.x,n.y]]));
 const body={method,dimension,nodes:input.nodes.map(n=>n.id),edges:input.edges.map(e=>[e.from,e.to,e.target]),initial:input.nodes.map(n=>initial.get(n.id)),context:key};
 const job={error:null,pending:true,cancelled:false,packaged:!!BUNDLE_PACK.combDisplay?.graphLayouts?.contexts?.[key],controller:typeof AbortController==='function'?new AbortController():null};graphEmbeddingJobs.set(key,job);
 job.promise=(async()=>{
  try{
   const packaged=BUNDLE_PACK.combDisplay?.graphLayouts,fitId=packaged?.contexts?.[key];
   let result,precomputed=false;
   if(fitId&&Object.hasOwn(packaged.deferredFits||{},fitId)){
    await ensurePreparedFit(META.id,'combGraphLayouts',fitId,packaged);
    result=packaged.fits[fitId];precomputed=true;
   }else{
    if(typeof fetch!=='function')throw Error('R embeddings require the localhost explorer service.');
    const response=await fetch('/api/graph-layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:job.controller?.signal});
    result=await response.json();if(!response.ok)throw Error(result.error||'Graph fitting service unavailable.');
   }
   if(job.cancelled)return null;
   if(result.method!==method||result.dimension!==dimension||JSON.stringify(result.nodes)!==JSON.stringify(body.nodes)||!Array.isArray(result.coords)||result.coords.length!==body.nodes.length||!result.coords.every(p=>Array.isArray(p)&&p.length===dimension&&p.every(Number.isFinite))||!Number.isFinite(result.relativeRms)||typeof result.runtimeId!=='string')throw Error('Invalid graph-fitting response.');
   const fit={...input,...result,precomputed,lookup:new Map(result.nodes.map((id,i)=>[id,result.coords[i]])),nodes:input.nodes,edgeById:new Map(input.edges.map(e=>[e.id,e]))};
   cacheGraphLayout(key,fit);job.fit=fit;job.pending=false;
   for(const [old,entry] of graphEmbeddingJobs)if(graphEmbeddingJobs.size>32&&!entry.pending&&old!==key)graphEmbeddingJobs.delete(old);
   if(key===graphLayoutKey(Number(el('dimension').value))&&graphLayoutMode!=='reference')redrawGraphLayout();
   return fit;
  }catch(error){if(job.cancelled)return null;job.pending=false;job.error=error.message;if(key===graphLayoutKey(Number(el('dimension').value)))updateGraphLayoutNote();return null}
 })();
}
async function waitGraphEmbedding(){
 flushGraphStrengthUpdate();if(graphLayoutMode==='reference')return;
 for(const dimension of new Set([Number(el('dimension').value),3])){
  const key=graphLayoutKey(dimension),assets=BUNDLE_PACK.combDisplay?.graphLayouts,id=assets?.contexts?.[key];
  if(id&&!assets.fits[id]&&Object.hasOwn(assets.deferredFits||{},id))scheduleGraphEmbedding(key,graphLayoutInput(),dimension);
  const fit=graphLayoutResult(dimension),job=graphEmbeddingJobs.get(key);
  if(fit.preview||job?.pending)await job?.promise;
  if(job?.error)throw Error(job.error);
 }
 await graphQueue;
}
function captureGraphEmbeddingFit(){
 if(graphLayoutMode==='reference'||graphEmbeddingMethod==='spring')return null;
 const fit=graphLayoutResult(3);
 return {method:graphEmbeddingMethod,dimension:3,nodes:fit.nodes.map(n=>n.id),coords:fit.nodes.map(n=>[...fit.lookup.get(n.id)]),relativeRms:fit.relativeRms,geodesicNormalizedRmse:fit.geodesicNormalizedRmse,runtimeId:fit.runtimeId};
}
function validateGraphEmbeddingFit(view,bundle){
 const fit=view.graphEmbeddingFit;if(fit==null)return;
 const input=graphLayoutInput(bundle,view.stateMode,view.coverage,view.graphLayout,view.graphProportionStrength??4);
 if(view.graphLayout==='reference'||view.graphEmbeddingMethod==='spring'||fit.method!==view.graphEmbeddingMethod||fit.dimension!==3||JSON.stringify(fit.nodes)!==JSON.stringify(input.nodes.map(n=>n.id))||!Array.isArray(fit.coords)||fit.coords.length!==input.nodes.length||!fit.coords.every(p=>Array.isArray(p)&&p.length===3&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<1e9))||![fit.relativeRms,fit.geodesicNormalizedRmse].every(v=>Number.isFinite(v)&&v>=0)||typeof fit.runtimeId!=='string'||!/^[a-f0-9]{64}$/.test(fit.runtimeId)||fit.runtimeId!==view.graphEmbeddingRuntime)throw Error('Invalid saved graph embedding coordinates.');
}
function restoreGraphEmbeddingFit(view){
 if(!view.graphEmbeddingFit)return;
 const fit=copyCamera(view.graphEmbeddingFit),input=graphLayoutInput(),key=graphLayoutKey(3);
 const job=graphEmbeddingJobs.get(key);if(job){job.cancelled=true;job.controller?.abort();graphEmbeddingJobs.delete(key);}
 cacheGraphLayout(key,{...input,...fit,nodes:input.nodes,lookup:new Map(fit.nodes.map((id,i)=>[id,fit.coords[i]])),edgeById:new Map(input.edges.map(e=>[e.id,e])),restored:true});
}
async function checkGraphRuntime(runtimeId){
 if(!runtimeId)return;
 const response=await fetch('/api/graph-layout');const runtime=await response.json();
 if(!response.ok||runtime.runtimeId!==runtimeId)throw Error('The local grip runtime differs from this named view or is unavailable. Restore with its original source/build.');
}

function graphLayoutInput(bundle=datasetRegistry.get(META.id),stateMode=activeStateMode,q=el('coverage').value,lengthMode=graphLayoutMode,strength=graphProportionStrength){
 const b=bundle.data,a=bundle.cohortAnalysis;
 const merged=stateMode==='merged'&&a,corrected=!!a?.eligibility,source=b.graphs[merged||corrected?'100':q];
 const ids=merged?new Set(a.merged[q].cores):corrected?new Set(a.pureCores[q]):new Set(source.edges.map(e=>e.id));
 const counts=new Map(),labels=merged?a.merged[q].pairs:b.samples.pair;
 if(a&&!(a.combDisplay&&!merged))for(const r of a.records)counts.set(labels[r.profile],(counts.get(labels[r.profile])||0)+1);
 else for(const p of corrected?a.eligibleProfiles:labels.keys()){const id=labels[p];counts.set(id,(counts.get(id)||0)+1)}
 const total=a&&!(a.combDisplay&&!merged)?a.records.length:corrected?a.eligibleProfiles.length:labels.length,maxCount=Math.max(1,...[...counts].filter(([id])=>id!==null).map(([,n])=>n));
 const edges=source.edges.filter(e=>ids.has(e.id)&&!(merged&&a.combDisplay&&BUNDLE_PACK.combDisplay.rank1[e.id])).map(e=>({...e,count:counts.get(e.id)||0,proportion:(counts.get(e.id)||0)/total,target:lengthMode==='equal'?1:1+strength*(counts.get(e.id)||0)/maxCount}));
 const features=new Set(edges.flatMap(e=>[e.from,e.to])),nodes=source.nodes.filter(n=>features.has(n.id));
 const coords3d=new Map(source.nodes.map((n,i)=>[n.id,b.coords3d[merged||corrected?'100':q][i]]));
 return {nodes,edges,coords3d,total,maxCount};
}
function springGraphLayout(nodes,edges,initial,dimension){
 // A fixed 600-step relaxation of edge springs, with short-range collision
 // separation. This is a schematic layout, not an MDS fit or exact realization.
 const index=new Map(nodes.map((n,i)=>[n.id,i])),links=edges.map(e=>[index.get(e.from),index.get(e.to),e.target]);
 const neighbors=nodes.map(()=>[]);for(const [a,b] of links){neighbors[a].push(b);neighbors[b].push(a)}
 const unseen=new Set(nodes.map((_,i)=>i)),components=[];
 while(unseen.size){const group=[unseen.values().next().value];unseen.delete(group[0]);for(let k=0;k<group.length;k++)for(const j of neighbors[group[k]])if(unseen.delete(j))group.push(j);components.push(group)}
 const result=new Map();let right=0;
 for(const group of components){
  const local=new Map(group.map((i,k)=>[i,k])),ee=links.filter(([i])=>local.has(i)).map(([i,j,t])=>[local.get(i),local.get(j),t]);
  const p=group.map(i=>initial.get(nodes[i].id).slice(0,dimension));
  const center=Array.from({length:dimension},(_,k)=>p.reduce((s,v)=>s+v[k],0)/p.length);
  const meanLength=ee.reduce((s,[i,j])=>s+Math.hypot(...p[i].map((x,k)=>x-p[j][k])),0)/(ee.length||1),meanTarget=ee.reduce((s,e)=>s+e[2],0)/(ee.length||1);
  p.forEach((v,i)=>v.forEach((x,k)=>v[k]=(x-center[k])*(meanTarget/(meanLength||1))+.015*Math.sin((nodes[group[i]].id+1)*(k+1)*2.39996323)));
  const degree=p.map(()=>0);ee.forEach(([i,j])=>{degree[i]++;degree[j]++});
  for(let step=0;step<600;step++){
   const force=p.map(()=>Array(dimension).fill(0)),rate=.45*(1-.8*step/600);
   for(const [i,j,target] of ee){const delta=p[j].map((x,k)=>x-p[i][k]),length=Math.hypot(...delta)||1e-9,scale=(length-target)/length;
    for(let k=0;k<dimension;k++){const f=delta[k]*scale;force[i][k]+=f;force[j][k]-=f}}
   for(let i=0;i<p.length;i++)for(let j=0;j<i;j++){
    let squared=0;for(let k=0;k<dimension;k++)squared+=(p[j][k]-p[i][k])**2;
    if(squared<.25){const length=Math.sqrt(squared)||1e-9;for(let k=0;k<dimension;k++){const f=.12*(length-.5)*(p[j][k]-p[i][k])/length;force[i][k]+=f;force[j][k]-=f}}
   }
   p.forEach((v,i)=>v.forEach((_,k)=>v[k]+=rate*force[i][k]/Math.max(1,degree[i])));
  }
  const min=Math.min(...p.map(v=>v[0])),max=Math.max(...p.map(v=>v[0]));
  p.forEach((v,i)=>{v[0]+=right-min;result.set(nodes[group[i]].id,v)});right+=max-min+2;
 }
 const center=Array.from({length:dimension},(_,k)=>[...result.values()].reduce((s,p)=>s+p[k],0)/(result.size||1));
 for(const p of result.values())p.forEach((_,k)=>p[k]-=center[k]);
 const relativeRms=edges.length?Math.sqrt(edges.reduce((s,e)=>{const a=result.get(e.from),b=result.get(e.to);return s+(Math.hypot(...a.map((x,k)=>x-b[k]))/e.target-1)**2},0)/edges.length):0;
 return {lookup:result,relativeRms};
}
function graphLayoutResult(dimension){
 const key=graphLayoutKey(dimension);if(graphLayoutCache.has(key)&&!graphLayoutCache.get(key).preview)return graphLayoutCache.get(key);
 const saved=savedGraphLayout(key);
 if(saved){cacheGraphLayout(key,saved);return saved}
 const input=graphLayoutInput(),springKey=graphLayoutKey(dimension,'spring');
 if(!graphLayoutCache.has(springKey)){
  const initial=dimension===3?input.coords3d:new Map(input.nodes.map(n=>[n.id,[n.x,n.y]]));
  const fit=springGraphLayout(input.nodes,input.edges,initial,dimension);
  cacheGraphLayout(springKey,{...input,...fit,preview:Object.hasOwn(BUNDLE_PACK.combDisplay?.graphLayouts?.deferredFits||{},BUNDLE_PACK.combDisplay?.graphLayouts?.contexts?.[springKey]),edgeById:new Map(input.edges.map(e=>[e.id,e]))});
 }
 const packaged=BUNDLE_PACK.combDisplay?.graphLayouts,id=packaged?.contexts?.[key];
 if(id&&Object.hasOwn(packaged.deferredFits||{},id)){
  scheduleGraphEmbedding(key,input,dimension);
  return {...graphLayoutCache.get(springKey),preview:true};
 }
 if(graphEmbeddingMethod==='spring')return graphLayoutCache.get(springKey);
 if(dimension===Number(el('dimension').value))scheduleGraphEmbedding(key,input,dimension);
 return graphLayoutCache.get(key)||{...graphLayoutCache.get(springKey),preview:true};
}
function savedGraphLayout(key){
 const assets=typeof BUNDLE_PACK==='undefined'?null:BUNDLE_PACK.graphLayouts;
 const extra=typeof BUNDLE_PACK==='undefined'?null:BUNDLE_PACK.combDisplay?.graphLayouts;
 const id=assets?.contexts?.[key],extraId=extra?.contexts?.[key],result=(id&&assets.fits[id])||(extraId&&extra.fits[extraId]);if(!result)return null;
 const input=graphLayoutInput(),dimension=Number(key.split('|').at(-3));
 if(result.method!==graphEmbeddingMethod||result.dimension!==dimension||JSON.stringify(result.nodes)!==JSON.stringify(input.nodes.map(n=>n.id))||!Array.isArray(result.coords)||result.coords.length!==input.nodes.length||!result.coords.every(p=>Array.isArray(p)&&p.length===dimension&&p.every(Number.isFinite)))throw Error('Invalid packaged graph layout. Rebuild from verified assets.');
 return {...input,...result,nodes:input.nodes,lookup:new Map(result.nodes.map((id,i)=>[id,result.coords[i]])),edgeById:new Map(input.edges.map(e=>[e.id,e])),precomputed:true};
}
function graphLayoutCoordinates(){
 if(graphLayoutMode==='reference')return new Map(current().nodes.map((n,i)=>[n.id,DATA.coords3d[el('coverage').value][i]]));
 const fit=graphLayoutResult(3);return new Map(current().nodes.map(n=>[n.id,fit.lookup.get(n.id)]));
}
function graphLayoutHover(e){
 if(graphLayoutMode==='reference')return '';
 const fit=graphLayoutResult(Number(el('dimension').value)),edge=fit.edgeById.get(e.id);
 return edge?`<br>Whole dataset: n=${edge.count}/${fit.total} (${fmt(100*edge.proportion)}%)<br>Display target length: ${fmt(edge.target)} (approximate)` :'';
}
function updateGraphLayoutNote(){
 const note=el('graphLayoutSummary');el('graphEdgeLengths').value=graphLayoutMode;syncGraphStrengthControl();el('graphEmbeddingStatus').textContent='';el('retryGraphEmbedding').hidden=true;
 if(graphLayoutMode==='reference'){
  note.textContent='Saved reference layout · edge length is not state abundance.';
  el('graphGeometryNote').textContent=META.graphGeometryDescription||(META.analysisKey?'Saved graph positions retain the combined reference geometry. Cohort filtering does not refit the graph.':'Saved SGD metric MDS of shortest-path distances using Euclidean endpoint distances. Drawn lengths are approximate.');return;
 }
 const fit=graphLayoutResult(Number(el('dimension').value));
 const job=graphEmbeddingJobs.get(graphLayoutKey(Number(el('dimension').value)));
 if(fit.preview){el('graphEmbeddingStatus').textContent=job?.packaged?(job.error?'Saved layout unavailable: '+job.error+' Spring preview is shown.':'Loading saved graph layout… Spring preview is shown until loading finishes.'):(job?.error?'R fit unavailable: '+job.error+' Spring preview is shown.':'Computing '+graphEmbeddingLabels[graphEmbeddingMethod]+'… Spring preview is shown until the R fit finishes.');el('retryGraphEmbedding').hidden=!job?.error}
 note.textContent=(graphEmbeddingMethod==='spring'||fit.preview?'Spring preview':graphEmbeddingLabels[graphEmbeddingMethod])+' · '+(graphLayoutMode==='equal'?'Equal edge targets: 1 · drawn lengths approximate.':`State proportion strength ${graphProportionStrength}: targets 1–${1+graphProportionStrength} · drawn lengths approximate.`);
 el('graphGeometryNote').textContent=(graphLayoutMode==='equal'?'Every retained top-2 CST edge has target length 1.':'Target = 1 + '+graphProportionStrength+' × p / p_max. p is the state’s fraction of all '+fmt(fit.total)+' observations in this dataset; p_max is the largest state fraction ('+fmt(100*fit.maxCount/fit.total)+'%). Counts follow the current pure/merged assignment, including repeated observations. The positive baseline prevents near-zero targets; lengths are not strictly proportional.')+(graphEmbeddingMethod==='spring'||fit.preview?' Deterministic display-only spring relaxation (600 steps), initialized from saved reference coordinates.':' '+graphEmbeddingLabels[graphEmbeddingMethod]+' from an optimized grip source build. '+(graphEmbeddingMethod==='mds'?'SGD metric MDS on length-weighted shortest paths; 3 random starts, 500 epochs, base seed 20261016.':graphEmbeddingMethod==='grip'?'Hop-count hierarchy and neighborhoods; supplied lengths still set adjacent-edge targets. 160 rounds, 384 final rounds, base seed 20261016.':'Length-weighted shortest paths throughout the hierarchy; internal length normalization disabled. 160 rounds, 384 final rounds, base seed 20261016.')+' Output is uniformly scaled per component against target geodesics. MDS fits shortest paths: shorter alternate routes can override a long direct-edge target. Geodesic normalized RMSE: '+fmt(100*fit.geodesicNormalizedRmse)+'%.')+' Full-layout relative edge-length RMS error: '+fmt(100*fit.relativeRms)+'%. This is approximation error, not a convergence certificate. Cohort and selection filtering do not refit this layout. Disconnected component placement is arbitrary. Endpoint distance (pp), sample embeddings and assignments are unchanged. Targets refer to vertex centers; drawn segments stop outside the markers. Rank-3 face boundaries have no assigned target lengths. Manual 2D dragging changes displayed lengths; Reset graph layout restores the computed positions.';
}
function setGraphLayoutMode(mode,persist=false){
 if(!Object.hasOwn(graphLayoutLabels,mode))return false;
 cancelGraphStrengthUpdate();graphLayoutMode=mode;el('graphEdgeLengths').value=mode;syncGraphStrengthControl();
 if(persist)try{(typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).setItem(graphLayoutPreference,mode)}catch{}
 return true;
}
function syncGraphStrengthControl(){
 el('graphEmbeddingMethod').value=graphLayoutMode==='reference'?'reference':graphEmbeddingMethod;el('graphEmbeddingMethod').disabled=graphLayoutMode==='reference';
 el('graphProportionStrength').value=String(graphProportionStrength);
 el('graphProportionStrength').disabled=graphLayoutMode!=='proportion';
 el('graphProportionStrengthValue').textContent=String(graphProportionStrength);
 el('graphProportionStrength').setAttribute('aria-valuetext',`${graphProportionStrength}; target lengths 1 to ${1+graphProportionStrength}`);
}
function setGraphProportionStrength(value,persist=false){
 if(value===null||value===undefined||value==='')return false;
 const strength=Number(value);if(!Number.isFinite(strength)||strength<0||strength>10||Math.abs(strength*4-Math.round(strength*4))>1e-9)return false;
 graphProportionStrength=strength;syncGraphStrengthControl();
 if(persist)try{(typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).setItem(graphStrengthPreference,String(strength))}catch{}
 return true;
}
function cancelGraphStrengthUpdate(){if(graphStrengthTimer!==null){clearTimeout(graphStrengthTimer);graphStrengthTimer=null}}
function redrawGraphLayout(){
 const camera=pendingGraphCamera||readCamera('graph3d'),panZoom={...transform};
 positions();transform=panZoom;graph(camera);
}
function flushGraphStrengthUpdate(){if(graphStrengthTimer!==null){cancelGraphStrengthUpdate();redrawGraphLayout()}}
function installGraphLayouts(){
 try{setGraphLayoutMode((typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).getItem(graphLayoutPreference))}catch{}
 try{setGraphProportionStrength((typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).getItem(graphStrengthPreference))}catch{}
 try{setGraphEmbeddingMethod((typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).getItem(graphMethodPreference))}catch{}
 el('graphEmbeddingMethod').onchange=()=>{if(setGraphEmbeddingMethod(el('graphEmbeddingMethod').value,true))redrawGraphLayout()};
 el('retryGraphEmbedding').onclick=()=>{for(const [key,job] of graphEmbeddingJobs)if(job.error)graphEmbeddingJobs.delete(key);redrawGraphLayout()};
 syncGraphStrengthControl();el('graphEdgeLengths').value=graphLayoutMode;
 el('graphProportionStrength').oninput=()=>{
  if(graphLayoutMode!=='proportion'||!setGraphProportionStrength(el('graphProportionStrength').value,true))return;
  cancelGraphStrengthUpdate();graphStrengthTimer=setTimeout(()=>{graphStrengthTimer=null;redrawGraphLayout()},graphEmbeddingMethod==='spring'?120:500);
 };
 el('graphProportionStrength').onchange=flushGraphStrengthUpdate;
 el('graphEdgeLengths').onchange=()=>{
  if(setGraphLayoutMode(el('graphEdgeLengths').value,true))redrawGraphLayout();
 };
}
