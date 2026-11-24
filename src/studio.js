'use strict';
(()=>{const A=window.APP;if(!A)return;const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),esc=A.esc,toast=A.toast;
const LS=k=>{try{return JSON.parse(localStorage[k]||'null')}catch(e){return null}},SV=(k,v)=>{try{localStorage[k]=JSON.stringify(v)}catch(e){}};
// ---------- 服务商 ----------
const PROV={openai:{name:'OpenAI',base:'https://api.openai.com/v1',model:'gpt-image-1',models:['gpt-image-1','gpt-image-1-mini','gpt-image-2','gpt-image-2.6-sunburst','gpt-image-2.6-flare','dall-e-2']},
 gemini:{name:'Gemini',base:'https://generativelanguage.googleapis.com/v1beta',model:'gemini-2.5-flash-image',models:['gemini-2.5-flash-image','gemini-3-pro-image-preview','gemini-3.1-flash-image']},
 seedream:{name:'豆包 Seedream',base:'https://ark.cn-beijing.volces.com/api/v3',model:'doubao-seedream-4-0-250828',models:['doubao-seedream-4-0-250828','doubao-seedream-4-5-251128','doubao-seedream-5-0-flash-260915']},
 custom:{name:'自定义中转',base:'',model:'gpt-image-1',models:['gpt-image-1','gpt-image-2','gpt-image-2.6-sunburst','gpt-image-2.6-flare','gemini-2.5-flash-image','flux-kontext-pro','qwen-image-edit','doubao-seedream-4-0-250828']}};
const cfg=Object.assign({prov:'openai',base:'',key:'',model:'',field:'image[]',proto:'edits',proxy:false},LS('wbCfg')||{});
// ---------- 预设 ----------
const CHARS=[['asia','东亚女性','an adult East Asian woman in her mid-20s, long black hair, natural makeup, slim build','一位二十多岁的成年东亚女性，黑色长发，自然淡妆，身材纤细'],
 ['west','欧美女性','an adult Caucasian woman in her late 20s, wavy light-brown hair, natural makeup, athletic build','一位二十多岁的成年欧美女性，浅棕色波浪长发，自然妆容，匀称身材'],
 ['man','男性模特','an adult East Asian man in his late 20s, short black hair, clean-shaven, tall and lean','一位二十多岁的成年东亚男性，黑色短发，干净面容，高瘦身材'],
 ['anime','动漫角色','an adult anime-style girl, long silver hair, large expressive eyes, adult proportions, clean cel-shaded illustration','一位成年动漫风格女性角色，银色长发，大眼睛，成人身材比例，干净的赛璐璐上色插画'],
 ['custom','自定义','','']];
// Outfit-led photography for everyday social posts. Style never redesigns the reference outfit.
const STYLES=[
 {id:'daily',label:'清透日常',hint:'自然光 · 干净耐看',note:'明亮自然光、简洁生活背景，清楚呈现肤色和衣料本色。',primary:true,
  en:'fresh everyday outfit photograph, bright diffused window daylight, uncluttered cream or light-grey interior, true-to-life colors and gentle natural contrast',zh:'清透自然的日常穿搭摄影，明亮均匀的窗边自然光，简洁米白或浅灰生活背景，真实色彩与自然反差',toneEn:'fresh true-to-life colors and gentle natural contrast',toneZh:'清透真实的色彩与自然反差'},
 {id:'commute',label:'温柔通勤',hint:'柔和中性 · 利落松弛',note:'浅色建筑、柔和中性色，让通勤搭配有轮廓也有亲近感。',primary:true,
  en:'approachable modern workday outfit editorial, quiet pale stone architecture, soft neutral daylight, balanced beige and grey tones, clean restrained composition',zh:'温柔利落的日常通勤穿搭摄影，安静的浅色石材建筑，柔和中性日光，平衡的米灰色调，克制干净的构图',toneEn:'balanced neutral beige and grey color grading with restrained contrast',toneZh:'平衡克制的米灰中性色调与自然对比'},
 {id:'street',label:'周末出街',hint:'生活街景 · 轻松随拍',note:'安静街角、自然日光，保留轻松随拍感与清楚的穿搭细节。',primary:true,
  en:'relaxed weekend street-style photograph, quiet walkable city corner with simple storefronts, clear natural daylight, fresh balanced colors, candid photographic feel while following the reference pose',zh:'轻松自然的周末穿搭街拍，安静街角与简洁店面，清晰自然日光，清爽平衡的色彩，在参考姿势下呈现随拍摄影感',toneEn:'fresh balanced street-photography colors with natural local contrast',toneZh:'清爽平衡的街拍色彩与自然局部反差'},
 {id:'date',label:'约会氛围',hint:'微暖光线 · 温柔近人',note:'微暖咖啡店或浅色露台，肤色自然，背景保留可辨认的环境细节。',primary:true,
  en:'gentle everyday date outfit photograph, calm cafe terrace or warm ivory interior, softly warm daylight with neutral skin tones, inviting atmosphere and a readable background',zh:'温柔亲近的日常约会穿搭摄影，安静咖啡店露台或暖象牙白室内，微暖日光与自然肤色，背景环境清楚可辨',toneEn:'subtly warm color grading with neutral natural skin tones',toneZh:'微暖而克制的色调与自然真实的肤色'},
 {id:'campus',label:'轻甜学院',hint:'明快配色 · 轻盈日常',note:'书店或林荫步道的清新氛围，保持成年人物与原搭配。',primary:true,
  en:'fresh collegiate-inspired everyday outfit photograph of an adult, quiet bookshop exterior or tree-lined walkway, bright neutral daylight, airy light color grading, lighthearted editorial mood; keep the supplied garments unchanged',zh:'成年人物的轻甜学院感日常穿搭摄影，安静书店外或林荫步道，明亮中性日光，轻盈清新色调；服装仍严格沿用参考搭配',toneEn:'airy fresh color grading and a lighthearted adult editorial mood',toneZh:'轻盈清新的色调与自然成年气质'},
 {id:'studio',label:'穿搭画报',hint:'简洁布景 · 轮廓清楚',note:'浅灰或米白布景、均匀布光，突出整套搭配的轮廓和面料层次。',primary:true,
  en:'clean fashion lookbook photograph, seamless light-grey or cream studio backdrop, large even softbox lighting, natural tonal separation, outfit-led editorial composition with a clear silhouette',zh:'简洁时装穿搭画报摄影，浅灰或米白无缝影棚布景，大面积均匀柔光，自然明暗层次，以服装为主的清楚轮廓与画册构图',toneEn:'clean neutral editorial color grading with natural tonal separation',toneZh:'干净中性的画报色调与自然明暗层次'},
 {id:'keep',label:'原片质感',en:'photorealistic photograph, true-to-life colors, natural skin texture and clearly resolved fabric detail',zh:'写实摄影质感，真实色彩、自然皮肤纹理与清楚的衣料细节',note:'保留自然摄影质感，按参考图呈现人物与服装。'},
 {id:'ecom',label:'电商白底',en:'e-commerce product-model photo, pure white background, even lighting, full body',zh:'电商模特图，纯白背景，均匀布光，全身构图',note:'纯白背景与均匀布光，适合核对服装款式。'},
 {id:'film',label:'胶片色调',en:'warm restrained 35mm film-inspired color grading, natural skin tones, crisp facial and fabric detail, no added grain or haze',zh:'克制温暖的35mm胶片风格色调，自然肤色、清楚的面部和衣料细节，不添加颗粒或雾化',note:'保留暖调胶片色彩，面部与衣料仍清晰。'},
 {id:'anime',label:'动漫插画',en:'high-quality anime illustration, clean line art, soft cel shading',zh:'高质量动漫插画，干净线稿，柔和赛璐璐上色',note:'将画面转为动漫插画，适合单独探索插画效果。'}];
const PHOTO_DETAIL={en:'Keep the face, individual hair strands and fabric weave clearly resolved, realistic skin texture, moderate depth of field and natural local contrast; no soft focus, haze, glow diffusion, heavy skin smoothing or added film grain. The style changes only the setting, light and color treatment, never the reference identity, outfit, accessories or body proportions.',zh:'面部、独立发丝与衣料纹理清楚可辨，保留真实皮肤细节，适当景深与自然局部反差；不柔焦、雾化、加光晕、过度磨皮或添加胶片颗粒。风格只调整场景、光线与色调，不改变参考人物身份、服装、配饰和身体比例。'};
const savedStyle=LS('wbStyle'),initialStyle=STYLES.some(s=>s.id==savedStyle)?savedStyle:'daily';
const ANG_EN={'正面':'front view','斜侧':'three-quarter view','侧面':'side profile','俯拍':'high-angle shot looking down','仰拍':'low-angle shot looking up','背面':'back view','下から':'low angle'};
const W={mode:LS('wbMode')||'tryon',persons:[],garments:[],poses:[],char:LS('wbChar')||'asia',charTxt:LS('wbCharTxt')||'',style:initialStyle,bm:LS('wbBm')||'each',pl:LS('wbPl')||'en',keepBg:LS('wbKeepBg')??true,busy:null,dirty:false,results:[],ri:0,cmp:true};
// item: {kind:'lib',k,ai?} | {kind:'file',blob,url,name}
const g0=LS('wbSel')||{};
// ---------- 工具 ----------
const normBase=b=>(b||'').trim().replace(/\/+$/,'');
function root(c=cfg){let b=normBase(c.base)||PROV[c.prov].base;if(c.prov=='gemini')return/\/v1(beta|alpha)?$/.test(b)?b:b+'/v1beta';if(c.prov=='seedream')return b;return/\/v\d+$/.test(b)?b:b+'/v1'}
const modelOf=()=>(cfg.model||'').trim()||PROV[cfg.prov].model;
const proto=()=>cfg.prov=='openai'?'edits':cfg.prov=='custom'?cfg.proto:cfg.prov;
// Native output capabilities, independent of reference-image resizing. Sources:
// developers.openai.com/api/docs/guides/image-generation
// ai.google.dev/gemini-api/docs/image-generation
// docs.volcengine.com/docs/ark/image-generation-api
const OUTPUT_TIERS=[['standard','标准'],['hd','高清'],['ultra','超清']];
const GPT_QUALITIES=['low','medium','high'],MODERN_GPT_QUALITIES=[...GPT_QUALITIES,'xhigh','max','auto'];
const QUALITY_OPTIONS=[['medium','中等（默认）'],['high','高（更多细节）'],['low','低（节省费用）'],['xhigh','极高（更多费用）'],['max','最高（最多费用）'],['auto','自动（由模型决定）']];
const outputPrefs={ar:LS('wbAR')||'auto',tier:LS('wbResolution')||'standard',quality:LS('wbQuality')||'medium'};
const GPT2_SIZES={'2:3':['1024x1536','1536x2304','1920x2880'],'3:4':['960x1280','1536x2048','1920x2560'],'9:16':['864x1536','1152x2048','1440x2560'],'1:1':['1024x1024','2048x2048','2560x2560'],'3:2':['1536x1024','2304x1536','2880x1920'],'4:3':['1280x960','2048x1536','2560x1920'],'16:9':['1536x864','2048x1152','2560x1440']};
const GPT1_SIZES={'2:3':['1024x1536'],'1:1':['1024x1024'],'3:2':['1536x1024']};
const SEEDREAM_SIZES={'2:3':['1664x2496','2560x3840'],'3:4':['1728x2304','3072x4096'],'9:16':['1440x2560','2304x4096'],'1:1':['2048x2048','4096x4096'],'3:2':['2496x1664','3840x2560'],'4:3':['2304x1728','4096x3072'],'16:9':['2560x1440','4096x2304']};
const GEMINI_BASE={'2:3':'848x1264','3:4':'896x1200','9:16':'768x1376','1:1':'1024x1024','3:2':'1264x848','4:3':'1200x896','16:9':'1376x768'};
const GEMINI25_BASE={'2:3':'832x1248','3:4':'864x1184','9:16':'768x1344','1:1':'1024x1024','3:2':'1248x832','4:3':'1184x864','16:9':'1344x768'};
const scaleSize=(s,n)=>s.split('x').map(v=>+v*n).join('x'),prettySize=s=>s?s.replace('x','×'):'由模型决定';
function outputCaps(){const m=modelOf();
 if(cfg.prov=='gemini'){const multi=/^gemini-(3-pro|3\.1-flash)-image(?:-preview)?$/.test(m),old=/^gemini-2\.5-flash-image(?:-preview)?$/.test(m),base=multi?GEMINI_BASE:GEMINI25_BASE;
  return{kind:'gemini',sizes:Object.fromEntries(Object.entries(base).map(([ar,s])=>[ar,multi?[s,scaleSize(s,2),scaleSize(s,4)]:[s]])),auto:true,multi,estimated:true,note:multi?'按模型的 1K / 2K / 4K 档位请求，宽高为文档参考值，以实际返回为准。':old?'此模型只支持标准分辨率；高清需手动更换支持的模型。':'此模型的尺寸能力未确认，仅发送画幅，不发送分辨率档位。',unknown:!multi&&!old}}
 if(cfg.prov=='seedream'){const known=/^doubao-seedream-4-(0|5)-/.test(m);return{kind:'seedream',sizes:known?SEEDREAM_SIZES:{},auto:true,unknown:!known,note:known?'标准约 4 百万像素；高清请求更多原生像素，费用与耗时可能增加。':'此模型的尺寸能力未确认，使用服务商默认尺寸；高清不可用。'}}
 if(/^gpt-image-2\.[56]-(sunburst|flare)(?:-\d{4}-\d{2}-\d{2})?$/.test(m))return{kind:'gpt2',sizes:GPT2_SIZES,auto:true,quality:true,qualities:MODERN_GPT_QUALITIES,note:m.startsWith('gpt-image-2.5-')?'此模型超过 2560×1440 的分辨率仍为实验性支持。':''};
 if(/^gpt-image-2(?:-\d{4}-\d{2}-\d{2})?$/.test(m))return{kind:'gpt2',sizes:GPT2_SIZES,auto:true,quality:true};
 if(/^gpt-image-1(?:\.5|-mini)?(?:-\d{4}-\d{2}-\d{2})?$/.test(m))return{kind:'gpt1',sizes:GPT1_SIZES,auto:true,quality:true,note:'此模型仅支持标准尺寸和 2:3、1:1、3:2；其他画幅与高清不可用。'};
 if(m=='dall-e-2')return{kind:'dalle2',sizes:{'1:1':['1024x1024']},auto:false,note:'此模型仅支持方形标准尺寸，渲染质量由模型固定。'};
 return{kind:'compatible',sizes:GPT1_SIZES,auto:false,note:'未知兼容模型仅提供常用标准尺寸；请核对服务商文档，高清与质量参数未启用。'}
}
function outputChoice(){const cap=outputCaps(),ar=$('#wbAR').value,tier=$('#wbResolution').value||'standard',idx=OUTPUT_TIERS.findIndex(t=>t[0]==tier),sizes=cap.sizes[ar],automatic=ar=='auto'&&cap.auto;
 const size=automatic?(cap.kind=='seedream'?'1728x2304':'auto'):sizes&&sizes[idx];
 const valid=idx>=0&&(automatic?(cap.multi||idx==0):!!size);
 const quality=cap.quality?$('#wbQuality').value:null;
 const qualityValid=!cap.quality||(cap.qualities||GPT_QUALITIES).includes(quality);
 return{ar,tier,size:cap.unknown?null:size,expectedSize:cap.unknown||size=='auto'?null:size,imageSize:cap.multi?['1K','2K','4K'][idx]:null,quality,kind:cap.kind,estimated:!!cap.estimated,invalidField:!valid?'wbResolution':!qualityValid?'wbQuality':null,error:!valid?'当前模型或自动画幅不支持所选分辨率。请选择可用画幅与档位。':!qualityValid?'当前模型不支持已选的渲染质量，请选择可用质量或更换模型。':''}}
function renderOutput(){const cap=outputCaps(),ar=$('#wbAR').value,{tier,quality}=outputPrefs;
 [...$('#wbAR').options].forEach(o=>o.disabled=o.value=='auto'?!cap.auto:!cap.sizes[o.value]);
 $('#wbResolution').innerHTML=OUTPUT_TIERS.map(([id,label],i)=>{const s=cap.sizes[ar]&&cap.sizes[ar][i],auto=ar=='auto'&&cap.auto,ok=auto?(cap.multi||i==0):!!s;return`<option value="${id}" ${tier==id?'selected':''} ${ok?'':'disabled'}>${label} · ${ok?(cap.unknown?'服务商默认':auto?(cap.kind=='seedream'?prettySize('1728x2304'):cap.multi?['1K','2K','4K'][i]+'，宽高自动':'宽高自动'):prettySize(s)+(cap.estimated?' 参考值':'')):'当前模型 / 画幅不支持'}</option>`}).join('');
 const allowedQualities=cap.qualities||GPT_QUALITIES,qualityOptions=QUALITY_OPTIONS.filter(([v])=>allowedQualities.includes(v)||v==quality);if(!qualityOptions.some(([v])=>v==quality))qualityOptions.push([quality,'不支持的质量设置']);
 $('#wbQuality').innerHTML=cap.quality?qualityOptions.map(([v,t])=>`<option value="${esc(v)}" ${quality==v?'selected':''} ${allowedQualities.includes(v)?'':'disabled'}>${t}${allowedQualities.includes(v)?'':'（当前模型不支持）'}</option>`).join(''):'<option value="fixed">由模型决定（无独立质量参数）</option>';
 $('#wbQuality').disabled=!cap.quality||!!W.busy;['wbAR','wbResolution','wbN'].forEach(id=>$('#'+id).disabled=!!W.busy);
 const choice=outputChoice();$('#wbAR').setAttribute('aria-invalid',String(ar=='auto'?!cap.auto:!cap.sizes[ar]));$('#wbResolution').setAttribute('aria-invalid',String(choice.invalidField=='wbResolution'));$('#wbQuality').setAttribute('aria-invalid',String(choice.invalidField=='wbQuality'));$('#wbOutputHelp').textContent=[choice.error,cap.note,cap.kind=='gpt2'?'尺寸直接请求模型原生输出，本站不放大图片。':'',cap.quality?'默认标准分辨率 + 中等质量；高清、超清或高质量通常更贵、更慢。':'默认使用标准档位，费用按服务商计费。',cfg.prov=='custom'?'中转须支持所选参数；失败时保留设置并报错，不自动降低尺寸或质量。':''].filter(Boolean).join(' ');
 return choice}
$('#wbAR').value=outputPrefs.ar;
function loadImg(src){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>j(Error('图片读取失败'));i.src=src})}
async function toJpeg(src,max=1536){const i=await loadImg(src);let w=i.naturalWidth,h=i.naturalHeight,s=Math.min(1,max/Math.max(w,h));w=Math.round(w*s);h=Math.round(h*s);
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(i,0,0,w,h);return new Promise(r=>c.toBlob(b=>r({blob:b,w,h}),'image/jpeg',.92))}
const libSrc=a=>{const it=A.ITEMS[a.k];return it.type=='pose'?it.angles[a.ai??it.ai].i:it.i};
async function assetBlob(a){if(a.kind=='file')return a.blob;const src=libSrc(a);const r=await fetch(src);if(!r.ok){if(r.status===401||r.status===403)await window.PWAccess.refresh();throw Error('素材下载失败（'+r.status+'）');}const u=URL.createObjectURL(await r.blob());try{return(await toJpeg(u,1280)).blob}finally{URL.revokeObjectURL(u)}}
const b64=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(b)});
const dataURL=async b=>'data:'+(b.type||'image/jpeg')+';base64,'+await b64(b);
const isGen=()=>W.mode=='gen';const hasPerson=()=>W.persons.length>0;
// ---------- 提示词 ----------
function poseDesc(p,en){const it=A.ITEMS[p.k];if(!it)return'';const a=it.angles[p.ai??it.ai];return en?`${it.en} (${it.lineEn}, ${ANG_EN[a.zh]||a.en||a.zh})${/2人|双人/.test(it.line)?' — a two-person pose: match the number of people and their relative positions':''}`:`${it.zh}（${it.line}，${a.zh}）${/2人|双人/.test(it.line)?'——双人姿势，人数与相对位置需与线稿一致':''}`}
const selectedStyle=()=>STYLES.find(s=>s.id==W.style)||STYLES[0];
function compose(poseSet){const en=W.pl=='en',P=W.persons.length,G=W.garments.length,ps=poseSet||W.poses,np=ps.length,sheet=np>1;const style=selectedStyle(),ch=CHARS.find(c=>c[0]==W.char)||CHARS[0],ex=$('#wbExtra').value.trim(),keepScene=P&&W.keepBg&&!isGen(),look=keepScene&&style.primary?(en?style.toneEn:style.toneZh):(en?style.en:style.zh);
 const gi=W.garments.map(g=>g.kind=='lib'&&A.ITEMS[g.k]).filter(Boolean);let n=0;const rng=(c)=>{if(!c)return null;const a=n+1,b=n+c;n=b;return a==b?(en?`image ${a}`:`第 ${a} 张`):(en?`images ${a}–${b}`:`第 ${a}–${b} 张`)};
 const rP=rng(P),rG=rng(G),rS=rng(np);const L=[];
 if(en){L.push(P?`Fashion ${isGen()?'image generation':'virtual try-on'} using reference images. ${rP} ${P>1?'show':'shows'} the person (same individual)${G?`; ${rG} ${G>1?'show':'shows'} the outfit${G>1?' pieces (top and bottom)':''} on an invisible mannequin`:''}${np?`; ${rS} ${np>1?'are':'is'} pose sketch${np>1?'es':''}`:''}.`:`Fashion image generation from reference images. ${G?`${rG} ${G>1?'show':'shows'} the outfit on an invisible mannequin`:''}${np?`; ${rS} ${np>1?'are':'is'} pose sketch${np>1?'es':''}`:''}.`);
  L.push(P?"Subject: the person from the photo. Preserve their face, identity, hairstyle, skin tone and body proportions exactly; they must stay recognisably the same adult.":`Subject: ${(W.char=='custom'?W.charTxt:ch[2])||ch[2]||'an adult model'}. Always an adult with adult proportions.`);
  if(G)L.push(`Outfit: dress the subject in the complete outfit from ${rG}, reproducing every garment faithfully — cut, color, fabric, pattern, layering, shoes and accessories${gi.length?': '+gi.map(x=>x.en.replace(/^[^,]*outfit,\s*/,'')).join('; '):''}. Replace the original clothing entirely. Never draw the mannequin or a blank body.`);
  if(np)L.push((sheet&&W.bm=='sheet'?`Pose: draw ${np} panels in one image, one per pose sketch, same subject and outfit in every panel, with even spacing and no text: `:'Pose: ')+ps.map((p,i)=>(sheet&&W.bm=='sheet'?`(${i+1}) `:'')+poseDesc(p,true)).join('; ')+'. Use the sketch only for body posture, weight, limb placement and camera angle; never draw sketch lines, joint circles or guide marks.');
  else if(P)L.push('Pose: keep the original pose, framing and camera angle.');
  L.push(`Look: ${keepScene?'keep the original background and lighting of the photo; ':''}${look}. ${style.primary?PHOTO_DETAIL.en+' ':''}Natural fabric drape with realistic folds and shadows, high detail. No text, no watermark, no borders.`);
  if(ex)L.push('Additional: '+ex)}
 else{L.push(P?`时尚${isGen()?'生图':'虚拟试穿'}，使用参考图。${rP}是人物照片（同一人）${G?`；${rG}是放在隐形人台上的服装${G>1?'（上装与下装）':''}`:''}${np?`；${rS}是姿势线稿`:''}。`:`根据参考图进行时尚生图。${G?`${rG}是放在隐形人台上的服装`:''}${np?`；${rS}是姿势线稿`:''}。`);
  L.push(P?'人物：照片中的人。严格保留其面部、身份特征、发型、肤色与身材比例，必须一眼认出是同一位成年人。':`人物：${(W.char=='custom'?W.charTxt:ch[3])||ch[3]||'一位成年模特'}。始终为成年人比例。`);
  if(G)L.push(`服装：为人物换上${rG}中的整套服装，准确还原版型、颜色、面料、图案、叠穿、鞋袜与配饰${gi.length?'：'+gi.map(x=>x.zh.replace(/[。.]$/,'')).join('；'):''}。完全替换原有衣物，不要画出人台或空白身体。`);
  if(np)L.push((sheet&&W.bm=='sheet'?`姿势：在同一张图中画 ${np} 格，每格对应一张线稿，人物与服装保持一致，均匀留白，不写文字：`:'姿势：')+ps.map((p,i)=>(sheet&&W.bm=='sheet'?`（${i+1}）`:'')+poseDesc(p,false)).join('；')+'。线稿只用于提取身体姿态、重心、四肢位置和镜头角度，不要画出线条、关节圆或辅助线。');
  else if(P)L.push('姿势：保持原照片的姿势、构图和拍摄角度。');
  L.push(`画面：${keepScene?'保留原照片的背景与光线；':''}${look}。${style.primary?PHOTO_DETAIL.zh:''}衣物垂坠自然，褶皱阴影真实，高细节。不要文字、水印或边框。`);
  if(ex)L.push('补充：'+ex)}
 return L.join('\n')}
