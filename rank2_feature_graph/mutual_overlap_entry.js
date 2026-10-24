// Only a small opener is installed in VME; diagnostics load on explicit request.
function openMutualOverlap(){
 if(!/*OVERLAP_AVAILABLE*/){alert('Mutual-overlap diagnostics have not been provisioned in this build.');return}
 if(META.id!=='comb-V3V4-tx'){alert('Mutual overlap is currently available for comb-V3V4-tx. Select that dataset first.');return}
 let box=document.getElementById('mutualOverlapDialog');
 if(!box){
  box=document.createElement('dialog');box.id='mutualOverlapDialog';box.style.cssText='width:94vw;height:94vh;max-width:none;max-height:none;padding:0;border:1px solid #7896a3;border-radius:5px';
  const bar=document.createElement('div');bar.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:5px 10px';
  const label=document.createElement('strong');label.textContent='Mutual overlap · original pure states';bar.append(label);
  const actions=document.createElement('div'),maximize=document.createElement('button'),close=document.createElement('button');maximize.textContent='Maximize';maximize.onclick=()=>{const full=box.dataset.full!=='true';box.dataset.full=String(full);box.style.width=full?'100vw':'94vw';box.style.height=full?'100vh':'94vh';maximize.textContent=full?'Restore':'Maximize';};close.textContent='Close';close.onclick=()=>box.close();actions.append(maximize,close);bar.append(actions);box.append(bar);
  const frame=document.createElement('iframe');frame.title='Mutual overlap comparison browser';frame.style.cssText='width:100%;height:calc(100% - 42px);border:0';
  const query=new URLSearchParams({q:el('coverage').value});if(selected!==null)query.set('seed',selected);frame.src='mutual-overlap/index.html?'+query;box.append(frame);document.body.append(box);
 }
 box.showModal();
}
// Read-only palette bridge; the comparison never changes the parent's colors.
if(typeof window!=='undefined')window.vmeOverlapColors=(a,b)=>[edgeColor(a),edgeColor(b)];
