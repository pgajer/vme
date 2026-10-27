// Enrollment graphs share the explorer's actual toolbar, appearance helpers and R service.
// Geometry and style counts always use the frozen pooled-enrollment reference.
const associationGraphState={fits:new Map(),jobs:new Map(),queue:Promise.resolve(),revision:0,toolbar:null,home:null,controls:[],cameras:new Map(),effectColors:true,rendered:new Map(),drawQueue:Promise.resolve(),timer:null,forcedMode:null};
function associationGraphInput(release,dimension=Number(el('dimension').value),mode=graphLayoutMode,strength=graphProportionStrength){
 const nodes=release.nodes.map(n=>({...n,id:Number(n.id),label:taxonDisplayLabel(n.name)}));
 const maximum=Math.max(1,...release.edges.map(e=>Object.values(e.results).reduce((s,r)=>s+r.all.n,0)));
 const edges=release.edges.map(e=>{const frequency=Object.values(e.results).reduce((s,r)=>s+r.all.n,0);return {...e,from:Number(e.from),to:Number(e.to),frequency,target:mode==='proportion'?1+strength*frequency/maximum:1}});
 const initial=new Map(nodes.map((n,i)=>{const angle=2*Math.PI*i/nodes.length;return [n.id,[Math.cos(angle),Math.sin(angle),.2*Math.sin(2*angle)].slice(0,dimension)]}));
 return {nodes,edges,initial,maximum,total:Object.values(release.cohorts).reduce((s,c)=>s+c.n,0)};
}
function associationGraphKey(release,dimension,method=graphEmbeddingMethod){return ['enrollment-associations-v1',release.graphId,release.partitionId,graphLayoutMode,graphLayoutMode==='proportion'?graphProportionStrength:0,dimension,method].join('|')}
function associationGraphRequest(release,dimension){
 const input=associationGraphInput(release,dimension);
 return {method:graphEmbeddingMethod,dimension,nodes:input.nodes.map(n=>n.id),edges:input.edges.map(e=>[e.from,e.to,e.target]),initial:input.nodes.map(n=>input.initial.get(n.id)),context:associationGraphKey(release,dimension)};
}
function associationValidateGraphFit(result,request){
 if(result.method!==request.method||result.dimension!==request.dimension||JSON.stringify(result.nodes)!==JSON.stringify(request.nodes)||!Array.isArray(result.coords)||result.coords.length!==request.nodes.length||!result.coords.every(p=>p.length===request.dimension&&p.every(Number.isFinite))||!Number.isFinite(result.relativeRms)||!Number.isFinite(result.geodesicNormalizedRmse)||typeof result.runtimeId!=='string')throw Error('Invalid enrollment graph layout response');
 return result;
}
function associationGraphFit(release,dimension){
 const key=associationGraphKey(release,dimension),input=associationGraphInput(release,dimension);
 if(associationGraphState.fits.has(key))return associationGraphState.fits.get(key);
 const packaged=associationView.bank.graphLayouts?.[key];
 if(packaged){const fit=associationValidateGraphFit(packaged,associationGraphRequest(release,dimension));const result={...fit,lookup:new Map(fit.nodes.map((id,i)=>[id,fit.coords[i]])),packaged:true};associationGraphState.fits.set(key,result);return result;}
 const springKey=associationGraphKey(release,dimension,'spring');
 if(!associationGraphState.fits.has(springKey))associationGraphState.fits.set(springKey,springGraphLayout(input.nodes,input.edges,input.initial,dimension));
 if(graphEmbeddingMethod==='spring')return associationGraphState.fits.get(springKey);
 if(!associationGraphState.jobs.has(key)){
  const request=associationGraphRequest(release,dimension),job={pending:true,error:null};associationGraphState.jobs.set(key,job);
  // The service also serializes fits. No parallel enrollment fitting batch is launched.
  job.promise=associationGraphState.queue=associationGraphState.queue.then(async()=>{
   try{
    const response=await fetch('/api/graph-layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)}),raw=await response.json();
    if(!response.ok)throw Error(raw.error||'Local graph-layout service unavailable');
    const fit=associationValidateGraphFit(raw,request);associationGraphState.fits.set(key,{...fit,lookup:new Map(fit.nodes.map((id,i)=>[id,fit.coords[i]]))});
   }catch(error){job.error=error.message}finally{job.pending=false}
   if(associationView.active&&key===associationGraphKey(associationView.bank.coverages[associationView.coverage],Number(el('dimension').value)))renderAssociationGraphs();
  });
 }
 return {...associationGraphState.fits.get(springKey),preview:true};
}
function associationDisplayGraph(release){
 const full=associationGraphInput(release),minimum=graphMinimumDegree();let g=full;
 if(el('graphDegreeFilter').checked)g=filterGraphByDegree(g,full,minimum);
 if(associationView.level==='vertex'&&el('graphScope').value==='incident'){
  const edges=g.edges.filter(e=>String(e.from)===associationView.selected||String(e.to)===associationView.selected),ids=new Set(edges.flatMap(e=>[e.from,e.to]));
  g={...g,edges,nodes:g.nodes.filter(n=>ids.has(n.id))};
 }
 return {full,g,degrees:graphNodeDegrees(g),fade:graphFadeStyle(g,full)};
}
function associationGraphPick(type,id){
 if(type==='vertex'&&!associationView.bank.coverages[associationView.coverage].vertices)return;
 associationView.level=type==='vertex'?'vertex':'edge';associationView.selected=String(id);renderAssociations();
}
function associationGraphColor(item,cohort,type){
 if(associationGraphState.effectColors&&associationView.level===type)return associationColor(associationEffect(item.results[cohort],associationView.mode));
 return type==='vertex'?graphColorSettings().vertex:graphColorSettings().edge;
}
function associationGraphCard(release,cohort){
 const p=release.cohorts[cohort],matched=associationView.mode==='matched';
 return `<article class="associationGraphCard" data-cohort="${cohort}"><header><h3>${cohort}</h3><button type="button" data-association-expand="${cohort}">Maximize</button><button type="button" data-association-png="${cohort}">Save PNG</button></header><p>${matched?p.matchedN:p.n} women · ${matched?p.matchedCases:p.cases} cases${matched?' · original matched sets':''}</p><div class="associationGraphPane"><div id="associationPlot${cohort}" class="associationPlot" aria-label="${cohort} enrollment association graph"></div><div class="associationGraphLabels"></div></div><small class="associationLabelStatus"></small><a class="associationPNG" hidden>Download PNG</a></article>`;
}
function associationSphereImage(color){
 const settings=sphereLightingSettings('graph'),h=settings.highlights/100,highlight=h<=.18?.65*h/.18:.65+.35*(h-.18)/.82,rgb=color.slice(1).match(/../g).map(v=>parseInt(v,16));
 const stops=[[0,highlight],[.25,highlight*(.2/.65)],[.6,0],[1,settings.ambient/100-1]].map(([offset,mix])=>`<stop offset="${offset}" stop-color="rgb(${rgb.map(v=>Math.round(mix>=0?v+(255-v)*mix:v*(1+mix))).join(',')})"/>`).join('');
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><radialGradient id="s" cx=".32" cy=".28" r=".72">${stops}</radialGradient></defs><circle cx="50" cy="50" r="49" fill="url(#s)" stroke="${color}"/></svg>`);
}
function associationGraphTraces(release,cohort,lookup,dimension){
 const {g,full,degrees,fade}=associationDisplayGraph(release),vertexMode=associationView.level==='vertex',vertices=new Map((release.vertices||[]).map(v=>[Number(v.id),v])),traces=[],images=[];
 const vertexColor=n=>associationGraphColor(vertices.get(n.id)||{results:{}},cohort,'vertex');
 const points=g.nodes.map(n=>lookup.get(n.id)),unit=graphSphereUnit(lookup);
 for(const edge of g.edges){
  const a=lookup.get(edge.from),b=lookup.get(edge.to),active=vertexMode?[edge.from,edge.to].some(id=>String(id)===associationView.selected):edge.id===associationView.selected;
  // Clip at sphere/marker boundaries using the common full-layout scale.
  const delta=b.map((x,i)=>x-a[i]),length=Math.hypot(...delta)||1,ra=graphNodeSize(degrees.get(edge.from))*unit,rb=graphNodeSize(degrees.get(edge.to))*unit;
  const aa=a.map((x,i)=>x+delta[i]*Math.min(.45,ra/length)),bb=b.map((x,i)=>x-delta[i]*Math.min(.45,rb/length));
  const color=associationGraphColor(edge,cohort,'edge'),width=graphEdgeWidth(edge,active,full,full.maximum),opacity=fade.edge(edge);
  const count=edge.results[cohort][associationView.mode==='matched'?'matched':'all'];
  const trace={type:dimension===3?'scatter3d':'scatter',mode:'lines',x:[aa[0],bb[0]],y:[aa[1],bb[1]],...(dimension===3?{z:[aa[2],bb[2]]}:{}),line:{color,width},opacity,customdata:[`edge:${edge.id}`,`edge:${edge.id}`],text:[edge.name.replaceAll('_',' ')+'<br>'+count.cases+' cases / '+count.n+' women'],hovertemplate:'%{text}<extra></extra>',showlegend:false};
  if(active)traces.push({...trace,line:{color:'#172f3b',width:width+3},hoverinfo:'skip',hovertemplate:null});
  traces.push(trace);
  const mid=a.map((x,i)=>(x+b[i])/2);
  traces.push({type:trace.type,mode:'markers',x:[mid[0]],y:[mid[1]],...(dimension===3?{z:[mid[2]]}:{}),marker:{size:9,color:'rgba(0,0,0,0)'},customdata:[`edge:${edge.id}`],text:trace.text,hovertemplate:trace.hovertemplate,showlegend:false});
 }
 const hover=n=>{const v=vertices.get(n.id),r=v?.results[cohort][associationView.mode==='matched'?'matched':'all'];return esc(n.name.replaceAll('_',' '))+'<br>Degree: '+degrees.get(n.id)+(r?'<br>Incident-state union: '+r.cases+' cases / '+r.n+' women':'')};
 if(dimension===3&&graphSpheresEnabled())traces.push(...graphSphereTraces(g,lookup,degrees,fade,{color:vertexColor,hover}));
 else{
  traces.push({type:dimension===3?'scatter3d':'scatter',mode:'markers',x:points.map(p=>p[0]),y:points.map(p=>p[1]),...(dimension===3?{z:points.map(p=>p[2])}:{}),marker:{size:g.nodes.map(n=>graphNodeSize(degrees.get(n.id),dimension)*(dimension===2?2:1)),color:g.nodes.map(n=>graphColorOpacity(vertexColor(n),dimension===2&&graphSpheresEnabled()?.001:fade.node(n.id))),line:{width:0}},customdata:g.nodes.map(n=>'vertex:'+n.id),text:g.nodes.map(hover),hovertemplate:'%{text}<extra></extra>',showlegend:false});
  if(dimension===2&&graphSpheresEnabled())for(const n of g.nodes){const p=lookup.get(n.id),diameter=2*graphNodeSize(degrees.get(n.id),2)*unit;images.push({source:associationSphereImage(vertexColor(n)),xref:'x',yref:'y',x:p[0],y:p[1],sizex:diameter,sizey:diameter,xanchor:'center',yanchor:'middle',opacity:fade.node(n.id),layer:'above'})}
 }
 const chosen=g.nodes.find(n=>vertexMode&&String(n.id)===associationView.selected);
 if(chosen){const p=lookup.get(chosen.id);traces.push({type:dimension===3?'scatter3d':'scatter',mode:'markers',x:[p[0]],y:[p[1]],...(dimension===3?{z:[p[2]]}:{}),marker:{size:2*graphNodeSize(degrees.get(chosen.id),dimension)+4,symbol:'circle-open',color:'#172f3b',line:{width:2}},hoverinfo:'skip',showlegend:false})}
 return {traces,images,g,degrees,fade};
}
function associationPackLabels(cohort){
 const plot=el('associationPlot'+cohort),saved=associationGraphState.rendered.get(cohort);if(!plot||!saved)return;
 const overlay=plot.parentElement.querySelector('.associationGraphLabels');overlay.replaceChildren();
 const {g,lookup,degrees,fade,dimension}=saved,rect=plot.getBoundingClientRect(),items=[],obstacles=[];
 const project=p=>{if(dimension===3){const point=graphScreenPoint(p,plot);return point?{x:point.x-rect.left,y:point.y-rect.top}:null}const layout=plot._fullLayout;return layout?.xaxis?{x:layout.xaxis._offset+layout.xaxis.l2p(p[0]),y:layout.yaxis._offset+layout.yaxis.l2p(p[1])}:null};
 if(!el('vertexLabels').checked){plot.closest('article').querySelector('.associationLabelStatus').textContent='Vertex labels hidden.';return}
 for(const n of g.nodes){const p=project(lookup.get(n.id));if(!p||p.x<0||p.y<0||p.x>rect.width||p.y>rect.height)continue;const radius=graphNodeSize(degrees.get(n.id),dimension);obstacles.push({...p,radius});items.push({...p,...graphLabelTextSize(n.label),id:n.id,radius,priority:degrees.get(n.id)+(associationView.level==='vertex'&&String(n.id)===associationView.selected?1e6:0)})}
 const placed=placeGraphLabels(items,{x:3,y:3,width:rect.width-6,height:rect.height-6},obstacles),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width',rect.width);svg.setAttribute('height',rect.height);overlay.append(svg);
 for(const n of g.nodes){const box=placed.get(n.id),point=project(lookup.get(n.id));if(!box||!point)continue;node('line',{x1:point.x,y1:point.y,x2:box.x+box.width/2,y2:box.y+box.height/2,stroke:'#758c97','stroke-opacity':.6*fade.node(n.id)},svg);
  const button=document.createElement('button');button.className='associationVertexLabel';button.textContent=n.label;button.title=n.name.replaceAll('_',' ');button.style.cssText=`left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;font-size:${graphLabelFont.size}px;opacity:${fade.node(n.id)}`;button.onclick=()=>associationGraphPick('vertex',n.id);overlay.append(button);
 }
 plot.closest('article').querySelector('.associationLabelStatus').textContent=`${placed.size} of ${g.nodes.length} labels shown. All results remain in the table.`;
}
function renderAssociationGraphs(){
 const revision=++associationGraphState.revision;
 associationGraphState.drawQueue=associationGraphState.drawQueue.then(()=>drawAssociationGraphs(revision)).catch(error=>{if(el('associationGraphFitStatus'))el('associationGraphFitStatus').textContent='Graph display error: '+error.message;console.error(error)});
 return associationGraphState.drawQueue;
}
async function drawAssociationGraphs(revision){
 if(!associationView.active||!associationGraphState.toolbar||revision!==associationGraphState.revision)return;
 const r=associationView.bank.coverages[associationView.coverage],cohorts=associationView.cohort==='both'?['ZAPPS','PreSSMat']:[associationView.cohort],dimension=Number(el('dimension').value),fit=associationGraphFit(r,dimension),lookup=new Map([...fit.lookup].map(([id,p])=>[id,dimension===2?[...p,0]:p]));
 syncGraphVertexSizeControl();syncGraphWidthControls();syncGraphFadeControls();syncSphereLightingControls('graph');syncGraphStrengthControl();
 el('graphMinimumDegree').disabled=!el('graphDegreeFilter').checked;el('graphScopeControl').hidden=associationView.level!=='vertex';
 el('graphVertexColor').disabled=associationGraphState.effectColors&&associationView.level==='vertex';el('graphEdgeColor').disabled=associationGraphState.effectColors&&associationView.level==='edge';
 const {g,full}=associationDisplayGraph(r),job=associationGraphState.jobs.get(associationGraphKey(r,dimension));
 el('associationGraphSummary').textContent=`${g.nodes.length}/${full.nodes.length} vertices · ${g.edges.length}/${full.edges.length} edges. Geometry, thickness and fading use pooled enrollment counts (N = ${full.total}); both cohorts share positions. Filtering changes only the graph, not the tests or correction family.`;
 el('associationGraphFitStatus').textContent=(fit.preview?(job?.error?'Fit unavailable: '+job.error+' Showing spring preview.':'Computing '+graphEmbeddingLabels[graphEmbeddingMethod]+'; spring preview shown.'):graphEmbeddingLabels[graphEmbeddingMethod])+' · Relative edge-length RMS error: '+associationNumber(100*fit.relativeRms)+'%'+(fit.geodesicNormalizedRmse===undefined?'':' · Geodesic normalized RMSE: '+associationNumber(100*fit.geodesicNormalizedRmse)+'%')+'. Display geometry only; this is not sample-embedding stress.';
 el('associationGraphRetry').hidden=!job?.error;
 for(const existing of [...el('associationGraphs').children])if(!cohorts.includes(existing.dataset.cohort)){const plot=existing.querySelector('.associationPlot');if(plot){plot._associationObserver?.disconnect();Plotly.purge(plot)}existing.remove()}
 for(const cohort of cohorts){
  let plot=el('associationPlot'+cohort);if(!plot){el('associationGraphs').insertAdjacentHTML('beforeend',associationGraphCard(r,cohort));plot=el('associationPlot'+cohort)}
  const card=plot.closest('article'),pop=r.cohorts[cohort],matched=associationView.mode==='matched';card.querySelector('p').textContent=`${matched?pop.matchedN:pop.n} women · ${matched?pop.matchedCases:pop.cases} cases${matched?' · original matched sets':''}`;
  const content=associationGraphTraces(r,cohort,lookup,dimension),base={margin:{l:18,r:18,t:18,b:18},showlegend:false,paper_bgcolor:'#fff',plot_bgcolor:'#fff',hoverlabel:{bgcolor:'#fff',font:{color:'#173744'}},uirevision:associationGraphKey(r,dimension),images:content.images};
  const camera=associationGraphState.cameras.get(cohort);
  const layout=dimension===3?{...base,scene:{...(camera?{camera}:{}),dragmode:'orbit',aspectmode:'data',xaxis:{visible:false},yaxis:{visible:false},zaxis:{visible:false}}}:{...base,dragmode:'pan',xaxis:{visible:false},yaxis:{visible:false,scaleanchor:'x',scaleratio:1}};
  await Plotly.react(plot,content.traces,layout,{responsive:true,scrollZoom:true,displaylogo:false,displayModeBar:false});
  if(revision!==associationGraphState.revision||!associationView.active)return;
  associationGraphState.rendered.set(cohort,{...content,lookup,dimension});associationPackLabels(cohort);
  if(!plot._associationBound){plot._associationBound=true;
   let press=null,hovered=null,token=0;
   const pick=id=>{if(typeof id==='string'){const at=id.indexOf(':');associationGraphPick(id.slice(0,at),id.slice(at+1))}};
   plot.on('plotly_hover',ev=>hovered=ev.points[0]?.customdata);plot.on('plotly_unhover',()=>hovered=null);
   plot.on('plotly_click',ev=>{if(press&&!press.moved&&!press.pick)press.pick=ev.points[0]?.customdata});
   plot.addEventListener('pointerdown',ev=>{press=ev.button===0?{x:ev.clientX,y:ev.clientY,moved:false,pick:null,id:hovered,token:++token,revision:associationGraphState.revision}:null},true);
   plot.addEventListener('pointermove',ev=>{if(press&&Math.hypot(ev.clientX-press.x,ev.clientY-press.y)>=5)press.moved=true},true);
   plot.addEventListener('pointerup',()=>{const click=press;press=null;if(click&&!click.moved)setTimeout(()=>{if(click.token===token&&click.revision===associationGraphState.revision)pick(click.pick||click.id||hovered)},0)},true);
   plot.addEventListener('pointercancel',()=>{press=null;++token},true);plot.addEventListener('pointerleave',()=>{press=null;hovered=null;++token},true);
   plot.on('plotly_relayout',()=>{if(plot.layout?.scene?.camera)associationGraphState.cameras.set(cohort,liveViewCamera(plot));requestAnimationFrame(()=>associationPackLabels(cohort))});
   plot._associationObserver=new ResizeObserver(()=>{if(associationView.active){Plotly.Plots.resize(plot);requestAnimationFrame(()=>associationPackLabels(cohort))}});plot._associationObserver.observe(plot);
  }
  card.querySelector('[data-association-expand]').onclick=()=>{card.classList.toggle('associationGraphExpanded');card.querySelector('[data-association-expand]').textContent=card.classList.contains('associationGraphExpanded')?'Restore':'Maximize';Plotly.Plots.resize(plot);requestAnimationFrame(()=>associationPackLabels(cohort))};
  card.querySelector('[data-association-png]').onclick=()=>associationGraphPNG(cohort);
 }
}
async function associationGraphPNG(cohort){
 const plot=el('associationPlot'+cohort),card=plot.closest('article'),link=card.querySelector('.associationPNG');
 try{
  const layout=JSON.parse(JSON.stringify(plot.layout)),saved=associationGraphState.rendered.get(cohort),{g,lookup,dimension}=saved;
  const labels=g.nodes.map(n=>{const p=lookup.get(n.id);return {x:p[0],y:p[1],...(dimension===3?{z:p[2]}:{}),text:esc(n.label),showarrow:false,yshift:12,font:{...graphLabelFont}}});
  if(el('vertexLabels').checked){if(dimension===3)layout.scene.annotations=labels;else layout.annotations=labels}
  if(dimension===3)layout.scene= {...exportScene(plot),annotations:layout.scene.annotations};
  const image=await Plotly.toImage({data:plot.data,layout},{format:'png',width:1100,height:850});
  link.textContent='Download PNG';await trajectoryPrepareImageDownload(image,link,`vme-enrollment-${associationView.level}-${associationView.coverage}-${cohort}.png`);
 }catch(error){link.hidden=false;link.removeAttribute('href');link.textContent='PNG export failed: '+error.message}
}
function mountAssociationGraphControls(active){
 if(typeof document==='undefined'||!el('associationGraphControls'))return;
 const state=associationGraphState;
 if(!state.toolbar){state.toolbar=document.querySelector('#graphDetails .graphToolbar');if(!state.toolbar)return;state.home=document.createComment('Shared graph toolbar');state.toolbar.before(state.home);
  const handle=event=>{
   if(!associationView.active)return;event.stopImmediatePropagation();const target=event.target,id=target.id;
   if(event.type==='click'&&id!=='resetGraphColors')return;
   if(id==='graphEdgeLengths')setGraphLayoutMode(target.value,true);
   if(id==='graphEmbeddingMethod')setGraphEmbeddingMethod(target.value,true);
   if(id==='graphProportionStrength')setGraphProportionStrength(target.value,true);
   if(id==='graphLabelSize')setGraphLabelSize(target.value,true);
   if(id==='graphMinimumDegree')target.value=String(graphMinimumDegree());
   if(id==='resetGraphColors')restoreGraphColorSettings();
   saveDatasetPanelSettings();clearTimeout(state.timer);state.timer=setTimeout(renderAssociationGraphs,['graphProportionStrength','graphEmbeddingMethod','graphEdgeLengths'].includes(id)?400:50);
  };
  for(const type of ['input','change','click'])state.toolbar.addEventListener(type,handle,true);
 }
 if(active&&state.toolbar.parentElement!==el('associationGraphControls')){
  state.titles=[...state.toolbar.querySelectorAll('.graphColorControls label')].map(label=>[label,label.title]);for(const [label] of state.titles)label.title='Base color when its association overlay is off. Selection uses a dark outline; fading still applies.';
  state.controls=[];for(const control of state.toolbar.querySelectorAll('input,select,option'))state.controls.push([control,control.disabled]);
  state.toolbar.querySelector('option[value="reference"]').disabled=true;
  if(graphLayoutMode==='reference'){state.forcedMode='reference';setGraphLayoutMode('equal',false)}
  const faces=el('showRank3').closest('label');state.facesHidden=faces.hidden;faces.hidden=true;
  state.participantHidden=el('participantGraphControls').hidden;el('participantGraphControls').hidden=true;
  el('associationGraphControls').append(state.toolbar);
 }else if(!active&&state.toolbar.parentElement===el('associationGraphControls')){
  state.home.after(state.toolbar);for(const [label,title] of state.titles)label.title=title;for(const [control,disabled] of state.controls)control.disabled=disabled;
  el('showRank3').closest('label').hidden=state.facesHidden;el('participantGraphControls').hidden=state.participantHidden;
  if(state.forcedMode){setGraphLayoutMode(state.forcedMode,false);state.forcedMode=null}
  for(const plot of el('associationGraphs').querySelectorAll('.associationPlot')){plot._associationObserver?.disconnect();Plotly.purge(plot)}
  el('associationGraphs').replaceChildren();state.rendered.clear();++state.revision;requestAnimationFrame(()=>{if(!associationView.active)graph()});
 }
}
function installAssociationGraphs(){
 if(!el('associationGraphs')?.insertAdjacentHTML)return;
 const graphs=el('associationGraphs'),wrapper=document.createElement('div');wrapper.id='associationGraphWorkspace';graphs.before(wrapper);wrapper.append(graphs);
 wrapper.insertAdjacentHTML('beforeend',`<aside id="associationGraphSidebar"><h3>Graph display</h3><small id="associationGraphSummary"></small><label><input id="associationEffectColors" type="checkbox" checked> Association colors</label><small>Colors show effect estimates, not significance. Base vertex/edge color applies when its association overlay is off. Fading can make small states hard to see.</small><div id="associationGraphControls"></div><button id="associationGraphReset" type="button">Reset graph view</button><button id="associationGraphRetry" type="button" hidden>Retry embedding</button><small id="associationGraphFitStatus" role="status"></small><small>Saved reference coordinates, participant density and top-3 faces are not supplied by the enrollment analysis. Available layouts use its own graph; both cohorts share the layout. R methods use supplied layouts when available; other settings need the local R graph service. Spring preview works without R.</small></aside>`);
 el('associationEffectColors').onchange=()=>{associationGraphState.effectColors=el('associationEffectColors').checked;renderAssociations()};
 el('associationGraphReset').onclick=()=>{associationGraphState.cameras.clear();for(const cohort of ['ZAPPS','PreSSMat']){const plot=el('associationPlot'+cohort);if(plot){Plotly.relayout(plot,{'scene.camera':defaultCamera,'xaxis.autorange':true,'yaxis.autorange':true})}}renderAssociationGraphs()};
 el('associationGraphRetry').onclick=()=>{for(const [k,v] of associationGraphState.jobs)if(v.error)associationGraphState.jobs.delete(k);renderAssociationGraphs()};
 const style=document.createElement('style');style.textContent=`#associationGraphWorkspace{display:grid;grid-template-columns:minmax(0,1fr) 235px;gap:12px}#associationGraphSidebar{border:1px solid #cbd8de;padding:12px;max-height:720px;overflow:auto}#associationGraphSidebar small{display:block;margin:6px 0;font-size:12px}#associationGraphSidebar label{display:block;margin:8px 0}#associationGraphSidebar select{max-width:100%}#associationGraphs{grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));align-items:start}.associationGraphCard header{display:flex;gap:4px;align-items:center;padding:8px}.associationGraphCard header h3{margin:0 auto 0 0}.associationGraphCard header button{font-size:11px;padding:4px}.associationGraphPane{position:relative;height:430px}.associationPlot{height:100%;width:100%}.associationGraphLabels{position:absolute;inset:0;pointer-events:none;overflow:hidden}.associationGraphLabels svg{position:absolute;inset:0;max-height:none}.associationVertexLabel{position:absolute;pointer-events:auto;border:0;background:rgba(255,255,255,.85);padding:0;color:#183743;text-align:center;line-height:1;font-family:Arial,sans-serif;white-space:nowrap}.associationVertexLabel:hover{background:#edf4f5;outline:1px solid #607d8b}.associationLabelStatus{display:block;padding:4px 8px;font-size:11px}.associationGraphExpanded{position:fixed;inset:20px;z-index:1000;background:white;display:flex;flex-direction:column;box-shadow:0 0 0 25px #0007}.associationGraphExpanded .associationGraphPane{flex:1;min-height:0}.associationPNG{display:block;padding:6px}.associationPNG[hidden]{display:none}@media(max-width:900px){#associationGraphWorkspace{grid-template-columns:minmax(0,1fr)}#associationGraphSidebar{max-height:400px}}`;document.head.append(style);
}
