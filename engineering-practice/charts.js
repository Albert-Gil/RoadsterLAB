const COLORS={blue:"#276494",orange:"#b15a25",grey:"#697a73",teal:"#006968"};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function evaluateSeries(s,x) {
  if(s.kind==="poly")return (s.coeff[0]||0)+(s.coeff[1]||0)*x+(s.coeff[2]||0)*x*x;
  if(s.kind==="power")return s.a*x**s.p;
  if(s.kind==="exp")return s.base+s.amp*Math.exp(-x/s.tau);
  if(s.kind==="ratio")return x/(s.hot-x);
  if(s.kind==="points"){
    const p=s.points;
    if(x<=p[0][0])return p[0][1];
    for(let i=1;i<p.length;i++)if(x<=p[i][0]){
      const [x0,y0]=p[i-1],[x1,y1]=p[i];
      return x1===x0?y1:y0+(y1-y0)*(x-x0)/(x1-x0);
    }
    return p.at(-1)[1];
  }
  throw new Error("Unknown curve type");
}
const number=v=>Math.abs(v)<1e-9?"0":Math.abs(v)>=100?String(Math.round(v)):String(Number(v.toFixed(2)));
function ticks(min,max){
  const raw=(max-min)/4,p=10**Math.floor(Math.log10(raw));
  const unit=[1,2,2.5,5,10].find(n=>n*p>=raw)||10,step=unit*p;
  const list=[];
  for(let v=Math.ceil(min/step)*step;v<=max+step*1e-6;v+=step)list.push([v,number(v)]);
  return list;
}
function arrow(x1,y1,x2,y2,color="#263f42"){
  const a=Math.atan2(y2-y1,x2-x1),l=6;
  const p1=[x2-l*Math.cos(a-.43),y2-l*Math.sin(a-.43)];
  const p2=[x2-l*Math.cos(a+.43),y2-l*Math.sin(a+.43)];
  return '<path d="M'+x1+' '+y1+' L'+x2+' '+y2+'" fill="none" stroke="'+color+'" stroke-width="1.7"/><path d="M'+x2+' '+y2+' L'+p1.join(" ")+' L'+p2.join(" ")+' Z" fill="'+color+'"/>';
}
export function renderPlot(g,revealed=false,id="plot"){
  const w=420,h=280,left=59,right=14,top=20,bottom=60;
  const xmin=g.xMin??0,xmax=g.xMax,ymin=g.yMin??0,ymax=g.yMax;
  const pw=w-left-right,ph=h-top-bottom;
  const X=x=>left+(x-xmin)/(xmax-xmin)*pw,Y=y=>h-bottom-(y-ymin)/(ymax-ymin)*ph;
  const clip="clip-"+id;
  let svg='<svg font-family="Arial, sans-serif" viewBox="0 0 420 280" role="img" aria-labelledby="title-'+id+' desc-'+id+'" xmlns="http://www.w3.org/2000/svg"><title id="title-'+id+'">'+esc(g.yLabel+" versus "+g.xLabel)+'</title><desc id="desc-'+id+'">'+esc("Curves: "+g.series.map(s=>s.label+(s.dash?" (dashed)":"")).join("; ")+". Axis limits: "+xmin+" to "+xmax+"; "+ymin+" to "+ymax+".")+'</desc><defs><clipPath id="'+clip+'"><rect x="'+left+'" y="'+top+'" width="'+pw+'" height="'+ph+'"/></clipPath></defs>';
  for(const [v,label] of ticks(ymin,ymax)){
    const y=Y(v);svg+='<path d="M'+left+' '+y+' H'+(w-right)+'" stroke="'+(v===0?"#bacbc0":"#e1e9e2")+'" stroke-width="1"/><text x="'+(left-9)+'" y="'+(y+4)+'" text-anchor="end" font-size="12.5" fill="#53676a">'+esc(label)+'</text>';
  }
  for(const [v,label] of (g.xTicks||ticks(xmin,xmax))){
    const x=X(v),anchor=x>w-right-5?"end":"middle";svg+='<path d="M'+x+' '+top+' V'+(h-bottom)+'" stroke="#e7ede7" stroke-width="1"/><text x="'+x+'" y="'+(h-bottom+21)+'" text-anchor="'+anchor+'" font-size="12.5" fill="#53676a">'+esc(label)+'</text>';
  }
  svg+='<path d="M'+left+' '+top+' V'+(h-bottom)+' H'+(w-right)+'" fill="none" stroke="#92a89c" stroke-width="1.2"/>';
  for(const s of g.series){
    const points=s.kind==="points"?s.points:Array.from({length:161},(_,i)=>{const x=xmin+(xmax-xmin)*i/160;return [x,evaluateSeries(s,x)];});
    let path="",open=false;
    for(const [x,y] of points){
      if(!Number.isFinite(x)||!Number.isFinite(y)){open=false;continue;}
      path+=(open?" L":"M")+X(x).toFixed(2)+" "+Y(y).toFixed(2);open=true;
    }
    svg+='<path d="'+path+'" clip-path="url(#'+clip+')" fill="none" stroke="'+(COLORS[s.color]||COLORS.blue)+'" stroke-width="2.6"'+(s.dash?' stroke-dasharray="7 5"':"")+'/>';
  }
  if(revealed)for(const p of (g.revealPoints||[])){
    const x=X(p.x),y=Y(p.y),anchor=x>w-100?"end":"start",dx=anchor==="end"?-8:8;
    svg+='<circle cx="'+x+'" cy="'+y+'" r="4.5" fill="#006968" stroke="white" stroke-width="1.5"/><text x="'+(x+dx)+'" y="'+(y-9)+'" text-anchor="'+anchor+'" font-size="12.5" font-weight="650" fill="#006968">'+esc(p.label)+'</text>';
  }
  svg+='<text x="'+(left+pw/2)+'" y="267" text-anchor="middle" font-size="13.5" fill="#334e53">'+esc(g.xLabel)+'</text><text x="16" y="'+(top+ph/2)+'" text-anchor="middle" transform="rotate(-90 16 '+(top+ph/2)+')" font-size="13.5" fill="#334e53">'+esc(g.yLabel)+'</text></svg>';
  return svg;
}
function beam(g,id){
  const x1=60,x2=360,y=105,loadx=x1+(x2-x1)*g.at;
  let s='<svg font-family="Arial, sans-serif" class="beam" viewBox="0 0 420 215" role="img" aria-labelledby="beam-'+id+'" xmlns="http://www.w3.org/2000/svg"><title id="beam-'+id+'">'+esc((g.support==="cantilever"?"Cantilever":"Simply supported beam")+" with "+g.label.toLowerCase())+'</title><path d="M60 105 H360" stroke="#254951" stroke-width="5"/>';
  if(g.support==="cantilever"){
    s+='<path d="M58 49 V155" stroke="#254951" stroke-width="3"/>';
    for(let a=50;a<155;a+=11)s+='<path d="M45 '+(a+10)+' L58 '+a+'" stroke="#607773" stroke-width="1"/>';
  }else{
    s+='<path d="M60 108 L48 129 H72 Z M360 108 L348 129 H372 Z" fill="#edf3ed" stroke="#607773" stroke-width="1.4"/>';
    s+=arrow(60,167,60,133,COLORS.teal)+arrow(360,167,360,133,COLORS.teal);
    s+='<text x="75" y="155" font-size="13" fill="#006968">RA</text><text x="330" y="155" font-size="13" fill="#006968">RB</text>';
  }
  if(g.uniform){
    s+='<path d="M60 43 H360" stroke="'+COLORS.orange+'" stroke-width="1.5"/>';
    for(let i=0;i<=8;i++)s+=arrow(x1+(x2-x1)*i/8,44,x1+(x2-x1)*i/8,99,COLORS.orange);
    s+='<text x="210" y="29" text-anchor="middle" font-size="14" fill="'+COLORS.orange+'">Uniform load w</text>';
  }else{
    s+=arrow(loadx,44,loadx,99,COLORS.orange);
    s+='<text x="'+(loadx===360?loadx-8:loadx+10)+'" y="44" text-anchor="'+(loadx===360?"end":"start")+'" font-size="14" fill="'+COLORS.orange+'">F</text>';
  }
  if(g.length)s+='<path d="M60 188 H360 M60 183 V193 M360 183 V193" stroke="#92a79c"/><text x="210" y="206" text-anchor="middle" font-size="13" fill="#52696a">L = '+g.length+' m</text>';
  else s+='<text x="210" y="192" text-anchor="middle" font-size="12" fill="#52696a">Schematic; not to scale</text>';
  return s+'</svg>';
}
function cycle(g,id){
  const xy=[[18,22],[240,22],[240,162],[18,162]],bw=162,bh=58;
  let s='<svg font-family="Arial, sans-serif" class="cycle" viewBox="0 0 420 250" role="img" aria-labelledby="cycle-'+id+'" xmlns="http://www.w3.org/2000/svg"><title id="cycle-'+id+'">'+esc("Cycle component sequence: "+g.labels.join(", "))+'</title>';
  for(let i=0;i<4;i++){
    const [x,y]=xy[i];
    s+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" rx="9" fill="#eef5ef" stroke="#98b5a5"/><text x="'+(x+bw/2)+'" y="'+(y+34)+'" text-anchor="middle" font-size="13.5" font-weight="600" fill="#224b50">'+esc(g.labels[i])+'</text>';
  }
  s+=arrow(183,51,235,51,COLORS.blue)+arrow(321,84,321,155,COLORS.blue)+arrow(237,191,185,191,COLORS.blue)+arrow(99,158,99,86,COLORS.blue);
  s+='<text x="210" y="127" text-anchor="middle" font-size="12" fill="#607772">Schematic sequence</text>';
  return s+'</svg>';
}
export function graphicHTML(q,revealed=false,suffix="normal"){
  const g=q.graph;if(!g)return "";
  const id=String(q.id)+"-"+suffix;
  if(g.type==="beam")return beam(g,id);
  if(g.type==="cycle")return cycle(g,id);
  return renderPlot(g,revealed,id);
}
export function legendHTML(g){
  if(g.type!=="plot")return "";
  return '<div class="legend">'+g.series.map(s=>'<span class="legend-item"><i class="legend-line'+(s.dash?" dashed":"")+'" style="border-color:'+(COLORS[s.color]||COLORS.blue)+'" aria-hidden="true"></i>'+esc(s.label)+(s.dash?' (dashed)':'')+'</span>').join("")+'</div>';
}
export function dataHTML(g){
  if(g.type!=="plot"||g.noData)return "";
  const xmin=g.xMin??0,xmax=g.xMax;
  const xs=g.xTicks?g.xTicks.map(t=>t[0]):Array.from({length:5},(_,i)=>xmin+(xmax-xmin)*i/4);
  return '<details class="chart-data"><summary>Read chart data</summary><table><thead><tr><th scope="col">'+esc(g.xLabel)+'</th>'+g.series.map(s=>'<th scope="col">'+esc(s.label)+'</th>').join("")+'</tr></thead><tbody>'+xs.map(x=>'<tr><th scope="row">'+esc(number(x))+'</th>'+g.series.map(s=>'<td>'+esc(number(evaluateSeries(s,x)))+'</td>').join("")+'</tr>').join("")+'</tbody></table></details>';
}
