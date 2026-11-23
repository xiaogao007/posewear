'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let current = {user:null,permissions:[],adultAvailable:false,adultMode:false,csrfToken:null};
  let notify = () => {}, requestEpoch = 0, activeRequest, opener, lastInvite, reconnectDisable=false;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('posewear-access') : null;
  const dialog = document.createElement('dialog');
  dialog.id='accessDialog'; dialog.className='access-dialog'; dialog.setAttribute('aria-labelledby','accessTitle');
  document.body.append(dialog);
  const toast = text => window.PWFeedback.toast(text);
  const has = permission => current.permissions.includes(permission);
  const broadcast = () => channel?.postMessage({changed:true});
  async function api(url, body, signal) {
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:signal?AbortSignal.any([signal,controller.signal]):controller.signal,
        ...(body===undefined?{}:{method:'POST',headers:{'content-type':'application/json','x-csrf-token':current.csrfToken||''},body:JSON.stringify(body)})});
      const result=await response.json().catch(()=>({error:'服务暂时不可用'}));
      if(!response.ok) throw Object.assign(new Error(result.error||'操作未完成，请稍后重试'),{status:response.status});
      return result;
    } catch(error) {if(error.name==='AbortError'||error.name==='TimeoutError')throw new Error('连接超时，请稍后重试');throw error;}
    finally {clearTimeout(timer);}
  }
  function apply(me) {
    const previous=current;
    current=me||{user:null,permissions:[],adultAvailable:false,adultMode:false,csrfToken:null};
    const account=$('[data-access="account"]'), admin=$('[data-access="admin"]'), password=$('[data-access="password"]');
    if(account)account.textContent=current.user?'退出登录':'登录';const applyInvite=$('[data-access="request-invite"]');if(applyInvite)applyInvite.hidden=Boolean(current.user);
    if(admin)admin.hidden=!has('users.permissions.manage');
    if(password)password.hidden=!current.user;
    if(dialog.open && previous.user && (!current.user||previous.user.id!==current.user.id)){closeDialog();}
    else if(dialog.open && previous.permissions.includes('users.permissions.manage')&&!has('users.permissions.manage')&&['admin','confirmation'].includes(dialog.dataset.view)){closeDialog();}
    else if(dialog.open&&['preferences','age'].includes(dialog.dataset.view)&&previous.adultAvailable!==current.adultAvailable){preferences();}
    $('#moreBtn')?.classList.toggle('content-active',current.adultMode);
    if(previous.adultMode!==current.adultMode || previous.user?.id!==current.user?.id)notify(current.adultMode);
    document.dispatchEvent(new CustomEvent('posewear-access-change',{detail:{adult:current.adultMode}}));
  }
  async function refresh(reset=false) {
    const epoch=++requestEpoch;
    try {
      let me=await api('/api/me');
      if(epoch!==requestEpoch)return;
      if((reset||reconnectDisable)&&me.user&&me.adultMode){current.csrfToken=me.csrfToken;me=await api('/api/session/adult-mode',{enabled:false});}
      if(epoch!==requestEpoch)return;
      apply(me);
      reconnectDisable=false;
      return current;
    } catch {if(epoch===requestEpoch)apply(null);}
  }
  function closeMenu() {const menu=$('#moreMenu');if(menu)menu.hidden=true;$('#moreBtn')?.setAttribute('aria-expanded','false');}
  function closeDialog() {activeRequest?.abort();dialog.close();lastInvite=null;}
  dialog.addEventListener('close',()=>{if(dialog.open)return;activeRequest?.abort();searchRequest?.abort();lastInvite=null;dialog.replaceChildren();if(opener?.isConnected&&opener.getClientRects().length)opener.focus();else $('#moreBtn')?.focus();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)closeDialog();});
  function panel(title, body, view='') {
    if(!dialog.open)opener=document.activeElement?.closest('#moreMenu')?$('#moreBtn'):document.activeElement;
    closeMenu();
    if(!dialog.open)dialog.showModal();
    activeRequest?.abort();dialog.dataset.view=view;
    dialog.innerHTML=`<div class="access-head"><h2 id="accessTitle">${escape(title)}</h2><button type="button" class="icon" data-close aria-label="关闭">✕</button></div><div class="access-body">${body}</div>`;
    dialog.querySelector('[data-close]').onclick=closeDialog;
    dialog.querySelectorAll('[data-reveal]').forEach(button=>button.onclick=()=>{const input=dialog.querySelector('#'+button.dataset.reveal);input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'显示':'隐藏';button.setAttribute('aria-label',`${button.textContent}${input.labels?.[0]?.textContent.replace('显示','').replace('隐藏','')||'输入内容'}`);});
    queueMicrotask(()=>dialog.querySelector('input, .access-body button')?.focus());
  }
  const field=(name,label,type='text',autocomplete='off',extra='')=>`<label class="access-field" for="pw-${name}">${label}</label><div class="access-input"><input id="pw-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" ${extra} ${type==='password'?'spellcheck="false"':''}>${type==='password'?`<button type="button" class="sm ghost" data-reveal="pw-${name}" aria-label="显示${label}">显示</button>`:''}</div>`;
  const form=(contents,button)=>`<form id="accessForm" novalidate>${contents}<p class="access-error" id="accessError" role="alert" hidden></p><button class="access-submit" type="submit">${button}</button></form>`;
  function errorMessage(error) {const node=$('#accessError')||$('#adminError');if(node){node.hidden=false;node.textContent=error.message||'操作未完成，请重试';}}
  function bindForm(action,validate) {
    $('#accessForm').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');if(button.disabled)return;
      form.querySelectorAll('[aria-invalid]').forEach(input=>{input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');});
      const values=Object.fromEntries(new FormData(form));
      const issue=validate?.(values);
      if(issue){const input=form.elements.namedItem(issue.field);if(input){input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby','accessError');input.focus();}errorMessage(new Error(issue.message));return;}
      const invalid=form.querySelector('input[type=email]');
      if(invalid && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invalid.value)){invalid.setAttribute('aria-invalid','true');invalid.setAttribute('aria-describedby','accessError');errorMessage(new Error('请填写有效邮箱'));invalid.focus();return;}
      const newPassword=form.querySelector('[autocomplete=new-password]');
      if(newPassword && (newPassword.value.length<12||newPassword.value.length>128)){newPassword.setAttribute('aria-invalid','true');newPassword.setAttribute('aria-describedby','accessError');errorMessage(new Error('密码需为 12–128 个字符'));newPassword.focus();return;}
      if(values.confirm!==undefined && values.confirm!==values.password && values.confirm!==values.newPassword){errorMessage(new Error('两次输入的密码不一致'));form.querySelector('[name=confirm]').focus();return;}
      const text=button.textContent;button.disabled=true;button.textContent='正在处理…';form.setAttribute('aria-busy','true');$('#accessError').hidden=true;
      const controller=new AbortController();activeRequest=controller;
      try {await action(values,controller.signal);}
      catch(error){errorMessage(error);if(error.status===401){form.querySelectorAll('[type=password]').forEach(input=>input.value='');const password=form.querySelector('[autocomplete=current-password]');if(password){password.setAttribute('aria-invalid','true');password.setAttribute('aria-describedby','accessError');password.focus();}}}
      finally {if(activeRequest===controller)activeRequest=undefined;if(button.isConnected){button.disabled=false;button.textContent=text;form.removeAttribute('aria-busy');}}
    });
  }
  async function completeAccount() {await refresh();broadcast();closeDialog();if(document.body.classList.contains('invite-page')){location.assign('/');return}toast('已登录');}
  function login() {
    panel('登录',form(field('email','邮箱','email','username')+field('password','密码','password','current-password'),'登录')+'<p class="access-note">账号由管理员邀请。收藏、API 密钥和生成记录保存在当前浏览器。</p><a class="btn ghost sm" href="/invite/">申请邀请码</a><button class="ghost sm" id="acceptInvite">使用邀请码创建账号</button><button class="ghost sm" id="ownerSetup" hidden>初始化管理员</button>','login');
    bindForm(async(body,signal)=>{await api('/api/auth/sign-in/email',body,signal);await completeAccount();});
    $('#acceptInvite').onclick=()=>accountForm(false);
    api('/api/setup/status').then(result=>{if(dialog.dataset.view==='login'&&$('#ownerSetup')){$('#ownerSetup').hidden=!result.required;$('#ownerSetup').onclick=()=>accountForm(true);}}).catch(()=>{});
  }
  function accountForm(setup,initialCode='') {
    panel(setup?'初始化管理员':'创建受邀账号',`<p class="access-note">${setup?'初始化码由服务器生成，仅供站点所有者首次设置使用。':'请输入邀请码和你的登录邮箱。定向邀请需使用被邀请的邮箱。'}密码需为 12–128 个字符。</p>`+form(field('code',setup?'初始化码':'邀请码','password')+field('email','邮箱','email','username')+field('name','称呼','text','nickname')+field('password','密码','password','new-password')+field('confirm','确认密码','password','new-password'),setup?'创建管理员':'创建账号'),'account');
    if(initialCode){$('#pw-code').value=initialCode;queueMicrotask(()=>$('#pw-email')?.focus());}
    bindForm(async(body,signal)=>{delete body.confirm;await api(setup?'/api/setup/claim':'/api/invites/accept',body,signal);await completeAccount();});
  }
  function changePassword() {
    panel('修改密码','<p class="access-note">新密码需为 12–128 个字符。修改后其他设备的登录会话将结束。</p>'+form(field('currentPassword','当前密码','password','current-password')+field('newPassword','新密码','password','new-password')+field('confirm','确认新密码','password','new-password'),'修改密码'),'password');
    bindForm(async(body,signal)=>{await api('/api/account/password',body,signal);await refresh();broadcast();closeDialog();toast('密码已更新');});
  }
  async function setMode(enabled) {const me=await api('/api/session/adult-mode',{enabled,confirmAdult:enabled});apply(me);broadcast();}
  function adultAsk(callback) {
    if(!current.adultAvailable)return preferences();
    panel('显示成人向参考？','<p>包括部分成人向姿势与服装参考。仅限已满 18 岁的用户。</p><p class="access-note">确认后仅在当前登录会话中开启，可随时恢复常规浏览。</p><p class="access-error" id="accessError" role="alert" hidden></p><div class="access-actions"><button id="adultCancel" type="button">暂不开启</button><button id="adultConfirm" type="button" class="access-submit">我已满 18 岁，开启</button></div>','age');
    $('#adultCancel').onclick=preferences;
    $('#adultConfirm').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await setMode(true);closeDialog();toast('已更新内容显示范围');callback?.();}catch(error){errorMessage(error);}finally{button.disabled=false;}};
    $('#adultCancel').focus();
  }
  function preferences() {
    const controls=current.adultAvailable?`<div class="access-preference"><div><b>显示成人向参考（18+）</b><p>仅限已满 18 岁的用户，开启后显示账号可访问的参考素材。</p></div><button id="adultSw" class="asw" role="switch" aria-label="显示成人向参考（18+）" aria-checked="${current.adultMode}"><span class="trk" aria-hidden="true"><span class="kn"></span></span></button></div>`:'<p>当前显示常规图库。</p><p class="access-note">'+(current.user?'此账号当前可使用常规素材。':'登录后可查看账号的内容偏好。')+'</p>';
    panel('内容偏好',controls+`<div class="access-account">${current.user?`<span>${escape(current.user.name)}<small>${escape(current.user.email)}</small></span><button id="prefsLogout" class="sm ghost">退出登录</button>`:'<button id="prefsLogin" class="access-submit">登录</button>'}</div>`,'preferences');
    if($('#adultSw'))$('#adultSw').onclick=async()=>{if(!current.adultMode)return adultAsk();$('#adultSw').disabled=true;try{await setMode(false);preferences();toast('已恢复常规浏览');}catch(error){panel('连接暂时不可用','<p>'+escape(error.message)+'</p><button id="prefRetry">重试</button>');$('#prefRetry').onclick=preferences;}};
    if($('#prefsLogin'))$('#prefsLogin').onclick=login;
    if($('#prefsLogout'))$('#prefsLogout').onclick=logout;
  }
  async function logout() {try{await api('/api/auth/sign-out',{});apply(null);broadcast();closeMenu();if(dialog.open)closeDialog();toast('已退出登录');}catch(error){toast(error.message);}}
  let adminPage=1,adminQuery='',searchTimer,searchRequest,adminSequence=0;
  async function loadUsers() {
    searchRequest?.abort();searchRequest=new AbortController();const sequence=++adminSequence;
    const region=$('#accountUsers');if(!region)return;region.setAttribute('aria-busy','true');
    try {
      const result=await api('/api/admin/users?page='+adminPage+'&q='+encodeURIComponent(adminQuery),undefined,searchRequest.signal);
      if(sequence!==adminSequence||dialog.dataset.view!=='admin')return;
      adminPage=result.page;
      region.innerHTML=result.users.length?result.users.map(user=>`<div class="access-user"><span><b>${escape(user.name)}</b><small>${escape(user.email)}</small></span><button type="button" class="sm" data-grant="${escape(user.id)}" data-enabled="${!user.permissions.includes('content.adult.view')}" data-email="${escape(user.email)}">${user.permissions.includes('content.adult.view')?'撤销查看权限':'授予查看权限'}</button></div>`).join(''):'<p class="access-note">没有匹配账号，换个关键词试试。</p>';
      $('#accountCount').textContent=`${result.total} 个账号 · 第 ${result.page} / ${result.pages} 页`;
      $('#accountPrevious').disabled=result.page<=1;$('#accountNext').disabled=result.page>=result.pages;
      $('#sitePolicy').textContent=result.enabled?'关闭全站成人素材':'开启全站成人素材';$('#sitePolicy').dataset.enabled=String(!result.enabled);
      $('#adminError').hidden=true;
    } catch(error) {if(sequence===adminSequence&&dialog.dataset.view==='admin')errorMessage(error);}
    finally {if(region.isConnected)region.removeAttribute('aria-busy');}
  }
  function confirmChange(title, explanation, action) {
    panel(title,`<p>${escape(explanation)}</p><p class="access-error" id="accessError" role="alert" hidden></p><div class="access-actions"><button id="grantCancel" type="button">取消</button><button id="grantConfirm" type="button" class="access-submit">${escape(title)}</button></div>`,'confirmation');
    $('#grantCancel').onclick=admin;
    $('#grantConfirm').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await action();await refresh();broadcast();admin();toast('设置已更新');}catch(error){errorMessage(error);button.disabled=false;}};
    $('#grantCancel').focus();
  }
  function admin() {
    if(!has('users.permissions.manage'))return preferences();
    panel('账号管理',`<p class="access-note">通过邀请创建账号，并按账号分配内容查看权限。</p>${form(field('email','邀请邮箱','email','off')+'<label class="access-check"><input type="checkbox" name="adult">授予成人素材查看权限</label>','创建邀请码')}<div id="inviteResult" hidden></div><hr><label class="access-field" for="accountQuery">搜索账号</label><div class="access-input"><input id="accountQuery" type="search" value="${escape(adminQuery)}" placeholder="邮箱或称呼" autocomplete="off"><button id="clearAccountQuery" type="button" class="sm ghost" aria-label="清除账号搜索" ${adminQuery?'':'hidden'}>✕</button></div><p class="access-error" id="adminError" role="alert" hidden></p><div id="accountUsers" class="access-users" aria-live="polite"></div><div class="access-pagination"><small id="accountCount"></small><button id="accountPrevious" class="sm">上一页</button><button id="accountNext" class="sm">下一页</button></div><hr><button id="sitePolicy" class="ghost sm">正在读取站点配置…</button>`,'admin');
    const showInvite=()=>{if(!lastInvite)return;$('#inviteResult').hidden=false;$('#inviteResult').innerHTML=`<p>已为 ${escape(lastInvite.email)} 创建邀请码，有效期 24 小时。请通过可信渠道交给对方。</p><label class="access-field" for="inviteCode">邀请码</label><div class="access-input"><input id="inviteCode" type="password" readonly autocomplete="off" value="${escape(lastInvite.code)}"><button class="sm" type="button" id="copyInviteCode">复制</button></div>`;$('#copyInviteCode').onclick=async()=>{try{await navigator.clipboard.writeText(lastInvite.code);toast('邀请码已复制');}catch{toast('无法访问剪贴板，请重试');}};};
    const integration=document.createElement('button');integration.type='button';integration.className='sm';integration.textContent='公众号自动发码设置';integration.onclick=wechatSettings;dialog.querySelector('.access-body').prepend(integration);
    showInvite();
    bindForm(async(values,signal)=>{const invite=await api('/api/admin/invites',{email:values.email,adult:values.adult==='on'},signal);if(!dialog.open||dialog.dataset.view!=='admin')return;lastInvite=invite;showInvite();toast('邀请已创建');});
    let composing=false;
    $('#accountQuery').addEventListener('compositionstart',()=>{composing=true;});
    const search=()=>{if(composing)return;clearTimeout(searchTimer);adminQuery=$('#accountQuery').value;$('#clearAccountQuery').hidden=!adminQuery;adminPage=1;searchTimer=setTimeout(loadUsers,300);};
    $('#accountQuery').addEventListener('input',search);$('#accountQuery').addEventListener('compositionend',()=>{composing=false;search();});
    $('#accountQuery').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();clearTimeout(searchTimer);loadUsers();}});
    $('#clearAccountQuery').onclick=()=>{clearTimeout(searchTimer);$('#accountQuery').value='';adminQuery='';adminPage=1;$('#clearAccountQuery').hidden=true;loadUsers();$('#accountQuery').focus();};
    $('#accountPrevious').onclick=()=>{adminPage--;loadUsers();};$('#accountNext').onclick=()=>{adminPage++;loadUsers();};
    $('#accountUsers').onclick=event=>{const button=event.target.closest('[data-grant]');if(!button)return;const enabled=button.dataset.enabled==='true';confirmChange(enabled?'授予查看权限':'撤销查看权限',`${button.dataset.email}：${enabled?'授权后仍需自行确认开启成人素材。':'撤销后，此账号新的受限资源请求将被拒绝。'}`,()=>api('/api/admin/permissions',{userId:button.dataset.grant,enabled}));};
    $('#sitePolicy').onclick=event=>{const enabled=event.currentTarget.dataset.enabled==='true';confirmChange(enabled?'开启全站成人素材':'关闭全站成人素材',enabled?'拥有权限的账号可在内容偏好中主动开启。':'所有账号将恢复常规浏览，新的受限资源请求会被拒绝。',()=>api('/api/admin/policy',{enabled}));};
    loadUsers();
  }
  async function wechatSettings() {
    panel('公众号自动发码','<p class="access-note" role="status">正在读取接入配置…</p>','wechat');
    let settings;
    try{settings=await api('/api/admin/wechat');}catch(error){if(dialog.dataset.view==='wechat'){panel('公众号自动发码',`<p>${escape(error.message)}</p><button id="wechatRetry">重试</button>`,'wechat');$('#wechatRetry').onclick=wechatSettings;}return;}
    if(!dialog.open||dialog.dataset.view!=='wechat')return;
    const secretNote=(configured,label)=>`<p class="access-note">${label}${configured?'已保存，留空保留现有值。':'尚未配置。'}</p>`;
    panel('公众号自动发码',`<p class="access-note">把以下回调地址填入公众号后台的服务器配置，消息加解密选择「安全模式」。本功能无需 AppSecret。</p><label class="access-field" for="wechatCallback">回调地址</label><div class="access-input"><input id="wechatCallback" readonly value="${escape(settings.callbackUrl)}"><button id="copyWechatCallback" type="button" class="sm">复制</button></div><p class="wechat-state" role="status">${settings.verified?'服务器验证已通过':'等待公众号服务器验证'}${settings.lastMessageAt?' · 已收到加密消息':''}</p><p class="access-note">已领取 ${settings.issued} 人 · 已注册 ${settings.redeemed} 人</p>`+form(
      field('name','公众号名称','text','off',`value="${escape(settings.name)}" maxlength="60"`)+
      field('keyword','领取关键词','text','off',`value="${escape(settings.keyword)}" maxlength="30"`)+
      field('appId','公众号 AppID','text','off',`value="${escape(settings.appId)}" placeholder="wx…"`)+
      field('originalId','公众号原始 ID（可选）','text','off',`value="${escape(settings.originalId)}" placeholder="gh_…"`)+
      field('token','服务器 Token','password','off','placeholder="16–32 位字母和数字"')+secretNote(settings.hasToken,'Token ')+
      field('aesKey','EncodingAESKey','password','off','placeholder="公众号后台生成的 43 位密钥"')+secretNote(settings.hasAesKey,'EncodingAESKey ')+
      field('quota','最多领取人数（0 表示不限）','number','off',`value="${settings.quota}" min="0" max="1000000" step="1"`)+
      `<label class="access-check"><input name="enabled" type="checkbox" ${settings.enabled?'checked':''}>开启自动发放</label><label class="access-check"><input name="adultGrant" type="checkbox" ${settings.adultGrant?'checked':''}>新领取的邀请码授予 18+ 素材查看权限</label><p class="access-note">不勾选时注册账号仅有常规权限。获授权用户仍需自行确认开启成人向参考。暂停发放不会撤销已发出的有效邀请码。</p>`,'保存接入配置')+`<div class="access-actions"><a class="btn" href="/invite/" target="_blank" rel="noopener">预览引流页</a><button id="refreshWechatStatus" type="button">刷新接入状态</button></div>`,'wechat');
    $('#copyWechatCallback').onclick=async()=>{try{await navigator.clipboard.writeText(settings.callbackUrl);toast('回调地址已复制');}catch{toast('无法访问剪贴板，请手动复制');}};
    $('#refreshWechatStatus').onclick=wechatSettings;
    bindForm(async(values,signal)=>{await api('/api/admin/wechat',{...values,enabled:values.enabled==='on',adultGrant:values.adultGrant==='on',quota:Number(values.quota)},signal);await wechatSettings();toast('接入配置已保存');},values=>{
      for(const key of ['name','keyword','appId','originalId','token','aesKey'])values[key]=values[key].trim();
      if(!values.name.trim())return{field:'name',message:'请填写公众号名称'};
      if(!values.keyword.trim())return{field:'keyword',message:'请填写领取关键词'};
      if(values.appId&&!/^wx[A-Za-z0-9]{8,32}$/.test(values.appId))return{field:'appId',message:'请填写正确的公众号 AppID'};
      if(values.originalId&&!/^gh_[A-Za-z0-9]{6,40}$/.test(values.originalId))return{field:'originalId',message:'请填写正确的公众号原始 ID'};
      if(values.token&&!/^[A-Za-z0-9]{16,32}$/.test(values.token))return{field:'token',message:'Token 需为 16–32 位字母和数字'};
      if(values.aesKey&&!/^[A-Za-z0-9+/]{43}$/.test(values.aesKey))return{field:'aesKey',message:'EncodingAESKey 需为 43 位密钥'};
      if(values.enabled==='on'){if(!values.appId)return{field:'appId',message:'启用前请填写公众号 AppID'};if(!values.token&&!settings.hasToken)return{field:'token',message:'启用前请填写 Token'};if(!values.aesKey&&!settings.hasAesKey)return{field:'aesKey',message:'启用前请填写 EncodingAESKey'};}
      const quota=Number(values.quota);if(!Number.isSafeInteger(quota)||quota<0||quota>1000000)return{field:'quota',message:'领取人数上限应为 0–1000000，0 表示不限'};
    });
  }
  window.PWAccess={login,register:code=>accountForm(false,code),get state(){return current;},api,refresh,preferences,adultAsk,connect(callback){notify=callback;},
    choose(title,explanation){return new Promise(resolve=>{panel(title,`<p>${escape(explanation)}</p><div class="access-actions"><button id="choiceNo">不包含密钥</button><button id="choiceYes" class="access-submit">包含密钥</button></div>`,'choice');let settled=false;const finish=value=>{if(settled)return;settled=true;resolve(value);};dialog.addEventListener('close',()=>finish(null),{once:true});$('#choiceNo').onclick=()=>{finish(false);closeDialog();};$('#choiceYes').onclick=()=>{finish(true);closeDialog();};});},
    async catalogue(type){if(!current.adultMode)return[];try{return await api('/api/catalog/adult?type='+encodeURIComponent(type));}catch(error){if(error.status===401||error.status===403)await refresh();throw error;}}};
  addEventListener('DOMContentLoaded',()=>{
    try{localStorage.removeItem('adult');}catch{}
    const more=$('#moreBtn'), menu=$('#moreMenu');
    more.onclick=()=>{menu.hidden=!menu.hidden;more.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('button:not([hidden])')?.focus();};
    more.onkeydown=event=>{if(event.key==='ArrowDown'){event.preventDefault();menu.hidden=false;more.setAttribute('aria-expanded','true');menu.querySelector('button:not([hidden])')?.focus();}};
    menu.onkeydown=event=>{const items=[...menu.querySelectorAll('button:not([hidden])')],index=items.indexOf(document.activeElement);if(event.key==='Escape'){closeMenu();more.focus();}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}};
    menu.onclick=event=>{const action=event.target.closest('[data-access]')?.dataset.access;if(!action)return;closeMenu();if(action==='request-invite')location.assign('/invite/');if(action==='preferences')preferences();if(action==='account')current.user?logout():login();if(action==='admin')admin();if(action==='password')changePassword();if(action==='help')$('#helpBox').hidden=false;if(action==='privacy')$('#privO').click();if(action==='standard')setMode(false).then(()=>toast('已恢复常规浏览')).catch(error=>toast(error.message));};
    document.addEventListener('click',event=>{if(!menu.contains(event.target)&&!more.contains(event.target))closeMenu();});
    document.querySelectorAll('[data-content-preferences]').forEach(button=>button.onclick=preferences);
    document.addEventListener('posewear-access-change',()=>{const item=$('[data-access="standard"]');if(item)item.hidden=!current.adultMode;});
    refresh(true);
  });
  channel?.addEventListener('message',()=>refresh());
  addEventListener('focus',()=>refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  addEventListener('offline',()=>{reconnectDisable=true;apply(null);});
  addEventListener('online',()=>refresh());
  setInterval(()=>{if(current.user&&!document.hidden)refresh();},60000);
})();
