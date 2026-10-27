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
 el('graphVertexRows').innerHTML=rows.map(n=>`<tr><td><button type="button" class="graphVertexName" data-graph-vertex="${esc(n.id)}">${esc(n.id)} · ${esc(n.label)}</button></td><td>${n.degree}</td><td>${fmt(n.count)}</td><td>${n.percent===null?'—':n.percent>0&&n.percent<.01?'&lt;0.01':n.percent.toFixed(2)}</td></tr>`).join('')||'<tr><td colspan="4">No vertices in the current graph.</td></tr>';
 const singleGroups=DATA.assignment?new Set(entries.filter(e=>DATA.rank1Groups?.[e.pair]).map(e=>e.pair)).size:0;
 graphInformationCache={data:DATA,graph:g,population,singleGroups};
 renderGraphSummary(g,singleGroups);
}
function resetAllDatasetGraphFading(){
 const result=datasetPanelStorage.resetGraphFading();
 el('graphFadeBySize').checked=true;setGraphFadeStrength(.1);saveDatasetPanelSettings();graph();
 el('resetGraphFadingStatus').textContent=`Fading on at 0.10 for all datasets; ${result.updated} saved settings updated.`+(result.failed?` ${result.failed} settings could not be updated.`:'');
}
function graphNodeSize(degree,dimension=3){return (dimension===2?5:4)*Math.sqrt(degree>0?degree:.25)*graphVertexScale()/100}
// Spheres use coordinate-unit radii, with the same sqrt(degree) size rule.
// One common scale from the full layout keeps subgraph selection from inflating them.
function graphSphereUnit(lookup){
 const points=[...lookup.values()];
 if(!points.length)return 1/500;
 const span=Math.max(...[0,1,2].map(j=>Math.max(...points.map(p=>p[j]||0))-Math.min(...points.map(p=>p[j]||0))));
 return (span||1)/500;
}
function graphVertexExtent(id,degrees,lookup,project=graphScreenPoint){
 const size=graphNodeSize(degrees.get(id));if(!graphSpheresEnabled())return size;
 const p=lookup.get(id),center=project(p);if(!center)return size;
 const radius=size*graphSphereUnit(lookup),offsets=[0,1,2].map(j=>project(p.map((v,k)=>v+(j===k?radius:0))));
 if(offsets.some(q=>!q))return size;
 // Orthographic projected radius; a local perspective approximation for picking/gaps.
 return Math.sqrt(offsets.reduce((sum,q)=>sum+(q.x-center.x)**2+(q.y-center.y)**2,0)/2);
}
const graphSphereMesh=(()=>{
 const points=[[0,0,1]],i=[],j=[],k=[],rings=12,sectors=24;
 for(let r=1;r<rings;r++)for(let s=0;s<sectors;s++){const a=Math.PI*r/rings,b=2*Math.PI*s/sectors;points.push([Math.sin(a)*Math.cos(b),Math.sin(a)*Math.sin(b),Math.cos(a)])}
 const bottom=points.length;points.push([0,0,-1]);
 const face=(a,b,c)=>{i.push(a);j.push(b);k.push(c)};
 for(let s=0;s<sectors;s++){
  const next=(s+1)%sectors;face(0,1+s,1+next);
  for(let r=0;r<rings-2;r++){const a=1+r*sectors+s,b=1+r*sectors+next;face(a,a+sectors,b);face(b,a+sectors,b+sectors)}
  face(bottom,1+(rings-2)*sectors+next,1+(rings-2)*sectors+s);
 }
 return {points,i,j,k};
})();
// Independent panel lighting, with the previous material as the backward-compatible default.
function sphereLightingValue(value,fallback){
 const n=(typeof value==='number'||typeof value==='string'&&value.trim()!=='')?Number(value):NaN;
 return Number.isFinite(n)&&n>=0&&n<=100?Math.round(n):fallback;
}
function sphereLightingSettings(panel){
 const prefix=panel==='graph'?'graphSphere':'sampleReferenceSphere';
 return {ambient:sphereLightingValue(el(prefix+'Ambient')?.value,85),highlights:sphereLightingValue(el(prefix+'Highlights')?.value,18)};
}
function restoreSphereLighting(panel,settings){
 const prefix=panel==='graph'?'graphSphere':'sampleReferenceSphere';
 el(prefix+'Ambient').value=String(sphereLightingValue(settings?.ambient,85));
 el(prefix+'Highlights').value=String(sphereLightingValue(settings?.highlights,18));
 syncSphereLightingControls(panel);
}
function validateSphereLighting(settings){
 if(settings===undefined)return;
 if(!settings||['ambient','highlights'].some(k=>typeof settings[k]!=='number'||!Number.isFinite(settings[k])||settings[k]<0||settings[k]>100))throw Error('The saved sphere lighting is invalid.');
}
function syncSphereLightingControls(panel,available=true){
 const prefix=panel==='graph'?'graphSphere':'sampleReferenceSphere',settings=sphereLightingSettings(panel);
 const enabled=available&&(panel==='graph'?graphSpheresEnabled():el('sampleReferenceSpheres')?.checked===true&&!el('sampleReferenceSpheres').disabled);
 for(const [suffix,key] of [['Ambient','ambient'],['Highlights','highlights']]){
  el(prefix+suffix).disabled=!enabled;el(prefix+suffix+'Value').textContent=settings[key]+'%';
 }
}
function vertexSphereLighting(panel='graph'){
 const s=sphereLightingSettings(panel);
 return {ambient:s.ambient/100,diffuse:.35,specular:s.highlights/100,roughness:.6,fresnel:0};
}
async function updateSphereLighting(panel){
 syncSphereLightingControls(panel);
 if(typeof saveDatasetPanelSettings==='function')saveDatasetPanelSettings();
 if(panel==='graph'&&el('dimension').value!=='3'){graph();return}
 if(panel==='graph'&&typeof graphQueue!=='undefined')await graphQueue;
 if(panel==='sample'&&typeof queue!=='undefined')await queue;
 const plot=el(panel==='graph'?'graph3d':'samples'),indices=[];
 (plot.data||[]).forEach((t,i)=>{if(panel==='graph'?t.meta?.graphSphere!==undefined:t.meta?.referenceSphere)indices.push(i)});
 if(indices.length)await Plotly.restyle(plot,{lighting:[vertexSphereLighting(panel)]},indices);
}
function graphSphereTraces(g,lookup,degrees,fade){
 const unit=graphSphereUnit(lookup),mesh=graphSphereMesh;
 return g.nodes.map(n=>{
  const center=lookup.get(n.id),radius=graphNodeSize(degrees.get(n.id))*unit,points=mesh.points.map(p=>p.map((v,j)=>center[j]+radius*v));
  return {type:'mesh3d',meta:{graphSphere:n.id},x:points.map(p=>p[0]),y:points.map(p=>p[1]),z:points.map(p=>p[2]),i:mesh.i,j:mesh.j,k:mesh.k,
   color:graphVertexColor(n.id===selectedVertex||rank3.enabled&&n.id===rank3.vertex),opacity:fade.node(n.id),flatshading:false,
   lighting:vertexSphereLighting('graph'),lightposition:{x:100000,y:200000,z:300000},
   customdata:points.map(()=>'vertex:'+n.id),text:points.map(()=>esc(graphNodeHover(n,degrees.get(n.id))).replaceAll('\n','<br>')),hovertemplate:'%{text}<extra></extra>',showlegend:false};
 });
}
// Only reference markers become meshes; observation and selection traces stay intact.
function sampleReferenceSphereTraces(traces,layout){
 if(!participant.showVertices)return traces;
 const spheres=el('sampleReferenceSpheres')?.checked===true,appearance=sampleReferenceSettings();
 const references=traces.filter(t=>t.meta?.referenceVertices),extra=[];
 if(!references.length){
  // Give annotation-only participant references the same marker controls.
  const groups=new Map();
  for(const a of layout.scene?.annotations||[]){
   if(!String(a.name||'').startsWith('participant-reference-vertex:')||![a.x,a.y,a.z].every(Number.isFinite))continue;
   const key=JSON.stringify([a.x,a.y,a.z]);if(!groups.has(key))groups.set(key,{a,labels:[]});groups.get(key).labels.push(a.text);
  }
  for(const {a,labels} of groups.values())extra.push({type:'scatter3d',mode:'markers',meta:{referenceVertices:true},x:[a.x],y:[a.y],z:[a.z],text:[labels.join('<br>')],marker:{size:8,symbol:'diamond',color:'#24414c'},hovertemplate:'%{text}<extra></extra>',showlegend:false});
 }
 const all=[...traces,...extra],lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const t of all)for(const [j,axis] of ['x','y','z'].entries())for(const v of t[axis]||[])if(Number.isFinite(v)){lo[j]=Math.min(lo[j],v);hi[j]=Math.max(hi[j],v)}
 const span=Math.max(...hi.map((v,j)=>v-lo[j])),unit=(Number.isFinite(span)&&span>0?span:1)/600,mesh=graphSphereMesh;
 const at=(v,i,fallback)=>Array.isArray(v)?v[i]??fallback:v??fallback;
 return all.flatMap(t=>{
  if(!t.meta?.referenceVertices||t.visible===false||t.visible==='legendonly')return [t];
  const scaled=v=>(Number.isFinite(v)?v:8)*appearance.scale/100;
  t={...t,marker:{...t.marker,color:appearance.color,size:Array.isArray(t.marker?.size)?t.marker.size.map(scaled):scaled(t.marker?.size)}};
  if(!spheres||!t.x?.length)return [t];
  const result=[];
  for(let n=0;n<t.x.length;n++){
   const center=[t.x[n],t.y?.[n],t.z?.[n]];if(!center.every(Number.isFinite))continue;
   const radius=at(t.marker?.size,n,8)*unit,points=mesh.points.map(p=>p.map((v,j)=>center[j]+radius*v)),hover=at(t.hovertext,n,at(t.text,n,t.name||'Reference vertex'));
   result.push({type:'mesh3d',meta:{...t.meta,referenceSphere:true},x:points.map(p=>p[0]),y:points.map(p=>p[1]),z:points.map(p=>p[2]),i:mesh.i,j:mesh.j,k:mesh.k,
    color:at(t.marker?.color,n,'#24414c'),opacity:(t.opacity??1)*at(t.marker?.opacity,n,1),flatshading:false,
    lighting:vertexSphereLighting('sample'),lightposition:{x:100000,y:200000,z:300000},
    name:t.name,legendgroup:t.legendgroup,showlegend:n===0&&(t.showlegend??layout.showlegend===true),
    customdata:points.map(()=>at(t.customdata,n,null)),text:points.map(()=>hover),hoverinfo:t.hoverinfo,
    hovertemplate:(t.hovertemplate||'%{text}<extra></extra>').replaceAll('%{hovertext}','%{text}')});
  }
  if(t.mode?.includes('text'))result.push({...t,mode:'text',showlegend:false,hoverinfo:'skip'});
  return result;
 });
}
function graphSphereGradients(svg){
 if(!graphSpheresEnabled())return;
 const defs=node('defs',{},svg),settings=sphereLightingSettings('graph');
 // Preserve the former 2D shading at 85/18, with smooth control to either endpoint.
 const h=settings.highlights/100,highlight=h<=.18?.65*h/.18:.65+.35*(h-.18)/.82;
 for(const active of [false,true]){
  const color=graphVertexColor(active),gradient=node('radialGradient',{id:active?'graphSphereSelected':'graphSphereBase',cx:'.32',cy:'.28',r:'.72'},defs);
  for(const [offset,mix] of [[0,highlight],[.25,highlight*(.2/.65)],[.6,0],[1,settings.ambient/100-1]]){
   const rgb=color.slice(1).match(/../g).map(v=>parseInt(v,16)),shade=rgb.map(v=>Math.round(mix>=0?v+(255-v)*mix:v*(1+mix)));
   node('stop',{offset,'stop-color':'rgb('+shade.join(',')+')'},gradient);
  }
 }
}
function graphVertexFill(active){return graphSpheresEnabled()?'url(#'+(active?'graphSphereSelected':'graphSphereBase')+')':graphVertexColor(active)}
function graphSphereLabelUpdates(g,lookup,degrees){
 const packed=graphCollisionLabelUpdates(g,lookup,degrees);if(packed)return packed;
 if(!graphSpheresEnabled())return {};
 const annotations=el('graph3d').layout?.scene?.annotations||[],updates={};
 for(const n of g.nodes){const i=annotations.findIndex(a=>a.name==='vertex:'+n.id);if(i>=0)updates[`scene.annotations[${i}].yshift`]=graphVertexExtent(n.id,degrees,lookup)+4}
 return updates;
}
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
function graphSpheresEnabled(){return el('graphSpheres')?.checked===true}
function graphVertexScaleValue(value){const n=Number(value);return Number.isFinite(n)&&n>=25&&n<=300?Math.round(n/5)*5:100}
function graphVertexScale(){return graphVertexScaleValue(el('graphVertexScale')?.value)}
function syncGraphVertexSizeControl(){if(el('graphVertexScaleValue'))el('graphVertexScaleValue').textContent=graphVertexScale()+'%'}
function setGraphVertexScale(value){if(el('graphVertexScale'))el('graphVertexScale').value=String(graphVertexScaleValue(value));syncGraphVertexSizeControl()}
function validGraphColor(value){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)}
function graphColorSettings(){return {vertex:validGraphColor(el('graphVertexColor')?.value)?el('graphVertexColor').value.toLowerCase():'#d62728',edge:validGraphColor(el('graphEdgeColor')?.value)?el('graphEdgeColor').value.toLowerCase():'#82a9b9'}}
function restoreGraphColorSettings(settings){
 if(el('graphVertexColor'))el('graphVertexColor').value=validGraphColor(settings?.vertex)?settings.vertex.toLowerCase():'#d62728';
 if(el('graphEdgeColor'))el('graphEdgeColor').value=validGraphColor(settings?.edge)?settings.edge.toLowerCase():'#82a9b9';
}
function sampleReferenceSettings(){return {scale:graphVertexScaleValue(el('sampleReferenceScale')?.value),color:validGraphColor(el('sampleReferenceColor')?.value)?el('sampleReferenceColor').value.toLowerCase():'#d62728'}}
function restoreSampleReferenceSettings(settings){
 el('sampleReferenceScale').value=String(graphVertexScaleValue(settings?.scale));
 el('sampleReferenceColor').value=validGraphColor(settings?.color)?settings.color.toLowerCase():'#d62728';
 syncSampleReferenceSizeControl();
}
function syncSampleReferenceSizeControl(){el('sampleReferenceScaleValue').textContent=sampleReferenceSettings().scale+'%'}
function graphVertexColor(active=false){return active?'#cf6b21':graphColorSettings().vertex}
function graphEdgeColor(active=false){return active?'#cf6b21':graphColorSettings().edge}
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
  const pts=[],ids=[],text=[],colors=[],base=graphEdgeColor(active);
  for(const e of edges){
   const a=lookup.get(e.from),b=lookup.get(e.to),ends=project?clippedSegment(a,b,project,graphVertexExtent(e.from,degrees,lookup,project)+5,graphVertexExtent(e.to,degrees,lookup,project)+5):[a,b];if(!ends)continue;
   const steps=g.edges.length>100?2:9,color=graphColorOpacity(base,fade.edge(e));
   for(let i=0;i<steps;i++){pts.push(ends[0].map((v,j)=>v+(ends[1][j]-v)*i/(steps-1)));ids.push(e.id);colors.push(color);text.push(`${esc(e.key)}: ${esc(e.label)}<br>n=${e.frequency}; Endpoint distance=${fmt(e.length)} pp${graphLayoutHover(e)}`)}
   pts.push([null,null,null]);ids.push(null);text.push('');colors.push(color);
  }
  return {type:'scatter3d',mode:'lines+markers',meta:{graphEdgeGroup:Number(active)+':'+width},x:pts.map(p=>p[0]),y:pts.map(p=>p[1]),z:pts.map(p=>p[2]),customdata:ids,connectgaps:false,line:{color:el('graphFadeBySize')?.checked?colors:base,width},marker:{size:3,color:'rgba(0,0,0,0)'},text,hovertemplate:'%{text}<extra></extra>'};
 });
}
function graphVertexAtPointer(x,y){
 const {g,lookup}=graphGeometry(),degrees=graphNodeDegrees(g);
 return g.nodes.map(n=>({id:n.id,size:graphVertexExtent(n.id,degrees,lookup),p:graphScreenPoint(lookup.get(n.id))})).filter(n=>n.p&&n.p.z>=-1&&n.p.z<=1&&Math.hypot(n.p.x-x,n.p.y-y)<=Math.max(11,n.size+4)).sort((a,b)=>a.p.z-b.p.z)[0]?.id;
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
async function positionGraphLabelsOnly(g,lookup,degrees){
 const updates=graphCollisionLabelUpdates(g,lookup,degrees);if(!updates)return;graphTrimming=true;
 try{await Plotly.relayout(el('graph3d'),updates)}finally{graphTrimming=false}
}
async function trimGraphEdges(){
 if(typeof window!=='undefined'&&document.body.classList.contains('panelMaximized')&&!el('featurePanel').classList.contains('maximized'))return;
 if(!el('graph3d')._fullLayout?.scene?._scene||el('dimension').value!=='3')return;
 const camera=liveViewCamera(el('graph3d'));
 const {g,lookup}=graphGeometry(),degrees=graphNodeDegrees(g),updates=[];
 if(participant.active){
  const traces=participantGraphEdgeTraces(g,lookup,graphScreenPoint);if(!matchingGraphEdgeTraces(traces)){await positionGraphLabelsOnly(g,lookup,degrees);return}graphTrimming=true;
  try{
   // Restyling density edges can reapply the stale layout camera. Commit the
   // gesture's live camera first, as in the ordinary graph branch below.
   await Plotly.relayout(el('graph3d'),{'scene.camera':camera,...graphSphereLabelUpdates(g,lookup,degrees)});
   await Plotly.restyle(el('graph3d'),Object.fromEntries(['x','y','z','customdata','text','line'].map(k=>[k,traces.map(t=>t[k])])),traces.map((_,i)=>i));
  }finally{graphTrimming=false}
  return;
 }
 updates.push(...graphEdgeTraces(g,lookup,graphScreenPoint));if(!matchingGraphEdgeTraces(updates)){await positionGraphLabelsOnly(g,lookup,degrees);return}
 graphTrimming=true;try{
  await Plotly.relayout(el('graph3d'),{'scene.camera':camera,...graphSphereLabelUpdates(g,lookup,degrees)});
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
  originals.forEach((n,i)=>{const s=getComputedStyle(n);for(const key of ['fill','stroke','stroke-width','paint-order','font-size','font-family','font-weight'])copies[i].style.setProperty(key,s.getPropertyValue(key).replace(/url\(["']?[^)]*#(graphSphere(?:Base|Selected))["']?\)/g,'url(#$1)'))});
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

// Pack screen-space text rectangles without changing scientific coordinates.
// Prefer short leaders; when space is exhausted retain selected/high-degree names.
function placeGraphLabels(items,bounds,obstacles=[]){
 const gap=4,placed=[],result=new Map(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const intersects=(a,b)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
 const hitsVertex=r=>obstacles.some(p=>Math.hypot(p.x-clamp(p.x,r.x,r.x+r.width),p.y-clamp(p.y,r.y,r.y+r.height))<p.radius+2);
 for(const item of [...items].sort((a,b)=>(b.priority||0)-(a.priority||0)||a.id-b.id)){
  const {width,height}=item;if(width>bounds.width||height>bounds.height)continue;
  const left=bounds.x,right=left+bounds.width-width,top=bounds.y,bottom=top+bounds.height-height;
  const idealX=item.x-width/2,idealY=item.y-(item.radius||0)-height-5;
  const xs=new Set([clamp(idealX,left,right),left,right]);
  for(const r of placed){xs.add(clamp(r.x-width-gap,left,right));xs.add(clamp(r.x+r.width+gap,left,right))}
  const ys=new Set([clamp(idealY,top,bottom),clamp(item.y+(item.radius||0)+5,top,bottom),bottom]);
  for(let y=top;y<=bottom;y+=height+gap)ys.add(y);
  for(const r of placed){ys.add(clamp(r.y-height-gap,top,bottom));ys.add(clamp(r.y+r.height+gap,top,bottom))}
  let best=null,score=Infinity;
  for(const x of xs)for(const y of ys){const r={id:item.id,x,y,width,height};
   const distance=(x+width/2-item.x)**2+(y+height/2-item.y)**2;
   if(distance>=score||placed.some(p=>intersects(r,p))||hitsVertex(r))continue;
   best=r;score=distance;
  }
  if(best){placed.push(best);result.set(item.id,best)}
 }
 return result;
}
function graphLabelPriority(id,degree){return (id===selectedVertex||rank3.enabled&&id===rank3.vertex?1000000:0)+(degree||0)}
function graphLabelCount(shown,total){
 const note=el('graphLabelNote');if(!note)return;
 note.hidden=!el('vertexLabels').checked||!total;
 note.textContent=shown===total?`All ${total} vertex labels shown.`:`${shown} of ${total} labels shown. Select any vertex by name in the table below.`;
 note.title='Labels avoid each other and vertex markers. Lines connect displaced names to their vertices. Selected and high-degree vertices take priority when space is limited; all vertices and edges remain in the graph.';
}
function graphLabelTextSize(text){
 if(typeof document!=='undefined'&&document.createElement){
  const context=graphLabelTextSize.context||(graphLabelTextSize.context=document.createElement('canvas').getContext('2d'));
  if(context){context.font=graphLabelFont.size+'px '+graphLabelFont.family;return {width:Math.ceil(context.measureText(text).width)+6,height:graphLabelFont.size+7}}
 }
 return {width:text.length*graphLabelFont.size*.6+6,height:graphLabelFont.size+7};
}
function graphCollisionLabelUpdates(g,lookup,degrees){
 const plot=el('graph3d'),rect=plot.getBoundingClientRect?.();if(!rect||rect.width<1||rect.height<1)return null;
 const annotations=plot.layout?.scene?.annotations||[],points=new Map(),items=[],obstacles=[];
 for(const n of g.nodes){
  const p=graphScreenPoint(lookup.get(n.id));if(!p||p.z< -1||p.z>1)continue;
  const radius=graphVertexExtent(n.id,degrees,lookup);points.set(n.id,{...p,radius});obstacles.push({...p,radius});
  if(el('vertexLabels').checked&&graphNodeLabelVisible(n))items.push({id:n.id,...p,radius,...graphLabelTextSize(graphNodeLabel(n)),priority:graphLabelPriority(n.id,degrees.get(n.id))});
 }
 const positions=placeGraphLabels(items,{x:rect.left+6,y:rect.top+20,width:Math.max(0,rect.width-12),height:Math.max(0,rect.height-26)},obstacles),updates={};
 annotations.forEach((a,i)=>{
  if(!a.name?.startsWith('vertex:'))return;const id=Number(a.name.slice(7)),r=positions.get(id),p=points.get(id),prefix=`scene.annotations[${i}].`;
  updates[prefix+'visible']=!!r;if(!r)return;
  const values={xshift:0,yshift:0,xanchor:'center',yanchor:'middle',showarrow:true,arrowhead:0,arrowwidth:.7,arrowcolor:'#8b9da5',standoff:p.radius+2,ax:r.x+r.width/2-p.x,ay:r.y+r.height/2-p.y,bgcolor:'rgba(255,255,255,0.9)',borderpad:2};
  for(const [key,value] of Object.entries(values))updates[prefix+key]=value;
 });
 graphLabelCount(positions.size,annotations.filter(a=>a.name?.startsWith('vertex:')).length);
 return updates;
}
function arrangeGraphLabels2d(svg){
 const rect=svg.getBoundingClientRect?.();if(!rect||rect.width<1||rect.height<1)return;
 const labels=[...svg.querySelectorAll('text[data-vertex]')],circles=new Map([...svg.querySelectorAll('circle[data-vertex]')].map(c=>[Number(c.dataset.vertex),c])),items=[],obstacles=[],degrees=graphNodeDegrees(displayedGraph());
 for(const [id,c] of circles){const r=c.getBoundingClientRect();obstacles.push({id,x:r.left+r.width/2,y:r.top+r.height/2,radius:r.width/2})}
 for(const label of labels){
  label.style.display='';label.setAttribute('x',0);label.setAttribute('y',0);label.setAttribute('text-anchor','start');
  const id=Number(label.dataset.vertex),p=obstacles.find(p=>p.id===id),r=label.getBoundingClientRect();
  if(p)items.push({id,...p,width:r.width+4,height:r.height+4,priority:graphLabelPriority(id,degrees.get(id))});
 }
 const positions=placeGraphLabels(items,{x:rect.left+6,y:rect.top+6,width:Math.max(0,rect.width-12),height:Math.max(0,rect.height-12)},obstacles);
 for(const line of svg.querySelectorAll('[data-label-leader]'))line.remove();
 for(const label of labels){
  const id=Number(label.dataset.vertex),r=positions.get(id);if(!r){label.style.display='none';continue}
  const m=label.getScreenCTM(),box=label.getBoundingClientRect(),p=obstacles.find(p=>p.id===id);if(!m)continue;
  const inverse=(x,y)=>{const dx=x-m.e,dy=y-m.f,d=m.a*m.d-m.b*m.c;return [(m.d*dx-m.c*dy)/d,(-m.b*dx+m.a*dy)/d]};
  const xy=inverse(r.x+2-(box.left-m.e),r.y+2-(box.top-m.f));label.setAttribute('x',xy[0]);label.setAttribute('y',xy[1]);
  const end={x:Math.max(r.x,Math.min(r.x+r.width,p.x)),y:Math.max(r.y,Math.min(r.y+r.height,p.y))},distance=Math.hypot(end.x-p.x,end.y-p.y);
  if(distance>p.radius+4){
   const a=inverse(p.x+(end.x-p.x)*(p.radius+2)/distance,p.y+(end.y-p.y)*(p.radius+2)/distance),b=inverse(end.x,end.y);
   const line=node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#8b9da5','stroke-width':.7/Math.hypot(m.a,m.b),opacity:label.getAttribute('opacity')||1,'pointer-events':'none','data-label-leader':id},label.parentNode);
   label.parentNode.insertBefore(line,label);
  }
 }
 graphLabelCount(positions.size,labels.length);
}

// Compensate the SVG viewBox and zoom transforms to match the 3D label size.
function sizeGraphLabels2d(){
 const svg=el('graph');if(!svg.querySelectorAll)return;
 for(const label of svg.querySelectorAll('text')){
  const matrix=label.getScreenCTM();if(!matrix)continue;
  const scale=Math.hypot(matrix.a,matrix.b);if(!scale)continue;
  label.style.fontSize=graphLabelFont.size/scale+'px';label.style.fontFamily=graphLabelFont.family;
  label.style.strokeWidth=2/scale+'px';
 }
 arrangeGraphLabels2d(svg);
}
if(typeof window!=='undefined'&&typeof ResizeObserver!=='undefined')new ResizeObserver(sizeGraphLabels2d).observe(el('graph'));

// Use the actual annotation hit by the browser, not overlapping text boxes.
// Selection still waits for a stationary pointer release in the graph handler.
function graphLabelAtPointer(x,y,target){
 const plot=el('graph3d');if(!el('vertexLabels').checked)return null;
 const group=target?.closest?.('.annotation-scene');
 if(!group||!plot.contains(group))return null;
 const name=plot.layout?.scene?.annotations?.[Number(group.getAttribute('data-index'))]?.name;
 return name?.startsWith('vertex:')?name:null;
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
