/* One domain state drives the scene, accessible list, dossier and public URL. */
(()=>{'use strict';const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};const fold=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
let lang='sr';try{lang=JSON.parse(localStorage.getItem('or-studio-v1:lang'))==='en'?'en':'sr'}catch{}let data,geo,renderer,manifest,bigz=null;const state={world:'atlas',quality:'auto',selected:'',layer:'research',mode:'city',night:false,city:'all',section:'',query:'',interactive:true,gesture:'orbit',connections:true,motion:false,holes:false,claim:'',source:'',relation:'',element:'',era:''};const say=(sr,en)=>lang==='sr'?sr:en, tr=v=>typeof v==='object'?(v?.[lang]||v?.sr||v?.en||''):v;
const layers=[['geography','Geografija','Geography','Klik na otisak otvara OSM izvor. Visine iz etaža su procene; širina reke je ilustrativna.','Select a footprint for its OSM source. Storey heights are estimates; river widths are illustrative.'],['research','Oblasti','Research','Jedan fasadni element = jedan zapis. Krilo = oblast; stub = izvor; otvor = pitanje.','One facade element = one record. Wing = section; pillar = source; opening = question.'],['documents','Dokumentacija','Documents','Izvori navedeni uz zapise. Privatni podnesci nisu javni prilozi.','Sources cited by records. Private submissions are not public attachments.'],['materials','Materijali','Materials','Zapisi o materijalima i konstrukciji; apstraktan omotač, ne presek zgrade.','Material and structure records; an abstract envelope, not a building section.'],['time','Vreme objekta','Building history','Zapisi o izgradnji i promenama; vreme događaja ostaje u izvornom iskazu.','Construction and change records; event dates remain in the original statements.'],['growth','Rast znanja','Growth','Biraj stvarno sačuvanu reviziju. Ranije nedokumentovane faze nisu rekonstruisane.','Select a recorded revision. Undocumented earlier stages are not reconstructed.'],['relations','Veze izvora','Source links','Luk = isti URL citiran u oba pasoša. Izaberi luk za oba kraja i izvor.','An arc means the same URL is cited in both passports. Select it for the source and endpoints.'],['questions','Pitanja','Questions','Eksplicitno nepoznati, sporni i nepotvrđeni podaci ostaju vidljivi.','Explicitly unknown, disputed and unconfirmed records remain visible.'],['density','Gustina znanja','Knowledge density','Izohipsa = nivo zapisanog istraživanja; opadanje 300 m, ćelija 75 m. Topla okolina znači da je blizu nešto zapisano, ne da je ovaj objekat obrađen. Hladan prsten = prijavljen objekat bez ijednog zapisa. Mera je zapisano istraživanje, ne znanje o gradu.','A contour is a level of recorded research; 300 m falloff, 75 m cell. Warm surroundings mean something nearby is recorded, not that this object has been covered. A cold ring marks a registered object with no record at all. It measures recorded research, not knowledge of the city.'],['teams','Timovi','Teams','Prazan temelj označava tim bez kuriranih zapisa. Skulpture predstavljaju dosijee, ne fizičke zgrade.','An empty foundation marks a team without curated records. Sculptures represent dossiers, not physical buildings.']];
/* Layer type comes from claim.category (assigned at build); the regex below is
   only a fallback for revision snapshots saved before categorization existed. */
const legacyCategory=c=>{const s=fold(c.section+' '+c.title+' '+c.value);if(/materijal|konstruk|beton|opek|celik|drvo|temelj/.test(s))return 'materials';if(/istorij|izgrad|rekonstruk|osniv|godin|period|promen/.test(s))return 'time';if(/unknown|conflict|disput/.test(c.status)||/nepoznat|nije potvr|nisu potvr|nije poznat|ne zna|pretpostav|neslag/.test(s))return 'questions';if(c.sourceIds.length>0)return 'documents';return 'research'};
// An embedded dialog must also keep Tab from moving into the parent document.
document.addEventListener('keydown',e=>{const modal=$('#atlas-drawer');if(e.key!=='Tab'||!modal?.open)return;const items=[...modal.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);if(!items.length){e.preventDefault();modal.focus();return}const at=items.indexOf(document.activeElement);if(at<0||(!e.shiftKey&&at===items.length-1)||(e.shiftKey&&at===0)){e.preventDefault();items[e.shiftKey?items.length-1:0].focus()}});
/* One object can be the subject of several teams. Buildings come from the
   architecture model, so an older revision snapshot groups the same way. */
let buildingsFor=null,buildingsCache=[];
function buildingList(){if(buildingsFor!==data){buildingsFor=data;buildingsCache=(window.AtlasArchitecture?AtlasArchitecture.buildings(data):[]).map(b=>({...b,records:data.claims.filter(c=>b.teams.includes(c.team)).length,passports:b.teams.filter(id=>data.teams.find(t=>t.id===id)?.hasPassport).length}))}return buildingsCache}
function buildingById(id){return buildingList().find(b=>b.id===id&&b.teams.length>1)||null}
function buildingFor(team){return buildingList().find(b=>b.teams.length>1&&b.teams.includes(team))||null}
function teamsOf(b){return b.teams.map(id=>data.teams.find(t=>t.id===id)).filter(Boolean)}
/* The 3D structure colours each team's part of a shared object; the list and the
   dossier repeat the same hue so the picture stays decodable without clicking. */
function tintOf(teamId){const b=buildingFor(teamId);return b&&window.AtlasArchitecture?AtlasArchitecture.tintCss(b.teams.indexOf(teamId),b.teams.length,state.night):null}
function swatch(teamId){const c=tintOf(teamId);if(!c)return null;const s=node('span',undefined,'tint');s.style.background=c;s.setAttribute('aria-hidden','true');return s}
function withTint(el,teamId){const s=swatch(teamId);if(s)el.prepend(s);return el}
function roster(b,host,current){const strip=node('article',undefined,'record');strip.append(node('h3',b.object+' · '+b.teams.length+' '+say('tima na istom objektu','teams on one object')));const v=node('div');
 v.append(node('p',say('Jedna struktura u atlasu nosi podatke svih ovih timova.','One atlas structure carries the data of all these teams.')));
 v.append(node('small',say('Boja = tim: terasa, krak i pilon u atlasu nose boju svog tima; jarbol u sredini je zbir svih.','Colour = team: each terrace, spoke and pylon in the atlas carries its own team hue; the central mast is the shared total.')));
 for(const t of teamsOf(b)){const x=node('button',t.id+' · '+t.claimsCount+' '+say('zapisa','records'));x.title=t.topic;x.disabled=t.id===current;x.onclick=()=>select(t.id);withTint(x,t.id);v.append(x)}
 const whole=node('button',say('Cela zgrada →','Whole building →'));whole.disabled=current===b.id;whole.onclick=()=>select(b.id);v.append(whole);
 strip.append(v);host.append(strip)}
/* A delivered archive is itself data: folders, scans, megabytes and how much of
   it has actually been read. None of it is a claim about the building yet. */
function archiveOf(team){return (data.archives||[]).find(a=>a.team===team)||null}
function archivePanel(a,host){const art=node('article',undefined,'record');art.id='archive-'+a.team;
 art.append(node('h3',say('Predata arhiva · ','Delivered archive · ')+a.files+' '+say('skenova','scans')+' · '+Math.round(a.bytes/1048576)+' MB · '+a.folders+' '+say('fascikli','folders')));
 const v=node('div');v.append(node('p',a.origin));
 const done=a.read.scans,total=a.read.total||1;
 v.append(node('p',say('Pročitano ','Read ')+done+' / '+total+' '+say('skenova','scans')+' ('+Math.round(done/total*100)+'%) — '+a.read.status));
 const bar=node('div',undefined,'readbar'),fill=node('span');fill.style.width=Math.max(1,Math.round(done/total*100))+'%';bar.append(fill);bar.setAttribute('role','img');
 bar.setAttribute('aria-label',say('Pročitano ','Read ')+done+' od '+total);v.append(bar);
 const list=node('ul',undefined,'tiers');
 for(const s of a.sections){const li=node('li');li.append(node('b',s.name),node('span',s.files+' '+say('skenova','scans')+' · '+s.mb+' MB'));list.append(li)}
 v.append(list);v.append(node('p',say('Zlatna skala uz toranj pokazuje ukupan napredak čitanja. Pojedinačni sanduci nemaju potvrđen status čitanja.','The gold gauge beside the tower shows overall reading progress. Individual crates have no verified reading status.')));
 {const go=node('button',say('Uđi u arhiv →','Enter the archive →'));go.className='gate-enter';go.disabled=!bigz;
  go.onclick=()=>{if(drawer?.open)drawer.close();enterArchive()};v.append(go)}v.append(node('small',a.note));v.append(node('small',a.contentNote));
 v.append(node('small',say('Čuvanje: ','Custody: ')+a.custody+' · sha256 '+a.sha256.slice(0,16)+'…'));
 art.append(v);host.append(art)}
/* U arhiv se ulazi kroz atlas, a ne kroz spisak svetova iznad scene. Kada je
   izabran objekat koji je predao arhivu, uz skulpturu se otvara kapija: brojevi
   predate grade, koliko je od nje stvarno procitano, i jedna stvar koja ceka
   unutra. Dugme iz trake je uklonjeno - traka je zbog njega prelazila preko
   zaglavlja, a i pogresno je govorila da je arhiv ravnopravan pogled na isti
   grad; to je zaseban prostor jednog objekta. */
let gateFor='',gateClosed='';
function archiveTeaser(){if(!bigz)return '';
 const dates=bigz.chronology.filter(e=>e.from).map(e=>e.from).sort();
 const parts=[];
 if(bigz.lift)parts.push(say('okno dizalice '+String(bigz.lift.hoistMetres).replace('.',',')+' m — jedina stvarna mera u arhivu','a '+bigz.lift.hoistMetres+' m lift shaft — the one real measurement in the archive'));
 if(dates.length)parts.push(say(bigz.chronology.length+' datuma prepisanih sa skenova, od '+dates[0].slice(0,4)+'. do '+dates.at(-1).slice(0,4)+'.',bigz.chronology.length+' dates transcribed off the scans, '+dates[0].slice(0,4)+'–'+dates.at(-1).slice(0,4)));
 const days=(bigz.labour||[]).reduce((n,p)=>n+(p.total||0),0);
 if(days)parts.push(say(days.toLocaleString('sr-RS')+' nadnica po zanatu sa platnih spiskova',days.toLocaleString('en-GB')+' man-days by trade from the payroll lists'));
 return parts.join(' · ')}
/* Jednom unutra, bocni spisak prestaje da bude spisak timova: u arhivu postoje
   fascikle. Svaka kaze koliko nosi skenova i koliko je od njih procitano, a
   klik vodi kameru do te police. Bez ovoga je arhiv imao prostor bez sadrzaja
   i pretragu koja trazi objekte kojih tamo nema. */
function archiveSidebar(){const list=$('#list');if(!bigz)return;
 const q=fold(state.query.trim()),folderHits=bigz.folders.filter(f=>!q||fold(f.path).includes(q));
 const scanHits=q?bigzIndex().filter(e=>e.f.includes(q)).map(e=>e.r):[];
 $('#result-count').textContent=folderHits.length+' / '+bigz.folders.length+' '+say('fascikli','folders')+(q?' · '+scanHits.length+' '+say('skenova po sadržaju','scans by content'):'');
 list.replaceChildren();
 for(const f of folderHits.sort((a,b)=>b.read-a.read||b.files-a.files||a.path.localeCompare(b.path))){
  const b=node('button');b.dataset.id=f.id;b.className='item';b.setAttribute('aria-current',String(state.selected===f.id));
  b.append(node('b',f.read?f.read+'/'+f.files:String(f.files)),node('span',f.name),
   node('small',f.mb+' MB · '+(f.read?say('pročitano ','read ')+f.read:say('još nije čitano','not read yet'))+(f.depth?' · '+say('podfascikla','subfolder'):'')));
  b.onclick=()=>{state.selected=f.id;$('#scene-status').replaceChildren();bigzPick(f.id);renderer?.focus(f.id);render()};
  list.append(b)}
 /* Pogodak u sadržaju skena: kamera leti na tačno tu ploču, ploča odgovara. */
 if(scanHits.length){list.append(node('p',say('Pogoci u pročitanim skenovima','Hits in read scans')+' · '+scanHits.length,'hit-head'));
  for(const r of scanHits.slice(0,16)){const b=node('button');b.className='item hit';
   b.append(node('b',r.kind.split(/[ /]/)[0].slice(0,5)),node('span',tr(r.title)),node('small',r.folder+' — '+snippet(r.text,q)));
   b.onclick=()=>{$('#scene-status').replaceChildren();bigzPick(r.id);renderer?.focus('bigz:r:'+r.id)};list.append(b)}
  if(scanHits.length>16)list.append(node('small',say('… i još ','… and ')+(scanHits.length-16)+say(' skenova — suzi upit',' more scans — narrow the query'),'hit-more'))}
 if(!folderHits.length&&!scanHits.length)list.append(node('p',say('Nema pogodaka ni u imenu fascikle ni u sadržaju pročitanih skenova.','No hits in folder names or in the contents of read scans.')))}
/* The era dam: one slider, read off the dates the documents themselves carry.
   Dragging it left sinks everything later than the chosen year into the ground
   tone — the site as it stood at that moment. The full-right position is the
   whole archive and keeps the URL clean. */
let eraMeta=null,eraQueued=false;
function eraSetup(){if(eraMeta||!bigz)return;const years=[];
 for(const e of bigz.chronology||[])years.push(+String(e.from).slice(0,4));
 for(const r of bigz.readings||[])if(r.date)years.push(+String(r.date).slice(0,4));
 for(const p of bigz.labour||[])if(p.from)years.push(+String(p.from).slice(0,4));
 const ys=years.filter(Number.isFinite).sort((a,b)=>a-b);if(!ys.length)return;
 eraMeta={min:ys[0],max:ys[ys.length-1],years:ys};
 const s=$('#era');if(!s)return;s.min=eraMeta.min;s.max=eraMeta.max;
 s.oninput=()=>{const v=+s.value;state.era=v>=eraMeta.max?'':String(v);eraNote();
  if(!eraQueued){eraQueued=true;requestAnimationFrame(()=>{eraQueued=false;render();url(false)})}}}
function eraNote(){if(!eraMeta)return;const n=$('#era-note');if(!n)return;
 if(!state.era){n.textContent=say('celo gradilište · ','whole site · ')+eraMeta.min+'–'+eraMeta.max;return}
 const seen=eraMeta.years.filter(y=>y<=+state.era).length;
 n.textContent=say('do kraja ','up to ')+state.era+'. · '+seen+'/'+eraMeta.years.length+say(' datiranih tragova',' dated traces')}
function archiveGate(){const gate=$('#archive-gate'),exit=$('#archive-exit');if(!gate)return;
 exit.hidden=state.world!=='bigz';
 const eraBar=$('#era-bar');
 if(eraBar){eraSetup();eraBar.hidden=state.world!=='bigz'||!eraMeta;
  if(!eraBar.hidden){$('#era').value=state.era||eraMeta.max;eraNote()}}
 const a=state.world==='atlas'&&state.selected?archiveOf(state.selected):null;
 if(!a||!bigz||gateClosed===state.selected){gate.hidden=true;gateFor='';return}
 if(gateFor!==state.selected){gateFor=state.selected;
  $('#gate-title').textContent=a.object;
  const fig=$('#gate-figures');fig.replaceChildren();
  for(const [v,sr,en]of [[a.files,'skenova','scans'],[a.folders,'fascikli','folders'],[Math.round(a.bytes/1048576)+' MB','predato','delivered']]){
   const d=node('div');d.append(node('b',String(v)),node('span',say(sr,en)));fig.append(d)}
  $('#gate-read').textContent=say('Pročitano ','Read ')+a.read.scans+' / '+a.read.total+' ('+Math.round(a.read.scans/a.read.total*100)+'%)';
  $('#gate-gauge').setAttribute('aria-label',$('#gate-read').textContent);
  $('#gate-line').textContent=archiveTeaser();
  gate.hidden=false;
  /* Skala se puni tek posto je kapija na ekranu - inace prelaza nema. */
  const fill=$('#gate-gauge span');fill.style.width='0';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{fill.style.width=Math.max(2,Math.round(a.read.scans/a.read.total*100))+'%'}));
 }else gate.hidden=false}
