const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..','..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const world=read('docs/svet/data/bigz.json');
const AtlasBigz=require('../svet/bigz.js');

test('the archive world holds every delivered scan, once',()=>{
 const plates=world.folders.reduce((n,f)=>n+f.scans.length,0);
 assert.equal(plates,world.archive.files);
 assert.equal(plates,289);
 assert.equal(new Set(world.folders.map(f=>f.id)).size,world.folders.length);
});

test('a plate is lit only where a reading exists',()=>{
 const m=AtlasBigz.model(world,{night:false});
 const lit=m.elements.filter(e=>e.role==='plateRead').length;
 const dark=m.elements.filter(e=>e.role==='plate').length;
 assert.equal(lit,world.readings.length);
 assert.equal(lit+dark,world.archive.files);
 assert.equal(world.folders.reduce((n,f)=>n+f.read,0),world.readings.length);
});

test('reading counts never claim more than was read',()=>{
 assert.equal(world.totals.readHere,world.readings.length);
 assert.equal(world.totals.read,world.totals.readHere+world.totals.readEarlier);
 assert(world.totals.read<=world.totals.files,'the archive claims more scans than it holds');
 for(const r of world.readings){assert(r.text.length>40);assert(r.legibility);assert(r.confidence);
  assert(world.folders.some(f=>f.path===r.folder),r.id+' points at a real folder')}
});

test('the only metric dimension is the one printed on the lift sheet',()=>{
 assert.equal(world.lift.hoistMetres,40.84);
 assert.equal(world.lift.stops,10);
 const m=AtlasBigz.model(world,{night:false});
 const shaft=m.elements.filter(e=>e.role==='shaft');
 assert(shaft.length>0);
 for(const s of shaft)assert.equal(s.h,world.lift.hoistMetres);
 assert.equal(Math.round(m.bounds.max[1]*100)/100,world.lift.hoistMetres+0.18);
});

test('man-day columns repeat the payroll totals exactly',()=>{
 for(const p of world.labour){
  assert.equal(p.trades.reduce((n,t)=>n+t.days,0),p.total);
  assert.equal(p.qualified+p.common,p.total);
 }
});

test('every chronology post comes from a date written on a read scan',()=>{
 for(const e of world.chronology){
  const r=world.readings.find(r=>r.id===e.reading);
  assert(r,e.id+' has a reading');
  assert(r.facts.some(f=>f.value===e.raw));
  assert(/^\d{4}-\d{2}(-\d{2})?$/.test(e.from),e.from);
 }
 assert(world.chronology.every((e,i,a)=>!i||a[i-1].from<=e.from),'sorted');
});

test('the layout keeps its places when a folder is added',()=>{
 const before=AtlasBigz.model(world,{night:false});
 const grown=JSON.parse(JSON.stringify(world));
 grown.folders.push({id:'bigz:f:nova-fascikla',path:'Nova fascikla',name:'Nova fascikla',parent:null,depth:0,
  files:3,mb:1.1,scans:[{name:'a.jpg',bytes:1},{name:'b.jpg',bytes:1},{name:'c.jpg',bytes:1}],read:0});
 const after=AtlasBigz.model(grown,{night:false});
 const posOf=m=>new Map(m.folders.map(f=>[f.id,f.pos.join(',')]));
 const a=posOf(before),b=posOf(after);
 for(const [id,p] of a)assert.equal(b.get(id),p,id+' moved when a folder was added');
 assert(b.has('bigz:f:nova-fascikla'));
 assert.equal(after.elements.length,before.elements.length+4);
});

test('no scan filename or private path reaches the public world file',()=>{
 const text=JSON.stringify(world);
 assert(!/bigz-review/.test(text));
 assert(!/C:\\\\|Downloads/.test(text));
 assert(/van repoa/.test(world.archive.custody));
});

test('rebuilding the archive world changes nothing',()=>{
 const before=fs.readFileSync(path.join(root,'docs/svet/data/bigz.json'),'utf8');
 cp.execFileSync(process.execPath,['tools/bigz-build.cjs'],{cwd:root,stdio:'pipe'});
 assert.equal(fs.readFileSync(path.join(root,'docs/svet/data/bigz.json'),'utf8'),before);
});

/* Koliko je pročitano govorilo se na dva mesta iz dva izvora i razišlo se:
   svet arhiva je brojao zapise u dnevniku (70), a dosije tima je čitao ručno
   polje u popisu arhive (41). Sajt je o istoj stvari govorio dvoje. Jedan broj,
   jedan izvor, i test koji to drži. */
