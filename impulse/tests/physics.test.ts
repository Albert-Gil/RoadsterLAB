import { test } from 'node:test';
import assert from 'node:assert/strict';
import {gaugeToAbsoluteBar,absoluteToGaugeBar,presetPressure,IDEAL_GAS_MIN_TEMP,DEFAULTS,G,GAMMA,R,CV,ATM,nozzleFlow,initialGas,simulateLaunch,simulateHop,invertState,fanModel,sampleAt} from '../src/physics.ts';
test('sealed tank retains mass and temperature with no thrusters',()=>{const start=initialGas(DEFAULTS);for(const mode of [0,1]){const r=simulateLaunch(DEFAULTS,mode);assert.equal(r.finalGas.mass,start.mass);assert.equal(r.finalGas.temp,start.temp);assert.equal(r.used,0);}});
test('adiabatic tank follows analytical temperature-mass relation',()=>{const r=simulateLaunch(DEFAULTS),start=initialGas(DEFAULTS);for(const s of r.samples){const expected=start.temp*Math.pow(s.gas/start.mass,GAMMA-1);assert.ok(Math.abs(s.temp-expected)<.0001);assert.ok(s.pressure>=ATM);}});
test('discharged inventory agrees with integrated mass flow',()=>{const r=simulateLaunch(DEFAULTS);let discharged=0;for(let i=1;i<r.samples.length;i++){const a=r.samples[i-1],b=r.samples[i];discharged+=(b.t-a.t)*(a.flow+b.flow)/2;}assert.ok(Math.abs(discharged-r.used)/r.used<.005);});
test('time step convergence of acceleration milestone',()=>{const a=simulateLaunch(DEFAULTS,2,initialGas(DEFAULTS),.002),b=simulateLaunch(DEFAULTS,2,initialGas(DEFAULTS),.001);assert.ok(a.sixty!==null&&b.sixty!==null);assert.ok(Math.abs(a.sixty!-b.sixty!)/b.sixty!<.005);});
test('assistance improves default launch; second launch has less impulse',()=>{const a=simulateLaunch(DEFAULTS,0),b=simulateLaunch(DEFAULTS,1),c=simulateLaunch(DEFAULTS,2),d=simulateLaunch(DEFAULTS,2,c.finalGas);assert.ok(a.sixty!>b.sixty!&&b.sixty!>c.sixty!);assert.ok(d.sixty!>c.sixty!);assert.ok(d.used<c.used);});
test('nozzle stops at ambient and is continuous at choking boundary',()=>{assert.equal(nozzleFlow(ATM,293,.001).flow,0);assert.equal(nozzleFlow(ATM/2,293,.001).thrust,0);const p=ATM/Math.pow(2/(GAMMA+1),GAMMA/(GAMMA-1));const a=nozzleFlow(p*.999999,293,.001),b=nozzleFlow(p*1.000001,293,.001);assert.ok(Math.abs(a.flow-b.flow)/b.flow<.00001);assert.ok(Math.abs(a.thrust-b.thrust)/b.thrust<.00001);});
test('fan off gives zero suction and fan power; leakage reduces suction',()=>{assert.equal(fanModel({...DEFAULTS,fan:0}).downforce,0);assert.equal(fanModel({...DEFAULTS,fan:0}).power,0);assert.ok(fanModel({...DEFAULTS,leak:0}).downforce>fanModel({...DEFAULTS,leak:100}).downforce);});
test('ceiling contact and vertical sliding boundaries are distinct',()=>{assert.equal(invertState({...DEFAULTS,fan:0,angle:180}).status,'CONTACT LOST');assert.equal(invertState({...DEFAULTS,fan:0,angle:0}).status,'ATTACHED');assert.equal(invertState({...DEFAULTS,fan:0,angle:90}).status,'SLIDING');assert.equal(invertState(DEFAULTS).status,'ATTACHED');});
test('hop coast conserves mechanical energy until touchdown',()=>{const r=simulateHop(DEFAULTS),coast=r.samples.filter(s=>s.t>DEFAULTS.pulse+.01&&s.y>0);const energy=coast[0].vy**2/2+G*coast[0].y;for(const s of coast)assert.ok(Math.abs(s.vy**2/2+G*s.y-energy)<.00001);assert.ok(r.landingSpeed!>0);assert.ok(r.peakHeight>0);assert.equal(r.samples.at(-1)!.y,0);});
test('insufficient vertical thrust stays on the ground',()=>{const r=simulateHop({...DEFAULTS,pressure:20,nozzle:2});assert.equal(r.peakHeight,0);assert.equal(r.status,'INSUFFICIENT LIFT');});
test('parameter corners remain finite and inventories nonnegative',()=>{for(const mass of [1200,2600])for(const pressure of [20,350])for(const fan of [0,100]){const r=simulateLaunch({...DEFAULTS,mass,pressure,fan,nozzle:20,volume:80,grip:1.8});for(const s of r.samples){for(const value of Object.values(s))if(typeof value==='number')assert.ok(Number.isFinite(value));assert.ok(s.gas>0&&s.temp>0);}}});
test('front-axle lift aborts as CONTACT LIMIT',()=>{const r=simulateLaunch({...DEFAULTS,mass:400,grip:5,power:5000,fan:0,nozzle:2},0);assert.equal(r.status,'CONTACT LIMIT');assert.equal(r.samples.at(-1)!.limit,'CONTACT LIMIT');assert.ok(r.samples.at(-1)!.t<6);});
test('fan power is deducted from the shared electrical budget',()=>{const c={...DEFAULTS,fan:80},f=fanModel(c),r=simulateLaunch(c,1);const powered=r.samples.filter(s=>s.limit==='POWER LIMITED'&&s.v>15);assert.ok(powered.length>10);for(const s of powered)assert.ok(Math.abs(s.tire*s.v+f.power-c.power*1000)<1e-6);const a=simulateLaunch({...DEFAULTS,fan:50},1),b=simulateLaunch({...DEFAULTS,fan:100},1);const sa=a.samples.find(s=>s.limit==='POWER LIMITED'&&s.v>40)!;const sb=b.samples.find(s=>s.limit==='POWER LIMITED'&&Math.abs(s.v-sa.v)<1.5)!;assert.ok(sa.tire>sb.tire);});
test('choked thrust includes the exit-pressure term; unchoked pressure term is zero',()=>{const area=.001,temp=293,critical=Math.pow(2/(GAMMA+1),GAMMA/(GAMMA-1)),p=ATM/critical*2,choked=nozzleFlow(p,temp,area);const exitV=Math.sqrt(GAMMA*R*temp*2/(GAMMA+1)),pressureTerm=(p*critical-ATM)*area;assert.ok(pressureTerm>50);assert.ok(Math.abs(choked.thrust-(choked.flow*exitV+pressureTerm))<1e-9);const unchoked=nozzleFlow(ATM*1.15,temp,area);assert.ok(unchoked.flow>0);const ratio=ATM/(ATM*1.15),exitUnchoked=Math.sqrt(2*(CV+R)*temp*(1-Math.pow(ratio,(GAMMA-1)/GAMMA)));assert.ok(Math.abs(unchoked.thrust-unchoked.flow*exitUnchoked)<1e-9);});
test('electrical energy matches integrated tire and fan power; tank U follows adiabatic mass loss',()=>{const c={...DEFAULTS,fan:80},f=fanModel(c),r=simulateLaunch(c,1);let electrical=0;for(let i=1;i<r.samples.length;i++){const a=r.samples[i-1],b=r.samples[i];electrical+=(b.t-a.t)*((a.tire*a.v+f.power)+(b.tire*b.v+f.power))/2;}assert.ok(Math.abs(electrical-r.samples.at(-1)!.energy)/electrical<.001);const start=initialGas(DEFAULTS),boost=simulateLaunch(DEFAULTS);const u0=start.mass*CV*start.temp,uf=boost.finalGas.mass*CV*boost.finalGas.temp;assert.ok(Math.abs(uf/u0-Math.pow(boost.finalGas.mass/start.mass,GAMMA))<1e-8);assert.ok(r.samples.at(-1)!.energy>0);assert.ok(simulateLaunch(DEFAULTS,0).samples.at(-1)!.energy>0);});
test('sampleAt interpolates kinematic fields between stored frames',()=>{const r=simulateLaunch(DEFAULTS),a=r.samples[10],b=r.samples[11],mid=sampleAt(r,(a.t+b.t)/2);assert.ok(Math.abs(mid.v-(a.v+b.v)/2)<1e-9);assert.equal(sampleAt(r,0).t,0);assert.equal(sampleAt(r,99).limit,r.samples.at(-1)!.limit);assert.ok(r.hundred!==null&&r.sixty!==null&&r.hundred>r.sixty);});
test('invert reports analytic normal load and friction capacity',()=>{const weight=(DEFAULTS.mass+initialGas(DEFAULTS).mass)*G,level=invertState({...DEFAULTS,fan:0,angle:0});assert.ok(Math.abs(level.normal-weight)<1e-8);assert.equal(level.status,'ATTACHED');const inverted=invertState({...DEFAULTS,angle:180}),fan=fanModel(DEFAULTS);assert.ok(Math.abs(inverted.normal-(fan.downforce-weight))<1e-6);assert.ok(Math.abs(inverted.available-DEFAULTS.grip*Math.max(0,inverted.normal))<1e-8);});
test('hop blowdown conserves adiabatic inventory like launch',()=>{const r=simulateHop(DEFAULTS),start=initialGas(DEFAULTS);let discharged=0;for(let i=1;i<r.samples.length;i++){const a=r.samples[i-1],b=r.samples[i];discharged+=(b.t-a.t)*(a.flow+b.flow)/2;}assert.ok(r.used>0);assert.ok(Math.abs(discharged-r.used)/r.used<.005);for(const s of r.samples){if(s.gas<1e-6)continue;const expected=start.temp*Math.pow(s.gas/start.mass,GAMMA-1);assert.ok(Math.abs(s.temp-expected)<1e-4);}});

