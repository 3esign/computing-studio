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
    'uniform float uContact;',
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
    '  // Bases sit into the ground instead of floating on it.',
    '  vLight *= mix(1.0, mix(0.60, 1.0, clamp(worldPos.y * 0.42, 0.0, 1.0)), uContact);',
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
    'uniform vec3 uHorizon;',
    'uniform vec2 uFog;',
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
    '  float fog = smoothstep(uFog.x, uFog.y, vDist);',
    '  vec3 finalColor = mix(lit, uHorizon, fog * fog * 0.96);',
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
  var uHorizon = gl.getUniformLocation(prog, 'uHorizon');
  var uFog = gl.getUniformLocation(prog, 'uFog');
  var uContact = gl.getUniformLocation(prog, 'uContact');

  var aPos = gl.getAttribLocation(prog, 'aPos');
  var aNormal = gl.getAttribLocation(prog, 'aNormal');
  var aColor = gl.getAttribLocation(prog, 'aColor');
  var aEmissive = gl.getAttribLocation(prog, 'aEmissive');

  /* One generated noise field, shared by the sky deck, the ground shadow of
     the same deck and the grain on the water. Nothing here is downloaded and
     nothing is a measurement of weather. */
  var NOISE_GLSL=[
   'float wHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
   'float wNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
   ' return mix(mix(wHash(i),wHash(i+vec2(1.0,0.0)),f.x),mix(wHash(i+vec2(0.0,1.0)),wHash(i+vec2(1.0,1.0)),f.x),f.y);}',
   'float wFbm(vec2 p){return wNoise(p)*0.54+wNoise(p*2.03+13.1)*0.29+wNoise(p*4.11+7.7)*0.17;}',
   // Two decks drifting at different speeds: the overlap is what makes a flat
   // shape read as weather instead of a moving stain.
   'float wCover(vec2 p,float t){',
   // Scale is chosen against the sheet: one cloud is ~50 units (1.2 km) wide,
   // so the deck reads as a handful of shapes and not as grain on the paper.
   ' float a=wFbm(p*0.020+vec2(t*0.0080,t*0.0030));',
   // The second deck only has to be broad, so one octave buys the same
   // picture for a third of the cost on a phone.
   ' float b=wNoise(p*0.0075+vec2(t*0.0024,-t*0.0009)+41.0);',
   ' return a*0.60+b*0.40;}'
  ].join('\n');
  var skyProgram=gl.createProgram();
  gl.attachShader(skyProgram,createShader(gl,gl.VERTEX_SHADER,'attribute vec2 aSky; varying vec2 vSky; void main(){vSky=aSky;gl_Position=vec4(aSky,1.0,1.0);}'));
  gl.attachShader(skyProgram,createShader(gl,gl.FRAGMENT_SHADER,`
precision mediump float;
varying vec2 vSky;
uniform vec3 sRight,sUp,sForward;
uniform float sAspect,sNight,sStreet,sTime;
`+NOISE_GLSL+`
void main(){
 vec3 ray=normalize(sForward+(sRight*vSky.x*sAspect+sUp*vSky.y)*0.57735);
 float elevation=mix(max(vSky.y*.45+.35,0.015),ray.y,sStreet);
 vec3 horizon=mix(vec3(.90,.91,.86),vec3(.16,.22,.25),sNight);
 vec3 zenith=mix(vec3(.43,.61,.65),vec3(.025,.055,.09),sNight);
 float band=floor(clamp(elevation,0.0,1.0)*12.0)/12.0;
 vec3 color=mix(horizon,zenith,smoothstep(0.0,.85,elevation)*.85+band*.15);
 float az=atan(ray.z,ray.x);
 float facets=abs(fract(az*3.8197)*2.0-1.0);
 color+=vec3(.013,.017,.016)*facets*smoothstep(.05,.55,elevation);
 // The same cloud deck that casts the shadow on the map, seen from below:
 // the ray is cut against a flat ceiling, so the shapes foreshorten toward
 // the horizon instead of sitting on the glass.
 // Only street mode ever shows this sky: from the orbit camera the ground
 // plane covers it, and paying for the noise there is paying for nothing.
 if(sStreet>0.5){
  float ceiling=240.0;
  float up=max(ray.y,0.02);
  vec2 deck=vec2(ray.x,ray.z)*(ceiling/up);
  float cover=wCover(deck,sTime);
  float edge=smoothstep(0.50,0.66,cover);
  float tier=floor(edge*3.0+0.001)/3.0+smoothstep(0.62,0.80,cover)*0.34;
  vec3 cloudInk=mix(mix(vec3(.80,.82,.78),vec3(1.0,.99,.96),tier),mix(vec3(.10,.14,.18),vec3(.22,.27,.33),tier),sNight);
  color=mix(color,cloudInk,edge*0.78*smoothstep(0.015,0.16,elevation));}
 vec3 below=mix(vec3(.55,.59,.53),vec3(.055,.085,.105),sNight);
 color=mix(below,color,smoothstep(-.035,.015,elevation));
 gl_FragColor=vec4(color,1.0);
}`));
  gl.linkProgram(skyProgram);
  if(!gl.getProgramParameter(skyProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(skyProgram));
  var skyBuffer=gl.createBuffer(),skyAttribute=gl.getAttribLocation(skyProgram,'aSky');
  gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  var vignetteProgram=gl.createProgram();
  gl.attachShader(vignetteProgram,createShader(gl,gl.VERTEX_SHADER,'attribute vec2 aSky; varying vec2 vV; void main(){vV=aSky;gl_Position=vec4(aSky,1.0,1.0);}'));
  gl.attachShader(vignetteProgram,createShader(gl,gl.FRAGMENT_SHADER,`
precision mediump float;
varying vec2 vV;
uniform float vNight;
void main(){
 float r=length(vec2(vV.x*0.88,vV.y));
 float a=smoothstep(0.66,1.42,r)*mix(0.26,0.46,vNight);
 vec3 c=mix(vec3(.106,.149,.141),vec3(.0,.012,.016),vNight);
 gl_FragColor=vec4(c,a);
}`));
  gl.linkProgram(vignetteProgram);
  if(!gl.getProgramParameter(vignetteProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(vignetteProgram));
  var vignetteAttribute=gl.getAttribLocation(vignetteProgram,'aSky'),uVignetteNight=gl.getUniformLocation(vignetteProgram,'vNight');
  function drawVignette(){
   gl.useProgram(vignetteProgram);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   for(var a of [aPos,aNormal,aColor,aEmissive])gl.disableVertexAttribArray(a);
   gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);gl.enableVertexAttribArray(vignetteAttribute);gl.vertexAttribPointer(vignetteAttribute,2,gl.FLOAT,false,0,0);
   gl.uniform1f(uVignetteNight,opts.night?1:0);gl.drawArrays(gl.TRIANGLES,0,3);
   gl.disableVertexAttribArray(vignetteAttribute);gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(prog);
  }
  /* Weather and water. Two stylized layers, both generated — no texture is
     downloaded and no frame is a photograph:

     1. A drifting cloud deck. From the orbit camera the sky is almost never
        on screen (the ground plane fills it), so the deck is read on the
        ground as a shadow: a flat, banded darkening that moves across the
        sheet. In street mode the same noise is drawn in the sky itself.
     2. A flow overlay on the river. The still ribbon stays exactly as it was;
        over it travel crest bands along the centreline, so the Sava and the
        Danube read as moving water instead of a blue shape.

     Neither layer is a measurement. Cloud cover is not today's weather and
     the flow speed is not the river's speed; both are declared on the page.
     Everything stops under prefers-reduced-motion. */
  var cloudProgram=gl.createProgram();
  gl.attachShader(cloudProgram,createShader(gl,gl.VERTEX_SHADER,
   'attribute vec3 aCloud; uniform mat4 cMVP; varying vec2 vGround; void main(){vGround=aCloud.xz;gl_Position=cMVP*vec4(aCloud,1.0);}'));
  gl.attachShader(cloudProgram,createShader(gl,gl.FRAGMENT_SHADER,[
   'precision mediump float;',
   'varying vec2 vGround;',
   'uniform float cTime,cNight,cFade;',
   NOISE_GLSL,
   'void main(){',
   ' float cover=wCover(vGround,cTime);',
   // Three flat tiers, the same banding the sky already uses.
   ' float edge=smoothstep(0.50,0.66,cover);',
   ' float tier=floor(edge*3.0+0.001)/3.0+smoothstep(0.62,0.80,cover)*0.34;',
   ' float a=edge*(0.080+tier*0.105)*cFade;',
   ' vec3 c=mix(vec3(0.42,0.46,0.44),vec3(0.02,0.05,0.08),cNight);',
   ' gl_FragColor=vec4(c,a);',
   '}'].join('\n')));
  gl.linkProgram(cloudProgram);
  if(!gl.getProgramParameter(cloudProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(cloudProgram));
  var aCloud=gl.getAttribLocation(cloudProgram,'aCloud'),cloudBuffer=gl.createBuffer(),cloudCount=0;
  var uCloud={};for(var cname of ['cMVP','cTime','cNight','cFade'])uCloud[cname]=gl.getUniformLocation(cloudProgram,cname);
  var waterProgram=gl.createProgram();
  gl.attachShader(waterProgram,createShader(gl,gl.VERTEX_SHADER,
   'attribute vec3 aWater; attribute vec2 aFlow; uniform mat4 wMVP; varying vec2 vFlow; void main(){vFlow=aFlow;gl_Position=wMVP*vec4(aWater,1.0);}'));
  gl.attachShader(waterProgram,createShader(gl,gl.FRAGMENT_SHADER,[
   'precision mediump float;',
   'varying vec2 vFlow;',       // x: distance along the centreline, y: -1..1 across
   'uniform float fTime,fNight;',
   NOISE_GLSL,
   'void main(){',
   ' float lane=vFlow.y;',                 // -1 left bank, +1 right bank
   ' float bank=1.0-abs(lane);',
   // Filaments: thin lines that keep their lane and slide downstream. Their
   // speed drops toward the banks, the way a current actually reads.
   ' float speed=mix(0.55,1.0,bank);',
   ' float lanePhase=wNoise(vec2(lane*2.7,3.1))*9.0;',
   ' float s=vFlow.x*0.085-fTime*0.055*speed+lanePhase;',
   ' float wave=sin(s*6.2831);',
   ' float filament=smoothstep(0.80,0.995,wave)*smoothstep(0.10,0.55,bank);',
   // A long, soft swell sweeping the whole channel, much slower than the
   // filaments: the two together stop the surface looking like a pattern.
   ' float swell=smoothstep(0.55,0.95,sin(vFlow.x*0.028-fTime*0.17+lane*0.35));',
   ' float alpha=(filament*0.78+swell*0.30*bank)*mix(0.40,0.30,fNight);',
   ' vec3 c=mix(vec3(0.92,0.97,0.95),vec3(0.52,0.72,0.80),fNight);',
   ' gl_FragColor=vec4(c,alpha);',
   '}'].join('\n')));
  gl.linkProgram(waterProgram);
  if(!gl.getProgramParameter(waterProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(waterProgram));
  var aWater=gl.getAttribLocation(waterProgram,'aWater'),aFlow=gl.getAttribLocation(waterProgram,'aFlow');
  var waterBuffers=[gl.createBuffer(),gl.createBuffer()],waterCount=0,waterPos=[],waterFlow=[];
  function resetWater(){waterPos=[];waterFlow=[];waterCount=0}
  /* The flow overlay rides the same joined ribbon as the still river, one
     step higher, with the distance travelled carried per vertex: the current
     then runs along the channel instead of across it, and it keeps running
     along it through every bend. */
  function waterRibbon(points,width){
   var edges=ribbonEdges(points,width,.028);if(!edges)return;
   for(var j=1;j<edges.length;j++){
    var a=edges[j-1],b=edges[j];
    push(a[0],a[2],1);push(b[0],b[2],1);push(b[1],b[2],-1);
    push(a[0],a[2],1);push(b[1],b[2],-1);push(a[1],a[2],-1)}
   function push(p,s,side){waterPos.push(p[0],p[1],p[2]);waterFlow.push(s,side);waterCount++}}
  function uploadWater(){
   gl.bindBuffer(gl.ARRAY_BUFFER,waterBuffers[0]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(waterPos),gl.STATIC_DRAW);
   gl.bindBuffer(gl.ARRAY_BUFFER,waterBuffers[1]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(waterFlow),gl.STATIC_DRAW);
   waterPos=[];waterFlow=[]}
  /* The cloud deck is one quad over the cropped sheet, just above the ground:
     a structure in front of it hides the shadow, which is what a shadow does. */
  function uploadClouds(c){
   if(!c){cloudCount=0;return}
   var y=.07,v=[c.x0,y,c.z0, c.x1,y,c.z0, c.x1,y,c.z1, c.x0,y,c.z0, c.x1,y,c.z1, c.x0,y,c.z1];
   gl.bindBuffer(gl.ARRAY_BUFFER,cloudBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.STATIC_DRAW);cloudCount=6}
  function drawWeather(seconds,fade){
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
   for(var a of [aPos,aNormal,aColor,aEmissive])gl.disableVertexAttribArray(a);
   if(waterCount){
    gl.useProgram(waterProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER,waterBuffers[0]);gl.enableVertexAttribArray(aWater);gl.vertexAttribPointer(aWater,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,waterBuffers[1]);gl.enableVertexAttribArray(aFlow);gl.vertexAttribPointer(aFlow,2,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(gl.getUniformLocation(waterProgram,'wMVP'),false,mvpMat);
    gl.uniform1f(gl.getUniformLocation(waterProgram,'fTime'),seconds);
    gl.uniform1f(gl.getUniformLocation(waterProgram,'fNight'),opts.night?1:0);
    gl.drawArrays(gl.TRIANGLES,0,waterCount);drawCalls++;
    gl.disableVertexAttribArray(aWater);gl.disableVertexAttribArray(aFlow)}
   if(cloudCount&&opts.mode!=='street'){
    gl.useProgram(cloudProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER,cloudBuffer);gl.enableVertexAttribArray(aCloud);gl.vertexAttribPointer(aCloud,3,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(uCloud.cMVP,false,mvpMat);
    gl.uniform1f(uCloud.cTime,seconds);gl.uniform1f(uCloud.cNight,opts.night?1:0);gl.uniform1f(uCloud.cFade,fade);
    gl.drawArrays(gl.TRIANGLES,0,cloudCount);drawCalls++;
    gl.disableVertexAttribArray(aCloud)}
   gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(prog);
   for(var a2 of [aPos,aNormal,aColor,aEmissive])gl.enableVertexAttribArray(a2);
  }
  var skyUniforms={};for(var name of ['sRight','sUp','sForward','sAspect','sNight','sStreet','sTime'])skyUniforms[name]=gl.getUniformLocation(skyProgram,name);
  function drawSky(aspect,seconds){
   gl.useProgram(skyProgram);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
   for(var a of [aPos,aNormal,aColor,aEmissive])gl.disableVertexAttribArray(a);
   gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);gl.enableVertexAttribArray(skyAttribute);gl.vertexAttribPointer(skyAttribute,2,gl.FLOAT,false,0,0);
   gl.uniform3f(skyUniforms.sRight,vMat[0],vMat[4],vMat[8]);gl.uniform3f(skyUniforms.sUp,vMat[1],vMat[5],vMat[9]);gl.uniform3f(skyUniforms.sForward,-vMat[2],-vMat[6],-vMat[10]);
   gl.uniform1f(skyUniforms.sAspect,aspect);gl.uniform1f(skyUniforms.sNight,opts.night?1:0);gl.uniform1f(skyUniforms.sStreet,opts.mode==='street'?1:0);gl.uniform1f(skyUniforms.sTime,seconds||0);
   gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(skyAttribute);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(prog);
  }

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
var eyePos=[0,0,0];
/* Detail is dropped only when a chunk is already smaller than a pixel, so no
   visible geometry pops on a desktop. Eco keeps a stricter budget on purpose. */
function detailPixels(b){var r=Math.max(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2])*.5,h=canvas.clientHeight||1;
 if(opts.mode==='street'){var d=Math.max(1,Math.hypot((b.min[0]+b.max[0])/2-eyePos[0],(b.min[1]+b.max[1])/2-eyePos[1],(b.min[2]+b.max[2])/2-eyePos[2]));return r/d*h}
 return r/Math.max(1,cam.dist*.5)*h}
function dropDetail(b){if(!b.lod)return false;var px=detailPixels(b);return opts.quality==='eco'?px<4:px<1.2}
function resetGeometry(){vertices=[];normals=[];colors=[];emissives=[];chunks=[]}
function chunk(start,lod){var end=vertices.length/3;if(end===start)return;var min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(var i=start*3;i<vertices.length;i+=3)for(var k=0;k<3;k++){min[k]=Math.min(min[k],vertices[i+k]);max[k]=Math.max(max[k],vertices[i+k])}min[1]=Math.min(min[1],0);chunks.push({start,count:end-start,min,max,lod})}
function upload(target){target.chunks=chunks;target.count=vertices.length/3;[vertices,normals,colors,emissives].forEach((arr,i)=>{var typed=new Float32Array(arr);gl.bindBuffer(gl.ARRAY_BUFFER,target.buffers[i]);gl.bufferData(gl.ARRAY_BUFFER,typed,gl.STATIC_DRAW);uploadedBytes+=typed.byteLength;lastUploadBytes+=typed.byteLength})}
// AABB positive vertex against all six clip planes; bounds include every
// vertex (also river caps and footprints crossing a cell boundary).
function outside(b){if(!culling)return false;for(var row=0;row<3;row++)for(var sign of [-1,1]){var a=mvpMat[3]+sign*mvpMat[row],c=mvpMat[7]+sign*mvpMat[row+4],d=mvpMat[11]+sign*mvpMat[row+8],e=mvpMat[15]+sign*mvpMat[row+12];if(a*(a>=0?b.max[0]:b.min[0])+c*(c>=0?b.max[1]:b.min[1])+d*(d>=0?b.max[2]:b.min[2])+e < -0.001)return true}return false}
function drawMesh(target){[aPos,aNormal,aColor,aEmissive].forEach((a,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,target.buffers[i]);gl.vertexAttribPointer(a,i===3?1:3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(a)});var start=-1,count=0;function flush(){if(count){gl.drawArrays(gl.TRIANGLES,start,count);drawCalls++;drawnTriangles+=count/3}start=-1;count=0}for(var b of target.chunks){if(dropDetail(b)){lodSkipped++;flush();continue}if(outside(b)){culledChunks++;flush();continue}if(start<0)start=b.start;count+=b.count}flush()}
var uGrowth=gl.getUniformLocation(prog,'uGrowth');
var pMat=M4.create(),vMat=M4.create(),mvpMat=M4.create(),mMat=M4.create();
var data,geo,bigz=null,bigzCache=null,bigzFor=null,opts={},marks=[],hit=[],pickBoxes=[],arcs=[],models=[],frame=0,frames=0,growthStart=0,cam={yaw:-.35,pitch:.8,dist:165,target:[12,0,10]},transition=null,drag=null,hover='',inView=true;
var reduced=matchMedia('(prefers-reduced-motion:reduce)'),labels=document.getElementById('map-labels'),labelNodes=new Map(),pointers=new Map();
var links=document.getElementById('map-links'),lastLabelTime=0;
// Street mode explores symbolic data architecture, not a metric survey.
var WALK_SPEED=4.26; // 3.2 x 1.33, asked for on 24.10.2026
var GROUND_LIFT=1; // raised on foot; see the near-plane note in render()
var walk={pos:[12,1.7,30],yaw:0,pitch:0},keys=new Set(),lastWalk=0,walkVelocity=[0,0],stick={x:0,y:0,id:null},aim=null;
var walkFly=null,glide=null,ORBIT_BACK=2000,PAN_LIMIT=1200,clipProbe=false,clippedCorners=0,ambientClock=0,ambientTimer=0;
var joystick=document.getElementById('joystick'),knob=joystick?.firstElementChild;
function resetStick(){stick={x:0,y:0,id:null};if(knob)knob.style.transform='translate(-50%,-50%)'}
function stopWalk(){keys.clear();resetStick();lastWalk=0;walkVelocity=[0,0];walkFly=null}
function enterStreet(id){stopWalk();transition=null;
 if(opts.world==='bigz'){var en=bigzModel().entry;walk.pos=en.slice();walk.yaw=Math.PI;walk.pitch=-.08;revealStage();invalidate();return}var lead=leadOf(id);if(lead)id=lead.id;var t=data.teams.find(t=>t.id===id)||data.teams.find(t=>t.hasPassport&&position(t)),p=t&&wingPos(t);if(!p)p=[12,0,10];var boxes=pickBoxes.filter(b=>b.team===t?.id),front=boxes.reduce((z,b)=>Math.max(z,b.max[2]),p[2]);
 /* Standing room: the arrival point is set back by the structure's own width,
    so the first frame shows the sculpture instead of its underside. */
 var span=boxes.reduce((n,b)=>Math.max(n,b.max[0]-b.min[0],b.max[2]-b.min[2]),8);
 walk.pos=[p[0],1.7,front+Math.max(12,span*.95)];
 for(var i=0;i<60&&blocked(walk.pos[0],walk.pos[2]);i++)walk.pos[2]+=.6;
 walk.yaw=0;walk.pitch=.04;canvas.focus({preventScroll:true});revealStage();invalidate()}
/* Na niskom ekranu scena i dugmad za hod padnu ispod pregiba: ulica bez
   vidljivih komandi nije upotrebljiva, pa se pozornica dovodi u kadar. */
function revealStage(){var s=canvas.closest('.stage')||canvas,r=s.getBoundingClientRect();if(r.top>=0&&r.bottom<=innerHeight)return;s.scrollIntoView({block:'center',inline:'nearest',behavior:reduced.matches?'instant':'smooth'})}
function blocked(x,z){return pickBoxes.some(b=>b.role!=='foundation'&&b.max[1]>.25&&b.min[1]<1.9&&x>b.min[0]-.3&&x<b.max[0]+.3&&z>b.min[2]-.3&&z<b.max[2]+.3)}
function stepWalk(now){
 var dt=lastWalk?Math.min(.05,(now-lastWalk)/1000):0;lastWalk=now;
 if(walkFly){if(keys.size||stick.x||stick.y)walkFly=null;else return}
 if(!keys.size&&!stick.x&&!stick.y){walkVelocity=[0,0];return}
 var forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS'))-stick.y,side=Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+stick.x;
 // Positive yaw faces left in this camera convention.
 walk.yaw-=(Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')))*dt*1.1;
 walk.pitch=Math.max(-1.2,Math.min(1.2,walk.pitch+(Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')))*dt*.8));
 var norm=Math.max(1,Math.hypot(forward,side)),speed=WALK_SPEED;
 var targetX=(side*Math.cos(walk.yaw)-forward*Math.sin(walk.yaw))*speed/norm,targetZ=(-forward*Math.cos(walk.yaw)-side*Math.sin(walk.yaw))*speed/norm;
 // Exact exponential integration: same travel at different refresh rates.
 var decay=Math.exp(-12*dt),integral=(1-decay)/12;
 var dx=targetX*dt+(walkVelocity[0]-targetX)*integral,dz=targetZ*dt+(walkVelocity[1]-targetZ)*integral;
 walkVelocity=[targetX+(walkVelocity[0]-targetX)*decay,targetZ+(walkVelocity[1]-targetZ)*decay];
 var steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
 for(var i=0;i<steps;i++){if(!blocked(walk.pos[0]+dx/steps,walk.pos[2]))walk.pos[0]+=dx/steps;else walkVelocity[0]=0;if(!blocked(walk.pos[0],walk.pos[2]+dz/steps))walk.pos[2]+=dz/steps;else walkVelocity[1]=0}
 invalidate()
}
function pickCenter(){var r=canvas.getBoundingClientRect(),p=findPick({clientX:r.left+r.width/2,clientY:r.top+r.height/2});if(p)onPick(p.id,p.team)}
function moveStick(e){var r=joystick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/34,dy=(e.clientY-r.top-r.height/2)/34,n=Math.max(1,Math.hypot(dx,dy));stick.x=Math.abs(dx/n)>.08?dx/n:0;stick.y=Math.abs(dy/n)>.08?dy/n:0;knob.style.transform='translate(calc(-50% + '+stick.x*27+'px),calc(-50% + '+stick.y*27+'px))';invalidate()}
if(joystick){joystick.addEventListener('pointerdown',e=>{if(opts.mode!=='street'||stick.id!==null)return;e.preventDefault();stopWalk();stick.id=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e)});joystick.addEventListener('pointermove',e=>{if(e.pointerId===stick.id)moveStick(e)});for(var type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,e=>{if(e.pointerId===stick.id){resetStick();invalidate()}});joystick.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);invalidate()}});joystick.addEventListener('keyup',e=>keys.delete(e.code));joystick.addEventListener('blur',stopWalk)}
canvas.addEventListener('keydown',e=>{if(opts.mode!=='street')return;if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();keys.add(e.code);invalidate()}if(e.code==='Enter'){e.preventDefault();pickCenter()}});
canvas.addEventListener('keyup',e=>keys.delete(e.code));canvas.addEventListener('blur',stopWalk);window.addEventListener('blur',stopWalk);document.addEventListener('visibilitychange',stopWalk);
for(let button of document.querySelectorAll('[data-walk]')){button.addEventListener('pointerdown',e=>{if(opts.mode!=='street')return;e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.walk);invalidate()});for(var event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.walk));button.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();keys.add(button.dataset.walk);invalidate()}});button.addEventListener('keyup',()=>keys.delete(button.dataset.walk));button.addEventListener('blur',()=>keys.delete(button.dataset.walk))}
document.getElementById('walk-pick')?.addEventListener('click',pickCenter);
/* Every layer goes through one published transform: the plain projection in the
   core, the declared radial compaction outside it. Streets, river and sculptures
   are warped together, so an object never floats over somebody else's block. */
