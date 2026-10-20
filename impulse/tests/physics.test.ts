import { test } from 'node:test';
import assert from 'node:assert/strict';
import {gasFromPreset,gaugeToAbsoluteBar,absoluteToGaugeBar,presetPressure,DEFAULTS as BASE_DEFAULTS,G,ATM,R,nozzleFlow,initialGas,simulateLaunch,simulateHop,invertState,fanModel,sampleAt,gasValidity,withInternalEnergy,pressureOf} from '../src/physics.ts';
import {propsAtTR,AIR_R,AIR_T_MIN,rhoFromPT} from '../src/air-table.js';
const DEFAULTS={...BASE_DEFAULTS,heatTransfer:0};

test('sealed tank retains mass and temperature with no thrusters',()=>{const start=initialGas(DEFAULTS);for(const mode of [0,1]){const r=simulateLaunch(DEFAULTS,mode);assert.equal(r.finalGas.mass,start.mass);assert.ok(Math.abs(r.finalGas.temp-start.temp)<1e-3);assert.equal(r.used,0);}});
test('discharged inventory agrees with integrated mass flow',()=>{const r=simulateLaunch(DEFAULTS);let discharged=0;for(let i=1;i<r.samples.length;i++){const a=r.samples[i-1],b=r.samples[i];discharged+=(b.t-a.t)*(a.flow+b.flow)/2;}assert.ok(r.used>0);assert.ok(Math.abs(discharged-r.used)/r.used<.01);});
test('tank energy removal uses stagnation enthalpy independently of nozzle output',()=>{
 const c=DEFAULTS,start=initialGas(c),r=simulateLaunch(c);
 let removed=0;
 for(let i=1;i<r.samples.length;i++){
  const a=r.samples[i-1],b=r.samples[i];
  const ha=propsAtTR(a.temp,a.gas/(c.volume/1000)).h;
  const hb=propsAtTR(b.temp,b.gas/(c.volume/1000)).h;
  removed+=(b.t-a.t)*(a.flow*ha+b.flow*hb)/2;
 }
 const delta=start.mass*start.u-r.finalGas.mass*r.finalGas.u;
 assert.ok(Math.abs(delta-removed)/Math.max(1,Math.abs(removed))<.005);
 assert.ok(r.finalGas.temp<start.temp);
});

