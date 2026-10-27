import {ShowcaseRecorder} from './recorder.js';
import {engineeringSection,AUTHOR} from './engineering.js';
import {SHOWCASE_STEPS,SHOWCASE_DURATION,showcaseFrame,showcaseStart} from './showcase.js';
import {comparisonSample,comparisonCsv,hopCsv,invertCsv,turnCsv,fanModel,DEFAULTS,G,ATM,gasFromPreset,gasValidity,withInternalEnergy,gaugeToAbsoluteBar,absoluteToGaugeBar,presetPressure,initialGas,simulateLaunch,sampleAt,pressureOf} from './physics.js';
import {bindTuningLinks,bindChoiceKeys,ownsKeyboardInput} from './ui.js';
import {TUNING_GUIDES,parameterHint,tuningRows,tuningDifference} from './tuning.js';
import {SimulationClient} from './simulation-client.js';
import {KinematicPlots} from './plots.js';
import {HOP_METRICS,hopSummary,hopPhase,hopDamage,hopLandingPrediction} from './hop.js';
import {INVERT_METRICS,invertDamage,invertPrediction} from './invert.js';
import {TURN_COLORS,TURN_METRICS,turnSample,turnPrediction,turnEvents,TurnMap} from './turn.js';
import {VesselAnalysis} from './vessel.js';
import {SimulationAudio} from './audio.js';
import {Scene,SCENARIO_COLORS} from './scene.js';
import {PREDICTIONS,gradePrediction,revealKey,speedUnit} from './reveal.js';
import {SCENERY_NAME} from './scenery.js';
const $=s=>document.querySelector(s);
const icons={bolt:'<path d="m13 2-8 12h6l-1 8 9-13h-7z"/>',play:'<path d="m8 5 11 7-11 7z"/>',pause:'<path d="M8 5v14M16 5v14"/>',reset:'<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',layers:'<path d="m12 3 10 6-10 6L2 9zm-10 12 10 6 10-6M2 15l10 6 10-6"/>',share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',sliders:'<path d="M4 8h16M4 16h10M8 8v0M14 16v0"/><circle cx="8" cy="8" r="2.2"/><circle cx="14" cy="16" r="2.2"/>',sound:'<path d="M4 10v4h4l5 4V6L8 10zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',mute:'<path d="M4 10v4h4l5 4V6L8 10zM17 9l5 6m0-6-5 6"/>'};
const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.bolt}</svg>`;
const c={...DEFAULTS};const bounds={mass:[1200,2600],power:[400,1300],grip:[.4,1.8],fan:[0,100],pressure:[ATM/1e5,gaugeToAbsoluteBar(650)],volume:[80,600],nozzle:[2,20],boostAt:[0,2],leak:[0,100],angle:[0,180],invertStart:[0,180],invertDuration:[1,20],heatTransfer:[0,2000],heatSourceTemp:[250,350],pulse:[.1,1.5],landingBurn:[0,2],wreckSpeed:[1,20],landingTarget:[.25,5],landingLead:[0,.2],manualBurnAt:[0,120],manualBurnDuration:[0,5],manualBurnCommand:[0,100],turnSpeed:[30/3.6,180/3.6],turnSteer:[-15*Math.PI/180,15*Math.PI/180],turnRadius:[20,80],turnSweep:[Math.PI/4,Math.PI*2/3],turnWidth:[8,16]};
Object.assign(bounds,{valveRise:[0,.2],feedLoss:[0,30],expansionRatio:[1,1.5]});
const params=new URLSearchParams(location.search);for(const key of Object.keys(c)){const value=params.get(key);if(value!==null&&Number.isFinite(+value))c[key]=Math.max(bounds[key][0],Math.min(bounds[key][1],key==='pressure'?presetPressure(+value,params.get('pressureUnit')):+value));}
c.landingBurn=Math.round(c.landingBurn);
const demo=params.get('demo')==='1';
let capture=params.get('capture')==='1';
let experiment=demo?'launch':(['launch','invert','hop','turn'].includes(params.get('experiment'))?params.get('experiment'):'launch'),mode=demo?2:(['0','1','2'].includes(params.get('mode'))?+params.get('mode'):2),t=0,playing=false,speed=1,cutaway=false,vectors=false,compare=demo,startGas=null,runs=[],run,scene,prev=0,launchCount=1,cine=false,demoQueued=demo;
const sound = new SimulationAudio();
function syncAudioControls(){
 const button=$('#sound');if(button){button.innerHTML=icon(sound.wantedEnabled?'sound':'mute')+'<span>'+(sound.wantedEnabled?'Sound on':'Sound off')+'</span>';button.setAttribute('aria-pressed',String(sound.wantedEnabled));button.title=sound.status;}
 const status=$('#sound-status');if(status)status.textContent=sound.status;
}
sound.onchange=syncAudioControls;
function audioPlaying(){return playing||!!(showcase&&!showcase.preparing&&!showcase.paused&&!showcase.done&&!showcase.recorder);}
function audioState(){
 if(!run||busy||calculationError||showcase?.preparing)return null;
 if(!audioPlaying()&&!sound.latest?.[2])return null;
 const at=playing&&prev?Math.min(duration(),t+Math.max(0,performance.now()-prev)/1000*speed):t;
 const context={config:activeConfig,mode,fan:fanModel(activeConfig)};
 if(experiment==='turn'){
  const selected=comparison?.runs[turnFocus];if(!selected)return null;
  const state=turnSample(selected,at);return [state.sample,'turn',audioPlaying()&&!state.ended,{...context,mode:turnFocus,info:selected.turn}];
 }
 return [sampleAt(run,at),experiment,audioPlaying()&&!(experiment==='launch'&&comparisonSample(run,at).ended),context];
}
sound.setStateProvider(audioState);

let showcase=null,latestResult=null,parametersOpen=false;
document.addEventListener('visibilitychange',()=>{if(document.hidden){sound.silence();playing=false;cine=false;prev=0;if(showcase){showcase.paused=true;if(showcase.recorder)cancelVideoExport('Recording cancelled because the tab went into the background. Keep it visible and retry.');updateShowcase();}}else{sound.allSilent=false;sound.refreshMusic();if(scene)scene.dirty=true;update();}});
window.addEventListener('pagehide',e=>{if(e.persisted)sound.silence({all:true});else sound.dispose();});
window.addEventListener('pageshow',()=>{sound.allSilent=false;sound.refreshMusic();});
startGas=experiment==='launch'?gasFromPreset(c,params):null;
if(startGas)launchCount=Math.max(1,Math.min(999,Math.floor(Number(params.get('run')))||1));
const client=new SimulationClient();
let frameIntervals=[],lastFrameTime=0,lastTelemetryFrame=0,renderCosts=[],disposeUI=()=>{},lastSize='';
const experimentSetups={};
let tuningKind=null,tuningResult=null,tuningPrevious=null,tuningEdit='',tuningEdits=[],selectedPresets={},controlLabels={};
let comparison=null,activeConfig={...c},busy=false,calculationError='',requestEpoch=0,computeTimer=null,plots=null,vessel=null,hopData=null,turnMap=null;
let visible=[0,1,2].map(i=>!params.has('visible')||params.get('visible').split(',').includes(String(i)));
if(!visible.some(Boolean))visible=[true,true,true];if(!visible[mode])mode=visible.findIndex(Boolean);
let turnCamera=params.get('turnCamera')==='field'?'field':'focus',turnFocus=params.get('turnFocus')==='0'?0:1;
let invertCamera=params.get('invertCamera')==='track'?'track':'field';
let hopCamera=['track','under'].includes(params.get('hopCamera'))?params.get('hopCamera'):'field',impactStart=null;
let camera=['cinema','field','side','focus'].includes(params.get('camera'))?params.get('camera'):matchMedia('(prefers-reduced-motion: reduce)').matches?'field':'cinema',autoFrame=params.get('autoFrame')!=='0',autoCloseFrom=null;
let units=['si','us'].includes(params.get('units'))?params.get('units'):(()=>{try{return localStorage.getItem('roadsterlab.units')==='us'?'us':'si';}catch{return 'si';}})();
const analysisTab={};
let launchMarks=[0,0,0],turnMarks=[];
try{if(localStorage.getItem('roadsterlab.hintSeen')==='1')document.body.classList.add('hint-seen');}catch{}
const previewSample=()=>{const g=initialGas(c);return {t:0,x:0,y:0,v:0,vy:0,a:0,gas:g.mass,temp:g.temp,u:g.u,pressure:pressureOf(c,g),thrust:0,tire:0,downforce:0,flow:0,energy:0,limit:'READY'};};
function setBusy(value,message=''){
 busy=value;calculationError=message;document.body.classList.toggle('calculating',value);set('tuning-clock',value?'Updating the current setup…':message?'Correct the highlighted input to continue.':t>0?`Paused at T+${t.toFixed(2)} s. Change a value to compare this moment.`:'Change one value. Results update before you replay.');
 const status=$('#calculation-status');if(status){status.hidden=false;status.dataset.pending=String(value||!!message);status.textContent=message||(value?'Recalculating this setup…':'');}

 $('#root').setAttribute('aria-busy',String(value));
 if(experiment==='turn'&&(value||message))for(const i of [0,1]){const box=$('#turn-case-'+i);if(box){box.className='turn-case pending';set('turn-case-'+i,`<span>${TURN_COLORS[i].name}</span><strong>${value?'Calculating corner.':'Prediction unavailable'}</strong>`);}}
 turnMap?.setDisabled(value||!!message);document.querySelectorAll('[data-turn-event]').forEach(b=>b.disabled=value||!!message);
 const inversion=$('#invert-prediction');if(inversion&&(value||message)){inversion.className='hop-prediction pending';inversion.dataset.outcome='PENDING';set('invert-prediction',`<span>ROTATION PREDICTION</span><strong>${value?'Calculating rotation.':'Prediction unavailable'}</strong><small>Evaluate the current setup before playback.</small>`);}
 const prediction=$('#hop-prediction');if(prediction&&(value||message)){prediction.className='hop-prediction pending';prediction.dataset.outcome='PENDING';set('hop-prediction',`<span>LANDING PREDICTION</span><strong>${value?'Calculating landing outcome…':'Prediction unavailable'}</strong><small>${value?'Playback is paused while the current setup is evaluated.':'Check the calculation status and inputs.'}</small>`);}

 for(const id of ['showcase-start','play','timeline','share','export','export-run','repeat','manual-fire','tuning-replay'])if($('#'+id))$('#'+id).disabled=value||!!message;
 $('#hop-landing')?.classList.toggle('pending-result',value||!!message);
 $('#invert-outcome')?.classList.toggle('pending-result',value||!!message);document.querySelectorAll('[data-invert-event]').forEach(b=>b.disabled=value||!!message);
 plots?.setDisabled(value||!!message);vessel?.setDisabled(value||!!message);document.querySelectorAll('[data-hop-event]').forEach(b=>b.disabled=value||!!message);renderTuningFeedback();
}
function selectFocus(value){
 mode=value;if(!visible[mode])visible[mode]=true;if(runs.length)run=runs[mode];
 document.querySelectorAll('[data-mode],[data-focus]').forEach(el=>{const selected=+(el.dataset.mode??el.dataset.focus)===mode;el.classList.toggle('selected',selected);el.setAttribute(el.dataset.mode!==undefined?'aria-checked':'aria-pressed',selected);if(el.dataset.mode!==undefined)el.tabIndex=selected?0:-1;});
 syncVisibility();if(comparison)drawPlots();update();
}
function syncVisibility(){document.querySelectorAll('[data-visible]').forEach(el=>el.checked=visible[+el.dataset.visible]);}
function scrub(time){sound.silence();impactStart=null;if(busy||calculationError)return;plots?.setInspection(null);vessel?.setInspection(null);t=time;if(run&&t>=duration()-.01)markRevealed();playing=false;cine=false;hideEndCard();update();}
const names=['Electric only','Fan assisted','Thrust assisted'];
const metadata={launch:{n:'01',eyebrow:'LONGITUDINAL DYNAMICS',title:'Beyond traction.',description:'Watch grip, suction, and cold gas compete in six seconds.',action:'Launch Simulation'},invert:{n:'02',eyebrow:'PRESSURE & SURFACE CONTACT',title:'Gravity, challenged.',description:'Set the angles. Rotate the platform. Watch grip challenge gravity.',action:'Rotate platform'},hop:{n:'03',eyebrow:'VERTICAL IMPULSE STUDY',title:'A moment airborne.',description:'A finite supply of gas. A brief escape from the ground.',action:'Fire thrust pulse'},turn:{n:'04',eyebrow:'STEERING & TIRE GRIP',title:'Hold the line.',description:'Same corner. Same steering. A different grip budget.',action:'Run corner comparison'}};
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function recompute(immediate=false,autoPlay=false,resumeTime=0){
 impactStart=null;const epoch=++requestEpoch,kind=experiment,snapshot={...c};clearTimeout(computeTimer);playing=false;sound.silence();cine=false;hideEndCard();
 setBusy(true);
 computeTimer=setTimeout(async()=>{
  try{
   const result=await client.compute(snapshot,kind==='launch'&&startGas?startGas:initialGas(snapshot),kind);
   if(epoch!==requestEpoch||experiment!==kind)return;
   installResult(result,resumeTime);
   if(autoPlay){playing=!document.hidden;update();}else queueDemo();
  }catch(error){if(error.name!=='AbortError'&&epoch===requestEpoch)setBusy(false,error.message);}
 },immediate?0:140);
}
// Display-only marks derived from solver samples: rubber while traction-limited, scrub while grip-limited.
function computeMarks(result){
 launchMarks=experiment==='launch'?result.runs.map(r=>{let end=0,seen=false;for(const s of r.samples){if(s.limit==='TRACTION LIMITED'){seen=true;end=s.x;}else if(seen)break;}return end;}):[0,0,0];
 turnMarks=experiment==='turn'?result.runs.map(r=>{const out=[];let last=null;for(const s of r.samples){if(!String(s.limit).startsWith('GRIP LIMITED'))continue;if(last&&Math.hypot(s.x-last.x,s.z-last.z)<.6)continue;last=s;out.push({x:s.x,z:s.z,yaw:s.yaw??0,t:s.t,len:.75});}return out;}):[];
}
function installResult(result,resumeTime=0){
 latestResult=result;computeMarks(result);comparison=['launch','turn'].includes(experiment)?result:null;activeConfig={...result.config};runs=comparison?result.runs:[];
 run=result.runs[experiment==='launch'?mode:experiment==='turn'?turnFocus:2];hopData=experiment==='hop'?hopSummary(run,activeConfig):null;
 t=Math.min(resumeTime,experiment==='launch'?6:experiment==='turn'?result.duration:run.samples.at(-1).t);
 tuningResult=tuningRows(experiment,result,units);setBusy(false);drawPlots();applyReveal();update();
}
function inputDisplay(key,value){return key==='pressure'?absoluteToGaugeBar(value):key==='turnSpeed'?value*3.6:['turnSteer','turnSweep'].includes(key)?value*180/Math.PI:value;}
function slider(key,label,min,max,step,unit){
 controlLabels[key]=label;const value=Number(inputDisplay(key,c[key]).toFixed(5)),hint=parameterHint(experiment,key);
 return `<div class="slider-control"><div class="param-heading"><label for="${key}">${label}</label><div class="param-entry"><input id="${key}-number" type="number" data-number-param="${key}" aria-label="${label}, value" aria-describedby="${key}-help" aria-errormessage="tuning-impact" min="${min}" max="${max}" step="any" data-increment="${step==='any'?1:step}" value="${value}"/><span>${unit}</span></div></div><input id="${key}" data-param="${key}" aria-label="${label}" aria-describedby="${key}-help" aria-errormessage="tuning-impact" type="range" min="${min}" max="${max}" step="${step==='any'?1:step}" data-increment="${step==='any'?1:step}" value="${value}"/><p id="${key}-help" class="parameter-hint">${hint}</p></div>`;
}
function manualNumber(key,label,min,max,unit){
 controlLabels[key]=label;
 return `<div class="slider-control manual-number"><label for="${key}">${label} <small>${unit}</small></label><input id="${key}" data-param="${key}" aria-label="${label}" aria-describedby="${key}-help" aria-errormessage="tuning-impact" type="number" min="${min}" max="${max}" step="any" data-increment=".05" value="${c[key]}"/><p id="${key}-help" class="parameter-hint">${parameterHint(experiment,key)}</p></div>`;
}
function presetControl(){
 const guide=TUNING_GUIDES[experiment],selected=selectedPresets[experiment]||'custom';
 return `<label class="preset-control" for="${experiment}-preset">TRY A SETUP</label><select id="${experiment}-preset" aria-label="${experiment[0].toUpperCase()+experiment.slice(1)} preset" aria-describedby="preset-description"><option value="custom" ${selected==='custom'?'selected':''}>Current values</option>${guide.presets.map(([value,label])=>`<option value="${value}" ${selected===value?'selected':''}>${label}</option>`).join('')}</select><p id="preset-description" class="preset-description">${guide.presets.find(p=>p[0]===selected)?.[2]||'Change one value, compare the calculated result, then replay.'}</p>`;
}
function noteTuningChange(label){if(!busy&&tuningResult){tuningPrevious=tuningResult.map(row=>({...row}));tuningEdits=[];}if(!tuningEdits.includes(label))tuningEdits.push(label);tuningEdit=tuningEdits.join(' + ');}
function syncControl(key){
 for(const el of document.querySelectorAll(`[data-param="${key}"],[data-number-param="${key}"]`)){
  if(el!==document.activeElement||el.type==='range')el.value=Number(inputDisplay(key,c[key]).toFixed(5));
  el.removeAttribute('aria-invalid');
 }
}
function renderTuningFeedback(){
 const host=$('#tuning-impact');if(!host)return;
 const pending=busy||!!calculationError||!tuningResult;
 const labels=experiment==='launch'?names:experiment==='hop'?['Apex','Landing speed']:experiment==='invert'?['Rotation outcome','Impact speed']:['No fan','Fan assisted'];
 const rows=tuningResult||labels.map((label,i)=>({id:'pending-'+i,label,value:null,detail:'',text:'--'}));
 host.setAttribute('aria-busy',String(busy));
 const status=calculationError|| (pending?'Recalculating…':tuningEdit?'Changed: '+tuningEdit:'Current setup');
 set('tuning-impact',`<div class="tuning-result-heading">PREDICTED RESULT${experiment==='launch'?' / '+speedUnit(units).milestone:''}<small title="${status.replaceAll('&','&amp;').replaceAll('"','&quot;')}">${status}</small></div><div class="tuning-results">${rows.map(row=>{
  const before=tuningPrevious?.find(old=>old.id===row.id),difference=pending?'':tuningEdit?tuningDifference(row,before):'';
  return `<div class="tuning-result-row ${!pending&&['WRECKED','LEFT LANE'].includes(row.detail)?'tuning-alert':''}"><span>${row.label}<small class="tuning-row-detail">${!pending&&row.value!==null?row.detail:'&nbsp;'}</small></span><strong>${pending?'--':row.text}</strong><small class="tuning-difference" title="${difference}">${difference||'&nbsp;'}</small></div>`;
 }).join('')}</div>`);
}
function tuningPanel(){return `<aside id="tuning-panel" class="controls tuning-panel" ${parametersOpen?'':'hidden'} data-tuning-kind="${experiment}" aria-labelledby="setup-title"><div class="panel-heading"><div><span class="eyebrow">${metadata[experiment].n} / EXPLORE</span><h2 id="setup-title" tabindex="-1">${TUNING_GUIDES[experiment].title}</h2></div><div class="parameter-actions"><button id="parameters-close" class="icon-btn" aria-label="Close parameters" title="Close parameters">×</button><button id="defaults" class="icon-btn" aria-label="Restore default parameters" title="Reset this setup">${icon('reset')}</button></div></div><p class="tuning-guide">${TUNING_GUIDES[experiment].start}</p><div class="tuning-feedback"><div id="tuning-impact" role="status" aria-live="polite"></div><button id="tuning-replay" class="tuning-replay">${icon('play')} Replay with these values</button><p id="tuning-clock">Changing values pauses and recalculates the current moment.</p></div><div class="tuning-inputs">${controls()}</div></aside>`;}
function landingControls(){return `<label class="preset-control">LANDING BURN MODE<select id="landing-burn" aria-label="Landing burn mode">${['Off / ballistic return','Automatic / predicted braking','Manual / timed burn'].map((name,i)=>`<option value="${i}" ${c.landingBurn===i?'selected':''}>${name}</option>`).join('')}</select><small id="landing-mode-note"></small></label><section id="manual-settings" class="manual-settings" ${c.landingBurn===2?'':'hidden'}>${manualNumber('manualBurnAt','Manual ignition time, T+',0,120,'s')}${manualNumber('manualBurnDuration','Manual burn duration',0,5,'s')}${slider('manualBurnCommand','Manual valve command',0,100,1,'%')}<p>The selected window fires on descent. Once lit, it stays on until cutoff or contact; firing too early can cause a rebound. Fire now moves the window to your current descent time.</p></section>`;}
function updateLandingControls(){
 if(!$('#landing-burn'))return;
 $('#manual-settings').hidden=c.landingBurn!==2;if($('#automatic-settings'))$('#automatic-settings').hidden=c.landingBurn!==1;
 $('#manual-fire-row').hidden=c.landingBurn!==2;
 $('#landing-mode-note').textContent=c.landingBurn===2?'Prediction assumes the selected manual window; Fire now changes its timing.':c.landingBurn===1?'Forecasts remaining blowdown. Target '+c.landingTarget+' m/s.':'No descent braking; the vehicle returns ballistically.';
 for(const key of ['manualBurnAt','manualBurnDuration'])if($('#'+key))$('#'+key).value=c[key];
}
function canFireManual(sample){return experiment==='hop'&&activeConfig.landingBurn===2&&!busy&&!calculationError&&sample.y>0&&sample.vy<0&&t<duration()-1e-8&&activeConfig.manualBurnDuration>0&&activeConfig.manualBurnCommand>0&&(run.landing.burnStart===null||t<run.landing.burnStart-1e-8);}
function updateLandingPrediction(){
 if(!run||busy||calculationError)return;
 const p=hopLandingPrediction(run),el=$('#hop-prediction');if(!el)return;
 const key=JSON.stringify([p.outcome,p.detail,activeConfig.landingBurn,activeConfig.manualBurnAt,activeConfig.manualBurnDuration,activeConfig.manualBurnCommand]);
 if(el.dataset.predictionKey===key&&el.dataset.outcome===p.outcome)return;
 el.dataset.predictionKey=key;
 el.className='hop-prediction '+p.tone;el.dataset.outcome=p.outcome;
 const manual=activeConfig.landingBurn===2;
 set('hop-prediction',`<div><span>LANDING PREDICTION / CURRENT SETUP</span><strong>${p.title}</strong><small>${p.detail}</small></div><p>${manual?`Assumes manual window T+${activeConfig.manualBurnAt.toFixed(2)}–${(activeConfig.manualBurnAt+activeConfig.manualBurnDuration).toFixed(2)} s at ${activeConfig.manualBurnCommand}% valve command. Fire now updates this prediction.`:activeConfig.landingBurn===1?'Automatic braking from the remaining tank.':'Ballistic return; landing burn off.'} ${p.speed===null?'':'Computed before playback using the same trajectory and cosmetic damage rule.'}</p>`);
}
function controls(){
 const common=slider('mass','Dry vehicle mass',1200,2600,50,'kg')+slider('volume','Tank volume',80,600,20,'L');
 let primary='',more='';
 if(experiment==='launch'){
  primary=slider('grip','Tire grip',.4,1.8,.05,'μ')+slider('fan','Fan command',0,100,1,'%')+slider('pressure','Initial gauge pressure',0,650,'any','barg');
  more=slider('boostAt','Boost delay',0,2,.05,'s')+slider('power','Electrical power cap',400,1300,50,'kW')+slider('nozzle','Nozzle area',2,20,.5,'cm²')+slider('leak','Seal leakage',0,100,1,'%')+common;
 }else if(experiment==='invert'){
  primary=slider('invertStart','Starting angle',0,180,1,'°')+slider('angle','Final angle',0,180,1,'°')+slider('invertDuration','Rotation duration',1,20,.5,'s')+slider('fan','Fan command',0,100,1,'%');
  more=slider('grip','Tire grip',.4,1.8,.05,'μ')+slider('leak','Seal leakage',0,100,1,'%')+common+slider('wreckSpeed','Cosmetic wreck threshold',1,20,.5,'m/s');
 }else if(experiment==='hop'){
  primary=slider('pulse','Ascent pulse duration',.1,1.5,.05,'s')+slider('pressure','Initial gauge pressure',0,650,'any','barg')+landingControls();
  more=slider('nozzle','Nozzle bank area',2,20,.5,'cm²')+common+`<div id="automatic-settings" ${c.landingBurn===1?'':'hidden'}>${slider('landingTarget','Automatic touchdown target',.25,5,.25,'m/s')}${slider('landingLead','Automatic ignition lead',0,.2,.005,'s')}</div>`+slider('wreckSpeed','Cosmetic wreck threshold',1,20,.5,'m/s');
 }else{
  primary=slider('turnSpeed','Commanded speed',30,180,5,'km/h')+slider('fan','Fan command',0,100,1,'%')+slider('turnSteer','Front-wheel steering',-15,15,.1,'°');
  more=slider('grip','Tire grip',.4,1.8,.05,'μ')+slider('leak','Seal leakage',0,100,1,'%')+slider('turnRadius','Road centreline radius',20,80,1,'m')+slider('turnSweep','Road corner sweep',45,120,5,'°')+slider('turnWidth','Road width',8,16,.5,'m')+slider('power','Shared electrical power cap',400,1300,50,'kW')+common;
 }
 const thermal=`<details class="tuning-more"><summary>Vessel heat exchange <small>Gas temperature &amp; heat input</small></summary>${slider('heatTransfer','Thermal conductance',0,2000,50,'W/K')}${slider('heatSourceTemp','Heat source temperature',250,350,1,'K')}<p class="parameter-hint">Heat rate = conductance × (source temperature − internal gas temperature). Positive adds energy; 0 W/K is adiabatic. Assumed source reservoir, without a separate wall heat capacity.</p></details>`;
 const delivery=['launch','hop'].includes(experiment)?`<details class="tuning-more delivery-settings" open><summary>Thrust delivery <small>Valve · feed · nozzle</small></summary>${slider('valveRise','Valve opening time',0,.2,.01,'s')}${slider('feedLoss','Feed pressure loss',0,30,1,'%')}${slider('expansionRatio','Nozzle expansion ratio',1,1.5,.05,'×')}<p class="parameter-hint">Opening ramps up smoothly; closure is immediate. Expansion ratio is exit area ÷ throat area. Start with a short hop to explore a bell nozzle.</p></details>`:'';
 return presetControl()+primary+delivery+thermal+`<details class="tuning-more"><summary>More variables <small>${TUNING_GUIDES[experiment].more}</small></summary>${more}</details><details class="tuning-model"><summary>Model & assumptions</summary><p>${TUNING_GUIDES[experiment].scope}</p><p>Pressure inputs are gauge (barg); calculations use absolute pressure. Real dry air uses a consistent Peng–Robinson approximation from 140–2000 K. Colder/phase-ambiguous states are unsupported. Vessel structural mass and separate wall heat capacity are omitted. Each experiment keeps its own settings in this session. These results are illustrative, not Tesla performance validation.</p></details><details class="audio-controls"><summary>Sound settings</summary><label for="sound-music">Background music <output id="sound-music-value">${Math.round(sound.musicVolume*100)}%</output></label><input id="sound-music" aria-label="Background music volume; zero mutes music" type="range" min="0" max="100" step="1" value="${Math.round(sound.musicVolume*100)}"/><label for="sound-effects">Simulation effects <output id="sound-effects-value">${Math.round(sound.effectsVolume*100)}%</output></label><input id="sound-effects" aria-label="Simulation effects volume; zero mutes effects" type="range" min="0" max="100" step="1" value="${Math.round(sound.effectsVolume*100)}"/><p id="sound-status" role="status">${sound.status}</p><p>Sound starts automatically when allowed, or with your first interaction. Music continues while paused; effects follow the selected car. Set either volume to zero to mute it. Conceptual recordings created with ElevenLabs.</p></details>`;
}
// One camera control in the same place for every experiment; values map to the existing per-experiment state.
const CAMERA_OPTIONS={launch:[['cinema','Director'],['field','Overview'],['side','Side'],['focus','Focus car']],invert:[['field','Whole rig'],['track','Track car']],hop:[['field','Envelope'],['track','Track car'],['under','Thrusters']],turn:[['field','Corner'],['focus','Follow car']]};
const CLOSE_CAMERA={launch:'focus',invert:'track',hop:'track',turn:'focus'};
function cameraValue(){return experiment==='launch'?camera:experiment==='hop'?hopCamera:experiment==='turn'?turnCamera:invertCamera;}
function setCameraValue(value){if(experiment==='launch')camera=value;else if(experiment==='hop')hopCamera=value;else if(experiment==='turn')turnCamera=value;else invertCamera=value;}
function cameraSwitch(){return `<div class="camera-switch hud-auto" role="group" aria-label="Camera">${CAMERA_OPTIONS[experiment].map(([value,label])=>`<button data-cam="${value}" aria-pressed="${cameraValue()===value}">${label}</button>`).join('')}${experiment==='launch'?`<button id="auto-frame" class="auto-frame" aria-pressed="${autoFrame}" title="Keep every visible car in frame">Auto frame</button>`:''}</div>`;}
function syncCameraButtons(){document.querySelectorAll('[data-cam]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cam===cameraValue())));}
function chooseCamera(value,{animated=!reducedMotion(),manual=true}={}){if(manual)autoCloseFrom=null;setCameraValue(value);cine=false;scene?.transitionCamera(selectedCamera(),animated);syncCameraButtons();update();}
// Cutaway and force vectors are unreadable from an overview, so move closer and return afterwards.
function closeUpForInspection(){
 if(!scene||showcase)return;const close=CLOSE_CAMERA[experiment],current=cameraValue();
 if(current===close)return;autoCloseFrom={experiment,value:current};chooseCamera(close,{manual:false});toast(cutaway?'Moved closer so the cutaway is readable.':'Moved closer so the force vectors are readable.');
}
function restoreAfterInspection(){
 if(cutaway||vectors||!autoCloseFrom||autoCloseFrom.experiment!==experiment)return;
 const value=autoCloseFrom.value;autoCloseFrom=null;if(cameraValue()===CLOSE_CAMERA[experiment])chooseCamera(value,{manual:false});
}
function turnFocusStrip(){return `<div class="turn-focus" role="group" aria-label="Selected Turn car">${TURN_COLORS.map((color,i)=>`<button data-turn-focus="${i}" aria-pressed="${turnFocus===i}" style="--scenario:${color.hex}"><i></i>${color.name}</button>`).join('')}<span>Independent runs / shared start</span></div>`;}
function turnPredictions(){return `<section class="turn-predictions" aria-label="Predicted corner outcomes" data-spoiler="Corner outcomes revealed after the run">${TURN_COLORS.map((color,i)=>`<article id="turn-case-${i}" class="turn-case pending" style="--scenario:${color.hex}"><span>${color.name}</span><strong>Calculating corner.</strong></article>`).join('')}</section>`;}
// Analysis views share one tab strip so the page stays short; the scene can dock while you read.
const ANALYSIS_TABS={launch:[['kinematics','Kinematics'],['vessel','Pressure vessel'],['forces','Force delivery']],hop:[['flight','Flight'],['vessel','Pressure vessel'],['forces','Impulse']],invert:[['contact','Contact & motion'],['forces','Forces']],turn:[['corner','Corner']]};
function analysisPane(id){
 if(id==='kinematics')return '<section id="kinematic-plots" class="kinematic-plots" aria-label="Three-scenario kinematic analysis"></section><div id="milestone-results" class="milestone-results" data-spoiler="Milestones revealed after the run"></div>';
 if(id==='flight')return '<section class="hop-analysis" aria-label="Vertical flight analysis"><div class="hop-analysis-heading"><div><span class="eyebrow">TRAJECTORY / SIGNED MOTION</span><h2>The way up. The way down.</h2></div><p>Vertical velocity is positive upward and negative on descent. Touchdown velocity is pre-impact; valves close at contact. Optional braking consumes the ascent tank; damage is a cosmetic threshold effect, not a structural simulation.</p></div><div id="hop-events" class="hop-event-controls" data-spoiler="Event times revealed after the run"></div><div id="hop-landing" class="hop-landing" role="status" data-spoiler="Touchdown outcome revealed after the run"></div><div id="hop-plots" class="hop-plots"></div></section>';
 if(id==='contact')return '<section class="hop-analysis invert-analysis" aria-label="Dynamic Invert analysis"><div class="hop-analysis-heading"><div><span class="eyebrow">CONTACT / FRICTION / GRAVITY</span><h2>Hold. Slide. Let go.</h2></div><p>Press Play to rotate from the starting angle to the final angle, then hold for two seconds. Grip and contact respond to the moving deck. Seal loss removes suction. Pitch follows the guided deck until detachment, then retains its angular velocity. A new deck collision stops the model before penetration; damage is cosmetic.</p></div><div id="invert-events" class="hop-event-controls" data-spoiler="Event times revealed after the run"></div><div id="invert-outcome" class="hop-landing" data-spoiler="Outcome revealed after the run"></div><div id="invert-plots" class="hop-plots"></div></section>';
 if(id==='corner')return turnAnalysis();
 if(id==='vessel')return '<section id="vessel-analysis" class="vessel-analysis" aria-label="Pressure vessel and blowdown analysis"></section>';
 return `<section class="secondary-analysis"><section class="bottom-grid ${experiment!=='invert'?'force-only':''}"><article class="plot-card"><div class="plot-title"><span><i class="red"></i><b id="plot1-title">FORCE DELIVERY</b></span><span id="force-value">0.0 kN</span></div><svg id="force-chart" viewBox="0 0 400 95" role="img" aria-label="Tire force and gas thrust over time"></svg><div class="plot-axis"><span id="plot1-start">0 s</span><span id="plot1-end">6 s</span></div></article><article class="plot-card legacy-pressure" ${experiment!=='invert'?'hidden':''}><div class="plot-title"><span><i class="blue"></i><b id="plot2-title">VESSEL PRESSURE</b></span><span id="pressure-value">${c.pressure.toFixed(0)} bara</span></div><svg id="pressure-chart" viewBox="0 0 400 95" role="img" aria-label="Pressure over time"></svg><div class="plot-axis"><span id="plot2-start">0 s</span><span id="plot2-end">6 s</span></div></article><article class="comparison-card" data-spoiler="Comparison revealed after the run"><div class="plot-title"><span id="bottom-title">THE SAME CAR. DIFFERENT PHYSICS.</span><span class="assumed-tag">SIMULATED</span></div><div id="comparisons"></div></article></section></section>`;
}
function analysisTabs(){
 const tabs=ANALYSIS_TABS[experiment],active=tabs.some(([id])=>id===analysisTab[experiment])?analysisTab[experiment]:tabs[0][0];
 return `<div class="analysis-tabs" role="tablist" aria-label="Analysis views" ${tabs.length<2?'hidden':''}>${tabs.map(([id,label])=>`<button role="tab" id="analysis-tab-${id}" data-analysis-tab="${id}" aria-controls="analysis-${id}" aria-selected="${id===active}" tabindex="${id===active?0:-1}">${label}</button>`).join('')}</div>${tabs.map(([id])=>`<div id="analysis-${id}" class="analysis-pane" role="tabpanel" aria-labelledby="analysis-tab-${id}" ${id===active?'':'hidden'}>${analysisPane(id)}</div>`).join('')}`;
}
function selectAnalysisTab(id,focus=false){
 analysisTab[experiment]=id;
 document.querySelectorAll('[data-analysis-tab]').forEach(b=>{const on=b.dataset.analysisTab===id;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus({preventScroll:true});});
 document.querySelectorAll('.analysis-pane').forEach(p=>p.hidden=p.id!=='analysis-'+id);
}
// Predict-then-reveal (reveal.js). Outcomes stay veiled until the run reaches its end, the viewer reveals them,
// or Parameters (explore mode, which always shows calculated results) is open. Demo, capture and showcase never veil.
const revealedKeys=new Set(),predictions=new Map();
function currentRevealKey(){return latestResult?revealKey(experiment,activeConfig,experiment==='launch'?startGas:null):null;}
function isRevealed(){const key=currentRevealKey();return demo||capture||parametersOpen||!!showcase||!key||revealedKeys.has(key);}
function markRevealed(){const key=currentRevealKey();if(key&&!revealedKeys.has(key)){revealedKeys.add(key);applyReveal();}}
function applyReveal(){const revealed=isRevealed();$('#root').classList.toggle('awaiting-reveal',!revealed);plots?.setReveal(revealed);vessel?.setReveal(revealed);turnMap?.setReveal(revealed);renderStageCard();return revealed;}
function stageState(){
 if(!run||busy||calculationError||showcase||docked||playing)return 'hidden';
 if(t>=duration()-1e-6)return demo||capture?'hidden':'result';
 return t<=0?'start':'hidden';
}
function renderStageCard(){
 const el=$('#stage-card');if(!el)return;
 const state=stageState();el.hidden=state==='hidden';el.dataset.state=state;
 if(state==='hidden')return;
 const q=PREDICTIONS[experiment],key=currentRevealKey(),choice=predictions.get(key),m=metadata[experiment];
 if(state==='start'){
  const ask=!isRevealed()&&q;
  set('stage-card',`${ask?`<div class="stage-question"><span class="eyebrow">PREDICT FIRST</span><strong id="stage-prompt">${q.prompt}</strong><div class="stage-options" role="radiogroup" aria-labelledby="stage-prompt">${q.options.map(([value,label])=>`<button role="radio" data-predict="${value}" aria-checked="${choice===value}">${label}</button>`).join('')}</div></div>`:''}<button class="stage-play" data-stage-play>${icon('play')}<span>${m.action}</span></button>${ask?'<button class="stage-skip" data-stage-reveal>Skip the guess · show results</button>':''}`);
  return;
 }
 const graded=gradePrediction(experiment,latestResult,choice);
 const verdict=!graded?.choice?'Results are unlocked in the panels below.':graded.correct===null?`You picked “${graded.choiceLabel}”. This setup has no single graded answer.`:graded.correct?`You called it: “${graded.choiceLabel}”.`:`You picked “${graded.choiceLabel}”. Not this time.`;
 set('stage-card',`<div class="stage-result ${graded?.correct===true?'correct':graded?.correct===false?'missed':''}"><span class="eyebrow">RESULT</span><strong>${graded?.answer.label??'Run complete'}</strong><p>${verdict}</p></div><div class="stage-actions"><button class="stage-play" data-stage-replay>${icon('reset')}<span>Replay</span></button><button class="stage-secondary" data-stage-data>See the data ${icon('arrow')}</button></div>`);
}
// Keep the scene in view while reading the analysis: dock it as a mini player once its slot scrolls away.
let dockObserver=null,slotRatio=1,docked=false,dockDismissed=false,hudTimer=0;
function observeDock(){
 dockObserver?.disconnect();dockObserver=null;docked=false;slotRatio=1;
 const slot=$('.viewport-slot');if(!slot||typeof IntersectionObserver==='undefined')return;
 dockObserver=new IntersectionObserver(entries=>{slotRatio=entries.at(-1).intersectionRatio;if(slotRatio>.6)dockDismissed=false;syncDock();},{threshold:[0,.15,.3,.45,.6,.8,1]});
 dockObserver.observe(slot);
}
function syncDock(){
 const viewport=$('.viewport'),slot=$('.viewport-slot');if(!viewport||!slot)return;
 const want=!!scene&&!showcase&&!capture&&!dockDismissed&&slotRatio<.3&&(playing||(t>0&&t<duration()-1e-6));
 if(want===docked)return;
 if(want)slot.style.height=viewport.offsetHeight+'px';else slot.style.removeProperty('height');
 docked=want;viewport.classList.toggle('docked',want);document.body.classList.toggle('scene-docked',want);
 $('#dock-return').hidden=!want;$('#dock-close').hidden=!want;
 if(scene)scene.dirty=true;renderStageCard();
}
function wakeHud(){const viewport=$('.viewport');if(!viewport)return;viewport.classList.add('hud-awake');clearTimeout(hudTimer);hudTimer=setTimeout(()=>viewport.classList.remove('hud-awake'),2600);}
function dismissOrbitHint(){document.body.classList.add('hint-seen');try{localStorage.setItem('roadsterlab.hintSeen','1');}catch{}}
function setUnits(value){
 units=value==='us'?'us':'si';try{localStorage.setItem('roadsterlab.units',units);}catch{}
 document.querySelectorAll('[data-units]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.units===units)));
 plots?.setSpeedUnits(units);if(latestResult){tuningResult=tuningRows(experiment,latestResult,units);tuningPrevious=null;tuningEdit='';tuningEdits=[];renderTuningFeedback();}drawPlots();update();
}
function mount(readyResult=null,resumeTime=0){const returnToTune=!!document.activeElement?.closest('#tuning-panel');if(tuningKind!==experiment){tuningKind=experiment;tuningResult=null;tuningPrevious=null;tuningEdit='';tuningEdits=[];}disposeUI();sound.silence();lastSize='';frameIntervals=[];renderCosts=[];lastFrameTime=0;turnMap?.dispose();turnMap=null;document.body.classList.remove('setup-open');plots?.dispose();plots=null;vessel?.dispose();vessel=null;client.cancel();run=null;hopData=null;comparison=null;runs=[];scene?.dispose();scene=null;const m=metadata[experiment],speedLabel=speedUnit(units).label;$('#root').innerHTML=`<a class="skip-link" href="#scene">Skip to vehicle</a>
<header class="topbar">
 <a class="brand" href="./" aria-label="RoadsterLAB home"><span class="brand-symbol">${icon('bolt')}</span><span class="brand-wordmark">Roadster<span>LAB</span></span><span class="brand-divider"></span><small>INTERACTIVE VEHICLE PHYSICS</small></a>
 <nav class="tabs hud-tabs mode-tabs" aria-label="Simulations">${['launch','invert','hop','turn'].map((x,i)=>`<button data-tab="${x}" class="${experiment===x?'active':''}" ${experiment===x?'aria-current="page"':''}><small>0${i+1}</small>${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</nav>
 <div class="top-actions">
  <button id="sound" class="sound-toggle quiet" aria-pressed="${sound.wantedEnabled}" aria-label="Toggle simulation sound">${icon(sound.wantedEnabled?'sound':'mute')}<span>Sound ${sound.wantedEnabled?'on':'off'}</span></button>
  <button id="showcase-start" class="quiet showcase-trigger" title="36-second guided showcase" aria-label="Showcase">${icon('play')}<span>Showcase</span></button>
  <button id="tune" class="quiet" aria-controls="tuning-panel" aria-expanded="${parametersOpen}">${icon('sliders')}<span>Parameters</span></button>
  <button id="capture-toggle" class="quiet" aria-pressed="false" aria-label="Capture layout" title="Capture layout">${icon('expand')}<span>Capture</span></button>
  <button id="about" class="quiet" aria-label="The model" title="The model">${icon('info')}<span>The model</span></button>
  <button id="share" class="quiet" aria-label="Share" title="Share">${icon('share')}<span>Share</span></button>
 </div>
</header>
<main>
<section class="workspace">
 <div class="lab-layout">
  <div class="center-column">
   <div class="page-heading stage-heading"><div class="eyebrow"><span>SIMULATION ${m.n}</span> / ${m.eyebrow}</div><h1>${m.title}</h1><p>${m.description}</p></div>
   <div class="viewport-slot">
   <section class="viewport" aria-label="Interactive 3D vehicle">
    <canvas id="scene" aria-label="3D vehicle. Drag to orbit, pinch or use plus and minus to zoom, arrow keys to orbit." tabindex="0"></canvas>
    <div class="viewport-top">
     <div class="scene-heading"><span class="view-label"><i></i><b id="run-label">RUN 01</b></span><span id="scene-mode">${experiment==='launch'?names[mode].toUpperCase():experiment.toUpperCase()+' / READY'}</span><small id="scene-detail">SI-based model · deterministic playback</small></div>
     ${cameraSwitch()}
    </div>
    <div id="calculation-status" class="calculation-status" role="status" hidden></div>
    <div id="stage-card" class="stage-card" hidden></div>
    <div id="cutaway-label" class="cutaway-label" hidden><i></i><div>PRESSURE VESSEL<small id="tank-label">${c.volume} L · compressed air</small></div></div>
    <div class="scene-bottom hud-auto">
     <span class="orbit-hint">${icon('expand')} DRAG / PINCH <span>·</span> ARROWS ORBIT <span>·</span> ± ZOOM</span>
     <div class="camera-tools"><button id="zoom-in" class="icon-btn" aria-label="Zoom in">+</button><button id="zoom-out" class="icon-btn" aria-label="Zoom out">−</button><button id="camera-reset" class="icon-btn" aria-label="Reset camera">${icon('reset')}</button></div>
    </div>
    <div class="view-tools hud-auto"><button id="cutaway" aria-pressed="false">${icon('layers')}<span>Cutaway</span><b class="toggle-state" aria-hidden="true"></b></button><button id="vectors" aria-pressed="false">${icon('arrow')}<span>Forces</span><b class="toggle-state" aria-hidden="true"></b></button></div>
    ${experiment==='launch'?`<div class="world-labels">${names.map((name,i)=>`<button data-world-focus="${i}" style="--scenario:${SCENARIO_COLORS[i].hex}">${name}<span></span></button>`).join('')}</div><div id="distance-marks"></div>`:''}
    ${experiment==='hop'?'<div class="hop-world-hud" aria-hidden="true"><div id="hop-ruler"></div><div id="hop-height-label" class="hop-height-label"></div><div id="hop-apex-label" class="hop-apex-label">APEX</div></div><div class="hop-scale-tag hud-auto">ALTITUDE RULER / METRES · 1:1</div>':''}
    ${experiment==='invert'?'<div id="invert-gauge" class="invert-gauge" aria-hidden="true"></div>':''}
    <div id="scene-error" hidden></div>
    <button id="dock-return" class="dock-return" hidden>${icon('arrow')} Back to the scene</button>
    <button id="dock-close" class="dock-close" aria-label="Close the mini player" hidden>×</button>
    <div class="corner-mark tl"></div><div class="corner-mark br"></div>
   </section>
   </div>
   <div class="transport">
    <button id="play" class="launch-button" aria-keyshortcuts="Space">${icon('play')}<span>${m.action}</span></button>
    <button id="edit-parameters" class="parameters-link parameters-button">${icon('sliders')}<span>Parameters</span></button>
    <button id="rewind" class="icon-btn rewind-btn" aria-label="Rewind playback">${icon('reset')}</button>
    <div class="time-controls"><div><span id="time">T + 0.00 s</span><span id="duration">06.00 s</span></div><input id="timeline" aria-label="Simulation time" type="range" min="0" max="6" step=".01" value="0"/></div>
    <button id="speed" class="speed-button" aria-label="Change playback speed" title="Cycle playback: 1×, 0.25×, 0.5×">${speed}×</button>
   </div>
   ${experiment==='hop'?'<div id="manual-fire-row" class="manual-fire-row" hidden><button id="manual-fire" disabled>Fire manual burn now</button><span id="manual-fire-note">Available during descent, before ignition. The scheduled window will still fire unless moved.</span></div>':''}
   ${experiment==='launch'?`<div class="scenario-strip">${names.map((name,i)=>`<div style="--scenario:${SCENARIO_COLORS[i].hex}"><button data-focus="${i}" aria-pressed="${mode===i}"><i></i>${name}</button><label class="show-toggle"><input data-visible="${i}" aria-label="Show ${name}" type="checkbox" ${visible[i]?'checked':''}/> Show</label><strong id="lane-stat-${i}">—</strong></div>`).join('')}</div>`:''}
   ${experiment==='hop'?'<section class="hop-flight-strip" aria-label="Flight summary"><div><span>FLIGHT PHASE</span><strong id="hop-phase">READY</strong></div><div data-spoiler="After the run"><span>APEX</span><strong id="hop-apex-stat">—</strong></div><div data-spoiler="After the run"><span>FLIGHT DURATION</span><strong id="hop-time-stat">—</strong></div><div><span>THRUST / WEIGHT</span><strong id="hop-twr">—</strong></div></section>':''}
   ${experiment==='turn'?turnFocusStrip():''}
   ${experiment==='invert'?'<section id="invert-prediction" class="hop-prediction pending" role="status" data-spoiler="Outcome revealed after the run"><span>ROTATION PREDICTION</span><strong>Calculating rotation.</strong></section>':''}
   ${experiment==='hop'?'<section id="hop-prediction" class="hop-prediction pending" role="status" aria-live="polite" data-spoiler="Landing outcome revealed after the run"><span>LANDING PREDICTION</span><strong>Calculating landing outcome…</strong></section>':''}
   ${experiment==='turn'?turnPredictions():''}
   <aside class="telemetry">
    <div class="panel-heading">Live telemetry <span class="tiny-live">●</span></div>
    <div class="primary-metric"><div class="metric-label"><span id="primary-label">VELOCITY</span>${['launch','turn'].includes(experiment)?`<div class="units-toggle" role="group" aria-label="Speed units"><button data-units="si" aria-pressed="${units==='si'}">km/h</button><button data-units="us" aria-pressed="${units==='us'}">mph</button></div>`:''}</div><div><strong id="velocity">0</strong><small id="primary-unit">${speedLabel}</small></div><div class="meter"><i id="velocity-meter"></i></div></div>
    <div class="metric-pair"><div><span id="secondary-label">ACCELERATION</span><strong id="acceleration">0.00 <small>g</small></strong></div><div><span id="third-label">DISTANCE</span><strong id="distance">0.0 <small>m</small></strong></div></div>
    <div class="result-card" data-spoiler="Revealed after the run"><span id="result-label">PREDICTED ${speedUnit(units).milestone.toUpperCase()}</span><div><strong id="result">—</strong><small id="result-unit">seconds</small></div><p id="result-note">Standing start · no rollout</p></div>
    <div class="constraint" aria-live="polite"><span>ACTIVE STATE</span><strong id="constraint">READY TO LAUNCH</strong><p id="insight">Explore how grip, suction and thrust shape a launch.</p></div>
    <div class="gas-remaining"><div><span>GAS INVENTORY</span><strong id="gas-percent">100%</strong></div><div class="gas-bars">${Array(25).fill('<i></i>').join('')}</div><small id="gas-mass">— kg remaining</small></div>
    <button id="repeat" class="repeat-button" title="Uses the focused car's final tank state as the starting inventory for all three comparisons.">Launch again, same tank ${icon('arrow')}</button>
    <button id="refill" class="refill-button">Refill tank & reset</button>
   </aside>
   <div class="legend"><span id="leg-1"><i class="green"></i>TIRE FORCE</span><span id="leg-2"><i class="red"></i>COLD-GAS THRUST</span><span id="leg-3"><i class="blue"></i>FAN + AERO LOAD</span><button id="export">${icon('download')} ${experiment==='launch'?'Comparison CSV':'CSV'}</button>${experiment==='launch'?'<button id="export-run">Focused run CSV</button>':''}</div>
   <details class="keyboard-help"><summary>Keyboard controls</summary><p><kbd>Space</kbd> play / pause · <kbd>[</kbd> <kbd>]</kbd> scrub · focus the vehicle to orbit with arrow keys, zoom with <kbd>+</kbd> <kbd>−</kbd>, or reset its camera with <kbd>0</kbd>. Use arrow keys within experiment and powertrain choices. Shortcuts pause while editing inputs.</p></details>
  </div>${tuningPanel()}
 </div>
</section>
<div class="analysis-heading"><div><span class="eyebrow">SYNCHRONIZED TELEMETRY</span><h2>Inside the experiment.</h2></div><p>Explore the forces and finite resources behind the motion.</p></div>
${analysisTabs()}
${engineeringSection()}<footer><span><i></i> Assumed parameters. Not affiliated with Tesla. Scenery: Starbase-inspired sunrise, an artistic setting.</span><span><b>RoadsterLAB / ${AUTHOR.name}</b></span></footer>
<div id="end-card" class="end-card" hidden><span class="end-mark">${icon('bolt')}</span><strong>RoadsterLAB</strong><p id="end-url">Independent Roadster physics lab</p><small>Independent simulation · illustrative parameters · not Tesla specs</small></div>
</main>
<dialog id="model-dialog" aria-labelledby="model-title"><button id="close-dialog" class="close-dialog" aria-label="Close model documentation">×</button><div class="eyebrow">THE ENGINEERING BEHIND THE EXPERIENCE</div><h2 id="model-title">Real principles.<br>Open assumptions.</h2><p>RoadsterLAB is an independent, reduced-order physics experiment inspired by the Roadster. It does not predict or validate Tesla vehicle performance.</p><button id="full-model" class="quiet">Explore all equations &amp; assumptions</button><div class="doc-grid"><section><h3>01 / Launch</h3><p>Newton’s second law couples rear-tire force, direct gas thrust, drag and rolling resistance. Rear axle loading is calculated from a quasi-static pitch balance. Tire force is limited by friction, torque and available power.</p><code>m dv/dt = F_tire + F_thrust − D − F_roll</code></section><section><h3>02 / Suction</h3><p>An assumed fan curve intersects a seal-leakage curve. The pressure difference acts over 4 m². Invert rotates a platform smoothly between your starting and final angles. Rotation changes normal load and tangential demand. Coulomb friction holds or slides it on a finite deck; seal loss removes suction. After support is lost, the car translates under gravity until ground impact. Pitch follows the guided deck while supported. Departure spin is conserved in flight. A new deck collision stops the model; edge tipping and collision response remain unsupported. The external rig actuator supplies motion; its power is not vehicle battery draw.</p><code>F_fan = Δp A · N = F_fan + m(g cos θ + qα + 2q̇ω − hω²)</code></section><section><h3>03 / Gas & heat</h3><p>A well-mixed tank uses consistent Peng–Robinson dry-air properties. Heat input is UA(T_source − T_gas), with adjustable conductance and imposed source temperature. Discharge is an open-system (m, u) blowdown through an isentropic real-gas nozzle (Cd = 0.9), with optional bell expansion, a prescribed valve opening ramp and assumed feed pressure loss. Feed throttling preserves enthalpy. A bell demanding sub-ambient exit pressure is approximated as separated throat-only delivery. Unsupported gas/nozzle states are flagged; the conservative gas domain starts at 140 K. No regulator, separate wall heat capacity or phase-change model is included.</p><code>d(mu)/dt = Q̇ − ṁ h₀ · nozzle: isentropic real gas</code></section><section><h3>04 / Hop</h3><p>Four balanced thrusters provide vertical motion. Optional descent braking draws from the remaining tank without refilling. Automatic mode forecasts the remaining real-air blowdown to choose coast and full-burn timing. Manual mode uses your scheduled window and fixed valve command; an early burn can cause rebound. The pre-run landing prediction uses the same simulated trajectory as playback. A bounded valve command then limits descent speed near the tunable touchdown target. Forecast limits close the valve before unsupported gas states; they remain visible in the result. Above the adjustable wreck speed, a cosmetic effect follows touchdown. No attitude controller or structural impact dynamics are modeled.</p><code>m d²y/dt² = F_thrust − mg</code></section><section><h3>05 / Turn</h3><p>Two independent runs share commanded speed, front-wheel steering, hardware and gas inventory. Steady-state bicycle geometry requests a curvature. A combined tire-friction circle reserves drive force before supplying lateral force; excess demand caps curvature and makes the path wider. Fan draw and steady drive load share the electrical budget. The finite track is separate from steering. Painted lane edges mark a departure event; cars continue into grass runoff without an impact. Speed, steering and available grip remain unchanged on the grass; terrain interaction is omitted. No transient tire-slip, yaw-stability, suspension, rollover or structural impact model is solved.</p><code>F_lat,max = sqrt((μN)² − F_drive²) · |κ| ≤ F_lat,max / (m v²)</code></section></div><h3>What the numbers mean</h3><p>Every vehicle and component input is an illustrative assumption. The defaults are ${DEFAULTS.mass} kg dry mass, ${DEFAULTS.power} kW electrical power, ${DEFAULTS.volume} L storage and ${absoluteToGaugeBar(DEFAULTS.pressure)} barg (${DEFAULTS.pressure.toFixed(5)} bara). Stored mass comes from the consistent Peng-Robinson EOS (below ideal-gas pV/RT at the default fill). No launch time is calibrated to a manufacturer claim.</p><p>Launch uses RK4 with a 2 ms step, milestone interpolation and a two-second boost window. Fans are pre-spun before launch. Comparison vehicles carry identical hardware and starting gas mass to isolate system effects. “Launch again” preserves the tank state at the end of the six-second run; no extra idle time or refill is assumed between runs. Heat exchange acts throughout simulated open- and closed-valve periods. Rotating Invert integrates guided contact motion with bracketed seal-loss, detachment, deck-recontact and ground-contact events; equal-angle tests retain analytic contact segments. Free flight preserves departure spin. Its rectangular contact proxy and speed-threshold wreck effects are illustrative; it does not solve structural impact dynamics. Sample energy in the engine is electrical work, not tank internal energy.</p><h3>Reference principles</h3><div class="source-links"><a href="https://www.grc.nasa.gov/www/k-12/airplane/mflchk.html" target="_blank" rel="noreferrer">NASA / Compressible mass flow ↗</a><a href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/" target="_blank" rel="noreferrer">NASA / Thrust equation ↗</a><a href="https://www.tesla.com/roadster" target="_blank" rel="noreferrer">Tesla / Vehicle inspiration ↗</a></div></dialog>
<div id="toast" role="status"></div>`;
try{scene=new Scene($('#scene'));}catch(e){$('#scene-error').hidden=false;$('#scene-error').textContent=e.message;}
if(experiment==='launch'){
 scene?.setCamera(camera);
 plots=new KinematicPlots($('#kinematic-plots'),{colors:SCENARIO_COLORS,getSample:comparisonSample,onScrub:scrub,onInspect:time=>vessel?.setInspection(time)});
}
if(experiment==='turn'){scene?.setCamera('turn-'+turnCamera);plots=new KinematicPlots($('#turn-plots'),{colors:TURN_COLORS,getSample:turnSample,onScrub:scrub,metrics:TURN_METRICS,family:'CORNER DYNAMICS'});turnMap=new TurnMap($('#turn-map'),scrub);}
if(experiment==='invert'){scene?.setCamera('invert-'+invertCamera);plots=new KinematicPlots($('#invert-plots'),{colors:SCENARIO_COLORS,getSample:comparisonSample,onScrub:scrub,metrics:INVERT_METRICS,family:'CONTACT & MOTION'});}
if(experiment==='hop'){scene?.setCamera('hop-'+hopCamera);plots=new KinematicPlots($('#hop-plots'),{colors:SCENARIO_COLORS,getSample:comparisonSample,onScrub:scrub,metrics:HOP_METRICS,family:'VERTICAL FLIGHT',onInspect:time=>vessel?.setInspection(time)});}
if(!['invert','turn'].includes(experiment))vessel=new VesselAnalysis($('#vessel-analysis'),{
 colors:SCENARIO_COLORS,getSample:comparisonSample,onScrub:scrub,onInspect:time=>plots?.setInspection(time),
 onCutaway:()=>{cutaway=true;closeUpForInspection();update();$('.viewport-slot').scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'center'});}
});
plots?.setSpeedUnits?.(units);applyCapture();wire();observeDock();updateLandingControls();if(readyResult)installResult(readyResult,resumeTime);else recompute(true);if(returnToTune)$('#setup-title').focus({preventScroll:true});}
function markCustomPreset(){selectedPresets[experiment]='custom';const el=$('#'+experiment+'-preset');if(el)el.value='custom';if($('#preset-description'))$('#preset-description').textContent='Your values. Compare the calculated effect, then replay.';}
function selectedCamera(){return experiment==='launch'?camera:experiment==='hop'?'hop-'+hopCamera:experiment==='turn'?'turn-'+turnCamera:'invert-'+invertCamera;}
function wire(){
 $('#showcase-start').onclick=startShowcase;
 const cleanup=[bindTuningLinks({trigger:$('#tune'),panel:$('#tuning-panel'),links:[$('#edit-parameters')],initialOpen:parametersOpen,onToggle:open=>{parametersOpen=open;if(scene)scene.dirty=true;if(latestResult)applyReveal();},onVisit:()=>{playing=false;sound.silence();update();}}),bindChoiceKeys([...document.querySelectorAll('[data-mode]')]),bindChoiceKeys([...document.querySelectorAll('[data-tab]')])];
 disposeUI=()=>cleanup.forEach(dispose=>dispose());
 if($('#landing-burn'))$('#landing-burn').onchange=e=>{noteTuningChange('Landing burn mode');c.landingBurn=+e.target.value;markCustomPreset();updateLandingControls();recompute(false,false,t);};if($('#manual-fire'))$('#manual-fire').onclick=()=>{if(!run||!canFireManual(sampleAt(run,t)))return;const resume=playing,now=t;noteTuningChange('Manual ignition now');c.manualBurnAt=now;syncControl('manualBurnAt');recompute(true,resume,now);};$('#tuning-replay').onclick=()=>{if(busy||calculationError||!run)return;if(parametersOpen)$('#parameters-close').click();t=0;impactStart=null;playing=true;cine=false;hideEndCard();$('#scene').scrollIntoView({behavior:'instant',block:'start'});$('#scene').focus({preventScroll:true});update();};for(const [id,property,setter] of [['music','musicVolume','setMusicVolume'],['effects','effectsVolume','setEffectsVolume']])$('#sound-'+id).oninput=e=>{sound[setter](+e.target.value/100);$('#sound-'+id+'-value').textContent=Math.round(sound[property]*100)+'%';};$('#sound').onclick=async()=>{try{if(sound.wantedEnabled)sound.disable();else await sound.toggle();syncAudioControls();update();}catch(e){toast(e.message);}};document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{experimentSetups[experiment]={...c};experiment=el.dataset.tab;Object.assign(c,experimentSetups[experiment]||DEFAULTS);playing=false;t=0;cine=false;hideEndCard();mount();document.querySelector(`[data-tab="${experiment}"]`).focus({preventScroll:true});});document.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>selectFocus(+el.dataset.mode));
 document.querySelectorAll('[data-focus],[data-world-focus]').forEach(el=>el.onclick=()=>selectFocus(+(el.dataset.focus??el.dataset.worldFocus)));
 document.querySelectorAll('[data-visible]').forEach(el=>el.onchange=()=>{
  const i=+el.dataset.visible;visible[i]=el.checked;
  if(!visible.some(Boolean)){visible[i]=true;el.checked=true;return;}
  if(!visible[mode])selectFocus(visible.findIndex(Boolean));
  syncVisibility();if(comparison)plots.setData(comparison,visible);update();
 });

 document.querySelectorAll('[data-turn-focus]').forEach(el=>el.onclick=()=>{turnFocus=+el.dataset.turnFocus;if(comparison)run=comparison.runs[turnFocus];document.querySelectorAll('[data-turn-focus]').forEach(b=>b.setAttribute('aria-pressed',b===el));update();});
 if($('#turn-preset'))$('#turn-preset').onchange=e=>{const preset=e.target.value;if(preset==='custom'){markCustomPreset();return;}noteTuningChange(TUNING_GUIDES[experiment].presets.find(p=>p[0]===preset)[1]);selectedPresets[experiment]=preset;Object.assign(c,DEFAULTS,preset==='both'?{turnSpeed:60/3.6}:preset==='neither'?{turnSpeed:160/3.6}:preset==='steer'?{turnSteer:2*Math.PI/180}:preset==='off'?{fan:0}:{});mount();$('#setup-title').focus({preventScroll:true});};

 if($('#invert-preset'))$('#invert-preset').onchange=e=>{const preset=e.target.value;if(preset==='custom'){markCustomPreset();return;}noteTuningChange(TUNING_GUIDES[experiment].presets.find(p=>p[0]===preset)[1]);selectedPresets[experiment]=preset;Object.assign(c,DEFAULTS,preset==='slide'?{angle:180,fan:40,invertDuration:6}:preset==='fall'?{angle:180,fan:0}:preset==='deck'?{angle:60,fan:0,grip:.4}:preset==='upright'?{invertStart:180,angle:0}:{});mount();$('#setup-title').focus({preventScroll:true});};

 if($('#hop-preset'))$('#hop-preset').onchange=e=>{const name=e.target.value;if(name==='custom'){markCustomPreset();return;}noteTuningChange(TUNING_GUIDES[experiment].presets.find(p=>p[0]===name)[1]);selectedPresets[experiment]=name;Object.assign(c,DEFAULTS,name==='delivery'?{pulse:.25,landingBurn:1,valveRise:.06,feedLoss:8,expansionRatio:1.15}:name==='short'?{pulse:.2}:name==='soft'?{pulse:.2,landingBurn:1}:name==='balanced'?{pulse:.35,landingBurn:1}:name==='manual'?{pulse:.35,landingBurn:2}:name==='high'?{pulse:1.2}:name==='ground'?{pressure:gaugeToAbsoluteBar(20),nozzle:2}:{});mount();$('#setup-title').focus({preventScroll:true});};

 if($('#auto-frame'))$('#auto-frame').onclick=e=>{autoFrame=!autoFrame;e.currentTarget.setAttribute('aria-pressed',String(autoFrame));update();};
 document.querySelectorAll('[data-cam]').forEach(el=>el.onclick=()=>chooseCamera(el.dataset.cam));
 document.querySelectorAll('[data-units]').forEach(el=>el.onclick=()=>setUnits(el.dataset.units));
 const analysisButtons=[...document.querySelectorAll('[data-analysis-tab]')];analysisButtons.forEach(el=>el.onclick=()=>selectAnalysisTab(el.dataset.analysisTab,true));cleanup.push(bindChoiceKeys(analysisButtons));
 $('#stage-card').onclick=e=>{
  const target=e.target.closest('button');if(!target)return;
  if(target.dataset.predict){predictions.set(currentRevealKey(),target.dataset.predict);renderStageCard();$(`[data-predict="${target.dataset.predict}"]`)?.focus({preventScroll:true});return;}
  if(target.hasAttribute('data-stage-play')||target.hasAttribute('data-stage-replay')){$('#play').click();return;}
  if(target.hasAttribute('data-stage-reveal')){markRevealed();update();return;}
  if(target.hasAttribute('data-stage-data'))$('.analysis-heading')?.scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'start'});
 };
 $('#dock-return').onclick=()=>{$('.viewport-slot').scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'center'});};
 $('#dock-close').onclick=()=>{dockDismissed=true;syncDock();};
 $('.viewport').addEventListener('pointerdown',wakeHud);$('.viewport').addEventListener('focusin',wakeHud);
 $('#scene').addEventListener('pointerdown',dismissOrbitHint,{once:true});
 if($('#launch-preset'))$('#launch-preset').onchange=e=>{
  const name=e.target.value;if(name==='custom'){markCustomPreset();return;}noteTuningChange(TUNING_GUIDES[experiment].presets.find(p=>p[0]===name)[1]);selectedPresets[experiment]=name;
  Object.assign(c,DEFAULTS,name==='grip'?{grip:.6}:name==='delay'?{boostAt:1.2}:{});
  startGas=null;launchCount=1;mount();$('#setup-title').focus({preventScroll:true});
 };