function enterArchive(){if(!bigz)return;
 state.world='bigz';state.selected='';state.claim='';state.source='';state.relation='';state.element='';
 $('#scene-status').replaceChildren();gateClosed='';gateFor='';
 const curtain=$('#archive-curtain');
 if(curtain&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  $('#curtain-line').textContent=say(bigz.totals.files+' skenova · '+bigz.totals.folders+' fascikli · pročitano '+bigz.totals.read,bigz.totals.files+' scans · '+bigz.totals.folders+' folders · '+bigz.totals.read+' read');
  curtain.hidden=false;setTimeout(()=>{curtain.hidden=true},950)}
 render();renderer?.home();url();$('#archive-exit').focus({preventScroll:true})}
function leaveArchive(back){state.world='atlas';state.selected=back||'';state.claim='';state.source='';state.relation='';state.element='';
 $('#scene-status').replaceChildren();gateClosed=state.selected;gateFor='';render();
 if(state.selected)renderer?.focus(state.selected);else renderer?.home();url()}
function buildingDossier(b){const teams=teamsOf(b),records=data.claims.filter(c=>b.teams.includes(c.team));$('#dossier').hidden=false;
 $('#d-badge').textContent=b.id+' / '+say('ZGRADA · ZAJEDNIČKI PREDMET','BUILDING · SHARED SUBJECT');
 $('#d-title').textContent=b.object;
 $('#d-meta').textContent=teams.length+' '+say('timova','teams')+' / '+b.passports+' '+say('pasoša','passports')+' / '+records.length+' '+say('zapisa','records');
 $('#d-topic').textContent=teams.map(t=>t.id+': '+t.topic).join(' · ');
 $('#d-location').textContent=say('Skulptura je sastavljena od krila svih timova; visina jarbola prati ukupan broj zapisa, a ne meru zgrade.','The sculpture is assembled from every team wing; mast height follows the total record count, not any building measurement.');
 const link=$('#passport-link');link.href='../timovi/'+teams[0].id+'.html';link.textContent=say('Otvori registar prvog tima →','Open the first team register →');
 const sections=$('#section-filters');sections.replaceChildren();
 for(const t of teams){const x=node('button',t.id+(t.hasPassport?' ✓':''));x.setAttribute('aria-pressed','false');x.title=t.topic;x.onclick=()=>select(t.id);withTint(x,t.id);sections.append(x)}
 const host=$('#records');host.replaceChildren();
 for(const t of teams){const art=node('article',undefined,'record');art.id='wing-'+t.id;art.append(withTint(node('h3',t.id+' — '+t.topic),t.id));const v=node('div');
  v.append(node('p',t.hasPassport?(t.previewClaim||say('Pasoš bez prikaza prvog zapisa.','Passport without a preview record.')):say('Tim još nema kuriran pasoš; njegovo krilo stoji kao prazan temelj.','No curated passport yet; this wing stands as an empty foundation.')));
  v.append(node('small',t.claimsCount+' '+say('zapisa','records')+' · '+t.sectionsCount+' '+say('oblasti','sections')+' · '+t.indices.join(' ')));
  const open=node('button',say('Otvori dosije tima →','Open the team dossier →'));open.onclick=()=>select(t.id);v.append(open);
  art.append(v);host.append(art)}
 const src=$('#sources');src.replaceChildren();
 for(const s of data.sources.filter(s=>b.teams.includes(s.team))){const n=node('div',undefined,'source');n.id='source-'+s.id;n.append(node('b',s.team+' · '+s.id.split(':').pop()),sourceLink(s));src.append(n)}
 const rel=$('#relations');rel.replaceChildren();
 for(const r of data.relations.filter(r=>b.teams.includes(r.from)&&b.teams.includes(r.to))){const p=node('p',undefined,'source'),x=node('button',r.from+' ↔ '+r.to);x.onclick=()=>select(r.from);p.append(x,sourceLink({url:r.url,label:r.url}));rel.append(p)}}
