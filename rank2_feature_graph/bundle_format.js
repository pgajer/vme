// Version 1 portable data contract. This validator is shared by browser and CLI.
function validateBundle(bundle){
 if(bundle?.data?.profileBankVersion!==undefined)return validateRebuiltProfileBank(bundle);
 const need=(ok,message)=>{if(!ok)throw new Error('Invalid dataset bundle: '+message)};
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const string=x=>typeof x==='string'&&x.length>0;
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const integer=x=>Number.isSafeInteger(x)&&x>=0;
 const xyz=x=>Array.isArray(x)&&x.length===3&&x.every(finite);
 const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
 need(object(bundle)&&bundle.format==='rank2-explorer-bundle'&&bundle.version===1,'unsupported format/version');
 const m=bundle.dataset,d=bundle.data;
 need(object(m)&&object(d),'dataset and data objects required');
 need(string(m.id)&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(m.id),'dataset.id must be a safe unique identifier');
 for(const k of ['revision','title','description','observationLabel','overviewLabel','overviewDescription','globalDescription','localDescription','methods'])need(string(m[k]),'dataset.'+k+' required');
 need(['sample','distinct-composition'].includes(m.observationUnit),'observationUnit must be sample or distinct-composition');
 need(integer(m.featureCount)&&m.featureCount>=2,'featureCount must be at least two');
 need(object(m.provenance)&&Object.keys(m.provenance).length>0,'provenance required');
 for(const k of ['graphs','samples','featureNames','overviewEmbeddings','overviewEndpointProjections','coords3d','localEmbeddings','endpointProjections','vertexEmbeddings','vertexEndpointProjections','pcaDimensions'])need(object(d[k]),'data.'+k+' required (may be empty for optional local/PCA assets)');
 need(object(d.vertexEmbeddings.mapping)&&object(d.vertexEmbeddings.fits),'vertexEmbeddings.mapping/fits required');
 const s=d.samples,N=s.ids?.length;
 need(N>0&&Array.isArray(s.ids)&&s.ids.every(string)&&new Set(s.ids).size===N,'unique nonempty sample IDs required');
 need(Array.isArray(s.pair)&&s.pair.length===N,'sample state array length');
 need(Array.isArray(s.coords)&&s.coords.length===N&&s.coords.every(xyz),'finite global coordinates required for every observation');
 need(Array.isArray(d.sampleTopFeatures)&&d.sampleTopFeatures.length===N,'sampleTopFeatures length');
 for(const a of d.sampleTopFeatures)need(Array.isArray(a)&&a.length>0&&a.length<=4&&a.every(x=>Array.isArray(x)&&x.length===2&&string(x[0])&&finite(x[1])&&x[1]>=0&&x[1]<=100),'top features must be names and percentages');
 need(Object.keys(d.featureNames).length===m.featureCount&&Object.entries(d.featureNames).every(([k,v])=>/^\d+$/.test(k)&&string(v)),'featureNames must cover featureCount numeric feature IDs');
 const qs=Object.keys(d.graphs);
 need(qs.includes('100')&&typeof m.defaultCoverage==='string'&&qs.includes(m.defaultCoverage),'100% and defaultCoverage graphs required');
 need(qs.every(q=>String(Number(q))===q&&Number(q)>0&&Number(q)<=100),'coverage keys must be canonical percentages in (0,100]');
 const full=d.graphs['100'];need(object(full)&&Array.isArray(full.edges)&&Array.isArray(full.nodes),'100% graph');
 const nodes=new Map(),edges=new Map(),members=new Map();
 for(const n of full.nodes){
  need(object(n)&&integer(n.id)&&!nodes.has(n.id)&&Object.hasOwn(d.featureNames,String(n.id)),'unique known graph feature IDs');
  need(string(n.label)&&finite(n.maximum)&&n.maximum>=0&&n.maximum<=100,'node label/maximum');
  need(integer(n.anchor_row)&&n.anchor_row<N&&s.ids[n.anchor_row]===n.anchor_id&&integer(n.maximum_ties)&&n.maximum_ties>=1,'endpoint row/ID/ties');
  nodes.set(n.id,n);
 }
 for(const e of full.edges){
  need(object(e)&&nodes.has(e.from)&&nodes.has(e.to)&&e.from<e.to&&e.id===e.from+','+e.to&&!edges.has(e.id),'unique canonical unordered state ID (smaller numeric feature first)');
  need(string(e.label)&&string(e.key)&&integer(e.frequency)&&e.frequency>0&&finite(e.length)&&e.length>=0,'edge label, count or distance');
  edges.set(e.id,e);members.set(e.id,[]);
 }
 // Versioned assignment extension: a truly single-positive composition has no
 // leading pair. It still has a full-reference coordinate and participant row.
 const unpaired=d.pairAssignmentVersion===2;
 if(d.pairAssignmentVersion!==undefined)need(unpaired,'unsupported pair assignment version');
 if(unpaired){
  need(Array.isArray(d.geometryProfile)&&d.geometryProfile.length===N&&d.geometryProfile.every(x=>integer(x)&&x<N),'composition geometry map');
  need(Array.isArray(s.singleTaxon)&&s.singleTaxon.length===N&&Array.isArray(s.dominantGe95)&&s.dominantGe95.length===N,'single-taxon and dominance arrays');
  const featureIDs=new Map(Object.entries(d.featureNames).map(([id,name])=>[name,Number(id)]));
  s.pair.forEach((id,i)=>{
   const top=d.sampleTopFeatures[i];need(top.every(v=>v[1]>0),'positive top features in assignment version 2');
   need(typeof s.dominantGe95[i]==='boolean'&&s.dominantGe95[i]===(top[0][1]>=95),'95% dominance flag');
   if(id===null)need(top.length===1&&Math.abs(top[0][1]-100)<1e-10&&s.singleTaxon[i]===featureIDs.get(top[0][0]),'null pair requires an explicit single-positive composition');
   else need(s.singleTaxon[i]===null&&top.length>=2&&top.slice(0,2).map(v=>featureIDs.get(v[0])).sort((a,b)=>a-b).join(',')===id,'positive leading pair identity');
  });
 }
 s.pair.forEach((id,i)=>{if(unpaired&&id===null)return;need(edges.has(id),'unknown sample state '+id);members.get(id).push(i)});
 for(const [id,e] of edges)need(members.get(id).length===e.frequency,'state frequency does not match observation rows: '+id);
 function fit(f,expected,where){
  need(object(f)&&Array.isArray(f.indices)&&same(f.indices,expected),'exact sorted membership: '+where);
  for(const k of ['relative.error','global.relative.error'])if(f[k]!=null)need(finite(f[k])&&f[k]>=0,'fit error: '+where);
  need(f.n===expected.length&&Array.isArray(f.coords)&&f.coords.length===f.n&&f.coords.every(xyz),'fit n/finite coordinates: '+where);
 }
 function anchors(list,features,f,where){
  need(Array.isArray(list)&&list.length===features.length,'endpoint count: '+where);
  const seen=new Set(),positions=new Map(f.indices.map((x,i)=>[x,f.coords[i]]));
  for(const a of list){
   need(object(a)&&features.includes(a.feature)&&!seen.has(a.feature),'endpoint feature: '+where);seen.add(a.feature);
   const n=nodes.get(a.feature);need(a.row===n.anchor_row&&a.id===n.anchor_id&&xyz(a.coords),'endpoint identity/coordinates: '+where);
   need(typeof a.member==='boolean'&&a.member===positions.has(a.row),'endpoint membership flag: '+where);
   if(a.member)need(same(a.coords,positions.get(a.row)),'member endpoint must use the saved fit coordinate: '+where);
   need(string(a.method),'endpoint method: '+where);
   need(a.relative_error===null||finite(a.relative_error)&&a.relative_error>=0,'endpoint projection error: '+where);
  }
 }
 const sorted=[...edges.values()].sort((a,b)=>b.frequency-a.frequency);
 for(const q of qs){
  const g=d.graphs[q];need(object(g)&&Array.isArray(g.edges)&&Array.isArray(g.nodes)&&integer(g.components)&&g.components>0,'graph '+q);
  let count=0,cutoff=Infinity;for(const e of sorted){count+=e.frequency;cutoff=e.frequency;if(count/N*100>=Number(q)-1e-10)break}
  const expectedEdges=sorted.filter(e=>e.frequency>=cutoff),wanted=new Set(expectedEdges.map(e=>e.id));
  need(g.edges.length===wanted.size&&new Set(g.edges.map(e=>e.id)).size===wanted.size,'complete tied-frequency coverage tiers: '+q);
  for(const e of g.edges){const base=edges.get(e.id);need(wanted.has(e.id)&&['from','to','frequency','length','label'].every(k=>e[k]===base[k])&&string(e.key),'coverage edge mismatch: '+q)}
  const featureIDs=[...new Set(g.edges.flatMap(e=>[e.from,e.to]))];
  need(g.nodes.length===featureIDs.length&&new Set(g.nodes.map(n=>n.id)).size===featureIDs.length,'graph node count '+q);
  for(const n of g.nodes){const base=nodes.get(n.id);need(featureIDs.includes(n.id)&&['label','maximum','anchor_row','anchor_id','maximum_ties'].every(k=>n[k]===base[k])&&finite(n.x)&&finite(n.y),'graph node identity/2D position '+q)}
  const unseen=new Set(featureIDs);let components=0;
  const adjacency=new Map(featureIDs.map(id=>[id,[]]));for(const e of g.edges){adjacency.get(e.from).push(e.to);adjacency.get(e.to).push(e.from)}
  while(unseen.size){components++;const todo=[unseen.values().next().value];unseen.delete(todo[0]);while(todo.length){for(const id of adjacency.get(todo.pop()))if(unseen.delete(id))todo.push(id)}}
  need(components===g.components,'graph component count '+q);
  const indices=s.pair.flatMap((id,i)=>wanted.has(id)?[i]:[]);
  need(finite(g.coverage)&&Math.abs(g.coverage-100*indices.length/N)<1e-7,'coverage denominator must be observation rows: '+q);
  need(Array.isArray(d.coords3d[q])&&d.coords3d[q].length===g.nodes.length&&d.coords3d[q].every(xyz),'graph 3D coordinates '+q);
  fit(d.overviewEmbeddings[q],indices,'overview '+q);
  anchors(d.overviewEndpointProjections[q],featureIDs,d.overviewEmbeddings[q],'overview '+q);
  for(const n of g.nodes){
   const key=d.vertexEmbeddings.mapping[q+'_'+n.id];if(key===undefined)continue;
   need(typeof key==='string','vertex fit key '+q+'_'+n.id);
   const incident=new Set(g.edges.filter(e=>e.from===n.id||e.to===n.id).map(e=>e.id));
   const ii=[...incident].flatMap(id=>members.get(id)).sort((a,b)=>a-b),f=d.vertexEmbeddings.fits[key];fit(f,ii,'vertex '+q+'_'+n.id);
   need(string(f.source),'vertex fit source');
   const features=[...new Set(g.edges.filter(e=>incident.has(e.id)).flatMap(e=>[e.from,e.to]))];
   anchors(d.vertexEndpointProjections[key],features,f,'vertex '+q+'_'+n.id);
  }
 }
 for(const [id,f] of Object.entries(d.localEmbeddings)){
  need(edges.has(id),'local fit for unknown edge');fit(f,members.get(id),'edge '+id);need(string(f.source),'edge fit source');
  anchors(d.endpointProjections[id],[edges.get(id).from,edges.get(id).to],f,'edge '+id);
 }
 for(const [id,p] of Object.entries(d.pcaDimensions)){
  need(edges.has(id)&&object(p)&&p.n===edges.get(id).frequency,'PCA state/count');
  const dims=[p['90'],p['95'],p['99']];need(dims.every(x=>x===null)||dims.every(x=>integer(x)&&x>=1&&x<=Math.min(m.featureCount,p.n-1))&&dims[0]<=dims[1]&&dims[1]<=dims[2],'PCA dimensions');
 }
 if(bundle.cohortAnalysis!==undefined)validateCohortAnalysis(bundle.cohortAnalysis,bundle);
 return bundle;
}

