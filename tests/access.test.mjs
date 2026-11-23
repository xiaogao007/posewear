import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import WXBizMsgCrypt from 'wechat-crypto';
import {XMLParser,XMLBuilder} from 'fast-xml-parser';
import { createAccessService } from '../server/access.mjs';

const password='local-fixture-passphrase-2026';
const fixture=async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'posewear-access-test-')),state=path.join(dir,'state'),privateDir=path.join(dir,'private'),key='a'.repeat(32)+'.png';
 fs.mkdirSync(path.join(privateDir,'media'),{recursive:true});fs.writeFileSync(path.join(privateDir,'media',key),'fixture-image');
 fs.writeFileSync(path.join(privateDir,'manifest.json'),JSON.stringify({assets:{[key]:{restricted:true,legacyPath:'p/i/old.png'}},depthPack:{note:'Fixture attribution'},catalogues:{pose:[{id:'private-fixture',a:1,t:'/restricted/media/'+key}],depth:[{id:'ordinary-depth-now-private',a:1,t:'/restricted/media/'+key}]}}));
 const service=await createAccessService({stateDir:state,privateDir,origin:'http://localhost',port:0});
 const base='http://127.0.0.1:'+service.port;
 const client=()=>{let cookie='',csrf='';return{async request(url,body,headers={}){const response=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{connection:'close',origin:'http://localhost',cookie,'content-type':'application/json','x-csrf-token':csrf,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});const set=response.headers.getSetCookie();if(set.length)cookie=set.map(value=>value.split(';')[0]).join('; ');const value=await response.text();let data;try{data=JSON.parse(value)}catch{data=value}if(data.csrfToken)csrf=data.csrfToken;return{status:response.status,data,headers:response.headers};},get cookie(){return cookie;},get csrf(){return csrf;}};};
 const owner=client(),code=fs.readFileSync(path.join(state,'bootstrap-code'),'utf8').trim();
 assert.equal((await owner.request('/api/setup/claim',{email:'owner@example.test',name:'Fixture owner',password,code})).status,200);
 const me=await owner.request('/api/me');assert.equal(me.data.adultMode,false);assert.equal(me.data.permissions.length,2);
 return{dir,state,privateDir,key,service,base,client,owner,ownerId:me.data.user.id};
};

test('server authorization blocks direct links, forged grants, CSRF, and public signup',async t=>{
 const f=await fixture();t.after(()=>f.service.close());const guest=f.client(),url='/restricted/media/'+f.key;
 assert.equal((await guest.request(url)).status,401);
 assert.equal((await guest.request('/api/catalog/adult?type=pose')).status,401);
 assert.equal((await guest.request('/api/auth/sign-up/email',{email:'x@example.test',password})).status,404);
 assert.equal((await guest.request('/api/session/adult-mode',{enabled:true,permissions:['content.adult.view']})).status,401);
 assert.equal((await f.owner.request('/api/session/adult-mode',{enabled:true,confirmAdult:true},{'x-csrf-token':'forged'})).status,403);
 assert.equal((await f.owner.request('/api/session/adult-mode',{enabled:true,confirmAdult:true},{origin:'https://evil.example'})).status,403);
 assert.equal((await f.owner.request(url)).status,403);
 assert.equal((await f.owner.request('/api/session/adult-mode',{enabled:true})).status,400);
 assert.equal((await f.owner.request('/api/session/adult-mode',{enabled:true,confirmAdult:true})).status,200);
 const resource=await f.owner.request(url);assert.equal(resource.status,200);assert.equal(resource.data,'fixture-image');assert.match(resource.headers.get('cache-control'),/private, no-store/);
 assert.equal((await f.owner.request('/api/catalog/adult?type=pose')).data[0].id,'private-fixture');
 assert.equal((await f.owner.request('/restricted/media/'+'b'.repeat(32)+'.png')).status,404);
 const head=await fetch(f.base+url,{method:'HEAD',headers:{cookie:f.owner.cookie}});assert.equal(head.status,200);assert.equal(await head.text(),'');
 const range=await f.owner.request(url,undefined,{range:'bytes=0-6'});assert.equal(range.status,206);assert.equal(range.data,'fixture');
 const check=await f.owner.request('/internal/authorize',undefined,{'x-forwarded-uri':url,'x-forwarded-method':'HEAD'});assert.equal(check.status,204);
 assert.equal((await f.owner.request('/internal/authorize',undefined,{'x-forwarded-uri':'/private/manifest.json'})).status,404);
 assert.equal((await f.owner.request('/api/session/adult-mode',{enabled:false})).status,200);
 assert.equal((await f.owner.request(url)).status,403);
});

