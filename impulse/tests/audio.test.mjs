import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {SimulationAudio} from '../src/audio.js';
import {audioTargets,AUDIO_MIX} from '../src/audio-mapping.js';
import {AUDIO_ASSETS} from '../src/audio-assets.js';
import {DEFAULTS,fanModel,simulateLaunch,simulateHop,simulateInvert,simulateTurnComparison} from '../src/physics.ts';

const cfg={...DEFAULTS,heatTransfer:0};
const context=(config=cfg,mode=2,info={})=>({config,mode,info,fan:fanModel(config)});
const param=()=>({value:0,events:[],setTargetAtTime(value,at,tau){this.value=value;this.events.push({value,at,tau});},cancelScheduledValues(at){this.events=this.events.filter(x=>x.at<at);}});
function fixture(options={}){
 const sources=[];let decoded=0;
 const node=()=>({gain:param(),playbackRate:param(),connect(){},disconnect(){this.disconnected=true;},start(at){this.started=at??0;this.starts=(this.starts||0)+1;},stop(at){this.stopped=at??0;}});
 const ctx={currentTime:2,state:'suspended',destination:{},
  async resume(){this.state='running';},async close(){this.state='closed';},
  createGain:node,createWaveShaper:node,
  createBufferSource(){const n=node();sources.push(n);return n;},
  createDynamicsCompressor(){return {...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}};
 const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const sound=new SimulationAudio({contextFactory:()=>ctx,storage,loadBuffer:async(name,asset)=>{decoded++;return {duration:asset.duration};},...options});
 return {sound,ctx,sources,storage,get decoded(){return decoded;}};
}

test('speed bands crossfade continuously; thrust follows delivered flow and force',()=>{
 const run=simulateLaunch(cfg,2),at=run.samples.find(s=>s.v>20),a=audioTargets(at,'launch',context());
 assert.ok(a.layers.motor_low>0&&a.layers.motor_mid>0&&a.layers.aero_noise>0);
 const edge=v=>audioTargets({...at,v},'launch',context());
 assert.ok(Math.abs(edge(24.999).layers.motor_mid-edge(25.001).layers.motor_mid)<.0001);
 assert.ok(edge(60).motorRate>edge(20).motorRate);
 assert.ok(edge(60).layers.aero_noise>edge(20).layers.aero_noise);
 assert.ok(audioTargets({...at,thrust:80000,flow:40},'launch',context()).layers.thrust_loop>0);
 assert.equal(audioTargets({...at,thrust:80000,flow:0},'launch',context()).thrust,false);
 const base=simulateLaunch(cfg,0).samples[50];assert.equal(audioTargets(base,'launch',context(cfg,0)).fan,false);
});

test('Hop has no road motor, scrub or skid in ascent, coast or touchdown',()=>{
 const run=simulateHop(cfg);let active=false;
 for(const s of run.samples){const a=audioTargets(s,'hop',context());
  active||=a.thrust;for(const name of ['motor_low','motor_mid','motor_high','tire_scrub_loop','tire_skid_loop','surface_slide_loop'])assert.equal(a.layers[name],0);
 }
 assert.ok(active);assert.ok(run.samples.some(s=>s.flow===0&&s.v>0));
});

test('Turn constant speed keeps motor/aero stable; only selected active fan sounds',()=>{
 const results=simulateTurnComparison(cfg);
 for(const [i,run] of results.runs.entries()){
  const a=audioTargets(run.samples[0],'turn',context(cfg,i,run.turn));
  const b=audioTargets({...run.samples.at(-1),lateralAccel:999},'turn',context(cfg,i,run.turn));
  assert.equal(a.motorRate,b.motorRate);assert.equal(a.layers.motor_mid,b.layers.motor_mid);assert.equal(a.layers.aero_noise,b.layers.aero_noise);
  assert.equal(a.fan,i===1);assert.equal(a.layers.tire_skid_loop,0,'no transient slip model in Turn');
  if(i===1)assert.ok(a.layers.seal_leak_loop>0&&a.layers.suction_loop>0);
 }
 const sample={v:25,tire:1000,normal:10000,demand:9000,capacity:10000};
 const a=audioTargets({...sample,demand:5000},'turn',context({...cfg,grip:1},0,{driveForce:1000}));
 const b=audioTargets(sample,'turn',context({...cfg,grip:1},0,{driveForce:1000}));
 assert.equal(a.layers.tire_scrub_loop,0);assert.ok(b.layers.tire_scrub_loop>0);
});

test('leakage follows airflow and budget-clamped suction, not commanded power alone',()=>{
 const sample={v:0,contact:1,downforce:fanModel(cfg).downforce,normal:40000,tire:0,alongV:0};
 const a=audioTargets(sample,'invert',context());
 const leaky={...cfg,leak:90};const b=audioTargets({...sample,downforce:fanModel(leaky).downforce},'invert',context(leaky));
 assert.ok(b.layers.seal_leak_loop>a.layers.seal_leak_loop);
 const reduced=audioTargets({...sample,downforce:sample.downforce/4},'invert',context());
 assert.ok(reduced.layers.suction_loop<a.layers.suction_loop);assert.ok(reduced.layers.seal_leak_loop<a.layers.seal_leak_loop);
 const off=audioTargets({...sample,downforce:0,contact:0},'invert',context());
 assert.equal(off.layers.suction_loop,0);assert.equal(off.layers.seal_leak_loop,0);
});

test('Invert surface and skid require modeled sliding contact; static attachment stays quiet',async()=>{
 const f=fixture();await f.sound.toggle();
 const config={...cfg,angle:90,invertStart:90,fan:20};const run=simulateInvert(config);
 const s=run.samples.find(s=>s.contact&&Math.abs(s.alongV)>.5);assert.ok(s);
 f.sound.update(s,'invert',true,context(config));assert.ok(f.sound.skid);
 assert.ok(f.sound.loops.get('surface_slide_loop').gain.gain.value>0);
 const v=Math.abs(s.alongV),sign=Math.sign(s.alongV);
 f.sound.update({...s,alongV:sign*.1},'invert',true,context(config));assert.ok(f.sound.skid,'hysteresis retains sliding layer');
 f.sound.update({...s,alongV:sign*.03},'invert',true,context(config));assert.equal(f.sound.skid,false);
 f.sound.update({...s,contact:0,alongV:v},'invert',true,context(config));
 assert.equal(f.sound.loops.get('tire_skid_loop').gain.gain.value,0);assert.equal(f.sound.loops.get('surface_slide_loop').gain.gain.value,0);
 f.sound.dispose();
});

test('recordings decode once; music and shared loop phases survive pause, mode changes and mute',async()=>{
 const f=fixture(),{sound}=f;assert.equal(f.decoded,0);assert.equal(sound.ctx,undefined);
 sound.update({v:20,tire:2000},'launch',false,context());assert.equal(f.decoded,0);
 await sound.toggle();assert.equal(f.decoded,17);assert.equal(sound.loops.size,11);
 const music=sound.loops.get('background_music'),motor=sound.loops.get('motor_low');
 sound.update({v:20,tire:2000},'launch',true,context());assert.ok(motor.gain.gain.value>0);
 sound.silence();assert.equal(motor.gain.gain.value,0);assert.ok(music.gain.gain.value>0);
 sound.update({v:30,tire:2000},'turn',true,context(cfg,0,{driveForce:2000}));
 assert.equal(sound.loops.get('motor_low'),motor);assert.equal(sound.loops.get('background_music'),music);
 await sound.toggle();assert.equal(music.gain.gain.value,0);await sound.toggle();
 assert.equal(f.decoded,17);assert.equal(music.source.starts,1);assert.equal(sound.loops.size,11);
 sound.dispose();assert.ok(f.sources.every(s=>s.stopped!==undefined));assert.equal(f.ctx.state,'closed');
});

test('default-on waits for a gesture when autoplay is blocked, and remembers an explicit mute',async()=>{
 const f=fixture();assert.equal(f.sound.wantedEnabled,true);
 await f.sound.startDefault();assert.equal(f.sound.enabled,false);assert.equal(f.decoded,0);
 assert.match(f.sound.status,/first interaction/);
 await f.sound.ensureStarted();assert.equal(f.sound.enabled,true);assert.equal(f.decoded,17);
 f.sound.disable();const next=new SimulationAudio({storage:f.storage});
 assert.equal(next.wantedEnabled,false);await next.startDefault();assert.equal(next.ctx,undefined);
 f.sound.dispose();
});

test('default-on starts immediately when allowed; repeated gesture starts share one pending load',async()=>{
 const f=fixture();f.ctx.state='running';await f.sound.startDefault();
 assert.equal(f.sound.enabled,true);assert.equal(f.sound.wantedEnabled,true);assert.equal(f.decoded,17);f.sound.dispose();
 let release;const wait=new Promise(r=>release=r);
 const pending=fixture({loadBuffer:async(n,a)=>{await wait;return {duration:a.duration};}});
 const a=pending.sound.ensureStarted(),b=pending.sound.ensureStarted();assert.equal(a,b);
 await Promise.resolve();pending.sound.disable();release();await a;
 assert.equal(pending.sound.enabled,false);assert.equal(pending.sound.wantedEnabled,false);
 assert.equal(pending.sound.loops.get('background_music').gain.gain.value,0);pending.sound.dispose();
});

test('new default retains legacy volumes without importing the former opt-in default',()=>{
 const values={'roadsterlab.audio.v2':JSON.stringify({music:.12,effects:.45,enabled:false})};
 const sound=new SimulationAudio({storage:{getItem:key=>values[key]}});
 assert.equal(sound.musicVolume,.12);assert.equal(sound.effectsVolume,.45);assert.equal(sound.wantedEnabled,true);
});

test('start/stop transitions occur once, explicit seeks cancel them, completion preserves impact tail',async()=>{
 const {sound,ctx}=fixture();await sound.toggle();const s={v:10,tire:1000,thrust:50000,flow:30};
 sound.update(s,'launch',true,context());const events=sound.eventCount;
 for(let i=0;i<10;i++)sound.update(s,'launch',true,context());assert.equal(sound.eventCount,events);
 sound.update({...s,thrust:0,flow:0},'launch',true,context());assert.equal(sound.eventCount,events+1);
 assert.ok([...sound.voices].some(v=>v.name==='thrust_stop'));
 sound.silence();assert.equal(sound.voices.size,0);sound.update(s,'launch',false,context());assert.equal(sound.voices.size,0);
 assert.equal(sound.impact(5,5),false);assert.equal(sound.impact(NaN,5),false);
 assert.ok(sound.impact(6,5));assert.ok([...sound.impacts].some(v=>v.name==='wreck_minor'));
 sound.update({v:0},'hop',false,context());assert.equal(sound.impacts.size,1);
 sound.silence();assert.equal(sound.impacts.size,0);
 assert.ok(sound.impact(15,5));assert.ok(sound.duckUntil>ctx.currentTime);
 const voice=[...sound.impacts][0];voice.source.onended();assert.equal(sound.impacts.size,0);assert.ok(voice.source.disconnected&&voice.gain.disconnected);
 sound.dispose();
});

test('volume preferences persist, storage failure is safe, mute buses and safety stage are bounded',async()=>{
 const {sound,storage}=fixture();await sound.toggle();sound.setMusicVolume(0);sound.setEffectsVolume(.3);
 assert.equal(sound.loops.get('background_music').gain.gain.value,0);assert.equal(sound.effects.gain.value,.3);
 const next=new SimulationAudio({storage});assert.equal(next.musicVolume,0);assert.equal(next.effectsVolume,.3);assert.equal(next.enabled,false);
 sound.setEffectsVolume(4);assert.equal(sound.effectsVolume,1);sound.setMusicVolume(-1);assert.equal(sound.musicVolume,0);
 assert.ok(sound.safety.curve.every(x=>Number.isFinite(x)&&Math.abs(x)<.94));
 assert.doesNotThrow(()=>new SimulationAudio({storage:{getItem(){throw Error();}}}));sound.dispose();
});

test('missing files degrade to remaining layers; loading cancellation and disposal cannot enable late audio',async()=>{
 const bad=fixture({loadBuffer:async(name,a)=>{if(name==='suction_loop')throw Error('missing');return {duration:a.duration};}});
 await bad.sound.toggle();assert.deepEqual(bad.sound.failures,['suction_loop']);assert.equal(bad.sound.loops.size,10);assert.match(bad.sound.status,/unavailable/);bad.sound.dispose();
 let release;const wait=new Promise(r=>release=r);const f=fixture({loadBuffer:async(n,a)=>{await wait;return {duration:a.duration};}});
 const loading=f.sound.toggle();await Promise.resolve();await f.sound.toggle();release();await loading;
 assert.equal(f.sound.enabled,false);assert.equal(f.sound.loops.get('background_music').gain.gain.value,0);f.sound.dispose();
 const gone=fixture({loadBuffer:async(n,a)=>{await Promise.resolve();return {duration:a.duration};}});const pending=gone.sound.toggle();gone.sound.dispose();await pending;assert.equal(gone.sound.loops.size,0);
});

test('hidden/context-interrupted/export states silence effects without leaking or restarting music',async()=>{
 const f=fixture();await f.sound.toggle();const s={v:20,tire:3000,thrust:80000,flow:20};
 const old=globalThis.document;
 try{
  f.sound.update(s,'launch',true,context());globalThis.document={hidden:true};f.sound.update(s,'launch',true,context());
  assert.equal(f.sound.voices.size,0);assert.equal(f.sound.loops.get('background_music').gain.gain.value,0);
  document.hidden=false;f.sound.refreshMusic();assert.ok(f.sound.loops.get('background_music').gain.gain.value>0);
  f.ctx.state='suspended';f.ctx.onstatechange();assert.match(f.sound.status,/interrupted/);assert.equal(f.sound.loops.get('thrust_loop').gain.gain.value,0);
  await f.sound.toggle();assert.equal(f.sound.loops.size,11);
  f.sound.presentationMuted=true;f.sound.update(s,'launch',true,context());assert.equal(f.sound.loops.get('background_music').gain.gain.value,0);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;f.sound.dispose();}
});

test('playback during loading defers transition gates until their recordings are decoded',async()=>{
 let release;const wait=new Promise(r=>release=r);
 const {sound}=fixture({loadBuffer:async(n,a)=>{await wait;return {duration:a.duration};}});
 const pending=sound.toggle();await Promise.resolve();
 sound.update({v:10,tire:3000,thrust:50000,flow:30},'launch',true,context());
 assert.equal(sound.gates.thrust,false);assert.equal(sound.eventCount,0);
 release();await pending;assert.equal(sound.ready,true);assert.equal(sound.gates.thrust,true);
 assert.ok([...sound.voices].some(v=>v.name==='thrust_start'));sound.dispose();
});

test('audio clock polls existing playback samples without a scene render and cleans up on disposal',async()=>{
 const {sound}=fixture();let calls=0,thrust=40000;
 sound.setStateProvider(()=>{calls++;return [{v:10,tire:3000,thrust,flow:thrust?20:0},'launch',true,context()];});
 try{
  await sound.toggle();assert.ok(sound.clock);assert.equal(sound.gates.thrust,true);
  const before=calls;thrust=0;await new Promise(r=>setTimeout(r,75));
  assert.ok(calls>before);assert.equal(sound.gates.thrust,false);
  assert.ok([...sound.voices].some(v=>v.name==='thrust_stop'));
 }finally{sound.dispose();}
 const ended=calls;await new Promise(r=>setTimeout(r,45));assert.equal(calls,ended);
});

test('17 source/processed assets have reproducible hashes, preferred WAV formats and headroom',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../assets/audio/catalog.json',import.meta.url),'utf8'));
 assert.deepEqual(catalog,AUDIO_ASSETS);assert.equal(Object.keys(catalog).length,17);
 for(const [name,a] of Object.entries(catalog)){
  for(const [folder,hash] of [['web',a.sha256],['original',a.original.sha256]]){
   const data=readFileSync(new URL(`../assets/audio/${folder}/${a.file}`,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),hash);
  }
  const bytes=readFileSync(new URL(`../assets/audio/web/${a.file}`,import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt32LE(24),48000);assert.equal(bytes.readUInt16LE(34),16);
  assert.equal(a.channels,['background_music','aero_noise','wreck_major'].includes(name)?2:1);
  assert.ok(a.peak<=.8001&&a.rms>0&&a.duration>.5);
  if(a.loop){assert.ok(a.crossfadeSeconds>0);assert.ok(a.duration<a.original.duration);}
 }
 const rights=JSON.parse(readFileSync(new URL('../assets/audio/RIGHTS.json',import.meta.url),'utf8'));assert.equal(typeof rights.redistributionConfirmed,'boolean');
 const checkRights=()=>execFileSync(process.execPath,['scripts/check-audio-rights.mjs'],{cwd:new URL('../',import.meta.url),stdio:'pipe'});
 if(rights.redistributionConfirmed&&rights.evidence?.trim())assert.doesNotThrow(checkRights);
 else assert.throws(checkRights,/Command failed/);
});
