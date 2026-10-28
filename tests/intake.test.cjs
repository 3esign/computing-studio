const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{mergePackage,hash,publicMedia}=require('../../tools/intake-core.cjs');
const registry={entries:[{id:'T01',object:'Synthetic test building',indices:['1/26']}]},main={passports:[]};
const pkg=()=>({schema:1,id:'test-001',team:'T01',source:{locator:'synthetic-test',sha256:'a'.repeat(64),receivedAt:'2026-10-21T12:00:00Z'},sources:[{id:'S1',label:'Synthetic source',url:'https://example.org'}],sections:[{id:'geometry',title:{sr:'Test',en:'Test'},claims:[{id:'T01:geometry:height',t:'Height',v:'Unknown',s:['S1'],status:'unknown',category:'geometry',unit:'m',locator:'p. 4'}]}]});
test('repeated intake is idempotent and exact previous content survives a correction',()=>{const a=mergePackage(main,registry,pkg()),b=mergePackage(a.main,registry,pkg(),a.ledger);assert.equal(b.duplicate,true);assert.deepEqual(a.main,b.main);const changed=pkg();changed.id='test-002';changed.sections[0].claims[0].v='3 m';assert.throws(()=>mergePackage(a.main,registry,changed,a.ledger),/Conflicting/);changed.replaces={'T01:geometry:height':hash(a.main.passports[0].sections[0].claims[0])};const c=mergePackage(a.main,registry,changed,a.ledger);assert.equal(c.ledger.receipts[1].before.sections[0].claims[0].v,'Unknown');assert.equal(c.main.passports[0].sections[0].claims[0].v,'3 m');assert.equal(c.main.passports.length,1)});
test('unknown team, dangling sources, private fields and reused package IDs fail closed',()=>{for(const mutate of [p=>p.team='T99',p=>p.sections[0].claims[0].s=['missing'],p=>p.sections[0].claims[0].originalText='private',p=>p.sources[0].url='javascript:alert(1)']){const p=pkg();mutate(p);assert.throws(()=>mergePackage(main,registry,p));assert.equal(main.passports.length,0)}const a=mergePackage(main,registry,pkg()),p=pkg();p.sections[0].claims[0].v='changed';assert.throws(()=>mergePackage(a.main,registry,p,a.ledger),/reused/)});
test('public media requires reviewed permission, exact bytes and a contained file',()=>{const base=process.env.OR_TEST_ROOT||path.resolve(__dirname,'../../dokazi/.intake-test');fs.mkdirSync(base,{recursive:true});const root=fs.mkdtempSync(path.join(base,'case-'));try{fs.mkdirSync(path.join(root,'docs/media'),{recursive:true});const file=path.join(root,'docs/media/test.png');fs.writeFileSync(file,'synthetic fixture');const p=mergePackage(main,registry,pkg()).main.passports[0],m={id:'M1',href:'media/test.png',sha256:hash('synthetic fixture'),caption:'Synthetic',alt:'Synthetic',credit:'Test',license:'CC0',sourceIds:['S1'],permission:{status:'approved',contentReviewed:true,metadataReviewed:true,reference:'synthetic-test',reviewedAt:'2026-10-21'}};p.media=[m];assert.equal(publicMedia(root,p)[0].team,'T01');assert(!JSON.stringify(publicMedia(root,p)).includes('permission'));for(const value of ['pending','unknown']){m.permission.status=value;assert.throws(()=>publicMedia(root,p),/Unreviewed/)}m.permission.status='approved';m.sha256='0'.repeat(64);assert.throws(()=>publicMedia(root,p),/hash mismatch/);m.href='media/../../private.png';assert.throws(()=>publicMedia(root,p),/Invalid public media/)}finally{fs.rmSync(root,{recursive:true,force:true})}});
test('generated team dossiers contain every claim and retain navigable source anchors without JS',()=>{const root=path.resolve(__dirname,'../..'),data=JSON.parse(fs.readFileSync(path.join(root,'docs/svet/data/atlas.json')));for(const t of data.teams){const html=fs.readFileSync(path.join(root,'docs/timovi',t.id+'.html'),'utf8');for(const c of data.claims.filter(c=>c.team===t.id))assert(html.includes('id="'+c.id+'"'));for(const s of data.sources.filter(s=>s.team===t.id))assert(html.includes('id="source-'+s.id+'"'))}});

/* The documented contract in PRIJEM.md must be the one the tools enforce:
   a skeleton from tools/novi-paket.cjs, filled in by a curator, merges cleanly. */
test('the documented skeleton becomes a valid package once a curator fills it in',()=>{
 const repo=path.resolve(__dirname,'../..'),cp=require('node:child_process');
 const out=cp.execFileSync(process.execPath,['tools/novi-paket.cjs','T01','evidencija/SISTEM-OBRADE-I-STRUKTURA-SAJTA.md'],{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','ignore']});
 const skeleton=JSON.parse(out);
 assert.equal(skeleton.schema,1);assert.equal(skeleton.team,'T01');assert.match(skeleton.source.sha256,/^[a-f0-9]{64}$/);
 const section=skeleton.sections[0];
 assert(skeleton.sections[0].claims[0].id.startsWith('T01:'+section.id+':'),'claim ID carries team and section');
 section.title={sr:'Provera ugovora',en:'Contract check'};
 skeleton.sources[0].label='Interni dokument sistema';skeleton.sources[0].url='https://example.org/prijem';
 section.claims[0].id='T01:'+section.id+':ugovor';section.claims[0].t='Provera';section.claims[0].v='Vrednost';
 const registry=JSON.parse(fs.readFileSync(path.join(repo,'docs/data/pasos/timovi-evidencija.json'),'utf8'));
 const merged=mergePackage({passports:[]},registry,skeleton);
 assert.equal(merged.duplicate,false);
 assert.equal(merged.main.passports[0].team,'T01');
 assert.equal(merged.main.passports[0].sections[0].claims[0].id,'T01:'+section.id+':ugovor');
 assert.equal(merged.ledger.receipts.length,1);
});
