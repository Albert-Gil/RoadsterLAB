import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,gaugeToAbsoluteBar,simulateComparison,simulateHop,simulateInvert,simulateTurnComparison} from '../src/physics.ts';
import {PREDICTIONS,gradePrediction,revealKey,speedUnit} from '../src/reveal.js';
import {tuningRows} from '../src/tuning.js';
import {directorShot} from '../src/scene.js';

const triple=run=>({runs:[run,run,run]});

test('every prediction is graded from solver results, with explicit options',()=>{
 const launch=simulateComparison(DEFAULTS),hundred=launch.runs[2].hundred;
 const answer=PREDICTIONS.launch.answer(launch);
 assert.equal(answer.key,hundred<1?'under-1':hundred<=2?'1-2':'over-2');
 assert.match(answer.label,new RegExp(hundred.toFixed(2)));
 assert.equal(gradePrediction('launch',launch,answer.key).correct,true);
 assert.equal(gradePrediction('launch',launch,answer.key==='over-2'?'under-1':'over-2').correct,false);
 assert.equal(gradePrediction('launch',launch,undefined).choice,null,'no guess stays ungraded');

 const wreck=simulateHop(DEFAULTS),soft=simulateHop({...DEFAULTS,pulse:.35,landingBurn:2});
 assert.equal(PREDICTIONS.hop.answer(triple(wreck)).key,wreck.landing.outcome==='WRECKED'?'wrecked':'intact');
 assert.equal(PREDICTIONS.hop.answer(triple(soft)).key,'intact');
 const noLift=simulateHop({...DEFAULTS,pressure:gaugeToAbsoluteBar(20),nozzle:2});
 assert.equal(PREDICTIONS.hop.answer(triple(noLift)).key,null,'no lift-off has no landing answer');
 assert.equal(gradePrediction('hop',triple(noLift),'intact').correct,null);

 assert.equal(PREDICTIONS.invert.answer(triple(simulateInvert(DEFAULTS))).key,'held');
 assert.equal(PREDICTIONS.invert.answer(triple(simulateInvert({...DEFAULTS,fan:0}))).key,'falls');

 const turn=simulateTurnComparison(DEFAULTS),slow=simulateTurnComparison({...DEFAULTS,turnSpeed:60/3.6}),fast=simulateTurnComparison({...DEFAULTS,turnSpeed:160/3.6});
 assert.equal(PREDICTIONS.turn.answer(turn).key,'fan');
 assert.equal(PREDICTIONS.turn.answer(slow).key,'both');
 assert.equal(PREDICTIONS.turn.answer(fast).key,'none');
 for(const kind of Object.keys(PREDICTIONS)){
  const keys=PREDICTIONS[kind].options.map(([key])=>key);
  assert.equal(new Set(keys).size,keys.length);assert.ok(keys.length>=2&&keys.length<=4);
 }
});

test('reveal keys follow the setup and starting inventory only',()=>{
 const a=revealKey('launch',{...DEFAULTS}),b=revealKey('launch',Object.fromEntries(Object.entries(DEFAULTS).reverse()));
 assert.equal(a,b,'key order does not matter');
 assert.notEqual(a,revealKey('launch',{...DEFAULTS,fan:10}));
 assert.notEqual(a,revealKey('hop',{...DEFAULTS}));
 const gas={mass:200,temp:250,u:1e5};
 assert.notEqual(revealKey('launch',DEFAULTS,gas),revealKey('launch',DEFAULTS,{...gas,mass:199}));
});

test('speed units change display milestones without touching SI results',()=>{
 const result=simulateComparison(DEFAULTS);
 const si=tuningRows('launch',result),us=tuningRows('launch',result,'us');
 assert.deepEqual(si.map(r=>r.value),result.runs.map(r=>r.hundred));
 assert.deepEqual(us.map(r=>r.value),result.runs.map(r=>r.sixty));
 assert.ok(si.every(r=>r.detail==='0–100 km/h'));assert.ok(us.every(r=>r.detail==='0–60 mph'));
 assert.equal(speedUnit('si').label,'km/h');assert.equal(speedUnit('us').label,'mph');
 assert.ok(Math.abs(speedUnit('us').scale*26.8224-60)<1e-6);
 assert.equal(speedUnit('unknown'),speedUnit('si'));
});

test('Launch director weights are deterministic, normalized and respect reduced motion',()=>{
 for(const t of [0,.2,.9,1.6,2.5,3.5,4.4,6]){
  const shot=directorShot(t,0);
  assert.deepEqual(shot,directorShot(t,0),'pure function of simulation time');
  assert.ok(Math.abs(shot.rear+shot.side+shot.wide-1)<1e-12);
  assert.ok([shot.rear,shot.side,shot.wide,shot.kick].every(v=>v>=0&&v<=1));
 }
 assert.equal(directorShot(0,0).rear,1);assert.equal(directorShot(6,0).wide,1);
 assert.ok(directorShot(.1,0).kick>0);assert.equal(directorShot(.1,0,true).kick,0,'no camera shake for reduced motion');
 assert.equal(directorShot(.1,1.2).kick,0,'kick waits for the actual boost onset');
 assert.ok(directorShot(1.3,1.2).kick>0);
});