function layerClaims(){if(['geography','teams','relations'].includes(state.layer))return [];return data.claims.filter(c=>['materials','time','questions','documents'].includes(state.layer)?(state.layer==='questions'?/unknown|conflict|disput|unconfirmed/.test(c.status)||(c.category||legacyCategory(c))==='questions':state.layer==='documents'?c.sourceIds.length>0:state.layer==='materials'?['materials','structure'].includes(c.category||legacyCategory(c)):state.layer==='time'?['time','history'].includes(c.category||legacyCategory(c)):(c.category||legacyCategory(c))===state.layer):true)}
/* Dubinska pretraga: upit ne gleda samo ime tima nego i sve zapise, izvore i
   (u arhivu) pun tekst pročitanih skenova. Indeks se savija jednom po skupu
   podataka; pogodak u zapisu vraća i tim u listu i sam zapis kao direktan ulaz. */
let searchData=null,searchIdx=null,hitsKey=null,hitsCache=null;
function searchIndex(){if(searchData===data&&searchIdx)return searchIdx;searchData=data;hitsKey=null;
 searchIdx={teams:new Map(data.teams.map(t=>[t.id,fold([t.id,t.object,t.place,t.topic||'',...(t.indices||[])].join(' '))])),
  claims:data.claims.map(c=>({c,f:fold([c.title,c.value,c.section].join(' '))})),
  sources:data.sources.map(s=>({s,f:fold([s.id,s.label||'',s.url||'',s.kind||''].join(' '))}))};
 return searchIdx}
function hits(){const idx=searchIndex(),q=fold(state.query.trim());
 if(hitsCache&&hitsKey===q)return hitsCache;hitsKey=q;
 hitsCache={q,claims:q?idx.claims.filter(e=>e.f.includes(q)).map(e=>e.c):[],
  sources:q?idx.sources.filter(e=>e.f.includes(q)).map(e=>e.s):[]};
 hitsCache.teams=new Set([...hitsCache.claims.map(c=>c.team),...hitsCache.sources.map(s=>s.team)]);
 return hitsCache}
/* Isečak oko pogotka, u izvornom pismu: pozicija iz foldovanog teksta se
   mapira nazad na original, pa „brasovan" nađe i pokaže „Brašovan". */
function snippet(text,q){const s=String(text);if(!q)return s.slice(0,90)+(s.length>90?'…':'');
 let f='';const map=[];for(let i=0;i<s.length;i++){const fc=fold(s[i]);for(let k=0;k<fc.length;k++)map.push(i);f+=fc}
 const at=f.indexOf(q);if(at<0)return s.slice(0,90)+(s.length>90?'…':'');
 const o=map[at]||0,start=Math.max(0,o-30),end=Math.min(s.length,o+q.length+60);
 return (start?'…':'')+s.slice(start,end)+(end<s.length?'…':'')}
let bigzIdxFor=null,bigzIdx=null;
function bigzIndex(){if(bigzIdxFor===bigz&&bigzIdx)return bigzIdx;bigzIdxFor=bigz;
 bigzIdx=(bigz?.readings||[]).map(r=>({r,f:fold([tr(r.title),r.text,r.kind,r.folder,(r.facts||[]).map(x=>x.kind+' '+x.value).join(' ')].join(' '))}));
 return bigzIdx}
/* Gustina znanja: rupa je objekat bez ijednog zapisa, a ne tim bez zapisa —
   tim na zajedničkom, dokumentovanom objektu nije praznina u istraživanju. */
