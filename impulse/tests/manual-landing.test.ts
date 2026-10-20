import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS as BASE_DEFAULTS,simulateHop,sampleAt,initialGas,hopCsv} from '../src/physics.ts';
import {propsAtTR} from '../src/air-table.js';
import {hopSummary,hopLandingPrediction} from '../src/hop.js';
const DEFAULTS={...BASE_DEFAULTS,heatTransfer:0};

const manual={...DEFAULTS,pulse:.35,landingBurn:2};

test('manual timing changes the predicted outcome before playback',()=>{
 const good=simulateHop(manual),late=simulateHop({...manual,manualBurnAt:2.5});
 assert.equal(good.landing!.mode,'manual');assert.equal(good.landing!.controller,'manual-window-v1');
 assert.equal(hopLandingPrediction(good).outcome,'INTACT');assert.ok(good.landingSpeed!<1.5);
 assert.equal(hopLandingPrediction(late).outcome,'WRECKED');assert.ok(late.landingSpeed!>10);
 assert.equal(hopLandingPrediction(good).speed,good.landingSpeed);
});

test('manual pulse respects exact window edges and fixed duty without automatic target control',()=>{
 const config={...manual,manualBurnAt:2.053,manualBurnDuration:.173,manualBurnCommand:55};
 const run=simulateHop(config,.004),end=config.manualBurnAt+config.manualBurnDuration;
 assert.ok(Math.abs(run.landing!.burnStart!-config.manualBurnAt)<1e-10);
 assert.ok(Math.abs(run.landing!.burnEnd!-end)<1e-9);
 assert.equal(sampleAt(run,config.manualBurnAt).valve,.55);assert.equal(sampleAt(run,end+1e-9).valve,0);
 for(const s of run.samples.filter(s=>s.t>config.pulse&&s.flow>0)){
  assert.ok(s.t>=config.manualBurnAt-1e-9&&s.t<=end+1e-9);assert.equal(s.valve,.55);
 }
 const altered=simulateHop({...manual,landingTarget:5,landingLead:.2});
 assert.deepEqual(altered.samples,simulateHop(manual).samples);
});

test('manual landing discharge conserves mass and stagnation-enthalpy energy',()=>{
 const run=simulateHop({...manual,manualBurnAt:2.053,manualBurnDuration:.173,manualBurnCommand:55}),start=initialGas(manual);
 let mass=0,energy=0;
 for(let i=1;i<run.samples.length;i++){
  const a=run.samples[i-1],b=run.samples[i],dt=b.t-a.t,V=manual.volume/1000;
  mass+=dt*(a.flow+b.flow)/2;
  energy+=dt*(a.flow*propsAtTR(a.temp,a.gas/V).h+b.flow*propsAtTR(b.temp,b.gas/V).h)/2;
  assert.ok(b.gas<=a.gas+1e-9);
 }
 assert.ok(Math.abs(mass-run.used)/run.used<5e-5);
 assert.ok(Math.abs(start.mass*start.u-run.finalGas.mass*run.finalGas.u-energy)/Math.abs(energy)<5e-5);
 const ignition=sampleAt(run,run.landing!.burnStart!);assert.ok(ignition.gas<start.mass&&ignition.temp<start.temp);
});

test('expired, zero-duration and zero-command windows do not invent a landing burn',()=>{
 const baseline=simulateHop({...manual,landingBurn:0});
 for(const change of [{manualBurnAt:4},{manualBurnAt:0,manualBurnDuration:.2},{manualBurnDuration:0},{manualBurnCommand:0}]){
  const run=simulateHop({...manual,...change});
  assert.equal(run.landing!.burnStart,null);assert.ok(Math.abs(run.used-baseline.used)<1e-7);
  assert.ok(Math.abs(run.landingSpeed!-baseline.landingSpeed!)<1e-6);
 }
 const noLift=simulateHop({...manual,pressure:20,nozzle:2});assert.equal(hopLandingPrediction(noLift).outcome,'NO LIFT');
 const stopped=simulateHop({...manual,mass:1200,volume:80,nozzle:20,pressure:651.01325,pulse:1.5});
 assert.equal(stopped.status,'OUT OF TABLE');assert.equal(hopLandingPrediction(stopped).outcome,'UNRESOLVED');
});

test('early manual burn can rebound; scene envelope and apex use the highest actual peak',()=>{
 const run=simulateHop({...manual,manualBurnAt:1.5}),summary=hopSummary(run,manual);
 assert.ok(run.samples.some(s=>s.limit==='MANUAL BURN / REBOUND'));
 assert.ok(summary.apexes.length>=2);assert.ok(summary.peakHeight>10);
 assert.ok(Math.abs(summary.peakHeight-run.peakHeight)<.001);
 assert.ok(summary.events.some(e=>e.label==='REBOUND APEX'));
});

test('Fire-now rescheduling preserves the pre-ignition trajectory and spent tank',()=>{
 const waiting=simulateHop({...manual,manualBurnAt:10}),fired=simulateHop(manual);
 for(const t of [.1,.5,1,2.2]){
  const a=sampleAt(waiting,t),b=sampleAt(fired,t);
  for(const key of ['y','vy','gas','temp','u'] as const)assert.ok(Math.abs(a[key]-b[key])<1e-6);
 }
 assert.ok(fired.used>waiting.used);assert.equal(fired.landing!.burnStart,manual.manualBurnAt);
});

test('manual cutoff and contact converge; exports include manual controls and finite data',()=>{
 const a=simulateHop(manual),b=simulateHop(manual,.001);
 assert.ok(Math.abs(a.landingSpeed!-b.landingSpeed!)<.02);assert.ok(Math.abs(a.used-b.used)/b.used<.001);
 const csv=hopCsv(a,manual);assert.ok(csv.includes('manual_start_s,manual_duration_s,manual_command_pct'));
 assert.ok(csv.includes('manual-window-v1'));assert.ok(!/NaN|Infinity/.test(csv));
 for(const run of [a,b])for(const s of run.samples)for(const v of Object.values(s))if(typeof v==='number')assert.ok(Number.isFinite(v));
 for(const change of [{manualBurnAt:-1},{manualBurnDuration:6},{manualBurnCommand:101},{manualBurnAt:NaN},{landingBurn:3}])assert.throws(()=>simulateHop({...manual,...change}),/manual landing/);
});