test('read count is one number everywhere, taken from the reading log',()=>{
 const log=read('evidencija/prijem-2026-10-18/bigz-citanje.json');
 const arhiva=read('docs/data/pasos/bigz-arhiva.json');
 const atlas=read('docs/svet/data/atlas.json');
 const scans=log.readings.length+(log.earlier?.scans||0);
 assert.equal(world.totals.read,scans,'archive world disagrees with the reading log');
 assert.equal(arhiva.citanje.skenovaProcitano,scans,'bigz-arhiva.json disagrees with the reading log');
 assert.equal(arhiva.citanje.odUkupno,arhiva.archive.files);
 const a=atlas.archives.find(a=>a.files===arhiva.archive.files);
 assert.equal(a.read.scans,scans,'team dossier disagrees with the reading log');
 assert.equal(a.read.total,arhiva.archive.files);
 assert(scans<=world.archive.files,'more scans read than the archive holds');
});

/* U arhiv se ulazi kroz atlas. Dugmeta svetova iznad scene više nema — ono je
   guralo traku alata preko zaglavlja — pa ulaz mora postojati negde drugde,
   inače je ceo prostor nedostupan. */
test('the archive is entered through the atlas, not through a world switch',()=>{
 const page=fs.readFileSync(path.join(root,'docs/svet/index.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'docs/svet/atlas.js'),'utf8');
 assert(!/data-world=/.test(page),'a world switch button is back in the tool strip');
 assert(/id="archive-gate"/.test(page)&&/id="enter-archive"/.test(page),'the archive gate is missing');
 assert(/id="archive-exit"/.test(page),'there is no way back to the atlas');
 assert(/enterArchive\(\)/.test(js)&&/leaveArchive\(/.test(js));
 const css=fs.readFileSync(path.join(root,'docs/svet/world.css'),'utf8');
 // granica se vise ne zakucava u piksele nego se meri: atlas.js upisuje --head-rail
 // (stvarnu sirinu zaglavlja), a traka alata staje tacno iza nje.
 assert(/\.immersive \.scene-tools[^{]*\{[^}]*max-width:calc\(100vw - var\(--head-rail[^)]*\)\)/.test(css),
  'the tool strip has no left boundary, so it can still run under the header');
 assert(/--head-rail/.test(js),'nobody measures the header, so --head-rail stays at its fallback');
});


/* The era dam: every dated structure carries its date, the axis spans the data,
   and the page actually wires the slider. */
test('the era dam has dates to stand on and a slider to pull',()=>{
 const m=AtlasBigz.model(world,{night:false});
 const posts=m.elements.filter(e=>e.role==='post');
 const platesT=m.elements.filter(e=>e.role==='timePlate');
 assert.equal(posts.length,world.chronology.length);
 assert(posts.every(e=>/^\d{4}(-\d{2}){0,2}$/.test(e.when)),'a chronology post lost its date');
 assert(platesT.every(e=>/^\d{4}(-\d{2}){0,2}$/.test(e.when)));
 // the axis is read off the data: the earliest and latest date sit at the two
 // ends, so dates outside the old fixed 1937-1947 span no longer pile up
 const ts=world.chronology.map(e=>Date.parse(e.from));
 const first=posts[ts.indexOf(Math.min(...ts))],last=posts[ts.indexOf(Math.max(...ts))];
 assert(first.x<last.x,'the axis is not ordered by date');
 const xs=new Set(posts.map(p=>Math.round(p.x*10)));
 assert(xs.size>world.chronology.length*0.5,'dates pile up on the axis ends');
 // dated readings light dated plates; undated ones stay undated, never hidden
 const lit=m.elements.filter(e=>e.role==='plateRead');
 const dated=world.readings.filter(r=>r.date).length;
 assert.equal(lit.filter(e=>e.when).length,dated);
 // labour decks carry the payroll period start
 for(const d of m.elements.filter(e=>e.role==='deck'))
  assert(/^\d{4}(-\d{2}){0,2}$/.test(d.when),'a payroll deck lost its period');
 // and the page wires it all: slider markup, state, URL round-trip, renderer key
 const page=fs.readFileSync(path.join(root,'docs/svet/index.html'),'utf8');
 assert(/id="era-bar"/.test(page)&&/id="era"[^>]*type="range"/.test(page),'the era slider is missing');
 const js=fs.readFileSync(path.join(root,'docs/svet/atlas.js'),'utf8');
 assert(/era:''/.test(js)&&/p\.set\('era'/.test(js)&&/eraSetup/.test(js),'atlas.js does not carry era state');
 const r=fs.readFileSync(path.join(root,'docs/svet/renderer.js'),'utf8');
 assert(/o\.era\|\|''/.test(r),'era is not part of the geometry key, so the slider would not rebuild');
 assert(/#era-bar/.test(r),'the 3D scene still captures the pointer over the slider');
});
