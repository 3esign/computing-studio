/* Student passports: read the curated claims, keep the submission verbatim. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  let data=null, selected='', query='', loadFailed=false;
  let lang=()=>document.documentElement.lang.startsWith('sr')?'sr':'en';
  const say=(en,sr)=>lang()==='sr'?sr:en;
  const tr=v=>typeof v==='string'?v:(v?.[lang()]??v?.en??'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PODNESCI={'t-k-district':'k-district-pilot','t-hram-svetog-save':'hram-svetog-save','t-palata-beograd':'palata-beograd','t-zgrada-tehnickih-fakulteta':'zgrada-tehnickih-fakulteta','t-zgrada-ims':'zgrada-ims','t-generalstab':'generalstab','t-sc-25-maj-dunavski-cvet':'sc-25-maj-dunavski-cvet','t-palata-srbije':'palata-srbije'};
  const claims=p=>p.sections.flatMap(s=>s.claims);
  const match=(p,q)=>!q||tr(p.object.name).toLowerCase().includes(q)||claims(p).some(c=>String(c.t).toLowerCase().includes(q)||String(c.v).toLowerCase().includes(q));
  const safeHref=url=>{try{const u=new URL(url,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'#';}catch{return '#';}};
  function announce(text){$('#record-announcement').textContent=text;}
  async function load(){
    loadFailed=false;
    try {
      const response=await fetch('data/student-pasosi.json',{cache:'no-cache'});
      if(!response.ok)throw new Error(response.status);
      data=await response.json();
      $('#passport-content').hidden=false;$('#record-load').hidden=true;
      render();
    } catch {
      loadFailed=true;
      $('#load-message').textContent=say('The record could not be loaded. Try again or open the source JSON.','Zapis nije mogao da se učita. Pokušaj ponovo ili otvori izvorni JSON.');
      $('#retry-record').hidden=false;
    }
  }
  function meta(){
    const total=data.passports.reduce((a,p)=>a+claims(p).length,0), sources=data.passports.reduce((a,p)=>a+p.sources.length,0);
    $('#record-counts').textContent=say(data.passports.length+' objects · '+total+' claims · '+sources+' cited sources',data.passports.length+' objekata · '+total+' tvrdnji · '+sources+' navedenih izvora');
    $('#curation-note').textContent=tr(data.note);
    $('#inbox-list').replaceChildren(...data.inbox.map(i=>{const li=document.createElement('li');li.append(esc(i.label)+' — '+esc(i.state)+' ('+esc(i.source)+')');return li;}));
  }
  function row(p){
    const li=document.createElement('li');li.className='claim-row';
    const b=document.createElement('button');b.type='button';b.setAttribute('aria-expanded','false');
    b.innerHTML='<strong>'+esc(tr(p.object.name))+'</strong><span>'+esc(p.object.address||'')+'</span><span>'+esc((p.team?'T'+p.team+' · ':'')+p.credit)+' · '+esc(p.received)+'</span><span>'+claims(p).length+' '+esc(say('claims','tvrdnji'))+' · '+p.sources.length+' '+esc(say('sources','izvora'))+'</span>';
    b.addEventListener('click',()=>{selected=p.id;writeAddress();render();$('#passport-detail').focus?.();});
    li.append(b);return li;
  }
  function detail(p){
    const d=$('#passport-detail');d.hidden=false;
    const q=query.trim().toLowerCase();
    const back=document.createElement('button');back.type='button';back.className='mobile-record-back';back.textContent=say('← All objects','← Svi objekti');
    back.addEventListener('click',()=>{selected='';writeAddress();render();});
    const heading=document.createElement('div');
    heading.innerHTML='<p class="eyebrow">'+esc(p.id)+'</p><h2 id="detail-title" tabindex="-1">'+esc(tr(p.object.name))+'</h2><p class="record-meta">'+esc(p.object.address||'')+'</p><p class="record-meta">'+esc((p.team?'T'+p.team+' · ':'')+p.credit)+' · '+esc(say('received','primljeno'))+' '+esc(p.received)+'</p>';
    const parts=[back,heading];
    for(const section of p.sections){
      const rows=section.claims.filter(c=>!q||String(c.t).toLowerCase().includes(q)||String(c.v).toLowerCase().includes(q));
      if(!rows.length)continue;
      const h3=document.createElement('h3');h3.textContent=tr(section.title);
      const table=document.createElement('dl');table.className='claim-detail';
      for(const c of rows){
        const dt=document.createElement('dt');dt.textContent=c.t;
        const dd=document.createElement('dd');
        dd.append(String(c.v));
        const src=document.createElement('span');src.className='source-list';
        src.append(' '+say('Sources:','Izvori:')+' ');
        (c.s||[]).forEach((id,i)=>{
          if(i)src.append(', ');
          const source=p.sources.find(s=>s.id===id),url=source&&safeHref(source.url);
          if(url&&url!=='#'){const a=document.createElement('a');a.href=url;a.title=source.label;a.textContent=id;src.append(a);}
          else if(source){const s=document.createElement('span');s.title=source.label;s.textContent=id+' '+say('(no link)','(bez veze)');src.append(s);}
          else src.append(id+' '+say('(unknown)','(nepoznat)'));
        });
        dd.append(src);table.append(dt,dd);
      }
      parts.push(h3,table);
    }
    const h3s=document.createElement('h3');h3s.textContent=say('Cited sources','Navedeni izvori');
    const list=document.createElement('ul');list.className='source-list';
    for(const s of p.sources){const li=document.createElement('li');const url=safeHref(s.url);
      if(url&&url!=='#'){const a=document.createElement('a');a.href=url;a.textContent=s.id+' · '+s.label;li.append(a);}else li.append(s.id+' · '+s.label+' '+say('(no link)','(bez veze)'));
      list.append(li);}
    parts.push(h3s,list);
    const podnesak=PODNESCI[p.id];
    if(podnesak){const p1=document.createElement('p');const a=document.createElement('a');a.href='data/pasos/podnesaci/2026-10-18/'+podnesak+'.txt';a.textContent=say('Read the verbatim submission ↗','Pročitaj doslovni podnesak ↗');p1.append(a);parts.push(p1);}
    const orig=document.createElement('details');
    orig.innerHTML='<summary>'+esc(say('Original submission (verbatim)','Izvorni podnesak (doslovno)'))+'</summary><pre>'+esc(p.originalText)+'</pre>';
    parts.push(orig);
    d.replaceChildren(...parts);
  }
  function writeAddress(){
    const params=new URLSearchParams();
    if(selected)params.set('id',selected);
    if(query)params.set('q',query);
    history.replaceState(null,'',location.pathname+(params.toString()?'?'+params:''));
  }
  function render(){
    meta();
    const params=new URLSearchParams(location.search);
    if(!selected && params.get('id') && data.passports.some(p=>p.id===params.get('id')))selected=params.get('id');
    const q=query.trim().toLowerCase();
    const shown=data.passports.filter(p=>match(p,q));
    $('#result-count').textContent=selected?'':say(shown.length+' of '+data.passports.length+' objects',shown.length+' od '+data.passports.length+' objekata');
    $('#passport-list').replaceChildren(...shown.map(row));
    if(selected){
      const p=data.passports.find(x=>x.id===selected);
      $('#passport-list').hidden=true;
      if(p)detail(p);else{selected='';$('#passport-detail').hidden=true;$('#passport-list').hidden=false;}
    } else $('#passport-detail').hidden=true;
    $('#filter-query').placeholder=say('Name, address, claim or value','Naziv, adresa, tvrdnja ili vrednost');
    document.title=selected?tr(data.passports.find(x=>x.id===selected)?.object.name)+' · Computing Studio':say('Student passports','Studentski pasoši')+' · Computing Studio';
  }
  $('#filter-query').addEventListener('input',e=>{query=e.target.value;writeAddress();render();});
  $('#reset-filters').addEventListener('click',()=>{query='';selected='';$('#filter-query').value='';writeAddress();render();$('#filter-query').focus();});
  $('#retry-record').addEventListener('click',load);
  $('#language').addEventListener('click',()=>setTimeout(render,0));
  load();
})();