function project(lng,lat){return AtlasLayout.place(lng,lat)}
var placeCache=null,placeFor=null;
function layoutPlace(id){if(!id)return null;if(placeFor!==data){placeCache=new Map((data.layout&&data.layout.places||[]).map(p=>[p.id,p]));placeFor=data}return placeCache.get(id)||null}
/* How far the sheet goes. The OSM extract carries the Sava 349 units (8.7 km)
   west of the westernmost sculpture, while every placed object fits inside
   x [-90, 63] and z [-56, 97]; at full zoom-out that empty tail was most of
   the picture (measured 2026-10-24). The atlas is therefore cropped to the
   objects it reports on plus MARGIN units of context, and river, streets and
   grid are cut to the same rectangle: the edge then reads as the edge of the
   sheet, not as a river that stops. The crop is drawing only — no record,
   position or pick is removed by it. */
var CROP_MARGIN=40;            // units (~1 km) of context around the objects
var cropCache=null,cropFor=null;
function contentCrop(){
 if(cropFor===data)return cropCache;
 cropFor=data;cropCache=null;
 var x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,found=false;
 for(var b of (data&&data.buildings||[])){var p=layoutPlace(b.id);if(!p)continue;
  var r=(p.radius||0)+4;found=true;
  if(p.x-r<x0)x0=p.x-r;if(p.x+r>x1)x1=p.x+r;if(p.z-r<z0)z0=p.z-r;if(p.z+r>z1)z1=p.z+r}
 if(found)cropCache={x0:x0-CROP_MARGIN,x1:x1+CROP_MARGIN,z0:z0-CROP_MARGIN,z1:z1+CROP_MARGIN};
 return cropCache}
