// Audited observation metadata only. This module never changes state membership or cameras.
const annotationKeys=['nugent','PH','MENSTRUATION','TAMPON','DOUCHING','VAG_INT','ANAL_SEX','ORAL_SEX','FING_PEN','sex_toy','LUBR_USE','VAG_IRR','VAG_ITCH','VAG_BURN','VAG_ODOR','VAG_DIS','PAD','PARTNER','STRESS','LSVF_NEW_PARTNER','LSVF_PARTNER_COUNT','LSVF_CONDOM','LSVF_DOUCHING','LSVF_MENSTRUAL_PATTERN','ZP_GESTATIONAL_WEEKS'];
const pregnancyRowFields={baseline:['age','bmi','gravidity','parity','twins','hiv','pressmat_height','pressmat_hemoglobin'],delivery:['gestational_age','selection','mode_a','outcome_a','mode_b','outcome_b','labor','phenotype']};
for(const [group,fields] of Object.entries(pregnancyRowFields))annotationKeys.push(...fields.map(key=>'ZP_'+group.toUpperCase()+'_'+key.toUpperCase()));
annotationKeys.push('ZP_VISIT_ORDER','ZP_COLLECTION_DATE','ZP_ELAPSED_DAYS','ZP_TIMING_FLAGS');
annotationKeys.push(...['IL_1A','IL_1B','IL_6','IL_8','IP_10','MIP_3A'].map(f=>'ZP_IMMUNE_'+f));
annotationKeys.push(...['MAT_WEIGHT','SBP','DBP','PULSE','FUNDAL_HEIGHT','HEMO','VAG_BLEED'].map(f=>'ZP_MATERNAL_'+f));
const annotationCategoryColors=['#4477aa','#ee7733','#228833','#aa3377','#66ccee'];
function annotationCoreKeys(asset){return asset?.coreTracks||annotationDefaults.selected}
const annotationBleedingColors={1:'#edb3c4',2:'#c65e86',3:'#84244c'};
const annotationBleedingLabels={1:'Spotting',2:'Moderate',3:'Heavy'};
const annotationPreference='vme-annotation-tracks-v1';
const annotationDefaults={version:1,show:true,autoPositive:true,selected:['nugent','PH','MENSTRUATION'],controlsOpen:false,numericStyle:'sticks',stickColor:'#246c99',stickWidth:2,fontSize:12,verticalScale:100,viewportHeight:null,numericGap:100,nugentHeight:100,phHeight:100,binarySize:100};
let annotationSettings={...annotationDefaults,selected:[...annotationDefaults.selected]},annotationLast=null;
const annotationIndex=new WeakMap();
function validateAnnotationSettings(s){
 if(s===undefined)return;
 if(!s||s.version!==1||typeof s.show!=='boolean'||typeof s.controlsOpen!=='boolean'||!Array.isArray(s.selected)||s.selected.length>annotationKeys.length||new Set(s.selected).size!==s.selected.length||s.selected.some(k=>!annotationKeys.includes(k)))throw Error('Invalid annotation track settings');
 for(const key of ['numericGap','nugentHeight','phHeight','binarySize'])if(s[key]!==undefined&&(!Number.isInteger(s[key])||s[key]<25||s[key]>300))throw Error('Invalid annotation '+key);
 if(s.autoPositive!==undefined&&typeof s.autoPositive!=='boolean')throw Error('Invalid automatic annotation selection');
 if(s.showDelivery!==undefined&&typeof s.showDelivery!=='boolean')throw Error('Invalid delivery outcome setting');
 if(s.verticalScale!==undefined&&(!Number.isInteger(s.verticalScale)||s.verticalScale<25||s.verticalScale>300))throw Error('Invalid annotation vertical scale');
 if(s.viewportHeight!==undefined&&s.viewportHeight!==null&&(!Number.isInteger(s.viewportHeight)||s.viewportHeight<80||s.viewportHeight>5000))throw Error('Invalid annotation viewport height');
 if(s.fontSize!==undefined&&(!Number.isInteger(s.fontSize)||s.fontSize<10||s.fontSize>24))throw Error('Invalid annotation font size');
 if(s.stickColor!==undefined&&(typeof s.stickColor!=='string'||!/^#[0-9a-f]{6}$/i.test(s.stickColor)))throw Error('Invalid annotation stick color');
 if(s.stickWidth!==undefined&&(!Number.isFinite(s.stickWidth)||s.stickWidth<.5||s.stickWidth>8||!Number.isInteger(s.stickWidth*2)))throw Error('Invalid annotation stick width');
 if(s.numericStyle!==undefined&&!['color','bars','sticks'].includes(s.numericStyle))throw Error('Invalid annotation numeric style');
}
try{const s=JSON.parse((typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).getItem(annotationPreference));validateAnnotationSettings(s);annotationSettings={...s,autoPositive:s.autoPositive??true}}catch{}
function annotationSnapshot(){return {...annotationSettings,selected:[...annotationSettings.selected]}}
function saveAnnotationSettings(){try{(typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).setItem(annotationPreference,JSON.stringify(annotationSettings))}catch{}}
function restoreAnnotationSettings(s){
 if(s===undefined)return;validateAnnotationSettings(s);
 annotationSettings={...s,autoPositive:s.autoPositive??false,selected:[...s.selected]};saveAnnotationSettings();
 if(typeof window!=='undefined')el('annotationControls').open=s.controlsOpen;
}
function annotationAsset(){return pregnancyAnnotationRows(BUNDLE_PACK.annotations?.[META.id]||null)}
const pregnancyRowAssets=new WeakMap();
// Display adapter only: the pinned supplement and scientific release stay intact.
function pregnancyAnnotationRows(asset){
 if(!asset?.subjectSummaries||asset.participantRows)return asset;
 if(pregnancyRowAssets.has(asset))return pregnancyRowAssets.get(asset);
 const summaries=new Map(asset.subjectSummaries.map(s=>[JSON.stringify([s.cohort,s.subject]),s]));
 const tracks=[...asset.tracks];
 for(const [group,fields] of Object.entries(pregnancyRowFields))for(const key of fields){
  const spec=asset[group+'Fields'].find(s=>s.key===key),baseline=group==='baseline';
  if(!spec)continue;
  tracks.push({track:'ZP_'+group.toUpperCase()+'_'+key.toUpperCase(),label:spec.label+' ['+(baseline?'Baseline':'Retrospective')+']',kind:'participant',summaryGroup:group,summaryKey:key,group:baseline?'Participant baseline — repeated for reference':'Delivery outcomes — retrospective',
   clarificationNote:baseline?'One participant baseline value repeated at each visit for reference; not a repeated measurement.':'Retrospective participant outcome repeated at each visit for reference; not known at the microbiome visit and not a repeated measurement.'});
 }
 const context=[['ZP_VISIT_ORDER','Visit order [Visit context]','numeric','order',''],['ZP_COLLECTION_DATE','Collection date [Visit context]','text','date',''],['ZP_ELAPSED_DAYS','Days since first collection [Visit context]','numeric','date','days'],['ZP_TIMING_FLAGS','Source timing flags [Visit context]','text','flags','']];
 for(const [track,label,kind,field,unit] of context)tracks.push({track,label,kind,field,unit,group:'Visit context — not additional clinical measurements',clarificationNote:'Released visit metadata; no clinical visit matching or inferred collection dates.'});
 const specimen=asset.specimenMeasurements,measurements=new Map((specimen?.records||[]).map(r=>[r.id,r.values]));
 tracks.push(...(specimen?.tracks||[]));
 const maternal=asset.maternalMeasurements,maternalValues=new Map((maternal?.records||[]).map(r=>[r.id,r.values]));
 tracks.push(...(maternal?.tracks||[]));
 const earliest=new Map(),groupKey=r=>JSON.stringify([r.cohort,r.subject]);
 for(const r of asset.records)if(r.subject&&r.date){const day=Date.parse(r.date);if(Number.isFinite(day))earliest.set(groupKey(r),Math.min(earliest.get(groupKey(r))??day,day))}
 const records=asset.records.map(r=>{
  const summary=summaries.get(groupKey(r)),values={...r.values,...measurements.get(r.id),...maternalValues.get(r.id)};
  for(const t of tracks.filter(t=>t.kind==='participant'))values[t.track]=summary?.[t.summaryGroup][t.summaryKey]||{value:null,status:'unavailable',raw:'',unit:'',field:'',source:'',sourceRecord:null,note:'No approved participant identity.',flags:[]};
  const date=r.date||null,elapsed=date&&r.subject?(Date.parse(date)-earliest.get(groupKey(r)))/86400000:null;
  const flags=r.values.ZP_GESTATIONAL_WEEKS.flags;
  for(const [key,value,field,unit,note] of [
   ['ZP_VISIT_ORDER',r.order,'order','','Released visit order; unordered observations remain unpositioned.'],
   ['ZP_COLLECTION_DATE',date,'date','','Source collection date; discrepancies remain flagged. No date imputation.'],
   ['ZP_ELAPSED_DAYS',Number.isFinite(elapsed)?elapsed:null,'date','days','Derived from recorded collection dates within this participant; not gestational-age matching.'],
   ['ZP_TIMING_FLAGS',flags.length?flags.join('; '):'No source timing flag recorded','flags','','Absence of a flag is not proof of accurate timing.']]){
   values[key]={value,status:value===null?'missing':value===0?'observed_zero':'observed_value',raw:value===null?'':String(value),unit,field,source:'Pinned participant annotation supplement '+asset.datasetRevision,sourceRecord:r.index,note,flags:[...flags]};
  }
  return {...r,values};
 });
 for(const t of tracks.filter(t=>t.kind==='numeric'&&!t.colorRange)){
  const values=records.map(r=>r.values[t.track].value).filter(Number.isFinite),lo=Math.min(...values),hi=Math.max(...values);
  t.colorRange=lo===hi?[lo-.5,hi+.5]:[lo,hi];
 }
 const result={...asset,participantRows:true,tracks,records,measurementNote:asset.measurementNote+' Visit-context, immune and maternal colors use each row’s full dataset observed range. Maternal clinical rows use exact participant and INTERGROWTH-day matches for ZAPPS only, with no imputation or carry-forward. PreSSMat definitions remain deferred. Immune values are signed net fluorescence, not concentrations; only one specimen per identified participant was assayed, so no longitudinal immune pairs are available.',scopeNote:asset.scopeNote+' Optional baseline and retrospective rows repeat participant values for reference, not new measurements. Visit context rows use released timing only. Maternal bleeding is a recall response, not a dated episode: enrollment asks about this pregnancy, follow-up since the last clinic visit; the extract does not identify the original form.'};
 pregnancyRowAssets.set(asset,result);return result;
}
function annotationRecord(asset,id){
 if(!annotationIndex.has(asset))annotationIndex.set(asset,new Map(asset.records.map(r=>[r.id,r])));
 return annotationIndex.get(asset).get(id);
}
// Display names stay independent of the frozen metadata supplement.
function annotationTrackLabel(track){return track.track==='MENSTRUATION'?'Menstrual bleeding':track.label}
function annotationChoiceSummary(model,asset,track){
 const label=annotationTrackLabel(track);
 if(track.kind!=='binary')return {label,title:track.clarificationNote||''};
 let positive=0,recorded=0,missing=0,invalid=0,unavailable=0,flagged=0;
 for(const point of model.points){
  const record=annotationRecord(asset,point.r.id);
  if(!record)throw Error('Missing audited annotation record: '+point.r.id);
  const cell=record.values[track.track];
  if(cell.status==='unavailable')unavailable++;
  else if(cell.status==='missing')missing++;
  else if(['observed_zero','observed_value'].includes(cell.status)&&[0,1].includes(cell.value)){
   recorded++;if(cell.value===1)positive++;
   if(cell.flags.length)flagged++;
  }else invalid++;
 }
 return {label:label+(positive?' ('+positive+')':''),positive,recorded,missing,invalid,unavailable,flagged,
  title:`${positive} positive observations out of ${recorded} with recorded yes/no values; ${missing} missing; ${invalid} invalid; ${unavailable} unavailable for this cohort. Counts cover all ${model.points.length} observations for this participant, regardless of the visible time range or state filters. Missing and invalid values are not negative responses. Positive observations are not necessarily separate events. ${flagged} recorded observations carry source quality/date flags or pending clarifications and remain included. ${track.clarificationNote||''}`};
}
function annotationSelectedKeys(model,asset,settings=annotationSettings){
 if(!asset)return [];
 const allowed=asset.tracks.filter(t=>t.summaryGroup!=='delivery'||settings.showDelivery);
 if(!settings.autoPositive)return settings.selected.filter(key=>allowed.some(t=>t.track===key));
 return allowed.filter(t=>annotationCoreKeys(asset).includes(t.track)||
  (t.kind==='binary'&&t.autoPositive!==false&&annotationChoiceSummary(model,asset,t).positive>0)).map(t=>t.track);
}
function annotationLabelMargin(model,asset,settings){
 const keys=annotationSelectedKeys(model,asset,settings),fontSize=annotationFontSize(settings);
 return Math.ceil(Math.max(0,...(asset?.tracks||[]).filter(t=>t.kind==='binary'&&keys.includes(t.track))
  .map(t=>annotationChoiceSummary(model,asset,t).label.length*fontSize*.65))+20);
}
function annotationUseManualSelection(){
 if(annotationLast)annotationSettings.selected=annotationSelectedKeys(annotationLast.model,annotationAsset());
 annotationSettings.autoPositive=false;
}
const annotationFlagLabels={maternal_bp_pair_unresolved:'Source review pending: systolic pressure is not greater than diastolic pressure; both measurements withheld, raw values retained',lsvf_baseline_newpartner_derivation:'Clarification pending: baseline new-partner derivation; detailed count is blank. Recorded yes/no response retained, including in positive counts',lsvf_zero_partners_condom_review:'Clarification pending: zero partners with condom use other than never; recall windows or skip rules may differ. Both recorded responses retained',lsvf_ph_suspected_code:'Suspected LSVF pH code; excluded from numeric plots and scaling; raw value and sample retained',no_exact_metadata_link:'No exact specimen metadata link; record retained',ph_above_9_source_review:'Source pH exceeds 9 (approximately 9.9); possible unusual value or undocumented code, requires source review; retained unchanged',NUGENT_DATE_MISMATCH:'Nugent date mismatch',DIA_DATE_MISMATCH:'Diary date mismatch',Diary_QUALITY_FLAG:'Diary quality flag',unresolved_source_conflict_99_vs_0:'Unresolved Nugent source conflict: raw 99 versus historical 0; no score assigned'};
function annotationClarificationList(asset){
 const pending=asset?.pendingClarifications||[];
 return pending.length?'<p><strong>Pending metadata clarifications</strong> — responses remain unchanged unless explicitly marked unavailable.</p><ul>'+pending.map(item=>'<li>'+esc(item.question)+' '+esc(item.handling)+'</li>').join('')+'</ul>':'';
}
function annotationValueText(cell,track,record){
 if(track.kind==='participant')return pregnancyValueText(cell);
 if(cell.status==='unavailable')return 'Unavailable for this cohort';
 if(cell.flags?.includes('maternal_bp_pair_unresolved'))return 'Unavailable: inconsistent systolic/diastolic pair (raw '+cell.raw+'; source review pending)';
 if(cell.flags?.includes('lsvf_ph_suspected_code'))return 'Unavailable—suspected code (raw '+cell.raw+'; exact code meaning unconfirmed)';
 if(cell.flags?.includes('unresolved_source_conflict_99_vs_0'))return 'Unavailable: unresolved Nugent source conflict (raw 99 versus historical 0); no score assigned';
 if(cell.status==='missing'){
  if(track.track==='MENSTRUATION')return record.diaryPresent?'No bleeding entry; other diary fields present (not a confirmed negative)':'No bleeding entry; no populated diary fields';
  return 'Missing / not recorded (not a negative response)';
 }
 if(cell.status==='invalid')return 'Invalid code: '+cell.raw+' (not interpreted)';
 if(track.kind==='category')return track.valueLabels?.[cell.value]??('Unrecognized category: '+cell.raw);
 if(track.kind==='binary')return ['yes','no'].includes(cell.raw)?(cell.value===0?'No':'Yes')+' (source: '+cell.raw+')':cell.value===0?'No (explicit 0)':'Yes (explicit 1)';
 if(track.kind==='flow')return annotationBleedingLabels[cell.value]+' (code '+cell.value+')';
 // Partner codes are retained literally: the audit validates 1–3, not a new recoding.
 if(track.kind==='partner')return 'Recorded partner-type code '+cell.value;
 return String(cell.value)+(track.kind==='numeric'&&track.unit?' '+track.unit:track.kind==='stress'?' / 5':track.kind==='nugent'?' / 10':'');
}
function annotationHover(point,track,cell,record){
 const lines=[point.r.subject+'-'+point.r.label,annotationTrackLabel(track)+': '+annotationValueText(cell,track,record),
  (record.day===null?(record.date?'Source collection date: '+record.date:'Collection date unavailable; '+(record.order===null?'unordered observation':'visit order '+record.order)):'Elapsed days from first observed visit: '+record.day)+' · '+record.cohort,
  'Source field: '+cell.field+' · '+cell.source+' record '+cell.sourceRecord];
 if(track.clarificationNote)lines.push(track.clarificationNote);
 if(cell.note)lines.push(cell.note);
 if(track.clinical&&cell.sourceRecords.length)lines.push('Exact clinical day: '+cell.gestationalDay+' · source rows: '+cell.sourceRecords.join(', ')+' · infant IDs: '+cell.infantIds.join(', '));
 if(cell.flags.length)lines.push('⚠ '+cell.flags.map(f=>annotationFlagLabels[f]||f).join('; '));
 else lines.push('No applicable flag recorded; not proof of error-free metadata.');
 if(track.track!=='nugent'&&record.diaryQC&&!['NA','0'].includes(record.diaryQC))lines.push('Diary QC note: '+record.diaryQC);
 if(record.comments&&!['NA','0'].includes(record.comments))lines.push('Source note: '+record.comments);
 return lines.map(esc).join('<br>');
}
function annotationAppearance(cell,track,record){
 if(cell.status==='unavailable')return {symbol:'square-x-open',color:'#8c969c'};
 if(cell.status==='invalid')return {symbol:'diamond-x',color:'#943f8c'};
 if(cell.status==='missing')return {symbol:track.track==='MENSTRUATION'&&record.diaryPresent?'diamond-open':'x',color:'#8c969c'};
 if(track.kind==='participant')return {symbol:track.summaryGroup==='baseline'?'square':'hexagon',color:track.summaryGroup==='baseline'?'#497082':'#8b5593'};
 if(track.kind==='text')return {symbol:'square',color:'#497082'};
 if(track.kind==='category')return {symbol:'square',color:annotationCategoryColors[(cell.value-1)%annotationCategoryColors.length]};
 if(track.kind==='binary')return {symbol:cell.value===0?'circle-open':'square',color:cell.value===0?'#497082':'#257a73'};
 if(track.kind==='flow')return {symbol:'square',color:annotationBleedingColors[cell.value]};
 if(track.kind==='partner')return {symbol:'square',color:['#d3dce5','#6885ac','#344f75'][cell.value-1]};
 // Fixed full measurement/code scale, independent of participant and visible time window.
 const domain=track.colorRange||[0,track.kind==='nugent'?10:track.kind==='ph'?14:5],f=Math.max(0,Math.min(1,(cell.value-domain[0])/(domain[1]-domain[0])));
 return {symbol:'square',color:`rgb(${Math.round(224-200*f)},${Math.round(240-132*f)},${Math.round(246-93*f)})`};
}
function annotationFontSize(settings=annotationSettings){return settings.fontSize??annotationDefaults.fontSize}
function annotationViewportHeight(contentHeight,settings=annotationSettings){return Math.min(contentHeight,settings.viewportHeight??contentHeight)}
function applyAnnotationHeight(){
 const scroll=el('annotationPlotScroll'),height=annotationViewportHeight(Number.parseFloat(el('annotationPlot').style.height));
 scroll.style.height=height+'px';
 const handle=el('annotationHeightHandle');handle.setAttribute('aria-valuenow',String(Math.round(height)));handle.setAttribute('aria-valuemax',String(Math.round(Number.parseFloat(el('annotationPlot').style.height))));
}
function annotationWrapLabel(text,fontSize,width){
 const limit=Math.max(8,Math.floor(width/(fontSize*.6)));
 return text.split('<br>').flatMap(part=>{
  const lines=[''];
  for(const word of part.split(' ')){
   const i=lines.length-1;
   if(lines[i]&&lines[i].length+1+word.length>limit)lines.push(word);
   else lines[i]+=(lines[i]?' ':'')+word;
  }
  return lines;
 }).join('<br>');
}
function annotationChart(model,asset,settings,selected,width,labelWidth=220){
 const fontSize=annotationFontSize(settings);
 const keys=annotationSelectedKeys(model,asset,settings);
 const tracks=asset.tracks.filter(t=>keys.includes(t.track)),points=model.points.filter(p=>p.x!==null);
 const traces=[],flagged=[],selectedCells=[],tickvals=[],ticktext=[],scales=[],titles=[];
 const style=settings.numericStyle||annotationDefaults.numericStyle;
 let cursor=-.5;
 const xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b),gaps=xs.slice(1).map((x,i)=>x-xs[i]);
 const barWidth=(gaps.length?Math.min(...gaps):1)*.7;
 const size=Math.max(5,Math.min(13,width/Math.max(1,points.length)*.65));
 for(const track of tracks){
  const entries=points.map(p=>{const r=annotationRecord(asset,p.r.id);if(!r)throw Error('Missing audited annotation record: '+p.r.id);return {p,r,c:r.values[track.track]}});
  const observed=({c})=>['observed_zero','observed_value'].includes(c.status)&&Number.isFinite(c.value);
  const numeric=style!=='color'&&['nugent','ph','numeric'].includes(track.kind),values=entries.filter(observed).map(e=>e.c.value);
  const row=cursor+.5;
  let position=()=>row,base=row,scale=null;
  if(numeric&&values.length){
   const low=Math.min(...values),high=Math.max(...values),constant=low===high;
   const lo=constant?(low<0?low-.5:Math.max(0,low-.5)):low,hi=constant?high+.5:high;
   const span=2.55*(track.kind==='numeric'?1:(settings[track.kind==='nugent'?'nugentHeight':'phHeight']??100)/100);
   const top=cursor+.25,bottom=top+span,unavailable=bottom+.55;
   base=bottom;
   position=e=>observed(e)?bottom-(e.c.value-lo)/(hi-lo)*(bottom-top):unavailable;
   const ticks=constant?[low]:[low,(low+high)/2,high];
   ticks.forEach(v=>{tickvals.push(bottom-(v-lo)/(hi-lo)*(bottom-top));ticktext.push(String(Number(v.toFixed(3))))});
   const titleGap=Math.max(...ticks.map(v=>String(Number(v.toFixed(3))).length))*fontSize*.65+18;
   titles.push({name:'annotationAxisTitle-'+track.track,text:annotationWrapLabel(esc(annotationTrackLabel(track)),fontSize,labelWidth-titleGap),xref:'paper',x:0,xshift:-titleGap,xanchor:'right',yref:'y',y:(top+bottom)/2,yanchor:'middle',align:'right',showarrow:false,font:{size:fontSize,color:'#203d4b'}});
   tickvals.push(unavailable);ticktext.push('unavailable');
   scale={track:track.track,observed:[low,high],domain:[lo,hi],baseline:lo,constant,span};scales.push(scale);
  }else{
   const participantValue=track.kind==='participant'?annotationRecord(asset,model.points[0].r.id).values[track.track]:null;
   tickvals.push(row);ticktext.push(annotationChoiceSummary(model,asset,track).label+(participantValue?'<br>'+esc(pregnancyValueText(participantValue)):numeric?' (no observed values)':track.kind==='nugent'?' (0–10)':track.kind==='ph'?' (0–14)':track.kind==='stress'?' (1–5)':''));
  }
  const styles=entries.map(({c,r})=>annotationAppearance(c,track,r));
  const positions=entries.map(position),glyphSize=(track.kind==='binary'||track.track==='MENSTRUATION')?size*(settings.binarySize??100)/100:size;
  const trace={type:'scatter',mode:'markers',name:annotationTrackLabel(track),meta:{annotationTrack:track.track,annotationNumericScale:scale},x:points.map(p=>p.x),y:positions,customdata:points.map(p=>p.r.index),hovertext:entries.map(({p,c,r})=>annotationHover(p,track,c,r)),hovertemplate:'%{hovertext}<extra></extra>',hoverlabel:{bgcolor:'#fff',font:{color:'#203d4b',size:fontSize}},marker:{symbol:styles.map((s,i)=>scale&&observed(entries[i])?'circle':s.symbol),color:styles.map((s,i)=>scale&&observed(entries[i])?(style==='sticks'?(settings.stickColor??annotationDefaults.stickColor):'#246c99'):s.color),size:entries.map(e=>scale&&observed(e)?5:glyphSize),line:{width:1}},showlegend:false};
  if(scale){
   const valid=entries.map((e,i)=>({e,i})).filter(({e})=>observed(e));
   if(style==='bars')traces.push({type:'bar',name:annotationTrackLabel(track)+' bars',meta:{annotationNumericMarks:track.track},x:valid.map(({e})=>e.p.x),y:valid.map(({i})=>positions[i]-base),base:valid.map(()=>base),width:barWidth,marker:{color:'#246c99',line:{color:'#246c99',width:.5}},customdata:valid.map(({e})=>e.p.r.index),hovertext:valid.map(({i})=>trace.hovertext[i]),hovertemplate:trace.hovertemplate,hoverlabel:trace.hoverlabel,showlegend:false});
   else traces.push({type:'scatter',mode:'lines',name:annotationTrackLabel(track)+' sticks',meta:{annotationNumericMarks:track.track},x:valid.flatMap(({e})=>[e.p.x,e.p.x,null]),y:valid.flatMap(({i})=>[base,positions[i],null]),line:{color:settings.stickColor??annotationDefaults.stickColor,width:settings.stickWidth??annotationDefaults.stickWidth},hoverinfo:'skip',showlegend:false});
  }
  traces.push(trace);
  entries.forEach(({p,c},i)=>{
   const entry={x:p.x,y:positions[i],id:p.r.index,hover:trace.hovertext[i],size:glyphSize};
   if(c.flags.length)flagged.push(entry);
   if(p.r.index===selected)selectedCells.push(entry);
  });
  // Independent numeric heights and inter-panel gap; measurement domains stay fixed.
  const next=tracks[tracks.indexOf(track)+1];
  const adjacentNumeric=next&&['nugent','ph','numeric'].includes(next.kind);
  cursor+=scale ? scale.span+(adjacentNumeric ? .55+.45*(settings.numericGap??100)/100 : 1.35) : 1;
 }
 for(const [entries,color,symbol,extra,name] of [[selectedCells,'#111111','circle-open',7,'Selected visit'],[flagged,'#bc6100','square-open',4,'Metadata quality flag']]){
  traces.push({type:'scatter',mode:'markers',name,meta:{annotationOverlay:name},x:entries.map(p=>p.x),y:entries.map(p=>p.y),customdata:entries.map(p=>p.id),hovertext:entries.map(p=>p.hover),hovertemplate:'%{hovertext}<extra></extra>',hoverlabel:{bgcolor:'#fff',font:{color:'#203d4b',size:fontSize}},marker:{symbol,size:entries.map(p=>p.size+extra),color,line:{width:1.7}},showlegend:false});
 }
 const binaryLabels=new Set(tracks.filter(t=>t.kind==='binary').map(t=>annotationChoiceSummary(model,asset,t).label));
 const labels=ticktext.map(t=>binaryLabels.has(t)?t:annotationWrapLabel(t,fontSize,labelWidth));
 const rowHeight=Math.max(29*fontSize/12,...[...labels,...titles.map(t=>t.text+'<br>')].map(t=>t.split('<br>').length*fontSize*1.2+8));
 return {tracks,traces,scales,titles,height:Math.max(80,40+(Math.max(110,(cursor+.5)*rowHeight+40)-40)*(settings.verticalScale??100)/100),yaxis:{range:[cursor,-.5],tickmode:'array',tickvals,ticktext:labels,tickfont:{size:fontSize},fixedrange:true,showgrid:true,gridcolor:'#edf1f3',zeroline:false}};
}
// CSV keeps all participant rows and the selected metadata columns, even when the
// chart is temporarily hidden. Numeric zero is never converted to a blank.
function annotationTrackCsvColumns(model,asset,settings){
 const keys=annotationSelectedKeys(model,asset,settings);
 const tracks=asset?.tracks.filter(t=>keys.includes(t.track))||[];
 if(!tracks.length)return {fields:[],rows:model.points.map(()=>[])};
 const suffixes=['value','status','raw','interpretation','quality_flags','source','source_field','source_record','quality_flag_details','clarification_note'];
 const clinicalSuffixes=['unit','source_records','source_sha256','gestational_day','match_method','infant_ids','source_note'];
 const fields=['annotation_dataset_revision','annotation_audit_sha256','annotation_cohort','annotation_source_day','annotation_diary_present','annotation_bleeding_context',...tracks.flatMap(t=>[...suffixes,...(t.clinical?clinicalSuffixes:[])].map(s=>'annotation_'+t.track+'_'+s))];
 const rows=model.points.map(p=>{
  const r=annotationRecord(asset,p.r.id);if(!r)throw Error('Missing audited annotation record: '+p.r.id);
  return [asset.datasetRevision,asset.auditManifestSha256,r.cohort,r.day??'',r.diaryPresent,r.bleedingContext??'',...tracks.flatMap(t=>{
   const c=r.values[t.track];
   return [c.value??'',c.status,c.raw??'',annotationValueText(c,t,r),c.flags.join('; '),c.source,c.field,c.sourceRecord,c.flags.map(f=>annotationFlagLabels[f]||f).join('; '),t.clarificationNote||'',...(t.clinical?[c.unit,c.sourceRecords.join('; '),c.sourceSha256,c.gestationalDay??'',c.matchMethod,c.infantIds.join('; '),c.note]:[])];
  })];
 });
 return {fields,rows};
}
// Keep the original axis style when the live trajectory hides its time labels.
function annotationTimeAxis(layout){
 return JSON.parse(JSON.stringify(layout.meta?.annotationTimeAxis||layout.xaxis));
}
function annotationMainAxisUpdate(layout,visible){
 const axis=annotationTimeAxis(layout);
 return {'margin.b':visible?6:65,'xaxis.title':visible?{...axis.title,text:''}:axis.title||{},'xaxis.showticklabels':visible?false:axis.showticklabels!==false,'xaxis.ticks':visible?'':axis.ticks||''};
}
// Extend only the selected-visit guide through the outer plot margins. Paper
// coordinates avoid y-axis clipping; the x axis still clips off-screen visits.
function annotationJoinedGuide(point,layout,edge){
 const height=Math.max(1,layout.height-layout.margin.t-layout.margin.b);
 return trajectorySelectedVisitGuide(point).map(s=>({...s,yref:'paper',
  y0:edge==='bottom'?-(layout.margin.b+.5)/height:0,
  y1:edge==='top'?1+(layout.margin.t+.5)/height:1}));
}
// Use Plotly's resolved numeric time ticks, so joins follow pan/zoom and resize
// rather than introducing a second tick-spacing rule.
const annotationTimeGridColor='#edf1f3';
function annotationTimeGridValues(axis){
 const range=axis?.range;if(!range||range.length!==2)return [];
 const low=Math.min(...range),high=Math.max(...range);
 if(!Number.isFinite(low)||!Number.isFinite(high))return [];
 if(axis.tickmode==='array')return [...new Set(axis.tickvals||[])].filter(x=>Number.isFinite(x)&&x>=low&&x<=high);
 const step=axis.dtick,origin=Number.isFinite(axis.tick0)?axis.tick0:0;
 if(!Number.isFinite(step)||step<=0)return [];
 const first=Math.ceil((low-origin)/step-1e-10),last=Math.floor((high-origin)/step+1e-10);
 if(last-first>2000)return [];
 return Array.from({length:Math.max(0,last-first+1)},(_,i)=>Number((origin+(first+i)*step).toPrecision(14)));
}
function annotationTimeGridShapes(values,y0,y1,xref='x'){
 return values.map(x=>({name:'annotation-time-grid-join',type:'line',xref,yref:'paper',x0:x,x1:x,y0,y1,layer:'below',line:{color:annotationTimeGridColor,width:1}}));
}
let annotationGridPending=false;
async function syncAnnotationTimeGrid(){
 if(typeof window==='undefined'||annotationGridPending)return;
 annotationGridPending=true;
 try{
  const visible=annotationSettings.show&&annotationLast&&!el('annotationPlotScroll').hidden;
  for(const [id,edge] of [['trajectoryPlot','bottom'],['annotationPlot','top']]){
   const plot=el(id),layout=plot.layout;if(!layout)continue;
   const height=Math.max(1,layout.height-layout.margin.t-layout.margin.b);
   const values=visible?annotationTimeGridValues(plot._fullLayout?.xaxis):[];
   const joins=annotationTimeGridShapes(values,edge==='bottom'?-(layout.margin.b+.5)/height:1,edge==='top'?1+(layout.margin.t+.5)/height:0);
   const shapes=[...joins,...(layout.shapes||[]).filter(s=>s.name!=='annotation-time-grid-join')];
   if(JSON.stringify(shapes)!==JSON.stringify(layout.shapes))await Plotly.relayout(plot,{shapes});
  }
 }finally{annotationGridPending=false}
}
// Compose a second subplot on a copy. Never resize or relayout the live figure.
// Axes 3–6 belong to quality tracks; 7 is the endpoint abundance axis; 8 is metadata.
function annotationTracksImageExport(figure,model,asset,settings,selected,timeAxis){
 if(!asset||!settings.show)return figure;
 const layout=JSON.parse(JSON.stringify(figure.layout));
 const labelExtra=Math.max(0,annotationLabelMargin(model,asset,settings)-layout.margin.l);
 layout.margin.l+=labelExtra;
 const exportWidth=figure.width+labelExtra;
 const chart=annotationChart(model,asset,settings,selected,exportWidth-layout.margin.l-layout.margin.r,layout.margin.l-20);
 if(!chart.tracks.length)return figure;
 const gap=12,added=chart.height+gap,area=figure.height-layout.margin.t-layout.margin.b;
 const total=area+added,offset=added/total,map=y=>offset+(1-offset)*y;
 for(const [key,axis] of Object.entries(layout)){
  if(/^yaxis\d*$/.test(key)&&!axis.overlaying)axis.domain=(axis.domain||[0,1]).map(map);
  if(/^xaxis\d*$/.test(key)&&axis.anchor==='free'&&Number.isFinite(axis.position))axis.position=map(axis.position);
 }
 for(const a of layout.annotations||[]){
  if(a.yref==='paper'&&a.name!=='trajectoryExportInterpretation')a.y=map(a.y);
 }
 for(const s of layout.shapes||[])if(s.yref==='paper'){s.y0=map(s.y0);s.y1=map(s.y1)}
 layout.xaxis8={...annotationTimeAxis(layout),domain:[...layout.xaxis.domain],anchor:'y8',range:[...layout.xaxis.range],autorange:false,showticklabels:true,showgrid:true,zeroline:false};
 layout.xaxis.title={text:''};layout.xaxis.showticklabels=false;layout.xaxis.ticks='';
 const categoryLegend=chart.tracks.filter(t=>t.kind==='category').map(t=>esc(t.label)+': '+Object.entries(t.valueLabels).map(([code,label])=>`<span style="color:${annotationCategoryColors[(Number(code)-1)%annotationCategoryColors.length]}">■</span> ${esc(label)}`).join(' · '));
 const footerExtra=Math.max(0,210+categoryLegend.length*16-layout.margin.b);layout.margin.b+=footerExtra;
 const interpretation=layout.annotations.find(a=>a.name==='trajectoryExportInterpretation');if(interpretation)interpretation.yshift=-125-categoryLegend.length*16;
 layout.yaxis8={...chart.yaxis,domain:[0,chart.height/total],anchor:'x8'};
 layout.annotations.push(...chart.titles.map(t=>({...t,x:layout.xaxis.domain[0],yref:'y8'})));

 layout.annotations.push({name:'annotationExportKey',xref:'paper',yref:'paper',x:0,y:0,xshift:10-layout.margin.l,yshift:-65,xanchor:'left',yanchor:'top',showarrow:false,align:'left',font:{size:10},text:(chart.scales.length?(asset.subjectSummaries?'Gestational age (weeks)':'Nugent / pH')+': subject observed ranges; baseline not necessarily zero<br>':'')+'●/■ recorded · ○ explicit no · × missing · ◇ no bleeding entry, other diary data present<br>Purple crossed diamond: invalid / suspected code · Orange outline: source quality/date flag · Black circle: selected visit'+(chart.tracks.some(t=>t.track==='MENSTRUATION')?'<br>Menstrual bleeding: '+Object.entries(annotationBleedingColors).map(([code,color])=>`<span style="color:${color}">■</span> ${annotationBleedingLabels[code]}`).join(' · '):'')});
 if(categoryLegend.length)layout.annotations.find(a=>a.name==='annotationExportKey').text+='<br>'+categoryLegend.join('<br>');
 if(asset.subjectSummaries)layout.annotations.find(a=>a.name==='annotationExportKey').text='Gestational age in decimal weeks; numeric visit rows use subject observed ranges for Bars / Sticks; baseline not necessarily zero.<br>●/■ recorded · ○ explicit no · × missing · crossed square: unavailable · purple crossed diamond: unresolved value · orange outline: source timing or assay flag · black circle: selected visit'+(chart.tracks.some(t=>t.kind==='participant')?'<br>Baseline squares and retrospective hexagons repeat one participant value for reference; not repeated measurements.<br>Retrospective outcomes were not known at microbiome visits.':'')+(chart.tracks.some(t=>t.group.startsWith('Visit context'))?'<br>Visit context rows describe released timing, not additional clinical measurements.':'')+(chart.tracks.some(t=>t.track.startsWith('ZP_IMMUNE_'))?'<br>Immune rows: signed net fluorescence (not concentration), finite replicate means without imputation; one assayed specimen per identified participant.<br>Missing visits are not negative tests. Plate, replicate and range cautions are retained in hover text and CSV.':'');
 if(chart.tracks.some(t=>t.clinical))layout.annotations.find(a=>a.name==='annotationExportKey').text+='<br>Maternal rows: ZAPPS only; exact participant and INTERGROWTH-day match. PreSSMat definitions deferred. No imputation or carry-forward.<br>Bleeding response recall: this pregnancy at enrollment; since the last clinic visit at follow-up. Original form is unspecified; positive responses are not dated episodes.<br>Inconsistent blood-pressure pairs are withheld; raw values and all clinical source rows remain in CSV.';
 // One stroke spans both subplots and their gap in vector and raster exports.
 layout.shapes=layout.shapes.filter(s=>s.name!=='selected-visit-guide'&&s.name!=='annotation-time-grid-join');
 const gridValues=annotationTimeGridValues(timeAxis||layout.xaxis);
 layout.xaxis.gridcolor=layout.xaxis8.gridcolor=annotationTimeGridColor;
 layout.xaxis.gridwidth=layout.xaxis8.gridwidth=1;
 layout.shapes.unshift(...annotationTimeGridShapes(gridValues,layout.yaxis8.domain[1],layout.yaxis.domain[0],'x8'));
 layout.shapes.push(...trajectorySelectedVisitGuide(model.points.find(p=>p.r.index===selected)).map(s=>({...s,xref:'x8',yref:'paper',y0:layout.yaxis8.domain[0],y1:layout.yaxis.domain[1]})));
 return {...figure,width:exportWidth,height:figure.height+added+footerExtra,layout,data:[...figure.data,...chart.traces.map(t=>({...t,xaxis:'x8',yaxis:'y8'}))]};
}
async function renderAnnotationTracks(model,layout){
 if(typeof window==='undefined')return;
 const section=el('trajectoryAnnotations'),asset=annotationAsset();section.hidden=!asset;
 renderPregnancySummary(model,asset);
 if(!asset){annotationLast=null;return}
 annotationLast={model,layout};
 const keys=annotationSelectedKeys(model,asset);
 el('annotationAutoPositive').checked=!!annotationSettings.autoPositive;
 for(const [id,key] of [['annotationNumericGap','numericGap'],['annotationNugentHeight','nugentHeight'],['annotationPhHeight','phHeight'],['annotationBinarySize','binarySize']]){el(id).value=annotationSettings[key]??100;el(id).disabled=key!=='binarySize'&&(annotationSettings.numericStyle||annotationDefaults.numericStyle)==='color'}
 const fontSize=annotationFontSize();el('annotationFontSize').value=fontSize;
 section.style.setProperty('--annotation-font-size',fontSize+'px');
 el('annotationShow').checked=annotationSettings.show;el('annotationVerticalScale').value=annotationSettings.verticalScale??100;
 const numericStyle=annotationSettings.numericStyle||annotationDefaults.numericStyle;
 el('annotationNumericStyle').value=numericStyle;
 el('annotationStickColor').value=annotationSettings.stickColor??annotationDefaults.stickColor;
 el('annotationStickWidth').value=annotationSettings.stickWidth??annotationDefaults.stickWidth;
 for(const id of ['annotationStickColor','annotationStickWidth'])el(id).disabled=numericStyle!=='sticks';
 const measurementKey=el('annotationMeasurementKey');
 if(!measurementKey.dataset.original)measurementKey.dataset.original=measurementKey.textContent;
 measurementKey.textContent=asset.datasetId==='lsvf-v3v4-20241111'?'Bars / Sticks use separate subject-observed Nugent and pH ranges; compare numeric values across subjects, not mark heights. Colors uses Nugent 0–10 and pH 0–14. New-partner responses use a filled teal square for explicit yes and an open circle for explicit no. Questionnaire categories retain their source text; the color key below applies only to selected tracks.':measurementKey.dataset.original;
 if(asset.measurementNote)measurementKey.textContent=asset.measurementNote;
 const pregnancy=!!asset.subjectSummaries;
 el('annotationNumericLabel').textContent=pregnancy?'Numeric visit rows':'Nugent / pH';
 el('annotationNumericStyle').setAttribute('aria-label',pregnancy?'Numeric visit row representation':'Nugent and pH representation');
 for(const id of ['annotationNumericGap','annotationNugentHeight','annotationPhHeight','annotationBinarySize','annotationAutoPositive'])el(id).closest('label').hidden=pregnancy;
 el('annotationSymbolKey').textContent=pregnancy?'●/■ recorded · ○ explicit no · × missing · crossed square: unavailable · purple crossed diamond: unresolved value · baseline square / retrospective hexagon: one participant value repeated for reference · orange outline: source timing or assay flag · black circle: selected visit':'●/■ recorded · ○ explicit no · × missing · ◇ no bleeding entry with other diary data · ⊠ invalid / suspected code · □ quality flag';
 el('annotationDatasetScope').textContent=asset.scopeNote||'HMP/U01 diary and clinical annotations. U01 Nugent scores use the reviewed specimen crosswalk. Medication, clinical diagnosis and qPCR tracks await separate interpretation rules. These annotations do not alter assignments or quality-preview thresholds.';
 el('annotationClarifications').innerHTML=annotationClarificationList(asset);
 const selected=model.points.find(p=>p.r.index===participant.record),record=selected&&annotationRecord(asset,selected.r.id);
 const list=el('annotationChoices');
 if(list.dataset.dataset!==META.id){
  list.innerHTML=[...new Set(asset.tracks.map(t=>t.group))].map(group=>`<fieldset><legend>${group==='Core'?'Core measurements':group}</legend>${group==='Delivery outcomes — retrospective'?'<p>Enable “Show delivery outcomes (retrospective)” in Participant summary above to select these rows. They were not known at the microbiome visits.</p>':''}${asset.tracks.filter(t=>t.group===group).map(t=>`<label><input type="checkbox" data-annotation-track="${esc(t.track)}"> <span data-annotation-label>${esc(annotationTrackLabel(t))}</span></label>`).join('')}</fieldset>`).join('');list.dataset.dataset=META.id;
 }
 for(const input of list.querySelectorAll('[data-annotation-track]')){
  const track=asset.tracks.find(t=>t.track===input.dataset.annotationTrack),summary=annotationChoiceSummary(model,asset,track),label=input.closest('label');
  input.checked=keys.includes(track.track);
  input.disabled=track.summaryGroup==='delivery'&&!annotationSettings.showDelivery;
  label.querySelector('[data-annotation-label]').textContent=summary.label;label.title=summary.title;
 }
 const plot=el('annotationPlot'),visible=annotationSettings.show&&keys.length>0;
 const bleedingLegend=el('annotationBleedingLegend');bleedingLegend.hidden=!visible||!keys.includes('MENSTRUATION');
 el('annotationCategoryLegend').innerHTML=asset.tracks.filter(t=>t.kind==='category'&&keys.includes(t.track)).map(t=>'<p>'+esc(t.label)+': '+Object.entries(t.valueLabels).map(([code,label])=>`<span class="annotationSwatch" style="background:${annotationCategoryColors[(Number(code)-1)%annotationCategoryColors.length]}" aria-hidden="true"></span>${esc(label)}`).join(' · ')+'</p>').join('');
 bleedingLegend.innerHTML='Menstrual bleeding: '+Object.entries(annotationBleedingColors).map(([code,color])=>`<span class="annotationSwatch" style="background:${color}" aria-hidden="true"></span>${annotationBleedingLabels[code]}`).join(' ');
 el('annotationHeightHandle').hidden=!visible;el('annotationPlotScroll').hidden=!visible;el('annotationEmpty').hidden=visible;
 el('annotationEmpty').textContent=annotationSettings.show?'No tracks selected. Open Track selection to choose tracks.':'Annotation tracks are hidden.';
 el('annotationVisitTitle').textContent=selected?selected.r.subject+'-'+selected.r.label+' · annotation values':'Selected visit annotation values';
 el('annotationVisitValues').innerHTML=record?asset.tracks.filter(t=>keys.includes(t.track)).map(t=>{const c=record.values[t.track];return `<tr><th>${esc(annotationTrackLabel(t))}</th><td>${esc(annotationValueText(c,t,record))}</td><td>${c.flags.length?'⚠ '+esc(c.flags.map(f=>annotationFlagLabels[f]||f).join('; ')):'No flag recorded'}${t.clarificationNote?'<br>'+esc(t.clarificationNote):''}</td></tr>`}).join(''):'';
 const axisPlot=el('trajectoryPlot'),axisLayout=axisPlot.layout||layout;
 const axisUpdate=annotationMainAxisUpdate(axisLayout,visible);
 const joinedLayout={...axisLayout,margin:{...axisLayout.margin,b:axisUpdate['margin.b']}};
 const guide=visible?annotationJoinedGuide(selected,joinedLayout,'bottom'):trajectorySelectedVisitGuide(selected);
 axisUpdate.shapes=[...(axisLayout.shapes||[]).filter(s=>s.name!=='selected-visit-guide'),...guide];
 if(JSON.stringify(axisLayout.shapes)!==JSON.stringify(axisUpdate.shapes)||axisLayout.margin.b!==axisUpdate['margin.b']||axisLayout.xaxis.showticklabels!==axisUpdate['xaxis.showticklabels']||axisLayout.xaxis.title?.text!==axisUpdate['xaxis.title'].text)await Plotly.relayout(axisPlot,axisUpdate);
 if(!visible){await syncAnnotationTimeGrid();return}
 const main=el('trajectoryPlot'),live=main.layout||layout;
 const left=Math.max(live.margin.l,annotationLabelMargin(model,asset,annotationSettings));
 // Share the wider margin with the trajectory so visit columns stay aligned.
 // Retain a usable plotting area at narrow widths; wrappers scroll horizontally.
 const minimumWidth=Math.max(560,left+live.margin.r+160);
 main.style.minWidth=minimumWidth+'px';plot.style.minWidth=minimumWidth+'px';
 const width=Math.max(minimumWidth,main.clientWidth);
 if(left!==live.margin.l||width!==live.width){
  await Plotly.relayout(main,{'margin.l':left,width});
  const quality=el('trajectoryTracksPlot');
  if(quality.data)await Plotly.relayout(quality,{'margin.l':left,width});
 }
 const chart=annotationChart(model,asset,annotationSettings,participant.record,live.width-live.margin.l-live.margin.r,live.margin.l-20);
 const plotHeight=chart.height+41;
 plot.style.height=plotHeight+'px';applyAnnotationHeight();
 await Plotly.react(plot,chart.traces,{width:live.width,height:plotHeight,margin:{...live.margin,t:4,b:65},font:{size:fontSize,color:'#203d4b'},showlegend:false,dragmode:'pan',uirevision:trajectoryContext,
  xaxis:{...annotationTimeAxis(live),domain:live.xaxis.domain,range:[...live.xaxis.range],autorange:false,showgrid:true,zeroline:false,showticklabels:true,gridcolor:annotationTimeGridColor,gridwidth:1},
  annotations:chart.titles.map(t=>({...t,x:live.xaxis.domain[0]})),
  yaxis:chart.yaxis,barmode:'overlay',
  shapes:annotationJoinedGuide(selected,{height:plotHeight,margin:{t:4,b:65}},'top')
 },{responsive:true,scrollZoom:true,displaylogo:false,displayModeBar:false});
 await syncAnnotationTimeGrid();
 if(!main._annotationGridEvents){main._annotationGridEvents=true;main.on('plotly_afterplot',syncAnnotationTimeGrid)}
 if(!plot._annotationEvents){
  plot._annotationEvents=true;
  plot.on('plotly_afterplot',syncAnnotationTimeGrid);
  plot.on('plotly_click',event=>{const id=event.points?.[0]?.customdata;if(Number.isInteger(id))chooseParticipantRecord(id)});
  plot.on('plotly_relayout',event=>{
   if(event['xaxis.autorange']){trajectoryRanges=null;renderSubjectTrajectory();return}
   if(Object.keys(event).some(k=>/^xaxis\.range/.test(k))){
    const main=el('trajectoryPlot'),range=[...plot.layout.xaxis.range];
    if(JSON.stringify(main.layout.xaxis.range)!==JSON.stringify(range))Plotly.relayout(main,{'xaxis.range':range});
   }
  });
 }
}
function syncAnnotationRange(range){
 if(typeof window==='undefined')return;
 const plot=el('annotationPlot');
 if(annotationLast&&plot.data&&JSON.stringify(plot.layout.xaxis.range)!==JSON.stringify(range))return Plotly.relayout(plot,{'xaxis.range':[...range]});
}
function installAnnotationTracks(){
 if(typeof window==='undefined')return;
 for(const [source,target] of [['trajectoryScroll','annotationPlotScroll'],['annotationPlotScroll','trajectoryScroll']])el(source).addEventListener('scroll',()=>{if(annotationSettings.show&&el(target).scrollLeft!==el(source).scrollLeft)el(target).scrollLeft=el(source).scrollLeft});
 const redraw=()=>{saveAnnotationSettings();if(annotationLast){const {model,layout}=annotationLast;trajectoryQueue=trajectoryQueue.catch(()=>{}).then(()=>renderAnnotationTracks(model,layout))}};
 for(const [id,key] of [['annotationNumericGap','numericGap'],['annotationNugentHeight','nugentHeight'],['annotationPhHeight','phHeight'],['annotationBinarySize','binarySize']]){
  const input=el(id);input.oninput=()=>{const value=Number(input.value);if(Number.isInteger(value)&&value>=25&&value<=300){annotationSettings[key]=value;redraw()}};
  input.onchange=()=>{input.value=annotationSettings[key]??100};
 }
 const scaleInput=el('annotationVerticalScale');
 scaleInput.oninput=()=>{const n=Number(scaleInput.value);if(Number.isInteger(n)&&n>=25&&n<=300){annotationSettings.verticalScale=n;redraw()}};
 scaleInput.onchange=()=>{scaleInput.value=annotationSettings.verticalScale??100};
 const handle=el('annotationHeightHandle');let drag=null;
 const setHeight=height=>{annotationSettings.viewportHeight=height===null?null:Math.round(Math.max(80,Math.min(5000,height)));applyAnnotationHeight()};
 handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();drag={id:event.pointerId,y:event.clientY,height:el('annotationPlotScroll').getBoundingClientRect().height};handle.setPointerCapture(event.pointerId)});
 handle.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)setHeight(drag.height+event.clientY-drag.y)});
 const endDrag=event=>{if(drag?.id!==event.pointerId)return;drag=null;saveAnnotationSettings();if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId)};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(event,endDrag);
 handle.addEventListener('dblclick',()=>{setHeight(null);saveAnnotationSettings()});
 handle.addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();
  const step=event.shiftKey?50:20,current=el('annotationPlotScroll').getBoundingClientRect().height;
  setHeight(event.key==='End'?null:event.key==='Home'?80:current+(event.key==='ArrowDown'?step:-step));saveAnnotationSettings();
 });
 const fontInput=el('annotationFontSize');
 fontInput.oninput=()=>{const n=Number(fontInput.value);if(Number.isInteger(n)&&n>=10&&n<=24){annotationSettings.fontSize=n;redraw()}};
 fontInput.onchange=()=>{fontInput.value=annotationFontSize()};
 el('annotationAutoPositive').onchange=()=>{if(el('annotationAutoPositive').checked)annotationSettings.autoPositive=true;else annotationUseManualSelection();redraw()};
 el('annotationShow').onchange=()=>{annotationSettings.show=el('annotationShow').checked;redraw()};
 el('annotationNumericStyle').onchange=()=>{annotationSettings.numericStyle=el('annotationNumericStyle').value;redraw()};
 el('annotationStickColor').oninput=()=>{annotationSettings.stickColor=el('annotationStickColor').value;redraw()};
 const stickWidth=el('annotationStickWidth');
 stickWidth.oninput=()=>{const n=Number(stickWidth.value);if(stickWidth.value&&Number.isFinite(n)&&n>=.5&&n<=8&&Number.isInteger(n*2)){annotationSettings.stickWidth=n;redraw()}};
 stickWidth.onchange=()=>{stickWidth.value=annotationSettings.stickWidth??annotationDefaults.stickWidth};
 el('annotationChoices').addEventListener('change',event=>{
  const key=event.target.dataset.annotationTrack;if(!annotationKeys.includes(key))return;
  annotationUseManualSelection();
  annotationSettings.selected=annotationKeys.filter(k=>k===key?event.target.checked:annotationSettings.selected.includes(k));redraw();
 });
 el('annotationControls').open=annotationSettings.controlsOpen;
 el('annotationControls').addEventListener('toggle',()=>{annotationSettings.controlsOpen=el('annotationControls').open;saveAnnotationSettings()});
 for(const [id,keys] of [['annotationCore',null],['annotationAll',annotationKeys],['annotationNone',[]]])el(id).onclick=()=>{annotationSettings.autoPositive=false;annotationSettings.selected=[...(keys??annotationCoreKeys(annotationAsset()))];redraw()};
}

