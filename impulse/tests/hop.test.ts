import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,G,gaugeToAbsoluteBar,simulateHop,sampleAt} from '../src/physics.ts';
import {hopSummary,hopPhase,hopPosition,HOP_METRICS} from '../src/hop.js';
import {Scene} from '../src/scene.js';

test('Hop apex and signed velocity follow the ballistic solution after pulse closure',()=>{
  const run=simulateHop(DEFAULTS),summary=hopSummary(run,DEFAULTS),burnout=sampleAt(run,DEFAULTS.pulse);
  assert.ok(summary.apex&&summary.touchdown);
  assert.ok(Math.abs(summary.apex.t-(DEFAULTS.pulse+burnout.vy/G))<1e-6);
  assert.ok(Math.abs(summary.peakHeight-(burnout.y+burnout.vy**2/(2*G)))<1e-5);
  assert.ok(sampleAt(run,summary.apex.t+.2).vy<0);
  assert.equal(hopPhase(run,sampleAt(run,summary.apex.t),summary.apex.t,DEFAULTS,summary),'APEX');
  assert.equal(hopPhase(run,run.samples.at(-1),summary.duration,DEFAULTS,summary),'TOUCHDOWN');
  assert.deepEqual(HOP_METRICS.map(m=>m.key),['y','vy','a']);
});

test('No-lift runs end at exact valve closure with the displayed final inventory',()=>{
  const config={...DEFAULTS,pressure:gaugeToAbsoluteBar(20),nozzle:2,pulse:.173};
  const run=simulateHop(config),end=run.samples.at(-1)!,summary=hopSummary(run,config);
  assert.equal(run.status,'INSUFFICIENT LIFT');assert.equal(end.t,config.pulse);
  assert.equal(end.flow,0);assert.equal(end.thrust,0);assert.equal(end.gas,run.finalGas.mass);
  assert.ok(run.samples.every(s=>s.y===0&&s.vy===0&&Number.isFinite(s.temp)));
  assert.equal(summary.apex,null);assert.equal(summary.touchdown,null);
  assert.equal(hopPhase(run,end,end.t,config,summary),'NO LIFT');
});

test('Pulse changes alter physical height and time; invalid timesteps fail immediately',()=>{
  const short=simulateHop({...DEFAULTS,pulse:.2}),long=simulateHop({...DEFAULTS,pulse:1.2});
  assert.ok(long.peakHeight>short.peakHeight*3);
  assert.ok(long.samples.at(-1)!.t>short.samples.at(-1)!.t);
  for(const dt of [0,-.002,NaN,Infinity])assert.throws(()=>simulateHop(DEFAULTS,dt),/timestep/);
  assert.deepEqual(hopPosition({y:250,vy:-40}),[0,250,0]);
});

test('Hop renderer keeps metre-scale height, follows altitude, and fits the full envelope',()=>{
  const previous=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
  try{
    const gl:any={viewport(){},clearColor(){},clear(){},COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2,uniform3fv(){},uniform1f(){}};
    const roots:any[]=[];
    const scene:any=Object.assign(Object.create(Scene.prototype),{gl,loc:{},canvas:{dataset:{},clientWidth:900,clientHeight:500,width:900,height:500},draw(){},car(root:any){roots.push(root);}});
    const hop={peakHeight:30,apex:{t:3,height:30}},sample={x:0,y:24,vy:-8,v:8,thrust:0,gas:100};
    scene.setCamera('hop-track');scene.render({sample,c:DEFAULTS,experiment:'hop',mode:2,hop});
    assert.equal(roots.at(-1)[13],24);assert.equal(scene.canvas.dataset.hopVelocity,'-8');
    const projected=scene.project([0,24.65,0]);assert.ok(projected);assert.ok(Math.abs(projected[1]-250)<1);
    scene.setCamera('hop-field');scene.render({sample,c:DEFAULTS,experiment:'hop',mode:2,hop});
    assert.ok(scene.project([0,0,0]));assert.ok(scene.project([0,30+1.5,0]));
    assert.equal(roots.at(-1)[13],24);
  }finally{if(previous===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=previous;}
});

test('four Hop mounts remain visible as hardware without flow; zero flow draws no plumes',()=>{
 const calls:any[]=[];
 const scene:any=Object.assign(Object.create(Scene.prototype),{bodyMats:[],wheelMeshes:[[],[]],draw:(...args:any[])=>calls.push(args),drawM(){}});
 const root=[1,0,0,0,0,1,0,0,0,0,1,0,0,2,0,1];
 const sample={x:0,y:2,v:0,temp:293,flow:0,thrust:0};
 scene.car(root,false,sample,DEFAULTS,2,'hop');
 const hardware=calls.length;assert.equal(hardware,12);
 calls.length=0;scene.car(root,false,{...sample,flow:40,thrust:30000},DEFAULTS,2,'hop');
 assert.equal(calls.length,hardware+4);
 const plumes=calls.filter(call=>call[0]==='plume');
 assert.equal(new Set(plumes.map(call=>[call[1][0],call[1][2]].join(','))).size,4);
 for(const call of plumes)assert.ok(call[1][1]<.12,'all exhaust points down from the nozzles');
});