/* Liang-Barsky, kept as runs: a line that leaves the sheet and comes back
   stays two lines instead of one shortcut across the corner. */
function clipSegment(a,b,c){
 var dx=b[0]-a[0],dz=b[2]-a[2],t0=0,t1=1;
 var p=[-dx,dx,-dz,dz],q=[a[0]-c.x0,c.x1-a[0],a[2]-c.z0,c.z1-a[2]];
 for(var k=0;k<4;k++){
  if(p[k]===0){if(q[k]<0)return null;continue}
  var r=q[k]/p[k];
  if(p[k]<0){if(r>t1)return null;if(r>t0)t0=r}
  else{if(r<t0)return null;if(r<t1)t1=r}}
 return [[a[0]+dx*t0,a[1],a[2]+dz*t0],[a[0]+dx*t1,a[1],a[2]+dz*t1]]}
/* Both ends of a drawn river are artificial: one is the crop, the other is
   where the OSM extract stops. Neither is a place where the Sava ends, so the
   ribbon narrows away over TAPER units instead of stopping square. */
var RIVER_TAPER=55;
function riverTaper(width,c){
 return function(p,along,total){
  var d=Math.min(along,total-along);
  if(c)d=Math.min(d,p[0]-c.x0,c.x1-p[0],p[2]-c.z0,c.z1-p[2]);
  var f=Math.max(0,Math.min(1,d/RIVER_TAPER));
  return width*(f*f*(3-2*f))}}
function clipRuns(pts,c){
 if(!c||pts.length<2)return [pts];
 var runs=[],run=null;
 var inside=function(p){return p[0]>=c.x0&&p[0]<=c.x1&&p[2]>=c.z0&&p[2]<=c.z1};
 for(var i=1;i<pts.length;i++){
  var seg=clipSegment(pts[i-1],pts[i],c);
  if(!seg){run=null;continue}
  var tail=run&&run[run.length-1];
  if(!tail||Math.abs(tail[0]-seg[0][0])>1e-6||Math.abs(tail[2]-seg[0][2])>1e-6){run=[seg[0]];runs.push(run)}
  run.push(seg[1]);
  if(!inside(pts[i]))run=null}
 return runs}
function hash(s){var n=2166136261;for(var c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0}
function line(a,b,width,col,y){var dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);if(!len)return;dx=dx/len*width/2;dz=dz/len*width/2;addQuad([a[0]-dz,y,a[2]+dx],[b[0]-dz,y,b[2]+dx],[b[0]+dz,y,b[2]-dx],[a[0]+dz,y,a[2]-dx],[0,1,0],col,0)}

// A joined, flat ribbon avoids overlapping cylinder caps and their false facets.
// `width` may be a number or a function(point, distanceAlong, totalLength):
// a river that is only cut off by the edge of the sheet tapers out instead of
// ending in a blunt stump.
function ribbonEdges(points,width,y){
 var pts=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[2]-points[i-1][2])>.0001);
 if(pts.length<2)return null;
 var along=[0];for(var k=1;k<pts.length;k++)along.push(along[k-1]+Math.hypot(pts[k][0]-pts[k-1][0],pts[k][2]-pts[k-1][2]));
 var total=along[along.length-1],edges=[],wide=typeof width==='function';
 for(var i=0;i<pts.length;i++){var p=pts[i],a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=p[0]-a[0],dz=p[2]-a[2],ex=b[0]-p[0],ez=b[2]-p[2];
  if(!i){dx=ex;dz=ez}
  if(i===pts.length-1){ex=dx;ez=dz}
  var l=Math.hypot(dx,dz),q=Math.hypot(ex,ez),n=[-dz/l,dx/l],m=[-ez/q,ex/q],mx=n[0]+m[0],mz=n[1]+m[1],ml=Math.hypot(mx,mz);
  if(ml<.001){mx=m[0];mz=m[1];ml=1}
  mx/=ml;mz/=ml;
  var w=wide?width(p,along[i],total):width,r=Math.min(w,w/2/Math.max(.5,mx*m[0]+mz*m[1]));
  edges.push([[p[0]+mx*r,y,p[2]+mz*r],[p[0]-mx*r,y,p[2]-mz*r],along[i]])}
 return edges}
function ribbon(points,width,col,y){var edges=ribbonEdges(points,width,y);if(!edges)return;
 for(var i=1;i<edges.length;i++)addQuad(edges[i-1][0],edges[i][0],edges[i][1],edges[i-1][1],[0,1,0],col,0)}
/* Shadows are projected along the same sun the shader shades with
   (uSunDir .65/.82/-.5), one silhouette per element instead of one convex hull
   around the whole sculpture: a courtyard stays a courtyard, a setback stays a
   setback. The edge is softened by two wider, lighter skirts under the core —
   a stand-in for a penumbra, which widens with the height of what casts it.
   It is a drawing convention, not a computed light transport. */
var SUN_X=.65/.82,SUN_Z=.5/.82;
function hullOf(pts){pts=pts.slice().sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
 var cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]),hull=[];
 for(var p of pts){while(hull.length>1&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p)}
 var lower=hull.length;
 for(var p of pts.slice(0,-1).reverse()){while(hull.length>lower&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p)}
 hull.pop();return hull}
// Push a convex ring outward from its own centre: the skirt of the penumbra.
function expandHull(hull,d){var cx=0,cz=0;for(var p of hull){cx+=p[0];cz+=p[2]}cx/=hull.length;cz/=hull.length;
 return hull.map(function(p){var dx=p[0]-cx,dz=p[2]-cz,l=Math.hypot(dx,dz)||1;return [p[0]+dx/l*d,0,p[2]+dz/l*d]})}
function shadow(model,pos){
 for(var e of model.elements){
  if(e.w<=0||e.d<=0||e.h<=0)continue;
  var pts=[];
  for(var sx of [-1,1])for(var sz of [-1,1])for(var h of [e.y,e.y+e.h])
   pts.push([pos[0]+e.x+sx*e.w/2-h*SUN_X,0,pos[2]+e.z+sz*e.d/2+h*SUN_Z]);
  var hull=hullOf(pts);if(hull.length<3)continue;
  var top=e.y+e.h,soft=Math.min(3.4,.22+top*.085);
  /* Only real mass gets a skirt. Giving every rail and tick its own penumbra
     trebles the team mesh for an edge nobody can see at that size. */
  if(top>=3&&e.w*e.d>=1.2){polygon(expandHull(hull,soft),.026*GROUND_LIFT,[.802,.828,.772]);
   if(top>=14)polygon(expandHull(hull,soft*.45),.028*GROUND_LIFT,[.742,.772,.708])}
  polygon(hull,.030*GROUND_LIFT,[.70,.73,.67])}}
function polygon(points,h,col){if(points.length<3)return;var pts=points.slice();if(pts[0][0]===pts.at(-1)[0]&&pts[0][2]===pts.at(-1)[2])pts.pop();var area=0;for(var i=0;i<pts.length;i++){var a=pts[i],b=pts[(i+1)%pts.length];area+=a[0]*b[2]-b[0]*a[2];if(h>.03*GROUND_LIFT){var len=Math.hypot(b[0]-a[0],b[2]-a[2]);if(len)addQuad([a[0],.05,a[2]],[b[0],.05,b[2]],[b[0],h,b[2]],[a[0],h,a[2]],[(b[2]-a[2])/len,0,(a[0]-b[0])/len],col,0)}}
if(area<0)pts.reverse();var ix=pts.map((_,i)=>i),guard=0;function cross(a,b,c){return (b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0])}while(ix.length>2&&guard++<pts.length*pts.length){var cut=false;for(var j=0;j<ix.length;j++){var ai=ix[(j+ix.length-1)%ix.length],bi=ix[j],ci=ix[(j+1)%ix.length],a=pts[ai],b=pts[bi],c=pts[ci];if(cross(a,b,c)<=0)continue;if(ix.some(k=>k!==ai&&k!==bi&&k!==ci&&cross(a,b,pts[k])>=0&&cross(b,c,pts[k])>=0&&cross(c,a,pts[k])>=0))continue;addTri([a[0],h,a[2]],[c[0],h,c[2]],[b[0],h,b[2]],[0,1,0],col,0);ix.splice(j,1);cut=true;break}if(!cut)break}}

/* Each view answers with its own perspective. Plan reads from above: every
   sculpture gets a flat rosette whose sectors are its record categories and
   whose ticks are its sources. Collage drops geography and sorts the same
   teams by what they actually documented. Both read the dataset, never a guess. */
var CATEGORY_ORDER=['materials','time','documents','questions','research'];
var CATEGORY_COLOR={materials:[.66,.45,.22],time:[.38,.48,.63],documents:[.22,.48,.44],questions:[.72,.34,.23],research:[.46,.47,.52],archive:[.80,.58,.22]};
var statsCache=null,statsFor=null;
function teamStats(){if(statsCache&&statsFor===data)return statsCache;var out=new Map();
 for(var t of data.teams)out.set(t.id,{records:0,sources:0,categories:{}});
 for(var c of data.claims||[]){var e=out.get(c.team);if(!e)continue;e.records++;var k=CATEGORY_ORDER.includes(c.category)?c.category:'research';e.categories[k]=(e.categories[k]||0)+1}
 for(var s of data.sources||[]){var e2=out.get(s.team);if(e2)e2.sources++}
 var delivered=new Set((data.archives||[]).map(a=>a.team));
 for(var [id3,e3] of out){var best='research',n=-1;for(var k2 of CATEGORY_ORDER){var v=e3.categories[k2]||0;if(v>n){n=v;best=k2}}e3.lead=e3.records?best:(delivered.has(id3)?'archive':'none')}
 statsCache=out;statsFor=data;return out}
