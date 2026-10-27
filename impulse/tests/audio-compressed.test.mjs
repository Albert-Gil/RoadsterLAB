import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AUDIO_ASSETS} from '../src/audio-assets.js';
import {conformBuffer,compressedFormats} from '../src/audio.js';

const manifest=JSON.parse(readFileSync(new URL('../assets/audio/compressed/manifest.json',import.meta.url),'utf8'));

test('compressed copies cover every recording, match their hashes and stay small',()=>{
 assert.deepEqual(Object.keys(manifest).sort(),Object.keys(AUDIO_ASSETS).sort());
 let wav=0,webm=0;
 for(const [name,entry] of Object.entries(manifest)){
  const asset=AUDIO_ASSETS[name];
  assert.equal(entry.frames,Math.round(asset.duration*asset.sampleRate),`${name} keeps the processed WAV length`);
  assert.equal(entry.channels,asset.channels);assert.equal(entry.loop,asset.loop);
  assert.equal(entry.lead,asset.loop?12000:0,'only loops carry a wrapped lead-in');
  for(const ext of ['webm','m4a']){
   const data=readFileSync(new URL(`../assets/audio/compressed/${entry[ext].file}`,import.meta.url));
   assert.equal(data.length,entry[ext].bytes);assert.equal(createHash('sha256').update(data).digest('hex'),entry[ext].sha256);
  }
  wav+=entry.wavBytes;webm+=entry.webm.bytes;
 }
 assert.ok(webm<wav*.15,`Opus copies should be a small fraction of the WAVs (${webm} of ${wav} bytes)`);
});

test('decoded compressed buffers are trimmed to the exact original frames',()=>{
 const makeBuffer=(channels,length,sampleRate,fill)=>{const data=Array.from({length:channels},(_,c)=>Float32Array.from({length},(_,i)=>fill(c,i)));return {numberOfChannels:channels,length,sampleRate,getChannelData:c=>data[c]};};
 const ctx={createBuffer:(channels,length,sampleRate)=>makeBuffer(channels,length,sampleRate,()=>0)};
 const entry={frames:1000,lead:200,sampleRate:48000};
 const decoded=makeBuffer(2,1400,48000,(c,i)=>c*10000+i);
 const out=conformBuffer(ctx,decoded,entry);
 assert.equal(out.length,1000);assert.equal(out.getChannelData(0)[0],200);assert.equal(out.getChannelData(1)[999],11199);
 const resampled=conformBuffer(ctx,makeBuffer(1,1300,44100,(c,i)=>i),entry);
 assert.equal(resampled.length,Math.round(1000*44100/48000));assert.equal(resampled.getChannelData(0)[0],Math.round(200*44100/48000));
 const exact=makeBuffer(1,1000,48000,()=>1);assert.equal(conformBuffer(ctx,exact,{frames:1000,lead:0,sampleRate:48000}),exact,'one-shots pass through untouched');
 assert.deepEqual(compressedFormats({canPlayType:type=>type.includes('opus')?'probably':''}),['webm']);
 assert.deepEqual(compressedFormats({canPlayType:()=>''}),[]);
 assert.deepEqual(compressedFormats(undefined),[]);
});