function holeOf(t){const b=(data.buildings||[]).find(b=>b.id===t.building);return (b?b.claimsCount:t.claimsCount)===0}
function densityTally(){const bs=data.buildings||[];const recorded=bs.filter(b=>(b.claimsCount||0)>0).length;
 return {total:bs.length,recorded,holes:bs.length-recorded,teamHoles:data.teams.filter(holeOf).length}}
function matches(t){const h=hits();return (!h.q||searchIndex().teams.get(t.id).includes(h.q)||h.teams.has(t.id))&&(state.city==='all'||(state.city==='unmapped'?t.locationStatus==='unmapped':t.city===state.city))&&(!state.holes||holeOf(t))}
function url(push=true){const p=new URLSearchParams();if(state.selected)p.set('team',state.selected);if(state.element)p.set('element',state.element);if(state.claim)p.set('claim',state.claim);if(state.source)p.set('source',state.source);p.set('layer',state.layer);p.set('mode',state.mode);if(state.world!=='atlas')p.set('world',state.world);if(state.era&&state.world==='bigz')p.set('era',state.era);p.set('revision',data.datasetRevision);if(state.city!=='all')p.set('city',state.city);if(state.holes)p.set('rupe','1');p.set('night',state.night?'1':'0');const hash='#'+p.toString();if(location.hash!==hash)history[push?'pushState':'replaceState'](null,'',hash)}
async function restore(){const p=new URLSearchParams(location.hash.slice(1));const rev=p.get('revision');if(rev&&rev!==data.datasetRevision&&manifest.revisions.some(r=>r.id===rev)){try{const response=await fetch('data/revisions/'+rev+'.json');if(response.ok)data=await response.json()}catch{}}$('#revision').value=data.datasetRevision;$('#revision-slider').value=manifest.revisions.findIndex(r=>r.id===data.datasetRevision);state.selected=data.teams.some(t=>t.id===p.get('team'))||buildingById(p.get('team'))?p.get('team'):'';state.claim=data.claims.some(c=>c.id===p.get('claim')&&c.team===state.selected)?p.get('claim'):'';state.source=data.sources.some(c=>c.id===p.get('source')&&c.team===state.selected)?p.get('source'):'';state.element=p.get('element')||'';state.layer=layers.some(l=>l[0]===p.get('layer'))?p.get('layer'):'research';state.mode=['city','plan','archive','street'].includes(p.get('mode'))?p.get('mode'):'city';state.world=p.get('world')==='bigz'&&bigz?'bigz':'atlas';state.era=state.world==='bigz'&&/^\d{4}$/.test(p.get('era')||'')?p.get('era'):'';state.city=['all','Beograd','unmapped'].includes(p.get('city'))?p.get('city'):'all';state.holes=p.get('rupe')==='1'&&state.layer==='density';state.night=p.has('night')?p.get('night')==='1':readTheme();$('#city').value=state.city;render();if(state.selected)renderer?.focus(state.selected)}
function readTheme(){try{return localStorage.getItem('or-atlas-theme')==='night'}catch{return false}}
function language(){document.documentElement.lang=lang==='sr'?'sr-Latn':'en';all('[data-sr][data-en]').forEach(n=>n.textContent=n.dataset[lang]);$('#language').textContent=lang==='sr'?'EN':'SR';$('#city').options[0].textContent=say('Svi gradovi','All cities');$('#city').options[2].textContent=say('Lokacija nije mapirana','Location not mapped');if(data)render()}

/* The archive answers on screen, in the archive's own terms: a folder says how
   much of it is read, a lit plate says what the scan actually says, and a trade
   column says the man-days printed on that payroll extract. */
function bigzFind(id){if(!bigz)return null;
 const r=bigz.readings.find(r=>'bigz:r:'+r.id===id||r.id===id);if(r)return {kind:'reading',r};
 const f=bigz.folders.find(f=>f.id===id||id.startsWith(f.id+':'));if(f)return {kind:'folder',f};
 const e=bigz.chronology.find(e=>e.id===id);if(e)return {kind:'time',e,r:bigz.readings.find(x=>x.id===e.reading)};
 for(const p of bigz.labour){if(p.id===id)return {kind:'labour',p};const t=p.trades.find(t=>t.id===id);if(t)return {kind:'trade',p,t}}
 if(id==='bigz:lift'||id==='bigz:lift:car')return {kind:'lift'};
 if(id==='bigz:pit')return {kind:'pit'};
 return null}
function bigzPick(id){const host=$('#scene-status');host.replaceChildren();const found=bigzFind(id);
 if(!found){host.append(node('b',say('Arhiv B.I.G.Z.','BIGZ archive')),node('p',bigz?bigz.totals.files+' '+say('skenova u 26 fascikli','scans in 26 folders'):''));return}
 if(found.kind==='reading'||found.kind==='time'){const r=found.r;if(!r){host.append(node('b',found.e.from));return}
  host.append(node('b',tr(r.title)));
  if(found.kind==='time')host.append(node('small',say('Datum sa skena: ','Date on the scan: ')+found.e.raw));
  host.append(node('small',r.folder+' \u00b7 '+r.kind));
  host.append(node('p',r.text));
  if(r.facts.length){const ul=node('ul',undefined,'tiers');for(const f of r.facts){const li=node('li');li.append(node('b',f.kind),node('span',f.value));ul.append(li)}host.append(ul)}
  host.append(node('small',say('\u010citljivost: ','Legibility: ')+r.legibility+' \u00b7 '+say('pouzdanost: ','confidence: ')+r.confidence));
  host.append(node('small',say('Pro\u010ditan sadr\u017eaj skena \u2014 nije paso\u0161ka tvrdnja. Sken nije javan.','Read content of the scan \u2014 not a passport claim. The scan itself is not public.')));
  return}
 if(found.kind==='folder'){const f=found.f;host.append(node('b',f.name));host.append(node('small',f.path));
  host.append(node('p',f.files+' '+say('skenova','scans')+' \u00b7 '+f.mb+' MB \u00b7 '+say('pro\u010ditano ','read ')+f.read+'/'+f.files));
  const bar=node('div',undefined,'readbar'),fill=node('span');fill.style.width=Math.max(1,Math.round(f.read/Math.max(1,f.files)*100))+'%';bar.append(fill);
  bar.setAttribute('role','img');bar.setAttribute('aria-label',say('Pro\u010ditano ','Read ')+f.read+' od '+f.files);host.append(bar);
  host.append(node('small',say('Svaka plo\u010da je jedan sken. Osvetljena plo\u010da je pro\u010ditana.','Each plate is one scan. A lit plate has been read.')));
  return}
 if(found.kind==='labour'||found.kind==='trade'){const p=found.p;host.append(node('b',p.list));
  host.append(node('small',p.from+' \u2192 '+p.to));
  if(found.kind==='trade')host.append(node('p',found.t.name+': '+found.t.days.toLocaleString('sr-RS')+' '+say('nadnica','man-days')));
  host.append(node('p',say('Svega ','Total ')+p.total.toLocaleString('sr-RS')+' '+say('nadnica','man-days')+' \u00b7 '+say('kvalifikovanih ','skilled ')+p.qualified.toLocaleString('sr-RS')+' \u00b7 '+say('obi\u010dnih ','unskilled ')+p.common.toLocaleString('sr-RS')+' \u00b7 '+p.amount));
  host.append(node('small',say('Visina stuba je logaritamska, da i 4 i 15.969 nadnica ostanu \u010ditljivi.','Column height is logarithmic so both 4 and 15,969 man-days stay readable.')));
  return}
 if(found.kind==='lift'){const l=bigz.lift;host.append(node('b',say('Okno dizalice \u00b7 ','Lift shaft \u00b7 ')+l.hoistMetres.toFixed(2)+' m'));
  host.append(node('p',l.maker));
  const ul=node('ul',undefined,'tiers');
  for(const [k,v] of [[say('visina dizanja','hoist height'),l.hoistMetres.toFixed(2)+' m'],[say('stajali\u0161ta','stops'),String(l.stops)],[say('ulazi','entrances'),String(l.entrances)],[say('nosivost','capacity'),l.capacityKg+' kg / '+l.persons+' '+say('osoba','persons')],[say('brzina','speed'),l.speed],[say('struja','power'),l.power],[say('kabina','car'),l.car.w+' \u00d7 '+l.car.d+' \u00d7 '+l.car.h+' m'],[say('porud\u017ebina','order'),l.order]]){const li=node('li');li.append(node('b',k),node('span',v));ul.append(li)}
  host.append(ul);host.append(node('small',l.note));return}
 if(found.kind==='pit'){host.append(node('b',say('Jama, 1937.','The pit, 1937')));
  host.append(node('p',say('Oblik je \u010ditan sa fotografija iskopa: stepenasti zasek koji je dr\u017eao vodu. Dubina ovde nije merena vrednost.','The shape is read off the excavation photographs: a stepped cut that held water. The depth here is not a measured value.')));
  host.append(node('small','24. V 1937 \u2014 \u201e\u041f\u0440\u0435\u0434\u045a\u0438 \u0434\u0435\u043e \u0458\u0430\u043c\u0435 \u043f\u043e\u0434 \u0432\u043e\u0434\u043e\u043c\u201c'));return}}