var collageCache=null,collageFor=null;
/* Collage columns are the dominant record category, rows the record count.
   Position is classification, never a place on the map. */
function collageLayout(){if(collageCache&&collageFor===data)return collageCache;var stats=teamStats(),cols=CATEGORY_ORDER.concat('archive','none'),used=cols.filter(c=>data.teams.some(t=>stats.get(t.id).lead===c));
 var out=new Map(),blocks=used.map(function(cat){var members=data.teams.filter(t=>stats.get(t.id).lead===cat).sort((a,b)=>stats.get(b.id).records-stats.get(a.id).records||a.id.localeCompare(b.id));
  // Teams without a single record need no room for one: their block stays tight.
  var step=cat==='none'?13:30,perRow=Math.max(1,Math.round(Math.sqrt(members.length))),rows=Math.ceil(members.length/perRow);
  return {cat,members,step,perRow,rows,w:perRow*step,d:rows*step}});
 /* The blocks themselves are packed into a near-square, so the collage frames
    the same on a phone and on a wide screen. */
 var gap=34,perBand=Math.max(1,Math.ceil(Math.sqrt(blocks.length))),bands=[];
 for(var i=0;i<blocks.length;i+=perBand)bands.push(blocks.slice(i,i+perBand));
 var totalD=bands.reduce((n,band)=>n+Math.max.apply(null,band.map(b=>b.d)),0)+gap*(bands.length-1),z=-totalD/2;
 bands.forEach(function(band,bi){var bandD=Math.max.apply(null,band.map(b=>b.d)),bandW=band.reduce((n,b)=>n+b.w,0)+gap*(band.length-1),x=-bandW/2,zc=z+bandD/2;
  band.forEach(function(b){var xc=x+b.w/2;x+=b.w+gap;
   b.members.forEach(function(t,i){var cx=i%b.perRow,cz=Math.floor(i/b.perRow);
    out.set(t.id,{pos:[xc+(cx-(b.perRow-1)/2)*b.step,0,zc+(cz-(b.rows-1)/2)*b.step],category:b.cat,column:blocks.indexOf(b),columns:blocks.length,slotX:cx,slots:b.perRow})})});
  z+=bandD+gap});
 collageCache={places:out,columns:blocks.map(b=>b.cat)};collageFor=data;return collageCache}
function planRosette(m,centre,stats,dark){if(!stats||!stats.records)return;
 var inner=AtlasArchitecture.footprint(m)+1.1,total=stats.records,span=Math.max(1.8,Math.min(5,.9+Math.sqrt(total)*.62)),angle=-Math.PI/2;
 for(var cat of CATEGORY_ORDER){var n=stats.categories[cat]||0;if(!n)continue;var sweep=n/total*Math.PI*2,steps=Math.max(2,Math.ceil(sweep/.22)),pts=[],col=CATEGORY_COLOR[cat];
  if(dark)col=col.map(v=>Math.min(1,v*1.35+.08));
  for(var i=0;i<=steps;i++){var a=angle+sweep*i/steps;pts.push([centre[0]+Math.cos(a)*inner,0,centre[2]+Math.sin(a)*inner])}
  for(var j=steps;j>=0;j--){var a2=angle+sweep*j/steps;pts.push([centre[0]+Math.cos(a2)*(inner+span),0,centre[2]+Math.sin(a2)*(inner+span)])}
  polygon(pts,.06,col);angle+=sweep+.035}
 /* One tick per cited source, outside the category band. */
 var ring=inner+span+.7,ticks=Math.min(48,stats.sources),ink=dark?[.72,.78,.8]:[.26,.3,.3];
 for(var k=0;k<ticks;k++){var a3=-Math.PI/2+k*Math.PI*2/Math.max(1,ticks);
  line([centre[0]+Math.cos(a3)*ring,0,centre[2]+Math.sin(a3)*ring],[centre[0]+Math.cos(a3)*(ring+.9),0,centre[2]+Math.sin(a3)*(ring+.9)],.26,ink,.05)}}

/* The knowledge density map. One object's mass is its number of records; the
   field value at a ground point is the sum of those masses with a Gaussian
   falloff over SIGMA units (300 m on the compressed map). Warm means a place
   something has been recorded about, never a claim that more is known about it:
   the city is researched where teams actually worked. A registered object with
   no record at all gets a cold open ring, so a hole stays visible instead of
   being invisible. The field is drawn only above FLOOR of the peak, which makes
   plain ground a statement too: nothing has been recorded there. Sigma is chosen
   from the data: documented neighbours stand 18-40 units apart, so a wider kernel
   would melt the centre into one blob and a narrower one would hide the clusters.

   Nothing here measures a building. The field is a readability kernel over
   registry points, and its sigma, cell size and peak are published in stats so
   a warm patch can always be traced back to the records that caused it. */
var DENSITY={sigma:12,cell:3,floor:.05,margin:38,maxCells:9000};
var dround=function(v){return Math.round(v*1000)/1000};
var densityCache=null,densityFor=null;
function densityField(){if(densityCache&&densityFor===data)return densityCache;
 var pins=[],holes=[],recorded=0,placed=0,total=0;
 for(var b of (data.buildings||[])){total++;
  var spot=layoutPlace(b.id);
  var p=spot?[spot.x,0,spot.z]:(b.locationStatus==='unmapped'||b.lat==null||b.lng==null?null:project(b.lng,b.lat));
  var mass=b.claimsCount||0;if(mass>0)recorded++;
  if(!p)continue;placed++;
  if(mass>0)pins.push({x:p[0],z:p[2],mass:mass,sources:b.sourcesCount||0,id:b.id,object:b.object});
  else holes.push({x:p[0],z:p[2],id:b.id,object:b.object,r:Math.max(4.5,(spot&&spot.radius)||6)})}
 var cells=[],peak=0,cell=DENSITY.cell,nx=0,nz=0,grid=null;
 if(pins.length){
  var sg=DENSITY.sigma,twoSig=2*sg*sg,m=DENSITY.margin,raw=[];
  var x0=Math.min.apply(null,pins.map(function(p){return p.x}))-m,x1=Math.max.apply(null,pins.map(function(p){return p.x}))+m;
  var z0=Math.min.apply(null,pins.map(function(p){return p.z}))-m,z1=Math.max.apply(null,pins.map(function(p){return p.z}))+m;
  /* The cell grows if the grid would exceed the agreed quad budget, so a denser
     registry never silently costs frames. The size actually used is published. */
  while(Math.ceil((x1-x0)/cell)*Math.ceil((z1-z0)/cell)>DENSITY.maxCells)cell*=1.25;
  nx=Math.ceil((x1-x0)/cell);nz=Math.ceil((z1-z0)/cell);
  for(var ix=0;ix<nx;ix++)for(var iz=0;iz<nz;iz++){
   var cx=x0+(ix+.5)*cell,cz=z0+(iz+.5)*cell,v=0;
   for(var q=0;q<pins.length;q++){var dx=cx-pins[q].x,dz=cz-pins[q].z;v+=pins[q].mass*Math.exp(-(dx*dx+dz*dz)/twoSig)}
   if(v>peak)peak=v;raw.push([cx,cz,v])}
  for(var r of raw)if(peak>0&&r[2]/peak>=DENSITY.floor)cells.push({x:r[0],z:r[1],v:r[2]/peak});
  grid={x0:x0,z0:z0,nx:nx,nz:nz,cell:cell,v:raw.map(function(r){return peak>0?r[2]/peak:0})}}
 densityCache={pins:pins,holes:holes,cells:cells,grid:grid,cell:dround(cell),peak:dround(peak),
  meta:{sigmaUnits:DENSITY.sigma,sigmaMetres:Math.round(DENSITY.sigma*AtlasLayout.METRES_PER_UNIT),
   cellUnits:dround(cell),cellMetres:Math.round(cell*AtlasLayout.METRES_PER_UNIT),
   cells:cells.length,grid:nx*nz,peak:dround(peak),levels:DENSITY_LEVELS.map(function(l){return l[0]}),pins:pins.length,holes:holes.length,
   buildings:total,placed:placed,recorded:recorded,floor:DENSITY.floor}};
 densityFor=data;return densityCache}
/* How the field is read. The dataset is one connected cluster in the centre of
   the city, so a continuous fill paints the whole map one colour and answers
   nothing. Contours answer: a closed line is a level of recorded research, the
   spacing between lines is how fast it falls off, and an object with no ring
   around it has nothing recorded near it. The lines are traced from the same
   grid the tally is published from — marching squares, linear crossings, no
   smoothing — so a ring can always be traced back to the records under it.

   Everything sits low: above the base grid, below the footprints and streets,
   so the city keeps reading through the contours. */
var DENSITY_LEVELS=[[.10,[.80,.73,.55],.34],[.22,[.78,.60,.34],.42],[.42,[.74,.44,.22],.52],[.70,[.67,.28,.15],.64]];
function contour(grid,level){var out=[],nx=grid.nx,nz=grid.nz,v=grid.v;
 var at=function(i,j){return v[i*nz+j]};
 var px=function(i){return grid.x0+(i+.5)*grid.cell},pz=function(j){return grid.z0+(j+.5)*grid.cell};
 /* One cell of the grid, four corners, the standard sixteen cases collapsed to
    "cut every edge whose ends straddle the level and join the cuts in pairs". */
 for(var i=0;i<nx-1;i++)for(var j=0;j<nz-1;j++){
  var a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1),cuts=[];
  var edge=function(v1,v2,x1,z1,x2,z2){if((v1<level)===(v2<level))return;var t=(level-v1)/(v2-v1);cuts.push([x1+(x2-x1)*t,z1+(z2-z1)*t])};
  edge(a,b,px(i),pz(j),px(i+1),pz(j));
  edge(b,c,px(i+1),pz(j),px(i+1),pz(j+1));
  edge(c,d,px(i+1),pz(j+1),px(i),pz(j+1));
  edge(d,a,px(i),pz(j+1),px(i),pz(j));
  for(var k=0;k+1<cuts.length;k+=2)out.push([cuts[k],cuts[k+1]])}
 return out}
function drawDensity(){var f=densityField();if(!f.grid&&!f.holes.length)return;
 /* The warmest band keeps a quiet fill, so the eye finds the core at a glance
    without the rest of the city being painted over. */
 if(f.grid){var fillFirst=vertices.length/3,h=f.cell/2;
  var night=!!opts.night;
  for(var c of f.cells)if(c.v>=.70){var g=Math.min(1,(c.v-.70)/.30);
   var col=night?[.34+.16*g,.20+.08*g,.13+.04*g]:[.86-.10*g,.78-.20*g,.66-.26*g];
   addQuad([c.x-h,.014,c.z-h],[c.x-h,.014,c.z+h],[c.x+h,.014,c.z+h],[c.x+h,.014,c.z-h],[0,1,0],col,(night?.03+g*.10:.06+g*.18))}
  chunk(fillFirst,1);
  var lineFirst=vertices.length/3;
  for(var L of DENSITY_LEVELS){var segs=contour(f.grid,L[0]);
   for(var sgm of segs)line([sgm[0][0],0,sgm[0][1]],[sgm[1][0],0,sgm[1][1]],L[2],L[1],.018)}
  chunk(lineFirst,1)}
 /* A hole: a registered object with no record. An open ring and a cross, never a
    fill, so it reads as emptiness and not as density. */
 var hf=vertices.length/3,cold=opts.night?[.52,.68,.76]:[.33,.45,.52];
 for(var o of f.holes){var rr=o.r+2.6,prev=null,seg=22;
  for(var i=0;i<=seg;i++){var a=i/seg*Math.PI*2,p=[o.x+Math.cos(a)*rr,0,o.z+Math.sin(a)*rr];
   if(prev)line(prev,p,.42,cold,.019);prev=p}
  line([o.x-rr*.34,0,o.z],[o.x+rr*.34,0,o.z],.42,cold,.019);
  line([o.x,0,o.z-rr*.34],[o.x,0,o.z+rr*.34],.42,cold,.019)}
 chunk(hf,1)}

/* The published layout decides where an object stands. Older revision snapshots
   carry no layout; those fall back to the plain registry point, as before. */
