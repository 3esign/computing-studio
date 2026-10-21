/* Public-tree release checks; runs in docs locally and at the public repository root. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),root=__dirname;
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const d=read('svet/data/atlas.json'),manifest=read('svet/data/revisions/index.json');
assert.equal(new Set(d.teams.map(t=>t.id)).size,d.teams.length);assert.equal(new Set(d.claims.map(c=>c.id)).size,d.claims.length);
for(const p of ['svet/data/pasosi.json','svet/data/index.json','data/pasos/timovi-evidencija.json'])assert.equal(read(p).datasetRevision,d.datasetRevision,p);
assert(manifest.revisions.some(r=>r.id===d.datasetRevision));assert.deepEqual(read('svet/data/revisions/'+d.datasetRevision+'.json'),d);
for(const c of d.claims){assert(d.teams.some(t=>t.id===c.team));assert(d.sections.some(s=>s.id===c.section));for(const id of c.sourceIds)assert(d.sources.some(s=>s.id===id))}
for(const m of d.media){assert(/^media\/[a-zA-Z0-9/_-]+\.(jpe?g|png|webp|pdf)$/.test(m.href));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,m.href))).digest('hex'),m.sha256);assert(d.teams.some(t=>t.id===m.team))}
for(const t of d.teams)assert(fs.existsSync(path.join(root,'timovi',t.id+'.html')));
const expected=['index.html#atlas','timovi.html','izvori.html','biblioteka.html','ideje.html'];for(const page of ['index.html','timovi.html','izvori.html','biblioteka.html','ideje.html','program.html','sledeci.html']){const html=fs.readFileSync(path.join(root,page),'utf8'),nav=html.match(/<header[\s\S]*?<nav[^>]*>([\s\S]*?)<\/nav>/)[1];assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),expected)}
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(home.indexOf('id="atlas"')<home.indexOf('class="home-intro"'));
console.log(JSON.stringify({ok:true,teams:d.teams.length,claims:d.claims.length,media:d.media.length,revision:d.datasetRevision}));