test('high impulse hop reaches apex and touchdown beyond six seconds',()=>{
 const r=simulateHop({...DEFAULTS,mass:1200,pressure:350,volume:600,nozzle:20,pulse:1.5});
 assert.equal(r.status,'TOUCHDOWN');assert.ok(r.samples.at(-1)!.t>6);
 assert.equal(r.samples.at(-1)!.y,0);assert.ok(r.landingSpeed!>0);
 const coast=r.samples.find(s=>s.t>1.52)!;
 const analyticPeak=coast.y+coast.vy**2/(2*G);
 assert.ok(Math.abs(r.peakHeight-analyticPeak)<.001);
});

test('gauge conversion and legacy links preserve absolute pressure',()=>{
 assert.equal(gaugeToAbsoluteBar(0)*1e5,ATM);
 assert.equal(DEFAULTS.volume,600);assert.equal(absoluteToGaugeBar(DEFAULTS.pressure),650);
 assert.equal(DEFAULTS.pressure*1e5,65101325);
 assert.equal(presetPressure(200,null),200);
 assert.equal(presetPressure(200,'bara'),200);
 assert.equal(presetPressure(650,'barg'),DEFAULTS.pressure);
 const c={...DEFAULTS,pressure:presetPressure(200,null),volume:200};
 assert.ok(Math.abs(initialGas(c).mass-200e5*.2/(R*293))<1e-10);
});
test('new default Hop converges with timestep refinement',()=>{
 const a=simulateHop(DEFAULTS),b=simulateHop(DEFAULTS,.001);
 assert.equal(a.status,'TOUCHDOWN');assert.equal(b.status,'TOUCHDOWN');
 assert.ok(Math.abs(a.peakHeight-b.peakHeight)/b.peakHeight<.005);
 assert.ok(Math.abs(a.landingSpeed!-b.landingSpeed!)/b.landingSpeed!<.005);
});
test('650 barg parameter corners retain positive finite inventory',()=>{
 for(const mass of [1200,2600])for(const volume of [80,600])for(const nozzle of [2,20]){
  const c={...DEFAULTS,mass,volume,nozzle,pulse:1.5};
  for(const r of [simulateLaunch(c),simulateHop(c)]){
   assert.ok(r.finalGas.mass>0&&r.finalGas.temp>0);
   for(const s of r.samples)for(const x of Object.values(s))if(typeof x==='number')assert.ok(Number.isFinite(x));
  }
 }
});
test('default runs start inside the ideal-gas temperature range; repeated launches leave it',()=>{
 const first=simulateLaunch(DEFAULTS),hop=simulateHop(DEFAULTS);
 assert.ok(first.finalGas.temp>IDEAL_GAS_MIN_TEMP);assert.ok(hop.finalGas.temp>IDEAL_GAS_MIN_TEMP);
 const second=simulateLaunch(DEFAULTS,2,first.finalGas);
 assert.ok(second.finalGas.temp<IDEAL_GAS_MIN_TEMP);
 assert.ok(second.samples.some(s=>s.temp<IDEAL_GAS_MIN_TEMP));
});
