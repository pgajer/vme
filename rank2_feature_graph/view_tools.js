// Plotly 2.25.2 live-scene adapter. Keep private scene access isolated here.
function liveViewCamera(plot){return copyCamera(plot._fullLayout?.scene?._scene?.getCamera?.()||plot.layout?.scene?.camera||defaultCamera)}
function exportScene(plot){
 const scene=plot._fullLayout?.scene?._scene,result=JSON.parse(JSON.stringify(plot.layout?.scene||{}));
 result.camera=liveViewCamera(plot);const ratio=plot._fullLayout?.scene?.aspectratio;
 if(ratio){result.aspectmode='manual';result.aspectratio={...ratio}}
 for(const [i,axis] of ['xaxis','yaxis','zaxis'].entries()){
  const a=plot._fullLayout?.scene?.[axis],bounds=scene?.glplot?.bounds;
  // Plotly 2.25.2 autoranged axes can retain placeholder layout ranges.
  // Export the bounds used by WebGL, converted back from scene scale.
  const range=bounds&&scene.dataScale?bounds.map(b=>a.l2r(b[i]/scene.dataScale[i])):a?.range;
  if(a&&range)result[axis]={...result[axis],type:a.type,range:[...range],autorange:false};
 }
 return result;
}
function graphScreenPoint(point){
 const scene=el('graph3d')._fullLayout?.scene?._scene,params=scene?.glplot?.cameraParams;
 if(!params||!scene.container?.getBoundingClientRect)return null;
 let v=[...point.map((x,i)=>x*scene.dataScale[i]),1];
 for(const name of ['model','view','projection']){const m=params[name];v=[0,1,2,3].map(j=>v.reduce((sum,x,i)=>sum+m[4*i+j]*x,0))}
 if(v[3]<=0||!v.every(Number.isFinite))return null;
 const r=scene.container.getBoundingClientRect();return {x:r.left+(v[0]/v[3]+1)*r.width/2,y:r.top+(1-v[1]/v[3])*r.height/2,z:v[2]/v[3],w:v[3]};
}
// Degree uses displayed top-2 edges only; face boundaries are not graph edges.
// Square-root radii/diameters make marker area proportional to positive degree.
function graphNodeDegrees(g){
 const neighbors=new Map(g.nodes.map(n=>[n.id,new Set()]));
 for(const e of g.edges){if(e.from===e.to||!neighbors.has(e.from)||!neighbors.has(e.to))continue;neighbors.get(e.from).add(e.to);neighbors.get(e.to).add(e.from)}
 return new Map([...neighbors].map(([id,ids])=>[id,ids.size]));
}
function graphMinimumDegree(value=el('graphMinimumDegree')?.value){
 const n=typeof value==='number'||typeof value==='string'&&value.trim()!==''?Number(value):NaN;
 return Number.isSafeInteger(n)&&n>=0?n:2;
}
function graphDegreeSettings(){return {enabled:el('graphDegreeFilter')?.checked===true,minimum:graphMinimumDegree()}}
function restoreGraphDegreeSettings(settings){
 el('graphDegreeFilter').checked=settings?.enabled===true;el('graphMinimumDegree').value=String(graphMinimumDegree(settings?.minimum??2));
}
function filterGraphByDegree(g,reference,minimum){
 const degrees=graphNodeDegrees(reference),nodes=g.nodes.filter(n=>(degrees.get(n.id)??0)>=minimum),ids=new Set(nodes.map(n=>n.id));
 return {...g,nodes,edges:g.edges.filter(e=>ids.has(e.from)&&ids.has(e.to))};
}
function degreeFilteredGraph(g){return graphDegreeSettings().enabled?filterGraphByDegree(g,current(),graphMinimumDegree()):g}
function degreeFilteredGeometry(geometry){
 if(!graphDegreeSettings().enabled)return geometry;
 const g=degreeFilteredGraph(geometry.g),ids=new Set(g.nodes.map(n=>n.id));
 return {...geometry,g,faces:geometry.faces.filter(f=>f.features.every(id=>ids.has(id))),supplemental:new Set([...geometry.supplemental].filter(id=>ids.has(id)))};
}
function syncGraphDegreeControls(){
 const settings=graphDegreeSettings();el('graphMinimumDegree').disabled=!settings.enabled;
 const whole=current(),g=degreeFilteredGraph(whole);
 el('graphDegreeNote').hidden=!settings.enabled;
 el('graphDegreeNote').textContent=`Degree ≥ ${settings.minimum} · displaying ${fmt(g.nodes.length)} of ${fmt(whole.nodes.length)} vertices and ${fmt(g.edges.length)} of ${fmt(whole.edges.length)} edges.`+(g.nodes.length?'':' Lower the minimum to show vertices.');
}
// Count observation identities, not edge frequencies: shared memberships count once.
function graphVertexStatistics(g,entries,population){
 const degrees=graphNodeDegrees(g),edges=new Map(g.edges.map(e=>[e.id,e]));
 const members=new Map(g.nodes.map(n=>[n.id,new Set()]));
 for(const {key,pair} of entries){
  if(!population.identities.has(key))continue;
  const e=edges.get(pair);if(!e)continue;
  members.get(e.from)?.add(key);members.get(e.to)?.add(key);
 }
 return g.nodes.map(n=>({...n,degree:degrees.get(n.id),count:members.get(n.id).size,percent:population.N?100*members.get(n.id).size/population.N:null}))
  .sort((a,b)=>b.degree-a.degree||b.count-a.count||String(a.label).localeCompare(String(b.label)));
}
// Count connected components after degree filtering, including isolated vertices.
function graphComponentCount(g){
 const neighbors=new Map(g.nodes.map(n=>[n.id,[]]));
 for(const e of g.edges){if(!neighbors.has(e.from)||!neighbors.has(e.to))continue;neighbors.get(e.from).push(e.to);neighbors.get(e.to).push(e.from)}
 const unseen=new Set(neighbors.keys());let count=0;
 while(unseen.size){count++;const todo=[unseen.values().next().value];unseen.delete(todo[0]);while(todo.length)for(const id of neighbors.get(todo.pop()))if(unseen.delete(id))todo.push(id)}
 return count;
}
function renderGraphSummary(g,singleGroups){
 const displayed=degreeFilteredGraph(g),merged=!!DATA.assignment;
 el('status').innerHTML=`<ul><li>Vertices: ${fmt(displayed.nodes.length)} phylotypes</li><li>Edges: ${fmt(displayed.edges.length)} ${merged?'merged groups':'top-2 CSTs'}</li><li>Connected components: ${fmt(graphComponentCount(displayed))}</li>${singleGroups?`<li>${fmt(singleGroups)} single-taxon ${singleGroups===1?'group has':'groups have'} no graph edges.</li>`:''}</ul>`;
}
let graphInformationCache=null;
function syncGraphInformation(){
 const g=current(),bundle=datasetRegistry.get(META.id),records=!!DATA.records||bundle.cohortAnalysis?.populationVersion===2&&bundle.dataset.observationUnit!=='distinct-composition';
 const population=legendPopulation(bundle,records);
 if(graphInformationCache?.data===DATA&&graphInformationCache.graph===g&&graphInformationCache.population===population){renderGraphSummary(g,graphInformationCache.singleGroups);return}
 const entries=[];
 for(const i of eligibleIndices()){
  const pair=DATA.samples.pair[i];
  if(records){
   const rows=DATA.records?[{key:DATA.records[i].id??i}]:population.byProfile.get(i)||[];
   for(const r of rows)entries.push({key:r.key,pair});
  }else entries.push({key:population.profileKey(i),pair});
 }
 const rows=graphVertexStatistics(g,entries,population);
 el('graphVertexNote').textContent=`Whole current graph before degree filtering; vertex and edge selections do not change this table. n: unique ${population.unit} in incident edges. % of the full eligible dataset: N = ${fmt(population.N)} ${population.unit}. A sample can belong to more than one vertex union.`;
 el('graphVertexRows').innerHTML=rows.map(n=>`<tr><td>${esc(n.id)} · ${esc(n.label)}</td><td>${n.degree}</td><td>${fmt(n.count)}</td><td>${n.percent===null?'—':n.percent>0&&n.percent<.01?'&lt;0.01':n.percent.toFixed(2)}</td></tr>`).join('')||'<tr><td colspan="4">No vertices in the current graph.</td></tr>';
 const singleGroups=DATA.assignment?new Set(entries.filter(e=>DATA.rank1Groups?.[e.pair]).map(e=>e.pair)).size:0;
 graphInformationCache={data:DATA,graph:g,population,singleGroups};
 renderGraphSummary(g,singleGroups);
}
function resetAllDatasetGraphFading(){
 const result=datasetPanelStorage.resetGraphFading();
 el('graphFadeBySize').checked=true;setGraphFadeStrength(.1);saveDatasetPanelSettings();graph();
 el('resetGraphFadingStatus').textContent=`Fading on at 0.10 for all datasets; ${result.updated} saved settings updated.`+(result.failed?` ${result.failed} settings could not be updated.`:'');
}
function graphNodeSize(degree,dimension=3){return (dimension===2?5:4)*Math.sqrt(degree>0?degree:.25)}
function graphNodeHover(n,degree){return graphNodeLabel(n)+'\nDegree: '+degree+' (displayed top-2 connections)'}
function graphFadeStrengthValue(value,fallback=.1){
 const n=typeof value==='number'||typeof value==='string'&&value.trim()!==''?Number(value):NaN;
 return Number.isFinite(n)&&n>=0&&n<=1?Math.round(Math.max(.05,Math.min(.25,n))*100)/100:fallback;
}
function graphFadeStrength(){return graphFadeStrengthValue(el('graphFadeStrength')?.value)}
function setGraphFadeStrength(value){
 const control=el('graphFadeStrength');if(control)control.value=String(graphFadeStrengthValue(value));
 syncGraphFadeControls();
}
function syncGraphFadeControls(){
 const control=el('graphFadeStrengthControl'),output=el('graphFadeStrengthValue');
 if(control)control.hidden=el('graphFadeBySize')?.checked!==true;
 if(output)output.textContent=graphFadeStrength().toFixed(2);
}
function graphEdgeWidthValue(value){const n=Number(value);return Number.isFinite(n)&&n>=1&&n<=12?Math.round(n*2)/2:6}
function graphWidthStrengthValue(value){const n=Number(value);return Number.isFinite(n)&&n>=.05&&n<=2?Math.round(n*20)/20:.5}
function graphWidthSettings(){return {scaled:el('graphWidthBySize')?.checked!==false,maximum:graphEdgeWidthValue(el('graphEdgeWidth')?.value),strength:graphWidthStrengthValue(el('graphWidthStrength')?.value)}}
function restoreGraphWidthSettings(settings){
 if(el('graphWidthBySize'))el('graphWidthBySize').checked=settings?.scaled!==false;
 if(el('graphEdgeWidth'))el('graphEdgeWidth').value=String(graphEdgeWidthValue(settings?.maximum));
 if(el('graphWidthStrength'))el('graphWidthStrength').value=String(graphWidthStrengthValue(settings?.strength));
 syncGraphWidthControls();
}
function syncGraphWidthControls(){
 const s=graphWidthSettings(),output=el('graphEdgeWidthValue');if(output)output.textContent=s.maximum.toFixed(1)+' px';
 if(el('graphWidthStrengthControl'))el('graphWidthStrengthControl').hidden=!s.scaled;
 if(el('graphWidthStrengthValue'))el('graphWidthStrengthValue').textContent=s.strength.toFixed(2);
}
function graphEdgeWidth(e,active=false,reference=current(),maximum=Math.max(0,...reference.edges.map(edge=>edge.frequency))){
 const settings=graphWidthSettings();
 const ratio=maximum>0?Math.max(0,Math.min(1,e.frequency/maximum)):0;
 const width=settings.scaled?1+(settings.maximum-1)*Math.pow(ratio,settings.strength):settings.maximum;
 // Half-pixel bins bound WebGL trace count; 2D and 3D use the same widths.
 return Math.round(width*2)/2+(active?2:0);
}
function graphEdgeWidthGroups(g,classify){
 const groups=new Map(),reference=current(),maximum=Math.max(0,...reference.edges.map(e=>e.frequency));
 for(const e of g.edges){const active=classify(e),width=graphEdgeWidth(e,active,reference,maximum),key=Number(active)+':'+width;
  if(!groups.has(key))groups.set(key,{active,width,edges:[]});groups.get(key).edges.push(e);
 }
 return [...groups.values()].sort((a,b)=>Number(a.active)-Number(b.active)||a.width-b.width);
}
// Normalize against the full current reference, so selecting a subgraph does
// not turn a rare state opaque. Degree and incident support use displayed edges.
function graphFadeStyle(g,reference=current(),enabled=el('graphFadeBySize')?.checked===true,strength=graphFadeStrength()){
 const maximum=Math.max(0,...reference.edges.map(e=>e.frequency)),exponent=graphFadeStrengthValue(strength);
 const edge=e=>enabled&&maximum>0?Math.pow(Math.max(0,Math.min(1,e.frequency/maximum)),exponent):1;
 const degrees=graphNodeDegrees(g),support=new Map(g.nodes.map(n=>[n.id,0])),lower=new Set();
 for(const e of g.edges){
  support.set(e.from,Math.max(support.get(e.from)||0,edge(e)));support.set(e.to,Math.max(support.get(e.to)||0,edge(e)));
  if(degrees.get(e.from)<=degrees.get(e.to))lower.add(e.from);
  if(degrees.get(e.to)<=degrees.get(e.from))lower.add(e.to);
 }
 return {edge,node:id=>enabled&&lower.has(id)?support.get(id):1};
}
function graphColorOpacity(color,opacity){
 if(opacity===1)return color;
 const rgb=color.startsWith('#')?color.slice(1).match(/../g).map(x=>parseInt(x,16)):color.match(/[\d.]+/g).slice(0,3);
 return `rgba(${rgb.join(',')},${opacity})`;
}
function graphEdgeTraces(g,lookup,project=null){
 const degrees=graphNodeDegrees(g),fade=graphFadeStyle(g);
 return graphEdgeWidthGroups(g,activeEdge).map(({active,width,edges})=>{
  const pts=[],ids=[],text=[],colors=[],base=active?'#cf6b21':'#82a9b9';
  for(const e of edges){
   const a=lookup.get(e.from),b=lookup.get(e.to),ends=project?clippedSegment(a,b,project,graphNodeSize(degrees.get(e.from))+5,graphNodeSize(degrees.get(e.to))+5):[a,b];if(!ends)continue;
   const steps=g.edges.length>100?2:9,color=graphColorOpacity(base,fade.edge(e));
   for(let i=0;i<steps;i++){pts.push(ends[0].map((v,j)=>v+(ends[1][j]-v)*i/(steps-1)));ids.push(e.id);colors.push(color);text.push(`${esc(e.key)}: ${esc(e.label)}<br>n=${e.frequency}; Endpoint distance=${fmt(e.length)} pp${graphLayoutHover(e)}`)}
   pts.push([null,null,null]);ids.push(null);text.push('');colors.push(color);
  }
  return {type:'scatter3d',mode:'lines+markers',meta:{graphEdgeGroup:Number(active)+':'+width},x:pts.map(p=>p[0]),y:pts.map(p=>p[1]),z:pts.map(p=>p[2]),customdata:ids,connectgaps:false,line:{color:el('graphFadeBySize')?.checked?colors:base,width},marker:{size:3,color:'rgba(0,0,0,0)'},text,hovertemplate:'%{text}<extra></extra>'};
 });
}
function graphVertexAtPointer(x,y){
 const {g,lookup}=graphGeometry(),degrees=graphNodeDegrees(g);
 return g.nodes.map(n=>({id:n.id,size:graphNodeSize(degrees.get(n.id)),p:graphScreenPoint(lookup.get(n.id))})).filter(n=>n.p&&n.p.z>=-1&&n.p.z<=1&&Math.hypot(n.p.x-x,n.p.y-y)<=Math.max(11,n.size+4)).sort((a,b)=>a.p.z-b.p.z)[0]?.id;
}
function clippedSegment(a,b,project,gap=12,endGap=gap){
 const pa=project(a),pb=project(b);if(!pa||!pb)return [a,b];
 const distance=Math.hypot(pb.x-pa.x,pb.y-pa.y);if(distance<=gap+endGap)return null;
 const at=t=>a.map((x,i)=>x+t*(b[i]-x));
 if(pa.w>0&&pb.w>0){const fraction=gap/distance,t=u=>u*pa.w/((1-u)*pb.w+u*pa.w);return [at(t(fraction)),at(t(1-endGap/distance))]}
 function boundary(origin,reverse,padding){let lo=0,hi=1;for(let i=0;i<24;i++){const t=(lo+hi)/2,p=project(at(reverse?1-t:t));if(!p)return reverse?1:0;if(Math.hypot(p.x-origin.x,p.y-origin.y)<padding)lo=t;else hi=t}return reverse?1-hi:hi}
 const start=boundary(pa,false,gap),end=boundary(pb,true,endGap);return start<end?[at(start),at(end)]:null;
}
function matchingGraphEdgeTraces(traces){
 const data=el('graph3d').data||[];
 return traces.length>0&&data.filter(t=>t.meta?.graphEdgeGroup!==undefined).length===traces.length&&traces.every((t,i)=>t.meta?.graphEdgeGroup!==undefined&&t.meta.graphEdgeGroup===data[i]?.meta?.graphEdgeGroup);
}
let graphTrimming=false;
async function trimGraphEdges(){
 if(typeof window!=='undefined'&&document.body.classList.contains('panelMaximized')&&!el('featurePanel').classList.contains('maximized'))return;
 if(!el('graph3d')._fullLayout?.scene?._scene||el('dimension').value!=='3')return;
 const camera=liveViewCamera(el('graph3d'));
 const {g,lookup}=graphGeometry(),degrees=graphNodeDegrees(g),updates=[];
 if(participant.active){
  const traces=participantGraphEdgeTraces(g,lookup,graphScreenPoint);if(!matchingGraphEdgeTraces(traces))return;graphTrimming=true;
  try{
   // Restyling density edges can reapply the stale layout camera. Commit the
   // gesture's live camera first, as in the ordinary graph branch below.
   await Plotly.relayout(el('graph3d'),{'scene.camera':camera});
   await Plotly.restyle(el('graph3d'),Object.fromEntries(['x','y','z','customdata','text','line'].map(k=>[k,traces.map(t=>t[k])])),traces.map((_,i)=>i));
  }finally{graphTrimming=false}
  return;
 }
 updates.push(...graphEdgeTraces(g,lookup,graphScreenPoint));if(!matchingGraphEdgeTraces(updates))return;
 graphTrimming=true;try{
  await Plotly.relayout(el('graph3d'),{'scene.camera':camera});
  await Plotly.restyle(el('graph3d'),Object.fromEntries(['x','y','z','customdata','text','line'].map(k=>[k,updates.map(u=>u[k])])),updates.map((_,i)=>i));
 }finally{graphTrimming=false}
}
(function installViewExport(){
 if(typeof window==='undefined')return;
 const dialog=el('viewExportDialog'),preview=el('viewExportPreview'),message=el('viewExportMessage'),download=el('viewExportDownload');
 let snapshot=null,version=0,imageURL=null;
 const clone=x=>JSON.parse(JSON.stringify(x)),frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 function information(kind){
  const rows=[];const add=(text,color=null)=>{if(text?.trim())rows.push({text:text.trim(),color})};
  if(kind==='samples'){
   add(el('sampleContext').innerText);if(edgeFacesActive())add(el('edgeFacesSummary').innerText);
   for(const note of el('sampleLegendItems').querySelectorAll('.legendCountNote'))add(note.innerText);
   for(const item of el('sampleLegendItems').querySelectorAll('.legendItem')){const style=getComputedStyle(item.querySelector('.colorSwatch'));add(item.innerText,style.backgroundColor==='rgba(0, 0, 0, 0)'?style.borderColor:style.backgroundColor)}
   for(const d of el('sampleTools').children)if(d.tagName==='DETAILS'&&d.open)add(d.innerText);
  }else{add(el('status').innerText);add(el('graphLayoutSummary').innerText);if(edgeFacesActive())add(el('edgeFacesSummary').innerText);for(const d of el('graphDetails').querySelectorAll('details[open]'))add(d.innerText)}
  return rows;
 }
 function svgSnapshot(svg){
  const copy=svg.cloneNode(true),originals=[svg,...svg.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
  originals.forEach((n,i)=>{const s=getComputedStyle(n);for(const key of ['fill','stroke','stroke-width','paint-order','font-size','font-family','font-weight'])copies[i].style.setProperty(key,s.getPropertyValue(key))});
  const r=svg.getBoundingClientRect();copy.setAttribute('width',Math.round(r.width));copy.setAttribute('height',Math.round(r.height));copy.setAttribute('xmlns','http://www.w3.org/2000/svg');return new XMLSerializer().serializeToString(copy);
 }
 async function imageFrom(url){const img=new Image();img.src=url;await img.decode();return img}
 async function capture(kind){
  if(kind==='graph')await waitGraphEmbedding();
  await (kind==='samples'?queue:graphQueue);await frame();await frame();
  const plot=el(kind==='samples'?'samples':el('dimension').value==='3'?'graph3d':'graph'),r=plot.getBoundingClientRect();
  const result={kind,width:Math.max(1,Math.round(r.width)),height:Math.max(1,Math.round(r.height)),title:kind==='samples'?el('sampleTitle').textContent:'Features and top-2 CSTs graph',rows:information(kind),filename:`vaginal-microbiome-${kind}-${META.id}-${new Date().toISOString().replace(/[:.]/g,'-')}`};
  if(plot.id==='graph')result.svg=svgSnapshot(plot);
  else{
   result.data=clone(plot.data);result.layout=clone(plot.layout);result.layout.scene=exportScene(plot);
   result.layout.width=result.width;result.layout.height=result.height;result.layout.autosize=false;
  }
  return result;
 }
 function textLines(ctx,text,width){
  const lines=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if(!word)continue;if(ctx.measureText(line+(line?' ':'')+word).width>width&&line){lines.push(line);line=''}let part=word;while(ctx.measureText(part).width>width){let cut=part.length-1;while(cut>1&&ctx.measureText(part.slice(0,cut)).width>width)cut--;if(line){lines.push(line);line=''}lines.push(part.slice(0,cut));part=part.slice(cut)}line+=(line?' ':'')+part}lines.push(line)}return lines;
 }
 async function render(){
  if(!snapshot)return;const token=++version,s=snapshot,scale=Number(el('viewExportScale').value),include=el('viewExportInfo').checked;
  download.hidden=true;preview.hidden=true;message.textContent='Preparing PNG…';let renderer=null;
  try{
   let url;if(s.svg){url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s.svg)}else{
    renderer=document.createElement('div');renderer.style.cssText=`position:fixed;left:-100000px;top:0;width:${s.width}px;height:${s.height}px;pointer-events:none`;document.body.appendChild(renderer);
    await Plotly.newPlot(renderer,clone(s.data),clone(s.layout),{staticPlot:true,displayModeBar:false,plotGlPixelRatio:2});
    await Plotly.relayout(renderer,{'scene.camera':clone(s.layout.scene.camera)});await frame();
    url=await Plotly.toImage(renderer,{format:'png',width:s.width,height:s.height,scale});
   }
   const plotImage=await imageFrom(url),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),infoWidth=include?340:0,pad=include?16:0;
   ctx.font='13px Arial';const rows=include?s.rows.map(row=>({...row,lines:textLines(ctx,row.text,infoWidth-40)})):[];
   const titleLines=include?textLines(ctx,s.title,s.width+infoWidth-32):[],heading=include?titleLines.length*22+24:0;
   const height=Math.max(s.height,rows.reduce((n,row)=>n+row.lines.length*18+12,16));
   canvas.width=(s.width+infoWidth+pad)*scale;canvas.height=(height+heading)*scale;ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width/scale,canvas.height/scale);
   ctx.drawImage(plotImage,0,heading,s.width,s.height);
   if(include){ctx.fillStyle='#183743';ctx.font='bold 16px Arial';titleLines.forEach((line,i)=>ctx.fillText(line,16,24+i*22));let y=heading+20;
    for(const row of rows){ctx.font='13px Arial';if(row.color){ctx.fillStyle=row.color;ctx.fillRect(s.width+pad,y-10,10,10)}ctx.fillStyle='#183743';for(const line of row.lines){ctx.fillText(line,s.width+pad+16,y);y+=18}y+=12}
   }
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG creation failed')),'image/png'));
   if(token!==version)return;if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(blob);preview.src=imageURL;preview.hidden=false;download.href=imageURL;download.download=s.filename+`-${scale}x.png`;download.hidden=false;
   message.textContent=`${canvas.width} × ${canvas.height} pixels. Captured view; changing export options keeps the same camera.`;
  }catch(error){if(token===version)message.textContent='Could not create PNG: '+error.message;console.error(error)}finally{if(renderer){Plotly.purge(renderer);renderer.remove()}}
 }
 async function open(kind){
  const token=++version;snapshot=null;preview.hidden=true;download.hidden=true;message.textContent='Capturing current view…';
  el('viewExportScale').disabled=el('viewExportInfo').disabled=true;dialog.showModal();
  try{const captured=await capture(kind);if(token!==version||!dialog.open)return;snapshot=captured;await render()}catch(error){if(token===version)message.textContent='Could not capture view: '+error.message;console.error(error)}finally{el('viewExportScale').disabled=el('viewExportInfo').disabled=false}
 }
 el('saveSampleView').onclick=()=>open('samples');el('saveGraphView').onclick=()=>open('graph');
 el('viewExportScale').onchange=el('viewExportInfo').onchange=render;
 el('viewExportClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{++version;snapshot=null;if(imageURL)URL.revokeObjectURL(imageURL);imageURL=null;preview.removeAttribute('src');download.removeAttribute('href')});
})();

