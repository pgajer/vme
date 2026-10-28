// Optional saved face rotations: the renderer never refits or changes membership.
function unfoldedAsset(){
 const bank=BUNDLE_PACK.datasetUnfoldedEmbeddings?.[META.id];
 return bank?.version===1&&bank.dataset===META.id&&bank.baseRevision===META.revision&&bank.analysisRevision===BUNDLE_PACK.participants?.[META.id]?.analysisRevision?bank:null;
}
const unfoldedDecoded=new WeakMap();
function unfoldedEntry(method=maxNormalizedMethod()){
 if(method!=='maxnorm-euclidean'||selectedVertex===null||participant.active||rank3UsesSamples()||candidateActive()||pureCoverageActive())return null;
 const bank=unfoldedAsset(),key=bank?.contexts[datasetMaxNormalizedContext('vertex',selectedVertex)],source=key&&bank.fits[key+':euclidean'];
 if(!source)return null;
 if(source.anchor!==selectedVertex-1)throw Error('Unfolded fit anchor differs from the selected vertex.');
 let fit=unfoldedDecoded.get(source);
 if(!fit){fit={...source,coordinates:decodeSavedCoordinates(source),label:'Max-normalized Euclidean · Unfolded faces',unfolded:true};unfoldedDecoded.set(source,fit)}
 return fit;
}
function unfoldedEnabled(){return el('unfoldFaces')?.checked===true&&!!unfoldedEntry()}
function syncUnfoldedControls(){
 const selection=selectedVertex!==null||selected!==null;
 const local=selection&&!participant.active&&!rank3UsesSamples()&&!candidateActive()&&!pureCoverageActive()&&sampleUsesLocalFit();
 const fit=local?localSelectionFit():null,visible=!!fit&&fit.fittingScope!=='population-restriction';
 const available=visible&&!!unfoldedEntry(),checked=available&&el('unfoldFaces').checked;
 const unavailable=maxNormalizedMethod()!=='maxnorm-euclidean'?'Unfolding requires Max-normalized · Euclidean and a matching saved unfolded fit.':
  selectedVertex===null?'No unfolded fit has been supplied for this edge view.':
  'No matching unfolded fit has been supplied for this vertex, cohort, state mode and coverage.';
 for(const id of ['unfoldFaces','panelUnfoldFaces']){
  const control=el(id);if(!control)continue;control.disabled=!available;control.checked=checked;
  if(id==='unfoldFaces')control.parentElement.hidden=!visible;
  control.parentElement.title=available?'Rotate neighboring dominant faces around this vertex’s face, then use the saved local Euclidean 3D fit. Off restores the ordinary fit. Samples and colors stay the same. Cuts between other faces remain.':unavailable;
 }
}
function installUnfoldedControls(){
 for(const id of ['unfoldFaces','panelUnfoldFaces'])el(id).onchange=()=>{
  const checked=el(id).checked;
  if(!unfoldedEntry()){syncUnfoldedControls();return}
  // The browser has already changed the clicked control. Record the old view.
  el('unfoldFaces').checked=!checked;rememberSelection();
  for(const other of ['unfoldFaces','panelUnfoldFaces'])el(other).checked=checked;
  return refreshSamples();
 };
}
function unfoldedStressRows(rows,anchor){
 return rows.map(row=>{
  const maximum=Math.max(...row.map(v=>v[1]));if(!(maximum>0))throw Error('Empty unfolded composition');
  const normalized=row.map(([k,v])=>[k,v/maximum]).sort((a,b)=>a[0]-b[0]);
  const anchorValue=normalized.find(([k])=>k===anchor)?.[1]||0;
  const dominant=anchorValue===1?anchor:normalized.find(([,v])=>v===1)[0];
  return normalized.filter(([k])=>k!==anchor).map(([k,v])=>[k,k===dominant&&dominant!==anchor?2-anchorValue:v]);
 });
}
function unfoldedStress(view,ordered,rows){
 const positions=new Map(view.profiles.map((p,i)=>[p,view.coordinates[i]]));
 if(ordered.some(p=>!positions.get(p.profile)?.every((v,k)=>v===p.xyz[k])))throw Error('Displayed coordinates differ from the unfolded fit.');
 const all=ordered.length===positions.size&&ordered.every(p=>positions.has(p.profile));
 const result=all?view.evaluation:cachedEmbeddingStress(JSON.stringify([unfoldedAsset().revision,view.anchor,ordered]),()=>evaluateEmbeddingStress(unfoldedStressRows(rows,view.anchor),ordered.map(p=>p.xyz)));
 setEmbeddingStress('sampleStress',result,'Target: Euclidean distances after rotating dominant faces onto the selected vertex’s face and dropping its constant coordinate. No stretching. Distances within each face are preserved; cuts between different neighboring faces remain. This is not a global surface-geodesic distance. Evaluated on displayed distinct profiles, excluding reference markers. The ordinary and unfolded fits have different targets; their stress scores are not a common method ranking.');
 return true;
}
