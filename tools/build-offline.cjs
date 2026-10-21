/* Rebuild the explicit offline snapshot after changing public site content. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function build(root=path.resolve(__dirname,'..')){
const allowed=/\.(?:html|css|js|json|svg|webmanifest)$/;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(e.name.startsWith('.')||['tools','tests'].includes(e.name))return [];
  const full=path.join(dir,e.name);
  return e.isDirectory()?walk(full):allowed.test(e.name)&&!['sw.js','offline-manifest.json'].includes(e.name)?[full]:[];
});}
const excluded=/^(?:studenti\/|data\/student-pasosi\.json$|data\/pasos\/bigz-arhiva\.json$|data\/pasos\/podnesaci\/|pasos-studenata\.html$|assets\/pasos-studenata\.js$)/;
const media=JSON.parse(fs.readFileSync(path.join(root,'svet/data/atlas.json'),'utf8')).media||[];
const approved=media.map(m=>{if(!/^media\/[a-zA-Z0-9/_-]+\.(?:jpe?g|png|webp|pdf)$/.test(m.href))throw Error('Invalid offline media path');const file=path.join(root,m.href);if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==m.sha256)throw Error('Offline media hash mismatch');return file});
const files=[...new Set([...walk(root).filter(f=>!excluded.test(path.relative(root,f).split(path.sep).join('/'))),...approved])].sort();
const hash=crypto.createHash('sha256');let bytes=0;
for(const f of files){const b=fs.readFileSync(f);bytes+=b.length;hash.update(path.relative(root,f).split(path.sep).join('/')+'\0');hash.update(b);}
const manifest={version:hash.digest('hex').slice(0,16),bytes,files:files.map(f=>path.relative(root,f).split(path.sep).join('/'))};
fs.writeFileSync(path.join(root,'offline-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
return {files:files.length,bytes,version:manifest.version};
}
module.exports=build;
if(require.main===module)console.log(JSON.stringify(build()));