function select(id,claim,source,relation,fromScene=false,element=''){if(drawer?.open&&moved?.classList.contains('sidebar'))drawer.close();const same=state.selected===id;state.selected=id;state.section='';state.claim=claim||'';state.source=source||'';state.relation=relation||'';state.element=element;$('#scene-status').replaceChildren();render();if(!same&&!fromScene)renderer?.focus(id);url();if(claim)document.getElementById(claim)?.classList.add('highlight');}
function close(){if(drawer?.open)drawer.close();state.selected='';state.claim='';state.source='';state.relation='';state.element='';$('#scene-status').replaceChildren();render();url();$('#world').focus({preventScroll:true})}
function sourceLink(s){const a=node('a',s.label||s.kind||s.id);if(s.url&&/^https?:\/\//.test(s.url)){a.href=s.url;a.target='_blank';a.rel='noopener noreferrer'}else{a.removeAttribute('href');a.append(document.createTextNode(say(' · neveb izvor',' · offline source')))}return a}
function dossier(){const building=buildingById(state.selected);if(building){buildingDossier(building);return}const t=data.teams.find(t=>t.id===state.selected);$('#dossier').hidden=!t;if(!t)return;$('#d-badge').textContent=t.id+' / '+say('DOS IJE ISTRAŽIVANJA'.replace('DOS IJE','DOSIJE'),'RESEARCH DOSSIER');$('#d-title').textContent=t.object;$('#d-meta').textContent=t.indices.join(' · ')+' / '+t.city+' / '+t.claimsCount+' '+say('zapisa','records');$('#d-topic').textContent=t.topic;if(t.city&&t.city!=='Beograd'){$('#d-location').innerHTML='<b>'+t.city+'</b> · '+say('Objekat je van beogradskog 3D modela. Dostupan u kolažu i na mapi timova: ','Object is beyond the Belgrade 3D model. Available in Collage and team map: ')+'<a href="../timovi.html#'+t.id+'" target="_blank">'+say('Prikaži na mapi timova →','Show on team map →')+'</a>';}else{$('#d-location').textContent=t.locationStatus==='unmapped'?say('Tačna lokacija još nije mapirana. Dostupno u kolažu.','Exact location is not mapped yet. Available in Collage.'):say('Približna tačka iz registra; nije potvrđena granica objekta.','Approximate registry pin; not a verified building boundary.');}const link=$('#passport-link');link.href='../timovi/'+t.id+'.html';link.textContent=t.hasPassport?say('Ceo pasoš sa izvorima →','Full passport with sources →'):say('Otvori tim u registru →','Open team register →');
const sections=$('#section-filters');sections.replaceChildren();for(const s of [{id:'',title:{sr:'Sve oblasti',en:'All sections'}},...data.sections.filter(s=>s.team===t.id)]){const b=node('button',tr(s.title));b.setAttribute('aria-pressed',String(state.section===s.id));b.onclick=()=>{state.section=s.id;dossier();height()};sections.append(b)}
const records=$('#records');records.replaceChildren();const shared=buildingFor(t.id);if(shared)roster(shared,records,t.id);const arch=archiveOf(t.id);if(arch)archivePanel(arch,records);const cs=layerClaims().filter(c=>c.team===t.id&&(!state.section||state.section===c.section));if(!cs.length)records.append(node('p',say('U ovom sloju nema povezanih zapisa. Izaberi Oblasti za ceo dosije.','No linked records in this layer. Choose Research for the full dossier.')));for(const c of cs){const row=node('article',undefined,'record');row.lang='sr-Latn';row.id=c.id;row.append(node('h3',c.title));const v=node('div');v.append(node('p',c.value));v.append(node('small',c.status==='source-reported'?say('Prema navedenom izvoru · nije nezavisno potvrđeno','Source-reported · not independently verified'):c.status));for(const ref of c.sourceIds){const s=data.sources.find(s=>s.id===ref);if(s){const a=node('a',ref);a.href='#source-'+ref;a.onclick=e=>{e.preventDefault();document.getElementById('source-'+ref)?.scrollIntoView({block:'center'})};v.append(a)}}row.append(v);records.append(row)}
const attachments=node('section');attachments.append(node('h3',say('Prilozi','Attachments')));const media=(data.media||[]).filter(m=>m.team===t.id);if(!media.length)attachments.append(node('p',say('Nema priloga odobrenih za javni prikaz.','No attachments approved for public display.')));for(const m of media){const figure=node('figure'),a=node('a');a.href='../'+m.href;a.target='_blank';a.rel='noopener noreferrer';if(/\.pdf$/.test(m.href))a.textContent=m.caption;else{const img=document.createElement('img');img.src='../'+m.href;img.alt=m.alt;img.loading='lazy';img.style.cssText='max-width:100%;max-height:65vh;object-fit:contain';a.append(img)}figure.append(a,node('figcaption',m.caption+' · '+m.credit+' · '+m.license));attachments.append(figure)}records.append(attachments);const src=$('#sources');src.replaceChildren();for(const s of data.sources.filter(s=>s.team===t.id)){const n=node('div',undefined,'source');n.id='source-'+s.id;n.append(node('b',s.id),sourceLink(s));src.append(n)}const rel=$('#relations');rel.replaceChildren();for(const r of data.relations.filter(r=>r.from===t.id||r.to===t.id)){const p=node('p',undefined,'source'),other=r.from===t.id?r.to:r.from,b=node('button',say('Zajednički izvor sa ','Shared source with ')+other);b.onclick=()=>select(other);p.append(b,sourceLink({url:r.url,label:r.url}));rel.append(p)}}
/* On a phone the tool strip is scrollable, so the active mode can sit outside
   the visible part of it. Keep it in view by moving the strip itself — never
   the page, which would fight the map under the finger. */
function keepModeInView(){const strip=$('.scene-tools'),active=$('[data-mode][aria-pressed=true]')||$('[data-world][aria-pressed=true]');
 if(!strip||!active||strip.scrollWidth<=strip.clientWidth+1)return;
 const s=strip.getBoundingClientRect(),a=active.getBoundingClientRect();
 if(a.left<s.left+4)strip.scrollLeft-=s.left+4-a.left;else if(a.right>s.right-4)strip.scrollLeft+=a.right-(s.right-4)}
function render(){const focusLayer=document.activeElement?.dataset?.layer,focusTeam=document.activeElement?.classList?.contains('item')?document.activeElement.dataset.id:null;const visible=data.teams.filter(matches),ids=new Set(visible.map(t=>t.id)),cs=layerClaims().filter(c=>ids.has(c.team));document.body.classList.toggle('night',state.night);document.documentElement.classList.toggle('night',state.night);document.body.style.color='var(--ink)';document.body.style.background='var(--paper)';$('#connections').setAttribute('aria-pressed',String(state.connections));$('#motion').setAttribute('aria-pressed',String(state.motion));$('#gesture').setAttribute('aria-pressed',String(state.gesture==='pan'));$('#night').textContent=state.night?say('Dan','Day'):say('Noć','Night');parent!==window&&parent.postMessage({type:'or-atlas-theme',night:state.night},location.origin);selection();archiveGate();$('#night').setAttribute('aria-pressed',String(state.night));all('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));keepModeInView();all('[data-world]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.world===state.world)));document.body.classList.toggle('bigz',state.world==='bigz');if(state.mode==='street')state.interactive=true;$('.stage').classList.toggle('active',state.interactive);$('#interactive').setAttribute('aria-pressed',String(state.interactive));$('.workspace').classList.toggle('street',state.mode==='street');$('#walk-controls').hidden=state.mode!=='street';$('#walk-help').hidden=true;for(const id of ['plus','minus','gesture','interactive'])$('#'+id).disabled=state.mode==='street';$('#mode-note').textContent=state.world==='bigz'?(state.mode==='street'?say('ARHIV B.I.G.Z. · FPS','BIGZ ARCHIVE · FPS'):say('ARHIV B.I.G.Z. · 289 SKENOVA','BIGZ ARCHIVE · 289 SCANS')):state.mode==='street'?say('FPS · PROSTOR PODATAKA','FPS · DATA SPACE'):state.mode==='archive'?say('KOLAŽ / APSTRAKTAN RASPORED','COLLAGE / ABSTRACT LAYOUT'):say('BEOGRAD · SKULPTURE PODATAKA','BELGRADE · DATA SCULPTURES');$('#totals').replaceChildren();for(const [value,label]of (state.world==='bigz'&&bigz?[[bigz.totals.files,say('skenova','scans')],[bigz.totals.folders,say('fascikli','folders')],[bigz.totals.read,say('pročitano','read')],[bigz.chronology.length,say('datuma','dates')]]:[[data.teams.length,say('timova','teams')],[data.teams.filter(t=>t.hasPassport).length,say('pasoša','passports')],[data.claims.length,say('zapisa','records')],[buildingList().filter(b=>b.teams.length>1).length,say('zajedničkih objekata','shared objects')]])){const n=node('span',label);n.prepend(node('b',value));$('#totals').append(n)}
const h=hits();$('#result-count').textContent=visible.length+' / '+data.teams.length+' '+say('timova','teams')+(h.q&&h.claims.length?' · '+h.claims.length+' '+say('zapisa','records'):'')+(h.q&&h.sources.length?' · '+h.sources.length+' '+say('izvora','sources'):'');const list=$('#list');list.replaceChildren();
for(const b of buildingList().filter(b=>b.teams.length>1&&b.teams.some(id=>ids.has(id)))){const x=node('button');x.dataset.id=b.id;x.className='item shared';x.setAttribute('aria-current',String(state.selected===b.id));x.append(node('b',b.teams.length+'×'),node('span',b.object),node('small',b.teams.join(' · ')+' · '+b.records+' '+say('zapisa','records')));x.onclick=()=>select(b.id);list.append(x)}for(const t of [...visible].sort((a,b)=>b.claimsCount-a.claimsCount||a.id.localeCompare(b.id))){const b=node('button');b.dataset.id=t.id;b.className='item';b.setAttribute('aria-current',String(state.selected===t.id));b.append(node('b',t.id),node('span',t.object),node('small',t.claimsCount+' '+say('zapisa','records')+' · '+t.city));b.onclick=()=>select(t.id);list.append(b)}
/* Pogodak u zapisu ili izvoru je direktan ulaz: klik bira tim i taj zapis. */
if(h.q&&state.world!=='bigz'){
 if(h.claims.length){list.append(node('p',say('Pogoci u zapisima','Record hits')+' · '+h.claims.length,'hit-head'));
  for(const c of h.claims.slice(0,14)){const b=node('button');b.className='item hit';
   b.append(node('b',c.team),node('span',c.title),node('small',snippet(c.value,h.q)));
   b.onclick=()=>select(c.team,c.id);list.append(b)}
  if(h.claims.length>14)list.append(node('small',say('… i još ','… and ')+(h.claims.length-14)+say(' zapisa — suzi upit',' more records — narrow the query'),'hit-more'))}
 if(h.sources.length){list.append(node('p',say('Pogoci u izvorima','Source hits')+' · '+h.sources.length,'hit-head'));
  for(const s of h.sources.slice(0,8)){const b=node('button');b.className='item hit';
   b.append(node('b',s.team),node('span',s.label||s.id),node('small',s.url||s.kind||''));
   b.onclick=()=>select(s.team,undefined,s.id);list.append(b)}}}
if(!visible.length&&!(h.q&&(h.claims.length||h.sources.length)))list.append(node('p',say('Nema rezultata — ni u timovima, ni u zapisima, ni u izvorima.','No results in teams, records or sources.')));
$('#layers').replaceChildren();for(const l of layers){const b=node('button',l[lang==='sr'?1:2]);b.dataset.layer=l[0];b.setAttribute('aria-pressed',String(state.layer===l[0]));b.onclick=()=>{state.layer=l[0];if(state.layer==='relations')state.connections=true;if(state.layer!=='density')state.holes=false;state.section='';render();url()};$('#layers').append(b)}const layer=layers.find(l=>l[0]===state.layer);$('#legend').textContent=layer[lang==='sr'?3:4];$('#layer-count').textContent=state.layer==='geography'?(geo?.features.length||0)+' '+say('mapnih elemenata','map features'):state.layer==='teams'?visible.length+' '+say('timova','teams'):state.layer==='relations'?data.relations.filter(r=>ids.has(r.from)&&ids.has(r.to)).length+' '+say('veza','links'):state.layer==='density'?(()=>{const d=densityTally();return d.recorded+' / '+d.total+' '+say('objekata sa zapisom','objects with a record')})():cs.length+' '+say('zapisa u sloju','records in layer');densityKey();var L=data.layout,ln=$('#layout-note');if(L){ln.textContent=say('Raspored: centar nepromenjen · dalje sabijeno na ','Layout: centre unchanged · beyond it compressed to ')+Math.round(L.compress*100)+say('% · razmak do ','% · nudged up to ')+Math.round(L.capUnits*L.metresPerUnit)+' m';ln.title=L.note}else ln.textContent='';const gn=$('#geography-note');gn.textContent=geo?say('Mapni izvod: ','Map extract: ')+geo.features.filter(f=>f.kind==='building').length+' '+say('otisaka · lokacije približne · skulpture nisu u razmeri · list isečen oko objekata','footprints · approximate locations · sculptures not to scale · sheet cropped to the objects'):say('Mapni izvod nije dostupan. Tačke su približne.','Map extract unavailable. Pins are approximate.');gn.title=say('Crtež je isečen na pravougaonik oko prijavljenih objekata uz oko 1 km okolnog konteksta; reka se na rubu stanjuje jer je tu kraj lista, ne kraj reke. Oblaci i tok vode su stilizovana animacija, nisu vremenska prognoza ni izmerena brzina reke; stoje pod prefers-reduced-motion.','The drawing is cropped to a rectangle around the registered objects plus about 1 km of context; the river narrows at the edge because the sheet ends there, not the river. Clouds and water flow are a stylized animation, not a forecast and not a measured current; they stop under prefers-reduced-motion.');dossier();renderer?.update(data,geo,{...state,visible:new Set(visible.map(t=>t.id)),claims:cs});if(focusLayer)document.querySelector('[data-layer="'+focusLayer+'"]')?.focus({preventScroll:true});if(state.world==='bigz')archiveSidebar();$('.sidebar>label').textContent=state.world==='bigz'?say('Pretraži arhiv: fascikle i sadržaj pročitanih skenova','Search the archive: folders and read scan contents'):say('Pretraži: objekat, tim, zapis ili izvor','Search: building, team, record or source');$('#team').placeholder=state.world==='bigz'?say('Brašovan, dizalica, 1937, beton…','Brašovan, lift, 1937, concrete…'):say('Generalštab, T22, beton, fasada…','Generalštab, T22, concrete, facade…');$('.register').hidden=state.world==='bigz';if(focusTeam)document.querySelector('.item[data-id="'+focusTeam+'"]')?.focus({preventScroll:true});height()}
/* Ključ gustine: skala, izmereni odnos i prelaz na same rupe. Ništa u njemu
   nije napisano u HTML-u — svaki broj se čita iz skupa podataka. */
