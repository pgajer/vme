// Optional, separately distributed coordinates; never fit or normalize in the renderer.
const maxNormalizedMethods=['maxnorm-euclidean','maxnorm-linf'];
const maxNormalizedIds=[...maxNormalizedMethods,...maxNormalizedMethods.map(id=>id+'-local')];
function maxNormalizedMethod(id=el('sampleEmbedding').value){return id.replace(/-local$/,'')}
function maxNormalizedIsLocal(){return maxNormalizedIds.includes(el('sampleEmbedding').value)&&el('sampleEmbedding').value.endsWith('-local')}
function sampleUsesLocalFit(){return el('sampleEmbedding').value==='local'||maxNormalizedIsLocal()}
const maxNormalizedCache=new WeakMap();
function maxNormalizedAsset(){
 const asset=BUNDLE_PACK.maxNormalizedEmbeddings;
 return META.id==='comb-V3V4-tx'&&activeSensitivityMode==='rebuilt'&&asset?.baseRevision===META.revision&&asset.sensitivityRevision===BUNDLE_PACK.combDisplay?.revision?asset:null;
}
function maxNormalizedView(){
 const id=el('sampleEmbedding').value;
 if(!maxNormalizedIds.includes(id)||participant.active||rank3UsesSamples()||candidateActive()||pureCoverageActive())return null;
 const asset=maxNormalizedAsset(),view=asset?.views[maxNormalizedMethod(id)];
 if(!view)throw Error('The max-normalized embedding supplement is unavailable for this population.');
 return maxNormalizedIsLocal()?maxNormalizedLocalView():view;
}
function maxNormalizedCoordinates(){
 const view=maxNormalizedView();if(!view)return null;
 let cached=maxNormalizedCache.get(DATA);
 if(!cached){cached=new Map();maxNormalizedCache.set(DATA,cached)}
 if(!cached.has(view)){
  const asset=maxNormalizedAsset(),positions=new Map((view.profiles||asset.profiles).map((p,i)=>[p,view.coordinates[i]]));
  const coords=DATA.records.map(r=>positions.get(r.profile));
  if(coords.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)))throw Error('Max-normalized coordinates do not cover the active records.');
  cached.set(view,coords);
 }
 return cached.get(view);
}
function syncMaxNormalizedControls(){
 const available=!!maxNormalizedAsset()&&!participant.active&&!rank3UsesSamples()&&!candidateActive()&&!pureCoverageActive();
 for(const id of ['sampleEmbedding','panelSampleEmbedding'])for(const option of el(id).options){
  if(maxNormalizedIds.includes(option.value)){option.hidden=!available;option.disabled=!available}
 }
 if(available&&maxNormalizedIsLocal()&&!maxNormalizedLocalEntry()){el('sampleEmbedding').value=maxNormalizedMethod();preferredSampleEmbedding=el('sampleEmbedding').value}
 if(!available&&maxNormalizedIds.includes(el('sampleEmbedding').value))el('sampleEmbedding').value='overview';
 if(!available&&maxNormalizedIds.includes(preferredSampleEmbedding))preferredSampleEmbedding='local';
}
function maxNormalizedDescription(){
 const view=maxNormalizedView();return view?view.label+(maxNormalizedIsLocal()?(view.solver.backend==='analytic'?' · exact local layout of '+view.profiles.length+' distinct composition(s)':' · independent local 3D MDS of this selection; max-normalized targets, two tested starts, 200 SGD epochs'):' · fixed full-population 3D embedding; selections restrict coordinates without refitting'):null;
}
function maxNormalizedStress(ordered,rows){
 const view=maxNormalizedView();if(!view)return false;
 const asset=maxNormalizedAsset(),metric=view.metric;
 const positions=new Map((view.profiles||asset.profiles).map((p,i)=>[p,view.coordinates[i]]));
 if(ordered.some(p=>!positions.get(p.profile)?.every((v,k)=>v===p.xyz[k])))throw Error('Displayed coordinates differ from the max-normalized fit; no score is substituted.');
 const profiles=new Set(view.profiles||asset.profiles),all=ordered.length===profiles.size&&ordered.every(p=>profiles.has(p.profile));
 const result=all?view.evaluation:cachedEmbeddingStress(JSON.stringify([asset.revision,metric,ordered]),()=>evaluateEmbeddingStress(rows,ordered.map(p=>p.xyz),{metric:'maxnorm_'+metric}));
 setEmbeddingStress('sampleStress',result,'Target: '+view.label+'. Each full composition is divided by its largest abundance: qᵢₖ = pᵢₖ / maxⱼ pᵢⱼ. '+(metric==='linf'?'dᵢⱼ = maxₖ |qᵢₖ − qⱼₖ|.':'dᵢⱼ = √(Σₖ (qᵢₖ − qⱼₖ)²).')+' Population: displayed distinct profiles, each counted once; reference markers and duplicate records are excluded. '+(all?(view.evaluation.sampled?'Reproducible sampled-pair evaluation of the complete fitted selection.':'Exact all-pairs evaluation of the complete fitted population.'):'Filtering changes the evaluation population, without refitting.')+(view.solver.backend==='analytic'?(view.profiles.length===1?' Single composition: no pairwise distances, so RMS relative error is undefined.':' Exact two-point layout at the target distance; no optimization needed.'):' Sparse metric MDS, SGD; '+view.solver.pivots+' pivots, seed '+view.solver.seed+', '+view.solver.starts+' start, '+view.solver.epochs+' epochs. Completing the epoch budget is not a convergence certificate.'));
 return true;
}