function reprompt(force){if(force||!W.dirty){$('#wbPrompt').value=compose();W.dirty=false}renderStyleHelp()}
function renderStyleHelp(){const s=selectedStyle(),keepScene=hasPerson()&&W.keepBg&&!isGen();$('#wbStyleHelp').textContent=`当前：${s.label}。`+(W.dirty?'提示词已手动修改；点击高级设置中的“重置”应用所选风格。':keepScene&&s.primary?'保留原背景时仅应用色调；配套场景需在高级设置关闭“保留原照片背景与光线”。':s.note)}
let stylesInitialized=false;
function renderStyles(){const button=s=>`<button type="button" class="${s.primary?'style-choice':'chip'}${W.style==s.id?' on':''}" data-style="${s.id}" aria-pressed="${W.style==s.id}" ${W.busy?'disabled':''}><span>${s.label}</span>${s.primary?`<small>${s.hint}</small>`:''}</button>`;
 $('#wbStylePrimary').innerHTML=STYLES.filter(s=>s.primary).map(button).join('');$('#wbStyleSecondary').innerHTML=STYLES.filter(s=>!s.primary).map(button).join('');$('#wbStyleCurrent').textContent=selectedStyle().primary?'':`当前：${selectedStyle().label}`;if(!stylesInitialized){$('#wbStyleMore').open=!selectedStyle().primary;stylesInitialized=true}}