// Optional cohort-analysis extension. Original version-1 pure bundles remain valid.
function validateCohortAnalysis(a,bundle){
 const need=(ok,msg)=>{if(!ok)throw new Error('Invalid cohort analysis: '+msg)};
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const integer=x=>Number.isSafeInteger(x)&&x>=0;
 const xyz=x=>Array.isArray(x)&&x.length===3&&x.every(Number.isFinite);
 const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
 const base=bundle.data,N=base.samples.ids.length,qs=Object.keys(base.graphs);
 need(object(a)&&a.version===1&&a.baseRevision===bundle.dataset.revision&&typeof a.revision==='string','version or base revision');
 need(Array.isArray(a.records)&&a.records.length>0&&object(a.merged)&&object(a.specs)&&object(a.fits),'records, assignments, view specifications and fits required');
 need(object(a.populations)&&object(a.populations.all)&&a.populations.all.sourceCohorts===null,'population definitions');
 for(const [id,pop] of Object.entries(a.populations)){
  need(/^[A-Za-z0-9+_.-]+$/.test(id)&&typeof pop.title==='string','population definition');
  if(pop.recordIndices!==undefined)need(a.populationVersion===2&&id!=='all'&&Array.isArray(pop.recordIndices)&&pop.recordIndices.length>0&&pop.recordIndices.every((x,k)=>Number.isSafeInteger(x)&&x>=0&&x<a.records.length&&(k===0||pop.recordIndices[k-1]<x)),'explicit population indices');
  else need(id==='all'||Array.isArray(pop.sourceCohorts)&&pop.sourceCohorts.length>0&&pop.sourceCohorts.every(c=>typeof c==='string'),'source cohort population');
 }
 const records=a.records,R=records.length;need(new Set(records.map(r=>r.id)).size===R,'unique record IDs');
 for(const r of records)need(object(r)&&integer(r.profile)&&r.profile<N&&['id','cohort','subject','visit','specimen'].every(k=>typeof r[k]==='string')&&r.id.length>0,'record metadata/profile');
 const pureCounts=new Map();for(const r of records){const s=base.samples.pair[r.profile];if(s===null&&base.pairAssignmentVersion===2)continue;pureCounts.set(s,(pureCounts.get(s)||0)+1)}
 const fullNodes=new Map(base.graphs['100'].nodes.map(n=>[n.id,n]));
 for(const q of qs){
  const m=a.merged[q];need(object(m)&&Array.isArray(m.cores)&&m.cores.length>0&&new Set(m.cores).size===m.cores.length,'core list '+q);
  const sorted=[...pureCounts].sort((a,b)=>b[1]-a[1]);let total=0,cutoff;for(const [s,n] of sorted){total+=n;cutoff=n;if(total*100>=Number(q)*R)break}
  const expected=sorted.filter(([s,n])=>n>=cutoff).map(([s])=>s),coreSet=new Set(m.cores);
  need(expected.length===coreSet.size&&expected.every(s=>coreSet.has(s)),'reference record-weighted coverage tiers '+q);
  need(Math.abs(m.referenceCoreCoverage-100*m.cores.reduce((n,s)=>n+pureCounts.get(s),0)/R)<1e-8,'core coverage percentage '+q);
  need(Array.isArray(m.pairs)&&m.pairs.length===N&&m.pairs.every(s=>coreSet.has(s))&&Array.isArray(m.methods)&&m.methods.length===N,'complete assignment arrays '+q);
  need(object(m.fallback)&&object(m.bridges),'assignment evidence '+q);
  m.methods.forEach((method,p)=>{
   const pure=base.samples.pair[p];need(['core','rank3','knn'].includes(method),'assignment method');
   if(coreSet.has(pure))need(method==='core'&&m.pairs[p]===pure,'core membership must remain unchanged');
   else need(method!=='core','noncore labelled core');
   if(method==='rank3'){const bridge=m.bridges[pure];need(object(bridge)&&bridge.core===m.pairs[p]&&Number.isFinite(bridge.score)&&bridge.score>0,'rank3 evidence')}
   if(method==='knn'){const v=m.fallback[p];need(object(v)&&integer(v.neighborhood)&&v.neighborhood>=Math.min(10,R-1)&&v.neighborhood<R&&integer(v.voters)&&v.voters>0&&v.voters<=v.neighborhood&&integer(v.votes)&&v.votes>0&&v.votes<=v.voters&&Math.abs(v.voteShare-v.votes/v.voters)<1e-12&&Number.isFinite(v.nearestDistance)&&v.nearestDistance>=0&&Number.isFinite(v.radius)&&v.radius>=v.nearestDistance&&integer(v.tiedGroups)&&v.tiedGroups>=1&&object(v.votesByGroup)&&Object.entries(v.votesByGroup).every(([c,n])=>coreSet.has(c)&&integer(n)&&n>0)&&Object.values(v.votesByGroup).reduce((n,k)=>n+k,0)===v.voters&&v.votesByGroup[m.pairs[p]]===v.votes&&Math.max(...Object.values(v.votesByGroup))===v.votes,'neighbor evidence')}
  });
 }
 for(const [key,f] of Object.entries(a.fits)){
  need(object(f)&&f.key===key&&Array.isArray(f.indices)&&f.indices.length===f.n&&f.n>0&&f.indices.every((i,k)=>integer(i)&&i<R&&(k===0||f.indices[k-1]<i)),'fit record membership '+key);
  const pp=[...new Set(f.indices.map(i=>records[i].profile))].sort((a,b)=>a-b);
  need(Array.isArray(f.profileIndices)&&same(pp,f.profileIndices)&&Array.isArray(f.profileCoords)&&f.profileCoords.length===pp.length&&f.profileCoords.every(xyz),'fit unique-profile coordinates '+key);
  need(object(f.settings)&&f.settings.backend==='sgd'&&integer(f.settings.seed)&&f.settings.starts===1&&f.settings.epochs>0&&f.settings.metric==='original full-feature Euclidean','fit recipe '+key);
  need(f['relative.error']===null||Number.isFinite(f['relative.error'])&&f['relative.error']>=0,'fit distance error '+key);
  need(object(f.pca)&&object(f.references),'PCA and references '+key);
  const dimensions=['90','95','99'].map(k=>f.pca[k]);need(dimensions.every(x=>x===null)||dimensions.every(x=>integer(x)&&x>=1&&x<=Math.min(bundle.dataset.featureCount,f.n-1))&&dimensions[0]<=dimensions[1]&&dimensions[1]<=dimensions[2],'PCA order '+key);
  for(const [j,r] of Object.entries(f.references)){
   need(fullNodes.has(Number(j))&&r.feature===Number(j)&&r.profile===fullNodes.get(Number(j)).anchor_row&&xyz(r.coords)&&typeof r.method==='string','reference identity '+key);
   const k=pp.indexOf(r.profile);need(r.member===(k>=0),'reference membership '+key);if(k>=0)need(same(r.coords,f.profileCoords[k]),'observed endpoint coordinates '+key);
   need(r.relative_error===null||Number.isFinite(r.relative_error)&&r.relative_error>=0,'projection error '+key);
  }
 }
 for(const cohort of Object.keys(a.populations))for(const mode of ['pure','merged'])for(const q of qs){
  if(cohort==='all'&&mode==='pure')continue;
  const key=`${cohort}|${mode}|${q}`,s=a.specs[key];need(object(s)&&s.cohort===cohort&&s.mode===mode&&s.q===q,'view specification '+key);
  const pop=a.populations[cohort].recordIndices||records.flatMap((r,i)=>cohort==='all'||a.populations[cohort].sourceCohorts.includes(r.cohort)?[i]:[]);
  need(Array.isArray(s.population)&&same(pop,s.population)&&pop.length>0,'exact cohort population '+key);
  need(object(a.fits[s.global])&&same(a.fits[s.global].indices,pop),'cohort global fit '+key);
  const cores=mode==='merged'?a.merged[q].cores:base.graphs[q].edges.map(e=>e.id),labels=mode==='merged'?a.merged[q].pairs:base.samples.pair;
  need(Array.isArray(s.cores)&&same(s.cores,cores)&&object(s.states)&&object(s.vertices),'state catalog '+key);
  const groups=new Map(cores.map(id=>[id,[]]));for(const i of pop)groups.get(labels[records[i].profile])?.push(i);
  const observed=[...groups].filter(([id,ii])=>ii.length>0);need(Object.keys(s.states).length===observed.length,'observed state count '+key);
  const features=[...new Set(observed.flatMap(([id])=>id.split(',').map(Number)))];need(Object.keys(s.vertices).length===features.length,'incident vertex count '+key);
  for(const [id,ii] of observed){const f=a.fits[s.states[id]];need(object(f)&&same(f.indices,ii)&&id.split(',').every(j=>f.references[j]),'exact state fit '+key+' '+id)}
  // Build the same ordered unions once, instead of rescanning every record
  // and splitting its state label separately for every feature.
  const stateFeatures=new Map([...groups.keys()].map(id=>[id,[...new Set(id.split(','))]]));
  const vertexMembers=new Map(features.map(j=>[String(j),[]])),vertexNeighbors=new Map(features.map(j=>[String(j),new Set()]));
  for(const i of pop)for(const j of stateFeatures.get(labels[records[i].profile])||[])vertexMembers.get(j)?.push(i);
  for(const [id] of observed)for(const j of stateFeatures.get(id))for(const v of stateFeatures.get(id))vertexNeighbors.get(j)?.add(v);
  for(const j of features){const ii=vertexMembers.get(String(j)),f=a.fits[s.vertices[j]];need(object(f)&&same(f.indices,ii),'exact vertex-union fit '+key+' '+j);need([...vertexNeighbors.get(String(j))].every(v=>f.references[v]),'vertex endpoint references '+key)}
  need(features.every(j=>a.fits[s.global].references[j]),'overview references '+key);
 }
 return a;
}

