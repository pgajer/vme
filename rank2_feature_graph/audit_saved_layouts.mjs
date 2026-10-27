// Optional exhaustive audit of stored comb-V3V4-tx layouts, without refitting.
// Imported only by the explicit --audit-layouts mode of verify_http_assets.mjs.
export async function auditSavedLayouts(run){
await run('ensureAllPreparedFits("comb-V3V4-tx","combDisplay",BUNDLE_PACK.combDisplay)');
return run(`(()=>{
 const bundle=datasetRegistry.get('comb-V3V4-tx'),asset=BUNDLE_PACK.combDisplay,records=recordExtension(bundle).records,compositions=participantData().compositions;
 const originalFit=combDisplayFit,calls=[];combDisplayFit=key=>{calls.push(key);return originalFit(key)};
 combDisplayViews.clear();combDisplayDecoded.clear();
 let initial;try{initial=materializeCombDisplay(bundle,'all','merged','60').data}finally{combDisplayFit=originalFit}
 const overview=combDisplayKey('overview','records',null,null);
 if(calls.some(key=>key!==overview))throw Error('Unselected local layouts were prepared eagerly');
 const first=Object.keys(initial.localEmbeddings)[0],key=combDisplayKey('group','records',60,first);
 if(!Object.getOwnPropertyDescriptor(initial.localEmbeddings,first).get)throw Error('Missing lazy local layout');
 combDisplayFit=k=>{if(k===key)throw Error('Test-only failed preparation');return originalFit(k)};
 try{try{initial.localEmbeddings[first];throw Error('Failed layout was accepted')}catch(e){if(e.message!=='Test-only failed preparation')throw e}}finally{combDisplayFit=originalFit}
 const restored=initial.localEmbeddings[first];if(initial.localEmbeddings[first]!==restored)throw Error('Prepared layout was not reused');
 let views=0,layouts=0,anchors=0;
 const pops=[...new Set(Object.keys(asset.contexts).map(k=>JSON.parse(k)).filter(k=>k[0]==='overview').map(k=>k[1]))];
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function check(f,refs){
  layouts++;const source=asset.fits[f.key],coords=decodeSavedCoordinates(source),positions=new Map(source.profiles.map((p,i)=>[p,coords[i]]));
  if(!equal(f.coords,f.indices.map(i=>positions.get(records[i].profile)))||f.n!==f.indices.length)throw Error('Local saved geometry or membership differs');
  for(const a of refs){anchors++;let best=0,maximum=-1;f.indices.forEach((i,k)=>{const value=compositions[records[i].profile].find(v=>v[0]===a.feature-1)?.[1]??0;if(value>maximum){best=k;maximum=value}});
   if(a.row!==f.indices[best]||a.id!==records[a.row].id||a.maximum!==maximum||!equal(a.coords,f.coords[best])||a.member!==true||a.relative_error!==0)throw Error('Observed endpoint maximum differs');
  }
 }
 for(const pop of pops)for(const q of Object.keys(asset.merged)){
  const d=materializeCombDisplay(bundle,pop,'merged',q).data;views++;
  for(const [state,f] of Object.entries(d.localEmbeddings)){check(f,d.endpointProjections[state]);if(!equal(d.pcaDimensions[state],{n:f.n,...f.pca}))throw Error('PCA summary differs')}
  for(const [key,f] of Object.entries(d.vertexEmbeddings.fits)){if(!Object.values(d.vertexEmbeddings.mapping).includes(key))throw Error('Vertex mapping differs');check(f,d.vertexEndpointProjections[key])}
  check(d.overviewEmbeddings[q],d.overviewEndpointProjections[q]);
 }
 const rows=rank3Base(bundle).rows,ordered=rows.slice().sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
 if(!equal(rows.map(r=>r.id),ordered.map(r=>r.id)))throw Error('Numeric rank-3 order differs');
 const index=bundle.cohortAnalysis.eligibleProfiles[0],bad={...bundle,data:{...bundle.data,sampleTopFeatures:bundle.data.sampleTopFeatures.slice()}};
 bad.data.sampleTopFeatures[index]=[['Unrecognized test feature',100]];
 try{rank3Base(bad);throw Error('Invalid rank-3 feature accepted')}catch(e){if(!e.message.includes('Unrecognized rank-3 feature'))throw e}
 return {views,layouts,anchors,rank3States:rows.length,lazyRetry:true};
})()`);
}
