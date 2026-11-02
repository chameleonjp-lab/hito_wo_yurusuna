import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function setup(saved=new Map(),deny=false){
 const start=html.indexOf('// ==== PLAY RECEIPTS ====');
 assert.ok(start>=0,'production receipt module exists');
 const code=html.slice(start,html.indexOf('// ==== END PLAY RECEIPTS ====',start));
 let seq=saved.size;
 const ctx={T:{text:(s,v={})=>String(s).replace(/\{p(\d+)\}/g,(m,i)=>v["p"+i]??m)},GAME_SLUG:'hito_wo_yurusuna',CLIENT_VERSION:'test',normalizePlayerName:v=>String(v||'').trim().replace(/\s+/g,' ').slice(0,16),crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`},localStorage:{get length(){return saved.size},key:i=>[...saved.keys()][i],getItem:k=>saved.get(k)??null,setItem:(k,v)=>{if(deny)throw Error('quota');saved.set(k,v)}},console};
 vm.runInNewContext(code+';globalThis.api=PlayReceipts;',ctx);return {api:ctx.api,saved};
}
const result={score:10500,clearWave:1,kills:10,money:420,cleared:false};
test('start snapshot keeps anonymous consent and immutable completed result',()=>{const {api}=setup();const p=api.start('  ');api.finish(p,result);api.start('B');api.finish(p,{...result,score:200});assert.equal(p.name,'');assert.equal(p.eligible,false);assert.equal(p.result.score,10500);});
test('failed result survives new play, reload and retry using same UUID/name/result',()=>{const {api,saved}=setup();const p=api.start(' A ');api.finish(p,result);api.status(p,'failed');api.start('B');const q=setup(saved).api.list()[0];assert.equal(q.id,p.id);assert.equal(q.name,'A');assert.equal(q.result.score,10500);});
test('corrupt record does not block valid history or independent save',()=>{const saved=new Map([['hito_wo_yurusuna:receipts:v1:broken','{']]);const {api}=setup(saved);const p=api.start('A');api.finish(p,result);assert.equal(api.list().length,1);assert.equal(p.persisted,true);assert.equal(saved.values().next().value,'{');});
test('quota failure retains in-memory result and never claims saved',()=>{const {api}=setup(new Map(),true);const p=api.start('A');api.finish(p,result);assert.equal(p.persisted,false);assert.equal(api.list()[0].result.score,10500);});
test('sent record never regresses on late failure from another tab',()=>{const {api,saved}=setup();const p=api.start('A');api.finish(p,result);const second=setup(saved).api;const q=second.list()[0];api.status(p,'sent');second.status(q,'failed');assert.equal(second.list()[0].status,'sent');});
test('same UUID different payload and foreign namespace are not overwritten',()=>{const {api,saved}=setup();const p=api.start('A');api.finish(p,result);const key=[...saved.keys()][0];const old=saved.get(key);api.status({...p,name:'B'},'sent');assert.equal(saved.get(key),old);const obj=JSON.parse(old);obj.game='other';saved.set(key,JSON.stringify(obj));assert.equal(setup(saved).api.list().length,0);});
test('unfinished game never becomes a score or public submission',()=>{const {api,saved}=setup();api.start('A');assert.equal(api.list().length,0);assert.equal(saved.size,0);});
test('a different payload with same UUID cannot promote the live result to sent',()=>{const {api,saved}=setup();const old=api.start('OLD');api.finish(old,result);api.status(old,'sent');const newer={...old,name:'NEW',result:null,status:'playing'};api.finish(newer,{...result,score:2});api.list();assert.notEqual(newer.status,'sent');assert.equal(JSON.parse([...saved.values()][0]).name,'OLD');});