function position(t){if(!t)return null;if(opts.mode==='archive'){var place=collageLayout().places.get(t.id);return place?place.pos.slice():null}
 var spot=layoutPlace(t.building);if(spot)return [spot.x,0,spot.z];
 var b=(data.buildings||[]).find(b=>b.id===t.building&&b.teamCount>1);if(b)return b.locationStatus==='unmapped'?null:project(b.lng,b.lat);return t.locationStatus==='unmapped'?null:project(t.lng,t.lat)}
/* Registry pin of a nudged object: drawn only for the selection, so the
   displacement is visible on demand and never becomes clutter. */
function anchorOf(t){var spot=layoutPlace(t&&t.building);return spot&&spot.nudge?spot:null}
function mix(a,b,f){return a.map((v,i)=>v+(b[i]-v)*f)}
function modelOf(id){for(var m of models)if(m.id===id)return m;return null}
function leadOf(building){for(var m of models)if(m.building===building&&m.shared.length)return m;return null}
function grouped(m){return opts.mode!=='archive'&&!!m&&m.buildingTeams.length>1}
/* Wing position: where this team's own structure stands once its object is shared. */
function wingPos(t){var p=position(t);if(!p)return null;var m=modelOf(t.id);return grouped(m)?[p[0]+m.wingOffset[0],p[1],p[2]+m.wingOffset[1]]:p}
/* The archive world is pure data in, boxes out: cache it until the dataset changes. */
function bigzModel(){if(bigzFor!==bigz){bigzCache=window.AtlasBigz&&bigz?AtlasBigz.model(bigz,{night:false}):{elements:[],labels:[],folders:[],bounds:{min:[0,0,0],max:[0,0,0]},home:{target:[0,0,0],dist:200,yaw:-.35,pitch:.8},entry:[0,1.7,0]};bigzFor=bigz}return bigzCache}
function build(){if(!data)return;var started=performance.now();builds++;lastUploadBytes=0;resetGeometry();marks=[];hit=[];pickBoxes=[];arcs=[];
var dark=false,ground=dark?[.055,.085,.105]:[.9,.91,.86],stone=dark?[.15,.21,.24]:[.83,.85,.79],ink=dark?[.12,.18,.21]:[.77,.80,.75];
if(opts.world==='bigz'){buildBigz();return}
var street=opts.mode==='street';GROUND_LIFT=street?3.6:1;
var key=[opts.mode==='archive',opts.layer==='geography'&&!street,street].join(':');
if(key!==staticKey||geo!==staticGeo){staticBuilds++;resetWater();
var sheet=contentCrop()||{x0:-500,x1:500,z0:-500,z1:500};
/* On foot a 0.7 m hairline seen from 40 m up is sub-pixel, and the map extract
   has no streets at all west of the Sava, which is exactly where a walker
   spawns. So the grid is drawn heavier in FPS: something to steer by where
   there is no city data. 25 units = 625 m, every fourth line heavier. */
var gy=.008*GROUND_LIFT,gstep=street?5:25;
function gridWeight(v){if(!street)return .028;return v%100===0?.52:v%25===0?.26:.10}
var sx0=Math.ceil(sheet.x0/gstep)*gstep,sx1=Math.floor(sheet.x1/gstep)*gstep,sz0=Math.ceil(sheet.z0/gstep)*gstep,sz1=Math.floor(sheet.z1/gstep)*gstep;
for(var x=sx0;x<=sx1;x+=gstep)line([x,0,sheet.z0],[x,0,sheet.z1],gridWeight(x),ink,gy);
for(var z=sz0;z<=sz1;z+=gstep)line([sheet.x0,0,z],[sheet.x1,0,z],gridWeight(z),ink,gy);
/* The base sheet used to be a 7200-unit slab. A quad that large never
   rasterised on foot (and not even in orbit — it only looked right because the
   clear colour is the same beige), so the ground map had nothing to sit on and
   the walker saw bare sky below the horizon. It is now the cropped sheet plus
   900 units, well past where fog has taken over at 620. */
addBox((sheet.x0+sheet.x1)/2,-1,(sheet.z0+sheet.z1)/2,sheet.x1-sheet.x0+600,1,sheet.z1-sheet.z0+600,ground,0);
chunk(0);
if(opts.mode!=='archive'&&geo){
/* Coordinates arrive quantized to integer microdegrees (see quantization in
   geography.json); decode once per feature. */
function coordsOf(f){if(f.coordinates)return f.coordinates;var q=f.q,out=[];for(var i=0;i<q.length;i+=2)out.push([q[i]/1e6,q[i+1]/1e6]);return out}
var crop=contentCrop();
var cells=new Map();for(var feature of geo.features){var c0=coordsOf(feature),p=project(c0[0][0],c0[0][1]),cell=Math.floor(p[0]/40)+':'+Math.floor(p[2]/40);if(!cells.has(cell))cells.set(cell,{building:[],river:[],major:[],minor:[]});var slot=feature.kind==='building'?'building':feature.kind==='river'?'river':feature.roadClass==='primary'?'major':'minor';cells.get(cell)[slot].push(feature)}
for(var group of cells.values())for(var features of [group.building,group.river,group.major,group.minor]){var first=vertices.length/3;for(var f of features){var pts=coordsOf(f).map(p=>project(p[0],p[1]));if(f.kind==='building'){
 var mid=pts.reduce((a,p)=>[a[0]+p[0]/pts.length,0,a[2]+p[2]/pts.length],[0,0,0]);
 if(crop&&(mid[0]<crop.x0||mid[0]>crop.x1||mid[2]<crop.z0||mid[2]>crop.z1))continue;
 /* On foot the city stays a flat sheet under you: a map to orient by, not a
    second set of massing competing with the sculptures at eye height. */
 var real=opts.layer==='geography'&&opts.mode!=='street';
 polygon(pts,real?(f.height!==null?Math.max(.04,f.height/25):(f.levels!==null?Math.max(.04,f.levels*3/25):.04)):.022*GROUND_LIFT,street?[.846,.862,.80]:stone);
 if(real)hit.push({id:f.id,pos:mid,role:'geography'});
}else{var width=f.kind==='river'?9:f.roadClass==='primary'?.32:.13;
 if(street&&f.kind!=='river')width*=1.45;
 for(var run of clipRuns(pts,crop)){if(run.length<2)continue;
  if(f.kind==='river'){var w=riverTaper(width,crop);ribbon(run,w,[.54,.69,.68],.025*GROUND_LIFT);waterRibbon(run,w)}
  else for(var i=1;i<run.length;i++)line(run[i-1],run[i],width,ink,.025*GROUND_LIFT)}}}
chunk(first,features===group.minor?1:0)}}
uploadWater();uploadClouds(opts.mode==='archive'?null:contentCrop());
upload(staticMesh);staticHits=hit.slice();staticKey=key;staticGeo=geo;
}else hit=staticHits.slice();
resetGeometry();
var palette=dark?[[.9,.55,.3],[.37,.72,.66],[.59,.63,.82],[.78,.68,.4]]:[[.78,.37,.19],[.19,.49,.44],[.45,.46,.63],[.65,.52,.27]];
var active=new Set((opts.claims||[]).map(c=>c.id)),filtered=['materials','time','questions','documents'].includes(opts.layer);
/* Ground work that belongs to one view only. */
if(opts.mode==='plan'){var gridFirst=vertices.length/3,gink=dark?[.30,.38,.40]:[.73,.75,.68],reach=560,step=40;
 for(var g=-reach;g<=reach;g+=step){var heavy=g%200===0;
  line([-reach,0,g],[reach,0,g],heavy?.5:.22,gink,.012);
  line([g,0,-reach],[g,0,reach],heavy?.5:.22,gink,.012)}
 chunk(gridFirst,1)}
if(opts.layer==='density'&&opts.mode!=='archive')drawDensity();
if(opts.mode==='archive'){var layout=collageLayout(),bandFirst=vertices.length/3;
 layout.columns.forEach(function(cat,ci){var xs=[],zs=[];
  for(var place of layout.places.values())if(place.column===ci){xs.push(place.pos[0]);zs.push(place.pos[2])}
  if(!xs.length)return;var x0=Math.min.apply(null,xs)-12,x1=Math.max.apply(null,xs)+12,z0=Math.min.apply(null,zs)-12,z1=Math.max.apply(null,zs)+12;
  var col=CATEGORY_COLOR[cat]||[.46,.47,.52];if(dark)col=col.map(v=>Math.min(1,v*1.3+.06));
  for(var seg of [[[x0,0,z0],[x1,0,z0]],[[x0,0,z1],[x1,0,z1]],[[x0,0,z0],[x0,0,z1]],[[x1,0,z0],[x1,0,z1]]])line(seg[0],seg[1],.55,col,.03)});
 chunk(bandFirst)}
for(var t of data.teams){var pos=position(t);if(!pos||opts.visible&&!opts.visible.has(t.id))continue;var first=vertices.length/3,m=models.find(m=>m.id===t.id),shares=grouped(m),off=shares?m.wingOffset:[0,0],wing=[pos[0]+off[0],pos[1],pos[2]+off[1]],selected=t.id===opts.selected||shares&&m.building===opts.selected;
 if(m.records||m.archive)shadow(m,wing);
 /* Where the registry actually puts this object. A nudged sculpture shows its
    pin and a leader to it while it is selected, so the displacement is visible
    on demand and never silently absorbed into the picture. */
 if(selected&&!shares||selected&&m.wingIndex===0){var pin=anchorOf(t);
  if(pin&&opts.mode!=='street'){line([pos[0],0,pos[2]],[pin.anchor[0],0,pin.anchor[1]],.26,ink,.07);
   for(var pa=0;pa<18;pa++){var a1=pa*Math.PI/9,a2=(pa+1)*Math.PI/9;
    line([pin.anchor[0]+Math.cos(a1)*1.7,0,pin.anchor[1]+Math.sin(a1)*1.7],[pin.anchor[0]+Math.cos(a2)*1.7,0,pin.anchor[1]+Math.sin(a2)*1.7],.24,ink,.07)}}}
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
 if(opts.mode==='plan'&&opts.layer!=='density')planRosette(m,wing,teamStats().get(t.id),dark);
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
renderLabels();
if(links){links.replaceChildren();for(var a of arcs){var p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('class','relation-line');p.dataset.id=a.id;p.onclick=()=>{};(function(id){p.onclick=function(){onPick(id)}})(a.id);links.append(p);a.path=p;var dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('r','2.6');dot.setAttribute('class','relation-pulse');links.append(dot);a.dot=dot}}
upload(teamMesh);buildMs=performance.now()-started;invalidate();}
/* The BIGZ archive is a world of its own: no map, no team sculptures, only the
   delivered folders, their scans and the few readings that are finished. */
function buildBigz(){var started=performance.now();
 if(!bigz){upload(staticMesh);upload(teamMesh);renderLabels();return}
 var m=bigzModel();
 if(staticKey!=='bigz'){staticBuilds++;
  /* The ground is a slab with a hole where the pit is cut, so the excavation
     reads as a void and no second plane shows through it. */
  addBox(0,-1,0,2600,1,2600,[.9,.91,.86],0);
  var ink=[.77,.80,.75],reach=AtlasBigz.PIT.w*2.2,step=12;
  for(var g=-reach;g<=reach;g+=step){line([-reach,0,g],[reach,0,g],.05,ink,.01);line([g,0,-reach],[g,0,reach],.05,ink,.01)}
  chunk(0);upload(staticMesh);staticHits=[];staticKey='bigz';staticGeo=null}
 hit=[];resetGeometry();
 var first=vertices.length/3;
 /* The era dam: a dated element later than the chosen year fades to the ground
    tone and loses its pick box — what did not yet exist cannot be touched.
    Undated elements (racks, unread plates, the lift) always stand. */
 var era=opts.era?+opts.era:0,ghost=opts.night?[.10,.14,.16]:[.86,.87,.82];
 var past=w=>!era||!w||+String(w).slice(0,4)<=era;
 for(var e of m.elements){
  var col=e.col,emis=e.emis,there=past(e.when);
  if(!there){col=mix(e.col,ghost,.86);emis=.02}
  if(there&&(e.id===opts.selected||e.folder&&e.folder===opts.selected)){col=[.97,.76,.38];emis=Math.max(emis,.55)}
  addBox(e.x,e.y,e.z,e.w,e.h,e.d,col,emis);
  if(e.pick!==false&&there)pickBoxes.push({id:e.id,team:bigz.team,role:e.role,folder:e.folder,
   min:[e.x-e.w/2,e.y,e.z-e.d/2],max:[e.x+e.w/2,e.y+e.h,e.z+e.d/2],w:e.w,d:e.d,lod:e.role==='plate'?1:0});
  if(e.label&&there)hit.push({id:e.id,team:bigz.team,pos:[e.x,e.y+e.h/2,e.z],role:e.role});
 }
 chunk(first);
 for(var l of m.labels){if(!past(l.when))continue;
  marks.push({id:l.id,pos:l.pos,base:[l.pos[0],0,l.pos[2]],label:l.text,always:true,
  selected:l.id===opts.selected,records:0,teams:[],title:l.sub?l.text+' · '+l.sub:l.text})}
 renderLabels();
 if(links)links.replaceChildren();
 upload(teamMesh);buildMs=performance.now()-started;invalidate();}
function renderLabels(){labels?.replaceChildren();labelNodes.clear();for(var m of marks){var el=document.createElement('button'),span=document.createElement('span');span.textContent=m.label;el.append(span);el.title=m.title;el.dataset.id=m.id;el.setAttribute('aria-label',m.label+' · '+m.title);el.className=[m.selected?'selected':'',m.teams&&m.teams.length>1?'shared':''].filter(Boolean).join(' ');(function(id){el.onclick=function(){onPick(id)}})(m.id);labels?.append(el);labelNodes.set(m.id,el)}}
function invalidate(){if(!frame&&!document.hidden&&inView)frame=requestAnimationFrame(render)}
function screen(p,w,h){var x=p[0]*mvpMat[0]+p[1]*mvpMat[4]+p[2]*mvpMat[8]+mvpMat[12],y=p[0]*mvpMat[1]+p[1]*mvpMat[5]+p[2]*mvpMat[9]+mvpMat[13],z=p[0]*mvpMat[2]+p[1]*mvpMat[6]+p[2]*mvpMat[10]+mvpMat[14],q=p[0]*mvpMat[3]+p[1]*mvpMat[7]+p[2]*mvpMat[11]+mvpMat[15];return q>0&&z>=-q&&z<=q?[w*(x/q*.5+.5),h*(.5-y/q*.5)]:[-10000,-10000]}
function splitLabel(m){return opts.mode==='street'||cam.dist<110||(opts.selected===m.id&&cam.dist<160)}
function overlays(rect,now){var taken=[],count=0,limit=rect.width<600?9:16,scale=Math.max(.55,Math.min(1,90/cam.dist));
for(var m of [...marks].sort((a,b)=>Number(b.selected)-Number(a.selected)||Number(!!b.parent)-Number(!!a.parent)||(b.id===hover)-(a.id===hover)||b.records-a.records)){
 var el=labelNodes.get(m.id),p=screen(m.pos,rect.width,rect.height);if(!el)continue;
 var parent=m.parent&&marks.find(q=>q.id===m.parent),split=parent?splitLabel(parent):splitLabel(m),eligible=m.parent?split:!(m.teams.length>1&&split);
 var important=m.selected||m.id===hover||!!parent&&parent.selected,show=eligible&&(important||(m.always||m.records>0||m.teams.length>1||m.parent||opts.layer==='teams')&&count<limit)&&p[0]>16&&p[0]<rect.width-16&&p[1]>66&&p[1]<rect.height-76&&!taken.some(q=>Math.abs(q[0]-p[0])<29&&Math.abs(q[1]-p[1])<22);
 if(show&&opts.mode==='street'){var occluder=findPick({clientX:rect.left+p[0],clientY:rect.top+p[1]}),range=Math.hypot(m.pos[0]-walk.pos[0],m.pos[1]-walk.pos[1],m.pos[2]-walk.pos[2]);if(occluder?.distance<range-.3)show=false}
 el.hidden=!show;if(!show)continue;count++;taken.push(p);el.style.left=p[0]+'px';el.style.top=p[1]+'px';var sc=opts.mode==='street'?Math.max(.55,Math.min(1,18/Math.hypot(m.pos[0]-walk.pos[0],m.pos[1]-walk.pos[1],m.pos[2]-walk.pos[2]))):scale;el.firstChild.style.transform='scale('+sc+')';el.dataset.scale=sc;
}
if(opts.mode==='street'){aim=findPick({clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2});var cross=document.querySelector('.crosshair'),hint=document.getElementById('aim-label');cross?.classList.toggle('target',!!aim);if(cross)cross.dataset.target=aim?.id||'';var claim=data.claims.find(c=>c.id===aim?.id),source=data.sources.find(s=>s.id===aim?.id),team=data.teams.find(t=>t.id===(aim?.team||aim?.id)),text=claim?claim.title:source?source.label:aim?.tier?aim.tier:team?team.id+' / '+team.object:'';if(hint)hint.textContent=text;var pick=document.getElementById('walk-pick');if(pick)pick.disabled=!aim}else{aim=null;document.getElementById('aim-label').textContent=''}
if(links){links.setAttribute('viewBox','0 0 '+rect.width+' '+rect.height);for(var a of arcs){var points=a.points.map(p=>screen(p,rect.width,rect.height));var clipped=opts.mode==='street'||points.some(p=>p[0]===-10000);a.path.style.display=clipped?'none':'';a.dot.style.display=clipped?'none':'';if(clipped)continue;a.path.setAttribute('d',points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2)).join(' '));var phase=opts.motion&&!reduced.matches?(now%6000)/6000:.5,index=phase*32,lo=Math.floor(index),hi=Math.min(32,lo+1),p=mix(points[lo],points[hi],index-lo);a.dot.setAttribute('cx',p[0]);a.dot.setAttribute('cy',p[1]);a.dot.style.visibility=opts.motion&&!reduced.matches?'visible':'hidden'}}
}
function render(now){frame=0;if(document.hidden||!inView)return;frames++;var renderStart=performance.now();if(glide&&opts.mode!=='street')glideStep(now);else glide=null;if(opts.mode==='street'){stepFly(now);stepWalk(now)}if(transition){var f=reduced.matches?1:Math.min(1,(now-transition.start)/550),e=1-Math.pow(1-f,3);for(var k of ['yaw','pitch','dist'])cam[k]=transition.from[k]+(transition.to[k]-transition.from[k])*e;cam.target=transition.from.target.map((v,i)=>v+(transition.to.target[i]-v)*e);if(f===1)transition=null;else invalidate()}
var growth=reduced.matches||!growthStart?1:Math.min(1,(now-growthStart)/950);if(growth<1)invalidate();
var rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,opts.quality==='eco'?1:opts.quality==='high'?2:1.6,Math.sqrt((opts.quality==='high'?2400000:opts.quality==='eco'?650000:1400000)/Math.max(1,rect.width*rect.height))),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);var sky=opts.night?[.055,.085,.105]:[.9,.91,.86];gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(prog);var d=cam.dist,cy=cam.pitch,cx=cam.yaw,eye=[cam.target[0]+d*Math.cos(cy)*Math.sin(cx),cam.target[1]+d*Math.sin(cy),cam.target[2]+d*Math.cos(cy)*Math.cos(cx)];
var target=cam.target,viewEye=eye;
if(opts.mode==='street'){eye=walk.pos;viewEye=eye;target=[eye[0]-Math.sin(walk.yaw)*Math.cos(walk.pitch),eye[1]+Math.sin(walk.pitch),eye[2]-Math.cos(walk.yaw)*Math.cos(walk.pitch)];/* Fog has fully taken over at 620, so the far plane is pulled in from 2600:
   cheap depth resolution for the ground sheet. The near plane stays at .05 —
   raising it clips whatever you are standing next to. */
M4.perspective(pMat,Math.PI/3,w/h,.05,1700)}
else{
 /* Orbit is orthographic: the eye carries no scale, so it is parked far behind
    the frame. Zooming in then never pushes geometry through the near plane. */
 eye=[cam.target[0]+ORBIT_BACK*Math.cos(cy)*Math.sin(cx),cam.target[1]+ORBIT_BACK*Math.sin(cy),cam.target[2]+ORBIT_BACK*Math.cos(cy)*Math.cos(cx)];
 M4.ortho(pMat,-d*w/h*.5,d*w/h*.5,-d*.5,d*.5,1,ORBIT_BACK*2+2600);
}
var horizon=opts.night?[.16,.22,.25]:[.90,.91,.86];
var fogNear=opts.mode==='street'?70:Math.max(190,d*1.5),fogFar=opts.mode==='street'?620:Math.max(900,d*4.4);
/* Weather runs on wall time, so a dropped frame slows nothing down and two
   tabs show the same sky. It is off under prefers-reduced-motion and in eco
   quality, and then the clock stands still rather than jumping. */
