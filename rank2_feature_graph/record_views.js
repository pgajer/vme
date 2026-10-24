// Additive record views. Frozen profile bundles and old all/pure bookmarks stay intact.
function recordExtension(bundle=datasetRegistry.get(META.id)){return BUNDLE_PACK.recordAdapters?.[bundle.dataset.id]}
function displayAnalysisRevision(bundle){return bundle.cohortAnalysis?.revision||recordExtension(bundle)?.revision}
const recordViewCache=new WeakMap();
function materializeRecordView(bundle,cohort){
 const a=recordExtension(bundle),b=bundle.data,population=a?.populations[cohort]?.indices;
 if(!population)throw Error('Reviewed record population unavailable');
 let cache=recordViewCache.get(bundle);if(!cache){cache=new Map();recordViewCache.set(bundle,cache)}if(cache.has(cohort))return cache.get(cohort);
 const records=a.records,profileRecords=new Map(),allProfileRecords=new Map(),counts=new Map();
 records.forEach((r,i)=>{if(!allProfileRecords.has(r.profile))allProfileRecords.set(r.profile,i)});
 for(const i of population){const p=records[i].profile;if(!profileRecords.has(p))profileRecords.set(p,[]);profileRecords.get(p).push(i);const pair=b.samples.pair[p];counts.set(pair,(counts.get(pair)||0)+1)}
 const referenceRow=p=>profileRecords.get(p)?.[0]??allProfileRecords.get(p);
 const fit=f=>{const rows=f.indices.flatMap((p,k)=>(profileRecords.get(p)||[]).map(i=>[i,f.coords[k]])).sort((a,b)=>a[0]-b[0]);return {...f,indices:rows.map(v=>v[0]),coords:rows.map(v=>v[1]),n:rows.length,source:'Saved full-reference fit restricted to source records; coordinates unchanged. Fit errors/PCA describe the original profile fit.'}};
 const anchors=(list,f)=>{const present=new Set(f.indices);return list.map(a=>({...a,row:referenceRow(a.row),id:records[referenceRow(a.row)].id,member:present.has(referenceRow(a.row))}))};
 const graphs={},coords3d={},overviewEmbeddings={},overviewEndpointProjections={};
 for(const [q,g] of Object.entries(b.graphs)){
  const edges=g.edges.filter(e=>counts.has(e.id)).map(e=>({...e,frequency:counts.get(e.id)})),features=new Set(edges.flatMap(e=>[e.from,e.to]));
  const kept=g.nodes.map((n,i)=>[n,i]).filter(([n])=>features.has(n.id));
  const nodes=kept.map(([n])=>({...n,anchor_row:referenceRow(n.anchor_row),anchor_id:records[referenceRow(n.anchor_row)].id}));
  const unseen=new Set(features);let components=0;while(unseen.size){components++;const todo=[unseen.values().next().value];unseen.delete(todo[0]);while(todo.length){const j=todo.pop();for(const e of edges){const k=e.from===j?e.to:e.to===j?e.from:null;if(k!==null&&unseen.delete(k))todo.push(k)}}}
  const f=fit(b.overviewEmbeddings[q]);overviewEmbeddings[q]=f;
  overviewEndpointProjections[q]=anchors(b.overviewEndpointProjections[q].filter(a=>features.has(a.feature)),f);
  graphs[q]={...g,nodes,edges,components,coverage:100*f.n/population.length};coords3d[q]=kept.map(([,i])=>b.coords3d[q][i]);
 }
 const localEmbeddings={},endpointProjections={},vertexFits={},vertexReferences={};
 for(const [pair,f] of Object.entries(b.localEmbeddings)){localEmbeddings[pair]=fit(f);endpointProjections[pair]=anchors(b.endpointProjections[pair],localEmbeddings[pair])}
 for(const [key,f] of Object.entries(b.vertexEmbeddings.fits)){vertexFits[key]=fit(f);vertexReferences[key]=anchors(b.vertexEndpointProjections[key],vertexFits[key])}
 const coords=records.map(r=>b.samples.coords[r.profile]);
 const data={...b,records,eligibleIndices:population,samples:{...b.samples,ids:records.map(r=>r.id),pair:records.map(r=>b.samples.pair[r.profile]),coords},referenceCoords:coords,
  purePairs:records.map(r=>b.samples.pair[r.profile]),sampleTopFeatures:records.map(r=>b.sampleTopFeatures[r.profile]),graphs,coords3d,overviewEmbeddings,overviewEndpointProjections,
  localEmbeddings,endpointProjections,vertexEmbeddings:{...b.vertexEmbeddings,fits:vertexFits},vertexEndpointProjections:vertexReferences};
 const title=a.populations[cohort].title;
 const meta={...bundle.dataset,analysisKey:a.revision+'|'+cohort+'|pure',viewMode:'pure',populationName:title,observationUnit:'sample',observationLabel:'source records',
  description:title+' · original pure states · reviewed record metadata',overviewLabel:title+' · saved coverage embedding',
  overviewDescription:'Existing coverage-specific coordinates restricted to this population; repeated records share profile coordinates. No cohort fit.',
  globalLabel:'Saved full reference / restricted',globalDescription:'Saved full-reference coordinates',
  localDescription:'Existing pure-state or vertex fit, restricted to this population; no refitting. Error and PCA statistics refer to the original distinct-profile reference.',
  graphGeometryDescription:'Frozen combined-reference graph geometry and state selection. Edge counts describe selected records; proportion-based graph lengths retain the original reference-profile weights.',
  methods:bundle.dataset.methods+' Stage B expands the exact profile-to-record bridge without changing coordinates. Coverage still selects the frozen pure-state catalogue; displayed coverage counts selected records. Unlinked and flagged records remain available. '+(bundle.cohortAnalysis?.combDisplay?'Merged groups and their precomputed joint embeddings are available in Merged mode.':'Merged states and joint embeddings are not supplied.')};
 const result={data,meta};cache.set(cohort,result);return result;
}
