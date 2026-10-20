import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,G,INVERT_RIG,initialGas,invertState,simulateInvert as solveInvert,invertRotation,invertDeckGap,sampleAt,invertCsv} from '../src/physics.ts';
import {invertPose,invertPrediction,invertDamage} from '../src/invert.js';

// Keep analytic stationary-deck regression cases explicit.
const simulateInvert=(c:typeof DEFAULTS,dt=.002)=>solveInvert({...c,invertStart:c.angle},dt);
const close=(a:number,b:number,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);

test('Invert holds upright and inverted with enough contact/friction; tank stays sealed',()=>{
 for(const angle of [0,180]){
  const c={...DEFAULTS,angle},r=simulateInvert(c),g=initialGas(c);
  assert.equal(r.status,'HELD');assert.equal(r.invert!.impactAt,null);assert.equal(invertPrediction(r).outcome,'HELD');
  for(const s of r.samples){close(s.x,r.samples[0].x);close(s.y,r.samples[0].y);assert.equal(s.v,0);assert.equal(s.contact,1);assert.equal(s.gas,g.mass);assert.equal(s.temp,g.temp);assert.equal(s.u,g.u);assert.equal(s.flow,0);}
  assert.deepEqual(r.finalGas,g);assert.equal(r.used,0);close(r.samples.at(-1)!.energy,r.invert!.fanPower*INVERT_RIG.holdTime);
 }
});

test('Invert no-fan inverted release is ballistic with exact first ground contact',()=>{
 const r=simulateInvert({...DEFAULTS,angle:180,fan:0}),i=r.invert!,first=r.samples[0],last=r.samples.at(-1)!;
 assert.equal(r.status,'IMPACT');assert.equal(i.detachAt,0);assert.equal(i.detachReason,'NORMAL CONTACT LOST');
 const drop=INVERT_RIG.height-2*INVERT_RIG.bodyHalfHeight;
 close(i.impactAt!,Math.sqrt(2*drop/G));close(i.impactSpeed!,Math.sqrt(2*G*drop));close(last.clearance!,0);
 for(const s of r.samples){close(s.x,first.x);close(s.y,first.y-.5*G*s.t*s.t);close(s.vy,-G*s.t);assert.equal(s.normal,0);assert.equal(s.downforce,0);assert.equal(s.tire,0);assert.equal(s.energy,0);}
});

test('friction failure slides to the finite seal boundary, then loses all suction',()=>{
 const c={...DEFAULTS,angle:90,fan:40},r=simulateInvert(c),i=r.invert!,load=invertState(c),a=(load.demand-load.available)/(c.mass+initialGas(c).mass);
 assert.equal(r.status,'IMPACT');assert.ok(i.sealAt!>0);close(i.sealAt!,Math.sqrt(2*(INVERT_RIG.halfLength-INVERT_RIG.bodyHalfLength)/a));
 close(i.detachAt!,i.sealAt!);const edge=sampleAt(r,i.sealAt!);assert.equal(edge.contact,0);assert.equal(edge.downforce,0);assert.equal(edge.normal,0);assert.equal(edge.tire,0);
 const limits=r.samples.filter(s=>s.t===i.sealAt);assert.equal(limits.length,2);assert.ok(limits[0].downforce>0);assert.equal(limits[1].downforce,0);
 for(const s of r.samples.filter(s=>s.t<i.sealAt!))close(s.along!,-.5*a*s.t*s.t);
 const end=r.samples.at(-1)!;close(end.energy,load.power*i.sealAt!);close(end.clearance!,0);
});

test('upper deck retains gravity contact after seal loss and stops at ground before clipping',()=>{
 const r=simulateInvert({...DEFAULTS,angle:60,fan:0,grip:.4}),i=r.invert!;
 assert.ok(i.sealAt!>0);assert.equal(i.detachAt,null);assert.equal(r.status,'IMPACT');
 const after=sampleAt(r,i.sealAt!+.05);assert.equal(after.downforce,0);assert.equal(after.contact,1);assert.ok(after.normal!>0);assert.ok(after.tire>0);
 close(r.samples.at(-1)!.clearance!,0);assert.ok(r.samples.every(s=>s.y>=0&&s.clearance!>=0));
});

