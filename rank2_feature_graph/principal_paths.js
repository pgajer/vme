// Descriptive full-composition fits, separate from the frozen reference graph and embedding.
let principalAsset=BUNDLE_PACK.principalPaths||null;
function principalHood(hood){
 if(!principalAsset||hood.anchor!=='Li'||hood.collection!==principalAsset.collection)return null;
 return principalAsset.neighborhoods.find(h=>h.size===hood.size)||null;
}
function principalContextKey(hood,model){return principalAsset.revision+'|'+hood.collection+'|'+hood.anchor+'|'+hood.size+'|'+model}
function principalDefaults(hood,s={}){
 const h=principalHood(hood),model=s.principalModel==='curve'?'curve':'tree',key=h?principalContextKey(hood,model):null;
 const same=s.principalContext===key&&key!==null,m=h?.models[model];
 return {principalEnabled:s.principalEnabled===true,principalModel:model,principalContext:key,
  principalPath:same&&m.branches.some(b=>b.branch===s.principalPath)?s.principalPath:null,
  principalProfile:same&&h.profileIds.includes(s.principalProfile)?s.principalProfile:null};
}
function principalModel(hood,s){
 const h=principalHood(hood);
 return h&&s.principalEnabled&&s.principalContext===principalContextKey(hood,s.principalModel)?h.models[s.principalModel]:null;
}
function principalLinked(hood,s,linked){
 const m=principalModel(hood,s);if(!m||s.principalPath===null)return linked;
 const mask=linked.mask.map((v,i)=>v&&m.assignments[i]===s.principalPath);
 return {...linked,active:true,mask,count:mask.filter(Boolean).length};
}
function principalReference(hood,s){return principalModel(hood,s)?{revision:principalAsset.revision,sourceRunSha256:principalAsset.sourceRunSha256}:null}
function principalValidateBookmark(bookmark,hood){
 const s=bookmark.selection;
 if(s.principalEnabled===undefined)return; // Older saved views retain their explicit size and camera.
 if(typeof s.principalEnabled!=='boolean'||!['curve','tree'].includes(s.principalModel))throw Error('Invalid saved principal-path controls');
 const d=principalDefaults(hood,s);
 if(d.principalContext!==s.principalContext||d.principalPath!==s.principalPath||d.principalProfile!==s.principalProfile)throw Error('Saved principal path or profile does not belong to this model and neighborhood');
 const expected=principalReference(hood,s);
 if(expected&&(bookmark.principalReference?.revision!==expected.revision||bookmark.principalReference?.sourceRunSha256!==expected.sourceRunSha256))throw Error('Saved principal-path release differs');
}
function principalErrorText(m,i){return `Path ${m.assignments[i]} · reconstruction error: total variation ${(100*m.tv[i]).toFixed(3)}%; Euclidean distance ${Math.sqrt(m.squared[i]).toFixed(5)} (abundance fractions)`}
function principalSummary(m,indices){return indices.length?{n:indices.length,rmse:Math.sqrt(indices.reduce((v,i)=>v+m.squared[i],0)/indices.length),tv:indices.reduce((v,i)=>v+m.tv[i],0)/indices.length}:{n:0,rmse:null,tv:null}}
function principalMixture(node){return node.map((value,i)=>[i,value]).sort((a,b)=>b[1]-a[1]).filter(v=>v[1]>0).slice(0,6).map(([i,v])=>`${principalAsset.features[i].replaceAll('_',' ')}: ${(100*v).toFixed(2)}%`).join('; ')}
function principalSvg(m,s){
 const x=m.positions.map(p=>p[0]),y=m.positions.map(p=>p[1]),width=330,height=210;
 const dx=Math.max(...x)-Math.min(...x),dy=Math.max(...y)-Math.min(...y),scale=Math.min(270/(dx||1),150/(dy||dx||1));
 const point=i=>[width/2+(x[i]-(Math.max(...x)+Math.min(...x))/2)*scale,height/2-(y[i]-(Math.max(...y)+Math.min(...y))/2)*scale];
 const li=principalAsset.features.indexOf('Lactobacillus_iners'),root=m.nodes.map(v=>v[li]).indexOf(Math.max(...m.nodes.map(v=>v[li])));
 const lines=m.branches.map(b=>`<g data-principal-path="${b.branch}" role="button" tabindex="0" aria-label="Highlight path ${b.branch}, ${b.compositions} profiles"><title>Path ${b.branch}: ${b.compositions} profiles; mean total variation ${(100*b.mean_tv).toFixed(2)}%</title><polyline points="${b.nodes.map(i=>point(i).join(',')).join(' ')}" fill="none" stroke="${s.principalPath===b.branch?'#c04812':'#4b7486'}" stroke-width="${s.principalPath===b.branch?5:3}"/><polyline points="${b.nodes.map(i=>point(i).join(',')).join(' ')}" fill="none" stroke="transparent" stroke-width="14"/></g>`).join('');
 const nodes=m.nodes.map((row,i)=>{const [a,b]=point(i);return `<g data-principal-node="${i}" role="button" tabindex="0" aria-label="Mixture at node ${i+1}"><title>Node ${i+1}: ${esc(principalMixture(row))}</title><circle cx="${a}" cy="${b}" r="10" fill="${i===root?'#ffe899':'#fff'}" stroke="#24414c"/><text x="${a}" y="${b+4}" text-anchor="middle" font-size="11" fill="#142e38">${i+1}</text></g>`}).join('');
 return `<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="Fitted ${s.principalModel} metro map">${lines}${nodes}</svg>`;
}
function syncPrincipalControls(){
 if(!activeEmbeddingFamily||!el('principalEnabled'))return;
 const {hood}=familyContext(),s=familySelection,h=principalHood(hood),m=h?.models[s.principalModel];
 el('principalEnabled').checked=!!h&&s.principalEnabled;el('principalEnabled').disabled=!h;
 el('principalModel').value=s.principalModel;el('principalModel').disabled=!h||!s.principalEnabled;
 el('principalPath').innerHTML='<option value="">All fitted paths</option>'+(m?m.branches.map(b=>`<option value="${b.branch}">${s.principalModel==='curve'?'Curve':'Path '+b.branch} · ${b.compositions.toLocaleString()} profiles</option>`).join(''):'');
 el('principalPath').value=s.principalPath??'';el('principalPath').disabled=!h||!s.principalEnabled;
 el('principalClear').disabled=!h||!s.principalEnabled;
 el('principalScope').textContent=h?'Saved fits in full taxon compositions. Path identities are local to the selected size and model.':'Available for the V3–V4 Li 2k, 4k and 8k neighborhoods only. No fitted layer is substituted for Lc or V4.';
 el('principalOpen4k').hidden=!!h;
 el('principalInformation').hidden=!h||!s.principalEnabled;
}
function renderPrincipalInformation(hood,s,linked){
 const m=principalModel(hood,s);if(!m||!el('principalMap'))return;
 const indices=linked.mask.flatMap((v,i)=>v?[i]:[]),summary=principalSummary(m,indices),b=m.branches.find(b=>b.branch===s.principalPath);
 el('principalMap').innerHTML=principalSvg(m,s);
 el('principalStatistics').textContent=`${s.principalModel==='tree'?'Tree':'Curve'} · ${hood.size/1000}k · ${summary.n.toLocaleString()} / ${hood.size.toLocaleString()} profiles highlighted. `+(summary.n?`Mean total variation ${(100*summary.tv).toFixed(3)}%; root mean squared Euclidean error ${summary.rmse.toFixed(5)}.`:'No profiles match both this path and the reference-graph selection; errors are unavailable.')+(b?` Full path: ${b.studies} studies, ${b.known_identity_units} recorded study–identity units (${b.missing_identity_records} records without an identity).`:'');
 el('principalNode').textContent='Click a numbered node to inspect its representative taxon mixture. Yellow marks the most Li-rich node.';
 el('principalReceipt').textContent=`Saved full-neighborhood fit, ${principalAsset.resultGenerated}. Ten nodes; edge penalty ${principalAsset.settings.edge_penalty}, junction penalty ${principalAsset.settings.star_penalty}. Release ${principalAsset.revision}.`;
}
function principalProfileTrace(hood,s,xyz,hover,key){
 if(!principalModel(hood,s)||s.principalProfile===null)return null;
 const i=hood.profileIds.indexOf(s.principalProfile);if(i<0)return null;
 return {type:'scatter3d',mode:'markers',x:[xyz[0][i]],y:[xyz[1][i]],z:[xyz[2][i]],ids:[hood.profileIds[i]],customdata:[i],text:[hover[i]],hovertemplate:'%{text}<extra></extra>',
 meta:{familyKey:key,familyPrincipalProfile:true},marker:{size:10,symbol:'circle-open',color:'#111111',line:{width:3},opacity:1},showlegend:false};
}
function principalChoosePath(value){
 const m=principalModel(familyContext().hood,familySelection),path=value===''||value===null?null:Number(value);
 if(!m||path!==null&&!m.branches.some(b=>b.branch===path))throw Error('Path unavailable in this model');
 familySelection.principalPath=path;familySelection.principalProfile=null;syncFamilySelectors();return renderFamily(familyCamera());
}
function principalCSV(hood,s,linked){
 const m=principalModel(hood,s);if(!m)throw Error('No principal model selected');
 const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
 const rows=[['fit_revision','collection','neighborhood_size','model','profile_id','path','total_variation_fraction','euclidean_distance_fraction','highlighted','selected_profile'],
  ...hood.profileIds.map((id,i)=>[principalAsset.revision,hood.collection,hood.size,s.principalModel,id,m.assignments[i],m.tv[i],Math.sqrt(m.squared[i]),linked.mask[i],s.principalProfile===id])];
 return rows.map(r=>r.map(quote).join(',')).join('\n');
}
function installPrincipalPaths(){
 if(!el('familySidebarControls'))return;
 const section=document.createElement('details');section.className='controlSection';section.open=true;section.id='principalControls';
 section.innerHTML='<summary>Descriptive Li paths</summary><div class="sectionControls"><label><input id="principalEnabled" type="checkbox"> Show fitted paths</label><label>Fitted model<select id="principalModel"><option value="tree">Branching tree</option><option value="curve">Unbranched curve</option></select></label><label>Highlight profiles on<select id="principalPath"><option value="">All fitted paths</option></select></label><button id="principalClear">Clear path / profile</button><small id="principalScope"></small><button id="principalOpen4k">Open V3–V4 Li 4k paths</button></div>';
 el('familySidebarControls').querySelector('details').after(section);
 const info=document.createElement('details');info.open=true;info.id='principalInformation';
 info.innerHTML='<summary>Fitted paths and reconstruction</summary><p id="principalStatistics"></p><div id="principalMap"></div><p id="principalNode"></p><small>Click a path to highlight its profiles. This metro map is separate from the saved embedding: it preserves relative edge lengths within this fit, with equal angles at junctions.</small><p>Paths describe observed mixtures, not validated biological transitions. Changing size or model clears the path selection. Reference-graph selections intersect the path highlight; unselected profiles can remain dimmed.</p><details><summary>What the errors mean</summary><p>Total variation is half the sum of absolute differences between an observed mixture and its closest Euclidean point on the fitted model, shown as a percentage. Euclidean error uses abundance fractions. The summary averages equally across highlighted distinct profiles, not participants or studies. These are full-data reconstruction errors, not held-out prediction scores. Smaller is closer; no pass/fail threshold is implied.</p></details><small id="principalReceipt"></small><button id="principalCSV">Export profile reconstruction errors CSV</button>';
 el('familyInformation').prepend(info);
 const style=document.createElement('style');style.textContent='#principalMap svg{display:block;width:100%;min-height:150px;max-height:250px}#principalMap [role=button]{cursor:pointer}#principalMap [role=button]:focus{outline:2px solid #c04812}#principalControls small{white-space:normal}';document.head.appendChild(style);
 const report=e=>{el('familyStatus').textContent=e.message||String(e)};
 el('principalEnabled').onchange=()=>{familySelection.principalEnabled=el('principalEnabled').checked;syncFamilySelectors();renderFamily(familyCamera()).catch(report)};
 el('principalModel').onchange=()=>{Object.assign(familySelection,principalDefaults(familyContext().hood,{...familySelection,principalModel:el('principalModel').value}));syncFamilySelectors();renderFamily(familyCamera()).catch(report)};
 el('principalPath').onchange=()=>principalChoosePath(el('principalPath').value).catch(report);
 el('principalClear').onclick=()=>principalChoosePath(null).catch(report);
 el('principalOpen4k').onclick=()=>{familySelection=familyDefaults(activeEmbeddingFamily,{...familySelection,anchor:'Li',collection:'comb-V3V4-tx',size:4000,principalEnabled:true,principalContext:null});syncFamilySelectors();prepareFamilyGraph().catch(report)};
 const activate=event=>{const path=event.target.closest('[data-principal-path]'),node=event.target.closest('[data-principal-node]');if(path)principalChoosePath(path.dataset.principalPath).catch(report);if(node){const m=principalModel(familyContext().hood,familySelection),i=Number(node.dataset.principalNode);if(m?.nodes[i])el('principalNode').textContent=`Node ${i+1}: ${principalMixture(m.nodes[i])}. Leading six taxa; all taxa remain in the fit.`}};
 el('principalMap').onclick=activate;el('principalMap').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e)}};
 el('principalCSV').onclick=()=>{try{const {hood}=familyContext();const linked=principalLinked(hood,familySelection,familyGraphMembership(hood,familyGraphState()));familyDownload(`Li-${hood.size}-${familySelection.principalModel}-reconstruction.csv`,principalCSV(hood,familySelection,linked),'text/csv')}catch(e){report(e)}};
}
