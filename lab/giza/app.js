/* One state supplies the geometry, table and progress. No animation at rest. */
(function () {
  'use strict';
  const M = window.GizaModel;
  const $ = id => document.getElementById(id);
  let state = M.create(4), lang = 'en', timer = null;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const translated = Array.from(document.querySelectorAll('[data-i18n]'));
  const english = new Map(translated.map(el => [el, el.innerHTML]));
  const sr = {
    skip:'Pređi na instrument',home:'Računarstvo',labs:'Svi instrumenti',
    eyebrow:'Oblak ideja · Geometrija / kod / dokazi',title:'Giza,<br>iz pravila.',
    lede:'Nekoliko redova gradi naš model. Dokazi govore koji delovi pripadaju istoriji.',readEvidence:'Prati dokaze ↓',
    instrumentTitle:'01 / Izgradi pravilo',toy:'NAŠ MODEL · NIJE REKONSTRUKCIJA',
    projection:'Izometrija · jedinične kocke',viewDescription:'Najnoviji sloj je plav. Tabela opisuje iste kocke. Isprekidana linija označava planiranu osnovu.',
    step:'Dodaj sloj',play:'Pusti',reset:'Početak',stepNote:'Jedan korak dodaje ceo sloj. Reprodukcija menja model, ne istorijsko vreme.',
    layers:'Broj slojeva',rangeNote:'Promena N započinje nov, prazan model.',height:'Dostignuta visina',blocks:'Postavljene kocke',
    tableCaption:'Tačan broj, odozdo nagore',layer:'Sloj',width:'Širina',count:'Kocke',state:'Stanje',total:'Ukupno',
    modelBoundary:'Jednake jedinične kocke, centrirani kvadratni slojevi, bez praznina. Po našem pravilu prvo završavamo niži sloj. Ovo ne opisuje stvarne kamene slojeve Velike piramide ni ponašanje konstrukcije. Broj kocki nije vreme, rad ili trošak.',
    codeTitle:'Pročitaj funkciju koja pravi ove slojeve',codeNote:'Ovo je funkcija koju prikaz zaista koristi. k počinje od 0; tabela označava slojeve od 1. Koordinate i crtanje su odvojeni.',
    researchKicker:'Četiri pogleda na gradnju',researchTitle:'Pravilo je naše.<br>Dokazi imaju izvor.',
    s1title:'Opiši oblik',s1:'Naša petlja pravi tačne kvadrate. Merenje počinje od sačuvanih, oštećenih tragova i procenjuje ono što nedostaje. Idealan model i izmeren spomenik odgovaraju na različita pitanja.',s1link:'Pročitaj izveštaj merenja →',
    s2title:'Prevezi materijal',s2:'Mererov sačuvani dnevnik beleži rečni prevoz iz Ture ka Akhet-Khufu. Istraživanja nekadašnjih vodotokova dodaju kontekst okruženja. Nijedno ne daje potpun algoritam podizanja piramide.',s2link:'Pročitaj dnevnik i radove o vodi →',
    s3title:'Uskladi rad',s3:'Niži sloj dolazi prvi u našem modelu. Stvarnom radu trebaju snabdevanje i prostor za život. Ostaci naselja otkrivaju deo organizacije, ne popis ljudi ili potpun raspored.',s3link:'Pročitaj izveštaj o naselju →',
    s4title:'Ostavi pitanje otvoreno',s4:'Rampa u Hatnubu je nalaz iz drugog kamenoloma. Ne utvrđuje sistem rampi Velike piramide. Uverljiva animacija ostaje hipoteza kada istorijski dokazi ne rešavaju pitanje.',s4link:'Pročitaj terenski zapis →',
    researchBoundary:'Razlikuj oznake: dokument · merenje · tumačenje · naš model. Iz ovog instrumenta ne izvodimo broj radnika, trajanje gradnje ili jedan dokazan metod izgradnje.',
    sourcesKicker:'Šest primarnih izvora · provereno 04.10.2026.',sourcesTitle:'Otvori dokaze.',openSource:'Otvori primarni izvor ↗',
    source1:'Primarno izdanje papirusa Jarf A i B. Pročitano: bibliografske strane, prevodi i početak sinteze u Dodatku I. Fragmenti beleže transport; priređivač navodi da tehnike gradnje nisu opisane. Cela monografija nije pročitana.',
    source2:'Originalno istraživanje paleo-okruženja. Pročitano: sažetak, rekonstrukcija G1/G4 i izabrane metode. Polen i sedimenti daju posredni pokazatelj nivoa vode uz neizvesno datiranje, ne dnevnu dubinu ili nosivost broda. Dopunski podaci nisu ponovo analizirani.',
    source3:'Originalni rad spaja radar, topografiju, karte, geofiziku i jezgra. Pročitano: sažetak, uvod, zaključak i izabrane metode u univerzitetskom PDF-u. Mapiranje starih rečnih segmenata nije opažanje pojedinačne isporuke. Bez ponovljene analize podataka.',
    source4:'Izveštaj iskopavanja, AERAGRAM 16(2), str.18–21. Pročitan tekst. Dvorište i kuhinje protumačeni su kao službenička kuća povezana sa snabdevanjem. Delimično iskopavanje, uglavnom poslednja faza; nije popis radnika.',
    source5:'Izvorno merenje, AERAGRAM 16(2). Pročitan tekst str.8–11 i 14; dijagrami 12–13 nisu vizuelno provereni. Regresija procenjuje izgubljene uglove. Ne utvrđuje drevnu metodu razmeravanja ili rampi.',
    source6:'Zapis kodirektora terenskog projekta, 09.10.2018. Pročitan ceo kratki izveštaj. Otkriveni su transportna rampa, uklesane stepenice i rupe za stubove. Hatnub je drugi kamenolom; ne utvrđuje raspored rampi Velike piramide.',
    back:'← Nazad na instrumente',footer:'Otvorena računarska ideja. Geometrija radi lokalno; veze ka izvorima traže internet.'
  };
  const t = (en, s) => lang === 'sr' ? s : en;
  const pct = n => new Intl.NumberFormat(lang === 'sr' ? 'sr-Latn' : 'en', {maximumFractionDigits:1}).format(n * 100) + '%';

  function stop() { if (timer !== null) window.clearInterval(timer); timer = null; }
  function announce(p) {
    $('announcement').textContent = t(
      `${state.built} of ${state.N} layers built. ${p.placedBlocks} of ${p.totalBlocks} cubes.`,
      `Izgrađeno ${state.built} od ${state.N} slojeva. ${p.placedBlocks} od ${p.totalBlocks} kocki.`);
  }
  function render(speak = false) {
    const p = M.progress(state);
    $('n-value').textContent = state.N;
    $('stage-status').textContent = `${state.built} / ${state.N}`;
    $('height-value').textContent = pct(p.heightFraction);
    $('blocks-value').textContent = pct(p.blockFraction);
    $('height-meter').value = p.heightFraction;
    $('blocks-meter').value = p.blockFraction;
    $('height-meter').setAttribute('aria-label', t('Height built','Dostignuta visina'));
    $('blocks-meter').setAttribute('aria-label', t('Cubes placed','Postavljene kocke'));
    $('height-detail').textContent = `${p.height} / ${p.targetHeight} ` + t('model units','modelskih jedinica');
    $('blocks-detail').textContent = `${p.placedBlocks} / ${p.totalBlocks} ` + t('cubes','kocki');
    $('table-total').textContent = p.totalBlocks;
    $('insight').textContent = state.built === 0 ? t(
      `At the first layer: ${pct(1 / state.N)} of the height, but ${pct(p.layers[0].blocks / p.totalBlocks)} of the cubes.`,
      `Posle prvog sloja: ${pct(1 / state.N)} visine, ali ${pct(p.layers[0].blocks / p.totalBlocks)} kocki.`)
      : p.done ? t('Same height and cube progress now. Neither measures time or work.','Visina i broj kocki sada su završeni. Nijedno ne meri vreme ili rad.')
      : t(`${pct(p.heightFraction)} of the height ≠ ${pct(p.blockFraction)} of the cubes.`,`${pct(p.heightFraction)} visine ≠ ${pct(p.blockFraction)} kocki.`);
    $('layer-table').replaceChildren(...p.layers.map(l => {
      const row = document.createElement('tr');
      if (l.k < state.built) row.className = 'completed';
      if (l.k === state.built - 1) row.className += ' current';
      const status = l.k < state.built ? t('Built','Gotov') : l.k === state.built ? t('Next','Sledeći') : t('Waiting','Čeka');
      [l.k + 1, `${l.side} × ${l.side}`, l.blocks, status].forEach(value => {
        const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
      }); return row;
    }));
    $('step').disabled = p.done;
    $('play').disabled = p.done || motion.matches;
    $('play').textContent = timer !== null ? t('Pause','Pauza') : t('Play','Pusti');
    $('play').setAttribute('aria-pressed', String(timer !== null));
    $('reset').disabled = state.built === 0 && timer === null;
    $('layers').disabled = false;
    $('motion-note').textContent = motion.matches
      ? t('Reduced motion: use Add a layer. Automatic playback is disabled.','Smanjeno kretanje: koristi Dodaj sloj. Automatska reprodukcija je isključena.')
      : t('One step adds one complete layer. Playback changes the model, not historical time.','Jedan korak dodaje ceo sloj. Reprodukcija menja model, ne istorijsko vreme.');
    $('algorithm').textContent = M.layersFor.toString();
    $('pyramid').setAttribute('aria-label',t(
      `Isometric toy model: ${state.built} completed layers, ${p.placedBlocks} cubes; target ${state.N} layers.`,
      `Izometrijski model: ${state.built} završenih slojeva, ${p.placedBlocks} kocki; cilj ${state.N} slojeva.`));
    draw(); if (speak) announce(p);
  }

  function draw() {
    const canvas = $('pyramid'), ctx = canvas.getContext('2d');
    if (!ctx) {
      $('view-description').textContent = t('Canvas is unavailable. The complete model is described in the table.','Canvas nije dostupan. Ceo model je opisan u tabeli.');
      return;
    }
    const width = canvas.getBoundingClientRect().width || 800;
    const height = width * 570 / 800, dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
    const B = 2 * state.N - 1;
    const scale = Math.min(width * .86 / (B * Math.sqrt(3)), height * .78 / (state.N + .5 + B / 2));
    const midV = (B / 2 - state.N - .5) / 2;
    const point = (x,y,z) => { const p=M.project(x,y,z); return [width/2 + p.u*scale,height/2+(p.v-midV)*scale]; };
    function polygon(points,fill,stroke) {
      ctx.beginPath(); points.forEach((p,i)=>{ const [x,y]=point(...p); i ? ctx.lineTo(x,y):ctx.moveTo(x,y); });ctx.closePath();
      if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}
    }
    ctx.setLineDash([4,5]);
    polygon([[-B/2,-B/2,0],[B/2,-B/2,0],[B/2,B/2,0],[-B/2,B/2,0]],null,'#777f7a');
    ctx.setLineDash([]);
    const cubes = M.cells(state).sort((a,b)=>a.k-b.k || (a.x+a.y)-(b.x+b.y));
    for(const c of cubes){
      const {x,y,z}=c, fresh=c.k===state.built-1;
      const top=fresh?'#557bea':'#ece7d8', left=fresh?'#1749c7':'#bfc3b6', right=fresh?'#315cc6':'#d2d1c4';
      const line=fresh?'#163b92':'#91978d';
      polygon([[x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1],[x,y+1,z+1]],left,line);
      polygon([[x+1,y,z],[x+1,y+1,z],[x+1,y+1,z+1],[x+1,y,z+1]],right,line);
      polygon([[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]],top,line);
    }
  }

  function language(next) {
    lang=next; document.documentElement.lang=lang==='sr'?'sr-Latn':'en';
    document.title=t('Giza, from a rule — OR','Giza, iz pravila — OR');
    translated.forEach(el=>{
      const key=el.dataset.i18n, value=lang==='sr'?sr[key]:english.get(el);
      // These values are our static copy, never external or user-provided HTML.
      if(key==='title'||key==='researchTitle')el.innerHTML=value;
      else if(lang==='en')el.innerHTML=english.get(el); else el.textContent=value;
    });
    $('lang-en').setAttribute('aria-pressed',String(lang==='en'));
    $('lang-sr').setAttribute('aria-pressed',String(lang==='sr'));
    document.querySelector('.controls').setAttribute('aria-label',t('Model controls','Kontrole modela'));
    render();
  }
  $('step').addEventListener('click',()=>{stop();state=M.advance(state);render(true);});
  $('play').addEventListener('click',()=>{
    if(timer!==null){stop();render();return;}
    if(motion.matches||M.progress(state).done)return;
    timer=window.setInterval(()=>{
      state=M.advance(state); const done=M.progress(state).done;
      if(done)stop(); render(done);
    },1000);render();
  });
  $('reset').addEventListener('click',()=>{stop();state=M.reset(state);render(true);});
  $('layers').addEventListener('input',()=>{stop();state=M.create(Number($('layers').value));render(true);});
  $('lang-en').addEventListener('click',()=>language('en'));
  $('lang-sr').addEventListener('click',()=>language('sr'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();render();}});
  const motionChanged=()=>{stop();render();};
  if(motion.addEventListener)motion.addEventListener('change',motionChanged);else motion.addListener(motionChanged);
  if(typeof ResizeObserver==='function')new ResizeObserver(draw).observe($('pyramid'));
  else window.addEventListener('resize',draw);
  window.addEventListener('pagehide',stop);
  document.querySelectorAll('.story a').forEach(link=>link.addEventListener('click',()=>{
    const target=document.querySelector(link.getAttribute('href'));if(target)target.open=true;
  }));
  language('en');
})();
