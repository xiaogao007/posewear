const V='posewear-v9';
const PRECACHE=['./','index.html','style.css','app.js','studio.js','extras.js','zip.js','favicon.svg'];
// Authentication and protected resources must always reach the server. Cache API
// ignores HTTP cache headers, so private paths are explicitly excluded here.
const privatePath=url=>url.pathname.startsWith('/api/')||url.pathname.startsWith('/restricted/')||url.pathname.startsWith('/internal/');
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(V).then(cache=>cache.addAll(PRECACHE)));});
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('posewear-')&&key!==V&&key!==V+'-img').map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==location.origin||privatePath(url)||event.request.method!=='GET')return;
 const image=/\/(p|c|r)\/(t|i|m)\//.test(url.pathname);
 const safe=response=>response.ok&&!/private|no-store/i.test(response.headers.get('cache-control')||'');
 const remember=async response=>{if(safe(response)){const cache=await caches.open(V+(image?'-img':''));await cache.put(event.request,response.clone());}return response;};
 event.respondWith(image?caches.match(event.request).then(cached=>cached||fetch(event.request).then(remember)):fetch(event.request).then(remember).catch(()=>caches.match(event.request)));
});