function densityKey(){const host=$('#density-key');if(!host)return;host.hidden=state.layer!=='density';if(host.hidden){host.replaceChildren();return}
 const d=densityTally();host.replaceChildren();
 const ramp=node('div','', 'ramp');ramp.setAttribute('role','img');
 ramp.setAttribute('aria-label',say('Skala: od mesta bez zapisa do najgušće zapisanog','Scale: from places with no record to the most densely recorded'));
 host.append(ramp);
 const ends=node('div','', 'ramp-ends');ends.append(node('span',say('nije zapisano','no record')),node('span',say('najgušće zapisano','densest record')));
 host.append(ends);
 const f=renderer?.stats?.().density;
 host.append(node('p',d.holes+' '+say('objekata bez ijednog zapisa','objects with no record at all')+(f?' · '+f.holes+' '+say('hladnih prstenova na mapi','cold rings on the map')+(d.holes>f.holes?' · '+(d.holes-f.holes)+' '+say('nije mapirano','not mapped'):''):''),'key-line'));
 const b=node('button',state.holes?say('Prikaži sve objekte','Show all objects'):say('Samo rupe','Holes only'));
 b.id='holes-only';b.setAttribute('aria-pressed',String(state.holes));
 b.onclick=()=>{state.holes=!state.holes;render();url()};
 host.append(b);
 if(state.holes)host.append(node('small',d.teamHoles+' '+say('timova stoji na objektu bez zapisa · polje ostaje celo, filter menja listu i skulpture, ne gustinu','teams stand on an object with no record · the field stays whole; the filter changes the list and the sculptures, not the density'),'key-line'));
 if(f)host.append(node('small',say('Izohipse na ','Contours at ')+(f.levels||[]).map(v=>Math.round(v*100)+'%').join(' · ')+say(' vrhunca · σ ',' of the peak · σ ')+f.sigmaMetres+say(' m · ćelija ',' m · cell ')+f.cellMetres+' m','key-line'))}
