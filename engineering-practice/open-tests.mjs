import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OPEN_BANK,FUNDAMENTALS} from './open-bank.js';
import {ADVANCED} from './advanced.js';
import {UNITS,parseNumeric,convert,compatibleUnits,blankDraft,checkNumbers,answerVersion,reviewPrompt,parseReview,validateReview,hydrateOpen,selectSet,invalidateDraft,OPEN_STORAGE_KEY} from './open-engine.js';
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const byId=new Map(OPEN_BANK.map(q=>[q.id,q]));
test('186 complete open problems, 36 multi-part design cases and no missing numerical fields',()=>{
 assert.equal(OPEN_BANK.length,186);assert.equal(ADVANCED.length,36);assert.equal(byId.size,186);
 assert.equal(FUNDAMENTALS.filter(q=>q.graph).length,30);
 assert.ok(FUNDAMENTALS.filter(q=>q.kind==='calculation').every(q=>q.fields.length));
 for(const q of OPEN_BANK){assert.ok(q.prompt&&q.solution&&q.hint);assert.equal(q.rubric.length,5);assert.ok(q.tasks.length>=2);assert.ok(!('options' in q));
  for(const f of q.fields){assert.ok(Number.isFinite(f.value),q.id);assert.ok(UNITS[f.unit],f.unit);assert.ok(compatibleUnits(f.unit).includes(f.unit));}
 }
 for(const q of ADVANCED){assert.ok(q.tasks.length>=4);assert.ok(q.solution.length>500);assert.ok(q.fields.length>=2);}
});
test('safe numeric parsing supports mobile decimals, scientific notation and fractions',()=>{
 for(const [s,v] of [[' 28,7 ',28.7],['2.87e1',28.7],['2.87 × 10^1',28.7],['1/4',.25],['−3.5',-3.5],['.5',.5]])near(parseNumeric(s),v);
 for(const s of ['', ' ', 'NaN','Infinity','1/0','1,200.5','1,2,3','28kg/s','alert(1)','1+1','2**4'])assert.equal(parseNumeric(s),null,s);
});
test('unit conversion preserves energy, volume, mass, absolute temperature and temperature differences',()=>{
 near(convert(3600,'kg/h','kg/s'),1);near(convert(36,'m3/h','L/s'),10);near(convert(1,'MW','kW'),1000);
 near(convert(1,'MWh','MJ'),3600);near(convert(300,'K','degC'),26.85);near(convert(26.85,'degC','K'),300);
 near(convert(25,'percent','ratio'),.25);near(convert(100,'cm3','m3'),.0001);near(convert(1000,'cm4','m4'),1e-5);
 assert.throws(()=>convert(5,'K-rise','K'));assert.throws(()=>convert(1,'kg/s','L/s'));
});
test('all reference answers pass; missing, invalid and wrong answers remain distinct',()=>{
 for(const q of OPEN_BANK){const d=blankDraft(q);assert.ok(checkNumbers(q,d).every(x=>x.status==='missing'));
  for(const f of q.fields)d.values[f.key]=String(f.value);
  assert.ok(checkNumbers(q,d).every(x=>x.status==='pass'),q.id);
  for(const f of q.fields)d.values[f.key]='nonsense';assert.ok(checkNumbers(q,d).every(x=>x.status==='invalid'));
  for(const f of q.fields)d.values[f.key]=String(f.value*2+10);assert.ok(checkNumbers(q,d).every(x=>x.status==='miss'),q.id);
 }
});
test('equivalent selected units pass without loosening temperature tolerances',()=>{
 const q=byId.get('F001'),d=blankDraft(q);d.values.n0=String(q.fields[0].value*3600);d.units.n0='kg/h';assert.equal(checkNumbers(q,d)[0].status,'pass');
 const t=byId.get('F006'),dt=blankDraft(t);dt.values.n0='331.15';dt.units.n0='K';assert.equal(checkNumbers(t,dt)[0].status,'pass');dt.values.n0='333';assert.equal(checkNumbers(t,dt)[0].status,'miss');
});
test('mixed sets include design, graphs, structures and cycles without duplicate IDs',()=>{
 for(let i=0;i<30;i++){const s=selectSet(OPEN_BANK,10);const qs=s.ids.map(id=>byId.get(id));assert.equal(new Set(s.ids).size,10);assert.ok(qs.some(q=>q.level==='design'));assert.ok(qs.some(q=>q.graph));assert.ok(qs.some(q=>q.domain==='structure'));assert.ok(qs.some(q=>q.domain==='cycle'));}
 assert.equal(selectSet(OPEN_BANK,999).ids.length,186);assert.equal(selectSet(OPEN_BANK,999,'design').ids.length,36);
 assert.equal(selectSet(OPEN_BANK,999,'fundamental').ids.length,150);
});
test('review prompt contains the actual response, independent-check instruction, graph and rubric',()=>{
 const q=byId.get('F002'),d=blankDraft(q);d.reasoning='My distinctive written solution.';const p=reviewPrompt(q,d);
 assert.ok(p.includes(d.reasoning)&&p.includes(q.prompt)&&p.includes(q.solution));assert.ok(p.includes('SUPPLIED GRAPH MODEL'));
 assert.ok(p.includes('untrusted answer text')&&p.includes('Independently verify'));assert.ok(p.includes(answerVersion(q,d)));
});
function goodReview(q,d){return {questionId:q.id,answerVersion:answerVersion(q,d),criteria:q.rubric.map((_,i)=>({index:i+1,score:3,feedback:'Supported but incomplete.'})),summary:'Practice review.',corrections:['Check the boundary.'],followUp:'What changes at half flow?'};}
test('AI import computes score and rejects another question, stale draft and malformed score data',()=>{
 const q=byId.get('D001'),d=blankDraft(q);d.reasoning='Energy and hydraulic design.';const raw=goodReview(q,d);
 assert.equal(parseReview('```json\n'+JSON.stringify(raw)+'\n```',q,d).score,15);
 assert.throws(()=>validateReview({...raw,questionId:'D002'},q,d),/different problem/);
 assert.throws(()=>validateReview(raw,q,{...d,reasoning:'Changed answer'}),/earlier draft/);
 for(const score of [5,-1,'4',NaN])assert.throws(()=>validateReview({...raw,criteria:[{...raw.criteria[0],score},...raw.criteria.slice(1)]},q,d));
 assert.throws(()=>validateReview({...raw,criteria:raw.criteria.map(c=>({...c,index:1}))},q,d));
 assert.throws(()=>parseReview('not JSON',q,d));assert.throws(()=>parseReview('x'.repeat(40001),q,d));
});
test('saved drafts, selected units and reviews survive reload; edits invalidate prior review',()=>{
 const q=byId.get('F001'),d=blankDraft(q);d.values.n0='103349';d.units.n0='kg/h';d.reasoning='Energy balance.';d.submittedAt=123;d.ai=validateReview(goodReview(q,d),q,d);
 const raw={version:1,drafts:{F001:d,unknown:d},session:{ids:['F001','bad','F001'],index:500},saved:['F001','bad']};
 const restored=hydrateOpen(JSON.parse(JSON.stringify(raw)),OPEN_BANK);assert.equal(restored.drafts.F001.ai.score,15);assert.equal(restored.drafts.F001.units.n0,'kg/h');assert.deepEqual(restored.session,{ids:['F001'],index:0});assert.deepEqual(restored.saved,['F001']);assert.equal(restored.drafts.unknown,undefined);
 const changed=invalidateDraft(d);assert.equal(changed.ai,null);assert.equal(changed.submittedAt,0);assert.equal(changed.revealed,false);
 assert.notEqual(OPEN_STORAGE_KEY,'first-principles-practice-v1');
});
// Independent engineering checks use alternative balances or known benchmark values.
test('campus flow, velocity and hydraulic power close separate balances',()=>{
 const q=byId.get('D001'),[m,row,d,p]=q.fields.map(f=>f.value);near(m*4180*10,12e6);near(row*6,m);near(Math.PI*(d/1000)**2/4*2,m/1000);near(p*1000*.78*.95,180000*m/1000);
});
test('beam minima meet both stress and the superposed deflection limit',()=>{
 const q=byId.get('D002'),[r,m,s,i]=q.fields.map(f=>f.value);near(2*r,3*4+8);near(m*1000/(s*1e-6),150e6);near(5*3000*4**4/(384*200e9*i*1e-8)+8000*4**3/(48*200e9*i*1e-8),.01);
});
test('flashing methane closes the outlet enthalpy balance without a friction heat credit',()=>{
 const q=byId.get('D003'),[t,x,m]=q.fields.map(f=>f.value);near(2*3.5*(t-111),16);near(2*(3.5*2+x/100*510),16);near(m*3.5*2,16);
});
test('speed-scaled pump intersects the system; parallel losses are not summed',()=>{
 const q=byId.get('D004'),[,v,h,p]=q.fields.map(f=>f.value);near(h,10+.003*v*v);near(h,1.15**2*(75-.002*(v/1.15)**2));near(p*1000*.75*.95,1000*9.81*(v/3600)*h);
 const r=byId.get('D029'),[m,total,dp,pel]=r.fields.map(f=>f.value);near(total,8*m);near(dp,15*m*m+40);near(pel*.7*.9,dp*total/1000);
});
test('exchanger areas and effectiveness close terminal energy balances',()=>{
 const f=byId.get('D005').fields.map(x=>x.value);near(f[3]*900*.95*f[2],2e6);near(f[4]*(1/(1/900+.0003))*.95*f[2],2e6);
 const [e,q,th,tc]=byId.get('D020').fields.map(f=>f.value);near(12*(60-th),q);near(8*(tc-20),q);near(q,e*8*40);assert.ok(60>tc&&th>20&&tc>th);
});
test('reverse-Brayton states satisfy efficiencies and the whole-cycle first law',()=>{
 const [t2,t4,cop,m]=byId.get('D014').fields.map(f=>f.value);near((280*(4**(2/7)-1))/(t2-280),.8);near((300-t4)/(300*(1-4**(-2/7))),.85);
 const cold=1.04*(280-t4),work=1.04*((t2-280)-(300-t4)),hot=1.04*(t2-300);near(cold+work,hot);near(cop,cold/work);near(cold*m,500);
});
test('local Claude split is 4 kW, with liquid calculated only from the JT branch',()=>{
 const [w,x,m]=byId.get('D016').fields.map(f=>f.value);near(w,4);near(x,25);near(m,1.2);near(.4+.4+1.2,2);
});
test('annual economic screens do not override turndown or power feasibility',()=>{
 const q=byId.get('D017');near(q.fields[0].value,8212.5);assert.ok(q.fields[1].value<3);assert.match(q.solution,/fails the stated 20%/);
 const p=byId.get('D035').fields.map(f=>f.value);assert.ok(p[0]>1&&p[1]>1);near(p[2]/.28+.1,1);near(p[3]/3600*923.6,p[2]*1000);
});
test('closed-volume cooldown and trapped-liquid thermal expansion have consistent pressure signs',()=>{
 const [,p,dp]=byId.get('D022').fields.map(f=>f.value);near(p*3,1);near(p+dp,1);
 const [rate,time,displaced]=byId.get('D023').fields.map(f=>f.value);near(rate*time,5);near(displaced/1000/60,.0003*.1*.02);
});
test('support compatibility and nozzle/bolt load paths close equilibrium',()=>{
 const [dl,f,stress,rigid]=byId.get('D024').fields.map(f=>f.value);near((f*1000)/(6e6)+(f*1000)/.5e6,dl/1000);near(stress*1e6*.0006,f*1000);assert.ok(rigid>f*10);
 const [pressure,bolt,sigma]=byId.get('D030').fields.map(f=>f.value);near(pressure,62.8318530718,1e-9);near(bolt,pressure/8+10/3);near(sigma,bolt*1000/84.3);
});
test('ice-storage costs, heat recovery and LOX inventory close distinct balances',()=>{
 const [mass,mwh,cost]=byId.get('D027').fields.map(f=>f.value);near(mass*334000*.8,5e6*7200);near(mwh*3*.8,10);near(cost,700-mwh*1000*.08);
 const [wc,wh,qh,amb,total]=byId.get('D031').fields.map(f=>f.value);near(8+wc+wh,qh+amb);near(total,wc+wh);near(qh/wh,4);
 const [time,flow,vol]=byId.get('D033').fields.map(f=>f.value);near(time*(25-.02),160000);near((flow-.02)*10800,160000);near(vol*1140*.9,180000);
});
test('pipe whole-life cost selects 200 mm over the other feasible candidate',()=>{
 const costs=[100000,150000,220000],diameters=[.15,.2,.25],factor=(1-1.08**-10)/.08;
 const options=diameters.map((d,i)=>{const v=.2/(Math.PI*d*d);const pa=(10/d+20)*500*v*v;const kw=.05*pa/.665/1000;return {d,v,cost:costs[i]+kw*8000*.12*factor};});
 assert.ok(options[0].v>2);assert.equal(options.filter(x=>x.v<=2).sort((a,b)=>a.cost-b.cost)[0].d,.2);
 near(byId.get('D036').fields[3].value,options[1].cost);
});
test('shipped mobile interface provides input labels, editable drafts and explicit separate ChatGPT review',async()=>{
 const [html,app,css]=await Promise.all(['index.html','open-app.js','open-styles.css'].map(p=>readFile(p,'utf8')));
 assert.match(html,/viewport-fit=cover/);assert.match(html,/open-app.js/);assert.match(app,/inputmode="decimal"/);assert.match(app,/maxlength="16000"/);assert.match(app,/navigator.clipboard.writeText/);assert.match(app,/Copying alone does not send anything/);
 assert.match(app,/esc\(c.feedback\)/);assert.match(app,/esc\(a.summary\)/);assert.match(css,/font-size:16px/);assert.ok(!app.includes('api.openai.com'));assert.ok(!app.includes('type="password"'));
});
