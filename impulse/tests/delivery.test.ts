import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,ATM,valveOpening,gasDelivery,nozzleFlow,simulateHop,simulateLaunch} from '../src/physics.ts';
import {propsAtTR,rhoFromPT} from '../src/air-table.js';

test('valve opening is bounded and smooth; slower opening softens the same Launch pulse',()=>{
 assert.equal(valveOpening(0,.06),0);assert.equal(valveOpening(.03,.06),.5);assert.equal(valveOpening(.06,.06),1);
 assert.equal(valveOpening(0,0),1);assert.equal(valveOpening(-.01,.06),0);
 const c={...DEFAULTS,valveRise:.06,feedLoss:8},r=simulateLaunch(c),a=r.samples.find(s=>Math.abs(s.t-.01)<1e-8)!;
 assert.equal(r.status,'COMPLETE');assert.ok(a.valve!>0&&a.valve!<.1);assert.ok(a.flow>0);
 assert.equal(r.samples.findLast(s=>s.t===2)!.valve,0);
 assert.ok(r.samples.every(s=>s.valve!>=0&&s.valve!<=1));
});

test('bell expansion conserves throat flow and stagnation energy; feed loss preserves enthalpy',()=>{
 const p=400e5,T=293,area=.001,throat=nozzleFlow(p,T,area),bell=nozzleFlow(p,T,area,1.15);
 assert.ok(bell.ok&&bell.choked&&!bell.separated);assert.equal(bell.flow,throat.flow);
 assert.ok(bell.velocity!>throat.velocity!&&bell.exitPressure!<throat.exitPressure!&&bell.mach!>1);
 const exit=propsAtTR(bell.exitTemp!,rhoFromPT(bell.exitPressure!,bell.exitTemp!).rho);
 assert.ok(Math.abs(bell.he-exit.h-bell.velocity!**2/2)<1e-5);
 const delivered=gasDelivery({...DEFAULTS,feedLoss:8},p,T,area),tank=propsAtTR(T,rhoFromPT(p,T).rho);
 assert.ok(delivered.ok&&delivered.flow<throat.flow);assert.equal(delivered.inletPressure,ATM+(p-ATM)*.92);
 assert.equal(delivered.he,tank.h);
 const separated=nozzleFlow(2*ATM,293,area,1.5);assert.ok(separated.ok&&separated.separated);
 for(const ratio of [0,2,NaN])assert.throws(()=>nozzleFlow(p,T,area,ratio));
});

test('smooth-valve bell-nozzle Hop lands with finite output and closes mass/energy balances',()=>{
 const c={...DEFAULTS,pulse:.25,landingBurn:1,valveRise:.06,feedLoss:8,expansionRatio:1.15},r=simulateHop(c);
 assert.equal(r.status,'TOUCHDOWN');assert.ok(Math.abs(r.landingSpeed!-1.5)<.15);
 const first=r.samples[0],last=r.samples.at(-1)!;let out=0,heat=0,used=0;
 for(let i=1;i<r.samples.length;i++){
  const a=r.samples[i-1],b=r.samples[i],dt=b.t-a.t;
  out+=dt*(a.flow*a.he+b.flow*b.he)/2;heat+=dt*((a.heatRate??0)+(b.heatRate??0))/2;used+=dt*(a.flow+b.flow)/2;
 }
 const delta=last.gas*last.u-first.gas*first.u;
 assert.ok(Math.abs(delta-heat+out)/Math.max(1,Math.abs(delta))<2e-4);
 assert.ok(Math.abs(r.used-used)<.002);assert.equal(last.valve,0);
 assert.ok(r.samples.every(s=>Object.values(s).every(v=>typeof v!=='number'||Number.isFinite(v))));
});
