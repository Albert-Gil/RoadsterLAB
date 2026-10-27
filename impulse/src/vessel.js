import {KinematicPlots} from './plots.js';

export const VESSEL_METRICS=[
  {key:'pressure',title:'Vessel pressure',unit:'bara',scale:1e-5},
  {key:'temp',title:'Gas temperature',unit:'K',scale:1,zero:false},
  {key:'gas',title:'Remaining mass',unit:'kg',scale:1},
  {key:'heatRate',title:'Heat into gas',unit:'kW',scale:.001},
  {key:'heatEnergy',title:'Cumulative heat',unit:'kJ',scale:.001}
];
export const DELIVERY_METRICS=[
  {key:'flow',title:'Mass flow',unit:'kg/s',scale:1},
  {key:'thrust',title:'Gas thrust',unit:'kN',scale:.001},
  {key:'nozzlePressure',validKey:'flow',title:'Nozzle exit pressure',unit:'bara',scale:1e-5},
  {key:'nozzleTemp',validKey:'flow',title:'Nozzle exit temperature',unit:'K',scale:1,zero:false},
  {key:'nozzleMach',validKey:'flow',title:'Nozzle exit Mach',unit:'',scale:1}
];

// Mark observed flow transitions, not an assumed successful valve command.
// A final unsupported sample is a solver stop, never an invented valve closure.
export function dischargeEvents(run){
  const events=[];let flowing=false;
  for(const sample of run.samples){
    const next=sample.flow>1e-8;
    if(next!==flowing){events.push({t:sample.t,label:next?'FLOW ON':'FLOW OFF'});flowing=next;}
  }
  if(!['COMPLETE','TOUCHDOWN','INSUFFICIENT LIFT'].includes(run.status))
    events.push({t:run.samples.at(-1).t,label:'RUN STOP'});
  return events;
}

export function vesselDisplay(sample,referenceMass){
  return {pressure:sample.pressure/1e5,temp:sample.temp,celsius:sample.temp-273.15,
    mass:sample.gas,fraction:Math.max(0,Math.min(1,sample.gas/referenceMass)),
    // Fixed color mapping across runs, with a visible numerical temperature legend.
    cold:Math.max(0,Math.min(1,(293.15-sample.temp)/150))};
}

