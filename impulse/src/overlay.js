// Live physics overlays: compact instrument panels inside the scene, built only from solver samples.
// Display only. Nothing here feeds back into physics, CSV or the predict-then-reveal state.
const G=9.80665;
const kN=n=>`${(n/1000).toFixed(1)} kN`;
const pct=(n,scale)=>Math.max(0,Math.min(100,scale>0?n/scale*100:0));
const tone=u=>u===null||!Number.isFinite(u)?'muted':u>=1-1e-6?'over':u>=.85?'near':'ok';
const LIMIT_TEXT={'TRACTION LIMITED':'Tire grip is the binding limit','POWER LIMITED':'Electrical power is the binding limit','TORQUE LIMITED':'Motor torque is the binding limit','CONTACT LIMIT':'Front axle unloaded: run stopped','OUT OF TABLE':'Gas state outside the property table'};

/** Launch: delivered tire force against its two ceilings (grip μN and motor), plus thrust and resistance. */
export function launchBudget(sample,c){
  if(!sample||!Number.isFinite(sample.traction)||!Number.isFinite(sample.motor))return null;
  const mass=c.mass+(sample.gas||0),tire=sample.tire||0,thrust=sample.thrust||0,resist=sample.resist||0;
  return {kind:'launch',tire,traction:sample.traction,motor:sample.motor,thrust,resist,net:tire+thrust-resist,accelG:(tire+thrust-resist)/mass/G,
    binding:sample.traction<sample.motor?'grip':'motor',limit:sample.limit,gripUse:sample.traction>0?tire/sample.traction:null};
}
/** Turn: vehicle-level friction circle. Radius = μN; drive force is reserved first, lateral uses the rest. */
export function turnCircle(sample){
  if(!sample)return null;
  const drive=sample.tire||0,capacity=sample.capacity||0,demand=sample.demand||0,total=Math.hypot(capacity,drive);
  return {kind:'turn',total,drive,capacity,demand,lateral:Math.min(demand,capacity),over:demand>capacity+1e-6,
    utilization:sample.utilizationValid?sample.utilization:null,normal:sample.normal||0};
}
/** Invert: friction needed along the deck against μN, and the normal load split into suction and the rest. */
export function invertBudget(sample,c){
  if(!sample)return null;
  const contact=!!sample.contact,needed=contact?sample.demand||0:0,available=contact?sample.capacity||0:0,normal=contact?sample.normal||0:0,suction=contact?sample.downforce||0:0;
  return {kind:'invert',contact,needed,available,normal,suction,utilization:available>0?needed/available:null,
    sliding:contact&&Math.abs(sample.alongV||0)>1e-8,angle:((sample.platformAngle??sample.angle)||0)*180/Math.PI,weight:(c.mass+(sample.gas||0))*G,limit:sample.limit};
}
/** Hop: thrust against weight, with the resulting vertical state. */
export function hopBudget(sample,c){
  if(!sample)return null;
  const weight=(c.mass+(sample.gas||0))*G,thrust=sample.thrust||0;
  return {kind:'hop',thrust,weight,ratio:weight>0?thrust/weight:0,y:sample.y||0,vy:sample.vy||0,valve:sample.valve||0};
}
/** Run-wide scale so bars do not rescale frame to frame. */
export function overlayScale(kind,runs,c){
  const all=runs.flatMap(r=>r.samples);
  if(kind==='launch')return Math.max(1,...all.map(s=>Math.max(s.tire||0,s.traction||0,s.motor||0,s.thrust||0)))*1.04;
  if(kind==='turn')return Math.max(1,...all.map(s=>Math.max(Math.hypot(s.capacity||0,s.tire||0),s.demand||0)))*1.06;
  if(kind==='invert')return Math.max(1,...all.map(s=>Math.max(s.normal||0,s.capacity||0,s.demand||0,s.downforce||0)),(c.mass+all[0].gas)*G)*1.04;
  if(kind==='hop')return Math.max(1,...all.map(s=>s.thrust||0),(c.mass+all[0].gas)*G)*1.08;
  return 1;
}
function bar(value,scale,cls,ticks=[]){
  return `<svg class="ov-bar" viewBox="0 0 160 12" preserveAspectRatio="none" aria-hidden="true"><rect class="ov-track" x="0" y="2" width="160" height="8" rx="2"/><rect class="ov-fill ${cls}" x="0" y="2" width="${(pct(value,scale)*1.6).toFixed(1)}" height="8" rx="2"/>${ticks.map(([v,c])=>`<rect class="ov-tick ${c}" x="${Math.min(158.5,pct(v,scale)*1.6).toFixed(1)}" y="0" width="1.6" height="12"/>`).join('')}</svg>`;
}
const row=(label,svg,value,cls='')=>`<div class="ov-row ${cls}"><span>${label}</span>${svg}<strong>${value}</strong></div>`;

