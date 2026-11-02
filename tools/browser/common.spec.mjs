import fs from 'node:fs';
import {test,expect} from '@playwright/test';
const safeHtml=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
test.beforeEach(async({context})=>{
 await context.routeWebSocket('**/*',socket=>socket.close());
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin==='http://127.0.0.1:4173'&&u.pathname==='/'&&['GET','HEAD'].includes(r.method()))return route.fulfill({contentType:'text/html; charset=utf-8',body:r.method()==='HEAD'?'':safeHtml});return route.abort();});
});
const languages=['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'];
async function prepare(page,lang='ja'){
 await page.addInitScript(lang=>localStorage.setItem('hito_language_v1',lang),lang);
 await page.route('**/rest/v1/rpc/**',async route=>{const name=route.request().url().split('/').pop();await route.fulfill({contentType:'application/json',body:JSON.stringify(name==='submit_score_once_shared_v1'?[{accepted:true,result_normalized_name:route.request().postDataJSON().p_display_name,result_display_name:route.request().postDataJSON().p_display_name,result_first_score:route.request().postDataJSON().p_score,result_best_score:route.request().postDataJSON().p_score,result_play_count:1,is_first_play:true,is_new_best:true,was_duplicate:false}]:Array.from({length:30},(_,i)=>({rank_no:i+1,display_name:'長い名前 / Very long player name '+i,best_score:1000-i})))});});
 await page.goto('/');
}
for(const lang of languages)test(`${lang}: home, translated guide, anonymous result, 30 records and safe-area layout`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let submits=0;page.on('request',r=>{if(r.url().includes('/rpc/submit_'))submits++});await prepare(page,lang);
 await expect(page.locator('html')).toHaveAttribute('lang',lang);await expect(page.locator('#languageSelect')).toHaveValue(lang);
 await expect(page.locator('#homeScreen #nameInput')).toBeVisible();await page.locator('#btnGuide').click();await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','false');await page.locator('#guideClose').click();
 await page.locator('#nameInput').fill('   ');await page.locator('#btnStart').click();await expect(page.locator('#gameScreen')).toHaveClass(/active/);
 await page.evaluate(()=>{game.waveIndex=2;game.kills=5;endGame(false)});await expect(page.locator('#resultScreen')).toHaveClass(/active/);await expect(page.locator('#rankingBox .stat')).toHaveCount(30);expect(submits).toBe(0);
 await page.locator('#btnHome').click();await expect(page.locator('#savedResults button')).toHaveCount(1);
 for(const viewport of [{width:402,height:874},{width:874,height:402}]){await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 expect(errors).toEqual([]);
});
test('named result uses one request across redraw, rejected request retry uses same payload',async({page})=>{
 await prepare(page);let attempts=[];await page.route('**/rest/v1/rpc/submit_score_once_shared_v1',async route=>{attempts.push(route.request().postDataJSON());await route.fulfill({status:attempts.length===1?503:200,contentType:'application/json',body:JSON.stringify([{accepted:true,result_normalized_name:route.request().postDataJSON().p_display_name,result_display_name:route.request().postDataJSON().p_display_name,result_first_score:route.request().postDataJSON().p_score,result_best_score:route.request().postDataJSON().p_score,result_play_count:1,is_first_play:true,is_new_best:true,was_duplicate:false}])})});
 await page.locator('#nameInput').fill('名前A');await page.locator('#btnStart').click();await page.evaluate(()=>{endGame(false)});await expect(page.locator('#btnSubmitRetry')).toBeVisible();await page.locator('#btnSubmitRetry').click();await expect(page.locator('#btnSubmitRetry')).toBeHidden();await page.evaluate(()=>showResult());await page.waitForTimeout(100);expect(attempts.length).toBe(2);expect(attempts[0]).toEqual(attempts[1]);
});
test('saved mute and zero volume survive home and reload; IME does not start',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('hito_wo_yurusuna:audio:v1',JSON.stringify({enabled:false,volume:0})));await prepare(page);await expect(page.locator('#soundEnabled')).not.toBeChecked();await expect(page.locator('#soundVolume')).toHaveValue('0');await page.locator('#nameInput').dispatchEvent('keydown',{key:'Enter',keyCode:229,isComposing:true});await expect(page.locator('#homeScreen')).toHaveClass(/active/);await page.reload();await expect(page.locator('#soundEnabled')).not.toBeChecked();await expect(page.locator('#soundVolume')).toHaveValue('0');
});


test('wrong-owner ACK keeps the result retryable with the same frozen payload',async({page})=>{
 await prepare(page);const attempts=[];
 await page.route('**/rest/v1/rpc/submit_score_once_shared_v1',async route=>{const p=route.request().postDataJSON();attempts.push(p);const owner=attempts.length===1?'Other':p.p_display_name;await route.fulfill({json:[{accepted:true,result_normalized_name:owner,result_display_name:owner,result_first_score:0,result_best_score:p.p_score,result_play_count:1,is_first_play:true,is_new_best:true,was_duplicate:attempts.length>1}]});});
 await page.locator('#nameInput').fill('名前A');await page.locator('#btnStart').click();await page.evaluate(()=>endGame(false));
 await expect(page.locator('#btnSubmitRetry')).toBeVisible();await page.locator('#btnSubmitRetry').click();await expect(page.locator('#btnSubmitRetry')).toBeHidden();expect(attempts).toHaveLength(2);expect(attempts[0]).toEqual(attempts[1]);
});
