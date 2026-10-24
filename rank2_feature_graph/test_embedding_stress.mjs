import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)};
const c=vm.createContext({el,console});
vm.runInContext(fs.readFileSync('rank2_feature_graph/embedding_stress.js','utf8'),c);
const rows=[[[0,1]],[[1,1]],[[0,.5],[1,.5]]],coords=[[1,0,0],[0,1,0],[.5,.5,0]];
const snapshot=JSON.stringify([rows,coords]);
let r=c.evaluateEmbeddingStress(rows,coords);assert.equal(r.relativeRms,0);assert.equal(r.pairs,3);assert.equal(r.sampled,false);
r=c.evaluateEmbeddingStress(rows,coords.map(v=>v.map(x=>2*x)));assert(Math.abs(r.relativeRms-1)<1e-14);
r=c.evaluateEmbeddingStress(rows,coords.map(v=>v.map(x=>2*x)),{scale:2});assert.equal(r.relativeRms,0);
assert.equal(c.stressDistance(rows[0],rows[1],'hellinger'),1);assert.equal(c.stressDistance(rows[0],rows[1],'jensen_shannon'),1);
assert.equal(c.stressDistance([[0,.25],[1,.75]],[[0,.5],[1,.5]],'ratio_euclidean',0),2);
assert(Math.abs(c.stressDistance([[0,.25],[1,.75]],[[0,.5],[1,.5]],'sqrt_ratio_euclidean',0)-(Math.sqrt(3)-1))<1e-14);
r=c.evaluateEmbeddingStress([rows[0],rows[0]],[[0,0,0],[0,0,0]]);assert.equal(r.relativeRms,null);assert.equal(r.zeroPairs,1);
assert.equal(c.evaluateEmbeddingStress([],[]).relativeRms,null);
const a=c.stressPairs(1000),b=c.stressPairs(1000);assert.equal(a.pairs.length,20000);assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(new Set(a.pairs.map(p=>p.join(','))).size,20000);assert(a.pairs.every(([i,j])=>i>=0&&i<j&&j<1000));
assert.equal(JSON.stringify([rows,coords]),snapshot);
c.setEmbeddingStress('test',{relativeRms:.12345,sampled:true},'target');assert.equal(el('test').textContent,'RMS relative error: 12.35% (sampled)');
c.setEmbeddingStress('test',null,'missing');assert.equal(el('test').textContent,'RMS relative error: unavailable');
// Geometry is computed from the actual displayed marker coordinates, with
// repeated profiles and endpoint references excluded from the evaluation.
c.META={id:'test'};c.DATA={records:[{profile:0},{profile:0},{profile:1}]};c.participant={active:false};c.participantData=()=>({compositions:{0:rows[0],1:rows[1]},provenance:{matrixSha256:'matrix'}});c.datasetRegistry=new Map([['test',{dataset:{revision:'rev'},data:{}}]]);c.BUNDLE_PACK={};c.legendVisibleTrace=t=>t.mode==='markers';
el('samples').data=[{mode:'markers',meta:{sampleView:'v'},ids:['0','1','2'],x:[1,1,0],y:[0,0,1],z:[0,0,0]},{mode:'markers',ids:['99'],x:[100],y:[100],z:[100]}];
c.renderSampleStress();assert.equal(el('sampleStress').textContent,'RMS relative error: 0.00%');
c.participantData=()=>({compositions:{0:rows[0]},provenance:{matrixSha256:'matrix'}});c.renderSampleStress();assert.equal(el('sampleStress').textContent,'RMS relative error: unavailable');
// Reject full-composition supplements from another dataset revision.
c.BUNDLE_PACK={stressCompositions:{test:{datasetRevision:'old',compositions:{0:rows[0],1:rows[1]},matrixSha256:'old-matrix'}}};
c.renderSampleStress();assert.equal(el('sampleStress').textContent,'RMS relative error: unavailable');
c.BUNDLE_PACK.stressCompositions.test.datasetRevision='rev';c.renderSampleStress();assert.equal(el('sampleStress').textContent,'RMS relative error: 0.00%');
// Existing normalized RMSE and solver stress must never masquerade as RMSRE.
c.renderFamilyStress({size:2000},{metric:'hellinger',construction:'Complete Fermat',power:'2',solver:{stress:.01,metadata:{target_normalized_rmse:.02}}},[]);assert.equal(el('familyStress').textContent,'RMS relative error: unavailable');
c.renderFamilyStress({size:2000},{metric:'hellinger',construction:'Symmetric kNN + MST',distanceEvaluation:{relativeRms:.25,pairs:2016,seed:20261024}},[]);assert.equal(el('familyStress').textContent,'RMS relative error: 25.00% (sampled)');
console.log('PASS: analytic RMSRE, display scaling, target metrics, reproducible unique pairs, zero distances, immutable inputs, displayed-profile deduplication, reference exclusion, missing inputs and metric separation.');
