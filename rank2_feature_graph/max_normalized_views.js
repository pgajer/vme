// Optional, separately distributed coordinates; never fit or normalize in the renderer.
const maxNormalizedIds=['maxnorm-euclidean','maxnorm-linf'];
const maxNormalizedCache=new WeakMap();
function maxNormalizedAsset(){
 const asset=BUNDLE_PACK.maxNormalizedEmbeddings;
 return META.id==='comb-V3V4-tx'&&activeSensitivityMode==='rebuilt'&&asset?.baseRevision===META.revision&&asset.sensitivityRevision===BUNDLE_PACK.combDisplay?.revision?asset:null;
}
function maxNormalizedView(){
 const id=el('sampleEmbedding').value;
 if(!maxNormalizedIds.includes(id)||participant.active||rank3UsesSamples()||candidateActive()||pureCoverageActive())return null;
 const asset=maxNormalizedAsset(),view=asset?.views[id];
 if(!view)throw Error('The max-normalized embedding supplement is unavailable for this population.');
 return view;
}
function maxNormalizedCoordinates(){
 const view=maxNormalizedView();if(!view)return null;
 let cached=maxNormalizedCache.get(DATA);
 if(!cached){cached=new Map();maxNormalizedCache.set(DATA,cached)}
 if(!cached.has(view)){
  const asset=maxNormalizedAsset(),positions=new Map(asset.profiles.map((p,i)=>[p,view.coordinates[i]]));
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
 if(!available&&maxNormalizedIds.includes(el('sampleEmbedding').value))el('sampleEmbedding').value='overview';
 if(!available&&maxNormalizedIds.includes(preferredSampleEmbedding))preferredSampleEmbedding='local';
}
function maxNormalizedDescription(){
 const view=maxNormalizedView();return view?view.label+' · fixed full-population 3D embedding; selections restrict coordinates without refitting':null;
}
function maxNormalizedStress(ordered,rows){
 const view=maxNormalizedView();if(!view)return false;
 const asset=maxNormalizedAsset(),metric=view.metric;
 const positions=new Map(asset.profiles.map((p,i)=>[p,view.coordinates[i]]));
 if(ordered.some(p=>!positions.get(p.profile)?.every((v,k)=>v===p.xyz[k])))throw Error('Displayed coordinates differ from the max-normalized fit; no score is substituted.');
 const profiles=new Set(asset.profiles),all=ordered.length===profiles.size&&ordered.every(p=>profiles.has(p.profile));
 const result=all?view.evaluation:cachedEmbeddingStress(JSON.stringify([asset.revision,metric,ordered]),()=>evaluateEmbeddingStress(rows,ordered.map(p=>p.xyz),{metric:'maxnorm_'+metric}));
 setEmbeddingStress('sampleStress',result,'Target: '+view.label+'. Each full composition is divided by its largest abundance: qᵢₖ = pᵢₖ / maxⱼ pᵢⱼ. '+(metric==='linf'?'dᵢⱼ = maxₖ |qᵢₖ − qⱼₖ|.':'dᵢⱼ = √(Σₖ (qᵢₖ − qⱼₖ)²).')+' Population: displayed distinct profiles, each counted once; reference markers and duplicate records are excluded. '+(all?'Exact all-pairs evaluation of the full fitted population.':'Filtering changes the evaluation population, without refitting.')+' Sparse metric MDS, SGD; '+view.solver.pivots+' pivots, seed '+view.solver.seed+', '+view.solver.starts+' start, '+view.solver.epochs+' epochs. Completing the epoch budget is not a convergence certificate.');
 return true;
}

function validateMaxNormalizedNamedView(view){
 const s=view.selection;if(!maxNormalizedIds.includes(s?.embedding))return;
 const asset=BUNDLE_PACK.maxNormalizedEmbeddings,r=s.rank3;
 if(view.dataset!=='comb-V3V4-tx'||view.populationComparison!=='rebuilt'||!asset?.views[s.embedding]||view.datasetRevision!==asset.baseRevision||view.maxNormalizedRevision!==asset.revision||s.participant?.active||r?.enabled&&(r.selected.length>0||r.vertex!==null||s.selected===null&&s.selectedVertex===null)||view.pureCoverage)
  throw Error('The saved max-normalized view requires its matching rebuilt-reference supplement and ordinary sample view.');
}
