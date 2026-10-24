// Display-only subject trajectories. Never mutate a release, assignment or 3D camera.
const trajectoryDefaults={taxonColors:{},representation:'whole',massThreshold:95,massScope:'visit',barWidth:100,showMass:false,massFontSize:10,roundMass:false,horizontalMass:false,mode:'merged',density:false,rank1:true,pairEndpoints:true,showStateSize:true,showReadDepth:true,highlightFlagged:false,showEndpointGuides:true,endpointGuideColor:'#808080',endpointGuideOpacity:.2,endpointGuideWidth:1,endpointFontSize:12,visitGuideColor:'#375a6e',visitGuideOpacity:.28,visitGuideWidth:1.5,axis:'auto',fontSize:12,verticalScale:100};
const trajectoryPreference='vme-subject-trajectory-v1';
let trajectorySettings={...trajectoryDefaults};
try{const s=JSON.parse((typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).getItem(trajectoryPreference));validateTrajectorySettings(s);trajectorySettings={...trajectoryDefaults,...s,endpointFontSize:s.endpointFontSize??s.fontSize}}catch{}
let trajectoryFitAll=false,trajectoryRestoredScale=null;
let trajectoryNaturalHeight=300,trajectoryResizePending=false;
let trajectoryRanges=null,trajectoryContext='',trajectoryModel=null,trajectoryQueue=Promise.resolve(),trajectoryDrawRevision=0;
const trajectoryReferences=new WeakMap(),trajectoryDensityCache=new Map();
let trajectoryDensityJob=null;
function validateTrajectorySettings(s){
 if(s?.massThreshold!==undefined&&(!Number.isFinite(s.massThreshold)||s.massThreshold<1||s.massThreshold>100))throw Error('Invalid stacked mass threshold');
 if(s?.massScope!==undefined&&!['visit','global'].includes(s.massScope))throw Error('Invalid stacked mass scope');
 if(s?.massFontSize!==undefined&&(!Number.isInteger(s.massFontSize)||s.massFontSize<8||s.massFontSize>24))throw Error('Invalid state mass label size');
 if(s?.barWidth!==undefined&&(!Number.isFinite(s.barWidth)||s.barWidth<25||s.barWidth>300))throw Error('Invalid visit bar width');
 if(s?.representation!==undefined&&!['pair','whole','stacked'].includes(s.representation))throw Error('Invalid trajectory representation');
 if(s?.verticalScale!==undefined&&(!Number.isFinite(s.verticalScale)||s.verticalScale<25||s.verticalScale>300))throw Error('Invalid trajectory vertical scale');
 if(!s||!['pure','merged'].includes(s.mode)||typeof s.density!=='boolean'||typeof s.rank1!=='boolean'||s.pairEndpoints!==undefined&&typeof s.pairEndpoints!=='boolean'||!['auto','elapsed','visit'].includes(s.axis)||!Number.isInteger(s.fontSize)||s.fontSize<10||s.fontSize>24)throw Error('Invalid trajectory settings');
 if(s.taxonColors!==undefined){
  const colors=s.taxonColors;
  if(!colors||typeof colors!=='object'||Array.isArray(colors)||Object.keys(colors).length>4096)throw Error('Invalid trajectory taxon colors');
  for(const [name,color] of Object.entries(colors))if(!name||name.length>512||name!==trajectoryTaxonKey(name)||['__proto__','prototype','constructor'].includes(name)||typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw Error('Invalid trajectory taxon color');
 }
 for(const key of ['showStateSize','showReadDepth','highlightFlagged','showEndpointGuides','showMass','roundMass','horizontalMass'])if(s[key]!==undefined&&typeof s[key]!=='boolean')throw Error('Invalid trajectory appearance setting');
 if(s.endpointGuideColor!==undefined&&(typeof s.endpointGuideColor!=='string'||!/^#[0-9a-f]{6}$/i.test(s.endpointGuideColor)))throw Error('Invalid endpoint guide color');
 if(s.endpointGuideOpacity!==undefined&&(!Number.isFinite(s.endpointGuideOpacity)||s.endpointGuideOpacity<0||s.endpointGuideOpacity>1))throw Error('Invalid endpoint guide opacity');
 if(s.endpointGuideWidth!==undefined&&(!Number.isFinite(s.endpointGuideWidth)||s.endpointGuideWidth<.5||s.endpointGuideWidth>5||!Number.isInteger(s.endpointGuideWidth*2)))throw Error('Invalid endpoint guide thickness');
 if(s.visitGuideColor!==undefined&&(typeof s.visitGuideColor!=='string'||!/^#[0-9a-f]{6}$/i.test(s.visitGuideColor)))throw Error('Invalid selected-visit guide color');
 if(s.visitGuideOpacity!==undefined&&(!Number.isFinite(s.visitGuideOpacity)||s.visitGuideOpacity<0||s.visitGuideOpacity>1))throw Error('Invalid selected-visit guide opacity');
 if(s.visitGuideWidth!==undefined&&(!Number.isFinite(s.visitGuideWidth)||s.visitGuideWidth<.5||s.visitGuideWidth>5||!Number.isInteger(s.visitGuideWidth*2)))throw Error('Invalid selected-visit guide thickness');
 if(s.endpointFontSize!==undefined&&(!Number.isInteger(s.endpointFontSize)||s.endpointFontSize<10||s.endpointFontSize>32))throw Error('Invalid endpoint label size');
}
// Stable numeric feature-order ties, without sorting the full composition.
const trajectoryLeadingCache=new WeakMap();
function trajectoryLeadingFeatures(sparse,limit){
 const cached=trajectoryLeadingCache.get(sparse);
 if(cached&&cached.limit>=limit)return cached.top.slice(0,limit);
 // The same immutable composition supplies trajectory ranks and hover text.
 const capacity=Math.max(5,limit),top=[];
 for(const item of sparse){
  let i=0;while(i<top.length&&(top[i][1]>item[1]||top[i][1]===item[1]&&top[i][0]<item[0]))i++;
  if(i<capacity){top.splice(i,0,item);if(top.length>capacity)top.pop()}
 }
 trajectoryLeadingCache.set(sparse,{limit:capacity,top});return top.slice(0,limit);
}
function trajectoryReference(bundle,d,mode,q){
 let cache=trajectoryReferences.get(d);if(!cache){cache=new Map();trajectoryReferences.set(d,cache)}
 const key=[bundle.dataset.revision,bundle.cohortAnalysis?.revision,mode,mode==='merged'?q:'pure'].join('|');
 if(cache.has(key))return cache.get(key);
 const groups=new Map(),profiles=new Map(),rank1Counts=new Map(),rank1Maxima=new Map(),seen=new Set(),base=bundle.data,a=bundle.cohortAnalysis||{records:d.records};
 if(mode==='merged'&&!a?.merged?.[q])throw Error('Merged assignments unavailable at this target');
 for(const r of d.records){
  if(seen.has(r.index)||!a.records[r.index]||a.records[r.index].id!==r.id)throw Error('Trajectory reference record mismatch');seen.add(r.index);
  let p=profiles.get(r.profile);
  if(!p){
   const sparse=d.compositions[r.profile];if(!sparse?.length)throw Error('Trajectory reference composition unavailable');
   const values=new Map();let mass=0,last=-1;
   for(const [j,v] of sparse){if(!Number.isInteger(j)||j<=last||j>=d.features.length||!Number.isFinite(v)||v<=0||d.features[j]!==base.featureNames[j+1])throw Error('Invalid trajectory feature map/composition');values.set(j+1,v);last=j;mass+=v}
   if(Math.abs(mass-1)>1e-10)throw Error('Trajectory composition mass differs from one');
   // Geometry and quality rules use only the leading three; all values above
   // still undergo the same feature, positivity and mass validation.
   const ranked=trajectoryLeadingFeatures(sparse,3).map(([j,v])=>[j+1,v]);
   const original=base.samples.pair[r.profile],pair=ranked.slice(0,2).map(x=>x[0]).sort((a,b)=>a-b).join(',');
   if(ranked.length>1&&pair!==original)throw Error('Original pair differs from frozen feature-order ranking: '+r.id);
   p={values,ranked,original,p1:ranked[0][1],p2:ranked[1]?.[1]||0,p3:ranked[2]?.[1]||0};profiles.set(r.profile,p);
  }
  if(p.p1>=.95){const lead=p.ranked[0][0];rank1Counts.set(lead,(rank1Counts.get(lead)||0)+1);rank1Maxima.set(lead,Math.max(rank1Maxima.get(lead)||0,p.p1));}
  const pair=mode==='merged'?a.merged[q].pairs[r.profile]:p.original;
  if(mode==='pure'&&p.ranked.length<2)continue;
  const ids=String(pair).split(',').map(Number);
  if(ids.length!==2||ids[0]>=ids[1]||ids.some(id=>!Object.hasOwn(base.featureNames,id)))throw Error('Invalid assigned trajectory pair');
  let g=groups.get(pair);if(!g){g={id:pair,ids,n:0,valid:0,a:Infinity,b:-Infinity,maxima:[0,0]};groups.set(pair,g)}g.n++;
  ids.forEach((id,i)=>g.maxima[i]=Math.max(g.maxima[i],p.values.get(id)||0));
  const mass=(p.values.get(ids[0])||0)+(p.values.get(ids[1])||0);
  if(mass>0){const t=(p.values.get(ids[1])||0)/mass;g.a=Math.min(g.a,t);g.b=Math.max(g.b,t);g.valid++}
 }
 for(const g of groups.values()){if(!g.valid){g.a=null;g.b=null;g.d=null}else g.d=g.b-g.a}
 const complete=seen.size===a.records.length&&a.records.every((_,i)=>seen.has(i));
 const scope=complete?(typeof datasetDisplayTitle==='function'?datasetDisplayTitle(bundle.dataset):bundle.dataset.title)+(d.records[0]?.transitionPolicy?' frozen source-record population (release holds retained)':' full released population'):[...new Set(d.records.map(r=>r.cohort))].join(' + ')+' supplement';
 const result={groups,profiles,rank1Counts,rank1Maxima,scope,n:d.records.length};cache.set(key,result);return result;
}
function trajectoryBuild(bundle,d,rows,settings,q,timing,scale=110){
 const mode=settings.mode==='merged'&&bundle.cohortAnalysis?.merged[q]?'merged':'pure';
 const reference=trajectoryReference(bundle,d,mode,q),elapsed=settings.axis!=='visit'&&timing.available;
 const orders=[...new Set(rows.filter(r=>r.order!==null).map(r=>r.order))].sort((a,b)=>a-b);
 const points=rows.map(r=>{
  const p=reference.profiles.get(r.profile),pair=mode==='merged'?bundle.cohortAnalysis.merged[q].pairs[r.profile]:p.original;
  const g=mode==='pure'&&p.ranked.length<2?undefined:reference.groups.get(pair),rank1=settings.rank1&&p.p1>=.95;
  const ids=rank1?[p.ranked[0][0]]:g?.ids||[],mass=rank1?p.p1:ids.reduce((s,id)=>s+(p.values.get(id)||0),0);
  const t=!rank1&&g&&mass>0?(p.values.get(ids[1])||0)/mass:null;
  if(t!==null&&(t<g.a-1e-12||t>g.b+1e-12))throw Error('Trajectory coordinate outside reference bounds');
  const state=rank1?'1:'+ids[0]:g?'2:'+pair:'undefined';
  const pairFraction=t===null?null:Math.max(t,1-t);
  const endpoint=rank1?{feature:ids[0],basis:'whole-sample',fraction:p.p1}:settings.pairEndpoints&&pairFraction>=.95?{feature:ids[t>.5?1:0],basis:'within-pair',fraction:pairFraction}:null;
  return {r,p,pair,g,ids,state,endpoint,rank:rank1?1:g?2:0,mass,off:1-mass,t,u:t!==null&&g.d>0?(t-g.a)/g.d:null,
   missing:rank1?'':t===null?(g?'Pair coordinate unavailable':'Top-2 CST undefined: one positive feature'):'',
   x:r.order===null?null:elapsed?timing.days[r.id]:orders.indexOf(r.order)};
 });
 // Use the same safe temporal adjacency for connectors and endpoint placement.
 const orderGroups=orders.map(order=>points.filter(p=>p.r.order===order)),segments=[];
 const sameMeasuredDay=(a,b)=>Number.isFinite(a.r.elapsedDays)&&Number.isFinite(b.r.elapsedDays)&&a.r.timeOrigin===b.r.timeOrigin&&a.r.elapsedDays===b.r.elapsedDays||a.r.timeVerified&&b.r.timeVerified&&a.r.date&&a.r.date===b.r.date;
 const links=new Set();
 for(let i=1;i<orderGroups.length;i++){
  const left=orderGroups[i-1],right=orderGroups[i];if(left.length!==1||right.length!==1)continue;
  const a=left[0],b=right[0];if(a.r.transitionPolicy&&!reviewedParticipantTransition(a.r,b.r,elapsed))continue;if(a.missing||b.missing||(a.r.episode||'')!==(b.r.episode||'')||sameMeasuredDay(a,b))continue;
  if(points.some(p=>p!==a&&sameMeasuredDay(p,a))||points.some(p=>p!==b&&sameMeasuredDay(p,b)))continue;
  links.add(i);
  const gap=b.r.order-a.r.order>1,days=elapsed?b.x-a.x:null;
  segments.push({a,b,dash:elapsed?(bundle.dataset.id==='umb-hmp-2019-panel'&&days<=3?'solid':'dot'):gap?'dash':'solid',days});
 }
 // Whole-sample >=95% observations retain one vertex state per taxon.
 // Only conditional within-pair endpoints can borrow a neighboring saved pair.
 for(let i=0;i<orderGroups.length;i++){
  const group=orderGroups[i];if(group.length!==1||group[0].endpoint?.basis!=='within-pair')continue;
  const first=group[0],lead=first.endpoint.feature;let end=i;
  const sameRun=p=>p?.endpoint?.feature===lead&&p.endpoint.basis===first.endpoint.basis&&(first.endpoint.basis==='whole-sample'||p.pair===first.pair);
  while(links.has(end+1)&&orderGroups[end+1]?.length===1&&sameRun(orderGroups[end+1][0]))end++;
  const before=links.has(i)?orderGroups[i-1][0]:null,after=links.has(end+1)?orderGroups[end+1][0]:null;
  const compatible=p=>p?.rank===2&&p.t!==null&&p.ids.includes(lead);
  const neighbor=compatible(before)?before:compatible(after)?after:null;
  for(let j=i;j<=end;j++){
   const p=orderGroups[j][0],anchor=neighbor||(p.endpoint.basis==='within-pair'?p:null);
   if(!anchor)continue;
   p.placement={pair:anchor.pair,g:anchor.g,feature:lead,side:anchor.ids[0]===lead?'first':'second',neighbor:neighbor?.r.id||null,rule:neighbor===before&&neighbor?'preceding pair':neighbor?'following pair':'own pair (no compatible neighbor)'};
   p.state='2:'+anchor.pair;
  }
  i=end;
 }
 const states=new Map();
 const sorted=points.slice().sort((a,b)=>(a.r.order??Infinity)-(b.r.order??Infinity)||a.state.localeCompare(b.state));
 for(const p of sorted){if(p.missing){p.y=null;continue}if(!states.has(p.state))states.set(p.state,{id:p.state,ids:p.placement?.g.ids||p.ids,rank:p.placement?2:p.rank,g:p.placement?.g||p.g,points:[]});states.get(p.state).points.push(p)}
 // Reference extent is never inflated; clearance and dotted locators are display aids.
 let cursor=20;
 for(const state of states.values()){
  state.maxima=state.rank===2?state.g.maxima:state.ids.map(id=>reference.rank1Maxima.get(id));
  state.top=cursor;state.height=state.rank===2&&state.g.d!==null?scale*state.g.d:0;
  state.short=state.rank===2&&state.g.d>0&&state.height<8;
  state.middle=cursor+state.height/2;const unavailable=state.points.some(p=>p.missing);
  const close=state.rank===2&&state.height<settings.fontSize*2+8;
  state.unavailableY=cursor+state.height+(close?settings.fontSize*3+24:24);
  for(const p of state.points)p.y=p.missing?state.unavailableY:p.placement?(p.placement.side==='first'?state.top:state.top+state.height):state.rank===1?cursor:cursor+scale*(p.t-state.g.a);
  cursor+=Math.max(30,state.height)+(unavailable?(close?settings.fontSize+50:32):0)+settings.fontSize*(close?3:2)+16;
 }
 return {reference,mode,elapsed,timing,orders,points,states:[...states.values()],height:cursor+65,scale,segments};
}
function trajectoryIntervalShapes(state,point){
 if(state.rank!==2||point.x===null||point.missing||state.g.d===null)return [];
 const style={color:point.missing?'#617d91':'#1769aa',width:state.short?1.5:3,...(point.missing?{dash:'dash'}:{})};
 const x=state.short?{xsizemode:'pixel',xanchor:point.x,x0:12,x1:12}:{x0:point.x,x1:point.x};
 const bar={type:'line',...x,y0:state.top,y1:state.top+state.height,line:style,layer:'below',name:point.missing?'Reference interval; observation position unavailable':'Reference interval'};
 if(state.g.d===0)return [{...bar,xsizemode:'pixel',xanchor:point.x,x0:-5,x1:5,name:'Zero-extent reference interval (d=0)'}];
 if(!state.short)return [bar];
 // The dotted 16 px guide identifies a short interval; only the solid part is to scale.
 return [{type:'line',...x,ysizemode:'pixel',yanchor:state.middle,y0:-8,y1:8,line:{color:'#7793a6',width:1,dash:'dot'},layer:'below',name:'Short interval locator; dotted length is not to scale'},bar];
}
function trajectoryLabel(state,bundle=datasetRegistry.get(META.id)){
 const names=state.ids.map(id=>taxonDisplayLabel(bundle.data.featureNames[id]));
 return state.rank===1?'1: '+names[0]+' (≥95%)':state.rank===2?names.join(' + ')+(state.g.d===0?' (d=0)':''):'Top-2 CST undefined';
}
function trajectoryEndpointAnnotations(state,bundle,fontSize){
 if(state.rank!==2)return [{x:0,xref:'paper',y:state.middle,yref:'y',text:esc(trajectoryLabel(state,bundle)),showarrow:false,xanchor:'right',xshift:-12,font:{size:fontSize}}];
 const close=state.height<fontSize*2+8;
 const labels=state.ids.map((id,i)=>({x:0,xref:'paper',y:state.top+(i?state.height:0),yref:'y',
  text:esc(taxonDisplayLabel(bundle.data.featureNames[id])),font:{size:fontSize},showarrow:true,arrowhead:0,arrowwidth:1,arrowcolor:'#617d91',
  ax:-24,ay:close?(i?fontSize+3:-fontSize-3):0,xanchor:'right',
  hovertext:(i?'Lower':'Upper')+' end: '+bundle.data.featureNames[id]+'. Applies to every interval in this row; observed reference extent, not a pure composition.'}));
 if(close)labels.push({x:0,xref:'paper',y:state.top+state.height,yref:'y',yshift:-fontSize*2-8,text:state.g.d===null?'No estimable interval':state.g.d===0?'Zero extent · d=0':'Short interval · d='+state.g.d.toPrecision(3),showarrow:false,xanchor:'right',xshift:-12,font:{size:10}});
 return labels;
}
function trajectoryEndpointGuides(state,settings){
 if(!settings.showEndpointGuides)return [];
 // Paper x coordinates span the plot through the optional density area. The y
 // coordinates are the exact interval ends; a zero-extent pair gets one guide.
 const ends=[...new Set(state.ids.map((_,i)=>state.top+(i?state.height:0)))];
 return ends.map(y=>({type:'line',xref:'paper',x0:0,x1:1,yref:'y',y0:y,y1:y,
  line:{color:settings.endpointGuideColor,width:settings.endpointGuideWidth??trajectoryDefaults.endpointGuideWidth},opacity:settings.endpointGuideOpacity,
  layer:'below',name:'Taxon endpoint guide'}));
}
function trajectoryMaximumAnnotations(state,bundle,fontSize){
 const close=state.height<fontSize*2+8;
 const maxima=state.maxima;
 return state.ids.map((id,i)=>({x:1,xref:'paper',y:state.top+(i?state.height:0),yref:'y',
  text:(100*maxima[i]).toFixed(1)+'%',font:{size:fontSize},showarrow:true,arrowhead:0,arrowwidth:1,arrowcolor:'#617d91',
  ax:24,ay:state.rank===2&&close?(i?fontSize+3:-fontSize-3):0,xanchor:'left',
  hovertext:bundle.data.featureNames[id]+': '+(state.rank===2?'Maximum whole-sample relative abundance among all reference records assigned to this displayed state; not within-pair normalization.':'Maximum whole-sample relative abundance among reference records meeting this single-taxon rule.')}));
}
function trajectoryEndpointHeading(fontSize,main){
 // A separate text column beyond the percentages keeps the heading beside the axis.
 return {name:'trajectoryEndpointHeading',xref:'paper',yref:'paper',x:1,y:main,
  xshift:Math.ceil(fontSize*4.2)+40,yshift:0,xanchor:'left',yanchor:'top',align:'left',
  text:'Whole-sample maximum<br>within state reference',showarrow:false,font:{size:11}};
}
function trajectoryEndpointPadding(fontSize,trackHeight){
 // Add equal height and top margin: existing plot scale and track heights stay fixed.
 return Math.max(0,Math.ceil(fontSize*1.7)+6-30-trackHeight);
}
function trajectoryIdentity(bundle=datasetRegistry.get(META.id),d=participantData(),settings=trajectorySettings,q=el('coverage').value){
 return ['trajectory-v1',bundle.dataset.id,bundle.dataset.revision,bundle.cohortAnalysis?.revision,BUNDLE_PACK.trajectoryReferences?.[bundle.dataset.id]||d?.provenance.auditSha256,settings.mode,settings.mode==='merged'?q:'pure'].join('|');
}
function trajectorySnapshot(){return {version:1,geometry:'whole-sample-vertices-v5',verticalSizing:'canvas-v1',...trajectorySettings,taxonColors:{...trajectorySettings.taxonColors},ranges:trajectoryRanges,scale:trajectoryModel?.scale||110,fitAll:trajectoryFitAll,reference:participant.active?trajectoryIdentity():null}}
function validateTrajectoryView(s,bundle,q,active){
 if(s===undefined)return;validateTrajectorySettings(s);
 if(s.verticalSizing!==undefined&&s.verticalSizing!=='canvas-v1')throw Error('Unsupported trajectory vertical sizing');
 if(s.geometry!==undefined&&!['adjacent-rank1-v2','labeled-endpoints-v3','displayed-states-v4','whole-sample-vertices-v5'].includes(s.geometry))throw Error('Unsupported trajectory display geometry');
 if(s.scale!==undefined&&(!Number.isFinite(s.scale)||s.scale<12||s.scale>110)||s.fitAll!==undefined&&typeof s.fitAll!=='boolean')throw Error('Invalid trajectory display scale');
 if(s.version!==1||s.ranges!==null&&(!s.ranges||!['x','y'].every(k=>Array.isArray(s.ranges[k])&&s.ranges[k].length===2&&s.ranges[k].every(Number.isFinite)&&s.ranges[k][0]!==s.ranges[k][1])))throw Error('Invalid trajectory ranges');
 const d=BUNDLE_PACK.participants?.[bundle.dataset.id];
 if(active&&s.reference!==trajectoryIdentity(bundle,d,s,q))throw Error('Trajectory reference differs from this saved view');
}
function restoreTrajectoryView(s){trajectorySettings=s?{taxonColors:{...s.taxonColors},representation:s.representation??'pair',massThreshold:s.massThreshold??95,massScope:s.massScope??'visit',barWidth:s.barWidth??100,showMass:s.showMass??false,massFontSize:s.massFontSize??10,roundMass:s.roundMass??false,horizontalMass:s.horizontalMass??false,mode:s.mode,density:s.density,rank1:s.rank1,pairEndpoints:s.pairEndpoints??false,showStateSize:s.showStateSize??true,showReadDepth:s.showReadDepth??true,highlightFlagged:s.highlightFlagged??false,showEndpointGuides:s.showEndpointGuides??trajectoryDefaults.showEndpointGuides,endpointGuideColor:s.endpointGuideColor??trajectoryDefaults.endpointGuideColor,endpointGuideOpacity:s.endpointGuideOpacity??trajectoryDefaults.endpointGuideOpacity,endpointGuideWidth:s.endpointGuideWidth??trajectoryDefaults.endpointGuideWidth,endpointFontSize:s.endpointFontSize??s.fontSize,visitGuideColor:s.visitGuideColor??trajectoryDefaults.visitGuideColor,visitGuideOpacity:s.visitGuideOpacity??trajectoryDefaults.visitGuideOpacity,visitGuideWidth:s.visitGuideWidth??trajectoryDefaults.visitGuideWidth,axis:s.axis,fontSize:s.fontSize,verticalScale:s.verticalScale??100}:{...trajectoryDefaults};trajectoryRanges=s?.geometry==='whole-sample-vertices-v5'&&s?.ranges?copyCamera(s.ranges):null;trajectoryRestoredScale=s?.scale??110;trajectoryFitAll=s?.fitAll??false;trajectoryContext='';
 // Earlier views encoded vertical magnification in the axis range. Undo that
 // factor once; canvas sizing now supplies it while moving the time axis too.
 if(trajectoryRanges&&s?.verticalSizing===undefined&&s?.verticalScale){const [bottom,top]=trajectoryRanges.y;trajectoryRanges.y=[top+(bottom-top)*s.verticalScale/100,top]}
}
// Displayed-row membership may borrow a neighboring pair. Amounts always come
// directly from the frozen whole-sample composition, never from t or u.
function trajectoryWholeComposition(p){
 const ids=p.placement?.g.ids||p.ids;
 const first=p.p.values.get(ids[0])||0,second=ids.length===2?(p.p.values.get(ids[1])||0):0;
 return {ids,first,second,other:Math.max(0,1-first-second)};
}
function trajectoryWholeText(p,bundle=datasetRegistry.get(META.id),compact=false){
 const c=trajectoryWholeComposition(p),name=id=>compact?taxonDisplayLabel(bundle.data.featureNames[id]||''):bundle.data.featureNames[id];
 return 'Whole sample: '+(name(c.ids[0])||'No displayed taxon')+' '+(100*c.first).toFixed(2)+'%'+
  (c.ids.length===2?' · '+name(c.ids[1])+' '+(100*c.second).toFixed(2)+'%':'')+
  ' · Other taxa '+(100*c.other).toFixed(2)+'%';
}
// Key by full taxon name, not feature index, row order or pair position.
// Normalize spelling separators only; distinct taxonomic names remain distinct.
function trajectoryTaxonKey(name){return String(name).replaceAll('_',' ').trim().replace(/\s+/g,' ').toLowerCase()}
function trajectoryTaxonColor(name,settings=trajectorySettings){
 const key=trajectoryTaxonKey(name);
 if(settings.taxonColors&&Object.hasOwn(settings.taxonColors,key))return settings.taxonColors[key];
 // The reviewed VMRC tables define defaults; explicit user choices above win.
 if(typeof VMRC_TAXON_PALETTE!=='undefined'&&Object.hasOwn(VMRC_TAXON_PALETTE.colors,key))return VMRC_TAXON_PALETTE.colors[key];
 let hash=2166136261;for(const char of key){hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0}
 return `hsl(${(hash%3600)/10},${55+(hash>>>12)%20}%,${32+(hash>>>20)%9}%)`;
}
function trajectoryTaxonHex(name){
 const color=trajectoryTaxonColor(name);if(color.startsWith('#'))return color;
 const [h,s,l]=color.match(/[\d.]+/g).map(Number),light=l/100,a=s/100*Math.min(light,1-light);
 return '#'+[0,8,4].map(n=>{const k=(n+h/30)%12;return Math.round(255*(light-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0')}).join('');
}
function trajectoryTaxonColorSource(name){
 const key=trajectoryTaxonKey(name),sources=typeof VMRC_TAXON_PALETTE==='undefined'?null:VMRC_TAXON_PALETTE.sources[key];
 return name+' · '+(sources?'VMRC recommended default ('+sources.join(', ')+')':'No exact VMRC entry; deterministic fallback color');
}
function renderTrajectoryTaxonEditor(m,bundle){
 const editor=el('trajectoryTaxonColors'),list=el('trajectoryTaxonColorList');
 editor.hidden=!['whole','stacked'].includes(trajectorySettings.representation);if(editor.hidden)return;
 const names=[...new Set((trajectorySettings.representation==='stacked'?trajectoryStackedComposition(m,trajectorySettings).ids:m.states.flatMap(s=>s.ids)).map(id=>bundle.data.featureNames[id]))].sort((a,b)=>a.localeCompare(b));
 const signature=JSON.stringify(names);
 if(list.dataset.taxa!==signature){
  list.dataset.taxa=signature;
  list.innerHTML=names.map(name=>`<div class="trajectoryTaxonColorRow"><label title="${esc(trajectoryTaxonColorSource(name))}"><input type="color" data-trajectory-taxon-color="${esc(trajectoryTaxonKey(name))}" aria-label="Color for ${esc(name)}" value="${trajectoryTaxonHex(name)}"> ${esc(taxonDisplayLabel(name))}</label><button type="button" data-trajectory-taxon-reset="${esc(trajectoryTaxonKey(name))}" aria-label="Reset color for ${esc(name)}">Reset</button></div>`).join('')||'<small>No displayed taxa.</small>';
 }
 // Keep native color-picker nodes in place while their value changes.
 for(const input of list.querySelectorAll?.('[data-trajectory-taxon-color]')||[])input.value=trajectoryTaxonHex(input.dataset.trajectoryTaxonColor);
 for(const button of list.querySelectorAll?.('[data-trajectory-taxon-reset]')||[])button.disabled=!Object.hasOwn(trajectorySettings.taxonColors||{},button.dataset.trajectoryTaxonReset);
}
function setTrajectoryTaxonColor(name,color){
 const key=trajectoryTaxonKey(name),taxonColors={...trajectorySettings.taxonColors};
 if(color===null)delete taxonColors[key];else taxonColors[key]=color;
 const next={...trajectorySettings,taxonColors};validateTrajectorySettings(next);
 if(trajectoryModel)trajectoryRestoredScale=trajectoryModel.scale;
 trajectorySettings=next;trajectorySavePreference();renderSubjectTrajectory();
}
function trajectoryWholeChart(m,bundle,settings,selected){
 const traces=[],shapes=[],annotations=[],rows=new Map(),positions=new Map();
 const ordered=m.points.filter(p=>p.x!==null&&!p.missing);
 const times=[...new Set(ordered.map(p=>p.x))].sort((a,b)=>a-b);
 const gap=times.length>1?Math.min(...times.slice(1).map((x,i)=>x-times[i])):1;
 const slot=Math.min(1,gap)*.72;
 m.states.forEach((state,i)=>{
  const top=i*132;rows.set(state.id,top);
  annotations.push({xref:'paper',x:0,xanchor:'right',xshift:-12,yref:'y',y:top+50,
   text:state.ids.map(id=>'<span style="color:'+trajectoryTaxonColor(bundle.data.featureNames[id],settings)+'">■</span> '+esc(taxonDisplayLabel(bundle.data.featureNames[id]))).join('<br>'),
   showarrow:false,font:{size:settings.endpointFontSize},hovertext:'Displayed state; bars use actual whole-sample abundances. Taxon colors match the row labels and stay consistent across rows. Gray: all other taxa.'});
  for(const percent of [0,100]){
   if(settings.showEndpointGuides)shapes.push({type:'line',xref:'paper',x0:0,x1:1,yref:'y',y0:top+percent,y1:top+percent,layer:'below',line:{color:settings.endpointGuideColor,width:settings.endpointGuideWidth},opacity:settings.endpointGuideOpacity});
  }
 });
 const counts=new Map();for(const p of ordered){const k=p.state+'|'+p.x;counts.set(k,(counts.get(k)||0)+1)}
 const seen=new Map();
 for(const p of ordered){
  const k=p.state+'|'+p.x,n=counts.get(k),j=seen.get(k)||0;seen.set(k,j+1);
  positions.set(p.r.index,{x:p.x+slot*((j+.5)/n-.5),width:slot/n*.92*(settings.barWidth??100)/100,top:rows.get(p.state)});
 }
 if(settings.showMass)for(const p of ordered){
  const v=positions.get(p.r.index),c=trajectoryWholeComposition(p);
  const mass=c.ids.reduce((sum,id)=>sum+(p.p.values.get(id)||0),0);
  annotations.push({name:'trajectory-state-mass',xref:'x',yref:'y',x:v.x,y:v.top,
   text:String(settings.roundMass?Math.round(100*mass):Number((100*mass).toFixed(1))),textangle:settings.horizontalMass?0:-90,xanchor:'center',yanchor:'bottom',yshift:3,showarrow:false,
   font:{size:settings.massFontSize??10,color:'#203d4b'},hovertext:esc(p.r.label+' · '+'Displayed support mass ('+c.ids.length+' taxa): '+(100*mass).toFixed(2)+'% — sum of whole-sample relative abundances of the displayed row taxa; not state frequency or within-pair abundance.')});
 }
 const keys=['first','other','second'];
 keys.forEach((key,j)=>{
  traces.push({type:'bar',name:['First named taxon','Other taxa','Second named taxon'][j],meta:{trajectoryWholeComponent:key},orientation:'v',
   x:ordered.map(p=>positions.get(p.r.index).x),y:ordered.map(p=>100*trajectoryWholeComposition(p)[key]),
   base:ordered.map(p=>{const c=trajectoryWholeComposition(p);return positions.get(p.r.index).top+100*(j===0?0:j===1?c.first:c.first+c.other)}),
   width:ordered.map(p=>positions.get(p.r.index).width),customdata:ordered.map(p=>p.r.index),
   marker:{color:key==='other'?'#8c8c8c':ordered.map(p=>{const id=trajectoryWholeComposition(p).ids[key==='first'?0:1];return id===undefined?'#8c8c8c':trajectoryTaxonColor(bundle.data.featureNames[id],settings)}),line:{width:0}},showlegend:false,
   hovertext:ordered.map(p=>{const full=ids=>ids.map(id=>taxonDisplayLabel(bundle.data.featureNames[id])).join(' + ');return esc(p.r.label+' · '+participantDateLabel(p.r)+'\n'+trajectoryWholeText(p,bundle,true)+'\nDisplayed state: '+full(trajectoryWholeComposition(p).ids)+'\nOriginal pair: '+(p.p.original===null?'No leading pair (one positive taxon)':full(String(p.p.original).split(',').map(Number)))+'\n'+(m.mode==='merged'?'Assigned group: '+full(p.g?.ids||[])+'\n':'')+(p.endpoint?'Endpoint rule affects row placement only; amounts remain measured.\n':'')+(settings.highlightFlagged&&p.quality?.flags.length?'Quality flags: '+p.quality.flags.map(f=>f.text).join('; ')+'\n':'')+'Click to select; full provenance in Selected observation details.').replaceAll('\n','<br>')}),
   hovertemplate:'%{hovertext}<extra></extra>',hoverlabel:{bgcolor:'#ffffff',font:{color:'#203d4b',size:12}}});
 });
 for(const p of ordered){
  const chosen=p.r.index===selected,flagged=settings.highlightFlagged&&p.quality?.flags.length;
  if(chosen||flagged){const v=positions.get(p.r.index);shapes.push({name:chosen?'selected-abundance-bar':'flagged-abundance-bar',type:'rect',xref:'x',yref:'y',x0:v.x-v.width/2,x1:v.x+v.width/2,y0:v.top,y1:v.top+100,fillcolor:'rgba(0,0,0,0)',line:{color:chosen?'#000000':'#b4580b',width:chosen?2.5:2,dash:flagged?'dot':'solid'}})}
 }
 return {traces,shapes,annotations,bottom:Math.max(100,(m.states.length-1)*132+100),height:Math.max(300,m.states.length*150+95)};
}
function trajectoryPointDetails(p){
 const b=datasetRegistry.get(META.id),a=b.cohortAnalysis,q=el('coverage').value,merged=a?.merged[q]?.pairs[p.r.profile];
 const fallback=a?.merged[q]?.fallback?.[p.r.profile];
 const support=fallback?'\nNeighbor support: '+fallback.votes+' / '+fallback.voters+' eligible voters among '+fallback.neighborhood+' nearest records; '+fallback.tiedGroups+' groups tied. Nearest winning distance: '+fallback.nearestDistance+' (proportions).':'';
 const num=v=>v===null||v===undefined?'unavailable':Number(v).toPrecision(5),full=pair=>pair==null?'No leading pair (one positive taxon)':String(pair).split(',').map(id=>b.data.featureNames[id]||id).join(' + ');
 return `${participantLabel(p.r)} · ${p.r.specimen}\n${participantDateLabel(p.r)}\nRecord: ${p.r.id}\nOriginal visit: ${p.r.originalVisit||'unavailable'}${p.r.transitionPolicy?'\nReviewed visit: '+(p.r.reviewedVisit||'unavailable')+'\nParticipant unit: '+p.r.participantUnit+'\nLink evidence: '+p.r.metadataEvidence+'\nTiming evidence: '+p.r.timingEvidence+'\nOrdered observation eligible: '+p.r.orderedEligible+'\nExact time eligible: '+p.r.timeVerified+'\nScientific release eligible: false':''} · Order: ${p.r.order??'unavailable'}\nSource day: ${p.r.elapsedDays??'unavailable'} · Origin: ${p.r.timeOrigin||'unavailable'} · Episode: ${p.r.episode||'not supplied'}${Number.isFinite(p.r.gestationalWeeks)?'\nGestation: '+p.r.gestationalWeeks.toFixed(1)+' weeks':''}\n${p.r.flags.join('; ')}\nOriginal pair: ${full(p.p.original)}\nAssigned merged group (${q}%): ${merged?full(merged):'unavailable'}\nAssignment route: ${a?.merged[q]?.methods?.[p.r.profile]||a?.merged[q]?.routes?.[p.r.profile]||'see assignment details'}${support}${p.mass===0&&p.rank===2?'\nNeither assigned taxon is detected. This merged assignment is not the original dominant pair.':''}\nTrajectory: ${p.missing?'Not drawn — '+p.missing:trajectoryLabel({ids:p.placement?.g.ids||p.ids,rank:p.placement?2:p.rank,g:p.placement?.g||p.g})}${p.placement?'\nEndpoint placement: '+full(p.placement.pair)+' · '+p.placement.side+' named feature ('+p.placement.rule+(p.placement.neighbor?', '+p.placement.neighbor:'')+'). Categorical end of observed interval; not a measured pair coordinate.':''}${p.endpoint?'\nEndpoint criterion: '+p.endpoint.basis+' ≥95%; '+num(100*p.endpoint.fraction)+'% of '+(p.endpoint.basis==='within-pair'?'the named pair only (not the whole sample)':'the whole sample'):''}\n${trajectoryWholeText(p,b)}\nPair-coordinate t uses only the two named taxa as denominator; it is not whole-sample abundance.\nLeading abundance: ${num(100*p.p.p1)}%\n${p.rank===1?'Dominant-feature':'Named-pair'} mass: ${num(100*p.mass)}%; residual: ${num(100*p.off)}%\nt: ${num(p.t)}; u: ${num(p.u)}; lower: ${num(p.g?.a)}; upper: ${num(p.g?.b)}; d: ${num(p.g?.d)}\nOriginal p2 − p3: ${num(100*(p.p.p2-p.p.p3))} pp${p.missing?'\n'+p.missing:''}${p.quality?'\n\n'+trajectoryQualityText(p.quality):''}`;
}
function trajectoryDensityRequest(m){return {context:trajectoryIdentity()+'|'+participant.key+'|rank1='+trajectorySettings.rank1+'|pairEndpoints='+trajectorySettings.pairEndpoints,groups:m.states.filter(s=>s.rank===2).map(s=>({id:s.id,positions:s.points.filter(p=>p.t!==null&&!p.placement).map(p=>p.t).sort((a,b)=>a-b),lower:s.g.a,upper:s.g.b})).filter(g=>g.positions.length)}}
function requestTrajectoryDensity(m){
 const request=trajectoryDensityRequest(m);if(!request.groups.length)return {groups:[]};
 const key=JSON.stringify(request),cached=trajectoryDensityCache.get(key);if(cached)return cached;
 if(trajectoryDensityJob?.key===key)return null;
 trajectoryDensityJob?.controller?.abort();
 const job={key,controller:typeof AbortController==='function'?new AbortController():null};trajectoryDensityJob=job;
 if(typeof fetch!=='function'){job.error='Local R service unavailable';return null}
 job.promise=(async()=>{try{
  const response=await fetch('/api/trajectory-density',{method:'POST',headers:{'Content-Type':'application/json'},body:key,signal:job.controller?.signal}),result=await response.json();
  if(!response.ok)throw Error(result.error||'Local R service unavailable');
  if(!Array.isArray(result.groups)||result.groups.length!==request.groups.length)throw Error('Invalid density result');
  for(const [i,g] of result.groups.entries()){
   if(g.id!==request.groups[i].id||g.n!==request.groups[i].positions.length||!['rug','density'].includes(g.type))throw Error('Invalid density membership');
   if(g.type==='density'&&(!Array.isArray(g.position)||g.position.length!==256||!Array.isArray(g.density)||g.density.length!==256||g.position.some(v=>!Number.isFinite(v))||g.density.some(v=>!Number.isFinite(v)||v<0)||!Number.isFinite(g.bandwidth)||g.bandwidth<=0))throw Error('Invalid density coordinates');
  }
  if(trajectoryDensityJob!==job)return;trajectoryDensityCache.set(key,result);if(trajectoryDensityCache.size>24)trajectoryDensityCache.delete(trajectoryDensityCache.keys().next().value);
 }catch(error){if(trajectoryDensityJob!==job)return;job.error=error.message}
 if(participant.active&&trajectorySettings.density&&trajectoryDensityJob===job)renderSubjectTrajectory();})();return null;
}
function trajectoryGraphPair(point){
 // Endpoint squares borrow a neighboring interval for display only. Linking
 // must follow that interval rather than the record's unchanged assignment.
 return point?.placement?.pair??(point?.rank===2?point.pair:null);
}
function trajectoryParticipantGraphPair(rows,index){
 const model=trajectoryBuild(datasetRegistry.get(META.id),participantData(),rows,
  trajectorySettings,el('coverage').value,participantTiming(rows));
 return trajectoryGraphPair(model.points.find(p=>p.r.index===index));
}
function trajectorySelectedVisitGuide(point,settings=trajectorySettings){
 // A display-only guide: follow the selected observation without moving axes.
 if(!point||!Number.isFinite(point.x))return [];
 return [{name:'selected-visit-guide',type:'line',xref:'x',yref:'y domain',
  x0:point.x,x1:point.x,y0:0,y1:1,layer:'below',
  line:{color:settings.visitGuideColor??trajectoryDefaults.visitGuideColor,width:settings.visitGuideWidth??trajectoryDefaults.visitGuideWidth,dash:'dot'},
  opacity:settings.visitGuideOpacity??trajectoryDefaults.visitGuideOpacity}];
}
function trajectoryAvailableHeight(){
 const content=el('trajectoryContent'),scroll=el('trajectoryScroll');
 if(typeof getComputedStyle!=='function')return scroll.clientHeight||0;
 // Measure the panel's budget, independently of the scaled plot/scroll height.
 // Otherwise shrinking the wrapper would shrink the next render again.
 const style=getComputedStyle(content);
 let available=content.clientHeight-(parseFloat(style.paddingTop)||0)-(parseFloat(style.paddingBottom)||0);
 for(const child of content.children){
  if(child===scroll)continue;
  const css=getComputedStyle(child);if(css.display==='none')continue;
  available-=child.getBoundingClientRect().height+(parseFloat(css.marginTop)||0)+(parseFloat(css.marginBottom)||0);
 }
 return Math.max(120,available);
}
function trajectoryCanvasHeight(){
 const frame=95+trajectoryEndpointPadding(trajectorySettings.endpointFontSize,0);
 const base=Math.max(trajectoryNaturalHeight,trajectoryAvailableHeight());
 // Keep fonts and label margins readable; compress/stretch the complete plotting
 // area so the time-axis ticks and title move with the last component.
 return Math.round(frame+Math.max(1,base-frame)*trajectorySettings.verticalScale/100);
}
function trajectorySavePreference(){try{(typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).setItem(trajectoryPreference,JSON.stringify(trajectorySettings))}catch{}}
function renderSubjectTrajectory(){
 if(!participant.active)return;
 const revision=++trajectoryDrawRevision,rows=participantRows(),b=datasetRegistry.get(META.id),d=participantData();
 try{
  const stacked=trajectorySettings.representation==='stacked',whole=stacked||trajectorySettings.representation==='whole';
  const context=[META.id,participant.key,trajectorySettings.representation,trajectorySettings.mode,trajectorySettings.rank1,trajectorySettings.pairEndpoints,trajectorySettings.axis,trajectorySettings.mode==='merged'?el('coverage').value:'pure'].join('|');
  if(trajectoryContext&&context!==trajectoryContext){trajectoryRanges=null;trajectoryRestoredScale=null}trajectoryContext=context;
  let m=trajectoryBuild(b,d,rows,trajectorySettings,el('coverage').value,participantTiming(rows));
  if(trajectoryRestoredScale!==null)m=trajectoryBuild(b,d,rows,trajectorySettings,el('coverage').value,participantTiming(rows),trajectoryRestoredScale);
  else if(trajectoryFitAll){const available=trajectoryAvailableHeight()||450,n=m.states.length,span=m.states.reduce((sum,s)=>sum+(s.g?.d||0),0);const scale=Math.max(12,Math.min(110,(available-100-n*(trajectorySettings.fontSize*2+45))/Math.max(.1,span)));m=trajectoryBuild(b,d,rows,trajectorySettings,el('coverage').value,participantTiming(rows),scale)}trajectoryModel=m;trajectoryQualityPreview(m,b,el('coverage').value);
  renderTrajectoryTaxonEditor(m,b);
  el('trajectoryRepresentation').value=trajectorySettings.representation;
  el('trajectoryBarControls').hidden=!whole;
  el('trajectoryThresholdControls').hidden=!stacked;el('trajectoryMassThreshold').value=trajectorySettings.massThreshold;el('trajectoryMassScope').value=trajectorySettings.massScope;
  el('trajectoryStackedHelp').hidden=!stacked;el('trajectoryStackedHelp').textContent=stacked?trajectoryStackedDescription():'';
  el('trajectoryBarWidth').value=trajectorySettings.barWidth;
  el('trajectoryShowMass').checked=trajectorySettings.showMass;
  el('trajectoryMassFontSize').value=trajectorySettings.massFontSize;
  el('trajectoryMassFontSize').disabled=!trajectorySettings.showMass;
  el('trajectoryHorizontalMass').checked=trajectorySettings.horizontalMass;
  el('trajectoryHorizontalMass').disabled=!trajectorySettings.showMass;
  el('trajectoryRoundMass').checked=trajectorySettings.roundMass;
  el('trajectoryRoundMass').disabled=!trajectorySettings.showMass;
  el('trajectoryDensity').disabled=whole;
  el('trajectoryFit').disabled=whole;
  el('trajectoryWholeHelp').hidden=!whole||stacked;
  el('trajectoryPairLegend').hidden=whole;
  el('trajectoryStateInterpretation').hidden=stacked;
  el('trajectoryWholeSelected').hidden=!whole;
  el('trajectoryVerticalScale').value=trajectorySettings.verticalScale;
  el('trajectoryFit').textContent=trajectoryFitAll?'Comfortable spacing':'Fit all states';
  const control=el('trajectoryMode');control.value=m.mode;control.options[1].disabled=!b.cohortAnalysis?.merged[el('coverage').value];
  el('trajectoryVisitGuideColor').value=trajectorySettings.visitGuideColor;
  el('trajectoryVisitGuideOpacity').value=Math.round(100*trajectorySettings.visitGuideOpacity);
  el('trajectoryVisitGuideOpacityValue').textContent=Math.round(100*trajectorySettings.visitGuideOpacity)+'%';
  el('trajectoryVisitGuideWidth').value=trajectorySettings.visitGuideWidth;
  el('trajectoryVisitGuideWidthValue').textContent=trajectorySettings.visitGuideWidth+' px';
  el('trajectoryEndpointGuides').checked=trajectorySettings.showEndpointGuides;
  el('trajectoryGuideColor').value=trajectorySettings.endpointGuideColor;el('trajectoryGuideColor').disabled=!trajectorySettings.showEndpointGuides;
  el('trajectoryGuideOpacity').value=Math.round(100*trajectorySettings.endpointGuideOpacity);el('trajectoryGuideOpacity').disabled=!trajectorySettings.showEndpointGuides;
  el('trajectoryEndpointFont').value=trajectorySettings.endpointFontSize;el('trajectoryEndpointFontValue').textContent=trajectorySettings.endpointFontSize+' px';
  el('trajectoryGuideWidth').value=trajectorySettings.endpointGuideWidth;el('trajectoryGuideWidth').disabled=!trajectorySettings.showEndpointGuides;
  el('trajectoryGuideWidthValue').textContent=trajectorySettings.endpointGuideWidth+' px';
  el('trajectoryGuideOpacityValue').textContent=Math.round(100*trajectorySettings.endpointGuideOpacity)+'%';
  el('trajectoryHighlightFlagged').checked=trajectorySettings.highlightFlagged;
  el('trajectoryStateSize').checked=trajectorySettings.showStateSize;el('trajectoryReadDepth').checked=trajectorySettings.showReadDepth;
  if(d.capabilities?.trajectoryDensity===false)trajectorySettings.density=false;
  el('trajectoryDensity').disabled=whole||d.capabilities?.trajectoryDensity===false;
  el('trajectoryDensity').checked=trajectorySettings.density;el('trajectoryRank1').checked=trajectorySettings.rank1;el('trajectoryPairEndpoints').checked=trajectorySettings.pairEndpoints;
  el('trajectoryAxis').value=trajectorySettings.axis;el('trajectoryAxis').options[1].disabled=!m.timing.available;
  el('trajectoryFont').value=trajectorySettings.fontSize;el('trajectoryFontValue').textContent=trajectorySettings.fontSize+' px';
  const subtitle=`${rows[0].cohort} · ${rows[0].subject} · ${rows.length} observations · ${m.mode==='pure'?'Original pairs':'Assigned groups · '+el('coverage').value+'% target'}\nTrajectory reference: ${m.reference.scope} · ${m.reference.n} records`;
  el('trajectorySummary').textContent=subtitle;el('trajectorySummary').title=subtitle;el('trajectoryReferenceInfo').textContent='Trajectory reference: '+m.reference.scope+' · '+m.reference.n+' records'+(m.mode==='merged'?' · '+el('coverage').value+'% core target':'');
  el('trajectoryOptionsSummary').textContent='Trajectory options · '+(m.mode==='pure'?'Pure pairs':'Merged groups')+' · ≥95% '+(trajectorySettings.rank1?'on':'off')+' · Within-pair endpoints '+(trajectorySettings.pairEndpoints?'on':'off')+' · Density '+(whole?'pair view only':trajectorySettings.density?'on':'off');
  const zeroAssigned=m.mode==='merged'?m.points.filter(p=>p.rank===2&&p.mass===0).length:0;
  el('trajectoryAssignmentWarning').hidden=!zeroAssigned;el('trajectoryAssignmentWarning').textContent=zeroAssigned+' visit(s) have 0% abundance for both assigned taxa. Merged labels name assigned groups, not necessarily dominant taxa; inspect Original pair and Neighbor support in observation details.';
  el('trajectoryTiming').textContent=m.elapsed?(m.timing.axisLabel||'Days since first observed collection')+'; intervening states unknown.': 'Visit order; spacing does not represent elapsed time. '+(!m.timing.available?m.timing.reason:'');
  const navigation=()=>`<button type="button" aria-label="Previous visit" title="Previous visit" data-trajectory-step="-1"${rows[0].index===participant.record?' disabled':''}>‹</button> <select aria-label="Select trajectory visit" data-trajectory-visit>${rows.map(r=>`<option value="${r.index}"${r.index===participant.record?' selected':''}>${esc(r.label+' · '+participantDateLabel(r)+' · '+r.specimen)}</option>`).join('')}</select> <button type="button" aria-label="Next visit" title="Next visit" data-trajectory-step="1"${rows.at(-1).index===participant.record?' disabled':''}>›</button>`;
  el('trajectoryNavigation').innerHTML=navigation();el('compactTrajectoryNavigation').innerHTML=navigation()+' <button type="button" data-open-trajectory>Open trajectory</button>';
  const selectedPoint=m.points.find(p=>p.r.index===participant.record),stackedSummary=stacked?trajectoryStackedComposition(m,trajectorySettings):null;
  el('trajectoryWholeSelected').textContent=selectedPoint?(stacked?trajectoryStackedSelected(selectedPoint,b,stackedSummary):selectedPoint.r.label+' · '+trajectoryWholeText(selectedPoint,b,true)+(selectedPoint.missing?' · Not drawn: '+selectedPoint.missing:'')):'';el('trajectoryRecordDetails').textContent=selectedPoint?trajectoryPointDetails(selectedPoint):'';
  el('compactTrajectoryDetails').textContent=selectedPoint?participantLabel(selectedPoint.r)+' · '+participantDateLabel(selectedPoint.r):'';
  el('trajectoryUnordered').innerHTML=m.points.some(p=>p.x===null)?'<strong>Unordered observations · no path</strong> '+m.points.filter(p=>p.x===null).map(p=>`<button type="button" data-trajectory-record="${p.r.index}"${trajectorySettings.highlightFlagged&&p.quality.flags.length?' class="trajectoryFlaggedRecord"':''} title="${esc(p.quality.flags.map(f=>f.text).join('; ')+'\n'+trajectoryPointDetails(p))}">${esc(p.r.label+' · '+p.r.specimen)}</button>`).join(' '):'';
  let density=null;
  if(trajectorySettings.density&&!whole)density=requestTrajectoryDensity(m);else {trajectoryDensityJob?.controller?.abort();trajectoryDensityJob=null}
  el('trajectoryExportDensity').disabled=!density;
  el('trajectoryDensityStatus').textContent=trajectorySettings.density&&!whole?(density?'R density · observations, not time-weighted · each state peak = 1':trajectoryDensityJob?.error?'Density unavailable: '+trajectoryDensityJob.error+' · observed positions shown':'Calculating R density… observed positions shown'):'';
  el('trajectoryRetry').hidden=whole||!trajectorySettings.density||!trajectoryDensityJob?.error;
  const traces=[],shapes=trajectorySelectedVisitGuide(selectedPoint),annotations=[],xDomain=trajectorySettings.density&&!whole?[0,.74]:[0,1];
  const ordered=m.points.filter(p=>p.x!==null),marks=ordered.filter(p=>!p.missing);
  let wholeChart=null;
  if(whole){
   wholeChart=stacked?trajectoryStackedChart(m,b,trajectorySettings,participant.record,stackedSummary):trajectoryWholeChart(m,b,trajectorySettings,participant.record);
   traces.push(...wholeChart.traces);shapes.push(...wholeChart.shapes);annotations.push(...wholeChart.annotations);
  }else{
  for(const s of m.states){
   shapes.push(...trajectoryEndpointGuides(s,trajectorySettings));
   annotations.push(...trajectoryEndpointAnnotations(s,b,trajectorySettings.endpointFontSize),...trajectoryMaximumAnnotations(s,b,trajectorySettings.endpointFontSize));
   if(s.points.some(p=>p.missing)&&s.rank===2)annotations.push({x:0,xref:'paper',y:s.unavailableY,yref:'y',text:'Pair coordinate unavailable',showarrow:false,xanchor:'right',xshift:-12,font:{size:10,color:'#647680'}});
   for(const p of s.points)shapes.push(...trajectoryIntervalShapes(s,p));
  }
  // Plotly can hit a connector endpoint before the overlaid visit marker.
  // Give both traces the same record identity so either hit selects the visit.
  for(const s of m.segments)traces.push({type:'scatter',mode:'lines',x:[s.a.x,s.b.x],y:[s.a.y,s.b.y],customdata:[s.a.r.index,s.b.r.index],line:{color:'#78858b',width:1,dash:s.dash},text:s.a.r.label+' → '+s.b.r.label+(s.days===null?'':' · '+s.days+' days'),hoverinfo:'text',showlegend:false});
  const flagged=trajectorySettings.highlightFlagged?marks.filter(p=>p.quality.flags.length):[];
  if(flagged.length)traces.push({type:'scatter',name:'Flagged observations',meta:{trajectoryQualityHighlight:true},mode:'markers',x:flagged.map(p=>p.x),y:flagged.map(p=>p.y),customdata:flagged.map(p=>p.r.index),hovertext:flagged.map(trajectoryFlagHover),hovertemplate:'%{hovertext}<extra></extra>',hoverlabel:{bgcolor:'#fff8ed',bordercolor:'#b4580b',font:{color:'#203d4b',size:12}},showlegend:false,marker:{symbol:'circle-open',size:flagged.map(p=>p.r.index===participant.record?24:20),color:'#b4580b',line:{width:2.5}}});
  traces.push({type:'scatter',mode:'markers',x:marks.map(p=>p.x),y:marks.map(p=>p.y),customdata:marks.map(p=>p.r.index),hovertext:marks.map(p=>trajectorySettings.highlightFlagged&&p.quality.flags.length?trajectoryFlagHover(p):esc(trajectoryPointDetails(p)).replaceAll('\n','<br>')),hovertemplate:'%{hovertext}<extra></extra>',hoverlabel:{bgcolor:'#ffffff',font:{color:'#203d4b',size:12}},showlegend:false,
   marker:{size:marks.map(p=>p.r.index===participant.record?13:9),symbol:marks.map(p=>p.missing?'x':p.endpoint?.basis==='within-pair'?'square-open':p.rank===1?'square':p.p.p2-p.p.p3<.02?'diamond':'circle'),color:marks.map(p=>p.mass),cmin:0,cmax:1,colorscale:[[0,'#edf5fa'],[1,'#1769aa']],line:{color:marks.map(p=>p.r.index===participant.record?'#000000':'#405c6b'),width:marks.map(p=>p.r.index===participant.record?3:1)}}});
  if(trajectorySettings.density)for(const s of m.states){
   const pairPoints=s.points.filter(p=>p.rank===2&&!p.placement),rank1Count=s.points.length-pairPoints.length,valid=pairPoints.filter(p=>p.t!==null),estimate=density?.groups.find(g=>g.id===s.id);
   annotations.push({x:1,xref:'paper',y:s.middle,yref:'y',text:s.rank===1?`${s.points.length} rank-1 observations`:`${valid.length}/${pairPoints.length} pair positions${rank1Count?' · '+rank1Count+' endpoint squares':''}${s.points.some(p=>p.missing)?' · '+s.points.filter(p=>p.missing).length+' unavailable':''}`,showarrow:false,xanchor:'right',font:{size:10}});
   if(estimate?.type==='density'){
    const max=Math.max(...estimate.density);traces.push({type:'scatter',mode:'lines',x:estimate.density.map(v=>max?v/max:0),y:estimate.position.map(t=>s.top+m.scale*(t-s.g.a)),xaxis:'x2',line:{color:'#1769aa',width:1.5},hoverinfo:'skip',showlegend:false});
   }else traces.push({type:'scatter',mode:'markers',x:valid.map(()=>.04),y:valid.map(p=>p.y),xaxis:'x2',marker:{symbol:'line-ns',size:9,color:'#1769aa'},hoverinfo:'skip',showlegend:false});
  }
  }
  renderTrajectoryPhylotypeLegend(traces,stacked);
  const bodyHeight=whole?wholeChart.height:Math.max(300,m.height),headingPadding=Math.max(trajectoryEndpointPadding(trajectorySettings.endpointFontSize,0),whole&&trajectorySettings.showMass?Math.ceil(trajectorySettings.massFontSize*3.5+8)-30:0),naturalHeight=bodyHeight+headingPadding,plot=el('trajectoryPlot');
  trajectoryNaturalHeight=naturalHeight;const height=trajectoryCanvasHeight();plot.style.height=height+'px';
  const xs=ordered.map(p=>p.x),min=Math.min(...xs,0),max=Math.max(...xs,1),pad=Math.max(.4,(max-min)*.035);
  const xRange=trajectoryRanges?.x||[min-pad,max+pad],qualityTracks=trajectoryQualityTracks(m,ordered,participant.record,xDomain,xRange,95,b,trajectorySettings);
  if(!whole)annotations.push(trajectoryEndpointHeading(trajectorySettings.endpointFontSize,1));
  // Independent state endpoint labels, not one continuous percentage scale.
  traces.push({type:'scatter',x:[null],y:[null],yaxis:'y7',mode:'markers',hoverinfo:'skip',showlegend:false});
  // Exclude the model's trailing inter-state gap from the initial visible range.
  // Explicit pan/zoom ranges (including restored named views) still take precedence.
  const stateBottom=whole?wholeChart.bottom:Math.max(0,...m.states.map(s=>s.top+s.height),...ordered.filter(p=>!p.missing).map(p=>p.y));
  const yRange=trajectoryRanges?.y||(stacked?[0,105]:[stateBottom?stateBottom+5:m.height,0]);
  const layout={height,width:Math.max(560,plot.clientWidth),margin:{l:stacked?75:Math.min(340,Math.max(230,Math.max(trajectorySettings.fontSize,trajectorySettings.endpointFontSize)*19)),r:stacked?20:whole?Math.max(70,trajectorySettings.endpointFontSize*4):Math.max(180,trajectorySettings.fontSize*14,trajectoryEndpointHeading(trajectorySettings.endpointFontSize,1).xshift+155),t:30+headingPadding,b:65},font:{size:trajectorySettings.fontSize,color:'#203d4b'},showlegend:false,legend:{x:1.02,y:1,font:{size:trajectorySettings.fontSize},itemclick:false,itemdoubleclick:false,traceorder:'normal'},shapes,annotations,
   barmode:'overlay',dragmode:'pan',uirevision:context,xaxis:{domain:xDomain,title:{text:m.elapsed?(m.timing.axisLabel||'Days since first observed collection'):'Visit order',font:{size:trajectorySettings.fontSize},standoff:6},tickfont:{size:trajectorySettings.fontSize},range:trajectoryRanges?.x||[min-pad,max+pad],autorange:false,zeroline:false,gridcolor:annotationTimeGridColor,gridwidth:1,...(!m.elapsed?{tickmode:'array',tickvals:m.orders.map((_,i)=>i),ticktext:m.orders.map(order=>rows.find(r=>r.order===order).label)}:{})},
   yaxis:{domain:[0,1],range:yRange,autorange:false,showticklabels:stacked,zeroline:false,showgrid:false,tickmode:stacked?'array':'auto',tickvals:stacked?[0,20,40,60,80,100]:undefined,title:stacked?{text:'Whole-sample abundance (%)'}:undefined,gridcolor:trajectorySettings.endpointGuideColor,gridwidth:trajectorySettings.endpointGuideWidth},
   yaxis7:{overlaying:'y',matches:'y',side:'right',anchor:'free',position:1,showticklabels:false,showgrid:false,zeroline:false,showline:true,linecolor:'#94a8b2'},
   xaxis2:{domain:[.8,1],anchor:'y',range:[0,1.08],fixedrange:true,title:'State peak = 1',showgrid:false,zeroline:false,visible:trajectorySettings.density&&!whole}};
  layout.meta={annotationTimeAxis:JSON.parse(JSON.stringify(layout.xaxis))};
  trajectoryQueue=trajectoryQueue.catch(()=>{}).then(async()=>{
   if(revision!==trajectoryDrawRevision)return;
   await Plotly.react('trajectoryPlot',traces,layout,{responsive:true,scrollZoom:true,displaylogo:false,displayModeBar:false});
   const trackPlot=el('trajectoryTracksPlot'),trackHeight=trajectoryTrackHeight(trajectorySettings,m);
   trackPlot.style.height=(trackHeight+50)+'px';trackPlot.hidden=!trackHeight;el('trajectoryTracksEmpty').hidden=!!trackHeight;
   await Plotly.react(trackPlot,[{type:'scatter',x:[null],y:[null],hoverinfo:'skip',showlegend:false},...qualityTracks.traces],{
    ...qualityTracks.layout,height:trackHeight+50,margin:{...layout.margin,t:30,b:20},font:layout.font,showlegend:false,
    shapes:qualityTracks.shapes,annotations:qualityTracks.annotations,dragmode:'pan',uirevision:context,
    xaxis:{domain:xDomain,range:xRange,autorange:false,visible:false},yaxis:{visible:false,fixedrange:true}
   },{responsive:true,scrollZoom:true,displaylogo:false,displayModeBar:false});
   await renderAnnotationTracks(m,layout);
   if(trackHeight&&!trackPlot._trajectoryEvents&&typeof window!=='undefined'){
    trackPlot._trajectoryEvents=true;
    trackPlot.on('plotly_click',event=>{const id=event.points?.[0]?.customdata;if(Number.isInteger(id))chooseParticipantRecord(id)});
    trackPlot.on('plotly_relayout',event=>{
     if(Object.keys(event).some(k=>/^xaxis[3456]?\.autorange$/.test(k)&&event[k])){trajectoryRanges=null;renderSubjectTrajectory();return}
     if(Object.keys(event).some(k=>/^xaxis[3456]?\.range/.test(k))){
      const range=[...trackPlot.layout.xaxis.range];trajectoryRanges={x:range,y:[...plot.layout.yaxis.range]};
      if(JSON.stringify(range)!==JSON.stringify(plot.layout.xaxis.range))Plotly.relayout(plot,{'xaxis.range':range});
     }
    });
   }
   if(!plot._trajectoryEvents&&typeof window!=='undefined'){
    plot._trajectoryEvents=true;plot.on('plotly_click',event=>{const id=event.points?.[0]?.customdata;if(Number.isInteger(id))chooseParticipantRecord(id)});
    plot.on('plotly_relayout',event=>{
     if(event['xaxis.autorange']||event['yaxis.autorange']){trajectoryRanges=null;renderSubjectTrajectory();return}
     if(Object.keys(event).some(k=>/^[xy]axis\.range/.test(k))){
      trajectoryRanges={x:[...plot.layout.xaxis.range],y:[...plot.layout.yaxis.range]};
      syncAnnotationRange(trajectoryRanges.x);
      if(trackPlot.data&&JSON.stringify(trackPlot.layout.xaxis.range)!==JSON.stringify(trajectoryRanges.x))Plotly.relayout(trackPlot,{'xaxis.range':trajectoryRanges.x});
     }
    });
   }
  }).catch(error=>{el('trajectoryDensityStatus').textContent='Trajectory rendering error: '+error.message});
 }catch(error){el('trajectoryDensityStatus').textContent='Trajectory unavailable: '+error.message;trajectoryModel=null;el('trajectoryPlot').replaceChildren()}
}
function trajectoryCsv(){
 const fields=['record_id','specimen','visit','date','source_day','order','trajectory_mode','reference_target','reference','state','rank','original_pair','assigned_pair','leading_abundance','mass','off_pair','t','u','lower','upper','d','missing','flags','display_row','endpoint_pair','endpoint_feature','endpoint_side','placement_neighbor_record','placement_rule','display_geometry','endpoint_basis','endpoint_fraction','quality_policy','quality_status','quality_flags','quality_unassessed','reference_state_records','analyzed_reads','reported_reads','named_pair_reads','assignment_route','assignment_evidence','read_source','read_source_sha256','displayed_reference_state_records','drawn_in_trajectory','representation','display_first_taxon','display_first_whole_fraction','display_second_taxon','display_second_whole_fraction','display_other_whole_fraction'];
 const b=datasetRegistry.get(META.id),q=el('coverage').value,m=trajectoryModel;
 const rows=m.points.map(p=>[p.r.id,p.r.specimen,p.r.label,p.r.date??'',p.r.elapsedDays??'',p.r.order??'',m.mode,q,m.reference.scope,p.rank===1?'1:'+p.ids[0]:p.rank===2?'2:'+p.pair:p.state,p.rank,p.p.original,b.cohortAnalysis?.merged[q]?.pairs[p.r.profile]??'',p.p.p1,p.mass,p.off,p.t??'',p.u??'',p.g?.a??'',p.g?.b??'',p.g?.d??'',p.missing,p.r.flags.join('; '),p.state,p.placement?.pair??'',p.placement?.feature??'',p.placement?.side??'',p.placement?.neighbor??'',p.placement?.rule??'','whole-sample-vertices-v5',p.endpoint?.basis??'',p.endpoint?.fraction??'',p.quality?.version??'',p.quality?.status??'',p.quality?.flags.map(f=>f.code).join('; ')??'',p.quality?.unknown.join('; ')??'',p.quality?.stateN??'',p.quality?.reads??'',p.quality?.reported??'',p.quality?.pairReads??'',p.quality?.route??'',p.quality?.support?JSON.stringify(p.quality.support):'',p.quality?.source?.path??'',p.quality?.source?.sha256??'',p.quality?.displayStateN??'',(trajectorySettings.representation==='stacked'||!p.missing)&&p.x!==null,trajectorySettings.representation,b.data.featureNames[trajectoryWholeComposition(p).ids[0]]??'',trajectoryWholeComposition(p).first,b.data.featureNames[trajectoryWholeComposition(p).ids[1]]??'',trajectoryWholeComposition(p).second,trajectoryWholeComposition(p).other]);
 if(trajectorySettings.representation==='stacked'){
  const summary=trajectoryStackedComposition(m,trajectorySettings);fields.push('stacked_threshold_percent','stacked_threshold_scope','stacked_taxa_json','stacked_displayed_mass','stacked_other_mass');
  m.points.forEach((p,i)=>{const row=summary.selected.get(p.r.index);rows[i].push(summary.threshold,summary.scope,JSON.stringify([...row.ids].map(id=>({phylotype:b.data.featureNames[id],fraction:p.p.values.get(id)||0}))),row.mass,row.other)});
 }
 const annotations=annotationCsvColumns(m,annotationAsset(),annotationSettings);
 if(b.cohortAnalysis?.eligibility){fields.push('analysis_revision');rows.forEach(row=>row.push(b.cohortAnalysis.eligibility.revision))}
 return [[...fields,...annotations.fields],...rows.map((row,i)=>[...row,...annotations.rows[i]])].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
}
function trajectoryDownload(blob,suffix){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(META.id+'_'+participantRows()[0].subject+'_trajectory'+suffix).replace(/[^a-zA-Z0-9_.-]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
// Blob URLs trigger native downloads in the in-app browser; Plotly data URLs do not.
async function trajectoryPrepareImageDownload(data,link,filename){
 const blob=await (await fetch(data)).blob(),url=URL.createObjectURL(blob),previous=link.href;
 link.href=url;link.download=filename;link.hidden=false;
 // Keep the current URL for manual retries and give an earlier download time to start.
 if(previous?.startsWith('blob:'))setTimeout(()=>URL.revokeObjectURL(previous),60000);
 link.click();
}
const qualityRulesExpandedKey='vme-quality-rules-open-v1';
function validateQualityRulesExpanded(value){if(value!==undefined&&typeof value!=='boolean')throw Error('Invalid saved Quality rules layout.')}
function restoreQualityRulesExpanded(value){
 validateQualityRulesExpanded(value);if(value===undefined)return;
 el('trajectoryQualityRules').open=value;
 try{(typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).setItem(qualityRulesExpandedKey,String(value))}catch{}
}
function installTrajectory(){
 const taxonList=el('trajectoryTaxonColorList');
 const editTaxon=event=>{const name=event.target.dataset?.trajectoryTaxonColor;if(name)setTrajectoryTaxonColor(name,event.target.value)};
 taxonList.addEventListener('input',editTaxon);taxonList.addEventListener('change',editTaxon);
 taxonList.addEventListener('click',event=>{const reset=event.target.closest?.('[data-trajectory-taxon-reset]');if(reset)setTrajectoryTaxonColor(reset.dataset.trajectoryTaxonReset,null)});
 el('trajectoryTaxonColors').addEventListener('toggle',()=>{if(trajectoryModel)trajectoryRestoredScale=trajectoryModel.scale});
 el('trajectoryTracks').addEventListener('toggle',()=>{
  // Expanding context must not change a fitted trajectory when selecting the next visit.
  if(trajectoryModel)trajectoryRestoredScale=trajectoryModel.scale;
  if(el('trajectoryTracks').open&&el('trajectoryTracksPlot').data)Plotly.Plots.resize('trajectoryTracksPlot');
 });
 const rules=el('trajectoryQualityRules');
 try{rules.open=(typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).getItem(qualityRulesExpandedKey)==='true'}catch{}
 rules.addEventListener('toggle',()=>{
  if(trajectoryModel)trajectoryRestoredScale=trajectoryModel.scale;
  try{(typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).setItem(qualityRulesExpandedKey,String(rules.open))}catch{}
 });
 for(const [id,key] of [['trajectoryMassThreshold','massThreshold'],['trajectoryMassScope','massScope']])el(id).onchange=()=>{
  const next={...trajectorySettings,[key]:key==='massThreshold'?Number(el(id).value):el(id).value};
  try{validateTrajectorySettings(next)}catch{el(id).value=trajectorySettings[key];return}
  trajectorySettings=next;trajectorySavePreference();renderSubjectTrajectory();
 };
 for(const [id,key,read] of [['trajectoryRepresentation','representation',e=>e.value],['trajectoryMode','mode',e=>e.value],['trajectoryDensity','density',e=>e.checked],['trajectoryRank1','rank1',e=>e.checked],['trajectoryPairEndpoints','pairEndpoints',e=>e.checked],['trajectoryAxis','axis',e=>e.value],['trajectoryFont','fontSize',e=>Number(e.value)]])el(id).onchange=()=>{trajectorySettings[key]=read(el(id));trajectorySavePreference();renderSubjectTrajectory();
  if(participant.active&&['mode','rank1','pairEndpoints'].includes(key)){
   const camera=pendingGraphCamera||readCamera('graph3d');participantGraphSelection();graph(camera);table();
  }
 };
 for(const [id,key] of [['trajectoryHorizontalMass','horizontalMass'],['trajectoryRoundMass','roundMass'],['trajectoryShowMass','showMass'],['trajectoryStateSize','showStateSize'],['trajectoryReadDepth','showReadDepth'],['trajectoryHighlightFlagged','highlightFlagged']])el(id).onchange=()=>{
  // Appearance changes must not refit a previously fitted trajectory or reset its ranges.
  if(trajectoryModel)trajectoryRestoredScale=trajectoryModel.scale;
  trajectorySettings[key]=el(id).checked;trajectorySavePreference();renderSubjectTrajectory();
 };
 for(const [id,key,read] of [['trajectoryVisitGuideColor','visitGuideColor',e=>e.value],['trajectoryVisitGuideOpacity','visitGuideOpacity',e=>Number(e.value)/100],['trajectoryVisitGuideWidth','visitGuideWidth',e=>Number(e.value)],['trajectoryEndpointGuides','showEndpointGuides',e=>e.checked],['trajectoryGuideColor','endpointGuideColor',e=>e.value],['trajectoryGuideOpacity','endpointGuideOpacity',e=>Number(e.value)/100],['trajectoryGuideWidth','endpointGuideWidth',e=>Number(e.value)],['trajectoryEndpointFont','endpointFontSize',e=>Number(e.value)]]){
  const update=()=>{
   const next={...trajectorySettings,[key]:read(el(id))};validateTrajectorySettings(next);
   if(trajectoryModel)trajectoryRestoredScale=trajectoryModel.scale;
   trajectorySettings=next;trajectorySavePreference();renderSubjectTrajectory();
  };
  el(id).onchange=update;if(id!=='trajectoryEndpointGuides')el(id).oninput=update;
 }
 const updateBarWidth=event=>{
  const input=el('trajectoryBarWidth'),value=Number(input.value);
  if(!input.value||!Number.isFinite(value)||value<25||value>300){if(event.type==='change')input.value=trajectorySettings.barWidth;return}
  if(trajectoryModel)trajectoryRestoredScale=trajectoryModel.scale;
  trajectorySettings.barWidth=value;trajectorySavePreference();renderSubjectTrajectory();
 };
 el('trajectoryBarWidth').oninput=updateBarWidth;el('trajectoryBarWidth').onchange=updateBarWidth;
 const updateMassFontSize=event=>{
  const input=el('trajectoryMassFontSize'),value=Number(input.value);
  if(!input.value||!Number.isInteger(value)||value<8||value>24){if(event.type==='change')input.value=trajectorySettings.massFontSize;return}
  if(trajectoryModel)trajectoryRestoredScale=trajectoryModel.scale;
  trajectorySettings.massFontSize=value;trajectorySavePreference();renderSubjectTrajectory();
 };
 el('trajectoryMassFontSize').oninput=updateMassFontSize;el('trajectoryMassFontSize').onchange=updateMassFontSize;
 el('trajectoryVerticalScale').onchange=()=>{
  const input=el('trajectoryVerticalScale'),value=Number(input.value),previous=trajectorySettings.verticalScale;
  if(!input.value||!Number.isFinite(value)||value<25||value>300){input.value=previous;return}
  const plot=el('trajectoryPlot');
  if(plot.layout&&trajectoryModel){
   trajectoryRanges={x:[...plot.layout.xaxis.range],y:[...plot.layout.yaxis.range]};
   trajectoryRestoredScale=trajectoryModel.scale;
  }
  trajectorySettings.verticalScale=value;trajectorySavePreference();renderSubjectTrajectory();
 };
 el('trajectoryFit').onclick=()=>{trajectoryFitAll=!trajectoryFitAll;trajectoryRestoredScale=null;el('trajectoryFit').textContent=trajectoryFitAll?'Comfortable spacing':'Fit all states';trajectoryRanges=null;el('trajectoryScroll').scrollTop=0;renderSubjectTrajectory()};
 el('trajectoryRetry').onclick=()=>{trajectoryDensityJob=null;renderSubjectTrajectory()};
 for(const id of ['trajectoryContent','trajectoryNavigation','compactTrajectory']){
  el(id).addEventListener('change',event=>{if(event.target.matches?.('[data-trajectory-visit]'))chooseParticipantRecord(Number(event.target.value))});
  el(id).addEventListener('click',event=>{
   const step=event.target.closest('[data-trajectory-step]'),record=event.target.closest('[data-trajectory-record]');
   if(step)stepParticipantVisit(Number(step.dataset.trajectoryStep));if(record)chooseParticipantRecord(Number(record.dataset.trajectoryRecord));
   if(event.target.closest('[data-open-trajectory]'))el('maximize-selectionPanel').click();
  });
 }
 el('trajectoryExportCsv').onclick=()=>{if(trajectoryModel)trajectoryDownload(new Blob([trajectoryCsv()],{type:'text/csv'}),'.csv')};
 el('trajectoryExportDensity').onclick=()=>{if(!trajectoryModel)return;const result=trajectoryDensityCache.get(JSON.stringify(trajectoryDensityRequest(trajectoryModel)));if(result)trajectoryDownload(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),'_density.json')};
 el('trajectoryExportImage').onclick=async()=>{
  const button=el('trajectoryExportImage'),status=el('trajectoryImageStatus'),link=el('trajectoryImageDownload');
  button.disabled=true;link.hidden=true;status.textContent='Preparing image…';
  try{
  if(trajectorySettings.density)await trajectoryDensityJob?.promise;await trajectoryQueue;
  const plot=el('trajectoryPlot'),format=el('trajectoryImageFormat').value,scale=Number(el('trajectoryImageScale').value);
  const exportLayout=copyCamera(plot.layout);exportLayout.margin={...exportLayout.margin,t:100,b:140};exportLayout.title={text:esc(el('trajectorySummary').textContent).replaceAll('\n','<br>')+'<br>Whole-sample vertex ≥95%: '+(trajectorySettings.rank1?'on':'off')+' · Within-pair endpoints: '+(trajectorySettings.pairEndpoints?'on':'off')+' · View: '+(trajectorySettings.representation==='stacked'?'Stacked bars · '+trajectorySettings.massScope+' · '+trajectorySettings.massThreshold+'%':trajectorySettings.representation==='whole'?'Whole-sample abundance':'Pair-coordinate trajectory')+' · Density: '+(trajectorySettings.density&&trajectorySettings.representation==='pair'?'state peak = 1':'off'),font:{size:13},x:.01};exportLayout.annotations.push({name:'trajectoryExportInterpretation',xref:'paper',yref:'paper',x:0,y:0,xshift:10-exportLayout.margin.l,yshift:-75,xanchor:'left',yanchor:'top',align:'left',showarrow:false,font:{size:10},text:trajectorySettings.representation==='stacked'?trajectoryStackedExportDescription():trajectorySettings.representation==='whole'?'Whole-sample abundance: consistent taxon colors match row labels; gray = all other taxa.<br>Each bar totals 100%; row placement follows the state/endpoint options, but amounts are never renormalized.<br>Black outline: selected visit. Orange/dotted outline: quality flags, when enabled.':'Blue fill: named-pair mass 0–100% (dominant-feature mass for rank 1).<br>◇ Rank margin &lt;2 pp · ■ Whole-sample ≥95% · □ Within-pair ≥95% · × Unavailable.<br>Endpoint names at left apply to each interval; squares mark categorical ends, not measured coordinates.<br>Dotted guides beside short intervals are not to scale; dashed intervals have unavailable positions.'+(trajectorySettings.highlightFlagged?'<br>Orange rings: quality flags only; assignments and positions unchanged.':'')});
  // The live legend is outside Plotly; restore it in the standalone image.
  let exportWidth=plot.clientWidth;
  if(trajectorySettings.representation==='stacked'){
   exportWidth+=220-exportLayout.margin.r;
   exportLayout.margin.r=220;exportLayout.showlegend=true;
  }
  let exportData=plot.data,extraHeight=0;
  if(el('trajectoryTracks').open){
   const m=trajectoryModel;extraHeight=trajectoryTrackHeight(trajectorySettings,m);
   if(extraHeight){
    const tracks=trajectoryQualityTracks(m,m.points.filter(p=>p.x!==null),participant.record,plot.layout.xaxis.domain,plot.layout.xaxis.range,plot.clientHeight,datasetRegistry.get(META.id),trajectorySettings);
    exportData=[...plot.data,...tracks.traces];Object.assign(exportLayout,tracks.layout);
    exportLayout.yaxis.domain=[0,tracks.main];exportLayout.shapes.push(...tracks.shapes);exportLayout.annotations.push(...tracks.annotations);
    const heading=exportLayout.annotations.find(a=>a.name==='trajectoryEndpointHeading');if(heading)heading.y=tracks.main;
   }
  }
  const exportHeight=trajectorySettings.representation==='stacked'?Math.max(plot.clientHeight+160+extraHeight,plot.data.filter(t=>t.showlegend).length*Math.max(20,trajectorySettings.fontSize*1.3+5)+exportLayout.margin.t+exportLayout.margin.b+extraHeight):plot.clientHeight+160+extraHeight;
  const figure=annotationImageExport({data:exportData,layout:exportLayout,width:exportWidth,height:exportHeight},trajectoryModel,annotationAsset(),annotationSettings,participant.record,plot._fullLayout?.xaxis);
  status.textContent='Rendering image…';
  const data=await Plotly.toImage({data:figure.data,layout:figure.layout},{format,width:figure.width,height:figure.height,scale});
  link.textContent='Download '+format.toUpperCase();
  await trajectoryPrepareImageDownload(data,link,(META.id+'_'+participantRows()[0].subject+'_trajectory.'+format).replace(/[^a-zA-Z0-9_.-]/g,'_'));
  status.textContent='Image ready; download requested. Use the download link to save another copy.';
 }catch(error){status.textContent='Export failed: '+error.message}finally{button.disabled=false}};
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(()=>{
  if(!participant.active||trajectoryResizePending)return;
  trajectoryResizePending=true;
  trajectoryQueue=trajectoryQueue.catch(()=>{}).then(async()=>{
   trajectoryResizePending=false;
   const plot=el('trajectoryPlot');if(!participant.active||!plot.data)return;
   // Resize only the canvas: preserve model coordinates, scale and user axis ranges.
   const height=trajectoryCanvasHeight();
   plot.style.height=height+'px';
   const width=Math.max(560,plot.clientWidth);
   if(plot._fullLayout?.height!==height||plot._fullLayout?.width!==width){
    if(trajectoryModel)trajectoryRestoredScale=trajectoryModel.scale;
    await Plotly.relayout(plot,{height,width});
   }
   if(el('trajectoryTracks').open&&el('trajectoryTracksPlot').data)await Plotly.Plots.resize('trajectoryTracksPlot');
   if(annotationLast&&annotationSettings.show)await renderAnnotationTracks(trajectoryModel,plot.layout);
  }).catch(error=>{el('trajectoryDensityStatus').textContent='Trajectory resizing error: '+error.message});
 });
 // Disclosures can change the available plot space without resizing the panel.
 for(const target of [el('trajectoryContent'),...el('trajectoryContent').children])observer.observe(target);
 }
}
