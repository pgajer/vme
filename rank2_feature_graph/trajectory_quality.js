// Display-only checks. These never screen a reference, change an assignment or move a point.
const trajectoryQualityVersion='flag-only-v2';
function trajectoryQuality(p,b,mode,q,depth){
 const flags=[],unknown=[],add=(code,text)=>flags.push({code,text}),a=b.cohortAnalysis?.merged[q];
 const raw=depth?.datasetRevision===b.dataset.revision?depth.records?.[p.r.id]:null;
 const reads=Number.isSafeInteger(raw?.reads)&&raw.reads>=0?raw.reads:null;
 const reported=Number.isSafeInteger(raw?.reportedReads)&&raw.reportedReads>=0?raw.reportedReads:null;
 const ids=String(p.pair||'').split(',').map(Number),mass=p.g&&ids.length===2?ids.reduce((s,id)=>s+(p.p.values.get(id)||0),0):null;
 if(!p.g)unknown.push('Reference pair and state size unavailable');
 const pairReads=reads!==null&&mass!==null?Math.round(reads*mass):null;
 if(reads===null)unknown.push('Analyzed read depth unknown');else if(reads<1000)add('insufficient-depth','Insufficient depth: <1,000 analyzed reads');else if(reads<3000)add('limited-depth','Limited depth: 1,000–2,999 analyzed reads');
 if(p.p.ranked.length>=2&&p.p.p2-p.p.p3<.02)add('near-rank-tie','Original second/third taxon margin <2 percentage points');
 if(mode==='merged'&&mass===0)add('zero-assigned-pair','Neither named merged-group taxon detected');
 if(p.endpoint?.basis==='within-pair'){
  if(pairReads===null)unknown.push('Within-pair endpoint read support unknown');else if(pairReads<100)add('low-pair-depth','Within-pair endpoint has <100 named-pair reads');
 }
 const route=mode==='pure'?'original pair':a?.methods?.[p.r.profile]||a?.routes?.[p.r.profile]||'unknown';
 let support=null;
 if(route==='knn'){
  support=a?.fallback?.[p.r.profile];
  if(!Number.isInteger(support?.voters))unknown.push('Neighbor voter count unavailable');else if(support.voters<5)add('few-voters','Fewer than 5 eligible neighbor voters');
  if(!Number.isFinite(support?.voteShare))unknown.push('Winning neighbor fraction unavailable');else if(support.voteShare<.7)add('weak-vote','Winning neighbor fraction <70%');
  if(!Number.isInteger(support?.tiedGroups))unknown.push('Neighbor tie evidence unavailable');else if(support.tiedGroups>1)add('neighbor-tie','Multiple merged groups tied for the winning vote');
 }else if(route==='rank3'){
  support=a?.bridges?.[p.p.original];
  if(!Number.isInteger(support?.sourceIntersection)||!Number.isInteger(support?.coreIntersection))unknown.push('Rank-3 bridge counts unavailable');else if(Math.min(support.sourceIntersection,support.coreIntersection)<5)add('weak-bridge','Rank-3 bridge has fewer than 5 records on at least one side');
  if(!Array.isArray(support?.tiedCores))unknown.push('Rank-3 bridge tie evidence unavailable');else if(new Set(support.tiedCores).size!==1)add('bridge-tie','Rank-3 bridge does not have a unique winning core');
 }else if(!['core','original pair'].includes(route))unknown.push('Assignment-support route unavailable');
 if(['knn','rank3'].includes(route))unknown.push('Independent-participant support not assessed');
 if(route==='knn')unknown.push('Neighbor distance cutoff not calibrated');
 if(depth?.source?.reportedComparable&&reported!==null&&reads!==null&&reported!==reads)add('depth-field-difference','Reported depth differs from analyzed taxon-count total');
 return {version:trajectoryQualityVersion,reads,reported,pairReads,pairMass:mass,stateN:p.g?.n??null,pair:p.pair,route,support,flags,unknown,
  status:flags.length?'Flagged':unknown.length?'Incomplete checks':'No flags in assessed checks',source:depth?.source??null};
}
function trajectoryQualityText(v){
 const text=[`Quality preview (${v.version}): ${v.status}`,`Underlying state size: ${v.stateN??'unknown'} reference records`,
  `Displayed state size: ${v.displayStateN??'not applicable'} reference records`,
  `Analyzed depth: ${v.reads??'unknown'} reads · named-pair reads: ${v.pairReads??'unknown'}`,
  `Reported source depth: ${v.reported??'unknown'} reads`,...v.flags.map(f=>f.text),...v.unknown];
 if(v.support)text.push('Assignment evidence: '+JSON.stringify(v.support));
 if(v.source)text.push('Depth source: '+v.source.path+'\nSHA256: '+v.source.sha256+'\n'+v.source.definition);
 text.push('Flag only: no records removed, no assignment or coordinate changed. Passing these checks does not validate biological support.');
 return text.join('\n');
}
function trajectoryQualityPreview(m,b,q){
 const depth=BUNDLE_PACK.qualityReadDepths?.[b.dataset.id];
 for(const p of m.points){p.quality=trajectoryQuality(p,b,m.mode,q,depth);p.quality.displayStateN=p.missing?null:p.placement?p.placement.g.n:p.rank===1?m.reference.rank1Counts.get(p.ids[0])??null:p.g?.n??null;}
 const count=m.points.filter(p=>p.quality.flags.length).length,unknown=m.points.filter(p=>p.quality.unknown.length).length;
 el('trajectoryQualitySummary').textContent=`Quality preview · ${count}/${m.points.length} flagged · ${unknown} with incomplete checks · flag only`;
 el('trajectoryQualityRows').innerHTML=m.points.map(p=>{const v=p.quality;return `<tr><th><button type="button" data-trajectory-record="${p.r.index}">${esc(p.r.label)}</button></th><td>${v.stateN??'Unknown'}</td><td>${v.reads?.toLocaleString()??'Unknown'}</td><td>${v.pairReads?.toLocaleString()??'Unknown'}</td><td>${esc(v.status)}${v.flags.length?'<br>'+v.flags.map(f=>esc(f.text)).join('; '):''}${v.unknown.length?'<br>'+esc(v.unknown.join('; ')):''}</td></tr>`}).join('');
 el('trajectoryQualitySource').textContent='Top state-size track counts the displayed interval in '+m.reference.scope+' ('+m.reference.n+' records). The quality table retains the underlying '+(m.mode==='merged'?'assigned group':'original pair')+' count and assignment evidence. '+(depth?.source?'Read depth: '+depth.source.definition+'.':depth?.reason||'Read depth unavailable.');
}
function trajectoryTrackHeight(settings={},m){return (settings.showStateSize!==false?88:0)+(settings.showReadDepth!==false?122:0)+(m?.points.some(p=>p.missing&&p.x!==null)?32:0)}
function trajectoryQualityTracks(m,marks,selected,xDomain,xRange,bodyHeight,b,settings={}){
 if(!trajectoryTrackHeight(settings,m))return {traces:[],shapes:[],annotations:[],layout:{},main:1};
 const showState=settings.showStateSize!==false,showReads=settings.showReadDepth!==false;
 const omitted=marks.filter(p=>p.missing),omittedHeight=omitted.length?32:0;
 const traces=[],shapes=[],annotations=[],plotArea=bodyHeight-95+trajectoryTrackHeight(settings,m),main=(bodyHeight-95)/plotArea,trackBase=main+omittedHeight/plotArea;
 const stateDomain=showState?[1-65/plotArea,1]:[0,1];
 const readDomain=showReads?[trackBase+50/plotArea,showState?1-88/plotArea:1]:[0,1],railDomain=showReads?[trackBase+18/plotArea,trackBase+33/plotArea]:[0,1];
 const axis=(domain,anchor,visible)=>({domain,anchor,visible,showgrid:false,zeroline:false,fixedrange:true,tickfont:{size:10},automargin:true});
 const layout={yaxis3:{...axis(stateDomain,'x3',showState),rangemode:'tozero'},yaxis4:{...axis(readDomain,'x4',showReads),type:'log',range:[0,Math.log10(Math.max(4000,...marks.map(p=>p.quality.reads||0)))+.15]},yaxis5:{...axis(railDomain,'x5',showReads),range:[-.5,.5],showticklabels:false}};
 for(const n of [3,4,5])layout['xaxis'+n]={domain:xDomain,anchor:'y'+n,matches:'x',range:[...xRange],visible:n===3?showState:showReads,showticklabels:false,showgrid:true,zeroline:false};
 const labels=[];
 if(showState)labels.push([stateDomain,'State size · records']);
 if(showReads)labels.push([readDomain,'Analyzed reads · log'],[railDomain,'Unknown / zero reads']);
 for(const [domain,text] of labels)annotations.push({xref:'paper',yref:'paper',x:0,y:(domain[0]+domain[1])/2,xanchor:'right',xshift:-45,text,showarrow:false,font:{size:11}});
 const display=p=>p.missing?'Not drawn: '+p.missing:trajectoryLabel(m.states.find(s=>s.id===p.state),b);
 const hover=p=>`${p.r.label}<br>Displayed state: ${esc(display(p))}<br>Displayed state size: ${p.quality.displayStateN??'not applicable'} records<br>Underlying ${m.mode==='merged'?'assigned group':'original pair'}: ${esc(String(p.quality.pair).split(',').map(id=>taxonDisplayLabel(b.data.featureNames[id]||id)).join(' + '))}<br>Underlying state size: ${p.quality.stateN??'unknown'} records<br>Analyzed reads: ${p.quality.reads??'unknown'}<br>${esc(p.quality.status)}<br>${p.quality.flags.map(f=>esc(f.text)).join('<br>')}<br>${p.quality.unknown.map(esc).join('<br>')}`;
 const track=(points,n,ys,name,symbol)=>({type:'scatter',name,mode:'markers',xaxis:'x'+n,yaxis:'y'+n,x:points.map(p=>p.x),y:ys,customdata:points.map(p=>p.r.index),hovertext:points.map(hover),hovertemplate:'%{hovertext}<extra></extra>',showlegend:false,marker:{size:points.map(p=>p.r.index===selected?11:7),symbol:symbol||'circle',color:points.map(p=>p.quality.flags.length?'#b4580b':p.quality.unknown.length?'#687c87':'#1769aa'),line:{color:'#263f4d',width:points.map(p=>p.r.index===selected?2:0)}}});
 const sized=marks.filter(p=>p.quality.displayStateN!==null),known=marks.filter(p=>p.quality.reads>0),missing=marks.filter(p=>p.quality.reads===null||p.quality.reads===0);
 if(showState)traces.push(track(sized,3,sized.map(p=>p.quality.displayStateN),'Reference state size'));
 if(showReads)traces.push(track(known,4,known.map(p=>p.quality.reads),'Analyzed reads'),track(missing,5,missing.map(()=>0),'Unknown or zero depth',missing.map(p=>p.quality.reads===0?'diamond-open':'x')));
 const unsized=marks.filter(p=>!p.missing&&p.quality.displayStateN===null);
 if(showState&&unsized.length)traces.push({...track(unsized,3,unsized.map(()=>0),'State size unavailable','x'),hovertext:unsized.map(p=>hover(p)+'<br>Baseline × means unavailable, not zero state members')});
 if(omitted.length){
  const domain=[main+5/plotArea,main+23/plotArea];
  layout.yaxis6={...axis(domain,'x6',true),range:[-.5,.5],showticklabels:false};
  layout.xaxis6={domain:xDomain,anchor:'y6',matches:'x',range:[...xRange],showticklabels:false,showgrid:false,zeroline:false};
  traces.push({...track(omitted,6,omitted.map(()=>0),'Not drawn in trajectory','x'),meta:{trajectoryOmitted:true}});
  annotations.push({xref:'paper',yref:'paper',x:0,y:(domain[0]+domain[1])/2,xanchor:'right',xshift:-12,text:'Not drawn · no pair position',showarrow:false,font:{size:11}});
 }
 if(showReads)for(const [y,color] of [[1000,'#b4580b'],[3000,'#687c87']])shapes.push({type:'line',xref:'x4 domain',x0:0,x1:1,yref:'y4',y0:y,y1:y,line:{color,width:1,dash:'dot'}});
 if(showState||showReads)annotations.push({xref:'paper',yref:'paper',x:xDomain[1],y:1,yshift:9,xanchor:'right',text:'Flag only · orange = flag · gray = incomplete'+(showReads?' · read guides: 1,000 / 3,000':''),showarrow:false,font:{size:10}});
 return {traces,shapes,annotations,layout,main};
}

function trajectoryFlagHover(p){
 return '<b>'+esc(p.r.label)+' · Flagged observation</b><br>'+p.quality.flags.map(f=>'• '+esc(f.text)).join('<br>')+'<br>Assignment unchanged. Click for observation details.';
}
