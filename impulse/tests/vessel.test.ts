import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS as BASE_DEFAULTS,simulateLaunch,simulateHop,sampleAt} from '../src/physics.ts';
import {dischargeEvents,vesselDisplay,VESSEL_METRICS,DELIVERY_METRICS} from '../src/vessel.js';
import {axisDomain,tracePath} from '../src/plots.js';
const DEFAULTS={...BASE_DEFAULTS,heatTransfer:0};

test('vessel plots convert SI samples without changing the modeled inventory',()=>{
  const sample={pressure:40101325,temp:293.15,gas:125};
  const view=vesselDisplay(sample,250);
  assert.equal(view.pressure,401.01325);assert.equal(view.celsius,20);
  assert.equal(view.fraction,.5);assert.equal(view.mass,125);
  assert.deepEqual(VESSEL_METRICS.map(m=>m.key),['pressure','temp','gas','heatRate','heatEnergy']);
  assert.deepEqual(DELIVERY_METRICS.map(m=>m.key),['flow','thrust','nozzlePressure','nozzleTemp','nozzleMach']);
});

test('observed discharge markers distinguish closed tanks, flow, and unsupported stops',()=>{
  const samples=[{t:0,flow:0},{t:.5,flow:20},{t:1.5,flow:0},{t:6,flow:0}];
  assert.deepEqual(dischargeEvents({samples,status:'COMPLETE'}),[{t:.5,label:'FLOW ON'},{t:1.5,label:'FLOW OFF'}]);
  assert.deepEqual(dischargeEvents({samples:[{t:0,flow:0}],status:'COMPLETE'}),[]);
  assert.deepEqual(dischargeEvents({samples:samples.slice(0,2),status:'OUT OF TABLE'}),[{t:.5,label:'FLOW ON'},{t:.5,label:'RUN STOP'}]);
});

test('delayed blowdown readouts and events follow simulation samples; coast holds state',()=>{
  const run=simulateLaunch({...DEFAULTS,boostAt:.5},2),events=dischargeEvents(run);
  assert.ok(Math.abs(events[0].t-.5)<.011);assert.ok(Math.abs(events[1].t-2.5)<.011);
  const before=sampleAt(run,.25),during=sampleAt(run,1.5),after=sampleAt(run,4);
  assert.ok(during.gas<before.gas&&during.temp<before.temp&&during.pressure<before.pressure);
  for(const key of ['gas','temp','pressure'])assert.equal(after[key],sampleAt(run,5)[key]);
  assert.ok(run.samples.every(s=>VESSEL_METRICS.every(m=>Number.isFinite(s[m.key]*m.scale))));
});

test('Hop vessel plot endpoints follow its own duration, not the six-second launch clock',()=>{
  const run=simulateHop(DEFAULTS),end=run.samples.at(-1)!.t;
  const domain=axisDomain(run.samples.map(s=>s.temp),false);
  assert.ok(domain.lo>0&&domain.lo<=Math.min(...run.samples.map(s=>s.temp)));
  const path=tracePath(run.samples,'temp',1,domain,400,198,end);
  assert.ok(path.endsWith(`L382.00,${(28+(domain.hi-run.samples.at(-1)!.temp)/(domain.hi-domain.lo)*138).toFixed(2)}`));
  assert.ok(!path.includes('NaN'));assert.equal(dischargeEvents(run).at(-1)!.label,'FLOW OFF');
});


test('nozzle plots show only active flow and never bridge an inactive interval',()=>{
 const s=[{t:0,flow:1,nozzleTemp:240},{t:1,flow:0,nozzleTemp:900},{t:2,flow:1,nozzleTemp:220}];
 const path=tracePath(s,'nozzleTemp',1,{lo:200,hi:250},400,198,2,'flow');
 assert.equal((path.match(/M/g)||[]).length,2);assert.equal((path.match(/L/g)||[]).length,0);
 assert.ok(DELIVERY_METRICS.filter(m=>m.key.startsWith('nozzle')).every(m=>m.validKey==='flow'));
});
