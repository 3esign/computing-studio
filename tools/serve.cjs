const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const site=path.resolve(__dirname,'..'),prefix='/computing-studio/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(!pathname.startsWith(prefix)){res.writeHead(302,{Location:prefix}).end();return;}
 let rel=pathname.slice(prefix.length);if(!rel||rel.endsWith('/'))rel+='index.html';
 const target=path.resolve(site,rel);
 if(!target.startsWith(site+path.sep)||rel.split('/').some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}
 try{if(!fs.statSync(target).isFile())throw Error();res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'text/plain; charset=utf-8','Cache-Control':'no-cache'});fs.createReadStream(target).pipe(res);}catch{res.writeHead(404).end('Not found');}
}).listen(Number(process.env.PORT||0),'127.0.0.1',function(){console.log('http://127.0.0.1:'+this.address().port+prefix);});
