import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ShowcaseRecorder,VIDEO_FORMATS,videoLayout,recordingType,recordingFrameTime,wrapVideoText} from '../src/recorder.js';

test('video compositions retain canonical dimensions with the scene inside the frame',()=>{
 for(const format of Object.keys(VIDEO_FORMATS)){
  const {width,height,scene,portrait}=videoLayout(format);
  assert.deepEqual({width,height},VIDEO_FORMATS[format]);
  assert.equal(portrait,height>width);
  assert.ok(scene.x>=0&&scene.y>=0&&scene.x+scene.w<=width&&scene.y+scene.h<=height);
 }
 assert.deepEqual(videoLayout('unknown'),videoLayout('landscape'));
});

test('recording format selection prefers MP4 and falls back to a supported WebM codec',()=>{
 assert.equal(recordingType(null),null);
 assert.equal(recordingType({isTypeSupported:()=>false}),null);
 assert.equal(recordingType({isTypeSupported:t=>t==='video/webm;codecs=vp8'}),'video/webm;codecs=vp8');
 assert.equal(recordingType({isTypeSupported:()=>true}),'video/mp4;codecs=avc1.420028');
});

test('video caption wrapping preserves words and respects available width',()=>{
 const ctx={measureText:text=>({width:text.length*10})};
 const caption='Automatic braking uses the remaining air to slow the return.';
 const lines=wrapVideoText(ctx,caption,220);
 assert.equal(lines.join(' '),caption);
 assert.ok(lines.length>1&&lines.every(line=>ctx.measureText(line).width<=220));
 assert.deepEqual(wrapVideoText(ctx,'',220),[]);
});

test('recording cadence carries frame remainder on 60/80/120 Hz and skips missed slots without bursts',()=>{
 for(const hz of [60,80,120]){
  let previous=-Infinity,count=0;
  for(let i=0;i<hz*30;i++){
   const now=i*1000/hz,time=recordingFrameTime(now,previous);
   if(time!==null){assert.ok(time>previous);previous=time;count++;}
  }
  assert.ok(Math.abs(count-900)<=1,`${hz} Hz produced ${count} frames instead of 900`);
 }
 assert.equal(recordingFrameTime(20,0),null);
 const resumed=recordingFrameTime(500,0);assert.ok(Math.abs(resumed-500)<1e-6);
 assert.equal(recordingFrameTime(500,resumed),null,'one callback never creates multiple catch-up draws');
});

test('recording requests its composed starting frame and cleans up manual/automatic capture tracks',()=>{
 const OriginalRecorder=globalThis.MediaRecorder;
 try{
  for(const manual of [true,false]){
   const events=[],tracks=[],rates=[];
   globalThis.MediaRecorder=class {
    static isTypeSupported(){return true;}
    constructor(){this.mimeType='video/mp4';this.state='inactive';}
    start(){this.state='recording';events.push('start');}
   };
   const recorder=Object.assign(Object.create(ShowcaseRecorder.prototype),{
    canvas:{captureStream(rate){rates.push(rate);const track={stop(){this.stopped=true;}};if(manual)track.requestFrame=()=>events.push('frame');tracks.push(track);return {getVideoTracks:()=>[track],getTracks:()=>[track]};}},
    scene:{dispose(){}},holder:{remove(){}},chunks:[]
   });
   recorder.start();
   assert.deepEqual(rates,manual?[0]:[0,30]);
   assert.deepEqual(events,manual?['start','frame']:['start'],'capture the already composed canvas after encoding starts');
   if(!manual)assert.equal(tracks[0].stopped,true,'stop abandoned fallback stream');
   recorder.release();assert.ok(tracks.every(t=>t.stopped));assert.equal(recorder.frameTrack,null);
  }
 }finally{if(OriginalRecorder===undefined)delete globalThis.MediaRecorder;else globalThis.MediaRecorder=OriginalRecorder;}
});
