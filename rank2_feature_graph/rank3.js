// Rank-3 display layer. Membership comes from frozen, ordered top-feature lists.
// No assignments, source arrays, reference endpoints or fitted coordinates change.
const rank3Cache=new WeakMap(),rank3PopulationCache=new WeakMap();
// Reuse the same numeric ordering without constructing a collator per comparison.
const rank3IdOrder=new Intl.Collator(undefined,{numeric:true});
let rank3={enabled:false,mode:'count',threshold:50,basis:'reference',color:'rank3',background:false,selected:[],vertex:null};
let rank3Sort={key:'frequency',descending:true},rank3Colors={};
function rank3Base(bundle=datasetRegistry.get(META.id)){
 if(rank3Cache.has(bundle))return rank3Cache.get(bundle);
 const d=bundle.data,normalize=s=>s.replaceAll('_',' '),names=new Map(),nodes=new Map(displayGraph(d.graphs['100'],d).nodes.map(n=>[n.id,n]));
 for(const [id,name] of Object.entries(d.featureNames)){
  const key=normalize(name);if(names.has(key))throw Error('Ambiguous feature names prevent rank-3 membership validation.');names.set(key,Number(id));
 }
 const groups=new Map(),membership=[],excluded=[],tied=[],eligible=bundle.cohortAnalysis?.eligibility?new Set(bundle.cohortAnalysis.eligibleProfiles):null;
 d.sampleTopFeatures.forEach((top,i)=>{
  if(eligible&&!eligible.has(i)){membership.push(null);return}
  const ids=top.slice(0,3).map(([name])=>names.get(normalize(name)));
  if(ids.some(id=>id===undefined)||new Set(ids).size!==ids.length)throw Error('Unrecognized rank-3 feature identity.');
  if(ids.length>=2&&ids.slice(0,2).sort((a,b)=>a-b).join(',')!==d.samples.pair[i])throw Error('Rank-3 ordering disagrees with the frozen leading pair.');
  if(top.some((v,k)=>!Number.isFinite(v[1])||v[1]<0||(k&&v[1]>top[k-1][1])))throw Error('Invalid frozen abundance ordering.');
  if(ids.length<3||top[2][1]<=0){membership.push(null);excluded.push(i);return}
  const id=ids.sort((a,b)=>a-b).join(',');membership.push(id);
  if(top.length>3&&top[2][1]===top[3][1])tied.push(i);
  if(!groups.has(id))groups.set(id,{id,features:ids,label:ids.map(j=>nodes.get(j)?.label||taxonDisplayLabel(d.featureNames[j])).join(' + '),profiles:[]});
  groups.get(id).profiles.push(i);
 });
 const rows=[...groups.values()].sort((a,b)=>rank3IdOrder.compare(a.id,b.id));rows.forEach((r,i)=>r.key='T'+(i+1));
 const result={membership,excluded,tied,rows,byId:new Map(rows.map(r=>[r.id,r]))};rank3Cache.set(bundle,result);return result;
}
function rank3Profile(i){return DATA.records?DATA.records[i].profile:i}
function rank3Id(i){return rank3Base().membership[rank3Profile(i)]}
function rank3Population(){
 let cached=rank3PopulationCache.get(DATA);
 if(!cached){
  const b=rank3Base(),population=eligibleIndices(),reference=DATA.samples.ids.map((_,i)=>i);
  const counts=indices=>{const m=new Map();for(const i of indices){const id=b.membership[rank3Profile(i)];if(id)m.set(id,(m.get(id)||0)+1)}return m};
  cached={population,reference,local:counts(population),ref:counts(reference)};rank3PopulationCache.set(DATA,cached);
 }
 const {population,reference,local,ref}=cached,basis=rank3.basis==='reference'?ref:local,N=rank3.basis==='reference'?reference.length:population.length;
 const rows=rank3Base().rows.map(r=>({...r,frequency:local.get(r.id)||0,referenceCount:ref.get(r.id)||0,basisCount:basis.get(r.id)||0,percent:N?100*(basis.get(r.id)||0)/N:0}));
 return {rows,N,population,reference,basisName:rank3.basis==='reference'?'Full reference dataset':META.populationName||'Full reference dataset'};
}
function rank3Retained(rows,N,mode,threshold){
 if(mode==='count')return rows.filter(r=>r.basisCount>=threshold&&r.basisCount>0);
 if(mode==='percent')return rows.filter(r=>r.basisCount>0&&r.percent>=threshold);
 const sorted=rows.filter(r=>r.basisCount>0).slice().sort((a,b)=>b.basisCount-a.basisCount||rank3IdOrder.compare(a.id,b.id));
 if(threshold<=0)return [];
 let sum=0,cutoff=Infinity;for(const r of sorted){sum+=r.basisCount;cutoff=r.basisCount;if(100*sum>=threshold*N-1e-9)break}
 return sorted.filter(r=>r.basisCount>=cutoff);
}
function rank3View(){
 const p=rank3Population(),retained=rank3Retained(p.rows,p.N,rank3.mode,rank3.threshold),rows=retained.filter(r=>r.frequency>0);
 const selected=new Set(rank3.selected),active=rank3.vertex!==null||selected.size>0;
 const isSelected=r=>rank3.vertex!==null?r.features.includes(rank3.vertex):selected.has(r.id);
 return {...p,retained,rows,active,isSelected,selected:rows.filter(isSelected)};
}
function rank3HasSelection(){return rank3.enabled&&(rank3.selected.length>0||rank3.vertex!==null)}
function rank3UsesSamples(){return rank3.enabled&&(rank3HasSelection()||selected===null&&selectedVertex===null)}
function rank3Color(id,dataset=META.id){
 if(!id)return '#a7b2b7';const custom=rank3Colors[dataset+'|'+id];if(/^#[0-9a-f]{6}$/i.test(custom||''))return custom;
 let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;
 return `hsl(${hash*137.508%360},62%,43%)`;
}
function sampleDisplayColor(i,fallback){const color=rank3.enabled&&rank3.color==='rank3'?rank3Color(rank3Id(i)):fallback;return typeof valenciaSampleColor==='function'?valenciaSampleColor(i,color):color}
function rank3Snapshot(){return {...rank3,selected:[...rank3.selected]}}
function rank3Restore(value){rank3=value?{...value,selected:[...value.selected]}:{...rank3,enabled:false,selected:[],vertex:null};el('catalogueKind').value=rank3.enabled?'faces':'edges';syncRank3Controls()}
function rank3FaceSelected(r){if(edgeFacesActive())return edgeFaces.focused===r.id;return rank3.vertex!==null?r.features.includes(rank3.vertex):rank3.selected.includes(r.id)}
function rank3Clear(){edgeFacesReset();rank3.selected=[];rank3.vertex=null}
function rank3Refresh(){
 syncRank3Controls();graph(readCamera('graph3d'));inspect();table();return refreshSamples(activeEmbeddingFamily?familyCamera():readCamera('samples'));
}
function selectRank3(id,add=false){
 if(edgeFacesActive())return focusEdgeFace(id);
 if(!rank3View().rows.some(r=>r.id===id))return;
 rememberSelection();if(add&&rank3.vertex!==null)rank3.selected=rank3View().selected.map(r=>r.id);selected=null;selectedVertex=null;hiddenEdges=new Set();rank3.vertex=null;
 rank3.selected=add?(rank3.selected.includes(id)?rank3.selected.filter(s=>s!==id):[...rank3.selected,id]):[id];
 el('catalogueKind').value='faces';return rank3Refresh();
}
function selectRank3Vertex(id){rememberSelection();selected=null;selectedVertex=null;rank3.selected=[];rank3.vertex=id;el('catalogueKind').value='faces';return rank3Refresh()}
function rank3SelectionControls(){
 el('sampleEmbedding').value=DATA.referenceCoords?'reference':'global';el('scope').value=rank3HasSelection()?'selected':'core';el('scope').options[0].textContent='Selected top-3 CSTs';syncSampleSelectors();
 for(const id of ['sampleEmbedding','panelSampleEmbedding','scope'])el(id).disabled=true;
 for(const id of ['headerClearSelection'])el(id).disabled=!rank3HasSelection();
 for(const id of ['headerBackSelection'])el(id).disabled=selectionHistory.length===0;
 for(const id of ['headerForwardSelection'])el(id).disabled=selectionFuture.length===0;
}
function rank3Inspect(){
 rank3SelectionControls();const v=rank3View(),rows=v.active?v.selected:v.rows,n=rows.reduce((s,r)=>s+r.frequency,0);
 el('edgeSelect').value='';
 el('inspector').innerHTML=`<p><b>${v.active?'Selected top-3 CSTs':'Displayed top-3 CSTs'}</b><br>${rows.length} triples · ${fmt(n)} ${esc(META.observationLabel)} in ${esc(META.populationName||'the full reference dataset')}.</p><p>Membership is the original unordered leading triple, independent of rank-2 coverage and merged groups. Click a face or row to select one; use catalogue checkboxes to combine states. Sample coordinates use the saved full-reference embedding, without refitting.</p>`+rows.map(r=>`<div><span class="colorSwatch" style="background:${rank3Color(r.id)}"></span> ${esc(r.key+': '+r.label)} · ${fmt(r.frequency)}</div>`).join('');
}
function rank3Legend(indices){
 const ids=new Set(indices.map(rank3Id)),base=rank3Base();el('sampleLegend').hidden=false;
 renderStateColors(tripleColorEntries([...ids].filter(Boolean).map(id=>base.byId.get(id))));
 el('sampleLegendItems').innerHTML=[...ids].map(id=>`<span class="legendItem"><span class="colorSwatch" style="background:${rank3Color(id)}"></span>${esc(id?base.byId.get(id).key+': '+base.byId.get(id).label:'Fewer than three positive taxa')}</span>`).join('');
}
function rank3Samples(){
 const v=rank3View(),rows=v.active?v.selected:v.rows,ids=new Set(rows.map(r=>r.id));
 const members=v.population.filter(i=>ids.has(rank3Id(i))),ii=rank3.background?v.population:members,memberSet=new Set(members),b=datasetRegistry.get(META.id).data;
 const corrected=!!datasetRegistry.get(META.id).cohortAnalysis?.eligibility;
 const z=ii.map(i=>corrected?DATA.referenceCoords[i]:b.samples.coords[rank3Profile(i)]);
 const colors=ii.map(i=>memberSet.has(i)?sampleDisplayColor(i,edgeColor(DATA.samples.pair[i])):'#d5dce0');
 updateSampleContext(ii);
 el('sampleTitle').textContent=samplePanelTitle(standardSampleEmbeddingTitle('Population 3D MDS (restricted)'),(v.active?'Selected':'Displayed')+' top-3 CSTs');
 el('sampleContext').innerHTML=`<strong>${rows.length} ${v.active?'selected':'displayed'} top-3 CSTs</strong><br>${esc(META.title)} · ${esc(META.populationName||'Full reference dataset')}<br>Members: ${esc(sampleCounts(members))}<br>Plotted: ${fmt(ii.length)} ${esc(META.observationLabel)}${rank3.background?' (nonmembers dimmed)':''}<br>Independent of rank-2 coverage; no sample refitting.`;
 el('sampleStatus').textContent='Saved full-reference sample coordinates, restricted by original top-three membership. Repeated records retain their identities. No new local fit; triangle area is not a measure of sample abundance.';
 if(rank3.color==='rank3')rank3Legend(members);else {const pairs=new Set(members.map(i=>DATA.samples.pair[i])),edges=new Map([...displayGraph(b.graphs['100'],b).edges,...current().edges].map(e=>[e.id,e]));renderSampleLegend([...pairs].map(id=>edges.get(id)).filter(Boolean))}
 return renderSamplePlot([{type:'scatter3d',mode:'markers',ids:ii.map(String),customdata:ii.map(i=>'face:'+rank3Id(i)),meta:{sampleView:sampleViewKey()},x:z.map(p=>p[0]),y:z.map(p=>p[1]),z:z.map(p=>p[2]),text:ii.map(i=>samplePlotHover(i)),marker:{size:ii.map(i=>memberSet.has(i)?3:1.5),color:colors,opacity:.7},hovertemplate:'%{text}<extra></extra>'}],{margin:{l:0,r:0,t:0,b:0},showlegend:false,uirevision:datasetKey()+'-rank3-reference',scene:{...(pendingSampleCamera?{camera:copyCamera(pendingSampleCamera)}:{}),aspectmode:'data',dragmode:'orbit',xaxis:{visible:false},yaxis:{visible:false},zaxis:{visible:false}}},{responsive:true,scrollZoom:true,displaylogo:false,displayModeBar:false});
}
// Extend the current display only. Missing vertices get explicitly schematic positions.
// Offsets avoid coincident supplementary vertices; they carry no metric meaning.
function rank3Geometry(g,lookup){
 if(!rank3.enabled&&!edgeFacesActive())return {g,lookup,faces:[],supplemental:new Set()};
 const v=edgeFacesActive()?edgeFacesView():rank3View(),candidates=v.rows,faces=edgeFacesActive()?candidates.filter(r=>edgeFaces.checked.includes(r.id)):candidates,base=datasetRegistry.get(META.id).data,known=new Map(current().nodes.map(n=>[n.id,n])),nodes=new Map(g.nodes.map(n=>[n.id,n])),supplemental=new Set();
 const coords=new Map(lookup),all=[...lookup.values()],center=[0,1,2].map(j=>all.length?all.reduce((s,p)=>s+p[j],0)/all.length:0),span=Math.max(1,...[0,1,2].map(j=>all.length?Math.max(...all.map(p=>p[j]))-Math.min(...all.map(p=>p[j])):1));
 const needed=[...new Set(candidates.flatMap(r=>r.features))].sort((a,b)=>a-b),neighbors=new Map();
 // Reference memberships make placement stable when face thresholds change.
 for(const r of rank3Base().rows)for(const id of r.features){if(!neighbors.has(id))neighbors.set(id,new Map());for(const other of r.features)if(id!==other)neighbors.get(id).set(other,(neighbors.get(id).get(other)||0)+r.profiles.length)}
 for(const id of needed){
  if(!coords.has(id)){
   const near=[...(neighbors.get(id)||[])].filter(([j])=>lookup.has(j)),weight=near.reduce((s,[,w])=>s+w,0),c=weight?[0,1,2].map(k=>near.reduce((s,[j,w])=>s+lookup.get(j)[k]*w,0)/weight):center;
   const angle=id*2.399963229728653,r=span*(weight?.07:.65),offset=[Math.cos(angle),Math.sin(angle),Math.sin(angle*.713)];coords.set(id,c.map((x,j)=>x+r*offset[j]));supplemental.add(id);
  }
  if(!nodes.has(id))nodes.set(id,known.get(id)||{id,label:taxonDisplayLabel(base.featureNames[id]),supplemental:true});
 }
 return {g:{...g,nodes:[...nodes.values()]},lookup:coords,faces,supplemental};
}
function graphGeometry(){return degreeFilteredGeometry(rank3Geometry(displayedGraph(),graphLayoutCoordinates()))}
function graphNodeLabelVisible(n){return !edgeFacesActive()||!n.supplemental||edgeFaces.checked.some(id=>rank3Base().byId.get(id)?.features.includes(n.id))}
function graphNodeLabel(n){return n.maximum===undefined?n.label+' [supplementary]':`${n.label} (${fmt(n.maximum)}%)`}
function rank3Traces(geometry){
 const {faces,lookup}=geometry;if(!faces.length)return [];
 const v=edgeFacesActive()?{active:!!edgeFaces.focused,isSelected:r=>r.id===edgeFaces.focused}:rank3View(),traces=[];
 for(const active of [false,true]){
  const rows=faces.filter(r=>v.active&&v.isSelected(r)?active:!active),pts=rows.flatMap(r=>r.features.map(id=>lookup.get(id)));
  if(!rows.length)continue;
  traces.push({type:'mesh3d',x:pts.map(p=>p[0]),y:pts.map(p=>p[1]),z:pts.map(p=>p[2]),i:rows.map((_,i)=>3*i),j:rows.map((_,i)=>3*i+1),k:rows.map((_,i)=>3*i+2),facecolor:rows.map(r=>rank3Color(r.id)),opacity:active?.55:.16,flatshading:true,customdata:rows.flatMap(r=>Array(3).fill('face:'+r.id)),text:rows.flatMap(r=>Array(3).fill(`${esc(r.key+': '+r.label)}<br>${r.frequency} ${esc(META.observationLabel)} in current population<br>${fmt(r.percent)}% of ${edgeFacesActive()?'current population':'filter population'}`)),hovertemplate:'%{text}<extra></extra>',showscale:false});
 }
 const edges=new Set(current().edges.map(e=>e.id)),lines=[],ids=[];
 for(const r of faces)for(const [a,b] of [[0,1],[0,2],[1,2]])if(!edges.has([r.features[a],r.features[b]].sort((a,b)=>a-b).join(','))){lines.push(lookup.get(r.features[a]),lookup.get(r.features[b]),[null,null,null]);ids.push('face:'+r.id,'face:'+r.id,null)}
 traces.push({type:'scatter3d',mode:'lines',x:lines.map(p=>p[0]),y:lines.map(p=>p[1]),z:lines.map(p=>p[2]),customdata:ids,line:{color:'#aaa',width:2,dash:'dash'},hoverinfo:'skip',showlegend:false});
 const mid=faces.map(r=>[0,1,2].map(k=>r.features.reduce((s,id)=>s+lookup.get(id)[k],0)/3));
 traces.push({type:'scatter3d',mode:'markers',x:mid.map(p=>p[0]),y:mid.map(p=>p[1]),z:mid.map(p=>p[2]),customdata:faces.map(r=>'face:'+r.id),text:faces.map(r=>`${esc(r.key+': '+r.label)}<br>n=${r.frequency}; ${fmt(r.percent)}% of ${edgeFacesActive()?'current population':'filter population'}<br>${edgeFacesActive()?'Click to emphasize; checkboxes control faces and sample rings.':'Click to select; combine states using catalogue checkboxes.'}`),marker:{size:4,color:faces.map(r=>rank3Color(r.id))},hovertemplate:'%{text}<extra></extra>',showlegend:false});
 return traces;
}
function rank3Table(){
 const v=rank3View(),query=el('search').value.toLowerCase(),only=el('catalogueSelectedOnly').checked&&v.active;
 const rows=v.rows.filter(r=>(!only||v.isSelected(r))&&r.label.toLowerCase().includes(query)).sort((a,b)=>{const k=rank3Sort.key,order=k==='label'?a.label.localeCompare(b.label):k==='id'?rank3IdOrder.compare(a.id,b.id):a[k]-b[k];return (rank3Sort.descending?-order:order)||rank3IdOrder.compare(a.id,b.id)});
 return {...v,filtered:rows};
}
function renderRank3Table(){
 const v=rank3Table();el('catalogueSelectedOnly').disabled=!v.active;
 el('catalogueStatus').textContent=`Showing ${v.filtered.length} of ${v.rows.length} top-3 CSTs · n: current population · %: ${v.basisName}`;
 const columns=[['id','ID'],['label','Top-3 CST'],['frequency','n'],['basisCount','Filter n'],['percent','Filter %']];
 el('tableBox').innerHTML='<table><thead><tr><th>Select</th>'+columns.map(([key,label])=>`<th scope="col" aria-sort="${rank3Sort.key===key?(rank3Sort.descending?'descending':'ascending'):'none'}"><button type="button" data-face-sort="${key}">${label} ${rank3Sort.key===key?(rank3Sort.descending?'▼':'▲'):'↕'}</button></th>`).join('')+'<th>Color</th></tr></thead><tbody>'+ (v.filtered.map(r=>`<tr data-face="${r.id}" class="${v.isSelected(r)?'selected':''}"><td><input type="checkbox" data-face-select="${r.id}" aria-label="Select ${esc(r.label)}" ${v.isSelected(r)?'checked':''}></td><td>${r.key}</td><td>${esc(r.label)}</td><td>${r.frequency}</td><td>${r.basisCount}</td><td>${fmt(r.percent)}</td><td><input type="color" data-face-color="${r.id}" aria-label="Color ${esc(r.label)}" value="${rank3Hex(r.id)}"></td></tr>`).join('')||'<tr><td colspan="7">No top-3 CSTs match these filters.</td></tr>')+'</tbody></table>';
}
function rank3Hex(id){const c=rank3Color(id);if(c.startsWith('#'))return c;const h=parseFloat(c.slice(4)),s=.62,l=.43,a=s*Math.min(l,1-l);return '#'+[0,8,4].map(n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0')}).join('')}
function rank3Csv(){
 const v=rank3Table(),rows=[['ID','Top-3 CST','n','filter_n','filter_percent','triple_id','dataset','population','filter_population','count_unit'],...v.filtered.map(r=>[r.key,r.label,r.frequency,r.basisCount,r.percent,r.id,META.id,META.populationName||'Full reference dataset',v.basisName,META.observationLabel])];
 if(META.analysisRevision){rows[0].push('analysis_revision');rows.slice(1).forEach(row=>row.push(META.analysisRevision))}
 return rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
}
function rank3TableClick(e){
 const sort=e.target.closest('[data-face-sort]');if(sort){const key=sort.dataset.faceSort;rank3Sort={key,descending:rank3Sort.key===key?!rank3Sort.descending:!['id','label'].includes(key)};table();return true}
 if(e.target.closest('[data-face-color]'))return true;
 const check=e.target.closest('[data-face-select]');if(check){const v=rank3View();selectRank3(check.dataset.faceSelect,true);return true}
 const row=e.target.closest('[data-face]');if(row){selectRank3(row.dataset.face);return true}return false;
}
function syncRank3Controls(){
 el('showRank3').checked=rank3.enabled;el('rank3Mode').value=rank3.mode;el('rank3Threshold').value=rank3.threshold;el('rank3Basis').value=rank3.basis;el('rank3SampleColor').value=rank3.color;el('rank3Background').checked=rank3.background;
 el('rank3Threshold').max=rank3.mode==='count'?'':100;el('rank3Threshold').step=rank3.mode==='count'?'1':'.1';
 el('rank3ThresholdLabel').textContent=rank3.mode==='count'?'Minimum count':rank3.mode==='percent'?'Minimum percentage (%)':'Coverage target (%)';
 el('rank3Settings').hidden=!rank3.enabled;el('catalogueKind').options[1].disabled=!rank3.enabled;
 if(!rank3.enabled&&el('catalogueKind').value==='faces')el('catalogueKind').value='edges';
 if(!rank3.enabled){el('rank3Status').textContent='';return}
 const v=rank3View(),eligible=v.retained.reduce((s,r)=>s+r.basisCount,0),valid=v.rows.reduce((s,r)=>s+r.frequency,0),totalValid=v.rows.length;
 const classified=v.population.filter(i=>rank3Id(i)!==null).length,existing=new Set(current().nodes.map(n=>n.id)),added=new Set(v.rows.flatMap(r=>r.features).filter(id=>!existing.has(id))).size;
 el('rank3Status').textContent=`${totalValid} faces · ${added} supplementary vertices · ${fmt(valid)} ${META.observationLabel} in current population. Filter population: ${v.basisName}, N=${fmt(v.N)} ${META.observationLabel}; retained ${fmt(v.N?100*eligible/v.N:0)}%. ${v.population.length-classified} current observations have fewer than three positive taxa and form no face. Boundary ties follow frozen feature order. Added vertices use schematic positions; existing coordinates are unchanged.`;
}
// Edge context is a display selection, never a reassignment or a new fit.
let edgeFaces={edge:null,enabled:false,checked:[],focused:null,catalogue:false};
let edgeFacesSort={key:'edgeCount',descending:true};
const edgeFacesCache=new WeakMap();
function edgeFacesReset(){edgeFaces={edge:null,enabled:false,checked:[],focused:null,catalogue:false}}
function edgeFacesActive(){return edgeFaces.enabled&&edgeFaces.edge===selected&&selected!==null&&!participant.active&&!rank3.enabled}
function edgeFacesCatalogue(){return edgeFacesActive()&&el('catalogueKind').value==='edgeFaces'}
function edgeFacesView(){
 let cache=edgeFacesCache.get(DATA);if(!cache){cache=new Map();edgeFacesCache.set(DATA,cache)}
 if(!cache.has(selected)){
  const pair=(selected||'').split(',').map(Number),p=rank3Population(),members=p.population.filter(i=>DATA.samples.pair[i]===selected),counts=new Map();
  for(const i of members){const id=rank3Id(i);if(id)counts.set(id,(counts.get(id)||0)+1)}
  const rows=p.rows.filter(r=>r.frequency>0&&pair.length===2&&pair.every(id=>r.features.includes(id))).map(r=>({...r,edgeCount:counts.get(r.id)||0,percent:p.population.length?100*r.frequency/p.population.length:0}));
  cache.set(selected,{rows,members,N:p.population.length,unmatched:members.length-rows.reduce((n,r)=>n+r.edgeCount,0)});
 }
 const v=cache.get(selected),query=el('search').value.trim().toLowerCase(),key=edgeFacesSort.key;
 const filtered=v.rows.filter(r=>r.label.toLowerCase().includes(query)).slice().sort((a,b)=>{const order=key==='label'?a.label.localeCompare(b.label):key==='id'?rank3IdOrder.compare(a.id,b.id):(a[key]||0)-(b[key]||0);return (edgeFacesSort.descending?-order:order)||rank3IdOrder.compare(a.id,b.id)});
 return {...v,filtered};
}
function startEdgeFaces(){
 rank3.enabled=false;edgeFaces={edge:selected,enabled:true,checked:edgeFacesView().rows.map(r=>r.id),focused:null,catalogue:true};
 el('catalogueKind').value='edgeFaces';el('search').value='';el('scope').value='selected';syncRank3Controls();
}
function edgeFacesSnapshot(){return edgeFaces.edge!==null&&edgeFaces.edge===selected?{...edgeFaces,checked:[...edgeFaces.checked]}:null}
function edgeFacesRestore(value){edgeFaces=value?{...value,checked:[...value.checked]}:{edge:null,enabled:false,checked:[],focused:null,catalogue:false};if(edgeFacesActive())el('catalogueKind').value=edgeFaces.catalogue?'edgeFaces':'edges'}
function syncEdgeFacesControls(){
 const available=selected!==null&&selectedVertex===null&&!participant.active&&!rank3.enabled,active=edgeFacesActive(),catalogue=edgeFacesCatalogue();
 el('edgeFacesControl').hidden=!available;el('showEdgeFaces').checked=active;
 el('catalogueKind').options[2].disabled=!active;
 if(!active&&el('catalogueKind').value==='edgeFaces')el('catalogueKind').value='edges';
 el('edgeFacesActions').hidden=!catalogue;el('catalogueSelectedOnlyLabel').hidden=catalogue;
 if(!active){el('edgeFacesSummary').textContent='Show associated triples and ring their members within this edge.';return}
 const v=edgeFacesView(),checked=new Set(edgeFaces.checked),n=v.rows.filter(r=>checked.has(r.id)).reduce((s,r)=>s+r.edgeCount,0);
 el('edgeFacesSummary').textContent=`${checked.size} of ${v.rows.length} faces checked · ${fmt(n)} of ${fmt(v.members.length)} edge ${META.observationLabel} ringed. ${fmt(v.unmatched)} edge observations have no associated positive triple and remain unringed. Faces contain both endpoint taxa; global rank-3 filters do not apply. Added vertices are schematic.`;
}
function setEdgeFaces(ids){
 if(!edgeFacesActive())return;rememberSelection();const allowed=new Set(edgeFacesView().rows.map(r=>r.id));edgeFaces.checked=[...new Set(ids)].filter(id=>allowed.has(id));
 if(!edgeFaces.checked.includes(edgeFaces.focused))edgeFaces.focused=null;
 return rank3Refresh();
}
function focusEdgeFace(id){
 if(!edgeFacesActive()||!edgeFacesView().rows.some(r=>r.id===id))return;
 rememberSelection();edgeFaces.focused=edgeFaces.focused===id?null:id;return rank3Refresh();
}
function renderEdgeFacesTable(){
 const v=edgeFacesView(),edge=current().edges.find(e=>e.id===selected),checked=new Set(edgeFaces.checked);
 el('catalogueTitle').textContent='top-3 CST catalogue';
 el('edgeCatalogueHelp').hidden=true;el('faceCatalogueHelp').hidden=true;el('catalogueSelectedOnly').disabled=true;
 el('search').placeholder='Filter triple names';el('search').setAttribute('aria-label','Filter catalogue triple names');
 el('catalogueCountHelp').textContent=`Faces contain both endpoint taxa and occur in the current population, regardless of global rank-3 filters. n (population) counts ${META.observationLabel} in the current dataset/cohort; n (edge) counts their intersection with this selected edge. Checkboxes control faces and matching sample rings, never remove rows or samples. Row buttons emphasize a triple without checking it. Unmatched assigned samples remain unringed. Select all and Clear checks apply to all associated triples, including rows hidden by name search. Colors match faces and rings. Export includes checked status and both counts. Supplementary positions and triangle area have no metric meaning.`;
 el('catalogueStatus').textContent=`${edge.key}: ${edge.label} · ${v.filtered.length} of ${v.rows.length} associated triples · ${checked.size} checked · ${META.observationLabel} · population N=${fmt(v.N)} · edge n=${fmt(v.members.length)}`;
 const columns=[['id','ID'],['label','Top-3 CST'],['edgeCount','n (edge)'],['frequency','n (population)'],['percent','Population %']];
 el('tableBox').innerHTML='<table><thead><tr><th scope="col">Show</th>'+columns.map(([key,label])=>`<th scope="col" aria-sort="${edgeFacesSort.key===key?(edgeFacesSort.descending?'descending':'ascending'):'none'}"><button type="button" data-face-sort="${key}">${label} ${edgeFacesSort.key===key?(edgeFacesSort.descending?'▼':'▲'):'↕'}</button></th>`).join('')+'<th scope="col">Color</th></tr></thead><tbody>'+(v.filtered.map(r=>`<tr data-edge-face="${r.id}" class="${edgeFaces.focused===r.id?'selected':''}"><td><input type="checkbox" data-edge-face-check="${r.id}" aria-label="Show face ${esc(r.label)}" ${checked.has(r.id)?'checked':''}></td><td>${r.key}</td><td><button type="button" data-edge-face-focus="${r.id}" aria-pressed="${edgeFaces.focused===r.id}" title="Emphasize this triple without changing its checkbox">${esc(r.label)}</button></td><td>${r.edgeCount}</td><td>${r.frequency}</td><td>${fmt(r.percent)}</td><td><input type="color" data-face-color="${r.id}" aria-label="Color ${esc(r.label)}" value="${rank3Hex(r.id)}"></td></tr>`).join('')||'<tr><td colspan="7">No associated positive triples match this name filter. The edge samples remain visible.</td></tr>')+'</tbody></table>';
}
function edgeFacesTableClick(e){
 const check=e.target.closest('[data-edge-face-check]');if(check){const id=check.dataset.edgeFaceCheck;setEdgeFaces(check.checked?[...edgeFaces.checked,id]:edgeFaces.checked.filter(s=>s!==id));return true}
 if(e.target.closest('[data-face-color]'))return true;
 const row=e.target.closest('[data-edge-face]');if(row){focusEdgeFace(row.dataset.edgeFace);return true}
 const sort=e.target.closest('[data-face-sort]');if(sort){const key=sort.dataset.faceSort;edgeFacesSort={key,descending:edgeFacesSort.key===key?!edgeFacesSort.descending:!['id','label'].includes(key)};table();return true}return false;
}
function addEdgeFaceRings(traces,ii,z){
 const checked=new Set(edgeFaces.checked),positions=ii.map((i,k)=>DATA.samples.pair[i]===selected&&checked.has(rank3Id(i))?k:-1).filter(k=>k>=0),ids=positions.map(k=>ii[k]);
 traces.push({type:'scatter3d',mode:'markers',name:'Checked top-3 CST members',showlegend:false,meta:{edgeFaceRings:true,sampleView:sampleViewKey()},ids:ids.map(String),customdata:ids.map(i=>'edge-face:'+rank3Id(i)),x:positions.map(k=>z[k][0]),y:positions.map(k=>z[k][1]),z:positions.map(k=>z[k][2]),text:ids.map(i=>samplePlotHover(i)+'<br>Ring: '+esc(rank3Base().byId.get(rank3Id(i)).label)),marker:{symbol:'circle-open',size:ids.map(i=>rank3Id(i)===edgeFaces.focused?9:6),color:ids.map(i=>rank3Color(rank3Id(i))),line:{width:2},opacity:1},hovertemplate:'%{text}<extra></extra>'});
 const v=edgeFacesView();el('sampleLegend').hidden=false;
 renderStateColors([...sampleStateColorEntries,...tripleColorEntries(v.rows.filter(r=>checked.has(r.id)))]);
 el('sampleLegendItems').innerHTML='<strong>Rings: checked top-3 CST members within this edge</strong>'+v.rows.filter(r=>checked.has(r.id)).sort((a,b)=>b.edgeCount-a.edgeCount||b.frequency-a.frequency).map(r=>`<span class="legendItem"><span class="colorSwatch" style="border:2px solid ${rank3Color(r.id)};border-radius:50%;background:transparent"></span>${esc(r.key+': '+r.label)} · ${r.edgeCount}</span>`).join('')+`<span>${fmt(ids.length)} of ${fmt(v.members.length)} edge observations ringed; ${fmt(v.unmatched)} have no associated positive triple. Unchecked members stay visible without rings.</span>`;
 el('sampleStatus').textContent+=' Faces around selected edge: rings mark checked original triples within the selected edge only. All edge samples retain their coordinates and assignments.';
}
function edgeFacesCsv(){
 const v=edgeFacesView(),rows=[['ID','Top-3 CST','checked','n_edge','n_population','population_percent','triple_id','edge_id','dataset','population','state_mode','reference_target_percent','count_unit'],...v.filtered.map(r=>[r.key,r.label,edgeFaces.checked.includes(r.id),r.edgeCount,r.frequency,r.percent,r.id,selected,META.id,META.populationName||'Full reference dataset',activeStateMode,el('coverage').value,META.observationLabel])];
 if(META.analysisRevision){rows[0].push('analysis_revision');rows.slice(1).forEach(row=>row.push(META.analysisRevision))}
 return rows.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
}
function validateEdgeFacesView(selection,bundle,data){
 const value=selection?.edgeFaces;if(value===undefined||value===null)return;
 const base=rank3Base(bundle),pair=(selection.selected||'').split(',').map(Number);
 if(value.edge!==selection.selected||pair.length!==2||selection.selectedVertex!==null||selection.rank3?.enabled||selection.participant?.active||typeof value.enabled!=='boolean'||typeof value.catalogue!=='boolean'||!Array.isArray(value.checked)||new Set(value.checked).size!==value.checked.length||value.checked.some(id=>!base.byId.has(id)||!pair.every(n=>base.byId.get(id).features.includes(n)))||value.focused!==null&&(!base.byId.has(value.focused)||!pair.every(n=>base.byId.get(value.focused).features.includes(n))))throw Error('Invalid saved faces-around-edge settings.');
 const population=data.eligibleIndices||data.samples.ids.map((_,i)=>i),present=new Set(population.map(i=>base.membership[data.records?data.records[i].profile:i]));
 if(value.checked.some(id=>!present.has(id))||value.focused!==null&&!present.has(value.focused))throw Error('Saved faces are absent from this population.');
}
function installEdgeFaces(){
 el('showEdgeFaces').onchange=()=>{rememberSelection();if(el('showEdgeFaces').checked)startEdgeFaces();else{edgeFaces.enabled=false;edgeFaces.catalogue=false;el('catalogueKind').value='edges'}return rank3Refresh()};
 el('edgeFacesAll').onclick=()=>setEdgeFaces(edgeFacesView().rows.map(r=>r.id));el('edgeFacesNone').onclick=()=>setEdgeFaces([]);
}

function installRank3(){
 try{rank3Colors=JSON.parse((typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).getItem('vme-rank3-colors-v1')||'{}')}catch{rank3Colors={}}
 if(!rank3Colors||typeof rank3Colors!=='object'||Array.isArray(rank3Colors))rank3Colors={};
 el('showRank3').onchange=()=>{
  try{rank3Base();rememberSelection();rank3.enabled=el('showRank3').checked;if(rank3.enabled&&rank3.color==='rank3')el('sampleColorScheme').value='rank3';rank3Clear();selected=null;selectedVertex=null;el('catalogueKind').value=rank3.enabled?'faces':'edges';rank3Refresh()}catch(e){rank3.enabled=false;el('showRank3').checked=false;el('rank3Status').textContent=e.message}
 };
 for(const id of ['rank3Mode','rank3Threshold','rank3Basis','rank3SampleColor','rank3Background'])el(id).onchange=()=>{
  if(id==='rank3Mode')el('rank3Threshold').value={count:50,percent:1,coverage:70}[el('rank3Mode').value];
  const mode=el('rank3Mode').value,n=Number(el('rank3Threshold').value);if(!Number.isFinite(n)||n<0||mode!=='count'&&n>100||mode==='count'&&!Number.isInteger(n)){el('rank3Status').textContent='Enter a nonnegative count, or a percentage from 0 to 100.';return}
  rememberSelection();rank3={...rank3,mode,threshold:n,basis:el('rank3Basis').value,color:el('rank3SampleColor').value,background:el('rank3Background').checked};
  if(id==='rank3SampleColor')el('sampleColorScheme').value=rank3.color==='rank3'?'rank3':'default';
  const keep=new Set(rank3View().rows.map(r=>r.id));rank3.selected=rank3.selected.filter(id=>keep.has(id));rank3Refresh();
 };
 el('catalogueKind').onchange=()=>{if(edgeFacesActive())edgeFaces.catalogue=el('catalogueKind').value==='edgeFaces';table()};
 el('tableBox').addEventListener('change',e=>{const input=e.target.closest('[data-face-color]');if(!input)return;return setStateColor('triple',input.dataset.faceColor,input.value)});
}
installRank3();
installEdgeFaces();

function validateRank3View(value,bundle){
 if(value===undefined)return;
 if(!value||typeof value.enabled!=='boolean'||!['count','percent','coverage'].includes(value.mode)||!['reference','population'].includes(value.basis)||!['rank2','rank3'].includes(value.color)||typeof value.background!=='boolean'||!Number.isFinite(value.threshold)||value.threshold<0||(value.mode==='count'?!Number.isInteger(value.threshold):value.threshold>100)||!Array.isArray(value.selected)||new Set(value.selected).size!==value.selected.length)throw Error('Invalid saved rank-3 settings.');
 const b=rank3Base(bundle);
 if(value.selected.some(id=>!b.byId.has(id))||value.vertex!==null&&(!Number.isInteger(value.vertex)||!b.rows.some(r=>r.features.includes(value.vertex))))throw Error('Saved rank-3 selection is unavailable.');
 if(value.vertex!==null&&value.selected.length)throw Error('Ambiguous saved rank-3 selection.');
}
