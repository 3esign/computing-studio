/* A guided reading connects each spatial form to a named archival record.
   No autoplay: each camera move follows the reader's next/previous action. */
(()=>{'use strict';
const text=(sr,en)=>({sr,en});
function stops(b){
 const readings=new Map((b?.readings||[]).map(r=>[r.id,r]));
 const l=b?.lift, p=b?.labour||[];
 const result=[
  {id:'pit',target:'bigz:pit',refs:['cit-foto-jama-pod-vodom'],title:text('Gradilište pod vodom','A flooded construction site'),
   body:text('Fotografija od 24. maja 1937. beleži prednji deo jame pod vodom. Stepenasti oblik u atlasu je tumačenje fotografija; dubina nije izmerena.','A photograph dated 24 May 1937 records water in the front of the excavation. The stepped form interprets photographs; its depth is not measured.')},
  {id:'lift',target:'bigz:lift',refs:[l?.reading],title:text('Jedna stvarna mera','One measured dimension'),
   body:text(`Visina dizanja je ${l?.hoistMetres?.toLocaleString('sr-RS')} m, uz ${l?.stops} stajališta i nosivost ${l?.capacityKg?.toLocaleString('sr-RS')} kg. To su podaci fabričkog lista, ne procena ukupne visine zgrade.`,`The hoist height is ${l?.hoistMetres} m, with ${l?.stops} stops and a ${l?.capacityKg?.toLocaleString('en-GB')} kg capacity. These are manufacturer-sheet values, not an estimate of the building's height.`)},
  ...p.slice(0,2).map((v,i)=>({id:'labour-'+(i+1),target:v.id,refs:[v.reading],title:i?text('Promena zanata','A changing mix of trades'):text('Rad izražen nadnicama','Work measured in man-days'),
   body:text(`${v.from} — ${v.to}: ${v.total.toLocaleString('sr-RS')} nadnica. Stubovi razlažu zbir po zanatima; njihova visina je logaritamska. Nadnice nisu broj različitih radnika.`,`${v.from} — ${v.to}: ${v.total.toLocaleString('en-GB')} man-days. Columns break the total down by trade; their height is logarithmic. Man-days are not a count of distinct workers.`)})),
  {id:'boilers',target:'bigz:r:cit-komisijski-izvestaj-kotlovi-s2',refs:['cit-komisijski-izvestaj-kotlovi-s2'],title:text('Cena i izbor opreme','Price and equipment selection'),
   body:text('Komisija 15. septembra 1941. predlaže Strebelwerke. Jeftinija alternativa Metlaš ima manju ogrevnu površinu i zahteva veštačku promaju. Dokument beleži obrazloženje preporuke, ne dokazuje izvršenje ugovora.','On 15 September 1941 the commission recommends Strebelwerke. The cheaper Metlaš alternative has less heating surface and needs forced draught. This records the recommendation and its reasoning, not proof of contract fulfilment.')},
  {id:'open-question',target:'bigz:r:cit-finansije-brod-na-savi-kaucija',refs:['cit-finansije-brod-na-savi-kaucija'],title:text('Šta ostaje otvoreno','What remains open'),
   body:text('Dopis iz 1943. traži povrat kaucije i tvrdi da licitacija nije održana usled rata. To je izjava pošiljaoca. Odnos prema drugim komisijskim dokumentima ostaje za proveru; evidentiran sken ne znači da je svaka tvrdnja potvrđena.','A 1943 letter requests the return of a bid bond and says the tender did not take place because of the war. This is the sender’s account. Its relationship to other commission documents still needs checking; recording a scan does not verify every claim.')}
 ];
 return result.filter(s=>s.refs.length&&s.refs.every(id=>readings.has(id))).map(s=>({...s,readings:s.refs.map(id=>readings.get(id))}));
}
function mount(api){
 const $=s=>document.querySelector(s),el=(tag,content)=>{const n=document.createElement(tag);if(content)n.textContent=content;return n};
 const panel=el('section');panel.id='archive-tour';panel.hidden=true;panel.setAttribute('aria-label','BIGZ');
 panel.innerHTML='<div class="tour-heading"><span id="tour-count"></span><button id="tour-close"></button></div><nav id="tour-stops"></nav><div id="tour-copy" aria-live="polite" aria-atomic="true"><h2 id="tour-title"></h2><p id="tour-text"></p></div><details id="tour-evidence"><summary></summary><div id="tour-records"></div></details><div class="tour-actions"><button id="tour-prev"></button><button id="tour-next"></button></div>';
 $('.workspace').append(panel);
 let saved=null,active='',items=[];
 const lang=()=>api.lang(),t=v=>v?.[lang()]||v?.sr||v||'',say=(sr,en)=>lang()==='sr'?sr:en;
 function paint(){
  items=stops(api.bigz());const index=items.findIndex(s=>s.id===active),s=items[index];
  panel.hidden=!s;document.body.classList.toggle('touring',!!s);
  if(!s)return;
  $('#tour-count').textContent='BIGZ · '+(index+1)+' / '+items.length;
  $('#tour-title').textContent=t(s.title);$('#tour-text').textContent=t(s.body);
  $('#tour-close').textContent=say('Završi ×','End ×');$('#tour-close').setAttribute('aria-label',say('Završi turu','End the tour'));
  $('#tour-prev').textContent=say('← Prethodno','← Previous');$('#tour-prev').disabled=index===0;
  $('#tour-next').textContent=index===items.length-1?say('Istraži samostalno →','Explore freely →'):say('Sledeće →','Next →');
  const nav=$('#tour-stops');nav.setAttribute('aria-label',say('Stanice ture','Tour stops'));nav.replaceChildren();
  items.forEach((v,i)=>{const b=el('button',String(i+1));b.title=t(v.title);b.setAttribute('aria-label',(i+1)+'. '+t(v.title));b.setAttribute('aria-current',v.id===active?'step':'false');b.onclick=()=>go(v.id);nav.append(b)});
  $('#tour-evidence summary').textContent=say('Zapis čitanja i pouzdanost','Reading record and confidence');
  const host=$('#tour-records');host.replaceChildren();
  for(const r of s.readings){const article=el('article');article.append(el('h3',t(r.title)),el('small',r.id+' · '+r.folder));const p=el('p',r.text);p.lang='sr-Latn';article.append(p,el('small',say('Čitljivost: ','Legibility: ')+r.legibility+' · '+say('Poverenje: ','Confidence: ')+r.confidence));host.append(article)}
  host.append(el('p',say('Javni zapis čitanja; originalni skenovi nisu javni.','Public reading record; original scans are not public.')));
 }
 function go(id,{write=true,focus=true}={}){
  items=stops(api.bigz());const s=items.find(s=>s.id===id);if(!s)return false;
  if(!saved)saved={era:api.state.era,mode:api.state.mode,motion:api.state.motion};
  active=id;api.state.tour=id;api.state.era='';api.state.mode='city';api.state.motion=false;
  $('#tour-evidence').open=false;
  api.render();paint();api.focus(s.target);if(write)api.url();
  if(focus)$('#tour-next').focus({preventScroll:true});return true;
 }
 function end({write=true,restore=true,focus=true}={}){
  active='';api.state.tour='';if(saved&&restore)Object.assign(api.state,saved);saved=null;paint();
  api.render();if(write)api.url();if(focus)$('#tour-start').focus({preventScroll:true});
 }
 $('#tour-close').onclick=()=>end();$('#tour-prev').onclick=()=>go(items[items.findIndex(s=>s.id===active)-1]?.id);
 $('#tour-next').onclick=()=>{const i=items.findIndex(s=>s.id===active);i===items.length-1?end():go(items[i+1].id)};
 $('#tour-start').onclick=()=>go(stops(api.bigz())[0]?.id);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!$('#atlas-drawer').open){e.preventDefault();e.stopImmediatePropagation();end()}},true);
 new ResizeObserver(()=>document.documentElement.style.setProperty('--tour-height',panel.getBoundingClientRect().height+'px')).observe(panel);
 return {go,end,refresh(){if(active)paint()},sync(id){if(api.state.world!=='bigz'||!stops(api.bigz()).some(s=>s.id===id)){if(active)end({write:false,restore:false,focus:false});return}go(id,{write:false,focus:false})},get active(){return active}};
}
window.AtlasTour={stops,mount};
})();
