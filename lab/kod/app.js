/* Four original instrumented models. Code specimens are the executed kernels. */
(function(){
'use strict';
const M=window.KodModel,$=id=>document.getElementById(id);
const modes=['loop','transform','walls','schedule'];
let lang='en',timer=null;
const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
const defaults={
 loop:{values:[12,18,15],operator:'add'},
 transform:{x:1,y:0,dx:4,dy:0,angle:90,order:'TR'},
 walls:[{id:'Z1',l_mm:4000,h_mm:3000,t_mm:200},{id:'Z2',l_mm:2500,h_mm:3000,t_mm:200}],
 schedule:{a:2,b:3,c:1,shared:false}
};
const clone=v=>JSON.parse(JSON.stringify(v));
const state={mode:modes.includes(location.hash.slice(1))?location.hash.slice(1):'loop',step:0,data:clone(defaults),valid:true};
const words={
 en:{
 titles:['A running total','Order changes place','Units become quantities','A shared constraint'],
 questions:['What is the next total before the program shows it?','Move, then rotate. Rotate, then move. Will the point arrive at the same place?','Two solid walls. Keep the millimetres in the input and the metres in the answer.','Both tasks are ready. Can they use one crane at the same time?'],
 boundaries:[
 'One step is one complete loop iteration. This is an instrumented example, not a debugger for arbitrary code. Values have no physical unit.',
 'Abstract model units. Rotation is counterclockwise about (0,0). The diagram maps positive y upwards; SVG screen coordinates are inverted for display. The large readout rounds coordinates smaller than 1e-12 to zero; the table keeps scientific notation.',
 'Two full rectangular solids: one-face area and volume. No openings, overlaps, waste, material properties or professional quantity rules. This is not an IFC file.',
 'Fictional days, constant durations, no calendars or interruptions. B and C require the same crane. Listed order B then C is used; the algorithm does not search for an optimum. Not a site plan.'
 ],
 input:'INPUT',values:'Three input values',operator:'Instruction',add:'Add (+)',subtract:'Subtract (−): intentional bug',step:'Step',play:'Play',pause:'Pause',predict:'Predict the next total',check:'Check prediction',finished:'All iterations complete. Reset to start again.',predictionEmpty:'Enter a finite number first.',correct:'Yes. The next total is ',incorrect:'Compare with the instruction. The next total is ',current:'CURRENT TOTAL',iteration:'Iteration',of:'of',
 loopAdd:'The previous total is kept, then the next input is added. Follow the highlighted row.',
 loopSubtract:'The intended sum is broken on purpose: the same inputs are subtracted. The trace and code show what actually runs.',
 motion:'Reduced motion is on. Advance with Step.',
 point:'Starting point',shift:'Translation vector',angle:'Angle (degrees)',order:'Operation order',TR:'Translate → rotate',RT:'Rotate → translate',
 endpoint:'END POINT',difference:'Distance between the two endpoints',transformNote:'The solid path is the selected order. The dashed path is the other order. Each segment joins discrete states; it is not a measured trajectory.',
 length:'Length / mm',height:'Height / mm',thickness:'Thickness / mm',totalVolume:'TOTAL VOLUME',faceArea:'One-face area',wallNote:'mm × mm × mm gives mm³. Divide by 1,000,000,000 for m³; divide mm² by 1,000,000 for m².',
 duration:'Task duration / fictional days',shared:'B + C share one crane',finish:'FINISH',days:'days',DAG:'Dependencies only',crane:'One shared crane',
 scheduleNote:'A finishes first. Without a resource limit, B and C overlap. With one crane, C waits until B releases it. Dependency and resource constraints are different.',
 invalid:'No result: check every input. Use finite numbers within the displayed ranges; dimensions and durations must be positive. Missing input is not zero.',
 before:'Before',incoming:'Input',after:'After',initial:'No iteration has run yet.',state:'State',start:'Start',middle:'After first operation',end:'After second operation',
 id:'ID',area:'Area / m²',volume:'Volume / m³',total:'Total',task:'Task',endTime:'End',craneUse:'Crane',yes:'yes',no:'no',
 copied:'Calculation function copied.',copyFailed:'Select the code text and copy it with your device. Clipboard access is unavailable.',
 codeTitle:'Code, made visible · OR Laboratory',copy:'Copy code',frame:'STEP',none:'not run',validated:'Validated inputs',range:'Supported range',
 loopRange:'Three values: −1000…1000. A changed input restarts the trace.',
 transformRange:'Coordinates/shift: −20…20. Angle: −180…180°.',
 wallRange:'Every dimension: 0.001…100000 mm.',scheduleRange:'Each duration: 0.001…50 days.'
 },
 sr:{
 titles:['Zbir kroz korake','Redosled menja mesto','Jedinice daju količine','Zajedničko ograničenje'],
 questions:['Koliki je sledeći zbir pre nego što ga program pokaže?','Pomeri, pa rotiraj. Rotiraj, pa pomeri. Da li tačka stiže na isto mesto?','Dva puna zida. Milimetri ostaju u ulazu, metri u odgovoru.','Oba posla su spremna. Mogu li istovremeno koristiti jednu dizalicu?'],
 boundaries:[
 'Jedan korak je jedna cela iteracija petlje. Ovo je instrumentovan primer, ne debugger proizvoljnog koda. Vrednosti nemaju fizičku jedinicu.',
 'Apstraktne modelske jedinice. Rotacija je suprotna kazaljci sata oko (0,0). Pozitivno y ide nagore; SVG ekranska koordinata je obrnuta samo za prikaz. Veliki prikaz zaokružuje koordinate manje od 1e-12 na nulu; tabela čuva naučni zapis.',
 'Dva puna pravougaona tela: površina jedne strane i zapremina. Nema otvora, preklopa, otpada, svojstava materijala ili stručnih pravila obračuna. Ovo nije IFC datoteka.',
 'Izmišljeni dani, stalna trajanja, bez kalendara i prekida. B i C traže istu dizalicu. Koristi se redosled B pa C; algoritam ne traži optimum. Ovo nije plan gradilišta.'
 ],
 input:'ULAZ',values:'Tri ulazne vrednosti',operator:'Naredba',add:'Saberi (+)',subtract:'Oduzmi (−): namerna greška',step:'Korak',play:'Pokreni',pause:'Pauza',predict:'Predvidi sledeći zbir',check:'Proveri predviđanje',finished:'Sve iteracije su završene. Vrati primer za novi početak.',predictionEmpty:'Prvo unesi konačan broj.',correct:'Da. Sledeći zbir je ',incorrect:'Uporedi sa naredbom. Sledeći zbir je ',current:'TRENUTNI ZBIR',iteration:'Iteracija',of:'od',
 loopAdd:'Prethodni zbir se čuva, pa se dodaje sledeći ulaz. Prati označeni red.',
 loopSubtract:'Namera da saberemo namerno je pokvarena: isti ulazi se oduzimaju. Trag i kod pokazuju šta se zaista izvršava.',
 motion:'Smanjeno kretanje je uključeno. Koristi Korak.',
 point:'Početna tačka',shift:'Vektor pomeranja',angle:'Ugao (stepeni)',order:'Redosled operacija',TR:'Pomeri → rotiraj',RT:'Rotiraj → pomeri',
 endpoint:'KRAJNJA TAČKA',difference:'Rastojanje između dva završetka',transformNote:'Puna putanja je izabrani redosled, isprekidana drugi. Duži spajaju odvojena stanja; to nije izmerena putanja kretanja.',
 length:'Dužina / mm',height:'Visina / mm',thickness:'Debljina / mm',totalVolume:'UKUPNA ZAPREMINA',faceArea:'Površina jedne strane',wallNote:'mm × mm × mm daje mm³. Za m³ deli se sa 1.000.000.000, a mm² se za m² dele sa 1.000.000.',
 duration:'Trajanje / izmišljeni dani',shared:'B + C dele jednu dizalicu',finish:'ZAVRŠETAK',days:'dana',DAG:'Samo zavisnosti',crane:'Jedna dizalica',
 scheduleNote:'Prvo se završava A. Bez ograničenja resursa, B i C se preklapaju. Sa jednom dizalicom, C čeka da je B oslobodi. Zavisnost i resurs su različita ograničenja.',
 invalid:'Nema rezultata: proveri sve ulaze. Unesi konačne brojeve u označenom opsegu; mere i trajanja moraju biti pozitivni. Prazan ulaz nije nula.',
 before:'Pre',incoming:'Ulaz',after:'Posle',initial:'Još nije izvršena nijedna iteracija.',state:'Stanje',start:'Početak',middle:'Posle prve operacije',end:'Posle druge operacije',
 id:'ID',area:'Površina / m²',volume:'Zapremina / m³',total:'Ukupno',task:'Posao',endTime:'Kraj',craneUse:'Dizalica',yes:'da',no:'ne',
 copied:'Računska funkcija je kopirana.',copyFailed:'Označi tekst koda i kopiraj ga na uređaju. Pristup ostavi nije dostupan.',
 codeTitle:'Kod koji se vidi · OR laboratorija',copy:'Kopiraj kod',frame:'KORAK',none:'nije pokrenuto',validated:'Provereni ulazi',range:'Podržani opseg',
 loopRange:'Tri vrednosti: −1000…1000. Promena ulaza vraća trag na početak.',
 transformRange:'Koordinate/pomeranje: −20…20. Ugao: −180…180°.',
 wallRange:'Svaka mera: 0,001…100000 mm.',scheduleRange:'Svako trajanje: 0,001…50 dana.'
 }
};
const t=key=>words[lang][key];
const fmt=n=>!Number.isFinite(n)?'—':n===0?'0':(Math.abs(n)<1e-5||Math.abs(n)>=1e7)?n.toExponential(3).replace('.',lang==='sr'?',':'.'):Number(n.toPrecision(7)).toLocaleString(lang==='sr'?'sr-Latn':'en',{maximumFractionDigits:7});
// This coordinate readout rounds floating-point residue; exact inputs and the table remain visible.
const coordinate=n=>Math.abs(n)<1e-12?'0':fmt(n);
const point=p=>'('+p.map(coordinate).join('; ')+')';
function numeric(id,label,value,min,max){return '<label for="'+id+'"><span>'+label+'</span><input type="number" id="'+id+'" value="'+(Number.isFinite(value)?value:'')+'" min="'+min+'" max="'+max+'" step="any" inputmode="decimal"></label>';}
function fieldset(label,body){return '<fieldset><legend>'+label+'</legend>'+body+'</fieldset>';}
function select(id,label,options,value){return '<label for="'+id+'"><span>'+label+'</span><select id="'+id+'">'+options.map(([v,name])=>'<option value="'+v+'"'+(v===value?' selected':'')+'>'+name+'</option>').join('')+'</select></label>';}
function controls(){
 const mode=state.mode,p=state.data[mode];let h='';
 if(mode==='loop'){
  h=fieldset(t('values'),'<div class="fields three">'+p.values.map((v,i)=>numeric('v'+i,'x'+(i+1),v,-1000,1000)).join('')+'</div>')+
   select('operator',t('operator'),[['add',t('add')],['subtract',t('subtract')]],p.operator)+
   '<div class="controls-row"><button id="step" class="primary" type="button">'+t('step')+'</button><button id="play" type="button">'+t('play')+'</button></div>'+
   '<div class="prediction">'+numeric('prediction',t('predict'),NaN,-12000,12000)+'<button id="check" type="button">'+t('check')+'</button><p id="feedback" class="feedback" role="status"></p></div>'+
   '<p class="minor">'+t('loopRange')+'</p><p class="minor" id="motion-note"></p>';
 }else if(mode==='transform'){
  h=fieldset(t('point'),'<div class="fields">'+numeric('px','x',p.x,-20,20)+numeric('py','y',p.y,-20,20)+'</div>')+
   fieldset(t('shift'),'<div class="fields">'+numeric('dx','Δx',p.dx,-20,20)+numeric('dy','Δy',p.dy,-20,20)+'</div>')+
   numeric('angle',t('angle'),p.angle,-180,180)+select('order',t('order'),[['TR',t('TR')],['RT',t('RT')]],p.order)+
   '<p class="minor">'+t('transformRange')+'</p>';
 }else if(mode==='walls'){
  h=p.map((w,i)=>fieldset(w.id,'<div class="fields">'+numeric('l'+i,t('length'),w.l_mm,.001,100000)+numeric('h'+i,t('height'),w.h_mm,.001,100000)+numeric('t'+i,t('thickness'),w.t_mm,.001,100000)+'</div>')).join('')+
   '<p class="minor">'+t('wallRange')+'</p>';
 }else{
  h=fieldset(t('duration'),'<div class="fields three">'+['a','b','c'].map(id=>numeric('d'+id,id.toUpperCase(),p[id],.001,50)).join('')+'</div>')+
   '<p class="minor">A → B<br>A → C</p><label class="check"><input id="shared" type="checkbox"'+(p.shared?' checked':'')+'>'+t('shared')+'</label>'+
   '<p class="minor">'+t('scheduleRange')+'</p>';
 }
 $('controls').innerHTML=h;
}
function numberValue(id){const input=$(id);return input.value.trim()===''?NaN:input.valueAsNumber;}
function read(){
 const p=state.data[state.mode];
 if(state.mode==='loop'){p.values=[0,1,2].map(i=>numberValue('v'+i));p.operator=$('operator').value;}
 if(state.mode==='transform'){p.x=numberValue('px');p.y=numberValue('py');p.dx=numberValue('dx');p.dy=numberValue('dy');p.angle=numberValue('angle');p.order=$('order').value;}
 if(state.mode==='walls')p.forEach((w,i)=>{w.l_mm=numberValue('l'+i);w.h_mm=numberValue('h'+i);w.t_mm=numberValue('t'+i);});
 if(state.mode==='schedule'){['a','b','c'].forEach(id=>p[id]=numberValue('d'+id));p.shared=$('shared').checked;}
}
function stop(){if(timer!==null){clearInterval(timer);timer=null;}document.body.dataset.playing='false';if($('play'))$('play').textContent=t('play');}
function showCode(){
 $('code').replaceChildren();
 M.codeSource(state.mode).split('\n').forEach((line,i)=>{const span=document.createElement('span');span.className='line';span.textContent=line||' ';if(state.mode==='loop'&&state.step>0&&i>=4&&i<=6)span.classList.add('active');$('code').append(span);});
}
function table(headers,rows,caption,active=-1){
 const el=document.createElement('table');const cap=document.createElement('caption');cap.textContent=caption;el.append(cap);
 const head=document.createElement('thead'),tr=document.createElement('tr');
 headers.forEach(h=>{const cell=document.createElement('th');cell.scope='col';cell.textContent=h;tr.append(cell);});head.append(tr);el.append(head);
 const body=document.createElement('tbody');
 rows.forEach((row,i)=>{const tr=document.createElement('tr');if(i===active)tr.className='active';row.forEach((v,j)=>{const cell=document.createElement(j===0?'th':'td');if(j===0)cell.scope='row';cell.textContent=String(v);tr.append(cell);});body.append(tr);});el.append(body);$('table').replaceChildren(el);
}
const NS='http://www.w3.org/2000/svg';
function element(tag,attrs={},text){const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));if(text!==undefined)el.textContent=text;return el;}
function drawing(){const svg=element('svg',{viewBox:'0 0 360 230','aria-hidden':'true',focusable:'false'});$('drawing').replaceChildren(svg);return svg;}
function line(svg,x1,y1,x2,y2,cls='axis'){svg.append(element('line',{x1,y1,x2,y2,class:cls}));}
function text(svg,x,y,value,attrs={}){svg.append(element('text',{x,y,...attrs},value));}
function loopDraw(rows){
 const svg=drawing(),shown=rows.slice(0,state.step),all=[0,...rows.map(r=>r.after)],lo=Math.min(...all),hi=Math.max(...all),range=Math.max(1,hi-lo);
 const Y=v=>185-(v-lo)/range*130;
 line(svg,28,Y(0),334,Y(0));
 [0,...shown.map(r=>r.after)].forEach((value,i)=>{const x=48+i*84,y=Y(value);svg.append(element('rect',{x:x-13,y:Math.min(y,Y(0)),width:26,height:Math.max(2,Math.abs(Y(0)-y)),fill:i===state.step?'#174ac6':'#aab6d4'}));svg.append(element('circle',{cx:x,cy:y,r:i===state.step?5:3,class:'fill'}));text(svg,x,217,i===0?'0':String(i),{'text-anchor':'middle'});text(svg,x,Math.max(22,y-12),fmt(value),{'text-anchor':'middle'});});
 text(svg,28,18,t('frame')+' '+state.step+' / '+rows.length);
}
function transformDraw(selected,other){
 const svg=drawing(),pts=[selected.start,selected.middle,selected.end,other.middle,other.end,[0,0]];
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),loX=Math.min(...xs)-1,hiX=Math.max(...xs)+1,loY=Math.min(...ys)-1,hiY=Math.max(...ys)+1;
 const scale=Math.min(280/(hiX-loX),160/(hiY-loY));
 const X=x=>40+(x-loX)*scale,Y=y=>195-(y-loY)*scale;
 line(svg,30,Y(0),330,Y(0));line(svg,X(0),20,X(0),205);text(svg,334,Y(0)-4,'x');text(svg,X(0)+5,19,'y');text(svg,X(0)+5,Y(0)+14,'0');
 function pathFor(r,cls){svg.append(element('polyline',{points:[r.start,r.middle,r.end].map(p=>X(p[0])+','+Y(p[1])).join(' '),class:cls}));}
 pathFor(other,'other');pathFor(selected,'signal');
 [selected.start,selected.middle,selected.end].forEach((p,i)=>{svg.append(element('circle',{cx:X(p[0]),cy:Y(p[1]),r:i===2?6:4,class:'fill'}));text(svg,Math.min(318,X(p[0])+8),Math.max(16,Y(p[1])-8),'P'+i);});
 svg.append(element('circle',{cx:X(other.end[0]),cy:Y(other.end[1]),r:6,class:'other'}));
}
function wallsDraw(walls){
 const svg=drawing();const maxL=Math.max(...walls.map(w=>w.l_mm)),maxH=Math.max(...walls.map(w=>w.h_mm));
 walls.forEach((w,i)=>{const x=24+i*178,ww=w.l_mm/maxL*132,hh=w.h_mm/maxH*132;svg.append(element('rect',{x,y:182-hh,width:Math.max(1,ww),height:Math.max(1,hh),fill:i===0?'#e7edff':'#f4f1e8',stroke:'#174ac6','stroke-width':1.5}));text(svg,x,28,w.id);text(svg,x,210,fmt(w.l_mm)+' × '+fmt(w.h_mm)+' mm');});
}
function scheduleTasks(){const p=state.data.schedule;return [{id:'A',duration:p.a,pre:[],crane:false},{id:'B',duration:p.b,pre:['A'],crane:true},{id:'C',duration:p.c,pre:['A'],crane:true}];}
function scheduleDraw(r,max){
 const svg=drawing(),X=n=>43+n/max*286;
 for(let i=0;i<=4;i++){const v=max*i/4;line(svg,X(v),25,X(v),190,'guide');text(svg,X(v),213,fmt(v),{'text-anchor':'middle'});}
 r.rows.forEach((row,i)=>{const y=45+i*52;text(svg,12,y+15,row.id);svg.append(element('rect',{x:X(row.start),y,width:Math.max(1,X(row.end)-X(row.start)),height:25,fill:row.crane?'#174ac6':'#6b7682'}));text(svg,X(row.start)>235?330:X(row.start)+4,y-6,fmt(row.start)+' → '+fmt(row.end),X(row.start)>235?{'text-anchor':'end'}:{});});
}
function render(){
 state.valid=true;$('error').hidden=true;$('drawing').hidden=false;$('copy-status').textContent='';showCode();
 const mode=state.mode,p=state.data[mode];$('input-code').textContent=t('validated')+':\n'+JSON.stringify(p,null,2);
 try{
  if(mode==='loop'){
   const rows=M.loopTrace(p.values,p.operator);state.step=Math.min(state.step,rows.length);
   $('result-label').textContent=t('current');$('result').textContent=fmt(state.step?rows[state.step-1].after:0);
   $('result-detail').textContent=t('iteration')+' '+state.step+' / '+rows.length;
   $('explain').textContent=t(p.operator==='add'?'loopAdd':'loopSubtract');
   table([t('frame'),t('before'),t('incoming'),t('after')],rows.slice(0,state.step).map(r=>[r.step,fmt(r.before),fmt(r.input),fmt(r.after)]),state.step?t('iteration')+' '+state.step:t('initial'),state.step-1);
   loopDraw(rows);$('step').disabled=state.step>=rows.length;$('play').disabled=motion.matches||state.step>=rows.length;$('check').disabled=state.step>=rows.length;
   $('motion-note').textContent=motion.matches?t('motion'):'';
  }else if(mode==='transform'){
   const r=M.transformTrace(p),other=M.transformTrace({...p,order:p.order==='TR'?'RT':'TR'});
   $('result-label').textContent=t('endpoint');$('result').textContent=point(r.end);$('result').style.fontSize='';$('result-detail').textContent=t(p.order);
   $('explain').textContent=t('transformNote')+' '+t('difference')+': '+fmt(Math.hypot(r.end[0]-other.end[0],r.end[1]-other.end[1]))+'.';
   table([t('state'),'x','y'],[[t('start'),...r.start.map(fmt)],[t('middle'),...r.middle.map(fmt)],[t('end'),...r.end.map(fmt)]],t(p.order),2);transformDraw(r,other);
  }else if(mode==='walls'){
   const r=M.wallQuantities(p);$('result-label').textContent=t('totalVolume');$('result').textContent=fmt(r.volume_m3);$('result-detail').textContent='m³ · '+t('faceArea')+': '+fmt(r.area_m2)+' m²';$('explain').textContent=t('wallNote');
   table([t('id'),t('area'),t('volume')],[...r.walls.map(w=>[w.id,fmt(w.area_m2),fmt(w.volume_m3)]),[t('total'),fmt(r.area_m2),fmt(r.volume_m3)]],t('faceArea')+' + m³',2);wallsDraw(p);
  }else{
   const tasks=scheduleTasks(),dag=M.schedule(tasks,false),crane=M.schedule(tasks,true),r=p.shared?crane:dag;
   $('result-label').textContent=t('finish');$('result').textContent=fmt(r.finish);$('result-detail').textContent=t('days')+' · '+t(p.shared?'crane':'DAG');
   $('explain').textContent=t('DAG')+': '+fmt(dag.finish)+'; '+t('crane')+': '+fmt(crane.finish)+'. '+t('scheduleNote');
   table([t('task'),t('start'),t('endTime'),t('craneUse')],r.rows.map(r=>[r.id,fmt(r.start),fmt(r.end),t(r.crane?'yes':'no')]),t(p.shared?'crane':'DAG'));scheduleDraw(r,crane.finish);
   $('input-code').textContent=t('validated')+':\n'+JSON.stringify({tasks,sharedCrane:p.shared},null,2);
  }
 }catch(e){
  state.valid=false;stop();$('result').textContent='—';$('result-detail').textContent='';$('explain').textContent='';$('drawing').replaceChildren();$('table').replaceChildren();
  $('error').hidden=false;$('error').textContent=t('invalid');$('input-code').textContent=t('input')+':\n'+JSON.stringify(p,(k,v)=>typeof v==='number'&&!Number.isFinite(v)?'INVALID':v,2);
  ['step','play','check'].forEach(id=>{if($(id))$(id).disabled=true;});
 }
}
function rebuild(){
 stop();document.documentElement.lang=lang==='sr'?'sr-Latn':'en';document.title=t('codeTitle');
 document.querySelectorAll('[data-en]').forEach(el=>el.textContent=el.dataset[lang]);
 $('language').textContent=lang==='en'?'SR':'EN';$('language').setAttribute('aria-label',lang==='en'?'Prikaži na srpskom':'Show in English');
 const i=modes.indexOf(state.mode);$('mode-number').textContent='0'+(i+1)+' / '+state.mode.toUpperCase();$('instrument-title').textContent=t('titles')[i];$('question').textContent=t('questions')[i];$('boundary').textContent=t('boundaries')[i];
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
 controls();render();
}
function advance(){if(!state.valid)return;const n=state.data.loop.values.length;if(state.step<n){state.step++;if($('feedback'))$('feedback').textContent='';}if(state.step>=n)stop();render();}
$('controls').addEventListener('submit',e=>e.preventDefault());
$('controls').addEventListener('input',e=>{if(e.target.id==='prediction')return;stop();read();if(state.mode==='loop')state.step=0;render();if($('feedback'))$('feedback').textContent='';});
$('controls').addEventListener('change',e=>{if(e.target.tagName==='SELECT'){stop();read();if(state.mode==='loop')state.step=0;render();}});
$('controls').addEventListener('click',e=>{
 const id=e.target.closest('button')?.id;
 if(id==='step')advance();
 if(id==='play'){
  if(timer!==null){stop();return;}if(!state.valid||motion.matches)return;
  document.body.dataset.playing='true';$('play').textContent=t('pause');timer=setInterval(advance,1000);
 }
 if(id==='check'&&state.valid){
  const prediction=numberValue('prediction'),rows=M.loopTrace(state.data.loop.values,state.data.loop.operator);
  if(!Number.isFinite(prediction)){$('feedback').textContent=t('predictionEmpty');return;}
  if(state.step>=rows.length){$('feedback').textContent=t('finished');return;}
  const expected=rows[state.step].after,ok=Math.abs(prediction-expected)<1e-8;
  $('feedback').textContent=t(ok?'correct':'incorrect')+fmt(expected)+'.';
 }
});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;history.replaceState(null,'','#'+state.mode);rebuild();}));
window.addEventListener('hashchange',()=>{const mode=location.hash.slice(1);if(modes.includes(mode)){state.mode=mode;rebuild();}});
$('language').addEventListener('click',()=>{lang=lang==='en'?'sr':'en';rebuild();});
$('reset').addEventListener('click',()=>{state.data[state.mode]=clone(defaults[state.mode]);if(state.mode==='loop')state.step=0;rebuild();});
$('copy').addEventListener('click',async()=>{
 const code=M.codeSource(state.mode);
 try{if(!navigator.clipboard)throw Error('clipboard');await navigator.clipboard.writeText(code);$('copy-status').textContent=t('copied');}
 catch(e){$('copy-status').textContent=t('copyFailed');const range=document.createRange();range.selectNodeContents($('code'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);$('code').focus();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);motion.addEventListener('change',()=>{stop();if(state.mode==='loop')render();});
rebuild();
})();