test('time step convergence of acceleration milestone',()=>{const a=simulateLaunch(DEFAULTS,2,initialGas(DEFAULTS),.002),b=simulateLaunch(DEFAULTS,2,initialGas(DEFAULTS),.001);assert.ok(a.sixty!==null&&b.sixty!==null);assert.ok(Math.abs(a.sixty!-b.sixty!)/b.sixty!<.01);});
test('assistance improves default launch; second launch has less impulse',()=>{const a=simulateLaunch(DEFAULTS,0),b=simulateLaunch(DEFAULTS,1),c=simulateLaunch(DEFAULTS,2),d=simulateLaunch(DEFAULTS,2,c.finalGas);assert.ok(a.sixty!>b.sixty!&&b.sixty!>c.sixty!);assert.ok(d.sixty!>c.sixty!);assert.ok(d.used<c.used);});
test('nozzle stops at ambient and rises with pressure',()=>{
  assert.equal(nozzleFlow(ATM,293,.001).flow,0);
  const low=nozzleFlow(ATM*1.5,293,.001),high=nozzleFlow(50e5,293,.001);
  assert.ok(low.flow>0&&high.flow>low.flow);
  assert.ok(high.thrust>low.thrust);
});
test('fan off gives zero suction and fan power; leakage reduces suction',()=>{assert.equal(fanModel({...DEFAULTS,fan:0}).downforce,0);assert.equal(fanModel({...DEFAULTS,fan:0}).power,0);assert.ok(fanModel({...DEFAULTS,leak:0}).downforce>fanModel({...DEFAULTS,leak:100}).downforce);});
test('ceiling contact and vertical sliding boundaries are distinct',()=>{assert.equal(invertState({...DEFAULTS,fan:0,angle:180}).status,'CONTACT LOST');assert.equal(invertState({...DEFAULTS,fan:0,angle:0}).status,'ATTACHED');assert.equal(invertState({...DEFAULTS,fan:0,angle:90}).status,'SLIDING');assert.equal(invertState(DEFAULTS).status,'ATTACHED');});
test('hop coast conserves mechanical energy until touchdown',()=>{const r=simulateHop(DEFAULTS),coast=r.samples.filter(s=>s.t>DEFAULTS.pulse+.01&&s.y>0);assert.ok(coast.length>5);const energy=coast[0].vy**2/2+G*coast[0].y;for(const s of coast)assert.ok(Math.abs(s.vy**2/2+G*s.y-energy)<.001);assert.ok(r.landingSpeed!>0);assert.ok(r.peakHeight>0);assert.equal(r.samples.at(-1)!.y,0);});
test('insufficient vertical thrust stays on the ground',()=>{const r=simulateHop({...DEFAULTS,pressure:20,nozzle:2});assert.equal(r.peakHeight,0);assert.equal(r.status,'INSUFFICIENT LIFT');});
test('parameter corners remain finite and inventories nonnegative',()=>{for(const mass of [1200,2600])for(const pressure of [50,350])for(const fan of [0,100]){const r=simulateLaunch({...DEFAULTS,mass,pressure,fan,nozzle:20,volume:80,grip:1.8});for(const s of r.samples){for(const value of Object.values(s))if(typeof value==='number')assert.ok(Number.isFinite(value));assert.ok(s.gas>0);}}});
test('front-axle lift aborts as CONTACT LIMIT',()=>{const r=simulateLaunch({...DEFAULTS,mass:400,grip:5,power:5000,fan:0,nozzle:2},0);assert.equal(r.status,'CONTACT LIMIT');assert.equal(r.samples.at(-1)!.limit,'CONTACT LIMIT');assert.ok(r.samples.at(-1)!.t<6);});
test('fan power is deducted from the shared electrical budget',()=>{const c={...DEFAULTS,fan:80},f=fanModel(c),r=simulateLaunch(c,1);const powered=r.samples.filter(s=>s.limit==='POWER LIMITED'&&s.v>15);assert.ok(powered.length>10);for(const s of powered)assert.ok(Math.abs(s.tire*s.v+f.power-c.power*1000)<1e-6);const a=simulateLaunch({...DEFAULTS,fan:50},1),b=simulateLaunch({...DEFAULTS,fan:100},1);const sa=a.samples.find(s=>s.limit==='POWER LIMITED'&&s.v>40)!;const sb=b.samples.find(s=>s.limit==='POWER LIMITED'&&Math.abs(s.v-sa.v)<1.5)!;assert.ok(sa.tire>sb.tire);});
test('electrical energy matches integrated tire and fan power',()=>{const c={...DEFAULTS,fan:80},f=fanModel(c),r=simulateLaunch(c,1);let electrical=0;for(let i=1;i<r.samples.length;i++){const a=r.samples[i-1],b=r.samples[i];electrical+=(b.t-a.t)*((a.tire*a.v+f.power)+(b.tire*b.v+f.power))/2;}assert.ok(Math.abs(electrical-r.samples.at(-1)!.energy)/electrical<.001);});
test('sampleAt interpolates kinematic fields between stored frames',()=>{const r=simulateLaunch(DEFAULTS),a=r.samples[10],b=r.samples[11],mid=sampleAt(r,(a.t+b.t)/2);assert.ok(Math.abs(mid.v-(a.v+b.v)/2)<1e-9);assert.equal(sampleAt(r,0).t,0);assert.equal(sampleAt(r,99).limit,r.samples.at(-1)!.limit);assert.ok(r.hundred!==null&&r.sixty!==null&&r.hundred>r.sixty);});
test('invert reports analytic normal load and friction capacity',()=>{const weight=(DEFAULTS.mass+initialGas(DEFAULTS).mass)*G,level=invertState({...DEFAULTS,fan:0,angle:0});assert.ok(Math.abs(level.normal-weight)<1e-8);assert.equal(level.status,'ATTACHED');const inverted=invertState({...DEFAULTS,angle:180}),fan=fanModel(DEFAULTS);assert.ok(Math.abs(inverted.normal-(fan.downforce-weight))<1e-6);assert.ok(Math.abs(inverted.available-DEFAULTS.grip*Math.max(0,inverted.normal))<1e-8);});
test('hop blowdown conserves mass inventory like launch',()=>{const r=simulateHop(DEFAULTS);let discharged=0;for(let i=1;i<r.samples.length;i++){const a=r.samples[i-1],b=r.samples[i];discharged+=(b.t-a.t)*(a.flow+b.flow)/2;}assert.ok(r.used>0);assert.ok(Math.abs(discharged-r.used)/r.used<.01);});
test('high impulse hop reaches apex and touchdown beyond six seconds',()=>{
 const r=simulateHop({...DEFAULTS,mass:1200,pressure:350,volume:600,nozzle:10,pulse:1});
 assert.equal(r.status,'TOUCHDOWN');assert.ok(r.samples.at(-1)!.t>6);
 assert.equal(r.samples.at(-1)!.y,0);assert.ok(r.landingSpeed!>0);
});
test('gauge conversion and legacy links preserve absolute pressure',()=>{
 assert.equal(gaugeToAbsoluteBar(0)*1e5,ATM);
 assert.equal(DEFAULTS.volume,600);assert.equal(absoluteToGaugeBar(DEFAULTS.pressure),400);
 assert.equal(presetPressure(200,null),200);
 assert.equal(presetPressure(400,'barg'),DEFAULTS.pressure);
 const c={...DEFAULTS,pressure:presetPressure(200,null),volume:200};
 const g=initialGas(c),ideal=200e5*.2/(R*293);
 // Near 200 bara, Z≈1 so inventory is only a fraction of a percent below ideal.
 assert.ok(Math.abs(g.mass/ideal-1)<.03);assert.ok(Number.isFinite(g.u));
 assert.ok(pressureOf(c,g)>ATM);
});
test('default fill mass is below ideal-gas inventory at 400 barg',()=>{
 const g=initialGas(DEFAULTS),ideal=DEFAULTS.pressure*1e5*(DEFAULTS.volume/1000)/(AIR_R*293);
 assert.ok(g.mass<ideal*0.95);
 const {rho,ok}=rhoFromPT(DEFAULTS.pressure*1e5,293);assert.equal(ok,true);
 assert.ok(Math.abs(g.mass-rho*(DEFAULTS.volume/1000))/g.mass<1e-9);
});
test('new default Hop converges with timestep refinement',()=>{
 const a=simulateHop(DEFAULTS),b=simulateHop(DEFAULTS,.001);
 assert.equal(a.status,'TOUCHDOWN');assert.equal(b.status,'TOUCHDOWN');
 assert.ok(Math.abs(a.peakHeight-b.peakHeight)/b.peakHeight<.01);
 assert.ok(Math.abs(a.landingSpeed!-b.landingSpeed!)/b.landingSpeed!<.01);
});
test('400 barg parameter corners retain positive finite inventory',()=>{
 for(const mass of [1200,2600])for(const volume of [80,600])for(const nozzle of [2,20]){
  const c={...DEFAULTS,mass,volume,nozzle,pulse:1.5};
  for(const r of [simulateLaunch(c),simulateHop(c)]){
   assert.ok(r.finalGas.mass>0&&r.finalGas.temp>=AIR_T_MIN-1e-6);
   for(const s of r.samples)for(const x of Object.values(s))if(typeof x==='number')assert.ok(Number.isFinite(x));
  }
 }
});
test('gasValidity accepts the default fill and rejects empty table states',()=>{
 const g=initialGas(DEFAULTS);assert.equal(gasValidity(DEFAULTS,g).ok,true);
 assert.equal(gasValidity(DEFAULTS,{mass:1e-9,temp:50,u:0}).ok,false);
 const restored=withInternalEnergy(DEFAULTS,{mass:g.mass,temp:g.temp});
 assert.ok(Math.abs(restored.u-g.u)/Math.abs(g.u)<.02);
});