// Optional version-2 supplement adds explicit relative time and episode identity.
function validateParticipantSupplement(d,bundle,recordAdapter=null){
 const need=(ok,msg)=>{if(!ok)throw Error('Invalid participant supplement: '+msg)};
 const a=bundle.cohortAnalysis||recordAdapter,finite=Number.isFinite;
 need(d&&[1,2].includes(d.version)&&a&&d.datasetRevision===bundle.dataset.revision&&d.analysisRevision===a.revision,'revision');
 need(Array.isArray(d.features)&&d.features.length===bundle.dataset.featureCount&&new Set(d.features).size===d.features.length,'feature dictionary');
 d.features.forEach((name,j)=>need(name===bundle.data.featureNames[String(j+1)],'feature map'));
 need(Array.isArray(d.records)&&d.compositions&&typeof d.provenance?.auditSha256==='string','ledger and provenance');
 const seen=new Set();
 if(bundle.dataset.fixedPopulation==='rebuilt'){
  const pp=bundle.data.retainedProfileIds,observed=[...new Set(d.records.map(r=>r.profile))].sort((a,b)=>a-b);
  need(d.records.length===24465&&JSON.stringify(observed)===JSON.stringify(pp)&&JSON.stringify(Object.keys(d.compositions).map(Number).sort((a,b)=>a-b))===JSON.stringify(pp),'restricted record/composition population');
 }
 if(recordAdapter){
  need(recordAdapter.datasetRevision===bundle.dataset.revision&&recordAdapter.version===1&&recordAdapter.auditSha256===d.provenance.auditSha256,'record adapter identity');
  need(d.records.length===recordAdapter.records.length,'complete record ledger');
  for(const pop of Object.values(recordAdapter.populations))need(Array.isArray(pop.indices)&&new Set(pop.indices).size===pop.indices.length&&pop.indices.every(i=>Number.isSafeInteger(i)&&i>=0&&i<d.records.length),'record population');
 }
 for(const r of d.records){
  const source=a.records[r.index];need(Number.isSafeInteger(r.index)&&source&&!seen.has(r.index),'record index');seen.add(r.index);
  need(['id','profile','cohort','subject'].every(k=>r[k]===source[k])&&typeof r.specimen==='string'&&typeof r.label==='string'&&typeof r.originalVisit==='string','record identity');
  need(r.order===null||Number.isSafeInteger(r.order)&&r.order>=0,'order');need(Array.isArray(r.flags)&&r.flags.every(x=>typeof x==='string')&&typeof r.timeVerified==='boolean','flags');
  need(r.date===null||typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(Date.parse(r.date+'T00:00:00Z'))&&new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)===r.date,'calendar date');
  if(r.elapsedDays!=null)need(d.version===2&&finite(r.elapsedDays)&&r.timeUnit==='day'&&typeof r.timeOrigin==='string'&&r.timeOrigin.length>0,'relative time');
  need(!r.timeVerified||r.date!==null||finite(r.elapsedDays),'verified time requires a measurement');
  need(r.episode===undefined||typeof r.episode==='string','episode');
  if(recordAdapter){
   need(r.transitionPolicy==='stage-a-allowlist-v1'&&typeof r.orderedEligible==='boolean','eligibility policy');
   for(const field of ['nextRecords','elapsedNextRecords'])need(Array.isArray(r[field])&&new Set(r[field]).size===r[field].length&&r[field].every(i=>Number.isSafeInteger(i)&&d.records[i]&&d.records[i].cohort===r.cohort&&d.records[i].subject===r.subject&&d.records[i].orderedEligible&&r.orderedEligible&&d.records[i].order>r.order),'transition allowlist');
   need(r.elapsedNextRecords.every(i=>r.nextRecords.includes(i)&&r.timeVerified&&d.records[i].timeVerified),'elapsed transition allowlist');
  }
  const c=d.compositions[r.profile];need(Array.isArray(c)&&c.length>0,'full composition');let mass=0,last=-1;
  for(const [j,v] of c){need(Number.isSafeInteger(j)&&j>last&&j<d.features.length&&finite(v)&&v>0,'sparse feature order/value');last=j;mass+=v}need(Math.abs(mass-1)<1e-10,'composition mass');
 }
 return d;
}

