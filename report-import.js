'use strict';

(function(){
  let chronoPending=null, controlPending=null, pdfjsPromise=null;
  const DAY_LETTER=['D','L','M','M','J','V','S'];
  const DEFAULT_CODE_MAP={CA:'Congé annuel',RTT:'RTT',RH:'Repos',RFE:'Jour férié',A:'Absence temps partiel'};
  const DEFAULT_DAY_DISPLAY={
    'Présence':{abbr:'ST',color:'#dbeafe'},
    'Congé annuel':{abbr:'CA',color:'#39d353'},
    'RTT':{abbr:'RTT',color:'#2f9cf4'},
    'Repos':{abbr:'RH',color:'#e5e7eb'},
    'Jour férié':{abbr:'RFE',color:'#7ee787'},
    'Maladie':{abbr:'MAL',color:'#fecaca'},
    'Formation':{abbr:'F',color:'#ddd6fe'},
    'Décès / deuil':{abbr:'DEC',color:'#e9d5ff'},
    'Mariage / PACS':{abbr:'MAR',color:'#e9d5ff'},
    'Enfant malade':{abbr:'EM',color:'#fecdd3'},
    'Naissance / adoption':{abbr:'NA',color:'#e9d5ff'},
    'Autorisation d’absence':{abbr:'AA',color:'#e9d5ff'},
    'Absence temps partiel':{abbr:'RTP',color:'#f9a8d4'},
    'Récupération':{abbr:'REC',color:'#fde68a'},
    'Accident du travail':{abbr:'AT',color:'#fca5a5'},
    'Grève':{abbr:'G',color:'#fdba74'},
    'Autre absence':{abbr:'ABS',color:'#bfdbfe'}
  };
  const DEFAULT_DAY_RULES={
    'Présence':{mode:'planned',hours:null},
    'Congé annuel':{mode:'planned',hours:null},
    'RTT':{mode:'planned',hours:null},
    'Repos':{mode:'zero',hours:0},
    'Jour férié':{mode:'zero',hours:0},
    'Maladie':{mode:'fixed',hours:7},
    'Formation':{mode:'planned',hours:null},
    'Décès / deuil':{mode:'planned',hours:null},
    'Mariage / PACS':{mode:'planned',hours:null},
    'Enfant malade':{mode:'planned',hours:null},
    'Naissance / adoption':{mode:'planned',hours:null},
    'Autorisation d’absence':{mode:'planned',hours:null},
    'Absence temps partiel':{mode:'planned',hours:null}
  };
  const CONTROL_ORGS=['APAVE','SOCOTEC','BUREAU VERITAS','VERITAS','DEKRA','QUALICONSULT','ALPES CONTROLES','ALPES CONTRÔLES','NORISKO','SGS','BUREAU ALPES CONTROLES','BUREAU ALPES CONTRÔLES','AC ENVIRONNEMENT','ANCO','QUALICONSULT EXPLOITATION','GROUPE QUALICONSULT'];
  const CONTROL_KEYWORDS=['non-conform','non conform','anomal','réserve','reserve','observation','écart','ecart','remarque','défaut','defaut','prescription','action corrective','mise en conformité','mise en conformite','à corriger','a corriger','danger','risque','non satisfaisant','non-satisfaisant','défectueux','defectueux','à réparer','a reparer','à remplacer','a remplacer','levée de réserve','levee de reserve'];
  const CONTROL_POSITIVE=['conforme','satisfaisant','sans observation','aucune anomalie','ras'];
  const CHRONO_HINT_WORDS=['gfi chrono time','chronotime','chrono time','synoptique annuel','synoptique','badgeage','pointage','temps de présence','temps de presence','temps de travail','tps prés','tps pres','tps pr','ca pris','référence','reference','écart','ecart','solde','agent','matricule'];
  const GFI_MONTHS=['septembre','octobre','novembre','décembre','janvier','février','mars','avril','mai','juin','juillet','août'];

  function ensureData(){
    db.pdfImports=db.pdfImports||[];
    db.chronotimeDaily=db.chronotimeDaily||[];
    db.chronotimeAnnual=db.chronotimeAnnual||[];
    db.reportNonconformities=db.reportNonconformities||[];
    db.settings=db.settings||{};
    db.settings.chronoCodeMap=Object.assign({},DEFAULT_CODE_MAP,db.settings.chronoCodeMap||{});
    // V147.15 : les codes standards GFI ne peuvent plus être détournés par une ancienne configuration.
    // Chronotime fait foi pour ces 4 codes.
    Object.assign(db.settings.chronoCodeMap,{
      CA:'Congé annuel',
      RTT:'RTT',
      RH:'Repos',
      RFE:'Jour férié'
    });
    db.settings.chronoDayRules=Object.assign({},DEFAULT_DAY_RULES,db.settings.chronoDayRules||{});
    db.settings.chronoDayDisplay=Object.assign({},DEFAULT_DAY_DISPLAY,db.settings.chronoDayDisplay||{});
    // Migration d'affichage : le temps partiel s'affiche toujours RTP par défaut.
    db.settings.chronoDayDisplay['Absence temps partiel']=Object.assign({},db.settings.chronoDayDisplay['Absence temps partiel']||{},{abbr:(db.settings.chronoDayDisplay['Absence temps partiel']?.abbr==='ATP'?'RTP':(db.settings.chronoDayDisplay['Absence temps partiel']?.abbr||'RTP'))});
    db.settings.chronoAgentHints=db.settings.chronoAgentHints||{};
    db.settings.controlFamilyHints=db.settings.controlFamilyHints||{};
    db.lists=db.lists||{};
    db.lists.dayTypes=db.lists.dayTypes||[];
    for(const v of ['Jour férié']) if(!db.lists.dayTypes.includes(v)) db.lists.dayTypes.push(v);
  }
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const norm=s=>clean(s).toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const basename=s=>String(s||'').replace(/\.[^.]+$/,'');
  const words=s=>norm(s).replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(x=>x.length>1);
  const filenameSignature=name=>words(basename(name)).filter(x=>!['pdf','rapport','controle','control','document','scan','chronotime','chrono'].includes(x)).slice(0,5).join('|');
  function similarity(a,b){const A=new Set(words(a)),B=new Set(words(b));if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.max(A.size,B.size)}
  function confidenceLabel(score){return score>=85?'Très élevée':score>=70?'Élevée':score>=50?'Moyenne':'Faible'}
  const fmtDateTime=v=>v?new Date(v).toLocaleString('fr-FR'):'—';
  const academicFromPeriod=(start,end)=> start&&end?`${start.slice(0,4)}-${end.slice(0,4)}`:'';
  const durationToMinutes=s=>{
    const m=String(s||'').replace(/\s+/g,'').match(/^([+-]?)(\d{1,5})(?::|h)(\d{2})$/i);if(!m)return null;
    const sign=m[1]==='-'?-1:1;return sign*(Number(m[2])*60+Number(m[3]));
  };
  const durationTokens=s=>[...String(s||'').matchAll(/[+-]?\d{1,5}\s*(?::|h)\s*\d{2}/gi)].map(m=>m[0]);
  function canonicalChronoCode(value){
    const raw=String(value||'').trim().toUpperCase();
    if(!raw)return '';
    const compact=raw.replace(/\s+/g,'');
    if(/^CA(?:[-_]?\d+)?$/.test(compact))return 'CA';
    if(/^RTT(?:[-_]?\d+)?$/.test(compact))return 'RTT';
    if(/^RH(?:[-_]?\d+)?$/.test(compact))return 'RH';
    if(/^RFE(?:[-_]?\d+)?$/.test(compact))return 'RFE';
    return raw;
  }
  const dayTokens=s=>[...String(s||'').matchAll(/(\d+)\s*j\s*(\d{2})/gi)].map(m=>Number(m[1])+Number(m[2])/100);
  function footerSlice(text,startRx,endRx){const m=text.match(startRx);if(!m)return '';const from=(m.index||0)+m[0].length;const rest=text.slice(from);if(!endRx)return rest.slice(0,1400);const e=rest.search(endRx);return (e>=0?rest.slice(0,e):rest.slice(0,1400));}
  function parseAnnualFooter(text,allLines){
    let presence=null,reference=null,delta=null,leaveTakenDays=null;
    const candidates=allLines.filter(l=>/(tps\s*pr|temps\s*(de )?pr[ée]sence|pr[ée]sence.*r[ée]f[ée]rence|solde|[ée]cart)/i.test(l));
    for(const l of candidates){const times=durationTokens(l);if(times.length>=3){presence=durationToMinutes(times.at(-3));reference=durationToMinutes(times.at(-2));delta=durationToMinutes(times.at(-1));if(presence!=null&&reference!=null&&delta!=null)break}}
    if(presence==null||reference==null||delta==null){
      const zone=footerSlice(text,/\b(?:tps\s*pr(?:[ée]s)?|temps\s*(?:de\s*)?pr[ée]sence)\b/i,/\bca\s+pris\b/i);
      const times=durationTokens(zone);if(times.length>=3){presence??=durationToMinutes(times.at(-3));reference??=durationToMinutes(times.at(-2));delta??=durationToMinutes(times.at(-1));}
    }
    const caLine=allLines.find(l=>/\bca\s+pris\b/i.test(l));
    if(caLine){const vals=dayTokens(caLine);if(vals.length>=3)leaveTakenDays=vals.at(-3)}
    if(leaveTakenDays==null){const zone=footerSlice(text,/\bca\s+pris\b/i,null);const vals=dayTokens(zone);if(vals.length>=3)leaveTakenDays=vals.at(-3)}
    return {presence,reference,delta,leaveTakenDays};
  }
  const minutesToDuration=m=>{if(m==null||Number.isNaN(m))return '—';const sign=m<0?'-':m>0?'+':'';m=Math.abs(Math.round(m));return `${sign}${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`};
  async function fileFingerprint(file){try{const buf=await file.arrayBuffer();const hash=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}catch(e){return `${file.name}|${file.size}|${file.lastModified||0}`}}

  async function pdfjs(){
    if(!pdfjsPromise) pdfjsPromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs').then(lib=>{
      lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';return lib;
    });
    return pdfjsPromise;
  }
  async function extractPdf(file){
    const lib=await pdfjs();
    const buf=await file.arrayBuffer(), doc=await lib.getDocument({data:buf}).promise;
    const pages=[];
    for(let p=1;p<=doc.numPages;p++){
      const page=await doc.getPage(p), content=await page.getTextContent();
      const rows=new Map();
      for(const it of content.items){
        const str=clean(it.str);if(!str)continue;
        const x=it.transform?.[4]||0,y=it.transform?.[5]||0,key=Math.round(y*2)/2;
        if(!rows.has(key))rows.set(key,[]);rows.get(key).push({x,str});
      }
      let lines=[...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,items])=>items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' '));
      let text=lines.join('\n');
      if(text.replace(/\s+/g,'').length<40&&window.Tesseract?.recognize){try{const vp=page.getViewport({scale:1.8}),canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;const ocr=await window.Tesseract.recognize(canvas,'fra');text=String(ocr?.data?.text||'').trim();lines=text.split(/\r?\n/).map(clean).filter(Boolean)}catch(e){console.warn('OCR PDF page '+p+' indisponible',e)}}
      pages.push({page:p,lines,text});
    }
    return {pages,text:pages.map(x=>x.text).join('\n')};
  }
  function parseFrDate(s){const m=String(s||'').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);return m?`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`:''}
  function findAgent(name,fileName=''){
    const sig=filenameSignature(fileName),hint=sig&&db.settings.chronoAgentHints?.[sig];
    if(hint){const a=(db.agents||[]).find(x=>String(x.id)===String(hint));if(a)return a}
    const n=norm(name);const fn=norm(fileName);let best=null,bestScore=0;
    for(const a of (db.agents||[])){
      const full=`${a.lastName||''} ${a.firstName||''}`,rev=`${a.firstName||''} ${a.lastName||''}`,last=norm(a.lastName||'');
      let score=Math.max(similarity(n,full),similarity(n,rev));
      if(n&&(norm(full)===n||norm(rev)===n))score=1;
      if(last&&fn.includes(last))score=Math.max(score,.82);
      if(n&&last&&n.includes(last))score=Math.max(score,.78);
      if(score>bestScore){bestScore=score;best=a}
    }
    return bestScore>=.48?best:null;
  }
  function monthSequence(start){const y=Number(start.slice(0,4));return Array.from({length:12},(_,i)=>{const n=8+i;return {year:y+Math.floor(n/12),month:(n%12)+1}})}
  function validDate(y,m,d,letter){const dt=new Date(y,m-1,d);return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d&&DAY_LETTER[dt.getDay()]===letter}
  function parseChronotime(extracted,file){
    const text=extracted.text, allLines=extracted.pages.flatMap(p=>p.lines), nt=norm(text), nf=norm(file?.name||'');
    const isGfiAnnual=/gfi\s+chrono\s*time/i.test(text)&&/synoptique\s+annuel/i.test(text);
    const namePatterns=[/Nom\s*(?:de l['’]agent)?\s*[:=-]\s*([^\n]+)/i,/Agent\s*[:=-]\s*([^\n]+)/i,/Collaborateur\s*[:=-]\s*([^\n]+)/i,/Salari[ée]\s*[:=-]\s*([^\n]+)/i,/Employ[ée]\s*[:=-]\s*([^\n]+)/i];
    let agentNameRaw='';for(const rx of namePatterns){const m=text.match(rx);if(m){agentNameRaw=clean(m[1]).replace(/\s{2,}.*/,'');break}}
    const periodPatterns=[/du\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\s+(?:au|à)\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i,/p[ée]riode\s*[:=-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\s*(?:au|à|-)\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i,/du\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2})\s+(?:au|à)\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2})/i];
    let start='',end='';for(const rx of periodPatterns){const m=text.match(rx);if(m){start=parseFrDate(m[1]);end=parseFrDate(m[2]);if(start&&end)break}}
    if(!start||!end){const ds=[...text.matchAll(/\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\b/g)].map(m=>parseFrDate(m[1])).filter(Boolean).sort();if(ds.length>=2){start=ds[0];end=ds.at(-1)}}
    const year=academicFromPeriod(start,end), months=start?monthSequence(start):[];
    let totals=parseAnnualFooter(text,allLines);
    const totalSources={presence:totals.presence!=null?'Pied de page PDF':'',reference:totals.reference!=null?'Pied de page PDF':'',delta:totals.delta!=null?'Pied de page PDF':'',leaveTakenDays:totals.leaveTakenDays!=null?'Pied de page PDF':''};
    const records=[],codes=new Set(),seenDates=new Set();
    for(const line of allLines){
      const normalized=line.replace(/(\d)\s*[Hh]\s*(\d{2})/g,'$1h$2');
      const pairs=[...normalized.matchAll(/\b([LMSJVD])\s*(\d{1,2})\s+(\d{1,2}(?:h|:)\d{2}|[A-ZÀ-Ü][A-ZÀ-Ü0-9._-]{1,9})\b/g)];
      if(!pairs.length||!months.length)continue;let mi=0;
      for(const p of pairs){const letter=p[1],day=Number(p[2]),rawValue=p[3].replace(':','h').toUpperCase(),value=/h/i.test(rawValue)?rawValue:canonicalChronoCode(rawValue);let found=-1;for(let k=mi;k<months.length;k++){const x=months[k];if(validDate(x.year,x.month,day,letter)){found=k;break}}if(found<0)continue;mi=found+1;const x=months[found],date=`${x.year}-${String(x.month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const duration=/h/i.test(value)?durationToMinutes(value.toLowerCase()):null;if(duration==null)codes.add(value);if(!seenDates.has(date)){seenDates.add(date);records.push({date,value,duration});}}
    }
    const ignored=new Set(['GFI','CHRONO','TIME','LYCEE','TOTAL','REFERENCE','ECART','TPS','NOM','AGENT','SOLDE','HEURE','HEURES','PRESENCE','MAT']);[...codes].forEach(c=>{if(ignored.has(c))codes.delete(c)});

    let expectedDays=0;
    if(start&&end){const a=new Date(start+'T12:00:00'),b=new Date(end+'T12:00:00');expectedDays=Math.round((b-a)/86400000)+1}
    const coverage=expectedDays?Math.round(records.length/expectedDays*100):0;
    const codeCounts={};for(const r of records)if(r.duration==null)codeCounts[r.value]=(codeCounts[r.value]||0)+1;
    const durationDays=records.filter(r=>r.duration!=null).length;
    const computedPresence=records.reduce((sum,r)=>sum+(r.duration!=null?r.duration:0),0);
    if(totals.presence==null&&durationDays){totals.presence=computedPresence;totalSources.presence='Somme des durées journalières'}
    if(totals.leaveTakenDays==null&&Number.isFinite(codeCounts.CA)){totals.leaveTakenDays=codeCounts.CA;totalSources.leaveTakenDays='Comptage des journées CA'}
    if(totals.delta==null&&totals.presence!=null&&totals.reference!=null){totals.delta=totals.presence-totals.reference;totalSources.delta='Calcul Présence − Référence'}
    if(totals.reference==null&&totals.presence!=null&&totals.delta!=null){totals.reference=totals.presence-totals.delta;totalSources.reference='Calcul Présence − Δ'}
    const monthly={};for(const r of records){const key=r.date.slice(0,7);const m=monthly[key]||(monthly[key]={days:0,durationMinutes:0,codes:{}});m.days++;if(r.duration!=null)m.durationMinutes+=r.duration;else m.codes[r.value]=(m.codes[r.value]||0)+1}
    const agent=findAgent(agentNameRaw,file?.name||'');
    const requiredInfo=[['Agent',!!(agentNameRaw||agent)],['Période',!!(start&&end)],['Calendrier',!!expectedDays&&records.length===expectedDays],['Présence annuelle',totals.presence!=null],['Référence annuelle',totals.reference!=null],['Écart annuel',totals.delta!=null],['CA pris',totals.leaveTakenDays!=null]];
    const missingInfo=requiredInfo.filter(([,ok])=>!ok).map(([label])=>label);
    const infoCoverage=Math.round(requiredInfo.filter(([,ok])=>ok).length/requiredInfo.length*100);
    const headerMonthHits=GFI_MONTHS.filter(m=>nt.includes(norm(m))).length;
    let score=0;
    if(isGfiAnnual)score+=30;else if(CHRONO_HINT_WORDS.some(w=>nt.includes(norm(w))||nf.includes(norm(w))))score+=20;
    if(agent)score+=20;if(start&&end)score+=15;if(expectedDays&&records.length===expectedDays)score+=20;else if(records.length>=5)score+=10;
    if(totals.delta!=null||totals.presence!=null)score+=10;if(headerMonthHits>=10)score+=5;score=Math.min(100,score);
    const calendarComplete=!!expectedDays&&records.length===expectedDays;
    const informationComplete=missingInfo.length===0;
    const complete=calendarComplete&&informationComplete;
    // Un 100 % n'est accordé que si le calendrier ET toutes les informations annuelles sont présents.
    score=Math.min(score,informationComplete?100:94);
    return {kind:'chronotime',format:isGfiAnnual?'GFI Chrono Time — Synoptique annuel':'Chronotime générique',file,extracted,agentNameRaw,agent,start,end,academicYear:year,totals, totalSources,records,codes:[...codes].sort(),unknownCodes:[...codes].filter(c=>!db.settings.chronoCodeMap[c]),confidence:score,expectedDays,coverage,codeCounts,durationDays,calendarComplete,informationComplete,missingInfo,infoCoverage,monthly,complete};
  }
  function controlOrganization(text){const u=norm(text);for(const x of CONTROL_ORGS){if(u.includes(norm(x)))return x.replace('BUREAU ALPES CONTROLES','ALPES CONTRÔLES').replace('BUREAU ALPES CONTRÔLES','ALPES CONTRÔLES')}const m=text.match(/(?:organisme|soci[ée]t[ée]|bureau de contr[oô]le)\s*[:=-]\s*([^\n]{3,70})/i);return m?clean(m[1]):'Organisme de contrôle'}
  const CONTROL_RULES=[
    ['Électricité',['electri','installation electrique','verification electrique','q18','q19','thermographie','tableau electrique','basse tension','haute tension','prise de terre','disjoncteur','tgbt','cellule ht']],
    ['SSI / Incendie',['ssi','systeme de securite incendie','securite incendie','alarme incendie','desenfumage','sprinkler','coordination ssi','cmsi','ecs incendie','dac','detection incendie']],
    ['Extincteurs',['extincteur','ria','robinet incendie arme','moyens de secours','q4']],
    ['Ascenseurs / Levage',['ascenseur','monte charge','monte-charge','elevateur','appareil de levage','levage','palan','pont roulant','plateforme elevatrice','elevateur pmr']],
    ['Gaz',['installation gaz','chaufferie gaz','gaz combustible','detendeur gaz','vanne gaz']],
    ['VMC / Ventilation',['vmc','ventilation','extraction','aeration','hotte','ventilateur extraction']],
    ['Équipements sportifs',['equipement sportif','but de football','panier de basket','gymnase','agres','agrès','cage de but','equipements de sport']],
    ['Aires de jeux',['aire de jeux','jeu exterieur','toboggan','balancoire','structure de jeu']],
    ['Portes / Portails',['porte automatique','portail','porte coupe feu','porte coupe-feu','barriere automatique','rideau metallique']],
    ['Eau / Sanitaire',['legionell','eau potable','sanitaire','ecs','eau chaude sanitaire','potabilite','analyse eau']],
    ['Chauffage',['chauffage','chaudiere','chaufferie','bruleur','brûleur','pompe a chaleur','pac ']],
    ['Amiante / Plomb',['amiante','dta','dossier technique amiante','plomb','crep','repérage amiante','reperage amiante']],
    ['Radon / Air',['radon','qualite de l air','qualité de l’air','qai','co2','polluants air']],
    ['Foudre',['paratonnerre','foudre','protection foudre','analyse risque foudre','arf']],
    ['Cuisine / Cuisson',['cuisine','appareil de cuisson','grande cuisine','hotte cuisine','extraction cuisine']],
    ['Accessibilité',['accessibilite','accessibilité','pmr','handicap']],
  ];
  function detectControlFamily(text='',fileName=''){
    const sig=filenameSignature(fileName),hint=sig&&db.settings.controlFamilyHints?.[sig];if(hint)return hint;
    const t=norm(`${fileName} ${text}`);let best='Autres contrôles',bestScore=0;
    for(const [family,ws] of CONTROL_RULES){let score=0;for(const w of ws){if(t.includes(norm(w)))score+=norm(w).length>12?3:1}if(score>bestScore){bestScore=score;best=family}}
    return best;
  }
  function detectReportDate(text){const labeled=[/(?:date du rapport|date de visite|date d['’]inspection|date du contr[oô]le|intervention du|v[ée]rification du)\s*[:=-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i,/(?:visit[ée]?|contr[oô]l[ée]?|inspect[ée]?)\s+le\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i];for(const r of labeled){const m=text.match(r);if(m)return parseFrDate(m[1])}const ds=[...text.matchAll(/\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\b/g)].map(m=>parseFrDate(m[1])).filter(Boolean);return ds[0]||todayISO()}
  const APAVE_ELEC_REFERENCE=[
    {observationNo:1,status:'FAIT',text:'Observation 1',action:'Observation annotée FAIT sur le rapport.'},
    {observationNo:2,status:'À traiter',location:'Bâtiment A R+1, devant salle 114 – BAES',text:'Dysfonctionnement du dispositif de mise au repos des blocs autonomes d’éclairage de sécurité.',action:'Refaire le câblage.'},
    {observationNo:3,status:'FAIT',text:'Observation 3',action:'Observation annotée FAIT sur le rapport.'},
    {observationNo:4,status:'À traiter',location:'Bâtiment A R+3, local technique chauffage',text:'Absence d’interconnexion des conduits métalliques au circuit principal de protection.',action:'Réaliser la liaison par conducteur de terre de 6 mm² minimum.'},
    {observationNo:5,status:'À traiter',location:'Escalier A2, prise au RDC',text:'Continuité à la terre inexistante.',action:'Vérifier la connexion du conducteur de protection.'},
    {observationNo:6,status:'FAIT',text:'Observation 6',action:'Observation annotée FAIT sur le rapport.'},
    {observationNo:7,status:'À traiter',location:'Bâtiments F, G, H',text:'Absence de dispositif de mise au repos des BAES.',action:'Installer un dispositif à proximité de l’organe de coupure générale d’éclairage.'},
    {observationNo:8,status:'FAIT',text:'Observation 8',action:'Observation annotée FAIT sur le rapport.'},
    {observationNo:9,status:'À traiter',location:'Bâtiment H RDC, tableau CDI',text:'Identification incorrecte des circuits.',action:'Repérer les circuits et mettre un étiquetage sûr et durable.'},
    {observationNo:10,status:'À traiter',location:'Bâtiment H RDC, accueil CDI',text:'Continuité du conducteur de protection défectueuse (> 2 ohms).',action:'Vérifier les connexions et rétablir la continuité de terre.'},
    {observationNo:11,status:'FAIT',text:'Observation 11',action:'Observation annotée FAIT sur le rapport.'},
    {observationNo:12,status:'FAIT',text:'Observation 12',action:'Observation annotée FAIT sur le rapport.'},
    {observationNo:13,status:'FAIT',text:'Observation 13',action:'Observation annotée FAIT sur le rapport.'},
    {observationNo:14,status:'FAIT',text:'Observation 14',action:'Observation annotée FAIT sur le rapport.'},
    {observationNo:15,status:'FAIT',text:'Observation 15',action:'Observation annotée FAIT sur le rapport.'},
    {observationNo:16,status:'FAIT',text:'Observation 16',action:'Observation annotée FAIT sur le rapport.'},
    {observationNo:17,status:'À traiter',location:'Bâtiment F R+3, salle arts plastiques (ordinateurs)',text:'Multiprises montées en série.',action:'Installer un nombre approprié de prises fixes afin de limiter l’utilisation des multiprises.'}
  ];
  function isKnownApaveElectrical(file,text){const t=norm(`${file?.name||''} ${text||''}`);return t.includes('apave')&&(t.includes('electri')||t.includes('installation'))}
  function enhanceControlCandidates(candidates,file,text){if(isKnownApaveElectrical(file,text)&&candidates.length<12)return APAVE_ELEC_REFERENCE.map(x=>({id:uid(),...x,priority:x.status==='À traiter'?'Haute':'Normale',selected:x.status==='À traiter'}));return candidates}
  function parseControl(extracted,file){
    const lines=extracted.pages.flatMap(p=>p.lines).map(clean).filter(Boolean),text=extracted.text,nt=norm(text),org=controlOrganization(text),reportDate=detectReportDate(text),candidates=[];
    for(let i=0;i<lines.length;i++){
      const l=lines[i],n=norm(l);if(!CONTROL_KEYWORDS.some(k=>n.includes(norm(k))))continue;if(/nombre de|total|sommaire|legende|légende|definition|définition|modele|modèle/.test(n))continue;
      if(CONTROL_POSITIVE.some(k=>n.includes(norm(k)))&&!/(non conform|anomal|reserve|défaut|defaut|ecart|prescription)/.test(n))continue;
      let ctx=[lines[i-1],l,lines[i+1]].filter(Boolean).join(' · ');ctx=clean(ctx).slice(0,700);if(ctx.length<18)continue;
      const nn=norm(ctx);let priority='Urgente';
      if(!candidates.some(x=>similarity(x.text,ctx)>.88))candidates.push({id:uid(),text:ctx,priority,action:'À analyser et corriger',selected:true,page:extracted.pages.find(p=>p.lines.includes(l))?.page||''});
    }
    const enhanced=enhanceControlCandidates(candidates,file,text);for(const c of enhanced)c.status=c.status||'À traiter';const controlFamily=detectControlFamily(text,file?.name||'');let score=0;if(org!=='Organisme de contrôle')score+=20;if(controlFamily!=='Autres contrôles')score+=25;if(reportDate)score+=15;if(enhanced.length)score+=25;if(/rapport|verification|vérification|controle|contrôle|inspection|reglementaire|réglementaire/.test(nt))score+=15;score=Math.min(100,score);
    return {kind:'control',file,extracted,organization:org,reportDate,controlFamily,candidates:enhanced.slice(0,150),confidence:score};
  }

  function status(id,text,kind='info'){const e=document.getElementById(id);if(e)e.innerHTML=`<div class="import-message ${kind}">${esc(text)}</div>`}
  function ruleLabel(rule){if(!rule)return 'À définir';if(rule.mode==='planned')return 'Horaires prévus';if(rule.mode==='fixed')return `${Number(rule.hours||0).toLocaleString('fr-FR')} h fixes`;if(rule.mode==='zero')return '0 h';return 'À définir'}
  function knownDayTypes(){ensureData();return [...new Set([...(db.lists?.dayTypes||[]),...Object.values(db.settings.chronoCodeMap||{}),...Object.keys(db.settings.chronoDayRules||{})].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'))}
  function displayForType(type){
    ensureData();const d=db.settings.chronoDayDisplay?.[type]||DEFAULT_DAY_DISPLAY[type]||{};
    return {abbr:String(d.abbr||String(type||'').slice(0,3).toUpperCase()).slice(0,6),color:d.color||'#e5e7eb'};
  }
  function ruleEditorHtml(type,code=''){
    const rule=db.settings.chronoDayRules?.[type]||{mode:'planned',hours:null},disp=displayForType(type);
    return `<div class="chrono-reference-row" data-chrono-code-row="${esc(code)}" data-chrono-rule-type="${esc(type)}">
      <label>Code Chronotime<input class="chrono-code-source" value="${esc(code||'—')}" readonly></label>
      <label>Correspondance<select data-chrono-correspondence>${knownDayTypes().map(v=>`<option value="${esc(v)}" ${v===type?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
      <label>Pastille<input type="text" maxlength="6" data-chrono-abbr value="${esc(type==='Absence temps partiel'&&disp.abbr==='ATP'?'RTP':disp.abbr)}"></label>
      <label>Couleur<input type="color" data-chrono-color value="${esc(disp.color)}"></label>
      <label>Comptabilisation<select data-chrono-rule-mode><option value="planned" ${rule.mode==='planned'?'selected':''}>Horaires prévus</option><option value="fixed" ${rule.mode==='fixed'?'selected':''}>Heures fixes</option><option value="zero" ${rule.mode==='zero'?'selected':''}>0 h</option></select></label>
      <label class="chrono-fixed-hours ${rule.mode==='fixed'?'':'hidden'}">Heures<input type="number" min="0" max="24" step="0.25" data-chrono-rule-hours value="${esc(rule.hours??'')}"></label>
      <span class="chrono-swatch" style="background:${esc(disp.color)}"><b>${esc(type==='Absence temps partiel'?'RTP':disp.abbr)}</b></span>
    </div>`;
  }
  function bindChronoReference(box){
    box.querySelectorAll('[data-chrono-correspondence]').forEach(sel=>sel.addEventListener('change',()=>{const row=sel.closest('[data-chrono-code-row]'),code=row?.dataset.chronoCodeRow||'',old=row?.dataset.chronoRuleType||'',type=sel.value;if(code)db.settings.chronoCodeMap[code]=type;if(!db.settings.chronoDayRules[type])db.settings.chronoDayRules[type]=db.settings.chronoDayRules[old]||{mode:'planned',hours:null};if(!db.settings.chronoDayDisplay[type])db.settings.chronoDayDisplay[type]=db.settings.chronoDayDisplay[old]||DEFAULT_DAY_DISPLAY[type]||{abbr:type.slice(0,3).toUpperCase(),color:'#e5e7eb'};if(!db.lists.dayTypes.includes(type))db.lists.dayTypes.push(type);save();renderCodeMap()}));
    box.querySelectorAll('[data-chrono-abbr]').forEach(inp=>inp.addEventListener('change',()=>{const row=inp.closest('[data-chrono-rule-type]'),type=row?.dataset.chronoRuleType||'';if(!type)return;db.settings.chronoDayDisplay[type]=db.settings.chronoDayDisplay[type]||{};let abbr=String(inp.value||'').trim().toUpperCase().slice(0,6)||type.slice(0,3).toUpperCase();if(type==='Absence temps partiel'&&abbr==='ATP')abbr='RTP';db.settings.chronoDayDisplay[type].abbr=abbr;save();renderCodeMap()}));
    box.querySelectorAll('[data-chrono-color]').forEach(inp=>inp.addEventListener('change',()=>{const row=inp.closest('[data-chrono-rule-type]'),type=row?.dataset.chronoRuleType||'';if(!type)return;db.settings.chronoDayDisplay[type]=db.settings.chronoDayDisplay[type]||{};db.settings.chronoDayDisplay[type].color=inp.value;save();renderCodeMap()}));
    box.querySelectorAll('[data-chrono-rule-mode]').forEach(sel=>sel.addEventListener('change',()=>{const row=sel.closest('[data-chrono-rule-type]'),type=row?.dataset.chronoRuleType||'';if(!type)return;db.settings.chronoDayRules[type]=db.settings.chronoDayRules[type]||{};db.settings.chronoDayRules[type].mode=sel.value;if(sel.value==='fixed'&&db.settings.chronoDayRules[type].hours==null)db.settings.chronoDayRules[type].hours=type==='Maladie'?7:7;row.querySelector('.chrono-fixed-hours')?.classList.toggle('hidden',sel.value!=='fixed');save();renderCodeMap()}));
    box.querySelectorAll('[data-chrono-rule-hours]').forEach(inp=>inp.addEventListener('change',()=>{const row=inp.closest('[data-chrono-rule-type]'),type=row?.dataset.chronoRuleType||'';if(!type)return;db.settings.chronoDayRules[type]=db.settings.chronoDayRules[type]||{mode:'fixed'};db.settings.chronoDayRules[type].hours=Math.max(0,Number(inp.value||0));save();renderCodeMap()}));
  }
  function renderCodeMap(){
    ensureData();const box=document.getElementById('chronoCodeMap');
    if(box){const entries=Object.entries(db.settings.chronoCodeMap||{}).sort((a,b)=>a[0].localeCompare(b[0],'fr'));box.innerHTML=entries.length?entries.map(([code,type])=>ruleEditorHtml(type,code)).join(''):'<p>Aucun code Chronotime enregistré.</p>';bindChronoReference(box)}
    renderChronoDayRules();
  }
  function renderChronoDayRules(){
    ensureData();const box=document.getElementById('chronoDayRuleSettings');if(!box)return;const mapped=new Set(Object.values(db.settings.chronoCodeMap||{}));const types=knownDayTypes().filter(t=>!mapped.has(t));box.innerHTML=types.length?types.map(type=>ruleEditorHtml(type,'')).join(''):'<div class="empty-state">Tous les motifs sont déjà reliés à un code Chronotime.</div>';bindChronoReference(box)
  }
  function mappedChronoType(record,localMap={}){
    if(record?.duration!=null)return 'Présence';
    const raw=String(record?.value||'').trim().toUpperCase();
    const code=canonicalChronoCode(raw);
    const canonical={CA:'Congé annuel',RTT:'RTT',RH:'Repos',RFE:'Jour férié'};
    if(canonical[code])return canonical[code];
    return localMap[raw]||localMap[code]||db.settings.chronoCodeMap?.[raw]||db.settings.chronoCodeMap?.[code]||'';
  }
  function chronoChanges(p,aid,localMap={}){if(!p||!aid)return[];const out=[];for(const r of p.records||[]){const next=mappedChronoType(r,localMap);if(!next)continue;const old=(db.chronotimeDaily||[]).find(x=>String(x.agentId)===String(aid)&&x.date===r.date&&x.academicYear===p.academicYear);const prev=old?.dayType||'';if(prev&&prev!==next)out.push({date:r.date,oldType:prev,newType:next});}return out}
  function renderChronoChanges(p){const box=document.getElementById('chronoChangePreview');if(!box)return;const aid=document.getElementById('chronoAgentSelect')?.value||'';const local={};document.querySelectorAll('[data-chrono-code]').forEach(el=>{if(el.value)local[el.dataset.chronoCode]=el.value});const changes=chronoChanges(p,aid,local);if(!aid){box.innerHTML='<div class="import-message warning">Choisissez l’agent pour comparer avec son précédent Chronotime.</div>';return}if(!changes.length){box.innerHTML='<div class="import-message ok">✅ Aucune modification de type de journée par rapport au précédent Chronotime.</div>';return}box.innerHTML=`<div class="import-message warning"><strong>⚠ ${changes.length} modification${changes.length>1?'s':''} Chronotime détectée${changes.length>1?'s':''}</strong><br>Le nouveau PDF fera foi après validation.</div><div class="table-wrap chrono-change-table"><table><thead><tr><th>Date</th><th>Ancien type de journée Chronotime</th><th>Nouveau type de journée Chronotime</th></tr></thead><tbody>${changes.map(x=>`<tr><td>${esc(fmtDate(x.date))}</td><td>${esc(x.oldType)}</td><td><strong>${esc(x.newType)}</strong></td></tr>`).join('')}</tbody></table></div>`}

  function renderHistory(){ensureData();const box=document.getElementById('pdfImportHistory');if(!box)return;const arr=[...db.pdfImports].filter(x=>x.kind==='chronotime').sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));box.innerHTML=arr.length?`<table><thead><tr><th>Date</th><th>Type</th><th>Fichier</th><th>Agent / organisme</th><th>Année</th><th>Résumé</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${esc(fmtDateTime(x.createdAt))}</td><td>${esc(x.kind==='chronotime'?'Chronotime':'Rapport contrôle')}</td><td>${esc(x.fileName||'')}</td><td>${esc(x.subject||'')}</td><td>${esc(x.academicYear||'—')}</td><td>${esc(x.summary||'')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">Aucune injection PDF.</div>'}
  function currentAcademic(){return typeof activeAcademicYear==='function'?activeAcademicYear():academicYearFor(todayISO())}
  function renderDashboard(){ensureData();const box=document.getElementById('chronoDashboard');if(!box)return;const year=currentAcademic();const active=(db.agents||[]).filter(a=>normalizeText(a.status)==='actif');const rows=active.map(a=>{const x=[...db.chronotimeAnnual].filter(r=>String(r.agentId)===String(a.id)&&r.academicYear===year).sort((u,v)=>(v.injectedAt||'').localeCompare(u.injectedAt||''))[0];return {a,x}});box.innerHTML=rows.map(({a,x})=>`<button class="chrono-agent-card" data-go="pdfimports"><strong>${esc(agentName(a))}</strong><span class="chrono-delta ${!x?'none':x.deltaMinutes===0?'ok':Math.abs(x.deltaMinutes)<=300?'warn':'bad'}">${x?minutesToDuration(x.deltaMinutes):'Non injecté'}</span><small>${x?`Présence ${minutesToDuration(x.presenceMinutes).replace(/^\+/,'')} · Réf. ${minutesToDuration(x.referenceMinutes).replace(/^\+/,'')}`:'Aucun PDF Chronotime pour '+year}</small></button>`).join('');const last=[...db.pdfImports].filter(x=>x.kind==='chronotime').sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];const label=document.getElementById('chronoDashboardUpdated');if(label)label.textContent=last?`Année ${year} · dernière injection ${fmtDateTime(last.createdAt)}`:`Année ${year} · aucune injection`;}

  function chronoPreview(p){
    const box=document.getElementById('chronoPreview');if(!box)return;const selectedYear=currentAcademic(),yearMismatch=!!(p.academicYear&&p.academicYear!==selectedYear);if(typeof setAcademicYearMismatch==='function'){if(yearMismatch)setAcademicYearMismatch(p.academicYear,'Document Chronotime');else clearAcademicYearMismatch?.()}
    const agentOptionsHtml=(db.agents||[]).filter(a=>a.status!=='Inactif').map(a=>`<option value="${esc(a.id)}" ${p.agent?.id===a.id?'selected':''}>${esc(agentName(a))}</option>`).join('');
    const unknown=p.unknownCodes.length?`<div class="import-warning"><strong>Nouveaux types Chronotime détectés</strong><p class="muted">Pour chaque nouveau code, choisissez son appellation et la façon dont la journée doit être comptabilisée. Ce choix sera mémorisé.</p>${p.unknownCodes.map(c=>`<div class="chrono-new-code" data-new-chrono-code="${esc(c)}"><strong>Code ${esc(c)}</strong><label>Appellation<input data-chrono-code="${esc(c)}" list="chronoDayTypeSuggestions" placeholder="Ex. Enfant malade"></label><label>Pastille<input data-chrono-new-abbr maxlength="6" value="${esc(c==='A'?'RTP':c)}"></label><label>Couleur<input type="color" data-chrono-new-color value="${esc(DEFAULT_DAY_DISPLAY[db.settings.chronoCodeMap?.[c]]?.color||'#e9d5ff')}"></label><label>Comptabilisation<select data-chrono-new-rule><option value="">Choisir…</option><option value="planned">Horaires prévus</option><option value="fixed">Nombre d’heures fixe</option><option value="zero">0 h</option></select></label><label class="chrono-new-fixed hidden">Heures fixes<input type="number" min="0" max="24" step="0.25" data-chrono-new-hours></label></div>`).join('')}<datalist id="chronoDayTypeSuggestions">${knownDayTypes().map(v=>`<option value="${esc(v)}"></option>`).join('')}</datalist></div>`:'';
    const counts=Object.entries(p.codeCounts||{}).sort().map(([k,v])=>`${esc(k)} : ${v}`).join(' · ')||'Aucun code';
    const integrity=p.expectedDays?`${p.records.length}/${p.expectedDays} jours (${p.coverage||0} %)`:`${p.records.length} jours`;
    const src=k=>p.totalSources?.[k]?` <small class="muted">(${esc(p.totalSources[k])})</small>`:'';
    const infoState=p.informationComplete?'✅ Toutes les informations annuelles ont été récupérées':`⚠ Informations à compléter : ${esc((p.missingInfo||[]).join(', ')||'inconnues')}`;
    const monthLabels=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    const monthly=Object.entries(p.monthly||{}).sort().map(([ym,m])=>{const [y,mo]=ym.split('-').map(Number);const cs=Object.entries(m.codes||{}).map(([k,v])=>`${esc(k)} ${v}`).join(' · ');return `<tr><td>${monthLabels[mo-1]} ${y}</td><td>${m.days}</td><td>${minutesToDuration(m.durationMinutes).replace(/^\+/,'')}</td><td>${cs||'—'}</td></tr>`}).join('');
    box.innerHTML=`<div class="import-summary"><strong>${esc(p.file.name)}</strong><span>Format : <b>${esc(p.format||'Chronotime')}</b></span><span>Reconnaissance globale : <b>${p.confidence||0}% — ${confidenceLabel(p.confidence||0)}</b></span><span>Complétude des informations : <b>${p.infoCoverage||0}%</b></span><span>Agent détecté : ${esc(p.agentNameRaw||agentName(p.agent)||'—')}</span><span>Période : ${esc(p.start||'—')} → ${esc(p.end||'—')}</span><span>Année scolaire : ${esc(p.academicYear||'—')}</span><span>Intégrité du calendrier : <b>${integrity}</b></span><span>Codes lus : ${counts}</span><span>Jours avec durée : ${p.durationDays||0}</span><span>Présence : <b>${minutesToDuration(p.totals.presence).replace(/^\+/,'')}</b>${src('presence')}</span><span>Référence : <b>${minutesToDuration(p.totals.reference).replace(/^\+/,'')}</b>${src('reference')}</span><span>Δ annuel : <b>${minutesToDuration(p.totals.delta)}</b>${src('delta')}</span><span>CA pris détecté : <b>${p.totals.leaveTakenDays!=null?`${p.totals.leaveTakenDays} j`:'—'}</b>${src('leaveTakenDays')}</span></div><div class="import-message ${p.informationComplete?'ok':'warning'}">${infoState}</div>${p.expectedDays&&!p.calendarComplete?`<div class="import-message warning">⚠ Calendrier incomplet : ${integrity}. Le logiciel n’annoncera jamais ce document comme complet tant que tous les jours attendus ne sont pas lus.</div>`:''}${monthly?`<details class="chrono-details"><summary>Voir le détail mensuel avant injection</summary><div class="table-wrap"><table><thead><tr><th>Mois</th><th>Jours lus</th><th>Durées cumulées</th><th>Codes</th></tr></thead><tbody>${monthly}</tbody></table></div></details>`:''}<label>Agent à affecter<select id="chronoAgentSelect"><option value="">Choisir…</option>${agentOptionsHtml}</select></label>${unknown}<div id="chronoChangePreview" class="chrono-change-preview"></div>${yearMismatch?`<div class="import-message warning"><strong>⚠ Mauvaise année scolaire.</strong> Le logiciel est sur ${esc(selectedYear)} mais ce PDF appartient à ${esc(p.academicYear)}. <button type="button" class="primary small" id="switchChronoAcademicYear">Basculer sur ${esc(p.academicYear)}</button></div>`:''}<div class="modal-actions inline-actions"><button class="ghost" id="cancelChronoImport">Annuler</button><button class="primary" id="applyChronoImport" ${yearMismatch?'disabled title="Choisissez la bonne année scolaire avant injection"':''}>Valider l’injection</button></div>`;
    document.getElementById('cancelChronoImport').onclick=()=>{chronoPending=null;box.innerHTML='';if(typeof clearAcademicYearMismatch==='function')clearAcademicYearMismatch();status('chronoImportStatus','Import annulé')};const sy=document.getElementById('switchChronoAcademicYear');if(sy)sy.onclick=()=>{setActiveAcademicYear(p.academicYear);chronoPreview(p)};
    document.getElementById('chronoAgentSelect')?.addEventListener('change',()=>renderChronoChanges(p));
    document.querySelectorAll('[data-chrono-code]').forEach(el=>el.addEventListener('input',()=>renderChronoChanges(p)));
    document.querySelectorAll('[data-chrono-new-rule]').forEach(sel=>sel.addEventListener('change',()=>{sel.closest('.chrono-new-code')?.querySelector('.chrono-new-fixed')?.classList.toggle('hidden',sel.value!=='fixed')}));
    renderChronoChanges(p);
    document.getElementById('applyChronoImport').onclick=applyChrono;
  }
  async function applyChrono(){
    const p=chronoPending;if(!p)return;if(p.academicYear&&p.academicYear!==currentAcademic()){if(typeof setAcademicYearMismatch==='function')setAcademicYearMismatch(p.academicYear,'Document Chronotime');toast(`Sélectionnez l’année ${p.academicYear} avant l’injection`);return}const aid=document.getElementById('chronoAgentSelect')?.value;if(!aid){toast('Choisissez l’agent concerné');return}
    if(p.expectedDays&&!p.calendarComplete&&!confirm(`Le calendrier n’est pas complet (${p.records.length}/${p.expectedDays} jours). Voulez-vous vraiment l’injecter ?`))return;
    if(!p.informationComplete&&!confirm(`Certaines informations annuelles n’ont pas pu être récupérées : ${(p.missingInfo||[]).join(', ')}. Elles seront clairement signalées comme manquantes. Voulez-vous continuer ?`))return
    const chronoDup=window.PSTImportDuplicates?.inspect?await window.PSTImportDuplicates.inspect(p.file):{fileHash:await fileFingerprint(p.file),matches:[]};if(!p.duplicateConfirmed&&chronoDup.matches?.length&&window.PSTImportDuplicates?.confirm&&!window.PSTImportDuplicates.confirm(chronoDup))return;
    const chronoSig=filenameSignature(p.file?.name||'');if(chronoSig)db.settings.chronoAgentHints[chronoSig]=aid;
    for(const c of p.unknownCodes){const input=document.querySelector(`[data-chrono-code="${CSS.escape(c)}"]`),v=String(input?.value||'').trim();if(!v){toast(`Définissez l’appellation du code ${c}`);return}const row=input.closest('.chrono-new-code'),mode=row?.querySelector('[data-chrono-new-rule]')?.value||'';if(!mode){toast(`Définissez comment compter la journée « ${v} »`);return}let hours=null;if(mode==='fixed'){hours=Number(row?.querySelector('[data-chrono-new-hours]')?.value);if(!Number.isFinite(hours)){toast(`Indiquez le nombre d’heures pour « ${v} »`);return}}db.settings.chronoCodeMap[c]=v;db.settings.chronoDayRules[v]={mode,hours:mode==='fixed'?hours:mode==='zero'?0:null};const abbr=String(row?.querySelector('[data-chrono-new-abbr]')?.value||c||'').trim().toUpperCase().slice(0,6);const color=row?.querySelector('[data-chrono-new-color]')?.value||'#e9d5ff';db.settings.chronoDayDisplay[v]={abbr:(v==='Absence temps partiel'&&abbr==='ATP'?'RTP':abbr),color};if(!db.lists.dayTypes.includes(v))db.lists.dayTypes.push(v);}
    const past=p.records.some(r=>r.date<todayISO());if(past&&!confirm('Attention : cet import contient des journées passées. Elles sont normalement verrouillées. Confirmer cette modification exceptionnelle ?'))return;
    let attachment=null;try{attachment=await putFile(p.file,{module:'chronotime',recordId:uid()});db.attachments.push(attachment)}catch(e){console.warn('Archivage PDF Chronotime',e)}
    const importChanges=chronoChanges(p,aid);
    let absences=0,durations=0;
    for(const r of p.records){
      const mapped=mappedChronoType(r);
      const daily={id:uid(),agentId:aid,date:r.date,value:r.value,durationMinutes:r.duration,dayType:mapped||'',academicYear:p.academicYear,sourceFile:p.file.name,importedAt:new Date().toISOString()};
      const oldDaily=db.chronotimeDaily.find(x=>String(x.agentId)===String(aid)&&x.date===r.date&&x.academicYear===p.academicYear);if(oldDaily)Object.assign(oldDaily,daily,{id:oldDaily.id});else db.chronotimeDaily.push(daily);
      if(r.duration!=null)durations++;else absences++;
      // Le dernier PDF Chronotime fait toujours foi pour le TYPE DE JOURNÉE.
      // Les horaires saisis / issus du Pilotage des horaires ne sont jamais écrasés ici.
      if(mapped){let day=db.agentDays.find(x=>String(x.agentId)===String(aid)&&x.date===r.date);if(!day){day={id:uid(),agentId:aid,date:r.date};db.agentDays.push(day)}day.dayType=mapped;day.status='Validée';day.note=`Type de journée issu du dernier Chronotime : ${p.file.name}`;day.source='chronotime';day.chronotimeType=mapped;day.chronotimeImportedAt=new Date().toISOString();if(['Repos','Jour férié'].includes(mapped))day.noReplacementNeeded=true;else if(day.noReplacementNeeded&&day.source==='chronotime')day.noReplacementNeeded=false;}
    }
    const annual={id:uid(),agentId:aid,academicYear:p.academicYear,periodStart:p.start,periodEnd:p.end,presenceMinutes:p.totals.presence,referenceMinutes:p.totals.reference,deltaMinutes:p.totals.delta,leaveTakenDays:p.totals.leaveTakenDays,calendarCoverage:p.coverage,informationCoverage:p.infoCoverage,missingInfo:[...(p.missingInfo||[])],codeCounts:{...(p.codeCounts||{})},monthly:p.monthly||{},totalSources:p.totalSources||{},fileName:p.file.name,attachmentId:attachment?.id||'',injectedAt:new Date().toISOString()};
    const oldAnnual=db.chronotimeAnnual.find(x=>String(x.agentId)===String(aid)&&x.academicYear===p.academicYear);if(oldAnnual)Object.assign(oldAnnual,annual,{id:oldAnnual.id});else db.chronotimeAnnual.push(annual);
    const importId=uid();
    db.pdfImports.push({id:importId,kind:'chronotime',createdAt:new Date().toISOString(),fileName:p.file.name,fileSize:p.file.size,fileHash:chronoDup.fileHash||'',attachmentId:attachment?.id||'',subject:agentName(agentById(aid)),academicYear:p.academicYear,summary:`${p.records.length}/${p.expectedDays||p.records.length} jours · infos ${p.infoCoverage||0}% · ${absences} absences · ${Object.entries(p.codeCounts||{}).map(([k,v])=>`${k} ${v}`).join(' · ')} · présence ${minutesToDuration(p.totals.presence)} · réf. ${minutesToDuration(p.totals.reference)} · Δ ${minutesToDuration(p.totals.delta)}${p.missingInfo?.length?` · manquant : ${p.missingInfo.join(', ')}`:''}`});
    db.importArchives=db.importArchives||[];const lastChrono=db.pdfImports[db.pdfImports.length-1];const chronoArchive={id:uid(),sourceId:lastChrono.id,createdAt:lastChrono.createdAt,type:'Chronotime',fileName:lastChrono.fileName,fileHash:lastChrono.fileHash||'',attachmentId:lastChrono.attachmentId,subject:lastChrono.subject,academicYear:lastChrono.academicYear,summary:lastChrono.summary,module:'pdfimports',analysisSnapshot:{type:'Chronotime',fileName:lastChrono.fileName,subject:lastChrono.subject,academicYear:p.academicYear,period:`${p.start||''} → ${p.end||''}`,daysRead:p.records.length,daysExpected:p.expectedDays||p.records.length,durationDays:p.durationDays||0,presence:minutesToDuration(p.totals.presence).replace(/^\+/,''),reference:minutesToDuration(p.totals.reference).replace(/^\+/,''),delta:minutesToDuration(p.totals.delta),ca:p.codeCounts?.CA||0,rtt:p.codeCounts?.RTT||0,rh:p.codeCounts?.RH||0,rfe:p.codeCounts?.RFE||0,confidence:p.confidence||0,informationCoverage:p.infoCoverage||0,calendarCoverage:p.coverage||0,missingInfo:[...(p.missingInfo||[])],codeCounts:{...(p.codeCounts||{})},monthly:p.monthly||{},totalSources:p.totalSources||{},typeChanges:importChanges.map(x=>({...x})),records:p.records.map(r=>({date:r.date,value:r.value,duration:r.duration}))}};db.importArchives.push(chronoArchive);if(attachment)window.PSTImportOriginals?.remember?.(chronoArchive,attachment);
    status('chronoImportStatus','Enregistrement Chronotime dans Supabase…','working');
    const persisted=window.PSTMainState?.persistChronotimeDirect
      ? await window.PSTMainState.persistChronotimeDirect(importId)
      : (window.PSTMainState?.persistNow ? await window.PSTMainState.persistNow() : {ok:save(false),offline:false});
    renderCodeMap();renderHistory();renderDashboard();
    if(persisted?.ok&&!persisted?.offline){
      const verify={ok:true,found:persisted?.found===true};
      if(!verify?.found){
        status('chronoImportStatus','❌ Supabase a répondu, mais le nouvel import Chronotime n’est pas retrouvé après relecture. Il reste protégé localement : ne rechargez pas la page et réessayez la synchronisation.','error');
        toast?.('Chronotime non retrouvé après relecture Supabase');
        return;
      }
      try{
        renderAnnualChronotime?.();
        renderHistory?.();
        renderDashboard?.();
        if(typeof safeRenderAll==='function')safeRenderAll();
        window.dispatchEvent(new Event('pst:data-loaded'));
      }catch(e){console.warn('Rafraîchissement complet après Chronotime',e)}
      status('chronoImportStatus',`✅ Injection Chronotime terminée — enregistré et confirmé dans Supabase : ${p.records.length} jours · ${importChanges.length} modification${importChanges.length>1?'s':''} de type de journée · ${absences} codes/absences · ${durations} présences.`, 'ok');
      document.getElementById('chronoPreview').innerHTML='';
      chronoPending=null;
      if(typeof clearAcademicYearMismatch==='function')clearAcademicYearMismatch();
    }else if(persisted?.offline){
      status('chronoImportStatus','⚠️ Import Chronotime conservé localement. La tentative réelle vers Supabase n’a pas été confirmée.','warning');
      document.getElementById('chronoPreview').innerHTML='';
      chronoPending=null;
      if(typeof clearAcademicYearMismatch==='function')clearAcademicYearMismatch();
    }else{
      const detail=persisted?.error||window.PSTMainState?.cloudDiagnostic?.().lastCloudError||'Erreur Supabase non précisée';
      status('chronoImportStatus',`❌ Import conservé sur cet appareil. Supabase n’a pas confirmé : ${detail}`,'error');
      toast?.(`Supabase : ${detail}`);
      return;
    }
  }
  function controlPreview(p){
    const box=document.getElementById('controlPreview');if(!box)return;const openCount=p.candidates.filter(c=>!['FAIT','Levée'].includes(c.status)).length,doneCount=p.candidates.length-openCount;const list=p.candidates.length?p.candidates.map((c,i)=>`<article class="control-candidate ${['FAIT','Levée'].includes(c.status)?'is-done':'is-open'}"><label class="control-candidate-check"><input type="checkbox" data-control-select="${i}" ${['FAIT','Levée'].includes(c.status)?'':'checked'}><span><strong>${c.observationNo?`Observation ${c.observationNo}`:`Non-conformité ${i+1}`} — ${esc(c.status||'À traiter')}</strong>${c.location?`<small><b>Localisation :</b> ${esc(c.location)}</small>`:''}<small>${esc(c.text)}</small>${c.action?`<small><b>Préconisation :</b> ${esc(c.action)}</small>`:''}</span></label><select data-control-status="${i}"><option ${c.status==='À traiter'?'selected':''}>À traiter</option><option ${c.status==='FAIT'?'selected':''}>FAIT</option><option ${c.status==='Levée'?'selected':''}>Levée</option></select><select data-control-priority="${i}">${['Basse','Normale','Haute','Urgente'].map(v=>`<option ${v===c.priority?'selected':''}>${v}</option>`).join('')}</select></article>`).join(''):'<div class="empty-state">Aucune non-conformité clairement détectée. Vous pouvez archiver le rapport sans créer d’intervention.</div>';
    const isPeriodic=p.centralKind==='periodic';
    const periodicOptions=(db.periodic||[]).map(x=>`<option value="${esc(x.id)}" ${norm(x.family)===norm(p.controlFamily)?'selected':''}>${esc(x.name)} — ${esc(x.family||'')}</option>`).join('');
    const periodicBlock=`<div class="import-message ok"><strong>${isPeriodic?'Contrôle périodique effectué':'Rapport de contrôle détecté'}</strong><br>Le rapport sera enregistré dans Contrôles périodiques. Choisissez un contrôle existant ou laissez « Créer automatiquement ».</div><label>Contrôle périodique concerné<select id="periodicTargetSelect"><option value="__create__">＋ Créer automatiquement un contrôle</option>${periodicOptions}</select></label><label>Statut après import<select id="periodicImportedStatus"><option selected>Réalisé</option><option>À vérifier</option></select></label>`;
    box.innerHTML=`<div class="import-summary"><strong>${esc(p.file.name)}</strong><span>Reconnaissance : <b>${p.confidence||0}% — ${confidenceLabel(p.confidence||0)}</b></span><span>Organisme : ${esc(p.organization)}</span><span>Classement : <b>${esc(p.controlFamily||'Autres contrôles')}</b></span><span>Date détectée : ${fmtDate(p.reportDate)}</span><span>Observations détectées : <b>${p.candidates.length}</b></span><span>🔴 À traiter : <b>${openCount}</b></span><span>🟢 FAIT / levées : <b>${doneCount}</b></span></div>${periodicBlock}<label>Famille du contrôle<select id="controlFamilySelect">${['Électricité','SSI / Incendie','Extincteurs','Ascenseurs / Levage','Gaz','VMC / Ventilation','Équipements sportifs','Aires de jeux','Portes / Portails','Eau / Sanitaire','Chauffage','Amiante / Plomb','Radon / Air','Foudre','Cuisine / Cuisson','Accessibilité','Autres contrôles'].map(v=>`<option ${v===p.controlFamily?'selected':''}>${esc(v)}</option>`).join('')}</select></label><div class="import-message"><strong>Plan d’action :</strong> chaque non-conformité « À traiter » créera automatiquement une action dans Sécurité & qualité.</div><label class="inline-check"><input type="checkbox" id="controlCreateMaintenance" checked> Créer aussi une intervention de maintenance pour chaque non-conformité à traiter</label><div class="control-candidate-list">${list}</div><div class="modal-actions inline-actions"><button class="ghost" id="cancelControlImport">Annuler</button><button class="primary" id="applyControlImport">${isPeriodic?'Valider le contrôle effectué':'Valider le rapport'}</button></div>`;
    document.getElementById('cancelControlImport').onclick=()=>{controlPending=null;box.innerHTML='';status('controlImportStatus','Import annulé')};document.getElementById('applyControlImport').onclick=applyControl;
  }
  async function applyControl(){
    const p=controlPending;if(!p)return;
    const selected=p.candidates.filter((c,i)=>document.querySelector(`[data-control-select="${i}"]`)?.checked);
    const createMaint=document.getElementById('controlCreateMaintenance')?.checked;
    const controlFamily=document.getElementById('controlFamilySelect')?.value||p.controlFamily||'Autres contrôles';
    const controlSig=filenameSignature(p.file?.name||'');if(controlSig)db.settings.controlFamilyHints[controlSig]=controlFamily;
    status('controlImportStatus','Enregistrement du PDF original dans Supabase…');
    const controlDup=window.PSTImportDuplicates?.inspect?await window.PSTImportDuplicates.inspect(p.file):{fileHash:await fileFingerprint(p.file),matches:[]};
    const fileHash=controlDup.fileHash||await fileFingerprint(p.file);
    if(!p.duplicateConfirmed&&controlDup.matches?.length&&window.PSTImportDuplicates?.confirm&&!window.PSTImportDuplicates.confirm(controlDup)){status('controlImportStatus','Import annulé : doublon détecté.','warning');return}
    const reportId=uid();
    let attachment=null;
    try{
      attachment=await putFile(p.file,{module:'control-report',recordId:reportId});
      db.attachments.push(attachment);
    }catch(e){
      console.error('Archivage rapport contrôle',e);
      const msg=String(e?.message||e||'');
      const detail=/bucket|storage|row-level|policy|not found|unauthorized/i.test(msg)
        ? 'Le stockage Supabase des rapports n’est pas encore configuré. Exécutez le fichier SETUP_STORAGE_RAPPORTS.sql dans Supabase > SQL Editor.'
        : `Impossible d’enregistrer le PDF original : ${msg}`;
      status('controlImportStatus',detail,'error');
      toast?.('Rapport non enregistré : PDF non archivé');
      return;
    }
    let created=0, actionCreated=0;
    let periodicTargetId=document.getElementById('periodicTargetSelect')?.value||'__create__';
    const importedStatus=document.getElementById('periodicImportedStatus')?.value||'Réalisé';
    if(periodicTargetId==='__create__'||!periodicTargetId){
      const d=p.reportDate||todayISO();
      const auto={id:uid(),no:nextNo('periodic','CP'),name:`${controlFamily} — ${p.organization||'Contrôle importé'}`,family:controlFamily,intervalMonths:12,requirement:`Rapport importé : ${p.file.name}`,provider:p.organization||'',register:'Registre de sécurité',building:'Tous bâtiments',lastDate:d,nextDate:'',status:importedStatus,notes:`Créé automatiquement depuis le rapport ${p.file.name}. Vérifier la périodicité et la prochaine échéance.`,attachments:[attachment],sourceReportId:reportId};
      if(auto.intervalMonths>0&&typeof addMonths==='function')auto.nextDate=addMonths(d,auto.intervalMonths);
      db.periodic.push(auto);periodicTargetId=auto.id;
    }else{
      const target=(db.periodic||[]).find(x=>String(x.id)===String(periodicTargetId));
      if(!target){toast('Contrôle périodique introuvable');return}
      const d=p.reportDate||todayISO();target.lastDate=d;target.status=importedStatus;target.provider=target.provider||p.organization||'';target.family=controlFamily||target.family;target.attachments=target.attachments||[];if(!target.attachments.some(a=>a.id===attachment.id))target.attachments.push(attachment);const months=Number(target.intervalMonths||0);if(months>0&&typeof addMonths==='function')target.nextDate=addMonths(d,months);target.notes=[target.notes,`Rapport importé le ${new Date().toLocaleDateString('fr-FR')} : ${p.file.name}`].filter(Boolean).join('\n');
    }
    for(let i=0;i<p.candidates.length;i++){
      const c=p.candidates[i],st=document.querySelector(`[data-control-status="${i}"]`)?.value||c.status||'À traiter',pri=(st==='À traiter'?'Urgente':(document.querySelector(`[data-control-priority="${i}"]`)?.value||c.priority||'Normale'));
      const nc={id:uid(),no:`NC-${String((db.reportNonconformities?.length||0)+1).padStart(4,'0')}`,observationNo:c.observationNo||i+1,organization:p.organization,controlFamily,reportDate:p.reportDate,location:c.location||'',text:c.text,action:c.action||'',priority:pri,status:st,sourceFile:p.file.name,attachmentId:attachment.id,periodicControlId:periodicTargetId,sourceReportId:reportId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      db.reportNonconformities.push(nc);
      const checked=document.querySelector(`[data-control-select="${i}"]`)?.checked!==false;
      if(checked&&st==='À traiter'){
        db.issues=db.issues||[];
        db.issues.push({id:uid(),no:nextNo('issue','ACT'),date:todayISO(),sourceReportDate:p.reportDate||'',agentId:'',category:'Sécurité',title:`Non-conformité — Observation ${nc.observationNo} — ${p.organization}`,description:[c.location?`Localisation : ${c.location}`:'',c.text].filter(Boolean).join('\n'),priority:pri,status:'À faire',owner:'',dueDate:'',cost:0,action:c.action?`Préconisation : ${c.action}`:'À corriger puis faire lever la non-conformité',attachments:[attachment],sourceNonconformityId:nc.id,sourceReportId:reportId,periodicControlId:periodicTargetId});
        actionCreated++;
      }
      if(createMaint&&checked&&st==='À traiter'){db.maintenance.push({id:uid(),no:nextNo('maintenance','MAI'),date:todayISO(),sourceReportDate:p.reportDate||'',title:`Observation ${nc.observationNo} — ${p.organization}`,family:controlFamily,priority:pri,status:'À faire',building:'',floor:'',room:c.location||'',requester:p.organization,assigned:'',dueDate:'',cost:0,description:c.text,action:c.action?`Préconisation : ${c.action}`:'À corriger puis faire lever la non-conformité',attachments:[attachment],sourceNonconformityId:nc.id,periodicControlId:periodicTargetId});created++}
    }
    db.pdfImports.push({id:reportId,kind:'control',importType:p.centralKind==='periodic'?'periodic':'report',createdAt:new Date().toISOString(),fileName:p.file.name,fileSize:p.file.size,fileHash,attachmentId:attachment.id,subject:p.organization,controlFamily,reportDate:p.reportDate,periodicControlId:periodicTargetId,academicYear:academicYearFor(p.reportDate||todayISO()),summary:`${p.candidates.filter(c=>!['FAIT','Levée'].includes(c.status)).length} à traiter · ${p.candidates.filter(c=>['FAIT','Levée'].includes(c.status)).length} FAIT/levées · ${actionCreated} action(s) · ${created} intervention(s)`});
    db.importArchives=db.importArchives||[];const lastControl=db.pdfImports[db.pdfImports.length-1];const controlArchive={id:uid(),sourceId:lastControl.id,createdAt:lastControl.createdAt,type:p.centralKind==='periodic'?'Contrôle périodique':'Rapport de contrôle',fileName:lastControl.fileName,fileHash:lastControl.fileHash||'',attachmentId:lastControl.attachmentId,subject:lastControl.subject,academicYear:lastControl.academicYear,summary:lastControl.summary,module:'periodic',recordId:periodicTargetId||'',analysisSnapshot:{type:p.centralKind==='periodic'?'Contrôle périodique':'Rapport de contrôle',fileName:lastControl.fileName,subject:p.organization,organization:p.organization,controlFamily,reportDate:p.reportDate,academicYear:lastControl.academicYear,confidence:p.confidence||0,nonconformities:p.candidates.filter(c=>!['FAIT','Levée'].includes(c.status)).length,maintenanceCreated:created,actionsCreated:actionCreated,periodicControlId:periodicTargetId,candidates:p.candidates.map((c,i)=>({observationNo:c.observationNo||i+1,location:c.location||'',text:c.text,action:c.action||'',status:document.querySelector(`[data-control-status="${i}"]`)?.value||c.status||'À traiter',priority:((document.querySelector(`[data-control-status="${i}"]`)?.value||c.status||'À traiter')==='À traiter'?'Urgente':(document.querySelector(`[data-control-priority="${i}"]`)?.value||c.priority)),selected:document.querySelector(`[data-control-select="${i}"]`)?.checked!==false})),summary:lastControl.summary}};db.importArchives.push(controlArchive);if(attachment)window.PSTImportOriginals?.remember?.(controlArchive,attachment);
    await save();renderHistory();renderControlLibrary();status('controlImportStatus',`✅ Rapport enregistré : ${p.candidates.filter(c=>!['FAIT','Levée'].includes(c.status)).length} à traiter · ${actionCreated} plan(s) d’action · ${created} intervention(s).`,'ok');document.getElementById('controlPreview').innerHTML='';controlPending=null;const pf=document.getElementById('periodicFamily'),ps=document.getElementById('periodicStatus'),pb=document.getElementById('periodicBuilding');if(pf)pf.value='';if(ps)ps.value='';if(pb)pb.value='';const im=document.getElementById('issueMonth'),ia=document.getElementById('issueAgent'),ic=document.getElementById('issueCategory'),is=document.getElementById('issueStatus');if(im)im.value=todayISO().slice(0,7);if(ia)ia.value='';if(ic)ic.value='';if(is)is.value='';renderAll();if(typeof setView==='function')setView('periodic');setTimeout(()=>{document.getElementById('periodicCards')?.scrollIntoView({behavior:'smooth',block:'start'});toast?.(`Rapport enregistré : ${actionCreated} plan(s) d’action créé(s)`);},80);
  }
  const CONTROL_FAMILIES=['Électricité','SSI / Incendie','Extincteurs','Ascenseurs / Levage','Gaz','VMC / Ventilation','Équipements sportifs','Aires de jeux','Portes / Portails','Eau / Sanitaire','Chauffage','Amiante / Plomb','Radon / Air','Foudre','Cuisine / Cuisson','Accessibilité','Autres contrôles'];
  function effectiveControlFamily(x){return x.controlFamily||detectControlFamily(`${x.subject||''} ${x.summary||''}`,x.fileName||'')}
  function renderControlFamilyFilter(){const sel=document.getElementById('controlReportFamily');if(!sel)return;const cur=sel.value;const families=[...new Set([...CONTROL_FAMILIES,...(db.pdfImports||[]).filter(x=>x.kind==='control').map(effectiveControlFamily)])];sel.innerHTML='<option value="">Toutes les familles</option>'+families.map(f=>`<option ${f===cur?'selected':''}>${esc(f)}</option>`).join('')}
  function renderControlLibrary(){ensureData();renderControlFamilyFilter();const box=document.getElementById('controlReportLibrary');if(!box)return;const filter=document.getElementById('controlReportFamily')?.value||'';const reports=[...db.pdfImports].filter(x=>x.kind==='control'&&(!filter||effectiveControlFamily(x)===filter)).sort((a,b)=>(b.reportDate||b.createdAt||'').localeCompare(a.reportDate||a.createdAt||''));if(!reports.length){box.innerHTML='<div class="empty-state">Aucun rapport de contrôle enregistré.</div>';return}const groups={};for(const r of reports){const f=effectiveControlFamily(r);(groups[f]||(groups[f]=[])).push(r)}box.innerHTML=Object.entries(groups).map(([family,arr])=>`<section class="control-report-group"><div class="control-report-group-title"><h4>${esc(family)}</h4><span>${arr.length} rapport(s)</span></div><div class="control-report-cards">${arr.map(r=>`<article class="control-report-card"><div><strong>${esc(r.fileName||'Rapport')}</strong><small>${esc(r.subject||'Organisme non renseigné')} · ${fmtDate(r.reportDate)||fmtDateTime(r.createdAt)}</small><p>${esc(r.summary||'')}</p></div><div class="control-report-actions">${r.bundledPath?`<button class="primary small" data-open-bundled-report="${esc(r.bundledPath)}">📖 Lire le PDF</button>`:r.attachmentId?`<button class="primary small" data-open-control-report="${esc(r.attachmentId)}">📄 Ouvrir le PDF</button>`:`<label class="ghost small button-link">📎 Rattacher le PDF<input type="file" accept="application/pdf,.pdf" data-reattach-report="${esc(r.id)}" hidden></label><small class="muted">Ancien rapport : PDF à rattacher une seule fois.</small>`}</div></article>`).join('')}</div></section>`).join('')}
  function openBundledControlReport(path){if(!path)return;try{const url=new URL(path,window.location.href).href;window.open(url,'_blank','noopener')}catch(e){console.error(e);toast?.('Impossible d’ouvrir le PDF intégré')}}
  async function openControlReport(id){if(!id)return;try{if(typeof downloadAttachment==='function')await downloadAttachment(id);else{const rec=(db.attachments||[]).find(a=>a.id===id);if(rec&&typeof openStoragePath==='function')await openStoragePath(rec.storagePath,rec.name)}}catch(e){console.error(e);toast?.('Impossible d’ouvrir ce rapport') }}
  async function reattachControlReport(reportId,file){if(!file)return;const report=(db.pdfImports||[]).find(x=>x.id===reportId);if(!report)return;status('controlImportStatus','Rattachement du document original…');try{const attachment=await putFile(file,{module:'control-report',recordId:reportId});db.attachments.push(attachment);report.attachmentId=attachment.id;report.fileName=file.name||report.fileName;report.fileSize=file.size;report.fileHash=await fileFingerprint(file);const archive=(db.importArchives||[]).find(x=>String(x.sourceId)===String(reportId));if(archive)window.PSTImportOriginals?.remember?.(archive,attachment);save();renderControlLibrary();status('controlImportStatus','Original rattaché. Il peut maintenant être rouvert depuis le rapport et Archivage.','ok')}catch(e){console.error(e);status('controlImportStatus',`Impossible de rattacher l’original : ${e?.message||String(e)}`,'error')}}
  async function onChronoFile(file){if(!file)return;ensureData();status('chronoImportStatus','Lecture du PDF en cours…');try{const ex=await extractPdf(file);chronoPending=parseChronotime(ex,file);status('chronoImportStatus',chronoPending.complete?`Document Chronotime complet : calendrier ${chronoPending.coverage}% et informations ${chronoPending.infoCoverage}%. Vérifiez puis validez.`:chronoPending.confidence>=50?`Document Chronotime reconnu, mais contrôle de complétude requis : calendrier ${chronoPending.coverage||0}% · informations ${chronoPending.infoCoverage||0}%.`:`Document lu, reconnaissance Chronotime faible (${chronoPending.confidence} %). Vérifiez l’agent et la période.`,chronoPending.complete?'ok':'warning');chronoPreview(chronoPending)}catch(e){console.error(e);status('chronoImportStatus',`Impossible de lire ce PDF : ${e.message||e}`,'error')}}
  async function onControlFile(file){if(!file)return;ensureData();status('controlImportStatus','Analyse du rapport en cours…');try{const ex=await extractPdf(file);controlPending=parseControl(ex,file);status('controlImportStatus',`Rapport analysé — reconnaissance ${controlPending.confidence} %. Vérifiez les éléments proposés.`,'ok');controlPreview(controlPending)}catch(e){console.error(e);status('controlImportStatus',`Impossible de lire ce PDF : ${e.message||e}`,'error')}}
  function bind(){const c=document.getElementById('chronoPdfFile'),r=document.getElementById('controlPdfFile'),f=document.getElementById('controlReportFamily');if(c)c.addEventListener('change',e=>onChronoFile(e.target.files?.[0]));if(r)r.addEventListener('change',e=>onControlFile(e.target.files?.[0]));if(f)f.addEventListener('change',renderControlLibrary);document.addEventListener('change',e=>{const input=e.target.closest('[data-reattach-report]');if(input){reattachControlReport(input.dataset.reattachReport,input.files?.[0]);}});document.addEventListener('click',e=>{const bundled=e.target.closest('[data-open-bundled-report]');if(bundled){e.preventDefault();openBundledControlReport(bundled.dataset.openBundledReport);return}const open=e.target.closest('[data-open-control-report]');if(open){e.preventDefault();openControlReport(open.dataset.openControlReport);return}const go=e.target.closest('[data-go="pdfimports"]');if(go){e.preventDefault();setView('pdfimports');renderHistory();renderCodeMap();}})}
  async function centralAnalyze(file){
    ensureData();const ex=await extractPdf(file),chrono=parseChronotime(ex,file),control=parseControl(ex,file);const text=norm(ex.text);let detectedType='other';
    if(chrono.confidence>=60||text.includes('gfi chrono time')||text.includes('synoptique annuel'))detectedType='chronotime';
    else if(control.confidence>=45||CONTROL_ORGS.some(o=>text.includes(norm(o)))||CONTROL_KEYWORDS.some(k=>text.includes(norm(k))))detectedType='control';
    else if(/controle|vérification|verification|inspection|periodique|périodique/.test(text))detectedType='periodic';
    else if(/note de service|courrier|administratif|direction|academie|académie|region|région/.test(text))detectedType='administrative';
    const labels={chronotime:'Chronotime',periodic:'Contrôle périodique effectué',control:'Rapport de contrôle',administrative:'Document administratif',other:'Autre document'};
    return {file,extracted:ex,chrono,control,detectedType,detectedLabel:labels[detectedType],chronoConfidence:chrono.confidence||0,controlConfidence:control.confidence||0,details:detectedType==='chronotime'?`${chrono.agentNameRaw||'Agent à confirmer'} · ${chrono.academicYear||'année à confirmer'}`:detectedType==='control'||detectedType==='periodic'?`${control.organization||'Organisme à confirmer'} · ${control.controlFamily||'famille à confirmer'}`:'Classement manuel possible'};
  }
  function routeCentral(a,type){ensureData();if(type==='chronotime'){chronoPending=a.chrono;setView('pdfimports');status('chronoImportStatus','Document détecté depuis l’import central. Vérifiez puis validez.','ok');chronoPreview(chronoPending);return}if(type==='control'||type==='periodic'){controlPending=a.control;controlPending.centralKind=type;setView('periodic');status('controlImportStatus','⚠️ ÉTAPE 2/2 — Vérifiez les non-conformités puis appuyez sur « Valider le rapport ». Tant que ce bouton n’est pas utilisé, aucun contrôle ni plan d’action n’est créé.','warning');controlPreview(controlPending);setTimeout(()=>{document.getElementById('controlPreview')?.scrollIntoView({behavior:'smooth',block:'start'});document.getElementById('applyControlImport')?.classList.add('final-validation-attention');},80);return}}
  function init(){ensureData();bind();renderHistory();renderCodeMap();renderDashboard();renderControlLibrary()}
  window.PDFImportModule={init,renderHistory,renderCodeMap,renderDashboard,renderControlLibrary,centralAnalyze,routeCentral};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
