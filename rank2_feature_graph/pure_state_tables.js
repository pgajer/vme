// Display-only pure-state evidence. Never calculate new geometry or change assignments.
const pureEvidenceCache=new WeakMap();
let pureTableContext='',pureTableSort={key:'default',descending:true},pureTableAll=false,pureTableQuery='',pureTableOptional=false;
let candidateChecked=new Set(),candidateComparison=false,candidateFrame=null,candidatePreviousEmbedding=null;
function pureTableKey(){
 if(selected===null||selectedVertex!==null||participant.active||activeEmbeddingFamily||rank3UsesSamples())return '';
 return JSON.stringify([datasetKey(),el('coverage').value,activeStateMode,selected]);
}
function syncPureTable(){
 const key=pureTableKey();
 if(key!==pureTableContext){pureTableContext=key;pureTableSort={key:'default',descending:true};pureTableAll=false;pureTableQuery='';pureTableOptional=false;candidateChecked=new Set([selected]);candidateComparison=false;candidateFrame=null}
 return key;
}
function pureTableIsCandidate(){return !!syncPureTable()&&(activeStateMode==='pure'||el('coverage').value==='100')}
function pureTablePair(i){return DATA.purePairs?DATA.purePairs[i]:DATA.samples.pair[i]}
function genuineTablePair(id){return typeof id==='string'&&/^\d+,\d+$/.test(id)&&new Set(id.split(',')).size===2}
function pureTableEvidence(){
 let cached=pureEvidenceCache.get(DATA);if(cached)return cached;
 const bundle=datasetRegistry.get(META.id),base=bundle.data,counts=new Map(),indices=new Map(),profiles=new Map();
 for(const i of eligibleIndices()){
  const id=pureTablePair(i),p=DATA.records?.[i]?.profile??i,g=base.geometryProfile?.[p]??p;
  counts.set(id,(counts.get(id)||0)+1);
  if(!indices.has(id)){indices.set(id,[]);profiles.set(id,new Set())}indices.get(id).push(i);profiles.get(id).add(g);
 }
 // A fixed-reference sensitivity population retains the baseline assignment evidence.
 const reference=typeof activeSensitivityMode!=='undefined'&&activeSensitivityMode==='fixed'&&typeof sensitivityBaseline!=='undefined'?sensitivityBaseline.bundle:bundle;
 const a=reference?.cohortAnalysis,refCounts=new Map(),refPairs=reference.data.samples.pair;
 if(a?.records){
  const rr=a.eligibility?a.populations.records?.indices:null;
  if(!a.eligibility||rr)for(const i of rr||a.records.map((_,i)=>i)){const id=refPairs[a.records[i].profile];refCounts.set(id,(refCounts.get(id)||0)+1)}
 }
 const bridgeFor=id=>{
  if(id===selected)return {reason:'Not applicable: seed self-comparison'};
  if(!genuineTablePair(id))return {reason:'Not applicable: no genuine two-taxon pair'};
  const matches=Object.entries(a?.merged||{}).flatMap(([q,m])=>m.bridges?.[id]?.core===selected?[{q,...m.bridges[id]}]:[]);
  if(!matches.length)return {reason:'Unavailable — no stored pairwise bridge evidence. Absence from a winning-bridge ledger does not mean zero support.'};
  const b=matches.find(v=>v.q===el('coverage').value)||matches[0];
  if(matches.some(v=>v.score!==b.score||v.sourceIntersection!==b.sourceIntersection||v.coreIntersection!==b.coreIntersection))return {reason:'Unavailable — stored targets disagree; reference review required'};
  const n=refCounts.get(id),strict=!!a?.combDisplay;
  return {score:b.score,coverage:n?100*b.sourceIntersection/n:null,source:b.sourceIntersection,seed:b.coreIntersection,triple:b.rank3,targets:matches.map(v=>v.q),reason:`Stored winning bridge at ${matches.map(v=>v.q+'%').join(', ')}; ${strict?'record-weighted observed positive-third triples':'historical record-weighted triples; positive-third eligibility not certified here'}.`,referenceCount:n};
 };
 const previousCache=new Map();
 const previousFor=seed=>{if(previousCache.has(seed))return previousCache.get(seed);const prior=new Set();for(const m of Object.values(a?.merged||{}))m.pairs?.forEach((id,p)=>{if(id===seed)prior.add(refPairs[p])});previousCache.set(seed,prior);return prior};
 cached={counts,indices,profiles,refCounts,bridgeFor,previousFor};pureEvidenceCache.set(DATA,cached);return cached;
}
function pureTableRows(candidate,model){
 const evidence=pureTableEvidence(),seed=new Set(String(selected).split(','));
 let rows;
 if(candidate){
  const keys=new Set([...evidence.counts.keys(),...evidence.refCounts.keys()]);
  rows=[...keys].filter(genuineTablePair).map(id=>{
   const shared=id.split(',').some(j=>seed.has(j)),bridge=evidence.bridgeFor(id);
   return {id,n:evidence.counts.get(id)||0,full:evidence.counts.get(id)||0,label:stateDisplayLabel(id),checked:candidateChecked.has(id),shared,previous:evidence.previousFor(selected).has(id),bridge};
  }).filter(r=>r.id===selected||pureTableAll||r.shared||r.previous||r.bridge.score!==undefined);
 }else rows=model.rows.map(r=>({...r,full:evidence.counts.get(r.id)||0,bridge:evidence.bridgeFor(r.id)}));
 for(const r of rows){
  r.profiles=evidence.profiles.get(r.id)?.size||0;r.captured=r.full?100*r.n/r.full:null;r.percent=model?.n?100*r.n/model.n:null;r.routes={};
  if(!candidate)for(const i of evidence.indices.get(r.id)||[])if(DATA.samples.pair[i]===selected){const route=DATA.assignment?.methods?.[DATA.records?.[i]?.profile];const key=['core','rank3','knn'].includes(route)?route:'unavailable';r.routes[key]=(r.routes[key]||0)+1}
 }
 const value=(r,k)=>k==='bridge'?r.bridge.score:k==='coverage'?r.bridge.coverage:r[k];
 rows.sort((a,b)=>{
  if(a.id===selected)return -1;if(b.id===selected)return 1;
  const {key,descending}=pureTableSort;
  if(key==='default')return candidate?(b.bridge.score??-1)-(a.bridge.score??-1)||(b.bridge.coverage??-1)-(a.bridge.coverage??-1)||b.n-a.n||String(a.id).localeCompare(String(b.id),undefined,{numeric:true}):b.n-a.n||String(a.id).localeCompare(String(b.id),undefined,{numeric:true});
  const av=value(a,key),bv=value(b,key);if(av==null&&bv!=null)return 1;if(bv==null&&av!=null)return -1;
  return (typeof av==='string'?av.localeCompare(bv):((av??0)-(bv??0)))*(descending?-1:1)||String(a.id).localeCompare(String(b.id));
 });return rows;
}
const pureDiagnosticColumns=['Contact','Seed-neighbor share','Mutual contact','Reverse contact','Seed share advantage','Distance to seed','Distance / seed spacing','Seed-pair mass','Mass ≥90%','Local angle','Off-axis extent'];
function pureTableNA(reason){return `<span class="pureUnavailable" title="${esc(reason)}">${reason.startsWith('Not applicable')?'—':'Unavailable'}</span>`}
function pureTableCell(row,key){
 const b=row.bridge;
 if(key==='bridge'||key==='coverage')return b[key==='bridge'?'score':'coverage']==null?pureTableNA(b.reason+(key==='coverage'?' Reference denominator may be unavailable.':'')):`<span title="${esc(b.reason)}">${fmt(b[key==='bridge'?'score':'coverage'])}${key==='coverage'?'%':''}</span>`;
 if(key==='contact')return pureTableNA('Not computed — geometric diagnostic study is on hold. k=10, whole-sample endpoint threshold 95%; denominator: eligible nonendpoint reference profiles.');
 if(key==='routes')return Object.entries(row.routes).map(([k,n])=>`${esc(assignmentNames[k]||'Unavailable')}: ${fmt(n)}`).join('<br>');
 return row[key]==null?pureTableNA('Denominator unavailable'):fmt(row[key])+(['percent','captured'].includes(key)?'%':'');
}
function renderPureEvidenceTable(candidate,model=null){
 if(!syncPureTable())return;
 const rows=pureTableRows(candidate,model),shown=rows.filter(r=>r.checked).reduce((n,r)=>n+r.n,0),q=pureTableQuery.toLowerCase(),filtered=rows.filter(r=>(r.label+' '+pairName(r.id)).toLowerCase().includes(q));
 const headers=candidate?[['n',DATA.records?'Records':'Observations','Complete original state in the current counting unit: '+META.observationLabel],['profiles','Profiles','Distinct displayed compositions; duplicates retain separate record counts'],['bridge','Potential bridge','Stored balanced rank-3 support; comparison evidence, not a proposed reassignment'],['coverage','Source triple coverage','Source intersection / entire reference pure-state record count ×100'],['contact','Outside-endpoint contact','Not computed; study on hold']]:[['n','In group','Assigned portion of this pure state in this group'],['percent','% of group','Assigned portion / complete selected group ×100; unchecked rows remain in denominator'],['captured','State captured','Assigned portion / full pure-state size in selected population ×100'],['routes','Assignment route','Stored routes and their counts within this row'],['bridge','Bridge support','Stored balanced rank-3 count; not a normalized overlap index'],['coverage','Source triple coverage','Source intersection / entire reference pure-state record count ×100']];
 const title=candidate?'Pure-state comparison candidates':'Original pure top-2 CSTs in this merged group';
 const noCoords=candidate&&!candidateCoordinatesAvailable(rows);
 const html=`<h3>${title}</h3><p id="mergedComponentCount" role="status">${candidate?'Selected':'Showing'} ${fmt(shown)} ${esc(META.observationLabel)} · ${rows.filter(r=>r.checked).length} of ${rows.length} states${candidate?'':` · ${fmt(model.n)} group records`}. Seed: ${esc(stateDisplayLabel(selected))}.</p>`+
 `<div class="mergedComponentActions"><button data-evidence-all="show" ${candidate&&!candidateComparison?'disabled':''}>Select all</button><button data-evidence-all="hide" ${candidate&&!candidateComparison?'disabled':''}>Clear all</button><input data-evidence-search placeholder="Filter pure-state names" aria-label="Filter pure-state names" value="${esc(pureTableQuery)}"><button data-evidence-export>Export CSV</button>${candidate?`<label><input type="checkbox" data-evidence-catalogue ${pureTableAll?'checked':''}>All pure states</label>`:''}<label><input type="checkbox" data-evidence-diagnostics ${pureTableOptional?'checked':''}>Diagnostic columns</label></div>`+
 (candidate?`<p>${candidateComparison?'Comparison uses one saved reference embedding; camera and bounds stay fixed. <button data-evidence-exit>Return to selected-state view</button>':`Candidates require a common saved reference embedding. The current local view is unchanged until comparison starts. <button data-evidence-compare ${noCoords?'disabled':''}>Compare in reference view</button>`}${noCoords?' Common coordinates unavailable for one or more listed states; no fitting will be started.':''}</p>`:'')+
 `<small>${candidate?'Bridge evidence order by default; the seed stays first.':'Counts are assigned portions; State captured uses the full pure-state denominator.'} Unavailable diagnostics are not zero. Select all / Clear all affect all listed states, including rows hidden by text search.</small>`+
 (META.id==='comb-V3V4-tx'?'<p><button type="button" onclick="openMutualOverlap()">Inspect mutual overlap…</button></p>':'')+
 '<div class="stateBreakdown"><table><thead><tr><th>Show</th><th>Color</th><th><button data-evidence-sort="label">'+(candidate?'Pure state':'Original pure state')+'</button></th>'+headers.map(([key,label,tip])=>`<th title="${esc(tip)}">${['routes','contact'].includes(key)?label:`<button data-evidence-sort="${key}">${label}${pureTableSort.key===key?(pureTableSort.descending?' ↓':' ↑'):''}</button>`}</th>`).join('')+(pureTableOptional?pureDiagnosticColumns.map(label=>`<th>${label}</th>`).join(''):'')+'</tr></thead><tbody>'+filtered.map(r=>`<tr><td><input type="checkbox" data-${candidate?'candidate-pure':'merged-pure'}="${esc(JSON.stringify(r.id))}" ${r.checked?'checked':''} ${candidate&&(!candidateComparison||!r.n)?'disabled':''} aria-label="Show original state ${esc(r.label)}"></td><td><input type="color" data-merged-color="${esc(JSON.stringify(r.id))}" value="${edgeColor(r.id)}" aria-label="Color original state ${esc(r.label)}" ${!genuineTablePair(r.id)?'disabled':''}></td><td><details><summary title="${esc(pairName(r.id))}">${esc(r.label)}${r.id===selected?' (seed)':''}</summary><p>Full selected state: ${fmt(r.full)} ${esc(META.observationLabel)}; ${r.profiles} distinct profiles. Reference records: ${evidenceReferenceText(r.id)}.</p><p>${esc(r.bridge.reason)}${r.bridge.score==null?'':` Triple ${esc(r.bridge.triple)}; source ${fmt(r.bridge.source)}, seed ${fmt(r.bridge.seed)}.`}</p>${candidate?`<p>Nomination: ${r.id===selected?'selected seed':r.shared?'shared seed taxon':r.previous?'previously assigned to seed':r.bridge.score!==undefined?'stored bridge to seed':'All pure states'}. Reference-only rows have no selectable records in this population.</p>`:''}</details></td>${headers.map(([key])=>`<td>${pureTableCell(r,key)}</td>`).join('')}${pureTableOptional?pureDiagnosticColumns.map(()=>`<td>${pureTableNA('Not computed — diagnostic study on hold')}</td>`).join(''):''}</tr>`).join('')+'</tbody></table></div>';
 el('inspector').innerHTML=`<section id="mergedComponentTable" style="white-space:normal">${html}</section>`+el('inspector').innerHTML;
 if(candidateComparison&&candidate)for(const id of ['scope','sampleEmbedding','panelSampleEmbedding'])el(id).disabled=true;
}
function evidenceReferenceText(id){const n=pureTableEvidence().refCounts.get(id);return n==null?'unavailable':fmt(n)}
function candidateCoordinates(){return DATA.referenceCoords||DATA.samples.coords}
function candidateCoordinatesAvailable(rows){const coords=candidateCoordinates();return rows.every(r=>(pureTableEvidence().indices.get(r.id)||[]).every(i=>Array.isArray(coords?.[i])&&coords[i].length===3&&coords[i].every(Number.isFinite)))}
function candidateActive(){return pureTableIsCandidate()&&candidateComparison}
function retainCandidateFrame(){if(!candidateActive())return;const scene=exportScene(el('samples'));candidateFrame={};for(const p of ['aspectmode','aspectratio','xaxis','yaxis','zaxis'])if(scene[p])candidateFrame[p]=copyCamera(scene[p])}
function candidateSamples(){
 const rows=pureTableRows(true),indices=rows.filter(r=>r.checked).flatMap(r=>pureTableEvidence().indices.get(r.id)||[]),coords=candidateCoordinates(),z=indices.map(i=>coords[i]);
 el('scope').disabled=true;el('sampleEmbedding').disabled=true;el('panelSampleEmbedding').disabled=true;
 updateSampleContext(indices);el('sampleTitle').textContent=samplePanelTitle(standardSampleEmbeddingTitle('Saved reference 3D MDS'),stateDisplayLabel(selected)+' · pure-state comparison');
 el('sampleContext').innerHTML=`<strong>Pure-state comparison</strong><br>Seed: ${esc(stateDisplayLabel(selected))}<br>Plotted: ${esc(sampleCounts(indices))}<br>One saved reference embedding; selected candidates do not change assignments.`;
 el('sampleStatus').textContent='Pure-state comparison in one saved reference embedding. Checkboxes change visibility only; assignments and coordinates are unchanged. Diagnostic study on hold.';
 const selectedRows=rows.filter(r=>r.checked);el('sampleLegend').hidden=false;el('sampleLegendItems').innerHTML=selectedRows.map(r=>`<span class="legendItem"><span class="colorSwatch" style="background:${edgeColor(r.id)}"></span>${esc(r.label)} · ${fmt(r.n)}</span>`).join('');renderStateColors(selectedRows.map(r=>({kind:'pair',id:r.id,label:r.label})));
 if(typeof rank3!=='undefined'&&rank3.enabled&&rank3.color==='rank3')rank3Legend(indices);
 const anchors=current().nodes.filter(n=>String(selected).split(',').includes(String(n.id))&&!n.externalReference&&coords[n.anchor_row]);
 const traces=[{type:'scatter3d',mode:'markers',x:z.map(p=>p[0]),y:z.map(p=>p[1]),z:z.map(p=>p[2]),ids:indices.map(String),customdata:indices.map(i=>pureTablePair(i)),meta:{sampleView:sampleViewKey()},text:indices.map(i=>samplePlotHover(i)),marker:{size:2,color:indices.map(i=>sampleDisplayColor(i,edgeColor(pureTablePair(i)))),opacity:.7},hovertemplate:'%{text}<extra></extra>',showlegend:false},
 {type:'scatter3d',mode:'markers+text',meta:{referenceVertices:true},x:anchors.map(n=>coords[n.anchor_row][0]),y:anchors.map(n=>coords[n.anchor_row][1]),z:anchors.map(n=>coords[n.anchor_row][2]),text:anchors.map(n=>n.label),textposition:'top center',marker:{symbol:'diamond',size:8,color:'#24414c'},hovertemplate:'%{text}<extra></extra>',showlegend:false}];
 // Fix bounds on the complete display population, not the current checkbox subset.
 if(!candidateFrame){const all=eligibleIndices().map(i=>coords[i]).filter(p=>p?.every(Number.isFinite));candidateFrame={aspectmode:'data'};['xaxis','yaxis','zaxis'].forEach((key,j)=>{let lo=Infinity,hi=-Infinity;for(const p of all){lo=Math.min(lo,p[j]);hi=Math.max(hi,p[j])}const pad=(hi-lo||1)*.04;candidateFrame[key]={visible:false,autorange:false,range:[lo-pad,hi+pad]}})}
 return renderSamplePlot(traces,{margin:{l:0,r:0,b:0,t:0},uirevision:pureTableContext+'-comparison',scene:{...candidateFrame,dragmode:'orbit',...(pendingSampleCamera?{camera:copyCamera(pendingSampleCamera)}:{})}},{responsive:true,scrollZoom:true,displayModeBar:false});
}
function pureEvidenceRefresh(){const camera=readCamera('samples');retainMergedComponentFrame();retainCandidateFrame();inspect();return refreshSamples(camera)}
function pureEvidenceChange(event){
 const t=event.target,d=t.dataset;
 if(d.evidenceCatalogue!==undefined){pureTableAll=t.checked;inspect();if(candidateActive())return refreshSamples(readCamera('samples'));return true}
 if(d.evidenceDiagnostics!==undefined){pureTableOptional=t.checked;inspect();return true}
 if(d.candidatePure!==undefined){if(!candidateActive())return true;const id=JSON.parse(d.candidatePure);if(t.checked)candidateChecked.add(id);else candidateChecked.delete(id);pureEvidenceRefresh();return true}
 if(d.mergedColor!==undefined&&pureTableIsCandidate()){retainCandidateFrame();setStateColor('pair',JSON.parse(d.mergedColor),t.value);return true}
 return false;
}
function pureEvidenceClick(event){
 const b=event.target.closest('[data-evidence-all],[data-evidence-sort],[data-evidence-compare],[data-evidence-exit],[data-evidence-export]');if(!b)return false;
 if(b.dataset.evidenceSort!==undefined){const key=b.dataset.evidenceSort;pureTableSort={key,descending:pureTableSort.key===key?!pureTableSort.descending:key!=='label'};inspect()}
 else if(b.dataset.evidenceExit!==undefined){const camera=readCamera('samples');candidateComparison=false;candidateChecked=new Set([selected]);candidateFrame=null;if(candidatePreviousEmbedding)el('sampleEmbedding').value=candidatePreviousEmbedding;inspect();refreshSamples(camera)}
 else if(b.dataset.evidenceCompare!==undefined){const camera=readCamera('samples');if(candidateCoordinatesAvailable(pureTableRows(true))){candidatePreviousEmbedding=el('sampleEmbedding').value;el('sampleEmbedding').value=DATA.referenceCoords?'reference':'global';candidateComparison=true;inspect();refreshSamples(camera)}}
 else if(b.dataset.evidenceAll!==undefined){const checked=b.dataset.evidenceAll==='show';if(pureTableIsCandidate()){if(!candidateActive())return true;for(const r of pureTableRows(true)){if(checked&&r.n)candidateChecked.add(r.id);else candidateChecked.delete(r.id)}pureEvidenceRefresh()}else setAllMergedComponents(checked)}
 else exportPureEvidence();return true;
}
function exportPureEvidence(){
 const candidate=pureTableIsCandidate(),model=candidate?null:mergedComponentModel(),rows=pureTableRows(candidate,model).filter(r=>(r.label+' '+pairName(r.id)).toLowerCase().includes(pureTableQuery.toLowerCase()));
 const csv=[['dataset','population','target_percent','mode','seed_pair','pure_pair','label','color','shown','display_records','full_pure_records','profiles','percent_group','percent_state_captured','assignment_routes','stored_bridge_count','source_triple_percent','bridge_status','geometry_status'],...rows.map(r=>[META.id,META.populationName||'all',el('coverage').value,candidate?'pure comparison':'merged component',selected,r.id,r.label,edgeColor(r.id),r.checked,r.n,r.full,r.profiles,candidate?'':r.percent,candidate?'':r.captured,JSON.stringify(r.routes),r.bridge.score??'',r.bridge.coverage??'',r.bridge.reason,'unavailable: not computed; study on hold'])].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=META.id+'_pure_state_evidence.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
el('inspector').addEventListener('input',e=>{if(e.target.dataset.evidenceSearch===undefined)return;const input=e.target,position=input.selectionStart;pureTableQuery=input.value;inspect();const next=el('inspector').querySelector('[data-evidence-search]');next?.focus();next?.setSelectionRange(position,position)});

// Pure core/non-core inspection uses one saved population coordinate system.
let pureCoverageComparison=null;
function pureNonCorePreference(){try{return (typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).getItem('vme-pure-non-core-v1')==='true'}catch{return false}}
function savePureNonCorePreference(value){try{(typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).setItem('vme-pure-non-core-v1',String(value))}catch{}}
function pureCoverageFrame(scene=exportScene(el('samples'))){
 const frame={};if(['auto','cube','data','manual'].includes(scene.aspectmode))frame.aspectmode=scene.aspectmode;
 if(scene.aspectratio)frame.aspectratio=Object.fromEntries(['x','y','z'].map(k=>[k,scene.aspectratio[k]]));
 for(const axis of ['xaxis','yaxis','zaxis'])if(scene[axis]?.range)frame[axis]={visible:false,autorange:false,range:[...scene[axis].range]};
 return frame;
}
function capturePureCoverage(){return pureCoverageActive()?{nonCore:pureCoverageComparison.nonCore,frame:pureCoverageFrame()}:null}
function validatePureCoverage(value,view){
 if(value==null)return;
 const s=view.selection,f=value.frame;
 if(typeof value.nonCore!=='boolean'||view.stateMode!=='pure'||view.neighborhood||s?.participant?.active||s?.rank3?.enabled||s?.selected!==null||s?.selectedVertex!==null||!f||typeof f!=='object'||Array.isArray(f))throw Error('Invalid saved pure core/non-core comparison.');
 if(f.aspectmode!==undefined&&!['auto','cube','data','manual'].includes(f.aspectmode))throw Error('Invalid saved pure comparison aspect mode.');
 if(f.aspectratio!==undefined&&(!f.aspectratio||!['x','y','z'].every(k=>typeof f.aspectratio[k]==='number'&&Number.isFinite(f.aspectratio[k])&&f.aspectratio[k]>0)))throw Error('Invalid saved pure comparison aspect ratio.');
 for(const axis of ['xaxis','yaxis','zaxis'])if(f[axis]!==undefined&&(!Array.isArray(f[axis]?.range)||f[axis].range.length!==2||!f[axis].range.every(v=>typeof v==='number'&&Number.isFinite(v))||f[axis].range[0]>=f[axis].range[1]))throw Error('Invalid saved pure comparison bounds.');
}
function restorePureCoverage(value){
 // Legacy views have no comparison field and retain their original overview.
 savePureNonCorePreference(value?.nonCore===true);
 pureCoverageComparison=value?{key:pureCoverageKey(),nonCore:value.nonCore,frame:pureCoverageFrame(value.frame)}:null;
}
function pureCoverageAvailable(){return activeStateMode==='pure'&&!participant.active&&!activeEmbeddingFamily&&!hasSelection()&&!rank3UsesSamples()}
function pureCoverageKey(){return datasetKey()+'|'+el('coverage').value}
function pureCoverageActive(){return pureCoverageAvailable()&&pureCoverageComparison?.key===pureCoverageKey()}
function syncPureCoverageControls(){
 const available=pureCoverageAvailable();if(!available||pureCoverageComparison?.key!==pureCoverageKey())pureCoverageComparison=null;
 if(available&&!pureCoverageComparison&&pureNonCorePreference())pureCoverageComparison={key:pureCoverageKey(),nonCore:true,frame:{}};
 if(pureCoverageActive()){
  if(DATA.referenceCoords)el('sampleEmbedding').value=el('panelSampleEmbedding').value='reference';
  else for(const id of ['sampleEmbedding','panelSampleEmbedding'])if(el(id).options?.[0])el(id).options[0].textContent='Core/non-core · fixed reference';
 }
 for(const prefix of ['', 'panel']){const id=prefix?'panelPureNonCore':'pureNonCore',box=el(id);el(id+'Control').hidden=activeStateMode!=='pure'||!!activeEmbeddingFamily;box.disabled=!available;box.checked=!!(pureCoverageActive()&&pureCoverageComparison.nonCore)}
}
function pureCoveragePartition(){
 const core=new Set(DATA.graphs[el('coverage').value].edges.map(e=>e.id)),known=new Set(datasetRegistry.get(META.id).data.graphs['100'].edges.map(e=>e.id));
 const result={core:[],nonCore:[],unpaired:[]};
 for(const i of eligibleIndices()){const pair=DATA.samples.pair[i];result[core.has(pair)?'core':known.has(pair)?'nonCore':'unpaired'].push(i)}
 return result;
}
function changePureCoverage(nonCore){
 if(!pureCoverageAvailable())return;
 const camera=readCamera('samples'),frame=pureCoverageFrame();
 // Keep the current camera and frame while switching the displayed record set.
 savePureNonCorePreference(!!nonCore);
 pureCoverageComparison={key:pureCoverageKey(),nonCore:!!nonCore,frame};
 if(DATA.referenceCoords)el('sampleEmbedding').value=el('panelSampleEmbedding').value='reference';
 else for(const id of ['sampleEmbedding','panelSampleEmbedding'])if(el(id).options?.[0])el(id).options[0].textContent='Core/non-core · fixed reference';
 return refreshSamples(camera);
}
function pureCoverageSamples(){
 const parts=pureCoveragePartition(),nonCore=pureCoverageComparison.nonCore,ii=nonCore?parts.nonCore:parts.core,coords=DATA.referenceCoords||DATA.samples.coords,z=ii.map(i=>coords[i]);
 const label=nonCore?'Non-core pure states':'Core pure states',stateCount=new Set(ii.map(i=>DATA.samples.pair[i])).size;
 el('scope').value='core';el('scope').disabled=true;
 // Both sides use saved full-reference coordinates, not separate fitted embeddings.
 el('sampleTitle').textContent=samplePanelTitle(standardSampleEmbeddingTitle('Reference 3D MDS'),label);
 el('sampleStatus').textContent=`${fmt(ii.length)} ${META.observationLabel} in ${fmt(stateCount)} original pure states at ${el('coverage').value}% reference coverage. Core: ${fmt(parts.core.length)}; non-core: ${fmt(parts.nonCore.length)}; without a catalogued pair: ${fmt(parts.unpaired.length)} (not plotted). Saved full-reference coordinates; no refitting or reassignment.${ii.length?'':' No samples in this category.'} The checkbox choice is remembered for this dataset and restored in the pure-state overview.`;
 renderSampleLegend(nonCore?[]:current().edges);
 if(nonCore){renderStateColors([]);el('sampleLegend').hidden=false;el('sampleLegend').setAttribute('aria-label','Non-core sample color legend');el('sampleLegendItems').innerHTML='<span class="legendItem"><span class="colorSwatch" style="background:#a8adb2"></span>Non-core pure-state samples</span>'}
 updateSampleContext(ii);
 el('sampleContext').innerHTML=`<strong>${label}</strong><br>${esc(META.title)} · ${esc(META.populationName||'Full dataset')}<br>Plotted: ${esc(sampleCounts(ii))}<br>Reference state target: ${el('coverage').value}% · ${fmt(ii.length)} of ${fmt(eligibleIndices().length)} selected ${esc(META.observationLabel)}. Assignments unchanged.`;
 const annotations=current().nodes.filter(n=>coords[n.anchor_row]).map(n=>{const p=coords[n.anchor_row];return {x:p[0],y:p[1],z:p[2],text:esc(n.label),name:'endpoint-vertex:'+n.id,showarrow:false,xshift:10,yshift:10,font:{size:12,color:'#24414c'}}});
 return renderSamplePlot([{type:'scatter3d',mode:'markers',x:z.map(p=>p[0]),y:z.map(p=>p[1]),z:z.map(p=>p[2]),meta:{sampleView:sampleViewKey()},ids:ii.map(String),customdata:ii.map(i=>DATA.samples.pair[i]),text:samplePlotHovers(ii),marker:{size:2,color:nonCore?'#a8adb2':ii.map(i=>sampleDisplayColor(i,edgeColor(DATA.samples.pair[i]))),opacity:.7},hovertemplate:'%{text}<extra></extra>',showlegend:false}],{margin:{l:0,r:0,t:0,b:0},uirevision:datasetKey()+'-pure-coverage-comparison',showlegend:false,scene:{dragmode:'orbit',aspectmode:'data',xaxis:{visible:false},yaxis:{visible:false},zaxis:{visible:false},...pureCoverageComparison.frame,...(pendingSampleCamera?{camera:copyCamera(pendingSampleCamera)}:{}),annotations}},{responsive:true,scrollZoom:true,displayModeBar:false});
}
