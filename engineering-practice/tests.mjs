import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {QUESTIONS as Q} from "./questions.js";
import {shuffle,freshProgress,makeSession,grade,nextQuestion,recordAttempt,sessionStats,progressStats,hydrate,finishSession} from "./engine.js";
import {graphicHTML,dataHTML,evaluateSeries} from "./charts.js";
const byId=new Map(Q.map(q=>[q.id,q]));
function seeded(seed=20261028){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
test("150 complete, unique, single-answer questions with 4 distinct choices",()=>{
  assert.equal(Q.length,150);
  assert.deepEqual(Q.map(q=>q.id),Array.from({length:150},(_,i)=>i+1));
  for(const q of Q){
    assert.equal(q.options.length,4,q.id);
    assert.equal(new Set(q.options.map(o=>o.id)).size,4,q.id);
    assert.equal(new Set(q.options.map(o=>o.text.trim().toLowerCase())).size,4,q.id);
    assert.equal(q.options.filter(o=>o.id===q.correct).length,1,q.id);
    for(const o of q.options)assert.ok(o.text.trim()&&o.feedback.trim(),q.id);
    assert.ok(q.prompt&&q.explanation&&q.hint,q.id);
  }
});
test("mixed sessions cover visual, numerical and reasoning questions without repetition",()=>{
  for(let i=1;i<=30;i++){
    const s=makeSession(Q,20,null,seeded(i));
    assert.equal(s.order.length,20);assert.equal(new Set(s.order).size,20);
    assert.ok(s.order.some(id=>byId.get(id).graph));
    assert.ok(s.order.some(id=>byId.get(id).kind==="calculation"));
    assert.ok(s.order.some(id=>byId.get(id).kind==="reasoning"));
    assert.ok(s.order.some(id=>byId.get(id).domain==="structure"));
    assert.ok(s.order.some(id=>byId.get(id).domain==="cycle"));
    for(const id of s.order)assert.deepEqual([...s.optionOrder[id]].sort(),byId.get(id).options.map(o=>o.id).sort());
  }
});
test("answer positions vary, and grading follows option identity rather than displayed index",()=>{
  const positionCounts=[0,0,0,0];
  for(let n=1;n<=12;n++){
    const s=makeSession(Q,150,null,seeded(n));
    for(const id of s.order)positionCounts[s.optionOrder[id].indexOf(byId.get(id).correct)]++;
  }
  for(const count of positionCounts)assert.ok(count>330&&count<570,positionCounts);
});
test("first response locks and is scored once; incomplete questions cannot advance",()=>{
  let s=makeSession(Q,10,null,seeded());
  const q=byId.get(s.order[0]),wrong=q.options.find(o=>o.id!==q.correct).id;
  assert.throws(()=>nextQuestion(s));
  const first=grade(s,q,wrong);assert.equal(first.recorded,true);s=first.session;
  const again=grade(s,q,q.correct);assert.equal(again.recorded,false);
  assert.equal(sessionStats(again.session).correct,0);
  assert.equal(sessionStats(again.session).answered,1);
  assert.equal(again.session.answers[q.id].selected,wrong);
  assert.throws(()=>grade(makeSession(Q,10,[q.id]),q,"not-an-option"));
});
test("complete session, scoring and persistence survive reload",()=>{
  let p=freshProgress(),s=makeSession(Q,20,null,seeded(),100);
  for(let i=0;i<20;i++){
    const q=byId.get(s.order[s.index]),g=grade(s,q,q.correct,200+i);
    p=recordAttempt(p,q.id,true);s=nextQuestion(g.session,300+i);
  }
  p.session=s;p.saved=[Q[0].id,Q[30].id];
  const restored=hydrate(JSON.parse(JSON.stringify(p)),Q);
  assert.equal(restored.session.done,true);
  assert.deepEqual(sessionStats(restored.session),{answered:20,correct:20,total:20,missed:[]});
  assert.deepEqual(restored.session.optionOrder,s.optionOrder);
  assert.equal(progressStats(restored,Q).seen,20);
  assert.equal(progressStats(restored,Q).accuracy,100);
  assert.deepEqual(restored.saved,p.saved);
});
test("resume preserves the active answer and order; malformed saved data is bounded",()=>{
  let p=freshProgress();p.session=makeSession(Q,10,null,seeded());
  const q=byId.get(p.session.order[0]);p.session=grade(p.session,q,q.correct).session;
  const restored=hydrate(JSON.parse(JSON.stringify(p)),Q);
  assert.equal(restored.session.index,0);
  assert.equal(restored.session.answers[q.id].correct,true);
  assert.deepEqual(restored.session.optionOrder,p.session.optionOrder);
  const bad=hydrate({version:1,saved:[1,1,999],history:{"999":{attempts:3}},session:{order:[999],index:100}},Q);
  assert.deepEqual(bad.saved,[1]);assert.equal(bad.session,null);
});
test("wrong-answer review uses the most recent attempt and stays within its pool",()=>{
  let p=recordAttempt(freshProgress(),1,false);
  p=recordAttempt(p,2,false);
  assert.deepEqual(progressStats(p,Q).mistakes,[1,2]);
  p=recordAttempt(p,1,true);
  assert.deepEqual(progressStats(p,Q).mistakes,[2]);
  const s=makeSession(Q,150,[2],seeded());
  assert.deepEqual(s.order,[2]);assert.equal(s.done,false);
  const empty=makeSession(Q,10,[],seeded());assert.equal(empty.done,true);
});
test("partial completion does not silently score unattempted questions as correct",()=>{
  let s=makeSession(Q,20,null,seeded());
  const q=byId.get(s.order[0]);s=grade(s,q,q.correct).session;
  s=finishSession(s,999);const x=sessionStats(s);
  assert.equal(x.answered,1);assert.equal(x.correct,1);assert.equal(x.total,20);
});
test("all 30 diagrams render valid finite SVG and unique accessibility IDs",async()=>{
  const graphs=Q.filter(q=>q.graph);assert.equal(graphs.length,30);
  const root="qa";await mkdir(root,{recursive:true});
  for(const q of graphs){
    const a=graphicHTML(q,false),b=graphicHTML(q,true,"expanded");
    assert.ok(a.startsWith("<svg"),q.id);
    assert.ok(a.includes('role="img"')&&a.includes("<title"),q.id);
    assert.ok(!/NaN|Infinity|undefined/.test(a+b+dataHTML(q.graph)),q.id);
    assert.notEqual(a.match(/aria-labelledby="([^"]+)/)[1],b.match(/aria-labelledby="([^"]+)/)[1],q.id);
    await writeFile(root+"/question-"+q.id+".svg",a);
  }
});
test("displayed pump and NPSH curves agree with independently solved operating points",()=>{
  const g7=byId.get(7).graph,flow=Math.sqrt(62/.05);
  assert.ok(Math.abs(evaluateSeries(g7.series[1],flow)-evaluateSeries(g7.series[2],flow))<1e-9);
  assert.ok(Math.abs(evaluateSeries(g7.series[1],flow)-47.2)<1e-9);
  const gp=byId.get(39).graph,q=Math.sqrt(40/.0225);
  assert.ok(Math.abs(evaluateSeries(gp.series[1],q)-evaluateSeries(gp.series[2],q))<1e-9);
  const gn=byId.get(106).graph,n=Math.sqrt(12/.01);
  assert.ok(Math.abs(evaluateSeries(gn.series[0],n)-evaluateSeries(gn.series[1],n))<1e-9);
});
function nums(text){return [...text.replaceAll(",","").matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));}
const cases=[
[1,[1200/(4.18*10)],.06],[6,[30+800*(.005+.010+.020)],.01],
[7,[Math.sqrt(62/.05)],.06],[9,[2/5,2+2/5],.01],
[10,[2e6*.5/(2*.005)/1e6,2e6*.5/(4*.005)/1e6],.01],
[11,[8,4],.01],[12,[12*20/2.4],.01],[13,[1.5/510*3600],.06],
[15,[500/15],.06],[17,[5*.9,5*.1],.01],[19,[6*333.15/293.15-1],.01],
[20,[10000/3600*(2.2*188+510)/1000,10000/3600*(2.2*188+510)/1000/.2],.06],
[22,[8-8*.75/2,8*.75/2],.01],[23,[80000/9810+3-.5],.02],
[28,[1000*1.013/8*300/273.15],.6],[29,[(110-100)/(300-100)*100],.01],
[31,[6000/50],.01],[32,[4-35/(5*3.5)],.01],
[36,[200*.5*180/213],.06],[37,[250000*.04/.7/.95/1000],.08],
[39,[Math.sqrt(40/.0225)],.06],[41,[.1*5.67e-8*(300**4-90**4)],.1],
[42,[6000/2400,6000/2400/3,6000/2400*4/3],.02],
[44,[Math.sqrt(.02**2+(Math.sqrt(2)*.1/5)**2)*100],.02],
[45,[(8*30+2*20)/10],.01],[47,[2e6*Math.PI*.1**2/4/1000],.1],
[49,[.8,.8**2,.8**3],.002],[51,[2000*3**2/8/1000,2000*3/2/1000],.01],
[52,[(40/20)**2,(40/40)**2],.01],[53,[15*200e-6*210/.2],.01],
[56,[25+4+3],.01],[59,[100/3600*600,100/3600*600/.15],.2],
[61,[3000*30/(4.18*5)/1000],.01],[64,[200/70],.01],[66,[2**.8,2**3],.01],
[67,[3e-4*10*20*1000,2.2e9*3e-4*20/1e5],.01],[68,[1200/48/.95/.9],.06],
[69,[280/(310-280)],.01],[74,[20*10/(1/2000+.0002)/1000],.6],
[76,[Math.sqrt(2e6/200)/(2*Math.PI)],.05],[77,[1000/(3.6*10)/1030*1000],.06],
[83,[.4+3,3.6-3],.01],[86,[20/213],.0001],[87,[25000/(8*8000*.12)],.01],
[92,[1e6/420/.9],1],[93,[80-1000*.04],.01],[94,[10000/(100e-6*200e9)*1000],.001],
[95,[500000/(1000*.9*10)],.06],[97,[100/((100*3.785/60)*4.18)],.01],
[100,[3/.25+10/5,3+3/.25+10+10/5],.01],
[103,[1.1,1.1**3],.001],[107,[Math.sqrt(120/3),Math.sqrt(120/12)],.01],
[108,[418/(10*4.18),418/(20*4.18)],.01],[110,[Math.exp(-1)*100],.06],
[115,[(10-5)/Math.log(10/5)],.01],[117,[6*330/300-1],.01],
[119,[1000/(40*4.18),2000/(40*4.18)],.01],[120,[(8-4)/.1],.01],
[128,[250000/((500-300)*8000*.1)],.01],[137,[1/.7,1+1/.7],.01],
[145,[Math.sqrt(100**2+3*50**2),250/Math.sqrt(100**2+3*50**2)],.6],
[148,[1/1.2**3,1/1.2**4],.001]
];
for(const [id,expected,tolerance] of cases)test("independent numerical option check #"+id,()=>{
  const q=byId.get(id),matching=q.options.filter(o=>{
    const n=nums(o.text);
    return n.length===expected.length&&n.every((x,i)=>Math.abs(x-expected[i])<=tolerance);
  });
  assert.equal(matching.length,1,JSON.stringify({id,expected,options:q.options.map(o=>o.text)}));
  assert.equal(matching[0].id,q.correct);
});
test("numeric feedback for series-pump distractor is consistent",()=>{
  const q=byId.get(39),seriesFlow=Math.sqrt(80/(.02+.02));
  assert.ok(Math.abs(nums(q.options[3].text)[0]-seriesFlow)<.06);
});
test("touch and accessibility essentials are present in the shipped files",async()=>{
  const [html,css,app]=await Promise.all(["multiple-choice.html","styles.css","app.js"].map(p=>readFile(p,"utf8")));
  assert.ok(html.includes('width=device-width'));
  assert.ok(html.includes('<html lang="en">'));
  assert.ok(css.includes("safe-area-inset-bottom")&&css.includes(":focus-visible"));
  assert.ok(css.includes("min-height:49px")&&css.includes("prefers-reduced-motion"));
  assert.ok(app.includes('aria-live="polite"')&&app.includes("aria-pressed"));
});

test("axis paths remain unfilled and cycle-loop data tables are suppressed",()=>{
  const plot=graphicHTML(byId.get(7));
  assert.ok(plot.includes('fill="none" stroke="#92a89c"'));
  assert.equal(dataHTML(byId.get(122).graph),"");
  assert.equal(dataHTML(byId.get(123).graph),"");
});
test("cryogenic minimum-work and structural scaling answers agree with formulas",()=>{
  const v=nums(byId.get(138).options.find(o=>o.id===byId.get(138).correct).text);
  assert.ok(Math.abs(v[0]-(300/112-1))<.01);
  assert.ok(Math.abs(v[2]-(300/280-1))<.0001);
  assert.equal(nums(byId.get(147).options.find(o=>o.id===byId.get(147).correct).text)[0],(1/.5)**2);
  assert.ok(byId.get(8).options.find(o=>o.id===byId.get(8).correct).text.includes("tension"));
  assert.ok(byId.get(84).options.find(o=>o.id===byId.get(84).correct).text.includes("compression"));
});

