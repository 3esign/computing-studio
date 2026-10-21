/* Spatial archive: native WebGL, reusable buffers, render only on changes. */
window.AtlasRenderer=function(canvas,onPick){
'use strict';
var gl=canvas.getContext('webgl',{antialias:true,alpha:false});if(!gl)throw Error('WebGL unavailable');
  // Matrix math helpers (column-major)
  var M4 = {
    create: function () {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },
    perspective: function (out, fov, aspect, near, far) {
      var f = 1.0 / Math.tan(fov / 2);
      var nf = 1 / (near - far);
      out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
      out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
      out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
      out[12] = 0; out[13] = 0; out[14] = (2 * far * near) * nf; out[15] = 0;
      return out;
    },
    ortho: function (out, left, right, bottom, top, near, far) {
      var lr = 1 / (left - right), bt = 1 / (bottom - top), nf = 1 / (near - far);
      out[0] = -2 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
      out[4] = 0; out[5] = -2 * bt; out[6] = 0; out[7] = 0;
      out[8] = 0; out[9] = 0; out[10] = 2 * nf; out[11] = 0;
      out[12] = (left + right) * lr; out[13] = (top + bottom) * bt; out[14] = (far + near) * nf; out[15] = 1;
      return out;
    },
    lookAt: function (out, eye, center, up) {
      var x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
      var eyex = eye[0], eyey = eye[1], eyez = eye[2];
      var upx = up[0], upy = up[1], upz = up[2];
      var centerx = center[0], centery = center[1], centerz = center[2];

      z0 = eyex - centerx; z1 = eyey - centery; z2 = eyez - centerz;
      len = 1 / Math.hypot(z0, z1, z2);
      z0 *= len; z1 *= len; z2 *= len;

      x0 = upy * z2 - upz * z1;
      x1 = upz * z0 - upx * z2;
      x2 = upx * z1 - upy * z0;
      len = 1 / Math.hypot(x0, x1, x2);
      x0 *= len; x1 *= len; x2 *= len;

      y0 = z1 * x2 - z2 * x1;
      y1 = z2 * x0 - z0 * x2;
      y2 = z0 * x1 - z1 * x0;
      len = 1 / Math.hypot(y0, y1, y2);
      y0 *= len; y1 *= len; y2 *= len;

      out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
      out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
      out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
      out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
      out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
      out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
      out[15] = 1;
      return out;
    },
    multiply: function (out, a, b) {
      var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

      var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
      out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
      out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
      out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
      out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

      b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
      out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
      out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
      out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
      out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

      b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
      out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
      out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
      out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
      out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

      b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
      out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
      out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
      out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
      out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
      return out;
    }
  };

  // Shaders
  var vsSource = [
    'attribute vec3 aPos;',
    'attribute vec3 aNormal;',
    'attribute vec3 aColor;',
    'attribute float aEmissive;',
    'uniform mat4 uMVP;',
    'uniform float uGrowth;',
    'uniform mat4 uModel;',
    'uniform vec3 uSunDir;',
    'uniform vec3 uEye;',
    'varying vec3 vColor;',
    'varying float vLight;',
    'varying float vEmissive;',
    'varying float vDist;',
    'void main() {',
    '  vec4 worldPos = uModel * vec4(aPos, 1.0);',
    '  gl_Position = uMVP * vec4(aPos, 1.0);',
    '  vec3 norm = normalize((uModel * vec4(aNormal, 0.0)).xyz);',
    '  float diff = max(dot(norm, normalize(uSunDir)), 0.0);',
    '  float sky = max(norm.y * 0.35 + 0.65, 0.0);',
    '  vLight = diff * 0.42 + sky * 0.58;',
    '  vColor = aColor;',
    '  vEmissive = aEmissive;',
    '  vDist = length(worldPos.xyz - uEye);',
    '}'
  ].join('\n');

  var fsSource = [
    'precision mediump float;',
    'varying vec3 vColor;',
    'varying float vLight;',
    'varying float vEmissive;',
    'varying float vDist;',
    'uniform vec3 uSkyColor;',
    'uniform float uNight;',
    'void main() {',
    '  float lum = dot(vColor, vec3(0.2126, 0.7152, 0.0722));',
    '  float neutral = 1.0 - smoothstep(0.08, 0.26, max(max(vColor.r,vColor.g),vColor.b)-min(min(vColor.r,vColor.g),vColor.b));',
    '  float structureFill = mix(0.12, 0.48, step(0.025, vEmissive));',
    '  vec3 nightColor = mix(vColor * vec3(0.75,0.95,1.1), vec3(0.08,0.13,0.16)+lum*structureFill, neutral);',
    '  vec3 base = mix(vColor, nightColor, uNight);',
    '  vec3 lit = base * mix(vLight, vLight*0.7+0.25, uNight);',
    '  if (vEmissive > 0.4) {',
    '    lit = mix(lit, vColor * 1.2, vEmissive * (uNight > 0.5 ? 0.8 : 0.2));',
    '  }',
    '  // Soft atmospheric haze',
    '  float fog = smoothstep(160.0, 700.0, vDist) * 0.62;',
    '  vec3 finalColor = mix(lit, uSkyColor, fog);',
    '  gl_FragColor = vec4(finalColor, 1.0);',
    '}'
  ].join('\n');

  function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  var prog = gl.createProgram();
  gl.attachShader(prog, createShader(gl, gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(prog);

  var uMVP = gl.getUniformLocation(prog, 'uMVP');
  var uModel = gl.getUniformLocation(prog, 'uModel');
  var uSunDir = gl.getUniformLocation(prog, 'uSunDir');
  var uSkyColor = gl.getUniformLocation(prog, 'uSkyColor');
  var uNight = gl.getUniformLocation(prog, 'uNight');
  var uEye = gl.getUniformLocation(prog, 'uEye');

  var aPos = gl.getAttribLocation(prog, 'aPos');
  var aNormal = gl.getAttribLocation(prog, 'aNormal');
  var aColor = gl.getAttribLocation(prog, 'aColor');
  var aEmissive = gl.getAttribLocation(prog, 'aEmissive');

  // Vertex data builder
  var vertices = [];
  var normals = [];
  var colors = [];
  var emissives = [];

  function addTri(p1, p2, p3, norm, col, emis) {
    vertices.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
    normals.push(norm[0], norm[1], norm[2], norm[0], norm[1], norm[2], norm[0], norm[1], norm[2]);
    colors.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
    emissives.push(emis, emis, emis);
  }

  function addQuad(p1, p2, p3, p4, norm, col, emis) {
    addTri(p1, p2, p3, norm, col, emis);
    addTri(p1, p3, p4, norm, col, emis);
  }

  function addBox(x, y, z, w, h, d, col, emis) {
    emis = emis || 0.0;
    var x0 = x - w/2, x1 = x + w/2;
    var y0 = y, y1 = y + h;
    var z0 = z - d/2, z1 = z + d/2;

    // Top
    addQuad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], col, emis);
    // North
    addQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [col[0]*0.9, col[1]*0.9, col[2]*0.9], emis);
    // South
    addQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [col[0]*0.95, col[1]*0.95, col[2]*0.95], emis);
    // West
    addQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [col[0]*0.85, col[1]*0.85, col[2]*0.85], emis);
    // East
    addQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [col[0]*0.88, col[1]*0.88, col[2]*0.88], emis);
  }

  function addCylinder(x, y, z, radius, h, segments, col, emis) {
    emis = emis || 0.0;
    var prevX = x + radius, prevZ = z;
    for (var i = 1; i <= segments; i++) {
      var angle = (i / segments) * Math.PI * 2;
      var currX = x + Math.cos(angle) * radius;
      var currZ = z + Math.sin(angle) * radius;

      // Side
      var norm = [Math.cos(angle - Math.PI / segments), 0, Math.sin(angle - Math.PI / segments)];
      addQuad([prevX, y, prevZ], [currX, y, currZ], [currX, y + h, currZ], [prevX, y + h, prevZ], norm, col, emis);
      // Top cap
      addTri([x, y + h, z], [prevX, y + h, prevZ], [currX, y + h, currZ], [0, 1, 0], [col[0]*1.05, col[1]*1.05, col[2]*1.05], emis);
      prevX = currX;
      prevZ = currZ;
    }
  }

  function addDome(x, y, z, radius, segments, col, emis) {
    emis = emis || 0.0;
    var rings = 4;
    for (var r = 0; r < rings; r++) {
      var phi0 = (r / rings) * (Math.PI / 2);
      var phi1 = ((r + 1) / rings) * (Math.PI / 2);
      var y0 = y + Math.sin(phi0) * radius;
      var y1 = y + Math.sin(phi1) * radius;
      var r0 = Math.cos(phi0) * radius;
      var r1 = Math.cos(phi1) * radius;

      for (var s = 0; s < segments; s++) {
        var t0 = (s / segments) * Math.PI * 2;
        var t1 = ((s + 1) / segments) * Math.PI * 2;

        var p1 = [x + Math.cos(t0) * r0, y0, z + Math.sin(t0) * r0];
        var p2 = [x + Math.cos(t1) * r0, y0, z + Math.sin(t1) * r0];
        var p3 = [x + Math.cos(t1) * r1, y1, z + Math.sin(t1) * r1];
        var p4 = [x + Math.cos(t0) * r1, y1, z + Math.sin(t0) * r1];

        var norm = [Math.cos((t0+t1)/2), Math.sin((phi0+phi1)/2), Math.sin((t0+t1)/2)];
        addQuad(p1, p2, p3, p4, norm, col, emis);
      }
    }
  }



