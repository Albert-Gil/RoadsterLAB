import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene,coldGasVisual} from '../src/scene.js';
import {DEFAULTS,simulateInvert,simulateTurnComparison} from '../src/physics.ts';
import {turnSample} from '../src/turn.js';

test('cold-gas visual envelope is finite, deterministic, delivery-gated and ground-clipped',()=>{
 const sample={t:.3,y:2,flow:70,thrust:50000};
 const a=coldGasVisual(sample,true);assert.deepEqual(a,coldGasVisual(sample,true));
 assert.ok(a.active&&a.ground>0&&a.length<=2.01&&a.core<=2.01);
 const high=coldGasVisual({...sample,y:40},true);assert.equal(high.ground,0);assert.ok(high.length<40);
 const launch=coldGasVisual(sample);assert.equal(launch.ground,0);assert.ok(launch.length>launch.core);
 const weak=coldGasVisual({...sample,flow:2,thrust:100});assert.ok(weak.length<launch.length&&weak.opacity<launch.opacity);
 for(const bad of [{flow:0,thrust:1},{flow:1,thrust:0},{flow:NaN,thrust:2},{flow:1,thrust:Infinity}]){
  const state=coldGasVisual(bad);assert.equal(state.active,false);assert.ok(Object.values(state).every(v=>typeof v==='boolean'||Number.isFinite(v)));
 }
});

test('every experiment initializes fog, lane and shadow uniforms before drawing',()=>{
  // Exercise the real render setup without requiring a GPU in CI.
  const previous=globalThis.devicePixelRatio;
  globalThis.devicePixelRatio=1;
  try {
    for(const experiment of ['launch','invert','hop']) {
      const written=new Map();
      const gl={viewport(){},clearColor(){},clear(){},COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2};
      for(const method of ['uniformMatrix4fv','uniform3fv','uniform1f'])gl[method]=(location,...values)=>{
        assert.ok(location,`${method} received an unknown uniform`);
        written.set(location,values.at(-1));
      };
      const loc=Object.fromEntries(['uEye','uTravel','uMVP','uShadows','uFogK','uLanes','uTime','uShadowYaw','uShadowHeight'].map(x=>[x,x]));
      const scene=Object.assign(Object.create(Scene.prototype),{
        gl,loc,canvas:{dataset:{},clientWidth:900,clientHeight:500,width:900,height:500},
        yaw:.88,elev:.22,zoom:6.6,draw(){},car(){}
      });
      scene.render({sample:{x:0,y:0,v:0},c:{angle:0},experiment,mode:2,compare:false,vectors:false});
      assert.ok(written.get('uFogK')>0,'zero fog divisor makes the scene dark');
      assert.equal(written.get('uLanes'),0);
      assert.equal(written.get('uShadows').length,9);
      assert.ok(written.get('uShadowHeight').every(Number.isFinite),'projected shadows need initialized SI heights');
    }
  } finally {
    if(previous===undefined)delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio=previous;
  }
});

