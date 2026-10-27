// Method routing, exact memberships and participant caches, without scientific assets.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:'',options:[],disabled:false});return elements.get(id)};
el('coverage').value='60';el('sampleEmbedding').value='maxnorm-euclidean';
const ctx=vm.createContext({el,atob,console});const run=s=>vm.runInContext(s,ctx);
run(`let META={id:'fixture',revision:'v1'},activeCohort='A',activeStateMode='merged',selected='1,2',selectedVertex=null,preferredSampleEmbedding='local';
let participant={active:false,embeddingMode:'union'},DATA={records:[{profile:0},{profile:1},{profile:1}],samples:{ids:['a','b','c'],pair:['1,2','1,2','1,2']}};
const rank3UsesSamples=()=>false,candidateActive=()=>false,pureCoverageActive=()=>false,hasSelection=()=>selected!==null,eligibleIndices=()=>[0,1,2];
const BUNDLE_PACK={participants:{fixture:{analysisRevision:'a'}},datasetMaxNormalizedEmbeddings:{fixture:{version:1,dataset:'fixture',revision:'bank',baseRevision:'v1',analysisRevision:'a',globals:{all:'pop',A:'pop'},contexts:{},subjects:{joint:'sel'},fits:{}}}};
const copyCamera=x=>JSON.parse(JSON.stringify(x));`);
for(const file of ['subject_embedding.js','max_normalized_views.js'])run(fs.readFileSync(new URL(file,import.meta.url),'utf8'));
run("currentSubjectEmbeddingScope=()=>({context:'joint',profiles:[0,1]})");
function encoded(coords){const b=Buffer.alloc(coords.length*24);coords.flat().forEach((v,i)=>b.writeDoubleLE(v,i*8));return b.toString('base64')}
for(const metric of ['euclidean','linf']){
 ctx.coordinates=encoded(metric==='euclidean'?[[0,0,0],[2,0,0]]:[[0,0,0],[1,0,0]]);ctx.metric=metric;
 run(`{const a=BUNDLE_PACK.datasetMaxNormalizedEmbeddings.fixture;for(const key of ['pop','sel'])a.fits[key+':'+metric]={profiles:[0,1],metric,coordinateEncoding:'float64-le-base64',coordinates,receipt:metric,solver:{backend:'sgd',epochs:200},evaluation:{profiles:2,relativeRms:0},validation:{}};a.contexts[datasetMaxNormalizedContext('group','1,2')]='sel';a.contexts[datasetMaxNormalizedContext('overview')]='pop'}`);
}
run('applyAutomaticEmbedding()');assert.equal(el('sampleEmbedding').value,'maxnorm-euclidean-local');
assert.deepEqual(JSON.parse(JSON.stringify(run('maxNormalizedLocalFit().coords'))),[[0,0,0],[2,0,0],[2,0,0]]);
assert.equal(run('maxNormalizedLocalFit().n'),3,'Repeated records retain their own membership');
run("selected=null;applyAutomaticEmbedding()");assert.equal(el('sampleEmbedding').value,'maxnorm-euclidean');assert.equal(run('maxNormalizedCoordinates()[1][0]'),2);
run("participant.active=true;el('sampleEmbedding').value='maxnorm-linf-local';applyAutomaticEmbedding()");
assert.equal(el('sampleEmbedding').value,'maxnorm-linf');assert.equal(run('embeddingChoiceState().locked'),false);
assert.equal(run('savedSubjectEmbedding(currentSubjectEmbeddingScope()).coords[1][0]'),1);
assert.equal(run('subjectEmbeddingCache.size'),0,'New metrics never enter the L1 cache');
el('sampleEmbedding').value='maxnorm-euclidean';assert.equal(run('savedSubjectEmbedding(currentSubjectEmbeddingScope()).coords[1][0]'),2);
assert.throws(()=>run('datasetMaxNormalizedSubject({context:"missing",profiles:[0,1]})'),/no joint fit/);
assert.throws(()=>run('datasetMaxNormalizedSubject({context:"joint",profiles:[1]})'),/membership differs/);
run("participant.active=false;META.revision='wrong'");assert.equal(run('datasetMaxNormalizedAsset()'),null);
console.log('PASS: saved dataset routing, duplicate observations, cohort/local identity, participant metric separation, missing/stale fits rejected.');