// Geography is immutable between geographic-layer/theme changes. Team meshes
// have independent uploads; culling never edits the semantic picking index.
function mesh(){return {buffers:[gl.createBuffer(),gl.createBuffer(),gl.createBuffer(),gl.createBuffer()],chunks:[],count:0}}
var staticMesh=mesh(),teamMesh=mesh(),chunks=[],staticKey='',staticGeo=null,staticHits=[];
var builds=0,staticBuilds=0,uploadedBytes=0,lastUploadBytes=0,drawCalls=0,drawnTriangles=0,culledChunks=0,lodSkipped=0,culling=true,buildMs=0;
function resetGeometry(){vertices=[];normals=[];colors=[];emissives=[];chunks=[]}
function chunk(start,lod){var end=vertices.length/3;if(end===start)return;var min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(var i=start*3;i<vertices.length;i+=3)for(var k=0;k<3;k++){min[k]=Math.min(min[k],vertices[i+k]);max[k]=Math.max(max[k],vertices[i+k])}min[1]=Math.min(min[1],0);chunks.push({start,count:end-start,min,max,lod})}
function upload(target){target.chunks=chunks;target.count=vertices.length/3;[vertices,normals,colors,emissives].forEach((arr,i)=>{var typed=new Float32Array(arr);gl.bindBuffer(gl.ARRAY_BUFFER,target.buffers[i]);gl.bufferData(gl.ARRAY_BUFFER,typed,gl.STATIC_DRAW);uploadedBytes+=typed.byteLength;lastUploadBytes+=typed.byteLength})}
// AABB positive vertex against all six clip planes; bounds include every
// vertex (also river caps and footprints crossing a cell boundary).
function outside(b){if(!culling)return false;for(var row=0;row<3;row++)for(var sign of [-1,1]){var a=mvpMat[3]+sign*mvpMat[row],c=mvpMat[7]+sign*mvpMat[row+4],d=mvpMat[11]+sign*mvpMat[row+8],e=mvpMat[15]+sign*mvpMat[row+12];if(a*(a>=0?b.max[0]:b.min[0])+c*(c>=0?b.max[1]:b.min[1])+d*(d>=0?b.max[2]:b.min[2])+e < -0.001)return true}return false}
function drawMesh(target){[aPos,aNormal,aColor,aEmissive].forEach((a,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,target.buffers[i]);gl.vertexAttribPointer(a,i===3?1:3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(a)});var start=-1,count=0;function flush(){if(count){gl.drawArrays(gl.TRIANGLES,start,count);drawCalls++;drawnTriangles+=count/3}start=-1;count=0}for(var b of target.chunks){if(b.lod&&opts.mode!=='street'&&opts.quality!=='high'&&(cam.dist>260||.13*canvas.clientHeight/cam.dist<.75)){lodSkipped++;flush();continue}if(outside(b)){culledChunks++;flush();continue}if(start<0)start=b.start;count+=b.count}flush()}
var uGrowth=gl.getUniformLocation(prog,'uGrowth');
var pMat=M4.create(),vMat=M4.create(),mvpMat=M4.create(),mMat=M4.create();
var data,geo,opts={},marks=[],hit=[],pickBoxes=[],arcs=[],models=[],frame=0,frames=0,growthStart=0,cam={yaw:-.35,pitch:.8,dist:165,target:[12,0,10]},transition=null,drag=null,hover='',inView=true;
var reduced=matchMedia('(prefers-reduced-motion:reduce)'),labels=document.getElementById('map-labels'),labelNodes=new Map(),pointers=new Map();
var links=document.getElementById('map-links'),lastLabelTime=0;
// Street mode explores symbolic data architecture, not a metric survey.
var walk={pos:[12,1.7,30],yaw:0,pitch:0},keys=new Set(),lastWalk=0,stick={x:0,y:0,id:null},aim=null;
var joystick=document.getElementById('joystick'),knob=joystick?.firstElementChild;
function resetStick(){stick={x:0,y:0,id:null};if(knob)knob.style.transform='translate(-50%,-50%)'}
function stopWalk(){keys.clear();resetStick();lastWalk=0}
function enterStreet(id){stopWalk();transition=null;var lead=leadOf(id);if(lead)id=lead.id;var t=data.teams.find(t=>t.id===id)||data.teams.find(t=>t.hasPassport&&position(t)),p=t&&wingPos(t);if(!p)p=[12,0,10];var boxes=pickBoxes.filter(b=>b.team===t?.id),front=boxes.reduce((z,b)=>Math.max(z,b.max[2]),p[2]);walk.pos=[p[0],1.7,front+8];walk.yaw=0;walk.pitch=.08;canvas.focus({preventScroll:true});revealStage();invalidate()}
/* Na niskom ekranu scena i dugmad za hod padnu ispod pregiba: ulica bez
   vidljivih komandi nije upotrebljiva, pa se pozornica dovodi u kadar. */
