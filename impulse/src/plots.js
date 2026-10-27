const SVG_NS='http://www.w3.org/2000/svg';
let plotInstances=0;
// Speed display only; the solver and CSV stay in SI.
const SPEED={kmh:{unit:'km/h',scale:3.6,milestoneKey:'hundred',milestoneSpeed:100/3.6},mph:{unit:'mph',scale:2.2369362920544,milestoneKey:'sixty',milestoneSpeed:26.8224}};
const METRICS=[{key:'x',title:'Position',unit:'m',scale:1},{key:'v',title:'Velocity',unit:'km/h',scale:3.6},{key:'a',title:'Acceleration',unit:'g',scale:1/9.80665}];
export function axisDomain(values,includeZero=true){
  let lo=Math.min(...values),hi=Math.max(...values);
  if(includeZero){lo=Math.min(0,lo);hi=Math.max(0,hi);}
  if(hi-lo<1e-6)hi=lo+1;
  const span=hi-lo,raw=span/4,power=10**Math.floor(Math.log10(raw));
  const step=([1,2,2.5,5,10].find(n=>n*power>=raw)||10)*power;
  return {lo:Math.floor((lo-(lo<0?span*.04:0))/step)*step,hi:Math.ceil((hi+span*.05)/step)*step,step};
}
export function tracePath(samples,key,scale,domain,width,height,duration=6,validKey=null){
  const left=52,right=18,top=28,bottom=32,iw=width-left-right,ih=height-top-bottom;
  let active=false;return samples.map(s=>{if(validKey&&!(s[validKey]>1e-8)){active=false;return '';}const command=active?'L':'M';active=true;return `${command}${(left+s.t/duration*iw).toFixed(2)},${(top+(domain.hi-s[key]*scale)/(domain.hi-domain.lo)*ih).toFixed(2)}`;}).join('');
}
const format=(n,d=1)=>Math.abs(n)<.00001?'0':Number(n.toFixed(d)).toString();

// Preserve every event marker while fitting captions into two non-overlapping rows.
export function plotEventLabels(events,width,duration){
 const compact={'LIFT-OFF':'LIFT','PULSE END':'CUT','LANDING IGNITION':'BRAKE','MANUAL IGNITION':'BURN','MANUAL CUTOFF':'OFF','REBOUND APEX':'APEX 2','NO FAN LEFT LANE':'NO FAN OFF','FAN LEFT LANE':'FAN OFF','NO FAN RUN END':'OFF END','FAN RUN END':'FAN END','NO FAN EXIT':'OFF EXIT','FAN EXIT':'FAN EXIT','SEAL LOST':'SEAL','GROUND IMPACT':'IMPACT','HOLD COMPLETE':'HELD','DETACHED':'FREE','TOUCHDOWN':'LAND','FLOW ON':'ON','FLOW OFF':'OFF','RUN STOP':'STOP'};
 const rows=[[],[]],left=54,right=width-20;
 return [...events].sort((a,b)=>a.t-b.t).map(event=>{
  const text=width<400?(compact[event.label]||event.label):event.label;
  const span=text.length*5.2,x=Math.max(left,Math.min(right-span,52+event.t/duration*(width-70)+4));
  const row=span>right-left?-1:rows.findIndex(items=>items.every(item=>x+span+5<item[0]||x>item[1]+5));
  if(row>=0)rows[row].push([x,x+span]);
  return {...event,text,x,row,y:14+row*10};
 });
}

