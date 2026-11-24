// Real-browser request/response tests. All model calls are intercepted; no API key or credits needed.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'output/playwright/studio-resolution');
fs.mkdirSync(artifacts,{recursive:true});
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/mk1.png'));
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/me'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({user:null,permissions:[],adultAvailable:false,adultMode:false}));}
 if(/\/(poses|costumes|portraits)\.json$/.test(pathname)){res.setHeader('content-type','application/json');return res.end('[]');}
 const file=path.resolve(root,'src','.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(path.join(root,'src')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
 const errors=[],checks=[];
 const passed=name=>{checks.push(name);console.log('PASS '+name);};
 async function setup(prov='openai',model='gpt-image-2',options={}){
  const context=await browser.newContext({viewport:options.viewport||{width:1440,height:900},reducedMotion:'reduce',colorScheme:options.dark?'dark':'light',serviceWorkers:'block'});
  const page=await context.newPage(),state={hits:[],responses:[],image:fixture};
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/api\.openai\.com|generativelanguage\.googleapis\.com|\/api\/proxy/,async route=>{
   const request=route.request();
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
   if(request.method()==='GET')return route.fulfill({status:200,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:JSON.stringify({data:[{id:model}],models:[{name:'models/'+model,supportedGenerationMethods:['generateContent']}]})});
   let body;
   if((request.headers()['content-type']||'').includes('multipart/form-data')){
    const form=await new Response(request.postDataBuffer(),{headers:{'content-type':request.headers()['content-type']}}).formData();
    body=Object.fromEntries([...form].map(([k,v])=>[k,typeof v==='string'?v:'[file]']));
   }else body=request.postDataJSON();
   state.hits.push({url:request.headers()['x-target-url']||request.url(),body});
   const next=state.responses.shift();
   if(next?.delay)await new Promise(resolve=>setTimeout(resolve,next.delay));
   const gemini=/generateContent/.test(state.hits.at(-1).url);
   return route.fulfill({status:next?.status||200,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:JSON.stringify(next?.body||(gemini?{candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:state.image.toString('base64')}}]}}]}:{data:[{b64_json:state.image.toString('base64')}]}))}).catch(()=>{});
  });
  await page.addInitScript(({prov,model,options})=>{
   if(!sessionStorage.resolutionFixture){sessionStorage.resolutionFixture='1';localStorage.clear();localStorage.setItem('introX','1');localStorage.setItem('theme',options.dark?'dark':'light');if(options.style)localStorage.setItem('wbStyle',JSON.stringify(options.style));localStorage.setItem('wbCfg',JSON.stringify({prov,model,key:'fixture-only',base:prov==='custom'?'https://relay.example.test/v1':'',proto:options.proto||'edits',field:'image[]',proxy:prov==='seedream'}));}
  },{prov,model,options});
  await page.goto(url+'/#studio');await page.waitForFunction(()=>window.WB&&document.querySelector('#wbResolution').options.length);
  async function uploads(){await page.setInputFiles('#wbFile',path.join(__dirname,'fixtures/person.png'));await page.setInputFiles('#wbGFile',path.join(__dirname,'fixtures/mk1.png'));await page.waitForFunction(()=>WB._W.persons.length&&WB._W.garments.length);}
  await uploads();return{context,page,state,uploads};
 }
 const choose=async(page,ar,tier='standard',quality)=>{await page.selectOption('#wbAR',ar);await page.selectOption('#wbResolution',tier);if(quality)await page.selectOption('#wbQuality',quality);};
 const go=async page=>{await page.click('#wbGo');await page.waitForFunction(()=>!WB._W.busy);};
 const failure=(message,status=400)=>({status,body:{error:{message}}});
 const switchModel=async(page,model)=>{await page.click('#wbCfg');await page.selectOption('#cfModelSelect','__manual__');await page.fill('#cfModel',model);await page.click('#cfSave');};
 try{
  {
   const {context,page,state}=await setup();assert.equal(await page.getAttribute('[data-style=daily]','aria-pressed'),'true');assert.equal(await page.locator('#wbStylePrimary button').count(),6);assert.equal(await page.locator('#wbStyleMore').evaluate(e=>e.open),false);
   assert.match(await page.textContent('#wbStyleHelp'),/保留原背景时仅应用色调/);assert.ok(!(await page.inputValue('#wbPrompt')).includes('uncluttered cream or light-grey interior'));
   await page.locator('.adv > summary').click();await page.uncheck('#wbKeepBg');
   const scenes={daily:['window daylight','窗边自然光'],commute:['pale stone architecture','石材建筑'],street:['city corner','安静街角'],date:['cafe terrace','咖啡店露台'],campus:['bookshop exterior','书店外'],studio:['studio backdrop','影棚布景']};
   for(const [id,[en,zh]] of Object.entries(scenes)){
    await page.click('[data-style='+id+']');assert.equal(await page.evaluate(()=>document.activeElement.dataset.style),id);assert.equal(await page.locator('#wbStyles [aria-pressed=true]').count(),1);
    for(const lang of ['en','zh']){await page.click('[data-pl='+lang+']');const prompt=await page.inputValue('#wbPrompt');assert.ok(prompt.includes(lang==='en'?en:zh));assert.match(prompt,lang==='en'?/reference identity, outfit, accessories or body proportions/:/不改变参考人物身份、服装、配饰和身体比例/);assert.match(prompt,lang==='en'?/no soft focus/:/不柔焦/);await go(page);assert.equal(state.hits.at(-1).body.model,'gpt-image-2');assert.ok(state.hits.at(-1).body.prompt.includes(lang==='en'?en:zh));}
   }
   await page.click('[data-style=commute]');await page.click('[data-mode=gen]');assert.equal(await page.getAttribute('[data-style=commute]','aria-pressed'),'true');await page.click('[data-mode=tryon]');await page.reload();await page.waitForFunction(()=>window.WB);assert.equal(await page.getAttribute('[data-style=commute]','aria-pressed'),'true');
   passed('six outfit photography styles change actual bilingual requests, preserve identity/garments, respect retained backgrounds, keep keyboard focus and persist across modes/reload');await context.close();
  }
  {
   const {context,page,state}=await setup('openai','gpt-image-2',{style:'anime'});assert.equal(await page.locator('#wbStyleMore').evaluate(e=>e.open),true);assert.equal(await page.getAttribute('[data-style=anime]','aria-pressed'),'true');assert.match(await page.textContent('#wbStyleHelp'),/动漫插画/);
   await page.locator('.adv > summary').click();await page.fill('#wbPrompt','my manually edited outfit prompt');await page.click('[data-style=daily]');assert.equal(await page.inputValue('#wbPrompt'),'my manually edited outfit prompt');assert.match(await page.textContent('#wbStyleHelp'),/手动修改/);await page.click('#wbReP');assert.match(await page.inputValue('#wbPrompt'),/fresh true-to-life colors/);
   state.responses=[{delay:1000}];await page.click('#wbGo');await page.waitForFunction(()=>!!WB._W.busy);assert.equal(await page.locator('#wbStyles button:disabled').count(),10);await page.click('#wbStop');await page.waitForFunction(()=>!WB._W.busy);assert.equal(await page.locator('#wbStyles button:disabled').count(),0);
   passed('saved legacy styles remain selected; manual prompt edits are preserved with recovery guidance; style choices freeze during generation');await context.close();
  }
  {
   const {context,page,state,uploads}=await setup();
   assert.equal(await page.inputValue('#wbResolution'),'standard');assert.equal(await page.inputValue('#wbQuality'),'medium');
   assert.equal(await page.locator('#wbResolution option[value=hd]').isDisabled(),true);
   await choose(page,'3:4');await go(page);assert.equal(state.hits.at(-1).body.size,'960x1280');assert.equal(state.hits.at(-1).body.quality,'medium');
   passed('default standard + explicit medium quality; automatic aspect blocks fixed HD');
   // Verify every actual GPT Image 2 request, including its exact aspect ratio and documented limits.
   for(const ar of ['2:3','3:4','9:16','1:1','3:2','4:3','16:9'])for(const tier of ['standard','hd','ultra']){
    await choose(page,ar,tier,'high');await go(page);const b=state.hits.at(-1).body,[w,h]=b.size.split('x').map(Number),[x,y]=ar.split(':').map(Number);
    assert.equal(w*y,h*x);assert.equal(w%16,0);assert.equal(h%16,0);assert.ok(Math.max(w,h)<=3840&&w*h>=655360&&w*h<=8294400);assert.equal(b.quality,'high');assert.equal(b.input_fidelity,undefined);assert.equal(b.model,'gpt-image-2');
   }
   passed('all 21 GPT Image 2 aspect/tier requests preserve ratio and satisfy native size constraints');
   state.image=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1536;c.height=2048;c.getContext('2d').fillRect(0,0,c.width,c.height);return c.toDataURL('image/png').split(',')[1];}),'base64');
   await choose(page,'3:4','hd','high');await go(page);
   assert.equal(state.hits.at(-1).body.size,'1536x2048');assert.equal(state.hits.at(-1).body['image[]'],'[file]');
   assert.match(await page.textContent('#wbDimensions'),/实际返回：1536×2048 px.*请求：1536×2048.*质量：high/);
   assert.equal(await page.locator('#wbDimensions').evaluate(e=>e.classList.contains('mismatch')),false);
   await page.click('#wbPreviewOpen');await page.waitForFunction(()=>document.querySelector('#wbPreview').open&&document.querySelector('#wbPreviewImg').naturalWidth===1536);
   assert.equal(await page.getAttribute('#wbPreviewImg','src'),await page.getAttribute('#wbAfter','src'));assert.match(await page.textContent('#wbPreviewMeta'),/1536×2048/);
   await page.click('#wbPreviewZoom');assert.equal(await page.locator('#wbPreviewImg').evaluate(e=>e.getBoundingClientRect().width),1536);assert.equal(await page.getAttribute('#wbPreviewZoom','aria-pressed'),'true');
   const [previewDownload]=await Promise.all([page.waitForEvent('download'),page.click('#wbPreviewDl')]);assert.deepEqual(fs.readFileSync(await previewDownload.path()),state.image);
   await page.focus('#wbPreviewX');await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('#wbPreview').contains(document.activeElement)));await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#wbPreview').open);assert.equal(await page.evaluate(()=>document.activeElement.id),'wbPreviewOpen');
   await page.click('#wbCmpT');await page.click('#wbAfter');assert.equal(await page.locator('#wbPreview').evaluate(e=>e.open),true);await page.click('#wbPreviewX');
   await page.focus('#wbAfter');await page.keyboard.press('Enter');assert.equal(await page.locator('#wbPreview').evaluate(e=>e.open),true);await page.keyboard.press('Escape');
   await page.click('#wbPreviewOpen');await page.mouse.click(2,2);assert.equal(await page.locator('#wbPreview').evaluate(e=>e.open),false);
   await page.click('#wbCmpT');const range=await page.locator('#wbRange').boundingBox();await page.mouse.move(range.x+range.width*.3,range.y+range.height*.5);await page.mouse.down();await page.mouse.move(range.x+range.width*.7,range.y+range.height*.5,{steps:8});await page.mouse.up();assert.equal(await page.locator('#wbPreview').evaluate(e=>e.open),false);assert.ok(+await page.inputValue('#wbRange')>60);
   await page.click('#wbRange',{position:{x:range.width*.75,y:range.height*.5}});assert.equal(await page.locator('#wbPreview').evaluate(e=>e.open),true);await page.keyboard.press('Escape');
   passed('result preview uses original bytes, native-size scrolling, exact download, keyboard/Escape/focus return and preserves comparison dragging');
   const [download]=await Promise.all([page.waitForEvent('download'),page.click('#wbDl')]);assert.deepEqual(fs.readFileSync(await download.path()),state.image);
   await page.selectOption('#wbN','2');await go(page);assert.equal(await page.locator('#wbRes button').count(),2);
   const [zip]=await Promise.all([page.waitForEvent('download'),page.click('#wbZip')]);const zipBytes=fs.readFileSync(await zip.path());
   let entries=0,offset=0;while(zipBytes.readUInt32LE(offset)===0x04034b50){assert.equal(zipBytes.readUInt16LE(offset+8),0);const size=zipBytes.readUInt32LE(offset+18),nameLen=zipBytes.readUInt16LE(offset+26),extraLen=zipBytes.readUInt16LE(offset+28),start=offset+30+nameLen+extraLen;assert.deepEqual(zipBytes.subarray(start,start+size),state.image);offset=start+size;entries++;}assert.equal(entries,2);
   state.image=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1536;c.height=2048;return c.toDataURL('image/jpeg').split(',')[1];}),'base64');
   await page.selectOption('#wbN','1');await go(page);const [jpeg]=await Promise.all([page.waitForEvent('download'),page.click('#wbDl')]);assert.match(jpeg.suggestedFilename(),/\.jpg$/);assert.deepEqual(fs.readFileSync(await jpeg.path()),state.image);
   passed('decoded return dimensions, exact request display, PNG/JPEG and ZIP downloads preserve original bytes');
   await page.reload();await page.waitForFunction(()=>window.WB&&document.querySelector('#wbHist button'));
   assert.equal(await page.inputValue('#wbAR'),'3:4');assert.equal(await page.inputValue('#wbResolution'),'hd');assert.equal(await page.inputValue('#wbQuality'),'high');
   await page.locator('#wbHist [data-t]').first().click();assert.match(await page.textContent('#wbDimensions'),/1536×2048/);await uploads();await page.selectOption('#wbN','1');
   await page.click('#wbPreviewOpen');assert.match(await page.textContent('#wbPreviewMeta'),/1536×2048/);await page.keyboard.press('Escape');
   state.image=fixture;await go(page);assert.match(await page.textContent('#wbDimensions'),/尺寸与请求不符/);
   passed('aspect, tier, quality and history metadata persist; smaller returned images are explicitly flagged');
   await page.screenshot({path:path.join(artifacts,'desktop.png')});
   await switchModel(page,'gpt-image-1');assert.equal(await page.inputValue('#wbResolution'),'hd');assert.equal(await page.locator('#wbGo').isDisabled(),true);assert.match(await page.textContent('#wbOutputHelp'),/不支持/);
   await choose(page,'2:3','standard','low');await go(page);assert.equal(state.hits.at(-1).body.size,'1024x1536');assert.equal(state.hits.at(-1).body.quality,'low');
   await switchModel(page,'dall-e-2');assert.equal(await page.locator('#wbGo').isDisabled(),true);await choose(page,'1:1');await go(page);assert.equal(state.hits.at(-1).body.quality,undefined);
   passed('unsupported model/aspect/tier blocks generation without silently downgrading; legacy quality is model specific');
   await context.close();
  }
  for(const model of ['gpt-image-2.6-sunburst','gpt-image-2.6-flare','gpt-image-2.5-sunburst','gpt-image-2.5-flare'])for(const adapter of [{prov:'openai'},{prov:'custom',proto:'edits'},{prov:'custom',proto:'json'}]){
   const {context,page,state}=await setup(adapter.prov,model,adapter);
   assert.equal(await page.inputValue('#wbAR'),'auto');assert.equal(await page.locator('#wbGo').isEnabled(),true);await go(page);
   assert.equal(state.hits.at(-1).body.model,model);assert.equal(state.hits.at(-1).body.size,'auto');assert.equal(state.hits.at(-1).body.quality,'medium');
   for(const quality of ['xhigh','max','auto']){await choose(page,'3:4','ultra',quality);await go(page);const body=state.hits.at(-1).body;assert.equal(body.model,model);assert.equal(body.size,'1920x2560');assert.equal(body.quality,quality);assert.equal(body.input_fidelity,undefined);}
   if(model==='gpt-image-2.6-sunburst'){
    await page.selectOption('#wbQuality','max');await page.reload();await page.waitForFunction(()=>window.WB&&document.querySelector('#wbResolution').options.length);
    assert.equal(await page.inputValue('#wbQuality'),'max');await switchModel(page,'gpt-image-2');
    assert.equal(await page.inputValue('#wbQuality'),'max');assert.equal(await page.locator('#wbQuality option[value=max]').isDisabled(),true);assert.equal(await page.locator('#wbGo').isDisabled(),true);assert.equal(await page.getAttribute('#wbQuality','aria-invalid'),'true');assert.equal(await page.getAttribute('#wbResolution','aria-invalid'),'false');assert.match(await page.textContent('#wbOutputHelp'),/不支持已选的渲染质量/);
   }
   passed(model+' '+adapter.prov+'/'+(adapter.proto||'edits')+' supports automatic/native sizes and model-specific quality without silent substitution');await context.close();
  }
  {
   const {context,page,state}=await setup('custom','gpt-image-2.6-sunburst');await choose(page,'3:4','hd','xhigh');state.responses=[failure('edits route not found',404)];await go(page);
   assert.equal(state.hits.length,2);assert.ok(state.hits.every(h=>h.body.model==='gpt-image-2.6-sunburst'&&h.body.size==='1536x2048'&&h.body.quality==='xhigh'&&h.body.input_fidelity===undefined));
   passed('Sunburst edits-to-JSON fallback preserves the chosen model, native size and xhigh quality');await context.close();
  }
  {
   const {context,page,state}=await setup('custom','gpt-image-2');await choose(page,'3:4','ultra','high');
   state.responses=[failure('Missing image field')];await go(page);assert.equal(state.hits.length,2);assert.equal(state.hits[1].body.image,'[file]');
   assert.ok(state.hits.every(h=>h.body.size==='1920x2560'&&h.body.quality==='high'));
   state.hits=[];state.responses=[failure('edits route not found',404)];await go(page);assert.equal(state.hits.length,2);assert.ok(Array.isArray(state.hits[1].body.image));
   assert.ok(state.hits.every(h=>h.body.size==='1920x2560'&&h.body.quality==='high'));
   state.hits=[];state.responses=[failure('edits route not found',404),failure('Unknown image argument')];await go(page);assert.equal(state.hits.length,3);assert.equal(state.hits[2].body.image,undefined);
   assert.ok(state.hits.every(h=>h.body.size==='1920x2560'&&h.body.quality==='high'));assert.match(await page.textContent('#wbWarn'),/只按文字/);
   passed('alternate multipart field and both JSON compatibility fallbacks retain native size + quality');
   for(const responses of [[failure('Unsupported size')],[failure('Unsupported quality')],[failure('edits route not found',404),failure('Unsupported quality')],[failure('edits route not found',404),failure('Invalid API key',401)],[failure('Missing image field'),failure('safety system rejected image')]]){
    state.hits=[];state.responses=responses.slice();await go(page);assert.equal(state.hits.length,responses.length);assert.equal(await page.locator('#wbErr').isVisible(),true);
   }
   passed('size, quality, authentication and safety errors stop retries and preserve selected settings');
   state.responses=[{delay:1000}];state.hits=[];await page.click('#wbGo');await page.waitForFunction(()=>!!WB._W.busy);
   assert.equal(await page.locator('#wbResolution').isDisabled(),true);assert.equal(await page.locator('#wbAR').isDisabled(),true);assert.equal(await page.locator('#wbQuality').isDisabled(),true);assert.equal(await page.locator('#wbAgain').isDisabled(),true);
   await page.click('#wbCfg');assert.equal(await page.locator('#cfg').isVisible(),false);await page.click('#wbStop');await page.waitForFunction(()=>!WB._W.busy);assert.equal(await page.locator('#wbResolution').isDisabled(),false);
   passed('in-flight settings stay fixed; cancel restores controls and prevents duplicate generation');
   await context.close();
  }
  {
   const {context,page,state}=await setup('custom','gpt-image-2',{proto:'json'});await choose(page,'3:4','ultra','high');await go(page);
   assert.match(state.hits[0].url,/images\/generations$/);assert.equal(state.hits[0].body.size,'1920x2560');assert.equal(state.hits[0].body.quality,'high');assert.equal(state.hits[0].body.input_fidelity,undefined);
   await switchModel(page,'qwen-image-edit');assert.equal(await page.locator('#wbGo').isDisabled(),true);await choose(page,'1:1');await go(page);assert.equal(state.hits.at(-1).body.quality,undefined);assert.match(await page.textContent('#wbOutputHelp'),/未知兼容模型/);
   passed('custom JSON protocol passes GPT Image 2 settings; unknown compatible models expose conservative capabilities');await context.close();
  }
  for(const model of ['gemini-2.5-flash-image','gemini-3-pro-image-preview','gemini-3.1-flash-image']){
   const {context,page,state}=await setup('gemini',model);await choose(page,'3:4',model.includes('2.5')?'standard':'hd');await go(page);
   const body=state.hits[0].body;assert.equal(body.generationConfig.imageConfig.aspectRatio,'3:4');assert.equal(body.generationConfig.imageConfig.imageSize,model.includes('2.5')?undefined:'2K');assert.equal(body.size,undefined);assert.equal(body.quality,undefined);assert.equal(await page.locator('#wbQuality').isDisabled(),true);
   if(!model.includes('2.5')){await choose(page,'9:16','ultra');await go(page);assert.equal(state.hits.at(-1).body.generationConfig.imageConfig.imageSize,'4K');}
   passed(model+' uses only supported Gemini imageConfig fields');await context.close();
  }
  for(const model of ['doubao-seedream-4-0-250828','doubao-seedream-4-5-251128','doubao-seedream-5-0-flash-260915']){
   const {context,page,state}=await setup('seedream',model);if(model.includes('-4-'))await choose(page,'3:4','hd');await go(page);
   const body=state.hits[0].body;assert.equal(body.size,model.includes('-4-')?'3072x4096':undefined);assert.equal(body.quality,undefined);assert.equal(body.imageSize,undefined);
   passed(model+' uses Seedream size without OpenAI quality; unconfirmed models use provider defaults');await context.close();
  }
  {
   const {context,page}=await setup('openai','gpt-image-2',{viewport:{width:390,height:844},dark:true});await choose(page,'3:4','ultra','high');
   await page.locator('#wbStyles').scrollIntoViewIfNeeded();assert.equal(await page.locator('#wbStylePrimary').evaluate(e=>e.scrollWidth<=e.clientWidth),true);await page.screenshot({path:path.join(artifacts,'outfit-styles-mobile-dark.png')});
   await page.locator('#wbResolution').focus();await page.keyboard.press('ArrowUp');assert.equal(await page.inputValue('#wbResolution'),'hd');
   await page.locator('#wbResolution').scrollIntoViewIfNeeded();await page.locator('#wbResolution').click();await page.screenshot({path:path.join(artifacts,'mobile-select-dark.png')});await page.keyboard.press('Escape');await page.keyboard.press('Tab');assert.equal(await page.locator('#wbQuality').evaluate(e=>e===document.activeElement),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await go(page);await page.locator('#wbDimensions').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(artifacts,'mobile-result-dark.png')});
   await page.click('#wbPreviewOpen');await page.waitForFunction(()=>document.querySelector('#wbPreviewImg').naturalWidth>0);assert.ok(await page.locator('#wbPreview').evaluate(e=>e.scrollWidth<=innerWidth));
   await page.click('#wbPreviewZoom');assert.equal(await page.locator('#wbPreviewImg').evaluate(e=>e.getBoundingClientRect().width===e.naturalWidth),true);await page.screenshot({path:path.join(artifacts,'mobile-preview-dark.png')});await page.click('#wbPreviewX');
   // Legacy IndexedDB records lack output metadata; dimensions must still come from the actual blob.
   await page.evaluate(()=>{delete WB._W.results[0].width;delete WB._W.results[0].height;delete WB._W.results[0].output;document.querySelector('#wbCmpT').click();});
   await page.waitForFunction(()=>document.querySelector('#wbDimensions').textContent.includes('实际返回：')&&!document.querySelector('#wbDimensions').textContent.includes('尺寸未读取'));
   assert.match(await page.textContent('#wbDimensions'),/历史记录未保存请求尺寸/);
   passed('native select keyboard, narrow dark layout, reduced motion and legacy history dimensions');await context.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify({checks,errors},null,2));console.log(`PASS ${checks.length} checks; zero browser errors; all model requests mocked`);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