export class VesselAnalysis {
  constructor(host,{colors,getSample,onScrub,onInspect,onCutaway}){
    this.host=host;this.getSample=getSample;this.colors=colors;this.focus=2;this.time=0;
    host.innerHTML=`<div class="vessel-heading"><div><span class="eyebrow">04 / FINITE ENERGY RESERVE</span><h2>Inside the pressure vessel.</h2><p>Pressure falls. Gas cools. Stored mass becomes thrust.</p></div><button data-vessel-cutaway>Inspect car cutaway <span aria-hidden="true">↗</span></button></div>
      <div class="vessel-console"><div class="vessel-schematic"><div class="vessel-caption"><span data-vessel-focus></span><strong data-vessel-state>VALVE CLOSED</strong></div>
      <svg viewBox="0 0 500 178" role="img" aria-label="Schematic gas vessel and discharge nozzle. Particle opacity represents remaining gas; color represents temperature.">
        <defs><linearGradient id="vessel-shell" x2="0" y2="1"><stop stop-color="#82969f" stop-opacity=".18"/><stop offset=".5" stop-color="#b0d4db" stop-opacity=".04"/><stop offset="1" stop-color="#82969f" stop-opacity=".16"/></linearGradient></defs>
        <path d="M45 38H259A35 35 0 0 1 294 73V105A35 35 0 0 1 259 140H45A35 35 0 0 1 10 105V73A35 35 0 0 1 45 38Z" fill="url(#vessel-shell)" stroke="#a7c2ca55"/>
        <path d="M64 39V139M240 39V139" stroke="#71878f" stroke-width="8" opacity=".35"/>
        <g data-gas-particles>${Array.from({length:40},(_,i)=>`<circle cx="${34+(i%10)*25}" cy="${59+Math.floor(i/10)*20}" r="${1.5+(i%3)*.5}"/>`).join('')}</g>
        <path data-feed-line d="M295 89H355M375 89H402" fill="none" stroke="#71878f" stroke-width="8"/>
        <circle cx="365" cy="89" r="14" fill="#142027" stroke="#9aafb7"/>
        <path data-valve-disk d="M365 78V100" stroke="#efab89" stroke-width="3"/>
        <path data-nozzle-shell d="M402 66L419 82H449V96H419L402 112Z" fill="#34464e" stroke="#8ca0a7"/>
        <path data-vessel-jet d="M450 89H495M451 77L490 65M451 101L490 113" stroke="#e7bc9b" stroke-width="2" stroke-dasharray="6 6" opacity="0"/>
        <text x="15" y="166">FIXED VOLUME / WELL-MIXED GAS</text><text x="337" y="136">VALVE</text><text x="408" y="151">NOZZLE</text>
      </svg><div class="vessel-key"><span data-vessel-volume></span><span><i></i>293 K → 143 K / cooling</span></div></div>
      <div class="vessel-readouts"><div><span>VESSEL PRESSURE / ABSOLUTE</span><strong data-tank-pressure></strong><small data-tank-gauge></small></div><div><span>GAS TEMPERATURE</span><strong data-tank-temp></strong><small data-tank-celsius></small></div><div><span>REMAINING AIR MASS</span><strong data-tank-mass></strong><small data-tank-inventory></small></div></div></div>
      <div class="delivery-live" aria-label="Live thrust delivery">
        <div><span>01 / VALVE OPENING</span><strong data-delivery-valve>0%</strong><div class="delivery-travel"><i data-delivery-travel></i></div><small data-delivery-command>Closed</small></div>
        <div><span>02 / NOZZLE FEED</span><strong data-delivery-feed>—</strong><small data-delivery-loss>Tank → valve → nozzle</small></div>
        <div><span>03 / EXIT JET</span><strong data-delivery-jet>—</strong><small data-delivery-expansion>Converging nozzle</small></div>
      </div>
      <div class="vessel-event-row"><div data-vessel-events></div><p data-vessel-insight></p></div>
      <div class="vessel-tabs" role="group" aria-label="Vessel analysis view"><button data-vessel-view="state" aria-pressed="true">State · P / T / mass</button><button data-vessel-view="delivery" aria-pressed="false">Delivery · flow / thrust</button><span>Focused car · shared simulation clock</span></div><div data-vessel-plots></div>
      <p class="vessel-disclosure">Illustrative well-mixed gas with Q̇ = UA(T_source − T_gas). Consistent Peng–Robinson approximation, supported from 140 K. Optional bell expansion changes exit speed and pressure. Valve opening is prescribed; closure is immediate. Feed loss is an assumed pressure fraction with conserved enthalpy. Low-pressure bell separation uses a throat-only approximation. No regulator or separate wall heat capacity. Gas occupies the whole vessel: dots indicate inventory, not a liquid level. Vessel geometry is schematic.</p>`;
    host.querySelector('[data-vessel-cutaway]').onclick=onCutaway;
    host.querySelectorAll('[data-vessel-view]').forEach(button=>button.onclick=()=>{
      this.plots.metrics=button.dataset.vesselView==='state'?VESSEL_METRICS:DELIVERY_METRICS;
      host.querySelectorAll('[data-vessel-view]').forEach(b=>b.setAttribute('aria-pressed',b===button));
      this.plots.draw();
    });
    this.plots=new KinematicPlots(host.querySelector('[data-vessel-plots]'),{
      colors,getSample,onScrub,metrics:VESSEL_METRICS,family:'BLOWDOWN',
      onInspect:time=>{this.inspection=time;this.drawState();onInspect(time);}
    });
  }
  setData(result,focus,referenceMass,kind='launch'){
    this.kind=kind;this.result=result;this.focus=focus;this.referenceMass=referenceMass;this.inspection=null;
    const run=result.runs[focus];this.events=dischargeEvents(run);
    this.plots.setData({...result,events:this.events},[0,1,2].map(i=>i===focus));
    this.host.querySelector('[data-vessel-events]').innerHTML=this.events.length?this.events.map((e,i)=>`<button data-event="${i}">${e.label}<strong>${e.t.toFixed(2)} s</strong></button>`).join(''):'<span class="no-discharge">NO DISCHARGE IN THIS RUN</span>';
    this.host.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>{this.inspection=null;this.plots.setInspection(null);this.plots.onInspect(null);this.plots.onScrub(this.events[+b.dataset.event].t);});
    this.drawState();
  }
  setDisabled(value){this.plots.setDisabled(value);this.host.classList.toggle('pending-result',value);this.host.querySelectorAll('button').forEach(b=>b.disabled=value);}
  setInspection(time){this.inspection=time;this.plots.setInspection(time);this.drawState();}
  setReveal(revealed){this.plots.setReveal(revealed);}
  update(time,focus,playing=false){this.playing=playing;this.time=time;this.focus=focus;this.plots.update(time,focus);this.drawState();}
  drawState(){
    if(!this.result)return;
    const at=this.inspection??this.time,run=this.result.runs[this.focus],state=this.getSample(run,at),s=state.sample;
    const view=vesselDisplay(s,this.referenceMass),text=(key,value)=>{const el=this.host.querySelector(`[data-${key}]`);if(el.textContent!==value)el.textContent=value;};
    // Before playback starts the vessel is ready with its valve closed, even when ignition is scheduled at T+0.
    const ready=this.inspection===null&&at<=0&&!this.playing;
    const stopped=state.unsupported&&at>=state.endTime-1e-8,flowing=!ready&&!stopped&&s.flow>1e-8;
    const config=this.result.config,commanded=!ready&&!stopped&&this.focus===2&&(this.kind==='hop'?((s.valve??0)>0||at<config.pulse||s.limit==='LANDING BURN'||s.limit==='INSUFFICIENT BRAKING'):at>=config.boostAt&&at<config.boostAt+2);
    text('vessel-focus',this.colors[this.focus].name.toUpperCase()+' / '+(this.inspection===null?'PLAYBACK':'INSPECTING')+' '+at.toFixed(2)+' s');
    text('vessel-state',ready?'READY / VALVE CLOSED':stopped?'RUN STOPPED':flowing?'VALVE OPEN / DISCHARGING':commanded?'VALVE OPEN / NO FLOW':'VALVE CLOSED / HOLDING');
    text('vessel-volume',this.result.config.volume+' L / schematic');
    text('tank-pressure',view.pressure.toFixed(1)+' bara');text('tank-gauge',(view.pressure-1.01325).toFixed(1)+' barg');
    text('tank-temp',view.temp.toFixed(1)+' K');text('tank-celsius',view.celsius.toFixed(1)+' °C');
    text('tank-mass',view.mass.toFixed(1)+' kg');text('tank-inventory',(view.fraction*100).toFixed(1)+'% of reference fill · '+Math.max(0,run.samples[0].gas-view.mass).toFixed(1)+' kg used this run');
    const color=`rgb(${Math.round(211-104*view.cold)},${Math.round(165+37*view.cold)},${Math.round(125+114*view.cold)})`;
    const particles=this.host.querySelector('[data-gas-particles]');particles.setAttribute('fill',color);particles.setAttribute('opacity',String(.08+.82*view.fraction));
    const opening=stopped||ready?0:Math.max(0,Math.min(1,s.valve??(flowing?1:0))),ratio=config.expansionRatio??1;
    this.host.querySelector('[data-valve-disk]').setAttribute('transform',`rotate(${opening*90} 365 89)`);
    this.host.querySelector('[data-feed-line]').setAttribute('stroke',flowing?'#91c7bb':'#71878f');
    const mouth=7*Math.sqrt(ratio);
    this.host.querySelector('[data-nozzle-shell]').setAttribute('d',`M402 66L419 82H430L449 ${89-mouth}V${89+mouth}L430 96H419L402 112Z`);
    text('delivery-valve',Math.round(opening*100)+'%');
    this.host.querySelector('[data-delivery-travel]').style.width=(opening*100)+'%';
    text('delivery-command',commanded?((config.valveRise??0)>0?`${Math.round(config.valveRise*1000)} ms opening · instant close`:'Instant opening'):'Closed');
    text('delivery-feed',flowing?((s.inletPressure??s.pressure)/1e5).toFixed(1)+' bara':'No flow');
    text('delivery-loss',(config.feedLoss??0)+'% assumed feed pressure loss');
    text('delivery-jet',flowing?(s.exitVelocity??0).toFixed(0)+' m/s':'No flow');
    text('delivery-expansion',s.separated?'Separated / throat-only approximation':ratio>1?`Bell ${ratio.toFixed(2)}× · ${flowing?'Mach '+(s.nozzleMach??0).toFixed(2):'exit / throat area'}`:'Converging · exit = throat');
    this.host.querySelector('[data-vessel-jet]').setAttribute('opacity',flowing?String(Math.min(.9,.2+s.flow/100)):0);
    this.host.classList.toggle('discharging',flowing);this.host.classList.toggle('playback-running',!!this.playing&&this.inspection===null);
    const ignition=this.kind==='hop'?0:config.boostAt;
    text('vessel-insight',ready?`Ready with a full charge. The valve opens at T+${ignition.toFixed(2)} s once the run starts.`:stopped?'Last supported state · '+run.status:flowing?`Gas removes stagnation enthalpy; heat input ${((s.heatRate??0)/1000).toFixed(1)} kW. ${s.choked?'Choked, underexpanded exit.':'Unchoked or zero flow.'}`:commanded?'Open command, but no discharge at the available pressure.':'Closed valve: mass holds; heat exchange can change temperature and pressure.');
  }
  dispose(){this.plots.dispose();}
}