export class KinematicPlots {
  constructor(host,{colors,getSample,onScrub,metrics=METRICS,family="KINEMATICS",onInspect=()=>{}}){
    this.metrics=metrics;this.family=family;this.onInspect=onInspect;this.duration=6;this.host=host;this.colors=colors;this.getSample=getSample;this.onScrub=onScrub;
    this.visible=[true,true,true];this.inspect=null;this.time=0;this.focus=2;this.accelerationUnit='g';this.speed=SPEED.kmh;this.revealed=true;this.uid='plot'+(++plotInstances);
    this.host.innerHTML=`<div class="inspection-bar"><span data-inspection>PLAYBACK · 0.00 s</span><span>Hover to inspect · drag / arrows to scrub</span><button data-live hidden>Return to playback</button><button data-accel aria-label="Change acceleration units">Acceleration: g</button></div><div class="kinematic-panels"></div>`;
    this.host.querySelector('[data-live]').onclick=()=>{this.setInspection(null);this.onInspect(null);};
    this.host.querySelector('[data-accel]').hidden=!this.metrics.some(m=>m.key==='a');
    this.host.querySelector('[data-accel]').onclick=()=>{this.accelerationUnit=this.accelerationUnit==='g'?'m/s²':'g';this.draw();};
    this.host.addEventListener('pointerdown',e=>{
      const svg=e.target.closest('svg[data-plot]');if(!svg||this.disabled)return;
      svg.setPointerCapture(e.pointerId);this.dragging=e.pointerId;this.inspect=null;this.onInspect(null);
      this.onScrub(this.timeFromPointer(svg,e));e.preventDefault();
    });
    this.host.addEventListener('pointermove',e=>{
      const svg=e.target.closest('svg[data-plot]');if(!svg||this.disabled)return;
      const time=this.timeFromPointer(svg,e);
      if(this.dragging===e.pointerId)this.onScrub(time);else{this.setInspection(time);this.onInspect(time);}
    });
    const release=()=>{this.dragging=null;};
    this.host.addEventListener('pointerup',release);this.host.addEventListener('pointercancel',release);
    this.host.addEventListener('pointerout',e=>{if(!this.dragging&&!e.relatedTarget?.closest?.('svg[data-plot]')){this.setInspection(null);this.onInspect(null);}});
    this.host.addEventListener('keydown',e=>{
      if(!e.target.matches('svg[data-plot]')||this.disabled)return;
      let value=this.time;
      if(e.key==='Home')value=0;else if(e.key==='End')value=this.duration;
      else if(e.key==='ArrowRight'||e.key==='ArrowLeft')value+=(e.key==='ArrowRight'?1:-1)*(e.shiftKey?.25:.05);else return;
      e.preventDefault();this.inspect=null;this.onInspect(null);this.onScrub(Math.max(0,Math.min(this.duration,value)));
    });
    this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(host);
  }
  dispose(){this.observer.disconnect();}
  setInspection(time){this.inspect=time;this.update(this.time,this.focus);}
  timeFromPointer(svg,e){const r=svg.getBoundingClientRect(),w=Number(svg.getAttribute('viewBox').split(' ')[2]);return Math.max(0,Math.min(this.duration,((e.clientX-r.left)/r.width*w-52)/(w-70)*this.duration));}
  setData(result,visible){this.result=result;this.duration=result.duration||6;this.visible=[...visible];this.inspect=null;this.draw();}
  setDisabled(disabled){this.disabled=disabled;this.host.classList.toggle('pending-result',disabled);}
  // Unrevealed runs show only the played part of each trace; revealed runs ghost the future.
  setReveal(revealed){if(this.revealed===revealed)return;this.revealed=revealed;this.host.querySelectorAll('.trace-future').forEach(g=>g.setAttribute('opacity',revealed?'.36':'0'));}
  setSpeedUnits(units){const next=units==='us'?SPEED.mph:SPEED.kmh;if(next===this.speed)return;this.speed=next;this.draw();}
  draw(){
    if(!this.result)return;
    const focused=document.activeElement?.closest?.('svg[data-plot]'),focusKey=this.host.contains(focused)?focused?.dataset.plot:null;
    const panels=this.host.querySelector('.kinematic-panels');
    panels.dataset.count=String(this.metrics.length);
    const layout=getComputedStyle(panels),columns=Math.max(1,layout.gridTemplateColumns.split(' ').length),gap=parseFloat(layout.columnGap)||0;
    const w=Math.max(250,(this.host.clientWidth-gap*(columns-1))/columns-(this.family==='KINEMATICS'?42:28)),h=198,l=52,r=18,top=28,bottom=32,iw=w-l-r,ih=h-top-bottom;
    this.geometry={w,h,l,iw};this.domains={};
    this.host.querySelector('[data-accel]').textContent='Acceleration: '+this.accelerationUnit;
    this.host.querySelector('.kinematic-panels').innerHTML=this.metrics.map((base,index)=>{
      const metric=base.key==='a'&&this.accelerationUnit!=='g'?{...base,scale:1,unit:'m/s²'}:base.key==='v'&&base.unit==='km/h'?{...base,scale:this.speed.scale,unit:this.speed.unit}:base;
      const values=this.result.runs.flatMap((run,i)=>this.visible[i]?run.samples.filter(s=>!metric.validKey||s[metric.validKey]>1e-8).map(s=>s[metric.key]*metric.scale):[]);
      const domain=axisDomain(values.length?values:[0,1],metric.zero!==false);this.domains[metric.key]=domain;
      const y=value=>top+(domain.hi-value)/(domain.hi-domain.lo)*ih;
      const ticks=[];for(let n=domain.lo;n<=domain.hi+domain.step*.001;n+=domain.step)ticks.push(n);
      const boostStart=l+this.result.config.boostAt/this.duration*iw,boostEnd=l+Math.min(this.duration,this.result.config.boostAt+2)/this.duration*iw;
      const traces=this.result.runs.map((run,i)=>!this.visible[i]?'':`<path class="scenario-trace" d="${tracePath(run.samples,metric.key,metric.scale,domain,w,h,this.duration,metric.validKey)}" fill="none" stroke="${this.colors[i].plot}" stroke-width="2" stroke-dasharray="${this.colors[i].dash}"/>${['COMPLETE','TOUCHDOWN','INSUFFICIENT LIFT','HELD','IMPACT','CORNER CLEAR','OFF TRACK'].includes(run.status)?'':`<circle cx="${l+run.samples.at(-1).t/this.duration*iw}" cy="${y(run.samples.at(-1)[metric.key]*metric.scale)}" r="4" fill="${this.colors[i].plot}"/><text x="${w-r-4}" text-anchor="end" y="${top+14+i*14}" fill="${this.colors[i].plot}">${run.status}</text>`}`).join('');
      const mark=this.speed,milestones=metric.key==='v'&&base.unit==='km/h'?this.result.runs.map((run,i)=>this.visible[i]&&Number.isFinite(run[mark.milestoneKey])?`<circle cx="${l+run[mark.milestoneKey]/this.duration*iw}" cy="${y(mark.milestoneSpeed*mark.scale)}" r="3.5" fill="${this.colors[i].plot}"/>`:'').join(''):'';
      const clip=`${this.uid}-${metric.key}`,future=this.revealed?'.36':'0';
      return `<article class="kinematic-card"><header><div><small>0${index+1} / ${this.family}</small><h3>${metric.title}<span>${metric.unit}</span></h3></div><output aria-live="off" data-selected="${metric.key}"></output></header><svg data-plot="${metric.key}" viewBox="0 0 ${w} ${h}" role="slider" tabindex="0" aria-label="${metric.title}, scrub simulation time" aria-valuemin="0" aria-valuemax="${this.duration}" aria-valuenow="${this.time.toFixed(2)}">${this.family==='KINEMATICS'?`<rect x="${boostStart}" y="${top}" width="${boostEnd-boostStart}" height="${ih}" fill="#ef79550a"/><text class="boost-label" x="${boostStart+5}" y="16">BOOST WINDOW</text>`:''}${plotEventLabels(this.result.events||[],w,this.duration).map(e=>`<g><title>${e.label} / ${e.t.toFixed(2)} s</title><line x1="${l+e.t/this.duration*iw}" x2="${l+e.t/this.duration*iw}" y1="${top}" y2="${h-bottom}" stroke="#efb79275" stroke-dasharray="3 4"/>${e.row<0?'':`<text class="boost-label" x="${e.x}" y="${e.y}">${e.text}</text>`}</g>`).join('')}${ticks.map(n=>`<line x1="${l}" y1="${y(n)}" x2="${w-r}" y2="${y(n)}" stroke="${Math.abs(n)<1e-8?'#ffffff35':'#ffffff0e'}"/><text class="axis-label" x="${l-10}" y="${y(n)+4}" text-anchor="end">${format(n,Math.abs(n)<1?2:1)}</text>`).join('')}${Array.from({length:7},(_,i)=>`<line x1="${l+i/6*iw}" y1="${top}" x2="${l+i/6*iw}" y2="${h-bottom}" stroke="#ffffff08"/><text class="axis-label" x="${l+i/6*iw}" y="${h-11}" text-anchor="middle">${format(i/6*this.duration,2)}${i===6?' s':''}</text>`).join('')}<defs><clipPath id="${clip}-past"><rect data-clip-past x="0" y="0" width="${l}" height="${h}"/></clipPath><clipPath id="${clip}-future"><rect data-clip-future x="${l}" y="0" width="${w}" height="${h}"/></clipPath></defs><g class="trace-past" clip-path="url(#${clip}-past)">${traces}${milestones}</g><g class="trace-future" clip-path="url(#${clip}-future)" opacity="${future}">${traces}${milestones}</g>${this.colors.map((color,i)=>`<circle data-dot="${metric.key}-${i}" r="4" fill="${color.plot}" stroke="#111a1f" stroke-width="1.5"/>`).join('')}<line data-playhead x1="${l}" x2="${l}" y1="${top}" y2="${h-bottom}" stroke="#e4ecee90"/><line data-inspector x1="${l}" x2="${l}" y1="${top}" y2="${h-bottom}" stroke="#f5c1a7" stroke-dasharray="3 3" visibility="hidden"/><rect class="plot-hit" x="${l}" y="${top}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="plot-readouts">${this.colors.map((color,i)=>`<div style="--scenario:${color.hex}" ${!this.visible[i]?'hidden':''}><span>${color.name}</span><strong data-value="${metric.key}-${i}">—</strong></div>`).join('')}</div></article>`;
    }).join('');
    this.update(this.time,this.focus);
    if(focusKey)this.host.querySelector(`[data-plot="${focusKey}"]`)?.focus({preventScroll:true});
  }
  update(time,focus){
    this.time=time;this.focus=focus;if(!this.result||!this.geometry)return;
    const inspect=this.inspect,at=inspect??time,{l,iw}=this.geometry;
    const text=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
    text(this.host.querySelector('[data-inspection]'),`${inspect===null?'PLAYBACK':'INSPECTING'} · ${at.toFixed(2)} s`);
    this.host.querySelector('[data-live]').hidden=inspect===null;
    this.host.querySelectorAll('svg[data-plot]').forEach(svg=>{
      const x=l+time/this.duration*iw,hover=l+at/this.duration*iw;
      svg.querySelector('[data-playhead]').setAttribute('x1',x);svg.querySelector('[data-playhead]').setAttribute('x2',x);
      const past=svg.querySelector('[data-clip-past]'),later=svg.querySelector('[data-clip-future]');if(past){past.setAttribute('width',Math.max(0,x+.5));later.setAttribute('x',x+.5);}
      const line=svg.querySelector('[data-inspector]');line.setAttribute('x1',hover);line.setAttribute('x2',hover);line.setAttribute('visibility',inspect===null?'hidden':'visible');
      svg.setAttribute('aria-valuenow',time.toFixed(2));svg.setAttribute('aria-valuetext',`${time.toFixed(2)} of ${this.duration.toFixed(2)} seconds`);
    });
    for(const metric of this.metrics){
      const speed=metric.key==='v'&&metric.unit==='km/h';
      const scale=metric.key==='a'&&this.accelerationUnit!=='g'?1:speed?this.speed.scale:metric.scale;
      const unit=metric.key==='a'?this.accelerationUnit:speed?this.speed.unit:metric.unit;
      this.result.runs.forEach((run,i)=>{
        const state=this.getSample(run,at),inactive=metric.validKey&&!(state.sample[metric.validKey]>1e-8),value=state.ended&&state.unsupported?'Stopped':inactive?'No flow':`${(state.sample[metric.key]*scale).toFixed(metric.key==='a'?2:1)} ${unit}${state.ended&&run.status==='OFF TRACK'?' / run end':state.ended&&run.status==='CORNER CLEAR'?' / exit':''}`;
        text(this.host.querySelector(`[data-value="${metric.key}-${i}"]`),value);
        const dot=this.host.querySelector(`[data-dot="${metric.key}-${i}"]`),domain=this.domains[metric.key];
        if(dot){dot.setAttribute('visibility',!this.visible[i]||inactive||(state.ended&&state.unsupported)?'hidden':'visible');dot.setAttribute('cx',l+Math.min(at,state.endTime??at)/this.duration*iw);dot.setAttribute('cy',28+(domain.hi-state.sample[metric.key]*scale)/(domain.hi-domain.lo)*(this.geometry.h-60));}
        if(i===focus)text(this.host.querySelector(`[data-selected="${metric.key}"]`),value);
      });
    }
  }
}
