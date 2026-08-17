/* Pilotage Service Technique V51 — import/export des horaires */
(() => {
  'use strict';
  const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  const DAY_KEYS=[1,2,3,4,5,6,0];
  const PROFILES=['Standard','Matin','Soir'];
  let pending=null;
  const $i=id=>document.getElementById(id);
  const norm=v=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const isoDate=v=>{
    if(!v)return '';
    if(v instanceof Date&&!isNaN(v))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
    if(typeof v==='number'&&window.XLSX?.SSF){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
    const s=String(v).trim();
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return '';
  };
  const timeText=v=>{
    if(v===null||v===undefined||v==='')return '';
    if(typeof v==='number') {const mins=Math.round(v*24*60)%1440;return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;}
    const s=String(v).trim();const m=s.match(/^(\d{1,2})[:hH](\d{2})/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:'';
  };
  const minutes=t=>{const m=timeText(t).match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};
  const agentLabel=a=>[a?.title,a?.firstName,a?.lastName].filter(Boolean).join(' ').trim()||a?.name||a?.agent||'';
  const agentMap=()=>{
    const byId=new Map(),byName=new Map();
    (db.agents||[]).forEach(a=>{byId.set(String(a.id),a);byName.set(norm(agentLabel(a)),a)});
    return {byId,byName};
  };
  const cell=(ws,addr,value,style)=>{ws[addr]={t:typeof value==='number'?'n':'s',v:value};if(style)ws[addr].s=style};
  const setWidths=(ws,widths)=>ws['!cols']=widths.map(w=>({wch:w}));
  const addAutoFilter=(ws,range)=>ws['!autofilter']={ref:range};
  const styleSheet=(ws,headerCount,rows)=>{
    ws['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};
    for(let c=0;c<headerCount;c++){const a=XLSX.utils.encode_cell({r:0,c});if(ws[a])ws[a].s={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'1F4E78'}},alignment:{horizontal:'center',vertical:'center',wrapText:true}}}
    for(let r=1;r<rows;r++)for(let c=0;c<headerCount;c++){const a=XLSX.utils.encode_cell({r,c});if(ws[a])ws[a].s={fill:{fgColor:{rgb:r%2?'F7FAFC':'FFFFFF'}},alignment:{vertical:'top',wrapText:c>7}}}
  };
  const exportMatrix=()=>{
    if(!window.XLSX){alert('Le composant Excel ne s’est pas chargé. Vérifiez la connexion Internet, puis réessayez.');return}
    const wb=XLSX.utils.book_new(), active=(db.agents||[]).filter(a=>norm(a.status||'actif')!=='archive');
    const agentRows=active.map(a=>({
      'Identifiant agent':a.id,'Nom de l’agent':agentLabel(a),'Fonction':a.role||'','Affectation principale':a.assignment||'',Actif:a.status||'Actif',
      'Samedi travaillé':(Array.isArray(a.workdays)?a.workdays:[1,2,3,4,5]).map(Number).includes(6)?'Oui':'Non',
      'Dimanche travaillé':(Array.isArray(a.workdays)?a.workdays:[1,2,3,4,5]).map(Number).includes(0)?'Oui':'Non',
      'Permanence début':a.permanenceSchedule?.start||a.permanenceStart||'',
      'Permanence fin':a.permanenceSchedule?.end||a.permanenceEnd||'',
      'Permanence pause (minutes)':Number(a.permanenceSchedule?.pause??a.permanencePause??0)
    }));
    const wsA=XLSX.utils.json_to_sheet(agentRows.length?agentRows:[{'Identifiant agent':'','Nom de l’agent':'','Fonction':'','Affectation principale':'','Actif':'Oui','Samedi travaillé':'Non','Dimanche travaillé':'Non','Permanence début':'','Permanence fin':'','Permanence pause (minutes)':0}]);
    setWidths(wsA,[25,28,24,28,12,18,20,18,18,24]);addAutoFilter(wsA,wsA['!ref']);styleSheet(wsA,10,agentRows.length+1);XLSX.utils.book_append_sheet(wb,wsA,'Agents');

    const hrows=[];
    active.forEach(a=>{
      const workdays=(Array.isArray(a.workdays)&&a.workdays.length?a.workdays:[1,2,3,4,5]).map(Number);
      const plans=(db.weeklyPlans||[]).filter(p=>String(p.agentId)===String(a.id));
      if(!plans.length){DAYS.forEach((day,i)=>{const key=DAY_KEYS[i],working=workdays.includes(key);hrows.push({'Identifiant agent':a.id,'Nom de l’agent':agentLabel(a),'Date début':'2026-09-01','Date fin':'2027-08-31','Profil horaire':'Standard','Jour':day,'Type de journée':working?'Travaillé':'Repos','Heure début':'','Heure fin':'','Pause (minutes)':0,'Mission principale':'','Commentaire':'','Contrôle':working?'À compléter':'OK'})});return}
      plans.forEach(p=>DAYS.forEach((day,i)=>{const key=DAY_KEYS[i],x=p.dayProfiles?.[key]||{},working=workdays.includes(key)&&!!(x.start&&x.end);hrows.push({'Identifiant agent':a.id,'Nom de l’agent':agentLabel(a),'Date début':p.effectiveFrom||'2026-09-01','Date fin':p.effectiveTo||'2027-08-31','Profil horaire':p.shift||'Standard','Jour':day,'Type de journée':working?'Travaillé':'Repos','Heure début':working?x.start||'':'','Heure fin':working?x.end||'':'','Pause (minutes)':working?Number(x.pause||0):0,'Mission principale':working?x.missions||'':'','Commentaire':'','Contrôle':'OK'})}));
    });
    const wsH=XLSX.utils.json_to_sheet(hrows);
    const hHeaders=Object.keys(hrows[0]||{});setWidths(wsH,[25,28,13,13,16,13,16,12,12,16,30,28,34]);addAutoFilter(wsH,wsH['!ref']);styleSheet(wsH,hHeaders.length,hrows.length+1);
    // Formules de contrôle Excel, calculées à l'ouverture du fichier.
    const col={id:'A',name:'B',from:'C',to:'D',profile:'E',day:'F',type:'G',start:'H',end:'I',pause:'J',control:'M'};
    for(let r=2;r<=hrows.length+1;r++){
      wsH[`${col.control}${r}`]={t:'s',f:`IF(AND(${col.id}${r}="",${col.name}${r}=""),"ERREUR : agent manquant",IF(OR(${col.from}${r}="",${col.to}${r}=""),"ERREUR : période incomplète",IF(${col.to}${r}<${col.from}${r},"ERREUR : fin de période avant début",IF(OR(${col.profile}${r}="",${col.day}${r}=""),"ERREUR : profil ou jour manquant",IF(${col.type}${r}="Repos","OK",IF(OR(AND(${col.start}${r}="",${col.end}${r}<>""),AND(${col.start}${r}<>"",${col.end}${r}="")),"ERREUR : début/fin incomplet",IF(AND(${col.start}${r}<>"",${col.end}${r}<>"",TIMEVALUE(${col.end}${r})<=TIMEVALUE(${col.start}${r})),"ERREUR : fin avant début",IF(AND(${col.start}${r}<>"",${col.end}${r}<>"",${col.pause}${r}>=(TIMEVALUE(${col.end}${r})-TIMEVALUE(${col.start}${r}))*1440),"ERREUR : pause trop longue","OK")))))))`};
    }
    // Les contrôles restent dans la colonne M. La couleur est appliquée dans l'application après import.
    XLSX.utils.book_append_sheet(wb,wsH,'Horaires annuels');

    const rrows=(db.rotations||[]).map(r=>{const a=(db.agents||[]).find(x=>String(x.id)===String(r.agentId));return {'Identifiant roulement':r.id,'Identifiant agent':r.agentId,'Nom de l’agent':agentLabel(a),'Date d’effet':r.effectiveFrom||'','Date de fin':r.effectiveTo||'','Nom du roulement':r.no||'','Semaines Matin':Number(r.morningWeeks||2),'Semaines Soir':Number(r.eveningWeeks||2),'Commence par':r.startShift||'Matin','Heure matin début':r.morningStart||'','Heure matin fin':r.morningEnd||'','Heure soir début':r.eveningStart||'','Heure soir fin':r.eveningEnd||'','Pause (minutes)':Number(r.pause||0),'Jours travaillés':(r.weekdays||((a&&Array.isArray(a.workdays))?a.workdays:[1,2,3,4,5])).join(','),'Commentaire':r.notes||'','Contrôle':'OK'}});
    if(!rrows.length)active.forEach(a=>rrows.push({'Identifiant roulement':'','Identifiant agent':a.id,'Nom de l’agent':agentLabel(a),'Date d’effet':'2026-09-01','Date de fin':'2027-08-31','Nom du roulement':'','Semaines Matin':2,'Semaines Soir':2,'Commence par':'Matin','Heure matin début':'','Heure matin fin':'','Heure soir début':'','Heure soir fin':'','Pause (minutes)':0,'Jours travaillés':(Array.isArray(a.workdays)&&a.workdays.length?a.workdays:[1,2,3,4,5]).join(','),'Commentaire':'','Contrôle':'À compléter'}));
    const wsR=XLSX.utils.json_to_sheet(rrows);setWidths(wsR,[24,25,28,13,13,20,15,15,15,16,16,16,16,15,18,28,32]);addAutoFilter(wsR,wsR['!ref']);styleSheet(wsR,17,rrows.length+1);XLSX.utils.book_append_sheet(wb,wsR,'Roulements');

    const instructions=[
      ['MATRICE HORAIRES ET ROULEMENTS — PILOTAGE SERVICE TECHNIQUE'],
      ['1. Les agents, horaires et roulements actuels sont déjà présents.'],
      ['2. Modifiez les heures, périodes, missions ou cycles. Ne modifiez pas les identifiants.'],
      ['3. La colonne Contrôle indique les erreurs dans Excel.'],
      ['4. Réimportez ensuite ce même fichier dans l’application.'],
      ['5. Le logiciel affiche une comparaison avant d’enregistrer.'],
      ['6. Les congés, RTT, absences et modifications ponctuelles ne sont pas supprimés.'],
      ['7. Dans l’onglet Agents, indiquez Oui/Non pour le samedi et le dimanche : ces valeurs mettent à jour les jours travaillés.'],['8. Renseignez aussi Permanence début, Permanence fin et Permanence pause (minutes).']
    ];
    const wsM=XLSX.utils.aoa_to_sheet(instructions);setWidths(wsM,[105]);wsM['A1'].s={font:{bold:true,color:{rgb:'FFFFFF'},sz:16},fill:{fgColor:{rgb:'1F4E78'}},alignment:{horizontal:'center'}};XLSX.utils.book_append_sheet(wb,wsM,'Mode d’emploi');
    wb.Workbook={Views:[{RTL:false}]};
    const data=XLSX.write(wb,{bookType:'xlsx',type:'array',compression:true,bookSST:true});const blob=new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});if(typeof triggerDownloadBlob==='function')triggerDownloadBlob(`Horaires_Roulements_${new Date().toISOString().slice(0,10)}.xlsx`,blob);else XLSX.writeFile(wb,`Horaires_Roulements_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const readRows=(wb,name)=>{const ws=wb.Sheets[name];return ws?XLSX.utils.sheet_to_json(ws,{defval:'',raw:true}):[]};
  const get=(row,...names)=>{for(const n of names){if(Object.prototype.hasOwnProperty.call(row,n))return row[n]}const keys=Object.keys(row);for(const n of names){const k=keys.find(k=>norm(k)===norm(n));if(k)return row[k]}return ''};
  const validateWorkbook=wb=>{
    const maps=agentMap(), agentRows=readRows(wb,'Agents'), hours=readRows(wb,'Horaires annuels'), rotations=readRows(wb,'Roulements');
    const results=[], validHours=[], validRot=[], agentSettings=[], duplicate=new Set();
    const yes=v=>['oui','yes','1','true','x'].includes(norm(v));
    agentRows.forEach((row,index)=>{
      if(Object.values(row).every(v=>String(v).trim()===''))return;
      const aid=String(get(row,'Identifiant agent','Agent ID')).trim(),name=String(get(row,"Nom de l’agent",'Nom agent','Agent')).trim(),agent=maps.byId.get(aid)||maps.byName.get(norm(name));
      if(!agent)return;
      const satRaw=get(row,'Samedi travaillé','Samedi'),sunRaw=get(row,'Dimanche travaillé','Dimanche');
       const permStart=timeText(get(row,'Permanence début','Début permanence')),permEnd=timeText(get(row,'Permanence fin','Fin permanence')),permPause=Number(get(row,'Permanence pause (minutes)','Pause permanence')||0);
       const permErrors=[];if((permStart&&!permEnd)||(!permStart&&permEnd))permErrors.push('Permanence début/fin incomplet');
       if(permStart&&permEnd){const sm=minutes(permStart),em=minutes(permEnd);if(sm!==null&&em!==null&&em<=sm)permErrors.push('Permanence : fin avant début');if(sm!==null&&em!==null&&permPause>=em-sm)permErrors.push('Permanence : pause trop longue')}
       if(String(satRaw).trim()!==''||String(sunRaw).trim()!==''||permStart||permEnd||permPause){agentSettings.push({agent,saturday:yes(satRaw),sunday:yes(sunRaw),permanenceStart:permStart,permanenceEnd:permEnd,permanencePause:permPause});results.push({kind:'Jours agent',line:index+2,agent,name:agentLabel(agent),from:'',to:'',profile:'',errors:permErrors,warnings:[],detail:`Samedi : ${yes(satRaw)?'travaillé':'repos'} · Dimanche : ${yes(sunRaw)?'travaillé':'repos'} · Permanence : ${permStart&&permEnd?`${permStart}–${permEnd}`:'non renseignée'}`})}
    });
    hours.forEach((row,index)=>{
      if(Object.values(row).every(v=>String(v).trim()===''))return;
      const aid=String(get(row,'Identifiant agent','Agent ID')).trim(),name=String(get(row,"Nom de l’agent",'Nom agent','Agent')).trim();
      const agent=maps.byId.get(aid)||maps.byName.get(norm(name)); const errors=[], warnings=[];
      const from=isoDate(get(row,'Date début','Début')),to=isoDate(get(row,'Date fin','Fin')),profile=String(get(row,'Profil horaire','Profil')).trim(),day=String(get(row,'Jour')).trim(),type=String(get(row,'Type de journée','Type')).trim()||'Travaillé',start=timeText(get(row,'Heure début','Début horaire')),end=timeText(get(row,'Heure fin','Fin horaire')),pause=Number(get(row,'Pause (minutes)','Pause')||0),mission=String(get(row,'Mission principale','Mission')).trim();
      if(!agent)errors.push('Agent inconnu');if(!from||!to)errors.push('Période invalide');else if(to<from)errors.push('Fin de période avant le début');if(!PROFILES.includes(profile))errors.push('Profil invalide');if(!DAYS.includes(day))errors.push('Jour invalide');
      if(norm(type)!=='repos'){
        if((start&&!end)||(!start&&end))errors.push('Début/fin incomplet');
        if(!start&&!end)warnings.push('Horaire vide : la journée deviendra repos');
        const sm=minutes(start),em=minutes(end);if(sm!==null&&em!==null&&em<=sm)errors.push('Heure de fin avant le début');if(sm!==null&&em!==null&&pause>=em-sm)errors.push('Pause trop longue');
      }
      const key=agent?`${agent.id}|${from}|${to}|${profile}|${day}`:`row-${index}`;if(duplicate.has(key))errors.push('Doublon agent / période / profil / jour');duplicate.add(key);
      const item={kind:'Horaire',line:index+2,agent,name:agent?agentLabel(agent):name,from,to,profile,day,type,start,end,pause,mission,errors,warnings,row};results.push(item);if(!errors.length)validHours.push(item);
    });
    rotations.forEach((row,index)=>{
      if(Object.values(row).every(v=>String(v).trim()===''))return;
      const aid=String(get(row,'Identifiant agent')).trim(),name=String(get(row,"Nom de l’agent",'Agent')).trim(),agent=maps.byId.get(aid)||maps.byName.get(norm(name));const errors=[],warnings=[];
      const from=isoDate(get(row,"Date d’effet",'Date effet')),to=isoDate(get(row,'Date de fin')),mw=Number(get(row,'Semaines Matin')||0),ew=Number(get(row,'Semaines Soir')||0),startShift=String(get(row,'Commence par')).trim(),ms=timeText(get(row,'Heure matin début')),me=timeText(get(row,'Heure matin fin')),es=timeText(get(row,'Heure soir début')),ee=timeText(get(row,'Heure soir fin'));
      if(!agent)errors.push('Agent inconnu');if(!from)errors.push('Date d’effet invalide');if(to&&to<from)errors.push('Date de fin avant date d’effet');if(!(mw>=1&&ew>=1))errors.push('Cycle matin/soir invalide');if(!['Matin','Soir'].includes(startShift))errors.push('Départ du roulement invalide');if(!ms||!me||!es||!ee)warnings.push('Heures générales du roulement incomplètes');
      const item={kind:'Roulement',line:index+2,agent,name:agent?agentLabel(agent):name,from,to,mw,ew,startShift,ms,me,es,ee,pause:Number(get(row,'Pause (minutes)')||0),weekdays:String(get(row,'Jours travaillés')||'1,2,3,4,5').split(',').map(Number).filter(n=>n>=0&&n<=6),notes:String(get(row,'Commentaire')||''),rotationId:String(get(row,'Identifiant roulement')||''),errors,warnings,row};results.push(item);if(!errors.length)validRot.push(item);
    });
    // Vérifie que les profils Matin et Soir existent dans le fichier ou déjà dans la base.
    validRot.forEach(r=>{for(const profile of ['Matin','Soir']){const exists=validHours.some(h=>h.agent?.id===r.agent?.id&&h.profile===profile&&h.from<=r.from&&h.to>=r.from)||(db.weeklyPlans||[]).some(p=>String(p.agentId)===String(r.agent?.id)&&p.shift===profile);if(!exists)r.warnings.push(`Profil ${profile} introuvable`)}});
    return {results,validHours,validRot,agentSettings};
  };
  const preview=data=>{
    pending=data;const errors=data.results.filter(x=>x.errors.length),warnings=data.results.filter(x=>!x.errors.length&&x.warnings.length),ok=data.results.filter(x=>!x.errors.length&&!x.warnings.length);
    $i('scheduleImportSummary').className='import-summary';$i('scheduleImportSummary').innerHTML=`<div class="import-stat ok"><strong>${ok.length}</strong><span>lignes correctes</span></div><div class="import-stat warning"><strong>${warnings.length}</strong><span>avertissements</span></div><div class="import-stat error"><strong>${errors.length}</strong><span>erreurs bloquantes</span></div><div class="import-stat"><strong>${new Set(data.validHours.map(x=>x.agent?.id).filter(Boolean)).size}</strong><span>agents concernés</span></div>`;
    $i('confirmScheduleImport').classList.toggle('hidden',data.validHours.length+data.validRot.length===0);
    $i('scheduleImportPreview').innerHTML=`<table><thead><tr><th>État</th><th>Type</th><th>Ligne</th><th>Agent</th><th>Période / date</th><th>Profil / cycle</th><th>Détail</th></tr></thead><tbody>${data.results.map(x=>{const cls=x.errors.length?'error':x.warnings.length?'warning':'ok',state=x.errors.length?'Erreur':x.warnings.length?'À vérifier':'OK',detail=[...x.errors,...x.warnings].join(' · ')||x.detail||(x.kind==='Horaire'?`${x.day} ${x.start||'Repos'}${x.end?'–'+x.end:''} ${x.mission||''}`:`${x.mw||0} sem. matin / ${x.ew||0} sem. soir`);return `<tr class="import-row-${cls}"><td><span class="import-badge ${cls}">${state}</span></td><td>${x.kind}</td><td>${x.line}</td><td>${x.name||'—'}</td><td>${x.from||'—'}${x.to?' → '+x.to:''}</td><td>${x.kind==='Horaire'?x.profile:x.kind==='Roulement'?x.startShift:'Jours travaillés'}</td><td>${detail}</td></tr>`}).join('')}</tbody></table>`;
  };
  const importFile=async file=>{
    if(!window.XLSX){alert('Le composant Excel ne s’est pas chargé. Vérifiez Internet.');return}
    try{const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array',cellDates:true});preview(validateWorkbook(wb));}
    catch(e){console.error(e);alert(`Impossible de lire le fichier : ${e.message}`)}
  };
  const applyImport=async()=>{
    if(!pending)return;
    for(const item of pending.agentSettings||[]){
      const a=item.agent,current=(Array.isArray(a.workdays)&&a.workdays.length?a.workdays:[1,2,3,4,5]).map(Number).filter(d=>d!==0&&d!==6);
      if(item.saturday)current.push(6);if(item.sunday)current.push(0);a.workdays=[...new Set(current)];
       if(item.permanenceStart||item.permanenceEnd||Number(item.permanencePause||0)){a.permanenceSchedule={start:item.permanenceStart||'',end:item.permanenceEnd||'',pause:Number(item.permanencePause||0)};a.permanenceStart=a.permanenceSchedule.start;a.permanenceEnd=a.permanenceSchedule.end;a.permanencePause=a.permanenceSchedule.pause}
    }
    const groups=new Map();
    pending.validHours.forEach(x=>{const key=`${x.agent.id}|${x.from}|${x.to}|${x.profile}`;if(!groups.has(key))groups.set(key,{id:null,agentId:x.agent.id,agent:agentLabel(x.agent),shift:x.profile,effectiveFrom:x.from,effectiveTo:x.to,dayProfiles:{},rows:[]});const p=groups.get(key),dayIndex=DAY_KEYS[DAYS.indexOf(x.day)],working=norm(x.type)!=='repos'&&x.start&&x.end;p.dayProfiles[dayIndex]={start:working?x.start:'',end:working?x.end:'',pause:working?x.pause:0,missions:x.mission||'',segments:[]};});
    let created=0,updated=0;
    groups.forEach(p=>{const idx=(db.weeklyPlans||[]).findIndex(old=>String(old.agentId)===String(p.agentId)&&old.shift===p.shift&&old.effectiveFrom===p.effectiveFrom&&old.effectiveTo===p.effectiveTo);if(idx>=0){p.id=db.weeklyPlans[idx].id||uid();db.weeklyPlans[idx]=p;updated++}else{p.id=uid();db.weeklyPlans.push(p);created++}});
    let rotCreated=0,rotUpdated=0;
    pending.validRot.forEach(x=>{let idx=x.rotationId?(db.rotations||[]).findIndex(r=>String(r.id)===x.rotationId):-1;if(idx<0)idx=(db.rotations||[]).findIndex(r=>String(r.agentId)===String(x.agent.id)&&r.effectiveFrom===x.from);const r={id:idx>=0?db.rotations[idx].id:uid(),no:idx>=0?(db.rotations[idx].no||''):(typeof nextNo==='function'?nextNo('rotation','RLT'):''),agentId:x.agent.id,effectiveFrom:x.from,effectiveTo:x.to,startShift:x.startShift,morningWeeks:x.mw,eveningWeeks:x.ew,morningStart:x.ms,morningEnd:x.me,eveningStart:x.es,eveningEnd:x.ee,pause:x.pause,weekdays:x.weekdays.length?x.weekdays:[1,2,3,4,5],notes:x.notes};if(idx>=0){db.rotations[idx]=r;rotUpdated++}else{db.rotations.push(r);rotCreated++}});
    if(typeof syncStoredChronotimePastilles==='function')syncStoredChronotimePastilles();
    // Les jours de week-end décochés dans l'onglet Agents sont aussi retirés des roulements existants.
    for(const a of db.agents||[]){const allowed=(Array.isArray(a.workdays)&&a.workdays.length?a.workdays:[1,2,3,4,5]).map(Number);for(const r of (db.rotations||[]).filter(r=>String(r.agentId)===String(a.id))){r.weekdays=(r.weekdays||[1,2,3,4,5]).map(Number).filter(d=>allowed.includes(d))}}
    db.scheduleImports=db.scheduleImports||[];
    const importMarker=typeof uid==='function'?uid():String(Date.now());
    db.scheduleImports.push({id:importMarker,date:new Date().toISOString(),created,updated,rotCreated,rotUpdated,errors:pending.results.filter(x=>x.errors.length).length,warnings:pending.results.filter(x=>x.warnings.length).length});

    // Afficher immédiatement les nouvelles données dans tous les modules.
    if(typeof safeRenderAll==='function')safeRenderAll();

    const persisted=window.PSTMainState?.persistStateDirect
      ? await window.PSTMainState.persistStateDirect({
          label:'Import horaires',
          verify:remote=>(remote.scheduleImports||[]).some(x=>String(x.id)===String(importMarker))
        })
      : (window.PSTMainState?.persistNow?await window.PSTMainState.persistNow():{ok:save(),offline:false});

    if(!persisted?.ok){
      $i('scheduleImportSummary').innerHTML=`<div class="import-stat error"><strong>Import appliqué localement — Supabase non confirmé</strong><span>${persisted?.error||'Erreur Supabase non précisée'}. Les modifications restent protégées sur cet appareil.</span></div>`;
      if(typeof safeRenderAll==='function')safeRenderAll();
      if(typeof toast==='function')toast(`Import horaires non confirmé : ${persisted?.error||'erreur Supabase'}`);
      return;
    }

    pending=null;
    $i('confirmScheduleImport').classList.add('hidden');
    $i('scheduleImportSummary').innerHTML=`<div class="import-success"><strong>✅ Import horaires terminé et synchronisé</strong><span>${created} profil(s) créé(s), ${updated} modifié(s), ${rotCreated} roulement(s) créé(s), ${rotUpdated} modifié(s).</span></div>`;
    $i('scheduleImportPreview').innerHTML='';
    if(typeof safeRenderAll==='function')safeRenderAll();
    if(typeof toast==='function')toast('✅ Horaires et roulements mis à jour');
  };
  const init=()=>{
    const d=$i('downloadScheduleMatrix'),f=$i('scheduleImportFile'),c=$i('confirmScheduleImport');if(!d||!f||!c)return;
    d.addEventListener('click',exportMatrix);f.addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importFile(file);e.target.value=''});c.addEventListener('click',applyImport);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
