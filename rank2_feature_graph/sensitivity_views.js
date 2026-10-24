// One dataset, three explicit comparison populations; baseline is never mutated.
let activeSensitivityMode='baseline',sensitivityBaseline=null;
function defaultPopulationComparison(id){
 return id==='comb-V3V4-tx'&&(BUNDLE_PACK.sensitivityComparisons?.rebuilt||
  typeof VME_ASSETS!=='undefined'&&VME_ASSETS.manifest.sensitivity)?'rebuilt':'baseline';
}
const sensitivityVariants=new Map();
function initializeSensitivityState(){
 if(!BUNDLE_PACK.combDisplay)return;
 const id='comb-V3V4-tx',bundle=datasetRegistry.get(id);
 if(!sensitivityBaseline){
 sensitivityBaseline={bundle,display:BUNDLE_PACK.combDisplay};
 for(const field of ['recordAdapters','participants','qualityReadDepths','valencia2','trajectoryReferences'])
  sensitivityBaseline[field]=BUNDLE_PACK[field][id];
 }
 for(const [mode,item] of Object.entries(BUNDLE_PACK.sensitivityComparisons||{})){
  if(sensitivityVariants.has(mode))continue;
  const d=item.display,r=item.records,b={...bundle,data:{...bundle.data}};
  if(item.referenceOverride){
   b.data.graphs={...b.data.graphs,'100':item.referenceOverride.graph};
   b.data.coords3d={...b.data.coords3d,'100':item.referenceOverride.coords};
  }
  // Preserve the dataset identity; the analysis and display revisions identify the comparison.
  installCombDisplay({...BUNDLE_PACK,bundles:[b],combDisplay:d,
   recordAdapters:{[id]:r.adapter},participants:{[id]:r.participants}});
  const ids=new Set(r.adapter.records.map(r=>r.id));
  sensitivityVariants.set(mode,{bundle:b,display:d,recordAdapters:r.adapter,participants:r.participants,
   qualityReadDepths:r.quality,valencia2:{...sensitivityBaseline.valencia2,
    records:sensitivityBaseline.valencia2.records.filter(r=>ids.has(r.id)),eligibilityRevision:d.revision},
   trajectoryReferences:item.trajectoryReference});
 }
 el('populationComparison').onchange=()=>changeSensitivity(el('populationComparison').value)
  .catch(error=>{syncSensitivityControls();datasetMessage(error.message)});
}
function selectSensitivityData(mode){
 if(!sensitivityBaseline){if(mode!=='baseline')throw Error('Sensitivity views are not provisioned');return}
 const item=mode==='baseline'?sensitivityBaseline:sensitivityVariants.get(mode);
 if(!item)throw Error('Unknown population comparison');
 const id='comb-V3V4-tx';
 datasetRegistry.set(id,item.bundle);BUNDLE_PACK.combDisplay=item.display;
 for(const field of ['recordAdapters','participants','qualityReadDepths','valencia2','trajectoryReferences'])
  BUNDLE_PACK[field][id]=item[field];
 activeSensitivityMode=mode;
 combDisplayDecoded.clear();combDisplayViews.clear();
 graphLayoutCache.clear();subjectEmbeddingCache.clear();subjectEmbeddingDecoded.clear();
 participantGraphCache=null;
}
function syncSensitivityControls(){
 const control=el('populationComparisonControl');
 control.hidden=!sensitivityBaseline||META.id!=='comb-V3V4-tx'||!!activeEmbeddingFamily;
 el('populationComparison').value=activeSensitivityMode;
}
function sensitivityPaletteEdges(bundle){
 // Keep shared pair identities visually comparable when rebuilt edges disappear.
 return (sensitivityBaseline&&bundle.dataset.id==='comb-V3V4-tx'?
  sensitivityBaseline.bundle:bundle).data.graphs['100'].edges;
}
async function changeSensitivity(mode){
 const revision=++datasetSwitchRevision;
 // Returning to the displayed population must cancel a queued earlier change.
 if(mode===activeSensitivityMode){syncSensitivityControls();return}
 await loadForSelection(()=>ensureSensitivityLoaded(mode),revision,()=>changeSensitivity(mode));
 if(revision!==datasetSwitchRevision)return;
 ++participantOpenRevision;
 await Promise.all([queue,graphQueue,trajectoryQueue]);
 if(revision!==datasetSwitchRevision)return;
 const q=el('coverage').value,cohort=activeCohort,state=activeStateMode,camera=readCamera('samples')||defaultCamera;
 const previous=activeSensitivityMode;
 let view;
 try{selectSensitivityData(mode);view=materializeAnalysis(datasetRegistry.get('comb-V3V4-tx'),cohort,state,q)}
 catch(error){selectSensitivityData(previous);throw error}
 participant.active=false;participant.key='';participant.record=null;
 DATA=view.data;META=view.meta;resetDatasetSelection();datasetPresentation(q);
 draw(camera);await Promise.all([queue,graphQueue,trajectoryQueue]);
}
// The fixed-reference experiment keeps baseline graph weights and maxima.
// This wrapper leaves the checksum-bound numerical producer unchanged.
const sensitivityOriginalGraphInput=graphLayoutInput;
graphLayoutInput=function(bundle=datasetRegistry.get(META.id),...args){
 const fixed=sensitivityVariants.get('fixed');
 if(fixed&&bundle.dataset.id==='comb-V3V4-tx'&&bundle.cohortAnalysis?.displayRevision===fixed.display.revision)
  return sensitivityOriginalGraphInput(sensitivityBaseline.bundle,...args);
 return sensitivityOriginalGraphInput(bundle,...args);
};
const sensitivityOriginalTrajectoryReference=trajectoryReference;
trajectoryReference=function(bundle,data,...args){
 const fixed=sensitivityVariants.get('fixed');
 if(fixed&&bundle.dataset.id==='comb-V3V4-tx'&&bundle.cohortAnalysis?.displayRevision===fixed.display.revision)
  return sensitivityOriginalTrajectoryReference(sensitivityBaseline.bundle,sensitivityBaseline.participants,...args);
 return sensitivityOriginalTrajectoryReference(bundle,data,...args);
};
function sensitivityReferenceNode(n,records,referenceRecords,mode){
 const row=referenceRecords.get(n.anchor_row);
 if(row===undefined){
  if(mode!=='fixed')throw Error('Reference maximum is not eligible');
  return {...n,anchor_row:null,anchor_id:n.anchor_id+' (external baseline reference)',externalReference:true};
 }
 return {...n,anchor_row:row,anchor_id:records[row].id};
}
const sensitivityOriginalGraphNote=updateGraphLayoutNote;
updateGraphLayoutNote=function(){
 sensitivityOriginalGraphNote();
 if(META.id!=='comb-V3V4-tx'||activeSensitivityMode==='baseline')return;
 const fixed=activeSensitivityMode==='fixed';
 el('graphLayoutSummary').textContent+=' · '+(fixed?'Fixed-reference sensitivity':'Rebuilt-reference sensitivity');
 el('graphGeometryNote').textContent+=(fixed?
  ' This comparison keeps baseline graph weights and reference vertices fixed: graph proportions use the 25,013-record baseline (24,960 distinct profiles in pure mode), although the displayed sample population has 24,465 records. External baseline references are not plotted as retained samples.':
  ' This comparison rebuilds reference weights and maxima from 24,465 retained records (24,412 distinct profiles in pure mode).')+
  ' The exclusion concerns VALENCIA2 reference-matched abundance, not sequencing depth or proven nonvaginal origin.';
};
const sensitivityOriginalGraphHover=graphLayoutHover;
graphLayoutHover=function(edge){
 const text=sensitivityOriginalGraphHover(edge);
 return META.id==='comb-V3V4-tx'&&activeSensitivityMode==='fixed'?text.replace('Whole dataset:','Fixed baseline reference:'):text;
};
