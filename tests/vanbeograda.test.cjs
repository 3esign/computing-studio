const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..','..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
/* Vanbeogradski registar je podatak, ne kod: proverava se da je složan sa registrom
   timova i kartom, i da novi-tim.cjs odbija sve što ne sme da upiše sam od sebe. */
const outside=read('docs/data/pasos/van-beograda.json'),registry=read('docs/data/pasos/timovi-evidencija.json'),map=read('docs/svet/data/belgrade-map.json');

test('the outside-Belgrade registry is consistent with teams and map',()=>{
 assert.equal(outside.schema,1);
 assert.equal(new Set(outside.entries.map(e=>e.id)).size,outside.entries.length,'duplicate team in van-beograda.json');
 for(const e of outside.entries){
  const r=registry.entries.find(t=>t.id===e.id),m=map.teams.find(t=>t.id===e.id);
  assert(r,'van-beograda tim '+e.id+' ne postoji u registru');
  assert(m,'van-beograda tim '+e.id+' ne postoji na karti');
  assert(r.location.includes(e.city),'registar za '+e.id+' kaže "'+r.location+'", grad je '+e.city);
  assert.equal(m.city,e.city);
  assert.equal(m.locationStatus,'unmapped','tim '+e.id+' iz '+e.city+' mora ostati unmapped');
  assert(Number.isFinite(e.lat)&&Number.isFinite(e.lng),'koordinate '+e.id+' nisu konačne');
  assert(e.city!=='Beograd');
 }
 assert.equal(outside.entries.length,map.teams.filter(t=>t.city&&t.city!=='Beograd').length,
  'broj vanbeogradskih timova na karti i u registru van-beograda.json se razlikuje');
});

test('a city shared by two teams carries one coordinate pair',()=>{
 const byCity={};for(const e of outside.entries){const k=e.city+'|'+e.lat+','+e.lng;byCity[k]=(byCity[k]||0)+1}
 for(const [k,n] of Object.entries(byCity)){const [city]=k.split('|');
  assert.equal(n,outside.entries.filter(e=>e.city===city).length,'city '+city+' has more than one coordinate pair')}
});

test('novi-tim.cjs refuses what it must not write',()=>{
 /* Vraća izlazni kod: 0 kad alat uspe. Sve probne stavke moraju pasti pre upisa —
    inače bi test pisao po stvarnom registru (lekcija iz prve verzije ovog testa). */
 const run=args=>{try{cp.execFileSync(process.execPath,[path.join(root,'tools','novi-tim.cjs'),...args],{stdio:'pipe'});return 0}
  catch(e){assert(e.status,'alat je pao bez izlaznog koda: '+(e.stderr||''));return e.status}};
 const existing=registry.entries[0].id;
 const cases=[
  [[],[],'no arguments'],
  [['T99','--objekat','X','--indeksi','101/2026','--tema','t'],[' nonzero '],'Belgrade team without --lat/--lng'],
  [[existing,'--objekat','X','--indeksi','101/2026','--tema','t','--lat','44.82','--lng','20.46'],[' nonzero '],'team already in the registry'],
  [['T99','--objekat','X','--indeksi','101/2026','--tema','t','--van-beograda','Novi Grad'],[' nonzero '],'new city without --grad-lat/--grad-lng'],
  [['T99','--objekat','X','--indeksi','abc','--tema','t','--van-beograda','Subotica'],[' nonzero '],'malformed indices'],
  [['T99','--objekat','X','--indeksi','101/2026','--tema','t','--lat','45.9','--lng','20.4'],[' nonzero '],'coordinates outside Belgrade without --van-beograda'],
 ];
 for(const [args,,label] of cases){
  const got=run(args);
  assert.notEqual(got,0,label+' must fail');
 }
 // ništa nije upisano: brojevi i dalje stoje
 assert.equal(registry.entries.length,registry.entries.filter(t=>map.teams.some(m=>m.id===t.id)).length);
 assert(!map.teams.some(t=>t.id==='T99'),'test je upisao T99 u stvarnu kartu');
 assert(!outside.entries.some(e=>e.id==='T99'),'test je upisao T99 u van-beograda.json');
});
