import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{value:'',options:[],textContent:'',setAttribute(){}});return elements.get(id)};
const options=['default','pure','cohorts','visits','rank3','valencia2-cst','valencia2-subtype'];
el('sampleColorScheme').options=options.map(value=>({value}));el('sampleColorScheme').value='default';el('coverage').value='90';
el('participantColorBy').options=[{},{},{}];
const records=[{id:'a',profile:0,index:0,cohort:'A',label:'E'},{id:'b',profile:0,index:1,cohort:'B',label:'V1'},{id:'c',profile:1,index:2,cohort:'A',label:'V2'},{id:'d',profile:2,index:3}];
const bundle={dataset:{id:'test',title:'Test',observationUnit:'sample'},data:{samples:{ids:['p0','p1','p2'],pair:['1,2','1,3',null]},graphs:{100:{edges:[]}}},cohortAnalysis:{records,merged:{90:{pairs:['1,3','1,3',null]},80:{pairs:['2,3','2,3',null]}}}};
const DATA={samples:{ids:records.map(r=>r.id),pair:['1,3','1,3','1,3',null],coords:records.map((_,i)=>[i,i+1,i+2])},records};
const state={selection:'vertex:1',embedding:'local',hidden:['state'],camera:{eye:{x:1,y:2,z:3}}};
let restyles=0,refreshes=0,legendCalls=0;
const c=vm.createContext({el,META:{id:'test'},DATA,BUNDLE_PACK:{valencia2:{test:{profiles:[{cst:'I',subCST:'I-A'},{cst:'III',subCST:'III-A'}],records:[]}}},datasetRegistry:new Map([['test',bundle]]),participant:{active:false,stateBackground:true,sampleColors:true},rank3:{enabled:false},queue:Promise.resolve(),sampleRenderedKey:null,activeStateMode:'pure',
 esc:String,pairName:id=>'Pair '+id,edgeColor:id=>'pair-'+id,rank3Base:()=>({membership:['1,2,3',null,null],byId:new Map([['1,2,3',{label:'Triple'}]])}),rank3Color:id=>'triple-'+id,participantVisitColor:r=>'visit-'+r.label,participantBackgroundScheme:()=> 'original',participantBackgroundPair:r=>bundle.data.samples.pair[r.profile],participantData:()=>({records}),pureCoverageActive:()=>false,renderCountedSampleLegend:()=>legendCalls++,sampleViewKey:()=> 'fixed',saveDatasetPanelSettings(){},refreshSamples(){refreshes++},console,URL,Blob,setTimeout,
 Plotly:{restyle:async(plot,change,[i])=>{assert.deepEqual(Object.keys(change),['marker.color']);plot.data[i].marker.color=change['marker.color'][0];restyles++}}});
