// Whole-composition threshold summaries; never change classifications or values.
function trajectoryStackedComposition(m,settings){
 const q=(settings.massThreshold??95)/100,scope=settings.massScope??'visit',points=m.points;
 const totals=new Map();for(const p of points)for(const [id,value] of p.p.values)totals.set(id,(totals.get(id)||0)+value);
 const ranked=[...totals].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
 const selected=new Map(),global=new Set(),mass=points.map(()=>0);
 if(scope==='global'){
  // A prefix of descending mean abundance, equally weighting observations.
  // Complete boundary ties avoid arbitrary taxon selection at equal abundance.
  for(let i=0;i<ranked.length;i++){
   const [id]=ranked[i];global.add(id);points.forEach((p,j)=>mass[j]+=p.p.values.get(id)||0);
   if(q<1&&mass.every(v=>v+1e-12>=q)&&ranked[i+1]?.[1]!==ranked[i][1])break;
  }
 }
 for(const p of points){
  const ids=scope==='global'?new Set(global):new Set();let covered=0;
  if(scope==='visit'){
   const order=[...p.p.values].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
   for(let i=0;i<order.length;i++){const [id,v]=order[i];ids.add(id);covered+=v;if(q<1&&covered+1e-12>=q&&order[i+1]?.[1]!==v)break}
  }else for(const id of ids)covered+=p.p.values.get(id)||0;
  selected.set(p.r.index,{ids,mass:covered,other:Math.max(0,1-covered)});
 }
 const used=new Set([...selected.values()].flatMap(s=>[...s.ids]));
 return {selected,ids:ranked.map(([id])=>id).filter(id=>used.has(id)),threshold:100*q,scope};
}
function trajectoryStackedDescription(settings=trajectorySettings){
 return (settings.massScope==='global'?'Global: one shared set, ranked by mean abundance across this participant’s observations, covers at least ':'Visit: independently ranked phylotypes cover at least ')+(settings.massThreshold??95)+'% at every observation. Boundary ties are included. Gray: Other phylotypes; each bar totals 100%, without renormalization. Unordered observations contribute to Global selection but remain listed separately.';
}
function trajectoryStackedExportDescription(){
 const lines=[''];for(const word of trajectoryStackedDescription().split(' ')){if(lines.at(-1).length+word.length>80)lines.push('');lines[lines.length-1]+=(lines.at(-1)?' ':'')+word}
 return lines.map(esc).join('<br>');
}
function trajectoryStackedSelected(p,bundle,summary){
 const row=summary.selected.get(p.r.index);
 return p.r.label+' · '+row.ids.size+' selected phylotypes · '+(100*row.mass).toFixed(2)+'% displayed mass · '+(100*row.other).toFixed(2)+'% Other phylotypes'+(p.x===null?' · Unordered; listed separately':'');
}
function trajectoryStackedChart(m,bundle,settings,selected,summary=trajectoryStackedComposition(m,settings)){
 const ordered=m.points.filter(p=>Number.isFinite(p.x)),traces=[],shapes=[],annotations=[],positions=new Map();
 const times=[...new Set(ordered.map(p=>p.x))].sort((a,b)=>a-b),gap=times.length>1?Math.min(...times.slice(1).map((x,i)=>x-times[i])):1,slot=Math.min(1,gap)*.72;
 const counts=new Map(),seen=new Map();ordered.forEach(p=>counts.set(p.x,(counts.get(p.x)||0)+1));
 for(const p of ordered){const n=counts.get(p.x),j=seen.get(p.x)||0;seen.set(p.x,j+1);positions.set(p.r.index,{x:p.x+slot*((j+.5)/n-.5),width:slot/n*.92*(settings.barWidth??100)/100})}
 if(settings.showEndpointGuides)for(const percent of [0,20,40,60,80,100])shapes.push({name:'stacked-abundance-guide',type:'line',xref:'paper',x0:0,x1:1,yref:'y',y0:percent,y1:percent,layer:'below',line:{color:settings.endpointGuideColor,width:settings.endpointGuideWidth},opacity:settings.endpointGuideOpacity});
 const bases=ordered.map(()=>0);
 const visibleIds=summary.ids.filter(id=>ordered.some(p=>summary.selected.get(p.r.index).ids.has(id)&&(p.p.values.get(id)||0)>0));
 for(const id of [...visibleIds,null]){
  const other=id===null,name=other?'Other phylotypes':bundle.data.featureNames[id],values=ordered.map(p=>{const row=summary.selected.get(p.r.index);return 100*(other?row.other:row.ids.has(id)?p.p.values.get(id)||0:0)});
  if(other&&!values.some(v=>v>1e-10))continue;
  traces.push({type:'bar',name:other?name:taxonDisplayLabel(name),meta:{trajectoryStackedTaxon:id,trajectoryStacked:true},x:ordered.map(p=>positions.get(p.r.index).x),y:values,base:[...bases],width:ordered.map(p=>positions.get(p.r.index).width),customdata:ordered.map(p=>p.r.index),
   marker:{color:other?'#8c8c8c':trajectoryTaxonColor(name,settings),line:{width:0}},showlegend:true,
   hovertext:ordered.map((p,j)=>esc(p.r.label+' · '+participantDateLabel(p.r)+'\n'+name+': '+values[j].toFixed(2)+'% of whole sample\nSelected phylotype mass: '+(100*summary.selected.get(p.r.index).mass).toFixed(2)+'%\n'+(settings.highlightFlagged&&p.quality?.flags.length?'Quality flags: '+p.quality.flags.map(f=>f.text).join('; ')+'\n':'')+'Click to select this visit.').replaceAll('\n','<br>')),hovertemplate:'%{hovertext}<extra></extra>',hoverlabel:{bgcolor:'#fff',font:{color:'#203d4b',size:12}}});
  values.forEach((v,i)=>bases[i]+=v);
 }
 for(const p of ordered){
  const pos=positions.get(p.r.index),chosen=p.r.index===selected,flagged=settings.highlightFlagged&&p.quality?.flags.length;
  if(chosen||flagged)shapes.push({name:chosen?'selected-stacked-bar':'flagged-stacked-bar',type:'rect',xref:'x',yref:'y',x0:pos.x-pos.width/2,x1:pos.x+pos.width/2,y0:0,y1:100,fillcolor:'rgba(0,0,0,0)',line:{color:chosen?'#000':'#b4580b',width:chosen?2.5:2,dash:flagged?'dot':'solid'}});
  if(settings.showMass){const value=100*summary.selected.get(p.r.index).mass;annotations.push({name:'trajectory-stacked-mass',xref:'x',yref:'y',x:pos.x,y:100,text:String(settings.roundMass?Math.round(value):Number(value.toFixed(1))),textangle:settings.horizontalMass?0:-90,xanchor:'center',yanchor:'bottom',yshift:3,showarrow:false,font:{size:settings.massFontSize??10,color:'#203d4b'},hovertext:'Selected phylotype mass: '+value.toFixed(2)+'%'})}
 }
 return {traces,shapes,annotations,bottom:100,height:390,summary};
}

// The live legend spans the panel body, independently of the bar-plot height.
// Reuse the plotted traces so names, order, overrides and remainder stay identical.
function renderTrajectoryPhylotypeLegend(traces,stacked){
 el('trajectoryBody').classList.toggle('stacked',stacked);
 el('trajectoryPhylotypeLegend').hidden=!stacked;
 const list=el('trajectoryPhylotypeLegendRows');
 list.style.fontSize=trajectorySettings.fontSize+'px';
 list.innerHTML=stacked?traces.filter(t=>t.meta?.trajectoryStacked&&t.showlegend).map(t=>`<li><span class="trajectoryPhylotypeSwatch" style="background:${esc(t.marker.color)}" aria-hidden="true"></span><span>${esc(t.name)}</span></li>`).join(''):'';
}
