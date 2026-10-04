/* One system, four complementary descriptions. Geometry, not engineering validation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DesignModel=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const version='1.0.0';
function number(n,min,max,integer=false){if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw new RangeError('finite supported range');}
function grid(p){number(p.cols,1,10,true);number(p.rows,1,8,true);}
function modularCore(p){
  const width_mm=p.cols*p.panelW_mm+(p.cols-1)*p.joint_mm;
  const depth_mm=p.rows*p.panelD_mm+(p.rows-1)*p.joint_mm;
  const panels=[];
  for(let row=0;row<p.rows;row++)for(let col=0;col<p.cols;col++){
    panels.push({id:panels.length+1,col,row,
      x_mm:col*(p.panelW_mm+p.joint_mm),
      y_mm:row*(p.panelD_mm+p.joint_mm)});
  }
  const panelArea_m2=panels.length*p.panelW_mm*p.panelD_mm/1e6;
  const footprint_m2=width_mm*depth_mm/1e6;
  const jointArea_m2=p.joint_mm*((p.cols-1)*p.rows*p.panelD_mm
    +(p.rows-1)*p.cols*p.panelW_mm+(p.cols-1)*(p.rows-1)*p.joint_mm)/1e6;
  return {width_mm,depth_mm,count:panels.length,panels,
    panelArea_m2,footprint_m2,jointArea_m2};
}
function stationsCore(p){
  const quotient=p.length_m/p.step_m;
  const nearest=Math.round(quotient);
  const tolerance_q=8*Number.EPSILON*Math.max(1,Math.abs(quotient));
  const endpointSnapped=Math.abs(quotient-nearest)<=tolerance_q;
  const fullSteps=Math.floor(endpointSnapped?nearest:quotient);
  const tolerance_m=tolerance_q*p.step_m;
  const points=[];
  for(let k=0;k<=fullSteps;k++)points.push({i:k,x_m:k*p.step_m,kind:'step'});
  let remainder_m=p.length_m-points[points.length-1].x_m;
  if(endpointSnapped){points[points.length-1].x_m=p.length_m;remainder_m=0;}
  else if(p.includeEnd)points.push({i:points.length,x_m:p.length_m,kind:'endpoint'});
  const intervals_m=points.slice(1).map((point,i)=>point.x_m-points[i].x_m);
  return {points,count:points.length,intervals_m,remainder_m,tolerance_m,endpointSnapped,
    last_m:points[points.length-1].x_m};
}
function proceduralCore(p){
  let state=p.seed;
  const cells=[];
  for(let row=0;row<p.rows;row++)for(let col=0;col<p.cols;col++){
    state=(Math.imul(1664525,state)+1013904223)>>>0;
    const u=state/4294967296;
    cells.push({id:cells.length+1,col,row,state,u,open:u<p.openFraction});
  }
  const openCount=cells.filter(cell=>cell.open).length;
  return {cells,count:cells.length,openCount,
    openRatio:openCount/cells.length,finalState:state};
}
function parametricCore(p){
  const spanX_m=p.width_m/p.baysX;
  const spanY_m=p.depth_m/p.baysY;
  const area_m2=p.width_m*p.depth_m;
  const volume_m3=area_m2*p.thickness_mm/1000;
  const nodes=[];
  for(let row=0;row<=p.baysY;row++)for(let col=0;col<=p.baysX;col++){
    nodes.push({id:nodes.length+1,col,row,x_m:col*spanX_m,y_m:row*spanY_m});
  }
  return {spanX_m,spanY_m,area_m2,volume_m3,
    bayCount:p.baysX*p.baysY,nodeCount:nodes.length,nodes};
}
function modular(p){if(!p)throw new RangeError('parameters');grid(p);number(p.panelW_mm,100,3000);number(p.panelD_mm,100,3000);number(p.joint_mm,0,150);return modularCore(p);}
function stations(p){if(!p)throw new RangeError('parameters');number(p.length_m,1,20);number(p.step_m,.25,5);if(typeof p.includeEnd!=='boolean')throw new RangeError('endpoint choice');return stationsCore(p);}
function procedural(p){if(!p)throw new RangeError('parameters');grid(p);number(p.seed,0,4294967295,true);number(p.openFraction,0,1);return proceduralCore(p);}
function parametric(p){if(!p)throw new RangeError('parameters');number(p.width_m,1,24);number(p.depth_m,1,20);number(p.baysX,1,10,true);number(p.baysY,1,8,true);number(p.thickness_mm,10,500);return parametricCore(p);}
const models={modular,algorithmic:stations,procedural,parametric};
const cores={modular:modularCore,algorithmic:stationsCore,procedural:proceduralCore,parametric:parametricCore};
function codeSource(mode){if(!Object.hasOwn(cores,mode))throw new RangeError('mode');return cores[mode].toString();}
function run(mode,p){if(!Object.hasOwn(models,mode))throw new RangeError('mode');return models[mode](p);}
function snapshot(mode,p){const result=run(mode,p);return {schema:'or-design/v1',modelVersion:version,mode,parameters:JSON.parse(JSON.stringify(p)),units:mode==='modular'?'mm and m2':mode==='procedural'?'dimensionless grid and probability':mode==='parametric'?'m, mm, m2, m3':'m',result,note:'Parameter record for a teaching geometry model. Not verified authorship, a submission receipt or engineering validation.'};}
return Object.freeze({version,modular,stations,procedural,parametric,run,codeSource,snapshot});
});
