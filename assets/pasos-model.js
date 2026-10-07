/* A real object becomes understandable through its evidence.
   Shared read model for the home and 2D passport. No authored object facts. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../prostor/model.js'));
  else root.PassportModel = factory(root.ProstorModel);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (space) {
  'use strict';
  const DATA_PATH = 'data/pasos/objekat-001-savski-most.json';
  const STATES = {
    confirmed: {en:'Confirmed in the record',sr:'Potvrđeno u zapisu'},
    'single-source': {en:'Single source',sr:'Jedan izvor'},
    conflicting: {en:'Disagreement',sr:'Neslaganje'},
    probable: {en:'Probable',sr:'Verovatno'},
    unconfirmed: {en:'Unconfirmed',sr:'Nepotvrđeno'},
    unknown: {en:'Unknown',sr:'Nepoznato'},
    illustrative: {en:'Teaching example',sr:'Nastavni primer'}
  };
  const KINDS = {
    D:{en:'Document',sr:'Dokument'}, M:{en:'Measurement',sr:'Merenje'},
    S:{en:'Secondary source',sr:'Sekundarni izvor'}, O:{en:'Statement',sr:'Izjava'},
    I:{en:'Interpretation',sr:'Tumačenje'}
  };
  const MEASURES = {
    length:{en:'Length',sr:'Dužina'}, span:{en:'Span',sr:'Raspon'},
    width:{en:'Width',sr:'Širina'}, piers:{en:'Piers',sr:'Stubovi'},
    'mass-total':{en:'Total mass',sr:'Ukupna masa'}, 'mass-arch':{en:'Arch mass',sr:'Masa luka'}
  };
  const unique = values => [...new Set(values.filter(Boolean))];
  const tr = (value,lang='en') => typeof value === 'string' ? value : value?.[lang] || value?.en || '';
  const fold = value => String(value).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'dj');
  const sourceIds = claim => unique([...(claim.src || []), ...(claim.m || []).flatMap(m=>m.src || []), ...(claim.flags || []).flatMap(f=>f.src || []), ...(claim.quote?.src || [])]);
  function validate(data) {
    if (!data?.object?.name || !Array.isArray(data.claims) || !data.claims.length || !Array.isArray(data.sources)) throw new Error('Invalid passport record');
    if (new Set(data.claims.map(c=>c.k)).size !== data.claims.length || new Set(data.sources.map(s=>s.id)).size !== data.sources.length) throw new Error('Duplicate record identifier');
    for (const c of data.claims) {
      if (!c.k || !c.q || !c.st) throw new Error('Incomplete claim');
      if (sourceIds(c).some(id=>!data.sources.some(s=>s.id===id))) throw new Error('Missing source reference');
    }
    return data;
  }
  function select(data, filters={}) {
    const query=fold(filters.q || '').trim();
    return data.claims.filter(c => {
      if (filters.lane && c.l !== filters.lane) return false;
      if (filters.status && c.st !== filters.status) return false;
      if (filters.source && !sourceIds(c).includes(filters.source)) return false;
      if (filters.kind && c.ev !== filters.kind) return false;
      const sources=data.sources.filter(s=>sourceIds(c).includes(s.id));
      return !query || fold([c.k,tr(c.q,'en'),tr(c.q,'sr'),tr(c.v,'en'),tr(c.v,'sr'),tr(c.note,'en'),tr(c.note,'sr'),tr(c.next,'en'),tr(c.next,'sr'),...sources.map(s=>s.id+' '+s.t+' '+s.pub)].join(' ')).includes(query);
    });
  }
  function counts(data) {
    const states={};
    for (const c of data.claims) states[c.st]=(states[c.st] || 0)+1;
    return {claims:data.claims.length,sources:data.sources.length,states};
  }
  function measurements(claim) {
    const groups=[];
    for (const m of claim.m || []) {
      let group=groups.find(g=>g.key===m.k && g.unit===m.u);
      if (!group) groups.push(group={key:m.k,unit:m.u,entries:[]});
      group.entries.push(m);
    }
    return groups.map(g=>({...g,disagrees:new Set(g.entries.map(m=>m.v)).size>1}));
  }
  function sceneURL(data, claim, partKey) {
    const parts=space.SPEC.filter(p=>p.claim===claim.k);
    const part=parts.find(p=>p.part===partKey) || parts.find(p=>measurements(claim).some(g=>g.disagrees && g.key===p.mk)) || parts[0];
    const q=new URLSearchParams();
    const ids=sourceIds(claim).filter(id=>data.sources.some(s=>s.id===id));
    if (ids.length) q.set('src',ids.join(','));
    if (part) q.set('part',part.part);
    return 'prostor/index.html'+(q.size?'?'+q.toString():'');
  }
  function safeURL(value) {
    try { const url=new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  }
  /* A fixed oblique projection of the existing model, not a second bridge model.
     All conflicting variants are kept. Open cages mean missing evidence.
     Projection constants below are layout choices, never surveyed dimensions. */
  function diagram(data, claimKey) {
    const scene=space.build(data), entries=[];
    const parts=scene.parts.filter(p=>['axis','arch','deck','piers'].includes(p.k) || p.claim===claimKey);
    for (const p of parts) {
      for (let i=0;i<space.variantCount(scene,p.k);i++) {
        // A newly documented length disagreement must not collapse the deck to
        // zero (the spatial model has no single lengthM in that case). Show
        // every recorded length for length-dependent parts; never pick a winner.
        const axes=space.part(scene,'axis')?.variants || [];
        const lengths=scene.lengthM===null && ['deck','piers','decklayers'].includes(p.k)?axes.map(a=>a.v):[scene.lengthM];
        for(let j=0;j<lengths.length;j++){
          let geometry;
          try { geometry=space.geometryOf({...scene,lengthM:lengths[j]},p.k,i); } catch { continue; }
          if (!geometry) continue;
          const points=geometry.nodes.map(([x,y,z])=>[x+z*.72,x*.18-y+z*.3]);
          entries.push({part:p.k,claim:p.claim,state:p.state,active:p.claim===claimKey,variant:i+j,points,lines:geometry.lines});
        }
      }
    }
    const points=entries.flatMap(e=>e.points);
    if (!points.length) return [];
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=Math.min(540/Math.max(1,maxX-minX),220/Math.max(1,maxY-minY));
    return entries.map(e=>({...e,points:e.points.map(([x,y])=>[300+(x-(minX+maxX)/2)*scale,150+(y-(minY+maxY)/2)*scale])}));
  }
  return {DATA_PATH,STATES,KINDS,MEASURES,LANES:space.LANES,PROPORTIONS:space.PROPORTIONS,tr,sourceIds,validate,select,counts,measurements,sceneURL,safeURL,diagram};
}));