test('invitations are email-bound and single-use; grant/revoke and global shutdown take effect immediately',async t=>{
 const f=await fixture();t.after(()=>f.service.close());const user=f.client(),regular=f.client();
 const invite=await f.owner.request('/api/admin/invites',{email:'reader@example.test',adult:true});assert.equal(invite.status,201);
 assert.equal((await user.request('/api/invites/accept',{code:invite.data.code,email:'other@example.test',password})).status,403);
 assert.equal((await user.request('/api/invites/accept',{code:invite.data.code,email:'reader@example.test',password})).status,200);
 assert.equal((await user.request('/api/invites/accept',{code:invite.data.code,email:'reader@example.test',password})).status,403);
 const reader=await user.request('/api/me');assert.deepEqual(reader.data.permissions,['content.adult.view']);assert.equal(reader.data.adultMode,false);
 assert.equal((await user.request('/api/admin/users')).status,403);
 assert.equal((await user.request('/api/session/adult-mode',{enabled:true,confirmAdult:true})).status,200);
 const url='/restricted/media/'+f.key;assert.equal((await user.request(url)).status,200);
 assert.equal((await f.owner.request('/api/admin/permissions',{userId:reader.data.user.id,enabled:false})).status,200);
 assert.equal((await user.request(url)).status,403);
 assert.equal((await user.request('/api/catalog/adult?type=pose')).status,403);
 await f.owner.request('/api/admin/permissions',{userId:reader.data.user.id,enabled:true});assert.equal((await user.request(url)).status,403);
 await user.request('/api/session/adult-mode',{enabled:true,confirmAdult:true});assert.equal((await user.request(url)).status,200);
 await f.owner.request('/api/admin/policy',{enabled:false});assert.equal((await user.request(url)).status,403);
 await f.owner.request('/api/admin/policy',{enabled:true});assert.equal((await user.request(url)).status,403);
 const invite2=await f.owner.request('/api/admin/invites',{email:'regular@example.test'});
 await regular.request('/api/invites/accept',{code:invite2.data.code,email:'regular@example.test',password});
 assert.equal((await regular.request('/api/me')).data.adultAvailable,false);
 assert.equal((await regular.request('/api/session/adult-mode',{enabled:true,confirmAdult:true})).status,403);
 const users=await f.owner.request('/api/admin/users?q=reader');assert.equal(users.data.total,1);assert.equal(users.data.users.length,1);
 await user.request('/api/auth/sign-out',{});assert.equal((await user.request(url)).status,401);
});

test('database survives restart, setup cannot be reused, cookies are opaque, expired sessions fail closed',async t=>{
 const f=await fixture();let service=f.service;t.after(()=>service.close());
 assert.equal(fs.existsSync(path.join(f.state,'bootstrap-code')),false);
 assert.equal((await f.owner.request('/api/setup/claim',{code:'invalid'})).status,409);
 assert.equal((await f.owner.request('/api/setup/status')).data.required,false);
 assert.doesNotMatch(f.owner.cookie,/owner|permissions|adult/);
 await service.close();service=await createAccessService({stateDir:f.state,privateDir:f.privateDir,origin:'http://localhost',port:f.service.port});
 assert.equal((await f.owner.request('/api/me')).data.user.id,f.ownerId);
 const db=new DatabaseSync(path.join(f.state,'accounts.sqlite'));db.prepare('UPDATE session SET expiresAt=1 WHERE userId=?').run(f.ownerId);db.close();
 assert.equal((await f.owner.request('/api/me')).data.user,null);
 assert.equal((await f.owner.request('/restricted/media/'+f.key)).status,401);
});

