'use strict';
(()=>{
 const $=selector=>document.querySelector(selector);
 let info={name:'404星球的猫',keyword:'邀请码',ready:false};
 async function copy(text){try{await navigator.clipboard.writeText(text);window.PWFeedback.toast('已复制');}catch{window.PWFeedback.toast('无法访问剪贴板，请长按文字复制');}}
 async function load(){
  $('#retryInviteInfo').hidden=true;$('#inviteAvailability').textContent='正在连接…';
  try{info=await window.PWAccess.api('/api/invite-info');document.querySelectorAll('[data-account-name]').forEach(node=>node.textContent=info.name);document.querySelectorAll('[data-keyword]').forEach(node=>node.textContent=info.keyword);$('#copyInviteKeyword').textContent=info.keyword;$('#inviteDelivery').textContent=info.ready?'公众号会自动回复你的一次性邀请码和注册链接。':'自动领取正在配置，开放后回复关键词即可领取。';$('#inviteAvailability').textContent=info.ready?'自动领取已开放':'自动领取暂未开放，已有邀请码仍可注册';if(info.qrUrl){$('#inviteQr').src=info.qrUrl;$('#inviteQrLink').href=info.qrUrl;$('#inviteQr').alt=info.name+'公众号二维码';}}
  catch{$('#inviteDelivery').textContent='暂时无法读取领取状态，稍后重试。';$('#inviteAvailability').textContent='连接失败，请重试';$('#retryInviteInfo').hidden=false;}
 }
 $('#inviteRegister').onclick=()=>window.PWAccess.register();$('#inviteLogin').onclick=()=>window.PWAccess.login();
 $('#copyAccountName').onclick=()=>copy(info.name);$('#copyInviteKeyword').onclick=()=>copy(info.keyword);$('#retryInviteInfo').onclick=load;
 function consumeCode(){const fragment=new URLSearchParams(location.hash.slice(1)),code=fragment.get('register');if(code){history.replaceState(null,'',location.pathname);if(/^[A-Za-z0-9_-]{43}$/.test(code))window.PWAccess.register(code);else window.PWFeedback.toast('邀请码格式不正确，请重新领取');}}
 addEventListener('hashchange',consumeCode);consumeCode();
 load();
})();