document.querySelectorAll('[data-param],[data-number-param]').forEach(el=>{
 const key=el.dataset.param||el.dataset.numberParam;
 el.oninput=()=>{
  const label=controlLabels[key]||key;
  if(el.value===''||!Number.isFinite(+el.value)||!el.validity.valid){requestEpoch++;client.cancel();clearTimeout(computeTimer);playing=false;sound.silence();el.setAttribute('aria-invalid','true');setBusy(false,`Enter a value for ${label.toLowerCase()} from ${el.min} to ${el.max}.`);return;}
  noteTuningChange(label);c[key]=key==='pressure'?gaugeToAbsoluteBar(+el.value):key==='turnSpeed'?+el.value/3.6:['turnSteer','turnSweep'].includes(key)?+el.value*Math.PI/180:+el.value;
  syncControl(key);markCustomPreset();if(key==='landingTarget'&&$('#landing-burn'))updateLandingControls();if(experiment==='launch'&&(key==='pressure'||key==='volume')){startGas=null;launchCount=1;}recompute(false,false,t);
 };
 el.onkeydown=e=>{
  if(e.ctrlKey||e.altKey||e.metaKey||(el.type!=='range'&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)))return;
  const direction=['ArrowRight','ArrowUp'].includes(e.key)?1:['ArrowLeft','ArrowDown'].includes(e.key)?-1:e.key==='PageUp'?10:e.key==='PageDown'?-10:0;
  if(!direction&&!(el.type==='range'&&['Home','End'].includes(e.key)))return;
  e.preventDefault();const value=direction?inputDisplay(key,c[key])+direction*(Number(el.dataset.increment)||1):e.key==='Home'?+el.min:+el.max;
  el.value=Number(Math.max(+el.min,Math.min(+el.max,value)).toFixed(5));el.oninput();
 };
});
$('#play').onclick=()=>{sound.silence();impactStart=null;if(t>=duration()-.01)t=0;playing=!playing;if(playing)hideEndCard();cine=false;update();};$('#rewind').onclick=()=>{sound.silence();impactStart=null;t=0;playing=false;cine=false;scene?.setCamera(selectedCamera());hideEndCard();update();};$('#timeline').oninput=e=>{sound.silence();impactStart=null;t=+e.target.value;if(t>=duration()-.01){t=duration();markRevealed();}playing=false;cine=false;update();};$('#speed').onclick=()=>{speed=speed===.5?1:speed===1?.25:.5;$('#speed').textContent=speed+'×';};
for(const key of ['cutaway','vectors','compare']){const el=$('#'+key);if(el)el.onclick=()=>{if(key==='cutaway')cutaway=!cutaway;if(key==='vectors')vectors=!vectors;if(key==='compare')compare=!compare;if(key!=='compare'){if((key==='cutaway'&&cutaway)||(key==='vectors'&&vectors))closeUpForInspection();else restoreAfterInspection();}update();};}
$('#camera-reset').onclick=()=>{cine=false;scene?.setCamera(selectedCamera());};$('#zoom-in').onclick=()=>scene?.nudgeZoom(-.55);$('#zoom-out').onclick=()=>scene?.nudgeZoom(.55);$('#defaults').onclick=()=>{noteTuningChange('Default setup');selectedPresets[experiment]=experiment==='invert'?'held':'default';Object.assign(c,DEFAULTS);if(experiment==='launch'){startGas=null;launchCount=1;}compare=false;cutaway=false;vectors=false;capture=false;cine=false;mount();};$('#capture-toggle').onclick=()=>{capture=!capture;applyCapture();};$('#repeat').onclick=()=>{startGas={...run.finalGas};launchCount++;hideEndCard();recompute(true,true);};$('#refill').onclick=()=>{startGas=null;launchCount=1;recompute();};document.querySelectorAll('#engineering summary').forEach(el=>el.addEventListener('click',()=>{playing=false;sound.silence();update();}));$('#about').onclick=()=>{playing=false;sound.silence();update();$('#model-dialog').showModal();};$('#close-dialog').onclick=()=>$('#model-dialog').close();$('#full-model').onclick=()=>{$('#model-dialog').close();$('#engineering').scrollIntoView({behavior:reducedMotion()?'auto':'smooth',block:'start'});$('#engineering-title').tabIndex=-1;$('#engineering-title').focus({preventScroll:true});};$('#model-dialog').onclick=e=>{if(e.target===$('#model-dialog'))$('#model-dialog').close();};
$('#share').onclick=async()=>{if(location.protocol==='file:'){toast('Sharing needs a hosted URL. Use CSV to export this experiment locally.');return;}const url=shareUrl();history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);toast('Experiment link copied.');}catch{toast('Preset saved in the address bar. Copy the URL to share.');}};
const exportRun=()=>{if(experiment==='turn'){downloadCsv(turnCsv(comparison),'roadsterlab-turn-comparison.csv');return;}if(experiment==='hop'){downloadCsv(hopCsv(run,activeConfig),'roadsterlab-hop.csv');return;}if(experiment==='invert'){downloadCsv(invertCsv(run,activeConfig),'roadsterlab-invert.csv');return;}const rows=['time_s,distance_m,speed_m_s,acceleration_m_s2,pressure_Pa,temperature_K,gas_kg,thrust_N,tire_N,downforce_N,massflow_kg_s,height_m,vertical_velocity_m_s,electrical_J',...run.samples.map(s=>[s.t,s.x,s.v,s.a,s.pressure,s.temp,s.gas,s.thrust,s.tire,s.downforce,s.flow,s.y,s.vy,s.energy].join(','))].join('\n');const url=URL.createObjectURL(new Blob([rows],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download=`roadsterlab-${experiment}-run-${launchCount}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#export').onclick=()=>{if(experiment==='launch'&&comparison)downloadCsv(comparisonCsv(comparison),`roadsterlab-launch-comparison-${launchCount}.csv`);else exportRun();};if($('#export-run'))$('#export-run').onclick=exportRun;}
function downloadCsv(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function shareUrl(){const url=new URL(location.href);url.search='';url.searchParams.set('experiment',experiment);url.searchParams.set('mode',mode);if(experiment==='launch'){url.searchParams.set('camera',camera);url.searchParams.set('visible',visible.flatMap((v,i)=>v?[i]:[]).join(','));url.searchParams.set('autoFrame',autoFrame?'1':'0');}if(experiment==='hop')url.searchParams.set('hopCamera',hopCamera);if(experiment==='invert')url.searchParams.set('invertCamera',invertCamera);if(experiment==='turn'){url.searchParams.set('turnCamera',turnCamera);url.searchParams.set('turnFocus',turnFocus);}if(capture)url.searchParams.set('capture','1');if(startGas&&experiment==='launch'){url.searchParams.set('gasMass',startGas.mass);url.searchParams.set('gasTemp',startGas.temp);if(Number.isFinite(startGas.u))url.searchParams.set('gasU',startGas.u);url.searchParams.set('run',launchCount);}for(const key of Object.keys(c))url.searchParams.set(key,key==='pressure'?absoluteToGaugeBar(c[key]):c[key]);url.searchParams.set('pressureUnit','barg');url.searchParams.set('units',units);return url;}
function applyCapture(){document.body.classList.toggle('capture',capture);const btn=$('#capture-toggle');if(btn){btn.classList.toggle('on',capture);btn.setAttribute('aria-pressed',capture);}}
function hideEndCard(){const el=$('#end-card');if(el)el.hidden=true;}
function showEndCard(){const el=$('#end-card');if(!el)return;el.hidden=false;const live=$('#end-url');if(live&&location.protocol!=='file:'){const path=location.pathname.replace(/index\.html$/,'');live.textContent=location.host+path+(path.endsWith('/')?'':'/');}}
async function startShowcase(){
 if(showcase||busy||calculationError||!latestResult||!scene)return;
 const saved={config:{...c},experiment,mode,t,speed,cutaway,vectors,compare,startGas:startGas?{...startGas}:null,launchCount,capture,
  camera,autoFrame,visible:[...visible],hopCamera,invertCamera,turnCamera,turnFocus,result:latestResult,
  orbit:{yaw:scene.yaw,elev:scene.elev,zoom:scene.zoom},scroll:[scrollX,scrollY],
  tuning:{kind:tuningKind,previous:tuningPrevious,edit:tuningEdit,edits:[...tuningEdits]}};
 const session={saved,clock:0,stage:-1,paused:reducedMotion(),preparing:true,done:false,results:[]};showcase=session;
 playing=false;cine=false;demoQueued=false;impactStart=null;prev=0;sound.silence();hideEndCard();
 const layer=document.createElement('section');layer.id='showcase-layer';layer.className='showcase-layer';layer.setAttribute('aria-label','Guided showcase');
 layer.innerHTML=`<header class="showcase-top"><div class="showcase-brand">Roadster<span>LAB</span><small>36 SECOND SHOWCASE</small></div><nav aria-label="Showcase chapters">${SHOWCASE_STEPS.map((step,i)=>`<button data-showcase-chapter="${i}" aria-label="Showcase chapter ${i+1}: ${step.kind}" disabled><small>0${i+1}</small><span>${step.kind}</span></button>`).join('')}</nav><div class="showcase-actions"><button id="showcase-video" disabled>Export video</button><button id="showcase-pause" disabled>Pause tour</button><button id="showcase-exit">Exit tour</button></div></header><footer class="showcase-caption"><div class="showcase-copy" role="status" aria-live="polite"><span id="showcase-kicker">PREPARING FOUR EXPERIMENTS</span><h2 id="showcase-title">One car. Four questions.</h2><p id="showcase-description">Calculating the example setups. Your current experiment is saved.</p></div><div id="showcase-results" class="showcase-results"></div><div class="showcase-bottom"><span>INDEPENDENT ENGINEERING · ILLUSTRATIVE INPUTS</span><span id="showcase-clock">PREPARING</span></div><input id="showcase-seek" class="showcase-progress" type="range" aria-label="Showcase time" min="0" max="36" step="0.1" value="0" disabled/></footer><section id="video-export-panel" class="video-export-panel" aria-label="Showcase video export" hidden><h3>Export the showcase.</h3><p>36-second silent video with captions, calculated results and physics. Keep this tab visible while recording.</p><div class="video-export-choices"><button data-video-format="landscape">Landscape · 1920 × 1080</button><button data-video-format="portrait">Portrait · 1080 × 1920</button></div><p id="video-export-status" role="status">MP4 when supported; WebM otherwise. Your experiment stays saved.</p><a id="video-download" hidden>Download video</a><div><button id="video-cancel" hidden>Cancel recording</button><button id="video-close">Close export panel</button></div></section>`;
 document.body.append(layer);$('#root').setAttribute('inert','');$('#root').setAttribute('aria-hidden','true');document.body.classList.add('showcase-mode');
 $('#showcase-video').onclick=()=>{$('#video-export-panel').hidden=!$('#video-export-panel').hidden;};
 $('#video-close').onclick=()=>{$('#video-export-panel').hidden=true;$('#showcase-video').focus();};
 $('#video-cancel').onclick=()=>cancelVideoExport('Recording cancelled. Choose a format to try again.');
 layer.querySelectorAll('[data-video-format]').forEach(button=>button.onclick=()=>startVideoExport(button.dataset.videoFormat));
 $('#showcase-seek').oninput=e=>{if(!showcase||showcase.preparing)return;showcase.clock=+e.target.value;showcase.paused=true;prev=0;sound.silence();applyShowcaseFrame();update();};
 $('#showcase-exit').onclick=stopShowcase;$('#showcase-exit').focus({preventScroll:true});
 $('#showcase-pause').onclick=()=>{
  if(!showcase||showcase.preparing)return;
  if(showcase.done){showcase.clock=0;showcase.stage=-1;showcase.done=false;showcase.paused=false;applyShowcaseFrame();}
  else showcase.paused=!showcase.paused;
  prev=0;if(showcase.paused)sound.silence();updateShowcase();update();
 };
 layer.querySelectorAll('[data-showcase-chapter]').forEach(button=>button.onclick=()=>{
  if(!showcase||showcase.preparing)return;
  showcase.clock=showcaseStart(+button.dataset.showcaseChapter);showcase.done=false;prev=0;applyShowcaseFrame();update();
 });
 try{
  for(const step of SHOWCASE_STEPS){
   const config={...DEFAULTS,...step.patch};const result=await client.compute(config,initialGas(config),step.kind);
   if(showcase!==session)return;session.results.push(result);
   $('#showcase-description').textContent=`${session.results.length} / 4 setups calculated. Your current experiment is saved.`;
  }
  if(showcase!==session)return;
  session.preparing=false;prev=0;applyShowcaseFrame();update();
 }catch(error){if(showcase===session){stopShowcase();toast('Showcase could not be prepared. Your setup has been restored.');}}
}
function applyShowcaseFrame(){
 if(!showcase||showcase.preparing)return;
 const view=showcaseFrame(showcase.clock);
 if(showcase.stage!==view.index){
  showcase.stage=view.index;experiment=view.step.kind;Object.assign(c,DEFAULTS,view.step.patch);
  mode=2;visible=[true,true,true];startGas=null;launchCount=1;cutaway=false;vectors=false;compare=false;capture=false;autoFrame=true;turnFocus=1;
  camera='field';hopCamera='track';invertCamera='field';turnCamera='field';
  mount(showcase.results[view.index]);$('#root').setAttribute('inert','');$('#root').setAttribute('aria-hidden','true');
 }
 if(selectedCamera()!==view.camera){
  if(experiment==='launch')camera=view.camera;
  if(experiment==='invert')invertCamera=view.camera.replace('invert-','');
  if(experiment==='turn')turnCamera=view.camera.replace('turn-','');
  if(experiment==='hop')hopCamera=view.camera.replace('hop-','');
  scene?.transitionCamera(view.camera,!reducedMotion());
 }
 t=duration()*view.fraction;playing=false;cine=false;if(scene)scene.dirty=true;
 showcase.done=view.done;updateShowcase(view);
}
function advanceShowcase(elapsed){
 showcase.clock=Math.min(SHOWCASE_DURATION,showcase.clock+elapsed);applyShowcaseFrame();
 if(showcase.recorder){
  const view=showcaseFrame(showcase.clock);showcase.recorder.draw(videoSceneState(),view,tuningRows(experiment,showcase.results[view.index],units));
  set('video-export-status',`Recording ${showcase.clock.toFixed(1)} / 36 s. Keep this tab visible.`);
  if(view.done)showcase.recorder.finish();
 }
}
function updateShowcase(view=showcase?showcaseFrame(showcase.clock):null){
 if(!showcase||!view||showcase.preparing)return;
 const {step,index,done}=view,layer=$('#showcase-layer');
 layer.dataset.chapter=step.kind;layer.dataset.state=done?'complete':showcase.paused?'paused':'playing';
 set('showcase-kicker',done?'TOUR COMPLETE · EXPLORE THE MODEL':`0${index+1} / 04 · ${step.kind.toUpperCase()}`);
 set('showcase-title',done?'Four experiments. One engineering story.':step.title);
 set('showcase-description',done?'Replay the tour, choose a chapter, or exit to return to your saved experiment.':step.caption);
 const rows=tuningRows(step.kind,showcase.results[index],units);
 set('showcase-results',rows.map(row=>`<div><span>${row.label}</span><strong>${row.text}</strong>${row.detail&&row.value!==null?`<small>${row.detail}</small>`:''}</div>`).join(''));
 const pause=$('#showcase-pause');pause.disabled=!!showcase.recorder;pause.textContent=done?'Replay tour':showcase.paused?'Play tour':'Pause tour';pause.setAttribute('aria-pressed',String(showcase.paused||done));
 layer.querySelectorAll('[data-showcase-chapter]').forEach((button,i)=>{button.disabled=!!showcase.recorder;button.setAttribute('aria-current',i===index?'step':'false');});
 set('showcase-clock',`${view.clock.toFixed(1)} / 36 s · T+${t.toFixed(2)} s`);
 $('#showcase-video').disabled=!!showcase.recorder||!ShowcaseRecorder.supported();$('#showcase-video').title=ShowcaseRecorder.supported()?'Export a fixed-size video':'Canvas video recording is unavailable in this browser';
 const progress=$('#showcase-seek');progress.disabled=!!showcase.recorder;progress.value=view.clock.toFixed(1);progress.setAttribute('aria-valuetext',`${view.clock.toFixed(1)} of 36 seconds, ${step.kind}`);
}
function videoSceneState(){
 const sample=sampleAt(run,t),base={sample,c:activeConfig,experiment,mode:experiment==='launch'?2:experiment==='turn'?1:experiment==='invert'?1:2,cutaway:false,vectors:false,autoFrame:true};
 if(experiment==='launch')base.entries=runs.map((r,i)=>({...comparisonSample(r,t),mode:i,visible:true}));
 if(experiment==='hop')base.hop={...hopData,stopped:t>=duration()-1e-8,damage:hopDamage(hopData,t)};
 if(experiment==='invert')base.invert={...run.invert,damage:invertDamage(run,t)};
 if(experiment==='turn'){base.entries=runs.map((r,i)=>({...turnSample(r,t),mode:i,visible:true}));base.sample=base.entries[1].sample;base.turn={track:comparison.track,bounds:comparison.bounds,focus:1,reveal:showcaseFrame(showcase.clock).fraction};}
 return base;
}
function videoControls(recording){
 sound.presentationMuted=recording;sound.silence({all:recording});
 document.querySelectorAll('[data-video-format]').forEach(button=>button.disabled=recording);$('#video-cancel').hidden=!recording;$('#video-close').disabled=recording;
}
function cancelVideoExport(message){
 if(!showcase?.recorder)return;
 showcase.recorder.cancel();showcase.recorder=null;showcase.paused=true;set('video-export-status',message);videoControls(false);updateShowcase();
}
function startVideoExport(format){
 if(!showcase||showcase.preparing||showcase.recorder)return;
 const session=showcase;session.clock=0;session.stage=-1;session.done=false;session.paused=true;applyShowcaseFrame();
 if(session.videoUrl){URL.revokeObjectURL(session.videoUrl);session.videoUrl=null;}$('#video-download').hidden=true;
 try{
  const recorder=new ShowcaseRecorder(format,{animate:!reducedMotion(),onComplete:result=>{
   if(showcase!==session)return;session.recorder=null;session.paused=true;session.videoUrl=URL.createObjectURL(result.blob);
   const link=$('#video-download');link.href=session.videoUrl;link.download=`roadsterlab-showcase-${format}.${result.extension}`;link.textContent=`Download ${result.width} × ${result.height} ${result.extension.toUpperCase()} · ${(result.blob.size/1e6).toFixed(1)} MB`;link.hidden=false;
   link.dataset.frames=String(result.frames);set('video-export-status','Video ready. Download it before closing the tour.');videoControls(false);updateShowcase();
  },onError:message=>{if(showcase===session){session.recorder=null;session.paused=true;set('video-export-status',message);videoControls(false);updateShowcase();}}});
  recorder.draw(videoSceneState(),showcaseFrame(0),tuningRows(experiment,session.results[0],units));recorder.start();session.recorder=recorder;session.paused=false;prev=0;videoControls(true);set('video-export-status','Recording 0 / 36 s. Keep this tab visible.');updateShowcase();update();
 }catch(error){session.paused=true;set('video-export-status',error.message);videoControls(false);updateShowcase();}
}
function stopShowcase(){
 if(!showcase)return;
 const saved=showcase.saved;showcase.recorder?.cancel();if(showcase.videoUrl)URL.revokeObjectURL(showcase.videoUrl);showcase=null;sound.presentationMuted=false;client.cancel();requestEpoch++;clearTimeout(computeTimer);sound.silence();
 $('#showcase-layer')?.remove();document.body.classList.remove('showcase-mode');$('#root').removeAttribute('inert');$('#root').removeAttribute('aria-hidden');
 Object.assign(c,saved.config);({experiment,mode,speed,cutaway,vectors,compare,startGas,launchCount,capture,camera,autoFrame,visible,hopCamera,invertCamera,turnCamera,turnFocus}=saved);
 playing=false;cine=false;impactStart=null;prev=0;mount(saved.result,saved.t);
 tuningKind=saved.tuning.kind;tuningPrevious=saved.tuning.previous;tuningEdit=saved.tuning.edit;tuningEdits=saved.tuning.edits;renderTuningFeedback();
 if(scene)Object.assign(scene,saved.orbit,{dirty:true});update();
 window.scrollTo({left:saved.scroll[0],top:saved.scroll[1],behavior:'instant'});$('#showcase-start')?.focus({preventScroll:true});
}
function queueDemo(){if(!demoQueued)return;demoQueued=false;speed=1;const speedBtn=$('#speed');if(speedBtn)speedBtn.textContent='1×';if(reducedMotion())return;setTimeout(()=>{if(showcase||!scene||document.hidden||experiment!=='launch'||busy||!run||playing||t!==0)return;t=0;playing=true;cine=true;hideEndCard();update();},900);}
function duration(){return experiment==='launch'?6:experiment==='turn'?(comparison?.duration??.01):Math.max(.01,run.samples.at(-1).t);}
function set(id,value){const el=$('#'+id);if(el&&el._lastMarkup!==String(value)){el.innerHTML=value;el._lastMarkup=String(value);}}
function legendFor(){
  const hide=experiment==='hop';
  $('#leg-2').hidden=false;$('#leg-3').hidden=hide;
  if(experiment==='invert'){set('leg-1','<i class="green"></i>CONTACT / FRICTION');set('leg-2','<i class="red"></i>WEIGHT');set('leg-3','<i class="blue"></i>FAN SUCTION');}
  else if(experiment==='hop'){set('leg-1','<i class="red"></i>COLD-GAS THRUST');set('leg-2','<i class="blue"></i>WEIGHT / RELATIVE FORCE SCALE');}
  else{set('leg-1','<i class="green"></i>TIRE FORCE');set('leg-2','<i class="red"></i>COLD-GAS THRUST');set('leg-3','<i class="blue"></i>FAN + AERO LOAD');}
}
function update(){document.body.classList.toggle('is-playing',playing);syncDock();renderStageCard();set('tuning-clock',busy?'Updating the current setup…':calculationError?'Correct the highlighted input to continue.':playing?'Playing the current setup.':t>0?`Paused at T+${t.toFixed(2)} s. Change a value to compare this moment.`:'Change one value. Results update before you replay.');if(!run){if(experiment==='turn')return;if(scene){const sample=previewSample();scene.render({sample,c,experiment,mode,entries:experiment==='launch'?[0,1,2].map(i=>({sample,mode:i,visible:visible[i],status:'READY'})):undefined,autoFrame});positionLabels();}return;}if(experiment==='turn'){updateTurn();return;}if(experiment==='invert'){updateInvert(sampleAt(run,t));return;}
const viewConfig=activeConfig,s=sampleAt(run,t);
const ready=t<=0&&!playing,show=sample=>ready?{...sample,flow:0,thrust:0}:sample;
const u=speedUnit(units);set('velocity',experiment==='hop'?s.y.toFixed(2):(s.v*u.scale).toFixed(0));set('primary-label',experiment==='hop'?'ALTITUDE':'VELOCITY');set('primary-unit',experiment==='hop'?'meters':u.label);$('#velocity-meter').style.width=Math.min(100,experiment==='hop'?s.y/Math.max(run.peakHeight,.01)*100:s.v*3.6/280*100)+'%';
set('secondary-label','ACCELERATION');set('acceleration',`${(s.a/G).toFixed(2)} <small>g</small>`);set('third-label',experiment==='hop'?'VERTICAL SPEED':'DISTANCE');set('distance',experiment==='hop'?`${s.vy.toFixed(1)} <small>m/s</small>`:`${s.x.toFixed(1)} <small>m</small>`);
const tableAbort=run.status==='OUT OF TABLE',contactAbort=run.status==='CONTACT LIMIT';
set('result-label',experiment==='hop'?((run.status==='TIME LIMIT'||tableAbort)?'MAX HEIGHT IN WINDOW':'PREDICTED PEAK HEIGHT'):'PREDICTED '+u.milestone.toUpperCase());set('result',experiment==='hop'?run.peakHeight.toFixed(2):(run[u.milestoneKey]?.toFixed(2)||'-'));$('#result').classList.toggle('word-result',contactAbort||tableAbort);set('result-unit',experiment==='hop'?'meters':'seconds');set('result-note',experiment==='hop'?run.landingSpeed!==null?`Touchdown at ${run.landingSpeed.toFixed(1)} m/s · ${viewConfig.landingBurn?'landing burn enabled':'ballistic return'}`:run.status:tableAbort?'Property limit reached. Run stopped at the last supported state.':contactAbort?'Front contact left the model envelope. The run stops.':`Standing start · no rollout${run[u.otherKey]?` · ${u.other} ${run[u.otherKey].toFixed(2)} s`:''}`);
set('constraint',tableAbort?'OUT OF TABLE':t===0&&!contactAbort?'READY TO '+(experiment==='hop'?'FIRE':'LAUNCH'):contactAbort?'CONTACT LIMIT':s.limit);set('insight',experiment==='hop'?(viewConfig.landingBurn?'Descent braking depends on remaining pressure and thrust.':'Ballistic return: no descent braking.'):contactAbort||s.limit==='CONTACT LIMIT'?'Front axle load went negative. Airborne pitch is not simulated.':s.thrust>0?'Cold gas adds force directly, beyond the tire grip limit.':s.limit==='POWER LIMITED'?'As speed rises, available motor force falls.':'More suction can increase the force the tires transmit.');
const gas=withInternalEnergy(viewConfig,{mass:s.gas,temp:s.temp,u:s.u}),valid=gasValidity(viewConfig,gas),fraction=Math.min(1,gas.mass/initialGas(viewConfig).mass);set('gas-percent',Math.round(fraction*100)+'%');set('gas-mass',`${gas.mass.toFixed(1)} kg remaining · ${gas.temp.toFixed(0)} K${!valid.ok||tableAbort?'<b class="gas-flag">OUT OF TABLE: run stopped at property limit</b>':''}`);document.querySelectorAll('.gas-bars i').forEach((el,i)=>el.classList.toggle('empty',i/25>=fraction));set('time',`T + ${t.toFixed(2)} s`);set('duration',duration().toFixed(2)+' s');$('#timeline').max=duration();$('#timeline').value=t;$('#timeline').setAttribute('aria-valuetext',`${t.toFixed(2)} of ${duration().toFixed(2)} seconds`);set('play',icon(playing?'pause':'play')+'<span>'+(playing?'Pause simulation':t>0&&t<duration()?'Resume':metadata[experiment].action)+'</span>');
for(const [key,value] of Object.entries({cutaway,vectors,compare})){const el=$('#'+key);if(el){el.classList.toggle('on',value);el.setAttribute('aria-pressed',value);}}
legendFor();$('#cutaway-label').hidden=!cutaway;set('tank-label',`${viewConfig.volume} L · ${(s.pressure/1e5).toFixed(0)} bara · ${s.temp.toFixed(0)} K · ${gas.mass.toFixed(1)} kg`);set('scene-mode',experiment==='launch'?names[mode].toUpperCase():(viewConfig.landingBurn?'VERTICAL THRUST / DESCENT BRAKING':'VERTICAL THRUST / BALLISTIC RETURN'));set('scene-detail',experiment==='hop'?`World scale 1:1 · ${hopCamera==='under'?'underbody inspection / ground hidden':hopCamera==='track'?'altitude-tracking camera':'full flight envelope'} · vertical only`:'World scale 1:1 · '+(camera==='focus'?'selected car camera':'shared tracking frame'));set('run-label','RUN '+String(launchCount).padStart(2,'0'));$('#repeat').hidden=experiment!=='launch';$('#repeat').disabled=busy||!!calculationError||t<duration()-.02;$('#refill').hidden=experiment!=='launch';set('force-value',experiment==='hop'?(s.thrust/1000).toFixed(1)+' kN':((s.tire+s.thrust)/1000).toFixed(1)+' kN');set('pressure-value',(s.pressure/1e5).toFixed(0)+' bara');
document.querySelectorAll('.cursor-line').forEach(el=>{const x=400*t/duration();el.setAttribute('x1',x);el.setAttribute('x2',x);});
$('#force-chart')?.setAttribute('aria-label',experiment==='hop'?'Tire force (zero in Hop) and gas thrust over time':'Tire force and gas thrust over time');$('#pressure-chart')?.setAttribute('aria-label','Pressure over time');
sound.poll();
if(experiment==='launch'&&comparisonSample(run,t).ended&&comparisonSample(run,t).unsupported){set('primary-label','VELOCITY AT STOP');set('secondary-label','LAST ACCELERATION');}
plots?.update(t,experiment==='hop'?2:mode);if(experiment==='hop')updateHop(s);vessel?.update(t,experiment==='hop'?2:mode,playing);

const entries=experiment==='launch'?runs.map((r,i)=>{const state=comparisonSample(r,t);return {...state,sample:show(state.sample),mode:i,visible:visible[i],marks:launchMarks[i]};}):undefined;
scene?.render({entries,autoFrame,sample:show(s),hop:experiment==='hop'?hopView():undefined,c:viewConfig,experiment,cutaway,vectors,compare,ghosts:experiment==='launch'?[sampleAt(runs[0],t),sampleAt(runs[1],t)]:[],mode});positionLabels();
if(experiment==='launch')runs.forEach((r,i)=>{const state=comparisonSample(r,t);set('lane-stat-'+i,state.ended&&state.unsupported?'STOPPED · '+r.status:(state.sample.v*speedUnit(units).scale).toFixed(0)+' '+speedUnit(units).label+' · '+state.sample.x.toFixed(1)+' m');});}
// The apex marker appears once the car gets there, or after the result is revealed.
function hopView(){const apex=hopData.apex&&(isRevealed()||t>=hopData.apex.t-1e-6)?hopData.apex:null;return {...hopData,apex,stopped:t>=duration()-1e-8,touchdownAge:impactStart===null||reducedMotion()?null:(performance.now()-impactStart)/1000,damage:hopDamage(hopData,t,reducedMotion()?1.2:impactStart===null?1.2:(performance.now()-impactStart)/1000)};}
function renderBetweenTelemetry(){
 if(!run){update();return;}
 if(experiment==='turn'){renderTurnSamples();return;}
 if(experiment==='invert'){renderInvertSample(sampleAt(run,t));return;}
 const cfg=activeConfig,s=sampleAt(run,t),ready=t<=0&&!playing,show=sample=>ready?{...sample,flow:0,thrust:0}:sample;
 const entries=experiment==='launch'?runs.map((r,i)=>{const state=comparisonSample(r,t);return {...state,sample:show(state.sample),mode:i,visible:visible[i],marks:launchMarks[i]};}):undefined;
 scene?.render({entries,autoFrame,sample:show(s),hop:experiment==='hop'?hopView():undefined,c:cfg,experiment,cutaway,vectors,mode});positionLabels();
}
function turnAnalysis(){return `<section class="hop-analysis turn-analysis" aria-label="Turn trajectory and grip analysis"><div class="hop-analysis-heading"><div><span class="eyebrow">TWO PATHS / ONE CORNER</span><h2>Grip sets the limit.</h2></div><p>Steering asks for a curvature. Tire grip, normal load and drive force set the available lateral force. Both cases start at the same point and run independently; coincident cars display the selected case.</p></div><div id="turn-events" class="hop-event-controls"></div><article class="turn-map-card"><header><h3>Trajectory / plan view</h3><span>No fan: dotted · Fan: solid</span></header><div id="turn-map"></div><p>Click the selected path or use arrow keys to scrub. Lane departures are marked; trajectories continue into the grass until the exit gate or observation-window end. World distances are in metres.</p></article><div id="turn-plots" class="hop-plots"></div><p class="turn-disclosure">This is a steady-state, grip-capped bicycle surrogate. It does not solve transient tire slip, yaw stability, suspension, rollover, braking strategy or structural impact. The ideal speed controller shares the electrical budget with the fan throughout the run, including runoff. Grass is visual: terrain grip, fan seal loss and braking are not modeled. Gas inventory remains unchanged.</p></section>`;}
function renderTurnSamples(){
 if(!comparison)return;
 const entries=comparison.runs.map((r,i)=>({...turnSample(r,t),mode:i}));
 scene?.render({sample:entries[turnFocus].sample,c:activeConfig,experiment:'turn',mode:turnFocus,cutaway,vectors,entries,turn:{track:comparison.track,bounds:comparison.bounds,focus:turnFocus,marks:turnMarks,reveal:showcase&&!showcase.preparing?showcaseFrame(showcase.clock).fraction:undefined}});positionVesselLabel();
}
function updateTurn(){
 if(!comparison)return;const selected=comparison.runs[turnFocus],state=turnSample(selected,t),s=state.sample,info=selected.turn;
 if(!busy&&!calculationError)comparison.runs.forEach((r,i)=>{
  const p=turnPrediction(r),box=$('#turn-case-'+i);box.className='turn-case '+p.tone;
  set('turn-case-'+i,`<span>${TURN_COLORS[i].name.toUpperCase()} / PREDICTION</span><strong>${p.title}</strong><p>${p.detail}</p><small>Requested / available grip ${r.samples[0].utilizationValid?r.samples[0].utilization.toFixed(2)+'×':'unavailable'} · fan ${(r.turn.fanPower/1000).toFixed(1)} kW</small><small>${r.turn.gripLimited?'Grip limited: the modeled path opens out.':r.status==='OFF TRACK'?'Grip reserve cannot correct a steering mismatch.':'Requested curvature is within the modeled grip budget.'}</small>`);
 });
 set('primary-label',state.ended?(selected.status==='OFF TRACK'?'RUN END SPEED':selected.status==='CORNER CLEAR'?'EXIT SPEED':'COMMAND AT STOP'):'COMMANDED SPEED');set('primary-unit',speedUnit(units).label);set('velocity',(s.v*speedUnit(units).scale).toFixed(0));$('#velocity-meter').style.width=Math.min(100,s.v*3.6/180*100)+'%';
 set('secondary-label',state.ended?'LAST LATERAL ACCELERATION':'LATERAL ACCELERATION');set('acceleration',`${(s.a/G).toFixed(2)} <small>g</small>`);set('third-label','DEMAND / CAPACITY');set('distance',s.utilizationValid?`${s.utilization.toFixed(2)} <small>×</small>`:'—');
 set('result-label',TURN_COLORS[turnFocus].name.toUpperCase()+' / OUTCOME');set('result',info.outcome);$('#result').classList.add('word-result');set('result-unit','');set('result-note',turnPrediction(selected).detail);
 const phase=state.ended?selected.status:t===0?'READY':info.laneExitAt!==null&&t>=info.laneExitAt?'OFF TRACK / CONTINUING':s.limit;set('constraint',phase);set('insight',state.ended?selected.status==='OFF TRACK'?'The car continues past the painted edge into grass runoff; no collision or damage is applied.':selected.status==='CORNER CLEAR'?'The full body envelope has cleared the exit gate.':turnPrediction(selected).detail:info.gripLimited?'Requested lateral force exceeds the remaining tire-friction budget; the path is wider.':'Tire grip can supply the requested curvature; steering still has to match the road.');
 set('gas-percent','100%');set('gas-mass',`${s.gas.toFixed(1)} kg remaining · ${s.temp.toFixed(0)} K / no discharge`);document.querySelectorAll('.gas-bars i').forEach(el=>el.classList.remove('empty'));
 set('time',`T + ${t.toFixed(2)} s`);set('duration',duration().toFixed(2)+' s');$('#timeline').max=duration();$('#timeline').value=t;$('#timeline').setAttribute('aria-valuetext',`${t.toFixed(2)} of ${duration().toFixed(2)} seconds`);set('play',icon(playing?'pause':'play')+'<span>'+(playing?'Pause simulation':t>0&&t<duration()?'Resume':'Run corner comparison')+'</span>');
 for(const [id,value] of Object.entries({cutaway,vectors})){const el=$('#'+id);el.classList.toggle('on',value);el.setAttribute('aria-pressed',value);}
 $('#cutaway-label').hidden=!cutaway;set('tank-label',`${activeConfig.volume} L · ${(s.pressure/1e5).toFixed(0)} bara · ${s.gas.toFixed(1)} kg`);set('run-label','TWO RUNS');set('scene-mode',TURN_COLORS[turnFocus].name.toUpperCase()+' / '+phase);
 const a=turnSample(comparison.runs[0],t).sample,b=turnSample(comparison.runs[1],t).sample,coincident=Math.hypot(a.x-b.x,a.z-b.z)<1.4;
 set('scene-detail',`${(activeConfig.turnSteer*180/Math.PI).toFixed(1)}° front steering · ${activeConfig.turnRadius} m road radius · ${coincident?'overlapping poses / selected car shown':'independent runs'} · 1:1 scale`);
 $('#repeat').hidden=true;$('#refill').hidden=true;$('#leg-2').hidden=false;$('#leg-3').hidden=false;set('leg-1','<i class="green"></i>LATERAL FORCE');set('leg-2','<i class="red"></i>REQUESTED FORCE');set('leg-3','<i class="blue"></i>FAN + AERO LOAD');
 plots?.update(t,turnFocus);turnMap?.update(t,turnFocus);sound.poll();renderTurnSamples();
}
function drawTurnPlots(){
 const events=turnEvents(comparison);plots?.setData({...comparison,events},[true,true]);turnMap?.setData(comparison);turnMap?.update(t,turnFocus);
 set('turn-events',events.map((e,i)=>`<button data-turn-event="${i}">${e.label}<strong>${e.t.toFixed(2)} s</strong></button>`).join(''));
 document.querySelectorAll('[data-turn-event]').forEach(b=>{b.disabled=busy;b.onclick=()=>scrub(events[+b.dataset.turnEvent].t);});
}
function renderInvertSample(sample){
 const age=reducedMotion()?1.2:impactStart===null?1.2:(performance.now()-impactStart)/1000;
 scene?.render({sample,c:activeConfig,experiment:'invert',mode:1,cutaway,vectors,invert:{...run.invert,damage:invertDamage(run,t,age)}});positionVesselLabel();positionInvertGauge();
}
function updateInvert(s){
 const info=run.invert,p=invertPrediction(run),done=t>=duration()-1e-8,phase=done?(run.status==='IMPACT'?info.outcome:run.status):t===0?'READY / '+s.limit:s.limit;
 if(!busy&&!calculationError){const box=$('#invert-prediction');box.className='hop-prediction '+p.tone;box.dataset.outcome=p.outcome;
  set('invert-prediction',`<div><span>ROTATION PREDICTION / CURRENT SETUP</span><strong>${p.title}</strong><small>${p.detail}</small></div><p>${activeConfig.invertStart.toFixed(0)}° → ${activeConfig.angle.toFixed(0)}° in ${activeConfig.invertDuration.toFixed(1)} s. 8 m deck / 5.5 m pivot. ${info.detachReason?info.detachReason+'. ':''}Computed from the same trajectory used for playback; damage is an illustrative speed rule.</p>`);}
 set('primary-label','GROUND CLEARANCE');set('primary-unit','meters');set('velocity',s.clearance.toFixed(2));$('#velocity-meter').style.width=Math.min(100,s.clearance/info.rig.height*100)+'%';
 set('secondary-label','CONTACT LOAD');set('acceleration',`${(s.normal/1000).toFixed(1)} <small>kN</small>`);
 set('third-label',done&&run.status==='IMPACT'?'PRE-IMPACT SPEED':'SPEED');set('distance',`${s.v.toFixed(2)} <small>m/s</small>`);
 set('result-label','ROTATION OUTCOME');set('result',p.outcome);$('#result').classList.add('word-result');set('result-unit','');
 set('result-note',info.impactSpeed!==null?`Predicted impact ${info.impactSpeed.toFixed(2)} m/s at ${info.impactAt.toFixed(2)} s`:p.detail);
 set('constraint',phase);set('insight',s.contact?(s.downforce>0?'Sealed suction adds contact load. Friction resists gravity and rotation loads along the deck.':'Suction is zero. The deck supplies tire contact; supported pitch follows the guide.'):'No deck contact: suction and tire friction are zero. Gravity drives the fall.');
 if(done&&run.status==='IMPACT')set('insight','Physics ends at first ground contact. Damage and fragments are cosmetic; no structural impact model.');
 set('gas-percent','100%');set('gas-mass',`${s.gas.toFixed(1)} kg remaining · ${s.temp.toFixed(0)} K / no discharge`);document.querySelectorAll('.gas-bars i').forEach(el=>el.classList.remove('empty'));
 set('time',`T + ${t.toFixed(2)} s`);set('duration',duration().toFixed(2)+' s');$('#timeline').max=duration();$('#timeline').value=t;$('#timeline').setAttribute('aria-valuetext',`${t.toFixed(2)} of ${duration().toFixed(2)} seconds`);
 set('play',icon(playing?'pause':'play')+'<span>'+(playing?'Pause simulation':t>0&&!done?'Resume':'Rotate platform')+'</span>');
 for(const [id,value] of Object.entries({cutaway,vectors})){const el=$('#'+id);el.classList.toggle('on',value);el.setAttribute('aria-pressed',value);}
 $('#cutaway-label').hidden=!cutaway;set('tank-label',`${activeConfig.volume} L · ${(s.pressure/1e5).toFixed(0)} bara · ${s.temp.toFixed(0)} K · ${s.gas.toFixed(1)} kg`);
 set('scene-mode',phase);set('scene-detail',`${((s.platformAngle??s.angle)*180/Math.PI).toFixed(1)}° deck · ${activeConfig.invertStart.toFixed(0)}° → ${activeConfig.angle.toFixed(0)}° · ${s.downforce>0?'seal intact':s.contact?'suction off / tires supported':'suction off'} · world scale 1:1`);set('run-label','RUN 01');
 $('#repeat').hidden=true;$('#refill').hidden=true;legendFor();set('force-value',(s.normal/1000).toFixed(1)+' kN');set('pressure-value',(s.capacity/1000).toFixed(1)+' kN');
 document.querySelectorAll('.cursor-line').forEach(el=>{el.setAttribute('x1',400*t/duration());el.setAttribute('x2',400*t/duration());});
 const impact=info.impactAt===null?'-':info.impactAt.toFixed(2)+' s',detach=info.detachAt===null?'None in window':info.detachAt.toFixed(2)+' s';
 set('invert-outcome',`<div><span>PHASE</span><strong>${phase}</strong></div><div><span>PLATFORM ANGLE</span><strong>${((s.platformAngle??s.angle)*180/Math.PI).toFixed(1)}°</strong></div><div><span>DETACHMENT</span><strong>${detach}</strong></div><div><span>GROUND IMPACT</span><strong>${impact}</strong></div><div class="landing-controller"><span>${p.title}</span><strong>${p.detail}</strong><small>Deck displacement ${s.along.toFixed(2)} m · suction ${(s.downforce/1000).toFixed(1)} kN · friction ${(s.tire/1000).toFixed(1)} kN · electrical work ${(s.energy/1000).toFixed(1)} kJ${info.impactEnergy===null?'':' · impact kinetic energy '+(info.impactEnergy/1000).toFixed(1)+' kJ'}</small></div><p>Seal loss at first body overhang disables fan suction. Gravity can maintain contact on the upper side of the deck. Pitch follows the guided deck while supported and retains departure spin in flight. New deck contact stops the model; edge tipping and collision response remain unsupported. Rig motor work is external to the fan electrical budget. Ground contact uses a rectangular body proxy. Wreck iff impact speed exceeds ${info.threshold.toFixed(1)} m/s; this is a cosmetic rule, not a structural rating.</p>`);
 $('#invert-outcome').classList.toggle('wrecked',info.outcome==='WRECKED');
 plots?.update(t,1);sound.poll();renderInvertSample(s);
}
function drawInvertPlots(){
 const info=run.invert,result={config:activeConfig,duration:duration(),runs:[run,run,run],events:info.events};
 plots?.setData(result,[false,true,false]);set('invert-events',info.events.map((e,i)=>`<button data-invert-event="${i}">${e.label}<strong>${e.t.toFixed(2)} s</strong></button>`).join(''));
 document.querySelectorAll('[data-invert-event]').forEach(b=>{b.disabled=busy;b.onclick=()=>scrub(info.events[+b.dataset.invertEvent].t);});
 const scale=Math.max(1000,...run.samples.map(s=>Math.max(s.normal,s.capacity,s.demand)))*1.12;
 const path=key=>run.samples.map((s,i)=>`${i?'L':'M'}${(400*s.t/duration()).toFixed(2)},${(89-78*s[key]/scale).toFixed(2)}`).join('');
 const grid='<path d="M0 23H400M0 47H400M0 71H400" stroke="#ffffff0c" fill="none"/><line class="cursor-line" x1="0" x2="0" y1="0" y2="95" stroke="#ffffff65" stroke-dasharray="3 3"/>';
 set('force-chart',grid+`<path d="${path('normal')}" fill="none" stroke="#96c5a9" stroke-width="1.7"/><path d="${path('demand')}" fill="none" stroke="#ed694b" stroke-width="1.7"/>`);
 set('pressure-chart',grid+`<path d="${path('demand')}" fill="none" stroke="#ed694b" stroke-width="1.7"/><path d="${path('capacity')}" fill="none" stroke="#87b2c4" stroke-width="1.7"/>`);
 set('plot1-title','CONTACT / TANGENTIAL DEMAND');set('plot2-title','DEMAND / FRICTION CAPACITY');for(const id of ['plot1-start','plot2-start'])set(id,'0 s');for(const id of ['plot1-end','plot2-end'])set(id,duration().toFixed(2)+' s');
 $('#force-chart').setAttribute('aria-label','Deck normal contact load and tangential demand including rotation over time');$('#pressure-chart').setAttribute('aria-label','Tangential demand and friction capacity over time');
 set('bottom-title','A SEAL IS NOT A SAFETY GUARANTEE.');set('comparisons',`<p class="bottom-insight">Fan electrical draw ${(info.fanPower/1000).toFixed(1)} kW while sealed.<br>Gas mass stays constant; heat exchange can change temperature.<br>Frictional energy loss ${(info.frictionWork/1000).toFixed(1)} kJ.</p><div class="equation">N = F<sub>fan</sub> + m(g cos θ + qα + 2q̇ω − hω²)</div>`);
}
function updateHop(sample){
 if(!hopData)return;
 updateLandingPrediction();
 if($('#manual-fire')){
  $('#manual-fire').disabled=!canFireManual(sample);
  set('manual-fire-note',busy?'Updating the burn and landing prediction…':activeConfig.landingBurn===2&&run.landing.burnStart!==null&&t>=run.landing.burnStart?'Manual burn already ignited. Rewind to try different timing.':sample.vy>=0?'Available during descent. The selected window fires unless you move it.':'Fire now moves the scheduled burn to this instant. The prediction updates.');
 }
 const phase=hopPhase(run,sample,t,activeConfig,hopData);
 set('hop-phase',phase);set('constraint',phase);set('hop-apex-stat',hopData.apex?`${hopData.peakHeight.toFixed(2)} m / ${hopData.apex.t.toFixed(2)} s`:hopData.lifted?'Not reached':'No lift-off');
 set('hop-time-stat',hopData.touchdown?`${hopData.duration.toFixed(2)} s / touchdown`:`${hopData.duration.toFixed(2)} s / ${run.status==='INSUFFICIENT LIFT'?'on pad':'window'}`);
 set('hop-twr',((t>=duration()?0:sample.thrust)/((activeConfig.mass+sample.gas)*G)).toFixed(2)+' ×');
 set('result',hopData.peakHeight.toFixed(2));
 const landing=run.landing,done=t>=duration()-1e-8;
 if(landing){
  const outcome=hopData.touchdown?landing.outcome:'NO TOUCHDOWN';
  const plan=landing.plan,burn=activeConfig.landingBurn,manual=burn===2;
  const forecast=manual?'Manual timing / fixed valve command':burn?(plan?(plan.reason==='BALLISTIC TARGET MET'?'Ballistic descent already meets target':plan.feasible?'Target within full-burn forecast':'Limited braking reserve / best effort'):'No airborne descent to plan'):'Landing burn off';
  let hint=burn&&plan&&!plan.feasible?'Shorten the ascent pulse, increase usable propulsion, or try the Balanced hop preset. ':'';
  const targetMet=run.landingSpeed!==null&&run.landingSpeed<=landing.target+.1;
  if(burn&&plan?.feasible&&!targetMet&&run.landingSpeed!==null)hint='The timing adjustment missed the target. Reduce ignition lead or shorten the ascent pulse. ';
  set('hop-landing',`<div><span>${hopData.touchdown?(done?'TOUCHDOWN OUTCOME':'PREDICTED TOUCHDOWN'):'RUN OUTCOME'}</span><strong>${outcome}</strong></div><div><span>PRE-IMPACT SPEED</span><strong>${run.landingSpeed===null?'—':run.landingSpeed.toFixed(2)+' m/s'}</strong></div><div><span>ILLUSTRATIVE WRECK THRESHOLD</span><strong>&gt; ${landing.threshold.toFixed(1)} m/s</strong></div><div><span>IMPACT KINETIC ENERGY</span><strong>${landing.impactEnergy===null?'—':(landing.impactEnergy/1000).toFixed(1)+' kJ'}</strong></div><div class="landing-controller"><span>${forecast}</span><strong>${manual?`Scheduled T+${landing.manualAt.toFixed(2)} s · ${landing.manualDuration.toFixed(2)} s window · ${landing.manualCommand}% valve`:burn?`Target ${landing.target.toFixed(2)} m/s · actual ${run.landingSpeed===null?'—':run.landingSpeed.toFixed(2)} m/s · ${targetMet?'target met':'target missed'}`:'Ballistic descent'}</strong><small>Valve command ${Math.round((sample.valve??0)*100)}%${landing.burnStart===null?'':` · ignition ${landing.burnStart.toFixed(2)} s`}${burn===1?` · applied lead ${(plan&&!plan.feasible?0:landing.lead).toFixed(3)} s`:''}</small></div><p>${hint}${manual?'Manual pulse uses the remaining tank; the automatic target and lead do not modify it. ':burn?'Gas pressure, temperature and mass are forecast from the post-ascent tank. No refill at ignition. ':'Ballistic return. '}Cosmetic damage rule; no structural impact model.${done&&hopData.touchdown?' Physics ends here; any debris motion is display-only.':''}</p>`);
  $('#hop-landing')?.classList.toggle('wrecked',outcome==='WRECKED');
  if(burn&&plan&&!plan.feasible)set('insight','Limited reserve for the requested touchdown target. The controller applies its forecast best-effort burn.');if(done&&hopData.touchdown){set('hop-phase',outcome);set('constraint',outcome);}
 }

 if(phase==='TOUCHDOWN'){set('third-label','PRE-IMPACT VERTICAL SPEED');set('secondary-label','LAST FLIGHT ACCELERATION');set('acceleration',`${(run.samples.at(-2).a/G).toFixed(2)} <small>g</small>`);}
 if(phase==='NO LIFT')set('result-note','Thrust never overcame weight. Vehicle stays on the pad.');
 document.querySelectorAll('[data-hop-event]').forEach(b=>b.disabled=busy);
}
function positionHopLabels(){
 if(!scene?.hopAnnotations||!run)return;
 const a=scene.hopAnnotations,w=scene.canvas.clientWidth,h=scene.canvas.clientHeight;
 const ruler=$('#hop-ruler');if(ruler){const html=a.ticks.filter(t=>t.point[1]>110&&t.point[1]<h-60).map(t=>`<span style="left:${Math.max(30,Math.min(w-50,t.point[0]))}px;top:${t.point[1]}px">${Number(t.height.toFixed(2))}<small>m</small></span>`).join('');if(ruler._last!==html){ruler.innerHTML=html;ruler._last=html;}}
 for(const [id,point,label] of [['hop-height-label',a.car,hopData?.touchdown&&t>=duration()-1e-8?`IMPACT / ${hopData.touchdown.speed.toFixed(2)} m/s`:`${a.height.toFixed(2)} m · ${a.velocity>=0?'+':''}${a.velocity.toFixed(1)} m/s`],['hop-apex-label',a.apex,`APEX / ${hopData?.peakHeight.toFixed(2)} m`]]){
  const el=$('#'+id);if(!el)continue;el.hidden=!point||point[1]<110||point[1]>h-75;
  if(point){const x=Math.max(85,Math.min(w-85,point[0])),y=point[1];el.style.left=x+'px';el.style.top=y+'px';if(el.textContent!==label)el.textContent=label;}
 }
}
function positionInvertGauge(){
 const el=$('#invert-gauge'),g=scene?.invertAnnotations;if(!el)return;
 if(!g?.gauge||docked){if(el.textContent)el.textContent='';return;}
 el.style.left=g.gauge[0]+'px';el.style.top=g.gauge[1]+'px';const text=`θ ${g.angle.toFixed(0)}°`;if(el.textContent!==text)el.textContent=text;
}
function positionVesselLabel(){
 const label=$('#cutaway-label'),point=scene?.vesselAnnotation?.point;
 if(!label)return;label.hidden=!cutaway||!point;if(label.hidden)return;
 const [x,y]=point,w=scene.canvas.clientWidth,caption=label.querySelector('div');
 label.style.left=x+'px';label.style.top=y+'px';
 label.dataset.anchorX=x.toFixed(2);label.dataset.anchorY=y.toFixed(2);
 const left=Math.max(8,Math.min(w-caption.offsetWidth-8,x+10));caption.style.left=(left-x)+'px';
 label.classList.toggle('label-below',(experiment==='hop'&&y+caption.offsetHeight+74<scene.canvas.clientHeight-40)||y<caption.offsetHeight+50);
}
function positionLabels(){
 positionVesselLabel();
 if(experiment==='hop'){positionHopLabels();return;}
 if(experiment!=='launch'||!scene)return;const placed=[],heading=$('.scene-heading');
 if(heading)placed.push({left:heading.offsetLeft,right:heading.offsetLeft+heading.offsetWidth,top:heading.offsetTop,bottom:heading.offsetTop+heading.offsetHeight});
 for(const el of document.querySelectorAll('[data-world-focus]')){
  const i=+el.dataset.worldFocus,item=scene.annotations?.find(x=>x.mode===i);
  el.hidden=!visible[i]||!item?.point||(cutaway&&i===mode);
  if(item?.point){const caption=item.x.toFixed(1)+' m'+(item.status!=='ACTIVE'&&item.status!=='READY'?' · '+item.status:'');const label=el.querySelector('span');if(label.textContent!==caption)label.textContent=caption;
    const compact=scene.canvas.clientWidth<600,width=compact?92:120,height=compact?34:42;
    // At phone widths, use a stable three-column readout below the heading.
    // Stacking world anchors against the top clamp otherwise merges the labels.
    if(compact){el.style.left=((i+.5)*scene.canvas.clientWidth/3)+'px';el.style.top='150px';continue;}
    const clampX=x=>Math.max(width/2+8,Math.min(scene.canvas.clientWidth-width/2-8,x)),minY=height+85;
    const candidates=[];
    for(const lift of [0,height+6,2*(height+6)])for(const shift of [0,width+8,-width-8,2*(width+8),-2*(width+8)])candidates.push({x:clampX(item.point[0]+shift),y:Math.max(minY,item.point[1]-lift)});
    const {x,y}=candidates.find(({x,y})=>!placed.some(p=>x+width/2>p.left-4&&x-width/2<p.right+4&&y>p.top-4&&y-height<p.bottom+4))||candidates[0];
    placed.push({left:x-width/2,right:x+width/2,top:y-height,bottom:y});
    el.style.left=x+'px';el.style.top=y+'px';}
 }
 const marks=$('#distance-marks');if(marks){const markup=(scene.distanceMarks||[]).map(m=>`<span style="left:${m.point[0]}px;top:${m.point[1]}px">${m.x} m</span>`).join('');if(marks._last!==markup){marks.innerHTML=markup;marks._last=markup;}}
}
function drawPlots(){if(!run)return;if(experiment==='turn'){drawTurnPlots();return;}if(experiment==='invert'){drawInvertPlots();return;}if(experiment==='hop'&&hopData){plots?.setData({config:activeConfig,duration:duration(),runs:[run,run,run],events:hopData.events},[false,false,true]);set('hop-events',hopData.events.map((e,i)=>`<button data-hop-event="${i}">${e.label}<strong>${e.t.toFixed(2)} s</strong></button>`).join(''));document.querySelectorAll('[data-hop-event]').forEach(b=>{b.disabled=busy;b.onclick=()=>scrub(hopData.events[+b.dataset.hopEvent].t);});}if(vessel){const result=experiment==='launch'?comparison:{config:activeConfig,duration:duration(),runs:[run,run,run]};if(result)vessel.setData(result,experiment==='hop'?2:mode,initialGas(activeConfig).mass,experiment);}if(experiment==='launch'&&comparison){plots?.setData(comparison,visible);const u=speedUnit(units);set('milestone-results',runs.map((r,i)=>`<div style="--scenario:${SCENARIO_COLORS[i].hex}"><span>${names[i]} / ${u.milestone}</span><strong>${r[u.milestoneKey]?.toFixed(2)||'—'} <small>s</small></strong><small>${r.status==='COMPLETE'?'Standing start, no rollout':r.status+' at '+r.samples.at(-1).t.toFixed(2)+' s'}</small></div>`).join(''));}const plotConfig=activeConfig,samples=run.samples,d=duration(),forceScale=Math.max(1000,...run.samples.map(s=>Math.max(s.tire,s.thrust)))*1.12;const grid='<path d="M0 23H400M0 47H400M0 71H400" stroke="#ffffff0c" fill="none"/><line class="cursor-line" x1="0" y1="0" x2="0" y2="95" stroke="#ffffff65" stroke-dasharray="3 3"/>';
const path=(key,max)=>samples.filter((_,i)=>i%3===0).map((s,i)=>`${i?'L':'M'}${(s.t/d*400).toFixed(1)},${(89-Math.max(0,s[key])/max*78).toFixed(1)}`).join('');
  set('force-chart',grid+`<path d="${path('tire',forceScale)}" fill="none" stroke="#96c5a9" stroke-width="1.7"/><path d="${path('thrust',forceScale)}" fill="none" stroke="#ed694b" stroke-width="1.7"/>`);set('pressure-chart',grid+`<path d="${path('pressure',Math.max(plotConfig.pressure*1e5,1))}" fill="none" stroke="#87b2c4" stroke-width="1.7"/>`);
  set('plot1-title','FORCE DELIVERY');set('plot2-title','VESSEL PRESSURE / bara');set('plot1-start','0 s');set('plot2-start','0 s');set('plot1-end',d.toFixed(1)+' s');set('plot2-end',d.toFixed(1)+' s');
if(experiment==='launch'){set('bottom-title','THE SAME CAR. DIFFERENT PHYSICS.');const key=speedUnit(units).milestoneKey,best=Math.min(...runs.map(r=>r[key]??Infinity));set('comparisons',runs.map((r,i)=>`<div class="comparison-row"><span>${names[i]}</span><div><i style="width:${r[key]?Math.min(100,best/r[key]*100):0}%;background:${SCENARIO_COLORS[i].hex}"></i></div><strong>${r[key]?.toFixed(2)||'—'}<small> s</small></strong></div>`).join(''));}else{set('bottom-title','IMPULSE IS A FINITE RESOURCE.');set('comparisons',`<p class="bottom-insight">${run.used.toFixed(1)} kg of air consumed.<br>${run.landingSpeed!==null?'Touchdown speed: '+run.landingSpeed.toFixed(1)+' m/s.':run.status==='INSUFFICIENT LIFT'?'Increase pressure or nozzle area to lift off.':'Still airborne at the simulation time limit.'}</p><div class="equation">I = ∫ F<sub>thrust</sub> dt</div>`);}}
mount();
sound.startDefault();
const startSoundOnGesture=e=>{if(!e.isTrusted||e.target?.closest('#sound')||e.type==='keydown'&&(e.ctrlKey||e.metaKey||e.altKey||e.repeat))return;sound.ensureStarted();};
document.addEventListener('pointerdown',startSoundOnGesture,{capture:true});
document.addEventListener('keydown',startSoundOnGesture,{capture:true});
function frame(now){
 if(document.hidden){prev=0;lastFrameTime=0;requestAnimationFrame(frame);return;}
 const animating=!!showcase&&!showcase.preparing&&!showcase.paused&&!showcase.done||playing||cine||!!scene?.cameraTween||(impactStart!==null&&!reducedMotion()&&now-impactStart<2700);
 const canvas=scene?.canvas||$('#scene'),size=canvas?`${canvas.clientWidth}:${canvas.clientHeight}:${devicePixelRatio}`:'';
 const resized=size!==lastSize;lastSize=size;
 scene?.advanceCamera(now);
 const elapsed=prev?Math.max(0,(now-prev)/1000):0;prev=now;let completed=false;
 if(showcase&&!showcase.preparing&&!showcase.paused&&!showcase.done)advanceShowcase(elapsed);
 if(playing&&!busy){
  t=Math.min(duration(),t+elapsed*speed);
  if(t>=duration()){
   completed=true;
   const wrecked=(experiment==='hop'&&run.landing?.outcome==='WRECKED')||(experiment==='invert'&&run.invert?.outcome==='WRECKED');
   if(wrecked||(experiment==='hop'&&run.status==='TOUCHDOWN'))impactStart=now;
   if(wrecked){
    if(sound.impact(experiment==='hop'?run.landingSpeed:run.invert.impactSpeed,activeConfig.wreckSpeed)&&scene)scene.canvas.dataset.impactSounds=String(sound.impactCount);
    if(!reducedMotion()){const viewport=$('.viewport');viewport?.classList.remove('impact-flash');void viewport?.offsetWidth;viewport?.classList.add('impact-flash');setTimeout(()=>viewport?.classList.remove('impact-flash'),950);}
   }
   playing=false;cine=false;markRevealed();if(capture||demo)showEndCard();
  }
 }
 if(animating||scene?.dirty||resized){
  if(lastFrameTime){frameIntervals.push(now-lastFrameTime);if(frameIntervals.length>=90){canvas.dataset.frameRate=(1000*frameIntervals.length/frameIntervals.reduce((a,b)=>a+b,0)).toFixed(1);frameIntervals=[];}}
  lastFrameTime=now;
  const renderStart=performance.now();
  if(completed||now-lastTelemetryFrame>=40){update();lastTelemetryFrame=now;}else renderBetweenTelemetry();
  renderCosts.push(performance.now()-renderStart);
  if(renderCosts.length>=90){canvas.dataset.renderMs=(renderCosts.reduce((a,b)=>a+b,0)/renderCosts.length).toFixed(2);renderCosts=[];}
  if(scene)canvas.dataset.webglError=String(scene.gl.getError());
 }else{lastFrameTime=0;frameIntervals=[];}
 requestAnimationFrame(frame);
}requestAnimationFrame(frame);
document.addEventListener('keydown',e=>{
  if(showcase){
   if(e.key==='Escape'){e.preventDefault();stopShowcase();}
   else if(e.code==='Space'&&!ownsKeyboardInput(e.target)){e.preventDefault();$('#showcase-pause')?.click();}
   return;
  }
  if($('#model-dialog')?.open)return;
  if(busy||calculationError)return;
  if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||ownsKeyboardInput(e.target))return;
  if(e.code==='Space'){e.preventDefault();$('#play')?.click();return;}
  if(e.key==='['||e.key===']'){sound.silence();impactStart=null;const step=(e.key===']'?1:-1)*(duration()/40);t=Math.max(0,Math.min(duration(),t+step));if(t>=duration()-1e-6)markRevealed();playing=false;e.preventDefault();update();}
});