function revealStage(){var s=canvas.closest('.stage')||canvas,r=s.getBoundingClientRect();if(r.top>=0&&r.bottom<=innerHeight)return;s.scrollIntoView({block:'center',inline:'nearest',behavior:reduced.matches?'instant':'smooth'})}
function blocked(x,z){return pickBoxes.some(b=>b.role!=='foundation'&&b.max[1]>.25&&b.min[1]<1.9&&x>b.min[0]-.3&&x<b.max[0]+.3&&z>b.min[2]-.3&&z<b.max[2]+.3)}
function stepWalk(now){var dt=lastWalk?Math.min(.05,(now-lastWalk)/1000):0;lastWalk=now;if(!keys.size&&!stick.x&&!stick.y)return;var forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS'))-stick.y,side=Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+stick.x;walk.yaw+=(Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')))*dt*1.5;walk.pitch=Math.max(-1.2,Math.min(1.2,walk.pitch+(Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')))*dt));var norm=Math.max(1,Math.hypot(forward,side)),dx=(side*Math.cos(walk.yaw)-forward*Math.sin(walk.yaw))*dt*8/norm,dz=(-forward*Math.cos(walk.yaw)-side*Math.sin(walk.yaw))*dt*8/norm;var steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));for(var i=0;i<steps;i++){if(!blocked(walk.pos[0]+dx/steps,walk.pos[2]))walk.pos[0]+=dx/steps;if(!blocked(walk.pos[0],walk.pos[2]+dz/steps))walk.pos[2]+=dz/steps}invalidate()}
function pickCenter(){var r=canvas.getBoundingClientRect(),p=findPick({clientX:r.left+r.width/2,clientY:r.top+r.height/2});if(p)onPick(p.id,p.team)}
function moveStick(e){var r=joystick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/34,dy=(e.clientY-r.top-r.height/2)/34,n=Math.max(1,Math.hypot(dx,dy));stick.x=Math.abs(dx/n)>.08?dx/n:0;stick.y=Math.abs(dy/n)>.08?dy/n:0;knob.style.transform='translate(calc(-50% + '+stick.x*27+'px),calc(-50% + '+stick.y*27+'px))';invalidate()}
if(joystick){joystick.addEventListener('pointerdown',e=>{if(opts.mode!=='street'||stick.id!==null)return;e.preventDefault();stopWalk();stick.id=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e)});joystick.addEventListener('pointermove',e=>{if(e.pointerId===stick.id)moveStick(e)});for(var type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,e=>{if(e.pointerId===stick.id){resetStick();invalidate()}});joystick.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);invalidate()}});joystick.addEventListener('keyup',e=>keys.delete(e.code));joystick.addEventListener('blur',stopWalk)}
canvas.addEventListener('keydown',e=>{if(opts.mode!=='street')return;if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();keys.add(e.code);invalidate()}if(e.code==='Enter'){e.preventDefault();pickCenter()}});
canvas.addEventListener('keyup',e=>keys.delete(e.code));canvas.addEventListener('blur',stopWalk);window.addEventListener('blur',stopWalk);document.addEventListener('visibilitychange',stopWalk);
for(let button of document.querySelectorAll('[data-walk]')){button.addEventListener('pointerdown',e=>{if(opts.mode!=='street')return;e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.walk);invalidate()});for(var event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.walk));button.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();keys.add(button.dataset.walk);invalidate()}});button.addEventListener('keyup',()=>keys.delete(button.dataset.walk));button.addEventListener('blur',()=>keys.delete(button.dataset.walk))}
document.getElementById('walk-pick')?.addEventListener('click',pickCenter);
function project(lng,lat){return [(lng-20.45)*111320*Math.cos(44.818*Math.PI/180)/25,0,(44.818-lat)*111320/25]}
function hash(s){var n=2166136261;for(var c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0}
function line(a,b,width,col,y){var dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);if(!len)return;dx=dx/len*width/2;dz=dz/len*width/2;addQuad([a[0]-dz,y,a[2]+dx],[b[0]-dz,y,b[2]+dx],[b[0]+dz,y,b[2]-dx],[a[0]+dz,y,a[2]-dx],[0,1,0],col,0)}

// A joined, flat ribbon avoids overlapping cylinder caps and their false facets.
function ribbon(points,width,col,y){var pts=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[2]-points[i-1][2])>.0001),edges=[];if(pts.length<2)return;for(var i=0;i<pts.length;i++){var p=pts[i],a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=p[0]-a[0],dz=p[2]-a[2],ex=b[0]-p[0],ez=b[2]-p[2];if(!i){dx=ex;dz=ez}if(i===pts.length-1){ex=dx;ez=dz}var l=Math.hypot(dx,dz),q=Math.hypot(ex,ez),n=[-dz/l,dx/l],m=[-ez/q,ex/q],mx=n[0]+m[0],mz=n[1]+m[1],ml=Math.hypot(mx,mz);if(ml<.001){mx=m[0];mz=m[1];ml=1}mx/=ml;mz/=ml;var r=Math.min(width,width/2/Math.max(.5,mx*m[0]+mz*m[1]));edges.push([[p[0]+mx*r,y,p[2]+mz*r],[p[0]-mx*r,y,p[2]-mz*r]])}for(var i=1;i<edges.length;i++)addQuad(edges[i-1][0],edges[i][0],edges[i][1],edges[i-1][1],[0,1,0],col,0)}
// One convex ground silhouette per sculpture, projected from its actual elements.
function shadow(model,pos){var pts=[];for(var e of model.elements)for(var x of [-1,1])for(var z of [-1,1])for(var h of [e.y,e.y+e.h])pts.push([pos[0]+e.x+x*e.w/2-h*.65/.82,0,pos[2]+e.z+z*e.d/2+h*.5/.82]);pts.sort((a,b)=>a[0]-b[0]||a[2]-b[2]);var cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]),hull=[];for(var p of pts){while(hull.length>1&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p)}var lower=hull.length;for(var p of pts.slice(0,-1).reverse()){while(hull.length>lower&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p)}hull.pop();polygon(hull,.035,[.70,.73,.67])}

