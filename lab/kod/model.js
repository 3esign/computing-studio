/* A program is a rule, an input, and a trace you can inspect. No eval. */
(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.KodModel=model;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function bounded(n,min,max){if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new RangeError('finite-range');return n;}
function traceCore(values, operator) {
  let total = 0;
  return values.map((input, i) => {
    const before = total;
    total = operator === 'add'
      ? total + input : total - input;
    return {step:i+1, before, input, after:total};
  });
}
function transformCore(p) {
  const a = p.angle * Math.PI / 180;
  const rotate = ([x,y]) => [
    x*Math.cos(a) - y*Math.sin(a),
    x*Math.sin(a) + y*Math.cos(a)
  ];
  const translate = ([x,y]) => [x+p.dx, y+p.dy];
  const start = [p.x,p.y];
  const first = p.order === 'TR' ? translate : rotate;
  const second = p.order === 'TR' ? rotate : translate;
  const middle = first(start);
  return {start, middle, end:second(middle), order:p.order};
}
function wallCore(walls) {
  const rows = walls.map(w => ({
    id:w.id,
    area_m2:w.l_mm*w.h_mm/1e6,
    volume_m3:w.l_mm*w.h_mm*w.t_mm/1e9
  }));
  return {
    walls:rows,
    area_m2:rows.reduce((s,w)=>s+w.area_m2,0),
    volume_m3:rows.reduce((s,w)=>s+w.volume_m3,0)
  };
}
function scheduleCore(tasks, sharedCrane) {
  const pending = tasks.slice(), rows = [];
  let craneFree = 0;
  while (pending.length) {
    const i = pending.findIndex(t =>
      t.pre.every(id=>rows.some(r=>r.id===id)));
    if(i<0) throw new RangeError('cycle');
    const task = pending.splice(i,1)[0];
    const ready = Math.max(0,...task.pre.map(id=>
      rows.find(r=>r.id===id).end));
    const start = sharedCrane && task.crane
      ? Math.max(ready,craneFree) : ready;
    const end = start + task.duration;
    if(sharedCrane && task.crane) craneFree=end;
    rows.push({id:task.id,start,end,
      duration:task.duration,crane:task.crane});
  }
  return {rows,finish:Math.max(...rows.map(r=>r.end))};
}
function loopTrace(values,operator='add'){
 if(!Array.isArray(values)||!values.length||values.length>12)throw new RangeError('values');
 values.forEach(n=>bounded(n,-1000,1000));
 if(!['add','subtract'].includes(operator))throw new RangeError('operator');
 return traceCore(values,operator);
}
function transformTrace(p){
 if(!p||!['TR','RT'].includes(p.order))throw new RangeError('order');
 ['x','y','dx','dy'].forEach(k=>bounded(p[k],-20,20));bounded(p.angle,-180,180);
 return transformCore(p);
}
function wallQuantities(walls){
 if(!Array.isArray(walls)||!walls.length||walls.length>12)throw new RangeError('walls');
 const ids=new Set();
 for(const w of walls){
  if(!w||typeof w.id!=='string'||!w.id.trim()||ids.has(w.id))throw new RangeError('id');
  ids.add(w.id);['l_mm','h_mm','t_mm'].forEach(k=>bounded(w[k],.001,100000));
 }
 return wallCore(walls);
}
function schedule(tasks,sharedCrane=false){
 if(!Array.isArray(tasks)||!tasks.length||tasks.length>12||typeof sharedCrane!=='boolean')throw new RangeError('tasks');
 const ids=new Set();
 for(const t of tasks){
  if(!t||typeof t.id!=='string'||!t.id.trim()||ids.has(t.id))throw new RangeError('id');
  ids.add(t.id);bounded(t.duration,.001,50);
  if(!Array.isArray(t.pre)||new Set(t.pre).size!==t.pre.length||typeof t.crane!=='boolean')throw new RangeError('task');
 }
 for(const t of tasks)for(const id of t.pre)if(!ids.has(id))throw new RangeError('unknown-task');
 return scheduleCore(tasks,sharedCrane);
}
function codeSource(name){
 const cores={loop:traceCore,transform:transformCore,walls:wallCore,schedule:scheduleCore};
 if(!Object.hasOwn(cores,name))throw new RangeError('instrument');return cores[name].toString();
}
return Object.freeze({loopTrace,transformTrace,wallQuantities,schedule,codeSource});
});