// Compensate the SVG viewBox and zoom transforms to match the 3D label size.
function sizeGraphLabels2d(){
 const svg=el('graph');if(!svg.querySelectorAll)return;
 for(const label of svg.querySelectorAll('text')){
  const matrix=label.getScreenCTM();if(!matrix)continue;
  const scale=Math.hypot(matrix.a,matrix.b);if(!scale)continue;
  label.style.fontSize=graphLabelFont.size/scale+'px';label.style.fontFamily=graphLabelFont.family;
  label.style.strokeWidth=2/scale+'px';
 }
}
if(typeof window!=='undefined'&&typeof ResizeObserver!=='undefined')new ResizeObserver(sizeGraphLabels2d).observe(el('graph'));

// Labels are visually above WebGL but must not consume its drag/wheel events.
// Resolve a label only on a stationary click, using Plotly's annotation index.
function graphLabelAtPointer(x,y){
 const plot=el('graph3d');if(!plot.querySelectorAll||!el('vertexLabels').checked)return null;
 const labels=[...plot.querySelectorAll('.annotation-scene')];
 for(const group of labels.reverse()){
  const text=group.querySelector('.annotation-text'),rect=text?.getBoundingClientRect();
  if(!rect||!rect.width||!rect.height||x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)continue;
  const name=plot.layout?.scene?.annotations?.[Number(group.getAttribute('data-index'))]?.name;
  if(name?.startsWith('vertex:'))return name;
 }
 return null;
}
const graphLabelSizeKey='vme-graph-label-size-v1';
function setGraphLabelSize(value,persist=true){
 const size=Number(value);if(!Number.isInteger(size)||size<6||size>24)return false;
 graphLabelFont.size=size;el('graphLabelSize').value=String(size);
 if(persist)try{(typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).setItem(graphLabelSizeKey,String(size))}catch{}
 return true;
}
(function installGraphLabelSize(){
 if(typeof window==='undefined')return;
 try{setGraphLabelSize((typeof datasetPanelStorage==='undefined'?localStorage:datasetPanelStorage).getItem(graphLabelSizeKey),false)}catch{}
 el('graphLabelSize').onchange=()=>{
  if(!setGraphLabelSize(el('graphLabelSize').value)){el('graphLabelSize').value=String(graphLabelFont.size);return}
  graph(readCamera('graph3d'));
 };
})();