test('Invert mechanical energy accounts for friction and fan electrical work independently',()=>{
 for(const config of [{angle:90,fan:40},{angle:60,fan:0,grip:.4},{angle:120,fan:60}]){
  const c={...DEFAULTS,...config},r=simulateInvert(c),first=r.samples[0],last=r.samples.at(-1)!,mass=c.mass+first.gas;
  close(mass*G*(first.y-last.y)-.5*mass*last.v**2,r.invert!.frictionWork,1e-6);
  let work=0;for(let k=1;k<r.samples.length;k++){const a=r.samples[k-1],b=r.samples[k];work+=(a.tire+b.tire)/2*Math.abs(b.along!-a.along!);}
  close(work,r.invert!.frictionWork,1e-5);
  assert.ok(r.invert!.fanPower<=c.power*1000+1e-8);
 }
 const lowPower=simulateInvert({...DEFAULTS,power:.1});assert.ok(lowPower.invert!.fanPower<=100+1e-8);
});

test('threshold equality is intact; cosmetic damage is deterministic and never precedes impact',()=>{
 const c={...DEFAULTS,fan:0},base=simulateInvert(c),speed=base.invert!.impactSpeed!;
 for(const [threshold,outcome] of [[speed-.01,'WRECKED'],[speed,'INTACT'],[speed+.01,'INTACT']] as const){
  const r=simulateInvert({...c,wreckSpeed:threshold});assert.equal(r.invert!.outcome,outcome);assert.deepEqual(r.samples,base.samples);
  assert.equal(invertDamage(r,0).wrecked,false);assert.equal(invertDamage(r,r.invert!.impactAt!-.0001).wrecked,false);
  assert.equal(invertDamage(r,r.invert!.impactAt!).wrecked,outcome==='WRECKED');assert.deepEqual(invertDamage(r,0),invertDamage(r,0));
 }
});

test('Invert event times are invariant to sample spacing; world pose reconstructs deck and free flight',()=>{
 const c={...DEFAULTS,angle:120,fan:60},a=simulateInvert(c,.01),b=simulateInvert(c,.001);
 assert.deepEqual(a.invert,b.invert);assert.deepEqual(a.samples.at(-1),b.samples.at(-1));
 const first=a.samples[0],pose=invertPose(first,INVERT_RIG);close(pose.position[0],0);close(pose.position[1],INVERT_RIG.height);
 const finalPose=invertPose(a.samples.at(-1),INVERT_RIG);assert.ok(finalPose.position[1]<pose.position[1]);
 assert.equal(finalPose.angle,first.angle);
});

test('Invert corners/export remain finite; unresolved windows never invent an impact',()=>{
 for(const angle of [0,45,89.999,90,90.001,135,180])for(const fan of [0,40,100]){
  const c={...DEFAULTS,angle,fan},r=simulateInvert(c,.01);
  for(const s of r.samples)for(const value of Object.values(s))if(typeof value==='number')assert.ok(Number.isFinite(value));
  assert.ok(!/NaN|Infinity/.test(invertCsv(r,c)));
  assert.equal(invertDamage(r,0).wrecked,false);
 }
 // Just above static-friction onset: the finite run may end before departure.
 let lo=0,hi=90;for(let j=0;j<45;j++){const angle=(lo+hi)/2;if(invertState({...DEFAULTS,angle,fan:0,grip:.4}).status==='SLIDING')hi=angle;else lo=angle;}
 const r=simulateInvert({...DEFAULTS,angle:hi+.001,fan:0,grip:.4});assert.equal(r.status,'TIME LIMIT');assert.equal(r.invert!.impactAt,null);assert.equal(invertPrediction(r).outcome,'UNRESOLVED');
 for(const change of [{angle:NaN},{angle:181},{fan:-1},{grip:-1},{leak:101}])assert.throws(()=>simulateInvert({...DEFAULTS,...change}));
 assert.throws(()=>simulateInvert(DEFAULTS,0));
});


test('rotating platform starts at rest, reaches the final angle smoothly, and holds',()=>{
 for(const setup of [{invertStart:0,angle:180},{invertStart:180,angle:0},{invertStart:30,angle:120}]){
  const c={...DEFAULTS,...setup,fan:100},r=solveInvert(c);
  close(r.samples[0].platformAngle!,c.invertStart*Math.PI/180);close(r.samples[0].v,0);
  const mid=sampleAt(r,c.invertDuration/2),last=r.samples.at(-1)!;
  close(mid.platformAngle!,(c.invertStart+c.angle)/2*Math.PI/180,1e-8);
  close(last.platformAngle!,c.angle*Math.PI/180);close(last.platformOmega!,0);close(last.t,c.invertDuration+2);
  assert.equal(r.status,'HELD');assert.ok(r.invert!.events.some(e=>e.label==='ROTATION COMPLETE'));
  close(invertRotation(c,0).omega,0);close(invertRotation(c,0).alpha,0);close(invertRotation(c,c.invertDuration).alpha,0);
  const gas=initialGas(c);assert.deepEqual(r.finalGas,gas);
  for(const s of r.samples){assert.equal(s.gas,gas.mass);assert.equal(s.u,gas.u);assert.equal(s.flow,0);}
  close(last.energy,r.invert!.fanPower*last.t);
  for(const s of r.samples.filter(s=>s.contact)){
   const mass=c.mass+s.gas,a=s.angle!;
   close(s.a,Math.hypot(s.alongForce!/mass-G*Math.sin(a),(s.normal!-s.downforce)/mass-G*Math.cos(a)),1e-9);
  }
 }
});

