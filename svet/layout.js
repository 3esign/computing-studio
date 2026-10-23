/* Where a sculpture stands on the map.

   Two problems were measured on the published atlas (2026-10-22): fourteen
   pairs of data sculptures overlapped — two of them at the identical registry
   point — while the most isolated object had 2.2 km of nothing around it. The
   cause is not the registry: the sculptures are symbolic and far larger than
   the objects they report on, so a plain projection cannot hold them.

   The answer is one declared transform plus one declared nudge:

   1. A radial cartogram. Inside CORE units of the map centre the atlas stays a
      plain projection — unchanged from before. Beyond it, distance from the
      centre is compressed by COMPRESS while the azimuth is kept exactly. The
      transform is monotone in distance, so no object ever passes another, and
      it is applied to the geography layer as well: a sculpture keeps standing
      over its own streets, because the streets travel with it.
   2. A displacement nudge. After the cartogram, footprints still collide, so
      they are pushed apart and pulled toward neighbours until no pair touches
      and the voids close. The nudge is capped (CAP units) and published per
      building in metres, so the distance to the registry point is always
      readable and never silently absorbed.

   Nothing here is a measurement of a building. The nudge is a legibility
   displacement of a symbolic sculpture, and the compression means scale is no
   longer uniform outside the core. Both are published in atlas.json and said
   on the page. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasLayout=api})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const VERSION=1;
 const METRES_PER_UNIT=25;
 /* Projection origin: kept from the first atlas so old revision snapshots and
    the geography file keep reading the same way. */
 const ORIGIN={lng:20.45,lat:44.818};
 /* Map centre: the centre of mass of the 2026-10-22 registry (45 placed
    objects), frozen as a constant. A centre recomputed from the data would
    move the whole city every time a team is added. */
 const CENTRE={lng:20.4525,lat:44.8147};
 const CORE=45;          // units (~1.1 km) of untouched plain projection
 const COMPRESS=0.4;     // how much of the distance beyond the core survives
 const CAP=10;           // units (250 m): the largest legibility nudge allowed
 const PAD=1.6;          // units of clear ground between two footprints
 const PROP=0.1;         // plus a tenth of the two radii, so big objects breathe
 const GAP_TARGET=3;     // units: a neighbour further than this is pulled closer
 const PULL=0.05;        // how hard a void closes per step
 const ITERATIONS=1400;

 const cos=Math.cos(ORIGIN.lat*Math.PI/180);
 function project(lng,lat){return [(lng-ORIGIN.lng)*111320*cos/METRES_PER_UNIT,0,(ORIGIN.lat-lat)*111320/METRES_PER_UNIT]}
 const CENTRE_XZ=project(CENTRE.lng,CENTRE.lat);
 /* Monotone radial compaction. Distance order and azimuth are exact; only the
    radial metric beyond CORE changes, and it changes for every layer alike. */
 function warp(p){const dx=p[0]-CENTRE_XZ[0],dz=p[2]-CENTRE_XZ[2],d=Math.hypot(dx,dz);
  if(d<=CORE||!d)return [p[0],p[1]||0,p[2]];
  const nd=CORE+(d-CORE)*COMPRESS;return [CENTRE_XZ[0]+dx/d*nd,p[1]||0,CENTRE_XZ[2]+dz/d*nd]}
 function place(lng,lat){return warp(project(lng,lat))}
 /* How wide one building stands: its own wings plus, when several teams share
    the object, their ring and plinth. Radius comes from the compiled geometry,
    never from a guess about the real building. */
 function radius(models,architecture){const span=models.reduce((r,m)=>Math.max(r,Math.hypot(m.wingOffset[0],m.wingOffset[1])+architecture.footprint(m)),0);
  const lead=models.find(m=>m.shared&&m.shared.length);
  return Math.max(span,lead?(lead.buildingPedestal||0)/2:0,1)}
 const need=(a,b)=>a.radius+b.radius+PAD+PROP*(a.radius+b.radius);
 /* Deterministic push-apart. Identical points are separated along a direction
    derived from their order, so two teams pinned at one registry point give the
    same picture on every machine and in every rebuild. */
 function relax(input,opts={}){
  const cap=opts.cap??CAP,pull=opts.pull??PULL;
  const nodes=[...input].sort((a,b)=>a.id.localeCompare(b.id)).map((n,i)=>({id:n.id,radius:n.radius,ax:n.x,az:n.z,x:n.x,z:n.z,seed:i}));
  for(let it=0;it<ITERATIONS;it++){
   const heat=Math.max(0,1-it/(ITERATIONS*0.75)),move=nodes.map(()=>[0,0]);
   for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],want=need(a,b);
    let dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
    if(d<1e-6){dx=Math.cos((i*7+j)*2.399963229728653);dz=Math.sin((i*7+j)*2.399963229728653);d=1}
    if(d>=want)continue;
    const push=(want-d)/2*0.55,ux=dx/d,uz=dz/d;
    move[i][0]-=ux*push;move[i][1]-=uz*push;move[j][0]+=ux*push;move[j][1]+=uz*push}
   if(heat>0)for(let i=0;i<nodes.length;i++){const a=nodes[i];
    const near=nodes.filter(b=>b!==a).map(b=>({b,gap:Math.hypot(a.x-b.x,a.z-b.z)-a.radius-b.radius})).sort((p,q)=>p.gap-q.gap||p.b.id.localeCompare(q.b.id)).slice(0,4);
    for(const e of near){if(e.gap<=GAP_TARGET)continue;const dx=e.b.x-a.x,dz=e.b.z-a.z,d=Math.hypot(dx,dz)||1;
     const f=Math.min(e.gap-GAP_TARGET,6)*pull*heat/near.length;move[i][0]+=dx/d*f;move[i][1]+=dz/d*f}}
   for(let i=0;i<nodes.length;i++){const n=nodes[i];n.x+=move[i][0];n.z+=move[i][1];
    const dx=n.x-n.ax,dz=n.z-n.az,d=Math.hypot(dx,dz);
    if(d>cap){n.x=n.ax+dx/d*cap;n.z=n.az+dz/d*cap}}
  }
  return nodes.map(n=>({id:n.id,x:round(n.x),z:round(n.z),anchor:[round(n.ax),round(n.az)],
   nudge:Math.round(Math.hypot(n.x-n.ax,n.z-n.az)*METRES_PER_UNIT),radius:round(n.radius)}))}
 const round=v=>Math.round(v*1000)/1000;
 /* What the layout is worth, measured rather than asserted: touching pairs,
    the tightest and the loneliest neighbour, how much of the occupied hull is
    actually occupied, and the largest nudge away from the registry point. */
 function metrics(places){
  const gaps=[];let overlaps=0;
  for(let i=0;i<places.length;i++)for(let j=i+1;j<places.length;j++){const a=places[i],b=places[j];
   const gap=Math.hypot(a.x-b.x,a.z-b.z)-a.radius-b.radius;if(gap<0)overlaps++}
  for(const a of places){let best=Infinity;for(const b of places)if(b!==a)best=Math.min(best,Math.hypot(a.x-b.x,a.z-b.z)-a.radius-b.radius);gaps.push(best)}
  const area=places.reduce((n,p)=>n+Math.PI*p.radius*p.radius,0),hull=hullArea(places.map(p=>[p.x,p.z]));
  const nudges=places.map(p=>p.nudge).sort((a,b)=>a-b);
  return {overlaps,minGap:round(Math.min(...gaps)),medianGap:round(gaps.slice().sort((a,b)=>a-b)[gaps.length>>1]),maxGap:round(Math.max(...gaps)),
   fill:round(100*area/hull),hullUnits:Math.round(hull),maxNudgeMetres:nudges[nudges.length-1],medianNudgeMetres:nudges[nudges.length>>1]}}
 function hullArea(points){const pts=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),hull=[];
  for(const p of pts){while(hull.length>1&&cross(hull[hull.length-2],hull[hull.length-1],p)<=0)hull.pop();hull.push(p)}
  const lower=hull.length;
  for(const p of pts.slice(0,-1).reverse()){while(hull.length>lower&&cross(hull[hull.length-2],hull[hull.length-1],p)<=0)hull.pop();hull.push(p)}
  hull.pop();let a=0;for(let i=0;i<hull.length;i++){const u=hull[i],v=hull[(i+1)%hull.length];a+=u[0]*v[1]-v[0]*u[1]}
  return Math.abs(a)/2||1}
 /* One call for the build: compiled models and registry buildings in, a
    published layout out. */
 function compile({buildings,models,architecture},opts={}){
  const byTeam=new Map(models.map(m=>[m.id,m]));
  const nodes=[];
  for(const b of buildings){if(b.locationStatus==='unmapped'||b.lat==null||b.lng==null)continue;
   const members=b.teams.map(id=>byTeam.get(id)).filter(Boolean);if(!members.length)continue;
   const p=place(b.lng,b.lat);nodes.push({id:b.id,x:p[0],z:p[2],radius:radius(members,architecture)})}
  /* The cap is a promise about honesty, not about geometry, so it cannot also
     promise an overlap-free map for data that does not exist yet. If a future
     intake packs one corner too tightly, the cap is widened in declared steps
     until nothing overlaps, and the step actually used is published. */
  let places=[],capUsed=opts.cap??CAP,report=null;
  for(const factor of [1,1.5,2.25,3.4,5]){capUsed=round((opts.cap??CAP)*factor);
   places=relax(nodes,{...opts,cap:capUsed});report=metrics(places);
   if(!report.overlaps)break}
  return {version:VERSION,metresPerUnit:METRES_PER_UNIT,centre:CENTRE,core:CORE,compress:COMPRESS,capUnits:capUsed,
   note:'Radijalni kartogram: do '+CORE*METRES_PER_UNIT+' m od centra mape projekcija je nepromenjena, dalje je rastojanje od centra sabijeno na '+Math.round(COMPRESS*100)+'% (azimut tačan, redosled tačan); isti pomeraj važi i za geografski sloj. Skulpture su potom razmaknute najviše '+Math.round(capUsed*METRES_PER_UNIT)+' m da se ne preklapaju. Pomeraj je čitljivost, ne merenje objekta.',
   places,metrics:report}}
 return {VERSION,METRES_PER_UNIT,ORIGIN,CENTRE,CORE,COMPRESS,CAP,PAD,PROP,PULL,GAP_TARGET,project,warp,place,relax,metrics,compile,radius,hullArea};
});
