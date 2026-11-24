// Real settings UI with mocked discovery endpoints; no real credentials or paid generations.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'output/playwright/studio-models');
fs.mkdirSync(artifacts,{recursive:true});
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/me'){res.setHeader('content-type','application/json');return res.end('{"user":null,"permissions":[],"adultAvailable":false,"adultMode":false}');}
 if(/\/(poses|costumes|portraits)\.json$/.test(pathname)){res.setHeader('content-type','application/json');return res.end('[]');}
 const file=path.resolve(root,'src','.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(path.join(root,'src')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
const models=ids=>({data:ids.map(id=>({id}))});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH}),url='http://127.0.0.1:'+server.address().port,checks=[],errors=[];
 const passed=name=>{checks.push(name);console.log('PASS '+name);};
 async function setup(config={},options={}){
  const context=await browser.newContext({viewport:options.mobile?{width:390,height:844}:{width:1280,height:900},colorScheme:options.mobile?'dark':'light',reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
  const state={hits:[],reply:()=>({body:models(['gpt-image-2','gpt-image-2.6-sunburst','gpt-4.1','gpt-image-2'])})};
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/api\.openai\.com|generativelanguage\.googleapis\.com|ark\.cn-beijing\.volces\.com|\/api\/proxy/,async route=>{
   const req=route.request();if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
   const hit={url:req.headers()['x-target-url']||req.url(),headers:req.headers(),method:req.method()};state.hits.push(hit);
   const response=await state.reply(hit,state.hits.length);if(response.delay)await new Promise(resolve=>setTimeout(resolve,response.delay));
   if(response.network)return route.abort().catch(()=>{});
   return route.fulfill({status:response.status||200,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:response.raw??JSON.stringify(response.body)}).catch(()=>{});
  });
  const saved={prov:'openai',base:'',key:'fixture-openai',model:'gpt-image-2',field:'image[]',proto:'edits',proxy:false,...config};
  await page.addInitScript(({saved,dark})=>{if(!sessionStorage.modelFixture){sessionStorage.modelFixture='1';localStorage.clear();localStorage.setItem('introX','1');localStorage.setItem('theme',dark?'dark':'light');localStorage.setItem('wbCfg',JSON.stringify(saved));}},{saved,dark:!!options.mobile});
  await page.goto(url+'/#studio');await page.waitForFunction(()=>window.WB);return{context,page,state,saved};
 }
 const open=async page=>{await page.click(await page.locator('#wbCfg').isVisible()?'#wbCfg':'#wbCfg2');await page.waitForFunction(()=>document.querySelector('#cfModelPicker').getAttribute('aria-busy')==='false');};
 const done=page=>page.waitForFunction(()=>document.querySelector('#cfModelPicker').getAttribute('aria-busy')==='false'&&!document.querySelector('#cfModelsStatus').textContent.includes('正在'));
 const ids=page=>page.locator('#cfModelSelect optgroup').first().locator('option').evaluateAll(xs=>xs.map(x=>x.value));
 const manual=async(page,id)=>{await page.selectOption('#cfModelSelect','__manual__');await page.fill('#cfModel',id);};
 try{
  {
   const {context,page,state}=await setup();await open(page);
   assert.deepEqual(await ids(page),['gpt-image-2','gpt-image-2.6-sunburst']);assert.equal(state.hits.length,1);assert.equal(state.hits[0].url,'https://api.openai.com/v1/models');assert.equal(state.hits[0].headers.authorization,'Bearer fixture-openai');
   await page.selectOption('#cfModelSelect','gpt-image-2.6-sunburst');await page.click('#cfSave');assert.match(await page.textContent('#wbProv'),/sunburst/);assert.equal(await page.inputValue('#wbQuality'),'medium');
   await page.reload();await page.waitForFunction(()=>window.WB);await open(page);assert.equal(await page.inputValue('#cfModelSelect'),'gpt-image-2.6-sunburst');
   passed('OpenAI automatically loads, filters/deduplicates image models; dropdown updates capabilities and persists');await context.close();
  }
  {
   const {context,page,state}=await setup();await open(page);await page.check('[name=prov][value=gemini]');assert.equal(await page.inputValue('#cfKey'),'');await page.waitForTimeout(800);assert.equal(state.hits.length,1);
   assert.equal(await page.evaluate(()=>WB._cfg.prov),'openai');await page.check('[name=prov][value=openai]');await done(page);assert.equal(await page.inputValue('#cfKey'),'fixture-openai');
   await page.selectOption('#cfModelSelect','gpt-image-2.6-sunburst');await page.click('#cfgX');assert.equal(await page.evaluate(()=>WB._cfg.model),'gpt-image-2');await open(page);assert.equal(await page.inputValue('#cfModelSelect'),'gpt-image-2');
   passed('supplier switch isolates credentials, restores in-dialog drafts, and cancel leaves active/saved configuration unchanged');await context.close();
  }
  {
   const {context,page,state}=await setup({prov:'gemini',key:'fixture-gemini',model:''});state.reply=h=>({body:new URL(h.url).searchParams.has('pageToken')?{models:[{name:'models/gemini-nano-banana-2.1',displayName:'Nano Banana 2.1',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3-pro-image',supportedGenerationMethods:['generateContent']}]}:{models:[{name:'models/gemini-2.5-flash-image',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3-flash',supportedGenerationMethods:['generateContent']},{name:'models/imagen-4.0-generate-001',supportedGenerationMethods:['predict']},{name:'models/gemini-fake-image',supportedGenerationMethods:['embedContent']}],nextPageToken:'token with / + ?'}});
   await open(page);assert.equal(state.hits.length,2);assert.equal(new URL(state.hits[1].url).searchParams.get('pageToken'),'token with / + ?');assert.ok(state.hits.every(h=>h.headers['x-goog-api-key']==='fixture-gemini'&&!h.url.includes('fixture-gemini')));assert.deepEqual(await ids(page),['gemini-2.5-flash-image','gemini-3-pro-image','gemini-nano-banana-2.1']);
   passed('Gemini follows pagination and header authentication; excludes text, embeddings and incompatible Imagen endpoints');await context.close();
  }
  {
   const {context,page,state}=await setup({prov:'seedream',model:'',key:'fixture-ark',proxy:true});state.reply=()=>({body:{data:[{id:'doubao-seedream-4-0-250828',domain:'ImageGeneration',modalities:{output_modalities:['image']}},{id:'doubao-seedream-4-5-251128',domain:'ImageGeneration'},{id:'doubao-vision',domain:'VLM',modalities:{input_modalities:['image'],output_modalities:['text']}},{id:'doubao-seedream-disabled',status:'Shutdown'},{id:'new-image-model',domain:'ImageGeneration'}]}});
   await open(page);assert.equal(state.hits[0].url,'https://ark.cn-beijing.volces.com/api/v3/models');assert.equal(state.hits[0].headers.authorization,'Bearer fixture-ark');assert.ok(await page.locator('#cfProxy').isChecked());assert.deepEqual(await ids(page),['doubao-seedream-4-0-250828','doubao-seedream-4-5-251128','new-image-model']);
   passed('Ark uses Bearer API key via proxy and filters image outputs/domain, rejecting input-only vision and shutdown models');await context.close();
  }
  {
   const {context,page,state}=await setup({prov:'custom',base:'https://relay.example.test/v1',model:'private-alias'});state.reply=()=>({body:{data:[{id:'gpt-image-2.6-sunburst'},{id:'qwen-image-edit'},{id:'flux-kontext-pro'},{id:'vision-only',modalities:{output_modalities:['text']}},{id:'new-renderer',modalities:{output_modalities:['image']}},{id:'<script>bad</script>'}]}});
   await open(page);assert.equal(state.hits[0].headers['x-proxy-custom'],'1');assert.match(await page.textContent('#cfModelsStatus'),/已保留原配置/);assert.equal(await page.inputValue('#cfModelSelect'),'private-alias');assert.deepEqual(await ids(page),['flux-kontext-pro','gpt-image-2.6-sunburst','new-renderer','qwen-image-edit']);
   await manual(page,'private-other');await page.click('#cfSave');assert.equal(await page.evaluate(()=>WB._cfg.model),'private-other');
   passed('compatible relays discover image families/metadata through proxy and retain unlisted private aliases with manual recovery');await context.close();
  }
  {
   const {context,page,state}=await setup();state.reply=()=>({delay:1400,body:models(['gpt-image-2.6-sunburst'])});await page.click('#wbCfg');await page.waitForFunction(()=>document.querySelector('#cfModelPicker').getAttribute('aria-busy')==='true');
   await page.check('[name=prov][value=gemini]');state.reply=()=>({body:{models:[{name:'models/gemini-2.5-flash-image',supportedGenerationMethods:['generateContent']}]}});await page.fill('#cfKey','fixture-gemini');await page.waitForTimeout(1900);await done(page);
   assert.deepEqual(await ids(page),['gemini-2.5-flash-image']);assert.equal(await page.inputValue('#cfModelSelect'),'gemini-2.5-flash-image');assert.equal(state.hits.at(-1).headers.authorization,undefined);
   passed('stale responses cannot overwrite another supplier; interrupted requests never reuse previous supplier credentials');await context.close();
  }
  {
   const {context,page,state}=await setup({key:''});await open(page);assert.equal(state.hits.length,0);await page.fill('#cfKey','partial');await page.fill('#cfKey','fixture-final');await page.waitForTimeout(900);await done(page);assert.equal(state.hits.length,1);assert.equal(state.hits[0].headers.authorization,'Bearer fixture-final');
   await page.click('#cfClr');assert.equal(await page.inputValue('#cfKey'),'');assert.match(await page.textContent('#cfModelsStatus'),/填写 API Key/);
   passed('key entry is debounced, empty keys do not request, and clear resets live-list provenance');await context.close();
  }
  {
   const {context,page,state}=await setup();for(const response of [{status:401,body:{error:{message:'fixture-openai'}}},{status:403,body:{}},{status:404,body:{}},{status:429,body:{}},{status:500,body:{}},{raw:'<html>bad</html>'},{body:{unexpected:[]}},{network:true}]){
    state.reply=()=>response;if(await page.locator('#cfg').isHidden())await open(page);else{await page.click('#cfRefresh');await done(page)}assert.equal(await page.locator('#cfModelsStatus').evaluate(e=>e.classList.contains('bad')),true);assert.ok(!(await page.textContent('#cfModelsStatus')).includes('fixture-openai'));assert.equal(await page.locator('#cfRefresh').isEnabled(),true);
   }
   await manual(page,'working-private-model');await page.click('#cfSave');assert.equal(await page.evaluate(()=>WB._cfg.model),'working-private-model');
   passed('auth, permissions, unsupported endpoint, rate limit, server, malformed and network failures remain recoverable without leaking keys');await context.close();
  }
  {
   const {context,page,state}=await setup();state.reply=()=>({body:{data:[{id:'gpt-4.1'}]}});await open(page);assert.match(await page.textContent('#cfModelsStatus'),/未返回/);assert.equal(await page.inputValue('#cfModelSelect'),'gpt-image-2');
   state.reply=()=>({body:models(['gpt-image-2.6-sunburst'])});await page.click('#cfTest');await done(page);assert.match(await page.textContent('#cfMsg'),/连接成功/);assert.equal(await page.inputValue('#cfModelSelect'),'gpt-image-2');
   passed('empty image lists and connection tests preserve a saved model and report visibility rather than generation availability');await context.close();
  }
  {
   const {context,page,state}=await setup();state.reply=()=>({delay:1100,body:models(['gpt-image-2'])});await page.click('#wbCfg');await manual(page,'manual-during-load');await done(page);assert.equal(await page.inputValue('#cfModelSelect'),'__manual__');assert.equal(await page.inputValue('#cfModel'),'manual-during-load');
   await page.click('#cfRefresh');await page.click('#cfgX');await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>WB._cfg.model),'gpt-image-2');assert.equal(await page.locator('#cfg').isHidden(),true);
   passed('discovery does not overwrite manual editing; closing aborts work without saving');await context.close();
  }
  {
   const {context,page,state}=await setup({prov:'gemini',model:'gemini-2.5-flash-image'});state.reply=()=>({body:{models:[],nextPageToken:'loop'}});await open(page);assert.match(await page.textContent('#cfModelsStatus'),/分页未完成/);assert.equal(state.hits.length,2);
   passed('repeated pagination tokens fail safely instead of presenting a partial model list');await context.close();
  }
  {
   const {context,page,state}=await setup();state.reply=()=>({delay:16000,body:models(['gpt-image-2'])});await page.click('#wbCfg');await page.waitForFunction(()=>document.querySelector('#cfModelsStatus').textContent.includes('超时'),null,{timeout:18000});assert.equal(await page.locator('#cfRefresh').isEnabled(),true);
   passed('model discovery times out with a usable refresh and manual fallback');await context.close();
  }
  {
   const {context,page}=await setup({}, {mobile:true});await open(page);await page.locator('#cfModelSelect').scrollIntoViewIfNeeded();await page.focus('#cfModelSelect');await page.keyboard.press('End');await page.keyboard.press('Enter');assert.equal(await page.locator('#cfManualW').isVisible(),true);
   assert.ok(await page.locator('.cfg-box').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert.ok(await page.locator('.cfg-f').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:path.join(artifacts,'mobile-dark.png')});
   passed('native model dropdown supports keyboard and narrow dark settings without horizontal overflow');await context.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify({checks,errors},null,2));console.log(`PASS ${checks.length} checks; zero browser errors; discovery requests mocked`);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
