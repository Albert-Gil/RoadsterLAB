import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,G,initialGas,turnTrack,simulateTurn,simulateTurnComparison,turnCsv,TURN_WHEELBASE,TURN_REAR_CG} from '../src/physics.ts';
import {turnSample,turnPrediction,turnRoadMesh} from '../src/turn.js';

const close=(a:number,b:number,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);

test('Turn has one-pass, both-pass and both-runoff scenarios without changing hardware',()=>{
 const defaultRun=simulateTurnComparison(DEFAULTS);
 assert.deepEqual(defaultRun.runs.map(r=>r.status),['OFF TRACK','CORNER CLEAR']);
 assert.deepEqual(simulateTurnComparison({...DEFAULTS,turnSpeed:60/3.6}).runs.map(r=>r.status),['CORNER CLEAR','CORNER CLEAR']);
 assert.deepEqual(simulateTurnComparison({...DEFAULTS,turnSpeed:160/3.6}).runs.map(r=>r.status),['OFF TRACK','OFF TRACK']);
 assert.ok(defaultRun.runs[0].turn!.gripLimited);assert.ok(!defaultRun.runs[1].turn!.gripLimited);
 assert.ok(turnPrediction(defaultRun.runs[0]).title.includes('lane'));
});

test('Turn constant speed and bicycle geometry reproduce a coordinated circle',()=>{
 const c={...DEFAULTS,turnSpeed:60/3.6},run=simulateTurn(c,1),info=run.turn!,first=run.samples[0];
 const beta=Math.atan(TURN_REAR_CG/TURN_WHEELBASE*Math.tan(c.turnSteer));
 close(info.beta,beta);close(info.requestedCurvature,Math.tan(c.turnSteer)*Math.cos(beta)/TURN_WHEELBASE);
 close(first.x,0);close(first.z!,0);close(first.course!,0);close(first.yaw!,-beta);
 for(const s of run.samples){close(s.v,c.turnSpeed);close(s.distance!,c.turnSpeed*s.t);close(Math.hypot(s.x,s.z!+1/info.curvature),1/info.curvature,1e-7);close(s.a,c.turnSpeed**2*info.curvature);}
});

test('combined tire force and shared electrical budget include the fan and drive load',()=>{
 for(const c of [DEFAULTS,{...DEFAULTS,power:30},{...DEFAULTS,leak:100},{...DEFAULTS,grip:.4}])for(const mode of [0,1]){
  const r=simulateTurn(c,mode),s=r.samples[0],i=r.turn!,mass=c.mass+s.gas;
  assert.ok(Math.hypot(i.driveForce,mass*s.a)<=c.grip*s.normal!+1e-6);
  assert.ok(i.fanPower+i.drivePower<=c.power*1000+1e-5);
  close(r.samples.at(-1)!.energy,(i.fanPower+i.drivePower)*r.samples.at(-1)!.t,1e-6);
  if(mode===0){assert.equal(i.fanPower,0);assert.equal(i.fanForce,0);}
 }
 const limited=simulateTurn({...DEFAULTS,power:.001},1);
 assert.equal(limited.status,'SPEED HOLD LIMIT');assert.equal(limited.samples.length,1);assert.equal(limited.samples[0].t,0);assert.equal(limited.turn!.laneExitAt,null);assert.equal(limited.turn!.outcome,'UNRESOLVED');
 const noGrip=simulateTurnComparison({...DEFAULTS,grip:0});
 for(const run of noGrip.runs){assert.equal(run.status,'SPEED HOLD LIMIT');assert.equal(run.samples[0].utilizationValid,0);}
 const fields=turnCsv(noGrip).split('\n').map(line=>line.split(',')),ratio=fields[0].indexOf('demand_capacity_ratio');
 assert.equal(fields[1][ratio],'');assert.equal(fields[1][ratio+1],'0');
});

test('gas inventory is unchanged; fan-off comparisons have exactly the same trace',()=>{
 const c={...DEFAULTS,fan:0},a=simulateTurn(c,0),b=simulateTurn(c,1),gas=initialGas(c);
 assert.deepEqual(a.samples,b.samples);assert.deepEqual(a.finalGas,gas);assert.deepEqual(b.finalGas,gas);
 for(const r of [a,b]){assert.equal(r.used,0);for(const s of r.samples){assert.equal(s.gas,gas.mass);assert.equal(s.u,gas.u);assert.equal(s.temp,gas.temp);assert.equal(s.flow,0);assert.equal(s.thrust,0);}}
});

test('road curvature is independent of steering; wrong steering can leave the lane with spare grip',()=>{
 const c={...DEFAULTS,turnSteer:2*Math.PI/180};
 assert.deepEqual(turnTrack(c),turnTrack(DEFAULTS));
 for(const r of simulateTurnComparison(c).runs){assert.equal(r.status,'OFF TRACK');assert.equal(r.turn!.gripLimited,false);}
 const tight=simulateTurn({...DEFAULTS,turnSpeed:30/3.6,turnSteer:15*Math.PI/180},1);
 assert.equal(tight.status,'OFF TRACK');assert.equal(tight.turn!.laneExitSide,'INNER');
});