test('password rotation replaces the cookie, revokes other sessions and resets restricted mode',async t=>{
 const f=await fixture();t.after(()=>f.service.close());const other=f.client();
 await other.request('/api/auth/sign-in/email',{email:'owner@example.test',password});
 assert.equal((await other.request('/api/me')).data.user.id,f.ownerId);
 await f.owner.request('/api/session/adult-mode',{enabled:true,confirmAdult:true});
 const oldCookie=f.owner.cookie;
 const result=await f.owner.request('/api/account/password',{currentPassword:password,newPassword:'rotated-fixture-password-2026'});
 assert.equal(result.status,200);assert.deepEqual(result.data,{ok:true});assert.notEqual(f.owner.cookie,oldCookie);
 const me=await f.owner.request('/api/me');assert.equal(me.data.user.id,f.ownerId);assert.equal(me.data.adultMode,false);
 assert.equal((await other.request('/api/me')).data.user,null);
 assert.equal((await other.request('/api/auth/sign-in/email',{email:'owner@example.test',password})).status,401);
 assert.equal((await other.request('/api/auth/sign-in/email',{email:'owner@example.test',password:'rotated-fixture-password-2026'})).status,200);
});

test('production cookies use host-only Secure HttpOnly SameSite attributes',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'posewear-cookie-test-'));
 const service=await createAccessService({stateDir:dir,privateDir:dir,origin:'https://posewear.test',port:0});t.after(()=>service.close());
 const response=await fetch('http://127.0.0.1:'+service.port+'/api/setup/claim',{method:'POST',headers:{origin:'https://posewear.test','content-type':'application/json'},body:JSON.stringify({code:fs.readFileSync(path.join(dir,'bootstrap-code'),'utf8').trim(),email:'cookie@example.test',password})});
 assert.equal(response.status,200);
 const cookie=response.headers.getSetCookie().find(value=>value.startsWith('__Host-posewear.session_token='));
 assert.ok(cookie);assert.match(cookie,/; Secure/i);assert.match(cookie,/; HttpOnly/i);assert.match(cookie,/; SameSite=Lax/i);assert.match(cookie,/; Path=\//i);assert.doesNotMatch(cookie,/; Domain=/i);
 assert.deepEqual(await response.json(),{ok:true});
});