// Baseline and retrospective attributes have participant grain, independently
// of the selected visit, selected state, time window, and track visibility.
const pregnancySummaryIndex=new WeakMap();
function pregnancySummary(model,asset){
 if(!asset?.subjectSummaries)return null;
 const first=model.points[0]?.r;if(!first?.subject)return null;
 if(!pregnancySummaryIndex.has(asset))pregnancySummaryIndex.set(asset,new Map(asset.subjectSummaries.map(s=>[JSON.stringify([s.cohort,s.subject]),s])));
 return pregnancySummaryIndex.get(asset).get(JSON.stringify([first.cohort,first.subject]))||null;
}
function pregnancyValueText(cell){
 if(cell.status==='unavailable')return 'Unavailable for this cohort';
 if(cell.status==='missing')return 'Not recorded';
 if(cell.status==='invalid')return 'Unresolved source code';
 return (typeof cell.value==='number'?String(Number(cell.value.toFixed(2))):cell.value)+(cell.unit?' '+cell.unit:'');
}
function pregnancySourceText(cell){
 return [cell.status,cell.source?cell.source+' · row '+cell.sourceRecord+' · '+cell.field:'',cell.raw!==''?'Raw / derived value: '+cell.raw:'',cell.note].filter(Boolean).join('\n');
}
function renderPregnancySummary(model,asset){
 const section=el('participantBaselineSummary'),summary=pregnancySummary(model,asset);section.hidden=!summary;
 if(!summary){section.innerHTML='';return}
 const fields=group=>asset[group+'Fields'].map(spec=>{const cell=summary[group][spec.key];return '<div><dt>'+esc(spec.label)+'</dt><dd title="'+esc(pregnancySourceText(cell)).replaceAll('"','&quot;')+'">'+esc(pregnancyValueText(cell))+'</dd></div>'}).join('');
 section.innerHTML='<h3>Participant summary · '+esc(summary.cohort)+'</h3><p>Baseline attributes were not measured at every microbiome visit. Hover over a value for its source and derivation. Use Track selection below the plot to show these values as labelled reference rows.</p><dl class="pregnancySummaryGrid">'+fields('baseline')+'</dl><label><input id="pregnancyShowDelivery" type="checkbox" '+(annotationSettings.showDelivery?'checked':'')+'> Show delivery outcomes (retrospective)</label><div id="pregnancyDelivery" '+(annotationSettings.showDelivery?'':'hidden')+'><p>These outcomes were known after pregnancy. Study selection groups and source phenotypes retain their original definitions; no new spontaneous-preterm-birth classification is inferred. Optional retrospective rows are available in Track selection.</p><dl class="pregnancySummaryGrid">'+fields('delivery')+'</dl></div>';
 el('pregnancyShowDelivery').onchange=()=>{annotationSettings.showDelivery=el('pregnancyShowDelivery').checked;saveAnnotationSettings();if(annotationLast){const {model,layout}=annotationLast;trajectoryQueue=trajectoryQueue.catch(()=>{}).then(()=>renderAnnotationTracks(model,layout))}else renderPregnancySummary(model,asset)};
}
function pregnancyCsvColumns(model,asset,settings){
 const summary=pregnancySummary(model,asset);
 if(!summary)return {fields:[],rows:model.points.map(()=>[])};
 const suffixes=['value','unit','status','raw','note','source','source_field','source_record'];
 const fields=['participant_summary_dataset_revision','participant_summary_audit_sha256','participant_summary_cohort'];
 const values=[asset.datasetRevision,asset.auditManifestSha256,summary.cohort];
 for(const group of settings.showDelivery?['baseline','delivery']:['baseline'])for(const spec of asset[group+'Fields']){
  const cell=summary[group][spec.key];
  fields.push(...suffixes.map(s=>'participant_'+group+'_'+spec.key+'_'+s));
  values.push(cell.value??'',cell.unit,cell.status,cell.raw,cell.note,cell.source,cell.field,cell.sourceRecord??'');
 }
 return {fields,rows:model.points.map(()=>[...values])};
}
function annotationCsvColumns(model,asset,settings){
 const tracks=annotationTrackCsvColumns(model,asset,settings),summary=pregnancyCsvColumns(model,asset,settings);
 return {fields:[...tracks.fields,...summary.fields],rows:model.points.map((_,i)=>[...tracks.rows[i],...summary.rows[i]])};
}
function annotationImageExport(figure,model,asset,settings,selected,timeAxis){
 const result=annotationTracksImageExport(figure,model,asset,settings,selected,timeAxis),summary=pregnancySummary(model,asset);
 if(!summary)return result;
 const layout=JSON.parse(JSON.stringify(result.layout)),lines=['Participant summary · '+esc(summary.cohort)+' · '+esc(summary.subject)+' (baseline; not repeated measurements)'];
 for(const group of settings.showDelivery?['baseline','delivery']:['baseline']){
  if(group==='delivery')lines.push('Delivery outcomes — retrospective source information; selection labels are not new diagnoses');
  for(const spec of asset[group+'Fields'])lines.push(esc(spec.label)+': '+esc(pregnancyValueText(summary[group][spec.key])));
 }
 const width=Math.max(120,result.width-32),oldTop=layout.margin.t,oldBottom=layout.margin.b;
 // Text must fit the exported image, including a narrow four-panel view.
 // Grow only the margins and canvas together, retaining the plot's pixel area.
 if(layout.title?.text){
  const size=layout.title.font?.size||13;
  layout.title={...layout.title,text:annotationWrapLabel(layout.title.text,size,width),x:0,xanchor:'left',y:1,yanchor:'top',pad:{l:12,t:24}};
  layout.margin.t=Math.max(oldTop,layout.title.text.split('<br>').length*size*1.5+40);
 }
 const summaryBlock={name:'pregnancySummaryExport',font:{size:11,color:'#203d4b'},text:lines.join('<br>')};
 const footerNames=['annotationExportKey','trajectoryExportInterpretation'];
 const footers=footerNames.map(name=>(layout.annotations||[]).find(a=>a.name===name)).filter(Boolean);
 layout.annotations=(layout.annotations||[]).filter(a=>!footerNames.includes(a.name));
 let cursor=65; // Leave room for bottom-axis ticks and its title.
 for(const block of [...footers,summaryBlock]){
  const size=block.font?.size||10,text=annotationWrapLabel(block.text||'',size,width);
  layout.annotations.push({...block,text,xref:'paper',yref:'paper',x:0,y:0,xshift:12-layout.margin.l,yshift:-cursor,xanchor:'left',yanchor:'top',align:'left',showarrow:false});
  cursor+=text.split('<br>').length*size*1.5+18;
 }
 layout.margin.b=Math.max(oldBottom,cursor+6);
 return {...result,layout,height:result.height+layout.margin.t-oldTop+layout.margin.b-oldBottom};
}
