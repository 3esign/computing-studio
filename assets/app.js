/* Computing Studio: local state, visible mechanisms, no student submissions. */
(() => {
 'use strict';
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const KEY='or-studio-v1:';
 function load(key,fallback){try{return JSON.parse(localStorage.getItem(KEY+key))??fallback;}catch{return fallback;}}
 function store(key,value){try{localStorage.setItem(KEY+key,JSON.stringify(value));return true;}catch{return false;}}
 let lang=load('lang','en')==='sr'?'sr':'en', currentRender=()=>{};
 const tr=v=>typeof v==='string'?v:(v?.[lang]??v?.en??'');
 const say=(en,sr)=>lang==='sr'?sr:en;
 const announce=text=>{const e=$('#announcements');if(e)e.textContent=text;};
 const safeHref=url=>{try{const u=new URL(url,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'#';}catch{return '#';}};
 const data={};
 async function get(name){
   if(data[name])return data[name];
   const response=await fetch('data/'+name+'.json',{cache:'no-cache'});
   if(!response.ok)throw new Error('Unable to load '+name+' ('+response.status+')');
   data[name]=await response.json();return data[name];
 }
 function language(){
   document.documentElement.lang=lang==='sr'?'sr-Latn':'en';
   $$('[data-en][data-sr]').forEach(el=>{
     const value=el.getAttribute('data-'+lang);
     // Authored template strings allow line breaks, never data-supplied HTML.
     el.replaceChildren(...value.split('<br>').flatMap((s,i)=>i?[document.createElement('br'),document.createTextNode(s)]:[document.createTextNode(s)]));
   });
   $('#language').textContent=lang==='en'?'SR':'EN';
   $('#language').setAttribute('aria-label',lang==='en'?'Prebaci na srpski':'Switch to English');
   document.body.classList.add('ready');
 }
 $('#language')?.addEventListener('click',()=>{lang=lang==='en'?'sr':'en';store('lang',lang);language();currentRender();});
 function download(name,value,type='application/json'){
   const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)+'\n'],{type});
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function copy(text){
   try{await navigator.clipboard.writeText(text);announce(say('Link copied.','Veza je kopirana.'));return true;}
   catch{announce(say('Copy this link: ','Kopiraj ovu vezu: ')+text);return false;}
 }
 function icon(tag,id=''){
   const path=tag==='history'?'M40 116 150 32 260 116 150 178Z M68 116 150 57 232 116 M96 116 150 82 204 116':
   tag==='geometry'?'M42 145 82 55 128 131 179 34 245 145 M42 145 245 145 M82 55 179 34 M128 131 245 145':
   tag==='civil'?'M30 144 80 58 130 144 180 58 230 144 M30 144 230 144 M80 58 180 58 M80 58 130 144 180 58':
   tag==='process'?'M36 105H90 M90 105 140 50H223 M90 105 140 160H223 M140 50V160':
   tag==='making'?'M40 130V60H235V145H40V86H211V123H66V104H185':
   'M40 60H130V102H215 M40 103H85V145H170 M130 60V145 M215 102V145';
   return `<svg viewBox="0 0 290 200" aria-hidden="true"><path d="M20 180H270M20 180V20" stroke="#c2c4c9" fill="none"/><path d="${path}" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="130" cy="102" r="5" fill="currentColor"/><text x="22" y="195" font-family="monospace" font-size="9" fill="#626772">${esc(id||tag.toUpperCase())} / RULE → TRACE</text></svg>`;
 }
 function labCard(l){return `<a class="lab-card" href="${esc(l.href)}"><span class="card-num">${esc(l.n)} / ${esc(l.tag.toUpperCase())}</span><div class="lab-graphic">${icon(l.tag,l.id)}</div><h2>${esc(tr(l.title))}</h2><p>${esc(tr(l.description))}</p>${l.limit?`<span class="model-limit">${esc(tr(l.limit))}</span>`:''}<span class="card-bottom">${esc(l.language)} <b>↗</b></span></a>`;}
 function hero(){
   const stage=$('#representation-stage');if(!stage)return;
   let view='drawing',layout=0,selected='P2';
   function panelArea(panels) {
     let area_m2 = 0;
     for (const panel of panels) {
       area_m2 += panel.width_m * panel.height_m;
     }
     return area_m2;
   }
   function draw(){
     const glass=layout===0?[0,1]:[0,5];
     const panels=Array.from({length:6},(_,i)=>({id:'P'+(i+1),row:Math.floor(i/3)+1,column:i%3+1,type:glass.includes(i)?'glass':'solid',width_m:.6,height_m:.6}));
     const num=n=>n.toLocaleString(lang==='sr'?'sr-Latn':'en',{maximumFractionDigits:2,minimumFractionDigits:2});
     const material=t=>t==='glass'?say('Glass','Staklo'):say('Solid','Puno');
     $('#specimen-layout').textContent=say('LAYOUT ','RASPORED ')+(layout?'B':'A');
     $$('[data-view-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.viewMode===view)));
     if(view==='drawing') {
       stage.innerHTML=`<div class="facade-dimension"><span>←</span><span>3 × 600 mm = 1 800 mm</span><span>→</span></div><div class="facade-grid">${panels.map(p=>`<button class="facade-panel ${p.type}" data-panel="${p.id}" aria-pressed="${selected===p.id}" aria-label="${p.id}, ${material(p.type)}, ${say('row','red')} ${p.row}, ${say('column','kolona')} ${p.column}"><span>${p.id}</span><strong>${p.type==='glass'?'S':'P'}</strong><small>${material(p.type)}</small></button>`).join('')}</div><p class="diagram-caption">${say('600 × 600 mm per panel · no gaps or frame. Select a panel, then read its data.','600 × 600 mm po panelu · bez razmaka i okvira. Izaberi panel, pa pročitaj podatke.')}</p>`;
       $$('[data-panel]').forEach(b=>b.onclick=()=>{selected=b.dataset.panel;draw();$$('[data-panel]').find(x=>x.dataset.panel===selected)?.focus();});
     } else if(view==='data') {
       stage.innerHTML=`<div class="specimen-table-wrap"><table class="specimen-table"><caption>${say('The same six panels. Dimensions in metres:','Istih šest panela. Mere u metrima:')}<br><code>width_m = 0.60 · height_m = 0.60</code></caption><thead><tr><th>ID</th><th>${say('Row','Red')}</th><th>${say('Column','Kolona')}</th><th>${say('Type','Tip')}</th></tr></thead><tbody>${panels.map(p=>`<tr class="${p.id===selected?'selected':''}"><th><button type="button" data-record="${p.id}" aria-pressed="${p.id===selected}">${p.id}</button></th><td>${p.row}</td><td>${p.column}</td><td>${material(p.type)}</td></tr>`).join('')}</tbody></table></div>`;
       $$('[data-record]').forEach(b=>b.onclick=()=>{selected=b.dataset.record;draw();$$('[data-record]').find(x=>x.dataset.record===selected)?.focus();});
     } else {
       stage.innerHTML=`<p class="diagram-caption">${say('This JavaScript function calculates the area shown below from the six panel records.','Ova JavaScript funkcija računa prikazanu površinu iz šest zapisa panela.')}</p><pre class="specimen-code" tabindex="0" aria-label="JavaScript">${esc(panelArea.toString())}</pre><p class="diagram-caption">${say('The sum uses dimensions. It does not retain positions.','Zbir koristi dimenzije. Ne čuva položaje.')}</p>`;
     }
     $('#specimen-area').innerHTML=num(panelArea(panels))+' <small>m²</small>';
     $('#specimen-summary').textContent=say('2 glass + 4 solid panels','2 staklena + 4 puna panela');
     $('#specimen-insight').textContent=layout===0?say('Do the quantities tell you where each panel goes?','Govore li količine gde koji panel stoji?'):say('Same quantities. New arrangement. What did the sum leave out?','Iste količine. Novi raspored. Šta je zbir izostavio?');
   }
   $$('[data-view-mode]').forEach(b=>b.onclick=()=>{view=b.dataset.viewMode;draw();});
   $('#change-layout').onclick=()=>{layout=1-layout;draw();};
   draw();return draw;
 }
 function sessions(rows){
   const visible=rows.filter(x=>x.status==='published'||x.status==='held');
   if(!visible.length)return `<div class="quiet-note"><h2>${say('The record is ready for the first entry.','Tok je spreman za prvi zapis.')}</h2><p>${say('No dated classes or assessed tasks have been entered here yet. Semir chooses and publishes them. Explore the ready instruments and open ideas in the meantime.','Ovde još nisu upisani datirani časovi ni zadaci za ocenjivanje. Semir ih bira i objavljuje. Do tada istražuj dostupne instrumente i otvorene ideje.')}</p><a href="cas.html#Q1">${say('Try a class question','Probaj pitanje za čas')} →</a></div>`;
   return visible.map(s=>`<article class="session"><div><time>${esc(s.date||'—')}</time><br><span class="status-badge">${s.status==='held'?say('RECORDED AS HELD','ZAPISANO KAO ODRŽANO'):say('PUBLISHED','OBJAVLJENO')}</span></div><div><h2>${esc(tr(s.title))}</h2><p>${esc(tr(s.summary))}</p>${s.task?`<h3>${say('Task','Zadatak')}</h3><p>${esc(tr(s.task))}</p>`:''}${s.link?`<a href="${esc(safeHref(s.link))}" rel="noreferrer">${say('Open the material','Otvori gradivo')} →</a>`:''}</div></article>`).join('');
 }
 async function home(){
   const [course,labs]=await Promise.all([get('course'),get('labs')]);
   const draw=hero();
   $('#question-code').addEventListener('input',()=>$('#question-code').removeAttribute('aria-invalid'));
   currentRender=()=>{
     const featured=['lab/dizajn/index.html','lab/kod/index.html','lab/resetka/index.html'].map(href=>labs.find(l=>l.href===href)).filter(Boolean);
     $('#featured-labs').innerHTML=featured.map(labCard).join('');$('#home-record').innerHTML=sessions(course.sessions);
     if(Array.isArray(course.learningPath))$('#home-path').innerHTML=course.learningPath.map((p,i)=>`<a class="learning-step" href="${esc(p.href)}"><span>0${i+1}</span><h3>${esc(tr(p.title))}</h3><p>${esc(tr(p.question))}</p><span class="step-action">${esc(tr(p.action))}</span><b aria-hidden="true">↗</b></a>`).join('');
     draw?.();
   };
   currentRender();
   $('#quick-open').addEventListener('submit',e=>{
     e.preventDefault();const id=$('#question-code').value.trim().toUpperCase();
     if(course.classQuestions.some(q=>q.id===id))location.href='cas.html#'+id;
     else{$('#code-status').textContent=say('Choose a question: ','Izaberi pitanje: ')+course.classQuestions.map(q=>q.id).join(', ');$('#question-code').setAttribute('aria-invalid','true');}
   });
 }
 async function catalog(kind){
   const bank=await get(kind),items=bank[kind];
   const params=new URLSearchParams(location.search);
   $('#search').value=params.get('q')||'';
   if([...$('#tag-filter').options].some(o=>o.value===params.get('tag')))$('#tag-filter').value=params.get('tag');
   let saved=load('saved',[]);if(!Array.isArray(saved))saved=[];
   const notes=load('notes',{}),safeNotes=notes&&typeof notes==='object'&&!Array.isArray(notes)?notes:{};
   let onlySaved=false;
   if(kind==='ideas'){
     const bar=document.createElement('div');bar.className='collection-actions';
     bar.innerHTML=`<button type="button" class="button" id="saved-filter" aria-pressed="false">${say('Only my saved ideas','Samo moje sačuvane ideje')}</button><button type="button" class="button" id="export-notes">${say('Export my notes','Izvezi moje beleške')}</button>`;
     $('.filter-bar').after(bar);
     $('#saved-filter').onclick=()=>{onlySaved=!onlySaved;$('#saved-filter').setAttribute('aria-pressed',String(onlySaved));render();};
     $('#export-notes').onclick=()=>download('or-my-ideas.json',{exported:new Date().toISOString(),saved,notes:safeNotes});
   }
   const folded=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
   function render(){
     const query=folded($('#search').value.trim()),tag=$('#tag-filter').value;
     const selected=items.filter(x=>(tag==='all'||x.tag===tag)&&(!onlySaved||saved.includes(x.id))&&folded([tr(x.title),tr(x.description),tr(x.summary),x.tag,x.id].join(' ')).includes(query));
     $('#result-count').textContent=selected.length+' / '+items.length+' '+say('entries','zapisa');
     if(kind==='ideas'){
       $('#saved-filter').textContent=say('Only my saved ideas','Samo moje sačuvane ideje');$('#export-notes').textContent=say('Export my notes','Izvezi moje beleške');
       $('#collection').innerHTML=selected.map(x=>`<article class="idea-card" id="${esc(x.id)}"><div class="idea-meta"><span>${esc(x.tag)} / ${say('OPEN IDEA','OTVORENA IDEJA')}</span><button type="button" class="save-idea" data-save="${esc(x.id)}" aria-pressed="${saved.includes(x.id)}" aria-label="${esc(say('Save idea: ','Sačuvaj ideju: ')+tr(x.title))}">${saved.includes(x.id)?say('Saved','Sačuvano'):say('Save +','Sačuvaj +')}</button></div><h2>${esc(tr(x.title))}</h2><p>${esc(tr(x.description))}</p><details><summary>${say('Follow this thread','Prati ovu nit')} ↗</summary><h3>${say('Try thinking about…','Razmisli o…')}</h3><p>${esc(tr(x.try))}</p><p class="micro">${esc(tr(x.boundary))}</p>${x.source?`<a class="source-link" href="${esc(safeHref(x.source.url))}" target="_blank" rel="noreferrer">${esc(x.source.title)} ↗</a>`:''}<label for="note-${esc(x.id)}">${say('My note · this browser only','Moja beleška · samo ovaj pregledač')}</label><textarea id="note-${esc(x.id)}" data-note="${esc(x.id)}" maxlength="5000">${esc(safeNotes[x.id]||'')}</textarea><span class="micro" data-note-status="${esc(x.id)}"></span></details></article>`).join('');
       $$('[data-save]').forEach(b=>b.onclick=()=>{
         const id=b.dataset.save,candidate=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];
         if(store('saved',candidate)){saved=candidate;render();const next=$$('[data-save]').find(x=>x.dataset.save===id);next?.focus();}
         else announce(say('Storage unavailable; this selection was not saved.','Skladište nije dostupno; izbor nije sačuvan.'));
       });
       $$('[data-note]').forEach(el=>el.addEventListener('input',()=>{
         safeNotes[el.dataset.note]=el.value;
         const ok=store('notes',safeNotes);
         el.nextElementSibling.textContent=ok?say('Saved on this device','Sačuvano na uređaju'):say('Not saved. Export your notes.','Nije sačuvano. Izvezi beleške.');
       }));
     }else{
       $('#collection').innerHTML=selected.map(x=>`<article class="source-card" id="${esc(x.id)}"><span class="tag-line">${esc(x.id)} / ${esc(x.tag)}</span><h2><a href="${esc(safeHref(x.url))}" target="_blank" rel="noreferrer">${esc(tr(x.title))} ↗</a></h2><p>${esc(tr(x.summary))}</p><p class="scope">${esc(tr(x.date)||'')} · ${say('Checked','Provereno')} ${esc(x.checked)}</p><details><summary>${say('What was read · limits','Šta je pročitano · granice')}</summary><p>${esc(tr(x.scope))}</p><p>${esc(tr(x.limit))}</p></details></article>`).join('');
     }
     if(!selected.length)$('#collection').innerHTML=`<div class="empty-state"><h2>${say('No matching entries.','Nema odgovarajućih zapisa.')}</h2><p>${say('Try a shorter phrase or clear the filters.','Probaj kraći izraz ili poništi filtere.')}</p></div>`;
   }
   function update(){const p=new URLSearchParams();if($('#search').value)p.set('q',$('#search').value);if($('#tag-filter').value!=='all')p.set('tag',$('#tag-filter').value);history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash);render();}
   $('#search').addEventListener('input',update);$('#tag-filter').addEventListener('change',update);
   $('#clear-filters').onclick=()=>{$('#search').value='';$('#tag-filter').value='all';onlySaved=false;$('#saved-filter')?.setAttribute('aria-pressed','false');update();};
   currentRender=render;render();
   const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(target){target.querySelector('details')?.setAttribute('open','');target.scrollIntoView({block:'start'});}
 }
 async function classroom(){
   const course=await get('course'),questions=[...course.classQuestions].sort((a,b)=>{const rank=q=>Number(q.id.slice(1))>=7?Number(q.id.slice(1))-7:Number(q.id.slice(1))+6;return rank(a)-rank(b);});
   let id=questions.some(q=>q.id===location.hash.slice(1))?location.hash.slice(1):questions[0].id;
   let revealed=false,chosen=null,remaining=90,timer=null,deadline=0;
   const saved=load('answers',{}),answers=saved&&typeof saved==='object'?saved:{};
   function render(){
     const q=questions.find(x=>x.id===id);
     $('#question-select').innerHTML=questions.map(x=>`<option value="${esc(x.id)}" ${id===x.id?'selected':''}>${esc(x.id+' · '+tr(x.title))}</option>`).join('');
     const join=$('#question-qr');if(join){const image=join.querySelector('img');image.src='assets/qr/'+(/^Q(?:[1-9]|1[0-2])$/.test(id)?id:'start')+'.svg';image.alt=say('QR link for question ','QR veza za pitanje ')+id;const anchor=join.querySelector('a');anchor.href='https://3esign.github.io/computing-studio/cas.html#'+id;anchor.textContent='3esign.github.io/computing-studio/ · '+id;}
     const answer=answers[id];chosen=Number.isInteger(answer?.choice)?answer.choice:null;
     $('#question-stage').innerHTML=`<span class="qid">${esc(q.id)} / ${say('PREDICT → DISCUSS → CHECK','PREDVIDI → RAZGOVARAJ → PROVERI')}</span><h2 id="question-title">${esc(tr(q.title))}</h2><p class="question-prompt">${esc(tr(q.prompt))}</p><div class="choices" role="group" aria-label="${say('Your answer','Tvoj odgovor')}">${q.choices.map((c,i)=>`<button type="button" class="choice" data-choice="${i}" aria-pressed="${chosen===i}"><span>${String.fromCharCode(65+i)}</span>${esc(tr(c))}</button>`).join('')}</div><p class="response-status">${chosen===null?say('Choose privately. No answer is sent.','Izaberi samostalno. Odgovor se ne šalje.'):say('Your choice: ','Tvoj izbor: ')+String.fromCharCode(65+chosen)+say(' · stored on this device',' · sačuvano na uređaju')}</p><label class="reason-label" for="question-reason">${say('Explain your prediction · or write it on paper','Objasni predviđanje · ili zapiši na papiru')}</label><textarea id="question-reason" maxlength="3000" rows="3" placeholder="${say('I think this because…','Mislim tako zato što…')}">${esc(answers[id]?.reason||'')}</textarea><p id="reason-status" class="micro" role="status">${say('Your note stays in this browser.','Beleška ostaje u ovom pregledaču.')}</p><div class="actions"><button type="button" class="button primary" id="reveal">${revealed?say('Hide explanation','Sakrij objašnjenje'):say('Reveal explanation','Otkrij objašnjenje')}</button><a class="button" href="${esc(q.lab)}">${q.lab.startsWith('ideje.html')?say('Explore this idea','Istraži ideju'):say('Try the instrument','Probaj instrument')} ↗</a><button type="button" class="button" id="next-question">${say('Next question','Sledeće pitanje')} →</button></div><div class="feedback" ${revealed?'':'hidden'}><h3>${say('Reasoning','Objašnjenje')} · ${String.fromCharCode(65+q.answer)}</h3><p>${esc(tr(q.explanation))}</p><h3>${say('Change the question','Promeni pitanje')}</h3><p>${esc(tr(q.transfer))}</p></div><p id="share-result" class="micro"></p>`;
     $$('[data-choice]').forEach(b=>b.onclick=()=>{
       chosen=Number(b.dataset.choice);answers[id]={...answers[id],firstChoice:Number.isInteger(answers[id]?.firstChoice)?answers[id].firstChoice:chosen,choice:chosen,at:new Date().toISOString()};
       const ok=store('answers',answers);render();
       if(!ok)$('#question-stage .response-status').textContent=say('Your choice is shown but cannot be saved in this browser.','Izbor je prikazan, ali ne može biti sačuvan u ovom pregledaču.');
       $$('[data-choice]')[chosen]?.focus();
     });
     $('#question-reason').oninput=e=>{answers[id]={...answers[id],reason:e.target.value,at:new Date().toISOString()};const ok=store('answers',answers);$('#reason-status').textContent=ok?say('Saved in this browser.','Sačuvano u ovom pregledaču.'):say('Could not save here. Download your reasoning to keep it.','Ovde nije moguće čuvanje. Preuzmi zapis da ga sačuvaš.');};
     $('#reveal').onclick=()=>{revealed=!revealed;render();$('#reveal').focus();};
     $('#next-question').onclick=()=>location.hash=questions[(questions.findIndex(x=>x.id===id)+1)%questions.length].id;
     $('#presenter').textContent=document.body.classList.contains('presenting')?say('Leave focus view','Vrati ceo prikaz'):say('Focus view','Izdvojen prikaz');
     clockText();
   }
   const clockText=()=>{$('#clock').textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');$('#timer-toggle').textContent=timer?say('Pause','Pauza'):say('Start','Pokreni');};
   function pause(){if(timer){clearInterval(timer);timer=null;}clockText();}
   $('#timer-toggle').onclick=()=>{if(timer)return pause();if(!remaining)remaining=90;deadline=Date.now()+remaining*1000;timer=setInterval(()=>{remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));clockText();if(!remaining){pause();announce(say('Discussion time is over.','Vreme za razgovor je isteklo.'));}},250);clockText();};
   $('#timer-reset').onclick=()=>{pause();remaining=90;clockText();};
   $('#question-select').onchange=e=>location.hash=e.target.value;
   addEventListener('hashchange',()=>{if(questions.some(x=>x.id===location.hash.slice(1))){id=location.hash.slice(1);revealed=false;pause();remaining=90;render();}});
   $('#presenter').onclick=()=>{document.body.classList.toggle('presenting');render();};
   $('#share-question').onclick=async()=>{const u=new URL('cas.html',location.href);u.hash=id;const ok=await copy(u.href);$('#share-result').textContent=ok?say('Link copied: ','Veza kopirana: ')+u.href:u.href;};
   $('#print-question').onclick=()=>window.print();
   $('#export-answers').onclick=()=>download('computing-studio-reasoning.json',{schema:1,kind:'local-question-notes',exported:new Date().toISOString(),answers});
   addEventListener('pagehide',pause);
   currentRender=render;render();
 }
 function validateCourse(c){
   if(!c||c.schema!==1||!Array.isArray(c.sessions)||!Array.isArray(c.classQuestions)||!Array.isArray(c.foundations))throw new Error('Expected schema:1, sessions, classQuestions and foundations.');
   if(c.sessions.length>200)throw new Error('Limit: 200 class records.');
   const ids=new Set();
   for(const s of c.sessions){
     if(!/^[a-zA-Z0-9-]{1,40}$/.test(s.id)||ids.has(s.id))throw new Error('Each topic needs a unique id.');
     ids.add(s.id);
     if(!['draft','published','held'].includes(s.status))throw new Error('Status must be draft, published or held.');
     if(typeof s.title?.en!=='string'||typeof s.title?.sr!=='string')throw new Error('Each title needs en and sr text.');
     if(s.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!Number.isFinite(Date.parse(s.date))||new Date(s.date).toISOString().slice(0,10)!==s.date))throw new Error('Date must be YYYY-MM-DD or empty.');
     if(s.status==='held'&&!s.date)throw new Error('A held class needs its actual date.');
     if(s.link&&safeHref(s.link)==='#')throw new Error('Use a local, http or https material link.');
   }
   for(const q of c.classQuestions){
     if(!/^Q[0-9]+$/.test(q.id)||!Array.isArray(q.choices)||q.choices.length<2||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.choices.length)throw new Error('Invalid question data.');
   }
   return c;
 }
 async function teacher(){
   const course=await get('course');let draft=structuredClone(course);$('#course-editor').value=JSON.stringify(draft,null,2);
   const fields=document.createElement('div');fields.id='session-fields';fields.className='session-fields';$('.editor>label').before(fields);
   const advanced=document.createElement('details'),summary=document.createElement('summary');
   summary.textContent=say('Advanced: edit the JSON record','Napredno: uređivanje JSON zapisa');advanced.append(summary);
   const label=$('.editor>label'),textarea=$('#course-editor');label.before(advanced);advanced.append(label,textarea);
   function renderFields(){
     fields.innerHTML=draft.sessions.length?draft.sessions.map((s,i)=>`<fieldset class="record-form"><legend>${say('Topic','Tema')} ${i+1} · ${esc(s.id)}</legend><div class="record-pair"><label>${say('Title · English','Naslov · engleski')}<input data-index="${i}" data-field="title.en" value="${esc(s.title.en)}" maxlength="200"></label><label>${say('Title · Serbian','Naslov · srpski')}<input data-index="${i}" data-field="title.sr" value="${esc(s.title.sr)}" maxlength="200"></label><label>${say('Date','Datum')}<input type="date" data-index="${i}" data-field="date" value="${esc(s.date)}"></label><label>${say('Publication status','Status objave')}<select data-index="${i}" data-field="status">${['draft','published','held'].map(v=>`<option value="${v}" ${s.status===v?'selected':''}>${v==='draft'?say('Draft · not shown to students','Nacrt · nije prikazan studentima'):v==='published'?say('Published preparation','Objavljena priprema'):say('Recorded as held','Zapisano kao održano')}</option>`).join('')}</select></label><label>${say('Material · English','Gradivo · engleski')}<textarea data-index="${i}" data-field="summary.en" rows="3">${esc(s.summary?.en||'')}</textarea></label><label>${say('Material · Serbian','Gradivo · srpski')}<textarea data-index="${i}" data-field="summary.sr" rows="3">${esc(s.summary?.sr||'')}</textarea></label><label>${say('Task · English','Zadatak · engleski')}<textarea data-index="${i}" data-field="task.en" rows="3">${esc(s.task?.en||'')}</textarea></label><label>${say('Task · Serbian','Zadatak · srpski')}<textarea data-index="${i}" data-field="task.sr" rows="3">${esc(s.task?.sr||'')}</textarea></label></div><label>${say('Material link · optional','Veza gradiva · opciono')}<input data-index="${i}" data-field="link" value="${esc(s.link||'')}" placeholder="lab/kod/index.html"></label></fieldset>`).join(''):`<p class="quiet-note">${say('Start with “Add a draft topic”. The empty record is intentional: no class date or assessment has been invented.','Kreni od „Dodaj nacrt teme”. Prazan tok je nameran: datum časa ili način ocenjivanja nisu izmišljeni.')}</p>`;
     $$('[data-field]').forEach(el=>el.addEventListener('input',()=>{
       const keys=el.dataset.field.split('.'),s=draft.sessions[Number(el.dataset.index)];
       if(keys.length===2){s[keys[0]]??={en:'',sr:''};s[keys[0]][keys[1]]=el.value;}else s[keys[0]]=el.value;
       $('#course-editor').value=JSON.stringify(draft,null,2);preview();
     }));
   }
   function preview(){try{const raw=$('#course-editor').value;if(raw.length>2000000)throw new Error('Content is too large.');draft=validateCourse(JSON.parse(raw));$('#editor-preview').innerHTML=sessions(draft.sessions);$('#editor-status').textContent=say('Valid local copy. Downloading does not publish it.','Ispravna lokalna kopija. Preuzimanje je ne objavljuje.');$('#editor-status').classList.remove('error');return true;}catch(e){$('#editor-status').textContent=say('Not ready: ','Nije spremno: ')+e.message;$('#editor-status').classList.add('error');return false;}}
   $('#load-course').onclick=()=>{$('#course-editor').value=JSON.stringify(course,null,2);preview();renderFields();};
   $('#add-session').onclick=()=>{if(!preview())return;draft.sessions.push({id:'topic-'+Date.now().toString(36),status:'draft',date:'',title:{en:'New topic',sr:'Nova tema'},summary:{en:'',sr:''},task:{en:'',sr:''},link:''});$('#course-editor').value=JSON.stringify(draft,null,2);preview();renderFields();};
   $('#download-course').onclick=()=>{if(preview()){draft.updated=new Date().toISOString().slice(0,10);$('#course-editor').value=JSON.stringify(draft,null,2);download('course.json',draft);}};
   $('#course-editor').addEventListener('input',()=>{if(preview())renderFields();});currentRender=()=>{preview();renderFields();};preview();renderFields();
 }
 async function access(){
   $('#offline-save').onclick=async()=>{
     const status=$('#offline-status'),button=$('#offline-save');button.disabled=true;
     if(!('serviceWorker' in navigator)||!window.isSecureContext){status.textContent=say('Offline storage needs HTTPS or localhost and service-worker support.','Čuvanje za rad bez mreže traži HTTPS ili localhost i podršku za service worker.');button.disabled=false;return;}
     status.textContent=say('Saving the site. Keep this page open…','Čuvanje sajta. Ostavi stranicu otvorenu…');
     try{
       await navigator.serviceWorker.register('sw.js',{scope:'./'});
       const registration=await navigator.serviceWorker.ready;
       const result=await new Promise((resolve,reject)=>{
         const channel=new MessageChannel(),timeout=setTimeout(()=>reject(new Error('Storage timed out. Retry while connected.')),60000);
         channel.port1.onmessage=e=>{clearTimeout(timeout);e.data.ok?resolve(e.data):reject(new Error(e.data.error||'Storage failed'));};
         registration.active.postMessage({type:'CACHE_ALL'},[channel.port2]);
       });
       status.textContent=say('Saved: ','Sačuvano: ')+result.count+say(' local files. Test reopening the site in airplane mode before class.',' lokalnih fajlova. Pre časa proveri ponovno otvaranje u avionskom režimu.');
     }catch(e){status.textContent=say('Not fully saved: ','Nije potpuno sačuvano: ')+e.message;}
     finally{button.disabled=false;}
   };
   $('#clear-local').onclick=()=>{for(const key of ['answers','notes','saved']){try{localStorage.removeItem(KEY+key);}catch{}}announce(say('Local answers and notes cleared.','Lokalni odgovori i beleške su obrisani.'));};
 }
 async function init(){
   language();
   const view=document.body.dataset.view;
   if(view==='home')await home();
   else if(view==='ideas'||view==='sources')await catalog(view);
   else if(view==='labs'){const labs=await get('labs');currentRender=()=>{$('#lab-list').innerHTML=labs.map(labCard).join('');};currentRender();}
   else if(view==='class')await classroom();
   else if(view==='course'){const c=await get('course');currentRender=()=>{$('#session-list').innerHTML=sessions(c.sessions);$('#foundation-list').innerHTML=c.foundations.map(f=>`<a class="foundation-row" href="ideje.html?tag=${esc(f.tag)}"><span>${esc(f.id)}</span><h3>${esc(tr(f.title))}</h3><p>${esc(tr(f.description))} →</p></a>`).join('');};currentRender();}
   else if(view==='teacher')await teacher();
   else if(view==='access')await access();
 }
 init().catch(e=>{
   const target=$('#collection')||$('#session-list')||$('#question-stage')||$('.hero-learning')||$('#main');
   const p=document.createElement('p');p.className='quiet-note error';p.textContent=say('The content could not be loaded. Reconnect and reload. The instruments remain available from the navigation. ','Sadržaj nije učitan. Poveži se i osveži stranicu. Instrumenti su dostupni kroz navigaciju. ')+e.message;target.append(p);
 });
})();
