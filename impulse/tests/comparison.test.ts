import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {Worker} from 'node:worker_threads';
import {gasFromPreset,DEFAULTS,initialGas,simulateComparison,comparisonSample,comparisonCsv,simulateLaunch,simulateHop,simulateInvert,simulateTurnComparison} from '../src/physics.ts';
import {launchPlacements,laneZ} from '../src/scene.js';
import {axisDomain,tracePath,plotEventLabels} from '../src/plots.js';
import {SimulationClient} from '../src/simulation-client.js';

test('served worker executes Launch, Hop, Invert and Turn with direct-solver parity',async()=>{
  const source=readFileSync(new URL('../src/simulation-worker.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  const airSource=readFileSync(new URL('../src/air-table.js',import.meta.url),'utf8');
  const airURL='data:text/javascript;base64,'+Buffer.from(airSource).toString('base64');
  const physicsSource=stripTypeScriptTypes(readFileSync(new URL('../src/physics.ts',import.meta.url),'utf8')).replace("'./air-table.js'",JSON.stringify(airURL));
  const physicsURL='data:text/javascript;base64,'+Buffer.from(physicsSource).toString('base64');
  // Execute the actual browser-worker handler in an isolated Node worker; no network or UI.
  const bootstrap=`const {parentPort}=require('node:worker_threads');import(${JSON.stringify(physicsURL)}).then(({simulateComparison,simulateHop,simulateInvert,simulateTurnComparison})=>{const self={postMessage:message=>parentPort.postMessage(message)};${source};parentPort.on('message',data=>self.onmessage({data}));});`;
  const worker=new Worker(bootstrap,{eval:true});
  try{
    const received=new Promise<any>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
    worker.postMessage({id:7,config:DEFAULTS,gas:initialGas(DEFAULTS)});
    const data=await received;assert.equal(data.id,7);assert.ok(!data.error);
    const direct=simulateComparison(DEFAULTS);
    assert.deepEqual(data.result,direct);
    assert.ok(direct.runs[0].sixty!>direct.runs[1].sixty!&&direct.runs[1].sixty!>direct.runs[2].sixty!);
    const hopReceived=new Promise<any>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
    const hopConfig={...DEFAULTS,landingBurn:1,pulse:.2};
    worker.postMessage({id:8,kind:'hop',config:hopConfig,gas:initialGas(hopConfig)});
    const hopData=await hopReceived;assert.ok(!hopData.error);assert.equal(hopData.id,8);
    assert.deepEqual(hopData.result.runs[2],simulateHop(hopConfig));
    assert.equal(hopData.result.duration,hopData.result.runs[2].samples.at(-1).t);
    const manualConfig={...hopConfig,landingBurn:2,manualBurnAt:1.48};
    const manualReceived=new Promise<any>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
    worker.postMessage({id:9,kind:'hop',config:manualConfig,gas:initialGas(manualConfig)});
    const manualData=await manualReceived;assert.ok(!manualData.error);
    assert.deepEqual(manualData.result.runs[2],simulateHop(manualConfig));
    assert.ok(manualData.result.runs[2].landing.burnStart!==null);
    const invertConfig={...DEFAULTS,angle:90,fan:40};
    const invertReceived=new Promise<any>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
    worker.postMessage({id:10,kind:'invert',config:invertConfig,gas:initialGas(invertConfig)});
    const invertData=await invertReceived;assert.ok(!invertData.error);
    assert.deepEqual(invertData.result.runs[2],simulateInvert(invertConfig));
    assert.equal(invertData.result.duration,invertData.result.runs[2].samples.at(-1).t);
    assert.equal(invertData.result.runs[2].status,'DECK CONTACT LIMIT');
    assert.equal(invertData.result.runs[2].invert.impactAt,null);
    const turnReceived=new Promise<any>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
    worker.postMessage({id:11,kind:'turn',config:DEFAULTS,gas:initialGas(DEFAULTS)});
    const turnData=await turnReceived;assert.ok(!turnData.error);
    assert.deepEqual(turnData.result,simulateTurnComparison(DEFAULTS));


  }finally{await worker.terminate();}
});

test('latest-request controller coalesces queued inputs and caches only exact configurations',async()=>{
  const posted:any[]=[];const fake:any={postMessage:(message:any)=>posted.push(message)};
  const client=new SimulationClient(()=>fake),gas=initialGas(DEFAULTS);
  const old=client.compute(DEFAULTS,gas).catch((e:any)=>e.name);
  const middle=client.compute({...DEFAULTS,grip:.8},gas).catch((e:any)=>e.name);
  const latest=client.compute({...DEFAULTS,grip:.6},gas);
  assert.equal(posted.length,1);
  fake.onmessage({data:{id:posted[0].id,result:{tag:'old'}}});
  assert.equal(posted.length,2);assert.equal(posted[1].config.grip,.6);
  fake.onmessage({data:{id:posted[1].id,result:{tag:'latest'}}});
  assert.equal(await old,'AbortError');assert.equal(await middle,'AbortError');
  assert.deepEqual(await latest,{tag:'latest'});
  assert.deepEqual(await client.compute({...DEFAULTS,grip:.6},gas),{tag:'latest'});
  assert.equal(posted.length,2);
});

test('cancelled calculations never publish into a different experiment',async()=>{
  const posted:any[]=[];const fake:any={postMessage:(message:any)=>posted.push(message)};
  const client=new SimulationClient(()=>fake);
  const request=client.compute(DEFAULTS,initialGas(DEFAULTS)).catch((e:any)=>e.name);
  client.cancel();fake.onmessage({data:{id:posted[0].id,result:{tag:'late'}}});
  assert.equal(await request,'AbortError');assert.equal(client.latest,null);
});

test('launch lane coordinates preserve uncompressed separation in a shared frame',()=>{
  const entries=[0,1,2].map((mode,i)=>({mode,sample:{x:[30,140,330][i]},visible:true}));
  const positions=launchPlacements(entries,180);
  assert.equal(positions[2].x-positions[0].x,300);
  assert.equal(positions[0].z,laneZ(0));assert.equal(positions[2].z,laneZ(2));
  assert.equal(positions.filter(e=>e.x===0).length,0);
});

test('aborted runs end their traces and label late inspection as unsupported',()=>{
  const run=simulateLaunch({...DEFAULTS,mass:400,grip:5,power:5000,fan:0,nozzle:2},0);
  const state=comparisonSample(run,6);
  assert.equal(state.unsupported,true);assert.equal(state.ended,true);assert.equal(state.status,'CONTACT LIMIT');
  const domain=axisDomain(run.samples.map(s=>s.x));
  const path=tracePath(run.samples,'x',1,domain,900,198);
  assert.ok(!path.includes('NaN'));assert.equal(run.samples.at(-1)!.t,0);
});

test('plot domains contain negative acceleration and all scenario extrema',()=>{
  const domain=axisDomain([-12,0,42]);assert.ok(domain.lo<=-12&&domain.hi>=42);
  const zero=axisDomain([0,0,0]);assert.ok(zero.hi>zero.lo);
});

test('comparison export contains only supported samples with configuration and SI units',()=>{
  const sample={t:0,x:0,v:0,a:1,pressure:101325,temp:293,gas:1,thrust:0,tire:1,downforce:0,flow:0,energy:0};
  const result:any={config:DEFAULTS,initialGas:initialGas(DEFAULTS),version:'test',runs:[0,1,2].map(()=>({samples:[sample],status:'COMPLETE'}))};
  const csv=comparisonCsv(result),rows=csv.split('\n');
  assert.equal(rows.length,4);assert.ok(rows[0].includes('acceleration_m_s2'));
  assert.ok(rows[0].includes('initial_u_J_kg'));assert.ok(rows[1].includes('""pressure""'));
  assert.ok(!csv.includes('NaN'));
});


test('an unspent focused tank survives inversion roundoff in shared links',()=>{
 const gas=simulateLaunch(DEFAULTS,1).finalGas;
 const params=new URLSearchParams({gasMass:String(gas.mass),gasTemp:String(gas.temp),gasU:String(gas.u)});
 const restored=gasFromPreset(DEFAULTS,params);assert.ok(restored);
 assert.equal(restored.mass,gas.mass);assert.equal(restored.temp,gas.temp);
});


test('Launch and Hop cache entries are isolated for identical hardware and fill',async()=>{
 const posted:any[]=[];const fake:any={postMessage:(message:any)=>posted.push(message)};
 const client=new SimulationClient(()=>fake),gas=initialGas(DEFAULTS);
 const launch=client.compute(DEFAULTS,gas);fake.onmessage({data:{id:posted[0].id,result:{tag:'launch'}}});await launch;
 const hop=client.compute(DEFAULTS,gas,'hop');assert.equal(posted.length,2);assert.equal(posted[1].kind,'hop');
 fake.onmessage({data:{id:posted[1].id,result:{tag:'hop'}}});assert.deepEqual(await hop,{tag:'hop'});
 assert.deepEqual(await client.compute(DEFAULTS,gas),{tag:'launch'});
});

test('crowded event captions stay inside small plots without losing event markers',()=>{
 const events=[{t:0,label:'ENTRY'},{t:.001,label:'LIFT-OFF'},{t:.002,label:'PULSE END'},{t:1.065,label:'NO FAN LEFT LANE'},{t:2.348,label:'FAN EXIT'},{t:2.748,label:'NO FAN RUN END'}];
 for(const width of [250,320,500]){
  const labels=plotEventLabels(events,width,2.748);
  assert.deepEqual(labels.map(e=>e.t),events.map(e=>e.t));
  assert.ok(labels.some(e=>e.row<0),'crowding hides a caption, never its marker');
  for(const label of labels.filter(e=>e.row>=0)){
   assert.ok(label.x>=54);assert.ok(label.x+label.text.length*5.2<=width-20+1e-7);
   for(const other of labels.filter(e=>e!==label&&e.row===label.row))assert.ok(label.x+label.text.length*5.2+5<other.x||other.x+other.text.length*5.2+5<label.x);
  }
 }
});
