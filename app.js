'use strict';

function appLogoURL(){
  try{return window.APP_LOGO_DATA_URI||new URL('./assets/logo-service-technique.png?v=138.0',document.baseURI||location.href).href}
  catch(e){return window.APP_LOGO_DATA_URI||'./assets/logo-service-technique.png?v=138.0'}
}
function secureAppLogos(){
  const src=appLogoURL();
  document.querySelectorAll('[data-app-logo],.auth-logo,.brand-logo,.welcome-logo').forEach(img=>{
    if(!img)return;img.removeAttribute('srcset');
    img.onerror=()=>{if(window.APP_LOGO_DATA_URI){img.onerror=null;img.src=window.APP_LOGO_DATA_URI}};
    img.src=src;
    if(img.complete&&img.naturalWidth===0&&window.APP_LOGO_DATA_URI)img.src=window.APP_LOGO_DATA_URI;
  });
}

const APP_VERSION='147.47';
const APP_BUILD='15/08/2026';

// V25 : les erreurs techniques sont journalisées sans bloquer l'utilisateur.
window.addEventListener('error',event=>{
  console.error('Erreur applicative :',event.error||event.message);
  const s=document.querySelector('#saveState');
  if(s){s.textContent='Une action a échoué — vos données restent conservées';s.dataset.state='local'}
});
window.addEventListener('unhandledrejection',event=>{
  console.error('Promesse rejetée :',event.reason);
  const s=document.querySelector('#saveState');
  if(s){s.textContent='Synchronisation différée — travail local conservé';s.dataset.state='local'}
});

const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const STORAGE_KEY='pilotage-service-technique-v25'; const OLD_KEYS=['pilotage-service-technique-v10','pilotage-service-technique-v9','jean-puy-pilote-v3','jp-pilote'];
const pad=n=>String(n).padStart(2,'0'); const uid=()=>`${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localISO(d){d=new Date(d);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
const todayISO=()=>localISO(new Date()); const monthISO=()=>todayISO().slice(0,7); const parseDate=v=>new Date(`${v}T12:00:00`);
function addDays(v,n){const d=typeof v==='string'?parseDate(v):new Date(v);d.setDate(d.getDate()+n);return localISO(d)}
function addMonths(v,n){const d=parseDate(v);d.setMonth(d.getMonth()+Number(n));return localISO(d)}
function startOfWeek(v){const d=typeof v==='string'?parseDate(v):new Date(v);d.setDate(d.getDate()-((d.getDay()+6)%7));return localISO(d)}
const endOfWeek=v=>addDays(startOfWeek(v),6); const fmtDate=v=>v?parseDate(v).toLocaleDateString('fr-FR'):'';
const fmtDateLong=v=>v?parseDate(v).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'';
function normalizeDateValue(value){
 const s=String(value||'').trim();if(!s)return '';
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
 let m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(m)return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
 const d=new Date(s);return Number.isNaN(d.getTime())?'':localISO(d);
}
function normalizeText(value){return String(value||'').trim().toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function isClosedStatus(value){const s=normalizeText(value);return ['termine','terminee','cloture','cloturee','annule','annulee','archive','archivee','realise','realisee','non applicable'].includes(s)}
function recordDueDate(record){
 const direct=record?.dueDate||record?.deadline||record?.echeance||record?.endDate||record?.targetDate||record?.dateLimite||record?.date_limit||record?.delai||record?.delay||'';
 const normalized=normalizeDateValue(direct);if(normalized)return normalized;
 // Compatibilité avec les anciennes données où l'échéance était écrite en texte, ex. « avant le 4/08 ».
 const text=[record?.description,record?.action,record?.notes,record?.comment,record?.comments,record?.suivi,direct].filter(Boolean).join(' ');
 let m=String(text).match(/(?:avant\s+le|pour\s+le|échéance\s*[:\-]?|echeance\s*[:\-]?|au plus tard\s+le)?\s*(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/i);
 if(!m)return '';
 let year=m[3]?Number(m[3]):Number(todayISO().slice(0,4));if(year<100)year+=2000;
 const candidate=`${year}-${pad(m[2])}-${pad(m[1])}`;return normalizeDateValue(candidate);
}
function isUrgentPriority(value){const s=normalizeText(value);return s==='urgente'||s==='urgent'}
function daysBetweenDates(fromISO,toISO){const a=normalizeDateValue(fromISO),b=normalizeDateValue(toISO);if(!a||!b)return null;return Math.round((parseDate(b)-parseDate(a))/86400000)}

function weekNumber(v){const d=parseDate(v);d.setDate(d.getDate()+3-((d.getDay()+6)%7));const w1=new Date(d.getFullYear(),0,4,12);return 1+Math.round(((d-w1)/86400000-3+((w1.getDay()+6)%7))/7)}
function minutes(t){if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+m}
function hoursBetween(a,b,p=0){a=minutes(a);b=minutes(b);if(a==null||b==null)return 0;let d=b-a;if(d<0)d+=1440;return Math.max(0,(d-Number(p||0))/60)}
const fmtHours=n=>`${(Math.round((Number(n)||0)*100)/100).toLocaleString('fr-FR',{maximumFractionDigits:2})} h`;
const inRange=(d,a,b)=>(!a||d>=a)&&(!b||d<=b); const dateMonthMatch=(d,m)=>!m||String(d||'').startsWith(m);
function businessDays(a,b){if(!a||!b)return 0;let d=parseDate(a),e=parseDate(b),n=0;while(d<=e){if(![0,6].includes(d.getDay()))n++;d.setDate(d.getDate()+1)}return n}
function normalizeEmails(v){return String(v||'').split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean).join(',')}
function selectOptions(items,value='',label=x=>x,val=x=>x){return items.map(x=>`<option value="${esc(val(x))}" ${String(val(x))===String(value)?'selected':''}>${esc(label(x))}</option>`).join('')}
function badge(text){const s=String(text||'—');let c='neutral';if(/conforme|terminé|clôturé|validé|actif|réalisé|à jour|présence|matin|prête/i.test(s))c='good';if(/en cours|planifié|à préparer|à reprendre|soir|demandé|bientôt/i.test(s))c='warn';if(/urgent|retard|non conforme|bloqué|refusé|absence|accident|maladie/i.test(s))c='bad';if(/réunion|rendez|formation|information|rtt/i.test(s))c='info';return `<span class="badge ${c}">${esc(s)}</span>`}
const emptyRow=(n,msg='Aucune donnée enregistrée.')=>`<tr><td class="empty" colspan="${n}">${esc(msg)}</td></tr>`;

const initialBuildings=[
 {name:'Extension',floors:['Rez-de-chaussée','1er étage']},{name:'Demi-pension',floors:['Rez-de-chaussée','1er étage']},{name:'Gymnase',floors:['Rez-de-chaussée','1er étage']},
 ...['Bâtiment A','Bâtiment B','Bâtiment H','Bâtiment G','Bâtiment E','Bâtiment F'].map(name=>({name,floors:['Rez-de-chaussée','1er étage','2e étage','3e étage','4e étage']})),{name:'Cour',floors:['Extérieur']}
].map(x=>({id:uid(),...x}));
const defaultLists={
 roles:['Agent polyvalent','Agent d’entretien','Agent de maintenance','Agent d’accueil','Responsable d’équipe','Remplaçant'],
 dayTypes:['Présence','Congé annuel','RTT','Récupération','Maladie','Accident du travail','Enfant malade','Décès / deuil','Mariage / PACS','Naissance / adoption','Autorisation d’absence','Formation','Absence temps partiel','Repos','Jour férié','Grève','Autre absence'],
 priorities:['Basse','Normale','Haute','Urgente'],
 generalStatuses:['À faire','Planifié','En cours','En attente','Terminé','Clôturé','Bloqué'],
 issueCategories:['Sécurité','Qualité','Organisation','Matériel','Comportement','Absentéisme','Formation','Coût','Autre'],
 maintenanceFamilies:['Électricité','Plomberie','Chauffage / CVC','Serrurerie','Menuiserie','Peinture','Maçonnerie','Toiture','Ascenseur','SSI / incendie','Cuisine / demi-pension','Informatique / réseau','Espaces extérieurs','Mobilier','Autre'],
 maintenanceStatuses:['À qualifier','À faire','Planifiée','En cours','En attente prestataire','En attente pièce','Terminée','Clôturée','Bloquée'],
 requestTypes:['Aménagement de salle','Déménagement','Événement','Ouverture / fermeture','Accès / clés','Mobilier','Logistique','Sécurité','Autre'],
 workTypes:['Réunion de chantier','Réserve','GPA','Levée de réserve','Visite architecte','Intervention entreprise','Réception','Autre'],
 meetingTypes:['Direction','Réunion équipe','Architecte','Entreprise','Prestataire','Rendez-vous','Commission de sécurité','Formation','Autre'],
 personalTypes:['Rendez-vous','Réunion','Tâche','Rappel','Déplacement','Appel','Échéance','Autre'],
 noteCategories:['Préparation de salle','Réunion','Rendez-vous','Maintenance','Chantier / GPA','Contrôle ménage','Agent / équipe','Demande direction','Sécurité / qualité','Vacances / fermeture','Contrôle périodique','Personnel','Autre'],
 roomTypes:['Sanitaires / vestiaires','Circulations / halls / escaliers','Salle de classe / devoirs / informatique','CDI','Salle des personnels','Bureaux / administration','Locaux techniques','Dortoirs internat','Infirmerie','Salle de sport / gymnase','Demi-pension / restaurant','Cuisine','Cour / extérieurs','Atelier','Autre'],
 cleaningStatuses:['Conforme','À reprendre','Non conforme','Non contrôlé','Non applicable'],
 periodicFamilies:['Incendie / SSI','Électricité','Chauffage / CVC','Gaz / cuisine','Ascenseurs / levage','Eau / légionelles','Qualité de l’air / radon','Portes / accès','Équipements sportifs','Équipements sous pression','Froid / fluides','Sûreté / PPMS','Autre'],
 documentCategories:['Guide / procédure','Réglementation','Plan','Contrat','Rapport de contrôle','Compte rendu','Photo','Courriel','Feuille de calcul','Fichier texte','Autre']
};

const GUIDE={
 'Sanitaires / vestiaires':[
 ['Préparation du matériel','Journalière (1 fois)'],['Aération','Journalière (1 fois)'],['Élimination des toiles d’araignées','Si nécessaire'],['Vidage des poubelles','Journalière (1 fois)'],['Changement du sac poubelle','Journalière (1 fois)'],['Réapprovisionnement savon et papier','Journalière (1 fois)'],['Détartrage des sanitaires','Journalière (1 fois)'],['Dépoussiérage des luminaires','À chaque permanence'],['Nettoyage miroirs et distributeurs','Journalière (1 fois)'],['Nettoyage/désinfection lavabos, douches et robinetteries','Journalière (1 fois)'],['Nettoyage/désinfection WC, urinoirs et cloisons','Journalière (2 fois)'],['Désinfection poignées et interrupteurs','Journalière (1 fois)'],['Lessivage faïences, portes, murs et cloisons','Hebdomadaire (1 fois)'],['Nettoyage des siphons de sols','Hebdomadaire (1 fois)'],['Nettoyage des bouches de VMC','Annuelle (1 fois)'],['Dépoussiérage dessus de vestiaires','À chaque permanence'],['Dépoussiérage plinthes, radiateurs, tuyauteries','Annuelle (1 fois)'],['Balayage des sols','Journalière (1 fois)'],['Lavage des sols','Journalière (1 fois)'],['Lavage mécanisé du sol','Si nécessaire'],['Nettoyage vitrerie accessible','Si nécessaire'],['Nettoyage du matériel','Journalière (1 fois)']],
 'Circulations / halls / escaliers':[
 ['Préparation du matériel','Journalière (1 fois)'],['Aération','Journalière (1 fois)'],['Élimination des toiles d’araignées','Si nécessaire'],['Dépoussiérage du mobilier dégagé','Hebdomadaire (1 fois)'],['Essuyage interrupteurs, rampes, poignées et entourage','Hebdomadaire (1 fois)'],['Traces sur surfaces vitrées à hauteur d’homme','Si nécessaire'],['Dépoussiérage plinthes, radiateurs et rebords de fenêtre','Annuelle (1 fois)'],['Vidage corbeilles / poubelles','Journalière (1 fois)'],['Changement du sac poubelle','Si nécessaire'],['Aspiration des tapis d’entrée','Hebdomadaire (1 fois)'],['Balayage des sols','Journalière (1 fois)'],['Lavage des sols / autolaveuse si possible','Hebdomadaire (1 fois)'],['Spray méthode des sols thermoplastiques cirés','À chaque permanence'],['Décapage et mise en cire des sols','Si nécessaire'],['Aspiration rainures ascenseur','Mensuelle (1 fois)'],['Nettoyage du matériel','Journalière (1 fois)']],
 'Salle de classe / devoirs / informatique':[
 ['Préparation du matériel','Journalière (1 fois)'],['Aération','Journalière (1 fois)'],['Élimination des toiles d’araignées','Si nécessaire'],['Nettoyage du tableau','À chaque permanence'],['Lavage des tables','Hebdomadaire (3 fois)'],['Détachage des tables','Si nécessaire'],['Essuyage humide des chaises','Si nécessaire'],['Lavage des chaises','À chaque permanence'],['Élimination des chewing-gums','À chaque permanence'],['Lavage du point d’eau hors paillasses','Hebdomadaire (1 fois)'],['Radiateurs, plinthes, dessus d’armoires, rebords de fenêtres','À chaque permanence'],['Essuyage des équipements informatiques','Hebdomadaire (1 fois)'],['Traces de doigts poignées, interrupteurs, portes vitrées','Hebdomadaire (1 fois)'],['Vidage des poubelles','Journalière (1 fois)'],['Changement du sac poubelle','Si nécessaire'],['Balayage des sols','Journalière (1 fois)'],['Lavage manuel ou mécanisé des sols','Hebdomadaire (1 fois)'],['Spray méthode des sols thermoplastiques cirés','À chaque permanence'],['Décapage et mise en cire des sols','Si nécessaire'],['Nettoyage du matériel','Journalière (1 fois)']],
 'CDI':[
 ['Préparation du matériel','Journalière (1 fois)'],['Aération','Journalière (1 fois)'],['Élimination des toiles d’araignées','Si nécessaire'],['Lavage des tables','Hebdomadaire (1 fois)'],['Détachage des tables','Si nécessaire'],['Essuyage humide des chaises','Si nécessaire'],['Lavage des chaises','À chaque permanence'],['Dépoussiérage matériel informatique','Hebdomadaire (1 fois)'],['Dépoussiérage des étagères sans sortir les livres','Hebdomadaire (1 fois)'],['Dépoussiérage du mobilier dégagé','Hebdomadaire (1 fois)'],['Interrupteurs, poignées et entourage','Hebdomadaire (1 fois)'],['Plinthes, radiateurs, rebords de fenêtres','À chaque permanence'],['Traces sur vitrages à hauteur d’homme','Si nécessaire'],['Vidage corbeilles / poubelles','Journalière (1 fois)'],['Changement du sac poubelle','Si nécessaire'],['Balayage des sols','Hebdomadaire (1 fois)'],['Lavage des sols / autolaveuse','Hebdomadaire (1 fois)'],['Spray méthode sols thermoplastiques','À chaque permanence'],['Décapage et mise en cire','Si nécessaire'],['Nettoyage du matériel','Journalière (1 fois)']],
 'Salle des personnels':[
 ['Préparation du matériel','Journalière (1 fois)'],['Aération','Journalière (1 fois)'],['Élimination des toiles d’araignées','Si nécessaire'],['Lavage des tables','Hebdomadaire (1 fois)'],['Détachage des tables','Hebdomadaire (1 fois)'],['Essuyage humide des chaises','Hebdomadaire (1 fois)'],['Dépoussiérage matériel informatique / photocopieurs','Hebdomadaire (1 fois)'],['Dépoussiérage mobilier dégagé','Hebdomadaire (1 fois)'],['Interrupteurs, poignées et entourage','Hebdomadaire (1 fois)'],['Traces sur vitrages à hauteur d’homme','Si nécessaire'],['Radiateurs, plinthes et rebords de fenêtres','À chaque permanence'],['Vidage corbeilles / poubelles','Journalière (1 fois)'],['Changement du sac poubelle','Si nécessaire'],['Balayage des sols','Journalière (1 fois)'],['Lavage des sols','Hebdomadaire (1 fois)'],['Spray méthode sols thermoplastiques','À chaque permanence'],['Décapage et mise en cire','Si nécessaire'],['Nettoyage du matériel','Journalière (1 fois)']],
 'Bureaux / administration':[
 ['Préparation du matériel','Journalière (1 fois)'],['Aération','Journalière (1 fois)'],['Élimination des toiles d’araignées','Si nécessaire'],['Lavage des tables','Hebdomadaire (1 fois)'],['Essuyage humide des chaises','Hebdomadaire (1 fois)'],['Dépoussiérage matériel informatique / photocopieur','Hebdomadaire (1 fois)'],['Dépoussiérage mobilier dégagé','Hebdomadaire (1 fois)'],['Interrupteurs, poignées et entourage','Hebdomadaire (1 fois)'],['Traces sur vitrages à hauteur d’homme','Si nécessaire'],['Plinthes, radiateurs et rebords de fenêtre','À chaque permanence'],['Vidage corbeilles / poubelles','Hebdomadaire (3 fois)'],['Changement du sac poubelle','Si nécessaire'],['Balayage des sols','Hebdomadaire (2 fois)'],['Lavage des sols','Hebdomadaire (1 fois)'],['Spray méthode sols thermoplastiques','À chaque permanence'],['Décapage et mise en cire','Si nécessaire'],['Nettoyage du matériel','Journalière (1 fois)']],
 'Locaux techniques':[
 ['Préparation du matériel','Hebdomadaire (1 fois)'],['Aération','Journalière (1 fois)'],['Élimination des toiles d’araignées','Si nécessaire'],['Lavage/désinfection des containers','Hebdomadaire (1 fois)'],['Nettoyage positionneurs et rouleur de bacs','Hebdomadaire (1 fois)'],['Dépoussiérage étagères et mobilier','Mensuelle (1 fois)'],['Interrupteurs, poignées et entourage','Hebdomadaire (1 fois)'],['Nettoyage du vide-seaux','Si nécessaire'],['Balayage des sols','Hebdomadaire (1 fois)'],['Lavage des sols','Hebdomadaire (1 fois)'],['Nettoyage du matériel','Hebdomadaire (1 fois)']],
 'Dortoirs internat':[
 ['Préparation du matériel','Journalière (1 fois)'],['Aération','Journalière (1 fois)'],['Élimination des toiles d’araignées','Si nécessaire'],['Essuyage humide du mobilier dégagé','Hebdomadaire (1 fois)'],['Détachage tables / bureaux','Si nécessaire'],['Essuyage humide des chaises','Hebdomadaire (1 fois)'],['Dépoussiérage du mobilier dégagé','Hebdomadaire (1 fois)'],['Blocs sanitaires collectifs WC + douches','Journalière (1 fois)'],['WC à l’intérieur des chambres','Journalière (1 fois)'],['Douches à l’intérieur des chambres','Hebdomadaire (1 fois)'],['Interrupteurs, poignées et entourage','À chaque permanence'],['Traces sur vitrages à hauteur d’homme','Si nécessaire'],['Plinthes et rebords de fenêtres','À chaque permanence'],['Vidage corbeilles / poubelles','Journalière (1 fois)'],['Changement du sac poubelle','Si nécessaire'],['Balayage des sols','Hebdomadaire (1 fois)'],['Lavage des sols / autolaveuse','Hebdomadaire (1 fois)'],['Spray méthode sols thermoplastiques','À chaque permanence'],['Décapage et mise en cire','Si nécessaire'],['Nettoyage du matériel','Journalière (1 fois)']],
 'Infirmerie':[
 ['Préparation du matériel','Journalière (1 fois)'],['Aération','Journalière (1 fois)'],['Élimination des toiles d’araignées','Si nécessaire'],['Nettoyage/désinfection mobilier et lavabos','Journalière (1 fois)'],['Dépoussiérage du matériel informatique','Hebdomadaire (1 fois)'],['Plinthes, radiateurs et rebords de fenêtres','Si nécessaire'],['Désinfection interrupteurs, poignées et entourage','Journalière (1 fois)'],['Traces sur vitrages à hauteur d’homme','Si nécessaire'],['Vidage corbeilles / poubelles','Journalière (1 fois)'],['Changement du sac poubelle','Hebdomadaire (1 fois)'],['Balayage des sols','Journalière (1 fois)'],['Lavage des sols','Journalière (1 fois)'],['Spray méthode sols thermoplastiques','À chaque permanence'],['Décapage et mise en cire','Si nécessaire'],['Nettoyage du matériel','Journalière (1 fois)']],
 'Salle de sport / gymnase':[
 ['Préparation du matériel','Journalière (1 fois)'],['Aération','Journalière (1 fois)'],['Élimination des toiles d’araignées','Si nécessaire'],['Vidage des poubelles','Journalière (1 fois)'],['Traces de doigts sur les portes','Hebdomadaire (1 fois)'],['Points de contact poignées et interrupteurs','Hebdomadaire (1 fois)'],['Balayage manuel ou mécanisé du sol','Hebdomadaire (2 fois)'],['Lavage mécanisé du sol','Hebdomadaire (1 fois)'],['Nettoyage du matériel','Journalière (1 fois)']]
};

const IMPORTED_WEEKLY_PLANS=[
 {agent:'Mme Tarrio',rows:[
  ['06:00-07:15','Ménage','Ménage','','Ménage','Ménage'],
  ['07:15-08:20','Loge','Loge','','Loge','Loge'],
  ['08:40-12:30','Loge + courrier','Loge + courrier','','Loge + courrier','Loge + courrier'],
  ['12:30-13:00','Pause','Pause','','Pause','Pause'],
  ['13:00-14:45','Loge','Loge','','Loge','Loge']]},
 {agent:'Mme Delorme',rows:[
  ['06:00-08:00','Ménage','Ménage','Lingerie','Ménage','Ménage'],
  ['08:20-10:30','Loge + courrier','Loge + courrier','Loge + courrier','Loge + courrier','Loge + courrier'],
  ['10:30-11:45','Lingerie','Lingerie','Loge 11:30-12:00','Lingerie','Lingerie'],
  ['11:45-12:15','Pause','Pause','','Pause','Pause'],
  ['12:15-13:00','Loge','Loge','','Loge','Loge'],
  ['13:00-15:10','Lingerie','Lingerie','','Lingerie','Lingerie']]},
 {agent:'Complément accueil',rows:[
  ['06:00-09:30','Ménage','Ménage','','Ménage','Ménage'],
  ['09:30-11:00','Loge + courrier','Loge + courrier','','Loge + courrier','Loge + courrier'],
  ['08:40-12:30','Loge + courrier','Loge + courrier','','Loge + courrier','Loge + courrier'],
  ['13:00-14:45','Loge','Loge','','Loge','Loge']]},
 {agent:'Mme Berthoux',rows:[
  ['06:00-08:00','Ménage','Ménage','Ménage','Ménage','Ménage'],
  ['08:00-10:50','Cuisine','Cuisine','Cuisine','Cuisine','Cuisine'],
  ['10:50-11:20','Pause','Pause','Pause','Pause','Pause'],
  ['11:20-15:00','Cuisine','Cuisine','Ménage 13:00-14:30','Cuisine','Cuisine']]},
 {agent:'Mme Bozio',rows:[
  ['14:30-18:15','Loge','Loge','Loge 12:00-16:00','Loge','Loge'],
  ['18:35-19:30','Fermeture','Fermeture','Fermeture 16:00-17:15','Fermeture','Fermeture']]}
];
const IMPORTED_INTERVENTIONS=[
 ['BAES à vérifier','SSI / incendie','Haute','À faire','',''],
 ['Travaux lingerie','Autre','Basse','À faire','Devis en cours',''],
 ['Interrupteur à clé gymnase à changer','Électricité','Normale','À faire','Devis en cours à l’intendance','Gymnase'],
 ['Conciergerie à ranger','Autre','Basse','À faire','Stand-by','Conciergerie'],
 ['Modification du support produit chimique','Autre','Basse','À faire','',''],
 ['Mettre cale de douche appartement Bozio','Plomberie','Normale','À faire','','Logement Bozio'],
 ['Changer les robinets d’arrivée d’eau logement','Plomberie','Haute','À faire','','Logement'],
 ['Fixer l’armoire sous la paillasse labo 3','Mobilier','Basse','À faire','','Laboratoire 3'],
 ['Repeindre vers ancien emplacement DAE','Peinture','Haute','À faire','',''],
 ['Enlever les roulettes en 129','Mobilier','Normale','À faire','','Salle 129'],
 ['Roulette à visser en 116','Mobilier','Normale','À faire','','Salle 116'],
 ['Fixer poubelles extérieures','Espaces extérieurs','Haute','À faire','','Cour'],
 ['Fixer attrape-chewing-gum','Mobilier','Haute','À faire','','']
];

const GENERIC_CLEANING=[['Poussière / mobilier','Selon plan local'],['Lavage des sols','Selon plan local'],['Points de contact','Selon plan local'],['Vitres / miroirs','Selon besoin'],['Poubelles / consommables','Selon plan local'],['Murs / portes','Selon besoin'],['Odeurs / aération','À chaque passage'],['Rangement général','À chaque passage']];
const VACATION_TASKS=['Vérifier et programmer les alarmes / intrusion','Vérifier les accès, clés et badges','Adapter ou arrêter le chauffage selon consignes','Adapter la ventilation et la climatisation','Sécuriser l’eau et programmer la remise en service ECS','Prévoir surveillance légionelles / températures si nécessaire','Éteindre les éclairages non indispensables','Sécuriser informatique, réseau et équipements audiovisuels','Contrôler chambres froides, cuisine et demi-pension','Prévoir surveillance des chantiers et entreprises','Informer les personnes d’astreinte et prestataires','Programmer la remise en service avant la rentrée','Effectuer une ronde de fermeture','Effectuer une ronde de réouverture'];
const SCHOOL_CALENDAR={
 '2026-2027':{
  A:[['Toussaint','2026-10-18','2026-11-01','Fin des cours 17/10 — reprise 02/11'],['Noël','2026-12-20','2027-01-03','Fin des cours 19/12 — reprise 04/01'],['Hiver','2027-02-14','2027-02-28','Fin des cours 13/02 — reprise 01/03'],['Printemps','2027-04-11','2027-04-25','Fin des cours 10/04 — reprise 26/04'],['Été','2027-07-04','2027-08-31','Fin des cours 03/07 — date de fin à adapter']],
  B:[['Toussaint','2026-10-18','2026-11-01','Fin des cours 17/10 — reprise 02/11'],['Noël','2026-12-20','2027-01-03','Fin des cours 19/12 — reprise 04/01'],['Hiver','2027-02-21','2027-03-07','Fin des cours 20/02 — reprise 08/03'],['Printemps','2027-04-18','2027-05-02','Fin des cours 17/04 — reprise 03/05'],['Été','2027-07-04','2027-08-31','Fin des cours 03/07 — date de fin à adapter']],
  C:[['Toussaint','2026-10-18','2026-11-01','Fin des cours 17/10 — reprise 02/11'],['Noël','2026-12-20','2027-01-03','Fin des cours 19/12 — reprise 04/01'],['Hiver','2027-02-07','2027-02-21','Fin des cours 06/02 — reprise 22/02'],['Printemps','2027-04-04','2027-04-18','Fin des cours 03/04 — reprise 19/04'],['Été','2027-07-04','2027-08-31','Fin des cours 03/07 — date de fin à adapter']]
 }
};
const PERIODIC_CATALOG=[
 ['Installations électriques ERP','Électricité',12,'Vérification périodique des installations et de l’éclairage de sécurité','Organisme / technicien compétent','Registre de sécurité'],
 ['SSI, alarme, détection et dispositifs associés','Incendie / SSI',12,'Maintenance et essais selon contrat, constructeur et règlement ERP','Prestataire SSI','Registre de sécurité'],
 ['Extincteurs et moyens de secours','Incendie / SSI',12,'Maintenance régulière et traçabilité des interventions','Prestataire incendie','Registre de sécurité'],
 ['Éclairage de sécurité / BAES — essai fonctionnel','Incendie / SSI',1,'Essais d’exploitation et consignation','Agent compétent','Registre de sécurité'],
 ['Éclairage de sécurité / BAES — autonomie','Incendie / SSI',6,'Essai d’autonomie et consignation','Agent compétent / prestataire','Registre de sécurité'],
 ['Désenfumage, clapets et portes coupe-feu','Incendie / SSI',12,'Vérification et essais des dispositifs','Prestataire qualifié','Registre de sécurité'],
 ['Exercices incendie','Sûreté / PPMS',6,'Au moins deux exercices dans l’année scolaire','Établissement','Compte rendu exercice'],
 ['Exercices PPMS','Sûreté / PPMS',6,'Un exercice en septembre-octobre et un avant les vacances d’hiver','Établissement','Compte rendu exercice'],
 ['Commission de sécurité ERP','Incendie / SSI',0,'Périodicité selon catégorie ERP et prescription de la commission','Commission de sécurité','Procès-verbal'],
 ['Chaudières et installations de chauffage','Chauffage / CVC',12,'Entretien, contrôle et réglages selon puissance et contrat','Exploitant chauffage','Carnet chaufferie'],
 ['Ventilation / CTA / VMC','Chauffage / CVC',12,'Maintenance des équipements, filtres et débits','Exploitant CVC','Carnet maintenance'],
 ['Installations gaz et organes de coupure','Gaz / cuisine',12,'Vérification selon règlement ERP et contrat','Prestataire qualifié','Registre sécurité'],
 ['Appareils de cuisson, hottes et conduits','Gaz / cuisine',12,'Entretien et nettoyage des appareils, hottes, filtres et conduits','Prestataire cuisine','Registre / rapport'],
 ['Ascenseur — contrôle technique','Ascenseurs / levage',60,'Contrôle technique quinquennal, en plus de l’entretien courant','Contrôleur indépendant','Rapport ascenseur'],
 ['Ascenseur — entretien contractuel','Ascenseurs / levage',1,'Visites et opérations selon contrat réglementaire','Ascensoriste','Carnet d’entretien'],
 ['Portes et portails automatiques','Portes / accès',6,'Maintenance et vérification des sécurités selon installation','Prestataire portes','Carnet entretien'],
 ['Appareils de levage / monte-charge','Ascenseurs / levage',12,'Vérification générale périodique selon le type d’équipement','Organisme compétent','Rapport VGP'],
 ['Températures eau chaude sanitaire','Eau / légionelles',1,'Surveillance régulière des températures du réseau ECS','Exploitant / agent','Carnet sanitaire'],
 ['Analyses légionelles','Eau / légionelles',12,'Campagne d’analyses selon installations et points à risque','Laboratoire accrédité','Carnet sanitaire'],
 ['Qualité de l’air intérieur','Qualité de l’air / radon',0,'Évaluation et plan d’actions selon réglementation applicable','Prestataire / collectivité','Dossier QAI'],
 ['Mesurage radon si établissement concerné','Qualité de l’air / radon',120,'Mesurage périodique dans les zones et établissements concernés','Organisme agréé','Rapport radon'],
 ['Équipements sportifs et ancrages','Équipements sportifs',12,'Contrôle visuel régulier et contrôle approfondi selon fabricant','Prestataire / agent compétent','Registre équipements'],
 ['Équipements sous pression','Équipements sous pression',0,'Inspection et requalification selon catégorie, dossier et plan d’inspection','Personne / organisme compétent','Dossier exploitation'],
 ['Installations frigorifiques / recherche de fuite','Froid / fluides',0,'Périodicité selon charge, fluide et dispositif de détection','Opérateur attesté','Registre fluides'],
 ['Protection contre la foudre / paratonnerre','Électricité',12,'Contrôle si installation présente et selon étude / norme','Organisme compétent','Rapport contrôle']
];
function makePeriodic(){return PERIODIC_CATALOG.map((x,i)=>({id:uid(),no:`CP-${String(i+1).padStart(3,'0')}`,name:x[0],family:x[1],intervalMonths:x[2],requirement:x[3],provider:x[4],register:x[5],building:'Tous bâtiments',lastDate:'',nextDate:'',time:'',floor:'',sector:'',room:'',status:'À planifier',notes:'',attachments:[]}))}

const CONTRACT_CONTROLS_V14723=[["gaz", "Contrôle des installations de gaz", "Gaz / cuisine", 12, "annuelle", "2025-02-25", "", "Tous bâtiments", "Contrôle périodique des installations de gaz.", ""], ["electricite", "Contrôle des installations électriques", "Électricité", 12, "annuelle", "2025-06-17", "", "Tous bâtiments", "Contrôle périodique des installations électriques.", ""], ["electricite-algeco", "Contrôle des installations électriques ALGECO", "Électricité", 12, "annuelle", "2025-05-28", "", "Algeco", "Contrôle périodique des installations électriques de l'ALGECO.", ""], ["ssi-desenfumage", "Contrôle du SSI + désenfumage", "Incendie / SSI", 36, "triennale", "2024-05-02", "", "Tous bâtiments", "Contrôle du SSI et du désenfumage.", ""], ["colonne-seche", "Contrôle colonne sèche incendie", "Incendie / SSI", 12, "annuelle + contrôle approfondi tous les 5 ans", "2024-12-20", "", "Tous bâtiments", "Contrôle annuel de la colonne sèche.", "Contrôle approfondi tous les 5 ans ; le tableau source indiquait : à prévoir en 2025."], ["installations-thermiques", "Contrôle installations thermiques (efficacité énergétique chaudières et émissions polluantes)", "Chauffage / CVC", 36, "triennale", "2024-12-11", "", "Tous bâtiments", "Contrôle efficacité énergétique chaudières et émissions polluantes.", ""], ["ascenseur-rvre", "Vérification de l'ascenseur — contrôle technique + RVRE incendie", "Ascenseurs / levage", 60, "tous les 5 ans", "2026-04-23", "BUREAU VERITAS", "Bâtiment Noëlas", "Contrôle technique ascenseur + RVRE incendie.", "Mise en service à Noëlas : janvier 2022. Contrôle fait le 23/04/2026."], ["ligne-vie-gym-dp", "Contrôle des lignes de vie en toiture — gymnase + demi-pension", "Travail en hauteur", 12, "annuelle", "2026-01-22", "APAVE", "Gymnase", "Contrôle des lignes de vie en toiture gymnase + demi-pension.", ""], ["ligne-vie-noelas", "Contrôle des lignes de vie en toiture — bâtiment Noëlas", "Travail en hauteur", 12, "annuelle", "2026-04-28", "APAVE", "Bâtiment Noëlas", "Contrôle des lignes de vie en toiture bâtiment Noëlas.", ""], ["porte-automatique", "Contrôle porte automatique", "Portes / accès", 6, "semestrielle", "", "RECORD", "Tous bâtiments", "Contrôle périodique de la porte automatique.", "Dernière prestation non renseignée."], ["eps-espaliers", "Contrôle EPS : 2 espaliers + 1 barre de traction", "Équipements sportifs", 24, "biennale", "2025-12-02", "APAVE", "Gymnase", "Contrôle de 2 espaliers + 1 barre de traction.", "Historique : 04/10/2023 ; 01/10/2024 ; 02/12/2025 contrôle fait avec les poids."], ["eps-gymnase", "Contrôle EPS : gymnase (basket + hand)", "Équipements sportifs", 0, "à définir", "", "", "Gymnase", "Contrôle des équipements basket + hand.", "Périodicité et dernière prestation à compléter."], ["filtres-hottes-armoires", "Contrôle des filtres de hottes et armoires chimiques", "Gaz / cuisine", 12, "annuelle", "", "DALKIA marché Région", "Tous bâtiments", "Contrôle des filtres de hottes et armoires chimiques.", "Dernière prestation non renseignée."]];
function makeContractControls14723(){
 return CONTRACT_CONTROLS_V14723.map((x,i)=>({
   id:uid(),no:`CP-${String(i+1).padStart(3,'0')}`,contractControlKey:x[0],contractSource:'suivi des contrats bis',
   name:x[1],family:x[2],intervalMonths:Number(x[3]||0),periodicityText:x[4]||'',lastDate:x[5]||'',
   nextDate:x[5]&&Number(x[3])>0?addMonthsClamped(x[5],Number(x[3])):'',provider:x[6]||'',building:x[7]||'Tous bâtiments',
   requirement:x[8]||'',notes:x[9]||'',register:'Registre de sécurité',time:'',floor:'',sector:'',room:'',status:'À planifier',attachments:[]
 }))
}
function mergeContractControls14723(d){
 d.settings=d.settings||{};
 if(String(d.settings.contractControlsVersion||'')==='147.23')return;
 d.periodic=Array.isArray(d.periodic)?d.periodic:[];
 const norm=s=>normalizeText(s);
 const aliases={
  gaz:['installation','gaz'],electricite:['installation','electri'], 'electricite-algeco':['electri','algeco'],
  'ssi-desenfumage':['ssi','desenfum'], 'colonne-seche':['colonne','seche'], 'installations-thermiques':['thermique'],
  'porte-automatique':['porte','automatique']
 };
 const taken=new Set();
 for(const src of makeContractControls14723()){
   let found=d.periodic.find(x=>String(x.contractControlKey||'')===src.contractControlKey);
   if(!found){
     const words=aliases[src.contractControlKey]||[];
     if(words.length)found=d.periodic.find(x=>!taken.has(x.id)&&words.every(w=>norm(x.name).includes(w)));
   }
   if(!found){d.periodic.push(src);taken.add(src.id);continue}
   taken.add(found.id);
   const keepAttachments=Array.isArray(found.attachments)?found.attachments:[];
   const keepStatus=found.status||'À planifier';
   const keepNo=found.no||src.no;
   Object.assign(found,src,{id:found.id,no:keepNo,status:keepStatus,attachments:keepAttachments});
 }
 d.settings.contractControlsVersion='147.23';
}

function defaultSpaces(buildings){const out=[];for(const b of buildings){for(const f of b.floors){out.push({id:uid(),building:b.name,floor:f,type:b.name==='Gymnase'?'Salle de sport / gymnase':b.name==='Cour'?'Cour / extérieurs':'Circulations / halls / escaliers',name:'Zone entière'});if(!['Cour','Gymnase'].includes(b.name)){out.push({id:uid(),building:b.name,floor:f,type:'Sanitaires / vestiaires',name:'Sanitaires'});if(/^Bâtiment/.test(b.name)||b.name==='Extension')out.push({id:uid(),building:b.name,floor:f,type:'Salle de classe / devoirs / informatique',name:'Salles de classe'})}}}return out}
function clone(x){return structuredClone(x)}

const BUNDLED_CONTROL_REPORTS=[{"key":"apave-135054046-001-1-rvre","title":"RVRE — Installations électriques et éclairages","org":"APAVE","family":"Électricité","date":"2025-07-07","ref":"135054046-001-1","summary":"RVRE ERP — aucune non-conformité identifiée dans le périmètre de la vérification.","observations":0,"subtype":"RVRE ERP","sha256":"fbcc7667636c65c9a134f6421ab4056fd9fcaedb586bd58f9aa34410dd89759a","size":1344942,"path":"reports/2025-07-07_APAVE_RVRE_Electricite_Eclairages.pdf","file":"2025-07-07_APAVE_RVRE_Electricite_Eclairages.pdf"},{"key":"apave-135054046-001-1-rvp","title":"Vérification périodique des installations électriques","org":"APAVE","family":"Électricité","date":"2025-07-07","ref":"135054046-001-1","summary":"Vérification périodique des installations électriques — 23 observations signalées dans le rapport.","observations":23,"subtype":"Vérification périodique","sha256":"cda549f71a666baaf27efddd3fa653b5a7725910497e2c81403eadc7438fcc01","size":3680309,"path":"reports/2025-07-07_APAVE_Verification_Installations_Electriques.pdf","file":"2025-07-07_APAVE_Verification_Installations_Electriques.pdf"},{"key":"apave-135046511-001-1-gaz","title":"Installations thermiques / réseau gaz","org":"APAVE","family":"Gaz","date":"2025-09-05","ref":"135046511-001-1","summary":"Vérification des installations thermiques fluide / réseau gaz — 1 observation.","observations":1,"subtype":"Thermique / Gaz","sha256":"f5ffc7006ae754c35ce9dbd4a82611eeb6d2e64878f6583e31112cf051588906","size":1497083,"path":"reports/2025-09-05_APAVE_Installations_Thermiques_Gaz.pdf","file":"2025-09-05_APAVE_Installations_Thermiques_Gaz.pdf"},{"key":"apave-a513283837-004-1-sport","title":"Vérification périodique des équipements sportifs","org":"APAVE","family":"Équipements sportifs","date":"2025-12-05","ref":"A513283837-004-1","summary":"Vérification visuelle et manuelle des équipements sportifs — 26 observations.","observations":26,"subtype":"Équipements sportifs","sha256":"423aa2fd3840deafbd2daab0dae3df00f449f40a1b9f3f314f1b44bbdc249f9e","size":4445518,"path":"reports/2025-12-05_APAVE_Equipements_Sportifs.pdf","file":"2025-12-05_APAVE_Equipements_Sportifs.pdf"},{"key":"apave-a513283836-004-1-ancrage","title":"Vérification des dispositifs d’ancrage pour EPI","org":"APAVE","family":"Autres contrôles","date":"2026-02-02","ref":"A513283836-004-1","summary":"Vérification générale périodique des dispositifs d’ancrage pour EPI — 5 observations.","observations":5,"subtype":"Ancrages / EPI","sha256":"fcf149dfb1e45c0e1dab938b86dbee07fcf9839d3b8180734abb92155c2f3e50","size":135938,"path":"reports/2026-02-02_APAVE_Dispositifs_Ancrage_EPI.pdf","file":"2026-02-02_APAVE_Dispositifs_Ancrage_EPI.pdf"},{"key":"bv-28016576-155-1-1-cta-vmc","title":"Contrôle des CTA et VMC sanitaires","org":"Bureau Veritas","family":"VMC / Ventilation","date":"2026-03-20","ref":"28016576/155.1.1.RAP","summary":"Contrôle des installations d’aération/assainissement — CTA et VMC sanitaires — écarts et non-conformités présents dans le rapport.","observations":null,"subtype":"CTA / VMC sanitaires","sha256":"aadb4258da54a155ca98194d8602d3bef1ff46a26236911f82388766f39fdb96","size":5246665,"path":"reports/2026-03-20_BureauVeritas_CTA_VMC_Sanitaires.pdf","file":"2026-03-20_BureauVeritas_CTA_VMC_Sanitaires.pdf"},{"key":"bv-28016576-152-1-1-hottes","title":"Contrôle des hottes de cuisines","org":"Bureau Veritas","family":"Cuisine / Cuisson","date":"2026-03-20","ref":"28016576/152.1.1.RAP","summary":"Contrôle des installations d’aération/assainissement — hottes de cuisines — observations présentes dans le rapport.","observations":null,"subtype":"Hottes de cuisines","sha256":"144566b4d982b7a241b3400b91f0ce4396b13f1026dbfeabd91b4aa024c3b912","size":3374751,"path":"reports/2026-03-20_BureauVeritas_Hottes_Cuisines.pdf","file":"2026-03-20_BureauVeritas_Hottes_Cuisines.pdf"}];

function defaultData(){const buildings=clone(initialBuildings);const agents=[['Mme','Tarrio','Agent d’accueil'],['Mme','Delorme','Agent d’accueil / lingerie'],['Complément','accueil','Agent d’accueil'],['Mme','Berthoux','Agent de restauration'],['Mme','Bozio','Agent d’accueil']].map((n,i)=>({id:uid(),no:`AGT-${String(i+1).padStart(3,'0')}`,firstName:n[0],lastName:n[1],role:n[2],weeklyHours:35,email:'',phone:'',assignment:'',status:'Actif',arrivalDate:'',workdays:[1,2,3,4,5],notes:''}));const monday=startOfWeek(todayISO());const maintenance=IMPORTED_INTERVENTIONS.map((x,i)=>({id:uid(),no:`MAI-2026-${String(i+1).padStart(4,'0')}`,date:todayISO(),title:x[0],family:x[1],priority:x[2],status:x[3],building:x[5]||'',floor:'',room:x[5]||'',requester:'Direction',assigned:'',dueDate:'',cost:'',description:x[4]||'',action:'',attachments:[],importBatch:'excel-2026-08'}));return {version:31,settings:{initialSeedCompleted:true,seedVersion:31,cleaningAlertDays:30,cleaningNotificationsEnabled:true,cleaningNotifyNever:true,cleaningNotifyOverdue:true,cleaningNotifyPlanned:true,meetingAlertDays:3,
autoDailyEnabled:true,autoWeeklyEnabled:false,autoReportHour:'07:00',autoReportTimezone:'Europe/Paris',autoReportWeekdays:'1,2,3,4,5',autoReportOnlyIfEvents:false,autoReportIncludeAgents:true,autoReportIncludeMaintenance:true,autoReportIncludeCleaning:true,autoReportIncludePeriodic:true,autoReportIncludeMeetings:true,autoReportSignature:'Rapport généré automatiquement par Pilotage Service Technique.',lastDailyEmailDate:'',lastWeeklyEmailKey:'',lastWeeklyArchiveKey:'',lastAnnualResetYear:0,appName:'Pilotage Service Technique',schoolName:'Lycée Jean Puy',schoolZone:'A',academicYear:'2026-2027',defaultLayout:'auto',printOrientation:'landscape',defaultInspector:'',emailsTo:'',emailsCc:'',emailsBcc:'',emailSubjectPrefix:'Pilotage Service Technique',outlookEmail:'',counters:{}},lists:clone(defaultLists),buildings,spaces:defaultSpaces(buildings),agents,weeklyPlans:clone(IMPORTED_WEEKLY_PLANS),rotations:[],rotationExceptions:[],agentDays:[],personalEvents:[],roomPreps:[],issues:[],periodic:makeContractControls14723(),cleaning:[],maintenance,requests:[],works:[],meetings:[],notes:[],vacations:[],documents:[],oneDriveLinks:[],contacts:[],attachments:[],archives:[],importArchives:[],cleaningRoomsConfig:null,cleaningRoomChecks:[],notificationDismissals:{},importOriginalBindings:{}}}
function nextSeedNo(rows){return `MAI-2026-${String((rows?.length||0)+1).padStart(4,'0')}`}

function normalizedReportFileKey(name=''){
 return normalizeText(String(name||''))
   .replace(/\bcopy\b|\bcopie\b/g,' ')
   .replace(/\s+/g,' ').trim();
}
function mergeBundledControlReports(d){
 if(!Array.isArray(d.pdfImports))d.pdfImports=[];
 if(!Array.isArray(d.importArchives))d.importArchives=[];
 // 1) Supprimer seulement les doublons certains déjà présents : même empreinte SHA-256.
 const seenHash=new Set();
 d.pdfImports=d.pdfImports.filter(x=>{
   const h=String(x.fileHash||'').trim().toLowerCase();
   if(!h)return true;
   if(seenHash.has(h))return false;
   seenHash.add(h);return true;
 });
 // 2) Ajouter / enrichir les rapports fournis. Deux documents partageant un même n° de rapport
 // mais un objet différent (ex. RVRE et vérification périodique électrique) restent distincts.
 for(const b of BUNDLED_CONTROL_REPORTS){
   const existing=d.pdfImports.find(x=>
      String(x.bundledKey||'')===b.key ||
      (x.fileHash&&String(x.fileHash).toLowerCase()===String(b.sha256).toLowerCase()) ||
      normalizedReportFileKey(x.fileName)===normalizedReportFileKey(b.file)
   );
   const base={kind:'control',importType:'report',bundled:true,bundledKey:b.key,bundledPath:b.path,
      fileName:b.file,fileSize:b.size,fileHash:b.sha256,subject:b.org,controlFamily:b.family,
      reportDate:b.date,reportReference:b.ref,reportSubtype:b.subtype,academicYear:academicYearFor(b.date),
      summary:b.summary,observationCount:b.observations,readOnlyBundled:true};
   let rec=existing;
   if(rec){Object.assign(rec,base,{id:rec.id||`bundled-${b.key}`,createdAt:rec.createdAt||`${b.date}T12:00:00.000Z`});}
   else{rec={id:`bundled-${b.key}`,createdAt:`${b.date}T12:00:00.000Z`,...base};d.pdfImports.push(rec);}
   const ar=d.importArchives.find(x=>String(x.sourceId||'')===String(rec.id)||String(x.bundledKey||'')===b.key);
   const archiveData={sourceId:rec.id,bundled:true,bundledKey:b.key,bundledPath:b.path,type:'Rapport de contrôle',
      createdAt:rec.createdAt,fileHash:b.sha256,fileName:b.file,subject:b.org,academicYear:rec.academicYear,
      summary:b.summary,module:'periodic',analysisSnapshot:{type:'Rapport de contrôle',fileName:b.file,subject:b.org,
      organization:b.org,controlFamily:b.family,reportDate:b.date,reportReference:b.ref,reportSubtype:b.subtype,
      observationCount:b.observations,summary:b.summary,bundled:true}};
   if(ar)Object.assign(ar,archiveData);
   else d.importArchives.push({id:`archive-bundled-${b.key}`,...archiveData});
 }
 // 3) Dédupliquer les archives correspondantes par empreinte, sans toucher aux autres archives métier.
 const ah=new Set();
 d.importArchives=d.importArchives.filter(x=>{
   const h=String(x.fileHash||'').trim().toLowerCase();
   if(!h)return true;
   const k=`${x.type||''}|${h}`;
   if(ah.has(k))return false;ah.add(k);return true;
 });
}

function migrate(raw){
 const base=defaultData();
 if(!raw||typeof raw!=='object'){mergeBundledControlReports(base);return base;}
 const d={...base,...raw,settings:{...base.settings,...(raw.settings||{}),counters:{...base.settings.counters,...(raw.settings?.counters||{})}},lists:{...base.lists,...(raw.lists||{})}};
 for(const k of ['buildings','spaces','agents','weeklyPlans','rotations','rotationExceptions','agentDays','personalEvents','roomPreps','issues','periodic','cleaning','maintenance','requests','works','meetings','notes','vacations','documents','contacts','attachments','archives','importArchives','pdfImports','chronotimeDaily','chronotimeAnnual','reportNonconformities','oneDriveLinks']){
   if(!Array.isArray(d[k]))d[k]=base[k];
 }
 mergeContractControls14723(d);
 if(!Array.isArray(d.cleaningRoomChecks))d.cleaningRoomChecks=[];
 mergeBundledControlReports(d);
 if(!d.notificationDismissals||typeof d.notificationDismissals!=='object'||Array.isArray(d.notificationDismissals))d.notificationDismissals={};
 if(!d.importOriginalBindings||typeof d.importOriginalBindings!=='object'||Array.isArray(d.importOriginalBindings))d.importOriginalBindings={};
 if(d.cleaningRoomsConfig!==null&&!Array.isArray(d.cleaningRoomsConfig))d.cleaningRoomsConfig=null;
 // V147.32 — correction des anciens roulements automatiques fictifs.
 // Un vrai roulement saisi par l'utilisateur n'est jamais supprimé.
 if(Number(raw.version||0)<=31 && Array.isArray(d.rotations)){
   d.rotations=d.rotations.filter(r=>{
     const fake=/^RLT-\d{3}$/.test(String(r.no||'')) &&
       Number(r.morningWeeks)===2 && Number(r.eveningWeeks)===2 &&
       r.morningStart==='06:00' && r.morningEnd==='13:30' &&
       r.eveningStart==='13:00' && r.eveningEnd==='20:30' &&
       Number(r.pause)===30 && !String(r.notes||'').trim();
     return !fake;
   });
 }
 for(const p of d.weeklyPlans||[]){
   const agent=d.agents.find(x=>String(x.id)===String(p.agentId));
   const supplied=IMPORTED_WEEKLY_PLANS.some(sp=>normalizeText(sp.agent||'')===normalizeText(p.agent||agentName(agent)||'')&&Array.isArray(p.rows)&&p.rows.length);
   if(supplied&&(!p.shift||p.shift==='Matin'))p.shift='Standard';
 }
 // Jours travaillés : par défaut lundi à vendredi. Les anciens agents sont migrés automatiquement.
 for(const a of d.agents){
   if(!Array.isArray(a.workdays)||!a.workdays.length)a.workdays=[1,2,3,4,5];
   else a.workdays=[...new Set(a.workdays.map(Number).filter(n=>n>=0&&n<=6))];
 }
 // Conversion uniquement pour les très anciennes sauvegardes. Aucun agent, planning ou intervention supprimé n'est recréé automatiquement.
 if(!d.agentDays.length){
   (raw.shifts||[]).forEach(s=>d.agentDays.push({id:s.id||uid(),agentId:s.agentId,date:s.date,dayType:'Présence',plannedStart:s.plannedStart,plannedEnd:s.plannedEnd,actualStart:s.actualStart,actualEnd:s.actualEnd,pause:s.pause,overtime:s.overtime||0,note:s.notes||''}));
   for(const a of raw.absences||[]){let day=a.dateFrom;while(day&&day<=a.dateTo){if(![0,6].includes(parseDate(day).getDay()))d.agentDays.push({id:uid(),agentId:a.agentId,date:day,dayType:a.type||'Autre absence',plannedStart:'',plannedEnd:'',actualStart:'',actualEnd:'',pause:0,overtime:0,note:a.notes||'',status:a.status||'Validée'});day=addDays(day,1)}}
 }
 d.version=32;
 return d;
}
function restoreSuppliedData(showMessage=true){
 const base=defaultData();
 // Agents fournis : ajout uniquement s'ils n'existent pas déjà.
 for(const sa of base.agents){
   const key=agentName(sa).toLowerCase().replace(/\s+/g,' ').trim();
   if(!db.agents.some(a=>agentName(a).toLowerCase().replace(/\s+/g,' ').trim()===key)) db.agents.push(sa);
 }
 // Horaires hebdomadaires fournis : restaure chaque fiche absente sans écraser les modifications existantes.
 for(const sp of clone(IMPORTED_WEEKLY_PLANS)){
   const key=String(sp.agent||'').toLowerCase().replace(/\s+/g,' ').trim();
   const i=db.weeklyPlans.findIndex(p=>String(p.agent||agentName(agentById(p.agentId))||'').toLowerCase().replace(/\s+/g,' ').trim()===key);
   if(i<0) db.weeklyPlans.push(sp);
   else if(!Array.isArray(db.weeklyPlans[i].rows)||!db.weeklyPlans[i].rows.length) db.weeklyPlans[i]=sp;
 }
 // Interventions/consignes fournies : ajout de tout élément manquant, sans supprimer les saisies personnelles.
 for(const x of IMPORTED_INTERVENTIONS){
   const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
   if(!db.maintenance.some(m=>norm(m.title)===norm(x[0]))){
     db.maintenance.push({id:uid(),no:nextSeedNo(db.maintenance),date:todayISO(),title:x[0],family:x[1],priority:x[2],status:x[3],building:x[5]||'',floor:'',room:x[5]||'',requester:'Direction',assigned:'',dueDate:'',cost:'',description:x[4]||'',action:'',attachments:[],importBatch:'excel-2026-08'});
   }
 }
 // Contrôles périodiques et bâtiments de référence si absents.
 if(!Array.isArray(db.periodic)||!db.periodic.length) db.periodic=makePeriodic();
 if(!Array.isArray(db.archives))db.archives=[];
 db.settings.cleaningAlertDays=Number(db.settings.cleaningAlertDays||30);db.settings.cleaningNotificationsEnabled=db.settings.cleaningNotificationsEnabled!==false;db.settings.cleaningNotifyNever=db.settings.cleaningNotifyNever!==false;db.settings.cleaningNotifyOverdue=db.settings.cleaningNotifyOverdue!==false;db.settings.cleaningNotifyPlanned=db.settings.cleaningNotifyPlanned!==false;db.settings.meetingAlertDays=Number(db.settings.meetingAlertDays||3);db.changeHistory=db.changeHistory||[];db.settings.lastWeeklyArchiveKey=db.settings.lastWeeklyArchiveKey||'';db.settings.lastAnnualResetYear=Number(db.settings.lastAnnualResetYear||0);
 if(!Array.isArray(db.buildings)||!db.buildings.length) db.buildings=clone(initialBuildings);
 if(!Array.isArray(db.spaces)||!db.spaces.length) db.spaces=defaultSpaces(db.buildings);
 db.version=30;
 db.settings.initialSeedCompleted=true;db.settings.seedVersion=31;
 try{window.dispatchEvent(new Event('pst:data-saved'))}catch(_){ }
 if(showMessage){renderAll();toast('Toutes les données fournies ont été restaurées')}
}
let db=defaultData(); let teamWeek=startOfWeek(todayISO()),personalWeek=startOfWeek(todayISO()),modalHandler=null,modalDeleteHandler=null,currentView='dashboard',modalAuditInitial=null,modalAuditTitle='';
let supabaseClient=null,currentUser=null,cloudReady=false,cloudSaveTimer=null,cloudRetryTimer=null,cloudBusy=false,cloudPollTimer=null,lastCloudUpdatedAt='',localDirty=false,lastCloudData=null,lastCloudError='';
const OFFLINE_CACHE_KEY='pst_offline_pending_v130';
const OFFLINE_MIRROR_KEY='pst_offline_mirror_v130';
function setSaveState(text,state=''){const s=$('#saveState');if(!s)return;s.textContent=text;s.dataset.state=state}
function classifyCloudError(message=''){
 const m=String(message||'').toLowerCase();
 if(!navigator.onLine)return 'internet';
 if(m.includes('délai')||m.includes('timeout'))return 'timeout';
 if(m.includes('row-level')||m.includes('rls')||m.includes('permission')||m.includes('not allowed')||m.includes('policy')||m.includes('42501'))return 'permission';
 if(m.includes('jwt')||m.includes('token')||m.includes('auth')||m.includes('session')||m.includes('401')||m.includes('403'))return 'auth';
 if(m.includes('network')||m.includes('fetch')||m.includes('failed to fetch'))return 'network';
 if(m.includes('occupé')||m.includes('busy'))return 'busy';
 return 'supabase';
}
function cloudFailureText(message=''){
 const kind=classifyCloudError(message);
 const msg=String(message||'Erreur inconnue');
 if(kind==='internet')return 'Pas de connexion Internet.';
 if(kind==='timeout')return `Supabase ne répond pas assez vite : ${msg}`;
 if(kind==='permission')return `Supabase refuse l’écriture (droits/RLS) : ${msg}`;
 if(kind==='auth')return `Session Supabase non valide ou expirée : ${msg}`;
 if(kind==='network')return `Internet fonctionne mais la requête Supabase a échoué : ${msg}`;
 if(kind==='busy')return `Supabase est occupé par une autre synchronisation : ${msg}`;
 return `Supabase n’a pas confirmé l’écriture : ${msg}`;
}
function withTimeout(promise,ms=9000){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Délai de connexion dépassé')),ms))])}
function hasUsefulData(x){return !!(x&&((x.agents&&x.agents.length)||(x.maintenance&&x.maintenance.length)||(x.weeklyPlans&&x.weeklyPlans.length)||(x.notes&&x.notes.length)))}
function deepClone(x){try{return structuredClone(x)}catch(_){return JSON.parse(JSON.stringify(x))}}
function eq(a,b){try{return JSON.stringify(a)===JSON.stringify(b)}catch(_){return a===b}}
function isObj(x){return !!x&&typeof x==='object'&&!Array.isArray(x)}
function mergeThreeWay(base,local,remote){
 if(eq(local,base))return deepClone(remote);
 if(eq(remote,base))return deepClone(local);
 if(eq(local,remote))return deepClone(local);
 if(Array.isArray(local)&&Array.isArray(remote)){
   const b=Array.isArray(base)?base:[];
   const objectIds=[...local,...remote,...b].filter(x=>isObj(x)).every(x=>x.id!=null);
   if(objectIds){
     const bm=new Map(b.map(x=>[String(x.id),x])),lm=new Map(local.map(x=>[String(x.id),x])),rm=new Map(remote.map(x=>[String(x.id),x]));
     const order=[];for(const arr of [b,remote,local])for(const x of arr){const id=String(x.id);if(!order.includes(id))order.push(id)}
     const out=[];
     for(const id of order){const B=bm.get(id),L=lm.get(id),R=rm.get(id);
       if(B!==undefined){
         if(L===undefined&&R===undefined)continue;
         if(L===undefined){if(eq(R,B))continue;continue} // suppression locale prioritaire en conflit
         if(R===undefined){if(eq(L,B))continue;out.push(deepClone(L));continue}
         out.push(mergeThreeWay(B,L,R));
       }else{
         if(L!==undefined&&R!==undefined)out.push(mergeThreeWay(undefined,L,R));
         else if(L!==undefined)out.push(deepClone(L));
         else if(R!==undefined)out.push(deepClone(R));
       }
     }
     return out;
   }
   return deepClone(local); // tableaux simples : la modification locale est prioritaire
 }
 if(isObj(local)&&isObj(remote)){
   const B=isObj(base)?base:{};const out={};
   const keys=new Set([...Object.keys(B),...Object.keys(local),...Object.keys(remote)]);
   for(const k of keys){
     const hasB=Object.prototype.hasOwnProperty.call(B,k),hasL=Object.prototype.hasOwnProperty.call(local,k),hasR=Object.prototype.hasOwnProperty.call(remote,k);
     if(hasB){
       if(!hasL&&!hasR)continue;
       if(!hasL){if(eq(remote[k],B[k]))continue;continue}
       if(!hasR){if(eq(local[k],B[k]))continue;out[k]=deepClone(local[k]);continue}
       out[k]=mergeThreeWay(B[k],local[k],remote[k]);
     }else{
       if(hasL&&hasR)out[k]=mergeThreeWay(undefined,local[k],remote[k]);
       else if(hasL)out[k]=deepClone(local[k]);
       else if(hasR)out[k]=deepClone(remote[k]);
     }
   }
   return out;
 }
 return deepClone(local);
}
function readJson(key){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch(error){console.warn('Lecture locale impossible',error);return null}}
function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(error){console.error('Écriture locale impossible',error);return false}}
function readOfflinePending(){return readJson(OFFLINE_CACHE_KEY)}
function writeMirror(){if(!currentUser)return false;return writeJson(OFFLINE_MIRROR_KEY,{userId:currentUser.id,savedAt:new Date().toISOString(),data:db})}
function loadMirrorIntoMemory(){const m=readJson(OFFLINE_MIRROR_KEY);if(!m?.data)return false;if(currentUser?.id&&m.userId&&m.userId!==currentUser.id)return false;db=migrate(m.data);safeRenderAll();try{window.dispatchEvent(new Event('pst:data-loaded'))}catch(_){}return true}
function writeOfflinePending(reason='hors ligne'){
 try{
   let previous=readOfflinePending();
   const baseData=previous?.baseData||lastCloudData||db;
   const item={userId:currentUser?.id||'',savedAt:new Date().toISOString(),baseCloudUpdatedAt:previous?.baseCloudUpdatedAt||lastCloudUpdatedAt||'',baseData:deepClone(baseData),reason,data:deepClone(db)};
   localStorage.setItem(OFFLINE_CACHE_KEY,JSON.stringify(item));writeMirror();localDirty=true;setSaveState('Hors ligne — modifications gardées sur cet appareil','local');return true
 }catch(error){console.error('Sauvegarde hors ligne impossible',error);setSaveState('Hors ligne — stockage local impossible','error');return false}
}
function clearOfflinePending(){try{localStorage.removeItem(OFFLINE_CACHE_KEY)}catch(_){}}
function loadOfflinePendingIntoMemory(){const pending=readOfflinePending();if(!pending?.data)return false;if(currentUser?.id&&pending.userId&&pending.userId!==currentUser.id)return false;db=migrate(pending.data);lastCloudData=pending.baseData?migrate(pending.baseData):lastCloudData;localDirty=true;safeRenderAll();try{window.dispatchEvent(new Event('pst:data-loaded'))}catch(_){}setSaveState('Hors ligne — modifications en attente de synchronisation','local');return true}
function scheduleCloudRetry(delay=12000){clearTimeout(cloudRetryTimer);cloudRetryTimer=setTimeout(()=>{if(navigator.onLine&&currentUser){if(localDirty||readOfflinePending())syncOfflinePending();else pollCloudChanges()}},delay)}
function useLocalMode(reason='Connexion momentanément indisponible'){cloudReady=false;console.warn(reason);if(!loadOfflinePendingIntoMemory()&&!loadMirrorIntoMemory())setSaveState('Hors ligne — les nouvelles modifications seront gardées sur cet appareil','local');else setSaveState('Hors ligne — données locales disponibles','local');scheduleCloudRetry()}
async function fetchRemote(){
 const result=await withTimeout(supabaseClient.from('app_state').select('data,updated_at').eq('user_id',currentUser.id).maybeSingle());
 const {data,error}=result||{};if(error)throw error;return data||null;
}
async function syncOfflinePending(){
 if(!supabaseClient||!currentUser||!navigator.onLine)return false;
 const pending=readOfflinePending();
 if(pending?.userId&&pending.userId!==currentUser.id)return false;
 if(pending?.data){db=migrate(pending.data);lastCloudData=pending.baseData?migrate(pending.baseData):lastCloudData;localDirty=true}
 if(!localDirty)return true;
 setSaveState('Connexion revenue — fusion et synchronisation…','loading');
 const ok=await cloudSaveNow({silent:true,mergeRemote:true});
 if(ok){clearOfflinePending();setSaveState(`Synchronisé à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`,'cloud')}
 return ok;
}
async function cloudLoad({silent=false}={}){
 if(!supabaseClient||!currentUser||cloudBusy)return false;
 cloudBusy=true;if(!silent)setSaveState('Connexion au serveur…','loading');
 try{
   const data=await fetchRemote();
   if(data?.data&&hasUsefulData(data.data)){
     db=migrate(data.data);lastCloudData=deepClone(db);lastCloudUpdatedAt=data.updated_at||lastCloudUpdatedAt;
     if(Number(db.settings?.seedVersion||0)<26){restoreSuppliedData(false);db.settings.initialSeedCompleted=true;db.settings.seedVersion=31;localDirty=true}
   }else{
     db=defaultData();runAutomaticHousekeeping();restoreSuppliedData(false);db.settings.initialSeedCompleted=true;db.settings.seedVersion=31;lastCloudData=null;localDirty=true;
   }
   cloudBusy=false;
   if(localDirty){const ok=await cloudSaveNow({silent:true,mergeRemote:true});if(!ok)return false}
   cloudReady=true;writeMirror();renderAll();try{window.dispatchEvent(new Event('pst:data-loaded'))}catch(_){ }
   setSaveState(`Synchronisé à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`,'cloud');clearTimeout(cloudRetryTimer);return true;
 }catch(error){console.error('Supabase indisponible :',error);useLocalMode(error?.message||String(error));try{window.dispatchEvent(new CustomEvent('pst:cloud-error',{detail:{message:error?.message||String(error)}}))}catch(_){ }return false}
 finally{cloudBusy=false}
}
async function cloudSaveNow({silent=false,mergeRemote=true}={}){
 if(!supabaseClient||!currentUser)return false;
 if(cloudBusy){
   clearTimeout(cloudSaveTimer);
   cloudSaveTimer=setTimeout(()=>{if(localDirty&&currentUser){if(navigator.onLine)cloudSaveNow({silent:true,mergeRemote:true});else writeOfflinePending('appareil hors connexion')}},700);
   return false;
 }
 cloudBusy=true;
 try{
   let toSave=deepClone(db),remoteRow=null;
   if(mergeRemote){
     remoteRow=await fetchRemote();
     if(remoteRow?.data){
       const remote=migrate(remoteRow.data),base=lastCloudData||remote;
       toSave=migrate(mergeThreeWay(base,toSave,remote));
     }
   }
   const stamp=new Date().toISOString();
   const payload={user_id:currentUser.id,data:toSave,updated_at:stamp};
   const {error}=await withTimeout(supabaseClient.from('app_state').upsert(payload,{onConflict:'user_id'}));if(error)throw error;
   db=toSave;lastCloudData=deepClone(toSave);lastCloudUpdatedAt=stamp;localDirty=false;cloudReady=true;lastCloudError='';clearOfflinePending();writeMirror();
   setSaveState(`Synchronisé à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`,'cloud');clearTimeout(cloudRetryTimer);safeRenderAll();try{window.dispatchEvent(new Event('pst:data-loaded'))}catch(_){}return true;
  }catch(error){
    lastCloudError=error?.message||String(error)||'Erreur Supabase inconnue';
    console.error('Sauvegarde cloud différée :',error);
    writeOfflinePending(lastCloudError);
    const detail=cloudFailureText(lastCloudError);
    setSaveState(detail,'error');
    if(!silent)toast(detail);
    scheduleCloudRetry();
    return false
  }
 finally{cloudBusy=false}
}
function save(render=true){
 clearTheoreticalScheduleCache();
 localDirty=true;
 if(!currentUser){setSaveState('Non connecté — non enregistré','error');if(render)safeRenderAll();return false}
 if(!navigator.onLine){writeOfflinePending('appareil hors connexion');if(render)safeRenderAll();return true}
 setSaveState('Envoi au serveur…','loading');clearTimeout(cloudSaveTimer);
 cloudSaveTimer=setTimeout(()=>{if(localDirty&&currentUser){if(navigator.onLine)cloudSaveNow({silent:true,mergeRemote:true});else writeOfflinePending('appareil hors connexion')}},350);
 if(render)safeRenderAll();return true;
}
window.PSTMainState={
 get:()=>db,
 save:(render=true)=>save(render),
 // Sauvegarde immédiate utilisée par les formulaires sensibles (ex. salle/café).
 // En ligne : attend la confirmation Supabase. Hors ligne : met explicitement en attente locale.
 persistNow:async()=>{
   localDirty=true;
   if(!currentUser){setSaveState('Non connecté — non enregistré','error');return {ok:false,offline:false}}
   if(!navigator.onLine){const ok=writeOfflinePending('appareil hors connexion');return {ok:!!ok,offline:true}}
   setSaveState('Test et envoi réel vers Supabase…','loading');
   const ok=await cloudSaveNow({silent:false,mergeRemote:true});
   return {ok:!!ok,offline:!ok};
 },
  persistStateDirect:async({label='Données',verify}={})=>{
    if(!supabaseClient||!currentUser){
      return {ok:false,offline:false,error:'Client Supabase ou utilisateur non disponible.'};
    }
    const timeoutMs=15000;
    const withTimeout=(promise,step)=>Promise.race([
      promise,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${step} : délai dépassé après 15 s`)),timeoutMs))
    ]);
    try{
      localDirty=true;
      setSaveState(`${label} : écriture directe Supabase…`,'loading');
      const payload=migrate(deepClone(db)), nowIso=new Date().toISOString();
      const write=await withTimeout(
        supabaseClient.from('app_state')
          .upsert({user_id:currentUser.id,data:payload,updated_at:nowIso},{onConflict:'user_id'})
          .select('updated_at').single(),
        'Écriture Supabase'
      );
      if(write?.error)throw write.error;

      setSaveState(`${label} : relecture de contrôle…`,'loading');
      const read=await withTimeout(
        supabaseClient.from('app_state').select('data,updated_at').eq('user_id',currentUser.id).single(),
        'Relecture Supabase'
      );
      if(read?.error)throw read.error;

      const remote=migrate(read?.data?.data||{});
      if(typeof verify==='function' && !verify(remote)){
        throw new Error(`${label} écrit mais non retrouvé lors de la relecture Supabase.`);
      }

      db=remote;
      lastCloudData=deepClone(remote);
      lastCloudUpdatedAt=read?.data?.updated_at||write?.data?.updated_at||nowIso;
      lastCloudError='';
      localDirty=false;
      cloudReady=true;
      clearOfflinePending();
      writeMirror();
      safeRenderAll();
      try{window.dispatchEvent(new Event('pst:data-loaded'))}catch(_){}
      setSaveState(`Synchronisé à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`,'cloud');
      return {ok:true,offline:false};
    }catch(error){
      lastCloudError=error?.message||String(error)||'Erreur Supabase inconnue';
      localDirty=true;
      writeOfflinePending(lastCloudError);
      safeRenderAll();
      setSaveState(`Erreur Supabase : ${lastCloudError}`,'error');
      console.error(`${label} — sauvegarde directe Supabase`,error);
      return {ok:false,offline:false,error:lastCloudError};
    }
  },
  persistChronotimeDirect:async(importId)=>{
    if(!supabaseClient||!currentUser)return {ok:false,offline:false,error:'Client Supabase ou utilisateur non disponible.'};
    const timeoutMs=15000;
    const withTimeout=(promise,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} : délai dépassé après 15 s`)),timeoutMs))]);
    try{
      localDirty=true;
      setSaveState('Chronotime : écriture directe Supabase…','loading');
      const payload=migrate(deepClone(db)), nowIso=new Date().toISOString();
      const write=await withTimeout(supabaseClient.from('app_state').upsert({user_id:currentUser.id,data:payload,updated_at:nowIso},{onConflict:'user_id'}).select('updated_at').single(),'Écriture Supabase');
      if(write?.error)throw write.error;
      setSaveState('Chronotime : relecture de contrôle…','loading');
      const read=await withTimeout(supabaseClient.from('app_state').select('data,updated_at').eq('user_id',currentUser.id).single(),'Relecture Supabase');
      if(read?.error)throw read.error;
      const remote=migrate(read?.data?.data||{}), id=String(importId||'');
      const found=(remote.pdfImports||[]).some(x=>String(x.id||'')===id)||(remote.chronotimeAnnual||[]).some(x=>String(x.id||'')===id||String(x.sourceId||'')===id);
      if(!found)throw new Error('Écriture réussie mais nouvel import absent lors de la relecture Supabase.');
      lastCloudData=deepClone(remote); lastCloudUpdatedAt=read?.data?.updated_at||nowIso; lastCloudError=''; localDirty=false; cloudReady=true;
      clearOfflinePending(); writeMirror();
      setSaveState(`Synchronisé à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`,'cloud');
      return {ok:true,offline:false,found:true};
    }catch(error){
      lastCloudError=error?.message||String(error)||'Erreur Supabase inconnue'; localDirty=true; writeOfflinePending(lastCloudError);
      setSaveState(`Erreur Supabase : ${lastCloudError}`,'error');
      console.error('Chronotime direct Supabase',error);
      return {ok:false,offline:false,error:lastCloudError};
    }
  },
  verifyChronotimeImport:async(importId)=>{
    if(!supabaseClient||!currentUser)return {ok:false,found:false};
    try{
      const row=await fetchRemote();
      const remote=migrate(row?.data||{});
      const id=String(importId||'');
      const found=!!(
        (remote.pdfImports||[]).some(x=>String(x.id||'')===id) ||
        (remote.chronotimeAnnual||[]).some(x=>String(x.id||'')===id||String(x.sourceId||'')===id)
      );
      if(found){
        lastCloudData=deepClone(remote);
        lastCloudUpdatedAt=row?.updated_at||lastCloudUpdatedAt;
        localDirty=false;
        cloudReady=true;
        clearOfflinePending();
        writeMirror();
        setSaveState(`Synchronisé à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`,'cloud');
        return {ok:true,found:true};
      }
      localDirty=true;
      return {ok:true,found:false};
    }catch(error){
      console.error('Vérification Chronotime Supabase',error);
      localDirty=true;
      return {ok:false,found:false,error:error?.message||String(error)};
    }
  }
};
async function pollCloudChanges(){
 if(!supabaseClient||!currentUser||!navigator.onLine||cloudBusy||localDirty)return;
 try{
   const data=await fetchRemote();if(!data?.data)return;
   const remoteStamp=data.updated_at||'';
   if(remoteStamp&&remoteStamp!==lastCloudUpdatedAt){clearTheoreticalScheduleCache();db=migrate(data.data);lastCloudData=deepClone(db);lastCloudUpdatedAt=remoteStamp;writeMirror();safeRenderAll();try{window.dispatchEvent(new Event('pst:data-loaded'))}catch(_){ }setSaveState(`Synchronisé à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`,'cloud')}
 }catch(error){console.warn('Vérification cloud différée',error);scheduleCloudRetry()}
}
function startCloudPolling(){clearInterval(cloudPollTimer);cloudPollTimer=setInterval(pollCloudChanges,8000)}
function safeRenderAll(){
 clearTheoreticalScheduleCache();
 capturePlanningScroll();

 // V147.36 : ne plus recalculer les 20+ écrans cachés à chaque sauvegarde.
 // L'écran actif est rendu immédiatement ; les autres seront recalculés à leur ouverture.
 const common=[
   ['Sélecteurs',hydrateSelects],
   ['Marque',renderBrand],
   ['Notifications',renderNotifications]
 ];
 const byView={
   dashboard:['Tableau de bord',renderDashboard],
   personal:['Agenda',renderPersonal],
   agents:['Agents',renderAgents],
   rotations:['Roulements',renderRotations],
   planning:['Horaires',renderPlanning],
   absences:['Absences',renderAbsences],
   vacations:['Vacances',renderVacations],
   issues:['Sécurité',renderIssues],
   periodic:['Contrôles périodiques',renderPeriodic],
   cleaning:['Ménage',renderCleaning],
   maintenance:['Maintenance',renderMaintenance],
   requests:['Demandes',renderRequests],
   works:['Chantiers',renderWorks],
   meetings:['Réunions',renderMeetings],
   notes:['Notes',renderNotes],
   documents:['Documents',renderDocuments],
   archives:['Archives',renderArchives],
   settings:['Paramètres',renderSettings],
   reports:['Rapports',renderReportPreview]
 };
 const errors=[];
 const active=document.querySelector('.view.active')?.id||((typeof currentView!=='undefined'&&currentView)?currentView:'dashboard');
 if(typeof currentView!=='undefined')currentView=active;
 const jobs=[...common];
 if(byView[active])jobs.push(byView[active]);
 for(const [name,fn] of jobs){
   try{fn()}catch(error){console.error(`Erreur d’affichage — ${name}`,error);errors.push(name)}
 }
 if(errors.length)setSaveState(`Enregistré — affichage partiel (${errors.join(', ')})`,'local');
 restorePlanningScroll();
 try{enhanceTableFilters(document.querySelector('.view.active')||document)}catch(error){console.warn('Filtres colonnes',error)}
 return errors;
}
let authInitPromise=null;
async function initAuth(){
 if(authInitPromise)return authInitPromise;
 authInitPromise=(async()=>{
   const loginBtn=$('#authLogin'),errorEl=$('#authError'),emailEl=$('#authEmail'),passwordEl=$('#authPassword');
   if(!loginBtn||!emailEl||!passwordEl)return;
   const setBusy=busy=>{loginBtn.disabled=busy;loginBtn.textContent=busy?'Connexion…':'Se connecter'};
   const loadScript=url=>new Promise((resolve,reject)=>{
     const existing=[...document.scripts].find(s=>s.src===url);
     if(existing){if(window.supabase)return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}
     const script=document.createElement('script');script.src=url;script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error(`Chargement impossible : ${url}`));document.head.appendChild(script);
   });
   const ensureClient=async()=>{
     const cfg=window.SUPABASE_CONFIG||{};
     if(!cfg.url||!cfg.publishableKey)throw new Error('Configuration Supabase absente.');
     if(!window.supabase){
       const fallbacks=[
         'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js',
         'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
       ];
       let loaded=false;
       for(const url of fallbacks){try{await loadScript(url);if(window.supabase){loaded=true;break}}catch(error){console.warn(error)}}
       if(!loaded)throw new Error('Le composant de connexion ne s’est pas chargé. Vérifiez Internet puis rechargez la page.');
     }
     if(!supabaseClient)supabaseClient=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
     return supabaseClient;
   };
   const doLogin=async()=>{
     if(loginBtn.disabled)return;
     const email=emailEl.value.trim(),password=passwordEl.value;
     if(!email){errorEl.textContent='Saisissez votre adresse e-mail.';emailEl.focus();return}
     if(!password){errorEl.textContent='Saisissez votre mot de passe.';passwordEl.focus();return}
     setBusy(true);errorEl.textContent='';
     try{
       const client=await ensureClient();
       const {data,error}=await client.auth.signInWithPassword({email,password});
       if(error)throw error;
       if(!data?.user)throw new Error('Connexion non confirmée.');
       await enterApp(data.user);
     }catch(error){
       console.error('Erreur de connexion',error);
       errorEl.textContent=error?.message==='Invalid login credentials'?'Adresse ou mot de passe incorrect.':(error?.message||'Connexion impossible.');
     }finally{setBusy(false)}
   };
   // Affectation directe et indépendante des autres modules.
   loginBtn.onclick=doLogin;
   passwordEl.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();doLogin()}};
   try{
     const client=await ensureClient();
     const {data:{session}}=await client.auth.getSession();
     if(session?.user)await enterApp(session.user);
   }catch(error){
     console.error('Initialisation Supabase',error);
     errorEl.textContent=error?.message||'Configuration Supabase indisponible.';
   }
   $('#logoutBtn')?.addEventListener('click',async()=>{try{await supabaseClient?.auth.signOut()}finally{location.reload()}});
 })();
 return authInitPromise;
}
async function enterApp(user){
 currentUser=user;$('#authScreen').classList.add('hidden');$('#logoutBtn')?.classList.remove('hidden');
 const pending=readOfflinePending();
 if(!navigator.onLine){
   if(!loadOfflinePendingIntoMemory()&&!loadMirrorIntoMemory())setSaveState('Hors ligne — aucune donnée locale disponible','local');
 }else if(pending?.data){
   loadOfflinePendingIntoMemory();await syncOfflinePending();
 }else{setSaveState('Connexion au serveur…','loading');await cloudLoad()}
 startCloudPolling();
}
async function manualSupabasePing(){
 const b=$('#supabasePingBtn');if(b){b.disabled=true;b.textContent='↻ Requête…'}
 try{
   if(!currentUser)throw new Error('Connectez-vous d’abord.');
   if(!navigator.onLine)throw new Error('Pas de connexion Internet.');
   setSaveState('Requête Supabase…','loading');
   const row=await fetchRemote();
   if(!row)throw new Error('Aucune réponse Supabase.');
   setSaveState(`Supabase actif — ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`,'cloud');
   toast('Requête Supabase OK');
   return true;
 }catch(e){console.error('Requête Supabase',e);setSaveState(`Supabase : ${e?.message||e}`,'error');toast(`Supabase : ${e?.message||e}`);return false}
 finally{if(b){b.disabled=false;b.textContent='↻ Requête Supabase'}}
}
window.addEventListener('online',()=>{if(!currentUser)return;syncOfflinePending().then(ok=>{if(ok&&!localDirty)pollCloudChanges()});startCloudPolling()});
window.addEventListener('offline',()=>{if(currentUser){writeMirror();if(localDirty)writeOfflinePending('appareil hors connexion');setSaveState('Hors ligne — données disponibles sur cet appareil','local')}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentUser){if(navigator.onLine){if(localDirty||readOfflinePending())syncOfflinePending();else pollCloudChanges()}else writeMirror()}});
function nextNo(type,prefix){db.settings.counters[type]=(db.settings.counters[type]||0)+1;return `${prefix}-${new Date().getFullYear()}-${String(db.settings.counters[type]).padStart(4,'0')}`}
function toast(msg){const e=$('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2200)}
function byId(type,id){return db[type]?.find(x=>x.id===id)} function agentById(id){return db.agents.find(a=>a.id===id)} function agentName(a){return a?`${a.firstName||''} ${a.lastName||''}`.trim():'Équipe'}
function agentWorkdays(agentId){const a=agentById(agentId);return Array.isArray(a?.workdays)&&a.workdays.length?a.workdays.map(Number):[1,2,3,4,5]}
function agentOptions(v='',team=false){return `${team?'<option value="">Toute l’équipe</option>':'<option value="">Choisir un agent</option>'}${selectOptions(db.agents.filter(a=>a.status!=='Inactif'||a.id===v),v,agentName,a=>a.id)}`}

function centralLocationRef(){return window.PSTCleaningRooms?.get?.()||[]}
function centralRoomLabel(x){return [x?.number||'',x?.name||''].filter(Boolean).join(' — ')||x?.type||'Local'}
function centralFind(building,floor,sector,room){const d=centralLocationRef();let bi=d.findIndex(x=>x.name===building);if(bi<0)bi=0;const b=d[bi];let fi=(b?.floors||[]).findIndex(x=>x.name===floor);if(fi<0)fi=0;const f=b?.floors?.[fi];let si=(f?.sectors||[]).findIndex(x=>x.name===sector);if(si<0)si=0;const s=f?.sectors?.[si];let ri=(s?.rooms||[]).findIndex(x=>centralRoomLabel(x)===room);if(ri<0)ri=0;return{d,b,f,s,r:s?.rooms?.[ri]}}
function centralLocationFields(x={},prefix='loc'){const d=centralLocationRef();if(!d.length)return `<label>Bâtiment<select name="building">${buildingOptions(x.building||'')}</select></label>${field('Salle / lieu','room',x.room||'')}`;const q=centralFind(x.building,x.floor,x.sector,x.room),op=(v,t,sel)=>`<option value="${esc(v)}" ${v===sel?'selected':''}>${esc(t)}</option>`;return `<label>Bâtiment<select name="building" id="${prefix}Building">${d.map(b=>op(b.name,b.name,q.b?.name)).join('')}</select></label><label>Étage<select name="floor" id="${prefix}Floor">${(q.b?.floors||[]).map(f=>op(f.name,f.name,q.f?.name)).join('')}</select></label><label>Secteur<select name="sector" id="${prefix}Sector">${(q.f?.sectors||[]).map(s=>op(s.name,s.name,q.s?.name)).join('')}</select></label><label>Salle / local<select name="room" id="${prefix}Room">${(q.s?.rooms||[]).map(rr=>op(centralRoomLabel(rr),centralRoomLabel(rr),x.room||centralRoomLabel(q.r))).join('')}<option value="Autre lieu">Autre lieu…</option></select></label><label id="${prefix}OtherWrap" class="hidden">Autre lieu<input name="otherLocation" value="${esc(x.otherLocation||'')}"></label>`}
function bindCentralLocation(prefix='loc'){const B=document.getElementById(prefix+'Building'),F=document.getElementById(prefix+'Floor'),S=document.getElementById(prefix+'Sector'),R=document.getElementById(prefix+'Room'),W=document.getElementById(prefix+'OtherWrap');if(!B||!F||!S||!R)return;const op=(v,t)=>`<option value="${esc(v)}">${esc(t)}</option>`,d=()=>centralLocationRef();const rooms=()=>{const b=d().find(x=>x.name===B.value),f=b?.floors?.find(x=>x.name===F.value),s=f?.sectors?.find(x=>x.name===S.value);R.innerHTML=(s?.rooms||[]).map(x=>op(centralRoomLabel(x),centralRoomLabel(x))).join('')+'<option value="Autre lieu">Autre lieu…</option>';W?.classList.add('hidden')};const sectors=()=>{const b=d().find(x=>x.name===B.value),f=b?.floors?.find(x=>x.name===F.value);S.innerHTML=(f?.sectors||[]).map(x=>op(x.name,x.name)).join('');rooms()};const floors=()=>{const b=d().find(x=>x.name===B.value);F.innerHTML=(b?.floors||[]).map(x=>op(x.name,x.name)).join('');sectors()};B.onchange=floors;F.onchange=sectors;S.onchange=rooms;R.onchange=()=>W?.classList.toggle('hidden',R.value!=='Autre lieu')}

function buildingOptions(v=''){return selectOptions(db.buildings,v,b=>b.name,b=>b.name)}
function floorOptions(building,v=''){const b=db.buildings.find(x=>x.name===building)||db.buildings[0];return selectOptions(b?.floors||[],v)}
function centralCleaningRoomOptions(building,floor,type=''){
 const ref=window.PSTCleaningRooms?.get?.()||[];
 const nb=normalizeText(building),nf=normalizeText(floor),nt=normalizeText(type);
 const b=ref.find(x=>normalizeText(x.name)===nb)||ref.find(x=>normalizeText(x.name).includes(nb)||nb.includes(normalizeText(x.name)));
 if(!b)return [];
 const f=(b.floors||[]).find(x=>{
   const n=normalizeText(x.name);
   return n===nf||n.startsWith(nf)||nf.startsWith(n);
 })||(b.floors||[])[0];
 if(!f)return [];
 const rooms=(f.sectors||[]).flatMap(s=>(s.rooms||[]).map(r=>({...r,sector:s.name})));
 const preferred=r=>{
   const rt=normalizeText(r.type);
   if(!nt)return 1;
   if(nt.includes('dortoir')||nt.includes('internat'))return ['chambre','internat','foyer'].some(x=>rt.includes(x))?0:1;
   if(nt.includes('salle'))return rt.includes('salle')?0:1;
   if(nt.includes('sanitaire'))return rt.includes('sanitaire')?0:1;
   if(nt.includes('circulation'))return rt.includes('circulation')?0:1;
   if(nt.includes('escalier'))return rt.includes('escalier')?0:1;
   if(nt.includes('bureau'))return rt.includes('bureau')?0:1;
   return 1;
 };
 return rooms.sort((x,y)=>preferred(x)-preferred(y)).map(r=>{
   const num=String(r.number||'').trim(),name=String(r.name||'').trim();
   return num&&name?`${num} — ${name}`:num||name||r.type||'Local';
 }).filter(Boolean);
}
function roomOptions(building,floor,type,v=''){
 const legacy=db.spaces.filter(s=>(!building||s.building===building)&&(!floor||s.floor===floor)&&(!type||s.type===type)).map(s=>s.name);
 const central=centralCleaningRoomOptions(building,floor,type);
 const values=[...new Set(['Zone entière',...central,...legacy,'Autre local'])];
 return selectOptions(values,v);
}

/* ---------- Pièces jointes : Supabase Storage uniquement ---------- */
const STORAGE_BUCKET='documentation';
// V87 : le lien archive <-> original est conservé séparément du gros état applicatif.
// Ainsi, un rechargement cloud plus ancien ne peut plus faire revenir un PDF à « Original absent ».
function safeFileName(name){return String(name||'fichier').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_')}
function loadImportOriginalBindings(){db.importOriginalBindings=db.importOriginalBindings||{};return db.importOriginalBindings}
function saveImportOriginalBindings(map){db.importOriginalBindings=map||{};save(false);return true}
function archiveBindingKeys(x){const a=[];if(x?.id)a.push(`archive:${x.id}`);if(x?.sourceId)a.push(`source:${x.sourceId}`);if(!a.length&&x?.fileName)a.push(`file:${normalizeText(x.fileName)}`);return a}
function rememberImportOriginalBinding(x,meta){if(!x||!meta)return false;const map=loadImportOriginalBindings(),payload={attachment:{...meta},savedAt:new Date().toISOString(),archiveId:x.id||'',sourceId:x.sourceId||'',fileName:x.fileName||meta.name||''};for(const k of archiveBindingKeys(x))map[k]=payload;return saveImportOriginalBindings(map)}
function restoreImportOriginalBinding(x){if(!x)return null;const map=loadImportOriginalBindings();let b=null;for(const k of archiveBindingKeys(x)){if(map[k]?.attachment){b=map[k];break}}if(!b?.attachment)return null;const meta=b.attachment;db.attachments=db.attachments||[];let changed=false,rec=db.attachments.find(a=>String(a.id)===String(meta.id));if(!rec){rec={...meta};db.attachments.push(rec);changed=true}else Object.assign(rec,meta);if(!x.attachmentId){x.attachmentId=rec.id;changed=true}const src=(db.pdfImports||[]).find(r=>String(r.id)===String(x.sourceId));if(src&&!src.attachmentId){src.attachmentId=rec.id;changed=true}const stored=(db.importArchives||[]).find(r=>String(r.id)===String(x.id)||x.sourceId&&String(r.sourceId)===String(x.sourceId));if(stored&&!stored.attachmentId){stored.attachmentId=rec.id;changed=true}if(changed)save(false);return rec}
function resolveArchiveAttachment(x){if(!x)return null;let rec=(db.attachments||[]).find(a=>String(a.id)===String(x.attachmentId));if(rec)return rec;return restoreImportOriginalBinding(x)}
function registerImportOriginal(archive,attachment){if(!archive||!attachment)return false;archive.attachmentId=attachment.id||archive.attachmentId||'';archive.fileName=attachment.name||archive.fileName||'';archive.originalStoredAt=archive.originalStoredAt||new Date().toISOString();archive.originalStorageMode=attachment.storageMode||archive.originalStorageMode||'';rememberImportOriginalBinding(archive,attachment);return true}
window.PSTImportOriginals={remember:registerImportOriginal,resolve:resolveArchiveAttachment,restore:restoreImportOriginalBinding};
window.PSTBundledReports={open:path=>{try{window.open(new URL(path,window.location.href).href,'_blank','noopener');return true}catch(e){console.error(e);return false}}};

// V89 — Détection de doublons pour TOUS les imports.
async function importFileFingerprint(file){
 if(!file)return '';
 try{const buf=await file.arrayBuffer();const hash=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}
 catch(_){return `${normalizeText(file.name)}|${file.size||0}|${file.lastModified||0}`}
}
function importDuplicateCandidates(fileName,fileHash=''){
 const n=normalizeText(fileName||'');
 const rows=typeof importedArchiveRows==='function'?importedArchiveRows():(db.importArchives||[]);
 const out=[];
 for(const x of rows){
  const sameName=n&&normalizeText(x.fileName||'')===n;
  const sameHash=fileHash&&x.fileHash&&String(x.fileHash)===String(fileHash);
  if(sameName||sameHash)out.push({...x,duplicateReason:sameHash?'Empreinte identique':'Même nom de fichier'});
 }
 for(const x of (db.pdfImports||[])){
  const sameName=n&&normalizeText(x.fileName||'')===n;
  const sameHash=fileHash&&x.fileHash&&String(x.fileHash)===String(fileHash);
  if((sameName||sameHash)&&!out.some(y=>String(y.sourceId||'')===String(x.id)))out.push({id:`pdf-${x.id}`,sourceId:x.id,fileName:x.fileName,createdAt:x.createdAt,type:x.kind==='chronotime'?'Chronotime':'Rapport de contrôle',subject:x.subject||'',duplicateReason:sameHash?'Empreinte identique':'Même nom de fichier'});
 }
 return out;
}
async function inspectImportDuplicate(file){const fileHash=await importFileFingerprint(file);return {fileHash,matches:importDuplicateCandidates(file?.name||'',fileHash)}}
function duplicateWarningHtml(info){if(!info?.matches?.length)return '';const rows=info.matches.slice(0,5).map(x=>`<li><strong>${esc(x.fileName||'Document')}</strong> — ${esc(x.type||'Import')} · ${x.createdAt?new Date(x.createdAt).toLocaleString('fr-FR'):'date inconnue'} · ${esc(x.duplicateReason||'Doublon possible')}</li>`).join('');return `<div class="import-message warning duplicate-warning"><strong>⚠️ Doublon possible</strong><p>Un fichier portant le même nom ou la même empreinte existe déjà dans Archivage.</p><ul>${rows}</ul><p>Vous pourrez continuer si cet import est volontaire.</p></div>`}
function confirmDuplicateImport(info){if(!info?.matches?.length)return true;const first=info.matches[0];return confirm(`⚠️ DOUBLON POSSIBLE\n\nLe fichier « ${first.fileName||'document'} » existe déjà (${first.type||'import'}, ${first.createdAt?new Date(first.createdAt).toLocaleString('fr-FR'):'date inconnue'}).\n\nVoulez-vous quand même créer un nouvel import ?`)}
window.PSTImportDuplicates={fingerprint:importFileFingerprint,inspect:inspectImportDuplicate,candidates:importDuplicateCandidates,confirm:confirmDuplicateImport,warningHtml:duplicateWarningHtml};
async function verifyStoragePathExists(path){
 if(!path)return {ok:false,reason:'Chemin cloud absent'};
 if(!navigator.onLine)return {ok:false,reason:'Hors ligne'};
 if(!supabaseClient||!currentUser)return {ok:false,reason:'Cloud non connecté'};
 try{
  // V147 : vérification via le SDK Supabase, sans requête HTTP Range depuis la WebView.
  const {data,error}=await supabaseClient.storage.from(STORAGE_BUCKET).download(path);
  if(error||!data)return {ok:false,reason:error?.message||'Document cloud indisponible'};
  return {ok:true,size:data.size||0};
 }catch(e){return {ok:false,reason:e?.message||String(e)}}
}
async function loadTusClient(){
 if(window.tus?.Upload)return window.tus;
 const urls=[
  'https://cdn.jsdelivr.net/npm/tus-js-client@4/dist/tus.min.js',
  'https://unpkg.com/tus-js-client@4/dist/tus.min.js'
 ];
 let lastErr=null;
 for(const url of urls){
  try{
   await new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(x=>x.src===url);
    if(existing){
      if(window.tus?.Upload)return resolve();
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const sc=document.createElement('script');
    sc.src=url;sc.async=true;
    sc.onload=resolve;
    sc.onerror=()=>reject(new Error('Chargement TUS impossible'));
    document.head.appendChild(sc);
   });
   if(window.tus?.Upload)return window.tus;
  }catch(e){lastErr=e}
 }
 throw lastErr||new Error('Client d’envoi résumable indisponible');
}

async function uploadViaTus(file,path){
 const cfg=window.SUPABASE_CONFIG||{};
 const {data:{session}}=await supabaseClient.auth.getSession();
 if(!session?.access_token)throw new Error('Session Supabase expirée');
 const projectId=String(cfg.url||'').replace(/^https?:\/\//,'').split('.')[0];
 if(!projectId)throw new Error('Identifiant Supabase introuvable');
 const tus=await loadTusClient();
 const endpoint=`https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
 return await new Promise(async(resolve,reject)=>{
  try{
   const upload=new tus.Upload(file,{
    endpoint,
    retryDelays:[0,1500,3000,5000,10000],
    headers:{authorization:`Bearer ${session.access_token}`,'x-upsert':'false'},
    uploadDataDuringCreation:true,
    removeFingerprintOnSuccess:true,
    metadata:{
      bucketName:STORAGE_BUCKET,
      objectName:path,
      contentType:file.type||'application/octet-stream',
      cacheControl:'3600'
    },
    chunkSize:6*1024*1024,
    onError:error=>reject(error),
    onSuccess:()=>resolve({path})
   });
   try{
    const prev=await upload.findPreviousUploads();
    if(prev?.length)upload.resumeFromPreviousUpload(prev[0]);
   }catch(_){}
   upload.start();
  }catch(e){reject(e)}
 });
}

async function putFile(file,meta={}){
 if(!supabaseClient||!currentUser)throw new Error('Connexion Supabase requise.');
 const id=uid(),base={id,name:file.name,type:file.type||'application/octet-stream',size:file.size,createdAt:new Date().toISOString(),...meta};
 const path=`${currentUser.id}/${meta.module||'documents'}/${meta.recordId||'general'}/${id}-${safeFileName(file.name)}`;
 const contentType=file.type||'application/octet-stream';
 let lastError=null;

 // Méthode 1 : upload standard avec ArrayBuffer (plus fiable sur certaines WebView Android).
 try{
  const body=await file.arrayBuffer();
  const {data,error}=await supabaseClient.storage.from(STORAGE_BUCKET).upload(path,body,{upsert:false,contentType});
  if(!error){
   const confirmedPath=data?.path||path;
   return {...base,storagePath:confirmedPath,storageMode:'supabase',cloudVerified:true,cloudVerifiedAt:new Date().toISOString(),cloudError:'',uploadConfirmed:true,uploadMethod:'arraybuffer'};
  }
  lastError=error;
 }catch(e){lastError=e}

 // Méthode 2 : URL d’upload signée Supabase.
 try{
  const {data:signed,error:signedError}=await supabaseClient.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path,{upsert:false});
  if(signedError)throw signedError;
  if(!signed?.token)throw new Error('Jeton d’upload Supabase absent');
  const body=await file.arrayBuffer();
  const {data,error}=await supabaseClient.storage.from(STORAGE_BUCKET).uploadToSignedUrl(path,signed.token,body,{contentType,upsert:false});
  if(error)throw error;
  const confirmedPath=data?.path||path;
  return {...base,storagePath:confirmedPath,storageMode:'supabase',cloudVerified:true,cloudVerifiedAt:new Date().toISOString(),cloudError:'',uploadConfirmed:true,uploadMethod:'signed'};
 }catch(e){lastError=e}

 // Méthode 3 : upload résumable TUS via le hostname Storage direct.
 try{
  const data=await uploadViaTus(file,path);
  const confirmedPath=data?.path||path;
  return {...base,storagePath:confirmedPath,storageMode:'supabase',cloudVerified:true,cloudVerifiedAt:new Date().toISOString(),cloudError:'',uploadConfirmed:true,uploadMethod:'tus'};
 }catch(e){lastError=e}

 const msg=lastError?.message||String(lastError||'Erreur inconnue');
 throw new Error(`Envoi Supabase impossible après 3 méthodes : ${msg}`);
}
async function verifyAttachmentCloud(id,{silent=false}={}){
 const rec=(db.attachments||[]).find(a=>String(a.id)===String(id));
 if(!rec){if(!silent)toast('Pièce jointe introuvable');return false}
 if(!rec.storagePath){rec.cloudVerified=false;rec.cloudError='Aucune copie cloud';rec.cloudCheckedAt=new Date().toISOString();save(false);renderImportArchives();return false}
 if(!navigator.onLine){if(!silent)toast('Connexion Internet nécessaire pour vérifier le cloud');return false}
 const check=await verifyStoragePathExists(rec.storagePath);
 rec.cloudVerified=!!check.ok;rec.cloudCheckedAt=new Date().toISOString();rec.cloudVerifiedAt=check.ok?rec.cloudCheckedAt:'';rec.cloudError=check.ok?'':(check.reason||'Fichier non confirmé sur le cloud');
 if(check.ok)rec.storageMode='supabase';
 save(false);renderImportArchives();
 if(!silent)toast(check.ok?'☁️ Document confirmé sur le cloud':'⚠️ Document non confirmé sur le cloud');
 return check.ok;
}
async function syncAttachmentToCloud(id){
 const rec=(db.attachments||[]).find(a=>String(a.id)===String(id));
 if(!rec)return toast('Pièce jointe introuvable');
 if(!rec.storagePath)return toast('Aucune copie cloud : rattachez le document original.');
 await verifyAttachmentCloud(id);
}
async function removeFileBlob(id){
 const meta=db.attachments.find(a=>a.id===id);if(!meta)return;
 if(meta.storagePath&&supabaseClient){const {error}=await supabaseClient.storage.from(STORAGE_BUCKET).remove([meta.storagePath]);if(error)console.error(error)}
}
function forgetImportOriginalBinding(x){
 if(!x)return;const map=loadImportOriginalBindings();for(const k of archiveBindingKeys(x))delete map[k];saveImportOriginalBindings(map);
}
async function deleteImportedArchive(archiveId){
 const x=importedArchiveRows().find(r=>String(r.id)===String(archiveId));if(!x)return toast('Archive introuvable');
 const att=resolveArchiveAttachment(x);
 const linked=x.recordId?'La fiche métier liée sera conservée, mais son document original sera retiré.':'Les données métier déjà injectées (Chronotime, contrôle, etc.) seront conservées.';
 const cloud=att?.storagePath?'\n☁️ La copie cloud sera également supprimée.':'';
 if(!confirm(`⚠️ SUPPRESSION DÉFINITIVE DU FICHIER\n\n${x.fileName||x.subject||'Document'}\nType : ${x.type||'Import'}\n\n${linked}${cloud}\n\nSupprimer ce fichier de l’Archivage ?`))return;
 try{
  if(att?.id)await removeFileBlob(att.id);
  if(att?.id)db.attachments=(db.attachments||[]).filter(a=>String(a.id)!==String(att.id));
  // Retirer l'archive explicite et la source PDF pour éviter sa reconstruction automatique.
  db.importArchives=(db.importArchives||[]).filter(a=>String(a.id)!==String(x.id)&&!(x.sourceId&&String(a.sourceId)===String(x.sourceId)));
  if(x.sourceId)db.pdfImports=(db.pdfImports||[]).filter(r=>String(r.id)!==String(x.sourceId));
  // Enlever la pièce jointe de la fiche métier, sans supprimer la fiche elle-même.
  if(x.recordId&&x.module&&Array.isArray(db[x.module])){const rec=db[x.module].find(r=>String(r.id)===String(x.recordId));if(rec&&Array.isArray(rec.attachments)&&att?.id)rec.attachments=rec.attachments.filter(a=>String(a.id)!==String(att.id))}
  forgetImportOriginalBinding(x);
  save(false);renderAll();renderImportArchives();
  try{if(currentUser&&navigator.onLine)await cloudSaveNow({silent:true})}catch(e){console.warn('Synchronisation suppression différée',e)}
  toast('Fichier supprimé de l’Archivage');
 }catch(e){console.error('Suppression import',e);toast(`Suppression impossible : ${e?.message||String(e)}`)}
}
async function openStoragePath(path,downloadName='document'){
 if(!supabaseClient||!path)return false;
 const {data,error}=await supabaseClient.storage.from(STORAGE_BUCKET).createSignedUrl(path,120);
 if(error||!data?.signedUrl){console.error(error);return false}
 window.open(data.signedUrl,'_blank','noopener');return true;
}
function ensurePdfViewer(){
 let dlg=document.getElementById('supabasePdfViewer');
 if(dlg)return dlg;
 dlg=document.createElement('dialog');dlg.id='supabasePdfViewer';dlg.className='modal pdf-viewer-modal';
 dlg.innerHTML=`<div class="modal-head"><div><h3 id="pdfViewerTitle">Document PDF</h3><p class="muted" id="pdfViewerStatus">Chargement…</p></div><button type="button" class="icon-btn" id="pdfViewerClose">×</button></div><div class="pdf-viewer-toolbar"><button class="ghost small" id="pdfPrevPage">‹ Page précédente</button><strong id="pdfPageInfo">—</strong><button class="ghost small" id="pdfNextPage">Page suivante ›</button></div><div class="pdf-viewer-canvas-wrap"><canvas id="pdfViewerCanvas"></canvas></div>`;
 document.body.appendChild(dlg);
 dlg.querySelector('#pdfViewerClose').onclick=()=>dlg.close();
 return dlg;
}
let __pdfViewerDoc=null,__pdfViewerPage=1,__pdfViewerRendering=false;
async function renderPdfViewerPage(pageNo){
 if(!__pdfViewerDoc||__pdfViewerRendering)return;
 __pdfViewerRendering=true;
 const dlg=ensurePdfViewer(),status=dlg.querySelector('#pdfViewerStatus'),canvas=dlg.querySelector('#pdfViewerCanvas');
 try{
  const page=await __pdfViewerDoc.getPage(pageNo);const base=page.getViewport({scale:1});
  const maxW=Math.max(280,Math.min(window.innerWidth-36,1000));const scale=Math.max(.7,Math.min(2,maxW/base.width));const vp=page.getViewport({scale});
  canvas.width=Math.floor(vp.width);canvas.height=Math.floor(vp.height);canvas.style.width='100%';canvas.style.height='auto';
  await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
  __pdfViewerPage=pageNo;dlg.querySelector('#pdfPageInfo').textContent=`Page ${pageNo} / ${__pdfViewerDoc.numPages}`;
  dlg.querySelector('#pdfPrevPage').disabled=pageNo<=1;dlg.querySelector('#pdfNextPage').disabled=pageNo>=__pdfViewerDoc.numPages;status.textContent='PDF chargé depuis Supabase';
 }catch(e){console.error('Lecture PDF',e);status.textContent='Impossible d’afficher cette page.'}
 finally{__pdfViewerRendering=false}
}
async function openPdfFromSupabasePath(path,name='Document PDF'){
 const dlg=ensurePdfViewer();
 dlg.querySelector('#pdfViewerTitle').textContent=name||'Document PDF';
 dlg.querySelector('#pdfViewerStatus').textContent='Chargement direct depuis Supabase…';
 dlg.querySelector('#pdfViewerCanvas').getContext('2d').clearRect(0,0,10,10);
 dlg.querySelector('#pdfPrevPage').onclick=()=>renderPdfViewerPage(Math.max(1,__pdfViewerPage-1));
 dlg.querySelector('#pdfNextPage').onclick=()=>renderPdfViewerPage(Math.min(__pdfViewerDoc?.numPages||1,__pdfViewerPage+1));
 if(!dlg.open)dlg.showModal();
 try{
  if(!window.pdfjsLib)throw new Error('Lecteur PDF indisponible');
  if(!supabaseClient||!path)throw new Error('Chemin Supabase indisponible');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const {data,error}=await supabaseClient.storage.from(STORAGE_BUCKET).download(path);
  if(error||!data)throw error||new Error('Téléchargement Supabase impossible');
  const buf=await data.arrayBuffer();
  __pdfViewerDoc=await window.pdfjsLib.getDocument({data:buf}).promise;
  __pdfViewerPage=1;
  await renderPdfViewerPage(1);
  return true;
 }catch(e){
  console.error('Ouverture PDF Supabase directe',e);
  dlg.querySelector('#pdfViewerStatus').textContent='Lecture intégrée impossible — ouverture externe…';
  try{
   const {data,error}=await supabaseClient.storage.from(STORAGE_BUCKET).createSignedUrl(path,900);
   if(!error&&data?.signedUrl){window.location.assign(data.signedUrl);return true}
  }catch(_){}
  return false;
 }
}

async function openPdfInApp(url,name='Document PDF'){
 const dlg=ensurePdfViewer();dlg.querySelector('#pdfViewerTitle').textContent=name||'Document PDF';dlg.querySelector('#pdfViewerStatus').textContent='Chargement depuis Supabase…';dlg.querySelector('#pdfViewerCanvas').getContext('2d').clearRect(0,0,10,10);
 dlg.querySelector('#pdfPrevPage').onclick=()=>renderPdfViewerPage(Math.max(1,__pdfViewerPage-1));dlg.querySelector('#pdfNextPage').onclick=()=>renderPdfViewerPage(Math.min(__pdfViewerDoc?.numPages||1,__pdfViewerPage+1));
 if(!dlg.open)dlg.showModal();
 try{
  if(!window.pdfjsLib)throw new Error('Lecteur PDF indisponible');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  // V147 : on télécharge d'abord le PDF signé Supabase en mémoire. Cela évite les blocages CORS/WebView Android.
  const response=await fetch(url,{cache:'no-store',credentials:'omit'});
  if(!response.ok)throw new Error('Téléchargement PDF impossible ('+response.status+')');
  const buf=await response.arrayBuffer();
  __pdfViewerDoc=await window.pdfjsLib.getDocument({data:buf}).promise;__pdfViewerPage=1;await renderPdfViewerPage(1);return true;
 }catch(e){console.error('Ouverture PDF intégrée',e);dlg.querySelector('#pdfViewerStatus').textContent='Lecture intégrée impossible — ouverture externe…';
  try{window.open(url,'_blank','noopener');return true}catch(_){try{window.location.assign(url);return true}catch(__){return false}}
 }
}

async function downloadAttachment(id){
 let rec=(db.attachments||[]).find(a=>String(a.id)===String(id));
 // V141 : secours ciblé pour les pièces jointes de contrôles périodiques.
 if(!rec){
  for(const row of (db.periodic||[])){
   const found=(row.attachments||[]).find(a=>String(a.id)===String(id));
   if(found){rec={...found};break}
  }
 }
 if(!rec){const map=loadImportOriginalBindings();for(const b of Object.values(map)){if(String(b?.attachment?.id)===String(id)){rec={...b.attachment};db.attachments=db.attachments||[];db.attachments.push(rec);break}}}
 if(!rec){const st=$('#importArchiveStatus');if(st){st.textContent='❌ Le lien du document original est introuvable. Rattachez l’original.';st.className='import-archive-status error'}toast('Fichier introuvable dans l’archive');return}
 try{
  // Android/Chrome : navigation dans l’onglet courant = pas de popup bloquée.
  // Le bouton Retour du téléphone ramène ensuite directement à l’application.
  if(rec.storagePath&&supabaseClient){
   const {data,error}=await supabaseClient.storage.from(STORAGE_BUCKET).createSignedUrl(rec.storagePath,900);
   if(!error&&data?.signedUrl){const st=$('#importArchiveStatus');if(st){st.textContent='☁️ Ouverture du document depuis le cloud…';st.className='import-archive-status ok'}const isPdf=/\.pdf(?:$|[?#])/i.test(rec.name||'')||String(rec.type||rec.mimeType||'').toLowerCase().includes('pdf');if(isPdf){const ok=await openPdfFromSupabasePath(rec.storagePath,rec.name||'Rapport PDF');if(ok)return;}window.location.assign(data.signedUrl);return}
   if(error)console.warn('Ouverture Supabase impossible',error);
  }
 }catch(e){console.error('Ouverture du document',e)}
 toast('Impossible d’ouvrir ce PDF depuis Supabase.');
}

function humanSize(n){n=Number(n)||0;if(n<1024)return `${n} o`;if(n<1048576)return `${(n/1024).toFixed(1)} Ko`;return `${(n/1048576).toFixed(1)} Mo`}

function noteItemsHTML(items=[]){
 const rows=(items||[]).map((i,index)=>`<div class="item-row">
   <input name="itemText" value="${esc(i?.text||'')}" placeholder="Action / item">
   <label class="inline-check"><input name="itemDone" type="checkbox" ${i?.done?'checked':''}> Fait</label>
   <button type="button" data-remove-item aria-label="Supprimer cet item">×</button>
 </div>`).join('');
 return `<div id="noteItems">${rows}</div><button type="button" id="addNoteItem">+ Ajouter un item</button>`;
}

function attachmentField(existing=[]){return `<div class="attachment-box"><div class="attachment-actions"><label class="camera-label">📷 Prendre une photo<input type="file" name="cameraPhotos" accept="image/*" capture="environment" multiple></label><label>📎 Ajouter des fichiers<input type="file" name="files" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.eml,.msg,.ods,.odt"></label></div><p class="hint">Les photos et fichiers sont synchronisés dans Supabase et deviennent accessibles sur le téléphone et le PC.</p>${existing.length?`<div class="attachment-list">${existing.map(a=>`<div><span>📎 ${esc(a.name)} <small>${humanSize(a.size)}</small></span><label class="inline-check"><input type="checkbox" name="removeAttachment" value="${esc(a.id)}"> Retirer</label></div>`).join('')}</div>`:''}</div>`}
async function processAttachments(form,record,module){
 record.attachments=record.attachments||[];
 const removeIds=[...form.querySelectorAll('[name="removeAttachment"]:checked')].map(x=>x.value);
 const files=[...(form.elements.files?.files||[]),...(form.elements.cameraPhotos?.files||[])];
 const uploadedMeta=[],failed=[];
 for(const file of files){
  try{
   const meta=await putFile(file,{module,recordId:record.id});
   uploadedMeta.push(meta);
  }catch(e){
   console.error('Upload pièce jointe',e);
   failed.push({name:file.name,error:e?.message||String(e)});
  }
 }
 if(failed.length){
   for(const meta of uploadedMeta){
    try{await removeFileBlob(meta.id||'',meta.storagePath||'')}catch(_){}
   }
   const names=failed.map(x=>x.name).join(', ');
   setSaveState(`Fichier non synchronisé : ${names}`,'error');
   toast(`Enregistrement annulé : ${names}`);
   return {ok:false,failed,uploaded:0,total:files.length};
 }
 for(const meta of uploadedMeta){record.attachments.push(meta);db.attachments.push(meta)}
 for(const id of removeIds){
  try{await removeFileBlob(id)}catch(e){console.warn('Suppression pièce jointe',e)}
  record.attachments=record.attachments.filter(a=>a.id!==id);
  db.attachments=db.attachments.filter(a=>a.id!==id);
 }
 return {ok:true,failed:[],uploaded:uploadedMeta.length,total:files.length};
}
function attachmentButtons(arr=[]){return arr.length?`<div class="attachment-chips">${arr.map(a=>a?.storagePath?`<button class="chip" data-download="${esc(a.id)}">📎 ${esc(a.name)}</button>`:`<span class="chip attachment-missing" title="Le fichier doit être rattaché">⚠️ ${esc(a?.name||'Original indisponible')}</span>`).join('')}</div>`:''}

const BUILTIN_GUIDES=[
 {title:'Guide d’accueil des lycées 2025',category:'Guide / procédure',storagePath:'guides/Guide_Accueil_Lycees_2025.pdf'},
 {title:'Guide de l’entretien dans les lycées 2023',category:'Guide / procédure',storagePath:'guides/Guide_Entretien_Lycees_2023.pdf'},
 {title:'Guide de maintenance des lycées 2023',category:'Guide / procédure',storagePath:'guides/Guide_Maintenance_Lycees_2023.pdf'}
];
async function openGuide(path){await openStoragePath(path)}
/* ---------- Fenêtres ---------- */
function openModal(title,html,onSave,opts={}){modalHandler=onSave;modalDeleteHandler=opts.onDelete||null;modalAuditTitle=title;$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;$('#modalSave').textContent=opts.saveLabel||'Enregistrer';$('#modalDelete').classList.toggle('hidden',!modalDeleteHandler);const d=$('#modal');if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');setTimeout(()=>{const f=$('#modalForm');modalAuditInitial={};if(f)for(const e of [...f.elements])if(e.name&&e.type!=='file'&&e.type!=='button'&&e.type!=='submit')modalAuditInitial[e.name]=e.type==='checkbox'?e.checked:e.value;$('#modalBody input:not([type="hidden"]),#modalBody select,#modalBody textarea')?.focus()},60)}
function closeModal(){const d=$('#modal');if(d.open)d.close();else d.removeAttribute('open');modalHandler=null;modalDeleteHandler=null;modalAuditInitial=null;modalAuditTitle=''}
function openDetail(title,html){$('#detailTitle').textContent=title;$('#detailBody').innerHTML=html;const d=$('#detailModal');if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','')}
function field(label,name,value='',type='text',extra=''){return `<label>${esc(label)}<input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra}></label>`}
function selectField(label,name,items,value='',extra=''){return `<label>${esc(label)}<select name="${esc(name)}" ${extra}>${selectOptions(items,value)}</select></label>`}
function textareaField(label,name,value='',rows=3,extra=''){return `<label class="span2">${esc(label)}<textarea name="${esc(name)}" rows="${rows}" ${extra}>${esc(value)}</textarea></label>`}
function formDataObj(form){return Object.fromEntries(new FormData(form).entries())}
async function deleteRecord(type,id,label='élément'){
 if(!confirm(`Supprimer cet ${label} ?`))return;
 db[type]=db[type].filter(x=>String(x.id)!==String(id));
 closeModal();
 safeRenderAll();
 setSaveState('Suppression en cours…','loading');
 let res={ok:true,offline:false};
 try{res=await window.PSTMainState.persistNow()}catch(error){console.error('Suppression',error);res={ok:false,offline:!navigator.onLine}}
 if(res?.ok){toast(res.offline?'Supprimé sur cet appareil — synchronisation automatique au retour du réseau':'Rendez-vous supprimé et synchronisé')}
 else{toast('Suppression gardée localement — elle sera renvoyée automatiquement vers Supabase')}
}

/* ---------- Navigation ---------- */
const VIEW_TITLES={dashboard:'Tableau de bord',personal:'Agenda personnel',agents:'Agents & recrutements',rotations:'Roulements annuels',planning:'Pilotage des horaires','schedule-import':'Import / export horaires',pdfimports:'Imports PDF & Chronotime',absences:'Congés, RTT & absences',vacations:'Vacances & fermetures',issues:'Sécurité & qualité',periodic:'Contrôles périodiques',cleaning:'Contrôle ménage','room-prep':'Préparation salle & café',maintenance:'Maintenance',requests:'Demandes direction',works:'Chantiers & GPA',meetings:'Réunions & rendez-vous',notes:'Bloc-notes',documents:'Documents & pièces jointes',archives:'Archives hebdomadaires',weather:'Météo',waste:'Poubelles',reports:'Rapports & impressions',settings:'Paramètres'};
function setView(view){if(!document.getElementById(view))return;currentView=view;$$('.view').forEach(v=>v.classList.toggle('active',v.id===view));$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if($('#pageTitle'))$('#pageTitle').textContent=VIEW_TITLES[view]||view;document.body.classList.remove('menu-open');window.PSTNavigation?.closeMenu?.();window.scrollTo({top:0,behavior:'auto'});renderAll()}
window.PSTSetView=setView;

document.addEventListener('pst:view-changed',e=>{
 const view=e?.detail?.view;
 if(view&&document.getElementById(view)){
   currentView=view;
   safeRenderAll();
 }
});

function applyLayout(mode=db.settings.defaultLayout||'auto'){document.body.dataset.layout=mode;$('#layoutMode').value=mode}

/* ---------- Calcul du roulement et du jour agent ---------- */
function activeRotation(agentId,date){return db.rotations.filter(r=>r.agentId===agentId&&r.effectiveFrom<=date&&(!r.effectiveTo||r.effectiveTo>=date)).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0]||null}
function rotationException(agentId,date){return db.rotationExceptions.filter(x=>x.agentId===agentId&&inRange(date,x.dateFrom,x.dateTo)).sort((a,b)=>b.dateFrom.localeCompare(a.dateFrom))[0]||null}

function normalizeWeeklyPlans(){
 const names=new Map(db.agents.map(a=>[agentName(a).toLowerCase(),a.id]));
 for(const p of db.weeklyPlans||[]){
  if(!p.id)p.id=uid();
  if(!p.agentId)p.agentId=names.get(String(p.agent||'').toLowerCase())||'';
  if(!p.shift)p.shift='Standard';
  const supplied=IMPORTED_WEEKLY_PLANS.some(sp=>normalizeText(sp.agent||'')===normalizeText(p.agent||agentName(agentById(p.agentId))||'')&&Array.isArray(p.rows)&&p.rows.length);
  if(supplied&&p.shift==='Matin')p.shift='Standard';
  if(!p.effectiveFrom)p.effectiveFrom='2026-09-01';
  if(!p.effectiveTo)p.effectiveTo='2027-08-31';
  if(!p.dayProfiles)p.dayProfiles=deriveDayProfiles(p.rows||[]);
 }
}
function deriveDayProfiles(rows){
 const out={};
 for(let day=1;day<=5;day++){
  const seg=[];
  for(const r of rows||[]){
   const txt=String(r[day]||'').trim(); if(!txt)continue;
   const m=String(r[0]||'').match(/(\d{1,2})h?(\d{2})?\s*[-–]\s*(\d{1,2})h?(\d{2})?/i);
   if(m){const st=`${pad(+m[1])}:${m[2]||'00'}`,en=`${pad(+m[3])}:${m[4]||'00'}`;seg.push({start:st,end:en,task:txt});}
  }
  const work=seg.filter(x=>!/pause/i.test(x.task));
  const pause=seg.filter(x=>/pause/i.test(x.task)).reduce((n,x)=>n+Math.round(hoursBetween(x.start,x.end)*60),0);
  out[day]={start:work[0]?.start||'',end:work.at(-1)?.end||'',pause,missions:work.map(x=>x.task).filter((v,i,a)=>a.indexOf(v)===i).join(' · '),segments:seg};
 }
 return out;
}
function weeklyPlanFor(agentId,shift,date=''){
 normalizeWeeklyPlans();
 const plans=(db.weeklyPlans||[])
   .filter(p=>String(p.agentId)===String(agentId))
   .filter(p=>!date||((!p.effectiveFrom||p.effectiveFrom<=date)&&(!p.effectiveTo||p.effectiveTo>=date)))
   .sort((a,b)=>(b.effectiveFrom||'').localeCompare(a.effectiveFrom||''));
 return plans.find(p=>p.shift===shift)||plans.find(p=>p.shift==='Standard')||null;
}
function anyWeeklyPlanFor(agentId,date=''){normalizeWeeklyPlans();return (db.weeklyPlans||[]).filter(p=>String(p.agentId)===String(agentId)&&(!date||((!p.effectiveFrom||p.effectiveFrom<=date)&&(!p.effectiveTo||p.effectiveTo>=date)))).sort((a,b)=>(b.effectiveFrom||'').localeCompare(a.effectiveFrom||''))[0]||null}
function weeklyProfile(agentId,shift,weekday,date=''){const p=weeklyPlanFor(agentId,shift,date);return p?.dayProfiles?.[weekday]||null}
function exactWeeklyProfile(agentId,shift,weekday,date=''){normalizeWeeklyPlans();const p=(db.weeklyPlans||[]).filter(x=>String(x.agentId)===String(agentId)&&x.shift===shift&&(!date||((!x.effectiveFrom||x.effectiveFrom<=date)&&(!x.effectiveTo||x.effectiveTo>=date)))).sort((a,b)=>(b.effectiveFrom||'').localeCompare(a.effectiveFrom||''))[0];return p?.dayProfiles?.[weekday]||null}

function standardScheduleForAgent(agentId,date=todayISO()){
 const agent=agentById(agentId)||{};
 const wd=parseDate(date).getDay();
 normalizeWeeklyPlans();

 const plan=(db.weeklyPlans||[])
   .filter(x=>String(x.agentId)===String(agentId)&&x.shift==='Standard')
   .filter(x=>(!x.effectiveFrom||x.effectiveFrom<=date)&&(!x.effectiveTo||x.effectiveTo>=date))
   .sort((x,y)=>(y.effectiveFrom||'').localeCompare(x.effectiveFrom||''))[0]||null;

 if(plan){
   const p=plan.dayProfiles?.[wd]||{};
   if(p.start&&p.end)return {
     start:p.start,end:p.end,pause:Number(p.pause||0),missions:p.missions||'',
     source:'standard-plan',effectiveFrom:plan.effectiveFrom||'',effectiveTo:plan.effectiveTo||''
   };
   return {
     start:'',end:'',pause:0,missions:'',source:'standard-plan-rest',
     effectiveFrom:plan.effectiveFrom||'',effectiveTo:plan.effectiveTo||''
   };
 }

 const direct=agent.standardSchedule||{};
 return {
   start:String(direct.start||agent.standardStart||'').trim(),
   end:String(direct.end||agent.standardEnd||'').trim(),
   pause:Number(direct.pause??agent.standardPause??0)||0,
   missions:String(direct.missions||agent.standardMissions||'').trim(),
   source:'standard-agent-legacy'
 };
}
function syncAgentStandardPlan(agent,effectiveFrom=''){
 if(!agent?.id)return;
 const s=agent.standardSchedule||{};
 const start=String(s.start||'').trim(),end=String(s.end||'').trim();
 if(!start||!end)return;

 const range=academicYearRange(activeAcademicYear());
 const from=normalizeDateValue(effectiveFrom||s.effectiveFrom||range.start)||range.start;
 const workdays=(Array.isArray(agent.workdays)&&agent.workdays.length?agent.workdays:[1,2,3,4,5]).map(Number);

 db.weeklyPlans=Array.isArray(db.weeklyPlans)?db.weeklyPlans:[];
 const standards=db.weeklyPlans
   .filter(x=>String(x.agentId)===String(agent.id)&&x.shift==='Standard')
   .sort((x,y)=>(x.effectiveFrom||'').localeCompare(y.effectiveFrom||''));

 // Fermer uniquement la période Standard immédiatement précédente.
 const prev=standards.filter(x=>(x.effectiveFrom||'')<from).sort((x,y)=>(y.effectiveFrom||'').localeCompare(x.effectiveFrom||''))[0];
 if(prev){
   const prevEnd=addDays(from,-1);
   if(!prev.effectiveTo || prev.effectiveTo>=from)prev.effectiveTo=prevEnd;
 }

 // Si une période commence déjà exactement à cette date, on la met à jour.
 let p=standards.find(x=>x.effectiveFrom===from);
 if(!p){
   // Déterminer la fin : veille de la prochaine période, sinon fin d'année scolaire.
   const next=standards.filter(x=>(x.effectiveFrom||'')>from).sort((x,y)=>(x.effectiveFrom||'').localeCompare(y.effectiveFrom||''))[0];
   p={
     id:uid(),agentId:agent.id,agent:agentName(agent),shift:'Standard',
     effectiveFrom:from,
     effectiveTo:next?.effectiveFrom?addDays(next.effectiveFrom,-1):range.end,
     dayProfiles:{},rows:[],historyCreatedAt:new Date().toISOString()
   };
   db.weeklyPlans.push(p);
 }else{
   p.historyUpdatedAt=new Date().toISOString();
 }

 p.agent=agentName(agent);
 p.dayProfiles=p.dayProfiles||{};
 for(const wd of [1,2,3,4,5,6,0]){
   p.dayProfiles[wd]=workdays.includes(wd)
     ? {start,end,pause:Number(s.pause||0),missions:s.missions||'',segments:[]}
     : {start:'',end:'',pause:0,missions:'',segments:[]};
 }

 // Garder la fiche agent comme raccourci vers la valeur courante, sans supprimer l'historique.
 agent.standardSchedule={
   start,end,pause:Number(s.pause||0),missions:s.missions||'',effectiveFrom:from
 };
 agent.standardStart=start;agent.standardEnd=end;agent.standardPause=Number(s.pause||0);agent.standardMissions=s.missions||'';
}

function scheduledFor(agentId,date){
 const wd=parseDate(date).getDay();
 // Le calendrier personnel de l'agent est prioritaire : samedi/dimanche sont en repos par défaut.
 if(!agentWorkdays(agentId).includes(wd))return {shift:'Repos',start:'',end:'',pause:0,missions:''};
 const r=activeRotation(agentId,date);
 if(!r){
   const p=standardScheduleForAgent(agentId,date);
   if(p?.source==='standard-plan-rest')return {shift:'Repos',start:'',end:'',pause:0,missions:'',source:'standard-plan'};
   return p&&p.start&&p.end
     ? {shift:'Standard',start:p.start,end:p.end,pause:Number(p.pause||0),missions:p.missions||'',segments:p.segments||[],source:p.source||'standard'}
     : {shift:'Non planifié',start:'',end:'',pause:0,missions:''};
 }
 if(!(r.weekdays||[1,2,3,4,5]).map(Number).includes(wd))return {shift:'Repos',start:'',end:'',pause:0,missions:''};
 const ex=rotationException(agentId,date);if(ex){if(ex.shift==='Repos')return {shift:'Repos',start:'',end:'',pause:0,missions:ex.note||''};return {shift:ex.shift||'Horaire modifié',start:ex.start||'',end:ex.end||'',pause:Number(ex.pause||0),missions:ex.note||''}}
 const anchor=startOfWeek(r.effectiveFrom),diff=Math.floor((parseDate(startOfWeek(date))-parseDate(anchor))/604800000),mw=Math.max(1,Number(r.morningWeeks)||1),ew=Math.max(1,Number(r.eveningWeeks)||1),cycle=mw+ew;let pos=((diff%cycle)+cycle)%cycle;if(r.startShift==='Soir')pos=(pos+mw)%cycle;const shift=pos<mw?'Matin':'Soir';
 const p=exactWeeklyProfile(agentId,shift,wd,date);
 // Agent en roulement : aucune référence Standard ne doit être utilisée.
 // Le profil Matin/Soir exact du roulement est prioritaire, puis les heures portées par le roulement lui-même.
 if(!p?.start||!p?.end)return {shift,start:'',end:'',pause:0,missions:'Horaire à définir dans Pilotage des horaires',segments:[],source:'rotation-missing'};
 return {shift,start:p.start,end:p.end,pause:Number(p.pause||0),missions:p.missions||'',segments:p.segments||[],source:'rotation'};
}
function resolvedTheoreticalSchedule(agentId,date,dayType='Présence'){
 // Ordre unique : Permanence > Roulement > Standard > Repos/aucun.
 return cachedTheoreticalSchedule(agentId,date,dayType);
}
let theoreticalScheduleCache=new Map();
function clearTheoreticalScheduleCache(){theoreticalScheduleCache.clear()}
function cachedTheoreticalSchedule(agentId,date,dayType='Présence'){
 const key=`${agentId}|${date}|${dayType}`;
 if(theoreticalScheduleCache.has(key))return theoreticalScheduleCache.get(key);
 const value=theoreticalScheduleFor(agentId,date,dayType);
 theoreticalScheduleCache.set(key,value);
 return value;
}

function theoreticalScheduleFor(agentId,date,dayType='Présence'){
 const type=normalizeText(dayType||'Présence');
 if(type.includes('perman')){
   const p=permanenceScheduleForAgent(agentId);
   return {shift:'Permanence',start:p.start||'',end:p.end||'',pause:Number(p.pause||0),missions:'Horaire fixe de permanence',source:'permanence'};
 }
 return scheduledFor(agentId,date);
}
function dayRecord(agentId,date,preferredDayType=''){
  const records=(Array.isArray(db.agentDays)?db.agentDays:[]).filter(r=>String(r.agentId)===String(agentId)&&String(r.date)===String(date));
  if(!records.length)return null;
  const preferred=normalizeText(preferredDayType||'');
  if(preferred){const exact=records.find(r=>normalizeText(r.dayType||'')===preferred);if(exact)return exact}
  return records[0]||null;
}
function dayTypeOptions(current=''){
  const items=[...(db.lists?.dayTypes||[])];
  const value=String(current||'').trim();
  // Une pastille peut provenir d'un import (Chronotime ou ancienne donnée) avec un libellé
  // qui n'existe pas encore dans la liste standard. On l'ajoute au menu au lieu de laisser
  // le navigateur retomber silencieusement sur « Présence ».
  if(value&&!items.some(x=>String(x)===value))items.unshift(value);
  return selectOptions(items,value||'Présence');
}

// V147.11 — Reconstruit les pastilles du planning à partir des Chronotime déjà injectés.
// Cela permet aux anciens CA / RTT / RH / RFE / maladie / formation de réapparaître
// dans le roulement annuel, sans modifier la logique d'état des agents du tableau de bord.

// V147.19 — Permanences pendant les vacances scolaires.
// Chronotime fait foi : une durée de présence pendant une date de vacances = permanence.
function permanenceScheduleForAgent(agentId){
  const agent=(db.agents||[]).find(x=>String(x.id)===String(agentId))||{};
  const p=agent.permanenceSchedule||{};
  return {
    start:String(p.start||agent.permanenceStart||'').trim(),
    end:String(p.end||agent.permanenceEnd||'').trim(),
    pause:Number(p.pause??agent.permanencePause??0)||0
  };
}
function dateIsSchoolVacation(date){
  if(!date)return false;
  const active=activeAcademicYear();
  const range=academicYearRange(active);
  if(date<range.start||date>range.end)return false;
  return (db.vacations||[]).some(v=>{
    if(!v?.start||!v?.end)return false;
    const zoneOk=!v.zone||v.zone==='Toutes'||v.zone===(db.settings?.vacationZone||$('#vacationZone')?.value||'Zone A');
    return zoneOk&&date>=v.start&&date<=v.end;
  });
}
function upsertChronotimePermanence(c){
  if(!c?.agentId||!c?.date||!dateIsSchoolVacation(c.date))return 0;
  if(c.durationMinutes===null||c.durationMinutes===undefined)return 0;
  db.agentDays=Array.isArray(db.agentDays)?db.agentDays:[];
  const sched=permanenceScheduleForAgent(c.agentId);
  const rows=db.agentDays.filter(x=>String(x.agentId)===String(c.agentId)&&String(x.date)===String(c.date));
  let day=rows.find(x=>x.source==='chronotime'||/Chronotime/i.test(String(x.note||'')))||rows[0]||null;

  // Une saisie manuelle d'absence reste prioritaire.
  if(day&&day.source!=='chronotime'&&!/Chronotime/i.test(String(day.note||''))&&day.dayType&&day.dayType!=='Présence'&&day.dayType!=='Permanence')return 0;

  const values={
    dayType:'Permanence',
    plannedStart:sched.start,
    plannedEnd:sched.end,
    pause:sched.pause,
    status:'Validée',
    source:'chronotime',
    chronotimeType:'Permanence',
    note:`Permanence détectée par Chronotime pendant les vacances scolaires${c.sourceFile?' — '+c.sourceFile:''}`,
    noReplacementNeeded:false
  };
  if(!day){
    db.agentDays.push(Object.assign({
      id:uid(),agentId:c.agentId,date:c.date,
      actualStart:'',actualEnd:'',overtime:0,replacement:''
    },values));
    return 1;
  }
  const before=JSON.stringify([day.dayType,day.plannedStart,day.plannedEnd,day.pause,day.source]);
  Object.assign(day,values);
  const after=JSON.stringify([day.dayType,day.plannedStart,day.plannedEnd,day.pause,day.source]);
  return before===after?0:1;
}

function syncStoredChronotimePastilles(){
  if(!Array.isArray(db.chronotimeDaily)||!db.chronotimeDaily.length)return 0;
  db.agentDays=Array.isArray(db.agentDays)?db.agentDays:[];
  db.settings=db.settings||{};
  db.settings.chronoCodeMap=Object.assign({},db.settings.chronoCodeMap||{},{
    CA:'Congé annuel',RTT:'RTT',RH:'Repos',RFE:'Jour férié'
  });
  const canonicalCode=value=>{
    const raw=String(value||'').trim().toUpperCase().replace(/\s+/g,'');
    if(/^CA(?:[-_]?\d+)?$/.test(raw))return 'CA';
    if(/^RTT(?:[-_]?\d+)?$/.test(raw))return 'RTT';
    if(/^RH(?:[-_]?\d+)?$/.test(raw))return 'RH';
    if(/^RFE(?:[-_]?\d+)?$/.test(raw))return 'RFE';
    return raw;
  };
  const canonicalType={CA:'Congé annuel',RTT:'RTT',RH:'Repos',RFE:'Jour férié'};
  let changed=0;

  for(const c of db.chronotimeDaily){
    if(!c?.agentId||!c?.date)continue;
    // Une durée pendant les vacances scolaires = journée de permanence.
    // Hors vacances, elle reste une présence normale et ne crée pas de pastille spéciale.
    if(c.durationMinutes!==null && c.durationMinutes!==undefined){
      changed+=upsertChronotimePermanence(c);
      continue;
    }

    const code=canonicalCode(c.value);
    // Pour les codes standards, le code GFI a priorité absolue sur un ancien dayType erroné.
    const mapped=canonicalType[code] || String(c.dayType||db.settings.chronoCodeMap?.[code]||'').trim();
    if(!mapped||mapped==='Présence')continue;

    if(c.value!==code && canonicalType[code]){c.value=code;changed++}
    if(c.dayType!==mapped){c.dayType=mapped;changed++}

    const rows=db.agentDays.filter(x=>String(x.agentId)===String(c.agentId)&&String(x.date)===String(c.date));
    let day=rows.find(x=>x.source==='chronotime'||/Chronotime/i.test(String(x.note||'')))||rows[0]||null;

    // Ne pas écraser une saisie manuelle explicitement différente.
    if(day && day.source!=='chronotime' && !/Chronotime/i.test(String(day.note||'')) &&
       day.dayType && day.dayType!=='Présence' && day.dayType!==mapped)continue;

    if(!day){
      db.agentDays.push({
        id:uid(),agentId:c.agentId,date:c.date,dayType:mapped,
        plannedStart:'',plannedEnd:'',actualStart:'',actualEnd:'',
        pause:0,overtime:0,status:'Validée',replacement:'',
        noReplacementNeeded:['Repos','Jour férié'].includes(mapped),
        note:`Type de journée issu du Chronotime : ${c.sourceFile||''}`.trim(),
        source:'chronotime',chronotimeType:mapped,chronotimeImportedAt:c.importedAt||new Date().toISOString()
      });
      changed++;
    }else{
      const before=JSON.stringify([day.dayType,day.source,day.chronotimeType,day.noReplacementNeeded]);
      day.dayType=mapped;
      day.source='chronotime';
      day.chronotimeType=mapped;
      day.status='Validée';
      day.note=`Type de journée issu du Chronotime : ${c.sourceFile||''}`.trim();
      day.noReplacementNeeded=['Repos','Jour férié'].includes(mapped);
      const after=JSON.stringify([day.dayType,day.source,day.chronotimeType,day.noReplacementNeeded]);
      if(before!==after)changed++;
    }
  }
  return changed;
}
function dayInfo(agentId,date){
 const rec=dayRecord(agentId,date),type=rec?.dayType||'Présence',sched=resolvedTheoreticalSchedule(agentId,date,type);
 if(!rec)return {...sched,dayType:sched.shift==='Repos'?'Repos':'Présence',plannedStart:sched.start,plannedEnd:sched.end,actualStart:'',actualEnd:'',overtime:0,note:'',status:'Prévu'};
 return {...sched,...rec,plannedStart:sched.start||rec.plannedStart||'',plannedEnd:sched.end||rec.plannedEnd||'',pause:Number(sched.pause??rec.pause??0),theoreticalSource:sched.source||sched.shift||''};
}
function isAbsenceType(t){return t&&t!=='Présence'&&t!=='Formation'}
function dayCountingRule(dayType){
 const rules=db.settings?.chronoDayRules||{};
 if(dayType==='Maladie')return {mode:'fixed',hours:7};
 return rules[dayType]||{mode:'planned',hours:null};
}
function dayCountingLabel(dayType){
 const r=dayCountingRule(dayType);
 if(r.mode==='fixed')return `${Number(r.hours||0).toLocaleString('fr-FR')} h fixes`;
 if(r.mode==='zero')return '0 h';
 return 'Horaires prévus';
}
function easterSundayISO(year){
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
 return `${year}-${pad(month)}-${pad(day)}`;
}
function frenchPublicHolidayName(date){
 const d=normalizeDateValue(date);if(!d)return'';const y=Number(d.slice(0,4));
 const fixed={
  [`${y}-01-01`]:'Jour de l’an',[`${y}-05-01`]:'Fête du Travail',[`${y}-05-08`]:'Victoire 1945',[`${y}-07-14`]:'Fête nationale',[`${y}-08-15`]:'Assomption',[`${y}-11-01`]:'Toussaint',[`${y}-11-11`]:'Armistice',[`${y}-12-25`]:'Noël'
 };
 if(fixed[d])return fixed[d];
 const easter=easterSundayISO(y),movable={};movable[addDays(easter,1)]='Lundi de Pâques';movable[addDays(easter,39)]='Ascension';movable[addDays(easter,50)]='Lundi de Pentecôte';
 return movable[d]||'';
}
function replacementNotificationAllowed(rec,date){
 const d=normalizeDateValue(date);if(!d)return false;const wd=parseDate(d).getDay();
 if(wd===0||wd===6)return false;
 if(frenchPublicHolidayName(d))return false;
 if(rec?.noReplacementNeeded===true)return false;
 const st=normalizeText(rec?.status||'');if(st==='refusee'||st==='annulee')return false;
 return true;
}
function dayHours(info){
 const planned=hoursBetween(info.plannedStart,info.plannedEnd,info.pause);
 const rule=dayCountingRule(info.dayType);
 let actual;
 if(rule?.mode==='fixed')actual=Math.max(0,Number(rule.hours||0));
 else if(rule?.mode==='zero')actual=0;
 else actual=(info.actualStart&&info.actualEnd)?hoursBetween(info.actualStart,info.actualEnd,info.pause):planned;
 // Règle métier immuable : une journée Maladie compte 7 h.
 if(info.dayType==='Maladie')actual=7;
 const total=actual+Number(info.overtime||0);
 return {planned,actual,total,delta:total-planned}
}
function agentState(agent,date=todayISO()){const info=dayInfo(agent.id,date);if(isAbsenceType(info.dayType)||info.dayType==='Repos')return {label:info.dayType,kind:'absent',info};if(info.dayType==='Formation')return {label:'Formation',kind:'info',info};if(!info.plannedStart||!info.plannedEnd)return {label:'Non planifié',kind:'info',info};return {label:`${info.plannedStart}–${info.plannedEnd}`,kind:'present',info}}

/* ---------- Formulaires agents / planning ---------- */

function openAgentPermanence(agentId){
 const agent=byId('agents',agentId);if(!agent)return;
 const p=permanenceScheduleForAgent(agentId);
 openModal(`Horaire de permanence — ${agentName(agent)}`,`<div class="form-grid">
   <div class="span2 permanence-info"><strong>🟠 Horaire unique de permanence</strong><p class="hint">Cet horaire sera utilisé automatiquement pour les journées travaillées détectées par Chronotime pendant les vacances scolaires.</p></div>
   ${field('Début','permanenceStart',p.start||'','time','required')}
   ${field('Fin','permanenceEnd',p.end||'','time','required')}
   ${field('Pause (minutes)','permanencePause',p.pause||0,'number','min="0" step="5"')}
 </div>`,async form=>{
   agent.permanenceSchedule={
     start:String(form.elements.permanenceStart.value||'').trim(),
     end:String(form.elements.permanenceEnd.value||'').trim(),
     pause:Number(form.elements.permanencePause.value||0)
   };
   agent.permanenceStart=agent.permanenceSchedule.start;
   agent.permanenceEnd=agent.permanenceSchedule.end;
   agent.permanencePause=agent.permanenceSchedule.pause;
   syncStoredChronotimePastilles();
   const persisted=await commitFormRecordVerified('Horaire de permanence','agents',agent);if(!persisted.ok)return;
   closeModal();
   toast(`✅ Permanence ${agent.permanenceSchedule.start}–${agent.permanenceSchedule.end} enregistrée`);
 });
}

function openAgent(id){
 const old=id?byId('agents',id):null;
 const x=old||{id:uid(),no:nextNo('agent','AGT'),firstName:'',lastName:'',role:db.lists.roles[0],weeklyHours:35,email:'',phone:'',assignment:'',status:'Actif',arrivalDate:'',workdays:[1,2,3,4,5],notes:'',attachments:[]};
 x.attachments=x.attachments||[];x.workdays=Array.isArray(x.workdays)&&x.workdays.length?x.workdays.map(Number):[1,2,3,4,5];
 const range=academicYearRange(activeAcademicYear());
 const refDate=todayISO()>=range.start&&todayISO()<=range.end?todayISO():range.start;
 const stdExisting=standardScheduleForAgent(x.id,refDate);
 const stdPlans=(db.weeklyPlans||[]).filter(p=>String(p.agentId)===String(x.id)&&p.shift==='Standard').sort((p,q)=>(p.effectiveFrom||'').localeCompare(q.effectiveFrom||''));
 const currentPlan=stdPlans.filter(p=>(!p.effectiveFrom||p.effectiveFrom<=refDate)&&(!p.effectiveTo||p.effectiveTo>=refDate)).sort((p,q)=>(q.effectiveFrom||'').localeCompare(p.effectiveFrom||''))[0];
 x.standardSchedule={start:stdExisting.start||'',end:stdExisting.end||'',pause:Number(stdExisting.pause||0),missions:stdExisting.missions||'',effectiveFrom:currentPlan?.effectiveFrom||range.start};
 const standardHistoryHtml=stdPlans.length?`<div class="standard-history-list">${stdPlans.map(p=>{const wd=Object.values(p.dayProfiles||{}).find(v=>v?.start&&v?.end)||{};return `<div class="standard-history-row"><strong>${fmtDate(p.effectiveFrom)||'—'} → ${fmtDate(p.effectiveTo)||'—'}</strong><span>${wd.start&&wd.end?`${esc(wd.start)}–${esc(wd.end)}`:'Repos'}</span>${wd.pause?`<small>Pause ${Number(wd.pause)} min</small>`:''}</div>`}).join('')}</div>`:'<p class="hint">Aucun historique Standard enregistré.</p>';
 const dayLabels=[['Lundi',1],['Mardi',2],['Mercredi',3],['Jeudi',4],['Vendredi',5],['Samedi',6],['Dimanche',0]];
 openModal(old?'Modifier l’agent':'Nouvel agent',`<div class="form-grid">${field('Prénom','firstName',x.firstName,'text','required')}${field('Nom','lastName',x.lastName)}<label>Fonction<select name="role">${selectOptions(db.lists.roles,x.role)}</select></label>${field('Temps hebdomadaire (h)','weeklyHours',x.weeklyHours,'number','min="0" step="0.25"')}${field('Téléphone','phone',x.phone,'tel')}${field('E-mail','email',x.email,'email')}${field('Affectation principale','assignment',x.assignment)}<label>Statut<select name="status">${selectOptions(['Actif','Inactif'],x.status)}</select></label>${field('Date d’arrivée','arrivalDate',x.arrivalDate,'date')}<fieldset class="span2 standard-config"><legend>🔵 Horaire standard théorique</legend><p class="hint">Utilisé quand l’agent n’est ni en permanence ni en roulement. Toute modification crée une nouvelle période et conserve l’ancien horaire.</p><div class="form-grid">${field('Date d’effet','standardEffectiveFrom',x.standardSchedule?.effectiveFrom||range.start,'date','required')}${field('Début standard','standardStart',x.standardSchedule?.start||'','time')}${field('Fin standard','standardEnd',x.standardSchedule?.end||'','time')}${field('Pause standard (min)','standardPause',x.standardSchedule?.pause??0,'number','min="0" step="5"')}${field('Mission standard','standardMissions',x.standardSchedule?.missions||'')}</div><details class="standard-history"><summary>Historique des horaires Standard (${stdPlans.length})</summary>${standardHistoryHtml}</details></fieldset><fieldset class="span2 permanence-config"><legend>🟠 Horaire de permanence</legend><p class="hint">Horaire fixe utilisé automatiquement lorsque Chronotime détecte une journée travaillée pendant les vacances scolaires.</p><div class="form-grid">${field('Début permanence','permanenceStart',x.permanenceSchedule?.start||x.permanenceStart||'','time')}${field('Fin permanence','permanenceEnd',x.permanenceSchedule?.end||x.permanenceEnd||'','time')}${field('Pause permanence (min)','permanencePause',x.permanenceSchedule?.pause??x.permanencePause??0,'number','min="0" step="5"')}</div></fieldset><fieldset class="span2"><legend>Jours travaillés habituels</legend><p class="hint">Par défaut : lundi à vendredi. Décoche un jour pour qu'il apparaisse automatiquement en Repos.</p>${dayLabels.map(([label,d])=>`<label class="inline-check"><input type="checkbox" name="agentWorkday" value="${d}" ${x.workdays.includes(d)?'checked':''}>${label}</label>`).join('')}</fieldset>${textareaField('Notes','notes',x.notes)}${attachmentField(x.attachments)}</div>`,async form=>{
   Object.assign(x,formDataObj(form),{weeklyHours:Number(form.elements.weeklyHours.value||0),workdays:[...form.querySelectorAll('[name="agentWorkday"]:checked')].map(e=>Number(e.value))});
   x.standardSchedule={
     start:String(form.elements.standardStart?.value||'').trim(),
     end:String(form.elements.standardEnd?.value||'').trim(),
     pause:Number(form.elements.standardPause?.value||0),
     missions:String(form.elements.standardMissions?.value||'').trim(),
     effectiveFrom:normalizeDateValue(form.elements.standardEffectiveFrom?.value||'')||range.start
   };
   x.standardStart=x.standardSchedule.start;
   x.standardEnd=x.standardSchedule.end;
   x.standardPause=x.standardSchedule.pause;
   x.standardMissions=x.standardSchedule.missions;
   if((x.standardSchedule.start&&!x.standardSchedule.end)||(!x.standardSchedule.start&&x.standardSchedule.end)){toast('Horaire standard : renseignez le début et la fin');return}
   x.permanenceSchedule={
     start:String(form.elements.permanenceStart?.value||'').trim(),
     end:String(form.elements.permanenceEnd?.value||'').trim(),
     pause:Number(form.elements.permanencePause?.value||0)
   };
   x.permanenceStart=x.permanenceSchedule.start;
   x.permanenceEnd=x.permanenceSchedule.end;
   x.permanencePause=x.permanenceSchedule.pause;
   const attachmentCheck=await processAttachments(form,x,'agents');if(!attachmentCheck?.ok)return;
   if(old){for(const r of db.rotations.filter(r=>String(r.agentId)===String(x.id))){r.weekdays=(r.weekdays||[]).map(Number).filter(d=>x.workdays.includes(d))}}
   syncAgentStandardPlan(x,x.standardSchedule.effectiveFrom);
   syncStoredChronotimePastilles();
   const persisted=await commitFormRecordVerified('Agent','agents',x);if(!persisted.ok)return;
   closeModal();toast(`✅ Agent enregistré — horaire Standard applicable à partir du ${fmtDate(x.standardSchedule.effectiveFrom)}`);
 },{onDelete:old?()=>deleteRecord('agents',x.id,'agent'):null})
}
function applyWeekendRestToAll(){
 if(!confirm('Mettre le samedi et le dimanche en repos pour tous les agents ? Les horaires du lundi au vendredi seront conservés.'))return;
 for(const a of db.agents){a.workdays=(Array.isArray(a.workdays)&&a.workdays.length?a.workdays:[1,2,3,4,5]).map(Number).filter(d=>d!==0&&d!==6);if(!a.workdays.length)a.workdays=[1,2,3,4,5]}
 for(const r of db.rotations||[])r.weekdays=(r.weekdays||[1,2,3,4,5]).map(Number).filter(d=>d!==0&&d!==6);
 for(const p of db.weeklyPlans||[]){if(p.dayProfiles){p.dayProfiles[6]={start:'',end:'',pause:0,missions:'',segments:[]};p.dayProfiles[0]={start:'',end:'',pause:0,missions:'',segments:[]}}}
 save();renderAll();toast('Samedi et dimanche mis en repos pour tous les agents');
}
function openRotation(id,agentId=''){const old=id?byId('rotations',id):null;const x=old||{id:uid(),no:nextNo('rotation','RLT'),agentId:agentId||db.agents[0]?.id,effectiveFrom:startOfWeek(todayISO()),effectiveTo:'',startShift:'Matin',morningWeeks:2,eveningWeeks:2,pause:30,weekdays:[1,2,3,4,5],notes:''};openModal(old?'Modifier le roulement':'Nouveau roulement avec date d’effet',`<div class="notice"><strong>Horaires synchronisés :</strong> les heures Matin et Soir ne se règlent plus ici. Elles sont reprises exclusivement depuis <b>Pilotage des horaires</b> pour éviter toute différence entre les deux écrans.</div><div class="form-grid"><label>Agent<select name="agentId" required>${agentOptions(x.agentId)}</select></label>${field('Date d’effet','effectiveFrom',x.effectiveFrom,'date','required')}${field('Date de fin (facultatif)','effectiveTo',x.effectiveTo,'date')}<label>Commence par<select name="startShift">${selectOptions(['Matin','Soir'],x.startShift)}</select></label>${field('Nombre de semaines du matin','morningWeeks',x.morningWeeks,'number','min="1" max="12"')}${field('Nombre de semaines du soir','eveningWeeks',x.eveningWeeks,'number','min="1" max="12"')}<fieldset class="span2"><legend>Jours travaillés</legend>${[1,2,3,4,5,6,0].map((d,i)=>`<label class="inline-check"><input type="checkbox" name="weekday" value="${d}" ${(x.weekdays||[]).map(Number).includes(d)?'checked':''}>${['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d]}</label>`).join('')}</fieldset>${textareaField('Notes','notes',x.notes)}</div>`,async form=>{const o=formDataObj(form);const weekdays=[...form.querySelectorAll('[name="weekday"]:checked')].map(e=>Number(e.value));if(!o.agentId){toast('Choisissez un agent');return}const missing=[];for(const shift of ['Matin','Soir']){if(!weekdays.some(wd=>{const p=exactWeeklyProfile(o.agentId,shift,wd,o.effectiveFrom);return p?.start&&p?.end}))missing.push(shift)}if(missing.length){toast(`Créez d’abord le profil ${missing.join(' et ')} dans Pilotage des horaires`);return}Object.assign(x,o,{morningWeeks:Number(o.morningWeeks),eveningWeeks:Number(o.eveningWeeks),weekdays});const persisted=await commitFormRecordVerified('Roulement','rotations',x);if(!persisted.ok)return;closeModal();toast('✅ Roulement enregistré — horaires synchronisés avec Pilotage des horaires')},{onDelete:old?()=>deleteRecord('rotations',x.id,'roulement'):null})}

function openRotationException(id){const old=id?byId('rotationExceptions',id):null;const x=old||{id:uid(),agentId:db.agents[0]?.id,dateFrom:todayISO(),dateTo:todayISO(),shift:'Horaire personnalisé',start:'',end:'',pause:30,note:''};openModal(old?'Modifier l’exception':'Exception de roulement',`<div class="form-grid"><label>Agent<select name="agentId">${agentOptions(x.agentId)}</select></label>${field('Du','dateFrom',x.dateFrom,'date','required')}${field('Au','dateTo',x.dateTo,'date','required')}<label>Service<select name="shift">${selectOptions(['Matin','Soir','Horaire personnalisé','Repos'],x.shift)}</select></label>${field('Arrivée','start',x.start,'time')}${field('Départ','end',x.end,'time')}${field('Pause (min)','pause',x.pause,'number','min="0"')}${textareaField('Motif','note',x.note)}</div>`,async form=>{const o=formDataObj(form);Object.assign(x,o,{pause:Number(o.pause||0)});const persisted=await commitFormRecordVerified('Exception de roulement','rotationExceptions',x);if(!persisted.ok)return;closeModal();toast('✅ Exception enregistrée')},{onDelete:old?()=>deleteRecord('rotationExceptions',x.id,'exception'):null})}
function updateDayCalc(){
 const f=$('#modalForm'), box=$('#dayCalc'); if(!f||!box||!f.elements.plannedStart)return;
 const dayType=f.elements.dayType?.value||'Présence';
 const rule=dayCountingRule(dayType);
 const plannedStart=f.elements.plannedStart.value, plannedEnd=f.elements.plannedEnd.value;
 const actualStart=f.elements.actualStart.value, actualEnd=f.elements.actualEnd.value;
 const pause=Number(f.elements.pause.value||0), overtime=Number(f.elements.overtime.value||0);
 const planned=(plannedStart&&plannedEnd)?hoursBetween(plannedStart,plannedEnd,pause):0;
 let actual=planned;
 if(rule.mode==='fixed')actual=Math.max(0,Number(rule.hours||0));
 else if(rule.mode==='zero')actual=0;
 else if(actualStart&&actualEnd)actual=hoursBetween(actualStart,actualEnd,pause);
 const total=actual+overtime, delta=total-planned;
 if(rule.mode==='fixed'){
   box.innerHTML=`<strong>Comptabilisation — ${esc(dayType)}</strong><span>Règle : ${esc(dayCountingLabel(dayType))}</span>${plannedStart&&plannedEnd?`<span>Horaire prévu conservé : ${esc(plannedStart)}–${esc(plannedEnd)}</span>`:''}<b>Comptabilisé : ${fmtHours(total)}</b>`;return;
 }
 if(rule.mode==='zero'){
   box.innerHTML=`<strong>Comptabilisation — ${esc(dayType)}</strong><span>Règle : 0 h</span><b>Comptabilisé : ${fmtHours(total)}</b>`;return;
 }
 if(!plannedStart||!plannedEnd){box.innerHTML=`<strong>Horaires prévus à définir</strong><span>La règle « ${esc(dayType)} » conserve les horaires prévus. Définissez-les dans Pilotage des horaires ou renseignez-les ici.</span>`;return}
 box.innerHTML=`<strong>Comptabilisation — ${esc(dayType)}</strong><span>Règle : Horaires prévus</span><span>Prévu : ${fmtHours(planned)}</span><span>Comptabilisé : ${fmtHours(total)}</span><b>Écart : ${delta>=0?'+':''}${fmtHours(delta)}</b>`;
}


function agentAnnualScheduleSummary(agentId,focusDate=''){
 normalizeWeeklyPlans();
 const aid=String(agentId||'');
 const plans=(db.weeklyPlans||[]).filter(p=>String(p.agentId)===aid).sort((a,b)=>(a.effectiveFrom||'').localeCompare(b.effectiveFrom||''));
 if(!plans.length)return `<div class="annual-theoretical-card empty"><strong>Horaires théoriques enregistrés</strong><span>Aucun planning annuel enregistré pour cet agent.</span></div>`;
 const dayNames={1:'Lundi',2:'Mardi',3:'Mercredi',4:'Jeudi',5:'Vendredi',6:'Samedi',0:'Dimanche'};
 const today=focusDate||todayISO();
 return `<div class="annual-theoretical-card"><div class="annual-theoretical-head"><div><strong>🕒 Horaires théoriques enregistrés</strong><small>Ils proviennent de « Pilotage des horaires ».</small></div></div>${plans.map(p=>{
   const active=(!p.effectiveFrom||p.effectiveFrom<=today)&&(!p.effectiveTo||p.effectiveTo>=today);
   const future=!active&&p.effectiveFrom&&p.effectiveFrom>today;
   const rows=[1,2,3,4,5,6,0].map(d=>{const x=p.dayProfiles?.[d]||{};return `<div class="annual-theoretical-day"><span>${dayNames[d]}</span><b>${x.start&&x.end?`${esc(x.start)} – ${esc(x.end)}`:'Repos / non travaillé'}</b>${x.pause?`<small>Pause ${Number(x.pause)} min</small>`:''}${x.missions?`<small>${esc(x.missions)}</small>`:''}</div>`}).join('');
   return `<section class="annual-theoretical-period ${active?'is-active':future?'is-future':''}"><div class="annual-theoretical-period-head"><span>${badge(p.shift||'Standard')}</span><strong>${fmtDate(p.effectiveFrom)||'—'} → ${fmtDate(p.effectiveTo)||'—'}</strong><small>${active?'Applicable à la date sélectionnée':future?'Prochain planning enregistré':'Planning archivé / hors période'}</small>${p.shift==='Standard'?`<button type="button" class="danger small delete-standard-period" data-delete-standard-period="${esc(p.id)}">🗑️ Supprimer cette période</button>`:''}</div><div class="annual-theoretical-grid">${rows}</div></section>`;
 }).join('')}</div>`;
}


function deleteStandardSchedulePeriod(planId){
 const plan=(db.weeklyPlans||[]).find(p=>String(p.id)===String(planId));
 if(!plan||plan.shift!=='Standard'){toast('Période Standard introuvable');return false}
 const ag=agentById(plan.agentId);
 const label=`${fmtDate(plan.effectiveFrom)||'—'} → ${fmtDate(plan.effectiveTo)||'—'}`;
 if(!confirm(`Supprimer uniquement cette période Standard ?\n\n${agentName(ag)}\n${label}\n\nLes autres périodes et les anciens horaires resteront conservés.`))return false;

 const deletedEnd=plan.effectiveTo||'';
 db.weeklyPlans=(db.weeklyPlans||[]).filter(p=>String(p.id)!==String(planId));

 // Recoller proprement l'historique Standard autour de la période supprimée.
 const standards=(db.weeklyPlans||[])
   .filter(p=>String(p.agentId)===String(plan.agentId)&&p.shift==='Standard')
   .sort((x,y)=>(x.effectiveFrom||'').localeCompare(y.effectiveFrom||''));

 for(let i=0;i<standards.length;i++){
   const cur=standards[i],next=standards[i+1];
   if(next?.effectiveFrom){
     cur.effectiveTo=addDays(next.effectiveFrom,-1);
   }
 }
 const previous=standards.filter(p=>(p.effectiveFrom||'')<(plan.effectiveFrom||'')).at(-1);
 const next=standards.find(p=>(p.effectiveFrom||'')>(plan.effectiveFrom||''));
 if(previous&&!next&&deletedEnd)previous.effectiveTo=deletedEnd;

 // Recalculer le raccourci Standard de la fiche agent sans recréer la période supprimée.
 if(ag){
   const ref=todayISO();
   const active=standards.filter(p=>(!p.effectiveFrom||p.effectiveFrom<=ref)&&(!p.effectiveTo||p.effectiveTo>=ref))
     .sort((x,y)=>(y.effectiveFrom||'').localeCompare(x.effectiveFrom||''))[0]||standards.at(-1)||null;
   const profile=active ? Object.values(active.dayProfiles||{}).find(x=>x?.start&&x?.end) : null;
   if(profile){
     ag.standardSchedule={start:profile.start||'',end:profile.end||'',pause:Number(profile.pause||0),missions:profile.missions||'',effectiveFrom:active.effectiveFrom||''};
     ag.standardStart=profile.start||'';ag.standardEnd=profile.end||'';ag.standardPause=Number(profile.pause||0);ag.standardMissions=profile.missions||'';
   }else{
     ag.standardSchedule={start:'',end:'',pause:0,missions:'',effectiveFrom:''};
     ag.standardStart='';ag.standardEnd='';ag.standardPause=0;ag.standardMissions='';
   }
 }

 save(true);
 safeRenderAll();

 const annualBox=$('#annualTheoreticalSummary');
 const form=$('#modalForm');
 if(annualBox&&form?.elements?.agentId){
   annualBox.innerHTML=agentAnnualScheduleSummary(form.elements.agentId.value,form.elements.dateFrom?.value||todayISO());
 }
 if(typeof refreshTheoretical==='function'){
   try{refreshTheoretical(true)}catch(_){}
 }
 toast('✅ Période Standard supprimée — historique recalculé');
 return true;
}

function openAgentDay(agentId,date,id,preferredDayType=''){
 const clicked=id?byId('agentDays',id):dayRecord(agentId,date,preferredDayType);
 const periodId=clicked?.periodId||'';
 const periodRows=periodId?db.agentDays.filter(x=>x.periodId===periodId):[];
 const old=clicked;
 const initialAgentId=clicked?.agentId||agentId||db.agents[0]?.id;
 const initialDate=clicked?.date||date||todayISO();
 const initialType=clicked?.dayType||preferredDayType||'Présence';
 const sched=resolvedTheoreticalSchedule(initialAgentId,initialDate,initialType);
 const x=old?Object.assign({},old,{plannedStart:sched.start||old.plannedStart||'',plannedEnd:sched.end||old.plannedEnd||'',pause:Number(sched.pause??old.pause??0),theoreticalSource:sched.source||sched.shift||''}):{id:uid(),agentId:initialAgentId,date:initialDate,dayType:initialType,plannedStart:sched.start,plannedEnd:sched.end,actualStart:'',actualEnd:'',pause:sched.pause,overtime:0,status:'Validée',note:'',replacement:'',noReplacementNeeded:false,theoreticalSource:sched.source||sched.shift||''};
 const dateFrom=periodRows.length?periodRows.map(r=>r.date).sort()[0]:x.date;
 const dateTo=periodRows.length?periodRows.map(r=>r.date).sort().at(-1):x.date;
 openModal(`${agentName(agentById(x.agentId))} — saisie planning`,`<div id="annualTheoreticalSummary">${agentAnnualScheduleSummary(x.agentId,initialDate)}</div><div class="day-shortcuts"><button type="button" data-set-day="Congé annuel">Congé</button><button type="button" data-set-day="RTT">RTT</button><button type="button" data-set-day="Maladie">Maladie</button><button type="button" data-set-day="Présence">Présence</button></div><div class="theoretical-schedule" id="theoreticalSchedule"></div><div class="form-grid"><label>Agent<select name="agentId">${agentOptions(x.agentId)}</select></label><label>Type de journée<select name="dayType">${dayTypeOptions(x.dayType)}</select></label>${field('Du','dateFrom',dateFrom,'date','required')}${field('Au','dateTo',dateTo,'date','required')}<label>Statut<select name="status">${selectOptions(['Demandée','Validée','Refusée','Annulée'],x.status||'Validée')}</select></label>${field('Horaire théorique — arrivée','plannedStart',x.plannedStart,'time')}${field('Horaire théorique — départ','plannedEnd',x.plannedEnd,'time')}${field('Horaire réel — arrivée','actualStart',x.actualStart,'time')}${field('Horaire réel — départ','actualEnd',x.actualEnd,'time')}${field('Pause (minutes)','pause',x.pause,'number','min="0" step="5"')}${field('Heures supplémentaires (+) / retirées (-)','overtime',x.overtime,'number','step="0.25"')}<label class="full-width replacement-choice"><span>Gestion du remplacement</span><span class="checkbox-row"><input type="checkbox" name="noReplacementNeeded" ${x.noReplacementNeeded?'checked':''}> Aucun remplacement nécessaire pendant cette période</span></label>${field('Remplacement / relais','replacement',x.replacement||'')}${textareaField('Motif / précision','note',x.note)}</div><p class="hint">Aucune notification de remplacement n’est créée le samedi, le dimanche ou un jour férié. Si la case « Aucun remplacement nécessaire » est cochée, aucune notification de remplacement ne sera créée pour toute la période.</p><div class="calculation-preview" id="dayCalc"></div>`,async form=>{const o=formDataObj(form);
 const from=o.dateFrom, to=o.dateTo;
 if(!o.agentId){toast('Choisissez un agent');return}
 if(!from||!to){toast('Renseignez les dates du et au');return}
 if(to<from){toast('La date de fin doit être après la date de début');return}
 const isPeriod=isAbsenceType(o.dayType)||['Formation','Repos'].includes(o.dayType);
 if(!Array.isArray(db.agentDays))db.agentDays=[];
 const countingRule=dayCountingRule(o.dayType);
 // Congé, RTT, formation et autres types doivent toujours pouvoir être enregistrés.
 // Quand la règle vaut « Horaires prévus », on conserve/reprend le Pilotage des horaires.
 if(countingRule.mode==='planned'){
   const firstSchedule=resolvedTheoreticalSchedule(o.agentId,from,o.dayType);
   o.plannedStart=o.plannedStart||firstSchedule.start||'';
   o.plannedEnd=o.plannedEnd||firstSchedule.end||'';
   if(o.dayType==='Présence'&&(!o.plannedStart||!o.plannedEnd)){toast('Aucun horaire théorique trouvé : renseignez arrivée et départ, ou créez les horaires de référence');return}
   if((o.actualStart&&!o.actualEnd)||(!o.actualStart&&o.actualEnd)){toast('Pour un horaire réel, renseignez à la fois l’arrivée et le départ');return}
 }
 if(periodId)db.agentDays=db.agentDays.filter(r=>r.periodId!==periodId);
 else if(old)db.agentDays=db.agentDays.filter(r=>r.id!==old.id);
 const newPeriodId=(isPeriod||from!==to)?uid():'';
 let d=from,added=0;
 while(d<=to){
   const weekday=![0,6].includes(parseDate(d).getDay());
   if(!isPeriod||weekday){
     db.agentDays=db.agentDays.filter(r=>!(String(r.agentId)===String(o.agentId)&&r.date===d));
     const sc=resolvedTheoreticalSchedule(o.agentId,d,o.dayType), sameStart=d===from;
     const rule=dayCountingRule(o.dayType);
     const pStart=rule.mode==='planned'?((from===to?o.plannedStart:'')||sc.start||o.plannedStart||''):(from===to?(o.plannedStart||''):'');
     const pEnd=rule.mode==='planned'?((from===to?o.plannedEnd:'')||sc.end||o.plannedEnd||''):(from===to?(o.plannedEnd||''):'');
     db.agentDays.push({id:uid(),periodId:newPeriodId,agentId:o.agentId,date:d,dayType:o.dayType,plannedStart:pStart,plannedEnd:pEnd,actualStart:sameStart?(o.actualStart||''):'',actualEnd:sameStart?(o.actualEnd||''):'',pause:Number((from===to&&o.pause!==''?o.pause:sc.pause??o.pause)||0),overtime:Number(sameStart?o.overtime||0:0),status:o.status||'Validée',replacement:o.noReplacementNeeded?'':(o.replacement||''),noReplacementNeeded:!!o.noReplacementNeeded,note:o.note||''});
     added++;
   }
   d=addDays(d,1);
 }
 const expectedDays=db.agentDays.filter(r=>String(r.agentId)===String(o.agentId)&&r.date>=from&&r.date<=to).map(r=>deepClone(r));
 const persisted=await window.PSTMainState.persistStateDirect({
   label:'Planning agent',
   verify:remote=>expectedDays.every(exp=>{
     const got=(remote.agentDays||[]).find(r=>String(r.id)===String(exp.id));
     return recordMatchesExpected(exp,got);
   })
 });
 if(!persisted?.ok){toast('⚠️ Planning agent non confirmé — le formulaire reste ouvert');return;}
 refreshCollectionView('agentDays');closeModal();toast(`✅ ${added} jour(s) enregistré(s)`)},{onDelete:old?()=>{if(!confirm('Supprimer cette saisie ou toute la période associée ?'))return;if(periodId)db.agentDays=db.agentDays.filter(r=>r.periodId!==periodId);else db.agentDays=db.agentDays.filter(r=>r.id!==old.id);closeModal();save();toast('Saisie supprimée')}:null});
 function refreshTheoretical(force=false){
   const f=$('#modalForm');if(!f)return;
   const aid=f.elements.agentId.value, d=f.elements.dateFrom.value||todayISO(), currentType=f.elements.dayType.value||'Présence', sc=resolvedTheoreticalSchedule(aid,d,currentType);
   const box=$('#theoreticalSchedule');
   const annualBox=$('#annualTheoreticalSummary');if(annualBox)annualBox.innerHTML=agentAnnualScheduleSummary(aid,d);
   const rule=dayCountingRule(currentType);
   if(box){
     if(currentType!=='Présence')box.innerHTML=`<strong>Pastille du calendrier — ${fmtDate(d)}</strong><b>${esc(currentType)}</b><small>Comptabilisation : ${esc(dayCountingLabel(currentType))}</small>${rule.mode==='planned'&&sc.start&&sc.end?`<small>Horaire prévu : ${esc(sc.start)} – ${esc(sc.end)}</small>`:''}`;
     else {
       const nextPlan=(db.weeklyPlans||[]).filter(p=>String(p.agentId)===String(aid)&&p.effectiveFrom&&p.effectiveFrom>d).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
       const label=sc.shift==='Repos'?'Repos / non travaillé':(sc.start&&sc.end?`${esc(sc.start)} – ${esc(sc.end)}`:'Aucun horaire applicable à cette date');
       const src=sc.shift==='Permanence'?'Permanence':sc.source==='rotation'?(sc.shift||'Roulement'):sc.shift==='Standard'?'Standard':(sc.source||'');
       box.innerHTML=`<strong>Horaire théorique du ${fmtDate(d)}</strong><b>${label}</b>${src?`<small>Source : ${esc(src)}</small>`:''}${sc.pause?`<small>Pause : ${sc.pause} min</small>`:''}${sc.missions?`<small>${esc(sc.missions)}</small>`:''}${!sc.start&&sc.shift!=='Repos'&&nextPlan?`<small>Prochain planning enregistré à partir du ${fmtDate(nextPlan.effectiveFrom)}.</small>`:''}`;
     }
   }
   if(rule.mode==='planned'&&(force||normalizeText(currentType).includes('perman')||(!f.elements.plannedStart.value&&!f.elements.plannedEnd.value))){
     f.elements.plannedStart.value=sc.start||'';f.elements.plannedEnd.value=sc.end||'';f.elements.pause.value=Number(sc.pause||0);
   }
   updateDayCalc();
 }
 $$('[data-set-day]',$('#modalBody')).forEach(b=>b.onclick=()=>{$('#modalBody [name="dayType"]').value=b.dataset.setDay;refreshTheoretical(false)});
 const f=$('#modalForm');
 const noReplacement=f.elements.noReplacementNeeded;
 const replacementField=f.elements.replacement;
 const syncReplacementChoice=()=>{if(!noReplacement||!replacementField)return;replacementField.disabled=noReplacement.checked;if(noReplacement.checked)replacementField.value='';};
 noReplacement?.addEventListener('change',syncReplacementChoice);
 syncReplacementChoice();
 f.elements.agentId.addEventListener('change',()=>refreshTheoretical(true));
 f.elements.dateFrom.addEventListener('change',()=>{if(!old)f.elements.dateTo.value=f.elements.dateFrom.value;refreshTheoretical(true)});
 f.elements.dayType.addEventListener('change',()=>refreshTheoretical(false));
 $$('#modalBody input,#modalBody select').forEach(e=>e.addEventListener('change',updateDayCalc));
 refreshTheoretical(!old);
}


function openAbsence(){const agentId=$('#absenceAgent')?.value||db.agents[0]?.id;const date=($('#absenceMonth')?.value||monthISO())+'-01';openAgentDay(agentId,date)}


async function persistFormRecordVerified(label='Donnée',collection='',id=''){
 try{
   localDirty=true;
   if(typeof clearTheoreticalScheduleCache==='function')clearTheoreticalScheduleCache();

   // Hors ligne : conservation locale explicite.
   if(!navigator.onLine){
     const ok=writeOfflinePending('appareil hors connexion');
     safeRenderAll();
     setSaveState(`${label} conservé localement — synchronisation au retour du réseau`,'local');
     return {ok:!!ok,offline:true};
   }

   // En ligne : écriture réelle Supabase + relecture de contrôle.
   if(window.PSTMainState?.persistStateDirect){
     const result=await window.PSTMainState.persistStateDirect({
       label,
       verify:remote=>!collection||!id||(Array.isArray(remote?.[collection])&&remote[collection].some(x=>String(x.id)===String(id)))
     });
     if(result?.ok){
       return {ok:true,offline:false};
     }
     throw new Error(result?.error||`${label} non confirmé par Supabase`);
   }

   // Secours.
   const ok=save(false);
   if(!ok)throw new Error(`${label} non enregistré`);
   safeRenderAll();
   return {ok:true,offline:false};
 }catch(error){
   console.error(`${label} — enregistrement vérifié impossible`,error);
   setSaveState(`${label} non confirmé : ${error?.message||error}`,'error');
   toast(`⚠️ ${label} non confirmé — le formulaire reste ouvert`);
   return {ok:false,offline:false,error:error?.message||String(error)};
 }
}

function recordComparableSnapshot(record){
 const skip=new Set(['attachments','historyCreatedAt','historyUpdatedAt']);
 const out={};
 for(const [k,v] of Object.entries(record||{})){
   if(skip.has(k)||typeof v==='function'||v===undefined)continue;
   out[k]=v;
 }
 return out;
}
function samePersistedValue(expected,actual){
 if(expected===undefined)return true;
 if(expected===null)return actual===null||actual===undefined||actual==='';
 if(typeof expected==='number')return Number(actual)===expected;
 if(typeof expected==='boolean')return Boolean(actual)===expected;
 if(Array.isArray(expected)||typeof expected==='object'){
   try{return JSON.stringify(actual??null)===JSON.stringify(expected)}
   catch(_){return false}
 }
 return String(actual??'')===String(expected);
}
function recordMatchesExpected(expectedRecord,actualRecord){
 if(!actualRecord)return false;
 const expected=recordComparableSnapshot(expectedRecord);
 return Object.entries(expected).every(([k,v])=>samePersistedValue(v,actualRecord[k]));
}
function upsertDbRecord(collection,record){
 if(!collection||!record?.id)return false;
 if(!Array.isArray(db[collection]))db[collection]=[];
 const i=db[collection].findIndex(x=>String(x.id)===String(record.id));
 const copy=deepClone(record);
 if(i>=0)db[collection][i]=copy;
 else db[collection].push(copy);
 return true;
}
function refreshCollectionView(collection){
 const map={
   maintenance:renderMaintenance,requests:renderRequests,works:renderWorks,meetings:renderMeetings,
   notes:renderNotes,issues:renderIssues,periodic:renderPeriodic,cleaning:renderCleaning,
   vacations:renderVacations,personalEvents:renderPersonal,documents:renderDocuments,
   agents:renderAgents,rotations:renderRotations,weeklyPlans:renderPlanning,agentDays:renderPlanning,
   spaces:renderSettings
 };
 try{map[collection]?.()}catch(error){console.warn('Rafraîchissement collection',collection,error)}
}
async function commitFormRecordVerified(label,collection,record){
 if(!record?.id)return {ok:false,error:'Identifiant manquant'};
 upsertDbRecord(collection,record);
 const expected=recordComparableSnapshot(record);

 try{
   localDirty=true;
   if(typeof clearTheoreticalScheduleCache==='function')clearTheoreticalScheduleCache();

   if(!navigator.onLine){
     const ok=writeOfflinePending('appareil hors connexion');
     refreshCollectionView(collection);
     setSaveState(`${label} conservé localement — synchronisation au retour du réseau`,'local');
     return {ok:!!ok,offline:true};
   }

   if(window.PSTMainState?.persistStateDirect){
     const result=await window.PSTMainState.persistStateDirect({
       label,
       verify:remote=>{
         const found=Array.isArray(remote?.[collection])
           ? remote[collection].find(x=>String(x.id)===String(record.id))
           : null;
         return recordMatchesExpected(expected,found);
       }
     });
     if(!result?.ok)throw new Error(result?.error||`${label} non confirmé par Supabase`);

     const confirmed=Array.isArray(db?.[collection])
       ? db[collection].find(x=>String(x.id)===String(record.id))
       : null;
     if(!recordMatchesExpected(expected,confirmed)){
       throw new Error(`${label} relu mais les modifications ne correspondent pas`);
     }
     refreshCollectionView(collection);
     return {ok:true,offline:false};
   }

   save(false);
   refreshCollectionView(collection);
   return {ok:true,offline:false};
 }catch(error){
   console.error(`${label} — commit impossible`,error);
   setSaveState(`${label} non confirmé : ${error?.message||error}`,'error');
   toast(`⚠️ ${label} non confirmé — le formulaire reste ouvert`);
   return {ok:false,offline:false,error:error?.message||String(error)};
 }
}

/* ---------- Formulaires métier ---------- */
function openPersonalEvent(id,date=todayISO()){const old=id?byId('personalEvents',id):null;const x=old||{id:uid(),no:nextNo('personal','PER'),date,start:'',end:'',type:'Rendez-vous',title:'',location:'',priority:'Normale',status:'À faire',notes:'',attachments:[]};openModal(old?'Modifier l’événement':'Nouvel événement personnel',`<div class="form-grid">${field('Date','date',x.date,'date','required')}${field('Début','start',x.start,'time')}${field('Fin','end',x.end,'time')}<label>Type<select name="type">${selectOptions(db.lists.personalTypes,x.type)}</select></label>${field('Objet','title',x.title,'text','required')}${field('Lieu','location',x.location)}<label>Priorité<select name="priority">${selectOptions(db.lists.priorities,x.priority)}</select></label><label>Statut<select name="status">${selectOptions(db.lists.generalStatuses,x.status)}</select></label>${textareaField('Notes','notes',x.notes)}${attachmentField(x.attachments)}</div>`,async form=>{Object.assign(x,formDataObj(form));const attachmentCheck=await processAttachments(form,x,'personal');if(!attachmentCheck?.ok)return;const persisted=await commitFormRecordVerified('Événement','personalEvents',x);if(!persisted.ok)return;closeModal();toast('✅ Événement enregistré')},{onDelete:old?()=>deleteRecord('personalEvents',x.id,'événement'):null})}
function openIssue(id,defaults={}){const old=id?byId('issues',id):null;const x=old||{id:uid(),no:nextNo('issue','ACT'),date:todayISO(),time:'',agentId:'',category:'Sécurité',title:'',description:'',priority:defaults.priority||'Haute',status:'À faire',owner:'',building:'',floor:'',sector:'',room:'',dueDate:'',cost:'',action:'',attachments:[]};openModal(old?'Modifier l’action':'Nouvelle action sécurité / qualité',`<div class="form-grid">${field('Date','date',x.date,'date')}${field('Heure','time',x.time,'time')}<label>Agent concerné<select name="agentId">${agentOptions(x.agentId,true)}</select></label><label>Catégorie<select name="category">${selectOptions(db.lists.issueCategories,x.category)}</select></label><label>Priorité<select name="priority">${selectOptions(db.lists.priorities,x.priority)}</select></label>${field('Problématique','title',x.title,'text','required')}<label>Statut<select name="status">${selectOptions(db.lists.generalStatuses,x.status)}</select></label>${centralLocationFields(x,'issueLoc')}${field('Responsable du suivi','owner',x.owner)}${field('Échéance','dueDate',x.dueDate,'date')}${field('Coût éventuel (€)','cost',x.cost,'number','min="0" step="0.01"')}${textareaField('Description','description',x.description)}${textareaField('Action corrective / décision','action',x.action)}${attachmentField(x.attachments)}</div>`,async form=>{Object.assign(x,formDataObj(form),{cost:Number(form.elements.cost.value||0)});const attachmentCheck=await processAttachments(form,x,'issues');if(!attachmentCheck?.ok)return;const persisted=await commitFormRecordVerified('Action sécurité / qualité','issues',x);if(!persisted.ok)return;closeModal();const issueMonth=document.getElementById('issueMonth'),issueAgent=document.getElementById('issueAgent'),issueCategory=document.getElementById('issueCategory'),issueStatus=document.getElementById('issueStatus');if(issueMonth&&x.date)issueMonth.value=String(x.date).slice(0,7);if(issueAgent)issueAgent.value='';if(issueCategory)issueCategory.value='';if(issueStatus)issueStatus.value='';setView('issues');renderIssues();toast('✅ Problématique confirmée et affichée dans la liste')},{onDelete:old?()=>deleteRecord('issues',x.id,'action'):null});bindCentralLocation('issueLoc')}
// Les contrôles périodiques sont indépendants de l'année scolaire : leur cycle suit leur vraie échéance, même plusieurs années plus tard.
function addMonthsClamped(dateISO,months){
 const d=parseDate(dateISO),day=d.getDate(),target=new Date(d.getFullYear(),d.getMonth()+Number(months||0),1,12,0,0,0);
 const last=new Date(target.getFullYear(),target.getMonth()+1,0,12,0,0,0).getDate();target.setDate(Math.min(day,last));return localISO(target)
}
function periodicIsInactive(x){const s=normalizeText(x?.status);return s==='cloture'||s==='cloturee'||s==='non applicable'||s==='archive'||s==='archivee'}
function periodicDue(x){if(x.nextDate)return normalizeDateValue(x.nextDate);if(x.lastDate&&Number(x.intervalMonths)>0)return addMonthsClamped(x.lastDate,x.intervalMonths);return ''}
function periodicComputed(x){const due=periodicDue(x);if(periodicIsInactive(x))return x.status||'Clôturé';if(!due)return x.status||'À planifier';const diff=(parseDate(due)-parseDate(todayISO()))/86400000;if(diff<0)return 'En retard';if(diff<=60)return 'Bientôt';return 'À jour'}
function openPeriodic(id){const old=id?byId('periodic',id):null;const x=old||{id:uid(),no:nextNo('periodic','CP'),name:'',family:db.lists.periodicFamilies[0],intervalMonths:12,requirement:'',provider:'',register:'Registre de sécurité',building:'Tous bâtiments',lastDate:'',nextDate:'',status:'À planifier',notes:'',attachments:[]};openModal(old?'Modifier le contrôle périodique':'Nouveau contrôle périodique',`<div class="form-grid">${field('N° contrôle','no',x.no||'')}${field('Contrôle','name',x.name,'text','required')}<label>Famille<select name="family">${selectOptions(db.lists.periodicFamilies,x.family)}</select></label><label>Bâtiment<select name="building"><option>Tous bâtiments</option>${buildingOptions(x.building)}</select></label>${field('Périodicité (mois, 0 = variable)','intervalMonths',x.intervalMonths,'number','min="0"')}${field('Périodicité / précision','periodicityText',x.periodicityText||'')}${field('Dernier contrôle','lastDate',x.lastDate,'date')}${field('Prochaine échéance','nextDate',periodicDue(x),'date')}${field('Heure prévue','time',x.time,'time')}${field('Étage / niveau','floor',x.floor)}${field('Secteur','sector',x.sector||'')}${field('Local / zone','room',x.room)}<label>Statut<select name="status">${selectOptions(['À planifier','Planifié','Réalisé','Clôturé','En attente','Non applicable'],x.status)}</select></label>${field('Prestataire / responsable','provider',x.provider)}${field('Registre / dossier','register',x.register)}${textareaField('Exigence / contenu','requirement',x.requirement)}${textareaField('Notes','notes',x.notes)}<p class="form-hint"><strong>Suivi permanent :</strong> ce contrôle reste suivi au-delà de l'année scolaire jusqu'à sa véritable prochaine échéance.</p>${attachmentField(x.attachments)}</div>`,async form=>{const o=formDataObj(form),intervalMonths=Number(o.intervalMonths||0);Object.assign(x,o,{intervalMonths});if(x.lastDate&&intervalMonths>0&&!o.nextDate)x.nextDate=addMonthsClamped(x.lastDate,intervalMonths);const attachResult=await processAttachments(form,x,'periodic');
if(!attachResult?.ok){
 toast('Le contrôle n’est pas enregistré : au moins un fichier n’a pas été chargé dans Supabase.');
 setSaveState('PDF non chargé — corrigez avant d’enregistrer','error');
 return;
}
const persisted=await commitFormRecordVerified('Contrôle périodique','periodic',x);
if(!persisted?.ok){
 toast('Le contrôle n’est pas confirmé dans Supabase. Le formulaire reste ouvert.');
 return;
}
closeModal();
toast(persisted?.offline?'Contrôle enregistré hors ligne — synchronisation automatique':'✅ Contrôle périodique et fichiers confirmés dans Supabase')},{onDelete:old?()=>deleteRecord('periodic',x.id,'contrôle'):null})}
function cleaningTasks(type,existing=[]){const oldMap=new Map((existing||[]).map(t=>[t.name,t]));return (GUIDE[type]||GUIDE['Autre']||[]).map(([name,freq])=>{const o=oldMap.get(name)||{name,frequency:freq,status:'Non contrôlé',comment:''};return `<div class="clean-task" data-clean-task><div><strong>${esc(name)}</strong><small>${esc(freq)}</small></div><select name="taskStatus">${selectOptions(db.lists.cleaningStatuses,o.status)}</select><input name="taskComment" value="${esc(o.comment||'')}" placeholder="Commentaire rapide"></div>`}).join('')}
function openCleaning(id){const old=id?byId('cleaning',id):null;const b=old?.building||db.buildings[0]?.name||'',floor=old?.floor||db.buildings[0]?.floors?.[0]||'',type=old?.roomType||'Salle de classe / devoirs / informatique';const x=old||{id:uid(),no:nextNo('cleaning','MEN'),date:todayISO(),time:new Date().toTimeString().slice(0,5),inspector:db.settings.defaultInspector||'',agentId:'',building:b,floor,roomType:type,room:'Zone entière',overallStatus:'',score:0,comment:'',tasks:[],attachments:[]};openModal(old?'Modifier le contrôle ménage':'Nouveau contrôle ménage',`<div class="form-grid">${field('Date','date',x.date,'date','required')}${field('Heure','time',x.time,'time')}<label>Agent / secteur contrôlé<select name="agentId">${agentOptions(x.agentId,true)}</select></label>${field('Contrôleur','inspector',x.inspector)}<label>Bâtiment<select name="building" id="mBuilding">${buildingOptions(x.building)}</select></label><label>Étage<select name="floor" id="mFloor">${floorOptions(x.building,x.floor)}</select></label><label>Type de local<select name="roomType" id="mRoomType">${selectOptions(db.lists.roomTypes,x.roomType)}</select></label><label>Local / zone<select name="room" id="mRoom">${roomOptions(x.building,x.floor,x.roomType,x.room)}</select></label><label id="mOtherRoomWrap" class="${x.room==='Autre local'?'':'hidden'}">Autre local<input name="otherRoom" id="mOtherRoom" value="${esc(x.otherRoom||'')}"></label>${textareaField('Observation générale','comment',x.comment)}</div><div class="clean-bulk"><span>Tout passer en :</span>${['Conforme','À reprendre','Non conforme','Non applicable'].map(s=>`<button type="button" data-bulk-clean="${s}">${s}</button>`).join('')}</div><div id="cleanTaskEditor" class="clean-task-editor">${cleaningTasks(x.roomType,x.tasks)}</div>${attachmentField(x.attachments)}`,async form=>{const o=formDataObj(form);const rows=$$('[data-clean-task]',form).map((r,i)=>({name:r.querySelector('strong').textContent,frequency:r.querySelector('small').textContent,status:r.querySelector('[name="taskStatus"]').value,comment:r.querySelector('[name="taskComment"]').value}));const rated=rows.filter(r=>!['Non contrôlé','Non applicable'].includes(r.status)),good=rated.filter(r=>r.status==='Conforme').length;if(o.room==='Autre local'&&o.otherRoom)o.room=o.otherRoom;Object.assign(x,o,{room:o.room,tasks:rows,score:rated.length?Math.round(good/rated.length*100):0,overallStatus:rows.some(r=>r.status==='Non conforme')?'Non conforme':rows.some(r=>r.status==='À reprendre')?'À reprendre':rated.length?'Conforme':'Non contrôlé'});const attachmentCheck=await processAttachments(form,x,'cleaning');if(!attachmentCheck?.ok)return;const persisted=await commitFormRecordVerified('Contrôle ménage','cleaning',x);if(!persisted.ok)return;closeModal();toast(`✅ Contrôle ménage enregistré — résultat : ${x.overallStatus||'—'}`)},{onDelete:old?()=>deleteRecord('cleaning',x.id,'contrôle'):null});const updateOtherRoom=()=>$('#mOtherRoomWrap')?.classList.toggle('hidden',$('#mRoom')?.value!=='Autre local');const updateLocation=()=>{const bb=$('#mBuilding').value,ff=$('#mFloor').value,tt=$('#mRoomType').value,oldRoom=$('#mRoom').value;$('#mRoom').innerHTML=roomOptions(bb,ff,tt,oldRoom);updateOtherRoom()};$('#mBuilding').onchange=()=>{$('#mFloor').innerHTML=floorOptions($('#mBuilding').value);updateLocation()};$('#mFloor').onchange=updateLocation;$('#mRoomType').onchange=()=>{$('#cleanTaskEditor').innerHTML=cleaningTasks($('#mRoomType').value,[]);updateLocation()};$('#mRoom').onchange=updateOtherRoom;updateOtherRoom();$$('[data-bulk-clean]').forEach(btn=>btn.onclick=()=>$$('[name="taskStatus"]',$('#cleanTaskEditor')).forEach(s=>s.value=btn.dataset.bulkClean))}
function openMaintenance(id){const old=id?byId('maintenance',id):null;const x=old||{id:uid(),no:nextNo('maintenance','MAI'),date:todayISO(),time:'',title:'',family:'Électricité',priority:'Normale',status:'À faire',building:'',floor:'',sector:'',room:'',requester:'',assigned:'',dueDate:'',description:'',action:'',cost:'',attachments:[]};openModal(old?'Modifier l’intervention':'Nouvelle intervention',`<div class="form-grid">${field('Date de demande','date',x.date,'date','required')}${field('Heure prévue','time',x.time,'time')}${field('Objet','title',x.title,'text','required')}<label>Famille<select name="family">${selectOptions(db.lists.maintenanceFamilies,x.family)}</select></label><label>Priorité<select name="priority">${selectOptions(db.lists.priorities,x.priority)}</select></label><label>Statut<select name="status">${selectOptions(db.lists.maintenanceStatuses,x.status)}</select></label>${centralLocationFields(x,'maintLoc')}${field('Demandeur','requester',x.requester)}${field('Assigné à / prestataire','assigned',x.assigned)}${field('Échéance','dueDate',x.dueDate,'date')}${textareaField('Description / diagnostic','description',x.description)}${textareaField('Action réalisée / suite','action',x.action)}${attachmentField(x.attachments)}</div>`,async form=>{Object.assign(x,formDataObj(form));if(x.room==='Autre lieu'&&x.otherLocation)x.room=x.otherLocation;const attachmentCheck=await processAttachments(form,x,'maintenance');if(!attachmentCheck?.ok)return;const persisted=await commitFormRecordVerified('Intervention','maintenance',x);if(!persisted.ok)return;closeModal();refreshCollectionView('maintenance');toast(`✅ Intervention enregistrée — statut : ${x.status}`)},{onDelete:old?()=>deleteRecord('maintenance',x.id,'intervention'):null});bindCentralLocation('maintLoc')}
function openRequest(id){const old=id?byId('requests',id):null;const x=old||{id:uid(),no:nextNo('request','DIR'),date:todayISO(),time:'',type:'Aménagement de salle',title:'',priority:'Normale',status:'À faire',building:'',floor:'',sector:'',room:'',requester:'Direction',dueDate:'',description:'',response:'',attachments:[]};openModal(old?'Modifier la demande':'Nouvelle demande de la direction',`<div class="form-grid">${field('Date','date',x.date,'date')}${field('Heure prévue','time',x.time,'time')}<label>Type<select name="type">${selectOptions(db.lists.requestTypes,x.type)}</select></label>${field('Objet','title',x.title,'text','required')}<label>Priorité<select name="priority">${selectOptions(db.lists.priorities,x.priority)}</select></label><label>Statut<select name="status">${selectOptions(db.lists.generalStatuses,x.status)}</select></label>${centralLocationFields(x,'reqLoc')}${field('Demandeur','requester',x.requester)}${field('Échéance','dueDate',x.dueDate,'date')}${textareaField('Demande','description',x.description)}${textareaField('Réponse / réalisation','response',x.response)}${attachmentField(x.attachments)}</div>`,async form=>{Object.assign(x,formDataObj(form));if(x.room==='Autre lieu'&&x.otherLocation)x.room=x.otherLocation;const attachmentCheck=await processAttachments(form,x,'requests');if(!attachmentCheck?.ok)return;const persisted=await commitFormRecordVerified('Demande','requests',x);if(!persisted.ok)return;closeModal();toast(`✅ Demande enregistrée — statut : ${x.status||'—'}`)},{onDelete:old?()=>deleteRecord('requests',x.id,'demande'):null});bindCentralLocation('reqLoc')}
function openWork(id){const old=id?byId('works',id):null;const x=old||{id:uid(),no:nextNo('work','CHT'),date:todayISO(),time:'',type:'Réunion de chantier',title:'',company:'',architect:'',building:'',floor:'',sector:'',room:'',priority:'Normale',status:'À faire',dueDate:'',description:'',decision:'',gpaEnd:'',attachments:[]};openModal(old?'Modifier le suivi chantier':'Nouveau suivi chantier / GPA',`<div class="form-grid">${field('Date','date',x.date,'date')}${field('Heure prévue','time',x.time,'time')}<label>Type<select name="type">${selectOptions(db.lists.workTypes,x.type)}</select></label>${field('Objet / réserve','title',x.title,'text','required')}${field('Entreprise','company',x.company)}${field('Architecte / maîtrise d’œuvre','architect',x.architect)}${centralLocationFields(x,'workLoc')}<label>Priorité<select name="priority">${selectOptions(db.lists.priorities,x.priority)}</select></label><label>Statut<select name="status">${selectOptions(db.lists.generalStatuses,x.status)}</select></label>${field('Échéance','dueDate',x.dueDate,'date')}${field('Fin GPA','gpaEnd',x.gpaEnd,'date')}${textareaField('Constat / description','description',x.description)}${textareaField('Décision / suite','decision',x.decision)}${attachmentField(x.attachments)}</div>`,async form=>{Object.assign(x,formDataObj(form));if(x.room==='Autre lieu'&&x.otherLocation)x.room=x.otherLocation;const attachmentCheck=await processAttachments(form,x,'works');if(!attachmentCheck?.ok)return;const persisted=await commitFormRecordVerified('Chantier / GPA','works',x);if(!persisted.ok)return;closeModal();toast(`✅ Suivi chantier enregistré — statut : ${x.status||'—'}`)},{onDelete:old?()=>deleteRecord('works',x.id,'suivi'):null});bindCentralLocation('workLoc')}
function openMeeting(id,date=todayISO()){const old=id?byId('meetings',id):null;const x=old||{id:uid(),no:nextNo('meeting','RDV'),date,time:'',end:'',type:'Rendez-vous',title:'',building:'',floor:'',sector:'',room:'',participants:'',status:'Planifié',notes:'',actions:'',attachments:[]};openModal(old?'Modifier le rendez-vous':'Nouvelle réunion / rendez-vous',`<div class="form-grid">${field('Date','date',x.date,'date','required')}${field('Heure','time',x.time,'time')}${field('Fin','end',x.end,'time')}<label>Type<select name="type">${selectOptions(db.lists.meetingTypes,x.type)}</select></label>${field('Objet','title',x.title,'text','required')}${centralLocationFields(x,'meetLoc')}${field('Participants','participants',x.participants)}<label>Statut<select name="status">${selectOptions(['Planifié','Réalisé','Reporté','Annulé'],x.status)}</select></label>${textareaField('Compte rendu','notes',x.notes)}${textareaField('Actions décidées','actions',x.actions)}${attachmentField(x.attachments)}</div>`,async form=>{Object.assign(x,formDataObj(form));if(x.room==='Autre lieu'&&x.otherLocation)x.room=x.otherLocation;x.location=[x.building,x.floor,x.sector,x.room].filter(Boolean).join(' · ');const attachmentCheck=await processAttachments(form,x,'meetings');if(!attachmentCheck?.ok)return;const persisted=await commitFormRecordVerified('Réunion / rendez-vous','meetings',x);if(!persisted.ok)return;closeModal();toast(`✅ Rendez-vous enregistré — statut : ${x.status||'—'}`)},{onDelete:old?()=>deleteRecord('meetings',x.id,'rendez-vous'):null});bindCentralLocation('meetLoc')}
function openNote(id,category='Autre'){const old=id?byId('notes',id):null;const x=old||{id:uid(),no:nextNo('note','NOT'),date:todayISO(),time:'',category,agentId:'',title:'',text:'',priority:'Normale',status:'À faire',building:'',floor:'',sector:'',room:'',dueDate:'',items:[],attachments:[]};openModal(old?'Modifier la note':'Nouvelle note',`<div class="form-grid">${field('Date','date',x.date,'date')}${field('Heure','time',x.time,'time')}<label>Catégorie<select name="category">${selectOptions(db.lists.noteCategories,x.category)}</select></label><label>Agent concerné<select name="agentId">${agentOptions(x.agentId,true)}</select></label><label>Priorité<select name="priority">${selectOptions(db.lists.priorities,x.priority)}</select></label>${field('Titre','title',x.title,'text','required')}<label>Statut<select name="status">${selectOptions(db.lists.generalStatuses,x.status)}</select></label>${field('Échéance','dueDate',x.dueDate,'date')}${centralLocationFields(x,'noteLoc')}${textareaField('Note','text',x.text,5)}</div><fieldset><legend>Liste d’items</legend>${noteItemsHTML(x.items)}</fieldset>${attachmentField(x.attachments)}`,async form=>{const o=formDataObj(form);const rows=$$('.item-row',form).map(r=>({text:r.querySelector('[name="itemText"]').value.trim(),done:r.querySelector('[name="itemDone"]').checked})).filter(i=>i.text);Object.assign(x,o,{items:rows});const attachmentCheck=await processAttachments(form,x,'notes');if(!attachmentCheck?.ok)return;if(x.room==='Autre lieu'&&x.otherLocation)x.room=x.otherLocation;const persisted=await commitFormRecordVerified('Note','notes',x);if(!persisted.ok)return;closeModal();toast(`✅ Note enregistrée — statut : ${x.status||'—'}`)},{onDelete:old?()=>deleteRecord('notes',x.id,'note'):null});bindCentralLocation('noteLoc');function bindItems(){const box=$('#noteItems');if(!box)return;$$('[data-remove-item]',box).forEach(b=>b.onclick=()=>b.closest('.item-row')?.remove())}bindItems();const add=$('#addNoteItem');if(add)add.onclick=()=>{const box=$('#noteItems');if(!box)return;box.insertAdjacentHTML('beforeend','<div class="item-row"><input name="itemText" placeholder="Nouvelle action"><label class="inline-check"><input name="itemDone" type="checkbox"> Fait</label><button type="button" data-remove-item>×</button></div>');bindItems()}}
function openVacation(id){const old=id?byId('vacations',id):null;const x=old||{id:uid(),name:'Fermeture / vacances',zone:db.settings.schoolZone,start:todayISO(),end:addDays(todayISO(),7),status:'À préparer',tasks:VACATION_TASKS.map(t=>({text:t,done:false})),notes:'',attachments:[]};openModal(old?'Modifier la période':'Nouvelle période de vacances / fermeture',`<div class="form-grid">${field('Nom','name',x.name,'text','required')}<label>Zone<select name="zone">${selectOptions(['A','B','C','Toutes'],x.zone)}</select></label>${field('Début','start',x.start,'date','required')}${field('Fin','end',x.end,'date','required')}<label>Statut<select name="status">${selectOptions(['À préparer','En préparation','Prête','Terminée'],x.status)}</select></label>${textareaField('Notes','notes',x.notes)}</div><fieldset><legend>Checklist de fermeture / reprise</legend>${noteItemsHTML(x.tasks)}</fieldset>${attachmentField(x.attachments)}`,async form=>{const o=formDataObj(form);const tasks=$$('.item-row',form).map(r=>({text:r.querySelector('[name="itemText"]').value.trim(),done:r.querySelector('[name="itemDone"]').checked})).filter(i=>i.text);Object.assign(x,o,{tasks});const attachmentCheck=await processAttachments(form,x,'vacations');if(!attachmentCheck?.ok)return;const persisted=await commitFormRecordVerified('Vacances / fermeture','vacations',x);if(!persisted.ok)return;closeModal();toast(`✅ Période enregistrée — statut : ${x.status||'—'}`)},{onDelete:old?()=>deleteRecord('vacations',x.id,'période'):null});function bind(){const box=$('#noteItems');if(!box)return;$$('[data-remove-item]',box).forEach(b=>b.onclick=()=>b.closest('.item-row')?.remove())}bind();const add=$('#addNoteItem');if(add)add.onclick=()=>{const box=$('#noteItems');if(!box)return;box.insertAdjacentHTML('beforeend','<div class="item-row"><input name="itemText" placeholder="Nouvelle action"><label class="inline-check"><input name="itemDone" type="checkbox"> Fait</label><button type="button" data-remove-item>×</button></div>');bind()}}
function openDocument(id){const old=id?byId('documents',id):null;const x=old||{id:uid(),no:nextNo('document','DOC'),date:todayISO(),title:'',category:'Guide / procédure',description:'',linkedModule:'Général',attachments:[]};openModal(old?'Modifier le document':'Ajouter un document',`<div class="form-grid">${field('Date','date',x.date,'date')}<label>Catégorie<select name="category">${selectOptions(db.lists.documentCategories,x.category)}</select></label>${field('Titre','title',x.title,'text','required')}<label>Rattacher à<select name="linkedModule">${selectOptions(['Général','Ménage','Maintenance','Chantier / GPA','Contrôles périodiques','Agents','Vacances','Sécurité / qualité'],x.linkedModule)}</select></label>${textareaField('Description','description',x.description)}${attachmentField(x.attachments)}</div>`,async form=>{Object.assign(x,formDataObj(form));const attachmentCheck=await processAttachments(form,x,'documents');if(!attachmentCheck?.ok)return;const persisted=await commitFormRecordVerified('Document','documents',x);if(!persisted.ok)return;closeModal();toast('✅ Document enregistré')},{onDelete:old?()=>deleteRecord('documents',x.id,'document'):null})}
function openSpace(id){const old=id?byId('spaces',id):null;const x=old||{id:uid(),building:db.buildings[0]?.name||'',floor:db.buildings[0]?.floors?.[0]||'',type:db.lists.roomTypes[0],name:''};openModal(old?'Modifier le local':'Ajouter un local',`<div class="form-grid"><label>Bâtiment<select name="building" id="mBuilding">${buildingOptions(x.building)}</select></label><label>Étage<select name="floor" id="mFloor">${floorOptions(x.building,x.floor)}</select></label><label>Type<select name="type">${selectOptions(db.lists.roomTypes,x.type)}</select></label>${field('Nom / numéro du local','name',x.name,'text','required')}</div>`,async form=>{Object.assign(x,formDataObj(form));const persisted=await commitFormRecordVerified('Local','spaces',x);if(!persisted.ok)return;closeModal();toast('✅ Local enregistré')},{onDelete:old?()=>deleteRecord('spaces',x.id,'local'):null});$('#mBuilding').onchange=()=>$('#mFloor').innerHTML=floorOptions($('#mBuilding').value)}
/* ---------- Rendu : calendriers ---------- */
function editButton(type,id,label='Modifier'){return `<button class="icon-btn row-edit" data-edit-type="${type}" data-edit-id="${esc(id)}" title="${label}">✎</button>`}
function cardList(items,empty='Aucun élément.'){return items.length?items.join(''):`<p class="empty-card">${esc(empty)}</p>`}
function renderTeamCalendar(){
  const days=Array.from({length:7},(_,i)=>addDays(teamWeek,i));
  $('#teamWeekLabel').textContent=`Semaine ${weekNumber(teamWeek)} · ${fmtDate(days[0])} au ${fmtDate(days[6])}`;
  $('#teamDateJump').value=teamWeek;
  const agents=db.agents.filter(a=>a.status==='Actif');
  if(!agents.length){$('#teamWeekCalendar').innerHTML='<div class="empty">Ajoutez un agent pour afficher le planning de la semaine.</div>';return}
  const html=days.map(date=>{
    const dateObj=parseDate(date);
    let present=0;
    const rows=agents.map(a=>{
      const info=dayInfo(a.id,date),h=dayHours(info);
      if(info.dayType==='Présence')present++;
      const absent=isAbsenceType(info.dayType);
      const cls=absent?'absence':info.dayType==='Formation'?'training':info.dayType==='Repos'?'rest':info.shift==='Soir'?'evening':info.shift==='Matin'?'morning':'neutral';

      // dayInfo contient déjà l'horaire théorique résolu : pas de deuxième calcul.
      const theoretical=info;
      const theoreticalText=theoretical.plannedStart&&theoretical.plannedEnd?`${esc(theoretical.plannedStart)}–${esc(theoretical.plannedEnd)}`:(theoretical.shift==='Repos'?'Repos / non travaillé':'Horaire non défini');
      const sourceLabel=theoretical.shift==='Permanence'?'Permanence':theoretical.source==='rotation'?(theoretical.shift||'Roulement'):theoretical.shift==='Standard'?'Standard':theoretical.shift==='Repos'?'Repos':'';
      const theoreticalLine=info.dayType==='Présence'?`<small class="agent-theoretical"><b>Théorique :</b> ${theoreticalText}${sourceLabel?` · ${esc(sourceLabel)}`:''}</small>`:`<small class="agent-theoretical muted"><b>Théorique :</b> ${theoreticalText}${sourceLabel?` · ${esc(sourceLabel)}`:''}</small>`;
      const mission=info.dayType==='Présence'&&theoretical.missions?`<small class="agent-missions">${esc(theoretical.missions)}</small>`:(info.note?`<small class="agent-missions">${esc(info.note)}</small>`:'');
      const delta=Math.abs(h.delta)>0.001?`<em class="agent-delta ${h.delta>0?'positive':'negative'}">${h.delta>0?'+':''}${h.delta.toFixed(2)} h</em>`:'';
      return `<button class="team-agent-entry ${cls}" data-agent-day="${a.id}" data-date="${date}" title="Modifier ${esc(agentName(a))} le ${fmtDate(date)}"><span class="agent-entry-avatar">${esc((a.firstName||a.lastName||'?').charAt(0).toUpperCase())}</span><span class="agent-entry-main"><strong>${esc(agentName(a))}</strong>${theoreticalLine}${mission}</span>${delta}<span class="agent-entry-arrow">›</span></button>`;
    }).join('');
    return `<section class="team-day-card ${date===todayISO()?'today':''}"><header class="team-day-header"><div><strong>${dateObj.toLocaleDateString('fr-FR',{weekday:'long'})}</strong><span>${dateObj.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</span></div><small>${present}/${agents.length} prévu${present>1?'s':''}</small></header><div class="team-day-agents">${rows}</div></section>`;
  }).join('');
  $('#teamWeekCalendar').innerHTML=`<div class="team-week-cards">${html}</div>`;
}
function roomPrepAgendaItems(){
 return Array.isArray(db.roomPreps)?db.roomPreps.filter(x=>!x?.deletedAt):[];
}
function wasteAgendaItemForDate(d){
 const api=window.PSTWeatherWaste;if(!api?.collectionInfo||!api?.binForDate||!api?.localISO)return null;
 const day=parseDate(d),wd=day.getDay();let friday=null;
 if(wd===5)friday=new Date(day);
 else if(wd===6){friday=new Date(day);friday.setDate(friday.getDate()-1)}
 else return null;
 const ci=api.collectionInfo(friday),actual=api.localISO(ci.actual);
 if(actual!==d)return null;
 const bin=api.binForDate(friday);
 return {id:`waste-${d}`,date:d,start:'',title:`${bin.icon} Sortir / passage ${bin.label}`,source:'waste',view:'waste',meta:`Rue Noëlas · Rue Jean Puy${ci.shifted?' · collecte décalée':''}`};
}
function eventsForDate(d){
 const sameDay=(x)=>normalizeDateValue(x)===d;
 const active=(x)=>!isClosedStatus(x.status)&&normalizeText(x.status)!=='annule';
 const onDateOrDue=(x)=>sameDay(x.date)||sameDay(recordDueDate(x));
 const rows=[
  ...(db.personalEvents||[]).filter(x=>sameDay(x.date)&&active(x)).map(x=>({...x,source:'personal',start:x.start||''})),
  ...(db.meetings||[]).filter(x=>sameDay(x.date)&&active(x)).map(x=>({...x,source:'meeting',start:x.time||'',title:x.title||'Rendez-vous'})),
  ...(db.notes||[]).filter(x=>onDateOrDue(x)&&active(x)).map(x=>({...x,date:d,start:x.time||'',source:'note',title:`Note · ${x.title||'À traiter'}`})),
  ...(db.maintenance||[]).filter(x=>onDateOrDue(x)&&active(x)).map(x=>({...x,date:d,start:x.time||'',source:'maintenance',title:`Maintenance · ${x.title||'Intervention'}`})),
  ...(db.requests||[]).filter(x=>onDateOrDue(x)&&active(x)).map(x=>({...x,date:d,start:x.time||'',source:'request',title:`Direction · ${x.title||x.description||'Demande'}`})),
  ...(db.works||[]).filter(x=>onDateOrDue(x)&&active(x)).map(x=>({...x,date:d,start:x.time||'',source:'work',title:`Chantier/GPA · ${x.title||'Action'}`})),
  ...(db.issues||[]).filter(x=>onDateOrDue(x)&&active(x)).map(x=>({...x,date:d,start:x.time||'',source:'issue',title:`${normalizeText(x.priority)==='urgente'?'⚠️ ':''}Sécurité/qualité · ${x.title||x.description||'Action'}`})),
  ...(db.cleaning||[]).filter(x=>sameDay(x.date)).map(x=>({...x,date:d,start:x.time||'',source:'cleaning',title:`Contrôle ménage · ${x.room||x.roomType||'Zone'}`})),
  ...(db.periodic||[]).filter(x=>sameDay(periodicDue(x))&&!isClosedStatus(x.status)).map(x=>({...x,date:d,start:x.time||'',source:'periodic',title:`Contrôle périodique · ${x.name||x.title||x.family||'Contrôle'}`})),
  ...roomPrepAgendaItems().filter(x=>sameDay(x.date)&&normalizeText(x.status)!=='termine').map(x=>({...x,start:x.time||x.coffee?.time||'',source:'roomprep',title:`Préparation salle${x.coffee?.enabled?' + café':''} · ${x.room||'Salle'}`})),
  ...(db.vacations||[]).filter(x=>sameDay(x.start)&&normalizeText(x.status)!=='cloturee').map(x=>({...x,date:d,start:'',source:'vacation',title:`Vacances / fermeture · ${x.name||'Période'}`}))
 ];
 const waste=wasteAgendaItemForDate(d);if(waste)rows.push(waste);
 return rows.sort((x,y)=>`${x.start||'99:99'}${x.title||''}`.localeCompare(`${y.start||'99:99'}${y.title||''}`));
}
function agendaPlace(e){
 if(e.location)return e.location;
 const parts=[e.room,e.sector,e.floor,e.building].filter(Boolean);
 return [...new Set(parts)].join(' · ');
}
function agendaTime(e){return e.start||e.time||e.deadlineTime||''}
function agendaMeta(e){
 const parts=[];const place=agendaPlace(e);
 if(place)parts.push(`📍 ${place}`);
 if(e.meta)parts.push(e.meta);
 return parts.join(' · ');
}
function personalEventButton(e){
 const tm=agendaTime(e),meta=agendaMeta(e);
 return `<button class="mini-event agenda-action ${esc(e.source||'personal')}" data-agenda-source="${esc(e.source||'personal')}" data-agenda-id="${esc(e.id||'')}"><b>${tm?`🕒 ${esc(tm)}`:'🕒 —'}</b><span>${esc(e.title||'Événement')}</span>${meta?`<small>${esc(meta)}</small>`:''}</button>`;
}
function renderDashboardTodayAgenda(){
 const el=$('#dashboardTodayAgenda');if(!el)return;
 const rows=eventsForDate(todayISO());
 el.innerHTML=rows.length?rows.map(e=>{const tm=agendaTime(e),place=agendaPlace(e);return `<button class="today-agenda-row agenda-action ${esc(e.source||'personal')}" data-agenda-source="${esc(e.source||'personal')}" data-agenda-id="${esc(e.id||'')}"><span class="today-agenda-time">${esc(tm||'—')}</span><span class="today-agenda-main"><strong>${esc(e.title||'Événement')}</strong><small>${place?`📍 ${esc(place)}`:'📍 Lieu non renseigné'}</small></span><span class="today-agenda-arrow">›</span></button>`}).join(''):'<div class="empty">Aucun événement prévu aujourd’hui.</div>';
}
function renderPersonalCalendar(){
 const days=Array.from({length:7},(_,i)=>addDays(personalWeek,i));
 $('#personalWeekLabel').textContent=`${fmtDate(days[0])} au ${fmtDate(days[6])}`;
 $('#personalWeekCalendar').innerHTML=days.map(d=>`<div class="personal-day ${d===todayISO()?'today':''}"><button class="personal-day-head" data-new-personal-date="${d}"><strong>${parseDate(d).toLocaleDateString('fr-FR',{weekday:'long'})}</strong><span>${parseDate(d).getDate()}</span></button><div>${cardList(eventsForDate(d).map(personalEventButton),'Libre')}</div></div>`).join('');
}
window.PSTRefreshPersonalAgenda=()=>{try{renderPersonalCalendar()}catch(e){console.warn('Actualisation agenda',e)}};
function calendarDayVisual(info){
 const raw=info.dayType||'Présence',day=normalizeText(raw),shift=normalizeText(info.shift||'Standard'),disp=db.settings?.chronoDayDisplay?.[raw]||{};
 let v;
 if(/maladie/.test(day))v={cls:'sick',code:'MAL',label:'Maladie'};
 else if(/rtt/.test(day))v={cls:'rtt',code:'RTT',label:'RTT'};
 else if(/congé|conge/.test(day))v={cls:'leave',code:'CA',label:'Congé annuel'};
 else if(/férié|ferie|rfe/.test(day))v={cls:'holiday',code:'RFE',label:'Jour férié'};
 else if(/repos/.test(day))v={cls:'off',code:'RH',label:'Repos'};
 else if(/absence temps partiel/.test(day))v={cls:'other',code:'RTP',label:'Absence temps partiel'};
 else if(day!=='presence')v={cls:'other',code:day==='formation'?'F':'ABS',label:raw||'Absence'};
 else if(shift==='matin')v={cls:'morning',code:'M',label:'Matin'};
 else if(shift==='soir')v={cls:'evening',code:'S',label:'Soir'};
 else v={cls:'standard',code:'ST',label:'Standard'};
 if(day!=='presence'&&disp.abbr)v.code=(raw==='Absence temps partiel'&&disp.abbr==='ATP')?'RTP':disp.abbr;
 if(day!=='presence'&&disp.color)v.color=disp.color;
 return v;
}
function renderAbsenceBoard(){const month=$('#absenceMonth').value||monthISO(),[y,m]=month.split('-').map(Number),count=new Date(y,m,0).getDate(),agents=db.agents.filter(a=>a.status==='Actif'),gridWidth=150+(count*42);let html=`<div class="month-grid" style="grid-template-columns:150px repeat(${count},42px);min-width:${gridWidth}px"><div class="month-corner">Agent</div>`+Array.from({length:count},(_,i)=>{const d=`${month}-${pad(i+1)}`;return `<div class="month-day-head ${[0,6].includes(parseDate(d).getDay())?'weekend':''}">${i+1}</div>`}).join('');for(const a of agents){html+=`<div class="month-agent">${esc(agentName(a))}</div>`;for(let i=1;i<=count;i++){const d=`${month}-${pad(i)}`,info=dayInfo(a.id,d),v=calendarDayVisual(info),hours=info.plannedStart&&info.plannedEnd?` ${info.plannedStart}–${info.plannedEnd}`:'';html+=`<button class="month-cell day-state ${v.cls}" ${v.color?`style="background:${esc(v.color)}!important"`:``} data-agent-day="${a.id}" data-date="${d}" data-day-type="${esc(info.dayType||'Présence')}" title="${fmtDate(d)} — ${esc(v.label)}${esc(hours)}"><span>${v.code}</span></button>`}}html+='</div>';$('#absenceMonthBoard').innerHTML=html}

/* ---------- Rendu : modules ---------- */
function renderAgents(){const q=($('#agentSearch').value||'').toLowerCase(),status=$('#agentStatus').value;const arr=db.agents.filter(a=>(!status||a.status===status)&&(!q||agentName(a).toLowerCase().includes(q)||String(a.assignment).toLowerCase().includes(q)));$('#agentCards').innerHTML=cardList(arr.map(a=>{const state=agentState(a),month=$('#planningMonth').value||monthISO(),rows=db.agentDays.filter(x=>x.agentId===a.id&&dateMonthMatch(x.date,month)),absence=rows.filter(x=>isAbsenceType(x.dayType)).length,ot=rows.reduce((s,x)=>s+Number(x.overtime||0),0);return `<article class="agent-card"><div class="agent-avatar">${esc((a.firstName||'?')[0])}</div><div class="agent-main"><div class="panel-head"><h3>${esc(agentName(a))}</h3>${badge(a.status)}</div><p>${esc(a.role)} · ${esc(a.assignment||'Sans affectation')}</p><div class="agent-stats"><span>${badge(state.label)}</span><span>${esc(a.weeklyHours)} h/semaine</span>${(()=>{const p=permanenceScheduleForAgent(a.id);return p.start&&p.end?`<span class="perm-summary">🟠 Permanence ${esc(p.start)}–${esc(p.end)}</span>`:''})()}${(()=>{if(activeRotation(a.id,todayISO()))return '';const s=standardScheduleForAgent(a.id,todayISO());return s.start&&s.end?`<span class="std-summary">🔵 Standard ${esc(s.start)}–${esc(s.end)}</span>`:''})()}<span>${absence} absence(s) ce mois</span><span>${ot>=0?'+':''}${ot} h supp.</span></div><div class="card-actions"><button type="button" data-edit-type="agent" data-edit-id="${a.id}">Modifier</button><button data-new-weekly-agent="${a.id}">Horaires annuels</button><button data-permanence-agent="${a.id}" class="permanence-button">Permanence</button><button data-new-rotation-agent="${a.id}">Roulement</button><button data-agent-day="${a.id}" data-date="${todayISO()}">Signaler un écart</button></div></div></article>`}),'Aucun agent trouvé.')}
function rotationPilotageSummary(agentId,shift,r){
 const labels=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'],days=(r.weekdays||[1,2,3,4,5]).map(Number),rows=[];
 for(const wd of days){const p=exactWeeklyProfile(agentId,shift,wd,r.effectiveFrom);if(p?.start&&p?.end)rows.push({wd,start:p.start,end:p.end})}
 if(!rows.length)return '<span class="schedule-missing">À définir dans Pilotage des horaires</span>';
 const unique=[...new Set(rows.map(x=>`${x.start}–${x.end}`))];
 if(unique.length===1)return `<strong class="schedule-source ${shift==='Matin'?'morning':'evening'}">${esc(unique[0])}</strong>`;
 return `<div class="rotation-hours-detail">${rows.map(x=>`<small><b>${labels[x.wd]}</b> ${esc(x.start)}–${esc(x.end)}</small>`).join('')}</div>`;
}
function dashboardAcademicStartYear(){
  const academic=(typeof activeAcademicYear==='function'
    ? activeAcademicYear()
    : (db.settings?.academicYear||academicYearFor(todayISO())||''));
  const y=Number(String(academic||'').split('-')[0]);
  return Number.isFinite(y)&&y>2000?y:new Date().getFullYear();
}
function syncRotationYearWithDashboard(){
  const el=$('#rotationYear');
  if(el)el.value=String(dashboardAcademicStartYear());
}

function renderRotations(){syncRotationYearWithDashboard();const agent=$('#rotationAgent').value;const arr=db.rotations.filter(r=>!agent||r.agentId===agent).sort((a,b)=>a.agentId.localeCompare(b.agentId)||b.effectiveFrom.localeCompare(a.effectiveFrom));$('#rotationsTable').innerHTML=arr.length?arr.map(r=>`<tr><td>${esc(agentName(agentById(r.agentId)))}</td><td>${fmtDate(r.effectiveFrom)}</td><td>${r.morningWeeks} sem. matin / ${r.eveningWeeks} sem. soir</td><td>${rotationPilotageSummary(r.agentId,'Matin',r)}</td><td>${rotationPilotageSummary(r.agentId,'Soir',r)}</td><td>${(r.weekdays||[]).map(d=>['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d]).join(', ')}</td><td>${fmtDate(r.effectiveTo)||'En cours'}</td><td>${editButton('rotation',r.id)}</td></tr>`).join(''):emptyRow(8);renderRotationPreview()}
function latestChronotimeAcademicStartYear(){
 const rows=[...(db.chronotimeAnnual||[])].filter(x=>/^\d{4}-\d{4}$/.test(String(x.academicYear||'')));
 rows.sort((x,y)=>String(y.importedAt||y.date||'').localeCompare(String(x.importedAt||x.date||'')));
 const raw=rows[0]?.academicYear||'';
 const y=Number(String(raw).split('-')[0]);
 return Number.isFinite(y)&&y>2000?y:null;
}
function renderRotationPreview(){syncRotationYearWithDashboard();const startYear=dashboardAcademicStartYear(),month=$('#rotationMonth').value,agentId=$('#rotationAgent').value||db.agents.find(a=>a.status==='Actif')?.id;if(!agentId){$('#rotationPreview').innerHTML='<p>Aucun agent.</p>';return}const months=month?[Number(month)]:[9,10,11,12,1,2,3,4,5,6,7,8];const academicLabel=`${startYear}–${startYear+1}`;$('#rotationPreview').innerHTML=`<div class="rotation-schoolyear-title"><h4>${esc(agentName(agentById(agentId)))} — année scolaire ${academicLabel}</h4><small>1er septembre ${startYear} → 31 août ${startYear+1}</small></div>`+months.map(m=>{const y=m>=9?startYear:startYear+1,first=`${y}-${pad(m)}-01`,last=new Date(y,m,0).getDate();return `<div class="rotation-month"><strong>${parseDate(first).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</strong><div>${Array.from({length:last},(_,i)=>{const d=`${y}-${pad(m)}-${pad(i+1)}`,info=dayInfo(agentId,d),shift=normalizeText(info.shift||'standard'),day=String(info.dayType||'Présence'),cls=/maladie/i.test(day)?'sick':/congé|conge/i.test(day)?'leave':/rtt/i.test(day)?'rtt':/férié|ferie|rfe/i.test(day)?'holiday':day!=='Présence'?'off':shift==='matin'?'morning':shift==='soir'?'evening':'standard',label=day!=='Présence'?day:(info.shift||'Standard');return `<button class="rotation-day ${cls}" data-agent-day="${agentId}" data-date="${d}" title="${fmtDate(d)} — ${label}${info.plannedStart&&info.plannedEnd?` ${info.plannedStart}–${info.plannedEnd}`:''}"><span>${i+1}</span><small>${cls==='morning'?'M':cls==='evening'?'S':cls==='standard'?'STD':cls==='leave'?'CA':cls==='rtt'?'RTT':cls==='sick'?'MAL':cls==='holiday'?'JF':'—'}</small></button>`}).join('')}</div></div>`}).join('')}

function renderWeeklyPlans(){const box=$('#weeklyPlansBoard');if(!box)return;normalizeWeeklyPlans();const days=['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];box.innerHTML=(db.weeklyPlans||[]).map((p,pi)=>`<article class="weekly-plan-card"><div class="panel-head"><div><h4>${esc(agentName(agentById(p.agentId))||p.agent||'Planning')}</h4>${badge(p.shift||'Standard')}<small>${fmtDate(p.effectiveFrom)} → ${fmtDate(p.effectiveTo)}</small></div><button class="ghost small" data-edit-weekly-plan="${pi}">Modifier</button></div><div class="weekly-day-grid">${days.map((d,i)=>{const x=p.dayProfiles?.[i+1]||{};return `<button class="weekly-day" data-edit-weekly-plan="${pi}"><strong>${d}</strong><span>${x.start&&x.end?`${x.start}–${x.end}`:'Non travaillé'}</span><small>${esc(x.missions||'')}</small></button>`}).join('')}</div></article>`).join('')||'<div class="empty">Aucun horaire de référence. Ajoutez un agent ou un planning.</div>'}
function openWeeklyPlan(i=null,agentId=''){
 normalizeWeeklyPlans();
 const old=i!==null?db.weeklyPlans[i]:null;
 const p=old||{id:uid(),agentId:agentId||db.agents[0]?.id,agent:agentName(agentById(agentId||db.agents[0]?.id)),shift:'Standard',effectiveFrom:'2026-09-01',effectiveTo:'2027-08-31',dayProfiles:{}};
 const days=[['Lundi',1],['Mardi',2],['Mercredi',3],['Jeudi',4],['Vendredi',5],['Samedi',6],['Dimanche',0]];
 openModal(old?'Modifier les horaires théoriques':'Nouveaux horaires théoriques',`<div class="notice"><strong>Base annuelle théorique :</strong> choisissez la période scolaire (par défaut du 01/09/2026 au 31/08/2027), puis les horaires de chaque jour. Les jours non travaillés peuvent rester vides. Le tableau de bord affichera automatiquement Repos.</div><div class="form-grid"><label>Agent<select name="agentId" required>${agentOptions(p.agentId)}</select></label><label>Profil<select name="shift">${selectOptions(['Standard','Matin','Soir'],p.shift||'Standard')}</select></label>${field('Valable du','effectiveFrom',p.effectiveFrom||'2026-09-01','date','required')}${field('Valable au','effectiveTo',p.effectiveTo||'2027-08-31','date','required')}</div><div class="day-profile-editor">${days.map(([label,key])=>{const x=p.dayProfiles?.[key]||{};return `<fieldset><legend>${label}</legend><div class="form-grid"><label>Début<input type="time" name="start_${key}" value="${esc(x.start||'')}"></label><label>Fin<input type="time" name="end_${key}" value="${esc(x.end||'')}"></label><label>Pause (min)<input type="number" min="0" step="5" name="pause_${key}" value="${esc(x.pause||0)}"></label><label class="span2">Missions principales<input name="missions_${key}" value="${esc(x.missions||'')}"></label></div></fieldset>`}).join('')}</div>`,async form=>{
   const o=formDataObj(form);if(!o.agentId){toast('Choisissez un agent');return}if(!o.effectiveFrom||!o.effectiveTo){toast('Renseignez la période de validité');return}if(o.effectiveTo<o.effectiveFrom){toast('La date de fin doit être après la date de début');return}
   p.agentId=o.agentId;p.agent=agentName(agentById(o.agentId));p.shift=o.shift;p.effectiveFrom=o.effectiveFrom;p.effectiveTo=o.effectiveTo;p.dayProfiles={};
   for(const [label,key] of days){const st=o[`start_${key}`]||'',en=o[`end_${key}`]||'';if((st&&!en)||(!st&&en)){toast(`${label} : renseignez le début et la fin, ou laissez les deux vides`);return}p.dayProfiles[key]={start:st,end:en,pause:Number(o[`pause_${key}`]||0),missions:o[`missions_${key}`]||'',segments:[]}}
   p.rows=[];
   if(!old){
     if(p.shift==='Standard'){
       const prev=(db.weeklyPlans||[]).filter(q=>String(q.agentId)===String(o.agentId)&&q.shift==='Standard'&&(q.effectiveFrom||'')<p.effectiveFrom).sort((x,y)=>(y.effectiveFrom||'').localeCompare(x.effectiveFrom||''))[0];
       if(prev&&(!prev.effectiveTo||prev.effectiveTo>=p.effectiveFrom))prev.effectiveTo=addDays(p.effectiveFrom,-1);
       const next=(db.weeklyPlans||[]).filter(q=>String(q.agentId)===String(o.agentId)&&q.shift==='Standard'&&(q.effectiveFrom||'')>p.effectiveFrom).sort((x,y)=>(x.effectiveFrom||'').localeCompare(y.effectiveFrom||''))[0];
       if(next&&p.effectiveTo>=next.effectiveFrom)p.effectiveTo=addDays(next.effectiveFrom,-1);
     }
     db.weeklyPlans.push(p);
   }
   const ag=agentById(o.agentId);
   if(ag){
     const working=new Set();
     for(const plan of (db.weeklyPlans||[]).filter(q=>String(q.agentId)===String(o.agentId))){
       for(const [,key] of days)if(plan.dayProfiles?.[key]?.start&&plan.dayProfiles?.[key]?.end)working.add(key);
     }
     ag.workdays=working.size?[...working]:[1,2,3,4,5];
     if(p.shift==='Standard'){
       const first=days.map(([,key])=>p.dayProfiles?.[key]).find(x=>x?.start&&x?.end)||{};
       ag.standardSchedule={start:first.start||'',end:first.end||'',pause:Number(first.pause||0),missions:first.missions||'',effectiveFrom:p.effectiveFrom};
       ag.standardStart=first.start||'';ag.standardEnd=first.end||'';ag.standardPause=Number(first.pause||0);ag.standardMissions=first.missions||'';
     }
   }
   const persisted=await commitFormRecordVerified('Horaires théoriques','weeklyPlans',p);if(!persisted.ok)return;
   closeModal();toast('✅ Horaires théoriques enregistrés, confirmés et appliqués partout');
 },{onDelete:old?()=>{if(confirm('Supprimer ce profil horaire ?')){db.weeklyPlans.splice(i,1);closeModal();save()}}:null});
}
function renderPlanning(){renderWeeklyPlans();const month=$('#planningMonth').value||monthISO(),agent=$('#planningAgent').value,signal=$('#planningSignal').value;const start=`${month}-01`,end=localISO(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0));const rows=[];for(const a of db.agents.filter(x=>x.status==='Actif'&&(!agent||x.id===agent))){let d=start;while(d<=end){if(![0,6].includes(parseDate(d).getDay())){const info=dayInfo(a.id,d),h=dayHours(info);let sig=isAbsenceType(info.dayType)?'Absence':h.delta>0.01?'Heures supplémentaires':h.delta<-0.01?'Heures manquantes':'Conforme';if(!signal||sig===signal)rows.push({a,d,info,h,sig})}d=addDays(d,1)}}const sums=rows.reduce((s,r)=>{s.p+=r.h.planned;s.a+=r.h.total;s.o+=Number(r.info.overtime||0);return s},{p:0,a:0,o:0});$('#planningSummary').innerHTML=`<article><span>Prévu</span><strong>${fmtHours(sums.p)}</strong></article><article><span>Réalisé</span><strong>${fmtHours(sums.a)}</strong></article><article><span>Écart</span><strong>${sums.a-sums.p>=0?'+':''}${fmtHours(sums.a-sums.p)}</strong></article><article><span>Heures ajoutées</span><strong>${fmtHours(sums.o)}</strong></article>`;$('#planningTable').innerHTML=rows.length?rows.map(r=>`<tr><td>${fmtDate(r.d)}</td><td>${esc(agentName(r.a))}</td><td>${r.info.dayType==='Présence'?`${r.info.plannedStart||'—'}–${r.info.plannedEnd||'—'} (${fmtHours(r.h.planned)})`:badge(r.info.dayType)}</td><td>${r.info.actualStart?`${r.info.actualStart}–${r.info.actualEnd} (${fmtHours(r.h.total)})`:'—'}</td><td>${r.h.delta>=0?'+':''}${fmtHours(r.h.delta)}</td><td>${badge(r.sig)}</td><td><button class="icon-btn" data-agent-day="${r.a.id}" data-date="${r.d}">✎</button></td></tr>`).join(''):emptyRow(7)}
function renderAbsences(){renderAbsenceBoard();const month=$('#absenceMonth').value||monthISO(),agent=$('#absenceAgent').value,type=$('#absenceType').value,status=$('#absenceStatus').value;const rows=db.agentDays.filter(x=>dateMonthMatch(x.date,month)&&isAbsenceType(x.dayType)&&(!agent||x.agentId===agent)&&(!type||x.dayType===type)&&(!status||x.status===status));const groups=new Map();for(const x of rows){const key=x.periodId||x.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x)}const arr=[...groups.values()].map(g=>g.sort((a,b)=>a.date.localeCompare(b.date))).sort((a,b)=>a[0].date.localeCompare(b[0].date));$('#absencesTable').innerHTML=arr.length?arr.map(g=>{const x=g[0],from=g[0].date,to=g.at(-1).date;return `<tr><td>${esc(agentName(agentById(x.agentId)))}</td><td>${fmtDate(from)}</td><td>${fmtDate(to)}</td><td>${badge(x.dayType)}</td><td>${g.length} jour${g.length>1?'s':''}</td><td>${badge(x.status||'Validée')}</td><td>${x.noReplacementNeeded?'<span class="badge good">Sans remplacement</span>':esc(x.replacement||'À décider')}</td><td><button class="icon-btn" data-agent-day="${x.agentId}" data-date="${from}">✎</button></td></tr>`}).join(''):emptyRow(8);renderAbsenceCounters(month)}
function renderAbsenceCounters(month){const agents=db.agents.filter(a=>a.status==='Actif');const types=db.lists.dayTypes.filter(isAbsenceType);const used=types.filter(t=>db.agentDays.some(x=>dateMonthMatch(x.date,month)&&x.dayType===t));const cols=used.length?used:types.slice(0,5);const head=`<table><thead><tr><th>Agent</th>${cols.map(t=>`<th>${esc(t)}</th>`).join('')}<th>Total</th></tr></thead><tbody>`;const body=agents.map(a=>{const rs=db.agentDays.filter(x=>x.agentId===a.id&&dateMonthMatch(x.date,month)&&isAbsenceType(x.dayType));return `<tr><td><strong>${esc(agentName(a))}</strong></td>${cols.map(t=>`<td>${rs.filter(x=>x.dayType===t).length}</td>`).join('')}<td><strong>${rs.length}</strong></td></tr>`}).join('');$('#absenceCounters').innerHTML=head+body+'</tbody></table>'}
function renderVacations(){
 const zone=$('#vacationZone').value,status=$('#vacationStatus').value,year=activeAcademicYear(),range=academicYearRange(year);
 const arr=db.vacations.filter(x=>
   (!zone||x.zone===zone||x.zone==='Toutes')&&
   (!status||x.status===status)&&
   (!x.start||!x.end||(x.end>=range.start&&x.start<=range.end))
 ).sort((a,b)=>a.start.localeCompare(b.start));$('#vacationCards').innerHTML=cardList(arr.map(x=>{const done=(x.tasks||[]).filter(t=>t.done).length,total=(x.tasks||[]).length,pct=total?Math.round(done/total*100):0;return `<article class="vacation-card"><div class="panel-head"><div><h3>${esc(x.name)}</h3><p>${fmtDate(x.start)} → ${fmtDate(x.end)} · Zone ${esc(x.zone)}</p></div>${badge(x.status)}</div><div class="progress"><span style="width:${pct}%"></span></div><p>${done}/${total} actions terminées (${pct} %)</p><ul>${(x.tasks||[]).slice(0,6).map(t=>`<li class="${t.done?'done':''}">${t.done?'✓':'○'} ${esc(t.text)}</li>`).join('')}</ul><div class="card-actions"><button type="button" data-edit-type="vacation" data-edit-id="${x.id}">Ouvrir la checklist</button></div></article>`}),'Aucune période chargée.')}
function renderIssues(){const m=$('#issueMonth').value,agent=$('#issueAgent').value,cat=$('#issueCategory').value,status=$('#issueStatus').value;let arr=db.issues.filter(x=>dateMonthMatch(x.date,m)&&(!agent||x.agentId===agent)&&(!cat||x.category===cat)&&(!status||x.status===status)).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));if(window.__dashboardUrgentOnly)arr=arr.filter(x=>!isClosedStatus(x.status)&&isUrgentPriority(x.priority));$('#issuesTable').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${esc(x.category)}</td><td>${esc(agentName(agentById(x.agentId)))}</td><td>${badge(x.priority)}</td><td><strong>${esc(x.title)}</strong>${x.sourceNonconformityId?`<small>📋 Plan d’action issu d’un rapport de contrôle${x.sourceReportDate?` · rapport du ${fmtDate(x.sourceReportDate)}`:''}</small>`:''}<small>${esc(x.description||'')}</small></td><td>${esc(x.action||'—')}</td><td>${fmtDate(x.dueDate)||'—'}</td><td>${badge(x.status)}</td><td>${editButton('issue',x.id)}</td></tr>`).join(''):emptyRow(9)}
function renderPeriodic(){const fam=$('#periodicFamily').value,status=$('#periodicStatus').value,bld=$('#periodicBuilding').value;const arr=db.periodic.filter(x=>(!fam||x.family===fam)&&(!status||periodicComputed(x)===status||x.status===status)&&(!bld||x.building===bld||x.building==='Tous bâtiments')).sort((a,b)=>(periodicDue(a)||'9999').localeCompare(periodicDue(b)||'9999'));$('#periodicCards').innerHTML=cardList(arr.map(x=>{const state=periodicComputed(x),ncs=(db.reportNonconformities||[]).filter(n=>String(n.periodicControlId||'')===String(x.id));const open=ncs.filter(n=>!['FAIT','Levée'].includes(n.status)),done=ncs.filter(n=>['FAIT','Levée'].includes(n.status)),plans=(db.issues||[]).filter(i=>ncs.some(n=>String(n.id)===String(i.sourceNonconformityId||''))),openPlans=plans.filter(i=>!isClosedStatus(i.status));const nc=ncs.length?`<section class="periodic-nc-block ${open.length?'has-open':'all-done'}"><div class="periodic-nc-summary"><strong>${open.length?'🔴 CONTRÔLE NON CONFORME':'🟢 OBSERVATIONS LEVÉES'}</strong><span>${ncs.length} observations · 🔴 ${open.length} à traiter · 🟢 ${done.length} FAIT/levées · 📋 ${openPlans.length} plan(s) d’action ouvert(s)</span></div>${open.length?`<h4>Non-conformités à traiter</h4>${open.map(n=>`<article class="periodic-nc-item"><div><strong>Observation ${esc(n.observationNo||'—')}</strong>${n.location?`<small>${esc(n.location)}</small>`:''}<p>${esc(n.text||'')}</p>${n.action?`<p><b>Préconisation :</b> ${esc(n.action)}</p>`:''}</div><select data-nc-status="${esc(n.id)}"><option selected>À traiter</option><option>FAIT</option><option>Levée</option></select></article>`).join('')}`:''}${done.length?`<details><summary>🟢 ${done.length} FAIT / levées</summary>${done.map(n=>`<article class="periodic-nc-item"><div><strong>Observation ${esc(n.observationNo||'—')} — ${esc(n.status)}</strong>${n.location?`<small>${esc(n.location)}</small>`:''}<p>${esc(n.text||'')}</p></div><select data-nc-status="${esc(n.id)}"><option>À traiter</option><option ${n.status==='FAIT'?'selected':''}>FAIT</option><option ${n.status==='Levée'?'selected':''}>Levée</option></select></article>`).join('')}</details>`:''}</section>`:'';return `<article class="periodic-card ${state==='En retard'?'late':''}"><div class="panel-head"><span>${esc(x.no)}</span>${badge(state)}</div><h3>${esc(x.name)}</h3><p>${esc(x.family)} · ${esc(x.building)}</p>${x.periodicityText?`<p class="muted"><strong>Périodicité :</strong> ${esc(x.periodicityText)}</p>`:''}<dl><dt>Dernier</dt><dd>${fmtDate(x.lastDate)||'Non renseigné'}</dd><dt>Échéance</dt><dd>${fmtDate(periodicDue(x))||'À définir'}</dd><dt>Responsable</dt><dd>${esc(x.provider||'À définir')}</dd></dl>${nc}${attachmentButtons(x.attachments)}${oneDriveLinkButtons('periodic',x.id)}<button type="button" class="ghost" data-edit-type="periodic" data-edit-id="${x.id}">✎ Ouvrir / modifier le contrôle</button></article>`}),'Aucun contrôle trouvé.');}
function renderCleaningGuide(){const type=$('#cleaningGuideType').value||db.lists.roomTypes.find(x=>GUIDE[x])||Object.keys(GUIDE)[0];$('#cleaningGuideType').value=type;const rows=GUIDE[type]||[];$('#cleaningGuideTable').innerHTML=`<table><thead><tr><th>Opération</th><th>Fréquence préconisée</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`}
function renderCleaning(){const month=$('#cleanMonth').value,bld=$('#cleanBuilding').value,type=$('#cleanRoomType').value,status=$('#cleanStatus').value;const arr=db.cleaning.filter(x=>dateMonthMatch(x.date,month)&&(!bld||x.building===bld)&&(!type||x.roomType===type)&&(!status||x.overallStatus===status)).sort((a,b)=>b.date.localeCompare(a.date));const all=arr.length,ok=arr.filter(x=>x.overallStatus==='Conforme').length,weak=arr.reduce((s,x)=>s+(x.tasks||[]).filter(t=>['À reprendre','Non conforme'].includes(t.status)).length,0),avg=all?Math.round(arr.reduce((s,x)=>s+Number(x.score||0),0)/all):0;$('#cleaningSummary').innerHTML=`<article><span>Contrôles</span><strong>${all}</strong></article><article><span>Conformes</span><strong>${ok}</strong></article><article><span>Score moyen</span><strong>${avg||'—'}${all?' %':''}</strong></article><article><span>Points faibles</span><strong>${weak}</strong></article>`;$('#cleaningTable').innerHTML=arr.length?arr.map(x=>{const weakTasks=(x.tasks||[]).filter(t=>['À reprendre','Non conforme'].includes(t.status));return `<tr><td>${fmtDate(x.date)} ${esc(x.time||'')}</td><td>${esc([x.building,x.floor,x.room].filter(Boolean).join(' · '))}</td><td>${esc(x.roomType)}</td><td>${esc(agentName(agentById(x.agentId)))}</td><td>${x.score||0} %</td><td>${badge(x.overallStatus)}</td><td>${esc(weakTasks.slice(0,3).map(t=>t.name).join(', ')||'—')}</td><td>${editButton('cleaning',x.id)}</td></tr>`}).join(''):emptyRow(8);renderCleaningGuide()}
function renderMaintenance(){const st=$('#maintenanceStatus').value,p=$('#maintenancePriority').value,f=$('#maintenanceFamily').value;const arr=db.maintenance.filter(x=>(!st||x.status===st)&&(!p||x.priority===p)&&(!f||x.family===f)).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));$('#maintenanceTable').innerHTML=arr.length?arr.map(x=>`<tr><td>${esc(x.no)}</td><td>${fmtDate(x.date)}</td><td>${esc([x.building,x.floor,x.room].filter(Boolean).join(' · '))}</td><td>${esc(x.family)}</td><td><strong>${esc(x.title)}</strong>${x.sourceNonconformityId?`<small>📋 Plan d’action issu d’un rapport de contrôle${x.sourceReportDate?` · rapport du ${fmtDate(x.sourceReportDate)}`:''}</small>`:''}<small>${esc(x.description||'')}</small></td><td>${badge(x.priority)}</td><td>${esc(x.assigned||'—')}</td><td>${fmtDate(x.dueDate)||'—'}</td><td>${badge(x.status)}</td><td>${editButton('maintenance',x.id)}</td></tr>`).join(''):emptyRow(10)}
function renderRequests(){const st=$('#requestStatus').value,t=$('#requestType').value;const arr=db.requests.filter(x=>(!st||x.status===st)&&(!t||x.type===t)).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));$('#requestsTable').innerHTML=arr.length?arr.map(x=>`<tr><td>${esc(x.no)}</td><td>${fmtDate(x.date)}</td><td>${esc(x.requester)}</td><td>${esc(x.type)}</td><td>${esc([x.building,x.room].filter(Boolean).join(' · '))}</td><td>${fmtDate(x.dueDate)||'—'}</td><td>${badge(x.priority)}</td><td>${badge(x.status)}</td><td>${editButton('request',x.id)}</td></tr>`).join(''):emptyRow(9)}
function renderWorks(){const st=$('#workStatus').value,t=$('#workType').value;const arr=db.works.filter(x=>(!st||x.status===st)&&(!t||x.type===t)).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));$('#worksTable').innerHTML=arr.length?arr.map(x=>`<tr><td>${esc(x.no)}</td><td>${esc(x.type)}</td><td><strong>${esc(x.title)}</strong>${x.sourceNonconformityId?`<small>📋 Plan d’action issu d’un rapport de contrôle${x.sourceReportDate?` · rapport du ${fmtDate(x.sourceReportDate)}`:''}</small>`:''}<small>${esc(x.description||'')}</small></td><td>${esc(x.building)}</td><td>${esc(x.company||'—')}</td><td>${fmtDate(x.dueDate)||'—'}</td><td>${badge(x.priority)}</td><td>${badge(x.status)}</td><td>${editButton('work',x.id)}</td></tr>`).join(''):emptyRow(9)}
function renderMeetings(){const m=$('#meetingMonth').value,t=$('#meetingType').value;const arr=db.meetings.filter(x=>dateMonthMatch(x.date,m)&&(!t||x.type===t)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));$('#meetingsTable').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${esc(x.time||'—')}</td><td>${esc(x.type)}</td><td>${esc(x.title)}</td><td>${esc(x.location||'—')}</td><td>${esc(x.participants||'—')}</td><td>${badge(x.status)}</td><td>${editButton('meeting',x.id)}</td></tr>`).join(''):emptyRow(8)}
function renderPersonal(){const m=$('#personalMonth').value,t=$('#personalType').value,s=$('#personalStatus').value;const arr=db.personalEvents.filter(x=>dateMonthMatch(x.date,m)&&(!t||x.type===t)&&(!s||x.status===s)).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));$('#personalTable').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${esc([x.start,x.end].filter(Boolean).join('–')||'—')}</td><td>${esc(x.type)}</td><td>${esc(x.title)}</td><td>${esc(x.location||'—')}</td><td>${badge(x.priority)}</td><td>${badge(x.status)}</td><td>${editButton('personal',x.id)}</td></tr>`).join(''):emptyRow(8);$('#personalCards').innerHTML=cardList(arr.map(x=>`<article class="list-card"><div><strong>${fmtDate(x.date)} ${esc(x.start||'')}</strong>${badge(x.status)}</div><h3>${esc(x.title)}</h3><p>${esc(x.type)} · ${esc(x.location||'Sans lieu')}</p><button type="button" data-edit-type="personal" data-edit-id="${x.id}">Modifier</button></article>`))}
function renderNotes(){const cat=$('#noteCategory').value,p=$('#notePriority').value,s=$('#noteStatus').value,q=($('#noteSearch').value||'').toLowerCase();const arr=db.notes.filter(x=>(!cat||x.category===cat)&&(!p||x.priority===p)&&(!s||x.status===s)&&(!q||`${x.title} ${x.text}`.toLowerCase().includes(q))).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));$('#notesBoard').innerHTML=cardList(arr.map(x=>{const done=(x.items||[]).filter(i=>i.done).length;return `<article class="note-card"><div class="panel-head"><span>${esc(x.category)}</span>${badge(x.priority)}</div><h3>${esc(x.title)}</h3><p>${esc(x.text||'')}</p>${x.agentId?`<p>👤 ${esc(agentName(agentById(x.agentId)))}</p>`:''}<p>Échéance : ${fmtDate(x.dueDate)||'—'} · ${done}/${(x.items||[]).length} items</p><ul>${(x.items||[]).map(i=>`<li class="${i.done?'done':''}">${i.done?'✓':'○'} ${esc(i.text)}</li>`).join('')}</ul>${attachmentButtons(x.attachments)}<div class="card-actions"><span>${badge(x.status)}</span><button type="button" class="note-edit-button" data-edit-type="note" data-edit-id="${x.id}" aria-label="Modifier la note ${esc(x.title)}">Modifier</button></div></article>`}),'Aucune note.')}
function renderDocuments(){const cat=$('#documentCategory').value,q=($('#documentSearch').value||'').toLowerCase();const arr=db.documents.filter(x=>(!cat||x.category===cat)&&(!q||`${x.title} ${x.description}`.toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));
 const guides=BUILTIN_GUIDES.filter(x=>(!cat||x.category===cat)&&(!q||x.title.toLowerCase().includes(q)));
 $('#documentCards').innerHTML=cardList([
   ...guides.map(g=>`<article class="document-card builtin"><div class="doc-icon">📘</div><h3>${esc(g.title)}</h3><p>Document officiel stocké dans Supabase Storage.</p><button data-guide-path="${esc(g.storagePath)}">Ouvrir le guide</button></article>`),
   ...arr.map(x=>`<article class="document-card"><div class="doc-icon">📄</div><h3>${esc(x.title)}</h3><p>${esc(x.category)} · ${fmtDate(x.date)}</p><p>${esc(x.description||'')}</p>${attachmentButtons(x.attachments)}${oneDriveLinkButtons('documents',x.id)}<button type="button" data-edit-type="document" data-edit-id="${x.id}">Modifier</button></article>`)
 ],'Aucun document trouvé.');}
function renderOutlook(){const email=db.settings.outlookEmail||'';const label=$('#outlookMailLabel');if(label)label.textContent=email?`Compte repère : ${email}`:'Adresse professionnelle non renseignée';}
/* ---------- Tableau de bord ---------- *//* ---------- Tableau de bord ---------- */
function itemCard(icon,title,meta,editType,id){return `<button type="button" class="preview-item" data-edit-type="${editType}" data-edit-id="${id}"><span>${icon}</span><div><strong>${esc(title)}</strong><small>${meta}</small></div><b>›</b></button>`}

function isoWeekKey(dateISO){const d=parseDate(dateISO);d.setHours(0,0,0,0);d.setDate(d.getDate()+3-(d.getDay()+6)%7);const y=d.getFullYear(),w=1+Math.round(((d-new Date(y,0,4))/86400000-3+(new Date(y,0,4).getDay()+6)%7)/7);return `${y}-S${String(w).padStart(2,'0')}`}
function academicYearFor(dateISO){const d=parseDate(dateISO),y=d.getFullYear();return d.getMonth()>=8?`${y}-${y+1}`:`${y-1}-${y}`}
function normalizeAcademicYear(value){
 const m=String(value||'').match(/(\d{4})\s*[-–]\s*(\d{4})/);if(!m)return '';
 const a=Number(m[1]),b=Number(m[2]);return b===a+1?`${a}-${b}`:'';
}
function activeAcademicYear(){return normalizeAcademicYear(db?.settings?.academicYear)||academicYearFor(todayISO())}
function academicYearStart(label){return Number((normalizeAcademicYear(label)||academicYearFor(todayISO())).slice(0,4))}
function academicYearRange(label){const y=academicYearStart(label);return {start:`${y}-09-01`,end:`${y+1}-08-31`,startYear:y,endYear:y+1}}
function shiftAcademicYear(label,delta){const y=academicYearStart(label)+Number(delta||0);return `${y}-${y+1}`}
function academicYearContains(label,dateISO){if(!dateISO)return false;const r=academicYearRange(label),d=normalizeDateValue(dateISO);return !!d&&d>=r.start&&d<=r.end}
window.PSTAcademicMismatch=null;
function setAcademicYearMismatch(year,source='Données'){const y=normalizeAcademicYear(year);window.PSTAcademicMismatch=y&&y!==activeAcademicYear()?{year:y,source}:null;renderGlobalAcademicYear()}
function clearAcademicYearMismatch(){window.PSTAcademicMismatch=null;renderGlobalAcademicYear()}
function buildAcademicYearOptions(select,centerLabel){if(!select)return;const center=academicYearStart(centerLabel);const previous=select.value;select.innerHTML='';for(let y=center-5;y<=center+5;y++){const label=`${y}-${y+1}`;select.insertAdjacentHTML('beforeend',`<option value="${label}">${label}</option>`)}select.value=normalizeAcademicYear(centerLabel)||previous||academicYearFor(todayISO())}
function syncAcademicYearFilters(label){
 const y=normalizeAcademicYear(label)||activeAcademicYear(),r=academicYearRange(y),fallbackMonth=`${r.startYear}-09`;
 const monthIds=['personalMonth','planningMonth','absenceMonth','issueMonth','cleanMonth','meetingMonth','monthlyDate','teamReportMonth','absenceReportMonth','cleaningReportMonth','maintenanceReportMonth'];
 for(const id of monthIds){
   const e=document.getElementById(id);
   if(e&&(!e.value||!academicYearContains(y,`${e.value}-01`)))e.value=fallbackMonth;
 }
 const dateIds=['dailyDate','weeklyDate','collectivePlanningDate','individualPlanningFrom','individualPlanningTo','teamDateJump'];
 for(const id of dateIds){
   const e=document.getElementById(id);
   if(e&&(!e.value||!academicYearContains(y,e.value)))e.value=r.start;
 }
 const ry=document.getElementById('rotationYear');if(ry){buildAcademicYearOptions(ry,y);ry.value=String(r.startYear)}
 const vy=document.getElementById('vacationYear');if(vy){buildAcademicYearOptions(vy,y);vy.value=y}
 const ay=document.getElementById('archiveYear');
 if(ay){
   const values=[...ay.options].map(o=>o.value);
   if(!values.includes(y))ay.insertAdjacentHTML('beforeend',`<option value="${y}">${y}</option>`);
   ay.value=y;
 }
 const pr=document.getElementById('periodicReportYear');if(pr)pr.value=String(r.startYear);
 const set=document.getElementById('academicYear');if(set)set.value=y;

 // Les calendriers hebdomadaires n'ont plus leur propre année cachée.
 if(typeof teamWeek!=='undefined'&&!academicYearContains(y,teamWeek))teamWeek=startOfWeek(r.start);
 if(typeof personalWeek!=='undefined'&&!academicYearContains(y,personalWeek))personalWeek=startOfWeek(r.start);
}
function setActiveAcademicYear(year,{render=true}={}){
 const y=normalizeAcademicYear(year);if(!y)return false;
 db.settings.academicYear=y;
 syncAcademicYearFilters(y);
 const mismatch=window.PSTAcademicMismatch;if(mismatch?.year===y)window.PSTAcademicMismatch=null;
 save(false);
 if(render)safeRenderAll();
 renderGlobalAcademicYear();
 try{window.dispatchEvent(new CustomEvent('pst:academic-year-changed',{detail:{year:y}}))}catch(_){}
 return true
}
function renderGlobalAcademicYear(){
 const y=activeAcademicYear(),sel=document.getElementById('globalAcademicYear');if(sel){buildAcademicYearOptions(sel,y);sel.value=y}
 const wrap=document.getElementById('globalAcademicYearWrap'),warn=document.getElementById('academicYearWarning'),m=window.PSTAcademicMismatch;
 const bad=!!(m&&m.year&&m.year!==y);if(wrap)wrap.classList.toggle('mismatch',bad);
 if(warn){warn.classList.toggle('hidden',!bad);warn.innerHTML=bad?`⚠ ${esc(m.source||'Données')} : année ${esc(m.year)} — sélection actuelle ${esc(y)} <button type="button" id="switchAcademicYearWarning">Basculer sur ${esc(m.year)}</button>`:'';const b=document.getElementById('switchAcademicYearWarning');if(b)b.onclick=()=>setActiveAcademicYear(m.year)}
}
function recordsInRange(arr,start,end,dateFields=['date']){return (arr||[]).filter(x=>dateFields.some(f=>x[f]&&x[f]>=start&&x[f]<=end)).map(clone)}
function createWeeklyArchive(force=false){const end=addDays(startOfWeek(todayISO()),-1),start=addDays(end,-6),key=isoWeekKey(start);if(!force&&db.archives.some(a=>a.kind==='weekly'&&a.key===key))return false;const absent=recordsInRange(db.agentDays,start,end).filter(x=>isAbsenceType(x.dayType));const snapshot={id:uid(),kind:'weekly',key,year:start.slice(0,4),academicYear:academicYearFor(start),start,end,createdAt:new Date().toISOString(),summary:{agents:db.agents.filter(a=>a.status==='Actif').length,absences:absent.length,maintenance:recordsInRange(db.maintenance,start,end,['date','dueDate']).length,cleaning:recordsInRange(db.cleaning,start,end).length,meetings:recordsInRange(db.meetings,start,end).length,notes:recordsInRange(db.notes,start,end,['date','dueDate']).length},data:{agentDays:recordsInRange(db.agentDays,start,end),maintenance:recordsInRange(db.maintenance,start,end,['date','dueDate']),cleaning:recordsInRange(db.cleaning,start,end),meetings:recordsInRange(db.meetings,start,end),personalEvents:recordsInRange(db.personalEvents,start,end),notes:recordsInRange(db.notes,start,end,['date','dueDate']),issues:recordsInRange(db.issues,start,end,['date','dueDate']),requests:recordsInRange(db.requests,start,end,['date','dueDate']),works:recordsInRange(db.works,start,end,['date','dueDate'])}};db.archives.push(snapshot);db.settings.lastWeeklyArchiveKey=key;return true}
function runAnnualReset(){const t=parseDate(todayISO()),y=t.getFullYear(),isCloseDay=t.getMonth()===7&&t.getDate()===31,isAfterClose=t.getMonth()>=8;if(!isCloseDay&&!isAfterClose)return false;const closeYear=y;if(db.settings.lastAnnualResetYear>=closeYear)return false;const prevStart=closeYear-1,from=`${prevStart}-09-01`,to=`${closeYear}-08-31`,key=`${prevStart}-${closeYear}`;if(!db.archives.some(a=>a.kind==='annual'&&a.key===key)){db.archives.push({id:uid(),kind:'annual',key,year:String(closeYear),academicYear:key,start:from,end:to,createdAt:new Date().toISOString(),summary:{leaveDays:db.agentDays.filter(x=>x.date>=from&&x.date<=to&&isAbsenceType(x.dayType)).length,overtime:db.agentDays.filter(x=>x.date>=from&&x.date<=to).reduce((n,x)=>n+Number(x.overtime||0),0)},data:{agentDays:recordsInRange(db.agentDays,from,to),rotations:clone(db.rotations),weeklyPlans:clone(db.weeklyPlans)}})}db.settings.lastAnnualResetYear=closeYear;db.settings.leaveBalances={};db.settings.overtimeBalances={};return true}
function runAutomaticHousekeeping(){let changed=false;try{changed=createWeeklyArchive(false)||changed;changed=runAnnualReset()||changed}catch(e){console.error('Archivage automatique',e)}return changed}
function notificationTarget(n){setView(n.view||'dashboard');if(n.type==='agentDay'&&n.id){const r=db.agentDays.find(x=>x.id===n.id);if(r)setTimeout(()=>openAgentDay(r.agentId,r.date),50);return}if(n.type&&n.id)setTimeout(()=>dispatchEdit(n.type,n.id),50)}
function wasteCollectionShiftInfo(referenceDate=todayISO()){
 const ref=normalizeDateValue(referenceDate)||todayISO(),d=parseDate(ref),day=d.getDay();
 // Semaine lundi -> dimanche contenant la date de référence.
 const monday=addDays(ref,-((day+6)%7)),friday=addDays(monday,4);
 const holidays=[];
 for(let x=monday;x<=friday;x=addDays(x,1)){
  const name=frenchPublicHolidayName(x);if(name)holidays.push({date:x,name});
 }
 const shifted=holidays.length>0,actualDate=shifted?addDays(friday,1):friday;
 return {monday,friday,actualDate,shifted,holidays};
}
function computeNotifications(){
 const out=[],today=todayISO(),replacementUntil=addMonths(today,1),active=(db.agents||[]).filter(a=>normalizeText(a.status)==='actif'),days=[0,1,2,3,4,5,6].map(i=>addDays(today,i));
 const push=n=>{if(n&&n.title)out.push(n)};
 // Poubelles : le jeudi, avertir si un jour férié de la semaine décale la collecte du vendredi au samedi.
 try{
  const shift=wasteCollectionShiftInfo(today),wd=parseDate(today).getDay();
  if(wd===4&&shift.shifted){
   const names=shift.holidays.map(h=>`${h.name} (${fmtDate(h.date)})`).join(', ');
   push({level:'orange',icon:'🗑️',title:'Collecte des poubelles décalée d’un jour',text:`Jour férié cette semaine : ${names}. Passage samedi ${fmtDate(shift.actualDate)} au lieu du vendredi ${fmtDate(shift.friday)}.`,view:'waste',type:'waste-holiday-shift',id:shift.friday,date:today});
  }
 }catch(error){console.error('Notification collecte déchets',error)}
 const openMaintenanceStatus=value=>{
  const s=normalizeText(value);
  return s==='a faire'||s==='en cours'||s.startsWith('en attente')||s==='a qualifier'||s==='planifiee'||s==='planifie'||s==='bloquee'||s==='bloque';
 };
 const timeOrderInvalid=(start,end)=>{
  const a=minutes(start),b=minutes(end);return a!=null&&b!=null&&b<=a;
 };
 const overlap=(a,b)=>{
  const as=minutes(a?.start),ae=minutes(a?.end),bs=minutes(b?.start),be=minutes(b?.end);
  if([as,ae,bs,be].some(v=>v==null))return false;
  return as<be&&bs<ae;
 };
 try{
  // Remplacements : alerter à partir d'un mois avant l'absence, pour tous les agents actifs.
  // Au-delà d'un mois, aucune notification de remplacement n'est affichée. Les exclusions
  // (week-end, férié, non-remplacement, refus/annulation) sont centralisées dans replacementNotificationAllowed().
  const activeIds=new Set(active.map(a=>String(a.id)));
  const futureAbsences=(db.agentDays||[])
   .filter(rec=>{const d=normalizeDateValue(rec.date);return activeIds.has(String(rec.agentId))&&d>=today&&d<=replacementUntil&&isAbsenceType(rec.dayType)})
   .sort((a,b)=>normalizeDateValue(a.date).localeCompare(normalizeDateValue(b.date)));
  for(const rec of futureAbsences){
   const day=normalizeDateValue(rec.date),a=agentById(rec.agentId);
   if(a&&replacementNotificationAllowed(rec,day)&&!String(rec.replacement||'').trim()){
    push({level:'orange',icon:'⚠️',title:`${agentName(a)} absent${day===today?' aujourd’hui':` le ${fmtDate(day)}`}`,text:`${rec.dayType||'Absence'} — remplacement à organiser`,view:'absences',type:'agentDay',id:rec.id||'',date:day});
   }
  }
  // Alertes de cohérence horaire : surveillance rapprochée sur les 7 prochains jours.
  for(const day of days){
   const abs=[];
   for(const a of active){
    const info=dayInfo(a.id,day)||{},records=(db.agentDays||[]).filter(x=>String(x.agentId)===String(a.id)&&normalizeDateValue(x.date)===day),rec=records[0];
    if(isAbsenceType(info.dayType)){
     abs.push({a,info,rec});
     if((rec?.actualStart||rec?.actualEnd||Number(rec?.overtime||0)>0))push({level:'red',icon:'🕒',title:`Horaire incohérent — ${agentName(a)}`,text:`${fmtDate(day)} : absence avec horaire réel ou heures supplémentaires`,view:'planning',type:rec?'agentDay':null,id:rec?.id||'',date:day});
    }
    if(records.length>1)push({level:'red',icon:'🕒',title:`Horaire incohérent — ${agentName(a)}`,text:`${fmtDate(day)} : plusieurs saisies existent pour la même journée`,view:'planning',type:rec?'agentDay':null,id:rec?.id||'',date:day});
    if(!isAbsenceType(info.dayType)&&info.dayType!=='Repos'){
     if((info.plannedStart&&!info.plannedEnd)||(!info.plannedStart&&info.plannedEnd))push({level:'red',icon:'🕒',title:`Horaire incomplet — ${agentName(a)}`,text:`${fmtDate(day)} : début ou fin théorique manquant`,view:'planning',type:rec?'agentDay':null,id:rec?.id||'',date:day});
     if(timeOrderInvalid(info.plannedStart,info.plannedEnd))push({level:'red',icon:'🕒',title:`Horaire incohérent — ${agentName(a)}`,text:`${fmtDate(day)} : fin théorique antérieure ou égale au début`,view:'planning',type:rec?'agentDay':null,id:rec?.id||'',date:day});
     if((info.actualStart&&!info.actualEnd)||(!info.actualStart&&info.actualEnd))push({level:'orange',icon:'🕒',title:`Saisie réelle incomplète — ${agentName(a)}`,text:`${fmtDate(day)} : arrivée ou départ réel manquant`,view:'planning',type:rec?'agentDay':null,id:rec?.id||'',date:day});
     if(info.actualStart&&info.actualEnd&&timeOrderInvalid(info.actualStart,info.actualEnd))push({level:'red',icon:'🕒',title:`Horaire réel incohérent — ${agentName(a)}`,text:`${fmtDate(day)} : départ réel antérieur ou égal à l’arrivée`,view:'planning',type:rec?'agentDay':null,id:rec?.id||'',date:day});
     const duration=info.plannedStart&&info.plannedEnd?Math.max(0,(minutes(info.plannedEnd)-minutes(info.plannedStart)+1440)%1440):0;
     if(duration&&Number(info.pause||0)>=duration)push({level:'red',icon:'🕒',title:`Pause incohérente — ${agentName(a)}`,text:`${fmtDate(day)} : la pause est supérieure ou égale à la présence`,view:'planning',type:rec?'agentDay':null,id:rec?.id||'',date:day});
    }
   }
  }
  // Alerte collective de remplacement sur la même fenêtre d'un mois.
  for(let day=today;day<=replacementUntil;day=addDays(day,1)){
   const absToCover=(db.agentDays||[]).filter(rec=>activeIds.has(String(rec.agentId))&&normalizeDateValue(rec.date)===day&&isAbsenceType(rec.dayType)&&replacementNotificationAllowed(rec,day)&&!String(rec.replacement||'').trim());
   if(absToCover.length>=2)push({level:'yellow',icon:'👥',title:`${absToCover.length} agents à remplacer le ${fmtDate(day)}`,text:'Vérifier la couverture des postes',view:'absences',date:day});
  }
  // Vérification des profils annuels : segments qui se chevauchent et horaires invalides.
  for(const p of db.weeklyPlans||[]){
   const agent=agentById(p.agentId),name=agentName(agent)||p.agent||'Agent';
   for(const [weekday,profile] of Object.entries(p.dayProfiles||{})){
    if(!profile)continue;
    if(timeOrderInvalid(profile.start,profile.end))push({level:'red',icon:'🕒',title:`Horaire annuel incohérent — ${name}`,text:`Jour ${weekday} : fin antérieure ou égale au début`,view:'planning',date:p.effectiveFrom||today});
    const seg=(profile.segments||[]).filter(x=>x.start&&x.end&&!/pause/i.test(x.task||''));
    for(let i=0;i<seg.length;i++)for(let j=i+1;j<seg.length;j++)if(overlap(seg[i],seg[j]))push({level:'red',icon:'🕒',title:`Créneaux superposés — ${name}`,text:`Jour ${weekday} : ${seg[i].start}–${seg[i].end} chevauche ${seg[j].start}–${seg[j].end}`,view:'planning',date:p.effectiveFrom||today});
   }
  }
  // Plusieurs roulements actifs simultanément pour le même agent.
  for(const a of active){
   for(const day of days){
    const rs=(db.rotations||[]).filter(r=>String(r.agentId)===String(a.id)&&(!r.effectiveFrom||r.effectiveFrom<=day)&&(!r.effectiveTo||r.effectiveTo>=day));
    if(rs.length>1)push({level:'red',icon:'🔄',title:`Roulements incohérents — ${agentName(a)}`,text:`${fmtDate(day)} : ${rs.length} roulements actifs en même temps`,view:'rotations',type:'rotation',id:rs[0]?.id||'',date:day});
   }
  }
 }catch(error){console.error('Notifications agents et horaires',error)}
 try{
  for(const x of db.maintenance||[]){
   if(isClosedStatus(x.status)||!openMaintenanceStatus(x.status))continue;
   const due=recordDueDate(x),late=!!due&&due<today,urgent=isUrgentPriority(x.priority);
   if(late||urgent)push({level:late?'red':'orange',icon:'🔧',title:x.title||x.no||'Intervention',text:late?`En retard depuis le ${fmtDate(due)} · statut ${x.status||'—'}`:`Intervention urgente · statut ${x.status||'—'}`,view:'maintenance',type:'maintenance',id:x.id,date:due||normalizeDateValue(x.date)||today});
  }
 }catch(error){console.error('Notifications maintenance',error)}
 try{
  for(const x of db.periodic||[]){
   if(periodicIsInactive(x))continue;
   const due=normalizeDateValue(periodicDue(x));if(!due)continue;
   const diff=daysBetweenDates(today,due);if(diff!==null&&diff<=30){
    const level=diff<=0?'red':diff<=15?'orange':'yellow';
    push({level,icon:'🛡️',title:x.name||x.no||'Contrôle périodique',text:diff<0?`Contrôle dépassé de ${Math.abs(diff)} jour(s)`:diff===0?'Contrôle prévu aujourd’hui':`Contrôle dans ${diff} jour(s)`,view:'periodic',type:'periodic',id:x.id,date:due});
   }
  }
 }catch(error){console.error('Notifications contrôles périodiques',error)}
 try{
  if(db.settings?.cleaningNotificationsEnabled!==false){
  const threshold=Math.max(1,Number(db.settings?.cleaningAlertDays||30));
  const never=[],overdue=[],planned=[];
  for(const sp of db.spaces||[]){
   const arr=(db.cleaning||[]).filter(c=>c.building===sp.building&&c.floor===sp.floor&&(c.room===sp.name||c.room==='Zone entière')).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
   if(!arr.length)never.push(sp);
   else{
    const last=normalizeDateValue(arr[0].date),diff=last?daysBetweenDates(last,today):null;
    if(diff!==null&&diff>threshold)overdue.push({space:sp,last,diff,id:arr[0].id});
   }
  }
  for(const x of (db.cleaning||[]).filter(c=>normalizeDateValue(c.date)<=today&&normalizeText(c.overallStatus)==='non controle'))planned.push(x);
  if(db.settings?.cleaningNotifyNever!==false&&never.length){const sample=never.slice(0,4).map(sp=>sp.name).join(', ');push({level:'yellow',icon:'🧹',title:`${never.length} local${never.length>1?'x':''} jamais contrôlé${never.length>1?'s':''}`,text:`${sample}${never.length>4?'…':''}`,details:never.map(sp=>`${sp.building||'Bâtiment'} · ${sp.floor||'Niveau'} · ${sp.name}`),view:'cleaning',type:'cleaning-summary',id:'never',date:today});}
  if(db.settings?.cleaningNotifyOverdue!==false&&overdue.length){const max=Math.max(...overdue.map(x=>x.diff));const sample=overdue.slice(0,4).map(x=>x.space.name).join(', ');push({level:'yellow',icon:'🧹',title:`${overdue.length} local${overdue.length>1?'x':''} à contrôler`,text:`Non contrôlé${overdue.length>1?'s':''} depuis plus de ${threshold} jours · ${sample}${overdue.length>4?'…':''}`,details:overdue.map(x=>`${x.space.building||'Bâtiment'} · ${x.space.floor||'Niveau'} · ${x.space.name} — dernier contrôle ${fmtDate(x.last)}`),view:'cleaning',type:'cleaning-summary',id:'overdue',date:today});}
  if(db.settings?.cleaningNotifyPlanned!==false&&planned.length){const sample=planned.slice(0,4).map(x=>x.room||x.roomType||'Local').join(', ');push({level:'orange',icon:'🧹',title:`${planned.length} contrôle${planned.length>1?'s':''} ménage non réalisé${planned.length>1?'s':''}`,text:`${sample}${planned.length>4?'…':''}`,details:planned.map(x=>`${x.building||'Bâtiment'} · ${x.floor||'Niveau'} · ${x.room||x.roomType||'Local'} — ${fmtDate(x.date)}`),view:'cleaning',type:'cleaning-summary',id:'planned',date:today});}
  }
 }catch(error){console.error('Notifications ménage',error)}
 try{
  const meetingDays=Math.max(1,Number(db.settings?.meetingAlertDays||3));
  for(const x of [...(db.meetings||[]),...(db.personalEvents||[])]){
   const date=normalizeDateValue(x.date);if(!date||date<today||isClosedStatus(x.status))continue;
   const diff=daysBetweenDates(today,date);if(diff!==null&&diff<=meetingDays)push({level:'blue',icon:'📅',title:x.title||'Rendez-vous',text:diff===0?`Aujourd’hui ${x.time||x.start||''}`:`Dans ${diff} jour(s) — ${fmtDate(date)}`,view:x.no?.startsWith('PER')?'personal':'meetings',type:x.no?.startsWith('PER')?'personalEvent':'meeting',id:x.id,date});
  }
 }catch(error){console.error('Notifications rendez-vous',error)}
 try{
  const nc=(db.reportNonconformities||[]).filter(x=>!['levee','leve','conforme','cloturee','cloture','archivee','archive'].includes(normalizeText(x.status)));
  if(nc.length)push({level:'orange',icon:'🛡️',title:`${nc.length} non-conformité${nc.length>1?'s':''} de contrôle à traiter`,text:'Rapports APAVE / organismes de contrôle — ouvrir les imports PDF pour le suivi',view:'pdfimports',type:'control-summary',id:'nonconformities',date:today});
 }catch(error){console.error('Notifications rapports de contrôle',error)}
 const seen=new Set(),dedup=out.filter(n=>{const k=[n.level,n.title,n.text,n.id,n.date].join('|');if(seen.has(k))return false;seen.add(k);return true});
 const order={red:0,orange:1,yellow:2,blue:3,green:4};return dedup.sort((a,b)=>(order[a.level]-order[b.level])||String(a.date||'').localeCompare(String(b.date||''))).slice(0,100)
}
function renderNotifications(){const arr=computeNotifications(),count=arr.length,b=$('#notificationCount');if(b){b.textContent=count;b.classList.toggle('hidden',!count)}const sub=$('#notificationSubtitle');if(sub)sub.textContent=count?`${count} notification${count>1?'s':''} à consulter`:'Aucune notification';const list=$('#notificationList');if(list)list.innerHTML=arr.length?arr.map((n,i)=>`<button class="notification-item ${n.level}" data-notification-index="${i}"><span class="notification-icon">${n.icon}</span><span><strong>${esc(n.title)}</strong><small>${esc(n.text)}</small></span><span class="go-arrow">›</span></button>`).join(''):'<div class="empty-state">✓ Aucune notification à traiter.</div>';window.__notifications=arr}
window.PSTNotifications={compute:computeNotifications,render:renderNotifications,target:notificationTarget};
window.PSTDiagnostics={
 getDb:()=>db,
 notificationSummary:()=>{
  const today=todayISO();
  const openStatuses=new Set(['a faire','en cours','en attente']);
  const maintenance=(db.maintenance||[]).map(x=>({
   id:x.id||'',title:x.title||x.no||'Intervention',status:x.status||'',statusNormalized:normalizeText(x.status),
   due:recordDueDate(x),priority:x.priority||'',closed:isClosedStatus(x.status)
  }));
  const maintenanceOpen=maintenance.filter(x=>!x.closed&&[...openStatuses].some(s=>x.statusNormalized===s||x.statusNormalized.startsWith(s+' ')));
  const maintenanceLate=maintenanceOpen.filter(x=>x.due&&x.due<today);
  let notifications=[];let error='';try{notifications=computeNotifications()}catch(e){error=e?.message||String(e)}
  return {today,agents:(db.agents||[]).length,agentDays:(db.agentDays||[]).length,maintenanceTotal:maintenance.length,maintenanceOpen:maintenanceOpen.length,maintenanceLate:maintenanceLate.length,maintenanceLateDetails:maintenanceLate,periodicTotal:(db.periodic||[]).length,cleaningTotal:(db.cleaning||[]).length,meetingsTotal:(db.meetings||[]).length,notifications:notifications.length,error};
 }
};

function importedArchiveRows(){
 const explicit=(db.importArchives||[]).map(x=>({...x}));
 const seen=new Set(explicit.map(x=>x.sourceId||x.id));
 for(const x of (db.pdfImports||[])){
  if(seen.has(x.id))continue;
  explicit.push({id:`pdf-${x.id}`,sourceId:x.id,createdAt:x.createdAt||'',type:x.kind==='chronotime'?'Chronotime':'Rapport de contrôle',fileName:x.fileName||'PDF',attachmentId:x.attachmentId||'',bundledPath:x.bundledPath||'',bundledKey:x.bundledKey||'',subject:x.subject||'',academicYear:x.academicYear||'',summary:x.summary||'',module:x.kind==='chronotime'?'pdfimports':'periodic'});
 }
 for(const n of (db.notes||[]).filter(n=>n.source==='scan'||n.importedScan)){
  if(seen.has(n.id))continue;
  const a=(n.attachments||[])[0];explicit.push({id:`note-${n.id}`,sourceId:n.id,createdAt:n.importedAt||`${n.date||todayISO()}T00:00:00`,type:'Note scannée',fileName:a?.name||n.title||'Note scannée',attachmentId:a?.id||'',subject:n.title||'',summary:(n.text||'').slice(0,180),module:'notes',recordId:n.id});
 }
 return explicit.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
function archiveAttachmentMeta(attachmentId){return (db.attachments||[]).find(a=>String(a.id)===String(attachmentId))||null}
function cloudStatusHtml(rec){
 if(!rec)return '<span class="cloud-status missing">⚪ Original absent</span>';
 if(rec.cloudVerified===true)return `<span class="cloud-status synced" title="Vérifié ${esc(rec.cloudVerifiedAt?new Date(rec.cloudVerifiedAt).toLocaleString('fr-FR'):'')}">☁️ Cloud — Synchronisé</span>`;
 if(rec.storagePath){
  const err=rec.cloudError?` title="${esc(rec.cloudError)}"`:'';
  return `<span class="cloud-status checking"${err}>☁️ Cloud — À vérifier</span>`;
 }
 return '<span class="cloud-status error">⚠️ Original indisponible</span>';
}
function cloudActionHtml(rec){
 if(!rec)return '';
 if(rec.cloudVerified===true)return '';
 if(rec.storagePath)return `<button class="ghost small" data-verify-import-cloud="${esc(rec.id)}">🔎 Vérifier le cloud</button>`;
 return '';
}
function renderImportArchives(){
 const box=$('#importArchiveCards'),sum=$('#importArchiveSummary');if(!box||!sum)return;
 const type=$('#importArchiveType')?.value||'',q=normalizeText($('#importArchiveSearch')?.value||'');let rows=importedArchiveRows();
 if(type)rows=rows.filter(x=>x.type===type);if(q)rows=rows.filter(x=>normalizeText(`${x.fileName} ${x.subject} ${x.summary} ${x.academicYear} ${x.type}`).includes(q));
 const all=importedArchiveRows(),resolved=all.map(x=>({x,a:resolveArchiveAttachment(x)})),withOriginal=resolved.filter(o=>!!o.a?.storagePath).length,cloudSynced=resolved.filter(o=>o.a?.cloudVerified===true).length,cloudPending=resolved.filter(o=>o.a?.storagePath&&o.a?.cloudVerified!==true).length;
 sum.innerHTML=`<article><span>Imports conservés</span><strong>${all.length}</strong></article><article><span>Originaux cloud</span><strong>${withOriginal}</strong></article><article><span>☁️ Cloud vérifié</span><strong>${cloudSynced}</strong></article><article><span>☁️ À vérifier</span><strong>${cloudPending}</strong></article>`;
 box.innerHTML=rows.length?rows.map(x=>{const att=resolveArchiveAttachment(x);if(att)rememberImportOriginalBinding(x,att);const attachmentId=att?.id||x.attachmentId||'';return `<article class="import-archive-card"><div class="import-archive-icon">${x.type==='Chronotime'?'⏱':x.type==='Note scannée'?'📝':x.type.includes('Contrôle')||x.type.includes('Rapport')?'🛡':'📄'}</div><div class="import-archive-main"><div class="panel-head"><div><strong>${esc(x.fileName||x.subject||'Document importé')}</strong><small>${esc(x.type||'Document')} · ${x.createdAt?new Date(x.createdAt).toLocaleString('fr-FR'):'—'}</small></div>${x.academicYear?badge(x.academicYear):''}</div><p>${esc(x.subject||'')}</p><small>${esc(x.summary||'')}</small><div class="import-cloud-line">${cloudStatusHtml(att)}</div><div class="import-archive-actions">${att?.storagePath?`<button class="primary small" data-download="${esc(attachmentId)}">📄 Relire l’original</button>`:`<label class="primary small button-link">📎 Rattacher le PDF<input type="file" accept="application/pdf,.pdf" data-reattach-import="${esc(x.id)}" hidden></label>`}${cloudActionHtml(att)}<button class="ghost small" data-open-import-analysis="${esc(x.id)}">📊 Relire l’analyse</button>${x.recordId?`<button class="ghost small" data-open-import-record="${esc(x.recordId)}" data-import-module="${esc(x.module||'')}">✎ Relire la fiche</button>`:''}${x.module?`<button class="ghost small" data-go="${esc(x.module)}">Ouvrir le module</button>`:''}<button class="ghost small danger-mini" data-delete-import="${esc(x.id)}">🗑 Supprimer</button></div></div></article>`}).join(''):'<div class="empty-state">Aucun import ne correspond à ces filtres.</div>';
}

async function reattachImportOriginal(archiveId,file){
 if(!file)return;
 let x=(db.importArchives||[]).find(a=>String(a.id)===String(archiveId));
 if(!x){
  const row=importedArchiveRows().find(a=>String(a.id)===String(archiveId));
  if(row){x={...row,id:uid(),analysisSnapshot:row.analysisSnapshot||row.analysis||null};db.importArchives=db.importArchives||[];db.importArchives.push(x)}
 }
 if(!x){const st=$('#importArchiveStatus');if(st){st.textContent='❌ Archive introuvable.';st.className='import-archive-status error'}toast('Archive introuvable');return}
 try{
  const st=$('#importArchiveStatus');if(st){st.textContent='⏳ Enregistrement du document original…';st.className='import-archive-status working'}
  const meta=await putFile(file,{module:'imports',recordId:x.sourceId||x.id});
  db.attachments=db.attachments||[];
  const oldIndex=db.attachments.findIndex(a=>String(a.id)===String(meta.id));
  if(oldIndex>=0)db.attachments[oldIndex]=meta;else db.attachments.push(meta);
  x.attachmentId=meta.id;x.fileName=file.name||x.fileName;x.originalStoredAt=new Date().toISOString();x.originalStorageMode=meta.storageMode||'';x.cloudVerified=meta.cloudVerified===true;x.cloudVerifiedAt=meta.cloudVerifiedAt||'';
  // Le lien archive ↔ original est conservé dans l’état Supabase commun.
  rememberImportOriginalBinding(x,meta);
  const src=(db.pdfImports||[]).find(r=>String(r.id)===String(x.sourceId));
  if(src){src.attachmentId=meta.id;src.fileName=file.name||src.fileName}
  // V147 : réparer aussi la fiche métier du contrôle pour que l’original soit relisible partout.
  const periodicId=x.recordId||src?.periodicControlId||x.analysisSnapshot?.periodicControlId||'';
  if(periodicId){
   const periodic=(db.periodic||[]).find(p=>String(p.id)===String(periodicId));
   if(periodic){
    periodic.attachments=periodic.attachments||[];
    const sameIndex=periodic.attachments.findIndex(a=>String(a.id)===String(x.attachmentId||'') || (!a?.storagePath && normalizeText(a?.name||'')===normalizeText(x.fileName||file.name||'')));
    if(sameIndex>=0)periodic.attachments[sameIndex]=meta;
    else if(!periodic.attachments.some(a=>String(a.id)===String(meta.id)))periodic.attachments.push(meta);
   }
  }
  x.attachmentId=meta.id;
  const annual=(db.chronotimeAnnual||[]).find(r=>String(r.sourceId||'')===String(x.sourceId)||String(r.fileName||'')===String(x.fileName));
  if(annual)annual.attachmentId=meta.id;

  // Sauvegarder l’état applicatif dans Supabase puis rafraîchir.
  const persisted=window.PSTMainState?.persistNow?await window.PSTMainState.persistNow():{ok:save(false),offline:!navigator.onLine};
  renderImportArchives();renderPeriodic();
  if(persisted?.ok){
   if(st){st.textContent=`✅ ${file.name} est rattaché, sauvegardé et confirmé dans Supabase.`;st.className='import-archive-status ok'}
   toast('Original rattaché et confirmé — « Relire l’original » est disponible');
  }else if(persisted?.offline){
   if(st){st.textContent='⚠️ Fichier chargé mais état applicatif en attente de synchronisation.';st.className='import-archive-status working'}
   toast('Rattachement en attente de synchronisation');
  }else{
   throw new Error('Le fichier est dans Storage mais la fiche n’a pas pu être confirmée dans app_state');
  }
 }catch(e){console.error(e);const st=$('#importArchiveStatus');if(st){st.textContent=`❌ Rattachement impossible : ${e?.message||String(e)}`;st.className='import-archive-status error'}toast(`Impossible de rattacher ce document${e?.message?` : ${e.message}`:''}`)}
}

function openImportAnalysis(id){
 const x=importedArchiveRows().find(r=>String(r.id)===String(id));if(!x)return;
 let a=x.analysisSnapshot||x.analysis||null;
 if(!a&&x.sourceId){
  const pdf=(db.pdfImports||[]).find(r=>String(r.id)===String(x.sourceId));
  if(pdf)a={type:x.type,fileName:x.fileName,subject:x.subject,academicYear:x.academicYear,summary:x.summary,legacy:true};
 }
 const rows=[];
 const add=(label,value)=>{if(value!==undefined&&value!==null&&String(value)!=='')rows.push([label,value])};
 if(a){
  add('Type',a.type||x.type);add('Fichier',a.fileName||x.fileName);add('Sujet / agent / organisme',a.subject||x.subject);add('Année scolaire',a.academicYear||x.academicYear);add('Période',a.period||a.periodLabel);
  add('Jours reconnus',a.daysRead!=null?`${a.daysRead}/${a.daysExpected||a.daysRead}`:'');add('Jours avec durée',a.durationDays);add('Présence',a.presence);add('Référence',a.reference);add('Écart annuel',a.delta);add('CA',a.ca);add('RTT',a.rtt);add('RH',a.rh);add('RFE',a.rfe);add('Organisme',a.organization);add('Famille',a.controlFamily);add('Date du rapport',a.reportDate?fmtDate(a.reportDate):'');add('Non-conformités',a.nonconformities);add('Résumé',a.summary||x.summary);add('Confiance',a.confidence!=null?`${a.confidence}%`:'');
 }
 $('#detailTitle').textContent=`Analyse import — ${x.fileName||x.subject||'Document'}`;
 const cards=rows.length?`<div class="summary-grid">${rows.map(([k,v])=>`<article><span>${esc(k)}</span><strong>${esc(String(v))}</strong></article>`).join('')}</div>`:'<div class="empty-state">Cet ancien import ne possède pas encore d’analyse détaillée enregistrée.</div>';
 const tech=a&&!a.legacy?`<details class="archive-tech-details"><summary>Détail technique de l’analyse</summary><pre class="archive-json">${esc(JSON.stringify(a,null,2))}</pre></details>`:'';
 $('#detailBody').innerHTML=`${cards}<div class="archive-detail-actions">${x.attachmentId?`<button class="primary" data-download="${esc(x.attachmentId)}">📄 Relire l’original</button>`:''}${x.recordId?`<button class="ghost" data-open-import-record="${esc(x.recordId)}" data-import-module="${esc(x.module||'')}">✎ Ouvrir la fiche</button>`:''}</div>${tech}`;
 $('#detailModal').showModal();
}
function renderArchives(){renderImportArchives();const year=$('#archiveYear')?.value||activeAcademicYear(),q=($('#archiveSearch')?.value||'').toLowerCase().trim();const years=[...new Set(db.archives.map(a=>a.year).filter(Boolean))].sort().reverse();if($('#archiveYear')){
 const active=activeAcademicYear(),allYears=[...new Set([active,...years])];
 $('#archiveYear').innerHTML='<option value="">Toutes les années</option>'+allYears.map(y=>`<option value="${esc(y)}" ${y===year?'selected':''}>${esc(y)}</option>`).join('')
}let arr=db.archives.filter(a=>(!year||a.year===year));if(q)arr=arr.filter(a=>JSON.stringify(a).toLowerCase().includes(q));arr.sort((a,b)=>b.start.localeCompare(a.start));$('#archiveSummary').innerHTML=`<article><span>Archives de pilotage</span><strong>${db.archives.length}</strong></article><article><span>Semaines</span><strong>${db.archives.filter(a=>a.kind==='weekly').length}</strong></article><article><span>Années clôturées</span><strong>${db.archives.filter(a=>a.kind==='annual').length}</strong></article><article><span>Dernière archive</span><strong>${db.archives.length?fmtDate([...db.archives].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0].createdAt.slice(0,10)):'—'}</strong></article>`;$('#archiveCards').innerHTML=arr.length?arr.map(a=>`<article class="archive-card"><div class="panel-head"><span>${a.kind==='weekly'?'Semaine':'Année scolaire'}</span>${badge(a.academicYear||a.year)}</div><h3>${esc(a.kind==='weekly'?a.key:a.academicYear)}</h3><p>${fmtDate(a.start)} → ${fmtDate(a.end)}</p><div class="archive-metrics">${Object.entries(a.summary||{}).map(([k,v])=>`<span><strong>${esc(v)}</strong><small>${esc(k)}</small></span>`).join('')}</div><button class="ghost" data-archive-detail="${a.id}">Consulter</button></article>`).join(''):'<div class="empty-state">Aucune archive trouvée.</div>'}

function archiveSection(title,rows,cols){if(!rows?.length)return `<section class="archive-readable-section"><h4>${esc(title)}</h4><div class="empty-state compact">Aucune donnée sur cette période.</div></section>`;return `<section class="archive-readable-section"><h4>${esc(title)} <span class="muted">(${rows.length})</span></h4><div class="archive-readable-list">${rows.map(r=>`<article class="archive-readable-item">${cols.map(c=>{const val=typeof c.value==='function'?c.value(r):r[c.value];return val!==undefined&&val!==null&&val!==''?`<div><small>${esc(c.label)}</small><strong>${esc(String(val))}</strong></div>`:''}).join('')}</article>`).join('')}</div></section>`}
function openArchiveDetail(id){const a=db.archives.find(x=>x.id===id);if(!a)return;const d=a.data||{};$('#detailTitle').textContent=`Archive ${a.kind==='weekly'?a.key:a.academicYear}`;const sections=[archiveSection('Journées agents',d.agentDays,[{label:'Date',value:r=>fmtDate(r.date)},{label:'Agent',value:r=>agentName(r.agentId)},{label:'Type',value:'dayType'},{label:'Prévu',value:r=>r.startPlanned||r.plannedStart||''},{label:'Fin',value:r=>r.endPlanned||r.plannedEnd||''}]),archiveSection('Maintenance',d.maintenance,[{label:'N°',value:'no'},{label:'Date',value:r=>fmtDate(r.date)},{label:'Objet',value:'title'},{label:'Lieu',value:r=>[r.building,r.room].filter(Boolean).join(' · ')},{label:'Statut',value:'status'}]),archiveSection('Contrôles ménage',d.cleaning,[{label:'Date',value:r=>fmtDate(r.date)},{label:'Lieu',value:r=>[r.building,r.room].filter(Boolean).join(' · ')},{label:'Résultat',value:r=>r.result||r.status||''},{label:'Agent',value:r=>agentName(r.agentId)}]),archiveSection('Réunions',d.meetings,[{label:'Date',value:r=>fmtDate(r.date)},{label:'Objet',value:'title'},{label:'Lieu',value:'location'},{label:'Statut',value:'status'}]),archiveSection('Notes',d.notes,[{label:'Date',value:r=>fmtDate(r.date||r.dueDate)},{label:'Titre',value:r=>r.title||r.subject||''},{label:'Priorité',value:'priority'},{label:'Statut',value:'status'}]),archiveSection('Demandes',d.requests,[{label:'Date',value:r=>fmtDate(r.date)},{label:'Objet',value:r=>r.title||r.subject||''},{label:'Statut',value:'status'}]),archiveSection('Chantiers / travaux',d.works,[{label:'Date',value:r=>fmtDate(r.date||r.dueDate)},{label:'Objet',value:r=>r.title||r.subject||''},{label:'Statut',value:'status'}])].join('');$('#detailBody').innerHTML=`<div class="archive-readable-head"><p><strong>Période :</strong> ${fmtDate(a.start)} au ${fmtDate(a.end)}</p><div class="summary-grid">${Object.entries(a.summary||{}).map(([k,v])=>`<article><span>${esc(k)}</span><strong>${esc(v)}</strong></article>`).join('')}</div><div class="archive-detail-actions"><button class="ghost" onclick="window.print()">🖨 Imprimer</button></div></div>${sections}<details class="archive-tech-details"><summary>Données techniques de sauvegarde</summary><pre class="archive-json">${esc(JSON.stringify(a.data,null,2))}</pre></details>`;$('#detailModal').showModal()}
function exportArchives(){const exportAcademicYear=activeAcademicYear();downloadText(`archives-pilotage-${todayISO()}.json`,JSON.stringify(db.archives,null,2),'application/json')}

function collectUrgentDashboardActions(){
 const sources=[
  ['issues','Sécurité / qualité','⚠','issue'],
  ['maintenance','Maintenance','🔧','maintenance'],
  ['requests','Demande direction','↗','request'],
  ['works','Chantier / GPA','🏗','work'],
  ['notes','Note','✎','note'],
  ['personalEvents','Agenda personnel','📅','personal']
 ];
 const rows=[];
 for(const [key,label,icon,editType] of sources){
  for(const x of (db[key]||[])){
   if(isClosedStatus(x.status)||!isUrgentPriority(x.priority))continue;
   rows.push({label,icon,editType,id:x.id,title:x.title||x.subject||x.no||label,due:recordDueDate(x)});
  }
 }
 const linkedNc=new Set((db.maintenance||[]).filter(x=>!isClosedStatus(x.status)&&x.sourceNonconformityId).map(x=>String(x.sourceNonconformityId)));
 for(const x of (db.reportNonconformities||[])){
  const closed=['levee','leve','conforme','cloturee','cloture','archivee','archive'].includes(normalizeText(x.status));
  if(closed||!isUrgentPriority(x.priority)||linkedNc.has(String(x.id)))continue;
  rows.push({label:'Non-conformité rapport',icon:'🛡️',editType:'reportNonconformity',id:x.id,title:x.text||x.title||x.no||'Non-conformité urgente',due:recordDueDate(x)});
 }
 return rows;
}
function collectLateDashboardActions(today=todayISO()){
 const sources=['issues','maintenance','requests','works','notes'];
 const rows=[];
 for(const key of sources){
  for(const x of (db[key]||[])){
   const due=recordDueDate(x);
   if(!isClosedStatus(x.status)&&due&&due<today)rows.push({module:key,record:x,due});
  }
 }
 return rows;
}
function renderDashboard(){
 renderGlobalAcademicYear();
 const today=todayISO(),soon7=addDays(today,7);
 const activeAgents=(db.agents||[]).filter(a=>normalizeText(a.status)==='actif');
 const present=activeAgents.filter(a=>{const info=dayInfo(a.id,today);return !isAbsenceType(info.dayType)&&normalizeText(info.dayType)!=='repos'}).length;
 const urgentActions=collectUrgentDashboardActions();
 const lateActions=collectLateDashboardActions(today);
 const allMaint=db.maintenance||[];
 const closedMaint=allMaint.filter(x=>isClosedStatus(x.status));
 const openMaint=allMaint.filter(x=>!isClosedStatus(x.status));
 // "À faire" = statut À faire uniquement. Les statuts À qualifier / Planifiée restent dans "ouvertes".
 const todoMaint=allMaint.filter(x=>normalizeText(x.status)==='a faire');
 const maintCounts={
   total:allMaint.length,
   todo:todoMaint.length,
   open:openMaint.length,
   closed:closedMaint.length,
   byStatus:allMaint.reduce((acc,x)=>{const k=String(x.status||'Sans statut').trim()||'Sans statut';acc[k]=(acc[k]||0)+1;return acc},{})
 };
 window.PSTMaintenanceCounts=maintCounts;
 const recentClean=(db.cleaning||[]).filter(x=>normalizeDateValue(x.date)>=addDays(today,-30));
 const comp=recentClean.length?Math.round(recentClean.filter(x=>normalizeText(x.overallStatus)==='conforme').length/recentClean.length*100):null;
 const weak=recentClean.reduce((sum,x)=>sum+(x.tasks||[]).filter(t=>['a reprendre','non conforme'].includes(normalizeText(t.status))).length,0);
 const pLate=(db.periodic||[]).filter(x=>normalizeText(periodicComputed(x))==='en retard'),pSoon=(db.periodic||[]).filter(x=>normalizeText(periodicComputed(x))==='bientot');
 const notes=(db.notes||[]).filter(x=>!isClosedStatus(x.status)),notesDue=notes.filter(x=>{const due=recordDueDate(x);return due&&due<=soon7}).length;
 $('#kpiAgents').textContent=activeAgents.length;$('#kpiPresent').textContent=`${present} présents aujourd’hui`;
 $('#kpiUrgentActions').textContent=urgentActions.length;$('#kpiLate').textContent=`${lateActions.length} en retard`;
 $('#kpiMaintenance').textContent=maintCounts.open;$('#kpiMaintenanceTodo').textContent=`${maintCounts.todo} à faire`;
 $('#kpiCompliance').textContent=comp==null?'—':`${comp} %`;$('#kpiCleaningWeak').textContent=`${weak} point${weak>1?'s':''} faible${weak>1?'s':''}`;
 $('#kpiPeriodicLate').textContent=pLate.length;$('#kpiPeriodicSoon').textContent=`${pSoon.length} bientôt`;
 $('#kpiNotes').textContent=notes.length;$('#kpiNotesDue').textContent=`${notesDue} échéance${notesDue>1?'s':''} proche${notesDue>1?'s':''}`;
 const pri=[...urgentActions].sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,8);
 $('#priorityList').innerHTML=cardList(pri.map(x=>itemCard(x.icon,x.title,`${badge('Urgente')} · ${esc(x.label)} · ${fmtDate(x.due)||'Sans échéance'}`,x.editType,x.id)),'Aucune urgence dans le logiciel.');
 $('#dashboardNotes').innerHTML=cardList(notes.slice().sort((a,b)=>(recordDueDate(a)||'9999').localeCompare(recordDueDate(b)||'9999')).slice(0,5).map(x=>itemCard('✎',x.title,`${esc(x.category)} · ${fmtDate(recordDueDate(x))||'Sans échéance'}`,'note',x.id)),'Aucune note active.');
 $('#maintenancePreview').innerHTML=cardList(openMaint.filter(x=>{const st=normalizeText(x.status);return st==='en cours'||st.startsWith('en attente')}).slice(0,5).map(x=>itemCard('⚙',x.title,`${esc(x.building)} · ${badge(x.status)}`,'maintenance',x.id)),'Aucune intervention en cours.');
 $('#maintenanceTodoPreview').innerHTML=cardList(todoMaint.slice(0,5).map(x=>itemCard('🧰',x.title,`${badge(x.priority)} · ${fmtDate(recordDueDate(x))||'Sans échéance'}`,'maintenance',x.id)),'Aucune intervention à faire.');
 const weakRows=[];recentClean.forEach(c=>(c.tasks||[]).filter(t=>['a reprendre','non conforme'].includes(normalizeText(t.status))).forEach(t=>weakRows.push({c,t})));
 $('#cleaningWeakPreview').innerHTML=cardList(weakRows.slice(0,5).map(({c,t})=>itemCard('🧹',t.name,`${esc(c.building)} · ${esc(c.room)} · ${badge(t.status)}`,'cleaning',c.id)),'Aucun point faible récent.');
 const nextMeet=(db.meetings||[]).filter(x=>normalizeDateValue(x.date)>=today&&!isClosedStatus(x.status)&&normalizeText(x.status)!=='annule').sort((a,b)=>`${normalizeDateValue(a.date)}${a.time||''}`.localeCompare(`${normalizeDateValue(b.date)}${b.time||''}`)).slice(0,5);
 $('#meetingPreview').innerHTML=cardList(nextMeet.map(x=>itemCard('📅',x.title,`${fmtDate(normalizeDateValue(x.date))} ${esc(x.time||'')} · ${esc(x.location||'')}`,'meeting',x.id)),'Aucun rendez-vous à venir.');
 renderTeamCalendar();renderPersonalCalendar();renderDashboardTodayAgenda();window.PDFImportModule?.renderDashboard?.();
}

/* ---------- Paramètres ---------- */
const LIST_LABELS={roles:'Fonctions agents',dayTypes:'Types de journée / absence',priorities:'Priorités',generalStatuses:'Statuts généraux',issueCategories:'Catégories sécurité / qualité',maintenanceFamilies:'Domaines maintenance',maintenanceStatuses:'Statuts maintenance',requestTypes:'Types de demande',workTypes:'Types chantier / GPA',meetingTypes:'Types réunion',personalTypes:'Types agenda personnel',noteCategories:'Catégories bloc-notes',roomTypes:'Types de locaux',cleaningStatuses:'Résultats ménage',periodicFamilies:'Familles contrôles périodiques',documentCategories:'Catégories documents'};
function renderSettings(){if($('#cleaningAlertDays'))$('#cleaningAlertDays').value=db.settings.cleaningAlertDays||30;if($('#meetingAlertDays'))$('#meetingAlertDays').value=db.settings.meetingAlertDays||3;for(const [k,v] of Object.entries(db.settings)){const e=document.getElementById(k);if(e&&k!=='counters'){if(e.type==='checkbox')e.checked=Boolean(v);else e.value=v??''}}$('#buildingSettings').innerHTML=db.buildings.map(b=>`<div class="building-card" data-building-id="${b.id}"><div class="panel-head"><input value="${esc(b.name)}" data-building-name><button class="danger small" data-remove-building="${b.id}">Supprimer</button></div><div class="floor-chips">${b.floors.map((f,i)=>`<span><input value="${esc(f)}" data-floor-index="${i}"><button data-remove-floor="${i}">×</button></span>`).join('')}</div><button class="ghost small" data-add-floor="${b.id}">＋ Étage / niveau</button></div>`).join('');$('#spaceSettings').innerHTML=db.spaces.slice().sort((a,b)=>(a.building+a.floor+a.name).localeCompare(b.building+b.floor+b.name)).map(s=>`<button class="space-chip" data-edit-type="space" data-edit-id="${s.id}"><strong>${esc(s.name)}</strong><small>${esc(s.building)} · ${esc(s.floor)} · ${esc(s.type)}</small></button>`).join('')||'<p>Aucun local configuré.</p>';const absenceItems=db.lists.dayTypes;if($('#absenceTypeSettings'))$('#absenceTypeSettings').innerHTML=`<div class="list-editor" data-list-key="dayTypes">${absenceItems.map((x,i)=>`<div><input value="${esc(x)}" data-list-index="${i}" ${x==='Présence'?'readonly':''}><button class="danger small" data-remove-list="${i}" ${x==='Présence'?'disabled':''}>×</button></div>`).join('')}<button class="ghost small" data-add-list="dayTypes">＋ Ajouter un motif</button></div>`;$('#listSettings').innerHTML=Object.entries(db.lists).filter(([k])=>k!=='dayTypes').map(([k,items])=>`<details><summary>${esc(LIST_LABELS[k]||k)} <small>${items.length} choix</small></summary><div class="list-editor" data-list-key="${k}">${items.map((x,i)=>`<div><input value="${esc(x)}" data-list-index="${i}"><button class="danger small" data-remove-list="${i}">×</button></div>`).join('')}<button class="ghost small" data-add-list="${k}">＋ Choix</button></div></details>`).join('')}
function saveSettings(){const keys=['appName','schoolName','schoolZone','academicYear','defaultLayout','printOrientation','defaultInspector','emailsTo','emailsCc','emailsBcc','emailSubjectPrefix','outlookEmail','cleaningAlertDays','meetingAlertDays','autoReportHour','autoReportTimezone','autoReportWeekdays','autoReportSignature'];for(const k of keys)db.settings[k]=document.getElementById(k)?.value??db.settings[k];db.settings.academicYear=normalizeAcademicYear(db.settings.academicYear)||academicYearFor(todayISO());for(const k of ['autoDailyEnabled','autoWeeklyEnabled','autoReportOnlyIfEvents','autoReportIncludeAgents','autoReportIncludeMaintenance','autoReportIncludeCleaning','autoReportIncludePeriodic','autoReportIncludeMeetings','cleaningNotificationsEnabled','cleaningNotifyNever','cleaningNotifyOverdue','cleaningNotifyPlanned']){const e=document.getElementById(k);if(e)db.settings[k]=e.checked}$$('[data-building-id]').forEach(card=>{const b=db.buildings.find(x=>x.id===card.dataset.buildingId);if(!b)return;const old=b.name;b.name=card.querySelector('[data-building-name]').value.trim()||b.name;b.floors=$$('[data-floor-index]',card).map(i=>i.value.trim()).filter(Boolean);if(old!==b.name){db.spaces.forEach(s=>{if(s.building===old)s.building=b.name});for(const type of ['cleaning','maintenance','requests','works','periodic'])db[type].forEach(x=>{if(x.building===old)x.building=b.name})}});$$('[data-list-key]').forEach(ed=>{db.lists[ed.dataset.listKey]=$$('[data-list-index]',ed).map(i=>i.value.trim()).filter(Boolean)});applyLayout(db.settings.defaultLayout);save();toast('Paramètres enregistrés')}
function addBuilding(){const b={id:uid(),name:`Nouveau bâtiment ${db.buildings.length+1}`,floors:['Rez-de-chaussée']};db.buildings.push(b);save();setView('settings')}
function loadSchoolHolidays(){const zone=$('#vacationZone').value||db.settings.schoolZone||'A',year=activeAcademicYear(),periods=SCHOOL_CALENDAR[year]?.[zone]||[];if(!periods.length){toast(`Calendrier officiel non intégré pour ${year}. Le logiciel reste utilisable : ajoutez les périodes manuellement.`);return}for(const [name,start,end,notes] of periods){if(!db.vacations.some(x=>x.name===name&&x.start===start)){db.vacations.push({id:uid(),name:`Vacances de ${name}`,zone,start,end,status:'À préparer',tasks:VACATION_TASKS.map(t=>({text:t,done:false})),notes,attachments:[]})}}save();toast(`Vacances zone ${zone} chargées`)}


async function sendAutomaticReportTest(){
 const btn=$('#sendAutomaticReportTest');if(btn)btn.disabled=true;
 try{
  saveSettings();
  if(!supabaseClient)throw new Error('Connexion Supabase indisponible');
  const {data,error}=await supabaseClient.functions.invoke('automatic-report',{body:{mode:'test'}});
  if(error)throw error;
  toast(data?.message||'Rapport test envoyé');
 }catch(e){console.error(e);toast(`Envoi test impossible : ${e?.message||e}`)}finally{if(btn)btn.disabled=false}
}

/* ---------- Rapports / impression / e-mail ---------- */
function reportTitle(type){return {daily:'Rapport quotidien',weekly:'Rapport hebdomadaire',monthly:'Rapport mensuel général',team:'Bilan mensuel des agents',absence:'Congés et absences',cleaning:'Contrôles ménage',maintenance:'Maintenance',periodic:'Contrôles périodiques',vacation:'Vacances et fermeture',full:'Registre complet'}[type]||'Rapport'}
function tableHTML(headers,rows){return `<div class="report-table-wrap"><table class="report-table cols-${headers.length}" data-cols="${headers.length}"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="empty-cell">Aucune donnée.</td></tr>`}</tbody></table></div>`}
function reportData(type){let title=reportTitle(type),subtitle='',html='';const daily=$('#dailyDate').value||todayISO(),weekly=startOfWeek($('#weeklyDate').value||todayISO()),monthly=$('#monthlyDate').value||monthISO(),teamMonth=$('#teamReportMonth').value||monthISO(),absMonth=$('#absenceReportMonth').value||monthISO(),cleanMonth=$('#cleaningReportMonth').value||monthISO(),maintMonth=$('#maintenanceReportMonth').value||monthISO(),year=$('#periodicReportYear').value||new Date().getFullYear();if(type==='daily'){subtitle=fmtDateLong(daily);const agents=db.agents.filter(a=>a.status==='Actif').map(a=>{const i=dayInfo(a.id,daily),h=dayHours(i);return [esc(agentName(a)),badge(i.dayType),esc(i.shift||''),esc(`${i.plannedStart||'—'}–${i.plannedEnd||'—'}`),esc(fmtHours(h.total))]});html+=`<h2>Équipe</h2>${tableHTML(['Agent','Journée','Service','Horaire','Heures'],agents)}`;const events=eventsForDate(daily);html+=`<h2>Agenda journalier — toutes les actions</h2>${tableHTML(['Heure','Objet','Lieu','Statut'],events.map(x=>[esc(agendaTime(x)||'—'),esc(x.title||'Événement'),esc(agendaPlace(x)||'Lieu non renseigné'),badge(x.status||x.overallStatus||'À faire')]))}`;html+=`<h2>Interventions</h2>${tableHTML(['N°','Objet','Lieu','Priorité','Statut'],db.maintenance.filter(x=>x.date===daily||x.dueDate===daily).map(x=>[esc(x.no),esc(x.title),esc(x.building),badge(x.priority),badge(x.status)]))}`}
if(type==='weekly'){const end=endOfWeek(weekly);subtitle=`${fmtDate(weekly)} au ${fmtDate(end)}`;const allDays=[];for(const a of db.agents.filter(x=>x.status==='Actif'))for(let d=weekly;d<=end;d=addDays(d,1)){const i=dayInfo(a.id,d);if(![0,6].includes(parseDate(d).getDay()))allDays.push([fmtDate(d),esc(agentName(a)),badge(i.dayType),esc(i.shift||''),esc(`${i.plannedStart||'—'}–${i.plannedEnd||'—'}`)])}html=tableHTML(['Date','Agent','Journée','Service','Horaire'],allDays)+`<h2>Échéances et rendez-vous</h2>`+tableHTML(['Date','Type','Objet','Statut'],[...db.meetings.filter(x=>inRange(x.date,weekly,end)).map(x=>[fmtDate(x.date),esc(x.type),esc(x.title),badge(x.status)]),...db.notes.filter(x=>inRange(x.dueDate,weekly,end)).map(x=>[fmtDate(x.dueDate),'Note',esc(x.title),badge(x.status)])])}
if(type==='monthly'){subtitle=monthly;html=`<h2>Indicateurs</h2>${tableHTML(['Module','Total','Ouverts / faibles'],[['Maintenance',db.maintenance.filter(x=>dateMonthMatch(x.date,monthly)).length,db.maintenance.filter(x=>dateMonthMatch(x.date,monthly)&&!['Terminée','Clôturée'].includes(x.status)).length],['Ménage',db.cleaning.filter(x=>dateMonthMatch(x.date,monthly)).length,db.cleaning.filter(x=>dateMonthMatch(x.date,monthly)&&x.overallStatus!=='Conforme').length],['Actions',db.issues.filter(x=>dateMonthMatch(x.date,monthly)).length,db.issues.filter(x=>dateMonthMatch(x.date,monthly)&&!['Terminé','Clôturé'].includes(x.status)).length]])}<h2>Rendez-vous</h2>${tableHTML(['Date','Objet','Lieu','Statut'],db.meetings.filter(x=>dateMonthMatch(x.date,monthly)).map(x=>[fmtDate(x.date),esc(x.title),esc(x.location),badge(x.status)]))}`}
if(type==='team'){subtitle=teamMonth;const rows=db.agents.filter(a=>a.status==='Actif').map(a=>{let planned=0,actual=0,abs=0,ot=0;const [y,m]=teamMonth.split('-').map(Number),last=new Date(y,m,0).getDate();for(let i=1;i<=last;i++){const d=`${teamMonth}-${pad(i)}`;if([0,6].includes(parseDate(d).getDay()))continue;const info=dayInfo(a.id,d),h=dayHours(info);planned+=h.planned;actual+=h.total;if(isAbsenceType(info.dayType))abs++;ot+=Number(info.overtime||0)}return [esc(agentName(a)),fmtHours(planned),fmtHours(actual),`${actual-planned>=0?'+':''}${fmtHours(actual-planned)}`,abs,fmtHours(ot)]});html=tableHTML(['Agent','Prévu','Réalisé','Écart','Jours absence','Heures ajoutées'],rows)}
if(type==='absence'){subtitle=absMonth;html=tableHTML(['Date','Agent','Motif','Statut','Note'],db.agentDays.filter(x=>dateMonthMatch(x.date,absMonth)&&isAbsenceType(x.dayType)).map(x=>[fmtDate(x.date),esc(agentName(agentById(x.agentId))),badge(x.dayType),badge(x.status||'Validée'),esc(x.note||'')]))}
if(type==='cleaning'){subtitle=cleanMonth;html=tableHTML(['Date','Lieu','Type','Agent','Score','Résultat','Points faibles'],db.cleaning.filter(x=>dateMonthMatch(x.date,cleanMonth)).map(x=>[fmtDate(x.date),esc(`${x.building} ${x.floor} ${x.room}`),esc(x.roomType),esc(agentName(agentById(x.agentId))),`${x.score||0} %`,badge(x.overallStatus),esc((x.tasks||[]).filter(t=>['À reprendre','Non conforme'].includes(t.status)).map(t=>t.name).join(', '))]))}
if(type==='maintenance'){subtitle=maintMonth;html=tableHTML(['N°','Date','Objet','Lieu','Priorité','Assigné','Échéance','Statut'],db.maintenance.filter(x=>dateMonthMatch(x.date,maintMonth)).map(x=>[esc(x.no),fmtDate(x.date),esc(x.title),esc(`${x.building} ${x.room||''}`),badge(x.priority),esc(x.assigned||''),fmtDate(x.dueDate),badge(x.status)]))}
if(type==='periodic'){subtitle=`Année ${year}`;html=tableHTML(['N°','Contrôle','Famille','Bâtiment','Dernier','Échéance','État','Prestataire'],db.periodic.filter(x=>!periodicDue(x)||String(periodicDue(x)).startsWith(String(year))||periodicComputed(x)==='En retard').map(x=>[esc(x.no),esc(x.name),esc(x.family),esc(x.building),fmtDate(x.lastDate),fmtDate(periodicDue(x)),badge(periodicComputed(x)),esc(x.provider)]))}
if(type==='vacation'){const id=$('#vacationReportPeriod').value,x=byId('vacations',id)||db.vacations[0];subtitle=x?`${x.name} · ${fmtDate(x.start)} au ${fmtDate(x.end)}`:'Aucune période';html=x?tableHTML(['État','Action'],(x.tasks||[]).map(t=>[t.done?'✓ Fait':'○ À faire',esc(t.text)])):'<p>Aucune période.</p>'}
if(type==='full'){subtitle=`Édité le ${fmtDate(todayISO())}`;html=['team','absence','cleaning','maintenance','periodic','vacation'].map(t=>`<section><h1>${reportTitle(t)}</h1>${reportData(t).html}</section>`).join('')}return {title,subtitle,html,text:stripHTML(html)}}
function stripHTML(h){const d=document.createElement('div');d.innerHTML=h;return d.innerText}
function reportPlainText(report){
 const box=document.createElement('div');box.innerHTML=report.html;
 const lines=[report.title,report.subtitle,''];
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
 [...box.children].forEach(node=>{
  if(/^H[1-6]$/.test(node.tagName)){const t=clean(node.textContent);if(t)lines.push('',`=== ${t.toUpperCase()} ===`);return}
  if(node.tagName==='SECTION'){
   const title=clean(node.querySelector('h1,h2,h3')?.textContent);if(title)lines.push('',`=== ${title.toUpperCase()} ===`);
   node.querySelectorAll('table').forEach(table=>appendTable(table));return;
  }
  if(node.tagName==='TABLE'){appendTable(node);return}
  const t=clean(node.textContent);if(t)lines.push(t);
 });
 function appendTable(table){
  const headers=[...table.querySelectorAll('thead th')].map(x=>clean(x.textContent));
  const rows=[...table.querySelectorAll('tbody tr')];
  if(!rows.length){lines.push('Aucune donnée.');return}
  rows.forEach(row=>{
   const cells=[...row.querySelectorAll('td')].map(x=>clean(x.textContent));
   if(cells.length===1&&cells[0]==='Aucune donnée.'){lines.push('Aucune donnée.');return}
   const parts=cells.map((v,k)=>v?`${headers[k]||`Champ ${k+1}`} : ${v}`:'').filter(Boolean);
   if(parts.length)lines.push(`• ${parts.join(' | ')}`);
  });
 }
 return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function reportPrintCSS(orientation='landscape'){
 return `@page{size:A4 ${orientation};margin:10mm 8mm 14mm}
 *{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;color:#172b3f;font-size:10px;line-height:1.3;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;background:#fff}
 .print-header{display:flex;align-items:center;gap:12px;border-bottom:3px solid #0875c9;padding-bottom:8px;margin-bottom:12px;break-inside:avoid}.print-header img{width:54px;height:54px;object-fit:contain}.print-header h1{color:#075ca8;margin:0 0 2px;font-size:19px}.print-header p{margin:1px 0;color:#475569}.print-header strong{font-size:11px}.print-subtitle{margin:-5px 0 10px;padding:6px 9px;background:#eef7fd;border:1px solid #cfe6f7;border-radius:7px;color:#31536d;font-size:9px}
 .print-footer{position:fixed;left:0;right:0;bottom:-9mm;border-top:1px solid #cbd5e1;padding-top:3px;font-size:7.5px;color:#64748b;text-align:center}
 h1,h2,h3{color:#075ca8;break-after:avoid}h2{font-size:14px;margin:15px 0 6px;border-bottom:1px solid #cfe2f1;padding-bottom:4px}h3{font-size:12.5px;margin:0 0 6px}p{margin:3px 0}.muted,.hint,small{color:#64748b}
 .panel{border:1px solid #d5e2eb;border-radius:9px;padding:9px;margin:0 0 10px;background:#fff;box-shadow:none;break-inside:auto}.panel-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:6px}.panel-head>p{max-width:55%}
 .summary-grid,.mini-kpis,.team-summary,.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0}.summary-grid article,.mini-kpis article,.team-summary article,.kpi{border:1px solid #dbe5ed;border-radius:7px;padding:6px;background:#f8fbfd;break-inside:avoid}.summary-grid strong,.mini-kpis strong,.team-summary strong,.kpi strong{display:block;font-size:14px;color:#075ca8}
 .report-table-wrap,.table-wrap{width:100%;overflow:visible!important;margin:6px 0 12px}.report-table,table{border-collapse:collapse;width:100%;table-layout:auto}.report-table thead,table thead{display:table-header-group}.report-table tr,table tr{break-inside:avoid;page-break-inside:avoid}.report-table th,.report-table td,th,td{border:1px solid #b7c5d2;padding:4px 5px;vertical-align:top;overflow-wrap:anywhere}.report-table th,th{background:#dceef9;color:#153c5a;font-weight:700;text-align:left}.report-table tbody tr:nth-child(even) td,tbody tr:nth-child(even) td{background:#f7fafc}.report-table.cols-7,.report-table.cols-8,.report-table.cols-9,.report-table.cols-10{font-size:8.2px}
 /* V147.42 — largeur des colonnes calculée selon le contenu, avec limites A4. */
 .report-table,table{table-layout:auto!important}
 .report-table th,.report-table td,th,td{width:auto!important;max-width:58mm;white-space:normal;overflow-wrap:anywhere;word-break:normal}
 .report-table th:first-child,.report-table td:first-child,table th:first-child,table td:first-child{white-space:nowrap;width:1%;max-width:30mm}
 .report-table th:has(.badge),.report-table td:has(.badge){white-space:nowrap;width:1%}

 .print-maintenance-table .print-col-action{display:none!important}
 .pst-auto-sized-print-table th,.pst-auto-sized-print-table td{white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;max-width:none!important}

 .badge{display:inline-block;padding:2px 5px;border-radius:6px;background:#e8edf2;white-space:nowrap}.good{background:#dff6e8!important}.bad{background:#ffe0e0!important}.warn{background:#fff0c9!important}.info{background:#dff0ff!important}.empty-cell{text-align:center;color:#64748b;font-style:italic}
 /* Calendrier Congés / RTT / absences */
 .month-board{width:100%;overflow:visible!important;margin:4px 0 10px}.month-grid{display:grid!important;align-items:stretch;width:100%!important;min-width:0!important;gap:0;border-left:1px solid #cbd5e1;border-top:1px solid #cbd5e1}.month-corner,.month-day-head,.month-agent,.month-cell.day-state{border-right:1px solid #cbd5e1!important;border-bottom:1px solid #cbd5e1!important;min-width:0!important;max-width:none!important;width:auto!important;margin:0!important;border-radius:0!important;display:flex!important;align-items:center;justify-content:center;min-height:24px!important;padding:2px!important}.month-corner,.month-agent{justify-content:flex-start!important;text-align:left!important;padding-left:4px!important;background:#f3f7fa!important;font-weight:700;font-size:7.5px;position:static!important}.month-day-head{background:#dceef9!important;font-weight:700;font-size:7px;position:static!important}.month-day-head.weekend{background:#edf2f6!important}.month-cell.day-state{font-size:7px;font-weight:700}.month-cell.day-state span{font-size:7px!important}.month-cell.day-state.standard{background:#dbeafe!important;color:#275a9b!important}.month-cell.day-state.morning{background:#dcfce7!important;color:#166534!important}.month-cell.day-state.evening{background:#ffedd5!important;color:#9a3412!important}.month-cell.day-state.leave{background:#bbf7d0!important;color:#166534!important}.month-cell.day-state.rtt{background:#93c5fd!important;color:#1e3a8a!important}.month-cell.day-state.sick{background:#fecaca!important;color:#991b1b!important}.month-cell.day-state.holiday{background:#fef08a!important;color:#854d0e!important}.month-cell.day-state.off{background:#eef1f4!important;color:#6b7280!important}.month-cell.day-state.other{background:#ede9fe!important;color:#5b21b6!important}
 /* Roulements */
 .rotation-preview{display:grid;gap:7px}.rotation-month{display:block;border:1px solid #dbe5ed;border-radius:7px;padding:6px;margin-bottom:7px;break-inside:avoid}.rotation-month>strong{display:block;margin-bottom:4px;text-transform:capitalize}.rotation-month>div{display:grid!important;grid-template-columns:repeat(31,1fr)!important;gap:1px!important;overflow:visible!important}.rotation-day{min-width:0!important;min-height:25px!important;padding:1px!important;border:1px solid #d8e1e8;border-radius:3px!important;font-size:6.5px!important;display:flex;flex-direction:column;align-items:center;justify-content:center}.rotation-day small{font-size:5.5px}.rotation-day.standard{background:#dbeafe!important}.rotation-day.morning{background:#dcfce7!important}.rotation-day.evening{background:#ffedd5!important}.rotation-day.leave{background:#bbf7d0!important}.rotation-day.rtt{background:#93c5fd!important}.rotation-day.sick{background:#fecaca!important}.rotation-day.holiday{background:#fef08a!important}.rotation-day.off{background:#eef1f4!important}
 /* Calendriers et cartes */
 .personal-calendar{display:grid!important;grid-template-columns:repeat(7,1fr)!important;gap:4px!important;overflow:visible!important}.personal-day{min-height:70px!important;border:1px solid #dbe5ed;border-radius:5px;padding:4px;break-inside:avoid}.cal-event{display:block;border-left:3px solid #7758b3;background:#f0eaff!important;border-radius:4px;padding:3px;margin:2px 0;font-size:7px}.cal-event.task{background:#fff3df!important}.cal-event.urgent{background:#ffe9ec!important}
 .team-week-cards{display:grid!important;grid-template-columns:repeat(7,1fr)!important;gap:3px!important;min-width:0!important}.team-day-card{border:1px solid #dbe5ed;border-radius:5px;padding:4px;min-height:0!important;break-inside:avoid}.team-agent-entry{display:block!important;border-left:2px solid #2a9d6c;padding:3px;font-size:7px}.agent-entry-avatar,.agent-entry-arrow,.agent-delta{display:none!important}
 .vacation-grid,.periodic-grid,.document-grid,.notes-board,.dashboard-grid,.agent-grid,.report-grid,.settings-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.card,.vacation-card,.note-card,.document-card,.periodic-card{break-inside:avoid;border:1px solid #dbe5ed;border-radius:7px;padding:7px}
 .desktop-table{display:block!important}.mobile-cards{display:none!important}.print-field{display:inline-block;min-width:40px;padding:2px 4px;border:1px solid #d5dde5;border-radius:4px;background:#f8fafc}
 section{break-before:auto}a{color:inherit;text-decoration:none}img{max-width:100%}
 @media print{.filters,.section-actions,.panel-actions,.file-label,.fab,.no-print,input,select,textarea,button:not(.print-data-cell){display:none!important}.panel{box-shadow:none!important}}
 `;
}

function autoSizePrintTables(w){
 try{
  const doc=w.document;
  [...doc.querySelectorAll('table')].forEach(table=>{
   const rows=[...table.rows];
   if(!rows.length)return;
   const colCount=Math.max(...rows.map(r=>r.cells.length||0));
   if(!colCount)return;

   // Colonnes réellement imprimées.
   const visibleCols=[];
   for(let c=0;c<colCount;c++){
    const cells=rows.map(r=>r.cells[c]).filter(Boolean);
    if(cells.some(cell=>w.getComputedStyle(cell).display!=='none'))visibleCols.push(c);
   }
   if(!visibleCols.length)return;

   const scores=visibleCols.map(c=>{
    const cells=rows.slice(0,80).map(r=>r.cells[c]).filter(Boolean);
    const lengths=cells.map(cell=>{
      const text=(cell.innerText||cell.textContent||'').replace(/\s+/g,' ').trim();
      // longueur utile plafonnée : évite qu'une description très longue écrase toutes les colonnes.
      return Math.min(60,Math.max(2,text.length));
    });
    const max=Math.max(2,...lengths);
    const avg=lengths.length?lengths.reduce((s,n)=>s+n,0)/lengths.length:2;
    return Math.max(3,Math.min(32,avg*.65+max*.35));
   });
   const minPct=visibleCols.length>=9?5:visibleCols.length>=7?6:7;
   let widths=scores.map(s=>Math.max(minPct,s));
   const sum=widths.reduce((s,n)=>s+n,0);
   widths=widths.map(n=>n/sum*100);

   // Rééquilibrage : aucune colonne ne peut monopoliser la page.
   const maxPct=visibleCols.length>=9?26:visibleCols.length>=7?30:38;
   let excess=0;
   widths=widths.map(n=>{if(n>maxPct){excess+=n-maxPct;return maxPct}return n});
   if(excess>0){
    const receivers=widths.map((n,i)=>n<maxPct?i:-1).filter(i=>i>=0);
    const capacity=receivers.reduce((s,i)=>s+(maxPct-widths[i]),0);
    if(capacity>0)receivers.forEach(i=>{widths[i]+=excess*((maxPct-widths[i])/capacity)});
   }

   table.style.tableLayout='fixed';
   table.style.width='100%';
   let cg=table.querySelector(':scope > colgroup.pst-auto-print-cols');
   if(!cg){
    cg=doc.createElement('colgroup');cg.className='pst-auto-print-cols';
    table.insertBefore(cg,table.firstChild);
   }
   cg.innerHTML='';
   for(let c=0;c<colCount;c++){
    const col=doc.createElement('col');
    const vi=visibleCols.indexOf(c);
    if(vi>=0)col.style.width=`${widths[vi].toFixed(2)}%`;
    else col.style.width='0';
    cg.appendChild(col);
   }
   table.classList.add('pst-auto-sized-print-table');
  });
 }catch(error){console.warn('Largeur automatique impression',error)}
}

function waitAndPrint(w){
 const run=()=>{try{autoSizePrintTables(w);w.focus();setTimeout(()=>w.print(),80)}catch(e){console.error(e)}};
 const imgs=[...w.document.images];let pending=imgs.filter(x=>!x.complete).length;
 if(!pending){setTimeout(run,250);return}
 imgs.forEach(img=>{if(!img.complete){img.onload=img.onerror=()=>{pending--;if(pending<=0)setTimeout(run,180)}}});
 setTimeout(run,1600);
}
function printReport(type){
 const r=reportData(type),orientation=db.settings.printOrientation||'landscape',w=window.open('','_blank');
 if(!w){toast('Autorisez les fenêtres contextuelles pour imprimer');return}
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.title)}</title><style>${reportPrintCSS(orientation)}</style></head><body><header class="print-header"><img src="${appLogoURL()}"><div><h1>${esc(db.settings.appName)}</h1><p>${esc(db.settings.schoolName)}</p><strong>${esc(r.title)} — ${esc(r.subtitle)}</strong></div></header><main>${r.html}</main><footer class="print-footer">${esc(db.settings.appName)} — V${APP_VERSION} — imprimé le ${new Date().toLocaleString('fr-FR')}</footer></body></html>`);
 w.document.close();waitAndPrint(w);
}
function printableViewHTML(view){
 const clone=view.cloneNode(true);
 if(view.id==='maintenance'){
   const table=clone.querySelector('table');
   if(table){
     table.classList.add('print-maintenance-table');
     const widths=['no','date','location','family','subject','priority','assigned','due','status','action'];
     table.querySelectorAll('tr').forEach(row=>[...row.cells].forEach((cell,i)=>cell.classList.add(`print-col-${widths[i]||i}`)));
   }
 }
 // Les cases de calendriers sont des <button> à l'écran : en impression on les convertit
 // en cellules statiques afin qu'elles ne disparaissent jamais avec les contrôles interactifs.
 clone.querySelectorAll('.month-cell.day-state,.rotation-day').forEach(btn=>{
  if(btn.tagName==='BUTTON'){
   const div=document.createElement('div');div.className=btn.className+' print-data-cell';div.innerHTML=btn.innerHTML;
   for(const a of [...btn.attributes]){if(a.name==='style'||a.name.startsWith('data-'))div.setAttribute(a.name,a.value)}
   btn.replaceWith(div);
  }
 });
 clone.querySelectorAll('button,.filters,.section-actions,.panel-actions,.file-label,.fab').forEach(x=>x.remove());
 const originals=[...view.querySelectorAll('input,select,textarea')],copies=[...clone.querySelectorAll('input,select,textarea')];
 copies.forEach((el,k)=>{const src=originals[k],span=document.createElement('span');span.className='print-field';span.textContent=src?.tagName==='SELECT'?src.options[src.selectedIndex]?.text||'':(src?.value||'');el.replaceWith(span)});
 clone.querySelectorAll('.hidden').forEach(x=>x.remove());return clone.innerHTML;
}
function printView(viewId){
 const view=document.getElementById(viewId)||document.querySelector('.view.active');if(!view)return;
 const orientation=db.settings.printOrientation||'landscape',w=window.open('','_blank');if(!w){toast('Autorisez les fenêtres contextuelles pour imprimer');return}
 const title=VIEW_TITLES[view.id]||'Impression';
 const filterLabels=[...view.querySelectorAll('.filters input,.filters select')].map(el=>{if(el.tagName==='SELECT')return el.options[el.selectedIndex]?.text||'';if(el.type==='month'&&el.value){const [y,m]=el.value.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}if(el.type==='date'&&el.value)return fmtDate(el.value);return el.value||''}).filter(Boolean);
 const subtitle=filterLabels.length?filterLabels.join(' · '):'';
 const days=view.id==='absences'?new Date(Number(($('#absenceMonth').value||monthISO()).slice(0,4)),Number(($('#absenceMonth').value||monthISO()).slice(5,7)),0).getDate():31;
 const specialCss=view.id==='absences'?`.month-grid{grid-template-columns:26mm repeat(${days},1fr)!important}.month-corner,.month-agent{font-size:6.6px!important}.month-day-head,.month-cell.day-state,.month-cell.day-state span{font-size:6px!important;min-height:22px!important}`:'';
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${reportPrintCSS(orientation)}${specialCss}</style></head><body><header class="print-header"><img src="${appLogoURL()}"><div><h1>${esc(db.settings.appName)}</h1><p>${esc(db.settings.schoolName)}</p><strong>${esc(title)}</strong></div></header>${subtitle?`<div class="print-subtitle"><strong>Filtres imprimés :</strong> ${esc(subtitle)}</div>`:''}<main>${printableViewHTML(view)}</main><footer class="print-footer">${esc(db.settings.appName)} — V${APP_VERSION} — imprimé le ${new Date().toLocaleString('fr-FR')}</footer></body></html>`);
 w.document.close();waitAndPrint(w);
}

/* ---------- V58 : PDF planning collectif / individuel ---------- */
function planningDisplayFor(agent,date){
 const info=dayInfo(agent.id,date),day=String(info.dayType||'Présence'),shift=String(info.shift||'').replace('Planning de référence','Standard');
 if(/maladie/i.test(day))return {text:day,shift:day,kind:'sick'};
 if(/congé|conge/i.test(day))return {text:day,shift:day,kind:'leave'};
 if(/rtt/i.test(day))return {text:day,shift:day,kind:'rtt'};
 if(/férié|ferie|rfe/i.test(day))return {text:day,shift:day,kind:'holiday'};
 if(day==='Repos'||isAbsenceType(day))return {text:day||'Repos',shift:day||'Repos',kind:'off'};
 if(day==='Formation')return {text:'Formation',shift:'Formation',kind:'info'};
 const hours=(info.plannedStart&&info.plannedEnd)?`${info.plannedStart}–${info.plannedEnd}`:'Non planifié';
 return {text:hours,shift:shift||'Standard',kind:shift==='Matin'?'morning':shift==='Soir'?'evening':'standard'};
}
function planningPrintCSS(){
 return `${reportPrintCSS('landscape')}.service-title{text-align:center;margin:0 0 12px}.service-title h1{font-size:18px;margin:0;color:#1f2937}.service-title p{margin:3px 0;color:#475569}.service-grid{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9.5px}.service-grid th,.service-grid td{border:1px solid #6b7280;padding:5px 4px;text-align:center;vertical-align:middle}.service-grid th{background:#e5e7eb;color:#111827}.service-grid .agent-col{text-align:left;font-weight:700;width:18%}.service-grid td.shift-morning{background:#dcfce7}.service-grid td.shift-evening{background:#ffedd5}.service-grid td.shift-standard{background:#dbeafe}.service-grid td.shift-off{background:#f3f4f6;color:#6b7280}.legend{display:flex;gap:12px;justify-content:center;margin:8px 0 12px;font-size:9px}.legend span{padding:3px 8px;border-radius:999px;border:1px solid #cbd5e1}.legend .m{background:#dcfce7}.legend .s{background:#ffedd5}.legend .std{background:#dbeafe}.legend .leave{background:#bbf7d0}.legend .rtt{background:#93c5fd}.legend .sick{background:#fecaca}.legend .holiday{background:#fef08a}.legend .off{background:#f3f4f6}.service-grid td.shift-leave{background:#bbf7d0}.service-grid td.shift-rtt{background:#93c5fd}.service-grid td.shift-sick{background:#fecaca}.service-grid td.shift-holiday{background:#fef08a}.individual-grid{border-collapse:collapse;width:100%;font-size:10.5px}.individual-grid th,.individual-grid td{border:1px solid #9ca3af;padding:6px}.individual-grid th{background:#e5e7eb}.agent-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0 14px}.agent-summary div{border:1px solid #cbd5e1;border-radius:6px;padding:7px}.agent-summary small{display:block;color:#64748b}.agent-summary strong{display:block;margin-top:2px}.individual-grid tr.shift-morning td{background:#dcfce7}.individual-grid tr.shift-evening td{background:#ffedd5}.individual-grid tr.shift-standard td{background:#dbeafe}.individual-grid tr.shift-leave td{background:#bbf7d0}.individual-grid tr.shift-rtt td{background:#93c5fd}.individual-grid tr.shift-sick td{background:#fecaca}.individual-grid tr.shift-holiday td{background:#fef08a}.individual-grid tr.shift-off td{background:#f3f4f6;color:#6b7280}`;
}
function openPlanningPrint(title,subtitle,body,orientation='landscape'){
 const w=window.open('','_blank'); if(!w){toast('Autorisez les fenêtres contextuelles pour générer le PDF');return}
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${planningPrintCSS()}</style></head><body><header class="print-header"><img src="${appLogoURL()}"><div><h1>${esc(db.settings.schoolName||db.settings.appName)}</h1><p>${esc(db.settings.appName)}</p><strong>${esc(title)}</strong><p>${esc(subtitle)}</p></div></header>${body}<footer class="print-footer">${esc(db.settings.appName)} — V${APP_VERSION} — généré le ${new Date().toLocaleString('fr-FR')} — année scolaire ${esc(activeAcademicYear())}</footer></body></html>`);
 w.document.close();waitAndPrint(w);
}
function generateCollectivePlanningPDF(){
 const picked=$('#collectivePlanningDate')?.value||todayISO(),start=startOfWeek(picked);
 const active=db.agents.filter(a=>a.status==='Actif');
 // Lundi-vendredi par défaut ; on ajoute samedi/dimanche uniquement si au moins un agent y travaille réellement.
 let dates=[0,1,2,3,4].map(i=>addDays(start,i));
 const weekend=[addDays(start,5),addDays(start,6)];
 for(const d of weekend){if(active.some(a=>{const x=planningDisplayFor(a,d);return x.kind!=='off'&&x.text!=='Non planifié'}))dates.push(d)}
 const head=dates.map(d=>`<th>${parseDate(d).toLocaleDateString('fr-FR',{weekday:'long'})}<br><small>${fmtDate(d)}</small></th>`).join('');
 const rows=active.map(a=>`<tr><td class="agent-col">${esc(agentName(a))}</td>${dates.map(d=>{const x=planningDisplayFor(a,d);return `<td class="shift-${x.kind}"><strong>${esc(x.text)}</strong><br><small>${esc(x.shift)}</small></td>`}).join('')}</tr>`).join('');
 const body=`<div class="service-title"><h1>Service général — Maintenance — Accueil</h1><p>Planning collectif — semaine type</p></div><div class="legend"><span class="std">Standard</span><span class="m">Matin</span><span class="s">Soir</span><span class="leave">Congé</span><span class="rtt">RTT</span><span class="sick">Maladie</span><span class="holiday">Jour férié</span><span class="off">Repos</span></div><table class="service-grid"><thead><tr><th class="agent-col">Agent</th>${head}</tr></thead><tbody>${rows||'<tr><td colspan="8">Aucun agent actif.</td></tr>'}</tbody></table>`;
 openPlanningPrint('Planning collectif',`Du ${fmtDate(dates[0])} au ${fmtDate(dates.at(-1))}`,body,'landscape');
}
function generateIndividualPlanningPDF(){
 const agentId=$('#individualPlanningAgent')?.value,agent=agentById(agentId);if(!agent){toast('Choisissez un agent');return}
 const from=$('#individualPlanningFrom')?.value,to=$('#individualPlanningTo')?.value;if(!from||!to){toast('Choisissez les dates du et au');return}if(to<from){toast('La date de fin doit être après la date de début');return}
 const dates=[];for(let d=from;d<=to;d=addDays(d,1)){dates.push(d);if(dates.length>400)break}
 const rows=dates.map(d=>{const info=dayInfo(agent.id,d),x=planningDisplayFor(agent,d);return `<tr class="shift-${x.kind}"><td>${fmtDate(d)}</td><td>${parseDate(d).toLocaleDateString('fr-FR',{weekday:'long'})}</td><td>${esc(x.shift)}</td><td>${esc(x.text)}</td><td>${esc(info.dayType||'Présence')}</td><td>${esc(info.note||'')}</td></tr>`}).join('');
 const activeR=(db.rotations||[]).filter(r=>String(r.agentId)===String(agent.id)&&(!r.effectiveTo||r.effectiveTo>=from)&&(!r.effectiveFrom||r.effectiveFrom<=to));
 const mode=activeR.length?'Roulement':'Standard';
 const body=`<div class="service-title"><h1>Planning individuel</h1><p>Document à remettre à l’agent</p></div><div class="agent-summary"><div><small>Agent</small><strong>${esc(agentName(agent))}</strong></div><div><small>Période</small><strong>${fmtDate(from)} → ${fmtDate(to)}</strong></div><div><small>Mode horaire</small><strong>${esc(mode)}</strong></div></div><table class="individual-grid"><thead><tr><th>Date</th><th>Jour</th><th>Profil / roulement</th><th>Horaire applicable</th><th>Situation</th><th>Observation</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:18px;font-size:9px;color:#64748b">Pour un agent en roulement, seuls les horaires du roulement réellement applicables à chaque date sont utilisés. Aucun horaire Standard de secours n’est substitué.</p>`;
 openPlanningPrint(`Planning individuel — ${agentName(agent)}`,`Du ${fmtDate(from)} au ${fmtDate(to)} · année scolaire ${activeAcademicYear()}`,body,'landscape');
}

function prepareEmail(type){
 const r=reportData(type),plain=reportPlainText(r);
 $('#mailTo').value=db.settings.emailsTo||'';$('#mailCc').value=db.settings.emailsCc||'';$('#mailBcc').value=db.settings.emailsBcc||'';
 $('#mailSubject').value=`${db.settings.emailSubjectPrefix||db.settings.appName} — ${r.title} — ${r.subtitle}`;
 $('#mailMessage').value=`Bonjour,\n\nVoici le compte rendu préparé depuis ${db.settings.appName}.\n\n${plain}\n\nCordialement.`;
 const d=$('#emailModal');if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
}
async function openMailClient(){
 const to=normalizeEmails($('#mailTo').value),cc=normalizeEmails($('#mailCc').value),bcc=normalizeEmails($('#mailBcc').value),subject=$('#mailSubject').value,body=$('#mailMessage').value;
 const params=new URLSearchParams();if(to)params.set('to',to);if(cc)params.set('cc',cc);if(bcc)params.set('bcc',bcc);params.set('subject',subject);
 // Outlook Web accepte mieux les longs rapports lorsqu'ils sont collés dans le corps après ouverture.
 if(body.length>5000){try{await navigator.clipboard.writeText(body);toast('Message copié : collez-le dans Outlook');window.open(`https://outlook.office.com/mail/deeplink/compose?${params.toString()}`,'_blank','noopener');return}catch(e){console.warn(e)}}
 location.href=`mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(cc)}&bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function csvEscape(v){v=String(v??'');return /[;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v}
function triggerDownloadBlob(name,blob){
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener';a.target='_blank';a.style.display='none';document.body.appendChild(a);
 let automatic=false;try{a.click();automatic=true}catch(error){console.warn('Téléchargement automatique bloqué',error)}
 let box=document.getElementById('downloadFallbackBox');
 if(!box){box=document.createElement('div');box.id='downloadFallbackBox';box.className='download-ready-panel';document.body.appendChild(box)}
 box.innerHTML='';
 const text=document.createElement('div');text.className='download-ready-text';text.innerHTML=`<strong>Fichier prêt</strong><small>${esc(name)}</small>`;
 const actions=document.createElement('div');actions.className='download-ready-actions';
 const link=document.createElement('a');link.href=url;link.download=name;link.target='_blank';link.rel='noopener';link.className='download-ready-link';link.textContent='⬇️ Télécharger maintenant';
 actions.appendChild(link);
 if(navigator.share&&typeof File!=='undefined'){
  const share=document.createElement('button');share.type='button';share.className='download-share';share.textContent='Partager / enregistrer';
  share.onclick=async()=>{try{const file=new File([blob],name,{type:blob.type||'application/octet-stream'});if(!navigator.canShare||navigator.canShare({files:[file]}))await navigator.share({files:[file],title:name})}catch(error){if(error?.name!=='AbortError')console.warn('Partage impossible',error)}};
  actions.appendChild(share);
 }
 const close=document.createElement('button');close.type='button';close.className='download-ready-close';close.textContent='×';close.onclick=()=>box.remove();
 box.append(text,actions,close);
 setTimeout(()=>a.remove(),1000);
 // L'URL reste disponible 10 minutes afin que l'utilisateur puisse toucher le bouton sur mobile.
 setTimeout(()=>{URL.revokeObjectURL(url);if(document.body.contains(box))box.remove()},600000);
 return automatic;
}
function downloadText(name,text,type='text/plain;charset=utf-8'){
 const blob=new Blob(['\ufeff',text],{type});return triggerDownloadBlob(name,blob);
}

function exportAcademicRange(){
  return academicYearRange(activeAcademicYear());
}
function exportDateOfRecord(x){
  return normalizeDateValue(
    x?.date || x?.start || x?.dateFrom || x?.dueDate || x?.createdAt ||
    x?.injectedAt || x?.reportDate || x?.effectiveFrom || x?.updatedAt || ''
  );
}
function exportRecordInActiveAcademicYear(x){
  const r=exportAcademicRange();
  const d=exportDateOfRecord(x);
  if(!d)return true;
  return d>=r.start&&d<=r.end;
}
function exportRowsForAcademicYear(rows){
  return (Array.isArray(rows)?rows:[]).filter(exportRecordInActiveAcademicYear);
}

function exportStyledExcel(module){
 const titles={agents:'Agents',agentDays:'Horaires, congés et absences',rotations:'Roulements',weeklyPlans:'Horaires hebdomadaires',cleaning:'Contrôles ménage',maintenance:'Maintenance',requests:'Demandes direction',works:'Chantiers et GPA',meetings:'Réunions',issues:'Sécurité et qualité',periodic:'Contrôles périodiques',notes:'Bloc-notes',vacations:'Vacances',documents:'Documentation'};
 const map={agents:[['Prénom','firstName'],['Nom','lastName'],['Fonction','role'],['Heures / semaine','weeklyHours'],['Affectation','assignment'],['Statut','status']],agentDays:[['Date','date'],['Agent','agentId'],['Journée','dayType'],['Début prévu','plannedStart'],['Fin prévue','plannedEnd'],['Début réel','actualStart'],['Fin réelle','actualEnd'],['Pause','pause'],['Heures +/-','overtime'],['Statut','status'],['Note','note']],rotations:[['Agent','agentId'],['Date d’effet','effectiveFrom'],['Commence par','startShift'],['Semaines matin','morningWeeks'],['Semaines soir','eveningWeeks'],['Fin','effectiveTo'],['Notes','notes']],cleaning:[['N°','no'],['Date','date'],['Bâtiment','building'],['Étage','floor'],['Zone','roomType'],['Local','room'],['Agent','agentId'],['Score','score'],['Résultat','overallStatus'],['Commentaire','comment']],maintenance:[['N°','no'],['Date','date'],['Titre','title'],['Domaine','family'],['Priorité','priority'],['Statut','status'],['Lieu','room'],['Affecté à','assigned'],['Échéance','dueDate'],['Action','action']],requests:[['N°','no'],['Date','date'],['Type','type'],['Titre','title'],['Priorité','priority'],['Statut','status'],['Lieu','room'],['Demandeur','requester'],['Échéance','dueDate']],works:[['N°','no'],['Date','date'],['Type','type'],['Titre','title'],['Entreprise','company'],['Bâtiment','building'],['Statut','status'],['Échéance','dueDate'],['Fin GPA','gpaEnd']],meetings:[['N°','no'],['Date','date'],['Heure','time'],['Type','type'],['Titre','title'],['Lieu','location'],['Participants','participants'],['Statut','status']],issues:[['N°','no'],['Date','date'],['Catégorie','category'],['Agent','agentId'],['Titre','title'],['Priorité','priority'],['Statut','status'],['Échéance','dueDate'],['Action','action']],periodic:[['N°','no'],['Contrôle','name'],['Famille','family'],['Périodicité (mois)','intervalMonths'],['Périodicité / précision','periodicityText'],['Bâtiment','building'],['Dernier contrôle','lastDate'],['Prochaine date','nextDate'],['Statut','status'],['Prestataire','provider']],notes:[['N°','no'],['Date','date'],['Catégorie','category'],['Titre','title'],['Priorité','priority'],['Statut','status'],['Échéance','dueDate'],['Texte','text']],vacations:[['Période','name'],['Zone','zone'],['Début','start'],['Fin','end'],['Statut','status'],['Notes','notes']],documents:[['N°','no'],['Date','date'],['Titre','title'],['Catégorie','category'],['Module','linkedModule'],['Description','description']]};
 let defs=map[module]||[],rows=db[module]||[];
 if(module==='weeklyPlans'){defs=[['Agent','agent'],['Profil','shift'],['Lundi','d1'],['Mardi','d2'],['Mercredi','d3'],['Jeudi','d4'],['Vendredi','d5']];rows=(db.weeklyPlans||[]).map(p=>{const r={agent:agentName(agentById(p.agentId))||p.agent,shift:p.shift};for(let d=1;d<=5;d++){const x=p.dayProfiles?.[d]||{};r['d'+d]=x.start&&x.end?`${x.start}-${x.end} — ${x.missions||''}`:'Repos'}return r})}
 const value=(r,k)=>k==='agentId'?agentName(agentById(r[k])):(r[k]??'');
 const aoa=[[titles[module]||module],[`Pilotage Service Technique — export du ${new Date().toLocaleString('fr-FR')}`],[],defs.map(d=>d[0]),...rows.map(r=>defs.map(d=>value(r,d[1])))];
 const filename=`${(titles[module]||module).replace(/\s+/g,'_')}_${todayISO()}.xlsx_${activeAcademicYear()}`;
 if(window.XLSX){
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=defs.map((d,i)=>({wch:Math.min(45,Math.max(12,d[0].length+4,...rows.slice(0,100).map(r=>String(value(r,d[1])??'').length+2)))}));
  ws['!autofilter']={ref:`A4:${XLSX.utils.encode_col(Math.max(0,defs.length-1))}${Math.max(4,rows.length+4)}`};
  XLSX.utils.book_append_sheet(wb,ws,(titles[module]||'Rapport').slice(0,31));
  const data=XLSX.write(wb,{bookType:'xlsx',type:'array',compression:true});
  triggerDownloadBlob(filename,new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 }else{
  const csv=aoa.map(row=>row.map(csvEscape).join(';')).join('\n');downloadText(filename.replace('.xlsx','.csv'),csv,'text/csv;charset=utf-8');
 }
 toast('Fichier prêt — touchez « Télécharger maintenant »');
}
function exportCSV(module){const map={agents:['firstName','lastName','role','weeklyHours','email','phone','assignment','status'],agentDays:['date','agentId','dayType','plannedStart','plannedEnd','actualStart','actualEnd','pause','overtime','status','note'],cleaning:['no','date','time','building','floor','roomType','room','agentId','score','overallStatus','comment'],maintenance:['no','date','title','family','priority','status','building','floor','room','requester','assigned','dueDate','cost','description','action'],requests:['no','date','type','title','priority','status','building','room','requester','dueDate','description','response'],works:['no','date','type','title','company','architect','building','priority','status','dueDate','gpaEnd','description','decision'],meetings:['no','date','time','end','type','title','location','participants','status','notes','actions'],issues:['no','date','category','agentId','title','priority','status','owner','dueDate','cost','description','action'],periodic:['no','name','family','intervalMonths','periodicityText','building','floor','sector','room','lastDate','nextDate','status','provider','register','requirement','notes'],notes:['no','date','category','agentId','title','priority','status','dueDate','text'],vacations:['name','zone','start','end','status','notes'],documents:['no','date','title','category','linkedModule','description']};const keys=map[module]||Object.keys(db[module]?.[0]||{}).filter(k=>!['id','attachments','tasks','items'].includes(k)),rows=db[module]||[];downloadText(`${module}-${todayISO()}.csv`,[keys.join(';'),...rows.map(r=>keys.map(k=>csvEscape(k==='agentId'?agentName(agentById(r[k])):r[k])).join(';'))].join('\n'),'text/csv;charset=utf-8')}
/* ---------- Initialisation des listes et rendu global ---------- */
function fillSelect(id,items,keep=true){const e=document.getElementById(id);if(!e)return;const old=keep?e.value:'';const first=e.querySelector('option[value=""]')?.outerHTML||'';e.innerHTML=first+selectOptions(items,old)}
function hydrateSelects(){fillSelect('personalType',db.lists.personalTypes);fillSelect('personalStatus',db.lists.generalStatuses);for(const id of ['rotationAgent','planningAgent','absenceAgent','issueAgent']){const e=$(`#${id}`);if(e){const old=e.value;e.innerHTML='<option value="">Tous les agents</option>'+agentOptions(old).replace('<option value="">Choisir un agent</option>','')}}fillSelect('planningSignal',['Conforme','Heures supplémentaires','Heures manquantes','Absence']);fillSelect('absenceType',db.lists.dayTypes.filter(isAbsenceType));fillSelect('absenceStatus',['Demandée','Validée','Refusée','Annulée']);fillSelect('issueCategory',db.lists.issueCategories);fillSelect('issueStatus',db.lists.generalStatuses);fillSelect('periodicFamily',db.lists.periodicFamilies);fillSelect('periodicStatus',['À jour','Bientôt','En retard','À planifier','Planifié','Réalisé','Clôturé','En attente','Non applicable']);const pb=$('#periodicBuilding');if(pb){const old=pb.value;pb.innerHTML='<option value="">Tous les bâtiments</option>'+buildingOptions(old)}const cb=$('#cleanBuilding');if(cb){const old=cb.value;cb.innerHTML='<option value="">Tous les bâtiments</option>'+buildingOptions(old)}fillSelect('cleanRoomType',db.lists.roomTypes);fillSelect('cleanStatus',db.lists.cleaningStatuses);fillSelect('cleaningGuideType',Object.keys(GUIDE));fillSelect('maintenanceStatus',db.lists.maintenanceStatuses);fillSelect('maintenancePriority',db.lists.priorities);fillSelect('maintenanceFamily',db.lists.maintenanceFamilies);fillSelect('requestStatus',db.lists.generalStatuses);fillSelect('requestType',db.lists.requestTypes);fillSelect('workStatus',db.lists.generalStatuses);fillSelect('workType',db.lists.workTypes);fillSelect('meetingType',db.lists.meetingTypes);fillSelect('noteCategory',db.lists.noteCategories);fillSelect('notePriority',db.lists.priorities);fillSelect('noteStatus',db.lists.generalStatuses);fillSelect('documentCategory',db.lists.documentCategories);const vp=$('#vacationReportPeriod');if(vp){const old=vp.value;vp.innerHTML=selectOptions(db.vacations,old,x=>`${x.name} — ${fmtDate(x.start)}`,x=>x.id)}const csv=$('#csvModule');if(csv){const opts=[['agents','Agents'],['agentDays','Horaires, congés et absences'],['cleaning','Contrôles ménage'],['maintenance','Maintenance'],['requests','Demandes direction'],['works','Chantiers / GPA'],['meetings','Réunions'],['issues','Sécurité / qualité'],['periodic','Contrôles périodiques'],['notes','Notes'],['vacations','Vacances'],['documents','Documents']];const old=csv.value;csv.innerHTML=selectOptions(opts,old,x=>x[1],x=>x[0])}}
function renderReportPreview(){if(!$('#reportPreview'))return;const r=reportData('daily');$('#reportPreview').innerHTML=`<h3>${esc(r.title)} — ${esc(r.subtitle)}</h3>${r.html}`}

const DAILY_MOTIVATION_SAYINGS=["Chaque jour fait avancer quand on garde le cap.","Chaque jour simplifie le chemin quand on ne lâche pas l’objectif.","Chaque jour construit du solide quand on apprend de chaque étape.","Un petit pas ouvre la voie quand on avance avec méthode.","Un petit pas transforme l’effort quand on transforme les difficultés en étapes.","Un petit pas fait gagner du temps quand on choisit d’avancer.","La constance renforce le résultat quand on reste concentré sur l’essentiel.","La constance prépare la réussite quand on fait simplement le prochain pas utile.","La constance rend l’objectif plus proche quand on travaille avec soin.","Le courage simplifie le chemin quand on agit avec régularité.","Le courage construit du solide quand on garde le cap.","La patience fait avancer quand on ne lâche pas l’objectif.","La patience transforme l’effort quand on apprend de chaque étape.","La patience fait gagner du temps quand on avance avec méthode.","L’attention ouvre la voie quand on transforme les difficultés en étapes.","L’attention prépare la réussite quand on choisit d’avancer.","L’attention rend l’objectif plus proche quand on reste concentré sur l’essentiel.","Une bonne méthode renforce le résultat quand on fait simplement le prochain pas utile.","Une bonne méthode donne de l’élan quand on travaille avec soin.","Le travail régulier fait avancer quand on agit avec régularité.","Le travail régulier transforme l’effort quand on garde le cap.","Le travail régulier construit du solide quand on ne lâche pas l’objectif.","La persévérance ouvre la voie quand on apprend de chaque étape.","La persévérance prépare la réussite quand on avance avec méthode.","La persévérance fait gagner du temps quand on transforme les difficultés en étapes.","Une priorité claire renforce le résultat quand on choisit d’avancer.","Une priorité claire donne de l’élan quand on reste concentré sur l’essentiel.","Une priorité claire rend l’objectif plus proche quand on fait simplement le prochain pas utile.","Le calme simplifie le chemin quand on travaille avec soin.","Le calme construit du solide quand on agit avec régularité.","L’organisation ouvre la voie quand on garde le cap.","L’organisation transforme l’effort quand on ne lâche pas l’objectif.","L’organisation fait gagner du temps quand on apprend de chaque étape.","Chaque effort renforce le résultat quand on avance avec méthode.","Chaque effort prépare la réussite quand on transforme les difficultés en étapes.","Chaque effort rend l’objectif plus proche quand on choisit d’avancer.","Une solution simplifie le chemin quand on reste concentré sur l’essentiel.","Une solution donne de l’élan quand on fait simplement le prochain pas utile.","Le progrès fait avancer quand on travaille avec soin.","Le progrès transforme l’effort quand on agit avec régularité.","Le progrès fait gagner du temps quand on garde le cap.","Chaque jour ouvre la voie quand on ne lâche pas l’objectif.","Chaque jour prépare la réussite quand on apprend de chaque étape.","Chaque jour rend l’objectif plus proche quand on avance avec méthode.","Un petit pas renforce le résultat quand on transforme les difficultés en étapes.","Un petit pas donne de l’élan quand on choisit d’avancer.","La constance fait avancer quand on reste concentré sur l’essentiel.","La constance simplifie le chemin quand on fait simplement le prochain pas utile.","La constance construit du solide quand on travaille avec soin.","Le courage ouvre la voie quand on agit avec régularité.","Le courage prépare la réussite quand on garde le cap.","Le courage fait gagner du temps quand on ne lâche pas l’objectif.","La patience renforce le résultat quand on apprend de chaque étape.","La patience donne de l’élan quand on avance avec méthode.","La patience rend l’objectif plus proche quand on transforme les difficultés en étapes.","L’attention simplifie le chemin quand on choisit d’avancer.","L’attention construit du solide quand on reste concentré sur l’essentiel.","Une bonne méthode fait avancer quand on fait simplement le prochain pas utile.","Une bonne méthode transforme l’effort quand on travaille avec soin.","Une bonne méthode fait gagner du temps quand on agit avec régularité.","Le travail régulier renforce le résultat quand on garde le cap.","Le travail régulier prépare la réussite quand on ne lâche pas l’objectif.","Le travail régulier rend l’objectif plus proche quand on apprend de chaque étape.","La persévérance simplifie le chemin quand on avance avec méthode.","La persévérance donne de l’élan quand on transforme les difficultés en étapes.","Une priorité claire fait avancer quand on choisit d’avancer.","Une priorité claire transforme l’effort quand on reste concentré sur l’essentiel.","Une priorité claire construit du solide quand on fait simplement le prochain pas utile.","Le calme ouvre la voie quand on travaille avec soin.","Le calme prépare la réussite quand on agit avec régularité.","Le calme rend l’objectif plus proche quand on garde le cap.","L’organisation renforce le résultat quand on ne lâche pas l’objectif.","L’organisation donne de l’élan quand on apprend de chaque étape.","Chaque effort fait avancer quand on avance avec méthode.","Chaque effort simplifie le chemin quand on transforme les difficultés en étapes.","Chaque effort construit du solide quand on choisit d’avancer.","Une solution ouvre la voie quand on reste concentré sur l’essentiel.","Une solution transforme l’effort quand on fait simplement le prochain pas utile.","Une solution fait gagner du temps quand on travaille avec soin.","Le progrès renforce le résultat quand on agit avec régularité.","Le progrès donne de l’élan quand on garde le cap.","Le progrès rend l’objectif plus proche quand on ne lâche pas l’objectif.","Chaque jour simplifie le chemin quand on apprend de chaque étape.","Chaque jour construit du solide quand on avance avec méthode.","Un petit pas fait avancer quand on transforme les difficultés en étapes.","Un petit pas transforme l’effort quand on choisit d’avancer.","Un petit pas fait gagner du temps quand on reste concentré sur l’essentiel.","La constance ouvre la voie quand on fait simplement le prochain pas utile.","La constance prépare la réussite quand on travaille avec soin.","La constance rend l’objectif plus proche quand on agit avec régularité.","Le courage simplifie le chemin quand on garde le cap.","Le courage donne de l’élan quand on ne lâche pas l’objectif.","La patience fait avancer quand on apprend de chaque étape.","La patience transforme l’effort quand on avance avec méthode.","La patience construit du solide quand on transforme les difficultés en étapes.","L’attention ouvre la voie quand on choisit d’avancer.","L’attention prépare la réussite quand on reste concentré sur l’essentiel.","L’attention fait gagner du temps quand on fait simplement le prochain pas utile.","Une bonne méthode renforce le résultat quand on travaille avec soin.","Une bonne méthode donne de l’élan quand on agit avec régularité.","Le travail régulier fait avancer quand on garde le cap.","Le travail régulier simplifie le chemin quand on ne lâche pas l’objectif.","Le travail régulier construit du solide quand on apprend de chaque étape.","La persévérance ouvre la voie quand on avance avec méthode.","La persévérance transforme l’effort quand on transforme les difficultés en étapes.","La persévérance fait gagner du temps quand on choisit d’avancer.","Une priorité claire renforce le résultat quand on reste concentré sur l’essentiel.","Une priorité claire prépare la réussite quand on fait simplement le prochain pas utile.","Une priorité claire rend l’objectif plus proche quand on travaille avec soin.","Le calme simplifie le chemin quand on agit avec régularité.","Le calme construit du solide quand on garde le cap.","L’organisation fait avancer quand on ne lâche pas l’objectif.","L’organisation transforme l’effort quand on apprend de chaque étape.","L’organisation fait gagner du temps quand on avance avec méthode.","Chaque effort ouvre la voie quand on transforme les difficultés en étapes.","Chaque effort prépare la réussite quand on choisit d’avancer.","Chaque effort rend l’objectif plus proche quand on reste concentré sur l’essentiel.","Une solution renforce le résultat quand on fait simplement le prochain pas utile.","Une solution donne de l’élan quand on travaille avec soin.","Le progrès fait avancer quand on agit avec régularité.","Le progrès transforme l’effort quand on garde le cap.","Le progrès construit du solide quand on ne lâche pas l’objectif.","Chaque jour ouvre la voie quand on apprend de chaque étape.","Chaque jour prépare la réussite quand on avance avec méthode.","Chaque jour fait gagner du temps quand on transforme les difficultés en étapes.","Un petit pas renforce le résultat quand on choisit d’avancer.","Un petit pas donne de l’élan quand on reste concentré sur l’essentiel.","Un petit pas rend l’objectif plus proche quand on fait simplement le prochain pas utile.","La constance simplifie le chemin quand on travaille avec soin.","La constance construit du solide quand on agit avec régularité.","Le courage ouvre la voie quand on garde le cap.","Le courage transforme l’effort quand on ne lâche pas l’objectif.","Le courage fait gagner du temps quand on apprend de chaque étape.","La patience renforce le résultat quand on avance avec méthode.","La patience prépare la réussite quand on transforme les difficultés en étapes.","La patience rend l’objectif plus proche quand on choisit d’avancer.","L’attention simplifie le chemin quand on reste concentré sur l’essentiel.","L’attention donne de l’élan quand on fait simplement le prochain pas utile.","Une bonne méthode fait avancer quand on travaille avec soin.","Une bonne méthode transforme l’effort quand on agit avec régularité.","Une bonne méthode fait gagner du temps quand on garde le cap.","Le travail régulier ouvre la voie quand on ne lâche pas l’objectif.","Le travail régulier prépare la réussite quand on apprend de chaque étape.","Le travail régulier rend l’objectif plus proche quand on avance avec méthode.","La persévérance renforce le résultat quand on transforme les difficultés en étapes.","La persévérance donne de l’élan quand on choisit d’avancer.","Une priorité claire fait avancer quand on reste concentré sur l’essentiel.","Une priorité claire simplifie le chemin quand on fait simplement le prochain pas utile.","Une priorité claire construit du solide quand on travaille avec soin.","Le calme ouvre la voie quand on agit avec régularité.","Le calme prépare la réussite quand on garde le cap.","Le calme fait gagner du temps quand on ne lâche pas l’objectif.","L’organisation renforce le résultat quand on apprend de chaque étape.","L’organisation donne de l’élan quand on avance avec méthode.","L’organisation rend l’objectif plus proche quand on transforme les difficultés en étapes.","Chaque effort simplifie le chemin quand on choisit d’avancer.","Chaque effort construit du solide quand on reste concentré sur l’essentiel.","Une solution fait avancer quand on fait simplement le prochain pas utile.","Une solution transforme l’effort quand on travaille avec soin.","Une solution fait gagner du temps quand on agit avec régularité.","Le progrès renforce le résultat quand on garde le cap.","Le progrès prépare la réussite quand on ne lâche pas l’objectif.","Le progrès rend l’objectif plus proche quand on apprend de chaque étape.","Chaque jour simplifie le chemin quand on avance avec méthode.","Chaque jour donne de l’élan quand on transforme les difficultés en étapes.","Un petit pas fait avancer quand on choisit d’avancer.","Un petit pas transforme l’effort quand on reste concentré sur l’essentiel.","Un petit pas construit du solide quand on fait simplement le prochain pas utile.","La constance ouvre la voie quand on travaille avec soin.","La constance prépare la réussite quand on agit avec régularité.","La constance rend l’objectif plus proche quand on garde le cap.","Le courage renforce le résultat quand on ne lâche pas l’objectif.","Le courage donne de l’élan quand on apprend de chaque étape.","La patience fait avancer quand on avance avec méthode.","La patience simplifie le chemin quand on transforme les difficultés en étapes.","La patience construit du solide quand on choisit d’avancer.","L’attention ouvre la voie quand on reste concentré sur l’essentiel.","L’attention transforme l’effort quand on fait simplement le prochain pas utile.","L’attention fait gagner du temps quand on travaille avec soin.","Une bonne méthode renforce le résultat quand on agit avec régularité.","Une bonne méthode donne de l’élan quand on garde le cap.","Une bonne méthode rend l’objectif plus proche quand on ne lâche pas l’objectif.","Le travail régulier simplifie le chemin quand on apprend de chaque étape.","Le travail régulier construit du solide quand on avance avec méthode.","La persévérance fait avancer quand on transforme les difficultés en étapes.","La persévérance transforme l’effort quand on choisit d’avancer.","La persévérance fait gagner du temps quand on reste concentré sur l’essentiel.","Une priorité claire ouvre la voie quand on fait simplement le prochain pas utile.","Une priorité claire prépare la réussite quand on travaille avec soin.","Une priorité claire rend l’objectif plus proche quand on agit avec régularité.","Le calme simplifie le chemin quand on garde le cap.","Le calme donne de l’élan quand on ne lâche pas l’objectif.","L’organisation fait avancer quand on apprend de chaque étape.","L’organisation transforme l’effort quand on avance avec méthode.","L’organisation construit du solide quand on transforme les difficultés en étapes.","Chaque effort ouvre la voie quand on choisit d’avancer.","Chaque effort prépare la réussite quand on reste concentré sur l’essentiel.","Chaque effort fait gagner du temps quand on fait simplement le prochain pas utile.","Une solution renforce le résultat quand on travaille avec soin.","Une solution donne de l’élan quand on agit avec régularité.","Le progrès fait avancer quand on garde le cap.","Le progrès simplifie le chemin quand on ne lâche pas l’objectif.","Le progrès construit du solide quand on apprend de chaque étape.","Chaque jour ouvre la voie quand on avance avec méthode.","Chaque jour transforme l’effort quand on transforme les difficultés en étapes.","Chaque jour fait gagner du temps quand on choisit d’avancer.","Un petit pas renforce le résultat quand on reste concentré sur l’essentiel.","Un petit pas prépare la réussite quand on fait simplement le prochain pas utile.","Un petit pas rend l’objectif plus proche quand on travaille avec soin.","La constance simplifie le chemin quand on agit avec régularité.","La constance construit du solide quand on garde le cap.","Le courage fait avancer quand on ne lâche pas l’objectif.","Le courage transforme l’effort quand on apprend de chaque étape.","Le courage fait gagner du temps quand on avance avec méthode.","La patience ouvre la voie quand on transforme les difficultés en étapes.","La patience prépare la réussite quand on choisit d’avancer.","La patience rend l’objectif plus proche quand on reste concentré sur l’essentiel.","L’attention renforce le résultat quand on fait simplement le prochain pas utile.","L’attention donne de l’élan quand on travaille avec soin.","Une bonne méthode fait avancer quand on agit avec régularité.","Une bonne méthode transforme l’effort quand on garde le cap.","Une bonne méthode construit du solide quand on ne lâche pas l’objectif.","Le travail régulier ouvre la voie quand on apprend de chaque étape.","Le travail régulier prépare la réussite quand on avance avec méthode.","Le travail régulier fait gagner du temps quand on transforme les difficultés en étapes.","La persévérance renforce le résultat quand on choisit d’avancer.","La persévérance donne de l’élan quand on reste concentré sur l’essentiel.","La persévérance rend l’objectif plus proche quand on fait simplement le prochain pas utile.","Une priorité claire simplifie le chemin quand on travaille avec soin.","Une priorité claire construit du solide quand on agit avec régularité.","Le calme ouvre la voie quand on garde le cap.","Le calme transforme l’effort quand on ne lâche pas l’objectif.","Le calme fait gagner du temps quand on apprend de chaque étape.","L’organisation renforce le résultat quand on avance avec méthode.","L’organisation prépare la réussite quand on transforme les difficultés en étapes.","L’organisation rend l’objectif plus proche quand on choisit d’avancer.","Chaque effort simplifie le chemin quand on reste concentré sur l’essentiel.","Chaque effort donne de l’élan quand on fait simplement le prochain pas utile.","Une solution fait avancer quand on travaille avec soin.","Une solution transforme l’effort quand on agit avec régularité.","Une solution fait gagner du temps quand on garde le cap.","Le progrès ouvre la voie quand on ne lâche pas l’objectif.","Le progrès prépare la réussite quand on apprend de chaque étape.","Le progrès rend l’objectif plus proche quand on avance avec méthode.","Chaque jour renforce le résultat quand on transforme les difficultés en étapes.","Chaque jour donne de l’élan quand on choisit d’avancer.","Un petit pas fait avancer quand on reste concentré sur l’essentiel.","Un petit pas simplifie le chemin quand on fait simplement le prochain pas utile.","Un petit pas construit du solide quand on travaille avec soin.","La constance ouvre la voie quand on agit avec régularité.","La constance prépare la réussite quand on garde le cap.","La constance fait gagner du temps quand on ne lâche pas l’objectif.","Le courage renforce le résultat quand on apprend de chaque étape.","Le courage donne de l’élan quand on avance avec méthode.","Le courage rend l’objectif plus proche quand on transforme les difficultés en étapes.","La patience simplifie le chemin quand on choisit d’avancer.","La patience construit du solide quand on reste concentré sur l’essentiel.","L’attention fait avancer quand on fait simplement le prochain pas utile.","L’attention transforme l’effort quand on travaille avec soin.","L’attention fait gagner du temps quand on agit avec régularité.","Une bonne méthode renforce le résultat quand on garde le cap.","Une bonne méthode prépare la réussite quand on ne lâche pas l’objectif.","Une bonne méthode rend l’objectif plus proche quand on apprend de chaque étape.","Le travail régulier simplifie le chemin quand on avance avec méthode.","Le travail régulier donne de l’élan quand on transforme les difficultés en étapes.","La persévérance fait avancer quand on choisit d’avancer.","La persévérance transforme l’effort quand on reste concentré sur l’essentiel.","La persévérance construit du solide quand on fait simplement le prochain pas utile.","Une priorité claire ouvre la voie quand on travaille avec soin.","Une priorité claire prépare la réussite quand on agit avec régularité.","Une priorité claire rend l’objectif plus proche quand on garde le cap.","Le calme renforce le résultat quand on ne lâche pas l’objectif.","Le calme donne de l’élan quand on apprend de chaque étape.","L’organisation fait avancer quand on avance avec méthode.","L’organisation simplifie le chemin quand on transforme les difficultés en étapes.","L’organisation construit du solide quand on choisit d’avancer.","Chaque effort ouvre la voie quand on reste concentré sur l’essentiel.","Chaque effort transforme l’effort quand on fait simplement le prochain pas utile.","Chaque effort fait gagner du temps quand on travaille avec soin.","Une solution renforce le résultat quand on agit avec régularité.","Une solution donne de l’élan quand on garde le cap.","Une solution rend l’objectif plus proche quand on ne lâche pas l’objectif.","Le progrès simplifie le chemin quand on apprend de chaque étape.","Le progrès construit du solide quand on avance avec méthode.","Chaque jour fait avancer quand on transforme les difficultés en étapes.","Chaque jour transforme l’effort quand on choisit d’avancer.","Chaque jour fait gagner du temps quand on reste concentré sur l’essentiel.","Un petit pas ouvre la voie quand on fait simplement le prochain pas utile.","Un petit pas prépare la réussite quand on travaille avec soin.","Un petit pas rend l’objectif plus proche quand on agit avec régularité.","La constance simplifie le chemin quand on garde le cap.","La constance donne de l’élan quand on ne lâche pas l’objectif.","Le courage fait avancer quand on apprend de chaque étape.","Le courage transforme l’effort quand on avance avec méthode.","Le courage construit du solide quand on transforme les difficultés en étapes.","La patience ouvre la voie quand on choisit d’avancer.","La patience prépare la réussite quand on reste concentré sur l’essentiel.","La patience fait gagner du temps quand on fait simplement le prochain pas utile.","L’attention renforce le résultat quand on travaille avec soin.","L’attention donne de l’élan quand on agit avec régularité."];
function renderDailyMotivation(){
 const el=document.getElementById('dailyMotivation');
 if(!el||!DAILY_MOTIVATION_SAYINGS.length)return;
 const now=new Date();
 // Index basé sur la date locale : même dicton toute la journée, changement à minuit.
 const dayKey=Math.floor(new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()/86400000);
 const index=((dayKey%DAILY_MOTIVATION_SAYINGS.length)+DAILY_MOTIVATION_SAYINGS.length)%DAILY_MOTIVATION_SAYINGS.length;
 el.textContent=DAILY_MOTIVATION_SAYINGS[index];
 el.title='Dicton motivation du jour';
}

function renderBrand(){renderDailyMotivation();secureAppLogos();document.title=`${db.settings.appName} — V${APP_VERSION}`;$('#brandAppName').textContent=db.settings.appName;$('#brandSchoolName').textContent=db.settings.schoolName;$('#welcomeTitle').textContent=db.settings.appName;$('#today').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});document.documentElement.style.setProperty('--print-orientation',db.settings.printOrientation||'landscape');for(const id of ['authVersion','sidebarVersion','aboutVersion']){const el=document.getElementById(id);if(el)el.textContent=`Version ${APP_VERSION} — ${APP_BUILD}`}}

// V147.15 — mémoire réelle des positions horizontales, y compris si le DOM est recréé.
const pstPlanningScrollMemory={};
function pstScrollKey(el,index=0){
  if(el.dataset?.scrollKey)return el.dataset.scrollKey;
  if(el.id)return `id:${el.id}`;
  const month=el.closest?.('.rotation-month')?.querySelector?.('strong')?.textContent?.trim();
  if(month)return `rotation-month:${month}`;
  const view=el.closest?.('.view')?.id||el.closest?.('section[id]')?.id||'planning';
  const cls=[...el.classList||[]].sort().join('.');
  return `${view}:${cls}:${index}`;
}
function capturePlanningScroll(){
  const els=[
    ...document.querySelectorAll(
      '#rotationPreview,#rotationPreview .rotation-month>div,#absenceMonthBoard,'+
      '#weeklyPlansBoard,#scheduleImportPreview,#planning .table-wrap,'+
      '#rotations .table-wrap,#absences .table-wrap,.month-grid'
    )
  ];
  els.forEach((el,i)=>{
    if(el.scrollWidth>el.clientWidth+2){
      pstPlanningScrollMemory[pstScrollKey(el,i)]=el.scrollLeft||0;
    }
  });
}
function restorePlanningScroll(){
  requestAnimationFrame(()=>{
    const els=[
      ...document.querySelectorAll(
        '#rotationPreview,#rotationPreview .rotation-month>div,#absenceMonthBoard,'+
        '#weeklyPlansBoard,#scheduleImportPreview,#planning .table-wrap,'+
        '#rotations .table-wrap,#absences .table-wrap,.month-grid'
      )
    ];
    els.forEach((el,i)=>{
      const key=pstScrollKey(el,i),x=pstPlanningScrollMemory[key];
      if(Number.isFinite(x))el.scrollLeft=x;
    });
  });
}
document.addEventListener('scroll',e=>{
  const el=e.target;
  if(!(el instanceof HTMLElement))return;
  if(el.scrollWidth<=el.clientWidth+2)return;
  if(!el.closest('#planning,#rotations,#absences,#scheduleImportPreview,#rotationPreview,#absenceMonthBoard'))return;
  const candidates=[...document.querySelectorAll(
    '#rotationPreview,#rotationPreview .rotation-month>div,#absenceMonthBoard,'+
    '#weeklyPlansBoard,#scheduleImportPreview,#planning .table-wrap,'+
    '#rotations .table-wrap,#absences .table-wrap,.month-grid'
  )];
  const i=Math.max(0,candidates.indexOf(el));
  pstPlanningScrollMemory[pstScrollKey(el,i)]=el.scrollLeft||0;
},true);



function auditMaintenanceCounts(){
 const rows=db.maintenance||[];
 const byStatus=rows.reduce((acc,x)=>{const k=String(x.status||'Sans statut').trim()||'Sans statut';acc[k]=(acc[k]||0)+1;return acc},{});
 const result={afficheTableauDeBord:rows.filter(x=>!isClosedStatus(x.status)).length,totalBase:rows.length,aFaire:rows.filter(x=>normalizeText(x.status)==='a faire').length,exclusTerminesClotures:rows.filter(x=>isClosedStatus(x.status)).length,byStatus};
 console.table(byStatus);console.log('Maintenance',result);return result;
}
window.PSTMaintenanceAudit={run:auditMaintenanceCounts};

function auditFormPersistence(){
 const collections=['personalEvents','agents','rotations','weeklyPlans','agentDays','vacations','issues','periodic','cleaning','maintenance','requests','works','meetings','notes','documents'];
 const state={};
 for(const c of collections)state[c]=Array.isArray(db?.[c])?db[c].length:0;
 console.table(state);
 return state;
}
window.PSTFormAudit={run:auditFormPersistence};


const PST_TABLE_FILTERS={};
function normalizeTableFilterValue(v){
 return normalizeText(String(v??'')).replace(/\s+/g,' ').trim();
}
function tableFilterKey(table,index){
 return table.id||table.closest('.view')?.id||`table-${index}`;
}
function enhanceTableFilters(root=document){
 const host=root?.classList?.contains('view')?root:document.querySelector('.view.active');
 if(host && host.querySelector('.table-wrap table') && !host.querySelector('.pst-clear-table-filters')){
   const actions=host.querySelector('.filters')||host.querySelector('.section-actions');
   if(actions){
     const b=document.createElement('button');
     b.type='button';b.className='ghost small pst-clear-table-filters';
     b.textContent='Effacer filtres colonnes';
     b.addEventListener('click',clearCurrentTableFilters);
     actions.appendChild(b);
   }
 }

 const tables=[...root.querySelectorAll('.table-wrap table')];
 tables.forEach((table,tableIndex)=>{
   const thead=table.tHead;
   const tbody=table.tBodies?.[0];
   if(!thead||!tbody)return;

   const headerRow=[...thead.rows].find(r=>!r.classList.contains('pst-column-filters'));
   if(!headerRow)return;
   const colCount=headerRow.cells.length;
   if(!colCount)return;

   let filterRow=thead.querySelector('tr.pst-column-filters');
   if(!filterRow){
     filterRow=document.createElement('tr');
     filterRow.className='pst-column-filters';
     const key=tableFilterKey(table,tableIndex);
     const saved=PST_TABLE_FILTERS[key]||{};

     [...headerRow.cells].forEach((th,col)=>{
       const cell=document.createElement('th');
       const title=String(th.textContent||'').trim();
       // La dernière colonne "action" est généralement vide : pas besoin de filtre.
       if(title||col<colCount-1){
         const input=document.createElement('input');
         input.type='search';
         input.className='pst-column-filter-input';
         input.dataset.filterCol=String(col);
         input.placeholder=title?`Filtrer ${title}`:'Filtrer';
         input.setAttribute('aria-label',input.placeholder);
         input.autocomplete='off';
         input.value=saved[col]||'';
         input.addEventListener('input',()=>applyTableColumnFilters(table));
         cell.appendChild(input);
       }
       filterRow.appendChild(cell);
     });
     thead.appendChild(filterRow);
   }
   applyTableColumnFilters(table);
 });
}
function applyTableColumnFilters(table){
 const tbody=table.tBodies?.[0];
 const thead=table.tHead;
 if(!tbody||!thead)return;
 const inputs=[...thead.querySelectorAll('.pst-column-filter-input')];
 const tableIndex=[...document.querySelectorAll('.table-wrap table')].indexOf(table);
 const key=tableFilterKey(table,tableIndex);
 const state={};
 inputs.forEach(i=>state[i.dataset.filterCol]=i.value||'');
 PST_TABLE_FILTERS[key]=state;

 let visible=0,total=0;
 [...tbody.rows].forEach(row=>{
   // Ne pas casser les lignes "Aucun résultat" avec colspan.
   if(row.cells.length<=1 && row.cells[0]?.colSpan>1){
     row.style.display='';
     return;
   }
   total++;
   const ok=inputs.every(input=>{
     const wanted=normalizeTableFilterValue(input.value);
     if(!wanted)return true;
     const col=Number(input.dataset.filterCol);
     const cell=row.cells[col];
     const actual=normalizeTableFilterValue(cell?.innerText||cell?.textContent||'');
     return actual.includes(wanted);
   });
   row.style.display=ok?'':'none';
   if(ok)visible++;
 });

 // Compteur discret ajouté à proximité du tableau.
 let counter=table.parentElement?.querySelector(':scope > .pst-filter-result-count');
 if(!counter && table.parentElement){
   counter=document.createElement('div');
   counter.className='pst-filter-result-count';
   table.parentElement.insertBefore(counter,table);
 }
 if(counter)counter.textContent=inputs.some(i=>i.value.trim())?`${visible} / ${total} ligne${total>1?'s':''}`:'';
}
function clearCurrentTableFilters(){
 const view=document.querySelector('.view.active');
 if(!view)return;
 view.querySelectorAll('.pst-column-filter-input').forEach(i=>i.value='');
 view.querySelectorAll('.table-wrap table').forEach(t=>applyTableColumnFilters(t));
}
window.PSTTableFilters={
 enhance:enhanceTableFilters,
 clear:clearCurrentTableFilters,
 state:PST_TABLE_FILTERS
};

function renderAll(){return safeRenderAll()}

/* ---------- Actions rapides ---------- */
function openQuickMenu(){openDetail('Ajouter rapidement',`<div class="quick-menu-grid"><button data-quick="agent-day">👤<strong>Jour agent</strong><small>Congé, RTT, horaires, heures supp.</small></button><button data-quick="note">✎<strong>Bloc-notes</strong><small>Note et liste d’actions</small></button><button data-quick="maintenance">⚙<strong>Intervention</strong><small>Maintenance</small></button><button data-quick="cleaning">✓<strong>Contrôle ménage</strong><small>Saisie guidée</small></button><button data-quick="meeting">📅<strong>Rendez-vous</strong><small>Réunion ou visite</small></button><button data-quick="room-prep">☕<strong>Préparation salle & café</strong><small>Préparer une salle / demande café</small></button><button data-quick="request">↗<strong>Demande direction</strong><small>Aménagement / logistique</small></button><button data-quick="issue-urgent">⚠<strong>Urgence</strong><small>Sécurité / qualité · priorité Urgente</small></button><button data-quick="issue-problem">❗<strong>Problématique</strong><small>Sécurité / qualité · priorité Normale</small></button><button data-quick="document">📎<strong>Document</strong><small>Créer une fiche documentaire</small></button><button data-quick="import-hub" class="quick-import-main">📥<strong>Importer / Scanner</strong><small>Scan manuscrit ou PDF · détection automatique</small></button></div>`)}
const QUICK_ACTION_KEYS=['agent-day','note','maintenance','cleaning','meeting','request','issue-urgent','issue-problem','document','room-prep'];
function dispatchQuick(q){if($('#detailModal').open)$('#detailModal').close();({note:()=>openNote(),maintenance:()=>openMaintenance(),cleaning:()=>openCleaning(),meeting:()=>openMeeting(),request:()=>openRequest(),'issue-urgent':()=>openIssue(null,{priority:'Urgente'}),'issue-problem':()=>openIssue(null,{priority:'Normale'}),document:()=>openDocument(),'room-prep':()=>{const b=document.querySelector('.nav-btn[data-view="room-prep"]');if(b)b.click();else setView('room-prep')},'import-hub':()=>openCentralImportHub(),'agent-day':()=>{const aid=db.agents.find(a=>normalizeText(a.status)==='actif')?.id;if(aid)openAgentDay(aid,todayISO());else toast('Ajoutez d’abord un agent')}}[q]||(()=>{console.warn('Action rapide inconnue',q);toast('Cette action rapide n’est pas disponible')}))()}
function dashboardShortcut(target){
 const view=target||'dashboard';
 if(view==='issues-urgent'){
  setView('issues');
  if($('#issueMonth'))$('#issueMonth').value='';
  if($('#issueStatus'))$('#issueStatus').value='';
  window.__dashboardUrgentOnly=true;renderIssues();return;
 }
 window.__dashboardUrgentOnly=false;
 setView(view);
 if(view==='maintenance'&&$('#maintenanceStatus'))$('#maintenanceStatus').value='';
 if(view==='periodic'&&$('#periodicStatus'))$('#periodicStatus').value='';
}
function dispatchEdit(type,id){({agent:()=>openAgent(id),rotation:()=>openRotation(id),personal:()=>openPersonalEvent(id),issue:()=>openIssue(id),periodic:()=>openPeriodic(id),cleaning:()=>openCleaning(id),maintenance:()=>openMaintenance(id),request:()=>openRequest(id),work:()=>openWork(id),meeting:()=>openMeeting(id),note:()=>openNote(id),vacation:()=>openVacation(id),document:()=>openDocument(id),space:()=>openSpace(id),reportNonconformity:()=>setView('pdfimports')}[type]||(()=>{}))()}

/* ---------- Sauvegarde / restauration ---------- */
function exportBackup(){const exportAcademicYear=activeAcademicYear();const payload={exportedAt:new Date().toISOString(),data:db,note:'Les fichiers joints sont stockés dans Supabase Storage. La sauvegarde JSON contient leurs références.'};downloadText(`Pilotage_Service_Technique_sauvegarde_${todayISO()}.json`,JSON.stringify(payload,null,2),'application/json')}
async function importBackup(file){try{
 const obj=JSON.parse(await file.text()),previous=deepClone(db);db=migrate(obj.data||obj);
 const persisted=window.PSTMainState?.persistNow?await window.PSTMainState.persistNow():{ok:save(),offline:false};
 if(!persisted?.ok){db=previous;safeRenderAll();throw new Error(persisted?.error||'Supabase n’a pas confirmé la restauration')}
 safeRenderAll();toast('✅ Sauvegarde restaurée et confirmée dans Supabase')
}catch(e){console.error(e);alert(`Restauration impossible : ${e?.message||e}`)}}
function resetData(){if(!confirm('Réinitialiser toute la base locale ? Cette action est irréversible.'))return;db=defaultData();restoreSuppliedData(false);save();toast('Base réinitialisée avec les données de référence')}
function restoreReferenceData(){if(!confirm('Restaurer les agents, horaires et interventions fournis ? Vos saisies personnelles seront conservées.'))return;restoreSuppliedData(true)}

/* ---------- Événements ---------- */
function runDiagnostic(){
 const critical=['nav','openMenu','closeMenu','menuBackdrop','modal','modalForm','newAgent','newRotation','newShift','newAbsence','teamWeekCalendar','agentsGrid','rotationsTable','planningTable','restoreReferenceData','notificationBell','notificationModal','notificationList','kpiAgents','kpiPresent','kpiUrgentActions','kpiLate','kpiMaintenance','kpiMaintenanceTodo','kpiCompliance','kpiCleaningWeak','kpiPeriodicLate','kpiPeriodicSoon','kpiNotes','kpiNotesDue','priorityList','dashboardNotes','maintenancePreview','maintenanceTodoPreview','cleaningWeakPreview','meetingPreview'];
 const missing=critical.filter(id=>!document.getElementById(id));
 const checks=[
  ['Données agents',Array.isArray(db.agents)],['Horaires hebdomadaires',Array.isArray(db.weeklyPlans)],['Roulements',Array.isArray(db.rotations)],
  ['Journées agents',Array.isArray(db.agentDays)],['Interventions',Array.isArray(db.maintenance)],['Contrôles périodiques',Array.isArray(db.periodic)],
  ['Contrôles ménage',Array.isArray(db.cleaning)],['Navigation mobile',!!document.getElementById('openMenu')],['Fenêtres',!!document.getElementById('modal')]
 ];
 const failed=checks.filter(x=>!x[1]).map(x=>x[0]);let notifications=[];try{notifications=computeNotifications()}catch(error){failed.push('Calcul des notifications');console.error(error)}
 const lateTest={status:'À faire',dueDate:addDays(todayISO(),-1),priority:'Normale'};if(isClosedStatus(lateTest.status)||!(recordDueDate(lateTest)<todayISO()))failed.push('Règle intervention en retard');
 const urgentIssueTest={status:'À faire',priority:'Urgent',dueDate:''};if(isClosedStatus(urgentIssueTest.status)||!isUrgentPriority(urgentIssueTest.priority))failed.push('Règle action urgente Sécurité & qualité');
 const urgentProblemTest={status:'À faire',priority:'Urgente',title:'Test problématique'};if(!isUrgentPriority(urgentProblemTest.priority))failed.push('Câblage problématique urgente → tableau de bord');
 const dueSoonIssueTest={status:'En cours',priority:'Normale',dueDate:addDays(todayISO(),2)};if(isClosedStatus(dueSoonIssueTest.status)||!(recordDueDate(dueSoonIssueTest)<=addDays(todayISO(),3)))failed.push('Règle échéance proche Sécurité & qualité');
 if(missing.length||failed.length){console.error('Diagnostic',{missing,failed});toast(`Diagnostic : ${missing.length+failed.length} anomalie(s) détectée(s)`);return false}
 toast(`Diagnostic réussi — ${notifications.length} notification(s) calculée(s)`);return true;
}



document.addEventListener('pointerup',e=>{
 const b=e.target.closest?.('.note-edit-button');
 if(!b)return;
 const now=Date.now();
 if(Number(b.dataset.lastOpen||0)+500>now)return;
 b.dataset.lastOpen=String(now);
 dispatchEdit('note',b.dataset.editId);
},{passive:true});

function bindReliableDynamicActions(){
 if(window.__pstDynamicActionsBound)return;
 window.__pstDynamicActionsBound=true;
 document.addEventListener('click',e=>{
   const edit=e.target.closest?.('[data-edit-type]');
   if(edit){
     const type=edit.dataset.editType,id=edit.dataset.editId;
     if(edit.classList.contains('note-edit-button')&&Number(edit.dataset.lastOpen||0)+500>Date.now())return;
     if(type&&id){dispatchEdit(type,id)}
   }
   const rpCard=e.target.closest?.('[data-roomprep-edit]');
   if(rpCard&&window.PSTRoomPrep?.edit){
     window.PSTRoomPrep.edit(rpCard.dataset.roomprepEdit);
   }
 });
}

function bindEvents(){
 $('#modalForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!modalHandler)return;
  const form=e.currentTarget,btn=$('#modalSave');
  if(!form.checkValidity()){form.reportValidity();toast('Complétez les champs obligatoires indiqués');return}
  const pastDates=[...form.querySelectorAll('input[type="date"]')].map(e=>e.value).filter(Boolean).filter(v=>v<todayISO());
  const changed=[];if(modalAuditInitial){for(const e of [...form.elements]){if(!e.name||e.type==='file'||e.type==='button'||e.type==='submit')continue;const nv=e.type==='checkbox'?e.checked:e.value,ov=modalAuditInitial[e.name];if(String(nv)!==String(ov))changed.push({field:e.name,oldValue:ov,newValue:nv})}}
  if(pastDates.length&&changed.length&&!confirm('⚠️ Cette donnée concerne une date passée.\n\nLa modification sera enregistrée dans l’historique.\n\nContinuer ?'))return;
  btn.disabled=true;
  try{const handlerResult=await modalHandler(form);if(handlerResult===false||handlerResult?.ok===false)return;if(pastDates.length&&changed.length){db.changeHistory=db.changeHistory||[];db.changeHistory.push({id:uid(),date:new Date().toISOString(),title:modalAuditTitle||'Modification d’une donnée passée',pastDates:[...new Set(pastDates)],changes:changed,user:currentUser?.email||'Utilisateur'});save()}}catch(err){
    console.error('Erreur d’enregistrement du formulaire :',err);
    const msg=err?.message?String(err.message):'Erreur inconnue';
    toast(`Enregistrement impossible : ${msg.slice(0,120)}`);
    setSaveState('Action non enregistrée — données précédentes conservées','local');
  }finally{btn.disabled=false}
 });
 $('#modalCancel').onclick=closeModal;$('#modalClose').onclick=closeModal;$('#modalDelete').onclick=()=>modalDeleteHandler?.();$('#detailClose').onclick=()=>$('#detailModal').close();$('#emailClose').onclick=()=>$('#emailModal').close();
 // Navigation mobile gérée uniquement par navigation.js pour éviter les doubles événements.
 $('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){setView(b.dataset.view)}});$('#layoutMode').onchange=e=>applyLayout(e.target.value);$('#printCurrent').onclick=()=>printView(document.querySelector('.view.active')?.id);
 const gay=$('#globalAcademicYear');if(gay)gay.onchange=e=>setActiveAcademicYear(e.target.value);const pay=$('#prevAcademicYear');if(pay)pay.onclick=()=>setActiveAcademicYear(shiftAcademicYear(activeAcademicYear(),-1));const nay=$('#nextAcademicYear');if(nay)nay.onclick=()=>setActiveAcademicYear(shiftAcademicYear(activeAcademicYear(),1));
 {const q=$('#quickAdd');if(q)q.onclick=openQuickMenu;const f=$('#quickNoteFab');if(f)f.onclick=openQuickMenu;}
 $('#newAgent').onclick=()=>openAgent();const wr=$('#weekendRestAll');if(wr)wr.onclick=applyWeekendRestToAll;const aw=$('#addWeeklyAgent');if(aw)aw.onclick=()=>openAgent();const nw=$('#newWeeklyPlan');if(nw)nw.onclick=()=>openWeeklyPlan();$('#newRotation').onclick=()=>openRotation();$('#newRotationException').onclick=()=>openRotationException();$('#newShift').onclick=()=>{const a=$('#planningAgent').value||db.agents[0]?.id;openAgentDay(a,`${$('#planningMonth').value||monthISO()}-01`)};$('#newAbsence').onclick=openAbsence;$('#newVacation').onclick=()=>openVacation();$('#loadSchoolHolidays').onclick=loadSchoolHolidays;$('#newIssue').onclick=()=>openIssue();$('#newPeriodic').onclick=()=>openPeriodic();$('#newCleaning').onclick=()=>openCleaning();$('#newMaintenance').onclick=()=>openMaintenance();$('#newRequest').onclick=()=>openRequest();$('#newWork').onclick=()=>openWork();$('#newMeeting').onclick=()=>openMeeting();$('#newNote').onclick=()=>openNote();$('#newDocument').onclick=()=>openDocument();$('#newPersonalEvent').onclick=$('#newPersonalEventDash').onclick=()=>openPersonalEvent();$('#addBuilding').onclick=addBuilding;$('#addSpace').onclick=()=>openSpace();
 $('#prevTeamWeek').onclick=()=>{teamWeek=addDays(teamWeek,-7);renderTeamCalendar()};$('#nextTeamWeek').onclick=()=>{teamWeek=addDays(teamWeek,7);renderTeamCalendar()};$('#prevTeamMonth').onclick=()=>{teamWeek=startOfWeek(addMonths(teamWeek,-1));renderTeamCalendar()};$('#nextTeamMonth').onclick=()=>{teamWeek=startOfWeek(addMonths(teamWeek,1));renderTeamCalendar()};$('#todayTeamWeek').onclick=()=>{teamWeek=startOfWeek(todayISO());renderTeamCalendar()};$('#teamDateJump').onchange=e=>{teamWeek=startOfWeek(e.target.value);renderTeamCalendar()};$('#prevPersonalWeek').onclick=()=>{personalWeek=addDays(personalWeek,-7);renderPersonalCalendar()};$('#nextPersonalWeek').onclick=()=>{personalWeek=addDays(personalWeek,7);renderPersonalCalendar()};$('#todayPersonalWeek').onclick=()=>{personalWeek=startOfWeek(todayISO());renderPersonalCalendar()};
 $('#saveSettings').onclick=saveSettings;const wizardOpen=$('#openAutoReportWizard');if(wizardOpen)wizardOpen.onclick=openAutoReportWizard;const wizardClose=$('#autoReportWizardClose');if(wizardClose)wizardClose.onclick=()=>wizardEl().close();const wizardBack=$('#autoReportWizardBack');if(wizardBack)wizardBack.onclick=()=>{saveWizardStep();autoReportWizardStep=Math.max(0,autoReportWizardStep-1);renderAutoReportWizard()};const wizardNext=$('#autoReportWizardNext');if(wizardNext)wizardNext.onclick=()=>{saveWizardStep();if(autoReportWizardStep===3){wizardEl().close();return}autoReportWizardStep=Math.min(3,autoReportWizardStep+1);renderAutoReportWizard()};document.addEventListener('click',e=>{const p=e.target.closest('[data-wizard-provider]');if(p){autoReportWizardData.provider=p.dataset.wizardProvider;renderAutoReportWizard()}});const sart=$('#sendAutomaticReportTest');if(sart)sart.onclick=sendAutomaticReportTest;function openNotificationCenter(){window.PSTNotificationCenter?.open?.()}
function closeNotificationCenter(){window.PSTNotificationCenter?.close?.()}
$('#archiveNow').onclick=()=>{const made=createWeeklyArchive(false);save();toast(made?'Archive créée':'La semaine précédente est déjà archivée')};$('#exportArchives').onclick=exportArchives;$('#exportBackup').onclick=exportBackup;$('#importBackup').onchange=e=>e.target.files[0]&&importBackup(e.target.files[0]);$('#resetData').onclick=resetData;const rr=$('#restoreReferenceData');if(rr)rr.onclick=restoreReferenceData;const dg=$('#runDiagnostic');if(dg)dg.onclick=runDiagnostic;const sp=$('#supabasePingBtn');if(sp)sp.onclick=manualSupabasePing;$('#resetPeriodicCatalog').onclick=()=>{if(confirm('Restaurer le catalogue par défaut ? Les contrôles personnalisés actuels seront remplacés.')){db.periodic=makePeriodic();save()}};$('#exportCsv').onclick=()=>exportStyledExcel($('#csvModule').value);$('#exportRotationCsv').onclick=()=>exportStyledExcel('rotations');const ewp=$('#exportWeeklyPlans');if(ewp)ewp.onclick=()=>exportStyledExcel('weeklyPlans');
 $('#copyMail').onclick=async()=>{const text=`À : ${$('#mailTo').value}\nCC : ${$('#mailCc').value}\nCCI : ${$('#mailBcc').value}\nObjet : ${$('#mailSubject').value}\n\n${$('#mailMessage').value}`;try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}toast('Message copié')}catch(e){prompt('Copiez le message :',text)}};$('#openMailClient').onclick=openMailClient;
 $$('[data-report-print]').forEach(b=>b.onclick=()=>printReport(b.dataset.reportPrint));$$('[data-report-email]').forEach(b=>b.onclick=()=>prepareEmail(b.dataset.reportEmail));$('#printFullRegister').onclick=()=>printReport('full');$$('[data-print]').forEach(b=>b.onclick=()=>printView(b.dataset.print)); const pc=$('#printCollectivePlanning');if(pc)pc.onclick=generateCollectivePlanningPDF;const pi=$('#printIndividualPlanning');if(pi)pi.onclick=generateIndividualPlanningPDF;
 document.addEventListener('click',e=>{const b=e.target.closest('[data-edit-weekly-plan]');if(b)openWeeklyPlan(Number(b.dataset.editWeeklyPlan))});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-new-weekly-agent]');if(b)openWeeklyPlan(null,b.dataset.newWeeklyAgent)});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-delete-standard-period]');if(b){e.preventDefault();e.stopPropagation();deleteStandardSchedulePeriod(b.dataset.deleteStandardPeriod)}});

 const filterIds=['personalMonth','personalType','personalStatus','agentSearch','agentStatus','rotationAgent','rotationYear','rotationMonth','planningMonth','planningAgent','planningSignal','absenceMonth','absenceAgent','absenceType','absenceStatus','vacationZone','vacationStatus','issueMonth','issueAgent','issueCategory','issueStatus','periodicFamily','periodicStatus','periodicBuilding','cleanMonth','cleanBuilding','cleanRoomType','cleanStatus','cleaningGuideType','maintenanceStatus','maintenancePriority','maintenanceFamily','requestStatus','requestType','workStatus','workType','meetingMonth','meetingType','noteCategory','notePriority','noteStatus','noteSearch','documentCategory','documentSearch','archiveYear','archiveSearch','importArchiveType','importArchiveSearch'];for(const id of filterIds){const e=document.getElementById(id);if(e)e.addEventListener(e.tagName==='INPUT'&&e.type==='text'?'input':'change',()=>{if(id==='cleaningGuideType')renderCleaningGuide();else if(id.startsWith('personal'))renderPersonal();else if(id.startsWith('agent'))renderAgents();else if(id.startsWith('rotation'))renderRotations();else if(id.startsWith('planning'))renderPlanning();else if(id.startsWith('absence'))renderAbsences();else if(id.startsWith('vacation'))renderVacations();else if(id.startsWith('issue'))renderIssues();else if(id.startsWith('periodic'))renderPeriodic();else if(id.startsWith('clean'))renderCleaning();else if(id.startsWith('maintenance'))renderMaintenance();else if(id.startsWith('request'))renderRequests();else if(id.startsWith('work'))renderWorks();else if(id.startsWith('meeting'))renderMeetings();else if(id.startsWith('note'))renderNotes();else if(id.startsWith('document'))renderDocuments();else if(id.startsWith('archive')||id.startsWith('importArchive'))renderArchives()})}
 document.addEventListener('keydown',e=>{const go=e.target.closest?.('#dashboard [data-go]');if(go&&(e.key==='Enter'||e.key===' ')){e.preventDefault();dashboardShortcut(go.dataset.go)}});
 document.addEventListener('click',async e=>{const ni=e.target.closest('[data-notification-index]');if(ni){const n=(window.__notifications||[])[Number(ni.dataset.notificationIndex)];closeNotificationCenter();if(n)notificationTarget(n);return}const ar=e.target.closest('[data-archive-detail]');if(ar){openArchiveDetail(ar.dataset.archiveDetail);return}const iana=e.target.closest('[data-open-import-analysis]');if(iana){openImportAnalysis(iana.dataset.openImportAnalysis);return}const irec=e.target.closest('[data-open-import-record]');if(irec){const id=irec.dataset.openImportRecord,m=irec.dataset.importModule;({notes:()=>openNote(id),issues:()=>openIssue(id),maintenance:()=>openMaintenance(id),requests:()=>openRequest(id),works:()=>openWork(id),meetings:()=>openMeeting(id),periodic:()=>openPeriodic(id),documents:()=>openDocument(id)}[m]||(()=>setView(m||'archives')))();return}const go=e.target.closest('[data-go]');if(go){if(go.closest('#dashboard'))dashboardShortcut(go.dataset.go);else setView(go.dataset.go);return}const quick=e.target.closest('[data-quick]');if(quick){dispatchQuick(quick.dataset.quick);return}const ae=e.target.closest('[data-agenda-source]');if(ae){
 const source=ae.dataset.agendaSource,id=ae.dataset.agendaId;
 if(source==='personal')openPersonalEvent(id);
 else if(source==='meeting')openMeeting(id);
 else if(source==='note')openNote(id);
 else if(source==='maintenance')openMaintenance(id);
 else if(source==='request')openRequest(id);
 else if(source==='work')openWork(id);
 else if(source==='issue')openIssue(id);
 else if(source==='cleaning')openCleaning(id);
 else if(source==='periodic')openPeriodic(id);
 else if(source==='vacation')openVacation(id);
 else if(source==='roomprep'){setView('room-prep');setTimeout(()=>window.PSTRoomPrep?.edit?.(id),60)}
 else if(source==='waste')setView('waste');
 return
}const perm=e.target.closest('[data-permanence-agent]');if(perm){openAgentPermanence(perm.dataset.permanenceAgent);return}const ed=e.target.closest('[data-edit-type]');if(ed){dispatchEdit(ed.dataset.editType,ed.dataset.editId);return}const ad=e.target.closest('[data-agent-day]');if(ad){openAgentDay(ad.dataset.agentDay,ad.dataset.date,null,ad.dataset.dayType||'');return}const np=e.target.closest('[data-new-personal-date]');if(np){openPersonalEvent(null,np.dataset.newPersonalDate);return}const nr=e.target.closest('[data-new-rotation-agent]');if(nr){openRotation(null,nr.dataset.newRotationAgent);return}const sc=e.target.closest('[data-sync-import-cloud]');if(sc){await syncAttachmentToCloud(sc.dataset.syncImportCloud);return}const vc=e.target.closest('[data-verify-import-cloud]');if(vc){await verifyAttachmentCloud(vc.dataset.verifyImportCloud);return}const di=e.target.closest('[data-delete-import]');if(di){await deleteImportedArchive(di.dataset.deleteImport);return}const dl=e.target.closest('[data-download]');if(dl){await downloadAttachment(dl.dataset.download);return}const gd=e.target.closest('[data-guide-path]');if(gd){await openGuide(gd.dataset.guidePath);return}const rb=e.target.closest('[data-remove-building]');if(rb){if(confirm('Supprimer ce bâtiment et ses niveaux de la liste ?')){const b=db.buildings.find(x=>x.id===rb.dataset.removeBuilding);db.buildings=db.buildings.filter(x=>x.id!==rb.dataset.removeBuilding);db.spaces=db.spaces.filter(s=>s.building!==b?.name);save()}return}const af=e.target.closest('[data-add-floor]');if(af){db.buildings.find(x=>x.id===af.dataset.addFloor)?.floors.push(`Nouvel étage`);renderSettings();return}const rf=e.target.closest('[data-remove-floor]');if(rf){const card=rf.closest('[data-building-id]'),b=db.buildings.find(x=>x.id===card.dataset.buildingId);b?.floors.splice(Number(rf.dataset.removeFloor),1);renderSettings();return}const al=e.target.closest('[data-add-list]');if(al){db.lists[al.dataset.addList].push('Nouveau choix');renderSettings();return}const rl=e.target.closest('[data-remove-list]');if(rl){const ed=rl.closest('[data-list-key]');db.lists[ed.dataset.listKey].splice(Number(rl.dataset.removeList),1);renderSettings();return}})
}


// V32 — Assistant de configuration des rapports automatiques
let autoReportWizardStep=0;
let autoReportWizardData={provider:'microsoft',tenantId:'',clientId:'',senderEmail:'',cronSecret:''};
function wizardEl(){return document.getElementById('autoReportWizard')}
function wizardBody(){return document.getElementById('autoReportWizardBody')}
function randomWizardSecret(){const a=new Uint8Array(24);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
function renderAutoReportWizard(){
 const steps=[...document.querySelectorAll('#autoReportWizard .wizard-progress span')];steps.forEach((x,i)=>{x.classList.toggle('active',i===autoReportWizardStep);x.classList.toggle('done',i<autoReportWizardStep)});
 const back=document.getElementById('autoReportWizardBack'),next=document.getElementById('autoReportWizardNext');if(back)back.hidden=autoReportWizardStep===0;if(next)next.textContent=autoReportWizardStep===3?'Fermer':'Suivant';
 if(autoReportWizardStep===0){wizardBody().innerHTML=`<div class="wizard-step"><h4>1. Choisir le mode d’envoi</h4><p>Pour envoyer depuis votre boîte Outlook professionnelle, choisissez Microsoft 365. Aucun mot de passe Outlook ne sera enregistré.</p><div class="wizard-choice-grid"><button type="button" class="wizard-choice ${autoReportWizardData.provider==='microsoft'?'selected':''}" data-wizard-provider="microsoft"><strong>Microsoft 365 / Outlook</strong><small>Envoi avec Microsoft Graph. Recommandé pour votre compte professionnel.</small></button><button type="button" class="wizard-choice ${autoReportWizardData.provider==='resend'?'selected':''}" data-wizard-provider="resend"><strong>Service Resend</strong><small>Alternative plus simple, mais l’expéditeur n’est pas directement votre boîte Outlook.</small></button></div><div class="wizard-status warn">L’assistant prépare et vérifie la configuration. Microsoft exige toutefois une autorisation administrateur dans Entra ID pour l’envoi automatique serveur.</div></div>`}
 if(autoReportWizardStep===1){
  if(autoReportWizardData.provider==='microsoft')wizardBody().innerHTML=`<div class="wizard-step"><h4>2. Informations Microsoft 365</h4><div class="form-grid"><label>Tenant ID Microsoft<input id="wizTenant" value="${esc(autoReportWizardData.tenantId)}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></label><label>Client ID de l’application<input id="wizClient" value="${esc(autoReportWizardData.clientId)}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></label><label class="span2">Adresse Outlook expéditrice<input id="wizSender" type="email" value="${esc(autoReportWizardData.senderEmail||db.settings.outlookEmail||'')}" placeholder="prenom.nom@etablissement.fr"></label></div><div class="wizard-checklist"><div class="wizard-check">① Dans Microsoft Entra ID, créer une inscription d’application.</div><div class="wizard-check">② Ajouter la permission d’application <strong>Mail.Send</strong>.</div><div class="wizard-check">③ Un administrateur Microsoft 365 doit accorder le consentement.</div><div class="wizard-check">④ Créer un secret client et le garder pour l’étape Supabase.</div></div><p class="hint">Le secret client ne doit jamais être saisi dans cette application.</p></div>`;
  else wizardBody().innerHTML=`<div class="wizard-step"><h4>2. Service Resend</h4><p>Créez un compte Resend et récupérez une clé API. La clé sera ajoutée uniquement dans les secrets Supabase.</p><div class="wizard-status warn">Pour envoyer à plusieurs destinataires avec votre propre adresse, un domaine de messagerie doit généralement être vérifié dans Resend.</div></div>`
 }
 if(autoReportWizardStep===2){
  if(!autoReportWizardData.cronSecret)autoReportWizardData.cronSecret=randomWizardSecret();
  const ms=autoReportWizardData.provider==='microsoft';
  const cmds=ms?`supabase secrets set MS_TENANT_ID="${autoReportWizardData.tenantId||'VOTRE_TENANT_ID'}"\nsupabase secrets set MS_CLIENT_ID="${autoReportWizardData.clientId||'VOTRE_CLIENT_ID'}"\nsupabase secrets set MS_CLIENT_SECRET="COLLEZ_ICI_LE_SECRET_CLIENT"\nsupabase secrets set MS_SENDER_EMAIL="${autoReportWizardData.senderEmail||'adresse@etablissement.fr'}"\nsupabase secrets set CRON_SECRET="${autoReportWizardData.cronSecret}"\nsupabase functions deploy automatic-report --no-verify-jwt`:`supabase secrets set RESEND_API_KEY="COLLEZ_ICI_LA_CLE_RESEND"\nsupabase secrets set REPORT_FROM_EMAIL="Pilotage Service Technique <adresse-verifiee@domaine.fr>"\nsupabase secrets set CRON_SECRET="${autoReportWizardData.cronSecret}"\nsupabase functions deploy automatic-report --no-verify-jwt`;
  wizardBody().innerHTML=`<div class="wizard-step"><h4>3. Installer la fonction Supabase</h4><p>Depuis un ordinateur où Supabase CLI est installé, ouvrez un terminal dans le dossier V32 et exécutez les commandes suivantes.</p><pre class="wizard-code" id="wizardCommands">${esc(cmds)}</pre><button type="button" class="ghost" id="copyWizardCommands">Copier les commandes</button><div class="wizard-status warn">Après le déploiement, exécutez aussi <strong>SETUP_CRON_EXEMPLE.sql</strong> dans SQL Editor en remplaçant le secret du cron par celui affiché ci-dessus.</div></div>`;
  setTimeout(()=>{const b=document.getElementById('copyWizardCommands');if(b)b.onclick=async()=>{await navigator.clipboard.writeText(document.getElementById('wizardCommands').innerText);toast('Commandes copiées')}},0)
 }
 if(autoReportWizardStep===3){wizardBody().innerHTML=`<div class="wizard-step"><h4>4. Vérifier et tester</h4><div class="wizard-checklist"><div class="wizard-check">Destinataires configurés : <strong>${esc(db.settings.emailsTo||'Aucun')}</strong></div><div class="wizard-check">Heure choisie : <strong>${esc(db.settings.autoReportHour||'07:00')}</strong></div><div class="wizard-check">Résumé quotidien : <strong>${db.settings.autoDailyEnabled?'Activé':'Désactivé'}</strong></div><div class="wizard-check">Bilan hebdomadaire : <strong>${db.settings.autoWeeklyEnabled?'Activé':'Désactivé'}</strong></div></div><div id="wizardTestStatus" class="wizard-status warn">Cliquez sur « Tester maintenant ». Si le serveur est correctement installé, un mail de test sera envoyé.</div><button type="button" class="primary" id="wizardRunTest">Tester maintenant</button></div>`;setTimeout(()=>{const b=document.getElementById('wizardRunTest');if(b)b.onclick=async()=>{const st=document.getElementById('wizardTestStatus');st.className='wizard-status warn';st.textContent='Test en cours…';try{if(!supabaseClient)throw new Error('Supabase non connecté');const {data,error}=await supabaseClient.functions.invoke('automatic-report',{body:{mode:'test'}});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'Échec du test');st.className='wizard-status ok';st.textContent='Mail test envoyé. Vérifiez votre boîte de réception et les courriers indésirables.'}catch(e){st.className='wizard-status bad';st.textContent=`Test impossible : ${e.message||e}. La fonction ou le fournisseur d’e-mail n’est pas encore configuré côté Supabase.`}}},0)}
}
function openAutoReportWizard(){autoReportWizardStep=0;renderAutoReportWizard();const d=wizardEl();if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','')}
function saveWizardStep(){if(autoReportWizardStep===1&&autoReportWizardData.provider==='microsoft'){autoReportWizardData.tenantId=document.getElementById('wizTenant')?.value.trim()||'';autoReportWizardData.clientId=document.getElementById('wizClient')?.value.trim()||'';autoReportWizardData.senderEmail=document.getElementById('wizSender')?.value.trim()||''}}

document.addEventListener('change',e=>{const s=e.target.closest?.('[data-nc-status]');if(!s)return;const n=(db.reportNonconformities||[]).find(x=>String(x.id)===String(s.dataset.ncStatus));if(!n)return;const before=n.status;n.status=s.value;n.updatedAt=new Date().toISOString();n.statusHistory=n.statusHistory||[];n.statusHistory.push({at:n.updatedAt,from:before,to:n.status});const closed=['FAIT','Levée'].includes(n.status);for(const x of (db.issues||[]).filter(x=>String(x.sourceNonconformityId||'')===String(n.id))){x.status=closed?'Clôturé':'À faire';x.updatedAt=n.updatedAt;}for(const x of (db.maintenance||[]).filter(x=>String(x.sourceNonconformityId||'')===String(n.id))){x.status=closed?'Clôturé':'À faire';x.updatedAt=n.updatedAt;}save();renderPeriodic();renderIssues();renderMaintenance();toast(`Observation ${n.observationNo||''} : ${n.status} — plan d’action ${closed?'clôturé':'rouvert'}`)});
function init(){secureAppLogos();db.settings.academicYear=normalizeAcademicYear(db.settings.academicYear)||academicYearFor(todayISO());const storedLayout=db.settings.defaultLayout||'auto';const academicStart=academicYearStart(activeAcademicYear());const defaults={personalMonth:monthISO(),planningMonth:monthISO(),absenceMonth:monthISO(),issueMonth:monthISO(),cleanMonth:monthISO(),meetingMonth:monthISO(),dailyDate:todayISO(),weeklyDate:todayISO(),monthlyDate:monthISO(),teamReportMonth:monthISO(),absenceReportMonth:monthISO(),cleaningReportMonth:monthISO(),maintenanceReportMonth:monthISO(),periodicReportYear:new Date().getFullYear(),collectivePlanningDate:todayISO(),individualPlanningFrom:todayISO(),individualPlanningTo:addDays(todayISO(),6)};for(const [id,v] of Object.entries(defaults))if(document.getElementById(id))document.getElementById(id).value=v;const ipa=$('#individualPlanningAgent');if(ipa){ipa.innerHTML=db.agents.filter(a=>a.status==='Actif').map(a=>`<option value="${a.id}">${esc(agentName(a))}</option>`).join('')}const ry=$('#rotationYear');if(ry){ry.innerHTML='';for(let y=academicStart-5;y<=academicStart+5;y++)ry.insertAdjacentHTML('beforeend',`<option value="${y}" ${y===academicStart?'selected':''}>${y}–${y+1}</option>`)}const rm=$('#rotationMonth');if(rm){rm.innerHTML='<option value="">Année scolaire entière</option>';for(const i of [9,10,11,12,1,2,3,4,5,6,7,8])rm.insertAdjacentHTML('beforeend',`<option value="${i}">${new Date(2026,i-1,1).toLocaleDateString('fr-FR',{month:'long'})}</option>`)}applyLayout(storedLayout);syncAcademicYearFilters(activeAcademicYear());runAutomaticHousekeeping();bindEvents();bindReliableDynamicActions();renderAll();renderGlobalAcademicYear();setView('dashboard')}
window.addEventListener('DOMContentLoaded',init);

document.addEventListener('DOMContentLoaded',()=>initAuth().catch(console.error),{once:true});
window.addEventListener('load',()=>initAuth().catch(console.error),{once:true});


const ONEDRIVE_PILOTAGE_ROOT='https://crrhonealpes-my.sharepoint.com/my?id=%2Fpersonal%2Fadelin%5Fvignal%5Fauvergnerhonealpes%5Ffr%2FDocuments%2FPilotage%20Service%20Technique&viewid=152cef09%2D9d18%2D493a%2D887f%2D4a1eefbc049f';
// ===== V147.24 — OneDrive = coffre documentaire ; Supabase = index + liens =====
function oneDriveLinksFor(module,recordId=''){
 return (db.oneDriveLinks||[]).filter(x=>x.module===module&&(!recordId||String(x.recordId||'')===String(recordId)));
}
function oneDriveLinkButtons(module,recordId=''){
 const rows=oneDriveLinksFor(module,recordId);if(!rows.length)return '';
 return `<div class="onedrive-links">${rows.map(x=>`<a class="ghost small onedrive-link" href="${esc(x.url)}" target="_blank" rel="noopener">☁️ ${esc(x.fileName||x.title||'Ouvrir dans OneDrive')}</a>`).join('')}</div>`;
}
function saveOneDriveIndex(meta){
 db.oneDriveLinks=Array.isArray(db.oneDriveLinks)?db.oneDriveLinks:[];
 const x={id:uid(),createdAt:new Date().toISOString(),academicYear:activeAcademicYear(),...meta};
 db.oneDriveLinks.push(x);return x;
}
function oneDriveClassificationFor(type,a){
 if(type==='chronotime')return {module:'chronotime',category:'Chronotime'};
 if(type==='periodic'||type==='control')return {module:'periodic',category:a?.control?.controlFamily||'Contrôles périodiques'};
 if(type==='administrative')return {module:'documents',category:'Document administratif'};
 return {module:'documents',category:'Autre document'};
}
function centralOneDrivePanel(){
 const type=$('#centralImportType')?.value||centralImportAnalysis?.detectedType||'other';
 const box=$('#centralOneDrivePanel');if(!box)return;
 if(type==='chronotime'){box.innerHTML='<div class="import-message"><strong>Chronotime</strong><p>Traitement Chronotime conservé tel quel. Aucun classement OneDrive imposé ici.</p></div>';return}
 const cls=oneDriveClassificationFor(type,centralImportAnalysis);
 const periodicOptions=(db.periodic||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.no)} — ${esc(x.name)}</option>`).join('');
 const already=(db.oneDriveLinks||[]).find(x=>String(x.id)===String(centralImportAnalysis?.oneDriveLinkId||''));
 box.innerHTML=`<section class="onedrive-classifier"><h4>☁️ Classement OneDrive</h4><p class="hint"><strong>1.</strong> Préparez le PDF et ouvrez OneDrive. <strong>2.</strong> Chargez-le dans le dossier voulu. <strong>3.</strong> Dans OneDrive faites Partager → Copier le lien. <strong>4.</strong> Revenez ici et cliquez sur « J’ai enregistré dans OneDrive ».</p><div class="form-grid"><label>Rubrique détectée<input id="centralOneDriveCategory" value="${esc(already?.category||cls.category)}"></label>${cls.module==='periodic'?`<label>Contrôle concerné<select id="centralOneDriveRecord"><option value="">À choisir…</option>${periodicOptions}</select></label>`:''}<label class="span2">Lien OneDrive du fichier<input id="centralOneDriveUrl" type="url" value="${esc(already?.url||'')}" placeholder="Collez ici le lien copié depuis OneDrive"></label></div><div class="card-actions"><button type="button" class="primary" id="centralSavePdfOneDrive">☁️ Préparer le PDF + ouvrir OneDrive</button><button type="button" class="ghost" id="centralOpenOneDrive">Ouvrir Pilotage Service Technique</button><button type="button" class="ghost" id="centralPasteOneDriveLink">📋 Coller le lien copié</button><button type="button" class="primary onedrive-done" id="centralConfirmOneDriveSaved" disabled>✅ J’ai enregistré dans OneDrive</button></div><div id="centralOneDriveSaveHelp" class="import-message ${already?'':'hidden'}">${already?`<strong>✅ Lien OneDrive déjà classé</strong><p>${esc(already.fileName||already.title||'Document')} est rattaché à ${esc(already.category||cls.category)}.</p>`:''}</div></section>`;
 const record=$('#centralOneDriveRecord');if(record&&already?.recordId)record.value=String(already.recordId);
 $('#centralSavePdfOneDrive')?.addEventListener('click',()=>downloadCentralPdfForOneDrive());
 $('#centralOpenOneDrive')?.addEventListener('click',()=>window.open(ONEDRIVE_PILOTAGE_ROOT,'_blank','noopener'));
 $('#centralPasteOneDriveLink')?.addEventListener('click',()=>pasteOneDriveLinkFromClipboard());
 $('#centralConfirmOneDriveSaved')?.addEventListener('click',()=>confirmCentralOneDriveSaved());
 $('#centralOneDriveUrl')?.addEventListener('input',updateCentralOneDriveValidationState);
 $('#centralOneDriveRecord')?.addEventListener('change',updateCentralOneDriveValidationState);
 updateCentralOneDriveValidationState();
}

function updateCentralOneDriveValidationState(){
 const type=$('#centralImportType')?.value||centralImportAnalysis?.detectedType||'other';
 const url=String($('#centralOneDriveUrl')?.value||'').trim();
 const urlOk=type==='chronotime'||!validateOneDriveDocumentUrl(url);
 const recordOk=type==='chronotime'||!['periodic','control'].includes(type)||!!$('#centralOneDriveRecord')?.value;
 const saved=type==='chronotime'||!!(db.oneDriveLinks||[]).find(x=>String(x.id)===String(centralImportAnalysis?.oneDriveLinkId||''));
 const oneDriveBtn=$('#centralConfirmOneDriveSaved');
 if(oneDriveBtn){
   oneDriveBtn.disabled=type!=='chronotime'&&!(urlOk&&recordOk);
   oneDriveBtn.title=oneDriveBtn.disabled?'Collez d’abord un lien OneDrive valide'+(recordOk?'':' et choisissez le contrôle concerné'):'Lien valide — vous pouvez confirmer';
 }
 const finalBtn=$('#centralImportConfirm');
 if(finalBtn){
   finalBtn.disabled=type!=='chronotime'&&!saved;
   finalBtn.title=finalBtn.disabled?'Le lien OneDrive doit être enregistré avant de continuer':'';
 }
 const input=$('#centralOneDriveUrl');
 if(input){
   input.setAttribute('required','required');
   input.setAttribute('aria-invalid',url&& !urlOk?'true':'false');
 }
}

function downloadCentralPdfForOneDrive(){
 const file=centralImportAnalysis?.file;if(!file)return toast('Aucun PDF à enregistrer');
 try{
   const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name||'document.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   const help=$('#centralOneDriveSaveHelp');if(help){help.classList.remove('hidden');help.innerHTML=`<strong>PDF préparé : ${esc(file.name||'document.pdf')}</strong><p>Le navigateur vient de télécharger le PDF. Le dossier racine « Pilotage Service Technique » va s’ouvrir directement : allez dans le sous-dossier voulu puis utilisez <b>Ajouter / Charger → Fichiers</b> et sélectionnez ce PDF. Ensuite copiez son lien et revenez le coller dans l’application.</p>`}
   setTimeout(()=>window.open(ONEDRIVE_PILOTAGE_ROOT,'_blank','noopener'),250);
 }catch(e){console.error(e);toast('Impossible de préparer le PDF pour OneDrive')}
}
async function pasteOneDriveLinkFromClipboard(){
 const input=$('#centralOneDriveUrl');if(!input)return;
 try{
   if(!navigator.clipboard?.readText)throw new Error('Lecture du presse-papiers indisponible');
   const text=String(await navigator.clipboard.readText()||'').trim();
   if(!text)throw new Error('Presse-papiers vide');
   input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));
   updateCentralOneDriveValidationState();
   toast('Lien OneDrive collé');
 }catch(e){
   input.focus();toast('Collez le lien OneDrive dans le champ puis validez');
 }
}
function validateOneDriveDocumentUrl(url){
 const u=String(url||'').trim();if(!/^https:\/\//i.test(u))return 'Le lien doit commencer par https://';
 if(!/(sharepoint\.com|1drv\.ms|onedrive\.live\.com)/i.test(u))return 'Ce lien ne ressemble pas à un lien OneDrive / SharePoint';
 if(u===ONEDRIVE_PILOTAGE_ROOT)return 'Copiez le lien du fichier, pas le lien du dossier racine';
 return '';
}
function confirmCentralOneDriveSaved(){
 if(!centralImportAnalysis)return toast('Aucun document analysé');
 const type=$('#centralImportType')?.value||centralImportAnalysis.detectedType||'other';
 const file=centralImportAnalysis.file;
 const url=String($('#centralOneDriveUrl')?.value||'').trim();
 const err=validateOneDriveDocumentUrl(url);if(err){toast(err);$('#centralOneDriveUrl')?.focus();return false}
 const cls=oneDriveClassificationFor(type,centralImportAnalysis),recordId=$('#centralOneDriveRecord')?.value||'';
 if(cls.module==='periodic'&&!recordId){toast('Choisissez le contrôle périodique concerné');$('#centralOneDriveRecord')?.focus();return false}
 const existing=(db.oneDriveLinks||[]).find(x=>String(x.id)===String(centralImportAnalysis.oneDriveLinkId||''));
 const meta={module:cls.module,recordId,category:String($('#centralOneDriveCategory')?.value||cls.category).trim(),title:file?.name?.replace(/\.pdf$/i,'')||'',fileName:file?.name||'',url,detectedType:type,source:'import-central'};
 let saved;
 if(existing){Object.assign(existing,meta,{updatedAt:new Date().toISOString(),academicYear:activeAcademicYear()});saved=existing}
 else saved=saveOneDriveIndex(meta);
 centralImportAnalysis.oneDriveLinkId=saved.id;
 save(false);
 const help=$('#centralOneDriveSaveHelp');if(help){help.classList.remove('hidden');help.innerHTML=`<strong>✅ Lien OneDrive enregistré et classé</strong><p>${esc(saved.fileName||'Document')} → ${esc(saved.category||'Documents')}${saved.module==='periodic'?'. Il sera rattaché au contrôle sélectionné.':'.'}</p>`}
 updateCentralOneDriveValidationState();
 toast('✅ Lien OneDrive classé dans l’application');
 return saved;
}
function captureCentralOneDriveLink(type,file){
 if(type==='chronotime')return null;
 const existing=(db.oneDriveLinks||[]).find(x=>String(x.id)===String(centralImportAnalysis?.oneDriveLinkId||''));
 if(existing)return existing;
 const url=String($('#centralOneDriveUrl')?.value||'').trim();
 if(!url){toast('Lien OneDrive obligatoire avant validation');$('#centralOneDriveUrl')?.focus();updateCentralOneDriveValidationState();return false;}
 const err=validateOneDriveDocumentUrl(url);if(err){toast(err);return false}
 return confirmCentralOneDriveSaved()||false;
}

// ===== V80 — Import centralisé + archivage des originaux =====
let centralImportAnalysis=null,centralImportDuplicateInfo=null;
function resetCentralImport(){centralImportAnalysis=null;centralImportDuplicateInfo=null;const f=$('#centralPdfFile');if(f)f.value='';$('#centralImportStart')?.classList.remove('hidden');$('#centralImportAnalysis')?.classList.add('hidden');$('#centralImportConfirm')?.classList.add('hidden');if($('#centralImportMeta'))$('#centralImportMeta').innerHTML='';if($('#centralImportPreview'))$('#centralImportPreview').innerHTML='';const c=$('#centralImportConfirm');if(c){c.disabled=false;c.title=''}}
function openCentralImportHub(){const d=$('#centralImportModal');if(!d)return toast('Import central indisponible');resetCentralImport();d.showModal()}
async function genericImportedDocument(file,type){
 const labels={administrative:'Document administratif',other:'Autre document'},label=labels[type]||'Autre document';
 const id=uid();let attachment=null;const od=(db.oneDriveLinks||[]).find(x=>String(x.id)===String(centralImportAnalysis?.oneDriveLinkId||''));
 if(!od){try{attachment=await putFile(file,{module:'imports',recordId:id});db.attachments.push(attachment)}catch(e){console.error(e);toast('Impossible d’archiver le PDF original');return false}}
 const doc={id,no:nextNo('document','DOC'),date:todayISO(),title:file.name.replace(/\.pdf$/i,''),category:label==='Document administratif'?'Administratif':'Autre',description:od?'Original classé dans OneDrive. Supabase conserve le lien et les données.':'Document importé depuis le moteur central.',linkedModule:'Général',attachments:attachment?[attachment]:[],oneDriveLinkId:od?.id||'',importedAt:new Date().toISOString()};
 if(od){od.recordId=id;od.module='documents'}
 db.documents.push(doc);db.importArchives=db.importArchives||[];const archive={id:uid(),sourceId:doc.id,createdAt:doc.importedAt,type:label,fileName:file.name,attachmentId:attachment?.id||'',subject:doc.title,summary:'Document original conservé dans Documentation',module:'documents',recordId:doc.id,fileHash:centralImportAnalysis?.fileHash||'',analysisSnapshot:{type:label,fileName:file.name,subject:doc.title,summary:'Document original conservé dans Documentation',confidence:centralImportAnalysis?Math.max(centralImportAnalysis.chronoConfidence||0,centralImportAnalysis.controlConfidence||0):0}};db.importArchives.push(archive);if(attachment)registerImportOriginal(archive,attachment);await save();renderAll();return true;
}

function centralImportValidationHtml(a){
 const c=a?.chrono||{},r=a?.control||{},type=$('#centralImportType')?.value||a?.detectedType||'other';
 const item=(k,v,ok=true)=>`<article><span>${esc(k)}</span><strong>${esc(v==null||v===''?'À vérifier':String(v))}</strong><small>${ok?'✅':'⚠️'}</small></article>`;
 let cards=[];
 if(type==='chronotime'){
  const counts=c.codeCounts||{};
  cards=[item('Agent',c.agentNameRaw||c.agent?.name||a.details||'',!!(c.agentNameRaw||c.agent)),item('Période',c.start&&c.end?`${c.start} → ${c.end}`:'',!!(c.start&&c.end)),item('Année scolaire',c.academicYear||'',!!c.academicYear),item('Jours reconnus',c.expectedDays?`${c.records?.length||0}/${c.expectedDays}`:`${c.records?.length||0}`,!!(c.records?.length)),item('Jours avec durée',c.durationDays||0,true),item('Présence',c.totals?.presence==null?'Manquante':`${Math.trunc(Math.abs(c.totals.presence)/60)}h${String(Math.abs(c.totals.presence)%60).padStart(2,'0')}`,c.totals?.presence!=null),item('Référence',c.totals?.reference==null?'Manquante':`${Math.trunc(Math.abs(c.totals.reference)/60)}h${String(Math.abs(c.totals.reference)%60).padStart(2,'0')}`,c.totals?.reference!=null),item('Écart annuel',c.totals?.delta==null?'Manquant':`${c.totals.delta<0?'-':c.totals.delta>0?'+':''}${Math.trunc(Math.abs(c.totals.delta)/60)}h${String(Math.abs(c.totals.delta)%60).padStart(2,'0')}`,c.totals?.delta!=null),item('CA',counts.CA||0,true),item('RTT',counts.RTT||0,true),item('RH',counts.RH||0,true),item('RFE',counts.RFE||0,true),item('Informations complètes',c.informationComplete?'Oui':`Non — ${(c.missingInfo||[]).join(', ')||'à vérifier'}`,!!c.informationComplete)];
 }else if(type==='control'||type==='periodic'){
  cards=[item('Organisme',r.organization||'',!!r.organization),item('Famille',r.controlFamily||'',!!r.controlFamily),item('Date du rapport',r.reportDate||'',!!r.reportDate),item('Non-conformités détectées',r.candidates?.length||0,true),item('Confiance',`${r.confidence||0}%`,(r.confidence||0)>=50)];
 }else cards=[item('Type proposé',a.detectedLabel||type,true),item('Confiance Chronotime',`${a.chronoConfidence||0}%`,true),item('Confiance contrôle',`${a.controlConfidence||0}%`,true)];
 return `${duplicateWarningHtml(centralImportDuplicateInfo)}<div class="import-validation-sheet"><h4>Contrôle avant validation</h4><div class="summary-grid">${cards.join('')}</div><p class="hint">Vérifiez ces informations. Rien n’est enregistré avant votre validation finale dans le module concerné.</p></div>`;
}
function refreshCentralImportValidation(){if(!centralImportAnalysis)return;$('#centralImportMeta').innerHTML=centralImportValidationHtml(centralImportAnalysis);centralOneDrivePanel()}
function bindCentralImportV80(){
 $('#centralImportClose')?.addEventListener('click',()=>$('#centralImportModal').close());
 $('#centralImportBack')?.addEventListener('click',resetCentralImport);
 $('#centralScanChoice')?.addEventListener('click',()=>{$('#centralImportModal').close();openScanCameraDirect()});
 $('#centralImportType')?.addEventListener('change',refreshCentralImportValidation);
 $('#centralPdfFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;centralImportDuplicateInfo=await inspectImportDuplicate(file);$('#centralImportStart').classList.add('hidden');$('#centralImportAnalysis').classList.remove('hidden');$('#centralImportProgress').textContent='Analyse du PDF en cours…';$('#centralImportConfirm').classList.add('hidden');try{if(!window.PDFImportModule?.centralAnalyze)throw new Error('Moteur PDF indisponible');centralImportAnalysis=await window.PDFImportModule.centralAnalyze(file);const a=centralImportAnalysis;$('#centralImportType').value=a.detectedType;refreshCentralImportValidation();const url=URL.createObjectURL(file);$('#centralImportPreview').innerHTML=`<details open><summary>📄 Aperçu du PDF original</summary><iframe src="${url}" title="Aperçu PDF" style="width:100%;height:360px;border:1px solid #d9e2ec;border-radius:12px;background:#fff"></iframe></details>`;$('#centralImportProgress').textContent='Analyse terminée — vérifiez toutes les informations avant de continuer.';$('#centralImportConfirm').classList.remove('hidden');updateCentralOneDriveValidationState()}catch(err){console.error(err);$('#centralImportProgress').textContent='Impossible d’analyser ce PDF. Vous pouvez le classer manuellement comme document.';centralImportAnalysis={file,detectedType:'other',detectedLabel:'Autre document',chronoConfidence:0,controlConfidence:0};$('#centralImportType').value='other';refreshCentralImportValidation();$('#centralImportConfirm').classList.remove('hidden');updateCentralOneDriveValidationState()}});
 $('#centralImportConfirm')?.addEventListener('click',async()=>{if(!centralImportAnalysis)return;if(!confirmDuplicateImport(centralImportDuplicateInfo))return;const type=$('#centralImportType').value,file=centralImportAnalysis.file;if(type!=='chronotime'&&!centralImportAnalysis.oneDriveLinkId){toast('Lien OneDrive obligatoire : enregistrez d’abord le lien du fichier');updateCentralOneDriveValidationState();$('#centralOneDriveUrl')?.focus();return}const oneDriveSaved=captureCentralOneDriveLink(type,file);if(oneDriveSaved===false)return;centralImportAnalysis.oneDriveLinkId=oneDriveSaved?.id||'';centralImportAnalysis.fileHash=centralImportDuplicateInfo?.fileHash||'';centralImportAnalysis.duplicateConfirmed=true;if(centralImportAnalysis.chrono)centralImportAnalysis.chrono.duplicateConfirmed=true;if(centralImportAnalysis.control)centralImportAnalysis.control.duplicateConfirmed=true;$('#centralImportModal').close();if(['chronotime','periodic','control'].includes(type)){window.PDFImportModule?.routeCentral?.(centralImportAnalysis,type);if(type==='control'||type==='periodic')toast('Étape 2/2 : validez maintenant le rapport dans Contrôles périodiques');return}if(await genericImportedDocument(file,type)){setView('archives');toast('Document importé et archivé')}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindCentralImportV80);else bindCentralImportV80();


// V147.11 : après chargement de la base, analyser aussi les Chronotime historiques.
window.addEventListener('pst:data-loaded',()=>{
  try{
    const n=syncStoredChronotimePastilles();
    syncRotationYearWithDashboard();
    if(n>0)save(false);
    safeRenderAll();
  }catch(e){console.warn('Reconstruction pastilles Chronotime',e)}
});

// ===== V81 — Scanner / OCR avec destination métier configurable =====
let scannedNoteAttachment=null;
function scanSetProgress(pct,title,text=''){
 const wrap=$('#scanProgress'); if(!wrap)return;
 wrap.classList.toggle('hidden',pct===null);
 if(pct===null)return;
 $('#scanProgressBar').style.width=`${Math.max(0,Math.min(100,pct))}%`;
 $('#scanProgressTitle').textContent=title||'Traitement en cours…';
 $('#scanProgressText').textContent=text||'';
}
function scanReset(){
 const f=$('#scanNoteFile'); if(f)f.value='';
 const t=$('#scanNoteText'); if(t)t.value='';
 const title=$('#scanNoteTitle'); if(title)title.value='';
 const img=$('#scanImagePreview'); if(img){img.src='';img.classList.remove('hidden')}
 const cv=$('#scanPdfCanvas'); if(cv)cv.classList.add('hidden');
 $('#scanPreviewWrap')?.classList.add('hidden');
 if($('#scanQuality'))$('#scanQuality').innerHTML='';
 scannedNoteAttachment=null; scanSetProgress(null);
}
function openScanNote(){
 const d=$('#scanNoteModal'); if(!d)return toast('Scanner indisponible');
 scanReset();
 const cat=$('#scanNoteCategory'), pri=$('#scanNotePriority'), dest=$('#scanDestination');
 if(cat)cat.innerHTML=selectOptions(db.lists.noteCategories||['Autre'],'Autre');
 if(pri)pri.innerHTML=selectOptions(db.lists.priorities||['Normale'],'Normale');
 if(dest)dest.value='notes';
 d.showModal();
}
function localCleanFrenchText(raw){
 let s=String(raw||'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n');
 s=s.split('\n').map(x=>x.trim().replace(/\s+/g,' ')).join('\n');
 s=s.replace(/\s+([,.;!?…:])/g,'$1').replace(/([,.;!?…:])(?=[A-Za-zÀ-ÿ])/g,'$1 ');
 s=s.replace(/\b([Jj])\s['’]\s/g,"$1’").replace(/\b([LlDdMmTtSsCcNn])\s['’]\s/g,'$1’');
 s=s.replace(/\b([0-9]{1,2})\s*h\s*([0-9]{2})\b/gi,'$1h$2');
 // Common OCR / writing normalization without changing meaning.
 const fixes=[[/\bca\b/gi,'ça'],[/\bC est\b/g,"C’est"],[/\bc est\b/g,"c’est"],[/\bd accord\b/gi,"d’accord"],[/\baujourd hui\b/gi,"aujourd’hui"],[/\bn est\b/gi,"n’est"],[/\bqu il\b/gi,"qu’il"],[/\bj ai\b/gi,"j’ai"],[/\bil y a\s+a\b/gi,'il y a']];
 for(const [r,v] of fixes)s=s.replace(r,v);
 s=s.split('\n').map(line=>{if(!line)return '';const m=line.match(/^(?:[-•]|\d+[.)])\s*/);const prefix=m?m[0]:'';let body=m?line.slice(prefix.length):line;if(body)body=body.charAt(0).toUpperCase()+body.slice(1);return prefix+body}).join('\n');
 return s.trim();
}
function formatScannedNote(raw){
 let s=localCleanFrenchText(raw);
 const lines=s.split('\n').map(x=>x.trim()).filter(Boolean);
 if(lines.length<=1){
   // Split long OCR blocks on sentence boundaries to improve readability.
   s=s.replace(/([.!?])\s+(?=[A-ZÀ-ÖØ-Þ])/g,'$1\n');
 }else{
   s=lines.join('\n');
 }
 return s.replace(/\n{3,}/g,'\n\n').trim();
}
async function languageToolCorrect(text){
 const cleaned=formatScannedNote(text); if(!cleaned)return '';
 const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),12000);
 try{
   const body=new URLSearchParams({text:cleaned,language:'fr-FR'});
   const res=await fetch('https://api.languagetool.org/v2/check',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:controller.signal});
   if(!res.ok)throw new Error('LanguageTool '+res.status);
   const data=await res.json(); let out=cleaned;
   const matches=(data.matches||[]).filter(m=>m.replacements&&m.replacements[0]&&Number.isFinite(m.offset)&&Number.isFinite(m.length)).sort((a,b)=>b.offset-a.offset);
   for(const m of matches){const rep=m.replacements[0].value;if(rep&&rep.length<80)out=out.slice(0,m.offset)+rep+out.slice(m.offset+m.length)}
   return formatScannedNote(out);
 }finally{clearTimeout(timer)}
}
async function imageSourceFromFile(file){
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
   if(!window.pdfjsLib)throw new Error('Lecteur PDF indisponible');
   window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
   const buf=await file.arrayBuffer(), pdf=await window.pdfjsLib.getDocument({data:buf}).promise;
   const page=await pdf.getPage(1), vp=page.getViewport({scale:2.2});
   const canvas=$('#scanPdfCanvas'); canvas.width=vp.width;canvas.height=vp.height;canvas.classList.remove('hidden');$('#scanImagePreview').classList.add('hidden');
   await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
   if(pdf.numPages>1)toast(`PDF de ${pdf.numPages} pages : reconnaissance de la première page pour cette note`);
   return canvas;
 }
 const url=URL.createObjectURL(file), img=$('#scanImagePreview'); img.src=url;img.classList.remove('hidden');$('#scanPdfCanvas').classList.add('hidden');
 await new Promise((ok,ko)=>{img.onload=ok;img.onerror=ko});
 return img;
}
function suggestScannedDestination(text){
 const t=normalizeText(text||'');
 const scores={notes:1,issues:0,maintenance:0,requests:0,works:0,meetings:0,periodic:0,documents:0};
 const add=(key,words,pts=2)=>{for(const w of words)if(t.includes(normalizeText(w)))scores[key]+=pts};
 add('periodic',['controle periodique','verification periodique','apave','socotec','dekra','bureau veritas','qualiconsult','rapport de controle','registre de securite'],4);
 add('issues',['securite','danger','incident','non conformite','non-conformite','anomalie','risque','qualite'],3);
 add('maintenance',['panne','reparer','reparation','fuite','maintenance','intervention','defaut','hors service'],3);
 add('requests',['direction','demande de la direction','demande direction','amenagement','demande'],2);
 add('works',['chantier','gpa','architecte','maitrise d oeuvre','reserve','travaux'],3);
 add('meetings',['reunion','rendez vous','rendez-vous','compte rendu','participants','ordre du jour'],3);
 add('documents',['procedure','notice','attestation','courrier','certificat','document administratif'],2);
 return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
}
async function recognizeScannedNote(file){
 if(!file)return;
 $('#scanPreviewWrap')?.classList.remove('hidden');
 scanSetProgress(5,'Préparation du document',file.name||'Document');
 try{
   const source=await imageSourceFromFile(file);
   if(!window.Tesseract)throw new Error('Moteur OCR indisponible');
   scanSetProgress(10,'Lecture de la note','Initialisation de la reconnaissance française…');
   const result=await Tesseract.recognize(source,'fra',{logger:m=>{
     if(m.status==='recognizing text')scanSetProgress(15+Math.round((m.progress||0)*80),'Reconnaissance du texte',`${Math.round((m.progress||0)*100)} %`);
     else if(m.status)scanSetProgress(10,'Préparation OCR',m.status);
   }});
   const raw=result?.data?.text||'', conf=Math.round(result?.data?.confidence||0);
   $('#scanNoteText').value=formatScannedNote(raw);
   const suggested=suggestScannedDestination(raw);if($('#scanDestination'))$('#scanDestination').value=suggested;
   const destLabel=$('#scanDestination')?.selectedOptions?.[0]?.textContent||'Bloc-notes';
   $('#scanQuality').innerHTML=`<span class="badge">OCR : ${conf}% de confiance</span><span class="badge">${raw.trim()?raw.trim().split(/\s+/).length:0} mots détectés</span><span class="badge">Destination proposée : ${esc(destLabel)}</span>`;
   if(!$('#scanNoteTitle').value){const first=formatScannedNote(raw).split('\n').find(Boolean)||'Document scanné';$('#scanNoteTitle').value=first.slice(0,80)}
   scannedNoteAttachment={name:file.name||`scan-${todayISO()}`,type:file.type||'application/octet-stream',file};
   scanSetProgress(100,'Reconnaissance terminée','Relisez le texte, puis utilisez « Corriger et mettre en forme ».');
   setTimeout(()=>scanSetProgress(null),1600);
 }catch(err){console.error(err);scanSetProgress(null);toast('Impossible de reconnaître ce document. Vous pouvez saisir/coller le texte manuellement.');}
}
async function correctScannedNote(){
 const ta=$('#scanNoteText'), raw=ta?.value||''; if(!raw.trim())return toast('Aucun texte à corriger');
 scanSetProgress(15,'Correction du texte','Orthographe, accords, ponctuation et mise en forme…');
 try{
   ta.value=await languageToolCorrect(raw);
   scanSetProgress(100,'Texte corrigé','Relisez le résultat avant l’enregistrement.');toast('Texte corrigé et mis en forme');
 }catch(err){console.warn('Correction avancée indisponible',err);ta.value=formatScannedNote(raw);scanSetProgress(100,'Mise en forme terminée','La correction en ligne est indisponible : nettoyage local appliqué.');toast('Mise en forme locale appliquée');}
 setTimeout(()=>scanSetProgress(null),1800);
}
async function saveScannedNote(){
 const text=($('#scanNoteText')?.value||'').trim(), title=($('#scanNoteTitle')?.value||'').trim(), destination=$('#scanDestination')?.value||'notes';
 if(!text)return toast('Le texte reconnu est vide');
 let scanDuplicateInfo=null;if(scannedNoteAttachment?.file){scanDuplicateInfo=await inspectImportDuplicate(scannedNoteAttachment.file);if(!confirmDuplicateImport(scanDuplicateInfo))return}
 const id=uid(), importedAt=new Date().toISOString(), priority=$('#scanNotePriority')?.value||'Normale', category=$('#scanNoteCategory')?.value||'Autre';
 let attachment=null;
 if(scannedNoteAttachment?.file){
   const f=scannedNoteAttachment.file;
   try{
     attachment=await putFile(f,{module:`scan-${destination}`,recordId:id});
     db.attachments.push(attachment);
   }catch(e){
     console.error('Stockage Supabase du scan impossible',e);
     setSaveState(`Scan non envoyé dans Supabase : ${e?.message||e}`,'error');
     toast('Scan non enregistré : le fichier original n’a pas été synchronisé dans Supabase');
     return;
   }
 }
 const attachments=attachment?[attachment]:[]; let record=null, archiveType='Document scanné', view=destination;
 if(destination==='notes'){
   record={id,no:nextNo('note','NOT'),date:todayISO(),category,agentId:'',title:title||'Note scannée',text,priority,status:'À faire',dueDate:'',items:[],attachments,source:'scan',importedScan:true,importedAt};db.notes.push(record);archiveType='Note scannée';
 }else if(destination==='issues'){
   record={id,no:nextNo('issue','ACT'),date:todayISO(),agentId:'',category:'Sécurité',title:title||'Problématique scannée',description:text,priority,status:'À faire',owner:'',dueDate:'',cost:'',action:'',attachments,source:'scan',importedAt};db.issues.push(record);archiveType='Scan → Sécurité & qualité';
 }else if(destination==='maintenance'){
   record={id,no:nextNo('maintenance','MAI'),date:todayISO(),title:title||'Intervention issue d’un scan',family:db.lists.maintenanceFamilies?.[0]||'Autre',priority,status:'À faire',building:db.buildings[0]?.name||'',floor:'',room:'Zone entière',requester:'Scan document',assigned:'',dueDate:'',description:text,action:'',cost:0,attachments,source:'scan',importedAt};db.maintenance.push(record);archiveType='Scan → Maintenance';
 }else if(destination==='requests'){
   record={id,no:nextNo('request','DIR'),date:todayISO(),type:db.lists.requestTypes?.[0]||'Autre',title:title||'Demande scannée',priority,status:'À faire',building:db.buildings[0]?.name||'',room:'',requester:'Direction',dueDate:'',description:text,response:'',attachments,source:'scan',importedAt};db.requests.push(record);archiveType='Scan → Demande direction';
 }else if(destination==='works'){
   record={id,no:nextNo('work','CHT'),date:todayISO(),type:db.lists.workTypes?.[0]||'Réunion de chantier',title:title||'Document chantier scanné',company:'',architect:'',building:db.buildings[0]?.name||'',priority,status:'À faire',dueDate:'',description:text,decision:'',gpaEnd:'',attachments,source:'scan',importedAt};db.works.push(record);archiveType='Scan → Chantier / GPA';
 }else if(destination==='meetings'){
   record={id,no:nextNo('meeting','RDV'),date:todayISO(),time:'',end:'',type:'Rendez-vous',title:title||'Compte rendu scanné',location:'',participants:'',status:'Planifié',notes:text,actions:'',attachments,source:'scan',importedAt};db.meetings.push(record);archiveType='Scan → Réunion / rendez-vous';
 }else if(destination==='periodic'){
   record={id,no:nextNo('periodic','CP'),name:title||'Contrôle périodique scanné',family:db.lists.periodicFamilies?.[0]||'Autre',intervalMonths:12,requirement:text,provider:'',register:'Registre de sécurité',building:'Tous bâtiments',lastDate:todayISO(),nextDate:addMonthsClamped(todayISO(),12),status:'Réalisé',notes:'Importé depuis un scan. Vérifier la périodicité et la prochaine échéance.',attachments,source:'scan',importedAt};db.periodic.push(record);archiveType='Scan → Contrôle périodique';
 }else{
   record={id,no:nextNo('document','DOC'),date:todayISO(),title:title||'Document scanné',category:'Autre',description:text,linkedModule:'Général',attachments,source:'scan',importedAt};db.documents.push(record);archiveType='Document scanné';view='documents';
 }
 db.importArchives=db.importArchives||[];
 const scanArchive={id:uid(),sourceId:record.id,createdAt:importedAt,type:archiveType,fileHash:scanDuplicateInfo?.fileHash||'',fileName:attachment?.name||scannedNoteAttachment?.name||record.title||record.name||'Scan',attachmentId:attachment?.id||'',subject:record.title||record.name||'',summary:text.slice(0,220),module:view,recordId:record.id,analysisSnapshot:{type:archiveType,correctedOrthography:true,fileName:attachment?.name||scannedNoteAttachment?.name||record.title||record.name||'Scan',subject:record.title||record.name||'',summary:text.slice(0,220),destination:view,category,priority,text,createdAt:importedAt}};db.importArchives.push(scanArchive);if(attachment)registerImportOriginal(scanArchive,attachment);
 await save();renderAll();$('#scanNoteModal')?.close();setView(view);toast(`Scan enregistré dans ${$('#scanDestination')?.selectedOptions?.[0]?.textContent||'le module choisi'} et Archivage`);
}

function openScanCameraDirect(){
 openScanNote();
 // Sur téléphone/tablette, capture="environment" demande directement l'appareil photo arrière.
 // Petit délai pour laisser le dialog s'ouvrir avant le sélecteur natif.
 setTimeout(()=>{
   const camera=$('#scanCameraInput')||$('#scanNoteFile');
   if(camera)camera.click();
   else toast('Appareil photo indisponible');
 },80);
}
function bindScanNoteV77(){
 const b=$('#scanNoteBtn');if(b)b.onclick=openScanCameraDirect;
 const fb=$('#scanNoteFab');if(fb)fb.onclick=openScanCameraDirect;
 const c=$('#scanNoteClose');if(c)c.onclick=()=>$('#scanNoteModal').close();
 const r=$('#scanRetry');if(r)r.onclick=scanReset;
 const f=$('#scanNoteFile');if(f)f.onchange=()=>recognizeScannedNote(f.files?.[0]);
 const corr=$('#scanCorrect');if(corr)corr.onclick=correctScannedNote;
 const saveBtn=$('#scanSaveNote');if(saveBtn)saveBtn.onclick=saveScannedNote;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindScanNoteV77);else bindScanNoteV77();

document.addEventListener('change',async e=>{const inp=e.target.closest?.('[data-reattach-import]');if(inp&&inp.files?.[0]){await reattachImportOriginal(inp.dataset.reattachImport,inp.files[0]);inp.value=''}});


// V147.9 — Sources du scanner : appareil photo, galerie ou PDF.
(function initScannerSources(){
  const byId=id=>document.getElementById(id);
  const sourceInput=()=>{
    const candidates=[
      document.querySelector('input[type="file"][id*="scan" i]:not(#scanCameraInput):not(#scanGalleryInput):not(#scanPdfInput)'),
      document.querySelector('input[type="file"][name*="scan" i]')
    ];
    return candidates.find(Boolean)||null;
  };
  const forwardFile=(file)=>{
    if(!file)return;
    const target=sourceInput();
    if(!target){toast?.('Entrée du scanner introuvable');return}
    try{
      const dt=new DataTransfer();
      dt.items.add(file);
      target.files=dt.files;
      target.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(e){
      console.error('Transmission fichier scanner',e);
      toast?.('Impossible de transmettre la photo au scanner');
    }
  };
  const bind=()=>{
    const camera=byId('scanCameraInput'), gallery=byId('scanGalleryInput'), pdf=byId('scanPdfInput');
    const cameraBtn=byId('scanTakePhotoBtn'), galleryBtn=byId('scanGalleryBtn'), pdfBtn=byId('scanPdfBtn');
    if(cameraBtn&&!cameraBtn.dataset.bound){cameraBtn.dataset.bound='1';cameraBtn.addEventListener('click',()=>camera?.click())}
    if(galleryBtn&&!galleryBtn.dataset.bound){galleryBtn.dataset.bound='1';galleryBtn.addEventListener('click',()=>gallery?.click())}
    if(pdfBtn&&!pdfBtn.dataset.bound){pdfBtn.dataset.bound='1';pdfBtn.addEventListener('click',()=>pdf?.click())}
    [camera,gallery,pdf].forEach(input=>{
      if(input&&!input.dataset.bound){
        input.dataset.bound='1';
        input.addEventListener('change',()=>forwardFile(input.files?.[0]));
      }
    });
  };
  document.addEventListener('DOMContentLoaded',bind);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('[data-open-scan],#openScanner,.openScanner'))setTimeout(bind,50);
  });
  setTimeout(bind,500);
})();






window.addEventListener('pst:academic-year-changed',()=>{
 try{
   syncAcademicYearFilters(activeAcademicYear());
   safeRenderAll();
   renderGlobalAcademicYear();
 }catch(e){console.warn('Synchronisation globale année scolaire',e)}
});




