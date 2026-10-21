import {Scene} from './scene.js';
import {SHOWCASE_DURATION} from './showcase.js';

export const VIDEO_FORMATS={landscape:{width:1920,height:1080},portrait:{width:1080,height:1920}};
// Carry fractional RAF time rather than restarting a 33.3 ms delay after each draw.
// This keeps 60/80 Hz displays near the 30 fps target without burst catch-up draws.
export function recordingFrameTime(now,previous=-Infinity){
 if(!Number.isFinite(previous))return now;
 const interval=1000/30,steps=Math.floor((now-previous+.1)/interval);
 return steps>0?previous+steps*interval:null;
}
export function videoLayout(format){
 const {width,height}=VIDEO_FORMATS[format]||VIDEO_FORMATS.landscape;
 return {width,height,portrait:height>width,scene:height>width?{x:40,y:170,w:1000,h:1190}:{x:48,y:116,w:1824,h:680}};
}
export function recordingType(Recorder=globalThis.MediaRecorder){
 if(!Recorder)return null;
 return ['video/mp4;codecs=avc1.420028','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>Recorder.isTypeSupported(type))||null;
}
export function wrapVideoText(ctx,text,width){
 const lines=[];let line='';
 for(const word of String(text).split(/\s+/)){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;}
 if(line)lines.push(line);return lines;
}
const equations={launch:'m dv/dt = F_tire + F_jet - drag - rolling',hop:'m d²y/dt² = F_jet - mg',invert:'N = F_fan + dynamic platform loads',turn:'F_lat ≤ sqrt((μN)² - F_drive²)'};

export class ShowcaseRecorder{
 static supported(){return !!recordingType()&&typeof HTMLCanvasElement!=='undefined'&&typeof HTMLCanvasElement.prototype.captureStream==='function';}
 constructor(format,{onComplete=()=>{},onError=()=>{},animate=true}={}){
  if(!ShowcaseRecorder.supported())throw new Error('Video recording is unavailable in this browser.');
  this.layout=videoLayout(format);this.format=format;this.onComplete=onComplete;this.onError=onError;this.animate=animate;this.frames=0;this.lastDraw=-Infinity;this.chunks=[];
  this.canvas=document.createElement('canvas');this.canvas.width=this.layout.width;this.canvas.height=this.layout.height;this.ctx=this.canvas.getContext('2d',{alpha:false});
  if(!this.ctx)throw new Error('Video composition is unavailable.');
  const holder=this.holder=document.createElement('div');holder.className='video-render-surface';holder.setAttribute('aria-hidden','true');
  const source=this.source=document.createElement('canvas'),scale=Math.min(devicePixelRatio,2);source.style.width=this.layout.scene.w/scale+'px';source.style.height=this.layout.scene.h/scale+'px';holder.append(source);document.body.append(holder);
  try{this.scene=new Scene(source);}catch(error){holder.remove();throw error;}
 }
 start(){
  try{
   this.stream=this.canvas.captureStream(0);this.frameTrack=this.stream.getVideoTracks()[0];
   // Explicit capture follows the completed composition; independent browser
   // sampling can otherwise drop renders when its 30 Hz clock is out of phase.
   if(typeof this.frameTrack?.requestFrame!=='function'){
    this.stream.getTracks().forEach(track=>track.stop());this.stream=this.canvas.captureStream(30);this.frameTrack=null;
   }
   this.recorder=new MediaRecorder(this.stream,{mimeType:recordingType(),videoBitsPerSecond:8_000_000});
   this.mime=this.recorder.mimeType||recordingType();this.recorder.ondataavailable=e=>{if(e.data.size)this.chunks.push(e.data);};
   this.recorder.onerror=()=>this.fail('The browser could not encode this recording. Try again or use a different browser.');
   this.recorder.onstop=()=>{
    const blob=new Blob(this.chunks,{type:this.mime});this.release();
    if(!this.cancelled){if(blob.size&&this.frames>1)this.onComplete({blob,mime:this.mime,extension:this.mime.includes('mp4')?'mp4':'webm',frames:this.frames,...this.layout});else this.onError('No video frames were recorded.');}
   };
   this.recorder.start(1000);this.started=true;this.frameTrack?.requestFrame();
  }catch(error){this.release();throw error;}
 }
 draw(state,view,rows,now=performance.now()){
  const frameTime=recordingFrameTime(now,this.lastDraw);
  if(this.cancelled||this.finishing||frameTime===null&&!view.done)return;
  this.lastDraw=frameTime??now;
  if(this.camera!==view.camera){if(this.camera)this.scene.transitionCamera(view.camera,this.animate);else this.scene.setCamera(view.camera);this.camera=view.camera;}
  this.scene.advanceCamera(now);this.scene.render(state);
  const {ctx}=this,{width:w,height:h,scene:r,portrait}=this.layout;
  ctx.fillStyle='#0b1418';ctx.fillRect(0,0,w,h);ctx.drawImage(this.source,r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#6b998448';ctx.lineWidth=2;ctx.strokeRect(r.x,r.y,r.w,r.h);
  ctx.textBaseline='top';ctx.textAlign='left';ctx.fillStyle='#e4f2e9';ctx.font='600 46px Arial';ctx.fillText('Roadster',48,38);const brand=ctx.measureText('Roadster').width;ctx.fillStyle='#a6dfc9';ctx.font='600 35px Arial';ctx.fillText('LAB',50+brand,47);
  ctx.fillStyle='#a8c5b8';ctx.font='18px Consolas, monospace';ctx.fillText('ALBERT GIL-ESMENDIA / ENGINEERING & SIMULATION',48,portrait?105:87);
  if(!portrait){ctx.textAlign='right';ctx.fillStyle='#adcbbb';ctx.font='20px Consolas, monospace';ctx.fillText(`0${view.index+1} / 04  ${view.step.kind.toUpperCase()}   ·   T+${state.sample.t.toFixed(2)} s`,w-48,48);ctx.textAlign='left';}
  const y=portrait?1410:828;
  ctx.fillStyle='#a6dfc9';ctx.font='19px Consolas, monospace';ctx.fillText(`0${view.index+1} / 04 · ${view.step.kind.toUpperCase()}`,48,y);
  ctx.fillStyle='#eef4e9';ctx.font=portrait?'52px Arial':'45px Arial';const title=wrapVideoText(ctx,view.step.title,portrait?w-96:1040);
  title.forEach((line,i)=>ctx.fillText(line,48,y+36+i*60));
  const textY=y+42+title.length*60;ctx.font=portrait?'27px Arial':'23px Arial';ctx.fillStyle='#adc5bb';
  wrapVideoText(ctx,view.step.caption,portrait?w-96:1040).slice(0,3).forEach((line,i)=>ctx.fillText(line,48,textY+i*35));
  const metricY=portrait?textY+114:y+20,metricX=portrait?48:1170,total=portrait?w-96:w-1220,cell=total/rows.length;
  rows.forEach((row,i)=>{
   const x=metricX+i*cell;ctx.fillStyle='#a4c2b6';ctx.font='19px Arial';ctx.fillText(row.label,x,metricY);
   ctx.fillStyle='#e3dfc5';ctx.font=portrait?'42px Arial':'36px Arial';wrapVideoText(ctx,row.text,cell-18).slice(0,2).forEach((line,j)=>ctx.fillText(line,x,metricY+34+j*43));
   if(row.detail&&row.value!==null){ctx.fillStyle='#a5bfb0';ctx.font='16px Consolas, monospace';ctx.fillText(row.detail,x,metricY+125);}
  });
  ctx.fillStyle='#a9cbbc';ctx.font=portrait?'23px Consolas, monospace':'20px Consolas, monospace';ctx.fillText(equations[view.step.kind],48,portrait?h-110:h-76);
  ctx.font='16px Consolas, monospace';ctx.fillStyle='#9eb7ab';ctx.fillText('INDEPENDENT MODEL · ILLUSTRATIVE INPUTS · NOT TESLA PERFORMANCE DATA',48,h-40);
  ctx.fillStyle='#263e35';ctx.fillRect(48,h-15,w-96,3);ctx.fillStyle='#b1dfc4';ctx.fillRect(48,h-15,(w-96)*view.clock/SHOWCASE_DURATION,3);this.frames++;this.frameTrack?.requestFrame();
 }
 finish(){if(this.finishing||this.cancelled)return;this.finishing=true;this.finishTimer=setTimeout(()=>{if(this.recorder?.state==='recording')this.recorder.stop();},100);}
 fail(message){this.cancel();this.onError(message);}
 cancel(){this.cancelled=true;clearTimeout(this.finishTimer);if(this.recorder?.state==='recording')this.recorder.stop();this.release();}
 release(){if(this.released)return;this.released=true;this.stream?.getTracks().forEach(track=>track.stop());this.frameTrack=null;this.scene?.dispose();this.holder?.remove();this.chunks.length=0;}
}
