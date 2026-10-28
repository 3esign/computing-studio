const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const model=require('../svet/architecture.js'),data=JSON.parse(fs.readFileSync(path.join(__dirname,'../svet/data/atlas.json')));
test('each real record and source owns one selectable architectural element',()=>{
 const buildings=model.compile(data),elements=buildings.flatMap(b=>b.elements);
 assert.equal(elements.filter(e=>e.role==='record').length,data.claims.length);
 assert.equal(elements.filter(e=>e.role==='source').length,data.sources.length);
 for(const c of data.claims){const panels=elements.filter(e=>e.role==='record'&&e.id===c.id);assert.equal(panels.length,1);assert.deepEqual(panels[0].sourceIds,c.sourceIds);assert.equal(panels[0].team,c.team)}
 for(const t of data.teams.filter(t=>!t.claimsCount&&!(data.archives||[]).some(a=>a.team===t.id))){const b=buildings.find(b=>b.id===t.id);assert.equal(b.records,0);assert(b.elements.every(e=>e.role==='empty'));assert.equal(b.height,.7)}
});
/* A delivered archive is the one case where a team without curated claims still
   has mass: the tower measures the submission itself, never the building. */
test('archive crates count scans without inventing per-scan reading status',()=>{
 const models=model.compile(data);assert(data.archives.length>=1);
 for(const a of data.archives){const m=models.find(m=>m.id===a.team);assert(m,'archive team '+a.team+' missing');
  const crates=m.elements.filter(e=>e.role==='archiveCrate'),tiers=m.elements.filter(e=>e.role==='archiveTier');
  assert.equal(crates.length,a.files);
  assert.equal(tiers.length,a.sections.length);
  assert.equal(new Set(crates.map(e=>e.id)).size,crates.length);
  assert(crates.every(e=>e.read===null));
  assert(tiers.every(e=>e.read===null));
  const gauge=m.elements.find(e=>e.role==='archiveProgress'),spine=m.elements.find(e=>e.role==='archiveSpine');
  assert.equal(gauge.read,a.read.scans);assert(Math.abs(gauge.h/spine.h-a.read.scans/a.files)<1e-10);
  assert(a.read.scans<=a.read.total&&a.read.total===a.files);
  for(const s of a.sections)assert.equal(crates.filter(e=>e.tier===s.name).length,s.files);
  // Thicker tier = more megabytes, never more certainty.
  const biggest=[...a.sections].sort((x,y)=>y.mb-x.mb)[0],thick=tiers.find(e=>e.tier===biggest.name);
  assert(tiers.every(e=>thick.y<=e.y||crates.find(c=>c.tier===thick.tier).h>=crates.find(c=>c.tier===e.tier).h));
  // Crates stay one contiguous run so the renderer can drop them as one detail level.
  const idx=m.elements.map((e,i)=>e.role==='archiveCrate'?i:-1).filter(i=>i>=0);
  assert.equal(idx[idx.length-1]-idx[0],idx.length-1);
  assert.equal(m.records,data.claims.filter(c=>c.team===a.team).length);
  assert(m.height>3);
 }
});
/* One object, several owners: the structure is combined, the parts stay separated,
   named and coloured per team. */
