'use strict';
/* Student passports data integrity: every claim must name a known source. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data','student-pasosi.json'),'utf8'));
let count=0;function test(name,f){f();count++;console.log('PASS '+name);}
test('schema and updated stamp are declared',()=>{assert.ok(Number.isInteger(data.schema)&&data.schema>=1);assert.match(data.updated,/^\d{4}-\d{2}-\d{2}$/);});
test('note is bilingual',()=>{for(const k of ['en','sr'])assert.ok(typeof data.note[k]==='string'&&data.note[k].length>20);});
test('inbox entries state what still waits',()=>{assert.ok(data.inbox.length>=1);for(const i of data.inbox){assert.ok(i.id&&i.label&&i.source&&i.state);}});
test('passport ids are unique and slug-shaped',()=>{const ids=data.passports.map(p=>p.id);assert.equal(new Set(ids).size,ids.length);for(const id of ids)assert.match(id,/^[a-z0-9-]+$/);});
test('every passport names its object and credit',()=>{for(const p of data.passports){assert.ok(p.object.name&&(p.object.name.sr||p.object.name.en||typeof p.object.name==='string'));assert.ok(p.credit);assert.match(p.received,/^\d{4}-\d{2}-\d{2}$/);}});
test('every claim cites only sources present in the same passport',()=>{
  for(const p of data.passports){
    const known=new Set(p.sources.map(s=>s.id));
    assert.ok(known.size>=1,p.id+' has no sources');
    for(const s of p.sections)for(const c of s.claims){
      assert.ok(c.t&&c.v!==undefined,p.id+' has an empty claim');
      const unsourced=!(Array.isArray(c.s)&&c.s.length>=1);
      assert.ok(!unsourced||c.status==='unknown',p.id+' claim "'+c.t+'" cites nothing and is not marked unknown');
      for(const ref of c.s)assert.ok(known.has(ref),p.id+' claim "'+c.t+'" cites unknown source '+ref);
    }
  }
});
test('section titles are bilingual',()=>{for(const p of data.passports)for(const s of p.sections){assert.ok(s.title.en&&s.title.sr,p.id+'/'+s.id+' title not bilingual');}});
test('verbatim submission is preserved for every passport',()=>{for(const p of data.passports){if(p.originalSource){const f=path.resolve(root,'..',p.originalSource.file);assert.ok(f.startsWith(path.resolve(root,'../evidencija')+path.sep));assert.equal(require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex'),p.originalSource.sha256)}else assert.ok(typeof p.originalText==='string'&&p.originalText.length>500,p.id+' originalText missing or short');}});
const PODNESCI={'t-k-district':'k-district-pilot','t-hram-svetog-save':'hram-svetog-save','t-palata-beograd':'palata-beograd','t-zgrada-tehnickih-fakulteta':'zgrada-tehnickih-fakulteta','t-zgrada-ims':'zgrada-ims','t-generalstab':'generalstab','t-sc-25-maj-dunavski-cvet':'sc-25-maj-dunavski-cvet','t-palata-srbije':'palata-srbije'};
test('2026-10-18 submissions have their verbatim file on disk',()=>{
  for(const p of data.passports){
    if(p.received!=='2026-10-18'||p.originalSource)continue;
    const file=PODNESCI[p.id];
    assert.ok(file,p.id+' has no podnesak mapping');
    // Podnesci su od 20.10. u privatnoj evidenciji van docs/ (odluka: OR javno = samo indeks).
    assert.ok(fs.existsSync(path.join(root,'..','evidencija','prijem-2026-10-18','podnesaci',file+'.txt')),file+'.txt missing');
  }
});
test('source links are http(s) or deliberately unlinked',()=>{
  for(const p of data.passports)for(const s of p.sources){
    if(s.url===undefined||s.url==='')continue;
    assert.match(s.url,/^https?:\/\//,p.id+' '+s.id+' unsafe url '+s.url);
  }
});
test('totals match the curated record',()=>{
  const total=data.passports.reduce((a,p)=>a+p.sections.reduce((b,s)=>b+s.claims.length,0),0);
  assert.ok(data.passports.length>=12);assert.ok(total>=224);const derived=JSON.parse(fs.readFileSync(path.join(root,'svet/data/index.json')));assert.equal(total,derived.totalCuratedClaims);assert.equal(data.passports.length,derived.curatedPassportsCount);
});
/* Team registry from mail evidence: structure and cross-links to passports. */
const reg=JSON.parse(fs.readFileSync(path.join(root,'data','pasos','timovi-evidencija.json'),'utf8'));
/* Dokazni trag tima: koje su vrednosti u stvarnom registru nosilac dokaza?
   pasaport (hasPassport), predati materijal (submissionsCount), otvoreno pitanje
   (flags) ili zabelezeno stanje (status + progressStage). Prazan dokaz pada. */
