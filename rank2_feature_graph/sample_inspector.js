// Presentation-only summaries and captured pins. Never mutate bundle data or fits.
let plottedSampleIndices=[],pinnedSamples=[],nextPinId=1;
const assignmentNames={core:'Core',rank3:'Rank-3 support',knn:'Nearest neighbors'};
const pairName=pair=>pair===null?'No leading pair (one positive taxon)':String(pair).split(',').map(id=>DATA.featureNames[id]??id).join(' + ');
function viewRecord(index){
 if(DATA.records)return DATA.records[index];
 const a=analysisExtension();if(a?.populationVersion!==2)return undefined;
 const records=a.records.filter(r=>r.profile===index);
 return records.length===1?records[0]:undefined;
}
function sampleCounts(indices){
 const geometry=datasetRegistry.get(META.id).data.geometryProfile;
 const distinct=profiles=>new Set([...profiles].map(i=>geometry?.[i]??i)).size;
 if(!DATA.records&&analysisExtension()?.populationVersion===2){
  const selected=new Set(indices),records=analysisExtension().records.filter(r=>selected.has(r.profile));
  return `${fmt(records.length)} ${META.observationLabel} · ${fmt(distinct(selected))} distinct compositions · ${fmt(new Set(records.filter(r=>r.subject).map(r=>r.cohort+'|'+r.subject)).size)} known participants`;
 }
 if(!DATA.records)return `${fmt(indices.length)} ${META.observationLabel} · ${typeof recordExtension==='function'&&recordExtension()?'choose a source-record or study view for participant metadata':'participant metadata not supplied'}`;
 const records=indices.map(i=>DATA.records[i]),profiles=new Set(records.map(r=>r.profile));
 const subjects=new Set(records.filter(r=>r.subject).map(r=>r.cohort+'|'+r.subject));
 return `${fmt(indices.length)} ${META.observationLabel} · ${fmt(distinct(profiles))} distinct compositions · ${fmt(subjects.size)} known participants`;
}
function assignmentComposition(indices){
 const methods={core:0,rank3:0,knn:0},states=new Map();
 for(const i of indices){
  const pair=DATA.purePairs?DATA.purePairs[i]:DATA.samples.pair[i];states.set(pair,(states.get(pair)||0)+1);
  if(DATA.assignment){const method=DATA.assignment.methods[DATA.records[i].profile];methods[method]=(methods[method]||0)+1}
 }
 return {n:indices.length,methods,states:[...states].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])))};
}
function updateSampleContext(indices){
 plottedSampleIndices=indices.slice();
 const edge=current().edges.find(e=>e.id===selected),node=current().nodes.find(n=>n.id===selectedVertex);
 const name=edge?`${edge.key}: ${edge.label}`:node?`Feature: ${node.label}`:'All displayed states';
 const target=DATA.assignment?`Reference core target: ${el('coverage').value}% (actual ${fmt(DATA.assignment.referenceCoreCoverage)}%)`:`Reference state target: ${el('coverage').value}%`;
 el('sampleContext').innerHTML=`<strong>${esc(name)}</strong><br>${esc(META.title)} · ${esc(META.populationName||'Full dataset')}<br>Plotted: ${esc(sampleCounts(indices))}<br>${esc(target)} · Selected population retained: ${fmt(current().coverage)}%`;
 if(edge)el('sampleTitle').textContent=samplePanelTitle(sampleEmbeddingTitle(),edge.label);
 const c=assignmentComposition(indices),denominator=c.n||1,paired=c.states.filter(([pair])=>pair!==null).length,unpaired=c.states.find(([pair])=>pair===null)?.[1]||0;
 el('assignmentHeading').textContent=DATA.assignment?`Assignment composition · ${fmt(c.methods.core)} core / ${fmt(c.methods.rank3)} rank-3 / ${fmt(c.methods.knn)} neighbors`:`Original state composition · ${fmt(paired)} states${unpaired?' · '+fmt(unpaired)+' without a leading pair':''}`;
 el('assignmentComposition').innerHTML=`<p>Counts describe the ${fmt(c.n)} plotted ${esc(META.observationLabel)}, including background samples when shown. Reference diamonds are excluded.</p>`+
  (DATA.assignment?`<div class="assignmentCounts">${Object.entries(assignmentNames).map(([m,label])=>`<span>${label}<br><strong>${fmt(c.methods[m])}</strong> · ${fmt(100*c.methods[m]/denominator)}%</span>`).join('')}</div><p>Core pairs name merged groups; they need not be the leading taxa in every assigned record. Neighbor vote share is a diagnostic, not calibrated confidence.</p>`:'<p>Merged-group assignments are not active in this view.</p>')+
  `<p>${fmt(paired)} original leading-pair states contribute to this view.${unpaired?' '+fmt(unpaired)+' single-positive observations have no leading pair.':''}</p><div class="stateBreakdown"><table><thead><tr><th>Original state (leading pair)</th><th>Count</th><th>% of plotted</th></tr></thead><tbody>${c.states.map(([pair,n])=>`<tr><td>${esc(pairName(pair))}</td><td>${fmt(n)}</td><td>${fmt(100*n/denominator)}</td></tr>`).join('')}</tbody></table></div>`;
 renderSampleMatches();
}
function pinSample(index){
 if(!Number.isInteger(index)||!plottedSampleIndices.includes(index))return;
 const key=datasetKey()+'|'+el('coverage').value+'|'+index;
 el('pinnedInspector').open=true;
 if(pinnedSamples.some(p=>p.key===key)){el('pinMessage').textContent='This sample is already pinned in this context.';return}
 if(pinnedSamples.length>=6){el('pinMessage').textContent='Six samples are pinned. Remove a pin before adding another.';return}
 const record=viewRecord(index),profile=record?.profile,m=DATA.assignment;
 const row=(label,value)=>`<dt>${label}</dt><dd>${esc(value==null||value===''?'Not supplied':value)}</dd>`;
 const fields=row(record?'Record ID':'Composition / sample ID',DATA.samples.ids[index])+row('Dataset',META.title)+row('Revision',META.revision)+row('Cohort',record?.cohort)+row('Participant',record?.subject)+row('Visit',record?.visit)+row('Specimen',record?.specimen)+row('Original state',pairName(DATA.purePairs?DATA.purePairs[index]:DATA.samples.pair[index]))+
  (m?row('Merged group',pairName(DATA.samples.pair[index]))+row('Assignment',assignmentNames[m.methods[profile]]??m.methods[profile]):row('Assignment','Pure state; no merged assignment'));
 const vote=m?.fallback?.[profile];
 const identity=record?`${esc(record.cohort)} · Participant ${esc(record.subject||'not supplied')} · ${esc(record.visit||'Visit not supplied')}`:'Participant / visit metadata not supplied';
 const diagnostics=vote?`<p>Neighbor vote: ${fmt(vote.votes)} / ${fmt(vote.voters)} (${fmt(100*vote.voteShare)}%); ${fmt(vote.neighborhood)} neighbors searched. Diagnostic vote share, not calibrated confidence.</p>`:'';
 const id=nextPinId++;
 pinnedSamples.push({id,key,html:`<article class="pinCard"><h3>${esc(DATA.samples.ids[index])}</h3><p>Captured: ${esc(META.title)} · ${esc(META.populationName||'Full dataset')} · ${m?'merged groups':'pure states'} · ${el('coverage').value}% reference target</p><p>${identity}<br>Assignment: ${esc(m?(assignmentNames[m.methods[profile]]??m.methods[profile]):'Pure state')}</p><strong>Most abundant taxa stored in this bundle</strong><p>Top four only; not a complete composition. Unlisted taxa are not assumed absent.</p><table><tbody>${DATA.sampleTopFeatures[index].map(([taxon,pct])=>`<tr><td>${esc(taxon)}</td><td><progress max="100" value="${pct}" aria-label="${esc(taxon)} relative abundance"></progress></td><td>${fmt(pct)}%</td></tr>`).join('')}</tbody></table><details><summary>Record and assignment details</summary><dl>${fields}</dl>${diagnostics}</details><button type="button" data-unpin="${id}" aria-label="Remove pin ${esc(DATA.samples.ids[index])}">Remove pin</button></article>`});
 el('pinMessage').textContent='Pinned '+DATA.samples.ids[index]+'. Context is saved with the pin; changing the view does not relabel it.';
 renderPins();
}
function renderPins(){
 el('pinCount').textContent=String(pinnedSamples.length);
 el('pinnedCards').innerHTML=pinnedSamples.map(p=>p.html).join('');
 el('clearPins').disabled=pinnedSamples.length===0;
}
function renderSampleMatches(){
 const query=el('sampleQuery').value.trim().toLowerCase();
 if(!query){el('sampleMatches').innerHTML='';return}
 const matches=plottedSampleIndices.filter(i=>String(DATA.samples.ids[i]).toLowerCase().includes(query));
 el('sampleMatches').innerHTML=`<small>${fmt(matches.length)} matching plotted samples${matches.length>20?'; showing the first 20. Refine your search.':''}</small>`+matches.slice(0,20).map(i=>{
  const r=DATA.records?.[i];return `<button type="button" data-pin="${i}">Pin ${esc(DATA.samples.ids[i])}${r?' · '+esc(r.cohort)+' · visit '+esc(r.visit||'not supplied'):''}</button>`;
 }).join('');
}
el('sampleQuery').oninput=renderSampleMatches;
el('sampleMatches').onclick=event=>{const button=event.target.closest('[data-pin]');if(button)pinSample(Number(button.dataset.pin))};
el('pinnedCards').onclick=event=>{const button=event.target.closest('[data-unpin]');if(button){pinnedSamples=pinnedSamples.filter(p=>p.id!==Number(button.dataset.unpin));el('pinMessage').textContent='Pin removed.';renderPins()}};
el('clearPins').onclick=()=>{pinnedSamples=[];el('pinMessage').textContent='Pins cleared.';renderPins()};
renderPins();

