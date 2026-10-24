// Additive, pinned annotations. No classifications or embeddings are computed here.
// Share this exact control node between the ordinary and maximized sidebars.
function moveValenciaControls(){
 const section=el('participantSection');
 section.parentElement.insertBefore(el('valenciaColorControls'),section);
}
if(el('participantSection').parentElement)moveValenciaControls();
const valenciaSubtypeColors={'I-A':'#ff6868','I-B':'#ffd4da','II':'#b4ff68','III-A':'#ffbc6b','III-B':'#e4a67b','IV-A':'#c1adec','IV-B':'#91a8ed','IV-C0':'#989898','IV-C1':'#ffc0cb','IV-C2':'#a8e5e5','IV-C3':'#9acc9a','IV-C4':'#800080','V':'#ffff71'};
const valenciaCstColors={'I':'#df5555','II':'#64a52d','III':'#ed993b','IV-A':'#9a7bc4','IV-B':'#5477c7','IV-C':'#737373','V':'#b6a616'};
function valenciaAsset(){return BUNDLE_PACK.valencia2?.[META.id]||null}
function valenciaActive(){return !!valenciaAsset()&&['valencia2-cst','valencia2-subtype'].includes(el('sampleColorScheme').value)}
function valenciaProfile(profile){return valenciaAsset()?.profiles[profile]||null}
function valenciaSampleProfile(i){return DATA.records?DATA.records[i]?.profile:i}
function valenciaColorForProfile(profile,fallback){
 if(!valenciaActive())return fallback;
 const a=valenciaProfile(profile);if(!a)return '#7c878d';
 return el('sampleColorScheme').value==='valencia2-subtype'?valenciaSubtypeColors[a.subCST]:valenciaCstColors[a.cst];
}
function valenciaSampleColor(i,fallback){return fallback==='#93b3c1'?fallback:valenciaColorForProfile(valenciaSampleProfile(i),fallback)}
function valenciaHover(profile,recordId=null,asset=valenciaAsset()){
 const a=asset?.profiles[profile];if(!a)return '';
 const record=recordId?valenciaRecordMap().get(recordId):null;
 return `<br><b>VALENCIA2 CST ${esc(a.cst)} · ${esc(a.subCST)}</b><br>Similarity: ${a.score.toFixed(4)} · margin: ${a.margin.toFixed(4)}<br>Reference-matched abundance: ${(100*a.matchedFraction).toFixed(2)}%<br>Runner-up: ${esc(a.runnerUp)}${a.tieCount>1?'<br>Near/exact tie (≤1e-12); reference order breaks exact ties':''}${record?'<br>Historical labels: '+esc(record.historical.status.replaceAll('_',' '))+(record.historical.labels.length?'<br>'+record.historical.labels.map(l=>esc(l.source)+': '+esc(l.fields.subCST||l.fields.CST||l.fields['sub.cst']||'Not supplied')).join('<br>'):''):''}<br>Diagnostics, not calibrated confidence; source quality holds retained.`;
}
const valenciaRecordMaps=new WeakMap();
function familyValenciaAvailable(collection){return !!BUNDLE_PACK.valencia2?.[collection]}
function familyValenciaReference(collection){
 const a=BUNDLE_PACK.valencia2?.[collection];if(!a)throw Error('VALENCIA2 is unavailable for this collection');
 return {policy:'VALENCIA2-full-union-v1',revision:a.revision+'|'+a.referenceSha256};
}
function familyValenciaModel(hood,mode){
 const reference=familyValenciaReference(hood.collection),a=BUNDLE_PACK.valencia2[hood.collection];
 const palette=mode==='valencia2-subtype'?valenciaSubtypeColors:valenciaCstColors;
 const profiles=hood.profileIndices.map((p,i)=>{
  const row=a.profiles[p];if(!row||row.id!==hood.profileIds[i])throw Error('Neighborhood VALENCIA2 profile identity differs');
  return row;
 });
 const states=profiles.map(p=>(mode==='valencia2-subtype'?p?.subCST:p?.cst)||null),counts=new Map();
 states.forEach(id=>counts.set(id,(counts.get(id)||0)+1));
 return {mode,coverage:null,states,colors:states.map(s=>palette[s]||'#7c878d'),labels:states.map(s=>s?'VALENCIA2 '+s:'Unclassified'),
  legend:[...Object.keys(palette),null].filter(id=>counts.has(id)).map(id=>({id,label:id?'VALENCIA2 '+id:'Unclassified',color:palette[id]||'#7c878d',n:counts.get(id)})),
  note:'VALENCIA2 assignments from full sample compositions, independent of reference coverage. Counts are distinct neighborhood compositions. Hover for similarity, margin and matched abundance; these are not confidence probabilities. Source quality holds remain. Coordinates, graph selections and dimmed backgrounds are unchanged.',reference};
}
function valenciaRecordMap(){
 const a=valenciaAsset();if(!a)return new Map();
 if(!valenciaRecordMaps.has(a))valenciaRecordMaps.set(a,new Map(a.records.map(r=>[r.id,r])));
 return valenciaRecordMaps.get(a);
}
function syncValenciaControls(){
 const available=!!valenciaAsset();
 el('valenciaColorControls').hidden=!available;
 el('exportValencia2').disabled=!available;
 el('valenciaExportDescription').textContent=available?`Exports all ${valenciaAsset().records.length.toLocaleString('en-US')} source records for ${META.id}, diagnostics and reconciled historical labels—not only the current view.`:'';
 el('rank3SampleColor').disabled=valenciaActive();
 if(!valenciaActive())el('sampleLegend').setAttribute('aria-label','Sample color legend');
}
function renderValenciaLegend(){
 syncValenciaControls();
 if(!valenciaActive()||(typeof pureCoverageActive==='function'&&pureCoverageActive()&&pureCoverageComparison.nonCore))return;
 const sub=el('sampleColorScheme').value==='valencia2-subtype',colors=sub?valenciaSubtypeColors:valenciaCstColors;
 el('sampleLegend').hidden=false;
 el('sampleLegend').setAttribute('aria-label','VALENCIA2 sample color legend');
 el('sampleLegendItems').innerHTML='<strong>VALENCIA2 '+(sub?'subtypes':'CSTs')+'</strong>'+Object.entries(colors).map(([label,color])=>`<span class="legendItem"><span class="colorSwatch" style="background:${color};border:1px solid #62727a"></span>${esc(label)}</span>`).join('')+
 '<small>Sample colors only; graph states, selections and coordinates are unchanged. Dimmed nonmembers and gray background settings are retained. Hover for similarity, runner-up margin and reference coverage. These are not confidence probabilities; existing scientific holds remain in force.</small>';
 // Existing state-color controls still edit the graph, not the VALENCIA palette.
 el('sampleStateColorMessage').textContent='State colors affect graph/state displays, not the fixed VALENCIA2 palette.';
 if(participant.active){el('participantColorBy').disabled=true;el('participantMatchBackground').disabled=true;}
 if(rank3.enabled)el('rank3SampleColor').disabled=true;
}
function valenciaCsv(asset=valenciaAsset()){
 if(!asset)throw Error('VALENCIA2 annotations unavailable');
 const header=['record_id','profile_id','VALENCIA2_CST','VALENCIA2_subCST','similarity','runner_up','margin','tie_count','matched_fraction','unmatched_fraction','historical_status','historical_labels_json','scientific_holds','source_release_eligible','source_analysis_included','source_metadata_json','annotation_revision','reference_sha256',...asset.subtypes.map(s=>s+'_sim')];
 const rows=asset.records.map(r=>{const p=asset.profiles[r.profile];return [r.id,p.id,p.cst,p.subCST,p.score,p.runnerUp,p.margin,p.tieCount,p.matchedFraction,1-p.matchedFraction,r.historical.status,JSON.stringify(r.historical.labels),r.scientificHolds,r.releaseEligible,r.sourceAnalysisIncluded,r.sourceMetadata?JSON.stringify(r.sourceMetadata):'',asset.revision,asset.referenceSha256,...p.scores]});
 if(asset.eligibilityRevision){header.push('eligibility_revision');rows.forEach(row=>row.push(asset.eligibilityRevision))}
 return [header,...rows].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
}
el('sampleColorScheme').onchange=()=>{
 if(!valenciaActive()){el('sampleStateColorMessage').textContent='';el('sampleLegend').setAttribute('aria-label','Sample color legend');syncRank3Controls();}
 refreshSamples(readCamera('samples'));
};
el('exportValencia2').onclick=()=>{
 const url=URL.createObjectURL(new Blob([valenciaCsv()],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=valenciaAsset().datasetId+'_VALENCIA2_assignments.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