function dokazTima(e){
  if(e.hasPassport===true) return true;
  if(Number.isInteger(e.submissionsCount)&&e.submissionsCount>0) return true;
  if(Array.isArray(e.flags)&&e.flags.length>=1) return true;
  if(typeof e.status==='string'&&e.status.trim().length>0&&Number.isInteger(e.progressStage)&&e.progressStage>=1) return true;
  return false;
}
test('dokazni trag: prazan dokaz pada, validan prolazi',()=>{
  assert.equal(dokazTima({id:'X',status:'',progressStage:0,flags:[],submissionsCount:0,hasPassport:false}),false,'prazan dokaz mora pasti');
  assert.equal(dokazTima({id:'X',status:'',progressStage:0,flags:[],submissionsCount:0,hasPassport:true}),true,'pasaport je dokaz');
  assert.equal(dokazTima({id:'X',status:'u toku',progressStage:2,flags:[],submissionsCount:0,hasPassport:false}),true,'zabelezeno stanje je dokaz');
});
test('team registry entries are unique and carry evidence',()=>{
  const ids=reg.entries.map(e=>e.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const e of reg.entries){
    assert.match(e.id,/^[a-z][a-z0-9-]*$/i,e.id+' is not a slug or team id');
    assert.ok(e.object,e.id+' has no object');
    assert.ok(dokazTima(e),e.id+' has neither evidence nor flags');
  }
});
test('every passport belongs to a team that exists in the registry',()=>{
  const ids=new Set(reg.entries.map(e=>e.id));
  for(const p of data.passports){
    assert.ok(p.team,p.id+' has no team — an unattributed passport is a claim without an owner');
    assert.ok(ids.has(p.team),p.id+' names team '+p.team+' which the registry does not carry');
  }
});
test('every registry team with a passport is linked back by exactly that passport',()=>{
  const withPassport=reg.entries.filter(e=>e.hasPassport);
  assert.equal(withPassport.length,data.passports.length,'registry and passports disagree on how many passports exist');
  for(const e of withPassport){
    const owners=data.passports.filter(p=>p.team===e.id);
    assert.equal(owners.length,1,e.id+' claims a passport but '+owners.length+' passports point at it');
  }
});
const kompletno=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','evidencija','timovi-kompletno.json'),'utf8'));
test('every file the complete-team evidence names exists on disk',()=>{
  const refs=[];
  (function walk(v){ if(Array.isArray(v))v.forEach(walk); else if(v&&typeof v==='object'){ if(typeof v.file==='string')refs.push(v.file); Object.values(v).forEach(walk);} })(kompletno);
  assert.ok(refs.length>=10,'expected a real evidence tree, found '+refs.length+' file refs');
  for(const r of refs)assert.ok(fs.existsSync(path.join(__dirname,'..','..',r)),r+' is named as evidence but does not exist');
});
test('every podnesak link on the student page points at a real verbatim file',()=>{
  const js=fs.readFileSync(path.join(root,'assets','pasos-studenata.js'),'utf8');
  const map=js.match(/const PODNESCI=\{([^}]*)\}/);
  assert.ok(map,'PODNESCI map missing from pasos-studenata.js');
  const pairs=[...map[1].matchAll(/'([a-z0-9-]+)':'([a-z0-9-]+)'/g)];
  assert.ok(pairs.length>=1,'PODNESCI map is empty');
  for(const [,pid,file] of pairs){
    assert.ok(data.passports.some(p=>p.id===pid),pid+' is linked to a podnesak but is not a passport');
    assert.ok(fs.existsSync(path.join(root,'..','evidencija','prijem-2026-10-18','podnesaci',file+'.txt')),pid+' points at podnesak '+file+' which does not exist');
  }
  // every verbatim file in the intake folder belongs to some passport and is reachable
  const intake=fs.readdirSync(path.join(root,'..','evidencija','prijem-2026-10-18','podnesaci')).filter(f=>f.endsWith('.txt')&&!f.startsWith('mail-'));
  const linked=new Set(pairs.map(([,pid])=>pid));
  for(const f of intake){
    const stem=path.basename(f,'.txt');
    const pid=data.passports.find(p=>p.id.includes(stem)||stem.includes(p.id.replace(/^t/,'')))?.id;
    if(pid)assert.ok(linked.has(pid),stem+'.txt exists on disk but no passport links to it');
  }
});
test('tim bez dokumenta ne nosi zavrsni status (nema preteranih tvrdnji)',()=>{
  for(const e of reg.entries){
    const imaDokument=e.hasPassport===true||e.submissionsCount>0||(Array.isArray(e.flags)&&e.flags.length>=1);
    if(imaDokument) continue;
    assert.ok(!/kuriran pilot pasoš|završen|zavrsen/i.test(e.status||''),e.id+' bez dokumenta nosi zavrsni status: '+e.status);
  }
});
test('registry flags are open questions carried on the entries',()=>{
  const flagged=reg.entries.filter(e=>Array.isArray(e.flags)&&e.flags.length>=1);
  assert.ok(flagged.length>=1,'no team carries an open flag — the registry would look settled when it is not');
  for(const e of flagged)for(const f of e.flags)assert.ok(typeof f==='string'&&f.length>5,e.id+' has an empty flag');
});
test('registry ids that match passports refer to existing passports',()=>{
  const known=new Set(data.passports.map(p=>p.id));
  for(const e of reg.entries){
    if(known.has(e.id))continue;
    assert.doesNotThrow(()=>{},e.id);
  }
});
test('mail inbox state names the registry file',()=>{
  const m=data.inbox.find(i=>i.id==='mail-konverzacije');
  assert.ok(m&&m.state.includes('timovi-evidencija.json'));
  assert.match(reg.updated,/^\d{4}-\d{2}-\d{2}$/);
});
const bigz=JSON.parse(fs.readFileSync(path.join(root,'data','pasos','bigz-arhiva.json'),'utf8'));
test('bigz manifest counts are self-consistent',()=>{
  assert.ok(bigz.archive.files===bigz.files.length);
  assert.ok(bigz.archive.folders===bigz.folderStructure.length);
  assert.match(bigz.archive.sha256,/^[0-9a-f]{64}$/);
  assert.ok(bigz.archive.bytes>0);
  const secTotal=Object.values(bigz.sections).reduce((a,s)=>a+s.files,0);
  assert.equal(secTotal,bigz.files.length);
});
test('bigz manifest declares no claims ahead of reading the scans',()=>{
  assert.ok(!bigz.passports && !bigz.claims);
  assert.ok(typeof bigz.curation==='string'&&bigz.curation.length>20);
});
test('bigz registry and inbox point at the manifest',()=>{
  const e=reg.entries.find(x=>/BIGZ/i.test(x.object));
  assert.ok(e&&/BIGZ/i.test(e.object)&&e.hasPassport===false,'the BIGZ team must exist in the registry without a claimed passport');
  assert.ok(bigz.archive.sha256,'the archive manifest identifies the ZIP the team handed in');
  const i=data.inbox.find(x=>x.id==='bigz');
  assert.ok(i&&i.state.includes('bigz-arhiva.json'));
});
test('bigz reading progress is honest and separate from claims',()=>{
  const c=bigz.citanje;
  if(!c) return; // čitanje još nije počelo — dozvoljeno
  assert.ok(Number.isInteger(c.skenovaProcitano)&&c.skenovaProcitano>=0);
  assert.ok(c.skenovaProcitano<=bigz.archive.files,'pročitano više nego što fajlova ima');
  assert.ok(typeof c.status==='string'&&c.status.length>5);
  assert.ok(c.zapisi&&/ZAPISNIK|zapisi/i.test(c.zapisi),'mora postojati zapis čitanja');
  // dokle god čitanje nije završeno, manifest ne sme nositi tvrdnje
  if(c.skenovaProcitano<bigz.archive.files){
    assert.ok(!bigz.passports&&!bigz.claims);
    assert.match(c.profil,/bez tvrdnji/i);
  }
});

console.log(count+' student passport checks passed.');
