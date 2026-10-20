import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SimulationAudio,synthesizeWreck} from '../src/audio.js';

// Exercise the sound lifecycle against a small Web Audio stand-in; no sound output.
test('audio stays opt-in, respects volume, tracks speed/flow, and silences on pause/hidden',async()=>{
  const parameter=()=>({value:0,last:0,setTargetAtTime(value){this.last=value;}});
  const node=()=>({gain:parameter(),frequency:parameter(),Q:parameter(),connect(){},start(){}});
  class Context {
    currentTime=0;sampleRate=100;state='suspended';destination={};
    resume(){this.state='running';return Promise.resolve();}
    createGain(){return node();}createOscillator(){return node();}
    createBufferSource(){return node();}createBiquadFilter(){return node();}
    createBuffer(){return {getChannelData:()=>new Float32Array(200)};}
    createDynamicsCompressor(){return {...node(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter()};}
  }
  const oldWindow=globalThis.window,oldDocument=globalThis.document;
  globalThis.window={AudioContext:Context};globalThis.document={hidden:false};
  try{
    const sound=new SimulationAudio(),sample={v:20,tire:30000,thrust:60000,flow:80};
    sound.update(sample,'launch',true);assert.equal(sound.ctx,undefined);
    sound.setVolume(.2);await sound.toggle();assert.equal(sound.master.gain.value,.2);
    sound.update(sample,'launch',true);const pitch=sound.tones[0].osc.frequency.last;
    assert.ok(sound.motor.gain.last>0&&sound.jet.gain.last>0);
    sound.update({...sample,v:40,thrust:0,flow:0},'launch',true);
    assert.ok(sound.tones[0].osc.frequency.last>pitch);assert.equal(sound.jet.gain.last,0);
    sound.setVolume(3);assert.equal(sound.master.gain.last,1);
    sound.setVolume(-1);assert.equal(sound.master.gain.last,0);
    sound.update(sample,'launch',false);assert.equal(sound.motor.gain.last,0);assert.equal(sound.jet.gain.last,0);
    document.hidden=true;sound.update(sample,'launch',true);assert.equal(sound.jet.gain.last,0);
    await sound.toggle();assert.equal(sound.enabled,false);
  }finally{
    if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  }
});


test('wreck impacts are opt-in one-shots; completion keeps the tail, explicit silence stops it',async()=>{
 const sources=[];
 const parameter=()=>({value:0,events:[],setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.events.push(v);},exponentialRampToValueAtTime(v){this.events.push(v);},cancelScheduledValues(){}});
 const node=()=>({gain:parameter(),frequency:parameter(),Q:parameter(),connect(){},disconnect(){},start(){},stop(at){this.stopped=at;}});
 class Context{
  currentTime=2;sampleRate=100;state='suspended';destination={};
  resume(){this.state='running';return Promise.resolve();}
  createGain(){return node();}createBiquadFilter(){return node();}
  createOscillator(){const n=node();sources.push(n);return n;}
  createBufferSource(){const n=node();sources.push(n);return n;}
  createBuffer(){return {getChannelData:()=>new Float32Array(200)};}
  createDynamicsCompressor(){return {...node(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter()};}
 }
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 globalThis.window={AudioContext:Context};globalThis.document={hidden:false};
 try{
  const sound=new SimulationAudio();assert.equal(sound.impact(10),false);assert.equal(sound.ctx,undefined);
  await sound.toggle();const before=sources.length;
  assert.equal(sound.impact(12),true);assert.equal(sound.impactCount,1);
  assert.equal(sources.length-before,1);assert.equal(sound.impacts.size,1);
  assert.ok(sources.slice(before).every(s=>s.stopped>2&&s.stopped<=3.6));
  sound.update({v:0,tire:0,thrust:0,flow:0},'hop',false);
  assert.equal(sound.impacts.size,1,'normal end-of-run silence must preserve impact decay');
  const voice=[...sound.impacts][0];for(const source of voice.sources)source.onended();assert.equal(sound.impacts.size,0,'finished voices are disconnected');
  sound.impact(9);sound.silence();assert.equal(sound.impacts.size,0);assert.ok(sources.slice(-1).every(s=>s.stopped===2.04));
  document.hidden=true;assert.equal(sound.impact(9),false);document.hidden=false;
  assert.equal(sound.impact(NaN),false);assert.equal(sound.impact(0),false);
  await sound.toggle();assert.equal(sound.impact(9),false);assert.equal(sound.impactCount,2);
 }finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});


test('wreck waveform has a strong finite transient, a quiet tail and repeatable debris',()=>{
 const a=synthesizeWreck(16000),b=synthesizeWreck(16000);
 assert.equal(a.length,24800);assert.deepEqual(a,b);assert.ok(a.every(Number.isFinite));
 const peak=a.reduce((v,s)=>Math.max(v,Math.abs(s)),0);assert.ok(peak>.85&&peak<=.901);
 const energy=(start,end)=>{let sum=0;for(let i=Math.floor(start*16000);i<Math.floor(end*16000);i++)sum+=a[i]**2;return sum/((end-start)*16000);};
 assert.ok(energy(0,.15)>energy(1.2,1.5)*1000);assert.equal(a[0],0);assert.equal(a.at(-1),0);
});
