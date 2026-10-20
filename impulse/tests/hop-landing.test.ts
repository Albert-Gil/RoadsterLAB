import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS as BASE_DEFAULTS,initialGas,simulateHop,nozzleFlow,pressureOf,hopNozzles,touchdownOutcome,hopCsv,sampleAt} from '../src/physics.ts';
import {propsAtTR} from '../src/air-table.js';
import {HOP_MOUNTS,hopSummary,hopDamage} from '../src/hop.js';
const DEFAULTS={...BASE_DEFAULTS,heatTransfer:0};

const soft={...DEFAULTS,pulse:.2,landingBurn:1};

test('four balanced nozzles preserve combined flow, force and area',()=>{
 const hw=hopNozzles(DEFAULTS),gas=initialGas(DEFAULTS),p=pressureOf(DEFAULTS,gas);
 const one=nozzleFlow(p,gas.temp,hw.areaEach),total=nozzleFlow(p,gas.temp,hw.totalArea);
 assert.equal(hw.count,4);assert.equal(hw.totalArea,2*DEFAULTS.nozzle*1e-4);
 assert.equal(HOP_MOUNTS.length,4);
 for(const k of [0,2])assert.equal(HOP_MOUNTS.reduce((sum,p)=>sum+p[k],0),0);
 assert.ok(Math.abs(4*one.flow-total.flow)<1e-9);assert.ok(Math.abs(4*one.thrust-total.thrust)<1e-7);
});

test('wreck threshold changes outcome only, with strict greater-than classification',()=>{
 assert.equal(touchdownOutcome(null,5),'NO TOUCHDOWN');
 assert.equal(touchdownOutcome(4.99,5),'INTACT');assert.equal(touchdownOutcome(5,5),'INTACT');assert.equal(touchdownOutcome(5.01,5),'WRECKED');
 const a=simulateHop({...DEFAULTS,pulse:.2}),b=simulateHop({...DEFAULTS,pulse:.2,wreckSpeed:10});
 assert.deepEqual(a.samples,b.samples);assert.equal(a.landing!.outcome,'WRECKED');assert.equal(b.landing!.outcome,'INTACT');
 const summary=hopSummary(a,DEFAULTS),end=a.samples.at(-1)!.t;
 assert.equal(hopDamage(summary,end-.001).wrecked,false);assert.equal(hopDamage(summary,end).wrecked,true);
 assert.deepEqual(hopDamage(summary,0),{wrecked:false,progress:0});
 assert.deepEqual(hopDamage(summary,end,.6),hopDamage(summary,end,.6));
});

test('landing burn preserves ascent and spends the remaining tank to soften a short hop',()=>{
 const off=simulateHop({...soft,landingBurn:0}),on=simulateHop(soft),end=on.samples.at(-1)!;
 assert.equal(on.status,'TOUCHDOWN');assert.equal(on.landing!.outcome,'INTACT');
 assert.ok(on.landingSpeed!<2&&off.landingSpeed!>7);assert.ok(on.used>off.used);
 const ignition=on.landing!.burnStart!;assert.ok(ignition>soft.pulse);
 const physical=(samples:any[])=>samples.filter(s=>s.t<ignition).map(({limit,...state})=>state);
 assert.deepEqual(physical(on.samples),physical(off.samples));
 assert.ok(on.samples.filter(s=>s.t>=ignition&&s.thrust>0).every(s=>s.vy<0&&(s.y>0||s.limit==='PRE-TOUCHDOWN')));
 assert.equal(end.flow,0);assert.equal(end.thrust,0);assert.equal(end.y,0);assert.equal(end.gas,on.finalGas.mass);
 assert.ok(on.samples.every(s=>s.gas>0));
});

test('landing burn mass and tank-outlet enthalpy balances remain consistent',()=>{
 const run=simulateHop(soft),start=initialGas(soft),end=run.finalGas;
 let massOut=0,energyOut=0;
 for(let i=1;i<run.samples.length;i++){
  const a=run.samples[i-1],b=run.samples[i],dt=b.t-a.t;
  const ha=propsAtTR(a.temp,a.gas/(soft.volume/1000)).h,hb=propsAtTR(b.temp,b.gas/(soft.volume/1000)).h;
  massOut+=dt*(a.flow+b.flow)/2;energyOut+=dt*(a.flow*ha+b.flow*hb)/2;
  assert.ok(b.gas<=a.gas+1e-9);
 }
 assert.ok(Math.abs(massOut-run.used)/run.used<.00005);
 assert.ok(Math.abs(start.mass*start.u-end.mass*end.u-energyOut)/Math.abs(energyOut)<.00005);
 const ignition=run.samples.find(s=>s.limit==='LANDING BURN')!;
 assert.ok(ignition.temp<start.temp&&ignition.gas<start.mass,'ignition never refills or reheats');
});