// Restricted source bank: null slots preserve historical fit keys without
// retaining excluded observations. Active rows come solely from the record ledger.
function validateRebuiltProfileBank(bundle){
 const need=(ok,msg)=>{if(!ok)throw Error('Invalid rebuilt-reference bank: '+msg)};
 const d=bundle.data,m=bundle.dataset,pp=d.retainedProfileIds;
 const xyz=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
 need(bundle.format==='rank2-explorer-bundle'&&bundle.version===1&&m.id==='comb-V3V4-tx'&&m.fixedPopulation==='rebuilt'&&d.profileBankVersion===1,'identity');
 need(m.recordCount===24465&&m.profileCount===24412&&Array.isArray(pp)&&pp.length===24412&&pp.every((p,i)=>Number.isSafeInteger(p)&&p>=0&&(!i||p>pp[i-1])),'retained population');
 const keep=new Set(pp),s=d.samples,N=s.ids.length;
 need(pp.at(-1)<N&&s.pair.length===N&&s.coords.length===N&&d.sampleTopFeatures.length===N,'profile slots');
 need(Object.keys(d.featureNames).length===m.featureCount,'feature dictionary');
 const ids=new Set(),counts=new Map();
 for(let i=0;i<N;i++){
  if(!keep.has(i)){need(s.ids[i]===null&&s.pair[i]===null&&s.coords[i]===null&&d.sampleTopFeatures[i]===null,'excluded profile data');continue}
  need(typeof s.ids[i]==='string'&&s.ids[i]&&!ids.has(s.ids[i])&&xyz(s.coords[i]),'profile identity/coordinates');ids.add(s.ids[i]);
  need(typeof s.pair[i]==='string'&&/^\d+,\d+$/.test(s.pair[i]),'pure pair');
  const top=d.sampleTopFeatures[i];need(Array.isArray(top)&&top.length>0&&top.length<=4&&top.every(v=>Array.isArray(v)&&typeof v[0]==='string'&&Number.isFinite(v[1])&&v[1]>=0&&v[1]<=100),'top features');
  counts.set(s.pair[i],(counts.get(s.pair[i])||0)+1);
 }
 const g=d.graphs['100'],nodes=new Set(g.nodes.map(n=>n.id)),edges=new Set(g.edges.map(e=>e.id));
 need(nodes.size===g.nodes.length&&edges.size===g.edges.length,'unique graph identities');
 for(const n of g.nodes)need(keep.has(n.anchor_row)&&s.ids[n.anchor_row]===n.anchor_id&&typeof d.featureNames[n.id]==='string'&&Number.isFinite(n.maximum)&&n.maximum>=0&&n.maximum<=100,'retained reference vertex');
 for(const e of g.edges)need(nodes.has(e.from)&&nodes.has(e.to)&&e.from<e.to&&e.id===e.from+','+e.to&&e.frequency===counts.get(e.id)&&Number.isFinite(e.length)&&e.length>=0,'rebuilt reference edge');
 need([...counts.keys()].every(k=>edges.has(k)),'complete pure-state reference');
 for(const q of ['60','70','80','90','100'])need(d.graphs[q]&&d.coords3d[q]?.length===g.nodes.length&&d.coords3d[q].every(xyz),'reference coverage scaffolding');
 for(const key of ['overviewEmbeddings','overviewEndpointProjections','localEmbeddings','endpointProjections','vertexEndpointProjections','pcaDimensions'])need(d[key]&&Object.keys(d[key]).length===0,'historical fits must be absent');
 need(Object.keys(d.vertexEmbeddings.mapping).length===0&&Object.keys(d.vertexEmbeddings.fits).length===0,'historical vertex fits must be absent');
 return bundle;
}
