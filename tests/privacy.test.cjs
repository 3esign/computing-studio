const test=require('node:test'),assert=require('node:assert/strict');
const {telefonJeLicni}=require('../../dokazi/objavi.cjs');
const detects=s=>[...s.matchAll(/(\+381|0)[0-9 /.-]{6,14}[0-9]/g)].some(m=>telefonJeLicni(s,m));
test('public dossier claim hashes are not telephones; real telephone contexts stay blocked',()=>{
 for(const s of ['<article id="T26:autorstva:b037211742e7">','{"id":"T26:autorstva:b037211742e7"}','{"claim":"T26:autorstva:b037211742e7"}'])assert.equal(detects(s),false,s);
 for(const s of ['<p>0601234567</p>','<article id="0601234567">','{"id":"0601234567"}','<p data-id="T26:autorstva:b037211742e7">','<article id="T26:autorstva:b037211742e7"><p>0601234567</p>'])assert.equal(detects(s),true,s);
});