function polygon(points,h,col){if(points.length<3)return;var pts=points.slice();if(pts[0][0]===pts.at(-1)[0]&&pts[0][2]===pts.at(-1)[2])pts.pop();var area=0;for(var i=0;i<pts.length;i++){var a=pts[i],b=pts[(i+1)%pts.length];area+=a[0]*b[2]-b[0]*a[2];if(h>.03){var len=Math.hypot(b[0]-a[0],b[2]-a[2]);if(len)addQuad([a[0],.05,a[2]],[b[0],.05,b[2]],[b[0],h,b[2]],[a[0],h,a[2]],[(b[2]-a[2])/len,0,(a[0]-b[0])/len],col,0)}}
if(area<0)pts.reverse();var ix=pts.map((_,i)=>i),guard=0;function cross(a,b,c){return (b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0])}while(ix.length>2&&guard++<pts.length*pts.length){var cut=false;for(var j=0;j<ix.length;j++){var ai=ix[(j+ix.length-1)%ix.length],bi=ix[j],ci=ix[(j+1)%ix.length],a=pts[ai],b=pts[bi],c=pts[ci];if(cross(a,b,c)<=0)continue;if(ix.some(k=>k!==ai&&k!==bi&&k!==ci&&cross(a,b,pts[k])>=0&&cross(b,c,pts[k])>=0&&cross(c,a,pts[k])>=0))continue;addTri([a[0],h,a[2]],[c[0],h,c[2]],[b[0],h,b[2]],[0,1,0],col,0);ix.splice(j,1);cut=true;break}if(!cut)break}}
function position(t){if(!t)return null;if(opts.mode==='archive'){var n=Number(t.id.slice(1))-1;return [(n%10-4.5)*24,0,(Math.floor(n/10)-3)*24]}var b=(data.buildings||[]).find(b=>b.id===t.building&&b.teamCount>1);if(b)return b.locationStatus==='unmapped'?null:project(b.lng,b.lat);return t.locationStatus==='unmapped'?null:project(t.lng,t.lat)}
function mix(a,b,f){return a.map((v,i)=>v+(b[i]-v)*f)}
function modelOf(id){for(var m of models)if(m.id===id)return m;return null}
function leadOf(building){for(var m of models)if(m.building===building&&m.shared.length)return m;return null}
function grouped(m){return opts.mode!=='archive'&&!!m&&m.buildingTeams.length>1}
/* Wing position: where this team's own structure stands once its object is shared. */
function wingPos(t){var p=position(t);if(!p)return null;var m=modelOf(t.id);return grouped(m)?[p[0]+m.wingOffset[0],p[1],p[2]+m.wingOffset[1]]:p}
function build(){if(!data)return;var started=performance.now();builds++;lastUploadBytes=0;resetGeometry();marks=[];hit=[];pickBoxes=[];arcs=[];
var dark=false,ground=dark?[.055,.085,.105]:[.9,.91,.86],stone=dark?[.15,.21,.24]:[.83,.85,.79],ink=dark?[.12,.18,.21]:[.77,.80,.75];
var key=[opts.mode==='archive'||opts.mode==='street',opts.layer==='geography'].join(':');
if(key!==staticKey||geo!==staticGeo){staticBuilds++;
addBox(0,-1,15,1400,1,1400,ground,0);
for(var x=-500;x<=500;x+=25)line([x,0,-500],[x,0,500],.028,ink,.008);for(var z=-500;z<=500;z+=25)line([-500,0,z],[500,0,z],.028,ink,.008);
chunk(0);
if(opts.mode!=='archive'&&opts.mode!=='street'&&geo){
/* Coordinates arrive quantized to integer microdegrees (see quantization in
   geography.json); decode once per feature. */
function coordsOf(f){if(f.coordinates)return f.coordinates;var q=f.q,out=[];for(var i=0;i<q.length;i+=2)out.push([q[i]/1e6,q[i+1]/1e6]);return out}
var cells=new Map();for(var feature of geo.features){var c0=coordsOf(feature),p=project(c0[0][0],c0[0][1]),cell=Math.floor(p[0]/40)+':'+Math.floor(p[2]/40);if(!cells.has(cell))cells.set(cell,{building:[],river:[],major:[],minor:[]});var slot=feature.kind==='building'?'building':feature.kind==='river'?'river':feature.roadClass==='primary'?'major':'minor';cells.get(cell)[slot].push(feature)}
for(var group of cells.values())for(var features of [group.building,group.river,group.major,group.minor]){var first=vertices.length/3;for(var f of features){var pts=coordsOf(f).map(p=>project(p[0],p[1]));if(f.kind==='building'){
 var real=opts.layer==='geography';
 polygon(pts,real?(f.height!==null?Math.max(.04,f.height/25):(f.levels!==null?Math.max(.04,f.levels*3/25):.04)):.022,stone);
 if(real){var mid=pts.reduce((a,p)=>[a[0]+p[0]/pts.length,0,a[2]+p[2]/pts.length],[0,0,0]);hit.push({id:f.id,pos:mid,role:'geography'})}
}else{var width=f.kind==='river'?9:f.roadClass==='primary'?.32:.13;if(f.kind==='river')ribbon(pts,width,[.54,.69,.68],.025);else for(var i=1;i<pts.length;i++)line(pts[i-1],pts[i],width,ink,.025)}}
chunk(first,features===group.minor?1:0)}}
upload(staticMesh);staticHits=hit.slice();staticKey=key;staticGeo=geo;
}else hit=staticHits.slice();
resetGeometry();
var palette=dark?[[.9,.55,.3],[.37,.72,.66],[.59,.63,.82],[.78,.68,.4]]:[[.78,.37,.19],[.19,.49,.44],[.45,.46,.63],[.65,.52,.27]];
var active=new Set((opts.claims||[]).map(c=>c.id)),filtered=['materials','time','questions','documents'].includes(opts.layer);
for(var t of data.teams){var pos=position(t);if(!pos||opts.visible&&!opts.visible.has(t.id))continue;var first=vertices.length/3,m=models.find(m=>m.id===t.id),shares=grouped(m),off=shares?m.wingOffset:[0,0],wing=[pos[0]+off[0],pos[1],pos[2]+off[1]],selected=t.id===opts.selected||shares&&m.building===opts.selected;
 if(m.records||m.archive)shadow(m,wing);
 var base=dark?[.50,.59,.60]:[.94,.91,.80],sourceCol=dark?[.39,.80,.76]:[.15,.43,.41];
 /* A shared object keeps one hue per team, so the part each team actually built
    stays legible inside the combined structure. The hue says who, never how good. */
 var own=shares?AtlasArchitecture.teamTint(m.teamSlot,m.teamCount,dark):null;
 var emit=function(e){var col=base,emis=.12,muted=filtered&&e.role==='record'&&!active.has(e.id);
   if(e.role==='empty'){col=dark?[.19,.28,.30]:[.66,.72,.65];emis=.12}
   if(e.role==='foundation'){col=dark?[.21,.29,.31]:[.70,.74,.66];if(own)col=mix(col,own,.45)}
   if(e.role==='core'){col=dark?[.29,.39,.41]:[.55,.63,.58];if(own)col=mix(col,own,.6)}
   if(e.role==='crown'&&own)col=mix(base,own,.5);
   if(e.role==='source'){col=sourceCol;emis=.5}
   // Delivered archive: paper-grey mass, lit only where a scan has actually been read.
   if(e.role==='archiveBase'||e.role==='archiveTier'){col=dark?[.21,.27,.31]:[.71,.73,.69];emis=.14}
   if(e.role==='archiveSpine'||e.role==='archiveGauge'){col=dark?[.28,.35,.39]:[.56,.60,.58];emis=.18}
   if(e.role==='archiveCrate'){col=dark?[.34,.44,.49]:[.69,.73,.70];emis=.06}
   if(e.role==='archiveProgress'){col=dark?[1,.70,.26]:[.88,.42,.10];emis=.72}
   if(e.role==='record'){col=palette[hash(e.section)%palette.length];emis=.25;if(muted){col=mix(ground,stone,.55);emis=.12}if(e.id===opts.claim){col=[.97,.67,.3];emis=.65}}
   if(selected&&['floor','crown'].includes(e.role)){col=dark?[.95,.77,.48]:[.92,.74,.43];emis=.3}
   var xx=wing[0]+e.x,zz=wing[2]+e.z;
   if(e.role!=='bridge')pickBoxes.push({id:((['record','source'].includes(e.role)&&!muted)||['archiveTier','archiveCrate'].includes(e.role))?e.id:t.id,team:t.id,building:m.building,role:e.role,tier:e.tier,files:e.files,mb:e.mb,lod:e.role==='archiveCrate'?1:0,min:[xx-e.w/2,e.y,zz-e.d/2],max:[xx+e.w/2,e.y+e.h,zz+e.d/2],opening:e.opening,w:e.w,d:e.d});
   if(e.role==='bridge'){var dx=e.end[0],dz=e.end[1],length=Math.hypot(dx,dz),nx=-dz/length*.22,nz=dx/length*.22;addQuad([wing[0]+nx,e.y,wing[2]+nz],[wing[0]+dx+nx,e.y,wing[2]+dz+nz],[wing[0]+dx-nx,e.y,wing[2]+dz-nz],[wing[0]-nx,e.y,wing[2]-nz],[0,1,0],col,emis)}
   else if(e.opening){var horizontal=e.w>e.d;addBox(xx,e.y,zz,e.w,.12,e.d,col,emis);addBox(xx,e.y+e.h-.12,zz,e.w,.12,e.d,col,emis);for(var sign of [-1,1])addBox(xx+(horizontal?sign*e.w/2:0),e.y,zz+(horizontal?0:sign*e.d/2),horizontal?.12:e.w,e.h,horizontal?e.d:.12,col,emis)}
   else if(e.role==='record'&&!muted){
     // Category changes the facade's construction, not the count or evidence status.
     var horizontal=e.w>e.d,categories={materials:[.66,.45,.22],time:[.38,.48,.63],documents:[.22,.48,.44],questions:[.72,.34,.23]},face=categories[e.category]||col;
     if(e.id===opts.claim)face=[.97,.67,.3];
     addBox(xx,e.y,zz,e.w,e.h,e.d,face,emis);
     if(e.category==='materials')for(var k of [-.8,0,.8])addBox(xx+(horizontal?k:0),e.y,zz+(horizontal?0:k),horizontal?.10:e.w+.08,e.h,horizontal?e.d+.08:.10,base,.2);
     if(e.category==='time')for(var k of [.45,1,1.55])addBox(xx,e.y+k,zz,e.w+.04,.055,e.d+.04,base,.2);
     if(e.category==='documents'){addBox(xx,e.y+.18,zz,e.w+.04,.055,e.d+.04,base,.2);addBox(xx,e.y+e.h-.18,zz,e.w+.04,.055,e.d+.04,base,.2)}
   }else addBox(xx,e.y,zz,e.w,e.h,e.d,col,emis);
   if(['record','source'].includes(e.role)&&!muted)hit.push({id:e.id,team:t.id,pos:[xx,e.y+e.h/2,zz],role:e.role});
   if(e.role==='archiveTier')hit.push({id:t.id,team:t.id,pos:[xx,e.y+e.h/2,zz],role:'archive',tier:e.tier,files:e.files,mb:e.mb,read:e.read});
 };
 for(var e of m.elements)if(e.role!=='archiveCrate')emit(e);
 /* The object itself: a plinth all its teams stand on, a terrace, spoke and pylon
    per team in that team's own hue, and a mast whose height is the record count
    of every team together. The whole is one structure; the parts stay named. */
 if(shares&&m.shared.length){var chosen=m.building===opts.selected||m.buildingTeams.includes(opts.selected),plinthCol=dark?[.19,.27,.29]:[.80,.82,.75];
  for(var e of m.shared){
   var partTint=e.slots?AtlasArchitecture.teamTint(e.slot,e.slots,dark):null;
   var col=e.role==='mast'?(dark?[.93,.73,.43]:[.74,.52,.24]):e.role==='ring'?(dark?[.95,.77,.48]:[.88,.70,.40]):partTint?mix(plinthCol,partTint,e.role==='pylon'?.88:e.role==='bridge'?.75:.5):plinthCol,
       emis=e.role==='mast'?.4:e.role==='ring'?.34:e.role==='pylon'?.42:e.role==='terrace'?.2:.14;
   if(chosen&&e.role==='ring'){col=dark?[.98,.82,.55]:[.95,.78,.46];emis=.5}
   if(partTint&&e.team===opts.selected){col=mix(col,dark?[1,.96,.82]:[1,.93,.72],.3);emis=.55}
   var xx=pos[0]+e.x,zz=pos[2]+e.z;
   if(e.role==='bridge'){var dx=e.end[0],dz=e.end[1],length=Math.hypot(dx,dz)||1,nx=-dz/length*.3,nz=dx/length*.3;addQuad([pos[0]+nx,e.y,pos[2]+nz],[pos[0]+dx+nx,e.y,pos[2]+dz+nz],[pos[0]+dx-nx,e.y,pos[2]+dz-nz],[pos[0]-nx,e.y,pos[2]-nz],[0,1,0],col,emis);continue}
   /* A team's ground is drawn as a rim, never a filled plate: the first version
      covered a neighbouring object at phone width (see shots 2026-10-21). */
   if(e.role==='terrace'){var bw=.46,half=e.w/2;for(var q of [[0,-half+bw/2,e.w,bw],[0,half-bw/2,e.w,bw],[-half+bw/2,0,bw,Math.max(bw,e.w-2*bw)],[half-bw/2,0,bw,Math.max(bw,e.w-2*bw)]])addBox(xx+q[0],e.y,zz+q[1],q[2],e.h,q[3],col,emis)}
   else addBox(xx,e.y,zz,e.w,e.h,e.d,col,emis);
   // Picking follows the visible rim too: empty terrace centres must not steal neighbour clicks.
   var hitRects=e.role==='terrace'?[[0,-e.d/2+.23,e.w,.46],[0,e.d/2-.23,e.w,.46],[-e.w/2+.23,0,.46,e.d-.92],[e.w/2-.23,0,.46,e.d-.92]]:[[0,0,e.w,e.d]];
   for(var hr of hitRects)pickBoxes.push({id:['terrace','pylon'].includes(e.role)?e.team:e.building,team:e.team||t.id,building:e.building,role:e.role,min:[xx+hr[0]-hr[2]/2,e.y,zz+hr[1]-hr[3]/2],max:[xx+hr[0]+hr[2]/2,e.y+e.h,zz+hr[1]+hr[3]/2],w:hr[2],d:hr[3]});
   if(e.role==='mast')hit.push({id:e.building,team:t.id,pos:[xx,e.y+e.h/2,zz],role:'building',teams:m.buildingTeams.slice(),records:m.buildingRecords});
   if(e.role==='pylon')hit.push({id:e.team,team:e.team,pos:[xx,e.y+e.h/2,zz],role:'teamPart',building:e.building,records:e.records});
  }}
 chunk(first);
 // 289 archive crates are one contiguous detail level: droppable from afar, intact up close.
 if(m.archive){var crates=vertices.length/3;for(var e of m.elements)if(e.role==='archiveCrate')emit(e);chunk(crates,1)}
 if(shares){
   marks.push({id:t.id,pos:[wing[0],m.height+1,wing[2]],base:wing,label:t.id,selected:t.id===opts.selected,records:m.records,teams:[t.id],parent:m.building,title:t.object+' · '+t.id});
   if(m.shared.length)marks.push({id:m.building,pos:[pos[0],(m.buildingHeight||m.height)+1.2,pos[2]],base:pos,label:String(m.buildingTeams.length),selected:m.building===opts.selected||m.buildingTeams.includes(opts.selected),records:m.buildingRecords,teams:m.buildingTeams.slice(),title:m.buildingObject+' · '+m.buildingTeams.join(' · ')});
 }else marks.push({id:t.id,pos:[pos[0],m.height+1,pos[2]],base:pos,label:t.id,selected,records:m.records,teams:[t.id],title:t.object});
}
// Arcs exist only for an explicit relation with resolvable evidence, never proximity.
if(opts.connections)for(var rel of data.relations){var a=data.teams.find(t=>t.id===rel.from),b=data.teams.find(t=>t.id===rel.to),pa=wingPos(a),pb=wingPos(b);if(!pa||!pb||opts.visible&&(!opts.visible.has(a.id)||!opts.visible.has(b.id)))continue;
 var ah=models.find(m=>m.id===a.id).height,bh=models.find(m=>m.id===b.id).height,points=[];for(var i=0;i<=32;i++){var t=i/32;points.push([pa[0]+(pb[0]-pa[0])*t,ah+(bh-ah)*t+Math.sin(t*Math.PI)*Math.min(30,Math.hypot(pb[0]-pa[0],pb[2]-pa[2])*.2),pa[2]+(pb[2]-pa[2])*t])}arcs.push({id:rel.id,from:rel.from,to:rel.to,url:rel.url,points});
}
labels?.replaceChildren();labelNodes.clear();for(var m of marks){var el=document.createElement('button'),span=document.createElement('span');span.textContent=m.label;el.append(span);el.title=m.title;el.dataset.id=m.id;el.setAttribute('aria-label',m.label+' · '+m.title);el.className=[m.selected?'selected':'',m.teams&&m.teams.length>1?'shared':''].filter(Boolean).join(' ');(function(id){el.onclick=function(){onPick(id)}})(m.id);labels?.append(el);labelNodes.set(m.id,el)}
if(links){links.replaceChildren();for(var a of arcs){var p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('class','relation-line');p.dataset.id=a.id;p.onclick=()=>{};(function(id){p.onclick=function(){onPick(id)}})(a.id);links.append(p);a.path=p;var dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('r','2.6');dot.setAttribute('class','relation-pulse');links.append(dot);a.dot=dot}}
upload(teamMesh);buildMs=performance.now()-started;invalidate();}
function invalidate(){if(!frame&&!document.hidden&&inView)frame=requestAnimationFrame(render)}
function screen(p,w,h){var x=p[0]*mvpMat[0]+p[1]*mvpMat[4]+p[2]*mvpMat[8]+mvpMat[12],y=p[0]*mvpMat[1]+p[1]*mvpMat[5]+p[2]*mvpMat[9]+mvpMat[13],z=p[0]*mvpMat[2]+p[1]*mvpMat[6]+p[2]*mvpMat[10]+mvpMat[14],q=p[0]*mvpMat[3]+p[1]*mvpMat[7]+p[2]*mvpMat[11]+mvpMat[15];return q>0&&z>=-q&&z<=q?[w*(x/q*.5+.5),h*(.5-y/q*.5)]:[-10000,-10000]}
function splitLabel(m){return opts.mode==='street'||cam.dist<110||(opts.selected===m.id&&cam.dist<160)}
function overlays(rect,now){var taken=[],count=0,limit=rect.width<600?9:16,scale=Math.max(.55,Math.min(1,90/cam.dist));
for(var m of [...marks].sort((a,b)=>Number(b.selected)-Number(a.selected)||Number(!!b.parent)-Number(!!a.parent)||(b.id===hover)-(a.id===hover)||b.records-a.records)){
 var el=labelNodes.get(m.id),p=screen(m.pos,rect.width,rect.height);if(!el)continue;
 var parent=m.parent&&marks.find(q=>q.id===m.parent),split=parent?splitLabel(parent):splitLabel(m),eligible=m.parent?split:!(m.teams.length>1&&split);
 var important=m.selected||m.id===hover||!!parent&&parent.selected,show=eligible&&(important||(m.records>0||m.teams.length>1||m.parent||opts.layer==='teams')&&count<limit)&&p[0]>16&&p[0]<rect.width-16&&p[1]>66&&p[1]<rect.height-76&&!taken.some(q=>Math.abs(q[0]-p[0])<29&&Math.abs(q[1]-p[1])<22);
 if(show&&opts.mode==='street'){var occluder=findPick({clientX:rect.left+p[0],clientY:rect.top+p[1]}),range=Math.hypot(m.pos[0]-walk.pos[0],m.pos[1]-walk.pos[1],m.pos[2]-walk.pos[2]);if(occluder?.distance<range-.3)show=false}
 el.hidden=!show;if(!show)continue;count++;taken.push(p);el.style.left=p[0]+'px';el.style.top=p[1]+'px';var sc=opts.mode==='street'?Math.max(.55,Math.min(1,18/Math.hypot(m.pos[0]-walk.pos[0],m.pos[1]-walk.pos[1],m.pos[2]-walk.pos[2]))):scale;el.firstChild.style.transform='scale('+sc+')';el.dataset.scale=sc;
}
if(opts.mode==='street'){aim=findPick({clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2});var cross=document.querySelector('.crosshair'),hint=document.getElementById('aim-label');cross?.classList.toggle('target',!!aim);if(cross)cross.dataset.target=aim?.id||'';var claim=data.claims.find(c=>c.id===aim?.id),source=data.sources.find(s=>s.id===aim?.id),team=data.teams.find(t=>t.id===(aim?.team||aim?.id)),text=claim?claim.title:source?source.label:aim?.tier?aim.tier:team?team.id+' / '+team.object:'';if(hint)hint.textContent=text;var pick=document.getElementById('walk-pick');if(pick)pick.disabled=!aim}else{aim=null;document.getElementById('aim-label').textContent=''}
if(links){links.setAttribute('viewBox','0 0 '+rect.width+' '+rect.height);for(var a of arcs){var points=a.points.map(p=>screen(p,rect.width,rect.height));var clipped=opts.mode==='street'||points.some(p=>p[0]===-10000);a.path.style.display=clipped?'none':'';a.dot.style.display=clipped?'none':'';if(clipped)continue;a.path.setAttribute('d',points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2)).join(' '));var phase=opts.motion&&!reduced.matches?(now%6000)/6000:.5,index=phase*32,lo=Math.floor(index),hi=Math.min(32,lo+1),p=mix(points[lo],points[hi],index-lo);a.dot.setAttribute('cx',p[0]);a.dot.setAttribute('cy',p[1]);a.dot.style.visibility=opts.motion&&!reduced.matches?'visible':'hidden'}}
}
function render(now){frame=0;if(document.hidden||!inView)return;frames++;if(opts.mode==='street')stepWalk(now);if(transition){var f=reduced.matches?1:Math.min(1,(now-transition.start)/550),e=1-Math.pow(1-f,3);for(var k of ['yaw','pitch','dist'])cam[k]=transition.from[k]+(transition.to[k]-transition.from[k])*e;cam.target=transition.from.target.map((v,i)=>v+(transition.to.target[i]-v)*e);if(f===1)transition=null;else invalidate()}
var growth=reduced.matches||!growthStart?1:Math.min(1,(now-growthStart)/950);if(growth<1)invalidate();
var rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,opts.quality==='eco'?1:opts.quality==='high'?2:1.6,Math.sqrt((opts.quality==='high'?2400000:opts.quality==='eco'?650000:1400000)/Math.max(1,rect.width*rect.height))),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);var sky=opts.night?[.055,.085,.105]:[.9,.91,.86];gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(prog);var d=cam.dist,cy=cam.pitch,cx=cam.yaw,eye=[cam.target[0]+d*Math.cos(cy)*Math.sin(cx),cam.target[1]+d*Math.sin(cy),cam.target[2]+d*Math.cos(cy)*Math.cos(cx)];
var target=cam.target;if(opts.mode==='street'){eye=walk.pos;target=[eye[0]-Math.sin(walk.yaw)*Math.cos(walk.pitch),eye[1]+Math.sin(walk.pitch),eye[2]-Math.cos(walk.yaw)*Math.cos(walk.pitch)];M4.perspective(pMat,Math.PI/3,w/h,.05,2200)}else M4.ortho(pMat,-d*w/h*.5,d*w/h*.5,-d*.5,d*.5,.1,2200);M4.lookAt(vMat,eye,target,[0,1,0]);M4.multiply(mvpMat,pMat,vMat);gl.uniformMatrix4fv(uMVP,false,mvpMat);gl.uniformMatrix4fv(uModel,false,mMat);gl.uniform3f(uSunDir,.65,.82,-.5);gl.uniform3fv(uSkyColor,sky);gl.uniform3fv(uEye,eye);gl.uniform1f(uNight,opts.night?1:0);drawCalls=0;drawnTriangles=0;culledChunks=0;lodSkipped=0;gl.uniform1f(uGrowth,1);drawMesh(staticMesh);gl.uniform1f(uGrowth,1-Math.pow(1-growth,3));drawMesh(teamMesh);
overlays(rect,now);if(opts.motion&&arcs.length&&!reduced.matches)invalidate();}
function fly(to){transition={from:{...cam,target:cam.target.slice()},to:{...cam,...to},start:performance.now()};invalidate()}
function home(){if(opts.mode==='street'){enterStreet(opts.selected);return}fly({target:opts.mode==='archive'?[0,0,0]:[12,2,10],dist:opts.mode==='archive'?235:(canvas.clientWidth<600?155:155),yaw:-.35,pitch:opts.mode==='plan'?1.55:.8})}
function findPick(e,onlyTeams=false){var rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,best=null,dist=onlyTeams?22:18;
 if(!onlyTeams){var right=[vMat[0],vMat[4],vMat[8]],up=[vMat[1],vMat[5],vMat[9]],back=[vMat[2],vMat[6],vMat[10]],rx=(x/rect.width-.5)*cam.dist*rect.width/rect.height,uy=(.5-y/rect.height)*cam.dist;
 var origin=cam.target.map((v,i)=>v+back[i]*cam.dist+right[i]*rx+up[i]*uy),dir=back.map(v=>-v),nearest=Infinity;
 if(opts.mode==='street'){origin=walk.pos.slice();rx=(x/rect.width*2-1)*Math.tan(Math.PI/6)*rect.width/rect.height;uy=(1-y/rect.height*2)*Math.tan(Math.PI/6);dir=back.map((v,i)=>-v+right[i]*rx+up[i]*uy);var length=Math.hypot(...dir);dir=dir.map(v=>v/length)}
 for(var b of pickBoxes){if(b.lod&&opts.mode!=='street'&&opts.quality!=='high'&&(cam.dist>260||.13*canvas.clientHeight/cam.dist<.75))continue;var near=0,far=Infinity;for(var axis=0;axis<3;axis++){if(Math.abs(dir[axis])<1e-8){if(origin[axis]<b.min[axis]||origin[axis]>b.max[axis]){far=-1;break}}else{var t1=(b.min[axis]-origin[axis])/dir[axis],t2=(b.max[axis]-origin[axis])/dir[axis];near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2))}}
 if(far<near||near>=nearest)continue;
 if(b.opening){var point=origin.map((v,i)=>v+near*dir[i]),axis=b.w>b.d?0:2;if(point[1]>b.min[1]+.15&&point[1]<b.max[1]-.15&&point[axis]>b.min[axis]+.15&&point[axis]<b.max[axis]-.15)continue}
 nearest=near;best=b}
 if(best){best={...best,distance:nearest};if(best.building&&['plinth','mast','ring'].includes(best.role))return {id:best.building,team:best.team,building:best.building,distance:nearest};
 if(best.building&&['terrace','pylon'].includes(best.role)&&opts.mode!=='street'&&cam.dist>160)return {id:best.building,team:best.team,building:best.building,distance:nearest};return opts.mode!=='street'&&cam.dist>115?{id:best.team,team:best.team,building:best.building}:best}
 }
 if(opts.mode==='street')return null;
 for(var m of (onlyTeams?[]:hit.filter(h=>h.role==='geography')).concat(marks)){if(labelNodes.has(m.id)&&labelNodes.get(m.id).hidden)continue;var p=screen(m.pos,rect.width,rect.height),v=Math.hypot(p[0]-x,p[1]-y);if(v<dist){best=m;dist=v}}return best}