test('landing burn can fail; no-lift and property stops never fabricate impact',()=>{
 const weak=simulateHop({...DEFAULTS,landingBurn:1});
 assert.equal(weak.landing!.outcome,'WRECKED');
 assert.ok(weak.samples.some(s=>s.limit==='INSUFFICIENT BRAKING'));
 const noLift=simulateHop({...DEFAULTS,pressure:20,nozzle:2,landingBurn:1});
 assert.equal(noLift.status,'INSUFFICIENT LIFT');assert.equal(noLift.landing!.burnStart,null);
 assert.equal(noLift.landing!.outcome,'NO TOUCHDOWN');
 const stopped=simulateHop({...DEFAULTS,pressure:651.01325,volume:80,nozzle:20,pulse:1.5,landingBurn:1,mass:1200});
 assert.equal(stopped.status,'OUT OF TABLE');assert.equal(stopped.landingSpeed,null);
 assert.equal(stopped.landing!.outcome,'NO TOUCHDOWN');
 for(const run of [weak,noLift,stopped])for(const s of run.samples)for(const v of Object.values(s))if(typeof v==='number')assert.ok(Number.isFinite(v));
});

test('descent braking and exact ground event converge with timestep refinement',()=>{
 for(const pulse of [.2,.65]){
  const a=simulateHop({...soft,pulse}),b=simulateHop({...soft,pulse},.001);
  assert.equal(a.landing!.outcome,b.landing!.outcome);
  assert.ok(Math.abs(a.landingSpeed!-b.landingSpeed!)<.12);
  assert.ok(Math.abs(a.used-b.used)/b.used<.005);
  assert.ok(Math.abs(a.samples.at(-1)!.t-b.samples.at(-1)!.t)<.02);
 }
});

test('Hop export carries physical samples, landing settings and outcome without visual tail',()=>{
 const r=simulateHop(soft),csv=hopCsv(r,soft),rows=csv.split('\n');
 assert.equal(rows.length,r.samples.length+1);assert.ok(!/NaN|Infinity/.test(csv));
 assert.ok(rows[0].includes('wreck_threshold_m_s'));assert.ok(rows[0].includes('tank_u_J_kg'));
 assert.ok(rows.at(-1)!.includes('TOUCHDOWN'));assert.ok(rows.at(-1)!.includes('INTACT'));
 assert.ok(rows[1].includes('""landingBurn"":1'));
});

test('blowdown forecast lands a higher hop near target and diagnoses limited reserve',()=>{
 const high=simulateHop({...soft,pulse:.35}),limited=simulateHop({...DEFAULTS,landingBurn:1});
 assert.ok(high.peakHeight>5);assert.ok(high.landing!.plan!.feasible);
 assert.ok(Math.abs(high.landingSpeed!-soft.landingTarget)<.08);
 assert.ok(!limited.landing!.plan!.feasible);assert.ok(limited.landingSpeed!<simulateHop({...DEFAULTS,landingBurn:0}).landingSpeed!);
 assert.ok(Math.abs(limited.landing!.plan!.predictedSpeed-limited.landingSpeed!)<.03);
});

test('target speed and ignition lead are real controls; lower requested speed can exhaust authority',()=>{
 const config={...soft,pulse:.35},fast=simulateHop({...config,landingTarget:3}),slow=simulateHop({...config,landingTarget:.25});
 assert.ok(Math.abs(fast.landingSpeed!-3)<.08);assert.ok(slow.landingSpeed!<fast.landingSpeed!);
 assert.ok(!slow.landing!.plan!.feasible);
 const early=simulateHop({...soft,landingLead:.05}),nominal=simulateHop({...soft,landingLead:0});
 assert.ok(early.landing!.burnStart!<nominal.landing!.burnStart!-.049);
 for(const key of ['landingTarget','landingLead'])for(const value of [-1,NaN,Infinity])assert.throws(()=>simulateHop({...soft,[key]:value}),/controller/);
});

test('valve event samples retain both limits and exact right-side playback state',()=>{
 const run=simulateHop(soft),samples=run.samples;
 const cutoff=samples.filter(s=>s.t===soft.pulse);
 assert.equal(cutoff.length,2);assert.ok(cutoff[0].flow>0);assert.equal(cutoff[1].flow,0);
 assert.equal(sampleAt(run,soft.pulse).flow,0);
 const end=samples.at(-1)!,before=samples.at(-2)!;
 assert.equal(before.t,end.t);assert.equal(before.limit,'PRE-TOUCHDOWN');
 assert.ok(before.flow>0);assert.equal(end.flow,0);
 assert.equal(sampleAt(run,end.t).flow,0);
 for(const s of samples){assert.ok(s.valve!>=0&&s.valve!<=1);}
});

test('forecast property limits explicitly close propulsion while retaining supported ballistic flight',()=>{
 const run=simulateHop({...soft,pulse:.8});
 assert.equal(run.status,'TOUCHDOWN');assert.ok(!run.landing!.plan!.feasible);
 assert.ok(run.samples.some(s=>s.limit==='GAS MODEL LIMIT / VALVE CLOSED'));
 assert.ok(run.landing!.burnStart!==null);
 for(const s of run.samples)for(const v of Object.values(s))if(typeof v==='number')assert.ok(Number.isFinite(v));
});