var ambient=!reduced.matches&&opts.quality!=='eco'&&opts.world!=='bigz'&&(waterCount>0||cloudCount>0);
if(ambient)ambientClock=(now||performance.now())/1000;
var seconds=ambientClock;
eyePos=viewEye;M4.lookAt(vMat,eye,target,[0,1,0]);M4.multiply(mvpMat,pMat,vMat);drawSky(w/h,seconds);gl.uniformMatrix4fv(uMVP,false,mvpMat);gl.uniformMatrix4fv(uModel,false,mMat);gl.uniform3f(uSunDir,.65,.82,-.5);gl.uniform3fv(uSkyColor,sky);gl.uniform3fv(uHorizon,horizon);gl.uniform2f(uFog,fogNear,fogFar);gl.uniform3fv(uEye,viewEye);gl.uniform1f(uNight,opts.night?1:0);drawCalls=0;drawnTriangles=0;culledChunks=0;lodSkipped=0;gl.uniform1f(uGrowth,1);gl.uniform1f(uContact,0);drawMesh(staticMesh);gl.uniform1f(uGrowth,1-Math.pow(1-growth,3));gl.uniform1f(uContact,1);drawMesh(teamMesh);
/* The cloud shadow fades out once the camera is close enough that the sheet
   is no longer read as a map: under a sculpture a passing shadow is noise. */
drawWeather(seconds,Math.min(1,Math.max(0,(cam.dist-55)/85)));
drawVignette();
if(clipProbe)measureClip(eye,d,w/h);
overlays(rect,now);
if(opts.motion&&arcs.length&&!reduced.matches)invalidate();
else if(ambient)scheduleAmbient(performance.now()-renderStart);}
/* Weather must never own the main thread. A frame that costs 4 ms is
   redrawn at 30 fps; one that costs 90 ms (software GL, a weak phone) is
   redrawn when the machine has been idle more than twice that long. Without
   this the queue of pointer events behind a continuous redraw grew to over a
   second and a double tap stopped arriving as a double tap (measured
   2026-10-24, headless SwiftShader). */
function scheduleAmbient(cost){
 if(ambientTimer)return;
 var wait=Math.max(1000/30,Math.min(900,cost*2.5));
 ambientTimer=setTimeout(function(){ambientTimer=0;invalidate()},wait)}
function measureClip(eye,d,aspect){clippedCorners=0;if(opts.mode==='street')return;
 var fwd=[-vMat[2],-vMat[6],-vMat[10]],rv=[vMat[0],vMat[4],vMat[8]],uv=[vMat[1],vMat[5],vMat[9]],hx=d*.5*aspect,hy=d*.5;
 for(var b of pickBoxes){var inFrame=false,ahead=0;
  for(var c=0;c<8;c++){var px=c&1?b.max[0]:b.min[0],py=c&2?b.max[1]:b.min[1],pz=c&4?b.max[2]:b.min[2];
   var vx=px-eye[0],vy=py-eye[1],vz=pz-eye[2];
   if(vx*fwd[0]+vy*fwd[1]+vz*fwd[2]<1)ahead++;
   if(Math.abs(vx*rv[0]+vy*rv[1]+vz*rv[2])<=hx&&Math.abs(vx*uv[0]+vy*uv[1]+vz*uv[2])<=hy)inFrame=true}
  if(inFrame)clippedCorners+=ahead}}
function fly(to){transition={from:{...cam,target:cam.target.slice()},to:{...cam,...to},start:performance.now()};invalidate()}
/* The collage has no geography to fall back on, so its home view is measured
   from the classification itself: every column must fit the screen. */
function collageDistance(){var places=[...collageLayout().places.values()];if(!places.length)return 235;
 var xs=places.map(p=>p.pos[0]),zs=places.map(p=>p.pos[2]),aspect=Math.max(.3,(canvas.clientWidth||1)/(canvas.clientHeight||1));
 var w=Math.max.apply(null,xs)-Math.min.apply(null,xs)+70,d=Math.max.apply(null,zs)-Math.min.apply(null,zs)+70;
 return Math.max(160,Math.min(900,Math.max(d*1.05,w*1.3/aspect)))}