// Original-pair composition of one selected merged group; display-only state.
let mergedComponentContext='',mergedComponentHidden=new Set(),mergedComponentFrame=null;
function mergedComponentKey(){
 if(activeStateMode!=='merged'||!DATA.purePairs||selected===null||selectedVertex!==null||participant.active||activeEmbeddingFamily||rank3UsesSamples())return '';
 return JSON.stringify([datasetKey(),el('coverage').value,selected]);
}
function mergedComponentModel(){
 const key=mergedComponentKey();
 if(key!==mergedComponentContext){mergedComponentContext=key;mergedComponentHidden=new Set();mergedComponentFrame=null}
 if(!key)return null;
 const members=eligibleIndices().filter(i=>DATA.samples.pair[i]===selected),counts=new Map();
 for(const i of members){const id=DATA.purePairs[i];counts.set(id,(counts.get(id)||0)+1)}
 const rows=[...counts].map(([id,n])=>({id,n,label:stateDisplayLabel(id),checked:!mergedComponentHidden.has(id)})).sort((a,b)=>b.n-a.n||a.label.localeCompare(b.label));
 return {members,rows,n:members.length,shown:rows.filter(r=>r.checked).reduce((n,r)=>n+r.n,0)};
}
function mergedComponentFilter(indices,coords){
 const model=mergedComponentModel();if(!model)return {indices,coords};
 const positions=indices.map((i,k)=>DATA.samples.pair[i]===selected&&mergedComponentHidden.has(DATA.purePairs[i])?-1:k).filter(k=>k>=0);
 return {indices:positions.map(k=>indices[k]),coords:positions.map(k=>coords[k])};
}
function mergedComponentSampleColor(i,fallback){
 return mergedComponentKey()&&DATA.samples.pair[i]===selected?edgeColor(DATA.purePairs[i]):fallback;
}
function mergedComponentScene(){
 const key=mergedComponentKey();return key&&mergedComponentFrame?.key===key&&mergedComponentFrame.embedding===el('sampleEmbedding').value&&mergedComponentFrame.scope===el('scope').value?mergedComponentFrame.scene:{};
}
function retainMergedComponentFrame(){
 const key=mergedComponentKey();if(!key)return;
 const currentScene=exportScene(el('samples')),scene={};
 for(const prop of ['aspectmode','aspectratio','xaxis','yaxis','zaxis'])if(currentScene[prop])scene[prop]=copyCamera(currentScene[prop]);
 mergedComponentFrame={key,embedding:el('sampleEmbedding').value,scope:el('scope').value,scene};
}
function renderMergedComponentTable(){
 const model=mergedComponentModel();if(!model)return;
 renderPureEvidenceTable(false,model);
}
function renderMergedComponentLegend(){
 const model=mergedComponentModel();if(!model)return;
 const rows=model.rows.filter(r=>r.checked);
 el('sampleLegend').hidden=false;
 el('sampleLegendItems').innerHTML='<strong>Original pure top-2 CSTs · selected merged group</strong>'+rows.map(r=>`<span class="legendItem"><span class="colorSwatch" style="background:${edgeColor(r.id)}"></span>${esc(r.label)} · ${fmt(r.n)}</span>`).join('')+(rows.length?'':'<span>No component samples selected.</span>');
 renderStateColors(rows.filter(r=>r.id!==null).map(r=>({kind:'pair',id:r.id,label:r.label})));
 el('sampleStatus').textContent+=` Original-pair filter: ${fmt(model.shown)} of ${fmt(model.n)} group records shown. Coordinates and fit errors refer to the full selected group; no refitting.`;
}
function mergedComponentChange(event){
 const input=event.target,show=input.dataset.mergedPure,color=input.dataset.mergedColor;
 if(show===undefined&&color===undefined)return false;
 const model=mergedComponentModel();if(!model)return false;
 const id=JSON.parse(show??color);if(!model.rows.some(r=>r.id===id))return false;
 const camera=readCamera('samples');retainMergedComponentFrame();
 if(show!==undefined){if(input.checked)mergedComponentHidden.delete(id);else mergedComponentHidden.add(id);inspect();refreshSamples(camera)}
 else setStateColor('pair',id,input.value);
 return true;
}
function setAllMergedComponents(checked){
 const model=mergedComponentModel();if(!model)return;
 const camera=readCamera('samples');retainMergedComponentFrame();
 for(const row of model.rows){if(checked)mergedComponentHidden.delete(row.id);else mergedComponentHidden.add(row.id)}
 inspect();return refreshSamples(camera);
}
// End original-pair composition controls.