function validateMaxNormalizedNamedView(view){
 const s=view.selection;if(!maxNormalizedIds.includes(s?.embedding))return;
 const asset=BUNDLE_PACK.maxNormalizedEmbeddings,r=s.rank3;
 if(view.dataset!=='comb-V3V4-tx'||view.populationComparison!=='rebuilt'||!asset?.views[maxNormalizedMethod(s.embedding)]||view.datasetRevision!==asset.baseRevision||![asset.revision,asset.populationRevision].includes(view.maxNormalizedRevision)||s.participant?.active||r?.enabled&&(r.selected.length>0||r.vertex!==null||s.selected===null&&s.selectedVertex===null)||view.pureCoverage)
  throw Error('The saved max-normalized view requires its matching rebuilt-reference supplement and ordinary sample view.');
 const level=maxNormalizedLocalLevel(view.coverage,asset);
 if(s.embedding.endsWith('-local')&&(!level||view.maxNormalizedLocalRevision!==level.revision||view.coverage!==level.coverage||view.cohort!==level.cohort||view.stateMode!==level.stateMode||!level.contexts[s.selectedVertex!==null?'vertex:'+s.selectedVertex:'group:'+s.selected]))throw Error('The saved local embedding requires its matching selection and local supplement.');
}


function maxNormalizedLocalLevel(coverage=el('coverage').value,asset=maxNormalizedAsset()){
 const local=asset?.localEmbeddings;
 return local?.version===2?local.levels[coverage]:local?.coverage===coverage?local:null;
}
function maxNormalizedLocalEntry(method=maxNormalizedMethod()){
 const asset=maxNormalizedAsset(),local=maxNormalizedLocalLevel();
 if(!local||activeCohort!==local.cohort||activeStateMode!==local.stateMode)return null;
 const key=selectedVertex!==null?'vertex:'+selectedVertex:selected!==null?'group:'+selected:null;
 const identity=key&&local.contexts[key];return identity?asset.localEmbeddings.fits[identity+':'+method.replace('maxnorm-','')]:null;
}
function maxNormalizedLocalView(){
 const fit=maxNormalizedLocalEntry();if(!fit)throw Error('No max-normalized local fit for this selection');
 return {...fit,label:maxNormalizedAsset().views[maxNormalizedMethod()].label};
}
const maxNormalizedLocalCache=new WeakMap();
function maxNormalizedLocalFit(){
 const entry=maxNormalizedLocalEntry();if(!entry)return null;
 let cache=maxNormalizedLocalCache.get(DATA);if(!cache){cache=new Map();maxNormalizedLocalCache.set(DATA,cache)}
 if(cache.has(entry))return cache.get(entry);
 const members=new Set(entry.profiles),positions=new Map(entry.profiles.map((p,i)=>[p,entry.coordinates[i]]));
 const states=new Set(selectedVertex!==null?incidentEdges().map(e=>e.id):[selected]);
 const indices=eligibleIndices().filter(i=>states.has(DATA.samples.pair[i]));
 const observed=new Set(indices.map(i=>DATA.records[i].profile));
 if(observed.size!==members.size||[...observed].some(p=>!members.has(p)))throw Error('Local embedding membership differs from this selection');
 const fit={indices,n:indices.length,coords:indices.map(i=>positions.get(DATA.records[i].profile)),
  source:'Independent max-normalized '+(entry.metric==='linf'?'L∞':'Euclidean')+' local fit',
  'relative.error':entry.evaluation.relativeRms,'global.relative.error':entry.validation.globalRestrictionRms};
 cache.set(entry,fit);return fit;
}
function maxNormalizedLocalReferences(features,fit){
 const compositions=BUNDLE_PACK.participants[META.id].compositions;
 return features.map(feature=>{
  let best=0,maximum=-1;
  fit.indices.forEach((i,k)=>{const abundance=compositions[DATA.records[i].profile].find(v=>v[0]===feature-1)?.[1]??0;if(abundance>maximum){best=k;maximum=abundance}});
  const row=fit.indices[best];return {feature,row,id:DATA.samples.ids[row],coords:fit.coords[best],member:true,maximum,
   method:'Observed maximum within this fitted selection',relative_error:null};
 });
}
// Preserve historical route values for named views and dataset settings. The
// visible controls separate distance geometry from the scope of the saved fit.
function embeddingChoiceState(){
 const route=el('sampleEmbedding').value,method=maxNormalizedIds.includes(route)?maxNormalizedMethod(route):'l1-euclidean';
 const cohort=!!DATA.referenceCoords&&activeCohort!=='all';
 const locked=participant.active||rank3UsesSamples()||candidateActive()||pureCoverageActive();
 const scope=participant.active&&participant.embeddingMode==='union'?'subject':sampleUsesLocalFit()?'local':cohort&&['global','overview'].includes(route)?'cohort':'population';
 return {method,scope,cohort,locked};
}
function syncEmbeddingChoices(){
 const state=embeddingChoiceState(),maxAvailable=!!maxNormalizedAsset()&&!state.locked;
 const localAvailable=!state.locked&&hasSelection()&&(state.method==='l1-euclidean'
  ? !!(selectedVertex!==null?DATA.vertexEmbeddings?.fits[DATA.vertexEmbeddings.mapping[el('coverage').value+'_'+selectedVertex]]:DATA.localEmbeddings?.[selected])
  : !!maxNormalizedLocalEntry(state.method));
 for(const [methodId,scopeId] of [['sampleMethod','sampleFitScope'],['panelSampleMethod','panelSampleFitScope']]){
  const method=el(methodId),scope=el(scopeId);if(!method||!scope)return;
  for(const option of method.options){option.disabled=option.value!=='l1-euclidean'&&!maxAvailable;if(option.value==='l1-euclidean')option.textContent=typeof standardSampleEmbeddingTitle==='function'&&standardSampleEmbeddingTitle('').startsWith('Normalization/metric unspecified')?'Normalization/metric unspecified':'L1-normalized · Euclidean'}
  method.value=state.method;method.disabled=state.locked;
  method.title=state.locked?'This view uses its supported saved embedding.':'Normalization and distance metric. Max-normalized methods require the rebuilt-reference supplement.';
  for(const option of scope.options){
   option.hidden=option.value==='cohort'&&!state.cohort||option.value==='subject'&&state.scope!=='subject';
   option.disabled=option.value==='local'?!localAvailable:option.value==='cohort'?(state.method!=='l1-euclidean'||!state.cohort):option.value==='subject';
  }
  scope.value=state.scope;scope.disabled=state.locked||(!localAvailable&&!(state.cohort&&state.method==='l1-euclidean'));
  scope.title=state.locked?'Fitting scope is fixed for this view.':localAvailable?'Population keeps saved full-population coordinates. Local selection uses an independent fit for the complete selected state or vertex union.':
   !hasSelection()?'Population is the only fitting scope in this overview. Select an edge or vertex to use a saved local fit. Max-normalized local fits require All cohorts, Merged groups and a supplied coverage level.':
   'Local selection requires a matching saved fit. Max-normalized local fits: Rebuilt reference, All cohorts, Merged groups, and a supplied coverage level.';
  if(scope.parentElement)scope.parentElement.title=scope.title;
 }
}
function changeEmbeddingChoice(method,scope){
 const state=embeddingChoiceState();if(state.locked)return;
 if(maxNormalizedMethods.includes(method)){
  if(!maxNormalizedAsset())return;
  el('sampleEmbedding').value=method+(scope==='local'&&maxNormalizedLocalEntry(method)?'-local':'');
 }else{
  el('sampleEmbedding').value=scope==='local'?'local':scope==='cohort'?(hasSelection()?'global':'overview'):
   DATA.referenceCoords?'reference':hasSelection()?'global':'overview';
 }
 preferredSampleEmbedding=el('sampleEmbedding').value==='overview'?'global':el('sampleEmbedding').value;
 return el('sampleEmbedding').onchange();
}
function installEmbeddingChoices(){
 for(const [methodId,scopeId] of [['sampleMethod','sampleFitScope'],['panelSampleMethod','panelSampleFitScope']]){
  el(methodId).onchange=()=>changeEmbeddingChoice(el(methodId).value,el(scopeId).value);
  el(scopeId).onchange=()=>changeEmbeddingChoice(el(methodId).value,el(scopeId).value);
 }
}
