/* Research becomes architecture: stable wings, record bays and source pillars.
   Symbolic dimensions are never geographic building measurements. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasArchitecture=api})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const VERSION=3;
 const fold=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 /* A single physical object can be the subject of several teams. The atlas must
    assemble one structure from all of their records instead of stacking copies
    at the same coordinate. Building identity is the folded object name, so the
    id survives team renumbering and later enrolments. */
 function key32(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(16).padStart(8,'0')}
 function buildings(data){const groups=new Map();
   for(const t of [...data.teams].sort((a,b)=>a.id.localeCompare(b.id))){const name=fold(t.object);if(!name)continue;const id='B'+key32(name);
     if(!groups.has(id))groups.set(id,{id,object:t.object,key:name,teams:[]});
     const g=groups.get(id);if(g.key!==name)throw Error('Building id collision '+id);g.teams.push(t.id)}
   return [...groups.values()]}
 /* How far a team's own structure reaches from its centre. */
 function footprint(m){let r=.5;for(const e of m.elements)r=Math.max(r,Math.abs(e.x)+e.w/2,Math.abs(e.z)+e.d/2);return r}
 /* The ring is only as wide as the real footprints require: a team without
    records needs a metre, a team with eight wings needs eight. A tight ring
    keeps the shared plinth from swallowing the neighbouring objects. */
 function wings(radii){const size=radii.length;if(size<2)return {radius:0,offsets:[[0,0]]};
   const sep=2*Math.sin(Math.PI/size);let radius=4;
   for(let i=0;i<size;i++)radius=Math.max(radius,(radii[i]+radii[(i+1)%size])/sep);
   radius+=1.4;
   return {radius,offsets:Array.from({length:size},(_,i)=>{const a=i*2*Math.PI/size-Math.PI/2;return [Math.cos(a)*radius,Math.sin(a)*radius]})}}
 /* One shared object, several owners: every team inside a building gets one
    stable hue so its own part of the structure is readable at a glance. The
    hue encodes ownership only — never a measurement or a judgement. */
 function hsl(h,s,l){const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(Math.min(k(n)-3,9-k(n)),1));return [f(0),f(8),f(4)]}
 function teamTint(index,count,dark){const n=Math.max(1,count),h=(28+index*(306/n))%360;return dark?hsl(h,.52,.62):hsl(h,.46,.46)}
 function tintCss(index,count,dark){return 'rgb('+teamTint(index,count,dark).map(v=>Math.round(Math.max(0,Math.min(1,v))*255)).join(',')+')'}
 const unknown=c=>/unknown|conflict|disput/.test(c.status)||/nepoznat|nije potvr|nisu potvr|nije poznat|ne zna|pretpostav|neslag/i.test(c.value+' '+c.title);
 function allocate(data,previous=[]){
   const slots=previous.map(x=>({...x})),known=new Map(slots.map(x=>[x.id,x]));
   for(const [items,kind,parent]of [[data.sections,'wing',x=>x.team],[data.claims,'bay',x=>x.section],[data.sources,'pillar',x=>x.team]]){
     for(const item of [...items].sort((a,b)=>a.id.localeCompare(b.id))){if(known.has(item.id))continue;const group=parent(item);const slot=1+slots.filter(x=>x.kind===kind&&x.parent===group).reduce((n,x)=>Math.max(n,x.slot),-1);const entry={id:item.id,kind,parent:group,slot};slots.push(entry);known.set(entry.id,entry)}
   }
   return slots;
 }
 function compile(data){
   const slots=new Map(allocate(data,data.architecture?.slots||[]).map(x=>[x.id,x.slot]));
   const models=data.teams.map(t=>{
     const records=data.claims.filter(c=>c.team===t.id),sources=data.sources.filter(s=>s.team===t.id),sections=data.sections.filter(s=>s.team===t.id),elements=[];
     const archive=(data.archives||[]).find(a=>a.team===t.id)||null;
     const box=(role,id,x,y,z,w,h,d,extra={})=>elements.push({role,id,team:t.id,x,y,z,w,h,d,...extra});
     let top=.5;
     if(!records.length&&!archive){for(const [x,z,w,d]of [[0,-1.5,3,.09],[0,1.5,3,.09],[-1.5,0,.09,3],[1.5,0,.09,3]])box('empty',t.id,x,.06,z,w,.12,d)}
     for(const s of sections){
       const cs=records.filter(c=>c.section===s.id);if(!cs.length)continue;
       const wing=slots.get(s.id),angle=(wing%8)*Math.PI/4,ring=1+Math.floor(wing/8),x=Math.cos(angle)*5.6*ring,z=Math.sin(angle)*5.6*ring;
       const floors=1+Math.floor(Math.max(...cs.map(c=>slots.get(c.id)))/4),base=.5+(wing%8)*1.05;
       top=Math.max(top,base+floors*2.5);
       box('foundation',s.id,x,.06,z,3.9,.35,3.9,{section:s.id});
       // Cantilevered wings join the source spine; their stable stagger reveals sections.
       box('bridge',s.id,x/2,base,z/2,Math.max(.2,Math.abs(x)),.22,.28,{section:s.id,end:[x,z]});
       for(let f=0;f<=floors;f++){
         // Open-centered floor plates expose the data facade, even from above.
         const y=base+f*2.5;
         for(const [dx,dz,w,d]of [[0,-1.65,3.8,.5],[0,1.65,3.8,.5],[-1.65,0,.5,2.8],[1.65,0,.5,2.8]])box('floor',s.id,x+dx,y,z+dz,w,.18,d,{section:s.id,floor:f});
       }
       for(const c of cs){const slot=slots.get(c.id),floor=Math.floor(slot/4),side=slot%4,y=base+floor*2.5+.32;
         const dx=[0,1.68,0,-1.68][side],dz=[-1.68,0,1.68,0][side],w=side%2?.2:2.7,d=side%2?2.7:.2;
         box('record',c.id,x+dx,y,z+dz,w,1.85,d,{section:s.id,sourceIds:c.sourceIds,opening:unknown(c),floor,slot});
       }
     }
     /* A delivered archive is mass before it is knowledge. One crate is one scan,
        one tier is one archive folder, tier thickness follows its megabytes, and
        the central gold gauge shows aggregate reading progress. Nothing here is a claim about
        the building: the tower measures the submission, not the object. */
     let tiers=[];
     if(archive){
       const order=[...(archive.sections||[])].sort((a,b)=>b.mb-a.mb||a.name.localeCompare(b.name));
       const readCount=archive.read?.scans||0;let y=.18,seen=0;
       box('archiveBase',t.id,0,0,0,9.4,.18,9.4,{archive:true,files:archive.files,bytes:archive.bytes});
       for(let i=0;i<order.length;i++){const s=order[i];
         const thickness=Math.max(.45,Math.min(3.2,s.mb*.042)),radius=2+Math.min(2.6,s.files*.045);
         box('archiveTier',t.id+':tier:'+i,0,y,0,radius*2+.6,.16,radius*2+.6,{archive:true,tier:s.name,files:s.files,mb:s.mb,read:null});
         tiers.push({index:i,name:s.name,files:s.files,mb:s.mb,y:y+.16,radius,thickness,readFrom:readCount-seen});
         seen+=s.files;y+=.16+thickness+.22;
       }
       box('archiveSpine',t.id,0,.18,0,.6,Math.max(1,y-.18),.6,{archive:true});
       // Only an aggregate reading count is verified. Never assign it to arbitrary scans.
       const progress=Math.max(0,Math.min(1,readCount/Math.max(1,archive.files)));
       box('archiveGauge',t.id+':gauge',5.4,.18,0,.36,Math.max(1,y-.18),.36,{archive:true});
       if(progress)box('archiveProgress',t.id+':progress',5.4,.18,0,.52,Math.max(1,y-.18)*progress,.78,{archive:true,read:readCount,total:archive.files});
       // Crates last: they are one contiguous run, so the renderer can drop the
       // whole 289-crate detail level from a distance without losing the tower.
       for(const tier of tiers){const step=2*Math.PI/Math.max(1,tier.files);
         for(let i=0;i<tier.files;i++){const a=tier.index*.6+i*step;
           box('archiveCrate',t.id+':scan:'+tier.index+':'+i,Math.cos(a)*tier.radius,tier.y,Math.sin(a)*tier.radius,.42,tier.thickness,.42,{archive:true,tier:tier.name,read:null});
         }}
       top=Math.max(top,y+1.1);
     }
     const height=records.length||archive?Math.max(top+1.6,3+Math.ceil(records.length/4)*1.2):.5;
     for(const s of sources){const slot=slots.get(s.id),angle=slot*2.399963229728653,r=1.1+Math.floor(slot/8)*.65;box('source',s.id,Math.cos(angle)*r,.1,Math.sin(angle)*r,.24,height,.24,{sourceIds:[s.id]})}
     if(records.length){box('core',t.id,0,.1,0,.7,height,.7);box('crown',t.id,0,height,0,3,.2,3)}
     return {id:t.id,height:height+.2,records:records.length,sections:sections.length,sources:sources.length,openings:records.filter(unknown).length,elements,shared:[],building:'',buildingObject:t.object,buildingTeams:[t.id],wingIndex:0,wingOffset:[0,0],
       archive:archive?{files:archive.files,bytes:archive.bytes,tiers:tiers.length,read:archive.read?.scans||0,crates:elements.filter(e=>e.role==='archiveCrate').length}:null,teamSlot:0,teamCount:1};
   });
   const byId=new Map(models.map(m=>[m.id,m]));
   for(const g of buildings(data)){
     const members=g.teams.map(id=>byId.get(id)).filter(Boolean);if(!members.length)continue;
     const geom=wings(members.map(footprint));
     const records=members.reduce((n,m)=>n+m.records,0),sources=members.reduce((n,m)=>n+m.sources,0),openings=members.reduce((n,m)=>n+m.openings,0);
     members.forEach((m,i)=>{m.building=g.id;m.buildingObject=g.object;m.buildingTeams=g.teams.slice();m.wingIndex=i;m.wingOffset=geom.offsets[i];m.teamSlot=i;m.teamCount=members.length});
     if(members.length<2)continue;
     // A shared plinth, spokes and mast say the one thing geometry can say
     // honestly here: this object carries several teams, and this much work.
     const lead=members[0],reach=geom.radius+Math.max(...members.map(footprint)),pedestal=Math.max(3.4,geom.radius*.45),tallest=members.reduce((h,m)=>Math.max(h,m.height),0),mast=Math.max(4+records*.38,tallest+2.6);
     const box=(role,x,y,z,w,h,d,extra={})=>lead.shared.push({role,id:g.id,team:lead.id,building:g.id,x,y,z,w,h,d,...extra});
     box('plinth',0,0,0,pedestal,.22,pedestal,{teams:g.teams.slice(),records});
     /* The combined object stays one structure, but each team owns a named,
        coloured part of it: its own terrace under its own wing, a spoke in its
        own hue, and a pylon whose height is that team's record count alone.
        A terrace is never wider than the wing standing on it, so neighbouring
        objects on the map stay uncovered. */
     members.forEach((m,i)=>{const dx=geom.offsets[i][0],dz=geom.offsets[i][1],reachI=footprint(m),tint=[i,members.length];
       const side=Math.max(2.2,reachI*2);
       lead.shared.push({role:'terrace',id:g.id+':'+m.id,team:m.id,building:g.id,x:dx,y:.02,z:dz,w:side,h:.16,d:side,slot:i,slots:members.length,records:m.records,topic:'',tint});
       lead.shared.push({role:'bridge',id:g.id+':'+m.id,team:m.id,building:g.id,x:dx/2,y:.3,z:dz/2,w:Math.hypot(dx,dz),h:.18,d:.42,end:[dx,dz],spoke:m.id,slot:i,slots:members.length});
       const inner=Math.hypot(dx,dz)||1,px=dx-dx/inner*(side/2+.45),pz=dz-dz/inner*(side/2+.45);
       lead.shared.push({role:'pylon',id:g.id+':'+m.id+':pylon',team:m.id,building:g.id,x:px,y:.18,z:pz,w:.5,h:Math.max(.7,.7+m.records*.2),d:.5,slot:i,slots:members.length,records:m.records});
     });
     box('mast',0,.22,0,1.1,mast,1.1,{records});
     box('ring',0,.22+mast,0,3.2,.26,3.2,{records});
     lead.buildingHeight=.22+mast+.52;lead.buildingRecords=records;lead.buildingSources=sources;lead.buildingOpenings=openings;lead.buildingSpan=2*reach;lead.buildingPedestal=pedestal;
   }
   return models;
 }
 return {VERSION,allocate,compile,unknown,buildings,wings,footprint,teamTint,tintCss};
});