function selection(){$('#selection-bar').hidden=!state.selected;const host=$('#selection-copy');host.replaceChildren();const picked=buildingById(state.selected);
 if(picked){$('#open-dossier').hidden=false;host.append(node('b',picked.object));host.append(node('span',picked.teams.length+' '+say('tima · zajednički objekat','teams · shared object')+' · '+picked.records+' '+say('zapisa','records')));
  for(const t of teamsOf(picked)){const x=node('button',t.id);x.title=t.topic;x.onclick=()=>select(t.id);host.append(x)}return}
 const t=data.teams.find(t=>t.id===state.selected),c=data.claims.find(c=>c.id===state.claim),s=data.sources.find(s=>s.id===state.source),r=data.relations.find(r=>r.id===state.relation);$('#open-dossier').hidden=!t;
 if(!t){host.append(node('span',say('Izaberi skulpturu. Približi za pojedinačne elemente.','Select a sculpture. Zoom in to explore its elements.')));return}
 host.append(node('b',t.id+' / '+t.object));if(t.city&&t.city!=='Beograd'){host.append(node('span','📍 '+t.city+' · '+say('van beogradskog 3D modela','outside Belgrade 3D model')));const ml=node('a',say('Prikaži na mapi ↗','Show on map ↗'));ml.href='../timovi.html#'+t.id;ml.target='_blank';ml.style.cssText='font-size:11px;font-weight:600;color:var(--gold,#8a6d1f);margin-left:6px;text-decoration:underline';host.append(ml);}
 const element=state.element&&AtlasArchitecture.compile(data).find(m=>m.id===t.id)?.elements.find(e=>e.id===state.element);if(element?.archive&&element.tier){host.append(node('span',element.tier));if(element.role==='archiveCrate')host.append(node('small',say('Arhivski prilog ','Archive attachment ')+(Number(element.id.split(':').at(-1))+1)+say(' · pojedinačni sadržaj nije javno dostupan',' · individual content is not public')));else host.append(node('small',element.files+' '+say('priloga','attachments')+' · '+element.mb+' MB'));host.append(node('small',say('Inventar zbirke · status čitanja ovog priloga nije utvrđen','Collection inventory · individual reading status is unknown')));return}
 if(c){host.append(node('span',c.title+' — '+c.value));host.append(node('small',say('Fasadni element · ','Facade element · ')+c.sourceIds.length+' '+say('izvora','sources')))}
 else if(s)host.append(node('span',say('Stub izvora · ','Source pillar · ')),sourceLink(s));
 else if(r){const b=node('button',r.from+' ↔ '+r.to);b.onclick=()=>select(r.from===t.id?r.to:r.from);host.append(b,sourceLink({url:r.url,label:say('Zajednički izvor ↗','Shared source ↗')}))}
 else if(archiveOf(t.id)&&!t.claimsCount){const a=archiveOf(t.id);host.append(node('span',a.files+' '+say('skenova','scans')+' · '+a.sections.length+' '+say('nivoa arhive','archive tiers')+' · '+Math.round(a.bytes/1048576)+' MB · '+say('pročitano ','read ')+a.read.scans+'/'+a.read.total));host.append(node('small',say('Sanduk = sken, debljina nivoa = megabajti. Još nema tvrdnji iz arhive.','A crate is one scan, tier thickness is megabytes. No claims drawn from the archive yet.')))}
 if(archiveOf(t.id)&&state.world==='atlas'&&gateClosed===t.id){const go=node('button',say('Uđi u arhiv →','Enter the archive →'));go.className='gate-enter';go.disabled=!bigz;go.onclick=()=>{gateClosed='';enterArchive()};host.append(go)}
 else {const m=AtlasArchitecture.compile(data).find(m=>m.id===t.id);host.append(node('span',m.records+' '+say('elemenata','elements')+' · '+m.sections+' '+say('krila','wings')+' · '+m.sources+' '+say('stubova izvora','source pillars')+' · '+m.openings+' '+say('otvora / pitanja','openings / questions')))} }
 $('#open-dossier').onclick=()=>openPanel($('#dossier'),say('Dosije istraživanja','Research dossier'),$('#open-dossier'));
 $('#clear-selection').onclick=close;
 $('#connections').onclick=()=>{state.connections=!state.connections;render()};$('#motion').onclick=()=>{state.motion=!state.motion;render()};$('#replay').onclick=()=>renderer?.replay();$('#gesture').onclick=()=>{state.gesture=state.gesture==='pan'?'orbit':'pan';state.interactive=true;$('#interactive').setAttribute('aria-pressed','true');$('.stage').classList.add('active');render()};
 $('#fullscreen').onclick=async()=>{try{if(drawer.open)drawer.close();if(document.fullscreenElement)await document.exitFullscreen();else await $('.workspace').requestFullscreen()}catch{$('#scene-status').textContent=say('Ceo ekran nije dostupan u ovom pregledaču.','Full screen is unavailable in this browser.')}};
 const drawer=$('#atlas-drawer');let moved=null,placeholder=null,opener=null;function returnPanel(){if(moved){placeholder.replaceWith(moved);moved=null;placeholder=null}}function openPanel(element,title,trigger){if(drawer.open){drawer.close();returnPanel()}opener=trigger||document.activeElement;moved=element;placeholder=document.createComment('panel home');element.before(placeholder);$('#drawer-title').textContent=title;$('#drawer-content').append(element);renderer?.stop();drawer.showModal();$('#drawer-close').focus()}drawer.addEventListener('close',()=>{if(drawer.open)return;returnPanel();opener?.focus({preventScroll:true})});drawer.addEventListener('cancel',e=>{e.preventDefault();drawer.close()});$('#drawer-close').onclick=()=>drawer.close();drawer.addEventListener('click',e=>{if(e.target===drawer){const r=drawer.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)drawer.close()}});$('.skip').onclick=e=>{e.preventDefault();openPanel($('.sidebar'),say('Pronađi tim','Find a team'),e.currentTarget);$('#team').focus()};$('#show-help').onclick=e=>{const h=$('#interaction-help');h.hidden=false;openPanel(h,say('Kretanje i čitanje','Navigation and reading'),e.currentTarget)};$('#atlas-menu').onclick=()=>{const h=$('.atlas-header'),open=h.classList.toggle('menu-open');$('#atlas-menu').setAttribute('aria-expanded',String(open))};$('#show-teams').onclick=e=>openPanel($('.sidebar'),say('Pronađi tim','Find a team'),e.currentTarget);$('#show-layers').onclick=e=>openPanel($('#research-controls'),say('Slojevi i rast','Layers and growth'),e.currentTarget);$('#quality').onchange=()=>{state.quality=$('#quality').value;render()};function height(){if(new URLSearchParams(location.search).get('embed')==='1')requestAnimationFrame(()=>parent.postMessage({type:'or-atlas-height',height:document.documentElement.scrollHeight},location.origin))}
