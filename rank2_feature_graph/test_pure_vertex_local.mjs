// Local vertex geometry, exact record mapping and references; no fitting/network.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const encode=rows=>{const b=Buffer.alloc(rows.length*24);rows.flat().forEach((v,i)=>b.writeDoubleLE(v,i*8));return b.toString('base64')};
const records=[{id:'a',profile:0},{id:'duplicate',profile:0},{id:'b',profile:1},{id:'c',profile:2}];
const edges=[{id:'1,2',from:1,to:2},{id:'2,3',from:2,to:3}];
const population={profiles:[0,1,2],coords:[[0,0,0],[9,0,0],[0,9,0]]};
const saved={profiles:[0,1],coords:[[0,0,0],[1,0,0]],solver:{backend:'sgd'}};
const fresh={profiles:[0,1,2],coordinates:encode([[0,0,0],[1,0,0],[0,1,0]]),evaluation:{relativeRms:.01}};
const bundle={dataset:{id:'comb-V3V4-tx'},data:{samples:{pair:['1,2','1,2','2,3']},
 graphs:{'60':{nodes:[{id:1},{id:2},{id:3}],edges},'100':{nodes:[{id:1},{id:2},{id:3}],edges}},
 coords3d:{'100':[[0,0,0],[1,0,0],[0,1,0]]},localEmbeddings:{},sampleTopFeatures:[[],[],[]]}};
const adapter={revision:'a',eligibility:{},records,populations:{records:{indices:[0,1,2,3],title:'All'}}};
const asset={populationRevision:'r',contexts:{'["records","60",1]':'ab','["records","60",2]':'ab',
 '["records","100",1]':'ab','["records","100",2]':'abc','["records","100",3]':'c'},
 fits:{ab:{profiles:[0,1],existingFit:'ab'},abc:fresh,c:{profiles:[2],coordinates:encode([[0,0,0]])}}};
const pack={combDisplay:{revision:'r',pureCores:{'60':['1,2'],'100':['1,2','2,3']}},pureVertexLocal:asset,
 participants:{'comb-V3V4-tx':{compositions:[[[0,.8],[1,.2]],[[0,.2],[1,.8]],[[1,.1],[2,.9]]]}}};
const ctx=vm.createContext({BUNDLE_PACK:pack,atob,recordExtension:()=>adapter,rebuiltOnlyPopulation:()=>true,
 sensitivityReferenceNode:n=>n,combDisplayKey:kind=>kind==='overview'?'population':'ab',
 combDisplayFit:key=>key==='population'?population:saved,
 decodeSavedCoordinates:f=>{const b=Buffer.from(f.coordinates,'base64');return f.profiles.map((_,i)=>[0,1,2].map(j=>b.readDoubleLE(i*24+j*8)))}});
vm.runInContext(fs.readFileSync(new URL('./control_excluded_views.js',import.meta.url),'utf8'),ctx);
ctx.bundle=bundle;
const view=vm.runInContext('materializeEligiblePureView(bundle,"all").data',ctx);
const local=view.vertexEmbeddings.fits['100_2'];
assert.equal(local.fittingScope,'local');assert.equal(local.n,4);
assert.deepEqual(JSON.parse(JSON.stringify(local.coords)),[[0,0,0],[0,0,0],[1,0,0],[0,1,0]]);
for(const anchor of view.vertexEndpointProjections['100_2'])assert.deepEqual(anchor.coords,local.coords[local.indices.indexOf(anchor.row)]);
assert.equal(view.vertexEmbeddings.fits['60_1'].fittingScope,'local');
assert.equal(view.vertexEmbeddings.fits['60_1'].coords[2][0],1);
assert.equal(view.overviewEmbeddings['100'].fittingScope,'population-restriction');
assert.equal(view.overviewEmbeddings['100'].coords[2][0],9);
// Older packages retain an honestly labelled fallback; no invalid local claim.
pack.pureVertexLocal=null;ctx.oldBundle={...bundle};
assert.equal(vm.runInContext('materializeEligiblePureView(oldBundle,"all").data.vertexEmbeddings.fits["100_2"].fittingScope',ctx),'population-restriction');
pack.pureVertexLocal=asset;asset.fits.abc={...fresh,profiles:[0,2]};ctx.badBundle={...bundle};
assert.throws(()=>vm.runInContext('materializeEligiblePureView(badBundle,"all").data.vertexEmbeddings.fits["100_2"]',ctx),/membership differs/);
console.log('PASS: new/reused local geometry, duplicate record mapping, local reference anchors, population overview, legacy fallback and membership rejection.');

// A cold named-view restore must fetch the reused pure vertex fit before render.
const fetched=[],named=vm.createContext({BUNDLE_PACK:{pureVertexLocal:asset},
 ensureDatasetLoaded:async()=>{},ensureSensitivityLoaded:async()=>{},rebuiltOnlyPopulation:()=>true,
 sensitivityBaseline:{display:{revision:'r',contexts:{}}},sensitivityVariants:new Map(),
 recordExtension:()=>adapter,datasetRegistry:new Map([['comb-V3V4-tx',bundle]]),
 ensurePreparedFit:async(id,role,key)=>fetched.push(key)});
vm.runInContext(fs.readFileSync(new URL('./named_views.js',import.meta.url),'utf8'),named);
await named.ensureNamedViewAssets({dataset:'comb-V3V4-tx',populationComparison:'rebuilt',stateMode:'pure',cohort:'all',coverage:'60',selection:{selectedVertex:1}});
assert.deepEqual(fetched,['ab']);
console.log('PASS: cold named-view restoration fetches the exact reused pure vertex fit.');