// Fit only the camera/2D viewport; the embedding and its full-scene bounds stay fixed.
function fittedGraphCamera(worldPoints,camera,projection,limits=[.72,.76]){
 if(!worldPoints.length)return null;
 const center=[0,1,2].map(j=>(Math.min(...worldPoints.map(p=>p[j]))+Math.max(...worldPoints.map(p=>p[j])))/2);
 const xyz=v=>[v.x,v.y,v.z],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=v=>{const n=Math.hypot(...v);return n?v.map(x=>x/n):null};
 const direction=unit(xyz(camera.eye).map((x,j)=>x-xyz(camera.center)[j]));if(!direction)return null;
 const right=unit(cross(xyz(camera.up),direction));if(!right)return null;const up=cross(direction,right);
 const relative=worldPoints.map(p=>p.map((x,j)=>x-center[j])),radius=Math.max(.01,...relative.map(p=>Math.hypot(...p)));
 const oldDistance=Math.hypot(...xyz(camera.eye).map((x,j)=>x-xyz(camera.center)[j]));
 const extent=p=>Math.max(Math.abs(dot(p,right)*projection[0])/limits[0],Math.abs(dot(p,up)*projection[5])/limits[1]);
 const distance=camera.projection?.type==='orthographic'?Math.max(.02,oldDistance*Math.max(...relative.map(extent))):Math.max(radius*.05,...relative.map(p=>dot(p,direction)+Math.max(extent(p),radius*.05)));
 const object=a=>({x:a[0],y:a[1],z:a[2]});
 return {...copyCamera(camera),center:object(center),eye:object(center.map((x,j)=>x+direction[j]*distance))};
}
async function fitSubjectGraph3d(lookup,nodes){
 const plot=el('graph3d'),scene=plot._fullLayout?.scene?._scene,params=scene?.glplot?.cameraParams;
 if(!params||plot.clientWidth<20||plot.clientHeight<20)return false;
 const world=nodes.map(n=>lookup.get(n.id)).filter(Boolean).map(point=>{
  const v=[...point.map((x,i)=>x*scene.dataScale[i]),1],m=params.model;
  return [0,1,2].map(j=>v.reduce((sum,x,i)=>sum+m[4*i+j]*x,0));
 });
 const labelWidth=el('vertexLabels').checked?Math.max(0,...nodes.map(n=>graphNodeLabel(n).length))*graphLabelFont.size*.6:0;
 const limits=[Math.max(.2,Math.min(.8,1-(labelWidth+24)/plot.clientWidth)),.76];
 const camera=fittedGraphCamera(world,liveViewCamera(plot),params.projection,limits);
 if(!camera)return false;
 graphTrimming=true;try{await Plotly.relayout(plot,{'scene.camera':camera})}finally{graphTrimming=false}
 return true;
}

