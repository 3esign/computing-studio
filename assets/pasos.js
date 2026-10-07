/* Read the source, keep its uncertainty, follow the same claim into space. */
(() => {
  'use strict';
  const M=window.PassportModel, $=s=>document.querySelector(s);
  const home=!!$('[data-passport-home]');
  let data=null, selected='', loading=false, loadFailed=false;
  let lang=document.documentElement.lang.startsWith('sr')?'sr':'en';
  const filters={q:'',lane:'',status:'',source:'',kind:''};
  const say=(en,sr)=>lang==='sr'?sr:en;
  const tr=v=>M.tr(v,lang);
  const state=c=>tr(M.STATES[c.st]) || c.st;
  const kind=k=>tr(M.KINDS[k]) || k || say('No evidence recorded','Dokaz nije upisan');
  function el(tag,attrs={},...children) {
    const node=document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)) if(v!==undefined && v!==null) node.setAttribute(k,String(v));
    for(const child of children.flat()) if(child!==null && child!==undefined) node.append(typeof child==='string'||typeof child==='number'?document.createTextNode(String(child)):child);
    return node;
  }
  function status(c){return el('span',{class:'status-label','data-status':c.st},state(c));}
  const lane=id=>tr(M.LANES.find(l=>l.id===id)) || id;
  function announce(text){$('#record-announcement').textContent=text;}
  function draw(target,claim){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 600 300');svg.setAttribute('aria-hidden','true');
    try {
      for(const item of M.diagram(data,claim.k)){
        const p=document.createElementNS(ns,'path');
        p.setAttribute('d',item.lines.map(([a,b])=>`M${item.points[a].map(n=>n.toFixed(2)).join(' ')}L${item.points[b].map(n=>n.toFixed(2)).join(' ')}`).join(' '));
        p.setAttribute('class','bridge-stroke'+(item.active?' active':'')+(item.variant>0?' alternative':''));
        p.setAttribute('data-part',item.part);svg.append(p);
      }
      target.replaceChildren(svg);
    } catch {
      target.replaceChildren(el('p',{class:'record-message'},say('The diagram is unavailable. The evidence remains readable below.','Crtež nije dostupan. Dokazi ostaju čitljivi ispod.')));
    }
  }
  function sourceLinks(ids){
    return ids.map(id=>{
      const source=data.sources.find(s=>s.id===id),url=source && M.safeURL(source.url);
      return url?el('a',{href:url,title:source.pub+' · '+source.t},id):el('span',{},id);
    });
  }
  function preview(){
    const c=data.claims.find(c=>c.k===selected) || data.claims[0];
    if(!c)return;
    selected=c.k;
    document.title=say('Digital passport','Digitalni pasoš')+' · Computing Studio';
    $('#preview-name').textContent=tr(data.object.name);
    $('#preview-id').textContent=data.id;
    const choiceDefs=[['konstr',say('Structure','Konstrukcija')],['gabarit',say('Dimensions','Mere')],['izvor',say('Material origin','Poreklo materijala')]];
    const choices=choiceDefs.filter(([key])=>data.claims.some(c=>c.k===key));
    $('#preview-controls').replaceChildren(...choices.map(([key,label])=>{
      const b=el('button',{type:'button','data-claim':key,'aria-pressed':String(key===c.k),'aria-controls':'preview-reading'},label);
      b.addEventListener('click',()=>{selected=key;preview();$('#preview-controls').querySelector(`[data-claim="${key}"]`)?.focus({preventScroll:true});announce(tr(data.claims.find(c=>c.k===key).q));});return b;
    }));
    draw($('#preview-diagram'),c);
    const groups=M.measurements(c).filter(g=>g.disagrees);
    const summary=groups.length?groups.map(g=>tr(M.MEASURES[g.key] || g.key)+': '+g.entries.map(e=>(e.approx?'≈ ':'')+e.v+' '+e.u+' ['+(e.src||[]).join(', ')+']').join(' / ')).join(' · '):tr(c.v) || tr(c.next);
    $('#preview-reading').replaceChildren(status(c),el('h3',{},tr(c.q)),el('p',{},summary),el('a',{href:'pasos.html?claim='+encodeURIComponent(c.k)},say('Read the claim and its sources →','Pročitaj tvrdnju i izvore →')));
    $('#home-scene').href=M.sceneURL(data,c);
  }
  function option(value,label,selected){return el('option',{value,...(selected?{selected:''}:{})},label);}
  function renderFilters(){
    const definitions={
      lane:[say('All tracks','Sve trake'),[...new Set(data.claims.map(c=>c.l))].map(id=>[id,lane(id)])],
      status:[say('All statuses','Svi statusi'),[...new Set(data.claims.map(c=>c.st))].map(id=>[id,tr(M.STATES[id]) || id])],
      source:[say('All sources','Svi izvori'),data.sources.map(s=>[s.id,s.id+' · '+s.pub])],
      kind:[say('All evidence types','Sve vrste dokaza'),[...new Set(data.claims.map(c=>c.ev).filter(Boolean))].map(id=>[id,kind(id)])]
    };
    for(const [key,[label,rows]] of Object.entries(definitions)){
      const field=$('#filter-'+key);
      if(filters[key] && !rows.some(([id])=>id===filters[key]))filters[key]='';
      field.replaceChildren(option('',label,!filters[key]),...rows.map(([id,name])=>option(id,name,filters[key]===id)));
    }
    $('#filter-query').placeholder=say('Question, value or publisher','Pitanje, vrednost ili izdavač');
  }
  function writeAddress(){
    const q=new URLSearchParams();
    if(selected)q.set('claim',selected);
    for(const [key,value]of Object.entries(filters))if(value)q.set(key,value);
    try{history.replaceState(null,'',location.pathname+(q.toString()?'?'+q.toString():'')+location.hash);}catch{/* Reading still works when history is unavailable. */}
  }
  function renderList(){
    const rows=M.select(data,filters);
    if(!rows.some(c=>c.k===selected))selected=rows[0]?.k || '';
    $('#result-count').textContent=rows.length+' / '+data.claims.length+' '+say('claims','tvrdnji');
    $('#claims-list').replaceChildren(...rows.map(c=>{
      const button=el('button',{type:'button','data-claim':c.k,'aria-pressed':String(c.k===selected),'aria-controls':'claim-detail'},
        el('span',{class:'lane-label'},lane(c.l)),el('strong',{},tr(c.q)),status(c),el('span',{class:'source-count'},M.sourceIds(c).length+' '+say('sources','izv.')));
      button.addEventListener('click',()=>{
        selected=c.k;
        for(const b of $('#claims-list').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.claim===selected));
        renderDetail();writeAddress();announce(tr(c.q)+' · '+state(c));
        if(window.matchMedia('(max-width:760px)').matches)$('#detail-title').focus();
      });
      return el('li',{class:'claim-row'},button);
    }));
    $('#no-results').hidden=rows.length>0;
    $('#claim-detail').hidden=rows.length===0;
    renderDetail();writeAddress();
  }
  function measureGroup(group){
    const title=el('h3',{},tr(M.MEASURES[group.key] || group.key));
    if(group.disagrees)title.append(el('span',{},say('Values disagree','Vrednosti se ne slažu')));
    const rows=group.entries.map(m=>el('div',{class:'measure-entry'},
      el('dt',{},(m.approx?'≈ ':'')+m.v+(m.u?' '+m.u:'')),
      el('dd',{},tr(m.by),el('br'),...sourceLinks(m.src || []))));
    return el('section',{class:'measure-group'},title,el('dl',{},rows));
  }
  function sourceCard(source,c){
    const url=M.safeURL(source.url);
    const metadata=[source.pub,kind(source.kind),say('checked ','provereno ')+(source.checked || '—')].join(' · ');
    const qualityNote=source.quality || source.note || source.limit || source.caveat;
    return el('li',{id:'source-'+source.id},
      el('div',{class:'source-title'},el('span',{},source.id),url?el('a',{href:url},source.t+' ↗'):el('span',{},source.t)),
      el('p',{},metadata),qualityNote?el('p',{},tr(qualityNote)):null,
      el('details',{},el('summary',{},say('How should I assess this source?','Kako da procenim ovaj izvor?')),
        el('p',{},say('Check the author, date, the original document or measurement, and whether other reports copy the same account. A source category or a second link is not an independent verification.','Proveri autora, datum, izvorni dokument ili merenje i da li drugi tekstovi prepisuju isti iskaz. Vrsta izvora ili još jedna veza nisu nezavisna potvrda.'))));
  }
  function renderDetail(){
    const c=data.claims.find(c=>c.k===selected);
    if(!c)return;
    const sourceIds=M.sourceIds(c),sources=data.sources.filter(s=>sourceIds.includes(s.id));
    const heading=el('div',{class:'detail-heading'},status(c),el('h2',{id:'detail-title',tabindex:'-1'},tr(c.q)));
    const meta=el('p',{class:'evidence-meta'},el('span',{},kind(c.ev)),el('span',{},say('Recorded check: ','Provera u zapisu: ')+(c.checked || '—')));
    const note=c.note?el('p',{class:'detail-note'},tr(c.note)):null;
    const measureGroups=M.measurements(c);
    const measures=measureGroups.length?el('div',{class:'measurements'},el('p',{class:'record-message'},say('Figures reported by the cited sources. These are not measurements made by this studio.','Brojevi koje navode izvori. Ovo nisu merenja koja je studio sproveo.')),measureGroups.map(measureGroup)):null;
    const quote=c.quote?el('blockquote',{class:'detail-note'},c.quote.text,el('br'),tr(c.quote.who),el('br'),...sourceLinks(c.quote.src || [])):null;
    const sourcesBlock=el('section',{class:'source-section'},el('h3',{},say('Follow the evidence','Prati dokaze')),
      el('p',{class:'record-message'},say('The status above belongs to this claim in the record. The links below show its provenance; their count does not establish independence or certainty.','Status iznad pripada ovoj tvrdnji u zapisu. Veze ispod pokazuju poreklo; njihov broj ne dokazuje nezavisnost niti izvesnost.')),
      sources.length?el('ol',{class:'source-list'},sources.map(s=>sourceCard(s,c))):el('p',{class:'record-message'},say('No source is attached to this claim. This does not prove that no document exists.','Ova tvrdnja nema priložen izvor. To ne dokazuje da dokument ne postoji.')));
    const mapped=window.ProstorModel.SPEC.filter(s=>s.claim===c.k);
    const scene=el('div',{class:'scene-links'},el('a',{class:'text-link',href:M.sceneURL(data,c)},mapped.length?say('Locate this evidence in 3D ↗','Pronađi ovaj dokaz u 3D ↗'):say('Open 3D · this claim has no spatial mapping yet','Otvori 3D · ova tvrdnja još nema prostornu vezu')));
    if(mapped.length>1)for(const p of mapped)scene.append(el('a',{href:M.sceneURL(data,c,p.part)},tr(p)));
    const body=[el('a',{href:'#passport-filters',class:'mobile-record-back'},say('↑ Back to questions','↑ Nazad na pitanja')),heading,meta,
      el('p',{class:'detail-value'},tr(c.v) || say('No answer is recorded.','Odgovor nije upisan.')),note,quote,measures,
      c.mNote?el('p',{class:'detail-note'},tr(c.mNote)):null,
      ...((c.flags || []).map(f=>el('p',{class:'flag-note'},tr(f)))),
      scene,sourcesBlock,
      el('section',{class:'next-step'},el('h3',{},say('What would strengthen this claim?','Šta bi ojačalo ovu tvrdnju?')),
        el('p',{},tr(c.next) || say('No next check is recorded.','Sledeća provera nije upisana.')),
        el('p',{class:'record-message'},say('A research lead in this record, not a new course obligation.','Istraživački pravac iz zapisa, ne nova nastavna obaveza.')))];
    $('#claim-detail').replaceChildren(...body.filter(node=>node!==null && node!==undefined));
  }
  function renderRecord(){
    const count=M.counts(data);
    document.title=tr(data.object.name)+' · '+say('Digital passport','Digitalni pasoš');
    $('#object-name').textContent=tr(data.object.name);
    $('#object-meta').textContent=data.id+' · '+data.object.life+' · '+say('record updated ','zapis ažuriran ')+data.updated;
    $('#object-counts').textContent=count.claims+' '+say('claims','tvrdnji')+' · '+count.sources+' '+say('sources','izvora')+' · '+(count.states.unknown || 0)+' '+say('unknown','nepoznato');
    $('#object-scope').textContent=tr(data.scope);
    $('#record-owner').textContent=say('Record compiled by: ','Zapis sastavio: ')+data.by;
    $('#proportion-notes').replaceChildren(...M.PROPORTIONS.map(p=>el('li',{},tr(p))));
    renderFilters();renderList();
  }
  function networkNote(){
    const target=$('#network-note');
    if(!target)return;
    target.textContent=navigator.onLine===false?say('Your browser reports no network. A loaded or previously saved record can still be read; external source pages need a connection.','Pregledač prijavljuje da nema mreže. Učitan ili ranije sačuvan zapis ostaje čitljiv; spoljne stranice izvora traže vezu.'):
      say('This is a dated record. For offline use, save the site from Access while connected; external source pages are not included.','Ovo je datirani zapis. Za rad bez mreže sačuvaj sajt kroz Pristup dok ima veze; spoljne stranice izvora nisu uključene.');
  }
  function errorMessage(){
    $('#load-message').textContent=say('The passport record could not be loaded. Connect and retry, or open the source JSON. No example data has been substituted.','Zapis pasoša nije učitan. Poveži se i pokušaj ponovo ili otvori izvorni JSON. Zamenski podaci nisu prikazani.');
  }
  async function load(){
    if(loading)return;
    loading=true;loadFailed=false;$('#retry-record').hidden=true;$('#record-load').hidden=false;
    $('#load-message').textContent=say('Loading the object record…','Učitavanje zapisa objekta…');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(M.DATA_PATH,{cache:'no-cache',signal:controller.signal});
      if(!response.ok)throw new Error('HTTP '+response.status);
      data=M.validate(await response.json());
      if(!selected || !data.claims.some(c=>c.k===selected))selected=data.claims.find(c=>c.st==='conflicting')?.k || data.claims[0]?.k || '';
      if(home){$('#home-evidence').hidden=false;preview();}
      else{$('#passport-content').hidden=false;renderRecord();}
      $('#record-load').hidden=true;networkNote();
    }catch{loadFailed=true;errorMessage();$('#retry-record').hidden=false;}
    finally{clearTimeout(timeout);loading=false;}
  }
  if(!home){
    $('#passport-filters').addEventListener('submit',e=>e.preventDefault());
    const q=new URLSearchParams(location.search);selected=q.get('claim') || '';
    for(const key of Object.keys(filters))filters[key]=q.get(key) || '';
    $('#filter-query').value=filters.q;
    for(const [id,key,event] of [['filter-query','q','input'],['filter-lane','lane','change'],['filter-status','status','change'],['filter-source','source','change'],['filter-kind','kind','change']]){
      $('#'+id).addEventListener(event,e=>{filters[key]=e.target.value;renderList();announce($('#result-count').textContent);});
    }
    $('#reset-filters').addEventListener('click',()=>{
      for(const key of Object.keys(filters))filters[key]='';$('#filter-query').value='';renderFilters();renderList();$('#filter-query').focus();announce($('#result-count').textContent);
    });
  }
  $('#retry-record').addEventListener('click',load);
  new MutationObserver(()=>{
    const next=document.documentElement.lang.startsWith('sr')?'sr':'en';
    if(next===lang)return;
    lang=next;
    if(data)home?preview():renderRecord();
    if(loadFailed)errorMessage();networkNote();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  window.addEventListener('online',networkNote);window.addEventListener('offline',networkNote);
  networkNote();load();
})();
