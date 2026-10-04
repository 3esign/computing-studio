'use strict';
// Focused model tests: no browser, external dependencies, or legacy suite.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../lab/giza/model.js');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS | '+name);}
check('known independent totals and layer widths for all supported N',()=>{
  const totals=[84,165,286,455,680,969,1330];
  for(let N=4;N<=10;N++){
    const rows=M.layersFor(N);assert.equal(rows.length,N);
    assert.equal(rows[0].side,2*N-1);assert.equal(rows.at(-1).side,1);
    assert.equal(rows.reduce((s,r)=>s+r.blocks,0),totals[N-4]);
    assert.equal(M.progress(M.create(N)).totalBlocks,totals[N-4]);
    assert.ok(rows.every((r,k)=>r.k===k&&r.blocks===r.side*r.side));
  }
});
check('N=4 exact prefixes; progress is not height or historical time',()=>{
  let s=M.create(4);const counts=[0,49,74,83,84];
  for(let i=0;i<=4;i++){
    const p=M.progress(s);assert.equal(p.placedBlocks,counts[i]);
    assert.equal(p.height,i);assert.equal(p.heightFraction,i/4);assert.equal(p.blockFraction,counts[i]/84);
    assert.equal(p.latest?.k??null,i===0?null:i-1);assert.equal(p.next?.k??null,i===4?null:i);
    s=M.advance(s);
  }
  assert.equal(M.progress(M.advance(M.create(4))).blockFraction,7/12);
});
check('all states contain exactly the counted unique unit cubes, no overlaps',()=>{
  for(let N=4;N<=10;N++){
    let s=M.create(N);
    for(let m=0;m<=N;m++){
      const cells=M.cells(s),p=M.progress(s);
      assert.equal(cells.length,p.placedBlocks);assert.equal(new Set(cells.map(c=>c.id)).size,cells.length);
      assert.equal(new Set(cells.map(c=>[c.x,c.y,c.z].join(','))).size,cells.length);
      for(let k=0;k<m;k++){
        const layer=cells.filter(c=>c.k===k),side=2*(N-k)-1;
        assert.equal(layer.length,side*side);
        assert.equal(layer.reduce((sum,c)=>sum+c.x+.5,0),0);
        assert.equal(layer.reduce((sum,c)=>sum+c.y+.5,0),0);
        assert.ok(layer.every(c=>c.z===k&&c.x>=-side/2&&c.x+1<=side/2&&c.y>=-side/2&&c.y+1<=side/2));
        assert.ok(layer.every(c=>Number.isInteger(c.x+.5)&&Number.isInteger(c.y+.5)));
      }
      s=M.advance(s);
    }
  }
});
check('step is pure; terminal step saturates; reset preserves N',()=>{
  const initial=M.create(6),next=M.advance(initial);assert.deepEqual(initial,{N:6,built:0});assert.deepEqual(next,{N:6,built:1});
  let done=initial;for(let i=0;i<9;i++)done=M.advance(done);
  assert.deepEqual(done,{N:6,built:6});assert.equal(M.progress(done).done,true);
  assert.deepEqual(M.reset(done),{N:6,built:0});
});
check('invalid dimensions and malformed progress are rejected',()=>{
  for(const N of [undefined,null,'4',3,11,4.5,NaN,Infinity,-1])assert.throws(()=>M.layersFor(N));
  for(const built of [-1,5,.5,NaN,Infinity,'1'])assert.throws(()=>M.progress({N:4,built}));
  assert.throws(()=>M.advance(null));assert.throws(()=>M.cells({N:100,built:0}));
});
check('projection preserves known axes and relative height',()=>{
  assert.deepEqual(M.project(0,0,0),{u:0,v:0});
  assert.equal(M.project(1,1,0).u,0);assert.equal(M.project(1,1,0).v,1);
  assert.equal(M.project(2,-2,0).v,0);assert.equal(M.project(0,0,4).v,-4);
});
check('browser export and displayed function compute the same layers',()=>{
  const sandbox={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lab/giza/model.js'),'utf8'),sandbox);
  assert.equal(typeof sandbox.GizaModel.create,'function');
  const displayed=vm.runInNewContext('('+M.layersFor.toString()+')');
  for(let N=4;N<=10;N++)assert.equal(JSON.stringify(displayed(N)),JSON.stringify(M.layersFor(N)));
  assert.equal(JSON.stringify(sandbox.GizaModel.progress(sandbox.GizaModel.advance(sandbox.GizaModel.create(4)))),JSON.stringify(M.progress(M.advance(M.create(4)))));
});
console.log(JSON.stringify({suite:'giza-model',passed,failed:0,node:process.version}));
