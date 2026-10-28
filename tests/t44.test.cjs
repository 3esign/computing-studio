const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p)));
/* T44 stoji na dokumentovanom objektu: Kula Beograd (prijem 2026-10-27, PDF
   „Dve kule Beograd" + mejl). Raniji zapisi su lutali (ATŠ, pa pogrešno spajanje
   sa Domom Svetog Save) — Dom se ne sme vratiti, a istorija promene ostaje u flagu.
   Na Kuli Beograd su četiri tima: objekat mora da ostane jedna deljena zgrada. */
test('T44 stoji na Kuli Beograd po dokumentovanom prijemu, Dom se ne vraća',()=>{
 const d=read('svet/data/atlas.json'),r=read('data/pasos/timovi-evidencija.json'),t=d.teams.find(t=>t.id==='T44');
 const e=r.entries.find(e=>e.id==='T44');
 assert.equal(t.object,'Kula Beograd');
 assert.equal(t.object,e.object);
 assert(!/Dom Svetog Save/.test(t.object));
 assert(!/Dom Svetog Save/.test(e.location||''));
 assert.equal(t.city,'Beograd');
 assert(typeof t.lat==='number'&&typeof t.lng==='number');
 const t28=d.teams.find(x=>x.id==='T28');
 assert.equal(t.building,t28.building,'T44 deli zgradu Kula Beograd sa T28/T67');
 assert(e.flags.some(f=>/ATŠ/.test(f)),'istorija promene objekta ostaje zabeležena');
 assert(e.flags.some(f=>/prijem-2026-10-27/.test(f)),'flag pokazuje na dokaz prijema');
 const kula=d.buildings.find(b=>b.object==='Kula Beograd');
 assert(kula.teams.includes('T44')&&kula.teams.includes('T28')&&kula.teams.includes('T67'));
 const total=read('data/student-pasosi.json').passports.reduce((n,p)=>n+p.sections.reduce((n,s)=>n+s.claims.length,0),0);
 assert.equal(d.claims.length,total);
 assert(total>=224);
});