var surface=canvas.closest('.stage')||canvas,suppressClickUntil=0;
surface.addEventListener('click',e=>{if(!e.target.closest('.camera,.walk-controls')&&performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
function panPixels(dx,dy){var unit=cam.dist/Math.max(1,canvas.clientHeight),sy=Math.max(.25,Math.sin(cam.pitch));cam.target[0]-=(dx*Math.cos(cam.yaw)-dy*Math.sin(cam.yaw)/sy)*unit;cam.target[2]-=(-dx*Math.sin(cam.yaw)-dy*Math.cos(cam.yaw)/sy)*unit}
surface.addEventListener('pointerdown',e=>{if(e.target.closest('.camera,.walk-controls'))return;canvas.focus({preventScroll:true});transition=null;surface.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(!drag)drag={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false,label:e.target.closest('#map-labels button,.relation-line')?.dataset.id};else drag.moved=true;});
surface.addEventListener('pointermove',e=>{if(e.target.closest('.camera,.walk-controls'))return;if(!drag){if(e.pointerType==='touch')return;var m=findPick(e,true);if(hover!==(m?.id||'')){hover=m?.id||'';invalidate()}return}if(!pointers.has(e.pointerId))return;
 if(pointers.size>=2){var old=[...pointers.values()],oldDist=Math.hypot(old[0][0]-old[1][0],old[0][1]-old[1][1]);pointers.set(e.pointerId,[e.clientX,e.clientY]);var ps=[...pointers.values()],newDist=Math.hypot(ps[0][0]-ps[1][0],ps[0][1]-ps[1][1]);if(opts.mode!=='street'){if(oldDist&&newDist)cam.dist=Math.max(18,Math.min(700,cam.dist*oldDist/newDist));panPixels((ps[0][0]+ps[1][0]-old[0][0]-old[1][0])/2,(ps[0][1]+ps[1][1]-old[0][1]-old[1][1])/2)}drag.moved=true;invalidate();return}
 var prev=pointers.get(e.pointerId),dx=e.clientX-prev[0],dy=e.clientY-prev[1];if(opts.mode==='street'){walk.yaw+=dx*.006;walk.pitch=Math.max(-1.2,Math.min(1.2,walk.pitch-dy*.006))}else if(e.shiftKey||e.buttons===2||opts.gesture==='pan')panPixels(dx,dy);else{cam.yaw+=dx*.006;cam.pitch=Math.max(.25,Math.min(1.55,cam.pitch+dy*.006))}pointers.set(e.pointerId,[e.clientX,e.clientY]);drag.x=e.clientX;drag.y=e.clientY;drag.moved=drag.moved||Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>5;invalidate()});
function endPointer(e,cancel){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(!drag)return;if(!cancel&&!drag.moved&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<6){var best=drag.label?{id:drag.label}:findPick(e);if(best)onPick(best.id,best.team)}suppressClickUntil=performance.now()+350;if(pointers.size){var [id,p]=pointers.entries().next().value;drag={id,x:p[0],y:p[1],sx:p[0],sy:p[1],moved:true}}else drag=null}
surface.addEventListener('pointerup',e=>endPointer(e,false));surface.addEventListener('pointercancel',e=>endPointer(e,true));surface.addEventListener('lostpointercapture',e=>endPointer(e,true));window.addEventListener('blur',()=>{drag=null;pointers.clear()});
surface.addEventListener('wheel',e=>{if(e.target.closest('.camera,.walk-controls'))return;if(opts.mode==='street')return;if(!opts.interactive&&!e.ctrlKey)return;e.preventDefault();transition=null;cam.dist=Math.max(18,Math.min(700,cam.dist*(e.deltaY>0?1.09:.91)));invalidate()},{passive:false});canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('scene-status').textContent='3D paused · Lista i dosijei / List and dossiers ↓'});canvas.addEventListener('webglcontextrestored',()=>location.reload());
new ResizeObserver(invalidate).observe(canvas);document.addEventListener('visibilitychange',invalidate);reduced.addEventListener('change',invalidate);new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)invalidate()}).observe(canvas);
function geometryKey(o){return JSON.stringify([o.mode==='archive',o.mode==='street',o.layer,o.selected,o.claim,[...(o.visible||[])].sort(),(o.claims||[]).map(c=>c.id).sort(),o.connections])}
return {stop:stopWalk,setCulling(value){culling=!!value;invalidate()},update(d,g,o){var change=opts.mode!==o.mode,revision=data?.datasetRevision!==d.datasetRevision,rebuild=data!==d||geo!==g||geometryKey(opts)!==geometryKey(o);if(data!==d)models=AtlasArchitecture.compile(d);data=d;geo=g;opts=o;if(revision)growthStart=performance.now();if(rebuild)build();else invalidate();if(change){stopWalk();home()}},focus(id){if(opts.mode==='street'){enterStreet(id);return}var lead=leadOf(id);if(lead&&opts.mode!=='archive'){var lt=data.teams.find(t=>t.id===lead.id),lp=lt&&position(lt);if(lp){fly({target:[lp[0],(lead.buildingHeight||0)*.4,lp[2]],dist:Math.max(52,(lead.buildingSpan||40)*1.9,(lead.buildingSpan||40)*1.28/Math.max(.25,canvas.clientWidth/canvas.clientHeight)),pitch:opts.mode==='plan'?1.55:.72});return}}var t=data.teams.find(t=>t.id===id),p=t&&wingPos(t),m=models.find(m=>m.id===id);if(p)fly({target:[p[0],(m?.height||0)*.35,p[2]],dist:Math.max(40,(m?.height||0)*2.5,(m?AtlasArchitecture.footprint(m)*2:12)*1.28/Math.max(.25,canvas.clientWidth/canvas.clientHeight)),pitch:opts.mode==='plan'?1.55:.75})},home,zoom(f){if(opts.mode==='street')return;transition=null;cam.dist=Math.max(18,Math.min(700,cam.dist*f));invalidate()},replay(){growthStart=performance.now();invalidate()},stats(){return {pixels:canvas.width*canvas.height,quality:opts.quality||'auto',geographyVisible:opts.mode!=='street'&&opts.mode!=='archive',frames,triangles:(staticMesh.count+teamMesh.count)/3,buffers:8,drawnTriangles,culledChunks,lodSkipped,chunks:staticMesh.chunks.length+teamMesh.chunks.length,builds,staticBuilds,uploadedBytes,lastUploadBytes,buildMs,pickBoxes:pickBoxes.length,pending:!!frame,distance:cam.dist,street:opts.mode==='street',night:!!opts.night,visibleLabels:[...labelNodes.values()].filter(n=>!n.hidden).length,structures:models.filter(m=>m.records||m.archive).length,archives:models.filter(m=>m.archive).length,archiveCrates:models.reduce((n,m)=>n+(m.archive?m.archive.crates:0),0),archiveRead:models.reduce((n,m)=>n+(m.archive?m.archive.read:0),0),teamParts:models.reduce((n,m)=>n+m.shared.filter(e=>e.role==='terrace').length,0),buildings:new Set(models.map(m=>m.building)).size,sharedBuildings:models.filter(m=>m.shared.length).length,sharedTeams:models.filter(m=>m.buildingTeams.length>1).length,recordElements:models.reduce((n,m)=>n+m.records,0),sourcePillars:models.reduce((n,m)=>n+m.sources,0),arcs:arcs.length,drawCalls,inView}},inspect(){var r=canvas.getBoundingClientRect();return {camera:{...cam},aim:aim?{id:aim.id,team:aim.team,role:aim.role,tier:aim.tier}:null,joystick:{x:stick.x,y:stick.y},street:opts.mode==='street'?{...walk,pos:walk.pos.slice()}:null,elements:hit.map(m=>({...m,screen:screen(m.pos,r.width,r.height)})),marks:marks.map(m=>({...m,screen:screen(m.pos,r.width,r.height)}))}},dispose(){if(frame)cancelAnimationFrame(frame);[...staticMesh.buffers,...teamMesh.buffers].forEach(b=>gl.deleteBuffer(b));gl.deleteProgram(prog)}};
};
