// Presentation only; each scenario keeps its own finite physical trace.
export const TURN_COLORS=[
 {name:'No fan',hex:'#e1e8e5',plot:'#c8d8d2',dash:'2 4',rgb:[.84,.87,.85]},
 {name:'Fan assisted',hex:'#69d9b8',plot:'#69d9b8',dash:'',rgb:[.055,.46,.37]}
];
export const TURN_METRICS=[
 {key:'laneError',title:'Lane deviation',unit:'m',scale:1},
 {key:'a',title:'Lateral acceleration',unit:'g',scale:1/9.80665},
 {key:'utilization',title:'Requested grip / capacity',unit:'×',scale:1},
 {key:'normal',title:'Normal load',unit:'kN',scale:.001},
 {key:'capacity',title:'Lateral capacity',unit:'kN',scale:.001},
 {key:'energy',title:'Electrical work',unit:'kJ',scale:.001}
];
export function turnSample(run,time){
 const end=run.samples.at(-1),samples=run.samples,at=Math.min(time,end.t);let lo=0,hi=samples.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(samples[mid].t<=at)lo=mid;else hi=mid-1;}
 const a=samples[lo],b=samples[Math.min(lo+1,samples.length-1)],k=b.t>a.t?(at-a.t)/(b.t-a.t):0,sample={...a};
 for(const key of Object.keys(a))if(typeof a[key]==='number')sample[key]=a[key]+k*(b[key]-a[key]);
 const unsupported=!['CORNER CLEAR','OFF TRACK'].includes(run.status);
 return {sample,ended:time>=end.t-1e-8,unsupported,status:time>=end.t-1e-8?run.status:'ACTIVE',endTime:end.t};
}
export function turnPrediction(run){
 if(run.status==='CORNER CLEAR')return {title:'Corner cleared',tone:'intact',detail:`Whole body exits at T+${run.samples.at(-1).t.toFixed(2)} s.`};
 if(run.status==='OFF TRACK')return {title:'Runs off the lane',tone:'limited',detail:`Crosses the ${run.turn.laneExitSide.toLowerCase()} edge at T+${run.turn.laneExitAt.toFixed(2)} s and continues onto the grass.`};
 return {title:'Outcome unresolved',tone:'limited',detail:run.status==='SPEED HOLD LIMIT'?'Available power or drive grip cannot maintain the commanded speed.':run.status+' before a supported corner finish.'};
}
export function turnEvents(result){return [{t:0,label:'ENTRY'},...result.runs.flatMap((r,i)=>{const name=i?'FAN ':'NO FAN ';return [...(r.turn.laneExitAt===null?[]:[{t:r.turn.laneExitAt,label:name+'LEFT LANE'}]),{t:r.samples.at(-1).t,label:name+(r.status==='CORNER CLEAR'?'EXIT':r.status==='OFF TRACK'?'RUN END':'STOP')}];})].sort((a,b)=>a.t-b.t);}
export function turnRoadMesh(track){
 const p=[],n=[],count=track.centerline.length-1;
 const point=(r,a)=>[r*Math.sin(a),.005,r*Math.cos(a)-track.radius];
 for(let j=0;j<count;j++){
  const a=track.sweep*j/count,b=track.sweep*(j+1)/count,inner=track.radius-track.width/2,outer=track.radius+track.width/2;
  const points=[point(inner,a),point(outer,a),point(outer,b),point(inner,a),point(outer,b),point(inner,b)];
  for(const v of points){p.push(...v);n.push(0,1,0);}
 }
 return {p,n};
}
export class TurnMap{
 constructor(host,onScrub){
  this.host=host;this.onScrub=onScrub;this.time=0;this.revealed=true;
  this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(host);
  host.addEventListener('pointerdown',e=>{if(this.disabled||!this.result)return;const svg=host.querySelector('svg'),r=svg.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*this.w,py=(e.clientY-r.top)/r.height*this.h;let best=Infinity,time=0;
   for(const sample of this.result.runs[this.focus].samples){const [x,y]=this.point(sample.x,sample.z),d=(x-px)**2+(y-py)**2;if(d<best){best=d;time=sample.t;}}onScrub(time);e.preventDefault();});
  host.addEventListener('keydown',e=>{if(this.disabled)return;let time=this.time;if(e.key==='Home')time=0;else if(e.key==='End')time=this.result.duration;else if(['ArrowLeft','ArrowRight'].includes(e.key))time+=(e.key==='ArrowRight'?1:-1)*(e.shiftKey?.25:.05);else return;e.preventDefault();onScrub(Math.max(0,Math.min(this.result.duration,time)));});
 }
 dispose(){this.observer.disconnect();}
 setData(result){this.result=result;this.draw();}
 setDisabled(value){this.disabled=value;this.host.classList.toggle('pending-result',value);}
 setReveal(revealed){if(this.revealed===revealed)return;this.revealed=revealed;this.host.querySelectorAll('[data-turn-future]').forEach(p=>p.setAttribute('opacity',revealed?'.35':'0'));}
 draw(){
  if(!this.result)return;const focused=document.activeElement===this.host.querySelector('svg');const {track,runs}=this.result,points=[...track.centerline,...runs.flatMap(r=>r.samples)];
  const minX=Math.min(...points.map(p=>p.x))-track.width/2-3,maxX=Math.max(...points.map(p=>p.x))+track.width/2+3,minZ=Math.min(...points.map(p=>p.z))-track.width/2-3,maxZ=Math.max(...points.map(p=>p.z))+track.width/2+3;
  this.w=Math.max(280,this.host.clientWidth);this.h=320;const scale=Math.min((this.w-40)/(maxX-minX),(this.h-40)/(maxZ-minZ));
  this.point=(x,z)=>[(this.w-(maxX-minX)*scale)/2+(x-minX)*scale,(this.h-(maxZ-minZ)*scale)/2+(z-minZ)*scale];
  const path=this.path=samples=>samples.map((p,i)=>`${i?'L':'M'}${this.point(p.x,p.z).map(v=>v.toFixed(2)).join(',')}`).join('');
  this.host.innerHTML=`<svg viewBox="0 0 ${this.w} ${this.h}" role="slider" tabindex="0" aria-label="Turn trajectory, scrub simulation time" aria-valuemin="0" aria-valuemax="${this.result.duration}" aria-valuenow="${this.time}"><rect width="100%" height="100%" fill="#172e23"/><path d="${path(track.centerline)}" stroke="#27383c" stroke-width="${track.width*scale}" fill="none"/>${track.edges.map(w=>{const a=this.point(w.x-Math.cos(w.angle)*w.halfLength,w.z-Math.sin(w.angle)*w.halfLength),b=this.point(w.x+Math.cos(w.angle)*w.halfLength,w.z+Math.sin(w.angle)*w.halfLength);return `<path d="M${a.join(',')}L${b.join(',')}" stroke="#b0c1b5" stroke-width="2" fill="none"/>`;}).join('')}<path d="${path(track.centerline)}" stroke="#71868a" stroke-dasharray="4 7" fill="none"/>${runs.map((run,i)=>`<path data-turn-future="${i}" opacity="${this.revealed?'.35':'0'}" d="${path(run.samples.filter((_,j)=>j%6===0||j===run.samples.length-1))}" stroke="${TURN_COLORS[i].plot}" stroke-width="2" stroke-dasharray="${TURN_COLORS[i].dash}" fill="none"/><path data-turn-past="${i}" d="" stroke="${TURN_COLORS[i].plot}" stroke-width="2" stroke-dasharray="${TURN_COLORS[i].dash}" fill="none"/><circle data-turn-dot="${i}" r="5" fill="${TURN_COLORS[i].plot}" stroke="#102024" stroke-width="2"/>`).join('')}<text x="16" y="20" fill="#9eb0b5" font-size="10">TOP VIEW / METRES · SELECTED CAR SCRUB</text></svg>`;
  this.update(this.time,this.focus??1);if(focused)this.host.querySelector('svg').focus({preventScroll:true});
 }
 update(time,focus){this.time=time;this.focus=focus;if(!this.result||!this.point)return;
  this.host.querySelector('svg').setAttribute('aria-valuenow',time.toFixed(2));this.host.querySelector('svg').setAttribute('aria-valuetext',`${time.toFixed(2)} of ${this.result.duration.toFixed(2)} seconds`);
  this.result.runs.forEach((run,i)=>{const s=turnSample(run,time).sample,[x,y]=this.point(s.x,s.z),dot=this.host.querySelector(`[data-turn-dot="${i}"]`);dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r',i===focus?6:4);
   // Draw only the travelled part of each path; the remainder is a ghost after reveal.
   const past=this.host.querySelector(`[data-turn-past="${i}"]`);if(past)past.setAttribute('d',this.path([...run.samples.filter((p,j)=>p.t<time&&(j%6===0)),s]));});
 }
}
