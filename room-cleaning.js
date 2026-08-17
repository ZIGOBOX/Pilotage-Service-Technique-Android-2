
(()=>{'use strict';
const KEY='pst_cleaning_rooms_v103', CK='pst_cleaning_checks_v103', CONFIG_VERSION='147.10';
const $=x=>document.getElementById(x), uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const room=(number,name,type='Salle')=>({id:uid(),number,name,type});
const std=(base)=>Array.from({length:9},(_,i)=>room(String(base+i),'','Salle'));
const common=(floor,stairs=[])=>[room('',`Sanitaires ${floor}`,'Sanitaires'),room('',`Circulation ${floor}`,'Circulation'),...stairs.map(x=>room(x,x.startsWith('Escalier')?x:`Escalier ${x}`,'Escalier'))];
const DEF=[
{id:"A",name:"Bâtiment A",floors:[
{name:"RDC",sectors:[
{name:"Secteur principal",rooms:[room("101","","Salle"),room("102","","Salle"),room("103","","Salle"),room("104","","Salle"),room("105","","Salle"),room("106","","Salle"),room("107","","Salle"),room("108","","Salle"),room("109","","Salle"),room("","Sanitaires RDC","Sanitaires"),room("","Circulation RDC","Circulation"),room("A1","Escalier A1","Escalier"),room("A2","Escalier A2","Escalier"),room("A3","Escalier A3","Escalier")]},
]},
{name:"1er étage",sectors:[
{name:"Salles de classe",rooms:[room("111","","Salle"),room("112","","Salle"),room("113","","Salle"),room("114","","Salle"),room("115","","Salle"),room("116","","Salle"),room("117","","Salle"),room("118","","Salle"),room("119","","Salle"),room("","Sanitaires 1er étage","Sanitaires"),room("","Circulation 1er étage","Circulation"),room("A1","Escalier A1","Escalier"),room("A2","Escalier A2","Escalier"),room("A3","Escalier A3","Escalier")]},
]},
{name:"2e étage",sectors:[
{name:"Internat — moitié étage",rooms:[room("","Internat 2e — local 1","Internat"),room("","Internat 2e — local 2","Internat"),room("","Foyer internat 2e","Foyer"),room("","Circulation internat 2e","Circulation"),room("A1","Escalier A1","Escalier"),room("A2","Escalier A2","Escalier"),room("A3","Escalier A3","Escalier")]},
{name:"Salles de classe — moitié étage",rooms:[room("121","","Chambre"),room("122","","Chambre"),room("123","","Chambre"),room("124","","Chambre"),room("Maitre","","Chambre"),room("","Circulation classes 2e","Circulation"),room("A1","Escalier A1","Escalier"),room("A2","Escalier A2","Escalier"),room("A3","Escalier A3","Escalier")]},
]},
{name:"3e étage — Internat",sectors:[
{name:"Internat",rooms:[room("131","Chambre 131","Chambre"),room("132","Chambre 132","Chambre"),room("133","Chambre 133","Chambre"),room("134","Chambre 134","Chambre"),room("135","Chambre 135","Chambre"),room("136","Chambre 136","Chambre"),room("137","Chambre 137","Chambre"),room("138","Chambre 138","Chambre"),room("","Salle zen","Salle"),room("","Circulation 3e étage","Circulation"),room("","Foyer internat 3e","Foyer")]},
]},
]},
{id:"B",name:"Bâtiment B",floors:[
{name:"RDC",sectors:[
{name:"Vie scolaire / espaces communs",rooms:[room("","Vie scolaire","Local"),room("","Foyer","Foyer"),room("","Salle de musique","Salle"),room("","Salle d’étude 1","Salle"),room("","Salle d’étude 2","Salle"),room("","Salle polyvalente","Salle"),room("","Sanitaires RDC","Sanitaires"),room("","Circulation RDC","Circulation"),room("","Escalier central","Escalier")]},
]},
{name:"1er étage",sectors:[
{name:"Secteur principal",rooms:[room("211","","Salle"),room("212","","Salle"),room("213","","Salle"),room("CDI","","Salle"),room("INFOR CDI","","Salle de classe"),room("","Sanitaires 1er étage","Sanitaires"),room("","Circulation 1er étage","Circulation"),room("","Escalier central","Escalier")]},
]},
{name:"2e étage",sectors:[
{name:"Secteur principal",rooms:[room("221","","Salle"),room("222","","Salle"),room("223","","Salle"),room("224","","Salle"),room("225","","Salle"),room("226","","Salle"),room("LABORATOIRE","","Salle"),room("COLLECTION","","Salle"),room("MENAGE","","Salle"),room("","Sanitaires 2e étage","Sanitaires"),room("","Circulation 2e étage","Circulation"),room("","Escalier central","Escalier")]},
]},
{name:"3e étage",sectors:[
{name:"Secteur principal",rooms:[room("331","","Salle"),room("332","","Salle"),room("333","","Salle"),room("334","","Salle"),room("335","","Salle"),room("336","","Salle"),room("LABORATOIRE","","Salle"),room("COLLECTION","","Salle"),room("","Sanitaires RDC","Sanitaires"),room("","Circulation RDC","Circulation")]},
]},
{name:"4e  etage",sectors:[
{name:"Secteur principal",rooms:[room("411","","Salle"),room("412","","Salle"),room("413","","Salle"),room("414","","Salle"),room("415","","Salle"),room("416","","Salle"),room("LABORATOIRE","","Salle"),room("COLLECTION","","Salle"),room("BUREAU","","Bureau"),room("","Sanitaires 4e étage","Sanitaires"),room("","Circulation 4e étage","Circulation")]},
]},
]},
{id:"H",name:"Bâtiment H",floors:[
{name:"2e étage",sectors:[
{name:"Secteur principal",rooms:[room("321","","Salle"),room("322","","Salle"),room("323","","Salle"),room("324","","Salle"),room("325","","Salle"),room("326","","Salle"),room("327","","Salle"),room("328","","Salle"),room("329","","Salle")]},
]},
]},
{id:"G",name:"Bâtiment G",floors:[
{name:"RDC",sectors:[
{name:"Secteur principal",rooms:[room("400","","Salle"),room("BUREAU INTENDANCE","","Bureau"),room("ADMINISTRATION","","Bureau")]},
]},
{name:"1er étage",sectors:[
{name:"Secteur principal",rooms:[room("411","","Salle"),room("412","","Salle"),room("413","","Salle")]},
]},
{name:"2e étage",sectors:[
{name:"Secteur principal",rooms:[room("421","","Salle"),room("422","","Salle"),room("423","","Salle"),room("424","","Salle"),room("425","","Salle"),room("426","","Salle"),room("427","","Salle"),room("428","","Salle"),room("429","","Salle"),room("","Sanitaires 2e étage","Sanitaires"),room("","Circulation 2e étage","Circulation")]},
]},
]},
{id:"E",name:"Bâtiment E",floors:[
{name:"RDC",sectors:[
{name:"Secteur principal",rooms:[room("501","","Salle"),room("502","","Salle")]},
]},
{name:"1er étage",sectors:[
{name:"Secteur principal",rooms:[room("511","","Salle"),room("512","","Salle"),room("513","","Salle"),room("514","","Salle"),room("515","","Salle"),room("516","","Salle"),room("517","","Salle"),room("518","","Salle"),room("519","","Salle"),room("","Sanitaires 1er étage","Sanitaires"),room("","Circulation 1er étage","Circulation")]},
]},
{name:"2e étage",sectors:[
{name:"Secteur principal",rooms:[room("521","","Salle"),room("522","","Salle"),room("523","","Salle"),room("524","","Salle"),room("525","","Salle"),room("526","","Salle"),room("527","","Salle"),room("528","","Salle"),room("529","","Salle"),room("","Sanitaires 2e étage","Sanitaires"),room("","Circulation 2e étage","Circulation")]},
]},
]},
{id:"F",name:"Bâtiment F",floors:[
{name:"RDC",sectors:[
{name:"Secteur principal",rooms:[room("601","","Salle"),room("602","","Salle"),room("603","","Salle"),room("604","","Salle"),room("605","","Salle"),room("606","","Salle"),room("607","","Salle"),room("608","","Salle"),room("609","","Salle"),room("","Sanitaires RDC","Sanitaires"),room("","Circulation RDC","Circulation")]},
]},
{name:"1er étage",sectors:[
{name:"Secteur principal",rooms:[room("611","","Salle"),room("612","","Salle"),room("613","","Salle"),room("614","","Salle"),room("615","","Salle"),room("616","","Salle"),room("617","","Salle"),room("618","","Salle"),room("619","","Salle"),room("","Sanitaires 1er étage","Sanitaires"),room("","Circulation 1er étage","Circulation")]},
]},
{name:"2e étage",sectors:[
{name:"Secteur principal",rooms:[room("621","","Salle"),room("622","","Salle"),room("623","","Salle"),room("624","","Salle"),room("625","","Salle"),room("626","","Salle"),room("627","","Salle"),room("628","","Salle"),room("629","","Salle"),room("","Sanitaires 2e étage","Sanitaires"),room("","Circulation 2e étage","Circulation")]},
]},
]},
{id:"ALG",name:"Algeco",floors:[
{name:"Locaux",sectors:[
{name:"Algeco",rooms:[room("1","Algeco 1","Local"),room("2","Algeco 2","Local"),room("3","Algeco 3","Local"),room("4","Algeco 4","Local"),room("5","Algeco 5","Local"),room("6","Algeco 6","Local")]},
]},
]},
{id:"EXT",name:"Extension",floors:[
{name:"Locaux",sectors:[
{name:"Extension",rooms:[room("","Local extension","Local"),room("","Sanitaires","Sanitaires"),room("","Circulation","Circulation")]},
]},
]},
];

let data=load();
let currentFiltered=[];
let roomSettingsDirty=false;
let roomSaveTimer=null;
let roomCloudBusy=false;

function roomEditorFocused(){
  const el=document.activeElement;
  return !!(el&&el.closest&&el.closest('#rcSettings')&&el.matches('input,select,textarea'));
}
function scheduleRoomConfigSave(forceCloud=false){
  roomSettingsDirty=true;
  localStorage.setItem(KEY,JSON.stringify(data));
  try{
    const main=window.PSTMainState?.get?.();
    if(main){
      main.cleaningRoomsConfig=clone(data);
      main.cleaningRoomsConfigVersion=CONFIG_VERSION;
      window.PSTMainState?.save?.(false);
    }
  }catch(e){console.warn('Pré-synchronisation configuration salles',e)}
  clearTimeout(roomSaveTimer);
  roomSaveTimer=setTimeout(async()=>{
    try{
      if(forceCloud||!roomEditorFocused()){
        roomCloudBusy=true;
        const result=window.PSTMainState?.persistNow?await window.PSTMainState.persistNow():{ok:true};
        if(result?.ok)roomSettingsDirty=false;
      }
    }catch(e){console.warn('Sauvegarde immédiate configuration salles',e)}
    finally{roomCloudBusy=false}
  },forceCloud?50:700);
}
function duplicateRoomNumber(buildingIndex,floorIndex,sectorIndex,roomIndex,value){
  const wanted=String(value||'').trim().toLocaleLowerCase('fr-FR');
  if(!wanted)return false;
  const rs=data?.[buildingIndex]?.floors?.[floorIndex]?.sectors?.[sectorIndex]?.rooms||[];
  return rs.some((x,i)=>i!==roomIndex&&String(x.number||'').trim().toLocaleLowerCase('fr-FR')===wanted);
}

function clone(x){return JSON.parse(JSON.stringify(x))}
function load(){try{let x=JSON.parse(localStorage.getItem(KEY));return Array.isArray(x)&&x.length?x:clone(DEF)}catch(e){return clone(DEF)}}
function loadChecks(){try{return JSON.parse(localStorage.getItem(CK))||[]}catch(e){return[]}}
function save(redraw=true){
 localStorage.setItem(KEY,JSON.stringify(data));
 roomSettingsDirty=true;
 try{
   const main=window.PSTMainState?.get?.();
   if(main){
     main.cleaningRoomsConfig=clone(data);
     main.cleaningRoomsConfigVersion=CONFIG_VERSION;
     window.PSTMainState?.save?.(false);
   }
 }catch(e){console.warn('Synchronisation configuration des salles',e)}
 scheduleRoomConfigSave(false);
 if(redraw){renderSettings();renderBuildings();renderHistory()}
}
function saveChecks(arr){localStorage.setItem(CK,JSON.stringify(arr));renderHistory()}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function label(r){return [r.number?`${r.number}`:'',r.name].filter(Boolean).join(' — ')||r.type}
function fmtDate(v){try{return new Date(v).toLocaleDateString('fr-FR')}catch{return v||''}}

function findRoomRefById(id){
 for(const b of data)for(const f of b.floors)for(const s of f.sectors){
  const r=s.rooms.find(x=>x.id===id);
  if(r)return {b,f,s,r};
 }
 return null;
}

function renderSettings(){
 const box=$('rcSettings');if(!box)return;
 // V147.11 : conserver les bâtiments dépliés lors des resynchronisations/rendus.
 // Sans cela, un rafraîchissement Supabase pouvait refermer immédiatement Bâtiment B.
 const previouslyOpen=[...box.querySelectorAll('details.rc-building[open]')].map(d=>Number(d.dataset.buildingIndex)).filter(Number.isFinite);
 box.innerHTML=data.map((b,bi)=>`<details class="rc-building" data-building-index="${bi}" ${(previouslyOpen.length?previouslyOpen.includes(bi):bi===0)?'open':''}><summary><b>${esc(b.name)}</b><span>${b.floors.length} étage(s)</span></summary><div class="rc-build-body">
 <div class="rc-edit-head"><label>Bâtiment<input data-k="bn" data-b="${bi}" value="${esc(b.name)}"></label><div class="inline-actions"><button class="ghost small" data-af="${bi}">+ Étage</button><button class="primary small" type="button" data-save-rooms="${bi}">💾 Enregistrer</button></div></div>
 ${b.floors.map((f,fi)=>`<div class="rc-floor"><div class="rc-edit-head"><label>Étage<input data-k="fn" data-b="${bi}" data-f="${fi}" value="${esc(f.name)}"></label><button class="ghost small" data-as="${bi}:${fi}">+ Secteur</button></div>
 ${f.sectors.map((s,si)=>`<div class="rc-sector"><div class="rc-edit-head"><label>Secteur<input data-k="sn" data-b="${bi}" data-f="${fi}" data-s="${si}" value="${esc(s.name)}"></label><button class="ghost small" data-ar="${bi}:${fi}:${si}">+ Salle / local</button></div>
 <div class="rc-room-table">${s.rooms.map((r,ri)=>`<div class="rc-room-row"><input placeholder="N°" data-k="rn" data-b="${bi}" data-f="${fi}" data-s="${si}" data-r="${ri}" value="${esc(r.number)}"><input placeholder="Nom" data-k="rname" data-b="${bi}" data-f="${fi}" data-s="${si}" data-r="${ri}" value="${esc(r.name)}"><select data-k="rt" data-b="${bi}" data-f="${fi}" data-s="${si}" data-r="${ri}">${['Salle','Salle de classe','Chambre','Sanitaires','Circulation','Escalier','Internat','Foyer','Local','Bureau'].map(t=>`<option ${r.type===t?'selected':''}>${t}</option>`).join('')}</select><button class="danger-lite small" data-dr="${bi}:${fi}:${si}:${ri}">Supprimer</button></div>`).join('')}</div></div>`).join('')}</div>`).join('')}</div></details>`).join('');
 box.querySelectorAll('[data-k]').forEach(el=>{
   const applyValue=()=>{
     const b=+el.dataset.b,f=+el.dataset.f,s=+el.dataset.s,r=+el.dataset.r,k=el.dataset.k;
     if(k==='bn')data[b].name=el.value;
     if(k==='fn')data[b].floors[f].name=el.value;
     if(k==='sn')data[b].floors[f].sectors[s].name=el.value;
     if(k==='rn'){
       data[b].floors[f].sectors[s].rooms[r].number=el.value;
       const dup=duplicateRoomNumber(b,f,s,r,el.value);
       el.classList.toggle('field-warning',dup);
       el.title=dup?'Attention : ce numéro existe déjà dans ce secteur.':'';
     }
     if(k==='rname')data[b].floors[f].sectors[s].rooms[r].name=el.value;
     if(k==='rt')data[b].floors[f].sectors[s].rooms[r].type=el.value;
     localStorage.setItem(KEY,JSON.stringify(data));
     roomSettingsDirty=true;
     scheduleRoomConfigSave(false);
     // Met à jour les menus métier sans reconstruire l'éditeur pendant la frappe.
     renderBuildings();
   };
   if(el.tagName==='SELECT'){
     el.addEventListener('change',()=>{applyValue();scheduleRoomConfigSave(true)});
   }else{
     el.addEventListener('input',applyValue);
     el.addEventListener('change',applyValue);
     el.addEventListener('blur',()=>scheduleRoomConfigSave(true));
     el.addEventListener('keydown',e=>{
       if(e.key==='Enter'){e.preventDefault();el.blur()}
     });
   }
 });
 box.querySelectorAll('[data-af]').forEach(x=>x.onclick=()=>{data[+x.dataset.af].floors.push({name:'Nouvel étage',sectors:[{name:'Nouveau secteur',rooms:[]}]});save();scheduleRoomConfigSave(true)});
 box.querySelectorAll('[data-as]').forEach(x=>x.onclick=()=>{let[b,f]=x.dataset.as.split(':').map(Number);data[b].floors[f].sectors.push({name:'Nouveau secteur',rooms:[]});save();scheduleRoomConfigSave(true)});
 box.querySelectorAll('[data-ar]').forEach(x=>x.onclick=()=>{let[b,f,s]=x.dataset.ar.split(':').map(Number);data[b].floors[f].sectors[s].rooms.push(room('','Nouveau local','Salle'));save();scheduleRoomConfigSave(true)});
 box.querySelectorAll('[data-dr]').forEach(x=>x.onclick=()=>{let[b,f,s,r]=x.dataset.dr.split(':').map(Number);if(confirm('Supprimer cette salle / ce local ?')){data[b].floors[f].sectors[s].rooms.splice(r,1);save()}});
}

function renderBuildings(){
 let e=$('rcBuilding');if(!e)return;
 const old=e.value;
 e.innerHTML=data.map((b,i)=>`<option value="${i}">${esc(b.name)}</option>`).join('');
 e.value=[...e.options].some(o=>o.value===old)?old:(e.options[0]?.value||'0');
 renderFloors();renderFilterOptions();
}
function renderFloors(){
 const be=$('rcBuilding'),e=$('rcFloor');if(!be||!e)return;
 const b=Number(be.value)||0,old=e.value, floors=data[b]?.floors||[];
 e.innerHTML=floors.map((f,i)=>`<option value="${i}">${esc(f.name)}</option>`).join('');
 e.disabled=!floors.length;
 if(floors.length)e.value=[...e.options].some(o=>o.value===old)?old:e.options[0].value;
 renderSectors();
}
function renderSectors(){
 const be=$('rcBuilding'),fe=$('rcFloor'),e=$('rcSector');if(!be||!fe||!e)return;
 const b=Number(be.value)||0,f=Number(fe.value)||0,old=e.value,sectors=data[b]?.floors[f]?.sectors||[];
 e.innerHTML=sectors.map((s,i)=>`<option value="${i}">${esc(s.name)}</option>`).join('');
 e.disabled=!sectors.length;
 if(sectors.length)e.value=[...e.options].some(o=>o.value===old)?old:e.options[0].value;
 renderRooms();
}
function rooms(){let b=+$('rcBuilding').value,f=+$('rcFloor').value,s=+$('rcSector').value;return data[b]?.floors[f]?.sectors[s]?.rooms||[]}
function renderRooms(){
 let box=$('rcRooms');if(!box)return;let mode=$('rcMode')?.value||'sector';
 const list=rooms();
 box.innerHTML=list.map((r,i)=>`<label class="rc-room"><input name="rcr" type="${mode==='single'?'radio':'checkbox'}" value="${i}" ${mode==='sector'?'checked':''}><span><b>${esc(label(r))}</b><small>${esc(r.type)}</small></span></label>`).join('')||'<div class="empty">Aucun local dans ce secteur.</div>';
 box.querySelectorAll('input[name="rcr"]').forEach(inp=>inp.addEventListener('change',renderSelectedHistory));
 renderSelectedHistory();
 const form=$('rcForm');if(form){form.classList.add('hidden');form.innerHTML=''}
}
function selected(){let rr=rooms();return [...document.querySelectorAll('#rcRooms input:checked')].map(x=>rr[+x.value]).filter(Boolean)}


function sameRoom(a,b){
 if(!a||!b)return false;
 if(a.id&&b.id&&String(a.id)===String(b.id))return true;
 const an=String(a.number||'').trim().toLowerCase(),bn=String(b.number||'').trim().toLowerCase();
 const aa=String(a.name||'').trim().toLowerCase(),ba=String(b.name||'').trim().toLowerCase();
 return (!!an&&an===bn)||(!an&&!bn&&!!aa&&aa===ba);
}
function recentHistoryForRoom(roomObj,days=15){
 const now=new Date(),min=now.getTime()-days*86400000;
 const out=[];
 for(const c of loadChecks()){
   const t=new Date(c.date||0).getTime();
   if(!t||t<min||t>now.getTime()+86400000)continue;
   for(const i of (c.items||[])){
     if(sameRoom(i.room,roomObj)){
       out.push({date:c.date,building:c.building,floor:c.floor,sector:c.sector,result:i.result,score:i.score,note:i.note||'',room:i.room});
     }
   }
 }
 return out.sort((a,b)=>new Date(b.date)-new Date(a.date));
}

function allHistoryForRoom(roomObj){
 const out=[];
 for(const check of loadChecks()){
   for(const item of (check.items||[])){
     if(sameRoom(item.room,roomObj)){
       out.push({
         date:check.date,building:check.building,floor:check.floor,sector:check.sector,
         result:item.result,score:item.score,note:item.note||'',room:item.room
       });
     }
   }
 }
 return out.sort((x,y)=>new Date(y.date)-new Date(x.date));
}
function selectedHistoryHtml(roomObj){
 const all=allHistoryForRoom(roomObj);
 if(!all.length){
   return `<article class="rc-history-preview-card empty-history"><strong>${esc(label(roomObj))}</strong><span>Aucun ancien contrôle enregistré pour cette pièce.</span></article>`;
 }
 const now=Date.now(),recent=all.filter(x=>{
   const t=new Date(x.date||0).getTime();
   return t&&now-t<=15*86400000&&t<=now+86400000;
 });
 const shown=(recent.length?recent:all).slice(0,5);
 return `<article class="rc-history-preview-card">
   <div class="rc-history-preview-head">
     <div><strong>${esc(label(roomObj))}</strong><small>${esc(roomObj.type||'')}</small></div>
     <span class="${recent.length?'recent':'old'}">${recent.length?`${recent.length} contrôle(s) sur 15 jours`:`Dernier ancien contrôle`}</span>
   </div>
   <div class="rc-history-preview-list">
     ${shown.map((x,n)=>`<div class="${n===0?'latest':''}">
       <b>${fmtDate(x.date)}</b>
       <span class="${x.result==='Non conforme'?'bad':x.result==='À améliorer'?'warn':'good'}">${esc(x.result||'—')}</span>
       <strong>${Number(x.score||0).toFixed(1)}/10</strong>
       ${x.note?`<p>${esc(x.note)}</p>`:''}
     </div>`).join('')}
   </div>
   ${recent.length&&all.length>recent.length?`<small class="rc-older-note">${all.length-recent.length} contrôle(s) plus ancien(s) également conservé(s).</small>`:''}
 </article>`;
}
function renderSelectedHistory(){
 const box=$('rcSelectedHistory');if(!box)return;
 const rs=selected();
 if(!rs.length){
   box.innerHTML='<div class="rc-history-prompt">Sélectionnez une salle pour afficher ses anciens contrôles.</div>';
   return;
 }
 const limited=rs.slice(0,6);
 box.innerHTML=`<div class="rc-selected-history-title"><strong>🕘 Anciens contrôles des locaux sélectionnés</strong><small>Priorité aux 15 derniers jours</small></div>${limited.map(selectedHistoryHtml).join('')}${rs.length>6?`<div class="rc-history-prompt">+ ${rs.length-6} autre(s) local(aux) sélectionné(s). Leur historique sera visible pendant le contrôle.</div>`:''}`;
}
function recentHistoryHtml(roomObj){
 const hist=recentHistoryForRoom(roomObj,15);
 if(!hist.length)return '';
 const latest=hist[0],all=hist.slice(0,5);
 return `<details class="rc-recent-history" open>
   <summary>🕘 Historique récent — ${hist.length} contrôle(s) sur 15 jours</summary>
   <div class="rc-recent-latest"><strong>Dernier : ${fmtDate(latest.date)} — ${esc(latest.result||'')}</strong><span>Note ${Number(latest.score||0).toFixed(1)}/10</span>${latest.note?`<p>${esc(latest.note)}</p>`:''}</div>
   <div class="rc-recent-list">${all.map(x=>`<div><span>${fmtDate(x.date)}</span><b>${esc(x.result||'')}</b><span>${Number(x.score||0).toFixed(1)}/10</span><small>${esc(x.note||'')}</small></div>`).join('')}</div>
 </details>`;
}
function start(){
 let rs=selected(),box=$('rcForm');if(!rs.length)return alert('Sélectionnez au moins un local.');
 box.classList.remove('hidden');
 box.innerHTML=`<h3>${rs.length} local(aux) à contrôler</h3>
 ${rs.map((r,i)=>`<div class="rc-check" data-room-id="${esc(r.id)}"><h4>${esc(label(r))}</h4>
 ${recentHistoryHtml(r)}
 <div class="rc-result">
   <label>Type de local<select data-room-type>${['Salle','Salle de classe','Chambre','Sanitaires','Circulation','Escalier','Internat','Foyer','Local','Bureau'].map(t=>`<option ${r.type===t?'selected':''}>${t}</option>`).join('')}</select></label>
   <label>Nom / appellation<input data-room-name value="${esc(r.name||'')}"></label>
   <label>Résultat<select data-res><option>Conforme</option><option>À améliorer</option><option>Non conforme</option></select></label>
   <label>Note /10<input data-score type="number" min="0" max="10" step=".5" value="10"></label>
 </div>
 <label>Observation<textarea data-note rows="2"></textarea></label></div>`).join('')}
 <button class="primary" id="rcSave">Enregistrer le contrôle</button>`;
 $('rcSave').onclick=()=>saveCheck(rs);
 box.scrollIntoView({behavior:'smooth'})
}

function saveCheck(rs){
 let b=+$('rcBuilding').value,f=+$('rcFloor').value,s=+$('rcSector').value;
 let rows=[...document.querySelectorAll('.rc-check')];

 const items=rows.map((x,i)=>{
   const original=rs[i], roomId=original.id;
   const newType=x.querySelector('[data-room-type]').value;
   const newName=x.querySelector('[data-room-name]').value.trim();

   // PRIORITÉ AU CONTRÔLE : les modifications saisies pendant le contrôle
   // mettent à jour immédiatement le référentiel pour les prochains contrôles.
   const ref=findRoomRefById(roomId);
   if(ref){
     ref.r.type=newType;
     ref.r.name=newName;
   }

   return {
     room:{
       id:roomId,
       number:original.number,
       name:newName,
       type:newType
     },
     result:x.querySelector('[data-res]').value,
     score:+x.querySelector('[data-score]').value,
     note:x.querySelector('[data-note]').value.trim()
   };
 });

 localStorage.setItem(KEY,JSON.stringify(data));

 const check={
   id:uid(),
   date:new Date().toISOString(),
   building:data[b].name,
   floor:data[b].floors[f].name,
   sector:data[b].floors[f].sectors[s].name,
   mode:$('rcMode').value,
   items
 };

 let a=loadChecks();
 a.unshift(check);
 localStorage.setItem(CK,JSON.stringify(a));

 alert(`Contrôle ménage enregistré : ${rs.length} local(aux). Les modifications de type/nom des locaux deviennent la nouvelle référence.`);
 $('rcForm').classList.add('hidden');
 renderSettings();renderBuildings();renderHistory()
}

function renderFilterOptions(){
 const b=$('rcFilterBuilding'), f=$('rcFilterFloor'), s=$('rcFilterSector');
 if(!b||!f||!s)return;
 const checks=loadChecks();
 const buildings=[...new Set(checks.map(x=>x.building).filter(Boolean))].sort();
 const floors=[...new Set(checks.map(x=>x.floor).filter(Boolean))].sort();
 const sectors=[...new Set(checks.map(x=>x.sector).filter(Boolean))].sort();
 const bv=b.value,fv=f.value,sv=s.value;
 b.innerHTML='<option value="">Tous</option>'+buildings.map(x=>`<option>${esc(x)}</option>`).join('');
 f.innerHTML='<option value="">Tous</option>'+floors.map(x=>`<option>${esc(x)}</option>`).join('');
 s.innerHTML='<option value="">Tous</option>'+sectors.map(x=>`<option>${esc(x)}</option>`).join('');
 if([...b.options].some(o=>o.value===bv))b.value=bv;
 if([...f.options].some(o=>o.value===fv))f.value=fv;
 if([...s.options].some(o=>o.value===sv))s.value=sv;
}

function getFiltered(){
 const from=$('rcFilterFrom')?.value||'', to=$('rcFilterTo')?.value||'', building=$('rcFilterBuilding')?.value||'', floor=$('rcFilterFloor')?.value||'', sector=$('rcFilterSector')?.value||'', result=$('rcFilterResult')?.value||'', roomQ=($('rcFilterRoom')?.value||'').trim().toLowerCase();
 return loadChecks().filter(c=>{
   const d=(c.date||'').slice(0,10);
   if(from&&d<from)return false;if(to&&d>to)return false;
   if(building&&c.building!==building)return false;if(floor&&c.floor!==floor)return false;if(sector&&c.sector!==sector)return false;
   if(result&&!c.items.some(i=>i.result===result))return false;
   if(roomQ&&!c.items.some(i=>`${i.room?.number||''} ${i.room?.name||''} ${i.room?.type||''}`.toLowerCase().includes(roomQ)))return false;
   return true;
 })
}

function statsFor(list){
 const items=list.flatMap(x=>x.items||[]);
 const total=items.length;
 const conform=items.filter(x=>x.result==='Conforme').length;
 const improve=items.filter(x=>x.result==='À améliorer').length;
 const nonconform=items.filter(x=>x.result==='Non conforme').length;
 const avg=total?items.reduce((s,x)=>s+(Number(x.score)||0),0)/total:0;
 return {checks:list.length,total,conform,improve,nonconform,avg}
}

function renderHistory(){
 renderFilterOptions();
 const box=$('rcHistory'), stats=$('rcStats');if(!box||!stats)return;
 currentFiltered=getFiltered();
 const st=statsFor(currentFiltered);
 stats.innerHTML=`
   <article><span>Contrôles</span><strong>${st.checks}</strong></article>
   <article><span>Locaux contrôlés</span><strong>${st.total}</strong></article>
   <article><span>Conformes</span><strong>${st.conform}</strong></article>
   <article><span>À améliorer</span><strong>${st.improve}</strong></article>
   <article><span>Non conformes</span><strong>${st.nonconform}</strong></article>
   <article><span>Note moyenne</span><strong>${st.avg.toFixed(1)}/10</strong></article>`;

 if(!currentFiltered.length){box.innerHTML='<div class="empty">Aucun contrôle correspondant aux filtres.</div>';return}
 box.innerHTML=currentFiltered.map(c=>`
   <article class="rc-history-card">
     <div class="rc-history-head"><div><strong>${esc(c.building)} — ${esc(c.floor)}</strong><small>${esc(c.sector)} · ${fmtDate(c.date)}</small></div>
       <div><button class="ghost small" data-print-check="${esc(c.id)}">Imprimer</button><button class="danger-lite small" data-del-check="${esc(c.id)}">Supprimer</button></div></div>
     <div class="rc-history-items">${(c.items||[]).map(i=>`
       <div class="rc-history-item ${i.result==='Non conforme'?'bad':i.result==='À améliorer'?'warn':'good'}">
         <div><b>${esc(label(i.room||{}))}</b><small>${esc(i.room?.type||'')}</small></div>
         <span>${esc(i.result||'')}</span><strong>${Number(i.score||0).toFixed(1)}/10</strong>
         <p>${esc(i.note||'')}</p>
       </div>`).join('')}</div>
   </article>`).join('');

 box.querySelectorAll('[data-print-check]').forEach(btn=>btn.onclick=()=>printOne(btn.dataset.printCheck));
 box.querySelectorAll('[data-del-check]').forEach(btn=>btn.onclick=()=>{
   const id=btn.dataset.delCheck;if(!confirm('Supprimer ce contrôle ménage de l’historique ?'))return;
   const arr=loadChecks().filter(x=>x.id!==id);saveChecks(arr)
 })
}

function printableHtml(list,title){
 const st=statsFor(list);
 const rows=list.map(c=>`<section class="p-check"><h2>${esc(c.building)} — ${esc(c.floor)} — ${esc(c.sector)}</h2><p>${fmtDate(c.date)}</p>
 <table><thead><tr><th>Local</th><th>Type</th><th>Résultat</th><th>Note</th><th>Observation</th></tr></thead><tbody>
 ${(c.items||[]).map(i=>`<tr><td>${esc(label(i.room||{}))}</td><td>${esc(i.room?.type||'')}</td><td>${esc(i.result||'')}</td><td>${Number(i.score||0).toFixed(1)}/10</td><td>${esc(i.note||'')}</td></tr>`).join('')}
 </tbody></table></section>`).join('');
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
 body{font-family:Arial,sans-serif;margin:24px;color:#17242d}h1{margin-bottom:4px}.sum{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.sum span{border:1px solid #ccc;border-radius:8px;padding:8px 10px}.p-check{page-break-inside:avoid;margin-top:22px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:6px;vertical-align:top}th{background:#eef3f6}@media print{button{display:none}}</style></head><body>
 <h1>${esc(title)}</h1><div class="sum"><span>${st.checks} contrôle(s)</span><span>${st.total} local(aux)</span><span>${st.conform} conformes</span><span>${st.improve} à améliorer</span><span>${st.nonconform} non conformes</span><span>Moyenne ${st.avg.toFixed(1)}/10</span></div>${rows}<script>window.onload=()=>window.print()</script></body></html>`
}

function printList(list,title){
 const w=window.open('','_blank');if(!w)return alert('Autorisez les fenêtres pour imprimer.');
 w.document.open();w.document.write(printableHtml(list,title));w.document.close()
}
function printOne(id){const c=loadChecks().find(x=>x.id===id);if(c)printList([c],`Contrôle ménage — ${c.building} — ${c.floor}`)}

function exportCsv(){
 const list=currentFiltered.length?currentFiltered:getFiltered();
 const rows=[['Date','Bâtiment','Étage','Secteur','N°','Local','Type','Résultat','Note /10','Observation']];
 list.forEach(c=>(c.items||[]).forEach(i=>rows.push([
   fmtDate(c.date),c.building,c.floor,c.sector,i.room?.number||'',i.room?.name||'',i.room?.type||'',i.result||'',i.score??'',i.note||''
 ])));
 const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`controles-menage-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

function init(){
 renderSettings();renderBuildings();renderHistory();
 $('rcAddBuilding')?.addEventListener('click',()=>{data.push({id:uid(),name:'Nouveau bâtiment',floors:[{name:'RDC',sectors:[{name:'Secteur principal',rooms:[]}]}]});save();scheduleRoomConfigSave(true)});
 $('rcBuilding')?.addEventListener('change',renderFloors);$('rcFloor')?.addEventListener('change',renderSectors);$('rcSector')?.addEventListener('change',renderRooms);$('rcMode')?.addEventListener('change',renderRooms);
 $('rcAll')?.addEventListener('click',()=>{document.querySelectorAll('#rcRooms input[type=checkbox]').forEach(x=>x.checked=true);renderSelectedHistory()});$('rcNone')?.addEventListener('click',()=>{document.querySelectorAll('#rcRooms input').forEach(x=>x.checked=false);renderSelectedHistory()});$('rcStart')?.addEventListener('click',start);
 ['rcFilterFrom','rcFilterTo','rcFilterBuilding','rcFilterFloor','rcFilterSector','rcFilterResult','rcFilterRoom'].forEach(id=>$(id)?.addEventListener('change',renderHistory));
 $('rcApplyFilters')?.addEventListener('click',renderHistory);
 $('rcResetFilters')?.addEventListener('click',()=>{['rcFilterFrom','rcFilterTo','rcFilterBuilding','rcFilterFloor','rcFilterSector','rcFilterResult','rcFilterRoom'].forEach(id=>{if($(id))$(id).value=''});renderHistory()});
 $('rcPrintFiltered')?.addEventListener('click',()=>printList(getFiltered(),'Rapport des contrôles ménage'));
 $('rcExportFiltered')?.addEventListener('click',exportCsv);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
function syncRoomsFromMain(){
 try{
   const main=window.PSTMainState?.get?.();
   if(!main)return;

   // Pendant qu'on saisit un numéro/nom/type, un polling Supabase ne doit jamais
   // remplacer la valeur qui est en cours de frappe.
   if(roomEditorFocused()||roomSettingsDirty||roomCloudBusy){
     return;
   }

   if(String(main.cleaningRoomsConfigVersion||'')!==CONFIG_VERSION){
     data=clone(DEF);
     localStorage.setItem(KEY,JSON.stringify(data));
     main.cleaningRoomsConfig=clone(data);
     main.cleaningRoomsConfigVersion=CONFIG_VERSION;
     window.PSTMainState?.save?.(false);
     renderSettings();renderBuildings();renderHistory();
     return;
   }
   if(Array.isArray(main.cleaningRoomsConfig)&&main.cleaningRoomsConfig.length){
     data=clone(main.cleaningRoomsConfig);
     localStorage.setItem(KEY,JSON.stringify(data));
     renderSettings();renderBuildings();renderHistory();
   }else{
     main.cleaningRoomsConfig=clone(data);
     main.cleaningRoomsConfigVersion=CONFIG_VERSION;
     window.PSTMainState?.save?.(false);
   }
 }catch(e){console.warn('Chargement configuration salles Supabase',e)}
}
window.addEventListener('pst:data-loaded',syncRoomsFromMain);
window.PSTCleaningRooms={get:()=>clone(data),saveAll:(v)=>{if(Array.isArray(v)){data=clone(v);save()}},reset:()=>{data=clone(DEF);save()},history:loadChecks};
})();