function streetRay(e){var rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
 var right=[vMat[0],vMat[4],vMat[8]],up=[vMat[1],vMat[5],vMat[9]],back=[vMat[2],vMat[6],vMat[10]];
 var rx=(x/rect.width*2-1)*Math.tan(Math.PI/6)*rect.width/rect.height,uy=(1-y/rect.height*2)*Math.tan(Math.PI/6);
 var dir=back.map((v,i)=>-v+right[i]*rx+up[i]*uy),len=Math.hypot(dir[0],dir[1],dir[2]);return dir.map(v=>v/len)}
/* Street mode: touching a structure walks you to it instead of only opening it. */
function teleport(e,target){if(!target||!(target.distance>0))return false;
 var dir=streetRay(e),stand=Math.max(0,target.distance-2.6),to=[walk.pos[0]+dir[0]*stand,1.7,walk.pos[2]+dir[2]*stand];
 for(var i=0;i<40&&blocked(to[0],to[2]);i++){to[0]-=dir[0]*.35;to[2]-=dir[2]*.35}
 if(blocked(to[0],to[2]))return false;
 var yaw=Math.atan2(-dir[0],-dir[2]),delta=((yaw-walk.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
 if(reduced.matches){walk.pos=to;walk.yaw=yaw;walkFly=null}
 else walkFly={from:walk.pos.slice(),to,yaw0:walk.yaw,delta,start:performance.now(),ms:Math.min(900,320+stand*34)};
 invalidate();return true}
function stepFly(now){if(!walkFly)return;var f=Math.min(1,(now-walkFly.start)/walkFly.ms),e=1-Math.pow(1-f,3);
 walk.pos=[walkFly.from[0]+(walkFly.to[0]-walkFly.from[0])*e,1.7,walkFly.from[2]+(walkFly.to[2]-walkFly.from[2])*e];
 walk.yaw=walkFly.yaw0+walkFly.delta*e;if(f>=1)walkFly=null;else invalidate()}
/* Fit the frame to what exists. The orbit camera is orthographic, so the
   visible height is exactly cam.dist and the width cam.dist x aspect: the home
   view can be computed instead of guessed. The old constant 155 framed a wide
   screen and left a quarter of the objects outside the glass of a phone
   (measured with touch emulation, 2026-10-22). */
function atlasFrame(yaw,pitch){
 if(!data)return null;
 var cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
 var f=[-cp*sy,-sp,-cp*cy],rt=[cy,0,-sy];
 var up=[rt[1]*f[2]-rt[2]*f[1],rt[2]*f[0]-rt[0]*f[2],rt[0]*f[1]-rt[1]*f[0]];
 var minR=Infinity,maxR=-Infinity,minU=Infinity,maxU=-Infinity,found=false;
 for(var t of data.teams){var p=wingPos(t);if(!p)continue;var m=modelOf(t.id);
  var reach=m?AtlasArchitecture.footprint(m)+1.5:3,high=m?(m.buildingHeight||m.height||0)+1.5:2;
  for(var sx=-1;sx<=1;sx+=2)for(var sz=-1;sz<=1;sz+=2)for(var sy2=0;sy2<=1;sy2++){
   var q=[p[0]+sx*reach,sy2*high,p[2]+sz*reach],a=q[0]*rt[0]+q[1]*rt[1]+q[2]*rt[2],b=q[0]*up[0]+q[1]*up[1]+q[2]*up[2];
   if(a<minR)minR=a;if(a>maxR)maxR=a;if(b<minU)minU=b;if(b>maxU)maxU=b;found=true}}
 if(!found)return null;
 var aspect=Math.max(.3,(canvas.clientWidth||1)/(canvas.clientHeight||1)),cr=(minR+maxR)/2,cu=(minU+maxU)/2;
 var dist=Math.max(60,Math.min(700,Math.max((maxU-minU)*1.1,(maxR-minR)*1.1/aspect)));
 return {dist:dist,target:[rt[0]*cr+up[0]*cu,Math.max(0,rt[1]*cr+up[1]*cu),rt[2]*cr+up[2]*cu]}}
function home(){if(opts.mode==='street'){enterStreet(opts.selected);return}
 if(opts.world==='bigz'){var h=bigzModel().home;fly({target:h.target.slice(),dist:opts.mode==='plan'?h.dist*1.1:h.dist,yaw:h.yaw,pitch:opts.mode==='plan'?1.55:h.pitch});return}var yaw=-.35,pitch=opts.mode==='plan'?1.55:.8,fit=opts.mode==='archive'?null:atlasFrame(yaw,pitch);
 fly({target:opts.mode==='archive'?[0,0,6]:fit?fit.target:[12,2,10],dist:opts.mode==='archive'?collageDistance():fit?fit.dist:155,yaw:yaw,pitch:pitch})}
function findPick(e,onlyTeams=false){var rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,best=null,dist=onlyTeams?22:18;
 if(!onlyTeams){var right=[vMat[0],vMat[4],vMat[8]],up=[vMat[1],vMat[5],vMat[9]],back=[vMat[2],vMat[6],vMat[10]],rx=(x/rect.width-.5)*cam.dist*rect.width/rect.height,uy=(.5-y/rect.height)*cam.dist;
 var origin=cam.target.map((v,i)=>v+back[i]*ORBIT_BACK+right[i]*rx+up[i]*uy),dir=back.map(v=>-v),nearest=Infinity;
 if(opts.mode==='street'){origin=walk.pos.slice();rx=(x/rect.width*2-1)*Math.tan(Math.PI/6)*rect.width/rect.height;uy=(1-y/rect.height*2)*Math.tan(Math.PI/6);dir=back.map((v,i)=>-v+right[i]*rx+up[i]*uy);var length=Math.hypot(...dir);dir=dir.map(v=>v/length)}
 for(var b of pickBoxes){if(b.lod&&opts.quality==='eco'&&opts.mode!=='street'&&cam.dist>320)continue;var near=0,far=Infinity;for(var axis=0;axis<3;axis++){if(Math.abs(dir[axis])<1e-8){if(origin[axis]<b.min[axis]||origin[axis]>b.max[axis]){far=-1;break}}else{var t1=(b.min[axis]-origin[axis])/dir[axis],t2=(b.max[axis]-origin[axis])/dir[axis];near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2))}}
 if(far<near||near>=nearest)continue;
 if(b.opening){var point=origin.map((v,i)=>v+near*dir[i]),axis=b.w>b.d?0:2;if(point[1]>b.min[1]+.15&&point[1]<b.max[1]-.15&&point[axis]>b.min[axis]+.15&&point[axis]<b.max[axis]-.15)continue}
 nearest=near;best=b}
 if(best){best={...best,distance:nearest};if(best.building&&['plinth','mast','ring'].includes(best.role))return {id:best.building,team:best.team,building:best.building,distance:nearest};
 if(best.building&&['terrace','pylon'].includes(best.role)&&opts.mode!=='street'&&cam.dist>160)return {id:best.building,team:best.team,building:best.building,distance:nearest};return opts.mode!=='street'&&cam.dist>115?{id:best.team,team:best.team,building:best.building}:best}
 }
 if(opts.mode==='street')return null;
 for(var m of (onlyTeams?[]:hit.filter(h=>h.role==='geography')).concat(marks)){if(labelNodes.has(m.id)&&labelNodes.get(m.id).hidden)continue;var p=screen(m.pos,rect.width,rect.height),v=Math.hypot(p[0]-x,p[1]-y);if(v<dist){best=m;dist=v}}return best}
