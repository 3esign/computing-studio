/* The offline manifest measures bytes on disk, so a Windows checkout that still
   holds CRLF in docs/ silently produces different numbers than the LF blobs the
   site actually serves. That mismatch reached a published tree once: the service
   worker would precache files whose sizes never matched the manifest. These two
   checks are deliberately independent of the builder, which rewrites the manifest
   as a side effect and therefore cannot be used to detect its own staleness. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const docs=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(docs,'offline-manifest.json'),'utf8'));

test('no file in the offline snapshot carries CRLF: docs/** is declared eol=lf',()=>{
 const crlf=manifest.files.filter(f=>{
  if(!/\.(?:html|css|js|json|svg|webmanifest)$/.test(f))return false;
  return fs.readFileSync(path.join(docs,f)).includes('\r\n');
 });
 assert.deepEqual(crlf,[],'CRLF in docs/ — renormalize the checkout before rebuilding the manifest');
});

test('the committed offline manifest matches the bytes on disk',()=>{
 const hash=crypto.createHash('sha256');let bytes=0;
 for(const f of manifest.files){
  const b=fs.readFileSync(path.join(docs,f));
  bytes+=b.length;hash.update(f+'\0');hash.update(b);
 }
 assert.equal(bytes,manifest.bytes,'manifest bytes are stale');
 assert.equal(hash.digest('hex').slice(0,16),manifest.version,'manifest version is stale');
});
