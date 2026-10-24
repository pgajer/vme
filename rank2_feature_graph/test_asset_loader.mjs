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