var surface=canvas.closest('.stage')||canvas,suppressClickUntil=0;
surface.addEventListener('click',e=>{if(!e.target.closest('.camera,.walk-controls,#archive-gate,#archive-exit,#archive-curtain,#era-bar')&&performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
/* Drag solves the ground displacement whose screen projection equals the drag,
   so the point under the finger stays under the finger at any pitch. */
function panPixels(dx,dy){var unit=cam.dist/Math.max(1,canvas.clientHeight),rx=vMat[0],rz=vMat[8],ux=vMat[1],uz=vMat[9],det=rx*uz-rz*ux;
 if(!isFinite(det)||Math.abs(det)<1e-6)return;var sx=dx*unit,sy=dy*unit;
 var a=(sx*uz+rz*sy)/det,b=(-rx*sy-ux*sx)/det;
 cam.target[0]=Math.max(-PAN_LIMIT,Math.min(PAN_LIMIT,cam.target[0]-a));
 cam.target[2]=Math.max(-PAN_LIMIT,Math.min(PAN_LIMIT,cam.target[2]-b));}
/* The ground under a screen point, and the screen point of a ground position.
   The orbit camera is orthographic in all but name, so the pair is exact and,
   unlike screen(), does not read a matrix left over from the previous frame —
   which is what a zoom needs, because it has just changed the distance. */
function groundAt(cx,cy){var rect=canvas.getBoundingClientRect();
 var right=[vMat[0],vMat[4],vMat[8]],up=[vMat[1],vMat[5],vMat[9]],back=[vMat[2],vMat[6],vMat[10]];
 var rx=((cx-rect.left)/rect.width-.5)*cam.dist*rect.width/rect.height,uy=(.5-(cy-rect.top)/rect.height)*cam.dist;
 var origin=cam.target.map((v,i)=>v+back[i]*ORBIT_BACK+right[i]*rx+up[i]*uy),dir=back.map(v=>-v);
 if(Math.abs(dir[1])<1e-6)return null;var t=-origin[1]/dir[1];return [origin[0]+dir[0]*t,0,origin[2]+dir[2]*t]}
function groundScreen(g){var rect=canvas.getBoundingClientRect();
 var right=[vMat[0],vMat[4],vMat[8]],up=[vMat[1],vMat[5],vMat[9]];
 var v=[g[0]-cam.target[0],g[1]-cam.target[1],g[2]-cam.target[2]];
 var rx=v[0]*right[0]+v[1]*right[1]+v[2]*right[2],uy=v[0]*up[0]+v[1]*up[1]+v[2]*up[2];
 return [rect.width*(.5+rx/(cam.dist*rect.width/rect.height)),rect.height*(.5-uy/cam.dist)]}
/* Zoom that holds its ground: the distance changes, then the point that was
   under the fingers (or the cursor) is brought back under them. */
/* How far out zoom is allowed to go. Past the frame that already shows every
   object there is nothing left to see, so the old constant 700 only shrank
   the city into a corner of empty paper (2026-10-24). The ceiling is now the
   fitted frame with a margin, measured from the data, not a number. */
function zoomCeiling(){if(opts.world==='bigz')return 700;
 if(opts.mode==='archive')return Math.min(900,Math.max(120,collageDistance()*1.3));
 var fit=atlasFrame(cam.yaw,cam.pitch);return Math.min(700,Math.max(90,(fit?fit.dist:155)*1.35))}
function zoomHolding(factor,cx,cy){transition=null;var hold=groundAt(cx,cy),rect=canvas.getBoundingClientRect();
 cam.dist=Math.max(8,Math.min(zoomCeiling(),cam.dist*factor));
 if(!hold)return;var s=groundScreen(hold);panPixels(cx-rect.left-s[0],cy-rect.top-s[1])}
/* Recentre on a touched point: the double tap and the double click share it. */
function recentreOn(cx,cy){var hit=groundAt(cx,cy);if(!hit)return;
 fly({target:[Math.max(-PAN_LIMIT,Math.min(PAN_LIMIT,hit[0])),0,Math.max(-PAN_LIMIT,Math.min(PAN_LIMIT,hit[2]))],dist:Math.max(8,cam.dist*.55)})}
/* Release keeps the gesture alive briefly: the frame settles instead of stopping dead. */
function glideStep(now){if(!glide)return;var dt=Math.min(.05,(now-glide.t)/1000);glide.t=now;
 if(glide.pan)panPixels(glide.dx*dt,glide.dy*dt);else{cam.yaw+=glide.dx*dt*.006;cam.pitch=Math.max(.25,Math.min(1.55,cam.pitch+glide.dy*dt*.006))}
 var decay=Math.exp(-5.5*dt);glide.dx*=decay;glide.dy*=decay;
 if(Math.hypot(glide.dx,glide.dy)<14)glide=null;else invalidate()}
function startGlide(){if(reduced.matches||!drag||opts.mode==='street'||!drag.vx&&!drag.vy)return;
 if(Math.hypot(drag.vx,drag.vy)<90)return;glide={dx:Math.max(-2600,Math.min(2600,drag.vx)),dy:Math.max(-2600,Math.min(2600,drag.vy)),pan:!!drag.pan,t:performance.now()};invalidate()}
/* How far a press may slip and still read as a tap. A fingertip is wider than
   a cursor and never holds still, so a touch gets a finger's worth of slack. */
var TAP_SLIP={touch:12,pen:7,mouse:5},tapSlip=e=>TAP_SLIP[e.pointerType]||TAP_SLIP.mouse,lastTap=null;
/* The gate overlay and the archive exit are real controls living on the stage:
   the scene must not capture their touch, or the tap never becomes a click. */
surface.addEventListener('pointerdown',e=>{if(e.target.closest('.camera,.walk-controls,#archive-gate,#archive-exit,#archive-curtain,#era-bar'))return;canvas.focus({preventScroll:true});transition=null;glide=null;surface.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(!drag)drag={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false,slip:tapSlip(e),touch:e.pointerType==='touch',label:e.target.closest('#map-labels button,.relation-line')?.dataset.id};else drag.moved=true;});
surface.addEventListener('pointermove',e=>{if(e.target.closest('.camera,.walk-controls,#archive-gate,#archive-exit,#archive-curtain,#era-bar'))return;if(!drag){if(e.pointerType==='touch')return;var m=findPick(e,true);if(hover!==(m?.id||'')){hover=m?.id||'';invalidate()}return}if(!pointers.has(e.pointerId))return;
 /* Two fingers: the ground held between them at the start of the step is put
    back between them at the end, so a pinch zooms into what it is pinching
    and drags what it is dragging in the same motion. */
 if(pointers.size>=2){var old=[...pointers.values()],oldDist=Math.hypot(old[0][0]-old[1][0],old[0][1]-old[1][1]);
  var oldMid=[(old[0][0]+old[1][0])/2,(old[0][1]+old[1][1])/2];
  pointers.set(e.pointerId,[e.clientX,e.clientY]);
  var ps=[...pointers.values()],newDist=Math.hypot(ps[0][0]-ps[1][0],ps[0][1]-ps[1][1]);
  var newMid=[(ps[0][0]+ps[1][0])/2,(ps[0][1]+ps[1][1])/2];
  if(opts.mode!=='street'){var hold=groundAt(oldMid[0],oldMid[1]),rect=canvas.getBoundingClientRect();
   if(oldDist&&newDist){transition=null;cam.dist=Math.max(8,Math.min(700,cam.dist*oldDist/newDist))}
   if(hold){var mark=groundScreen(hold);panPixels(newMid[0]-rect.left-mark[0],newMid[1]-rect.top-mark[1])}
   else panPixels(newMid[0]-oldMid[0],newMid[1]-oldMid[1])}
  drag.moved=true;invalidate();return}
 var prev=pointers.get(e.pointerId),dx=e.clientX-prev[0],dy=e.clientY-prev[1];var pan=e.shiftKey||e.buttons===2||e.buttons===4||opts.gesture==='pan';
 /* A dead zone before the frame moves at all. Without it a fingertip's own
    tremor turns the camera a little, the world slides out from under the
    finger, and the tap that follows picks nothing — the view has moved away
    from what was touched. Below the slip the press is still a tap. */
 if(!drag.moved&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<=(drag.slip||5)){pointers.set(e.pointerId,[e.clientX,e.clientY]);drag.x=e.clientX;drag.y=e.clientY;return}
 if(opts.mode==='street'){walkFly=null;walk.yaw-=dx*.004;walk.pitch=Math.max(-1.2,Math.min(1.2,walk.pitch-dy*.004))}else if(pan)panPixels(dx,dy);else{cam.yaw+=dx*.006;cam.pitch=Math.max(.25,Math.min(1.55,cam.pitch+dy*.006))}
 var now=performance.now(),span=Math.max(8,now-(drag.t||now-16));drag.vx=dx/span*1000;drag.vy=dy/span*1000;drag.t=now;drag.pan=pan;
 pointers.set(e.pointerId,[e.clientX,e.clientY]);drag.x=e.clientX;drag.y=e.clientY;drag.moved=drag.moved||Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>(drag.slip||5);invalidate()});
function endPointer(e,cancel){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(!drag)return;
 if(!cancel&&!drag.moved&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<=(drag.slip||5)+1){var best=drag.label?{id:drag.label}:findPick(e);
  /* Two taps in the same place read as "take me there". dblclick is not
     dependable under a finger, and the click guard below would swallow it. */
  /* The window is measured between the two releases, not between the two
     contacts, so a finger that rests on the glass for a moment still counts.
     340 ms left no room for that and dropped real double taps on a phone
     (measured 2026-10-24); platforms allow 300-500 ms. */
  var now=performance.now(),pair=drag.touch&&lastTap&&now-lastTap.t<460&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<44;
  lastTap=drag.touch?{t:now,x:e.clientX,y:e.clientY}:null;
  if(pair&&opts.mode!=='street'){lastTap=null;recentreOn(e.clientX,e.clientY);if(best)onPick(best.id,best.team);pointers.clear();drag=null;suppressClickUntil=now+350;return}
  if(best&&opts.mode==='street'&&!drag.label)teleport(e,best);
  if(best)onPick(best.id,best.team)}
 else if(!cancel&&pointers.size===0)startGlide();
 suppressClickUntil=performance.now()+350;if(pointers.size){var [id,p]=pointers.entries().next().value;drag={id,x:p[0],y:p[1],sx:p[0],sy:p[1],moved:true}}else drag=null}
surface.addEventListener('pointerup',e=>endPointer(e,false));surface.addEventListener('pointercancel',e=>endPointer(e,true));surface.addEventListener('lostpointercapture',e=>endPointer(e,true));window.addEventListener('blur',()=>{drag=null;pointers.clear()});
surface.addEventListener('wheel',e=>{if(e.target.closest('.camera,.walk-controls'))return;if(opts.mode==='street')return;if(!opts.interactive&&!e.ctrlKey)return;e.preventDefault();zoomHolding(e.deltaY>0?1.09:.91,e.clientX,e.clientY);invalidate()},{passive:false});
/* Double tap reads as "take me there": the frame recentres on what was touched. */
surface.addEventListener('dblclick',e=>{if(e.target.closest('.camera,.walk-controls')||opts.mode==='street')return;recentreOn(e.clientX,e.clientY)});canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('scene-status').textContent='3D paused · Lista i dosijei / List and dossiers ↓'});canvas.addEventListener('webglcontextrestored',()=>location.reload());
new ResizeObserver(invalidate).observe(canvas);document.addEventListener('visibilitychange',invalidate);reduced.addEventListener('change',invalidate);new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)invalidate()}).observe(canvas);
function geometryKey(o){return JSON.stringify([o.world||'atlas',o.mode==='archive',o.mode==='street',o.mode==='plan',o.layer,o.selected,o.claim,o.era||'',[...(o.visible||[])].sort(),(o.claims||[]).map(c=>c.id).sort(),o.connections])}
return {setBigz(b){if(bigz===b)return;bigz=b;bigzFor=null;if(opts.world==='bigz'){staticKey='';build()}},stop:stopWalk,setCulling(value){culling=!!value;invalidate()},setOrbitBack(value){ORBIT_BACK=value>0?value:2000;invalidate()},groundAt(cx,cy){return groundAt(cx,cy)},groundScreen(g){return groundScreen(g)},probeClip(on){clipProbe=!!on;invalidate()},update(d,g,o){var change=opts.mode!==o.mode||opts.world!==o.world,revision=data?.datasetRevision!==d.datasetRevision,rebuild=data!==d||geo!==g||geometryKey(opts)!==geometryKey(o);if(data!==d)models=AtlasArchitecture.compile(d);data=d;geo=g;opts=o;if(revision)growthStart=performance.now();if(rebuild)build();else invalidate();if(change){stopWalk();home()}},focus(id){if(opts.mode==='street'){enterStreet(id);return}
  if(opts.world==='bigz'){var el=bigzModel().elements.find(e=>e.id===id&&e.pick!==false);if(el)fly({target:[el.x,el.y+el.h/2,el.z],dist:Math.max(22,el.h*2.6,el.w*3.2),pitch:opts.mode==='plan'?1.55:.7});else home();return}var lead=leadOf(id);if(lead&&opts.mode!=='archive'){var lt=data.teams.find(t=>t.id===lead.id),lp=lt&&position(lt);if(lp){fly({target:[lp[0],(lead.buildingHeight||0)*.4,lp[2]],dist:Math.max(52,(lead.buildingSpan||40)*1.9,(lead.buildingSpan||40)*1.28/Math.max(.25,canvas.clientWidth/canvas.clientHeight)),pitch:opts.mode==='plan'?1.55:.72});return}}var t=data.teams.find(t=>t.id===id),p=t&&wingPos(t),m=models.find(m=>m.id===id);if(p)fly({target:[p[0],(m?.height||0)*.35,p[2]],dist:Math.max(40,(m?.height||0)*2.5,(m?AtlasArchitecture.footprint(m)*2:12)*1.28/Math.max(.25,canvas.clientWidth/canvas.clientHeight)),pitch:opts.mode==='plan'?1.55:.75})},home,zoom(f){if(opts.mode==='street')return;transition=null;glide=null;cam.dist=Math.max(8,Math.min(zoomCeiling(),cam.dist*f));invalidate()},replay(){growthStart=performance.now();invalidate()},stats(){return {pixels:canvas.width*canvas.height,quality:opts.quality||'auto',geographyVisible:opts.mode!=='archive',frames,triangles:(staticMesh.count+teamMesh.count)/3,buffers:9,skybox:true,vignette:true,walkSpeed:WALK_SPEED,drawnTriangles,culledChunks,lodSkipped,chunks:staticMesh.chunks.length+teamMesh.chunks.length,builds,staticBuilds,uploadedBytes,lastUploadBytes,buildMs,pickBoxes:pickBoxes.length,clipProbe:clipProbe,clippedCorners:clippedCorners,orbitBack:ORBIT_BACK,pending:!!frame,distance:cam.dist,street:opts.mode==='street',night:!!opts.night,visibleLabels:[...labelNodes.values()].filter(n=>!n.hidden).length,structures:models.filter(m=>m.records||m.archive).length,archives:models.filter(m=>m.archive).length,archiveCrates:models.reduce((n,m)=>n+(m.archive?m.archive.crates:0),0),archiveRead:models.reduce((n,m)=>n+(m.archive?m.archive.read:0),0),teamParts:models.reduce((n,m)=>n+m.shared.filter(e=>e.role==='terrace').length,0),buildings:new Set(models.map(m=>m.building)).size,sharedBuildings:models.filter(m=>m.shared.length).length,sharedTeams:models.filter(m=>m.buildingTeams.length>1).length,recordElements:models.reduce((n,m)=>n+m.records,0),sourcePillars:models.reduce((n,m)=>n+m.sources,0),arcs:arcs.length,drawCalls,inView,world:opts.world||'atlas',bigzPlates:opts.world==='bigz'?bigzModel().elements.filter(e=>e.role==='plate'||e.role==='plateRead').length:0,bigzRead:opts.world==='bigz'?bigzModel().elements.filter(e=>e.role==='plateRead').length:0,bigzRacks:opts.world==='bigz'?bigzModel().folders.length:0,density:data?densityField().meta:null}},density(){return data?densityField():null},inspect(){var r=canvas.getBoundingClientRect();return {camera:{...cam},aim:aim?{id:aim.id,team:aim.team,role:aim.role,tier:aim.tier}:null,joystick:{x:stick.x,y:stick.y},pointers:pointers.size,teleporting:!!walkFly,gliding:!!glide,orbitBack:ORBIT_BACK,street:opts.mode==='street'?{...walk,pos:walk.pos.slice()}:null,elements:hit.map(m=>({...m,screen:screen(m.pos,r.width,r.height)})),marks:marks.map(m=>({...m,screen:screen(m.pos,r.width,r.height)}))}},dispose(){if(frame)cancelAnimationFrame(frame);[...staticMesh.buffers,...teamMesh.buffers].forEach(b=>gl.deleteBuffer(b));gl.deleteBuffer(skyBuffer);gl.deleteProgram(skyProgram);gl.deleteProgram(vignetteProgram);gl.deleteProgram(prog)}};
};
