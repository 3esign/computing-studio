/* The map layout is a published claim about legibility, so it is measured here
   rather than eyeballed: nothing overlaps, nothing moved further than declared,
   the transform keeps bearings and order, and the result is reproducible. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const L=require(path.join(root,'docs/svet/layout.js')),A=require(path.join(root,'docs/svet/architecture.js'));
const d=read('docs/svet/data/atlas.json'),layout=d.layout,models=A.compile(d);

test('the published layout exists, is versioned and covers exactly the placed buildings',()=>{
 assert.equal(layout.version,L.VERSION);
 const placed=d.buildings.filter(b=>b.locationStatus!=='unmapped'&&b.lat!==null&&b.lng!==null);
 assert.equal(layout.places.length,placed.length);
 assert.equal(new Set(layout.places.map(p=>p.id)).size,layout.places.length);
 for(const b of placed)assert(layout.places.some(p=>p.id===b.id),b.object);
 for(const b of d.buildings)if(b.locationStatus==='unmapped')assert(!layout.places.some(p=>p.id===b.id),b.object);
 // Every mapped team can be positioned: the renderer looks the layout up by building.
 for(const t of d.teams)if(t.locationStatus!=='unmapped')assert(layout.places.some(p=>p.id===t.building),t.id);
});

test('no two sculptures touch, and the distance is the real footprint',()=>{
 assert.equal(layout.metrics.overlaps,0);
 const byTeam=new Map(models.map(m=>[m.id,m]));
 for(const place of layout.places){const b=d.buildings.find(b=>b.id===place.id);
  const r=L.radius(b.teams.map(id=>byTeam.get(id)).filter(Boolean),A);
  assert(Math.abs(r-place.radius)<1e-3,b.object+' radius '+r+' vs published '+place.radius)}
 for(let i=0;i<layout.places.length;i++)for(let j=i+1;j<layout.places.length;j++){
  const a=layout.places[i],b=layout.places[j],gap=Math.hypot(a.x-b.x,a.z-b.z)-a.radius-b.radius;
  assert(gap>=0,a.id+' and '+b.id+' overlap by '+(-gap).toFixed(2))}
 assert(layout.metrics.minGap>0);
});

test('no sculpture moves further from its registry point than the layout declares',()=>{
 const cap=layout.capUnits*layout.metresPerUnit;
 for(const p of layout.places){
  const moved=Math.hypot(p.x-p.anchor[0],p.z-p.anchor[1])*layout.metresPerUnit;
  assert(moved<=cap+1,p.id+' moved '+moved.toFixed(0)+' m, cap '+cap);
  assert(Math.abs(moved-p.nudge)<1.5,p.id+' publishes '+p.nudge+' m but moved '+moved.toFixed(0));
 }
 assert.equal(layout.metrics.maxNudgeMetres,Math.max(...layout.places.map(p=>p.nudge)));
 assert(layout.note.includes(String(Math.round(cap))),'the note must say the cap in metres');
 assert(layout.note.includes(String(layout.core*layout.metresPerUnit)),'the note must say the untouched core');
});

test('the anchor of every place is the declared transform of its registry point',()=>{
 for(const place of layout.places){const b=d.buildings.find(b=>b.id===place.id),p=L.place(b.lng,b.lat);
  assert(Math.abs(p[0]-place.anchor[0])<1e-3&&Math.abs(p[2]-place.anchor[1])<1e-3,b.object)}
});

test('the radial cartogram keeps the core, the order of distances and every bearing',()=>{
 const c=L.project(L.CENTRE.lng,L.CENTRE.lat);
 const probes=[0,.2,.5,.9,1,1.5,2,4,8].map(f=>[c[0]+L.CORE*f,0,c[2]]);
 for(const p of probes.slice(0,5)){const w=L.warp(p);assert.deepEqual([w[0],w[2]],[p[0],p[2]],'inside the core nothing moves')}
 let last=-1;
 for(const p of probes){const w=L.warp(p),d0=Math.hypot(p[0]-c[0],p[2]-c[2]),d1=Math.hypot(w[0]-c[0],w[2]-c[2]);
  assert(d1>last,'the transform must stay monotone in distance');last=d1;
  assert(d1<=d0+1e-9,'the transform never pushes outward');
  if(d0>1e-9)assert(Math.abs(Math.atan2(p[2]-c[2],p[0]-c[0])-Math.atan2(w[2]-c[2],w[0]-c[0]))<1e-12,'bearing must be exact')}
 // Order between two real objects never changes, so the map cannot lie about which is further out.
 const sorted=layout.places.map(p=>({id:p.id,raw:Math.hypot(p.anchor[0]-c[0],p.anchor[1]-c[2])}));
 const b=new Map(d.buildings.map(x=>[x.id,x]));
 for(const p of sorted){const q=b.get(p.id),raw=L.project(q.lng,q.lat);p.plain=Math.hypot(raw[0]-c[0],raw[2]-c[2])}
 const byPlain=[...sorted].sort((a,b)=>a.plain-b.plain).map(p=>p.id),byWarp=[...sorted].sort((a,b)=>a.raw-b.raw).map(p=>p.id);
 assert.deepEqual(byWarp,byPlain);
});

test('the layout is reproducible and strictly better than the plain projection',()=>{
 const again=L.compile({buildings:d.buildings,models,architecture:A});
 assert.deepEqual(again.places,layout.places);
 assert.deepEqual(again.metrics,layout.metrics);
 const plain=layout.places.map(p=>{const b=d.buildings.find(b=>b.id===p.id),raw=L.project(b.lng,b.lat);return {...p,x:raw[0],z:raw[2]}});
 const before=L.metrics(plain);
 assert(before.overlaps>0,'the fault this layout fixes must still be reproducible');
 assert(layout.metrics.fill>before.fill,'the occupied hull must be better used than before');
 assert(layout.metrics.maxGap<before.maxGap,'the loneliest object must gain neighbours');
});

/* The layout pulls colliding sculptures apart, which is exactly how a bad
   coordinate could disappear from view. Two objects pinned to one registry
   point are a registry fault, not a drawing one, so each side must carry it as
   an open question and the map must not be allowed to swallow it. */
test('two objects on one registry point stay open questions in the registry',()=>{
 const reg=read('docs/data/pasos/timovi-evidencija.json'),flagged=new Set(reg.entries.filter(e=>(e.flags||[]).some(f=>/upisan[au] ta[čc]k/i.test(f))).map(e=>e.id));
 const placed=d.buildings.filter(b=>b.lat!==null&&b.lng!==null&&b.locationStatus!=='unmapped'),same=[];
 for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++)
  if(placed[i].lat===placed[j].lat&&placed[i].lng===placed[j].lng)same.push([placed[i],placed[j]]);
 for(const [a,b] of same)for(const t of a.teams.concat(b.teams))
  assert(flagged.has(t),t+' shares a registry point ('+a.object+' / '+b.object+') with no flag saying so');
 // The three known collisions must still be the ones the registry declares.
 assert.equal(same.length,3,'a new or resolved collision changes what the registry must declare: '+same.map(p=>p[0].object+' / '+p[1].object).join('; '));
 assert.equal(flagged.size,6);
});
