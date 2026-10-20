import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VIDEO_FORMATS,videoLayout,recordingType,wrapVideoText} from '../src/recorder.js';

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