test('every team inside a shared object owns a named, coloured part',()=>{
 const models=model.compile(data);
 for(const g of model.buildings(data).filter(g=>g.teams.length>1)){
  const lead=models.find(m=>m.building===g.id&&m.shared.length);assert(lead);
  for(const role of ['terrace','pylon','bridge']){
   const parts=lead.shared.filter(e=>e.role===role);
   assert.equal(parts.length,g.teams.length,role+' per team in '+g.id);
   assert.deepEqual([...new Set(parts.map(e=>e.team))].sort(),[...g.teams].sort());
   assert.deepEqual([...new Set(parts.map(e=>e.slot))].sort((a,b)=>a-b),g.teams.map((_,i)=>i));
  }
  // The pylon is that team's own record count; the mast is the sum of all of them.
  for(const t of g.teams){const own=models.find(m=>m.id===t),pylon=lead.shared.find(e=>e.role==='pylon'&&e.team===t);
   assert.equal(pylon.records,own.records);
   const terrace=lead.shared.find(e=>e.role==='terrace'&&e.team===t);
   // A terrace never reaches wider than the wing standing on it: neighbours stay uncovered.
   assert(terrace.w<=Math.max(2.2,model.footprint(own)*2)+1e-9);
   assert.deepEqual([terrace.x,terrace.z],[own.wingOffset[0],own.wingOffset[1]]);
  }
  assert.equal(lead.buildingRecords,g.teams.reduce((n,t)=>n+models.find(m=>m.id===t).records,0));
  // Hues are distinct inside one object and stable for a given slot.
  const hues=g.teams.map((_,i)=>model.tintCss(i,g.teams.length,false));
  assert.equal(new Set(hues).size,g.teams.length);
  assert.equal(model.tintCss(0,g.teams.length,false),hues[0]);
 }
});
test('growth, reordering and removal retain existing geometry slots',()=>{
 const before=model.compile(data),next=structuredClone(data),base=next.claims[0];
 next.claims.reverse();next.sections.reverse();next.sources.reverse();
 for(let i=0;i<12;i++)next.claims.push({...base,id:base.team+':added:'+i});
 next.architecture.slots=model.allocate(next,data.architecture.slots);
 const after=model.compile(next),oldPanels=before.flatMap(b=>b.elements.filter(e=>e.role==='record')),newPanels=after.flatMap(b=>b.elements.filter(e=>e.role==='record'));
 for(const p of oldPanels)assert.deepEqual(newPanels.find(n=>n.id===p.id),p);
 assert(after.find(b=>b.id===base.team).height>before.find(b=>b.id===base.team).height);
 next.claims=next.claims.filter(c=>c.id!==base.id);const removedSlots=model.allocate(next,next.architecture.slots);next.claims.push({...base,id:'replacement'});const restored=model.allocate(next,removedSlots);
 assert.notEqual(restored.find(s=>s.id==='replacement').slot,restored.find(s=>s.id===base.id).slot);
});
test('unknown statements open the facade and all geometry remains finite',()=>{
 const next=structuredClone(data);next.claims[0].status='unknown';const out=model.compile(next);
 assert(out.flatMap(b=>b.elements).find(e=>e.role==='record'&&e.id===next.claims[0].id).opening);
 for(const b of out){assert(Number.isFinite(b.height));for(const e of b.elements)for(const key of ['x','y','z','w','h','d'])assert(Number.isFinite(e[key]))}
});
test('older recorded revisions remain renderable without a layout registry',()=>{
 const old=structuredClone(data);delete old.architecture;
 assert.equal(model.compile(old).reduce((n,b)=>n+b.records,0),data.claims.length);
});

