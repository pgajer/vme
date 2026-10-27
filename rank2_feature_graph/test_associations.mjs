// On-demand tests; synthetic fixture contains no study records or actual results.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',querySelectorAll:()=>[]});return elements.get(id)};
const ctx=vm.createContext({console,el,esc:s=>String(s).replaceAll('<','&lt;'),META:{id:'zapps-pressmat-v4'},BUNDLE_PACK:{},setTimeout});
vm.runInContext(fs.readFileSync(new URL('associations.js',import.meta.url),'utf8'),ctx);
const bank={version:1,dataset:'zapps-pressmat-v4',outcome:'original-study-sptb',window:'approved-enrollment',annotation:'enrollment-merged-rank2',coverages:{}};
for(const [q,count] of [[60,7],[70,10],[80,17],[90,36]]){
 const r={coverage:q,actualCoverage:q+.5,graphId:'a'.repeat(64),partitionId:'b'.repeat(64),membershipSha256:'c'.repeat(64),testFamilySize:2*count,sourceRelease:'synthetic',sources:{},status:'Synthetic',nodes:[],edges:[],cohorts:{}};
 r.nodes=Array.from({length:count+1},(_,i)=>({id:String(i),name:'Taxon_'+i}));
 for(const [c,n,cases,m] of [['ZAPPS',100,20,80],['PreSSMat',120,30,100]])r.cohorts[c]={n,cases,matchedN:m,matchedCases:cases};
 for(let i=0;i<count;i++){
  const e={id:'state:'+i,name:'Taxon_0 + Taxon_'+(i+1),from:'0',to:String(i+1),results:{}};
  for(const [c,p] of Object.entries(r.cohorts))e.results[c]={all:{n:i?0:p.n,cases:i?0:p.cases,expected:i?0:p.cases},matched:{n:i?0:p.matchedN,cases:i?0:p.cases,expected:i?0:p.cases},exact:{supported:!i,sets:i?0:3,logOR:i?null:0,low:i?null:-1,high:i?null:1,p:i?null:1,holm:i?null:1,by:i?null:1}};
  r.edges.push(e);
 }
 bank.coverages[q]=r;
}
assert.equal(ctx.validateAssociationBank(bank),bank);
for(const mutate of [b=>b.dataset='other',b=>b.window='all-visits',b=>b.coverages['90'].edges.pop(),b=>b.coverages['70'].graphId='old',b=>b.coverages['60'].edges[0].results.ZAPPS.matched.n++,b=>b.coverages['80'].edges[0].results.ZAPPS.all.expected++,b=>b.coverages['90'].edges[0].results.ZAPPS.exact.p=2]){
 const bad=structuredClone(bank);mutate(bad);assert.throws(()=>ctx.validateAssociationBank(bad));
}
assert.equal(ctx.associationEffect({exact:{supported:false,logOR:0}},'matched'),null);
assert.equal(ctx.associationEffect({exact:{supported:true,logOR:'Infinity'}},'matched'),Infinity);
assert.equal(ctx.associationEffect({all:{n:1,cases:0,expected:.2}},'all'),-Infinity);
assert.equal(ctx.associationEffect({all:{n:0,cases:0,expected:0}},'all'),null);
assert.equal(ctx.associationOR('-Infinity'),0);assert.equal(ctx.associationOR('Infinity'),Infinity);
assert.equal(ctx.associationColor(null),'#a3abb0');assert.notEqual(ctx.associationColor(0),ctx.associationColor(null));
assert.equal(ctx.associationColor(Infinity),ctx.associationColor(30));
ctx.bank=bank;vm.runInContext("associationView.bank=bank;associationView.active=true",ctx);
const before=JSON.stringify(bank);
for(const q of ['60','70','80','90'])for(const mode of ['matched','all'])for(const cohort of ['both','ZAPPS','PreSSMat']){
 ctx.q=q;ctx.mode=mode;ctx.cohort=cohort;vm.runInContext('Object.assign(associationView,{coverage:q,mode,cohort});renderAssociations()',ctx);
 assert.match(el('associationScope').textContent,/all 220 women assigned/);
 assert.match(el('associationGraphs').innerHTML,/data-association-edge/);
 const csv=ctx.associationCSV().split('\r\n');assert.equal(csv.length,1+bank.coverages[q].edges.length*(cohort==='both'?2:1));
 assert(csv.every(line=>line.split(',').length===csv[0].split(',').length));
 if(mode==='all')assert(!el('associationTable').innerHTML.includes('Holm p'));
 else assert.match(el('associationMethod').textContent,/do not cover searching across coverage/);
}
assert.equal(JSON.stringify(bank),before,'Displaying/filtering results never changes the saved analysis');
const edge=bank.coverages['90'].edges[0];edge.results.ZAPPS.exact={supported:true,sets:3,logOR:'Infinity',low:0,high:'Infinity',p:.03,holm:1,by:1};
vm.runInContext("associationView.mode='matched';associationView.cohort='both';renderAssociations()",ctx);
assert.match(el('associationTable').innerHTML,/∞/);assert.match(el('associationComparison').innerHTML,/▶/);assert.match(el('associationComparison').innerHTML,/→/);
assert.equal(ctx.associationRows(bank.coverages['90'],['ZAPPS'],'NONEXISTENT').length,0);
console.log('Association schema, population/denominator isolation, all coverages/cohorts, unavailable and unbounded estimates, comparison rendering and CSV checks passed.');
// Optional local acceptance: the actual release is never required by public tests.
const actual=new URL('enrollment_associations.json',import.meta.url);
if(fs.existsSync(actual)){const real=JSON.parse(fs.readFileSync(actual));ctx.validateAssociationBank(real);assert.equal(Object.values(real.coverages).reduce((n,r)=>n+2*r.edges.length,0),140);console.log('Local saved 140-result supplement also validated.');}
