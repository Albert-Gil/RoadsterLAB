import {Scene,SCENARIO_COLORS} from './scene.js';
import {ShowcaseRecorder} from './recorder.js';
import {sampleAt,comparisonSample,fanModel} from './physics.js';
import {SimulationAudio} from './audio.js';
import {KinematicPlots} from './plots.js';
import {HOP_METRICS,hopSummary,hopDamage} from './hop.js';
import {VESSEL_METRICS,dischargeEvents} from './vessel.js';
import {INVERT_METRICS,invertDamage} from './invert.js';
import {TURN_METRICS,TURN_COLORS,turnSample,turnEvents} from './turn.js';
import {tuningRows} from './tuning.js';
const $=s=>document.querySelector(s),{configs,results}=await(await fetch('./publication-data.json')).json();
const summary=hopSummary(results.hop.runs[2],configs.hop),scene=new Scene($('#scene')),fans=Object.fromEntries(Object.entries(configs).map(([kind,c])=>[kind,fanModel(c)]));let plots,recording=false,cancelRecording;
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelRecording?.();});
const steps=[
 {kind:'launch',seconds:5.6,camera:'field',title:'Three systems. One start line.',caption:'Electric drive, fan suction and cold-gas thrust. The same starting vehicle and fill.'},
 {kind:'hop',seconds:3.7,camera:'hop-track',title:'A short burst. A full flight.',caption:'5.55 m upward. Automatic descent braking uses the air remaining in the same tank.'},
 {kind:'invert',seconds:4.5,camera:'invert-track',title:'Fan-assisted grip. Upside down.',caption:'Watch the contact loads change as the platform rotates through 180 degrees.'},
 {kind:'turn',seconds:3,camera:'turn-field',title:'Same steering. A different outcome.',caption:'A 120° sweep. The fan-assisted car holds the corner. The car without the fan runs wide.'}
];
const total=steps.reduce((s,x)=>s+x.seconds,0)+2.8;
function state(kind,time){const result=results[kind],c=configs[kind],run=result.runs[2]||result.runs[1],sample=sampleAt(run,time),base={sample,c,experiment:kind,mode:kind==='turn'?1:kind==='invert'?1:2,cutaway:false,vectors:false,autoFrame:true};
 if(kind==='launch')base.entries=result.runs.map((r,mode)=>({...comparisonSample(r,time),mode,visible:true}));
 if(kind==='hop')base.hop={...summary,damage:hopDamage(summary,time)};
 if(kind==='invert')base.invert={...run.invert,damage:invertDamage(run,time)};
 if(kind==='turn'){base.entries=result.runs.map((r,mode)=>({...turnSample(r,time),mode,visible:true}));base.sample=base.entries[1].sample;base.turn={track:result.track,bounds:result.bounds,focus:1,reveal:time/result.duration};}
 return base;
}
const metric=(label,value,detail='')=>`<div class="metric"><label>${label}</label><strong>${value}</strong><small>${detail}</small></div>`;
function poster(kind){if(recording)return;plots?.dispose();const physical=kind==='vessel'?'launch':kind,result=results[physical],run=result.runs[2]||result.runs[1];let time,metrics,colors=SCENARIO_COLORS,visible=[false,false,true],data={...result,events:[]};
 const copy={
 launch:['Beyond traction.','Three independent launches. Identical starting hardware and air inventory.','Grip, suction and thrust separate the curves.','Every line comes from the same deterministic vehicle and blowdown solvers. The bright traces make the performance differences visible.'],
 hop:['A short burst. A full flight.','A 5.55 m hop, followed by a controlled descent using the same air supply.','The landing burn changes the return.','Altitude, signed vertical velocity and acceleration show the ascent, coast and automatic landing burn. Negative velocity means descent.'],
 vessel:['Pressure becomes motion.','A finite tank. Falling pressure. Cooling gas. Measurable thrust.','Watch the energy reserve change.','These plots come from the thrust-assisted launch. Pressure is absolute; gas temperature and remaining mass follow the same tank history.'],
 turn:['Same steering. A different outcome.','A 120° corner. Same entry speed and steering. Fan suction changes the grip budget.','One holds the line. One runs wide.','The no-fan trace leaves the painted lane. Its motion continues onto schematic grass; this is a grip-capped path model, not a drifting simulation.'],
 invert:['What holds a car upside down?','A rotating platform exposes the relationship between suction, load and contact.','Rotation makes the loads visible.','The platform angle and contact loads come from the stored physical solution. Supported pitch is guided; this is not a tipping/contact-moment solver.']
 }[kind];
 if(kind==='launch'){time=.45;visible=[true,true,true];$('#metrics').innerHTML=result.runs.map((r,i)=>metric(SCENARIO_COLORS[i].name,r.sixty.toFixed(2)+' s','0–60 mph')).join('');}
 if(kind==='hop'){time=run.landing.burnStart+.24;metrics=HOP_METRICS;data.events=summary.events;$('#metrics').innerHTML=metric('APEX',run.peakHeight.toFixed(2)+' m')+metric('TOUCHDOWN',run.landingSpeed.toFixed(2)+' m/s','Automatic landing burn');}
 if(kind==='vessel'){time=.6;metrics=VESSEL_METRICS.slice(0,3);data.events=dischargeEvents(run);const s=sampleAt(run,time);$('#metrics').innerHTML=metric('PRESSURE',(s.pressure/1e5).toFixed(0)+' bara')+metric('TEMPERATURE',s.temp.toFixed(0)+' K')+metric('AIR REMAINING',s.gas.toFixed(0)+' kg');}
 if(kind==='turn'){time=1.5;metrics=[TURN_METRICS[0],TURN_METRICS[2],TURN_METRICS[3]];colors=TURN_COLORS;visible=[true,true];data.events=turnEvents(result);$('#metrics').innerHTML=metric('ENTRY SPEED','100 km/h')+metric('STEERING','4°')+metric('FAN CASE','CORNER CLEAR');}
 if(kind==='invert'){time=3;metrics=[INVERT_METRICS[0],INVERT_METRICS[4],INVERT_METRICS[5]];data.events=run.invert.events;$('#metrics').innerHTML=metric('ROTATION','180°')+metric('OUTCOME',run.invert.outcome)+metric('AIR USED','0 kg');}
 $('#heading').textContent=copy[0];$('#subtitle').textContent=copy[1];$('#insight').textContent=copy[2];$('#note').textContent=copy[3];
 plots=new KinematicPlots($('#plots'),{colors,getSample:(run,t)=>physical==='turn'?turnSample(run,t):comparisonSample(run,t),onScrub:()=>{},metrics,family:kind==='vessel'?'BLOWDOWN':kind==='launch'?'KINEMATICS':kind.toUpperCase()});plots.setData(data,visible);plots.update(time,physical==='turn'?1:2);
 scene.setCamera(physical==='hop'?'hop-track':physical==='invert'?'invert-track':physical==='turn'?'turn-field':'field');scene.render({...state(physical,time),cutaway:kind==='vessel'});
 const setup={kind:physical,config:configs[physical],presentationTime:time};$('#setup').href='data:application/json,'+encodeURIComponent(JSON.stringify(setup,null,2));$('#setup').download='roadsterlab-'+kind+'-settings.json';$('#setup').hidden=false;
}
$('#material').onchange=()=>{if(recording)return;$('#board').hidden=false;$('#preview').style.display='none';poster($('#material').value);};poster('launch');$('#record').disabled=false;$('#status').textContent='Ready · 5.55 m Hop / 1.00 m/s touchdown · music and simulation sound.';
$('#record').onclick=async()=>{
 recording=true;$('#record').disabled=true;$('#download').hidden=true;$('#board').hidden=true;$('#preview').style.display='block';let lastKind=null,started=0;
 const audio=new SimulationAudio({storage:{getItem:()=>null,setItem:()=>{}}});audio.setMusicVolume(.24);audio.setEffectsVolume(.65);
 let destination,recorder;
 const cleanup=()=>{cancelRecording=null;destination?.stream.getTracks().forEach(t=>t.stop());audio.dispose();};
 try{
 $('#status').textContent='Preparing soundtrack…';await audio.ensureStarted();if(!audio.enabled||!audio.ready||document.hidden)throw Error('Sound could not start. Keep this tab visible and retry.');
 destination=audio.ctx.createMediaStreamDestination();audio.safety.connect(destination);
 recorder=new ShowcaseRecorder('landscape',{animate:false,audioStream:destination.stream,onComplete:({blob,frames,extension})=>{cleanup();recording=false;$('#record').disabled=false;$('#download').href=URL.createObjectURL(blob);$('#download').download=`roadsterlab-showcase-publication.${extension}`;$('#download').textContent='Download showcase with sound';$('#download').hidden=false;$('#status').textContent=`Ready · ${frames} frames · ${total.toFixed(1)} s presentation · sound included`;},onError:message=>{cleanup();$('#status').textContent=message;recording=false;$('#record').disabled=false;}});
 cancelRecording=()=>{recording=false;recorder.cancel();cleanup();$('#record').disabled=false;$('#status').textContent='Recording cancelled. Keep the tab visible while recording.';};
 $('#preview').replaceChildren(recorder.canvas);
 function frame(clock){let start=0,index=0;for(;index<steps.length;index++){if(clock<start+steps[index].seconds)break;start+=steps[index].seconds;}
  if(index===steps.length){if(lastKind!=='end'){audio.silence();lastKind='end';}audio.setMusicVolume(.24*Math.min(1,Math.max(0,(total-clock)/.85)));const ctx=recorder.ctx;ctx.fillStyle='#0b1418';ctx.fillRect(0,0,1920,1080);ctx.textBaseline='top';ctx.fillStyle='#edf6ee';ctx.font='700 112px Arial';ctx.fillText('Roadster',90,220);ctx.fillStyle='#a6dfc9';ctx.fillText('LAB',90+ctx.measureText('Roadster').width,220);ctx.fillStyle='#eef4e9';ctx.font='58px Arial';ctx.fillText('Have some fun experimenting.',90,435);ctx.fillStyle='#a8c9b8';ctx.font='34px Arial';ctx.fillText('Still in development. What would you add next?',90,535);ctx.fillStyle='#c6edda';ctx.font='36px Arial';ctx.fillText('albert-gil.github.io/RoadsterLAB',90,680);ctx.fillStyle='#9eb7ab';ctx.font='21px Arial';ctx.fillText('Independent exploratory model · illustrative inputs · not Tesla performance data',90,995);recorder.frames++;recorder.frameTrack?.requestFrame();return;}
  const step=steps[index],result=results[step.kind],physicalEnd=step.kind==='invert'?4.25:result.duration,local=clock-start;
  const time=physicalEnd*Math.min(1,Math.max(0,(local-.06)/(step.seconds-.18)));
  if(lastKind!==step.kind){recorder.camera=null;audio.silence();lastKind=step.kind;audio.allSilent=false;audio.refreshMusic();}
  const snapshot=state(step.kind,time),view={index,step,clock:clock/total*36,camera:step.camera,done:false};recorder.draw(snapshot,view,tuningRows(step.kind,result));
  audio.update(snapshot.sample,step.kind,true,{config:snapshot.c,mode:snapshot.mode,fan:fans[step.kind],info:step.kind==='turn'?result.runs[1].turn:{}});
 }
 frame(0);recorder.start();
 function tick(now){if(!recording)return;if(!started)started=now;const clock=Math.min(total,(now-started)/1000);frame(clock);$('#status').textContent=`Recording ${clock.toFixed(1)} / ${total.toFixed(1)} s`;if(clock>=total){recorder.finish();return;}requestAnimationFrame(tick);}requestAnimationFrame(tick);
 }catch(error){recorder?.cancel();cleanup();recording=false;$('#record').disabled=false;$('#status').textContent=error.message;}
};