test('comparison render places all three cars at their simulated separation',()=>{
  const previous=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
  try{
    const written=new Map(),cars=[];
    const gl={viewport(){},clearColor(){},clear(){},COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2};
    for(const method of ['uniformMatrix4fv','uniform3fv','uniform1f'])gl[method]=(location,...values)=>{
      assert.ok(location);written.set(location,values.at(-1));
    };
    const loc=Object.fromEntries(['uEye','uTravel','uMVP','uShadows','uFogK','uLanes','uTime','uShadowYaw','uShadowHeight'].map(x=>[x,x]));
    const scene=Object.assign(Object.create(Scene.prototype),{
      gl,loc,canvas:{dataset:{},clientWidth:900,clientHeight:500,width:900,height:500},
      yaw:2.5,elev:.36,zoom:6.6,cam:'field',draw(){},car(root){cars.push(root);}
    });
    const entries=[30,140,330].map((x,mode)=>({mode,visible:true,status:'ACTIVE',sample:{x,y:0,v:10}}));
    scene.render({sample:entries[2].sample,entries,c:{},experiment:'launch',mode:2});
    assert.equal(cars.length,3);assert.equal(cars[2][12]-cars[0][12],300);
    assert.equal(written.get('uLanes'),1);assert.ok(written.get('uFogK')>0);
    assert.ok(scene.annotations.every(e=>e.point!==null));
    cars.length=0;scene.cam='focus';
    scene.render({sample:entries[2].sample,entries,c:{},experiment:'launch',mode:2});
    assert.equal(cars.length,1,'focus camera isolates the selected car');
    assert.equal(scene.annotations.length,1);assert.equal(scene.annotations[0].mode,2);

  }finally{if(previous===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=previous;}
});

test('Invert renderer uses independent deck and solver-driven falling car transforms',()=>{
 const previous=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
 try{
  const run=simulateInvert({...DEFAULTS,fan:0}),info=run.invert,written=new Map(),cars=[],draws=[];
  const gl={viewport(){},clearColor(){},clear(){},COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2};
  for(const method of ['uniformMatrix4fv','uniform3fv','uniform1f'])gl[method]=(location,...values)=>{assert.ok(location);written.set(location,values.at(-1));};
  const loc=Object.fromEntries(['uEye','uTravel','uMVP','uShadows','uFogK','uLanes','uTime','uShadowYaw','uShadowHeight'].map(x=>[x,x]));
  const scene=Object.assign(Object.create(Scene.prototype),{gl,loc,canvas:{dataset:{},clientWidth:900,clientHeight:500,width:900,height:500},yaw:1.35,elev:.12,zoom:6.6,cam:'invert-field',draw(...args){draws.push(args);},car(root,cut,s,c,mode,experiment,ghost,damage){cars.push({root,s,damage});}});
  for(const sample of [run.samples[0],run.samples.at(-1)])scene.render({sample,c:DEFAULTS,experiment:'invert',mode:1,invert:{...info,damage:{wrecked:false,progress:0}},vectors:true});
  assert.equal(cars.length,2);assert.ok(cars[1].root[13]<cars[0].root[13]);
  assert.equal(scene.canvas.dataset.invertContact,'0');assert.equal(scene.canvas.dataset.invertSuction,'0');
  assert.equal(written.get('uLanes'),0);assert.ok(written.get('uFogK')>=1);assert.equal(written.get('uShadows').length,9);
  const decks=draws.filter(args=>args[2]?.[0]===8&&args[2]?.[1]===.24);
  assert.equal(decks.length,2);assert.notDeepEqual(decks[0][6],decks[1][6]);
  assert.equal(scene.canvas.dataset.invertPlatformAngle,String(run.samples.at(-1).platformAngle));
 }finally{if(previous===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=previous;}
});

test('Turn draws the solved world positions, painted lane edges and initialized uniforms',()=>{
 const previous=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
 try{
  const result=simulateTurnComparison(DEFAULTS),cars=[],draws=[],written=new Map(),uploads=[];
  const gl={viewport(){},clearColor(){},clear(){},deleteBuffer(){},COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2};
  for(const method of ['uniformMatrix4fv','uniform3fv','uniform1f'])gl[method]=(location,...values)=>{assert.ok(location);written.set(location,values.at(-1));};
  const loc=Object.fromEntries(['uEye','uTravel','uMVP','uShadows','uFogK','uLanes','uTime','uShadowYaw','uShadowHeight'].map(x=>[x,x]));
  const scene=Object.assign(Object.create(Scene.prototype),{gl,loc,meshes:{},canvas:{dataset:{},clientWidth:900,clientHeight:500,width:900,height:500},yaw:2.2,elev:.98,zoom:6.6,cam:'turn-field',draw(...args){draws.push(args);},upload(name,data){uploads.push(data);this.meshes[name]={};},car(root){cars.push(root);}});
  for(const time of [0,result.duration]){
   const entries=result.runs.map((r,mode)=>({...turnSample(r,time),mode}));
   scene.render({sample:entries[1].sample,c:DEFAULTS,experiment:'turn',entries,turn:{track:result.track,bounds:result.bounds,focus:1},vectors:true});
  }
  assert.equal(uploads.length,1);assert.ok(uploads[0].p.every(Number.isFinite));
  assert.equal(cars.length,3,'coincident start draws the selected case, then both separated cars');
  for(const i of [0,1]){const end=result.runs[i].samples.at(-1);assert.equal(cars[i+1][12],end.x);assert.equal(cars[i+1][14],end.z);}
  assert.equal(scene.canvas.dataset.turnState0,'OFF TRACK');assert.equal(scene.canvas.dataset.turnState1,'CORNER CLEAR');
  assert.equal(written.get('uLanes'),0);assert.ok(written.get('uFogK')>=1);assert.equal(written.get('uShadows').length,9);
  assert.ok(draws.some(args=>args[2]?.[1]===.012&&args[2]?.[2]===.08),'painted edges are flat');
  assert.ok(!draws.some(args=>args[2]?.[1]===.86),'no solid walls');
  assert.equal(scene.canvas.dataset.turnWreck0,'false');
 }finally{if(previous===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=previous;}
});

test('camera controls request a redraw and keyboard reset keeps the experiment camera',()=>{
 const scene=Object.assign(Object.create(Scene.prototype),{dirty:false});
 scene.setCamera('turn-field');assert.equal(scene.dirty,true);
 const original={yaw:scene.yaw,elev:scene.elev,zoom:scene.zoom};
 scene.dirty=false;scene.nudgeZoom(1);assert.equal(scene.dirty,true);assert.notEqual(scene.zoom,original.zoom);
 scene.dirty=false;scene.reset();assert.equal(scene.cam,'turn-field');assert.equal(scene.dirty,true);
 assert.deepEqual({yaw:scene.yaw,elev:scene.elev,zoom:scene.zoom},original);
});

test('camera transitions take the short orbit with smooth endpoints',()=>{
 const scene=Object.assign(Object.create(Scene.prototype),{dirty:false});
 scene.setCamera('focus');const target=scene.yaw;
 scene.yaw=target+2*Math.PI-.15;const from=scene.yaw;
 scene.transitionCamera('focus',true);
 assert.ok(Math.abs(scene.cameraTween.to.yaw-from)<Math.PI);
 const start=scene.cameraTween.start;
 scene.advanceCamera(start);assert.equal(scene.yaw,from);
 scene.advanceCamera(start+800);assert.equal(scene.cameraTween,null);
 assert.ok(Math.abs(Math.sin(scene.yaw)-Math.sin(target))<1e-12);
});


test('vessel callout uses the body transform and compensates the Launch floating origin',()=>{
 const world=[];const scene=Object.assign(Object.create(Scene.prototype),{frameX:100,project(point){world.push(point);return point.slice(0,2);}});
 const translated=[1,0,0,0,0,1,0,0,0,0,1,0,-10,2,3,1];scene.annotateVessel(translated);
 assert.deepEqual(world[0],[89.4,2.7199999999999998,3]);assert.deepEqual(scene.vesselAnnotation.point,world[0].slice(0,2));
 const rotated=[0,1,0,0,-1,0,0,0,0,0,1,0,-10,2,3,1];scene.annotateVessel(rotated);
 assert.ok(Math.abs(world[1][0]-89.28)<1e-10);assert.ok(Math.abs(world[1][1]-1.4)<1e-10);
 scene.frameX=0;scene.annotateVessel(translated);assert.equal(world[2][0],-10.6);
});

test('Launch overview lifts with real separation but frozen framing retains manual orbit',()=>{
 const previous=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
 try{
  const eyes=[],gl={viewport(){},clearColor(){},clear(){},uniform1f(){},uniform3fv(key,value){if(key==='uEye')eyes.push([...value]);}};
  const scene=Object.assign(Object.create(Scene.prototype),{gl,loc:{uEye:'uEye'},canvas:{dataset:{},clientWidth:900,clientHeight:500,width:900,height:500},draw(){},car(){}});
  scene.setCamera('field');const base=scene.elev;
  const draw=(xs,autoFrame)=>{const entries=xs.map((x,mode)=>({mode,visible:true,status:'ACTIVE',sample:{x,v:10}}));scene.render({experiment:'launch',sample:entries[2].sample,entries,c:{},mode:2,autoFrame});};
  draw([0,0,0],true);assert.equal(scene.frozenFrame.autoLift,0);
  draw([30,140,330],true);assert.ok(scene.frozenFrame.autoLift>.15);assert.equal(scene.elev,base,'display lift never changes orbit state');
  const frozen={...scene.frozenFrame};draw([70,220,480],false);assert.deepEqual(scene.frozenFrame,frozen);
  const before=eyes.at(-1);scene.elev+=.1;draw([70,220,480],false);assert.ok(eyes.at(-1)[1]>before[1]);
  assert.equal(scene.frozenFrame.origin,frozen.origin);assert.ok(eyes.flat().every(Number.isFinite));
 }finally{if(previous===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=previous;}
});