test('nozzle answers are independent of call order even near ambient',()=>{
 nozzleFlow(110000,293,.001);const a=nozzleFlow(190000,293,.001);
 nozzleFlow(190000,293,.002);const b=nozzleFlow(190000,293,.001);
 assert.deepEqual(a,b);assert.ok(a.thrust>100);
 const h0=propsAtTR(293,rhoFromPT(190000,293).rho).h;
 assert.ok(Math.abs(a.he-h0)<1e-6);
});
test('Hop coast retains finite constant tank properties',()=>{
 const r=simulateHop(DEFAULTS),coast=r.samples.filter(s=>s.t>DEFAULTS.pulse+.01);
 assert.ok(coast.length>10);
 for(const s of coast){assert.ok(Number.isFinite(s.temp)&&Number.isFinite(s.pressure));assert.ok(Math.abs(s.temp-coast[0].temp)<.001);assert.ok(gasValidity(DEFAULTS,{mass:s.gas,temp:s.temp,u:s.u}).ok);}
});
test('legacy shares reconstruct absent or stale internal energy',()=>{
 const base=initialGas(DEFAULTS),mass=base.mass*.8,temp=250;
 const expected=propsAtTR(temp,mass/(DEFAULTS.volume/1000)).u;
 for(const gasU of [null,'','0','NaN',String(expected)]){
  const p=new URLSearchParams({gasMass:String(mass),gasTemp:String(temp)});
  if(gasU!==null)p.set('gasU',gasU);
  const gas=gasFromPreset(DEFAULTS,p);assert.ok(gas);
  assert.ok(Math.abs(gas.u-expected)<1e-6);assert.equal(gas.temp,temp);
 }
 assert.equal(gasFromPreset(DEFAULTS,new URLSearchParams({gasMass:'1',gasTemp:'50'})),null);
});


test('zero gauge and 650 barg limits give finite displayed trajectories',()=>{
 for(const pressure of [gaugeToAbsoluteBar(0),gaugeToAbsoluteBar(650)]){
  const c={...DEFAULTS,pressure,mass:1200,volume:80,nozzle:20,pulse:1.5};
  for(const r of [simulateLaunch(c),simulateHop(c)]){
   for(const sample of r.samples)for(const value of Object.values(sample))if(typeof value==='number')assert.ok(Number.isFinite(value));
   assert.ok(['COMPLETE','TOUCHDOWN','INSUFFICIENT LIFT','OUT OF TABLE','CONTACT LIMIT'].includes(r.status));
  }
 }
});
