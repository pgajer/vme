// Synthetic geometry checks; no study data required and no R jobs launched.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false});return elements.get(id)};
for(const [id,value] of Object.entries({dimension:'3',graphVertexScale:'100',graphVertexColor:'#d62728',graphEdgeColor:'#82a9b9',graphEdgeWidth:'6',graphWidthStrength:'.5',graphFadeStrength:'.1',graphMinimumDegree:'2',graphScope:'all',graphSphereAmbient:'85',graphSphereHighlights:'18'}))el(id).value=value;
for(const id of ['graphWidthBySize','graphFadeBySize','graphSpheres','vertexLabels'])el(id).checked=true;
const cohort={n:100,cases:20,matchedN:80,matchedCases:20};
const result=(n,logOR)=>({all:{n,cases:n/5,expected:n/5},matched:{n:n*.8,cases:n/5,expected:n/5},exact:{supported:true,logOR,low:-1,high:1,p:.2,holm:1,by:1,sets:5}});
const r={coverage:90,graphId:'a'.repeat(64),partitionId:'b'.repeat(64),cohorts:{ZAPPS:cohort,PreSSMat:cohort},nodes:[1,2,3].map(id=>({id:String(id),name:'Taxon_'+id})),edges:[{id:'a',name:'A + B',from:'1',to:'2',results:{ZAPPS:result(80,1),PreSSMat:result(30,-1)}},{id:'b',name:'B + C',from:'2',to:'3',results:{ZAPPS:result(20,0),PreSSMat:result(70,0)}}]};
r.vertices=r.nodes.map(n=>({...n,incidentEdges:r.edges.filter(e=>e.from===n.id||e.to===n.id).map(e=>e.id),results:{ZAPPS:result(50,1),PreSSMat:result(50,-1)}}));
const original=JSON.stringify(r),requests=[];
const ctx=vm.createContext({console,el,esc:String,taxonDisplayLabel:s=>s.replaceAll('_',' '),fmt:String,setTimeout,clearTimeout,current:()=>({nodes:[],edges:[]}),fetch:async(url,options)=>{const b=JSON.parse(options.body);requests.push(b);return {ok:true,json:async()=>({...b,coords:b.initial,relativeRms:.2,geodesicNormalizedRmse:.3,runtimeId:'c'.repeat(64)})}}});
for(const file of ['view_tools.js','graph_layout.js','associations.js','association_graphs.js'])vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),ctx);
ctx.r=r;vm.runInContext("associationView.bank={coverages:{'90':r}};associationView.level='vertex';associationView.selected='2'",ctx);
const run=s=>vm.runInContext(s,ctx),plain=x=>JSON.parse(JSON.stringify(x));
for(const dimension of [2,3])for(const mode of ['equal','proportion']){
 ctx.dimension=dimension;ctx.mode=mode;run('graphLayoutMode=mode;graphProportionStrength=4');
 const input=ctx.associationGraphInput(r,dimension),body=ctx.associationGraphRequest(r,dimension);
 assert.deepEqual(plain(body.nodes),[1,2,3]);assert.equal(input.total,200);assert.deepEqual(plain(input.edges.map(e=>e.frequency)),[110,90]);
 assert.equal(input.edges[0].target,mode==='equal'?1:5);
 assert.equal(body.initial[0].length,dimension);assert(body.context.includes(r.graphId)&&body.context.includes(r.partitionId));
 for(const metric of ['mds','grip','weighted_grip']){ctx.metric=metric;run('graphEmbeddingMethod=metric');assert.equal(ctx.associationGraphRequest(r,dimension).method,metric)}
}
run("graphLayoutMode='proportion';graphEmbeddingMethod='spring'");
const fit=ctx.associationGraphFit(r,3),lookup=fit.lookup;
assert([...lookup.values()].every(p=>p.length===3&&p.every(Number.isFinite)));
const beforePoints=JSON.stringify([...lookup]);
for(const c of ['ZAPPS','PreSSMat']){
 const content=ctx.associationGraphTraces(r,c,lookup,3),spheres=content.traces.filter(t=>t.type==='mesh3d');
 assert.equal(spheres.length,3);assert(spheres.every(t=>t.color===ctx.associationColor(c==='ZAPPS'?1/Math.LN2:-1/Math.LN2)));
 assert(content.traces.some(t=>t.line?.color==='#82a9b9'));
 const radius=t=>Math.max(...t.x)-Math.min(...t.x);
 assert(Math.abs((radius(spheres[1])/radius(spheres[0]))**2-2)<1e-10);
}
el('graphVertexScale').value='200';let larger=ctx.associationGraphTraces(r,'ZAPPS',lookup,3);assert.equal(JSON.stringify([...lookup]),beforePoints);
el('graphDegreeFilter').checked=true;assert.deepEqual(plain(ctx.associationDisplayGraph(r).g.nodes.map(n=>n.id)),[2]);
assert.equal(ctx.associationDisplayGraph(r).g.edges.length,0);el('graphMinimumDegree').value='10';assert.equal(ctx.associationDisplayGraph(r).g.nodes.length,0);el('graphDegreeFilter').checked=false;
run("associationGraphState.effectColors=false");assert(ctx.associationGraphTraces(r,'ZAPPS',lookup,3).traces.filter(t=>t.type==='mesh3d').every(t=>t.color==='#d62728'));
run("associationGraphState.effectColors=true;associationView.level='edge';associationView.selected='a'");
const edgeTraces=ctx.associationGraphTraces(r,'ZAPPS',lookup,3).traces;assert(edgeTraces.some(t=>t.line?.color===ctx.associationColor(1/Math.LN2)));
el('dimension').value='2';const plane=ctx.associationGraphFit(r,2),planeLookup=new Map([...plane.lookup].map(([id,p])=>[id,[...p,0]]));
const flat=ctx.associationGraphTraces(r,'ZAPPS',planeLookup,2);assert.equal(flat.images.length,3);assert(flat.images.every(i=>i.source.startsWith('data:image/svg+xml')));assert(flat.traces.every(t=>t.type==='scatter'));
el('graphSpheres').checked=false;assert.equal(ctx.associationGraphTraces(r,'ZAPPS',planeLookup,2).images.length,0);
run("graphEmbeddingMethod='mds'");ctx.associationGraphFit(r,3);ctx.associationGraphFit(r,3);await run('associationGraphState.queue');assert.equal(requests.length,1,'Repeated renders share one serial layout job');
const body=ctx.associationGraphRequest(r,3);assert.throws(()=>ctx.associationValidateGraphFit({method:'other'},body));
const valid={...body,coords:body.initial,relativeRms:.2,geodesicNormalizedRmse:.3,runtimeId:'c'.repeat(64)};
assert.equal(ctx.associationValidateGraphFit(valid,body),valid);
run("associationGraphState.fits.clear();associationView.bank.graphLayouts={}");ctx.key=ctx.associationGraphKey(r,3);ctx.fit=valid;run('associationView.bank.graphLayouts[key]=fit');assert(ctx.associationGraphFit(r,3).packaged);assert.equal(requests.length,1,'Portable supplied layouts do not call the R service');
assert.equal(JSON.stringify(r),original,'Appearance, fitting and filtering never mutate result rows');
console.log('PASS: enrollment-only layout inputs, pooled styling, shared appearance formulas, 2D/3D spheres, effect overrides, filters, geometry stability, serial fit deduplication and portable layouts.');
