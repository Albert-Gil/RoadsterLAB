// Presentation derived from stored solver samples. All heights/velocities stay SI.
export const HOP_METRICS=[
  {key:'y',title:'Altitude',unit:'m',scale:1},
  {key:'vy',title:'Vertical velocity',unit:'m/s',scale:1},
  {key:'a',title:'Vertical acceleration',unit:'g',scale:1/9.80665}
];
export const hopPosition=sample=>[0,sample.y,0];
export const HOP_MOUNTS=[[-1.65,.12,-.48],[-1.65,.12,.48],[1.65,.12,-.48],[1.65,.12,.48]];

// Pure reconstruction from playback time: scrubbing never leaves a stale wreck.
export function hopDamage(summary,time,age=1.2){
  const wrecked=summary?.landing?.outcome==='WRECKED'&&summary.touchdown&&time>=summary.touchdown.t-1e-8;
  return {wrecked:!!wrecked,progress:wrecked?Math.max(0,Math.min(1,age/1.2)):0};
}

export function hopLandingPrediction(run){
  if(run.status==='INSUFFICIENT LIFT')return {outcome:'NO LIFT',title:'No lift-off',tone:'limited',speed:null,detail:'The vehicle stays on the pad; no landing impact is predicted.'};
  if(run.status!=='TOUCHDOWN'||run.landingSpeed===null||!run.landing)return {outcome:'UNRESOLVED',title:'Landing outcome unresolved',tone:'limited',speed:null,detail:run.status+' — no supported touchdown prediction.'};
  const wrecked=run.landing.outcome==='WRECKED';
  return {outcome:run.landing.outcome,title:wrecked?'Wrecked on landing':'Intact landing',tone:wrecked?'wrecked':'intact',speed:run.landingSpeed,
    detail:`${run.landingSpeed.toFixed(2)} m/s impact / ${run.landing.threshold.toFixed(1)} m/s illustrative wreck threshold`};
}

export function hopSummary(run,config){
  const samples=run.samples,end=samples.at(-1),peak=samples.reduce((best,s)=>s.y>best.y?s:best,samples[0]);
  const apexes=[];
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i];
    if(a.vy>0&&b.vy<=0){
      const k=a.vy/(a.vy-b.vy),dt=b.t-a.t;
      // Interpolate velocity's zero; trapezoidal displacement to that instant.
      apexes.push({t:a.t+k*dt,height:a.y+a.vy*k*dt/2});
    }
  }
  const apex=apexes.reduce((best,p)=>!best||p.height>best.height?p:best,null);
  const lifted=peak.y>1e-9,events=[];
  if(lifted)events.push({t:0,label:'LIFT-OFF'});
  if(config.pulse<=end.t+1e-8)events.push({t:config.pulse,label:'PULSE END'});
  apexes.forEach((p,i)=>events.push({t:p.t,label:i?'REBOUND APEX':'APEX'}));
  if(run.landing?.burnStart!==null&&run.landing?.burnStart!==undefined)events.push({t:run.landing.burnStart,label:run.landing.mode==='manual'?'MANUAL IGNITION':'LANDING IGNITION'});
  if(run.landing?.mode==='manual'&&run.landing.burnEnd!==null)events.push({t:run.landing.burnEnd,label:'MANUAL CUTOFF'});
  events.push({t:end.t,label:run.status==='TOUCHDOWN'?'TOUCHDOWN':run.status==='INSUFFICIENT LIFT'?'NO LIFT':'RUN STOP'});
  return {apex,apexes,peakHeight:apex?.height??peak.y,duration:Math.max(.01,end.t),lifted,landing:run.landing,
    touchdown:run.status==='TOUCHDOWN'?{t:end.t,speed:run.landingSpeed}:null,
    events:events.sort((a,b)=>a.t-b.t)};
}

export function hopPhase(run,sample,time,config,summary){
  if(time>=run.samples.at(-1).t-1e-8)return run.status==='TOUCHDOWN'?'TOUCHDOWN':run.status==='INSUFFICIENT LIFT'?'NO LIFT':run.status;
  if(time<=0)return 'READY';
  if(sample.y<=1e-9&&sample.vy<=0)return 'ON PAD';
  if(time<config.pulse)return 'POWERED ASCENT';
  if(summary.apexes?.some(p=>Math.abs(time-p.t)<.035))return 'APEX';
  if((sample.vy<0&&config.landingBurn)||config.landingBurn===2)return sample.limit;
  return sample.vy>=0?'COASTING UP':'DESCENDING';
}