// Reframe the existing joint fit after panel maximize/restore, never refit the MDS.
async function fitSubjectSamples3d(){
 if(!participant.active||participant.embeddingMode!=='union')return false;
 const plot=el('samples'),scene=plot._fullLayout?.scene?._scene,params=scene?.glplot?.cameraParams;
 if(!params||plot.clientWidth<20||plot.clientHeight<20)return false;
 const scope=currentSubjectEmbeddingScope(),fit=subjectEmbeddingCache.get(scope.context);
 if(!fit||plot.layout?.uirevision!=='participant-union-'+scope.context)return false;
 const world=fit.coords.map(point=>{
  const v=[...point.map((x,i)=>x*scene.dataScale[i]),1],m=params.model;
  return [0,1,2].map(j=>v.reduce((sum,x,i)=>sum+m[4*i+j]*x,0));
 });
 // Leave space for marker radii and labels without letting long labels in a
 // narrow panel shrink the cloud to almost nothing.
 const annotations=plot.layout.scene.annotations||[];
 const labelWidth=Math.max(0,...annotations.map(a=>String(a.text||'').length*(a.font?.size||12)*.6));
 const markerPad=Math.max(24,participant.sphereSize*1.6+14);
 const limits=[Math.max(.45,Math.min(.84,1-(labelWidth+markerPad)/plot.clientWidth)),Math.max(.45,Math.min(.8,1-(markerPad+participant.labelSize+24)/plot.clientHeight))];
 const camera=fittedGraphCamera(world,liveViewCamera(plot),params.projection,limits);
 if(!camera)return false;
 await Plotly.relayout(plot,{'scene.camera':camera});
 return true;
}