test('one object researched by several teams becomes one structure',()=>{
 const groups=model.buildings(data),models=model.compile(data);
 assert.equal(groups.reduce((n,g)=>n+g.teams.length,0),data.teams.length);
 assert.deepEqual(groups.map(g=>g.id).sort(),[...new Set(groups.map(g=>g.id))].sort());
 for(const g of groups){
  const members=g.teams.map(id=>models.find(m=>m.id===id));
  for(const m of members){assert.equal(m.building,g.id);assert.deepEqual(m.buildingTeams,g.teams)}
  if(g.teams.length<2){assert.deepEqual(members[0].wingOffset,[0,0]);assert.equal(members[0].shared.length,0);continue}
  // Exactly one lead carries the shared plinth, spokes and mast for the object.
  assert.equal(members.filter(m=>m.shared.length).length,1);
  const lead=members.find(m=>m.shared.length),roles=lead.shared.map(e=>e.role);
  assert.equal(roles.filter(r=>r==='plinth').length,1);
  assert.equal(roles.filter(r=>r==='mast').length,1);
  assert.equal(roles.filter(r=>r==='bridge').length,g.teams.length);
  assert.equal(lead.buildingRecords,data.claims.filter(c=>g.teams.includes(c.team)).length);
  assert(lead.buildingHeight>members.reduce((h,m)=>Math.max(h,m.height),0)||lead.buildingRecords===0);
  for(const e of lead.shared){assert.equal(e.building,g.id);for(const key of ['x','y','z','w','h','d'])assert(Number.isFinite(e[key]))}
  // No two wings may intersect, measured on their own real footprints.
  const offsets=members.map(m=>m.wingOffset),radii=members.map(m=>model.footprint(m));
  assert.equal(new Set(offsets.map(o=>o.map(v=>v.toFixed(3)).join('/'))).size,g.teams.length);
  for(let i=0;i<offsets.length;i++)for(let j=i+1;j<offsets.length;j++)
   assert(Math.hypot(offsets[i][0]-offsets[j][0],offsets[i][1]-offsets[j][1])>radii[i]+radii[j],g.id+' '+i+'/'+j);
  // The pedestal stays inside the ring, so one object never covers the ground
  // of the object standing next to it on a dense registry coordinate.
  const plinth=lead.shared.find(e=>e.role==='plinth');
  for(const o of offsets)assert(Math.hypot(o[0],o[1])>plinth.w/2,g.id+' pedestal reaches into a wing');
  assert(lead.buildingSpan>=2*Math.max(...offsets.map((o,i)=>Math.hypot(o[0],o[1])+radii[i]))-.01,g.id+' framing misses a wing');
  // Every wing is tied to the centre by its own spoke.
  const spokes=lead.shared.filter(e=>e.role==='bridge');
  assert.deepEqual(spokes.map(e=>e.spoke).sort(),g.teams.slice().sort());
  for(const [i,o] of offsets.entries()){const s=spokes.find(e=>e.spoke===members[i].id);
   assert.deepEqual(s.end.map(v=>v.toFixed(3)),o.map(v=>v.toFixed(3)))}
 }
});
test('building identity survives renumbering and keeps the records whole',()=>{
 const shared=model.buildings(data).filter(g=>g.teams.length>1);
 assert(shared.length>=7);
 const hram=shared.find(g=>g.object==='Hram Svetog Save');
 assert.deepEqual(hram.teams,['T11','T27','T43']);
 // The id comes from the object name, so a renamed team id keeps its building.
 const renamed=structuredClone(data);
 for(const t of renamed.teams)t.id='X'+t.id.slice(1);
 for(const c of renamed.claims)c.team='X'+c.team.slice(1);
 const again=model.buildings(renamed).find(g=>g.object==='Hram Svetog Save');
 assert.equal(again.id,hram.id);
 assert.deepEqual(again.teams,['X11','X27','X43']);
 // A record never moves between teams because the object is shared.
 const models=model.compile(data),elements=models.flatMap(m=>m.elements.filter(e=>e.role==='record'));
 for(const c of data.claims.filter(c=>hram.teams.includes(c.team)))
  assert.equal(elements.find(e=>e.id===c.id).team,c.team);
});
test('the published dataset carries the same buildings the scene draws',()=>{
 assert(Array.isArray(data.buildings));
 const groups=model.buildings(data);
 assert.deepEqual(data.buildings.map(b=>b.id).sort(),groups.map(g=>g.id).sort());
 for(const b of data.buildings){
  const g=groups.find(g=>g.id===b.id);
  assert.deepEqual(b.teams,g.teams);
  assert.equal(b.teamCount,g.teams.length);
  assert.equal(b.claimsCount,data.claims.filter(c=>b.teams.includes(c.team)).length);
  assert.equal(b.passports,b.teams.filter(id=>data.teams.find(t=>t.id===id).hasPassport).length);
  for(const id of b.teams)assert.equal(data.teams.find(t=>t.id===id).building,b.id);
 }
});

test('known aliases gather all teams without merging multi-object subjects',()=>{
 const groups=model.buildings(data);
 for(const [object,ids] of [['Palata Beograd (Beograđanka)',['T17','T18','T34','T50','T62','T64']],['Geneks kula',['T35','T45','T52','T57']],['Sava Centar',['T03','T60']],['Kapetan Mišino zdanje',['T30','T31']]]){
  assert.deepEqual(groups.find(g=>g.object===object).teams,ids);
 }
 assert.notEqual(groups.find(g=>g.teams.includes('T25')).id,groups.find(g=>g.teams.includes('T12')).id);
 const reversed=model.buildings({...data,teams:[...data.teams].reverse()});assert.deepEqual(reversed,groups);
});
