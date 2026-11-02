// No server traffic: every HTTP request is fulfilled from fixed local bytes or aborted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),engines=require('@playwright/test'),root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const origin='http://127.0.0.1:4173',publicUrl='https://chameleonjp.codeberg.page/hito_wo_yurusuna/',languages=['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'];
async function visible(page,selector){
 const e=page.locator(selector);assert.equal(await e.isVisible(),true);await e.scrollIntoViewIfNeeded();
 const a=await e.evaluate(el=>{
  const r=el.getBoundingClientRect(),epsilon=1;let opacity=1,unclipped=true;const ancestors=[];
  for(let n=el;n;n=n.parentElement){
   const style=getComputedStyle(n);opacity*=Number(style.opacity);
   if(n===el)continue;const p=n.getBoundingClientRect(),left=n===document.scrollingElement?0:p.left+n.clientLeft,top=n===document.scrollingElement?0:p.top+n.clientTop;ancestors.push({tag:n.tagName,id:n.id,overflowX:style.overflowX,overflowY:style.overflowY,left,top,w:n.clientWidth,h:n.clientHeight,scrollTop:n.scrollTop,scrolling:n===document.scrollingElement});
   if(/hidden|clip|scroll|auto/.test(style.overflowX))unclipped=unclipped&&r.left>=left-epsilon&&r.right<=left+n.clientWidth+epsilon;
   if(/hidden|clip|scroll|auto/.test(style.overflowY))unclipped=unclipped&&r.top>=top-epsilon&&r.bottom<=top+n.clientHeight+epsilon;
  }
  const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return{rect:{x:r.x,y:r.y,w:r.width,h:r.height},ancestors,w:r.width,h:r.height,opacity,unclipped,viewport:r.left>=-epsilon&&r.top>=-epsilon&&r.right<=innerWidth+epsilon&&r.bottom<=innerHeight+epsilon,hit:hit===el||el.contains(hit),pointer:getComputedStyle(el).pointerEvents};
 });
 if(!a.unclipped||!a.viewport){console.error('VISIBILITY_DIAGNOSTIC',JSON.stringify({selector,metrics:a}));fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'test-artifacts','visibility-failure.png'),fullPage:true});}
 assert.ok(a.w>=44&&a.h>=44,selector+' target');assert.ok(a.opacity>0);assert.ok(a.viewport,selector+' full rect inside viewport');assert.ok(a.unclipped,selector+' full rect inside overflow ancestors');assert.notEqual(a.pointer,'none');assert.equal(a.hit,true);
}
async function main(){
 const engine=process.env.BROWSER_ENGINE||'chromium';assert.ok(['chromium','webkit'].includes(engine));const browser=await engines[engine].launch({headless:true});let cases=0;
 try{for(const lang of languages){
 const context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),intents=[],errors=[];let scoreAttempts=0,unknownAttempts=0,webSocketAttempts=0;
 try{
 await context.routeWebSocket('**/*',s=>{webSocketAttempts++;s.close();});
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin===origin&&u.pathname==='/'&&['GET','HEAD'].includes(r.method()))return route.fulfill({contentType:'text/html; charset=utf-8',body:r.method()==='HEAD'?'':html});if(u.origin==='https://x.com'&&u.pathname==='/intent/post'&&r.method()==='GET'){intents.push(u.searchParams.get('text'));return route.fulfill({contentType:'text/html',body:'<title>Mock X composer</title>'});}if(u.hostname.endsWith('.supabase.co')&&u.pathname.endsWith('/get_best_score_ranking')&&r.method()==='POST')return route.fulfill({json:[]});if(/submit|record_game_play|start/.test(u.pathname))scoreAttempts++;else unknownAttempts++;return route.abort();});
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(lang=>{localStorage.setItem('hito_language_v1',lang);localStorage.setItem('hito_wo_yurusuna:audio:v1',JSON.stringify({enabled:false,volume:0}));},lang);await page.goto(origin+'/');assert.equal(await page.locator('html').getAttribute('lang'),lang);
 if(lang==='ja'){
 const home=page.locator('#btnShareHome');await home.evaluate(e=>e.style.display='none');await assert.rejects(()=>visible(page,'#btnShareHome'));await home.evaluate(e=>e.style.removeProperty('display'));await home.evaluate(e=>e.parentElement.style.opacity='0');await assert.rejects(()=>visible(page,'#btnShareHome'));await home.evaluate(e=>e.parentElement.style.removeProperty('opacity'));
 await home.evaluate(e=>{const w=document.createElement('div');w.style.cssText='overflow:hidden;height:'+(e.getBoundingClientRect().height-8)+'px';e.before(w);w.append(e)});await assert.rejects(()=>visible(page,'#btnShareHome'));await home.evaluate(e=>e.parentElement.replaceWith(e));await home.evaluate(e=>e.style.cssText='position:fixed;top:-8px;left:20px;width:180px;z-index:9999');await assert.rejects(()=>visible(page,'#btnShareHome'));await home.evaluate(e=>e.style.cssText='');await visible(page,'#btnShareHome');
 }
 for(const phase of ['home','result']){
 if(phase==='result'){await page.locator('#nameInput').fill('');await page.locator('#btnStart').click();
 if(lang==='ja'){
  // Actual touch flow and running browser clock, not the synthetic result fixture.
  await page.waitForFunction(()=>!document.getElementById('countOverlay').classList.contains('show'));
  const stage=page.locator('#stage');const cell=()=>page.evaluate(()=>({x:TILE/2,y:TILE/2}));
  await stage.tap({position:await cell()});await page.locator('[data-build="rapid"]').tap();await page.waitForTimeout(160);await stage.tap({position:await cell()});
  assert.equal(await page.evaluate(()=>game.towers.length),1);await page.locator('#btnSheetClose').click();
  await page.waitForFunction(()=>game.phase==='wave'&&game.spawnTimer>=3,{},{timeout:25000});
  assert.equal(await page.evaluate(()=>game.waveIndex),0);assert.equal(await page.evaluate(()=>game.receipt.eligible),false);
  fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});await stage.screenshot({path:path.join(root,'test-artifacts',`${engine}-actual-first-wave-canvas.png`)});
 }
 await page.evaluate(()=>{game.waveIndex=2;game.kills=5;endGame(false);showResult();});await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>resultPayload.receipt.eligible),false);}
 const selector=phase==='home'?'#btnShareHome':'#btnShareResult',screen=phase==='home'?'homeScreen':'resultScreen';
 const frozen=await page.evaluate(()=>JSON.stringify(resultPayload));
 for(const viewport of [{width:402,height:874},{width:874,height:402}]){
 await page.setViewportSize(viewport);await visible(page,selector);await visible(page,`#${screen} .common-ranking-link`);const action=page.locator(selector);assert.equal(await action.textContent(),await page.evaluate(()=>T.text('Xでシェア')));assert.deepEqual(await action.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,fg:getComputedStyle(e).color})),{bg:'rgb(0, 0, 0)',fg:'rgb(255, 255, 255)'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 const before=intents.length,opened=context.waitForEvent('page');await page.waitForFunction(()=>Date.now()-lastTouchEndAt>=360);await action.tap();const popup=await opened;await popup.waitForURL('https://x.com/intent/post**');assert.equal(intents.length,before+1);const expected=intents[before];assert.equal(new URL(popup.url()).searchParams.get('text'),expected);assert.deepEqual(expected.match(/#[\p{L}\p{N}_]+/gu),['#ヒトを許すな','#ゲーム制作']);assert.ok(expected.includes(publicUrl));if(phase==='result')assert.equal(expected,await page.evaluate(()=>detailedResultShareText()));else assert.equal(expected,await page.evaluate(()=>T.text('{p0}\nヒトを許さない動物たちが攻めてくる。武器を置いて、👨‍🌾を守れ。\n{p1}',{p0:GAME_TITLE,p1:PUBLIC_URL})+'\n'+SHARE_TAGS));await popup.close();
 await page.evaluate(()=>{window.__originalOpen=window.open;window.open=()=>null;});await page.waitForFunction(()=>Date.now()-lastTouchEndAt>=360);await action.tap();assert.equal(await page.locator('#commonShareFallback').isVisible(),true);assert.equal(await page.locator('#commonShareText').inputValue(),expected);await page.locator('#commonShareClose').click();await page.evaluate(()=>{window.open=window.__originalOpen;delete window.__originalOpen;});assert.equal(await page.locator('#commonShareCopy').isVisible(),false);assert.equal(intents.length,before+1);assert.equal(await page.evaluate(()=>JSON.stringify(resultPayload)),frozen);assert.equal(scoreAttempts,0);
 await visible(page,selector);fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'test-artifacts',`${engine}-${phase}-${lang}-${viewport.width}x${viewport.height}.png`),fullPage:true});cases++;
 }
 }
 assert.equal(scoreAttempts,0);assert.equal(unknownAttempts,0);assert.equal(webSocketAttempts,0);assert.deepEqual(errors,[]);
 }finally{await context.close();}
 }console.log(JSON.stringify({engine,cases,languages:15,orientations:2,phases:2,network:'mock-only',scoreAttempts:0}));}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
