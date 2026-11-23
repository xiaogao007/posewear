import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import WXBizMsgCrypt from 'wechat-crypto';
import {XMLParser,XMLBuilder,XMLValidator} from 'fast-xml-parser';

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const same=(a,b)=>crypto.timingSafeEqual(Buffer.from(hash(String(a))),Buffer.from(hash(String(b))));
const parser=new XMLParser({ignoreAttributes:true,parseTagValue:false,trimValues:false,processEntities:false});
const builder=new XMLBuilder({ignoreAttributes:true,processEntities:true});

export function createWeChat({db,secret,root,origin,meta,setMeta,audit,fail,limited,json}) {
  db.exec(`CREATE TABLE IF NOT EXISTS pw_wechat_claims(subject TEXT PRIMARY KEY,invite_hash TEXT NOT NULL UNIQUE,nonce TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pw_invite_reservations(hash TEXT PRIMARY KEY,email TEXT NOT NULL);`);
  const defaults={name:'404星球的猫',keyword:'邀请码',enabled:false,adultGrant:false,quota:0,appId:'',originalId:'',token:'',aesKey:''};
  const config=()=>({...defaults,...JSON.parse(meta('wechatConfig')||'{}')});
  const fingerprint=c=>hash(JSON.stringify([c.appId,c.originalId,c.token,c.aesKey]));
  const valid=c=>Boolean(c.appId&&c.token&&c.aesKey);
  const verified=c=>meta('wechatVerifiedFingerprint')===fingerprint(c);
  const xml=value=>new Response(value,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
  const plain=(value,status=200)=>new Response(value,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
  function parse(text) {
    if(text.length>65536||/<!DOCTYPE|<!ENTITY|\x00/i.test(text)||XMLValidator.validate(text)!==true)fail(400,'消息格式不正确');
    const body=parser.parse(text)?.xml;
    if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'消息格式不正确');
    return body;
  }
  const publicInfo=()=>{const c=config();return{name:c.name,keyword:c.keyword,ready:Boolean(c.enabled&&valid(c)&&verified(c)),qrUrl:fs.existsSync(path.join(root,'dist/invite-wechat.png'))?'/invite-wechat.png':null,expiresHours:24};};
  const adminInfo=()=>{
    const c=config(),issued=db.prepare('SELECT COUNT(*) AS n FROM pw_wechat_claims').get().n;
    const redeemed=db.prepare('SELECT COUNT(*) AS n FROM pw_wechat_claims c JOIN pw_invites i ON i.hash=c.invite_hash WHERE i.used=1').get().n;
    return{...publicInfo(),enabled:c.enabled,adultGrant:c.adultGrant,quota:c.quota,appId:c.appId,originalId:c.originalId,hasToken:Boolean(c.token),hasAesKey:Boolean(c.aesKey),verified:verified(c),verifiedAt:Number(meta('wechatVerifiedAt')||0),lastMessageAt:Number(meta('wechatLastMessageAt')||0),issued,redeemed,callbackUrl:origin+'/api/wechat/callback'};
  };
  function configure(input,actor) {
    const old=config(),next={...old};
    for(const [key,max] of [['name',60],['keyword',30],['appId',40],['originalId',60]])if(Object.hasOwn(input,key))next[key]=String(input[key]).trim().slice(0,max);
    if(!next.name||!next.keyword||/[\x00-\x1f]/.test(next.name+next.keyword))fail(400,'请填写公众号名称和回复关键词');
    for(const key of ['enabled','adultGrant'])if(Object.hasOwn(input,key)){if(typeof input[key]!=='boolean')fail(400,'配置值不正确');next[key]=input[key];}
    if(Object.hasOwn(input,'quota')){next.quota=Number(input.quota);if(!Number.isSafeInteger(next.quota)||next.quota<0||next.quota>1000000)fail(400,'领取人数上限应为 0–1000000，0 表示不限');}
    if(input.token){if(!/^[A-Za-z0-9]{16,32}$/.test(input.token))fail(400,'Token 需为 16–32 位字母和数字');next.token=input.token;}
    if(input.aesKey){if(!/^[A-Za-z0-9+/]{43}$/.test(input.aesKey)||Buffer.from(input.aesKey+'=','base64').length!==32)fail(400,'EncodingAESKey 需为有效的 43 位密钥');next.aesKey=input.aesKey;}
    if(next.appId&&!/^wx[A-Za-z0-9]{8,32}$/.test(next.appId))fail(400,'请填写正确的公众号 AppID');
    if(next.originalId&&!/^gh_[A-Za-z0-9]{6,40}$/.test(next.originalId))fail(400,'请填写正确的公众号原始 ID');
    if(next.enabled&&!valid(next))fail(400,'启用前请填写 AppID、Token 和 EncodingAESKey');
    if(valid(next))new WXBizMsgCrypt(next.token,next.aesKey,next.appId);
    if(fingerprint(old)!==fingerprint(next))db.prepare('DELETE FROM pw_meta WHERE key IN (?,?)').run('wechatVerifiedFingerprint','wechatVerifiedAt');
    setMeta('wechatConfig',JSON.stringify(next));audit(actor,'configure-wechat','site');
    return adminInfo();
  }
  function issue(c,openid) {
    const subject=crypto.createHmac('sha256',secret).update('wechat-subject:'+c.appId+':'+openid).digest('hex');
    limited('wechat:'+subject,10);
    let claim=db.prepare('SELECT * FROM pw_wechat_claims WHERE subject=?').get(subject);
    let invitation=claim&&db.prepare('SELECT * FROM pw_invites WHERE hash=?').get(claim.invite_hash);
    if(invitation?.used===1)return{registered:true};
    const codeFor=nonce=>crypto.createHmac('sha256',secret).update('wechat-invite:'+subject+':'+nonce).digest('base64url');
    if(invitation&&invitation.expires>Date.now())return{code:codeFor(claim.nonce)};
    if(!claim&&c.quota>0&&db.prepare('SELECT COUNT(*) AS n FROM pw_wechat_claims').get().n>=c.quota)return{full:true};
    const nonce=crypto.randomBytes(32).toString('base64url'),code=codeFor(nonce),inviteHash=hash(code);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO pw_invites(hash,email,adult,expires,used,actor) VALUES (?,?,?,?,0,?)').run(inviteHash,'',c.adultGrant?1:0,Date.now()+86400000,'wechat');
      db.prepare('INSERT INTO pw_wechat_claims VALUES (?,?,?,?) ON CONFLICT(subject) DO UPDATE SET invite_hash=excluded.invite_hash,nonce=excluded.nonce').run(subject,inviteHash,nonce,Date.now());
      audit('wechat','issue-invite','wechat');db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    return{code};
  }
  async function callback(request,clientIp) {
    const c=config();if(!valid(c))return plain('Wechat integration is not configured',503);
    if(!['GET','POST'].includes(request.method))return plain('Method not allowed',405);
    limited('wechat-ip:'+clientIp,120);
    const query=new URL(request.url).searchParams,timestamp=query.get('timestamp')||'',nonce=query.get('nonce')||'';
    if(!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300||!/^[A-Za-z0-9_-]{1,128}$/.test(nonce))fail(403,'消息校验失败');
    const crypt=new WXBizMsgCrypt(c.token,c.aesKey,c.appId);
    if(request.method==='GET') {
      const expected=crypto.createHash('sha1').update([c.token,timestamp,nonce].sort().join('')).digest('hex');
      if(!same(query.get('signature')||'',expected))fail(403,'消息校验失败');
      const echo=query.get('echostr')||'';if(!echo||echo.length>512||/[\x00-\x1f]/.test(echo))fail(400,'校验参数不正确');
      setMeta('wechatVerifiedFingerprint',fingerprint(c));setMeta('wechatVerifiedAt',Date.now());return plain(echo);
    }
    if(query.get('encrypt_type')!=='aes')fail(403,'请使用公众号安全模式');
    const outer=parse(await request.text()),encrypted=outer.Encrypt;
    if(typeof encrypted!=='string'||encrypted.length>60000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encrypted))fail(400,'加密消息格式不正确');
    if(!same(query.get('msg_signature')||'',crypt.getSignature(timestamp,nonce,encrypted)))fail(403,'消息校验失败');
    let decrypted;try{decrypted=crypt.decrypt(encrypted);}catch{fail(403,'消息校验失败');}
    if(decrypted.id!==c.appId)fail(403,'消息校验失败');
    const message=parse(decrypted.message),from=message.FromUserName,to=message.ToUserName;
    if(typeof from!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(from)||typeof to!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(to)||(c.originalId&&to!==c.originalId))fail(403,'消息校验失败');
    setMeta('wechatVerifiedFingerprint',fingerprint(c));setMeta('wechatVerifiedAt',Date.now());setMeta('wechatLastMessageAt',Date.now());
    let content;
    if(message.MsgType==='event'&&String(message.Event).toLowerCase()==='subscribe')content=`欢迎关注${c.name}。回复「${c.keyword}」领取衣姿邀请码。`;
    else if(message.MsgType==='text'&&typeof message.Content==='string'&&message.Content.trim()===c.keyword){
      if(!c.enabled)content='邀请码自动领取暂未开放，请稍后再试。';
      else {
        const result=issue(c,from);
        if(result.registered)content=`你的微信已使用邀请码创建账号，请直接登录：${origin}/`;
        else if(result.full)content='本轮邀请码已领完，请等待管理员开放下一轮。';
        else content=`你的衣姿邀请码：\n${result.code}\n\n24 小时内有效，仅限使用一次。\n点击注册：${origin}/invite/#register=${encodeURIComponent(result.code)}\n\n每个微信可注册一个账号。重复回复可取回尚未使用的有效邀请码。`;
      }
    }else return plain('success');
    const reply=builder.build({xml:{ToUserName:from,FromUserName:to,CreateTime:Math.floor(Date.now()/1000),MsgType:'text',Content:content}});
    const encryptedReply=crypt.encrypt(reply),stamp=String(Math.floor(Date.now()/1000)),replyNonce=crypto.randomBytes(12).toString('hex');
    return xml(builder.build({xml:{Encrypt:encryptedReply,MsgSignature:crypt.getSignature(stamp,replyNonce,encryptedReply),TimeStamp:stamp,Nonce:replyNonce}}));
  }
  return{publicInfo,adminInfo,configure,callback};
}