// ---------- 渲染 ----------
function pickRow(a,type,i){const it=a.kind=='lib'&&A.ITEMS[a.k];if(a.kind=='lib'&&!it)return'<div class="empty0">加载中…</div>';
 const src=it?(type=='pose'?it.angles[a.ai??it.ai].t:A.thumb(it)):a.url,t=it?A.title(it):(a.name||'自定义图片'),sub=it?(it.type=='pose'?it.line+' · '+it.angles[a.ai??it.ai].zh:it.cat+' · '+it.id):(type=='costume'?(W.garments.length>1?(i==0?'上装':'下装'):'本地上传'):'本地上传');
 return`<div class="pick ${type}"><img src="${src}" alt="${esc(t)}"><div><b>${esc(t)}</b><small>${esc(sub)}</small></div>${type=='pose'&&it?`<select data-ang="${i}" aria-label="角度">${it.angles.map((x,j)=>`<option value="${j}" ${j==(a.ai??it.ai)?'selected':''}>${x.zh}</option>`).join('')}</select>`:''}<button class="rmx" data-rm="${type}" data-i="${i}" aria-label="移除" title="移除">×</button></div>`}
function render(){const G=isGen();$$('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode==W.mode));
 $('#stLead').textContent=G?'选模特类型和服装，直接出一张上身图。':'上传照片，选一套衣服，换上看看。';
 $('#s1T').textContent=G?'模特':'人物照片';$('#s1R').textContent=G?'可传脸部参考':'必选';$('#s1T').textContent=G?'模特':'人物';
 $('#wbPersons').innerHTML=W.persons.map((p,i)=>`<div class="pp"><img src="${p.url}" alt="人物照片 ${i+1}"><small>${p.w}×${p.h}</small><button class="x" data-rmp="${i}" aria-label="移除">×</button></div>`).join('');
 $('#wbDrop').classList.toggle('mini',W.persons.length>0);$('#wbDrop').hidden=W.persons.length>=3;$('#wbChar').hidden=!G||hasPerson();
 $('#wbChars').innerHTML=CHARS.map(c=>`<button class="chip ${W.char==c[0]?'on':''}" data-char="${c[0]}">${c[1]}</button>`).join('');$('#wbCharTxt').hidden=W.char!='custom';$('#wbCharTxt').value=W.charTxt;
 $('#wbG').innerHTML=W.garments.length?W.garments.map((g,i)=>pickRow(g,'costume',i)).join(''):'<button class="empty0" data-pick="costume"><span><b>选择服装</b><small>从库里选，或上传图片</small></span></button>';
 $('#wbPo').innerHTML=W.poses.length?W.poses.map((p,i)=>pickRow(p,'pose',i)).join(''):`<button class="empty0" data-pick="pose"><span><b>选择姿势（可选）</b><small>${G?'不选就随机':'不选就保持原姿势'}</small></span></button>`;
 $('#wbBatch').hidden=W.poses.length<2;$$('[data-bm]').forEach(b=>b.classList.toggle('on',b.dataset.bm==W.bm));$('#wbAllAng').hidden=W.poses.length!=1||!A.ITEMS[(W.poses[0]||{}).k];
 renderStyles();$('#wbKeepBg').checked=W.keepBg;$('#wbKeepBg').closest('label').hidden=G||!hasPerson();
 $$('[data-pl]').forEach(b=>b.classList.toggle('on',b.dataset.pl==W.pl));
 const ok=!!cfg.key;$('#wbDot').className='dot'+(ok?' on':'');$('#wbProv').textContent=ok?PROV[cfg.prov].name+' · '+modelOf():'未配置 API';$('#wbDot2').className='dot'+(ok?' on':'');$('#wbProv2').textContent=ok?PROV[cfg.prov].name:'未配置 API';$('#wbOnb').hidden=ok;
 const dn=[G?true:hasPerson(),W.garments.length>0,W.poses.length>0,!!(W.style||$('#wbExtra').value)];$$('.step[data-s]').forEach(e=>e.classList.toggle('done',dn[e.dataset.s-1]));
 const jobs=nJobs();$('#wbGo').textContent='生成';$('#wbEst').textContent=`将生成 ${jobs} 张`;
 const output=renderOutput(),miss=[!G&&!hasPerson()&&'人物照片',!W.garments.length&&'服装',!ok&&'API 密钥',output.error&&'可用出图设置'].filter(Boolean);$('#wbHint').textContent=miss.length?'还缺：'+miss.join('、'):'每张约半分钟，高清可能更久';$('#wbHint').classList.toggle('miss',!!miss.length);const need=[!G&&!hasPerson()&&'上传人物照片',!W.garments.length&&'选择服装',output.error&&'调整出图设置'].filter(Boolean);if(!W.busy){$('#wbGo').disabled=!!need.length;$('#wbGo').title=need.length?'请先'+need.join('、'):'';if(need.length)$('#wbGo').textContent='请先'+need[0]}$$('.flow [data-f]').forEach(e=>e.classList.toggle('on',e.dataset.f<4?dn[e.dataset.f-1]&&(e.dataset.f!=3||W.poses.length>0):!need.length));
 SV('wbSel',{g:W.garments.filter(g=>g.kind=='lib').map(g=>g.k),p:W.poses.filter(p=>p.kind=='lib').map(p=>[p.k,p.ai])});reprompt()}
const nJobs=()=>(W.poses.length>1&&W.bm=='each'?W.poses.length:1)*(+$('#wbN').value||1);
// ---------- 上传 ----------
async function addPortrait(it){if(W.persons.length>=3)return toast('最多 3 张人物照片');try{const x=await toJpeg(it.m,1536);W.persons.push({blob:x.blob,url:URL.createObjectURL(x.blob),w:x.w,h:x.h,k:it.k});render();toast(W.mode=='gen'?'已设为脸部参考（生成时保持这张脸）':'已设为人物照片')}catch(e){toast('人像加载失败')}}
async function addPersons(files){files=[...files].filter(f=>/^image\//.test(f.type));if(!files.length)return toast('请选择图片文件');for(const f of files){if(W.persons.length>=3){toast('最多 3 张人物照片');break}const u=URL.createObjectURL(f);try{const r=await toJpeg(u,1536);W.persons.push({blob:r.blob,url:URL.createObjectURL(r.blob),w:r.w,h:r.h})}catch(e){toast('无法读取这张图片')}finally{URL.revokeObjectURL(u)}}render()}
const drop=$('#wbDrop');$('#wbFile').onchange=e=>{addPersons(e.target.files);e.target.value=''};
['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over')}));['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>addPersons(e.dataTransfer.files));drop.addEventListener('keydown',e=>{if(e.key=='Enter'||e.key==' '){e.preventDefault();$('#wbFile').click()}});
$('#wbGFile').onchange=async e=>{const fs=[...e.target.files];e.target.value='';W.garments=W.garments.filter(g=>g.kind=='file');for(const f of fs){if(W.garments.length>=2){toast('最多上传 2 张服装图（上装 + 下装）');break}const u=URL.createObjectURL(f);try{const r=await toJpeg(u,1280);URL.revokeObjectURL(u);W.garments.push({kind:'file',blob:r.blob,url:URL.createObjectURL(r.blob),name:f.name})}catch(x){toast('无法读取服装图')}}render()};
document.addEventListener('paste',e=>{if(document.body.classList.contains('studio')&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){const f=[...e.clipboardData.files].filter(f=>/^image/.test(f.type));if(f.length)addPersons(f)}});
$('#studio').addEventListener('click',e=>{const t=e.target;let b;
 if(b=t.closest('[data-rm]')){const i=+b.dataset.i;b.dataset.rm=='pose'?W.poses.splice(i,1):W.garments.splice(i,1);render()}
 if(b=t.closest('[data-rmp]')){W.persons.splice(+b.dataset.rmp,1);render()}
 if(b=t.closest('[data-pick]'))picker(b.dataset.pick);
 if(b=t.closest('[data-pl]')){W.pl=b.dataset.pl;SV('wbPl',W.pl);reprompt(true);render()}
 if(b=t.closest('[data-mode]')){W.mode=b.dataset.mode;SV('wbMode',W.mode);W.dirty=false;render()}
 if(b=t.closest('[data-char]')){W.char=b.dataset.char;SV('wbChar',W.char);render()}
 if(b=t.closest('[data-style]')){if(W.busy)return;W.style=b.dataset.style;SV('wbStyle',W.style);render();$(`#wbStyles [data-style="${W.style}"]`).focus({preventScroll:true})}
 if(b=t.closest('[data-bm]')){W.bm=b.dataset.bm;SV('wbBm',W.bm);render()}});
$('#studio').addEventListener('change',e=>{const s=e.target.closest('[data-ang]');if(s){W.poses[+s.dataset.ang].ai=+s.value;render()}if(e.target.id=='wbN')render();if(e.target.id=='wbKeepBg'){W.keepBg=e.target.checked;SV('wbKeepBg',W.keepBg);render()}});
for(const [id,key] of [['wbAR','ar'],['wbResolution','tier'],['wbQuality','quality']])$('#'+id).addEventListener('change',e=>{outputPrefs[key]=e.target.value;SV(id,e.target.value);render()});
$('#wbCharTxt').oninput=e=>{W.charTxt=e.target.value;SV('wbCharTxt',W.charTxt);reprompt()};
$('#wbAllAng').onclick=()=>{const p=W.poses[0],it=A.ITEMS[p.k];W.poses=it.angles.slice(0,6).map((a,i)=>({kind:'lib',k:p.k,ai:i}));toast(`已展开 ${W.poses.length} 个角度`);render()};
$('#wbPrompt').oninput=()=>{W.dirty=true;renderStyleHelp()};$('#wbExtra').oninput=()=>reprompt();$('#wbReP').onclick=()=>{reprompt(true);toast('已按当前选择重新生成提示词')};
$('#wbCopyP').onclick=()=>A.copy($('#wbPrompt').value,'提示词');
// ---------- 选择器 ----------
let pkType='costume';async function picker(t){pkType=t;$('#pkT').textContent=t=='pose'?'选择姿势（可多选，最多 6 个）':t=='portrait'?'选择人像（作为人物 / 脸部参考）':'选择服装';$('#pkDone').hidden=t!='pose';$('#pk').hidden=false;document.body.style.overflow='hidden';$('#pkQ').value='';$('#pkG').innerHTML='<div class="skel"></div>'.repeat(12);await A.load(t);drawPk();setTimeout(()=>$('#pkQ').focus(),50)}
function drawPk(){const q=$('#pkQ').value.toLowerCase().trim().split(/\s+/).filter(Boolean),L=A.DATA[pkType].filter(A.ok).filter(it=>q.every(w=>(it._s||[it.id,it.zh,it.en,it.cat,it.line||''].join(' ').toLowerCase()).includes(w))).slice(0,150),sel=new Set(W.poses.map(p=>p.k));
 $('#pkG').innerHTML=L.length?L.map(it=>`<button data-k="${it.k}" class="${pkType} ${sel.has(it.k)?'on':''}" title="${esc(A.title(it))}"><img loading="lazy" src="${A.thumb(it)}" alt="${esc(A.title(it))}"><span>${esc(A.title(it))}</span></button>`).join(''):'<p class="fine">没有匹配的结果</p>'}
let pq;$('#pkQ').oninput=()=>{clearTimeout(pq);pq=setTimeout(drawPk,150)};const pkClose=()=>{$('#pk').hidden=true;document.body.style.overflow='';render()};$('#pkX').onclick=pkClose;$('#pkDone').onclick=pkClose;
$('#pk').onclick=e=>{if(e.target.id=='pk')return pkClose();const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;
 if(pkType=='pose'){const i=W.poses.findIndex(p=>p.k==k);if(i>=0)W.poses.splice(i,1);else if(W.poses.length>=6)return toast('最多选择 6 个姿势');else W.poses.push({kind:'lib',k,ai:A.ITEMS[k].ai});b.classList.toggle('on',i<0);$('#pkT').textContent=`选姿势（${W.poses.length}/6）`}
 else if(pkType=='portrait'){pkClose();addPortrait(A.ITEMS[k])}
 else{W.garments=[{kind:'lib',k}];pkClose()}};
// ---------- 设置 ----------

// ---------- 减少误拦截：只改发送给服务商的措辞，不改服装、姿势 ----------
// [匹配, 替换]，按顺序执行；替换为空表示删掉
const NEUTRAL=[
 [/(?:胸部|臀部|腰臀|身材)(?:曲线|线条)?(?:突出|丰满|饱满|凸显)/g,''],[/凸显(?:身材|曲线|胸部|臀部)/g,''],[/火辣|撩人|诱惑|魅惑|勾人|性感/g,'时尚'],
 [/紧身/g,'修身'],[/露肩/g,'一字肩'],[/露背/g,'开背设计'],[/露脐/g,'短款'],[/低胸/g,'V 领'],[/透视/g,'薄纱拼接'],
 [/比基尼|泳装|泳衣/g,'泳池边时装'],[/情趣内衣|内衣/g,'内搭'],[/裸露|裸体|半裸/g,''],
 [/\b(?:emphasi[sz]ing|accentuating|showing off|highlighting) (?:her |his |the )?(?:curves|figure|body|bust|chest|hips|cleavage)\b/gi,''],
 [/\b(?:curvy|voluptuous|busty)\b/gi,''],[/\b(?:sexy|seductive|sultry|alluring|provocative|hot)\b/gi,'stylish'],
 [/\b(?:skin-?tight|bodycon)\b/gi,'fitted'],[/\btight\b/gi,'fitted'],[/\boff[- ]the[- ]shoulder\b/gi,'off-shoulder neckline'],[/\bbackless\b/gi,'open-back design'],
 [/\b(?:bikini|swimsuit|swimwear)\b/gi,'swimwear fashion catalog piece'],[/\b(?:lingerie|underwear|bra and panties)\b/gi,'loungewear catalog set'],
 [/\b(?:nude|naked|topless|cleavage|bust|busty)\b/gi,''],[/\bsee-?through\b/gi,'sheer-panel'],[/\blow-?cut\b/gi,'V-neck'],
];
const FRAME={en:'Professional e-commerce fashion try-on photo for a clothing catalog. The subject is an adult, fully clothed in exactly the reference garments (same design, color and cut, nothing added or removed), keeping the same identity, in a natural, relaxed, non-suggestive pose, in a tasteful studio or lifestyle setting.',
 zh:'服装电商的专业试穿照片，用于商品目录。人物是成年人，完整穿着参考图中的服装（款式、颜色、剪裁完全一致，不增不减），保持同一人的长相，姿势自然放松，场景为简洁的影棚或生活场景。'};
const neutralOn=()=>LS('wbNeutral')!==false;$('#wbNeutral').checked=neutralOn();$('#wbNeutral').onchange=e=>{SV('wbNeutral',e.target.checked);toast(e.target.checked?'已开启减少误拦截':'已关闭减少误拦截，将按原提示词发送')};
const isAdultJob=set=>[...W.garments,...(set||[])].some(g=>g.kind=='lib'&&A.ITEMS[g.k]&&A.ITEMS[g.k].a);
function neutralize(p){let t=p;for(const [a,b] of NEUTRAL)t=t.replace(a,b?'\x01'+b+'\x01':'\x02');
 t=t.replace(/\b(with|and|in)\s+\x02\s+(?:and|with)\b/gi,'$1').replace(/\x01\x02*\x01/g,'、').replace(/\x01\s+\x01/g,' ').replace(/[\x01]/g,'').replace(/\s*\x02\s*/g,' ')
  .replace(/(^|[，,、；;：:。.\n])\s*(?:and|with|,)?\s*(?=[，,、；;。.\n]|$)/g,'$1').replace(/([，、；])[，、；]+/g,'$1').replace(/([,;])\s*[,;]+/g,'$1').replace(/[ \t]{2,}/g,' ').replace(/\s+([,.;，。；、])/g,'$1').replace(/^[，,、]\s*|[，,、]\s*$/gm,'').replace(/[,，、]\s*([.。;；])/g,'$1');
 const zh=/[\u4e00-\u9fa5]/.test(t.slice(0,40))&&W.pl!='en';return FRAME[zh?'zh':'en']+'\n'+t}
// Discovery uses the settings draft, never the active generation configuration.
// Official contracts: OpenAI GET /v1/models; Gemini GET /v1beta/models
// (pageSize/nextPageToken); Ark GET /api/v3/models (modalities/domain).
// Model visibility does not guarantee quota, reference support, or every output setting.
let cfgProvider=cfg.prov,cfgDrafts={},modelExplicit=false,modelTimer,modelController,modelSerial=0;
const MANUAL_MODEL='__manual__';
function cancelModels(){clearTimeout(modelTimer);modelController?.abort();modelController=null;modelSerial++;$('#cfModelPicker').setAttribute('aria-busy','false');$('#cfRefresh').disabled=false;$('#cfTest').disabled=false}
function modelStatus(t,bad=false){$('#cfModelsStatus').textContent=t;$('#cfModelsStatus').className='fine'+(bad?' bad':'')}
function modelOptions(models,live=false){const s=$('#cfModelSelect'),input=$('#cfModel'),current=input.value.trim(),manual=s.value==MANUAL_MODEL&&modelExplicit;
 const ids=models.map(m=>m.id),preferred=(modelExplicit&&current)||ids.find(id=>id==PROV[cfgProvider].model)||ids[0]||current;
 const options=models.map(m=>`<option value="${esc(m.id)}">${esc(m.label||m.id)}</option>`).join('');
 s.innerHTML=`<optgroup label="${live?'接口返回的生图模型':'预设模型（未核验账户权限）'}">${options}</optgroup>`+(preferred&&!ids.includes(preferred)?`<optgroup label="当前配置（列表未确认）"><option value="${esc(preferred)}">${esc(preferred)}</option></optgroup>`:'')+`<option value="${MANUAL_MODEL}">手动填写其他模型 ID…</option>`;
 s.value=manual?MANUAL_MODEL:preferred||MANUAL_MODEL;if(!manual)input.value=preferred;$('#cfManualW').hidden=s.value!=MANUAL_MODEL;
}
function imageModel(m,c){if(!m||typeof m!='object')return null;const id=String(m.id||m.name||'').replace(/^models\//,'');if(!id||id==MANUAL_MODEL||id.length>200||/[\s<>]/.test(id)||/shutdown|deprecated|disabled/i.test(m.status||''))return null;
 const modalities=m.modalities?.output_modalities||m.outputModalities||m.output_modalities;
 if(Array.isArray(modalities)&&modalities.length&&!modalities.some(x=>/^image$/i.test(x)))return null;
 const gpt=/^(?:gpt-image-|chatgpt-image-)/i.test(id)||/^dall-e-2(?:$|-)/i.test(id),gem=/^gemini-.*(?:image|nano-banana)/i.test(id);
 let ok;if(c.prov=='gemini')ok=gem&&(!Array.isArray(m.supportedGenerationMethods)||m.supportedGenerationMethods.includes('generateContent'));
 else if(c.prov=='openai')ok=gpt;
 else if(c.prov=='seedream')ok=/^doubao-seedream-/i.test(id)||m.domain=='ImageGeneration';
 else ok=gpt||gem||/(?:^|[\/.-])(?:flux|qwen-image|seedream|stable-diffusion|sdxl|imagen)(?:$|[\/.-])/i.test(id)||m.domain=='ImageGeneration'||Array.isArray(modalities)&&modalities.some(x=>/^image$/i.test(x));
 return ok?{id,label:c.prov=='gemini'&&m.displayName?`${m.displayName} · ${id}`:id}:null;
}
async function listImageModels(c,signal){let token='',all=[],pages=new Set();
 do{if(pages.size>=10||pages.has(token))throw Error('模型列表分页未完成，请重试或手动填写模型 ID');pages.add(token);
  const url=new URL(root(c)+'/models');if(c.prov=='gemini'){url.searchParams.set('pageSize','1000');if(token)url.searchParams.set('pageToken',token)}
  const r=await call(url.toString(),{method:'GET',headers:auth(c),signal},c);if(!r.ok)throw Error(({401:'密钥无效或已过期，请检查 API Key',403:'没有模型列表权限，请检查密钥权限或账户地区',404:'此地址未提供模型列表接口，可使用预设或手动填写',429:'模型列表请求过于频繁，请稍后刷新'})[r.status]||`获取模型列表失败（HTTP ${r.status}），请稍后刷新`);
  const j=await r.json(),rows=c.prov=='gemini'?j.models:j.data;if(!Array.isArray(rows))throw Error('模型列表格式无法识别，可使用预设或手动填写');all.push(...rows);token=c.prov=='gemini'&&typeof j.nextPageToken=='string'?j.nextPageToken:'';
 }while(token);
 return [...new Map(all.map(m=>imageModel(m,c)).filter(Boolean).map(m=>[m.id,m])).values()].sort((a,b)=>a.id.localeCompare(b.id));
}
function resetModels(){cancelModels();modelOptions(PROV[cfgProvider].models.map(id=>({id})));modelStatus('填写 API Key 后自动获取生图模型；预设尚未核验账户权限。');$('#cfRefresh').disabled=!$('#cfKey').value.trim()||(cfgProvider=='custom'&&!$('#cfBase').value.trim())}
async function loadModels(test=false){cancelModels();const c=cfgRead(),serial=modelSerial;
 if(!c.key){modelStatus('填写 API Key 后自动获取生图模型。');if(test)msg('请先填写 API Key',1);return}
 if(c.prov=='custom'&&!c.base){modelStatus('填写 Base URL 和 API Key 后自动获取生图模型。');if(test)msg('请填写 Base URL',1);return}
 try{const u=new URL(root(c));if(u.protocol!='https:'||u.username||u.password)throw 0}catch(e){modelStatus('请填写有效的 HTTPS Base URL。',true);return}
 const controller=new AbortController();modelController=controller;let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},15000);
 $('#cfModelPicker').setAttribute('aria-busy','true');$('#cfRefresh').disabled=true;$('#cfTest').disabled=true;modelStatus('正在获取生图模型…');if(test)msg('正在连接并获取模型列表…');
 try{const models=await listImageModels(c,controller.signal);if(serial!=modelSerial)return;modelOptions(models,true);const current=$('#cfModel').value,listed=models.some(m=>m.id==current);
  const text=models.length?`已获取 ${models.length} 个适配当前接口的生图模型。${listed?'':'当前模型未在列表中，已保留原配置。'}列表可见不代表已开通额度或支持所有出图参数。`:'接口未返回适配当前接口的生图模型；可检查模型权限，或手动填写模型 ID。';modelStatus(text,!models.length);if(test)msg('连接成功。'+text);
 }catch(e){if(serial!=modelSerial)return;const t=timedOut?'获取模型列表超时，请刷新重试；也可使用预设或手动填写。':e.name=='AbortError'?'已取消获取模型列表。':e instanceof TypeError?'无法获取模型列表。请检查网络，或开启「通过本站代理转发」后重试。':e instanceof SyntaxError?'模型列表不是有效 JSON，可使用预设或手动填写。':e.message;modelStatus(t,true);if(test)msg(t,1)}
 finally{clearTimeout(timer);if(serial==modelSerial){modelController=null;$('#cfModelPicker').setAttribute('aria-busy','false');$('#cfRefresh').disabled=false;$('#cfTest').disabled=false}}
}
function scheduleModels(){resetModels();modelTimer=setTimeout(()=>loadModels(),700)}
function cfgFill(o=cfg,explicit=!!o.model){cancelModels();cfgProvider=o.prov;modelExplicit=explicit;$$('[name=prov]').forEach(r=>r.checked=r.value==o.prov);const P=PROV[o.prov];$('#cfBase').value=o.base;$('#cfBase').placeholder=P.base||'https://你的中转地址/v1';$('#cfKey').value=o.key;$('#cfKey').placeholder=o.prov=='gemini'?'AIza…':'sk-… / 方舟 API Key';
 $('#cfModelSelect').innerHTML='';$('#cfModel').value=o.model;$('#cfModel').placeholder=P.model;$('#cfField').value=o.field;$('#cfProto').value=o.proto;$('#cfProtoW').hidden=o.prov!='custom';$('#cfFieldW').hidden=!(o.prov=='custom'&&o.proto=='edits');$('#cfProxy').checked=o.proxy;$('#cfHelp').innerHTML=({openai:'在 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI 控制台</a> 创建密钥，并为生图模型开通相应权限。',gemini:'在 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a> 获取 API Key；仅列出支持当前生图接口的 Gemini 模型。',seedream:'在 <a href="https://console.volcengine.com/ark" target="_blank" rel="noopener">火山方舟控制台</a> 开通 Seedream 模型并创建 API Key；自动走本站代理获取模型列表。',custom:'填写中转商提供的 Base URL（通常以 /v1 结尾）与密钥。自动获取列表；未列出的别名可手动填写。'})[o.prov]||'';$('#cfMsg').textContent='';$('#cfMsg').className='fine';resetModels();if(!$('#cfg').hidden)loadModels()}
