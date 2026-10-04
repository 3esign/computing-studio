/* Explicit offline snapshots. Caches are isolated to this site's scope. */
'use strict';
const base=new URL(self.registration.scope);
const prefix='computing-studio:'+base.pathname+':';
const metadata=prefix+'metadata';
const pointer=new URL('__offline_snapshot__',base).href;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
let saving=null;
async function save(){
  const response=await fetch(new URL('offline-manifest.json',base),{cache:'no-store'});
  if(!response.ok)throw new Error('Offline manifest is unavailable.');
  const manifest=await response.json();
  if(!/^[a-f0-9]{16}$/.test(manifest.version)||!Array.isArray(manifest.files))throw new Error('Invalid offline manifest.');
  const urls=manifest.files.map(file=>{
    const url=new URL(file,base);
    if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw new Error('Out-of-scope offline file.');
    return url.href;
  });
  const name=prefix+manifest.version;
  const cache=await caches.open(name);
  // addAll rejects when any required resource fails; the previous snapshot stays active.
  await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})));
  const meta=await caches.open(metadata);
  await meta.put(pointer,new Response(name));
  for(const key of await caches.keys())if(key.startsWith(prefix)&&key!==metadata&&key!==name)await caches.delete(key);
  return {ok:true,count:urls.length,version:manifest.version};
}
self.addEventListener('message',event=>{
  if(event.data?.type!=='CACHE_ALL'||!event.ports[0])return;
  if(!saving)saving=save().finally(()=>{saving=null;});
  event.waitUntil(saving.then(result=>event.ports[0].postMessage(result)).catch(error=>event.ports[0].postMessage({ok:false,error:error.message})));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
  event.respondWith((async()=>{
    try{return await fetch(event.request);}catch(error){
      const meta=await caches.open(metadata),record=await meta.match(pointer);
      if(!record)throw error;
      const cache=await caches.open(await record.text());
      url.search='';url.hash='';
      if(url.pathname.endsWith('/'))url.pathname+='index.html';
      const cached=await cache.match(url.href);
      if(cached)return cached;
      throw error;
    }
  })());
});
