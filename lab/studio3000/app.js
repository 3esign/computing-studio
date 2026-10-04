'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const num = id => $(id).value.trim() === '' ? NaN : Number($(id).value);
  const set = (id, value) => { $(id).textContent = value; };
  const rad = degrees => degrees * Math.PI / 180;
  let language = 'en', mode = 'arch', playing = false, raf = 0, lastTime = 0;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const text = (en, sr) => language === 'en' ? en : sr;
  const fmt = (x, digits = 3) => x.toLocaleString(language === 'en' ? 'en-GB' : 'sr-Latn-RS', {maximumFractionDigits:digits});
  function value(x) { return Math.abs(x) > 0 && (Math.abs(x) < .001 || Math.abs(x) > 9999) ? x.toExponential(3) : fmt(x); }
  const defaults = {cols:10,rows:6,amplitude:55,phase:0,'arch-yaw':-25,F:1,L:2,b:100,h:200,E:200,magnify:200,'civil-yaw':-25};
  const civilIds = ['F','L','b','h','E'];
  function surface(id) {
    const canvas = $(id), bounds = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1,bounds.width), h = Math.max(1,bounds.height);
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {
      canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    return {ctx,w,h};
  }
  function camera(points, yawDegrees, w, h) {
    const yaw = rad(yawDegrees), pitch = rad(16);
    const transform = ([x,y,z]) => {
      const x1 = x*Math.cos(yaw) + z*Math.sin(yaw);
      const z1 = -x*Math.sin(yaw) + z*Math.cos(yaw);
      return [x1, y*Math.cos(pitch)-z1*Math.sin(pitch), z1*Math.cos(pitch)+y*Math.sin(pitch)];
    };
    const projected = points.map(transform);
    const xs = projected.map(p=>p[0]), ys = projected.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=Math.min((w-70)/Math.max(maxX-minX,.8),(h-80)/Math.max(maxY-minY,.8));
    return p => {
      const q=transform(p);
      return [w/2+(q[0]-(minX+maxX)/2)*scale,h/2-(q[1]-(minY+maxY)/2)*scale,q[2]];
    };
  }
  function polygon(ctx, points, fill, stroke='#586061') {
    ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();} ctx.strokeStyle=stroke;ctx.stroke();
  }
  function line(ctx, points, color, width=1, dash=[]) {
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    ctx.lineWidth=width;ctx.strokeStyle=color;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;
  }
  function drawFacade(m) {
    const s=surface('facade-canvas'); if(!s)return;
    const {ctx,w,h}=s, bounds=[];
    for(const x of [-num('cols')/2,num('cols')/2])for(const y of [-num('rows')*.6,num('rows')*.6])for(const z of [-.4,.4])bounds.push([x,y,z]);
    const project=camera(bounds,num('arch-yaw'),w,h);
    const panels=m.panels.map(p=>({...p,points:p.vertices.map(project)}));
    panels.sort((a,b)=>a.points.reduce((n,p)=>n+p[2],0)-b.points.reduce((n,p)=>n+p[2],0));
    for(const p of panels){
      const shade=Math.round(211+18*Math.cos(p.angle+rad(num('arch-yaw'))));
      const fill=p.i===0&&p.j===0?'#c55a2f':'rgb('+shade+','+(shade+1)+','+(shade-5)+')';
      polygon(ctx,p.points,fill);
      const center=p.points.reduce((q,v)=>[q[0]+v[0]/4,q[1]+v[1]/4],[0,0]);
      ctx.beginPath();ctx.arc(center[0],center[1],1.5,0,Math.PI*2);ctx.fillStyle='#5a6564';ctx.fill();
    }
  }
  function archUpdate() {
    const m=StudioModel.facade({cols:num('cols'),rows:num('rows'),amplitude:num('amplitude'),phase:num('phase')});
    for(const id of ['cols','rows'])set(id+'-val',fmt(num(id),0));
    set('amplitude-val',fmt(num('amplitude'),0)+'°');set('phase-val',fmt(num('phase'),2));set('arch-yaw-val',fmt(num('arch-yaw'),0)+'°');
    set('panel-count',fmt(m.count,0));set('panel-area',fmt(m.area,1)+' m²');set('panel-angle',fmt(m.panels[0].angle*180/Math.PI,1)+'°');
    if(mode==='arch')drawFacade(m);
  }
  function arrow(ctx,from,to,label) {
    line(ctx,[from,to],'#ab3d17',2.4);
    const a=Math.atan2(to[1]-from[1],to[0]-from[0]),len=10;
    line(ctx,[[to[0]-len*Math.cos(a-.45),to[1]-len*Math.sin(a-.45)],to,[to[0]-len*Math.cos(a+.45),to[1]-len*Math.sin(a+.45)]],'#ab3d17',2.4);
    ctx.fillStyle='#ab3d17';ctx.font='600 13px system-ui';
    const labelX=Math.max(8,Math.min(from[0]+8,ctx.canvas.clientWidth-ctx.measureText(label).width-12));
    ctx.fillText(label,labelX,from[1]+5);
  }
  function drawBeam(m, magnify) {
    const s=surface('beam-canvas');if(!s)return;
    const {ctx,w,h}=s;
    const points=[], top=[],bottom=[],front=[],back=[],center=[];
    for(let i=0;i<=36;i++){
      const x=m.L*i/36,y=-m.v(x)*magnify;
      top.push([x,y+m.h/2,-m.b/2]);bottom.push([x,y-m.h/2,-m.b/2]);
      front.push([x,y+m.h/2,m.b/2]);back.push([x,y-m.h/2,m.b/2]);center.push([x,y,0]);
    }
    const forceStart=[m.L,-m.delta*magnify+m.L*.22+m.h,0], forceEnd=[m.L,-m.delta*magnify+m.h/2,0];
    const supportH=Math.max(m.h*2,m.L*.14), supportB=Math.max(m.b*2,m.L*.1);
    const support=[[0,-supportH,-supportB],[0,supportH,-supportB],[0,supportH,supportB],[0,-supportH,supportB]];
    points.push(...top,...bottom,...front,...back,...support,forceStart,forceEnd,[0,0,0],[m.L,0,0]);
    const project=camera(points,num('civil-yaw'),w,h);
    const faces=[
      {p:[...top,...front.slice().reverse()],color:'#d9dacd'},
      {p:[...bottom,...back.slice().reverse()],color:'#bdc4bd'},
      {p:[...top,...bottom.slice().reverse()],color:'#dce0d7'},
      {p:[...front,...back.slice().reverse()],color:'#e6e7db'}
    ].map(f=>({p:f.p.map(project),color:f.color}));
    faces.sort((a,b)=>a.p.reduce((n,p)=>n+p[2],0)/a.p.length-b.p.reduce((n,p)=>n+p[2],0)/b.p.length);
    for(const f of faces)polygon(ctx,f.p,f.color,'#697775');
    polygon(ctx,support.map(project),'#b3b9b2','#535d5c');
    for(let i=1;i<8;i++){
      const z=-supportB+2*supportB*i/8;
      line(ctx,[project([0,-supportH,z]),project([0,supportH,z])],'#747e77');
    }
    line(ctx,[[0,0,0],[m.L,0,0]].map(project),'#56656a',1.3,[5,5]);
    line(ctx,center.map(project),'#ab3d17',2);
    if(m.F>0)arrow(ctx,project(forceStart),project(forceEnd),'F = '+fmt(m.F/1000)+' kN');
    const tip0=project([m.L,0,0]), tip1=project(center.at(-1));
    line(ctx,[tip0,tip1],'#ab3d17',1,[2,4]);
    ctx.fillStyle='#465653';ctx.font='12px system-ui';const origin=project([0,-supportH,0]);
    ctx.fillText(text('FIXED','UKLJEŠTENO'),Math.max(8,origin[0]-40),Math.min(h-12,origin[1]+24));
  }
  function civilUpdate() {
    const parameters=Object.fromEntries(civilIds.map(id=>[id,num(id)]));
    let m;
    try { m=StudioModel.cantilever(parameters); }
    catch(e) {
      set('civil-error',text('Enter finite values within each range: F ≥ 0; L, b, h, E > 0.','Unesi konačne vrednosti u granicama: F ≥ 0; L, b, h, E > 0.'));
      for(const id of ['delta','reaction','moment','section-value'])set(id,'—');
      $('beam-samples').replaceChildren();set('assumptions',text('No result for invalid inputs.','Nema rezultata za neispravan unos.'));
      if(mode==='civil')surface('beam-canvas');
      return;
    }
    set('civil-error','');
    const magnify=num('magnify');
    set('magnify-val',fmt(magnify,0)+'×');set('civil-yaw-val',fmt(num('civil-yaw'),0)+'°');
    set('magnify-label',text('Deflection ×','Ugib ×')+fmt(magnify,0));
    set('delta',value(m.delta*1000)+' mm');set('reaction',fmt(m.R/1000)+' kN');set('moment',fmt(m.M/1000)+' kN·m');
    set('section-value','I = '+m.I.toExponential(5)+' m⁴ · δ/L = '+value(m.ratio)+' · L/h = '+fmt(m.slenderness,1));
    const caution=m.ratio>.01?text('Large δ/L: question the small-deflection assumption. ','Veliko δ/L: preispitaj pretpostavku malih deformacija. '):'';
    const shear=m.slenderness<10?text('Short/deep beam: neglected shear may matter. ','Kratka/visoka greda: zanemareno smicanje može biti važno. '):'';
    set('assumptions',caution+shear+text('Teaching prompts at δ/L > 0.01 or L/h < 10 are heuristics, not design limits or a pass/fail assessment. Validity requires judgment.','Didaktički pragovi δ/L > 0,01 ili L/h < 10 su heuristike, ne projektantske granice ili ocena prolazi/ne prolazi. Valjanost zahteva procenu.'));
    const fragment=document.createDocumentFragment();
    for(const factor of [0,.25,.5,.75,1]){
      const tr=document.createElement('tr');
      for(const val of [fmt(m.L*factor),value(m.v(m.L*factor)*1000)]){const td=document.createElement('td');td.textContent=val;tr.append(td);}
      fragment.append(tr);
    }
    $('beam-samples').replaceChildren(fragment);
    if(mode==='civil')drawBeam(m,magnify);
  }
  function update(){mode==='arch'?archUpdate():civilUpdate();}
  function motionState() {
    $('play').disabled=playing||media.matches;$('pause').disabled=!playing;
    set('arch-state',playing?text('Playing · geometric rule','Pokrenuto · geometrijsko pravilo'):text('Paused','Pauzirano'));
    set('motion-note',media.matches?text('Reduced motion is enabled. Use Step to explore the rule.','Uključeno je smanjeno kretanje. Istražuj dugmetom Korak.'):text('Starts paused. Playback pauses when this tab is hidden.','Počinje pauzirano. Animacija staje kada se ovaj tab sakrije.'));
  }
  function stop(){playing=false;cancelAnimationFrame(raf);raf=0;lastTime=0;motionState();}
  function animate(time){
    if(!playing)return;
    if(!lastTime)lastTime=time;
    const dt=Math.min((time-lastTime)/1000,.1);
    if(dt>=1/30){
      $('phase').value=(num('phase')+dt*.55)%(2*Math.PI);lastTime=time;archUpdate();
    }
    raf=requestAnimationFrame(animate);
  }
  $('play').addEventListener('click',()=>{if(media.matches)return;playing=true;motionState();raf=requestAnimationFrame(animate);});
  $('pause').addEventListener('click',stop);
  $('advance').addEventListener('click',()=>{stop();$('phase').value=(num('phase')+.25)%(2*Math.PI);archUpdate();});
  function reset(ids){stop();for(const id of ids)$(id).value=defaults[id];update();}
  $('arch-reset').addEventListener('click',()=>reset(['cols','rows','amplitude','phase','arch-yaw']));
  $('civil-reset').addEventListener('click',()=>reset([...civilIds,'magnify','civil-yaw']));
  document.querySelectorAll('input').forEach(el=>el.addEventListener('input',()=>{if(el.id==='phase')stop();update();}));
  function select(next, focus=false){
    stop();mode=next;
    for(const name of ['arch','civil']){
      $(name).hidden=name!==mode;$('tab-'+name).setAttribute('aria-selected',String(name===mode));$('tab-'+name).tabIndex=name===mode?0:-1;
    }
    if(focus)$('tab-'+mode).focus();update();
  }
  for(const name of ['arch','civil'])$('tab-'+name).addEventListener('click',()=>select(name));
  document.querySelector('[role=tablist]').addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();select(event.key==='Home'?'arch':event.key==='End'?'civil':mode==='arch'?'civil':'arch',true);
    }
  });
  $('language').addEventListener('click',()=>{
    language=language==='en'?'sr':'en';document.documentElement.lang=language==='en'?'en':'sr-Latn';
    document.querySelectorAll('[data-en][data-sr]').forEach(el=>el.textContent=el.dataset[language]);
    $('language').setAttribute('aria-label',text('Switch language to Serbian','Prebaci jezik na engleski'));
    $('facade-canvas').setAttribute('aria-label',text('Rotating rectangular facade panels; numerical panel count and material area follow.','Rotirajući pravougaoni fasadni paneli; ispod su broj panela i površina materijala.'));
    $('beam-canvas').setAttribute('aria-label',text('Cantilever fixed at left with a downward tip load; original axis dashed, amplified deflection orange. Numerical samples follow.','Konzola uklještena levo, sila nadole na kraju; prvobitna osa isprekidano, uvećan ugib narandžasto. Ispod su numeričke vrednosti.'));
    motionState();update();set('copy-status','');
  });
  document.querySelectorAll('.copy').forEach(button=>button.addEventListener('click',async()=>{
    const el=$(button.dataset.copy);
    try { if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(el.textContent);set('copy-status',text('Rule copied.','Pravilo je kopirano.')); }
    catch(e){
      const range=document.createRange();range.selectNodeContents(el);
      const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
      set('copy-status',text('Rule selected. Press Ctrl+C / ⌘C or use your device Copy command.','Pravilo je označeno. Pritisni Ctrl+C / ⌘C ili koristi komandu Kopiraj na uređaju.'));
    }
  }));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  media.addEventListener('change',()=>{stop();});
  window.addEventListener('resize',update);
  motionState();archUpdate();civilUpdate();
})();
