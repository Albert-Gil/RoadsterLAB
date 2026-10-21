import {AUDIO_ASSETS} from './audio-assets.js';
import {audioTargets,AUDIO_MIX} from './audio-mapping.js';

const PREF_KEY='roadsterlab.audio.v3';
const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const hidden=()=>globalThis.document?.hidden===true;
const ramp=(param,value,now,tau=AUDIO_MIX.smoothing)=>param.setTargetAtTime(value,now,tau);

// One manager per app. Buffers and silent loop voices survive mode remounts.
// AudioParam automation uses the audio clock, independent of display frame rate.
export class SimulationAudio {
 enabled=false; wantedEnabled=true; musicVolume=.18; effectsVolume=.65; volume=.65;
 buffers=new Map(); loops=new Map(); voices=new Set(); impacts=new Set();
 gates={thrust:false,suction:false}; gateAt={}; skid=false;
 impactCount=0; eventCount=0; status='Sound is off'; failures=[]; epoch=0;
 constructor({storage,contextFactory,loadBuffer}={}){
  this.contextFactory=contextFactory;this.loadBuffer=loadBuffer;
  try{this.storage=storage??globalThis.localStorage;const current=this.storage?.getItem(PREF_KEY),p=JSON.parse(current||this.storage?.getItem('roadsterlab.audio.v2')||'null');
   if(p){if(Number.isFinite(p.music))this.musicVolume=clamp(p.music);if(Number.isFinite(p.effects))this.effectsVolume=clamp(p.effects);if(current&&typeof p.enabled==='boolean')this.wantedEnabled=p.enabled;}
  }catch{}
  this.volume=this.effectsVolume;
  // New default is on. Retain legacy volumes, and honor explicit v3 mute choices.
 }
 notify(){this.onchange?.();}
 setStateProvider(provider){this.stateProvider=provider;}
 poll(){const state=this.stateProvider?.();if(state)this.update(...state);}
 persist(){try{this.storage?.setItem(PREF_KEY,JSON.stringify({music:this.musicVolume,effects:this.effectsVolume,enabled:this.wantedEnabled}));}catch{}}
 startDefault(){
  if(!this.wantedEnabled||this.disposed)return Promise.resolve(false);
  try{if(!this.ctx)this.init();}catch{this.unavailable=true;this.status='Audio is unavailable in this browser';this.notify();return Promise.resolve(false);}
  if(this.ctx.state==='running')return this.ensureStarted();
  // Do not leave an unresolved autoplay resume promise. Resume synchronously
  // on the next real pointer/keyboard gesture if browser policy requires it.
  this.status='Sound on · starts with your first interaction';this.notify();return Promise.resolve(false);
 }
 ensureStarted(){
  if(!this.wantedEnabled||this.disposed||this.unavailable)return Promise.resolve(false);
  if(this.starting)return this.starting;
  if(this.enabled&&this.ctx?.state==='running')return Promise.resolve(true);
  this.starting=this.toggle().catch(()=>{this.status='Audio could not start · tap Sound to retry';this.notify();return false;}).finally(()=>{this.starting=null;});
  return this.starting;
 }
 disable(){
  ++this.epoch;this.wantedEnabled=false;this.enabled=false;this.silence();
  if(this.ctx)ramp(this.master.gain,0,this.ctx.currentTime,.02);
  this.status='Sound is off';this.persist();this.notify();return false;
 }
 setMusicVolume(value){if(!Number.isFinite(value))return;this.musicVolume=clamp(value);this.persist();this.refreshMusic();}
 setEffectsVolume(value){if(!Number.isFinite(value))return;this.effectsVolume=this.volume=clamp(value);this.persist();if(this.ctx)ramp(this.effects.gain,this.effectsVolume,this.ctx.currentTime);}
 setVolume(value){this.setEffectsVolume(value);}
 init(){
  const Context=globalThis.window?.AudioContext||globalThis.window?.webkitAudioContext;
  if(!this.contextFactory&&!Context)throw new Error('Audio is unavailable in this browser.');
  const ctx=this.ctx=this.contextFactory?this.contextFactory():new Context();
  this.master=ctx.createGain();this.master.gain.value=0;
  this.effects=ctx.createGain();this.effects.gain.value=this.effectsVolume;this.effects.connect(this.master);
  const compressor=this.compressor=ctx.createDynamicsCompressor();
  compressor.threshold.value=-8;compressor.knee.value=4;compressor.ratio.value=20;compressor.attack.value=.002;compressor.release.value=.18;
  const safety=this.safety=ctx.createWaveShaper();
  safety.curve=Float32Array.from({length:4097},(_,i)=>.94*Math.tanh((i/2048-1)/.94));
  safety.oversample='none';this.master.connect(compressor);compressor.connect(safety);safety.connect(ctx.destination);
  ctx.onstatechange=()=>{
   if(ctx.state!=='running'){this.silence();this.status='Audio interrupted · tap Sound to resume';}
   else{this.status=this.failures.length?'Some recordings are unavailable':'Sound ready';this.refreshMusic();}
   this.notify();
  };
  // Read solver playback independently of the scene's render cadence. The
  // provider interpolates existing samples; it never integrates new physics.
  if(this.stateProvider)this.clock=setInterval(()=>{if(this.enabled&&this.ready&&!hidden())this.poll();},30);
 }
 async toggle(){
  if(this.disposed)return false;
  if(this.enabled&&this.ctx?.state==='running'){
   return this.disable();
  }
  const token=++this.epoch;this.wantedEnabled=true;
  if(!this.ctx)this.init();
  // Resume before any network await, inside the user's gesture.
  try{await this.ctx.resume();}catch{this.status='Audio could not start · tap Sound to retry';this.notify();return false;}
  if(token!==this.epoch||this.disposed)return false;
  this.enabled=this.ctx.state==='running';this.persist();
  ramp(this.master.gain,this.enabled?.65:0,this.ctx.currentTime,.03);
  this.status='Loading recordings…';this.notify();
  await this.load();
  if(token!==this.epoch||this.disposed)return this.enabled;
  this.status=this.failures.length?`${this.failures.length} recording${this.failures.length===1?'':'s'} unavailable · other sound remains usable`:'Sound ready';
  this.refreshMusic();if(this.stateProvider)this.poll();else if(this.latest)this.update(...this.latest);this.notify();return this.enabled;
 }
 async load(){
  if(this.loading)return this.loading;
  this.loading=(async()=>{
   const entries=Object.entries(AUDIO_ASSETS);let cursor=0;
   await Promise.all(Array.from({length:3},async()=>{
    while(cursor<entries.length){const [name,asset]=entries[cursor++];
     try{
      let buffer;
      if(this.loadBuffer)buffer=await this.loadBuffer(name,asset,this.ctx);
      else{
       const inline=globalThis.ROADSTERLAB_AUDIO_DATA?.[name];
       const url=inline||new URL(`assets/audio/${asset.file}`,import.meta.url);
       const response=await fetch(url);if(!response.ok)throw new Error('Recording unavailable');
       buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());
      }
      if(this.disposed)return;
      this.buffers.set(name,buffer);if(asset.loop)this.startLoop(name,buffer);
     }catch{if(!this.disposed)this.failures.push(name);}
    }
   }));
   this.ready=!this.disposed;
  })();
  return this.loading;
 }
 startLoop(name,buffer){
  if(this.loops.has(name))return;
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
  source.buffer=buffer;source.loop=true;gain.gain.value=0;source.connect(gain);
  gain.connect(name==='background_music'?this.master:this.effects);
  source.start();this.loops.set(name,{source,gain});this.refreshMusic();
 }
 refreshMusic(){
  if(!this.ctx)return;
  const music=this.loops.get('background_music');if(!music)return;
  const now=this.ctx.currentTime;
  music.gain.gain.cancelScheduledValues(now);
  const duck=this.enabled&&!hidden()&&(now<(this.duckUntil||0)||this.gates.thrust);
  const target=this.enabled&&!hidden()&&!this.allSilent&&!this.presentationMuted?this.musicVolume*AUDIO_MIX.music*(duck?.28:1):0;
  ramp(music.gain.gain,target,now,target===0?.025:duck?.04:.18);
  // Return from collision duck even when visual playback has gone idle.
  if(duck&&!this.gates.thrust&&this.duckUntil>now&&target>0)music.gain.gain.setTargetAtTime(this.musicVolume*AUDIO_MIX.music,this.duckUntil,.22);
 }
 stopVoice(voice,fade=.025){
  const now=this.ctx.currentTime;
  voice.gain.gain.cancelScheduledValues(now);ramp(voice.gain.gain,0,now,fade/3);
  try{voice.source.stop(now+fade);}catch{}
  this.voices.delete(voice);this.impacts.delete(voice);
 }
 stopTag(tag){for(const voice of this.voices)if(voice.tag===tag)this.stopVoice(voice);}
 oneShot(name,gainValue,tag=name){
  if(!this.enabled||!this.ctx||this.ctx.state!=='running'||hidden()||this.disposed)return null;
  const buffer=this.buffers.get(name);if(!buffer)return null;
  this.stopTag(tag);
  const ctx=this.ctx,source=ctx.createBufferSource(),gain=ctx.createGain(),now=ctx.currentTime;
  source.buffer=buffer;gain.gain.value=0;source.connect(gain);gain.connect(this.effects);
  ramp(gain.gain,gainValue,now,.003);
  const voice={source,gain,tag,name};this.voices.add(voice);
  source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);this.impacts.delete(voice);};
  source.start(now);source.stop(now+buffer.duration+.01);this.eventCount++;return voice;
 }
 gate(kind,on,level=1){
  if(this.gates[kind]===on)return;
  this.gates[kind]=on;this.gateAt[kind]=this.ctx.currentTime;
  this.oneShot(`${kind}_${on?'start':'stop'}`,(kind==='thrust'?.32:.24)*level,kind);
  if(kind==='thrust')this.refreshMusic();
 }
 silenceMotion(){
  if(!this.ctx)return;
  for(const [name,voice] of this.loops)if(name!=='background_music')ramp(voice.gain.gain,0,this.ctx.currentTime,.025);
 }
 // Explicit pause/reset/seek cancels effects. Music is independent of transport.
 silence({all=false}={}){
  this.allSilent=all;this.skid=false;this.gates={thrust:false,suction:false};
  if(this.latest)this.latest[2]=false;
  if(!this.ctx)return;
  this.silenceMotion();for(const voice of [...this.voices])this.stopVoice(voice);
  this.duckUntil=0;this.refreshMusic();
 }
 impact(speed,threshold=6){
  if(!Number.isFinite(speed)||!Number.isFinite(threshold)||speed<=threshold)return false;
  // Caller supplies only supported WRECKED ground contact, once at forward completion.
  const major=speed>threshold*1.75;
  const voice=this.oneShot(major?'wreck_major':'wreck_minor',major?.85:.6,'impact');if(!voice)return false;
  this.impacts.add(voice);this.impactCount++;
  if(major){this.duckUntil=this.ctx.currentTime+1.8;this.refreshMusic();}
  return true;
 }
 update(sample,experiment,playing,context={}){
  this.latest=[sample,experiment,playing,context];this.allSilent=false;
  if(!this.ctx||this.disposed||!this.ready)return;
  if(!this.enabled||hidden()||this.ctx.state!=='running'||this.presentationMuted){this.silence({all:!!this.presentationMuted});return;}
  const target=audioTargets(sample,experiment,context),now=this.ctx.currentTime;
  const wasActive=this.gates.thrust||this.gates.suction;
  this.gate('thrust',playing&&target.thrust);
  this.gate('suction',playing&&target.fan,experiment==='turn'?.35:1);
  this.skid=playing&&target.sliding>(this.skid?AUDIO_MIX.skidOff:AUDIO_MIX.skidOn);
  if(this.skid){const mix=clamp(target.sliding/2);target.layers.tire_skid_loop=AUDIO_MIX.skid*mix;target.layers.tire_scrub_loop*=1-.8*mix;}
  for(const [name,value] of Object.entries(target.layers)){
   const voice=this.loops.get(name);if(!voice)continue;
   const kind=name==='thrust_loop'?'thrust':name==='suction_loop'?'suction':null;
   const crossfade=kind&&this.gates[kind]?1-.65*Math.exp(-(now-this.gateAt[kind])/.3):1;
   ramp(voice.gain.gain,playing?value*crossfade:0,now);
   if(name.startsWith('motor_'))ramp(voice.source.playbackRate,target.motorRate,now,.09);
   if(name==='suction_loop')ramp(voice.source.playbackRate,target.fanRate,now,.09);
  }
  if(wasActive||this.gates.thrust)this.refreshMusic();
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;++this.epoch;this.enabled=false;this.silence({all:true});
  clearInterval(this.clock);
  for(const voice of this.loops.values()){try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();}
  this.loops.clear();this.buffers.clear();if(this.ctx){this.ctx.onstatechange=null;this.effects.disconnect();this.master.disconnect();this.compressor.disconnect();this.safety.disconnect();this.ctx.close();}
 }
}