vm.runInContext(fs.readFileSync(new URL('valencia2.js',import.meta.url),'utf8'),c);
const run=source=>vm.runInContext(source,c),plain=x=>JSON.parse(JSON.stringify(x));
assert.equal(run('sampleColorCategory(0).id'),'1,3');
el('sampleColorScheme').value='pure';assert.equal(run('sampleColorCategory(0).id'),'1,2');
el('coverage').value='80';el('sampleColorScheme').value='default';assert.equal(run('sampleColorTitle()'),'80% 2-CSTs');assert.equal(run('sampleColorCategory(0).id'),'2,3');
el('coverage').value='90';el('sampleColorScheme').value='cohorts';
assert.equal(run('sampleColorCategory(0).id'),'A');assert.equal(run('sampleColorCategory(1).id'),'B');assert.equal(run('sampleColorCategory(3).id'),null);
const original=JSON.stringify({bundle,DATA,state});
const trace={mode:'markers',meta:{sampleView:'selection'},ids:['0','1','2','3'],x:[0,1,2,3],y:[1,2,3,4],z:[2,3,4,5],marker:{color:['x','x','x','x'],size:3,opacity:.7}};
const reference={mode:'markers',meta:{referenceVertices:true},x:[1],y:[1],z:[1],marker:{color:'green',symbol:'diamond'}};
const ring={mode:'markers',meta:{sampleView:'selection',edgeFaceRings:true},ids:['0'],x:[0],y:[1],z:[2],marker:{color:'red'}};
el('samples').data=[trace,reference,ring];el('samples').layout={scene:{camera:state.camera}};
const withoutColors=()=>JSON.stringify({traces:el('samples').data.map(t=>({...t,marker:{...t.marker,color:undefined}})),layout:el('samples').layout,state});
const before=withoutColors();
for(const mode of ['default','pure','cohorts','valencia2-cst','valencia2-subtype']){
 el('sampleColorScheme').value=mode;await run('recolorSampleView()');assert.equal(withoutColors(),before);assert.equal(JSON.stringify({bundle,DATA,state}),original);
 assert.equal(reference.marker.color,'green');assert.equal(ring.marker.color,'red');
}
trace.marker.color[2]='#d5dce0';trace.marker.color[3]='#93b3c1';el('sampleColorScheme').value='cohorts';await run('recolorSampleView()');assert.equal(trace.marker.color[2],'#d5dce0');assert.equal(trace.marker.color[3],'#93b3c1');
assert.equal(refreshes,0);assert.equal(restyles,6);assert.equal(legendCalls,6);
// Repeated records keep separate cohort identities; profile-only points report ambiguity.
c.DATA={samples:bundle.data.samples};el('sampleColorScheme').value='cohorts';assert.equal(run('sampleColorCategory(0).id'),'Multiple cohorts');assert.equal(run('sampleColorCategory(1).id'),'A');c.DATA=DATA;
// Participant visits and backgrounds retain geometry; explicitly gray backgrounds remain gray.
c.participant.active=true;el('sampleColorScheme').value='visits';assert.equal(run('sampleColorCategory(0,DATA.records[0]).color'),'visit-E');
el('samples').data=[{...trace,marker:{...trace.marker},meta:{legendRecords:[0,2]}},{...trace,marker:{...trace.marker},meta:{participantBackground:true,legendRecords:[0,1,2,3]}}];c.participant.stateBackground=false;
await run('recolorSampleView()');assert.equal(el('samples').data[1].marker.color,'#c9d2d7');assert.deepEqual(plain(el('samples').data[0].marker.color),['visit-E','visit-V2']);
// Unsupported merged/visit modes fall back without modifying the population.
c.participant.active=false;bundle.cohortAnalysis.merged={};el('sampleColorScheme').value='default';run('syncSampleColorOptions()');assert.equal(el('sampleColorScheme').value,'pure');assert.equal(el('valenciaColorControls').hidden,false);
// Real legend classifier: cohort counts and missing row follow displayed records.
c.DATA=DATA;c.participant.active=false;el('sampleColorScheme').value='cohorts';el('samples').data=[trace,reference,ring];
Object.assign(c,{datasetPanelStorage:{getItem:()=> 'selected'},legendAbundanceTotals:{},activeSensitivityMode:'baseline',taxonDisplayLabel:String,mergedComponentKey:()=>'',candidateActive:()=>false,displayGraph:g=>g,current:()=>({edges:[]}),stateDisplayLabel:String,edgeFacesActive:()=>false});
vm.runInContext(fs.readFileSync(new URL('legend_counts.js',import.meta.url),'utf8'),c);run('renderCountedSampleLegend()');
assert.match(el('sampleLegendItems').innerHTML,/<strong>Cohorts<\/strong>/);assert.match(el('sampleLegendItems').innerHTML,/Unclassified/);assert.match(el('sampleLegendItems').innerHTML,/>2<\/td><td class="legendNumber">50.00/);
console.log('PASS: explicit palettes, coverage, missing/shared cohorts, record counts, participant visits, gray backgrounds, reference markers, and color-only geometry/selection/camera invariance.');

// Reviewed cohort annotations refine legacy umbrella labels by exact record ID.
c.BUNDLE_PACK.annotations={test:{records:[{id:'a',cohort:'HMP'},{id:'b',cohort:'U01'}]}};
assert.equal(run('sampleColorCategory(0).id'),'HMP');assert.equal(run('sampleColorCategory(1).id'),'U01');assert.equal(DATA.records[0].cohort,'A');
c.DATA={samples:bundle.data.samples};assert.equal(run('sampleColorCategory(0).id'),'Multiple cohorts');
console.log('PASS: reviewed cohort metadata refines umbrella labels without changing source records.');

const major=['CONTRA','HMP','JiVitA','LSVF','MM','PRJNA549339','GALE','V400','Douching','CHARM','U01','PreSSMat','ZAPPS','PAPCLEAR'];
const palette=major.map(id=>c.sampleCohortColor(id));assert.equal(new Set(palette).size,major.length);
const other=c.sampleCohortColor('new-cohort');c.META={id:'another-dataset'};
assert.deepEqual(major.map(id=>c.sampleCohortColor(id)),palette);assert.equal(c.sampleCohortColor('new-cohort'),other);
assert.equal(c.sampleCohortColor(null),'#7c878d');assert.equal(c.sampleCohortColor('Multiple cohorts'),'#686868');
console.log('PASS: distinct major-cohort palette, fixed cross-dataset identities, deterministic fallback and neutral missing/mixed cohorts.');
// Missing scientific annotations remain visible as unavailable, never as historical CST calls.
delete c.BUNDLE_PACK.valencia2.test;c.META.id='test';c.DATA=DATA;el('sampleColorScheme').value='valencia2-cst';
run('syncSampleColorOptions()');
for(const value of ['valencia2-cst','valencia2-subtype']){
 const o=el('sampleColorScheme').options.find(o=>o.value===value);
 assert.equal(o.disabled,true);assert.equal(o.hidden,false);assert.match(o.textContent,/unavailable/);assert.match(o.title,/verified annotations/);
}
assert.equal(el('sampleColorScheme').value,'pure');
c.META.id='hmp-u01-2019';assert.match(run('valenciaUnavailableReason()'),/legacy taxon names/);
console.log('PASS: unavailable VALENCIA2 choices stay visible with the mapping prerequisite; no historical-label fallback.');
