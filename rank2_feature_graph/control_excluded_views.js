// Eligibility is separate from the historical profile-coordinate bank.
function unmodifiedProfileView(bundle,cohort,mode){
 return cohort==='all'&&mode==='pure'&&!recordExtension(bundle)?.eligibility;
}
function canonicalDisplayCohort(bundle,cohort){
 return cohort==='records'&&recordExtension(bundle)?.eligibility?'all':cohort;
}
const eligiblePureCache=new WeakMap();
function materializeEligiblePureView(bundle,cohort){
 const a=recordExtension(bundle),b=bundle.data,x=BUNDLE_PACK.combDisplay,pop=cohort==='all'?'records':cohort;
 let cache=eligiblePureCache.get(bundle);if(!cache){cache=new Map();eligiblePureCache.set(bundle,cache)}if(cache.has(pop))return cache.get(pop);
 const population=a.populations[pop]?.indices;if(!population)throw Error('Eligible population unavailable');
 const records=a.records,compositions=BUNDLE_PACK.participants[bundle.dataset.id].compositions;
 const fullFit=combDisplayFit(combDisplayKey('overview','records',null,null)),fullPositions=new Map(fullFit.profiles.map((p,i)=>[p,fullFit.coords[i]]));
 const populationFit=combDisplayFit(combDisplayKey('overview',pop,null,null)),populationPositions=new Map(populationFit.profiles.map((p,i)=>[p,populationFit.coords[i]]));
 const referenceCoords=records.map(r=>fullPositions.get(r.profile)),coords=records.map(r=>populationPositions.get(r.profile)||fullPositions.get(r.profile)),pairs=records.map(r=>b.samples.pair[r.profile]);
 const counts=new Map();for(const i of population)counts.set(pairs[i],(counts.get(pairs[i])||0)+1);
 const base=b.graphs['100'],positions=new Map(base.nodes.map((n,i)=>[n.id,b.coords3d['100'][i]])),referenceRecords=new Map();
 records.forEach((r,i)=>{if(!referenceRecords.has(r.profile))referenceRecords.set(r.profile,i)});
 function restricted(indices,original=null){
  const byProfile=original&&new Map(original.profiles.map((p,k)=>[p,original.coords[k]]));
  if(original&&JSON.stringify(original.profiles)!==JSON.stringify([...new Set(indices.map(i=>records[i].profile))].sort((a,b)=>a-b)))throw Error('Pure-state fit membership differs from eligible records');
  return {...(original||{}),fittingScope:original?'local':'population-restriction',indices,n:indices.length,coords:indices.map(i=>byProfile?byProfile.get(records[i].profile):coords[i]),'relative.error':original?.evaluation?.relativeRms??null,
   source:original?'Verified exact-membership pure-state fit from the corrected 100% catalogue; original solver provenance retained.':'Corrected population coordinates restricted to selected pure states; not a new subset fit.',
   pca:original?.pca||original?.provenance?.pca||{'90':null,'95':null,'99':null}};
 }
 function anchors(f,features){
  if(!f.indices.length)return [];
  return features.map(j=>{let best=0,maximum=-1;f.indices.forEach((i,k)=>{const value=compositions[records[i].profile].find(([t])=>t===j-1)?.[1]??0;if(value>maximum){best=k;maximum=value}});
   const i=f.indices[best];return {feature:j,row:i,id:records[i].id,coords:f.coords[best],member:true,method:'Observed maximum among eligible displayed records',relative_error:0,maximum}});
 }
 const graphs={},coords3d={},overviewEmbeddings={},overviewEndpointProjections={},localEmbeddings={},endpointProjections={},vertexFits={},vertexMap={},vertexReferences={},pcaDimensions={};
 const byPair=new Map();for(const i of population){if(!byPair.has(pairs[i]))byPair.set(pairs[i],[]);byPair.get(pairs[i]).push(i)}
 // Pure overviews need only the population coordinates. Local pure-state fits
 // are HTTP fragments; prepare them after selection has loaded the fragment.
 const lazy=(object,key,prepare)=>Object.defineProperty(object,key,{enumerable:true,configurable:true,get(){const value=prepare();Object.defineProperty(object,key,{value,enumerable:true,configurable:true,writable:true});return value}});
 for(const [pair,indices] of byPair){
  const key=combDisplayKey('group',pop,100,pair),prior=b.localEmbeddings[pair],profiles=[...new Set(indices.map(i=>records[i].profile))].sort((a,b)=>a-b);
  const priorPca=prior?.pca&&JSON.stringify(prior.indices)===JSON.stringify(profiles)?prior.pca:null;
  lazy(localEmbeddings,pair,()=>{const f=restricted(indices,combDisplayFit(key));if(priorPca)f.pca=priorPca;return f});
  lazy(endpointProjections,pair,()=>anchors(localEmbeddings[pair],pair.split(',').map(Number)));
  // A catalogue must not fetch every local fit merely to display its PCA cells.
  Object.defineProperty(pcaDimensions,pair,{enumerable:true,get(){const fit=x.fits?.[key];return {n:indices.length,...(priorPca||fit?.pca||fit?.provenance?.pca||{'90':null,'95':null,'99':null})}}});
 }
 for(const q of Object.keys(b.graphs)){
  const selected=new Set(x.pureCores[q]),edges=base.edges.filter(e=>selected.has(e.id)&&counts.has(e.id)).map(e=>({...e,frequency:counts.get(e.id)}));
  const features=new Set(edges.flatMap(e=>[e.from,e.to])),included=population.filter(i=>selected.has(pairs[i]));
  const f=restricted(included),references=anchors(f,[...features]);
  const nodes=base.nodes.filter(n=>features.has(n.id)).map(n=>sensitivityReferenceNode(n,records,referenceRecords,x.sensitivityMode));
  const unseen=new Set(features);let components=0;while(unseen.size){components++;const todo=[unseen.values().next().value];unseen.delete(todo[0]);while(todo.length){const j=todo.pop();for(const e of edges){const k=e.from===j?e.to:e.to===j?e.from:null;if(k!==null&&unseen.delete(k))todo.push(k)}}}
  graphs[q]={nodes,edges,coverage:100*included.length/population.length,components};coords3d[q]=nodes.map(n=>positions.get(n.id));
  overviewEmbeddings[q]=f;overviewEndpointProjections[q]=references;
  for(const j of features){const incident=new Set(edges.filter(e=>e.from===j||e.to===j).map(e=>e.id)),ii=included.filter(i=>incident.has(pairs[i])),key=q+'_'+j;
   vertexFits[key]=restricted(ii);vertexMap[key]=key;vertexReferences[key]=anchors(vertexFits[key],[...new Set(edges.filter(e=>incident.has(e.id)).flatMap(e=>[e.from,e.to]))]);}
 }
 const data={...b,records,eligibleIndices:population,purePairs:pairs,samples:{ids:records.map(r=>r.id),pair:pairs,coords},referenceCoords,
  sampleTopFeatures:records.map(r=>b.sampleTopFeatures[r.profile]),graphs,coords3d,overviewEmbeddings,overviewEndpointProjections,
  localEmbeddings,endpointProjections,pcaDimensions,vertexEmbeddings:{fits:vertexFits,mapping:vertexMap},vertexEndpointProjections:vertexReferences};
 const title=rebuiltOnlyPopulation()&&pop==='records'?'All cohorts':a.populations[pop].title,meta={...bundle.dataset,analysisKey:a.revision+'|'+pop+'|pure',viewMode:'pure',populationName:title,observationUnit:'sample',observationLabel:'source records',
  description:title+' · control-excluded pure states',overviewLabel:title+' · restricted population coordinates',globalLabel:'Corrected population / restricted',
  overviewDescription:'Pure-state coverage is recomputed from eligible distinct profiles. Coordinates restrict the corrected population fit; this is not a separately fitted coverage subset.',
  globalDescription:'Eligible records only; verified corrected-population coordinates.',
  localDescription:'Pure states use exact-membership fits from the corrected 100% catalogue. Vertex unions restrict the corrected population fit. Historical exact-membership fits retain their solver provenance; no subset stress or convergence claim.',
  graphGeometryDescription:'Eligible distinct-profile frequencies define pure reference coverage and graph lengths. Selected-record counts are displayed.',
  methods:'82 explicit laboratory controls excluded; 548 low-reference-coverage records retained with diagnostics. Historical labels, unresolved participant/specimen mappings and scientific holds remain. The coordinate bank is historical, not the eligibility population.'};
 if(x.sensitivityMode){
  meta.analysisRevision=x.revision;
  meta.populationName=title+' · '+(x.sensitivityMode==='fixed'?'fixed-reference':'rebuilt-reference')+' sensitivity';
  meta.overviewLabel=meta.populationName+' · restricted population coordinates';
  meta.description=title+' · '+x.sensitivityLabel+' · pure states';
  meta.methods=x.methodsNote;
  meta.overviewDescription=(x.sensitivityMode==='fixed'?'Baseline pure-state catalogue is fixed.':'Pure-state coverage is rebuilt from retained distinct profiles.')+' Coordinates restrict the refitted selected population; this is not a separately fitted coverage subset.';
  meta.graphGeometryDescription=x.sensitivityMode==='fixed'?'Baseline graph geometry, weights and reference vertices retained, including external baseline references.':'Reference maxima and endpoint-distance graph geometry rebuilt after the sensitivity exclusion.';
 }
 if(rebuiltOnlyPopulation()){
  meta.populationName=title;
  meta.overviewLabel=title+' · population embedding';
  meta.description=title+' · pure states';
  meta.graphGeometryDescription='Reference graph weights and observed maxima use the eligible dataset population.';
 }
 const result={data,meta};if(cache.size>=2)cache.delete(cache.keys().next().value);cache.set(pop,result);return result;
}
