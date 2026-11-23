import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { Agent, fetch as remoteFetch } from 'undici';
import proxyTools from './proxy.cjs';
import {createWeChat} from './wechat.mjs';

const VIEW = 'content.adult.view', MANAGE = 'users.permissions.manage';
const sha = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
const equal = (a, b) => crypto.timingSafeEqual(Buffer.from(sha(a)), Buffer.from(sha(b)));
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json' };
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

export async function createAccessService(options = {}) {
  const root = path.resolve(options.root || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const stateDir = path.resolve(options.stateDir || process.env.POSEWEAR_AUTH_STATE || process.env.STATE_DIRECTORY || path.join(root, '.local/auth'));
  const privateDir = path.resolve(options.privateDir || process.env.POSEWEAR_PRIVATE || path.join(root, 'private'));
  const origin = new URL(options.origin || process.env.POSEWEAR_SITE || 'http://localhost:8787').origin;
  const secure = origin.startsWith('https:');
  fs.mkdirSync(stateDir, { recursive:true, mode:0o700 });
  const persistentSecret = name => {
    const target = path.join(stateDir, name);
    if (!fs.existsSync(target)) fs.writeFileSync(target, token() + '\n', { mode:0o600, flag:'wx' });
    return fs.readFileSync(target, 'utf8').trim();
  };
  const secret = persistentSecret('signing-secret');
  const db = new DatabaseSync(path.join(stateDir, 'accounts.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const authOptions = {
    database:db, secret, baseURL:origin, trustedOrigins:[origin],
    emailAndPassword:{ enabled:true, minPasswordLength:12, maxPasswordLength:128, autoSignIn:false },
    session:{ expiresIn:Number(process.env.POSEWEAR_SESSION_SECONDS || 28800), disableSessionRefresh:true, cookieCache:{enabled:false} },
    advanced:{ useSecureCookies:false, cookiePrefix:'posewear', defaultCookieAttributes:{secure,httpOnly:true,sameSite:'lax',path:'/'}, cookies:{session_token:{name:secure?'__Host-posewear.session_token':'posewear.session_token'}} },
    rateLimit:{enabled:true,window:60,max:10,storage:'memory'},
    logger:{disabled:true},
  };
  await (await getMigrations(authOptions)).runMigrations();
  const auth = betterAuth(authOptions);
  db.exec(`CREATE TABLE IF NOT EXISTS pw_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pw_grants (user_id TEXT NOT NULL, permission TEXT NOT NULL, PRIMARY KEY(user_id,permission));
    CREATE TABLE IF NOT EXISTS pw_modes (session_id TEXT PRIMARY KEY, adult INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS pw_invites (hash TEXT PRIMARY KEY,email TEXT NOT NULL,adult INTEGER NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,actor TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pw_audit (id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created INTEGER NOT NULL);`);
  const meta = key => db.prepare('SELECT value FROM pw_meta WHERE key=?').get(key)?.value;
  const setMeta = (key, value) => db.prepare('INSERT OR REPLACE INTO pw_meta VALUES (?,?)').run(key, String(value));
  if (!meta('enabled')) setMeta('enabled','1');
  if (!meta('owner') && !meta('bootstrap')) setMeta('bootstrap',sha(persistentSecret('bootstrap-code')));
  const grants = id => db.prepare('SELECT permission FROM pw_grants WHERE user_id=?').all(id).map(row=>row.permission);
  const grant = (id, permission) => db.prepare('INSERT OR IGNORE INTO pw_grants VALUES (?,?)').run(id, permission);
  const audit = (actor, action, target) => db.prepare('INSERT INTO pw_audit(actor,action,target,created) VALUES (?,?,?,?)').run(actor, action, target, Date.now());
  const csrf = id => crypto.createHmac('sha256',secret).update('csrf:'+id).digest('base64url');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(privateDir, 'manifest.json'),'utf8')); }
  catch { manifest = { assets:{}, catalogues:{} }; }
  const remoteAgent = new Agent({connections:8,connect:{lookup:proxyTools.publicLookup,timeout:15000},autoSelectFamily:true,autoSelectFamilyAttemptTimeout:250,maxResponseSize:24*1024*1024});
  const limits = new Map();
  const limited = (key, max=12) => {
    const now=Date.now(); let item=limits.get(key);
    if (!item || now-item.start>60000) { item={start:now,count:0}; limits.set(key,item); }
    if (limits.size>4000) for (const [k,v] of limits) if(now-v.start>60000) limits.delete(k);
    if (++item.count>max) fail(429,'操作过于频繁，请稍后重试');
  };
  const sessionFor = async request => {
    const session = await auth.api.getSession({ headers:request.headers, query:{disableCookieCache:true,disableRefresh:true} });
    if (!session) return null;
    return {...session, permissions:grants(session.user.id)};
  };
  const requireSession = async (request, permission) => {
    const session = await sessionFor(request);
    if (!session) fail(401,'请先登录');
    if (permission && !session.permissions.includes(permission)) fail(403,'此账号没有操作权限');
    return session;
  };
  const isAdult = session => Boolean(session && meta('enabled')==='1' && session.permissions.includes(VIEW) && db.prepare('SELECT adult FROM pw_modes WHERE session_id=?').get(session.session.id)?.adult);
  const requireAdult = async request => {
    const session = await requireSession(request, VIEW);
    if (!isAdult(session)) fail(403,'请在内容偏好中确认开启');
    return session;
  };
  const describe = session => ({
    user:session?{id:session.user.id,name:session.user.name,email:session.user.email}:null,
    permissions:session?.permissions || [],
    adultAvailable:Boolean(session?.permissions.includes(VIEW) && meta('enabled')==='1'),
    adultMode:isAdult(session),
    csrfToken:session?csrf(session.session.id):null,
  });
  const checkCsrf = (request, session) => {
    if (!equal(request.headers.get('x-csrf-token') || '', csrf(session.session.id))) fail(403,'页面状态已更新，请刷新后重试');
  };
  const json = (body, status=200, extra={}) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',...extra}});
  const bodyFor = async request => { try { return await request.json(); } catch { fail(400,'提交格式不正确'); } };
  const wechat=createWeChat({db,secret,root,origin,meta,setMeta,audit,fail,limited,json});
  const validateAccount = body => {
    const email=String(body.email||'').trim().toLowerCase(), password=String(body.password||''), name=String(body.name||'').trim().slice(0,80);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) fail(400,'请填写有效邮箱');
    if(password.length<12 || password.length>128) fail(400,'密码需为 12–128 个字符');
    return {email,password,name:name||email.split('@')[0]};
  };
  const signInResponse = async (body, headers) => {
    const response=await auth.api.signInEmail({body:{email:body.email,password:body.password,rememberMe:false},headers,asResponse:true});
    if (!response.ok) return json({error:'邮箱或密码不正确'},401);
    const safeHeaders=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'});
    for (const cookie of response.headers.getSetCookie()) safeHeaders.append('set-cookie',cookie);
    return new Response('{"ok":true}',{headers:safeHeaders});
  };
  let accountMutation = false;
  async function createAccount(body, headers, recovery=false) {
    const existing=db.prepare('SELECT id FROM user WHERE email=?').get(body.email);
    if (existing) {
      if(meta('owner')&&!recovery) fail(409,'该邮箱已创建账号，请直接登录');
      const check=await auth.api.signInEmail({body:{email:body.email,password:body.password},headers,asResponse:true});
      if(!check.ok) fail(400,'账号创建尚未完成，请核对邮箱和密码');
      return existing.id;
    }
    const created=await auth.api.signUpEmail({body,headers});
    return created.user.id;
  }
  const protectedAsset = uri => {
    const pathname=String(uri||'').split('?')[0];
    const match=/^\/restricted\/(media|remote)\/([0-9a-f]{32}\.(?:webp|png|jpg|jpeg))$/.exec(pathname);
    if(!match) fail(404,'素材不可用');
    const asset=manifest.assets[match[2]];
    if(!asset || (asset.remote?'remote':'media')!==match[1]) fail(404,'素材不可用');
    return {asset,key:match[2]};
  };
  const fileResponse = (filename, request, restricted=false) => {
    let stat; try {stat=fs.statSync(filename);} catch {return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});}
    if (!stat.isFile()) return new Response('Not found',{status:404});
    const headers={'content-type':mime[path.extname(filename)]||'application/octet-stream','cache-control':restricted?'private, no-store':'no-cache','x-content-type-options':'nosniff','accept-ranges':'bytes'};
    let start=0,end=stat.size-1,status=200;
    if(request.headers.get('range')) {
      const match=/^bytes=(\d+)-(\d*)$/.exec(request.headers.get('range'));
      if(!match || Number(match[1])>=stat.size) return new Response(null,{status:416,headers:{...headers,'content-range':`bytes */${stat.size}`}});
      start=Number(match[1]); end=match[2]?Math.min(Number(match[2]),end):end;
      if(end<start) return new Response(null,{status:416,headers});
      status=206; headers['content-range']=`bytes ${start}-${end}/${stat.size}`;
    }
    headers['content-length']=String(end-start+1);
    return new Response(request.method==='HEAD'?null:Readable.toWeb(fs.createReadStream(filename,{start,end})),{status,headers});
  };
  async function handle(request, clientIp='unknown') {
    const url=new URL(request.url), route=url.pathname, method=request.method;
    if(route==='/api/wechat/callback')return wechat.callback(request,clientIp);
    if(method==='POST') {
      if(request.headers.get('origin')!==origin) fail(403,'请求来源不正确');
      if(!request.headers.get('content-type')?.startsWith('application/json')) fail(415,'请使用 JSON 提交');
      limited(clientIp+route,route.includes('sign-in')||route.includes('claim')||route.includes('accept')?5:20);
    } else if(!['GET','HEAD'].includes(method)) fail(405,'此操作不支持该请求方式');
    if(route==='/healthz') return json({status:'ok',service:'posewear-access'});
    if(route==='/api/me' && method==='GET') return json(describe(await sessionFor(request)));
    if(route==='/api/invite-info' && method==='GET')return json(wechat.publicInfo());
    if(route==='/api/setup/status' && method==='GET') return json({required:!meta('owner')});
    if(route==='/api/setup/claim' && method==='POST') {
      if(meta('owner') || accountMutation) fail(409,'初始化已完成或正在处理');
      const input=await bodyFor(request);
      if(!equal(sha(input.code||''),meta('bootstrap')||'')) fail(403,'初始化码无效');
      const account=validateAccount(input); accountMutation=true;
      try {
        const id=await createAccount(account,request.headers);
        db.exec('BEGIN IMMEDIATE');
        try {grant(id,VIEW);grant(id,MANAGE);setMeta('owner',id);db.prepare('DELETE FROM pw_meta WHERE key=?').run('bootstrap');audit(id,'bootstrap',id);db.exec('COMMIT');}
        catch(error){db.exec('ROLLBACK');throw error;}
        try{fs.unlinkSync(path.join(stateDir,'bootstrap-code'));}catch{}
        return await signInResponse(account,request.headers);
      } finally {accountMutation=false;}
    }
    if(route==='/api/auth/sign-in/email' && method==='POST') {
      const input=await bodyFor(request);
      try {return await signInResponse({email:String(input.email||'').toLowerCase().trim(),password:String(input.password||'')},request.headers);}
      catch {return json({error:'邮箱或密码不正确'},401);}
    }
    if(route==='/api/auth/sign-out' && method==='POST') {
      const session=await requireSession(request); checkCsrf(request,session);
      db.prepare('DELETE FROM pw_modes WHERE session_id=?').run(session.session.id);
      const result=await auth.api.signOut({headers:request.headers,asResponse:true});
      const headers=new Headers({'content-type':'application/json','cache-control':'private, no-store'});
      for(const cookie of result.headers.getSetCookie()) headers.append('set-cookie',cookie);
      return new Response('{"ok":true}',{headers});
    }
    if(route==='/api/account/password' && method==='POST') {
      const session=await requireSession(request);checkCsrf(request,session);
      const input=await bodyFor(request);validateAccount({email:session.user.email,password:input.newPassword});
      try {
        const result=await auth.api.changePassword({headers:request.headers,body:{currentPassword:input.currentPassword,newPassword:input.newPassword,revokeOtherSessions:true},asResponse:true});
        if(!result.ok)fail(400,'当前密码不正确或新密码不符合要求');
        db.prepare('DELETE FROM pw_modes WHERE session_id NOT IN (SELECT id FROM session)').run();
        const headers=new Headers({'content-type':'application/json','cache-control':'private, no-store'});
        for(const cookie of result.headers.getSetCookie())headers.append('set-cookie',cookie);
        return new Response('{"ok":true}',{headers});
      }
      catch {fail(400,'当前密码不正确或新密码不符合要求');}
    }
    if(route==='/api/session/adult-mode' && method==='POST') {
      const session=await requireSession(request);checkCsrf(request,session);
      const input=await bodyFor(request), on=input.enabled===true;
      if(on && (!session.permissions.includes(VIEW)||meta('enabled')!=='1')) fail(403,'此账号没有查看权限');
      if(on && input.confirmAdult!==true) fail(400,'请先确认已满 18 岁');
      db.prepare('INSERT OR REPLACE INTO pw_modes VALUES (?,?)').run(session.session.id,on?1:0);
      return json(describe(session));
    }
    if(route==='/api/catalog/adult' && method==='GET') {
      await requireAdult(request);
      if(!Object.hasOwn(manifest.catalogues,url.searchParams.get('type')||'')) fail(404,'目录不存在');
      const type=url.searchParams.get('type');
      return json(type==='depth'?{items:manifest.catalogues.depth,pack:manifest.depthPack||null}:manifest.catalogues[type]);
    }
    if(route==='/internal/authorize' && method==='GET') {
      if(!['GET','HEAD'].includes(request.headers.get('x-forwarded-method')||'GET')) fail(405,'只支持读取素材');
      await requireAdult(request);protectedAsset(request.headers.get('x-forwarded-uri'));
      return new Response(null,{status:204,headers:{'cache-control':'private, no-store'}});
    }
    if(route.startsWith('/restricted/')) {
      await requireAdult(request);
      const {asset,key}=protectedAsset(route);
      if(!asset.remote) return fileResponse(path.join(privateDir,'media',key),request,true);
      const target=new URL(asset.remote);
      if(target.origin!=='https://ai-pose-depth-gallery.pages.dev' || target.search || target.hash) fail(404,'素材不可用');
      const response=await remoteFetch(target,{dispatcher:remoteAgent,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{accept:'image/*'}});
      if(!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {await response.body?.cancel();fail(502,'原站图片暂时不可用');}
      const size=Number(response.headers.get('content-length')||0);
      if(size>24*1024*1024) {await response.body?.cancel();fail(502,'原站图片过大');}
      if(method==='HEAD') await response.body?.cancel();
      return new Response(method==='HEAD'?null:response.body,{headers:{'content-type':response.headers.get('content-type'),'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
    }
    if(route.startsWith('/api/admin/')) {
      const session=await requireSession(request,MANAGE);
      if(method==='POST') checkCsrf(request,session);
      if(route==='/api/admin/wechat'&&method==='GET')return json(wechat.adminInfo());
      if(route==='/api/admin/wechat'&&method==='POST')return json(wechat.configure(await bodyFor(request),session.user.id));
      if(route==='/api/admin/users' && method==='GET') {
        const q=(url.searchParams.get('q')||'').slice(0,80), page=Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1));
        const filter='%'+q+'%', total=db.prepare('SELECT COUNT(*) AS n FROM user WHERE email LIKE ? OR name LIKE ?').get(filter,filter).n;
        const last=Math.max(1,Math.ceil(total/20)), current=Math.min(page,last);
        const users=db.prepare('SELECT id,email,name FROM user WHERE email LIKE ? OR name LIKE ? ORDER BY createdAt DESC LIMIT 20 OFFSET ?').all(filter,filter,(current-1)*20).map(user=>({...user,permissions:grants(user.id)}));
        return json({users,total,page:current,pages:last,enabled:meta('enabled')==='1'});
      }
      if(route==='/api/admin/invites' && method==='POST') {
        const input=await bodyFor(request), email=String(input.email||'').trim().toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) fail(400,'请填写有效邮箱');
        if(db.prepare('SELECT id FROM user WHERE email=?').get(email)) fail(409,'该邮箱已注册，请在账号列表调整权限');
        const code=token(),expires=Date.now()+86400000;
        db.prepare('INSERT INTO pw_invites VALUES (?,?,?,?,0,?)').run(sha(code),email,input.adult===true?1:0,expires,session.user.id);
        audit(session.user.id,'invite',email);
        return json({code,email,expires},201);
      }
      if(route==='/api/admin/permissions' && method==='POST') {
        const input=await bodyFor(request), id=String(input.userId||'');
        if(!db.prepare('SELECT id FROM user WHERE id=?').get(id)) fail(404,'账号不存在');
        if(typeof input.enabled!=='boolean') fail(400,'权限值不正确');
        if(input.enabled) grant(id,VIEW);
        else {db.prepare('DELETE FROM pw_grants WHERE user_id=? AND permission=?').run(id,VIEW);db.prepare('DELETE FROM pw_modes WHERE session_id IN (SELECT id FROM session WHERE userId=?)').run(id);}
        audit(session.user.id,input.enabled?'grant-view':'revoke-view',id);
        return json({ok:true});
      }
      if(route==='/api/admin/policy' && method==='POST') {
        const input=await bodyFor(request);if(typeof input.enabled!=='boolean') fail(400,'配置值不正确');
        setMeta('enabled',input.enabled?'1':'0');if(!input.enabled)db.prepare('DELETE FROM pw_modes').run();
        audit(session.user.id,input.enabled?'enable-site-content':'disable-site-content','site');
        return json({ok:true});
      }
      fail(404,'操作不存在');
    }
    if(route==='/api/invites/accept' && method==='POST') {
      if(accountMutation) fail(409,'正在创建账号，请稍后重试');
      const input=await bodyFor(request), invitation=db.prepare('SELECT * FROM pw_invites WHERE hash=? AND used IN (0,2) AND expires>?').get(sha(input.code||''),Date.now());
      const account=validateAccount(input);
      const reservation=invitation&&db.prepare('SELECT email FROM pw_invite_reservations WHERE hash=?').get(invitation.hash);
      if(!invitation || (invitation.email&&invitation.email!==account.email)||(reservation&&reservation.email!==account.email)) fail(403,'邀请码无效、已使用或已过期');
      if(!reservation&&db.prepare('SELECT id FROM user WHERE email=?').get(account.email))fail(409,'该邮箱已创建账号，请直接登录');
      accountMutation=true;
      let created=false;
      try {
        if(!reservation){db.prepare('INSERT INTO pw_invite_reservations VALUES (?,?)').run(invitation.hash,account.email);db.prepare('UPDATE pw_invites SET used=2 WHERE hash=?').run(invitation.hash);}
        const id=await createAccount(account,request.headers,Boolean(reservation));created=true;
        db.exec('BEGIN IMMEDIATE');
        try {db.prepare('UPDATE pw_invites SET used=1,email=? WHERE hash=?').run(account.email,invitation.hash);db.prepare('DELETE FROM pw_invite_reservations WHERE hash=?').run(invitation.hash);if(invitation.adult)grant(id,VIEW);audit(id,'accept-invite',id);db.exec('COMMIT');}
        catch(error){db.exec('ROLLBACK');throw error;}
        return await signInResponse(account,request.headers);
      } catch(error) {
        if(!created&&!db.prepare('SELECT id FROM user WHERE email=?').get(account.email)){db.prepare('UPDATE pw_invites SET used=0 WHERE hash=?').run(invitation.hash);db.prepare('DELETE FROM pw_invite_reservations WHERE hash=?').run(invitation.hash);}
        throw error;
      } finally {accountMutation=false;}
    }
    if(options.servePublic && ['GET','HEAD'].includes(method) && !route.startsWith('/api/') && !route.startsWith('/internal/')) {
      if(route==='/invite')return new Response(null,{status:302,headers:{location:'/invite/','cache-control':'no-store'}});
      if(route.includes('%') || route.includes('\\') || route.split('/').some(part=>part.startsWith('.'))) fail(404,'页面不存在');
      const publicDir=path.join(root,'dist'), filename=path.join(publicDir,route.endsWith('/')?route+'index.html':route);
      if(!filename.startsWith(publicDir+path.sep)) fail(404,'页面不存在');
      return fileResponse(filename,request);
    }
    fail(404,'操作不存在');
  }
  let mutationQueue=Promise.resolve(),pendingMutations=0;
  const serialize=work=>{if(pendingMutations>=20)fail(503,'服务繁忙，请稍后重试');pendingMutations++;const run=mutationQueue.then(work,work);mutationQueue=run.catch(()=>{});return run.finally(()=>pendingMutations--);};
  const server=http.createServer({headersTimeout:15000,requestTimeout:30000},async(incoming,outgoing)=>{
    if(options.aiProxyUrl && new URL(incoming.url,origin).pathname==='/api/proxy') {
      const target=new URL('/api/proxy',options.aiProxyUrl);
      const relay=http.request(target,{method:incoming.method,headers:incoming.headers},response=>{outgoing.writeHead(response.statusCode,response.headers);response.pipe(outgoing);});
      relay.on('error',()=>{if(!outgoing.headersSent)outgoing.writeHead(502,{'content-type':'application/json'});outgoing.end('{"error":"代理服务暂时不可用"}');});
      incoming.pipe(relay);return;
    }
    try {
      const chunks=[];let bytes=0;
      for await(const chunk of incoming){bytes+=chunk.length;if(bytes>65536)fail(413,'提交内容过大');chunks.push(chunk);}
      const headers=new Headers();for(const [key,value]of Object.entries(incoming.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
      const method=incoming.method||'GET';
      const request=new Request(new URL(incoming.url,origin),{method,headers,...(['GET','HEAD'].includes(method)?{}:{body:Buffer.concat(chunks)})});
      const clientIp=String(incoming.headers['x-real-ip']||incoming.socket.remoteAddress);
      const response=await (method==='POST'||new URL(request.url).pathname==='/api/wechat/callback'?serialize(()=>handle(request,clientIp)):handle(request,clientIp));
      const responseHeaders=Object.fromEntries([...response.headers].filter(([key])=>key!=='set-cookie'));
      const cookies=response.headers.getSetCookie();if(cookies.length)responseHeaders['set-cookie']=cookies;
      outgoing.writeHead(response.status,responseHeaders);
      if(response.body && method!=='HEAD')await pipeline(Readable.fromWeb(response.body),outgoing);else outgoing.end();
    } catch(error) {
      if(outgoing.headersSent)return outgoing.destroy();
      outgoing.writeHead(error.status||400,{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'});
      outgoing.end(JSON.stringify({error:error instanceof HttpError?error.message:'操作未完成，请检查填写内容后重试'}));
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port??Number(process.env.PORT||8792),'127.0.0.1',resolve);});
  const close=async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await remoteAgent.close();db.close();};
  return {server,close,stateDir,port:server.address().port};
}

if(process.argv[1] && fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))) {
  const service=await createAccessService({servePublic:process.env.POSEWEAR_SERVE_PUBLIC==='1'});
  console.log(`PoseWear access ready on 127.0.0.1:${service.port}`);
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>service.close().then(()=>process.exit(0)));
}