export function overlayHTML(data,{scale=1,title='',color='#a6dfc9',second=null,secondColor='',secondTitle=''}={}){
  if(!data)return '';
  if(data.kind==='launch'){
    const note=LIMIT_TEXT[data.limit]||data.limit;
    return `<div class="ov-head"><span>FORCE BUDGET</span><b style="color:${color}">${title}</b></div>`+
      row('Tire',bar(data.tire,scale,'grip',[[data.traction,'grip'],[data.motor,'motor']]),kN(data.tire))+
      row('Cold gas',bar(data.thrust,scale,'thrust'),kN(data.thrust))+
      row('Drag + roll',bar(data.resist,scale,'drag'),kN(data.resist))+
      `<div class="ov-key"><span><i class="grip"></i>grip limit ${kN(data.traction)}</span><span><i class="motor"></i>motor limit ${kN(data.motor)}</span></div>`+
      `<div class="ov-compact">Tire ${kN(data.tire)} · gas ${kN(data.thrust)} · drag ${kN(data.resist)}</div>`+
      `<div class="ov-foot"><strong>${data.accelG.toFixed(2)} g</strong><span class="${data.binding==='grip'&&data.gripUse>=.999?'ov-near':''}">${note}</span></div>`;
  }
  if(data.kind==='turn'){
    const R=60,s=R/scale,cars=[[data,color,title],...(second?[[second,secondColor,secondTitle]]:[])];
    const circles=cars.map(([d,col],i)=>`<circle cx="0" cy="0" r="${(d.total*s).toFixed(1)}" fill="none" stroke="${col}" stroke-opacity="${i?.5:.85}" stroke-width="${i?1.2:1.8}" ${i?'stroke-dasharray="4 3"':''}/>`).join('');
    const marks=cars.map(([d,col])=>{const x=d.lateral*s,y=-d.drive*s,dx=d.demand*s;return `${d.over?`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${dx.toFixed(1)}" y2="${y.toFixed(1)}" class="ov-overline"/><path d="M${(dx-3).toFixed(1)} ${(y-3).toFixed(1)}l6 6m0-6l-6 6" class="ov-overline"/>`:''}<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="1.6"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="${col}" stroke="#0d1f22" stroke-width="1.2"/>`;}).join('');
    const legend=cars.map(([d,col,name])=>`<div><i style="background:${col}"></i><span>${name}</span><strong class="ov-${tone(d.utilization)}">${d.utilization===null?'—':d.utilization.toFixed(2)+'×'}</strong><small>${kN(d.demand)} asked · ${kN(d.capacity)} lateral</small></div>`).join('');
    return `<div class="ov-head"><span>FRICTION CIRCLE</span><b>grip budget per car</b></div><div class="ov-circle"><svg viewBox="-70 -70 140 140" aria-hidden="true"><line x1="-66" y1="0" x2="66" y2="0" class="ov-axis"/><line x1="0" y1="-66" x2="0" y2="66" class="ov-axis"/><text x="68" y="64" text-anchor="end" class="ov-axis-label">lateral →</text><text x="5" y="-58" class="ov-axis-label">drive</text>${circles}${marks}</svg><div class="ov-legend">${legend}</div></div><div class="ov-compact">${cars.map(([d,,name])=>`${name} ${d.utilization===null?'—':d.utilization.toFixed(2)+'×'}`).join(' · ')} of available grip</div><div class="ov-foot"><span>Radius = μN. A request outside the circle cannot be met, so the path widens.</span></div>`;
  }
  if(data.kind==='invert'){
    const state=!data.contact?'No deck contact · ballistic':data.sliding?'Sliding along the deck':'Held by friction';
    return `<div class="ov-head"><span>CONTACT BUDGET</span><b>θ ${data.angle.toFixed(0)}°</b></div>`+
      row('Friction',bar(data.needed,scale,data.utilization>=1?'thrust':'grip',[[data.available,'grip']]),kN(data.needed))+
      row('Normal',bar(data.normal,scale,'grip'),kN(data.normal))+
      row('Suction',bar(data.suction,scale,'fan'),kN(data.suction))+
      row('Weight',bar(data.weight,scale,'drag'),kN(data.weight))+
      `<div class="ov-key"><span><i class="grip"></i>available μN ${kN(data.available)}</span></div>`+
      `<div class="ov-compact">Friction ${kN(data.needed)} of ${kN(data.available)} · normal ${kN(data.normal)}</div>`+
      `<div class="ov-foot"><strong class="ov-${tone(data.utilization)}">${data.utilization===null?'—':Math.round(data.utilization*100)+' %'}</strong><span>${state}</span></div>`;
  }
  if(data.kind==='hop'){
    const dir=data.vy>.05?'climbing':data.vy<-.05?'descending':'level';
    return `<div class="ov-head"><span>THRUST / WEIGHT</span><b class="ov-${data.ratio>=1?'ok':'muted'}">${data.ratio.toFixed(2)}</b></div>`+
      row('Thrust',bar(data.thrust,scale,'thrust',[[data.weight,'motor']]),kN(data.thrust))+
      row('Weight',bar(data.weight,scale,'drag'),kN(data.weight))+
      `<div class="ov-key"><span><i class="motor"></i>weight line: thrust beyond it lifts the car</span></div>`+
      `<div class="ov-compact">Thrust ${kN(data.thrust)} · weight ${kN(data.weight)}</div>`+
      `<div class="ov-foot"><strong>${data.y.toFixed(2)} m</strong><span>${dir} ${Math.abs(data.vy).toFixed(1)} m/s · valve ${Math.round(data.valve*100)} %</span></div>`;
  }
  return '';
}
