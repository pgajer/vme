// Additive display extension: frozen bundle bytes and record identities stay intact.
const combDisplayDecoded=new Map(),combDisplayViews=new Map();
function installCombDisplay(pack){
 const x=pack.combDisplay;if(!x)return;
 const b=pack.bundles.find(b=>b.dataset.id==='comb-V3V4-tx'),a=pack.recordAdapters[b.dataset.id],d=pack.participants[b.dataset.id];
 if(x.version!==1||x.baseRevision!==b.dataset.revision||d.analysisRevision!==a.revision)throw Error('Incompatible comb-V3V4 display extension');
 // Keep the Stage B analysis identity for existing pure/record named views.
 b.cohortAnalysis={version:1,revision:a.revision,displayRevision:x.revision,combDisplay:true,records:a.records,merged:x.merged,
  ...(a.eligibility?{eligibility:a.eligibility,eligibleProfiles:x.eligibleProfiles,pureCores:x.pureCores}:{}),
  populations:{all:{title:a.eligibility?(a.populations.records?.title||'All control-excluded records'):'All source records'},...a.populations},specs:{}};
 for(const c of Object.keys(b.cohortAnalysis.populations))for(const q of Object.keys(x.merged))b.cohortAnalysis.specs[`${c}|merged|${q}`]={};
 d.capabilities={...d.capabilities,jointEmbedding:true,mergedJointOnly:true};
 // Bind offline geometry keys to this record-analysis revision without changing fit receipts.
 for(const [key,id] of Object.entries(x.graphLayouts.contexts)){const parts=key.split('|');if(parts.length===9){parts.splice(2,0,a.revision);x.graphLayouts.contexts[parts.join('|')]=id;}}
}
function combDisplayFit(key){
 if(combDisplayDecoded.has(key))return combDisplayDecoded.get(key);
 const f=BUNDLE_PACK.combDisplay.fits[key];if(!f)throw Error('Missing precomputed comb-V3V4 population');
 const fit={...f,coords:decodeSavedCoordinates(f)};
 if(combDisplayDecoded.size>=16)combDisplayDecoded.delete(combDisplayDecoded.keys().next().value);
 combDisplayDecoded.set(key,fit);return fit;
}
function combDisplayKey(kind,pop,q,selection){return BUNDLE_PACK.combDisplay.contexts[JSON.stringify([kind,pop==='all'?'records':pop,q,selection])]}
let combSelectionRevision=0;
function deferCombSelection(kind,selection,retry){
 const request=++combSelectionRevision,bundle=datasetRegistry.get(META.id);
 const eligiblePure=activeStateMode==='pure'&&!!recordExtension(bundle)?.eligibility;
 if(!bundle.cohortAnalysis?.combDisplay||activeStateMode!=='merged'&&!(eligiblePure&&kind==='group'))return null;
 const asset=BUNDLE_PACK.combDisplay,key=combDisplayKey(kind,activeCohort,eligiblePure?100:Number(el('coverage').value),selection);
 if(!key||asset.fits[key]||!Object.hasOwn(asset.deferredFits||{},key))return null;
 const data=DATA,coverage=el('coverage').value,revision=datasetSwitchRevision,participantRevision=participantOpenRevision,edge=selected,vertex=selectedVertex,rank=JSON.stringify(rank3);
 const current=()=>request===combSelectionRevision&&revision===datasetSwitchRevision&&data===DATA&&coverage===el('coverage').value&&participantRevision===participantOpenRevision&&edge===selected&&vertex===selectedVertex&&rank===JSON.stringify(rank3);
 return loadForSelection(()=>ensurePreparedFit(META.id,'combDisplay',key,asset).catch(error=>{if(current())throw error}),revision,()=>{if(current())return retry()})
  .then(()=>true,error=>{if(current())datasetMessage(error.message);return false})
  .then(loaded=>{if(loaded&&current())return retry()});
}
function combSubjectFitKey(scope){
 const r=scope.records.find(r=>participantKey(r)===participant.key);
 return combDisplayKey('subject',r.cohort,Number(el('coverage').value),JSON.stringify([r.cohort,r.subject,r.episode??null]));
}
function combSubjectFit(scope){
 const b=datasetRegistry.get(META.id);if(!b.cohortAnalysis?.combDisplay||activeStateMode!=='merged')return null;
 const key=combSubjectFitKey(scope);
 const asset=BUNDLE_PACK.combDisplay;
 if(!asset.fits[key]&&Object.hasOwn(asset.deferredFits||{},key))return null;
 const f=combDisplayFit(key);
 if(JSON.stringify(f.profiles)!==JSON.stringify(scope.profiles))throw Error('Packaged comb-V3V4 subject membership differs');
 // Historical fits keep their original recipe; do not mislabel them as 200-epoch fits.
 const {coordinates,coordinateEncoding,...metadata}=f;
 return {...metadata,distinctCompositions:f.profiles.length,context:scope.context,receipt:f.receipt||key,displayRevision:BUNDLE_PACK.combDisplay.revision};
}
function materializeCombDisplay(bundle,cohort,mode,q){
 if(mode==='pure')return recordExtension(bundle)?.eligibility?materializeEligiblePureView(bundle,cohort):materializeRecordView(bundle,cohort);
 const a=recordExtension(bundle),b=bundle.data,x=BUNDLE_PACK.combDisplay,m=x.merged[q],pop=cohort==='all'?'records':cohort,cacheKey=pop+'|'+q;
 if(combDisplayViews.has(cacheKey))return combDisplayViews.get(cacheKey);
 const population=a.populations[pop].indices,records=a.records,groups=new Map(),vertices=new Map();
 const stateIds=s=>x.rank1[s]?[x.rank1[s]]:s.split(',').map(Number);
 for(const i of population){const s=m.pairs[records[i].profile];if(!groups.has(s))groups.set(s,[]);groups.get(s).push(i);for(const j of stateIds(s)){if(!vertices.has(j))vertices.set(j,[]);vertices.get(j).push(i)}}
 const compositions=BUNDLE_PACK.participants[bundle.dataset.id].compositions;
 function fitted(kind,selection,indices){
  const key=combDisplayKey(kind,pop,kind==='overview'?null:Number(q),selection),f=combDisplayFit(key),positions=new Map(f.profiles.map((p,i)=>[p,f.coords[i]]));
  return {...f,key,indices,n:indices.length,coords:indices.map(i=>positions.get(records[i].profile)),source:f.historical?'Reused frozen coordinates; original fit provenance retained':'Independent full-composition Euclidean fit; 200 SGD epochs (analytic for ≤4 profiles)', 'relative.error':f.evaluation?.relativeRms??null,pca:{'90':null,'95':null,'99':null}};
 }
 function anchors(f,ids){
  return ids.map(j=>{let best=0,maximum=-1;f.indices.forEach((i,k)=>{const v=compositions[records[i].profile].find(v=>v[0]===j-1)?.[1]??0;if(v>maximum){best=k;maximum=v}});const i=f.indices[best];return {feature:j,row:i,id:records[i].id,coords:f.coords[best],member:true,method:'Observed maximum within this fitted population',relative_error:0,maximum}});
 }
 const overview=fitted('overview',null,population),globalPositions=new Map(overview.indices.map((i,k)=>[i,overview.coords[k]]));
 const localEmbeddings={},endpointProjections={},vertexFits={},vertexMap={},vertexReferences={},pcaDimensions={};
 // Publish the same enumerable fields, but prepare a saved local layout only
 // when a selection asks for it. Failed preparation remains retryable.
 const lazy=(object,key,prepare)=>Object.defineProperty(object,key,{enumerable:true,configurable:true,get(){const value=prepare();Object.defineProperty(object,key,{value,enumerable:true,configurable:true,writable:true});return value}});
 for(const [s,ii] of groups){lazy(localEmbeddings,s,()=>fitted('group',s,ii));lazy(endpointProjections,s,()=>anchors(localEmbeddings[s],stateIds(s)));pcaDimensions[s]={n:ii.length,'90':null,'95':null,'99':null}}
 const edges=b.graphs['100'].edges.filter(e=>groups.has(e.id)&&!x.rank1[e.id]).map(e=>({...e,key:'G'+(m.cores.indexOf(e.id)+1),frequency:groups.get(e.id).length}));
 const features=new Set([...groups.keys()].flatMap(stateIds)),positions=new Map(b.graphs['100'].nodes.map((n,i)=>[n.id,b.coords3d['100'][i]]));
 const ref=anchors(overview,[...features]),refById=new Map(ref.map(r=>[r.feature,r]));
 const referenceRecords=new Map();records.forEach((r,i)=>{if(!referenceRecords.has(r.profile))referenceRecords.set(r.profile,i)});
 const nodes=b.graphs['100'].nodes.filter(n=>features.has(n.id)).map(n=>x.sensitivityMode?
  sensitivityReferenceNode(n,records,referenceRecords,x.sensitivityMode):({...n,anchor_row:refById.get(n.id).row,anchor_id:refById.get(n.id).id}));
 for(const [j,ii] of vertices){const key=combDisplayKey('vertex',pop,Number(q),j);vertexMap[q+'_'+j]=key;lazy(vertexFits,key,()=>fitted('vertex',j,ii));lazy(vertexReferences,key,()=>{const ids=[...new Set(edges.filter(e=>e.from===j||e.to===j).flatMap(e=>[e.from,e.to]))];return anchors(vertexFits[key],ids.length?ids:[j])})}
 const unseen=new Set(features);let components=0;while(unseen.size){components++;const todo=[unseen.values().next().value];unseen.delete(todo[0]);while(todo.length){const j=todo.pop();for(const e of edges){const k=e.from===j?e.to:e.to===j?e.from:null;if(k!==null&&unseen.delete(k))todo.push(k)}}}
 const referenceFit=a.eligibility?combDisplayFit(combDisplayKey('overview','records',null,null)):null,referencePositions=referenceFit&&new Map(referenceFit.profiles.map((p,i)=>[p,referenceFit.coords[i]]));
 const referenceCoords=records.map(r=>referencePositions?referencePositions.get(r.profile):b.samples.coords[r.profile]);
 const g={nodes,edges,coverage:100,components},coords=records.map((r,i)=>globalPositions.get(i)||referenceCoords[i]);
 const data={...b,rank1Groups:x.rank1,records,eligibleIndices:population,purePairs:records.map(r=>b.samples.pair[r.profile]),assignment:m,
  samples:{ids:records.map(r=>r.id),pair:records.map(r=>m.pairs[r.profile]),coords},referenceCoords,sampleTopFeatures:records.map(r=>b.sampleTopFeatures[r.profile]),
  graphs:Object.fromEntries(Object.keys(b.graphs).map(t=>[t,g])),coords3d:Object.fromEntries(Object.keys(b.graphs).map(t=>[t,nodes.map(n=>positions.get(n.id))])),
  overviewEmbeddings:Object.fromEntries(Object.keys(b.graphs).map(t=>[t,overview])),overviewEndpointProjections:Object.fromEntries(Object.keys(b.graphs).map(t=>[t,ref])),
  localEmbeddings,endpointProjections,pcaDimensions,vertexEmbeddings:{fits:vertexFits,mapping:vertexMap},vertexEndpointProjections:vertexReferences};
 const name=a.populations[pop].title;
 const meta={...bundle.dataset,analysisKey:`${x.revision}|${pop}|merged|${q}`,viewMode:'merged',populationName:name,observationUnit:'sample',observationLabel:'source records',
  description:name+' · record-weighted merged groups',overviewLabel:name+' · population embedding',globalLabel:'Selected population / restricted',
  overviewDescription:'All selected records retained. Duplicate compositions share coordinates; saved exact-membership fits are reused with their original provenance.',globalDescription:'Selected population embedding',
  localDescription:'Verified exact-membership coordinates: original full-composition Euclidean targets, 200 SGD epochs for new numerical fits; historical fits retain their original recipe. Epoch completion is not convergence. Endpoint labels identify observed maxima within the displayed population.',
  methods:`Record-weighted reference cores and rank-3/neighbor assignments for ${records.length.toLocaleString()} reference records. Assigned group labels need not name dominant taxa. ${a.eligibility?'82 explicit laboratory controls excluded; 548 low-reference-coverage records retained with diagnostics.':'Historical reference population retained.'} Scientific release holds remain in force. Single-positive compatibility groups retain records but do not create spurious two-taxon edges.`};
 if(x.sensitivityMode){
  meta.analysisRevision=x.revision;
  meta.populationName=name+' · '+(x.sensitivityMode==='fixed'?'fixed-reference':'rebuilt-reference')+' sensitivity';
  meta.overviewLabel=meta.populationName+' · population embedding';
  meta.description=name+' · '+x.sensitivityLabel+' · merged groups';
  meta.methods=x.methodsNote;
  meta.graphGeometryDescription=x.sensitivityMode==='fixed'?'Baseline reference graph retained; selected-record counts are descriptive and do not refit the graph.':'Reference catalogue, graph weights and endpoint maxima rebuilt after the sensitivity exclusion.';
 }
 const result={data,meta};if(combDisplayViews.size>=2)combDisplayViews.delete(combDisplayViews.keys().next().value);combDisplayViews.set(cacheKey,result);return result;
}