function cfgRead(){return{prov:($('[name=prov]:checked')||{}).value||'openai',base:$('#cfBase').value.trim(),key:$('#cfKey').value.trim(),model:$('#cfModel').value.trim(),field:$('#cfField').value,proto:$('#cfProto').value,proxy:$('#cfProxy').checked}}
const cfgOpen=()=>{if(W.busy)return toast('生成完成或取消后可修改 API 设置');cfgDrafts={};cfgFill();$('#cfg').hidden=false;document.body.style.overflow='hidden';loadModels()},cfgClose=()=>{cancelModels();cfgDrafts={};$('#cfg').hidden=true;document.body.style.overflow=''};
$('#wbCfg').onclick=cfgOpen;$('#wbCfg2').onclick=cfgOpen;$('#wbOnbGo').onclick=cfgOpen;$('#cfgX').onclick=cfgClose;$('#cfg').addEventListener('click',e=>{if(e.target.id=='cfg')cfgClose()});
$$('[name=prov]').forEach(r=>r.onchange=()=>{cfgDrafts[cfgProvider]={...cfgRead(),prov:cfgProvider,explicit:modelExplicit};const o=cfgDrafts[r.value]||{prov:r.value,base:'',key:'',model:'',field:'image[]',proto:'edits',proxy:r.value=='seedream'};cfgFill(o,o.explicit??!!o.model)});
$('#cfProto').onchange=()=>{$('#cfFieldW').hidden=$('#cfProto').value!='edits';scheduleModels()};
for(const id of ['cfBase','cfKey'])$('#'+id).addEventListener('input',scheduleModels);$('#cfProxy').onchange=scheduleModels;
$('#cfModelSelect').onchange=()=>{modelExplicit=true;const value=$('#cfModelSelect').value;$('#cfManualW').hidden=value!=MANUAL_MODEL;if(value!=MANUAL_MODEL)$('#cfModel').value=value;else $('#cfModel').focus()};$('#cfModel').oninput=()=>modelExplicit=true;
$('#cfRefresh').onclick=()=>loadModels();
$('#cfEye').onclick=()=>{const k=$('#cfKey');k.type=k.type=='password'?'text':'password';$('#cfEye').textContent=k.type=='password'?'显示':'隐藏'};
$('#cfSave').onclick=()=>{const o=cfgRead();if(o.prov=='custom'&&!o.base)return msg('自定义中转需要填写 Base URL',1);if(!o.model){msg('请选择生图模型或手动填写模型 ID',1);$('#cfModelSelect').focus();return}Object.assign(cfg,o);SV('wbCfg',cfg);render();cfgClose();toast('API 设置已保存在本机')};
$('#cfClr').onclick=()=>{cfg.key='';$('#cfKey').value='';for(const d of Object.values(cfgDrafts))d.key='';SV('wbCfg',cfg);resetModels();render();msg('已从本机清除密钥')};
function msg(t,bad){const m=$('#cfMsg');m.textContent=t;m.className='fine '+(bad?'bad':'good')}
$('#cfTest').onclick=()=>loadModels(true);
// ---------- 请求 ----------
function auth(c=cfg){return c.prov=='gemini'?{'x-goog-api-key':c.key}:{Authorization:'Bearer '+c.key}}
const p2=n=>String(n).padStart(2,'0'),stamp=d=>`${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
const OFF=/^(api\.openai\.com|generativelanguage\.googleapis\.com|ark\.[a-z0-9-]+\.(volces|bytepluses)\.com)$/;
function call(url,o,c=cfg){let hn='';try{hn=new URL(url).hostname}catch(e){}const cu=c.prov=='custom'||!OFF.test(hn);if(!c.proxy&&!cu)return fetch(url,o);const h=new Headers(o.headers||{});h.set('x-target-url',url);if(cu)h.set('x-proxy-custom','1');return fetch('/api/proxy',Object.assign({},o,{headers:h}))}
async function fetchResult(url){let r=await fetch(url).catch(()=>null);if(!r||!r.ok)r=await fetch('/api/proxy',{headers:{'x-target-url':url,'x-proxy-kind':'image'}}).catch(()=>null);if(r&&r.ok)return r.blob();const e=Error('');e.zh='结果图片无法在浏览器中下载，请直接打开：'+url;throw e}

const SAFE_RE=/safety system|safety_violations|moderation_blocked|content_policy_violation|content policy|SensitiveContent|sensitive content|PROHIBITED_CONTENT|IMAGE_SAFETY|\bSAFETY\b|BLOCKLIST|SPII|blocked by|内容安全|敏感/i;
const CAT=[[/minor|child|CSAM/i,'涉及未成年人'],[/sexual|SEXUALLY_EXPLICIT|nudity|porn|色情/i,'性感/暴露内容'],[/violen|gore|血腥|暴力/i,'暴力或血腥'],[/self-?harm/i,'自残'],[/hate|HATE_SPEECH/i,'仇恨'],[/harass/i,'骚扰'],[/illicit|DANGEROUS/i,'危险或违法内容'],[/SPII|personal/i,'个人隐私信息'],[/copyright|RECITATION|trademark/i,'版权内容']];
function safeErr(raw,j,rid){const t=String(raw||'')+' '+JSON.stringify(j||'');if(!SAFE_RE.test(t))return null;const e=Error(String(raw||'safety'));const c=CAT.filter(x=>x[0].test(t)).map(x=>x[1]);
 e.safe={cats:[...new Set(c)],where:/InputImage|input image/i.test(t)?'in':/OutputImage|output/i.test(t)?'out':'',rid:rid||(t.match(/req_[A-Za-z0-9]+/)||[])[0]||''};
 let r=String(raw||'').trim();if(cfg.key)r=r.split(cfg.key).join('***');e.raw=r||t.slice(0,600);e.zh='被服务商的安全审核拦下了';return e}
async function apiErr(r,j){if(j===undefined)j=await r.json().catch(()=>null);const raw=(j&&(j.error&&(j.error.message||j.error.status||j.error)||j.message))||r.statusText||'';{const se=safeErr(typeof raw=='string'?raw:JSON.stringify(raw),j,(j&&j.error&&j.error.request_id)||r.headers.get('x-request-id'));if(se){se.status=r.status;return se}}
 const m={400:'请求参数有误：常见原因是模型不支持参考图、画幅尺寸不对或图片格式不支持，可换个模型或画幅再试',401:'密钥无效或已过期，请检查 API Key',403:'没有权限：密钥无此模型权限、账户未验证，或所在地区不受支持',404:'地址或模型不存在：请检查 Base URL 和模型名',413:'图片太大，请换一张更小的照片',429:'请求过于频繁或额度已用完，请稍后再试或检查账户余额',500:'服务商内部错误，请稍后重试',502:'网关错误（中转服务不可用）',503:'服务暂时不可用，请稍后重试',504:'服务商响应超时，请重试'}[r.status]||('请求失败（HTTP '+r.status+'）');
 let t=String(typeof raw=='string'?raw:JSON.stringify(raw));if(cfg.key)t=t.split(cfg.key).join('***');const bad=/API_KEY_INVALID|API key not valid|invalid api key|Incorrect API key|AuthenticationError|InvalidApiKey/i.test(t+' '+JSON.stringify(j||''));const e=Error(t);e.status=r.status;e.zh=(bad?'密钥无效或已过期，请检查 API Key':m)+(t?`\n服务商返回：${t.slice(0,300)}`:'');return e}
function nice(e){if(e.name=='AbortError')return'已取消';if(e instanceof TypeError)return'无法连接到服务商：网络不通，或该地址不允许浏览器跨域访问（CORS）。\n可在 API 设置中开启「通过本站代理转发」。';return e.zh||e.message||String(e)}
const toB=async d=>(await fetch('data:'+(/^\/9j\//.test(d)?'image/jpeg':/^UklGR/.test(d)?'image/webp':'image/png')+';base64,'+d)).blob();
async function openaiData(j){const d=j&&j.data&&j.data[0];if(!d){const e=Error('');e.zh='服务商没有返回图片数据'+(j&&j.error?'：'+(j.error.message||''):'');throw e}return d.b64_json?toB(d.b64_json):fetchResult(d.url)}
const outputParamError=e=>/\b(size|quality|resolution|dimensions|input_fidelity)\b|尺寸|分辨率|质量/i.test(e.message);
const referenceError=e=>[400,422].includes(e.status)&&/image|参考/i.test(e.message)&&!outputParamError(e)&&!e.safe;
async function genOnce(imgs,prompt,sig,output){if(output.error)throw Error(output.error);const {ar,size,quality,imageSize}=output,m=modelOf(),P=proto();let warn='';
 if(P=='gemini'){const parts=[{text:prompt}];for(const b of imgs)parts.push({inline_data:{mime_type:b.type||'image/jpeg',data:await b64(b)}});const gc={responseModalities:['TEXT','IMAGE']},ic={};if(ar!='auto')ic.aspectRatio=ar;if(imageSize)ic.imageSize=imageSize;if(Object.keys(ic).length)gc.imageConfig=ic;
  const r=await call(`${root()}/models/${encodeURIComponent(m)}:generateContent`,{method:'POST',signal:sig,headers:Object.assign({'Content-Type':'application/json'},auth()),body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:gc})});
  const j=await r.json().catch(()=>null);if(!r.ok)throw await apiErr(r,j);const c=j&&j.candidates&&j.candidates[0],ps=((j&&j.candidates)||[]).flatMap(c=>(c.content&&c.content.parts)||[]),im=ps.find(p=>(p.inlineData||p.inline_data||{}).data);
  if(!im){const why=(j&&j.promptFeedback&&j.promptFeedback.blockReason)||(c&&c.finishReason);{const rs=(c&&c.safetyRatings||[]).filter(x=>x.blocked||/HIGH|MEDIUM/.test(x.probability||'')).map(x=>x.category).join(' ');const se=why&&/SAFETY|PROHIBITED|BLOCKLIST|SPII|OTHER/i.test(why)?safeErr(why+' '+rs+' '+((c&&c.finishMessage)||''),null,j&&j.responseId):null;if(se)throw se}const t=ps.map(p=>p.text).filter(Boolean).join(' ');const e=Error(t);e.zh='模型没有返回图片'+(why?`（${why}，可能触发了安全策略）`:'')+(t?'\n模型回复：'+t.slice(0,300):'');throw e}
  const d=im.inlineData||im.inline_data;return{blob:await(await fetch(`data:${d.mimeType||d.mime_type||'image/png'};base64,${d.data}`)).blob()}}
 const json=async(withImgs,extra)=>{const body=Object.assign({model:m,prompt,n:1},extra);if(withImgs&&imgs.length)body.image=await Promise.all(imgs.map(dataURL));
  const r=await call(`${root()}/images/generations`,{method:'POST',signal:sig,headers:Object.assign({'Content-Type':'application/json'},auth()),body:JSON.stringify(body)});const j=await r.json().catch(()=>null);if(!r.ok)throw await apiErr(r,j);return openaiData(j)};
 if(P=='seedream'){const ex={response_format:'b64_json',watermark:false,sequential_image_generation:'disabled'};if(size)ex.size=size;try{return{blob:await json(true,ex)}}catch(e){if(referenceError(e)){warn='该模型没有接收参考图，结果只按文字生成，人物与服装可能对不齐。';return{blob:await json(false,ex),warn}}throw e}}
 const ex={size};if(quality)ex.quality=quality;
 if(P=='json'||!imgs.length)return{blob:await json(!!imgs.length,ex)};
 const edits=async field=>{const fd=new FormData();fd.append('model',m);fd.append('prompt',prompt);const one=/^dall-e-2$/.test(m);(one?imgs.slice(0,1):imgs).forEach((b,i)=>fd.append(field,b,`ref-${i+1}.jpg`));fd.append('n','1');fd.append('size',size);if(quality)fd.append('quality',quality);
  const r=await call(`${root()}/images/edits`,{method:'POST',signal:sig,headers:auth(),body:fd});const j=await r.json().catch(()=>null);if(!r.ok)throw await apiErr(r,j);return openaiData(j)};
 const f0=cfg.prov=='custom'?cfg.field:'image[]';
 try{return{blob:await edits(f0)}}catch(e){if(e.name=='AbortError'||e.safe||outputParamError(e))throw e;
  if(referenceError(e)&&!/safety|moderation|reject/i.test(e.message)){try{return{blob:await edits(f0=='image[]'?'image':'image[]'),warn:'已自动改用另一种图片字段名重试成功。'}}catch(x){throw x}}
  if([404,405,415,501].includes(e.status)||/edits|no such|invalid url/i.test(e.message)){try{return{blob:await json(true,ex),warn:'该接口不支持 images/edits，已自动改用 images/generations（JSON 多图）。'}}catch(x){if(!referenceError(x))throw x;return{blob:await json(false,ex),warn:'该接口不支持参考图，结果只按文字生成，人物与服装可能对不齐。'}}}
  throw e}}
// ---------- 进度 ----------
let T0,tick,PR=0,done=0,total=1;function stage(t){$('#wbStage1').textContent=t}
function busy(on){$('#wbBusy').hidden=!on;$('#wbGo').classList.toggle('run',on);if(on)$('#wbGo').innerHTML='<i class="ring"></i>生成中…';$('#wbGo').disabled=on;$('#wbAgain').disabled=on;$$('#wbStyles [data-style]').forEach(b=>b.disabled=on);renderOutput();clearInterval(tick);if(on){T0=Date.now();PR=.03;tick=setInterval(()=>{const s=(Date.now()-T0)/1e3,cap=(done+.95)/total;PR=Math.max(done/total,Math.min(cap,PR+(cap-PR)*.03));$('#wbProg').style.transform=`scaleX(${PR})`;$('#wbTime').textContent=`${Math.round(s)} 秒`+(total>1?` · 已完成 ${done} / ${total}`:'');},250)}else render()}
async function run(){if(W.busy)return;if(!cfg.key){toast('请先配置你的 API');return cfgOpen()}if(!isGen()&&!hasPerson())return toast('请先上传人物照片');if(!W.garments.length)return toast('请先选择服装');const output=outputChoice();if(output.error){errBox(Error(output.error));return $('#'+output.invalidField).focus()}
 const ac=new AbortController();W.busy=ac;$('#wbErr').hidden=true;$('#wbWarn').hidden=true;
 const n=+$('#wbN').value||1,sets=W.poses.length>1&&W.bm=='each'?W.poses.map(p=>[p]):[W.poses];const jobs=[];sets.forEach(s=>{for(let i=0;i<n;i++)jobs.push(s)});
 done=0;total=jobs.length;busy(true);stage('正在准备素材…');const errs=[],warns=new Set(),got=[];
 try{const pb=W.persons.map(p=>p.blob),gb=await Promise.all(W.garments.map(assetBlob)),cache=new Map();const poseB=async p=>{const key=p.k+':'+p.ai;if(!cache.has(key))cache.set(key,assetBlob(p));return cache.get(key)};
  const custom=W.dirty?$('#wbPrompt').value.trim():null;stage(total>1?`模型正在绘制… 共 ${total} 张`:'模型正在绘制…');
  let q=0;const worker=async()=>{while(q<jobs.length&&!ac.signal.aborted){const set=jobs[q++];try{const imgs=[...pb,...gb,...await Promise.all(set.map(poseB))];const prompt0=custom&&sets.length==1?custom:compose(set),soft=neutralOn()&&!isAdultJob(set),prompt=soft?neutralize(prompt0):prompt0;W.lastSent=prompt;
    const jc=new AbortController(),onA=()=>jc.abort();ac.signal.addEventListener('abort',onA);let tmo=false;const tm=setTimeout(()=>{tmo=true;jc.abort()},window.__TMO||180000);let r;try{r=await genOnce(imgs,prompt,jc.signal,output)}catch(x){x.sent=prompt;if(tmo&&!ac.signal.aborted){const y=Error('timeout');y.zh='等了 3 分钟还没有返回。服务商可能正忙，稍后点「重试」。';throw y}throw x}finally{clearTimeout(tm);ac.signal.removeEventListener('abort',onA)}if(r.warn)warns.add(r.warn);const dimensions=await measureResult(r.blob).catch(()=>({}));const rec={t:Date.now()+Math.random(),prov:cfg.prov,model:modelOf(),prompt,orig:soft?prompt0:null,neutral:soft,mode:W.mode,label:set.map(p=>poseDesc(p,false).split('（')[0]).join(' / ')||'',before:pb[0]||null,after:r.blob,output:{...output},...dimensions};got.push(rec);await save(rec);W.results=got.slice();show(got.length-1)}
   catch(e){if(e.name=='AbortError')throw e;errs.push(e)}finally{done++}}};
  await Promise.all(Array.from({length:Math.min(2,jobs.length)},worker));
  if(got.length){toast(got.length>1?`完成 ${got.length} 张`:'生成完成');hist()}if(errs.length){const e=errs.find(x=>x.safe)||errs[0];errBox(e,got.length?`${errs.length} 张生成失败`:'')}
  if(warns.size){$('#wbWarn').hidden=false;$('#wbWarn').textContent=[...warns].join(' ')}}
 catch(e){if(e.name=='AbortError'){toast('已取消生成');if(got.length)hist()}else errBox(e)}
 finally{W.busy=null;busy(false)}}
function errBox(e,head){const el=$('#wbErr');el.hidden=false;el.classList.toggle('safe',!!e.safe);
 if(e.safe){const S=e.safe,c=S.cats.length?`，原因是<b>${S.cats.join('、')}</b>`:'';const w=S.where=='in'?'上传的照片或服装图':S.where=='out'?'生成出来的图片':'这次请求';
  el.innerHTML=`<b>${head?head+' · ':''}被服务商的安全审核拦下了</b><p>${(PROV[cfg.prov]||{}).name||'服务商'} 判断${w}不合规${c}。真人照片配上比较暴露的服装（泳装、内衣、露背等）很容易被拦，OpenAI 审核最严，Gemini 和豆包 Seedream 相对宽松一些。</p><p class="fine">可以换一家服务商，或换一套遮挡多一点的服装。原样重试大多还会被拦。</p><div class="row"><button class="sm" data-ef="prov">换服务商重试</button><button class="sm ghost" data-ef="cos">换一套服装</button><button class="sm ghost" id="wbRetry">重试</button></div>${neutralOn()?'':'<div class="row"><button class="sm" data-ef="neutral">打开减少误拦截后重试</button></div>'}<details class="raw"><summary>查看原始信息</summary><pre>${esc(e.raw+(S.rid&&!e.raw.includes(S.rid)?'\nrequest id: '+S.rid:'')+(e.sent?'\n\n实际发送的提示词'+(neutralOn()?'（已开启减少误拦截）':'')+'：\n'+e.sent:''))}</pre><button class="sm ghost" data-ef="copy">复制</button></details>`;return}
 el.innerHTML=`<b>${head||'生成失败'}</b><p>${esc(nice(e)).replace(/\n/g,'<br>')}</p><div class="row"><button class="sm" id="wbRetry">重试</button><button class="sm ghost" data-open-cfg>检查 API 设置</button></div>`}
$('#wbStage').addEventListener('click',e=>{const f=e.target.closest('[data-ef]');if(f){const k=f.dataset.ef;if(k=='prov'){cfgOpen();const p=$('#cfg .prov');p.scrollIntoView({block:'start'});p.classList.remove('hl');void p.offsetWidth;p.classList.add('hl');const o=$('[name=prov]:not(:checked)');o&&o.focus()}if(k=='cos')picker('costume');if(k=='neutral'){SV('wbNeutral',true);$('#wbNeutral').checked=true;run()}if(k=='copy')A.copy?A.copy(f.previousElementSibling.textContent):navigator.clipboard.writeText(f.previousElementSibling.textContent).then(()=>toast('已复制'));return}if(e.target.id=='wbRetry')run();if(e.target.closest('[data-open-cfg]'))cfgOpen()});
$('#wbGo').onclick=run;$('#wbAgain').onclick=run;$('#wbStop').onclick=()=>W.busy&&W.busy.abort();
// ---------- 结果 ----------
let urls=[];const ru=new Map();const U=b=>{if(!ru.has(b))ru.set(b,URL.createObjectURL(b));return ru.get(b)};
async function measureResult(blob){if(typeof createImageBitmap=='function'){const im=await createImageBitmap(blob);try{return{width:im.width,height:im.height}}finally{im.close()}}const u=URL.createObjectURL(blob);try{const im=await loadImg(u);return{width:im.naturalWidth,height:im.naturalHeight}}finally{URL.revokeObjectURL(u)}}
function showDimensions(r){const el=$('#wbDimensions'),o=r.output,actual=r.width&&r.height?`${r.width}x${r.height}`:null,mismatch=!!(actual&&o&&o.expectedSize&&!o.estimated&&actual!=o.expectedSize);el.hidden=false;el.classList.toggle('mismatch',mismatch);
 const requested=o?(o.kind=='gemini'?`${o.imageSize?o.imageSize+' · ':''}${o.ar=='auto'?'自动画幅':o.ar}${o.expectedSize?'（文档参考 '+prettySize(o.expectedSize)+'）':''}`:prettySize(o.size=='auto'?null:o.size)):null;
 el.textContent=[`实际返回：${actual?prettySize(actual)+' px':'尺寸未读取'}`,requested?'请求：'+requested:'历史记录未保存请求尺寸',o&&o.quality?'质量：'+o.quality:'',mismatch?'尺寸与请求不符，请核对服务商支持情况。':'', '下载保留服务商原文件，本站未缩放。'].filter(Boolean).join(' · ')}
function show(i,meta){const r=W.results[i];if(!r)return;{let d=$('#wbSentD');if(!d){d=document.createElement('details');d.id='wbSentD';d.className='raw sent';$('#wbOutAct').after(d)}d.hidden=!r.prompt;d.innerHTML=r.prompt?`<summary>查看原始信息${r.neutral?' · 已减少误拦截':''}</summary><pre>${esc((r.orig?'原提示词：\n'+r.orig+'\n\n实际发送：\n':'实际发送：\n')+r.prompt)}</pre>`:''}W.ri=i;const a=U(r.after),hasB=!!r.before;$('#wbAfter').src=a;if(hasB)$('#wbBefore').src=U(r.before);$('#wbCmp').hidden=false;$('#wbCmp').classList.toggle('solo',!hasB||!W.cmp);$('#wbCmpT').hidden=!hasB;$('#wbCmpT').textContent=W.cmp?'关闭对比':'前后对比';
 showDimensions(r);if(!r.width||!r.height)measureResult(r.after).then(d=>{Object.assign(r,d);if(W.results[W.ri]===r)showDimensions(r)}).catch(()=>{});
 $('#wbPh0').hidden=true;$('#wbErr').hidden=true;$('#wbOutAct').hidden=false;setX(50);$('#wbZip').hidden=W.results.length<2;if(!matchMedia('(prefers-reduced-motion: reduce)').matches){$('#wbAfter').animate([{opacity:0,transform:'scale(1.03)',filter:'blur(8px)'},{opacity:1,transform:'none',filter:'none'}],{duration:620,easing:'cubic-bezier(.16,1,.3,1)'});if(hasB&&W.cmp&&!W._wig){W._wig=1;const t0=performance.now();const f=t=>{const p=(t-t0)/1400;if(p>=1)return setX(50);setX(50+Math.sin(p*Math.PI*2)*12*(1-p));requestAnimationFrame(f)};setTimeout(()=>requestAnimationFrame(f),500)}}$('#wbMeta').textContent=meta||((PROV[r.prov]||{name:r.prov}).name+' · '+r.model+(r.label?' · '+r.label:''));
 const R=$('#wbRes');R.hidden=W.results.length<2;R.innerHTML=W.results.map((x,j)=>`<button data-ri="${j}" class="${j==i?'on':''}"><img src="${U(x.after)}" alt="结果 ${j+1}"></button>`).join('')}
$('#wbRes').onclick=e=>{const b=e.target.closest('[data-ri]');b&&show(+b.dataset.ri)};$('#wbCmpT').onclick=()=>{W.cmp=!W.cmp;show(W.ri)};
const resultExt=r=>({'image/jpeg':'jpg','image/webp':'webp','image/png':'png'}[r.after.type]||'png');
function downloadResult(r){if(!r)return;const l=document.createElement('a');l.href=U(r.after);l.download=`posewear-${r.mode=='gen'?'gen':'tryon'}-${stamp(new Date(r.t))}-${String(W.results.indexOf(r)+1||1).padStart(2,'0')}.${resultExt(r)}`;l.click()}
let previewRecord,previewTrigger,previewOverflow,previewGesture;
const preview=$('#wbPreview'),previewImage=$('#wbPreviewImg'),previewView=$('#wbPreviewView');
function previewMeta(){if(!previewRecord)return;const w=previewRecord.width||previewImage.naturalWidth,h=previewRecord.height||previewImage.naturalHeight;$('#wbPreviewMeta').textContent=(w&&h?`原图 ${w}×${h} px · `:'')+previewRecord.model+' · 可切换原始大小查看细节'}
function openPreview(trigger){const r=W.results[W.ri];if(!r||preview.open)return;previewRecord=r;previewTrigger=trigger||$('#wbPreviewOpen');previewOverflow=document.body.style.overflow;previewView.classList.remove('native');$('#wbPreviewZoom').textContent='原始大小';$('#wbPreviewZoom').setAttribute('aria-pressed','false');previewImage.src=U(r.after);previewMeta();preview.showModal();previewView.scrollTo(0,0);document.body.style.overflow='hidden'}
previewImage.onload=previewMeta;
$('#wbPreviewOpen').onclick=e=>openPreview(e.currentTarget);$('#wbPreviewX').onclick=()=>preview.close();$('#wbPreviewDl').onclick=()=>downloadResult(previewRecord);
$('#wbPreviewZoom').onclick=()=>{const native=previewView.classList.toggle('native');$('#wbPreviewZoom').textContent=native?'适合窗口':'原始大小';$('#wbPreviewZoom').setAttribute('aria-pressed',String(native));previewView.scrollTo(0,0)};
preview.addEventListener('close',()=>{document.body.style.overflow=previewOverflow||'';previewImage.removeAttribute('src');previewRecord=null;if(previewTrigger?.isConnected)previewTrigger.focus({preventScroll:true})});
preview.addEventListener('click',e=>{if(e.target!=preview)return;const r=preview.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)preview.close()});
$('#wbCmp').addEventListener('pointerdown',e=>{previewGesture={x:e.clientX,y:e.clientY,moved:false}});
$('#wbCmp').addEventListener('pointermove',e=>{if(previewGesture&&Math.hypot(e.clientX-previewGesture.x,e.clientY-previewGesture.y)>6)previewGesture.moved=true});
$('#wbCmp').addEventListener('click',()=>{if(!previewGesture?.moved)openPreview($('#wbAfter'));previewGesture=null});
$('#wbAfter').addEventListener('keydown',e=>{if(e.key=='Enter'||e.key==' '){e.preventDefault();openPreview(e.currentTarget)}});
$('#wbZip').onclick=async()=>{if(!window.makeZip)return;const ts=stamp(new Date());const fs=W.results.map((r,i)=>({name:`posewear-${r.mode=='gen'?'gen':'tryon'}-${ts}-${String(i+1).padStart(2,'0')}.${resultExt(r)}`,blob:r.after}));window.X.dl(await makeZip(fs),`posewear-tryon-${ts}.zip`);toast(`已打包 ${fs.length} 张`)};
$('#cfExp').onclick=async()=>{const withKey=await window.PWAccess.choose('导出 API 设置','包含密钥的文件可被持有者用于调用你的模型服务，请仅保存在可信设备。');if(withKey===null)return;const o={...cfg};if(!withKey)delete o.key;window.X.dl(new Blob([JSON.stringify({app:'衣姿 PoseWear',type:'api-config',cfg:o},null,2)],{type:'application/json'}),'衣姿-API设置.json');msg('已导出设置'+(withKey?'（含密钥，请妥善保管）':'（不含密钥）'))};
$('#cfImp').onclick=()=>$('#cfImpF').click();$('#cfImpF').onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());const o=j.cfg||j;if(!o.prov)throw 0;Object.assign(cfg,o);SV('wbCfg',cfg);cfgFill();render();msg('已导入设置')}catch(err){msg('导入失败：文件格式不正确',1)}e.target.value=''};
$('#wbDl').onclick=()=>downloadResult(W.results[W.ri]);
$('#wbUse').onclick=async()=>{const r=W.results[W.ri];if(!r)return;const x=await toJpeg(U(r.after),1536);W.persons=[{blob:x.blob,url:URL.createObjectURL(x.blob),w:x.w,h:x.h}];W.mode='tryon';render();toast('已将结果设为新的人物照片')};
function setX(x){$('#wbCmp').style.setProperty('--x',x+'%');$('#wbRange').value=x}$('#wbRange').oninput=e=>setX(e.target.value);
// ---------- IndexedDB ----------
let dbp;const db=()=>dbp||(dbp=new Promise((r,j)=>{const q=indexedDB.open('lk-studio',1);q.onupgradeneeded=()=>q.result.createObjectStore('h',{keyPath:'t'});q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)}));
const tx=async(m,f)=>{const d=await db();return new Promise((r,j)=>{const t=d.transaction('h',m),s=t.objectStore('h'),q=f(s);t.oncomplete=()=>r(q&&q.result);t.onerror=()=>j(t.error)})};
async function save(rec){try{await tx('readwrite',s=>s.put(rec));const all=await tx('readonly',s=>s.getAllKeys());if(all.length>40)await tx('readwrite',s=>{all.slice(0,all.length-40).forEach(k=>s.delete(k))})}catch(e){}}
let hu=[];async function hist(){let L=[];try{L=(await tx('readonly',s=>s.getAll()))||[]}catch(e){}L.sort((a,b)=>b.t-a.t);hu.forEach(URL.revokeObjectURL);hu=[];
 $('#wbHist').innerHTML=L.length?L.map(r=>{const u=URL.createObjectURL(r.after);hu.push(u);return`<button data-t="${r.t}" title="${esc(new Date(r.t).toLocaleString('zh-CN')+(r.label?' · '+r.label:''))}"><img src="${u}" alt="历史结果"><span>${r.mode=='gen'?'生图':'试穿'} · ${esc(new Date(r.t).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}))}</span><i data-del="${r.t}" aria-label="删除">×</i></button>`}).join(''):'<p class="fine">还没有生成记录</p>';W.hist=L}
$('#wbHist').onclick=async e=>{const d=e.target.closest('[data-del]');if(d){e.stopPropagation();const rec=(W.hist||[]).find(x=>x.t==d.dataset.del);await tx('readwrite',s=>s.delete(+d.dataset.del));await hist();if(rec)toast('已删除 1 条记录',async()=>{await tx('readwrite',s=>s.put(rec));hist()});return}const b=e.target.closest('[data-t]');if(!b)return;const r=W.hist.find(x=>x.t==b.dataset.t);if(r){W.results=[r];show(0,(PROV[r.prov]||{name:r.prov}).name+' · '+r.model+' · '+new Date(r.t).toLocaleString('zh-CN'));$('#wbStage').scrollIntoView({behavior:'smooth',block:'nearest'})}};
$('#wbHClr').onclick=async()=>{const all=W.hist||[];if(!all.length)return toast('还没有生成记录');await tx('readwrite',s=>s.clear());await hist();toast(`已清空 ${all.length} 条记录`,async()=>{await tx('readwrite',s=>{all.forEach(r=>s.put(r))});hist()})};
// ---------- 对外 ----------
let inited=false;async function init(){if(inited)return;inited=true;const gk=[].concat(g0.g||[]),pk=(g0.p||[]).filter(x=>Array.isArray(x));const need=[gk.length&&'costume',pk.length&&'pose'].filter(Boolean);if(need.length)await Promise.all(need.map(A.load)).catch(()=>{});
 if(!W.garments.length)W.garments=gk.filter(k=>A.ok(A.ITEMS[k])).slice(0,1).map(k=>({kind:'lib',k}));if(!W.poses.length)W.poses=pk.filter(x=>A.ok(A.ITEMS[x[0]])).slice(0,6).map(x=>({kind:'lib',k:x[0],ai:x[1]??A.ITEMS[x[0]].ai}));hist()}
document.addEventListener('posewear-library-access-change',()=>{const allowed=item=>item.kind!=='lib'||A.ok(A.ITEMS[item.k]);const changed=[...W.garments,...W.poses].some(item=>!allowed(item));if(changed&&W.busy)W.busy.abort();W.garments=W.garments.filter(allowed);W.poses=W.poses.filter(allowed);if(!$('#pk').hidden)pkClose();if(inited)render()});
window.WB={async show(){await init();render()},async pick(it){if(!A.ok(it))return window.PWAccess.adultAsk(()=>WB.pick(it));await init();if(it.type=='pose'){if(!W.poses.some(p=>p.k==it.k)){if(W.poses.length>=6)W.poses.shift();W.poses.push({kind:'lib',k:it.k,ai:it.ai})}toast(`已加入姿势参考（${W.poses.length} 个）`)}else if(it.type=='portrait'){await addPortrait(it)}else{W.garments=[{kind:'lib',k:it.k}];toast('已选为试穿服装')}A.setTab('studio')},_W:W,_cfg:cfg};
if(document.body.classList.contains('studio'))WB.show();
if(location.hash=='#studio'){const t0=()=>scrollTo(0,0);requestAnimationFrame(t0);addEventListener('load',()=>setTimeout(t0,0),{once:true})}
addEventListener('keydown',e=>{if(document.querySelector('#accessDialog[open]'))return;if(e.key=='Escape'){if(!$('#pk').hidden)pkClose();else if(!$('#cfg').hidden)cfgClose()}});
})();
// v10：手机端把密钥引导卡放到第 1 步之前
(()=>{const mq=matchMedia('(max-width:760px)'),o=document.getElementById('wbOnb');if(!o)return;const place=()=>{if(mq.matches){const s1=document.querySelector('.st-l [data-s="1"]');s1&&s1.parentNode.insertBefore(o,s1)}else document.querySelector('.st-c').prepend(o)};place();mq.addEventListener('change',place)})();
