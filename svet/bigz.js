/* A second world inside the atlas: the delivered BIGZ archive as architecture.
   One plate per scan, one rack per folder, lit only where a scan was actually
   read. Metres are metres only in the lift shaft; everything else is symbolic.
   The layout is slot-based, so new folders and new readings extend the space
   without moving what already stands in it. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasBigz=api})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const VERSION=1;
 const PLATE=0.30,GAP=0.08,COLUMN=10;               // one scan, stacked in columns of ten
 const PLATE_W=2.6,PLATE_D=3.4,PLATE_GAP=0.6;
 const PIT={w:76,d:54,depth:11,terraces:4};
 const SLOTS=96;                                     // stable cells; a new folder takes a free one
 const KIND_COLOR={
  'crtež / plan':[.38,.62,.86],
  'fotografija / album':[.93,.74,.36],
  'tabela / obračun':[.42,.82,.63],
  'tekst / rukopis':[.86,.55,.48],
  'naslovnica / katalog':[.76,.58,.90],
  'oprema / ilustracija':[.52,.80,.84]
 };
 const PAPER=[.74,.73,.68],PAPER_DARK=[.26,.29,.33];
 function key32(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h>>>0}
 /* Slot ring: cells spiral outward around the pit, nearest first. A folder keeps
    its cell as long as its path keeps its name. */
 function cells(){const out=[];let ring=0;
  while(out.length<SLOTS){ring++;const per=ring*6;
   for(let i=0;i<per&&out.length<SLOTS;i++){const a=i*2*Math.PI/per+(ring%2)*Math.PI/per;
    out.push([Math.cos(a)*(PIT.w/2+15+ring*19),Math.sin(a)*(PIT.d/2+13+ring*17)])}}
  return out}
 function place(folders){const grid=cells(),taken=new Map(),order=folders.slice().sort((a,b)=>a.path.localeCompare(b.path));
  for(const f of order){let at=key32(f.path)%grid.length;
   while(taken.has(at))at=(at+1)%grid.length;
   taken.set(at,f.id);f.slot=at;f.pos=grid[at]}
  return folders}

 function model(data,opts){
  opts=opts||{};const dark=!!opts.night,elements=[],labels=[];
  const paper=dark?PAPER_DARK:PAPER;
  const tint=k=>{const c=KIND_COLOR[k]||[.6,.62,.66];return dark?c.map(v=>Math.min(1,v*.92+.05)):c.map(v=>v*.78+.08)};
  const push=e=>{elements.push(e);return e};

  /* 1. The excavation, shown as the mass that was taken out: a stepped block
     whose profile is read off the 1937 photographs. It stands above ground so
     the void never needs a hole in the floor, and so you can walk around it. */
  const stone=dark?[.24,.26,.27]:[.62,.58,.50];
  for(let t=0;t<PIT.terraces;t++){
   const f=t/PIT.terraces,w=PIT.w*(1-f*.30),d=PIT.d*(1-f*.30),h=PIT.depth/PIT.terraces;
   const band=stone.map(v=>dark?v+t*.028:v+t*.045);
   push({id:'bigz:pit',role:'pit',x:0,y:t*h,z:0,w,h,d,col:band,emis:.07,pick:true,
    label:t===PIT.terraces-1?{sr:'Jama 1937.',en:'The pit, 1937'}:null,
    dossier:{kind:'pit'}});
  }
  /* The water that stopped the work on 24 May 1937, as a thin plate on the step
     where the photograph shows it standing. */
  push({id:'bigz:pit',role:'water',x:0,y:PIT.depth/PIT.terraces-.06,z:0,
   w:PIT.w*(1-1/PIT.terraces*.30)*.92,h:.12,d:PIT.d*(1-1/PIT.terraces*.30)*.92,
   col:dark?[.26,.46,.55]:[.44,.60,.63],emis:.3,pick:true,dossier:{kind:'pit'}});

  /* 2. One rack per folder, one plate per scan. A read plate carries its kind
     colour and lights up; an unread plate stays paper. */
  const folders=place(data.folders.map(f=>Object.assign({},f)));
  const readById=new Map(data.readings.map(r=>[r.id,r]));
  for(const f of folders){
   const cols=Math.max(1,Math.ceil(f.scans.length/COLUMN)),rows=Math.min(COLUMN,f.scans.length||1);
   const pw=PLATE_W,pd=PLATE_D,span=cols*(pw+PLATE_GAP);
   const [cx,cz]=f.pos;
   push({id:f.id,role:'rackBase',x:cx,y:0,z:cz,w:span+1.6,h:.55,d:pd+1.6,
    col:dark?[.19,.24,.28]:[.70,.71,.67],emis:.08,pick:true,
    label:{sr:f.name,en:f.name},
    dossier:{kind:'folder',folder:f.id}});
   labels.push({id:f.id,pos:[cx,.9+rows*(PLATE+GAP),cz],text:f.name,
    sub:f.read?f.read+'/'+f.files:'0/'+f.files});
   const reads=(f.readIds||[]).map(id=>readById.get(id)).filter(Boolean);
   f.scans.forEach((s,i)=>{
    const col=Math.floor(i/COLUMN),row=i%COLUMN;
    /* The read scans light the first plates of the rack: the gallery keeps the
       scan↔plate pairing private, so only the count is public here. */
    const lit=i<reads.length?reads[i]:null;
    const x=cx-span/2+pw/2+col*(pw+PLATE_GAP);
    push({id:lit?'bigz:r:'+lit.id:f.id+':s'+i,role:lit?'plateRead':'plate',
     x,y:.55+row*(PLATE+GAP),z:cz,w:pw,h:PLATE,d:pd,
     col:lit?tint(lit.kind):paper,emis:lit?.55:.10,pick:true,folder:f.id,
     label:lit?lit.title:null,
     dossier:lit?{kind:'reading',reading:lit.id}:{kind:'folder',folder:f.id}});
   });
  }

  /* 3. Chronology: a line of posts for every date literally written on a scan. */
  const span0=Date.UTC(1937,0,1),span1=Date.UTC(1947,0,1),avenueZ=-(PIT.d/2+22),reach=78;
  push({id:'bigz:time',role:'avenue',x:0,y:.04,z:avenueZ,w:reach*2+10,h:.08,d:3.2,
   col:dark?[.24,.30,.34]:[.72,.73,.68],emis:.08,pick:false});
  data.chronology.forEach((e,i)=>{
   const t=Date.parse(e.from+'T00:00:00Z'),f=Math.max(0,Math.min(1,(t-span0)/(span1-span0)));
   const x=-reach+f*reach*2,h=3.4+(i%4)*1.1;
   push({id:'bigz:t:'+e.id,role:'post',x,y:.08,z:avenueZ,w:.42,h,d:.42,
    col:dark?[.55,.66,.72]:[.40,.46,.48],emis:.3,pick:false});
   push({id:e.id,role:'timePlate',x,y:.08+h,z:avenueZ,w:3.6,h:.3,d:2.4,
    col:tint(readById.get(e.reading)?.kind||''),emis:.5,pick:true,
    label:{sr:e.from,en:e.from},
    dossier:{kind:'time',event:e.id}});
   labels.push({id:e.id,pos:[x,.5+h,avenueZ],text:e.from,sub:''});
  });

  /* 4. Labour tower: one storey per payroll extract, one column per trade,
     height from the man-days written in that extract. */
  const towerX=PIT.w/2+74;
  data.labour.forEach((p,k)=>{
   const y0=k*16,wide=p.trades.length*2.3+3;
   push({id:p.id,role:'deck',x:towerX,y:y0,z:0,w:wide,h:.6,d:9,
    col:dark?[.20,.26,.30]:[.71,.72,.67],emis:.1,pick:true,
    label:{sr:p.list,en:p.list},
    dossier:{kind:'labour',period:p.id}});
   labels.push({id:p.id,pos:[towerX,y0+13,0],text:p.list,sub:p.from+' → '+p.to});
   p.trades.forEach((t,i)=>{
    const h=Math.log10(t.days+1)*3.2;
    push({id:t.id,role:'trade',x:towerX-wide/2+2+i*2.3,y:y0+.6,z:0,w:1.5,h,d:1.5,
     col:dark?[.46,.78,.66]:[.22,.50,.44],emis:.34,pick:true,
     label:{sr:t.name,en:t.name},
     dossier:{kind:'trade',period:p.id,trade:t.id}});
   });
  });

  /* 5. The lift shaft, at its measured height. The only true dimension here. */
  const liftX=-(PIT.w/2+70),H=data.lift.hoistMetres;
  for(const [dx,dz] of [[-1.7,-1.9],[1.7,-1.9],[-1.7,1.9],[1.7,1.9]])
   push({id:'bigz:lift',role:'shaft',x:liftX+dx,y:0,z:dz,w:.5,h:H,d:.5,
    col:dark?[.52,.60,.68]:[.36,.41,.46],emis:.22,pick:true,
    label:{sr:'Okno dizalice · '+H.toFixed(2)+' m',en:'Lift shaft · '+H.toFixed(2)+' m'},
    dossier:{kind:'lift'}});
  for(let s=0;s<data.lift.stops;s++)
   push({id:'bigz:lift',role:'stop',x:liftX,y:s*(H/(data.lift.stops-1||1)),z:0,w:4.2,h:.18,d:4.6,
    col:dark?[.62,.74,.82]:[.30,.38,.44],emis:.4,pick:true,
    label:null,dossier:{kind:'lift'}});
  push({id:'bigz:lift:car',role:'car',x:liftX,y:.2,z:0,w:data.lift.car.w,h:data.lift.car.h,d:data.lift.car.d,
   col:dark?[.80,.70,.42]:[.52,.44,.22],emis:.35,pick:true,
   label:{sr:'Kabina '+data.lift.capacityKg+' kg',en:'Car '+data.lift.capacityKg+' kg'},
   dossier:{kind:'lift'}});
  labels.push({id:'bigz:lift',pos:[liftX,H+3,0],text:H.toFixed(2)+' m',sub:data.lift.stops+' stajališta'});

  let min=[Infinity,0,Infinity],max=[-Infinity,0,-Infinity];
  for(const e of elements){min[0]=Math.min(min[0],e.x-e.w/2);max[0]=Math.max(max[0],e.x+e.w/2);
   min[2]=Math.min(min[2],e.z-e.d/2);max[2]=Math.max(max[2],e.z+e.d/2);max[1]=Math.max(max[1],e.y+e.h)}
  return {version:VERSION,elements,labels,folders,bounds:{min,max},
   home:{target:[0,4,0],dist:Math.max(240,(max[0]-min[0])*.95),yaw:-.35,pitch:.78},
   entry:[0,1.7,PIT.d/2+10]};
 }
 return {VERSION,model,KIND_COLOR,PIT};
});