test('rotation accounts for angular contact loads and inherited velocity on detachment',()=>{
 const c={...DEFAULTS,fan:0},r=solveInvert(c),i=r.invert!;
 assert.equal(r.status,'DECK CONTACT LIMIT');assert.ok(i.detachAt!>0);assert.ok(i.detachAt!<c.invertDuration);
 assert.equal(i.impactAt,null);assert.equal(i.impactSpeed,null);assert.equal(invertPrediction(r).outcome,'UNRESOLVED');
 const limits=r.samples.filter(s=>s.t===i.detachAt);assert.equal(limits.length,2);assert.equal(limits[0].contact,1);assert.equal(limits[1].contact,0);
 const departed=limits[1];assert.ok(Math.abs(departed.vx!)>.01);
 for(const s of r.samples.filter(s=>s.t>=i.detachAt!)){
  close(s.bodyOmega!,departed.bodyOmega!);close(s.angle!,departed.angle!+departed.bodyOmega!*(s.t-i.detachAt!));close(s.vx!,departed.vx!);
  close(s.vy,departed.vy-G*(s.t-i.detachAt!));assert.equal(s.downforce,0);assert.equal(s.normal,0);assert.equal(s.tire,0);
 }
 assert.notEqual(r.samples.at(-1)!.platformAngle,departed.platformAngle);assert.ok(r.samples.at(-1)!.clearance!>0);
 for(const s of r.samples.filter(s=>!s.contact))assert.ok(invertDeckGap(s as any)>-1.001e-6);
 assert.ok(!/NaN|Infinity/.test(invertCsv(r,c)));assert.match(invertCsv(r,c).split('\n')[0],/platform_angle_rad/);
});

test('prescribed rig work and dissipated friction close COM mechanical energy',()=>{
 for(const fan of [0,40,80,100]){
  const c={...DEFAULTS,fan},r=solveInvert(c),a=r.samples[0],b=r.samples.at(-1)!,mass=c.mass+a.gas;
  const inertia=mass*((2*INVERT_RIG.bodyHalfLength)**2+(2*INVERT_RIG.bodyHalfHeight)**2)/12;
  const change=.5*mass*(b.v*b.v-a.v*a.v)+.5*inertia*((b.bodyOmega??0)**2-(a.bodyOmega??0)**2)+mass*G*(b.y-a.y);
  close(change,r.invert!.platformWork!-r.invert!.frictionWork,.05);
  assert.ok(r.invert!.frictionWork>=0);
 }
});

test('rotating event outcomes converge with timestep and remain finite at control corners',()=>{
 for(const fan of [0,40,80]){
  const c={...DEFAULTS,fan},a=solveInvert(c,.002),b=solveInvert(c,.001),d=solveInvert(c,.0005);
  assert.equal(a.status,d.status);assert.equal(a.invert!.outcome,d.invert!.outcome);
  if(a.invert!.impactAt!==null){
   close(a.invert!.impactAt!,d.invert!.impactAt!,.0001);close(b.invert!.impactAt!,d.invert!.impactAt!,.00003);
   close(a.invert!.impactSpeed!,d.invert!.impactSpeed!,.001);
  }
 }
 for(const invertStart of [0,90,180])for(const angle of [0,90,180])for(const invertDuration of [1,20]){
  const c={...DEFAULTS,invertStart,angle,invertDuration,fan:0},r=solveInvert(c,.01);
  for(const s of r.samples)for(const v of Object.values(s))if(typeof v==='number')assert.ok(Number.isFinite(v));
  assert.ok(!/NaN|Infinity/.test(invertCsv(r,c)));
 }
 for(const change of [{invertStart:NaN},{invertStart:-1},{invertStart:181},{invertDuration:0},{invertDuration:21}])assert.throws(()=>solveInvert({...DEFAULTS,...change}));
});