$('#team').oninput=()=>{state.query=$('#team').value;if(state.world==='bigz'){render();return}const result=data.teams.filter(matches);if(result.length===1&&state.query.length>=2){state.selected=result[0].id;state.claim='';state.source='';state.relation='';state.section='';renderer?.focus(state.selected)}render();url(false)};$('#city').onchange=()=>{state.city=$('#city').value;render();url()};$('#language').onclick=()=>{lang=lang==='sr'?'en':'sr';try{localStorage.setItem('or-studio-v1:lang',JSON.stringify(lang))}catch{}language()};$('#night').onclick=()=>{state.night=!state.night;try{localStorage.setItem('or-atlas-theme',state.night?'night':'day')}catch{}render();url()};$('#enter-archive').onclick=()=>enterArchive();
$('#gate-dismiss').onclick=()=>{gateClosed=state.selected;$('#archive-gate').hidden=true;gateFor='';$('#world').focus({preventScroll:true})};
$('#archive-exit').onclick=()=>leaveArchive((data.archives||[])[0]?.team||'');
/* „/" otvara pretragu odakle god: panel sa listom se otvori, polje dobije fokus. */
document.addEventListener('keydown',e=>{if(e.key!=='/'||e.defaultPrevented)return;const t=e.target;
 if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
 e.preventDefault();const field=$('#team');
 if(!field.getClientRects().length)$('#show-teams')?.click();
 requestAnimationFrame(()=>{field.focus({preventScroll:true});field.select()})});
all('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;if(state.mode==='street'){state.interactive=true;$('.stage').classList.add('active');$('#interactive').setAttribute('aria-pressed','true')}render();url()});$('#close').onclick=close;document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(drawer.open){e.preventDefault();drawer.close();return}if(state.mode==='street'){state.mode='city';render();renderer?.home();url()}else if(state.world==='bigz')leaveArchive((data.archives||[])[0]?.team||'');else close()}});$('#reset').onclick=()=>{state.selected='';state.claim='';state.source='';state.relation='';state.query='';state.city='all';$('#team').value='';$('#city').value='all';render();renderer?.home();url()};$('#plus').onclick=()=>renderer?.zoom(.8);$('#minus').onclick=()=>renderer?.zoom(1.25);$('#interactive').onclick=()=>{state.interactive=!state.interactive;$('#interactive').setAttribute('aria-pressed',String(state.interactive));$('.stage').classList.toggle('active',state.interactive);render()};addEventListener('popstate',restore);addEventListener('storage',e=>{if(e.key==='or-studio-v1:lang'){try{lang=JSON.parse(e.newValue)==='en'?'en':'sr'}catch{}language()}});addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='or-language'){lang=e.data.lang==='en'?'en':'sr';language()}});
if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embedded');$('#research-controls').append($('.motion-tools'),$('.quality-label'),$('.map-credit'));document.body.classList.add('immersive');language();const load=async p=>{const r=await fetch(p,{cache:'no-cache'});if(!r.ok)throw Error(p+' '+r.status);return r.json()};
Promise.all([load('data/atlas.json'),load('data/geography.json').catch(()=>null),load('data/revisions/index.json'),load('data/bigz.json').catch(()=>null)]).then(([d,g,h,b])=>{data=d;geo=g;manifest=h;bigz=b;all('[data-world]').forEach(x=>{if(x.dataset.world==='bigz')x.disabled=!bigz});try{renderer=window.AtlasRenderer($('#world'),(id,team)=>{if(state.world==='bigz'){bigzPick(id);return}if(id.startsWith('osm:')){const f=geo?.features.find(f=>f.id===id);if(f){const n=$('#scene-status');n.replaceChildren(node('b',f.name||id),node('p',f.height!==null?f.height+' m / OSM height':f.levels!==null?f.levels+' × 3 m / '+say('procena visine','height estimate'):say('Visina nije poznata','Height unknown')));const a=node('a',say('OSM izvor ↗','OSM source ↗'));a.href='https://www.openstreetmap.org/'+id.slice(4);a.target='_blank';a.rel='noreferrer';n.append(a)}return}const c=data.claims.find(c=>c.id===id),r=data.relations.find(r=>r.id===id),s=data.sources.find(s=>s.id===id);select(c?.team||s?.team||r?.from||(buildingById(id)?id:team||id),c?.id,s?.id,r?.id,true,!c&&!s&&!r&&team&&id!==team?id:'')});renderer.setBigz(bigz)}catch(e){$('#scene-status').textContent=say('3D nije dostupan. Otvori Timovi za pretragu i sve dosijee.','3D unavailable. Open Teams for search and every dossier.')}for(const rev of manifest.revisions){const o=node('option',rev.recordedAt.slice(0,16).replace('T',' ')+' · '+rev.claims+' '+say('zapisa','records'));o.value=rev.id;$('#revision').append(o)}$('#revision').value=d.datasetRevision;const slider=$('#revision-slider');slider.max=manifest.revisions.length-1;slider.value=manifest.revisions.findIndex(r=>r.id===d.datasetRevision);slider.oninput=()=>{$('#revision').value=manifest.revisions[Number(slider.value)].id;$('#revision').dispatchEvent(new Event('change'))};$('#revision-note').textContent=manifest.revisions.length===1?say('Prvo sačuvano stanje; još nema ranije revizije.','First recorded state; no earlier revision yet.'):say('Stvarna sačuvana stanja','Recorded states');$('#revision').onchange=async()=>{slider.value=manifest.revisions.findIndex(r=>r.id===$('#revision').value);const old=data;try{data=await load('data/revisions/'+$('#revision').value+'.json');const oldIds=new Set(old.claims.map(c=>c.id)),newIds=new Set(data.claims.map(c=>c.id));$('#revision-note').textContent='+'+data.claims.filter(c=>!oldIds.has(c.id)).length+' / −'+old.claims.filter(c=>!newIds.has(c.id)).length+' · '+data.teams.filter(t=>JSON.stringify(t)!==JSON.stringify(old.teams.find(o=>o.id===t.id))).length+' '+say('izmenjenih timskih zapisa','changed team records');render();url()}catch{data=old;$('#revision').value=old.datasetRevision;$('#revision-note').textContent=say('Revizija nije učitana; prethodno stanje je sačuvano.','Revision unavailable; previous state retained.')}};restore();window.__atlas={state,get data(){return data},stats:()=>renderer?.stats(),inspect:()=>renderer?.inspect(),setCulling:v=>renderer?.setCulling(v),select,pickBigz:id=>bigzPick(id),get bigz(){return bigz},enterArchive,leaveArchive};new ResizeObserver(height).observe(document.body)}).catch(()=>{$('#totals').textContent=say('Arhiv nije učitan. Otvori registar timova.','Archive unavailable. Open the team register.');$('#scene-status').textContent=$('#totals').textContent});
})();