test('CLI entry point starts correctly through the production release symlink',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'posewear-symlink-test-')),root=fileURLToPath(new URL('..',import.meta.url)),link=path.join(dir,'current');
 fs.symlinkSync(root,link,process.platform==='win32'?'junction':'dir');
 const child=spawn(process.execPath,[path.join(link,'server/access.mjs')],{env:{...process.env,PORT:'0',POSEWEAR_AUTH_STATE:path.join(dir,'state'),POSEWEAR_PRIVATE:path.join(dir,'private'),POSEWEAR_SITE:'http://localhost'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 t.after(()=>{child.kill();});
 await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Symlink CLI startup timed out')),10000);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('PoseWear access ready on 127.0.0.1:')){clearTimeout(timer);resolve();}});child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(new Error('CLI exited before startup: '+code));});});
});

const wxConfig={name:'Fixture公众号',keyword:'邀请码',enabled:true,adultGrant:false,appId:'wx0123456789abcdef',originalId:'gh_fixture12345',token:'fixtureTokenLetters2026',aesKey:Buffer.alloc(32,7).toString('base64').replace(/=$/,'')};
const wxParser=new XMLParser({parseTagValue:false}),wxBuilder=new XMLBuilder();
async function wxHandshake(f,{signature,stamp=String(Math.floor(Date.now()/1000))}={}){
 const nonce='fixtureNonce',sig=signature||crypto.createHash('sha1').update([wxConfig.token,stamp,nonce].sort().join('')).digest('hex');
 return fetch(f.base+'/api/wechat/callback?'+new URLSearchParams({timestamp:stamp,nonce,signature:sig,echostr:'fixture-echo'}),{headers:{connection:'close'}});
}
async function wxMessage(f,openid,options={}) {
 const crypt=new WXBizMsgCrypt(wxConfig.token,wxConfig.aesKey,options.appId||wxConfig.appId),timestamp=String(options.timestamp||Math.floor(Date.now()/1000)),nonce='messageFixture';
 const payload=wxBuilder.build({xml:{ToUserName:wxConfig.originalId,FromUserName:openid,CreateTime:timestamp,MsgType:options.type||'text',Content:options.content||'邀请码',MsgId:'9007199254740993999',...(options.event?{Event:options.event}:{})}});
 const encrypted=crypt.encrypt(payload),signature=options.signature||crypt.getSignature(timestamp,nonce,encrypted);
 const response=await fetch(f.base+'/api/wechat/callback?'+new URLSearchParams({timestamp,nonce,encrypt_type:options.plain?'raw':'aes',msg_signature:signature}),{method:'POST',headers:{connection:'close','content-type':'text/xml'},body:options.body||wxBuilder.build({xml:{Encrypt:encrypted}})});
 const text=await response.text();if(response.status!==200)return{status:response.status,text};
 if(text==='success')return{status:200,text};
 const envelope=wxParser.parse(text).xml;assert.equal(envelope.MsgSignature,crypt.getSignature(envelope.TimeStamp,envelope.Nonce,envelope.Encrypt));
 const result=crypt.decrypt(envelope.Encrypt);assert.equal(result.id,wxConfig.appId);
 const content=wxParser.parse(result.message).xml.Content;
 return{status:200,text:content,code:content.match(/\b[A-Za-z0-9_-]{43}\b/)?.[0]};
}

test('whole depth catalogue requires a valid permitted session and explicit mode',async t=>{
 const f=await fixture();t.after(()=>f.service.close());
 assert.equal((await f.client().request('/api/catalog/adult?type=depth')).status,401);
 assert.equal((await f.owner.request('/api/catalog/adult?type=depth')).status,403);
 await f.owner.request('/api/session/adult-mode',{enabled:true,confirmAdult:true});
 const result=await f.owner.request('/api/catalog/adult?type=depth');assert.equal(result.status,200);assert.equal(result.data.items[0].id,'ordinary-depth-now-private');assert.equal(result.data.pack.note,'Fixture attribution');
 await f.owner.request('/api/session/adult-mode',{enabled:false});assert.equal((await f.owner.request('/api/catalog/adult?type=depth')).status,403);
});

test('WeChat verifies signatures/AES/app identity and never exposes integration secrets',async t=>{
 const f=await fixture();t.after(()=>f.service.close());
 assert.equal((await f.client().request('/api/admin/wechat')).status,401);
 assert.equal((await f.owner.request('/api/admin/wechat',wxConfig,{'x-csrf-token':'forged'})).status,403);
 const configured=await f.owner.request('/api/admin/wechat',wxConfig);assert.equal(configured.status,200);assert.equal(configured.data.verified,false);assert.ok(configured.data.hasToken&&configured.data.hasAesKey);
 assert.doesNotMatch(JSON.stringify(configured.data),new RegExp(wxConfig.token));assert.ok(!JSON.stringify(configured.data).includes(wxConfig.aesKey));
 const info=await f.client().request('/api/invite-info');assert.equal(info.data.ready,false);assert.ok(!JSON.stringify(info.data).includes(wxConfig.token));assert.ok(!JSON.stringify(info.data).includes('aesKey'));
 assert.equal((await wxHandshake(f,{signature:'forged'})).status,403);
 assert.equal((await wxHandshake(f,{stamp:String(Math.floor(Date.now()/1000)-600)})).status,403);
 const challenge=await wxHandshake(f);assert.equal(challenge.status,200);assert.equal(await challenge.text(),'fixture-echo');
 assert.equal((await f.client().request('/api/invite-info')).data.ready,true);
 assert.equal((await wxMessage(f,'openid-fixture',{signature:'0'.repeat(40)})).status,403);
 assert.equal((await wxMessage(f,'openid-fixture',{appId:'wxdifferent1234567'})).status,403);
 assert.equal((await wxMessage(f,'openid-fixture',{plain:true})).status,403);
 assert.equal((await wxMessage(f,'openid-fixture',{body:'<!DOCTYPE xml [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><xml><Encrypt>&xxe;</Encrypt></xml>'})).status,400);
 assert.equal((await f.owner.request('/api/admin/wechat')).data.issued,0);
});

test('automatic invitations are idempotent, single-use, persist, and do not grant administrator access',async t=>{
 const f=await fixture();let service=f.service;t.after(()=>service.close());await f.owner.request('/api/admin/wechat',wxConfig);
 const messages=await Promise.all(Array.from({length:4},()=>wxMessage(f,'openid-one')));
 assert.ok(messages.every(result=>result.status===200&&result.code===messages[0].code));const code=messages[0].code;assert.equal(code.length,43);
 assert.equal((await f.owner.request('/api/admin/wechat')).data.issued,1);
 await service.close();service=await createAccessService({stateDir:f.state,privateDir:f.privateDir,origin:'http://localhost',port:f.service.port});
 assert.equal((await wxMessage(f,'openid-one')).code,code);
 const reader=f.client();assert.equal((await reader.request('/api/invites/accept',{code,email:'wechat-reader@example.test',password,adult:true,permissions:['users.permissions.manage']})).status,200);
 assert.deepEqual((await reader.request('/api/me')).data.permissions,[]);
 assert.equal((await reader.request('/api/admin/users')).status,403);
 assert.equal((await f.client().request('/api/invites/accept',{code,email:'another@example.test',password})).status,403);
 const after=await wxMessage(f,'openid-one');assert.match(after.text,/已使用/);assert.equal(after.code,undefined);
 const db=new DatabaseSync(path.join(f.state,'accounts.sqlite'));const claims=db.prepare('SELECT * FROM pw_wechat_claims').all();assert.ok(!JSON.stringify(claims).includes('openid-one'));db.close();
});

test('WeChat quota, renewal, pause, and explicitly configured viewing grants follow server policy',async t=>{
 const f=await fixture();t.after(()=>f.service.close());await f.owner.request('/api/admin/wechat',{...wxConfig,quota:1});
 const first=await wxMessage(f,'openid-renew');assert.ok(first.code);
 assert.match((await wxMessage(f,'openid-over-quota')).text,/领完/);
 const db=new DatabaseSync(path.join(f.state,'accounts.sqlite'));db.prepare('UPDATE pw_invites SET expires=1 WHERE hash=?').run(crypto.createHash('sha256').update(first.code).digest('hex'));db.close();
 const renewed=await wxMessage(f,'openid-renew');assert.ok(renewed.code&&renewed.code!==first.code);
 assert.equal((await f.client().request('/api/invites/accept',{code:first.code,email:'expired@example.test',password})).status,403);
 await f.owner.request('/api/admin/wechat',{enabled:false});assert.match((await wxMessage(f,'openid-renew')).text,/暂未开放/);
 await f.owner.request('/api/admin/wechat',{enabled:true,adultGrant:true,quota:0});
 const allowed=await wxMessage(f,'openid-viewer'),reader=f.client();assert.ok(allowed.code);
 await reader.request('/api/invites/accept',{code:allowed.code,email:'allowed@example.test',password});
 const me=await reader.request('/api/me');assert.deepEqual(me.data.permissions,['content.adult.view']);assert.equal(me.data.adultMode,false);
});

test('interrupted registration resumes only with the reserved email and correct password',async t=>{
 const f=await fixture();t.after(()=>f.service.close());const email='recover@example.test',reader=f.client();
 const ordinary=await f.owner.request('/api/admin/invites',{email});await reader.request('/api/invites/accept',{code:ordinary.data.code,email,password});
 const reserved=await f.owner.request('/api/admin/invites',{email:'reserved@example.test',adult:true});
 const inviteHash=crypto.createHash('sha256').update(reserved.data.code).digest('hex');
 const db=new DatabaseSync(path.join(f.state,'accounts.sqlite'));
 // Simulate a crash after auth created the account, before the permission transaction.
 db.prepare('UPDATE pw_invites SET used=2,email=? WHERE hash=?').run(email,inviteHash);db.prepare('INSERT INTO pw_invite_reservations VALUES (?,?)').run(inviteHash,email);db.close();
 const attempt=f.client();
 assert.equal((await attempt.request('/api/invites/accept',{code:reserved.data.code,email:'different@example.test',password})).status,403);
 assert.equal((await attempt.request('/api/invites/accept',{code:reserved.data.code,email,password:'incorrect-fixture-password'})).status,400);
 assert.equal((await attempt.request('/api/invites/accept',{code:reserved.data.code,email,password})).status,200);
 assert.deepEqual((await attempt.request('/api/me')).data.permissions,['content.adult.view']);
 assert.equal((await attempt.request('/api/invites/accept',{code:reserved.data.code,email,password})).status,403);
});