test('lane departure uses the body envelope without stopping or sample-interval dependence',()=>{
 const c={...DEFAULTS,turnSteer:0},fine=simulateTurn(c,0,.001),coarse=simulateTurn(c,0,.2),end=fine.samples.at(-1)!;
 assert.deepEqual(fine.turn,coarse.turn);assert.deepEqual(end,coarse.samples.at(-1));
 const track=turnTrack(c),expected=(Math.sqrt((track.radius+track.width/2)**2-(track.radius+track.halfWidth)**2)-track.halfLength)/c.turnSpeed;
 close(fine.turn!.laneExitAt!,expected,.003);
 assert.equal(fine.turn!.exitAt,null,'straight car misses the corner exit');
 close(end.t,track.radius*track.sweep/c.turnSpeed+2);
 assert.ok(end.t>fine.turn!.laneExitAt!+1);
 assert.ok(end.x>50);assert.equal(end.z,0);assert.equal(end.yaw,0);
 const departure=fine.samples.find(s=>s.t===fine.turn!.laneExitAt)!;
 const after=fine.samples.find(s=>s.t>departure.t+.1)!;
 assert.ok(after.x>departure.x);close(after.v,c.turnSpeed);assert.ok(after.energy>departure.energy);
 assert.equal(after.limit,'OFF TRACK / CONTINUING');
});

test('clear exit requires the whole body to cross the exit gate',()=>{
 const r=simulateTurn(DEFAULTS,1),s=r.samples.at(-1)!,track=turnTrack(DEFAULTS),p=track.centerline.at(-1)!;
 const tx=Math.cos(track.sweep),tz=-Math.sin(track.sweep),fx=Math.cos(s.yaw!),fz=-Math.sin(s.yaw!),sx=Math.sin(s.yaw!),sz=Math.cos(s.yaw!);
 const extent=track.halfLength*Math.abs(fx*tx+fz*tz)+track.halfWidth*Math.abs(sx*tx+sz*tz);
 close((s.x-p.x)*tx+(s.z!-p.z)*tz-extent,0,1e-7);
 assert.ok(s.course!>track.sweep);
});

test('runoff has continuous motion, no damage rule and replayable departure events',()=>{
 const base=simulateTurn(DEFAULTS,0),at=base.turn!.laneExitAt!,end=base.samples.at(-1)!;
 assert.equal(base.turn!.outcome,'LEFT LANE');assert.ok(base.turn!.exitAt!>at+1);
 for(const threshold of [1,DEFAULTS.turnSpeed,100]){
  const r=simulateTurn({...DEFAULTS,wreckSpeed:threshold},0);assert.equal(r.turn!.outcome,'LEFT LANE');assert.deepEqual(r.samples,base.samples);
 }
 const before=turnSample(base,at-.001),after=turnSample(base,at+.1);
 assert.equal(before.ended,false);assert.equal(after.ended,false);assert.ok(after.sample.distance!>before.sample.distance!);
 const event=base.turn!.events.find(e=>e.label==='LEFT LANE');assert.equal(event!.t,at);
 const later=turnSample(base,end.t+10);assert.deepEqual(later.sample,end);assert.equal(later.ended,true);assert.equal(later.unsupported,false);
 const csv=turnCsv(simulateTurnComparison(DEFAULTS));assert.ok(csv.includes('lane_exit_time_s'));assert.ok(!csv.includes('impact_speed_m_s'));assert.ok(!csv.includes('WRECKED'));
});

test('fan command/leak change the available grip without altering the requested curve',()=>{
 const low=simulateTurn({...DEFAULTS,fan:40},1),high=simulateTurn(DEFAULTS,1),leaky=simulateTurn({...DEFAULTS,leak:100},1);
 assert.ok(high.turn!.lateralCapacity>low.turn!.lateralCapacity);assert.ok(high.turn!.lateralCapacity>leaky.turn!.lateralCapacity);
 close(high.turn!.requestedCurvature,low.turn!.requestedCurvature);close(high.turn!.requestedCurvature,leaky.turn!.requestedCurvature);
 assert.ok(high.samples[0].normal!>(DEFAULTS.mass+initialGas(DEFAULTS).mass)*G);
});

test('Turn corners, CSV and road meshes remain finite; invalid inputs are rejected',()=>{
 for(const change of [{turnSteer:0},{turnSteer:-15*Math.PI/180},{turnRadius:20,turnSweep:Math.PI/4,turnWidth:8,turnSpeed:180/3.6},{turnRadius:80,turnSweep:Math.PI*2/3,turnSpeed:30/3.6},{grip:.4,fan:0,leak:100,mass:2600,volume:80},{fan:100,mass:1200,pressure:651.01325}]){
  const c={...DEFAULTS,...change},result=simulateTurnComparison(c),csv=turnCsv(result);
  assert.ok(!/NaN|Infinity/.test(csv));assert.ok(csv.includes('front_steering_rad'));assert.ok(csv.includes('impulse-turn-runoff-v2'));
  for(const r of result.runs)for(const s of r.samples)for(const value of Object.values(s))if(typeof value==='number')assert.ok(Number.isFinite(value));
  const mesh=turnRoadMesh(result.track);assert.ok(mesh.p.length>0);assert.equal(mesh.p.length,mesh.n.length);assert.ok(mesh.p.every(Number.isFinite));
 }
 for(const change of [{turnSpeed:0},{turnSteer:NaN},{turnWidth:2},{turnRadius:Infinity},{turnSweep:0}])assert.throws(()=>simulateTurn({...DEFAULTS,...change}));
 assert.throws(()=>simulateTurn(DEFAULTS,1,0));
});
