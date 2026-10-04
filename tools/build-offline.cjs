/* Rebuild the explicit offline snapshot after changing public site content. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const allowed=/\.(?:html|css|js|json|svg|webmanifest)$/;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(e.name.startsWith('.')||['tools','tests'].includes(e.name))return [];
  const full=path.join(dir,e.name);
  return e.isDirectory()?walk(full):allowed.test(e.name)&&!['sw.js','offline-manifest.json'].includes(e.name)?[full]:[];
});}
const files=walk(root).sort();
const hash=crypto.createHash('sha256');let bytes=0;
for(const f of files){const b=fs.readFileSync(f);bytes+=b.length;hash.update(path.relative(root,f));hash.update(b);}
const manifest={version:hash.digest('hex').slice(0,16),bytes,files:files.map(f=>path.relative(root,f).split(path.sep).join('/'))};
fs.writeFileSync(path.join(root,'offline-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({files:files.length,bytes,version:manifest.version}));
