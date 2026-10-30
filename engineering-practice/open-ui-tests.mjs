// Runtime smoke tests with a minimal DOM adapter. These are not layout/browser tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {OPEN_BANK} from './open-bank.js';
import {OPEN_STORAGE_KEY} from './open-engine.js';
const handlers={},memory=new Map(),root={innerHTML:'',querySelectorAll:()=>[]};
const node={textContent:'',value:'',focus(){},scrollIntoView(){},setAttribute(){},addEventListener(){},close(){},showModal(){},remove(){}};
globalThis.document={querySelector:s=>s==='#app'?root:node,addEventListener:(name,fn)=>{handlers[name]=fn;},createElement:()=>({...node,click(){}})};
globalThis.window={scrollY:0,scrollTo(){},addEventListener(){}};
globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
let copied='';Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async t=>{copied=t;}}}});
await import('./open-app.js');
const click=async(action,extra={})=>handlers.click({target:{closest:()=>({dataset:{action,...extra},disabled:false,setAttribute(){},textContent:''})}});
const input=(field,value,key)=>handlers.input({target:{id:field==='review-json'?field:'',dataset:field==='review-json'?{}:{field,key},value,matches:()=>false}});
const stored=()=>JSON.parse(memory.get(OPEN_STORAGE_KEY));
test('runtime renders every open problem including all 30 graphs without options or premature solutions',async()=>{
 assert.match(root.innerHTML,/186 mixed problems/);
 for(const q of OPEN_BANK){await click('open',{id:q.id});assert.ok(root.innerHTML.includes(q.id),q.id);assert.ok(!root.innerHTML.includes('class="option"'),q.id);assert.ok(!root.innerHTML.includes('class="worked-solution"'),q.id);if(q.graph)assert.ok(root.innerHTML.includes('<svg'),q.id);}
});
test('runtime input saves selected units and marks a converted numeric response',async()=>{
 await click('open',{id:'F001'});input('unit','kg/h','n0');input('value','103349.28','n0');input('reasoning','Steady balance: mdot=Q/(cp deltaT).');await click('submit');
 assert.match(root.innerHTML,/Numerical check: 1 \/ 1 within tolerance/);assert.equal(stored().drafts.F001.units.n0,'kg/h');assert.ok(stored().drafts.F001.submittedAt>0);assert.equal(stored().drafts.F001.ai,null);
 await click('solution');assert.match(root.innerHTML,/class="worked-solution"/);
});
test('runtime copies a complete prompt and imports a synthetic AI review with stale-answer protection',async()=>{
 await click('copy-review');assert.ok(copied.includes('103349.28'));const version=copied.match(/"answerVersion": "([a-f0-9]+)"/)[1];
 const review={questionId:'F001',answerVersion:version,criteria:Array.from({length:5},(_,i)=>({index:i+1,score:3,feedback:'Synthetic test feedback.'})),summary:'Synthetic test review.',corrections:['Check the control volume.'],followUp:'What if flow halves?'};
 input('review-json',JSON.stringify(review));await click('import-review');assert.match(root.innerHTML,/15 \/ 20/);assert.equal(stored().drafts.F001.ai.score,15);
 input('reasoning','A revised calculation.');assert.equal(stored().drafts.F001.ai,null);assert.equal(stored().drafts.F001.submittedAt,0);
 await click('open',{id:'F001'});assert.ok(!root.innerHTML.includes('class="ai-result"'));assert.ok(!root.innerHTML.includes('class="worked-solution"'));
});
