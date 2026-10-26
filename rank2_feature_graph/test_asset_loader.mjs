import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
const context=vm.createContext({TextDecoder,Uint8Array,crypto:webcrypto});
vm.runInContext(fs.readFileSync(new URL('asset_loader.js',import.meta.url),'utf8'),context);
const {createLoader}=context.VMEAssetLoader;
const plain=x=>JSON.parse(JSON.stringify(x));
const bodies=new Map();
async function descriptor(value){const bytes=new TextEncoder().encode(JSON.stringify(value)),sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');const d={url:'/vme-assets/'+sha256+'.json',sha256,bytes:bytes.length};bodies.set(d.url,bytes);return d}
const a=await descriptor({bundles:[{dataset:{id:'a'}}],subjectEmbeddings:{contexts:{a:'one'}}}),fit=await descriptor({subjectEmbeddings:{fits:{one:{coords:[[1,2,3]]}}}}),b=await descriptor({bundles:[{dataset:{id:'b'}}]});
const manifest={version:1,datasets:{a:{parts:[a,fit],deferred:{subjectEmbeddings:{parts:[fit]}}},b:{parts:[b]}}};
const requests=[];let active=0,maximum=0,fail=false,corrupt=false;
const request=async url=>{requests.push(url);active++;maximum=Math.max(maximum,active);await new Promise(r=>setTimeout(r,2));active--;const bytes=bodies.get(url);return {ok:!fail,status:fail?503:200,arrayBuffer:async()=>{const copy=bytes.slice();if(corrupt)copy[0]^=1;return copy.buffer}}};
const loader=createLoader(manifest,request);let checks=0;
const [first,second]=await Promise.all([loader.dataset('a',()=>checks++),loader.dataset('a',()=>checks++)]);
assert.equal(first,second);assert.equal(checks,1);assert.equal(requests.length,2);assert(!requests.includes(b.url));
assert.deepEqual(plain(first.subjectEmbeddings),{contexts:{a:'one'},fits:{one:{coords:[[1,2,3]]}}});
assert.equal(await loader.dataset('a'),first);assert.equal(requests.length,2);
fail=true;await assert.rejects(loader.dataset('b'),/503/);assert(!loader.loaded.has('dataset:b'));
fail=false;corrupt=true;await assert.rejects(loader.dataset('b'),/checksum/);assert(!loader.loaded.has('dataset:b'));
corrupt=false;await assert.rejects(loader.dataset('b',()=>{throw Error('invalid membership')}),/invalid membership/);assert(!loader.loaded.has('dataset:b'));
await loader.dataset('b',()=>checks++);assert(loader.loaded.has('dataset:b'));assert.equal(checks,2);
await assert.rejects(loader.dataset('unknown'),/not in the current release/);
const parts=await Promise.all(Array.from({length:13},(_,i)=>descriptor({['x'+i]:i})));
await loader.group('many',{parts});assert(maximum<=4);
const bad=createLoader({version:1,datasets:{bad:{parts:[{...a,bytes:a.bytes+1}]}}},request);
await assert.rejects(bad.dataset('bad'),/Incomplete/);
console.log('PASS: lazy requests, exact merge, single admission, concurrent deduplication, bounded fetches, checksum/length/HTTP/validation failure, retry, unknown dataset');

const n=requests.length;const [chunk1,chunk2]=await Promise.all([loader.fitChunk('a','subjectEmbeddings',0),loader.fitChunk('a','subjectEmbeddings',0)]);assert.equal(chunk1,chunk2);assert.equal(requests.length,n+1);
const {mergePack}=context.VMEAssetLoader;const source={subjectEmbeddings:{fits:{one:{coords:[1]}}}};const target={};mergePack(target,source);mergePack(target,{subjectEmbeddings:{fits:{two:{coords:[2]}}}});assert.deepEqual(Object.keys(source.subjectEmbeddings.fits),['one'],'Public merge must not mutate previous sources');
console.log('PASS: deferred fit requests deduplicated and public merge preserves source ownership');

// Startup and later dataset activation resolve the same stored comparison fits.
const deferred=await descriptor({combDisplay:{fits:{shared:{coordinates:'saved baseline'}}}});
const sensitivity=await descriptor({sensitivityFitPool:{changed:{coordinates:'saved refit'}},sensitivityComparisons:{rebuilt:{display:{fitKeys:['shared','changed']}}}});
const comparisonLoader=createLoader({version:1,datasets:{'comb-V3V4-tx':{deferred:{combDisplay:{parts:[deferred]}}}},sensitivity:{parts:[sensitivity]}},request);
const baseline={combDisplay:{fits:{overview:{coordinates:'overview'}},deferredFits:{shared:0}}};
const prepared=await comparisonLoader.prepareSensitivity(baseline);
assert.deepEqual(plain(prepared.sensitivityComparisons.rebuilt.display.fits),{shared:{coordinates:'saved baseline'},changed:{coordinates:'saved refit'}});
assert.deepEqual(Object.keys(baseline.combDisplay.fits),['overview'],'Default activation must not mutate the baseline');
const afterPrepare=requests.length;await comparisonLoader.prepareSensitivity(baseline);assert.equal(requests.length,afterPrepare);
assert.equal(comparisonLoader.loaded.get('sensitivity').sensitivityComparisons.rebuilt.display.fits,undefined,'Cached comparison metadata stays immutable');
const missing=await descriptor({sensitivityComparisons:{rebuilt:{display:{fitKeys:['absent']}}}});
await assert.rejects(createLoader({version:1,datasets:{},sensitivity:{parts:[missing]}},request).prepareSensitivity({combDisplay:{fits:{}}}),/Missing sensitivity fit/);
console.log('PASS: rebuilt startup fit resolution, baseline immutability, cached reuse and missing-fit rejection.');

// Dataset import is the last menu action, never a dataset identity.
{
 const source=fs.readFileSync(new URL('datasets.js',import.meta.url),'utf8');
 const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:''});return nodes.get(id)};
 let opened=0;const switches=[];
 const c=vm.createContext({el,esc:String,datasetDisplayTitle:m=>m.title,datasetRegistry:new Map([['a',{dataset:{id:'a',title:'A'}}]]),embeddingFamilyRegistry:new Map([['family',{id:'family',title:'Neighborhoods'}]]),activeEmbeddingFamily:null,META:{id:'a'}});
 c.switchDataset=async id=>{switches.push(id);if(id==='bad')throw Error('Could not load dataset');c.META.id=id;c.updateDatasetChoices()};
 c.registerDataset=async b=>{c.datasetRegistry.set(b.dataset.id,b);await c.switchDataset(b.dataset.id)};
 el('datasetFile').click=()=>{opened++;assert.equal(el('datasetSelect').value,c.activeEmbeddingFamily?.id||c.META.id);assert.equal(el('panelDatasetSelect').value,el('datasetSelect').value)};
 vm.runInContext(source.slice(source.indexOf('function updateDatasetChoices('),source.indexOf('function datasetPresentation(')),c);
 vm.runInContext(source.slice(source.indexOf('function datasetMessage('),source.indexOf('const initialDatasetView=')),c);
 c.updateDatasetChoices();assert.match(el('datasetSelect').innerHTML,/<option value="">Load dataset bundle…<\/option>$/);
 assert.equal(el('datasetSelect').innerHTML,el('panelDatasetSelect').innerHTML);
 for(const id of ['datasetSelect','panelDatasetSelect']){el(id).value='';await el(id).onchange();el('datasetFile').files=[];await el('datasetFile').onchange()}
 assert.equal(opened,2);assert.deepEqual(switches,[]);assert.equal(c.META.id,'a');
 c.activeEmbeddingFamily={id:'family'};el('datasetSelect').value='';await el('datasetSelect').onchange();assert.equal(el('datasetSelect').value,'family');c.activeEmbeddingFamily=null;c.updateDatasetChoices();
 el('datasetFile').files=[{name:'invalid.json',text:async()=>'{invalid'}];await el('datasetFile').onchange();assert.equal(c.META.id,'a');assert(el('datasetMessage').textContent);assert.equal(el('datasetFile').value,'');
 el('datasetFile').files=[{name:'valid.json',text:async()=>JSON.stringify({dataset:{id:'b',title:'B'}})}];await el('datasetFile').onchange();assert.equal(c.META.id,'b');assert.equal(el('panelDatasetSelect').value,'b');assert.match(el('datasetSelect').innerHTML,/<option value="">Load dataset bundle…<\/option>$/);
 el('panelDatasetSelect').value='bad';await el('panelDatasetSelect').onchange();assert.equal(el('panelDatasetSelect').value,'b');assert.equal(el('datasetMessage').textContent,'Could not load dataset');
 console.log('PASS: import action last in both selectors; picker/cancel preserves dataset or neighborhood; invalid files and failed switches retain selection; successful import updates both menus.');
}
