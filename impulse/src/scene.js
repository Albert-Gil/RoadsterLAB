import {hopPosition,HOP_MOUNTS} from './hop.js';
import {invertPose} from './invert.js';
import {turnRoadMesh} from './turn.js';
import {sceneryMeshes,sceneryShader} from './scenery.js';
export const SCENARIO_COLORS = [
  {name:'Electric only',hex:'#e1e8e5',plot:'#c8d8d2',dash:'1 3.5',rgb:[.88,.91,.89]},
  {name:'Fan assisted',hex:'#69d9b8',plot:'#69d9b8',dash:'7 4',rgb:[.055,.61,.49]},
  {name:'Thrust assisted',hex:'#f3939b',plot:'#f3939b',dash:'',rgb:[.84,.085,.15]}
];
// Launch lanes: electric nearest the default camera, thrust farthest. Metres, scene +z.
export const LANE_WIDTH=3.4;
export const laneZ=m=>(1-m)*LANE_WIDTH;
const TURN_RGB=[[.88,.91,.89],[.055,.61,.49]];
export function launchPlacements(entries,frameX=0){return entries.filter(e=>e.visible!==false).map(e=>({...e,x:e.sample.x-frameX,z:laneZ(e.mode)}));}
const CAMERAS={
  'turn-field':{yaw:2.2,elev:.98,zoom:5.8,shot:{}},
  'turn-focus':{yaw:1.05,elev:.32,zoom:6.6,shot:{}},
  'invert-field':{yaw:1.35,elev:.12,zoom:6.6,shot:{}},
  'invert-track':{yaw:1.35,elev:.04,zoom:6.6,shot:{}},
  'hop-field':{yaw:1.18,elev:.2,zoom:6.6,shot:{}},
  'hop-under':{yaw:1.02,elev:-.42,zoom:6.6,shot:{}},
  'hop-track':{yaw:1.18,elev:.2,zoom:6.6,shot:{}},
  field:{yaw:.95,elev:.08,zoom:6.6,shot:{yaw:1.08,elev:.12,zoom:6.2}},
  cinema:{yaw:.95,elev:.08,zoom:6.6,shot:{}},
  side:{yaw:Math.PI/2,elev:.42,zoom:6.6,shot:{yaw:Math.PI/2,elev:.42,zoom:6.4}},
  focus:{yaw:.82,elev:.18,zoom:6.6,shot:{yaw:.72,elev:.16,zoom:6.1}}
};
// Native WebGL renderer. Original procedural Roadster built from designed character lines; procedural studio reflections and directional lighting.
const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function matrix(p=[0,0,0],s=[1,1,1],r=[0,0,0]){const [x,y,z]=r,c=Math.cos,d=Math.sin;const rx=[1,0,0,0,0,c(x),d(x),0,0,-d(x),c(x),0,0,0,0,1],ry=[c(y),0,-d(y),0,0,1,0,0,d(y),0,c(y),0,0,0,0,1],rz=[c(z),d(z),0,0,-d(z),c(z),0,0,0,0,1,0,0,0,0,1];let m=mul(mul(rz,ry),rx);for(let j=0;j<3;j++)for(let i=0;i<3;i++)m[j*4+i]*=s[j];m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;}
const sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);},dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
function view(eye,target){const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
function perspective(aspect,n=.1,far=4000,fov=.64){const f=Math.min(1,aspect/1.6)/Math.tan(fov/2);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0];}
function triangles(faces){const p=[],n=[];for(const f of faces){for(let i=1;i<f.length-1;i++){const a=f[0],b=f[i],c=f[i+1],v=norm(cross(sub(b,a),sub(c,a)));p.push(...a,...b,...c);n.push(...v,...v,...v);}}return {p,n};}
function box(){const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];return triangles([[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[1,2,6,5],[0,4,7,3]].map(f=>f.map(i=>v[i])));}
function cylinder(){const f=[],seg=48;for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2;const p=t=>[Math.cos(t),Math.sin(t)];const [x,y]=p(a),[u,v]=p(b);f.push([[x,y,-.5],[u,v,-.5],[u,v,.5],[x,y,.5]],[[0,0,.5],[x,y,.5],[u,v,.5]],[[0,0,-.5],[u,v,-.5],[x,y,-.5]]);}return triangles(f);}

// Crossed soft sheets form the narrow jet. The cloud bank is camera-facing
// procedural puffs; no textures, simulation history or frame-dependent particles.
function coldPlume(){const faces=[];for(let plane=0;plane<3;plane++)for(let i=0;i<18;i++){
 const a=plane*Math.PI/3,z=i/18,next=(i+1)/18,point=(side,t)=>{const r=.2+.8*t;return [Math.cos(a)*r*side,Math.sin(a)*r*side,t];};
 faces.push([point(-1,z),point(1,z),point(1,next),point(-1,next)]);
}return triangles(faces);}
function plumeCloud(count=48){const p=[],n=[];for(let i=0;i<count;i++){
 const angle=i*2.399963,r=Math.sqrt((i*.61803398875)%1)*.72,center=[Math.cos(angle)*r,Math.sin(angle)*r,(i+.5)/count],size=.18+((i*.75487766)%1)*.15;
 for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){p.push(...center);n.push(x,y,size);}
}return {p,n};}
export function coldGasVisual(s,vertical=false){
 const active=Number.isFinite(s.flow)&&Number.isFinite(s.thrust)&&s.flow>0&&s.thrust>0;
 if(!active)return {active:false,core:0,length:0,spread:0,opacity:0,ground:0};
 const level=Math.min(1,.65*Math.sqrt(s.flow/80)+.35*Math.sqrt(s.thrust/100000));
 const nominal=(vertical?3:4)+(vertical?7:9)*level,height=Math.max(.01,(s.y||0)+.01);
 return {active:true,core:Math.min(.7+2.4*level,vertical?height:Infinity),
  length:vertical?Math.min(nominal,height):nominal,spread:.4+level*(vertical?.75:1.3),
  opacity:.18+.17*level,ground:vertical?Math.max(0,1-height/nominal)*level:0};
}

// Deterministic Launch director. Shot weights depend only on simulation time, so pause, scrub,
// replay and recordings agree. Display only: camera motion never feeds back into physics.
export function directorShot(time,boostAt=0,reduced=false){
 const ease=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
 const t=Number.isFinite(time)?time:0,toSide=ease(.7,1.7,t),toWide=ease(3.2,4.6,t);
 const u=(t-boostAt)/.45,kick=reduced||!(u>=0&&u<1)?0:(1-u)*(1-u);
 return {rear:1-toSide,side:toSide*(1-toWide),wide:toSide*toWide,kick};
}
const prefersReducedMotion=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Procedural body. Scene axes: +x forward, +y up, +z right; metres. Proportions follow a fan STL of the
// new Roadster, details follow public photos; every line below is a design choice, not Tesla data.
// The right half is lofted between named character lines (smooth inside a panel, creased between
// panels), openings and graphics are clipped exactly in side or plan projection, then mirrored.
const CAR=(()=>{
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mixf=(a,b,t)=>a+(b-a)*t,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const lerp3=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],len=a=>Math.hypot(a[0],a[1],a[2]),neg=a=>[-a[0],-a[1],-a[2]],mz=p=>[p[0],p[1],-p[2]];
const sub2=(a,b)=>[a[0]-b[0],a[1]-b[1]],n2=a=>{const l=Math.hypot(a[0],a[1])||1;return [a[0]/l,a[1]/l];};
function pchip(keys){
  const k=keys.slice().sort((a,b)=>a[0]-b[0]),n=k.length,X=k.map(p=>p[0]),Y=k.map(p=>p[1]),d=[],m=Array(n).fill(0);
  for(let i=0;i<n-1;i++)d.push((Y[i+1]-Y[i])/(X[i+1]-X[i]));
  m[0]=d[0];m[n-1]=d[n-2];
  for(let i=1;i<n-1;i++)if(d[i-1]*d[i]>0){const h0=X[i]-X[i-1],h1=X[i+1]-X[i],w1=2*h1+h0,w2=h1+2*h0;m[i]=(w1+w2)/(w1/d[i-1]+w2/d[i]);}
  return x=>{if(x<=X[0])return Y[0];if(x>=X[n-1])return Y[n-1];let i=0;while(x>X[i+1])i++;const h=X[i+1]-X[i],t=(x-X[i])/h,t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*Y[i]+(t3-2*t2+t)*h*m[i]+(3*t2-2*t3)*Y[i+1]+(t3-t2)*h*m[i+1];};
}
const line3=keys=>{const fy=pchip(keys.map(k=>[k[0],k[1]])),fz=pchip(keys.map(k=>[k[0],k[2]]));return x=>[x,fy(x),fz(x)];};

const WHEELS=[{x:1.325,y:.345,z:.79,r:.34,w:.27,arch:.378,inner:.53},{x:-1.455,y:.35,z:.815,r:.35,w:.30,arch:.392,inner:.545}];
const MATS={
  paint:{c:[.86,.87,.858],metal:.36,rough:.18,spec:.9,ao:.5},
  blade:{c:[.14,.17,.19],metal:.65,rough:.26,spec:.65,ao:.3},
  glassD:{c:[.025,.043,.056],metal:.12,rough:.08,spec:1},
  glassS:{c:[.055,.075,.085],metal:.1,rough:.09,spec:1},
  black:{c:[.022,.023,.026],metal:.2,rough:.16,spec:.45},
  satin:{c:[.042,.044,.047],rough:.85},
  well:{c:[.028,.03,.032],rough:.95},
  chrome:{c:[.72,.74,.75],metal:.9,rough:.12,spec:.6},
  light:{c:[.95,.97,1],emit:2.2},
  red:{c:[.95,.10,.06],emit:2},
  amber:{c:[1,.55,.12],emit:1.1},
  plate:{c:[.93,.93,.9],emit:.22}
};
const WHEEL_MATS={tire:{c:[.035,.035,.038],rough:.85},lip:{c:[.28,.32,.35],metal:.8,rough:.18,spec:.75},barrel:{c:[.10,.13,.15],metal:.6,rough:.4},disc:{c:[.27,.29,.30],metal:.35,rough:.65},spokes:{c:[.07,.085,.10],metal:.65,rough:.22,spec:.7},hub:{c:[.04,.04,.045],metal:.4,rough:.25},emblem:{c:[.75,.76,.77],metal:.8,rough:.2}};

// Character lines: [x, y, z] keys; scalar lines are [x, value].
const X0=2.10,X1=-1.95;
const CL={
  sh:line3([[2.10,.545,.715],[2.00,.588,.775],[1.90,.628,.822],[1.78,.68,.866],[1.66,.728,.893],[1.54,.758,.908],[1.42,.778,.918],[1.30,.792,.928],[1.10,.802,.940],[.90,.798,.946],[.60,.786,.946],[.30,.778,.944],[0,.778,.944],[-.30,.788,.952],[-.60,.810,.964],[-.90,.842,.977],[-1.10,.864,.986],[-1.30,.876,.993],[-1.50,.880,.994],[-1.70,.878,.984],[-1.85,.873,.962],[-1.95,.868,.932]]),
  belt:line3([[2.10,.590,.602],[2.00,.633,.598],[1.80,.712,.586],[1.66,.751,.574],[1.56,.776,.562],[1.48,.790,.628],[1.40,.802,.698],[1.32,.812,.750],[1.24,.820,.784],[1.12,.829,.800],[.90,.822,.806],[.53,.808,.815],[.20,.836,.830],[0,.862,.836],[-.30,.895,.834],[-.60,.928,.825],[-.90,.958,.810],[-1.10,.962,.796],[-1.30,.950,.778],[-1.50,.935,.735],[-1.70,.912,.668],[-1.85,.897,.600],[-1.95,.887,.552]]),
  rail:line3([[2.10,.596,.40],[2.00,.640,.40],[1.80,.716,.40],[1.66,.752,.40],[1.56,.777,.42],[1.40,.810,.52],[1.24,.848,.62],[1.10,.888,.68],[1.00,.912,.70],[.76,.988,.712],[.50,1.058,.690],[.24,1.110,.660],[0,1.132,.640],[-.30,1.132,.638],[-.60,1.114,.634],[-.90,1.085,.625],[-1.10,1.064,.600],[-1.30,1.038,.560],[-1.50,1.008,.500],[-1.70,.968,.440],[-1.85,.938,.400],[-1.95,.918,.370]]),
  yc:pchip([[2.10,.603],[2.00,.646],[1.90,.690],[1.80,.720],[1.66,.753],[1.56,.778],[1.48,.802],[1.40,.832],[1.30,.868],[1.20,.900],[1.10,.933],[1.00,.966],[.90,.998],[.80,1.027],[.70,1.058],[.60,1.086],[.50,1.112],[.40,1.136],[.30,1.154],[.20,1.166],[.10,1.172],[0,1.172],[-.20,1.163],[-.40,1.144],[-.60,1.124],[-.80,1.104],[-1.00,1.090],[-1.20,1.072],[-1.40,1.044],[-1.60,1.004],[-1.80,.958],[-1.95,.928]]),
  ysk:pchip([[2.10,.290],[1.80,.285],[1.40,.272],[1.00,.256],[.60,.262],[.20,.276],[-.20,.296],[-.60,.330],[-1.00,.372],[-1.30,.405],[-1.60,.425],[-1.95,.430]]),
  W:pchip([[2.10,.700],[2.00,.764],[1.90,.814],[1.80,.853],[1.70,.882],[1.50,.912],[1.30,.928],[1.10,.940],[.90,.947],[.60,.946],[.30,.942],[0,.942],[-.30,.950],[-.60,.962],[-.90,.977],[-1.10,.988],[-1.30,.996],[-1.50,.998],[-1.70,.992],[-1.85,.972],[-1.95,.944]]),
  yfl:pchip([[2.10,.172],[1.90,.150],[1.70,.126],[1.50,.112],[1.20,.106],[0,.105],[-1.00,.108],[-1.20,.115],[-1.40,.135],[-1.60,.165],[-1.80,.196],[-1.95,.215]]),
  blade:pchip([[2.10,.022],[1.0,.024],[-1.0,.024],[-1.6,.018],[-1.80,.006],[-1.95,0]])
};
// Section loop, bottom centre to roof centre: [name, material, subdivisions].
const SEGS=[['floor','satin',6],['bladeU','satin',1],['bladeE','blade',1],['bladeT','blade',1],['skirt','black',2],['ledge','black',1],['side','paint',6],['deck','paint',3],['green','paint',5],['frame','paint',1],['crown','paint',7]];
const BULGE=[0,0,0,0,0,0,.008,.003,.010,0,0];
const archBlend=x=>Math.max(...WHEELS.map(w=>1-smooth(w.arch-.02,w.arch+.10,Math.abs(x-w.x))));
function named(x){
  const sh=CL.sh(x),be=CL.belt(x),ra=CL.rail(x),yc=CL.yc(x),ysk=CL.ysk(x),W=CL.W(x),yfl=CL.yfl(x),bl=CL.blade(x);
  const fr=[x,ra[1]+mixf(.011,(yc-ra[1])*.034/ra[2],smooth(1.2,1.5,x)),ra[2]-.034];
  return [[x,yfl,0],[x,yfl,mixf(W-.10,.50,archBlend(x))],[x,yfl+.010,W+bl],[x,yfl+.034,W+bl],[x,yfl+.040,W-.028],[x,ysk-.003,W-.024],[x,ysk,W+.002],sh,be,ra,fr,[x,yc,0]];
}
function segPts(s,a,b){
  const n=SEGS[s][2],out=[];
  for(let k=0;k<=n;k++){const t=k/n;let p;
    if(s===10){const u=1-t;p=[a[0],b[1]+(a[1]-b[1])*u*u,a[2]*u];}
    else{p=lerp3(a,b,t);const bu=BULGE[s]*Math.sin(Math.PI*t);if(bu){const dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dy,dz)||1;p[1]-=dz/l*bu;p[2]+=dy/l*bu;}}
    out.push(p);}
  return out;
}
const section=x=>{const v=named(x);return SEGS.map((_,s)=>segPts(s,v[s],v[s+1]));};

// Nose: blade leading edge LE(z); cheek front edge NQ->NK; lower corner and chin targets NT.
const LE=z=>{const u=Math.min(1,Math.abs(z)/.602);return [2.360-.098*Math.pow(u,2.2),.468+.021*u*u,z];};
const NK=LE(.602),NQ=[NK[0],.290,.612],NT=[[2.200,.180,0],[2.200,.180,.560],[2.200,.188,.655],[2.200,.212,.655],[2.215,.214,.630],[2.250,.287,.598]];
function noseTargets(segs){return segs.map((pts,s)=>pts.map((p,k)=>{const t=k/(pts.length-1);if(s>=8)return LE(p[2]);if(s===7)return NK;if(s===6)return lerp3(NQ,NK,t);return lerp3(NT[s],s===5?NQ:NT[s+1],t);}));}
// Tail: deck edge RE(z), rear face RF(y,z), corner edge RC->RCb.
const RE=z=>{const u=Math.min(1,Math.abs(z)/.86);return [-2.140+.115*Math.pow(u,2.6),.884-.008*u*u,z];};
const RF=(y,z)=>{const u=Math.min(1,Math.abs(z)/.86);return [-2.140-.030*(.884-y)/.469+.115*Math.pow(u,2.6),y,z];};
const RC=RE(.86),RCb=[RF(.415,.845)[0],.415,.845],RCp=RF(.415,.83),RD1=RF(.415,.78);
function rearTargets(segs){
  const L=[null,RD1,RCp,RCp,RCp,RCb,RCb];
  return segs.map((pts,s)=>pts.map((p,k)=>{const t=k/(pts.length-1);
    if(s>=8)return RE(p[2]);if(s===7)return p[2]>=.86?RC:RE(p[2]);if(s===6)return lerp3(RCb,RC,t);if(s===0)return RF(.415,.78*t);return lerp3(L[s],L[s+1],t);}));
}

function tri(out,p,n,m,s){const f=cross(sub(p[1],p[0]),sub(p[2],p[0]));if(len(f)<1e-11)return;if(dot(f,[n[0][0]+n[1][0]+n[2][0],n[0][1]+n[1][1]+n[2][1],n[0][2]+n[1][2]+n[2][2]])<0){p=[p[0],p[2],p[1]];n=[n[0],n[2],n[1]];}out.push({p,n,m,s});}
function poly(pts,m,ref,out,tag='x'){for(let i=1;i<pts.length-1;i++){const p=[pts[0],pts[i],pts[i+1]];let n=norm(cross(sub(p[1],p[0]),sub(p[2],p[0])));if(dot(n,ref)<0)n=neg(n);tri(out,p,[n,n,n],m,tag);}}
// Smooth normals over a station x point grid, oriented by ref(p, dk, dj).
function grid(G,mat,tag,ref,out,matFn){
  const J=G.length,K=G[0].length,N=[];
  for(let j=0;j<J;j++){N.push([]);for(let k=0;k<K;k++){
    let dj=null,dk=null;
    for(let s=1;s<J&&!dj;s++){const d=sub(G[Math.min(J-1,j+s)][k],G[Math.max(0,j-s)][k]);if(len(d)>1e-7)dj=d;}
    for(let s=1;s<K&&!dk;s++){const d=sub(G[j][Math.min(K-1,k+s)],G[j][Math.max(0,k-s)]);if(len(d)>1e-7)dk=d;}
    let n=null;if(dj&&dk){const c=cross(dk,dj);if(len(c)>1e-12){n=norm(c);if(dot(n,ref(G[j][k],dk,dj))<0)n=neg(n);}}
    N[j].push(n);}}
  for(let j=0;j<J;j++)for(let k=0;k<K;k++)if(!N[j][k]){for(let s=1;s<J&&!N[j][k];s++)N[j][k]=N[j-s]?.[k]||N[j+s]?.[k]||null;if(!N[j][k])N[j][k]=[0,1,0];}
  for(let j=0;j<J-1;j++)for(let k=0;k<K-1;k++){const m=matFn?matFn(j,k):mat,a=G[j][k],b=G[j][k+1],c=G[j+1][k+1],d=G[j+1][k];
    tri(out,[a,b,c],[N[j][k],N[j][k+1],N[j+1][k+1]],m,tag);tri(out,[a,c,d],[N[j][k],N[j+1][k+1],N[j+1][k]],m,tag);}
}

// Exact convex-region clipping in a projection; in/out: material, null removes, undefined keeps.
const PROJ={side:p=>[p[0],p[1]],plan:p=>[p[0],p[2]]};
function ccw(pg){let a=0;for(let i=0;i<pg.length;i++){const p=pg[i],q=pg[(i+1)%pg.length];a+=p[0]*q[1]-q[0]*p[1];}return a<0?pg.slice().reverse():pg;}
function clipHalf(vs,A,B,sg){const out=[],S=w=>sg*((B[0]-A[0])*(w.q[1]-A[1])-(B[1]-A[1])*(w.q[0]-A[0]));
  for(let i=0;i<vs.length;i++){const a=vs[i],b=vs[(i+1)%vs.length],sa=S(a),sb=S(b);if(sa>=0)out.push(a);if((sa>=0)!==(sb>=0)){const t=sa/(sa-sb);out.push({q:[a.q[0]+(b.q[0]-a.q[0])*t,a.q[1]+(b.q[1]-a.q[1])*t],p:lerp3(a.p,b.p,t),n:norm(lerp3(a.n,b.n,t))});}}
  return out.length>=3?out:null;}
function applyRule(tris,R){
  const proj=PROJ[R.proj],pg=ccw(R.poly),out=[],xs=pg.map(p=>p[0]),ys=pg.map(p=>p[1]),bx=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];
  const inside=c=>pg.every((A,i)=>{const B=pg[(i+1)%pg.length];return (B[0]-A[0])*(c[1]-A[1])-(B[1]-A[1])*(c[0]-A[0])>=0;});
  const keep=(t,mat)=>{if(mat===null)return;out.push(mat===undefined?t:{...t,m:mat});};
  for(const t of tris){
    if(!R.seg.has(t.s)||(R.when&&!R.when(t.m))){out.push(t);continue;}
    const q=t.p.map(proj);
    if(Math.max(q[0][0],q[1][0],q[2][0])<bx[0]||Math.min(q[0][0],q[1][0],q[2][0])>bx[1]||Math.max(q[0][1],q[1][1],q[2][1])<bx[2]||Math.min(q[0][1],q[1][1],q[2][1])>bx[3]){keep(t,R.out);continue;}
    const area=(q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[1][1]-q[0][1])*(q[2][0]-q[0][0]);
    if(Math.abs(area)<1e-9){keep(t,inside([(q[0][0]+q[1][0]+q[2][0])/3,(q[0][1]+q[1][1]+q[2][1])/3])?R.in:R.out);continue;}
    let rem=t.p.map((p,i)=>({q:q[i],p,n:t.n[i]}));const outs=[];
    for(let i=0;i<pg.length&&rem;i++){const A=pg[i],B=pg[(i+1)%pg.length],o=clipHalf(rem,A,B,-1);if(o)outs.push(o);rem=clipHalf(rem,A,B,1);}
    const emit=(vs,mat)=>{const m=mat===undefined?t.m:mat;if(m===null)return;for(let i=1;i<vs.length-1;i++){const p=[vs[0].p,vs[i].p,vs[i+1].p];if(len(cross(sub(p[1],p[0]),sub(p[2],p[0])))<1e-12)continue;out.push({p,n:[vs[0].n,vs[i].n,vs[i+1].n],m,s:t.s});}};
    if(rem)emit(rem,R.in);for(const o of outs)emit(o,R.out);
  }
  return out;
}
const band=(A,B,w,ext=.02)=>{const d=n2(sub2(B,A)),n=[-d[1]*w,d[0]*w],a=[A[0]-d[0]*ext,A[1]-d[1]*ext],b=[B[0]+d[0]*ext,B[1]+d[1]*ext];return [[a[0]-n[0],a[1]-n[1]],[b[0]-n[0],b[1]-n[1]],[b[0]+n[0],b[1]+n[1]],[a[0]+n[0],a[1]+n[1]]];};
const halfPlane=(A,B)=>{const d=n2(sub2(B,A)),F=20,n=[-d[1]*F,d[0]*F],a=[A[0]-d[0]*F,A[1]-d[1]*F],b=[B[0]+d[0]*F,B[1]+d[1]*F];return [a,b,[b[0]+n[0],b[1]+n[1]],[a[0]+n[0],a[1]+n[1]]];};
const archPoly=w=>{const p=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI;p.push([w.x+w.arch*Math.cos(a),w.y+w.arch*Math.sin(a)]);}p.push([w.x-w.arch,-1],[w.x+w.arch,-1]);return p;};
const xCowl=z=>1.66-.10*(z/.56)**2,xVent=z=>1.745-.06*(z/.44)**2;
const COWL=[...Array.from({length:13},(_,i)=>{const z=-.56+1.12*i/12;return [xCowl(z),z];}),[1,2],[-5,2],[-5,-2],[1,-2]];
const WEDGE=[[-1.55,-.28],[-1.55,.28],[-1.55+1.944*2.72,3],[6,3],[6,-3],[-1.55+1.944*2.72,-3]];
const VENT=Array.from({length:12},(_,i)=>{const a=-.44+.88*i/12,b=-.44+.88*(i+1)/12;return [[xVent(a),a],[xVent(a)+.07,a],[xVent(b)+.07,b],[xVent(b),b]];});
const S=(...a)=>new Set(a),is=(...m)=>x=>m.includes(x);
const APIL=[[1.13,.826],[.235,1.116]],SEAL=[[.195,1.126],[.53,.805]],CPIL=[[-.98,1.075],[-.895,.955]];
const RULES=[
  ...WHEELS.map(w=>({seg:S(1,2,3,4,5,6),proj:'side',poly:archPoly(w),in:null})),
  {seg:S(8,9,10),proj:'plan',poly:COWL,when:is('paint'),in:'cand'},
  {seg:S(9,10),proj:'plan',poly:WEDGE,when:is('cand'),out:'paint'},
  {seg:S(9),proj:'plan',poly:[[.24,-3],[.24,3],[-5,3],[-5,-3]],when:is('cand'),in:'paint'},
  {seg:S(9,10),proj:'plan',poly:[[-9,-9],[9,-9],[9,9],[-9,9]],when:is('cand'),in:'glassD'},
  {seg:S(8),proj:'side',poly:halfPlane(...CPIL),when:is('cand'),out:'paint'},
  {seg:S(8),proj:'side',poly:halfPlane(...SEAL),when:is('cand'),in:'glassD',out:'glassS'},
  {seg:S(8),proj:'side',poly:band(...APIL,.018,.03),when:is('glassD'),in:'paint'},
  {seg:S(8),proj:'side',poly:[[-.49,1.16],[-.437,.86],[-.313,.86],[-.40,1.16]],when:is('glassS'),in:'black'},
  {seg:S(8),proj:'side',poly:band(...SEAL,.006,.03),when:is('glassS','glassD'),in:'black'},
  ...VENT.map(poly=>({seg:S(8,9,10),proj:'plan',poly,when:is('paint'),in:'black'})),
  {seg:S(8,9,10),proj:'plan',poly:[[1.980,-.62],[1.990,-.62],[1.990,.62],[1.980,.62]],when:is('paint'),in:'satin'},
  {seg:S(8,9,10),proj:'plan',poly:[[-1.61,-.50],[-1.61,.50],[-2.3,.64],[-2.3,-.64]],when:is('paint'),in:'black'},
  ...[0,1,2,3,4,5].map(i=>({seg:S(8,9,10),proj:'plan',poly:[[-1.66-i*.075,-.7],[-1.66-i*.075,.7],[-1.685-i*.075,.7],[-1.685-i*.075,-.7]],when:is('black'),in:'satin'})),
  {seg:S(6),proj:'side',poly:band([.660,.262],[.762,.735],.004,.01),when:is('paint'),in:'black'},
  {seg:S(6,7),proj:'side',poly:band([-.405,.300],[-.468,.880],.004,.01),when:is('paint'),in:'black'},
  {seg:S(6),proj:'side',poly:[[.76,.735],[1.045,.727],[1.045,.772],[.77,.784]],when:is('paint'),in:'black'},
  {seg:S(6),proj:'side',poly:[[.978,.733],[1.038,.731],[1.038,.762],[.978,.765]],when:is('black'),in:'amber'},
  {seg:S(6),proj:'side',poly:[[1.78,.25],[2.30,.25],[2.30,.405],[2.02,.37]],when:is('paint'),in:'black'},
  {seg:S(6,7),proj:'side',poly:[[-2.6,.828],[-1.99,.828],[-1.99,.848],[-2.6,.848]],in:'red'},
  {seg:S(6,7),proj:'side',poly:[[-2.6,.848],[-1.99,.848],[-1.99,.885],[-2.6,.885]],when:is('paint'),in:'black'}
];

function bodyZ(x,y){const sg=section(x);let best=-1;for(let s=1;s<=6;s++){const P=sg[s];for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1];if(a[1]!==b[1]&&(a[1]-y)*(b[1]-y)<=0)best=Math.max(best,a[2]+(b[2]-a[2])*(y-a[1])/(b[1]-a[1]));}}return best>0?best:CL.W(x);}
function well(w,out){
  const R=w.arch,yb=x=>CL.yfl(x)+.004,pts=[[w.x+R,yb(w.x+R)]];
  for(let i=0;i<=36;i++){const a=i/36*Math.PI;pts.push([w.x+R*Math.cos(a),w.y+R*Math.sin(a)]);}
  pts.push([w.x-R,yb(w.x-R)]);
  const outer=pts.map(([x,y])=>[x,y,bodyZ(x,y)+.005]),inner=pts.map(([x,y])=>[x,y,w.inner]);
  grid([outer,inner],'well','well',p=>[w.x-p[0],w.y-p[1],0],out);
  const c=[w.x,(yb(w.x)+w.y+R)/2,w.inner];
  for(let i=0;i<inner.length;i++)poly([c,inner[i],inner[(i+1)%inner.length]],'well',[0,0,1],out,'well');
}
function fascia(ft,out){
  const zs=[...new Set(ft.slice(8).flat().map(p=>Math.round(p[2]*1e5)/1e5))].sort((a,b)=>a-b);
  const xfb=z=>LE(z)[0]-.072*(1-Math.min(1,z/.602)**2);
  const row=yo=>{const yEnd=yo<0?NK[1]+yo:yo,end=lerp3(NK,NQ,(NK[1]-yEnd)/(NK[1]-NQ[1])),sc=end[2]/.602;
    return zs.map((z,i)=>{if(i===zs.length-1)return end;const zz=z*sc,le=LE(zz),y=yo<0?le[1]+yo:yo,f=(le[1]-y)/(le[1]-NQ[1]);return [le[0]+(xfb(zz)-le[0])*f,y,zz];});};
  const r3=row(NQ[1]);
  grid([zs.map(LE),row(-.026),row(-.040),r3],null,'fascia',()=>[1,.25,0],out,j=>['paint','light','black'][j]);
  const s4=.585/.602,r4=zs.map(z=>[xfb(z*s4)-.065,.292,z*s4]),r5=r4.map(p=>[p[0],.214,p[2]]);
  grid([r3,r4],'satin','fascia',()=>[0,-1,0],out);
  grid([r4,r5],'satin','fascia',()=>[1,0,0],out);
  poly([r4[r4.length-1],NQ,NT[5],NT[4],r5[r5.length-1]],'satin',[0,0,1],out);
}
function chin(out){
  const F=[],at=(pts,y)=>pts.map(p=>[p[0],y,p[2]]);
  for(let i=0;i<=12;i++){const z=.655*i/12;F.push([2.352-.152*Math.pow(z/.655,2.2),0,z]);}
  const back=F.map(p=>[2.14,0,p[2]]);
  grid([at(F,.212),at(back,.212)],'blade','chin',()=>[0,1,0],out);
  grid([at(F,.188),at(back,.188)],'blade','chin',()=>[0,-1,0],out);
  grid([at(F,.212),at(F,.188)],'blade','chin',p=>[1,0,p[2]*.6],out);
}
function rearCap(rt,out){
  const zs=[...new Set([...rt[7],...rt[8],...rt[9],...rt[10]].map(p=>Math.round(p[2]*1e5)/1e5))].filter(z=>z<=.86).sort((a,b)=>a-b);
  if(zs[zs.length-1]<.86)zs.push(.86);
  const row=y=>{const end=lerp3(RC,RCb,(RC[1]-y)/(RC[1]-RCb[1])),sc=end[2]/.86;return zs.map((z,i)=>i===zs.length-1?end:RF(y,z*sc));};
  grid([zs.map(RE),row(.848),row(.828),row(.600),row(.415)],null,'rear',()=>[-1,0,0],out,j=>['black','red','paint','black'][j]);
}
function prism(pg,z0,z1,m,out){const c=ccw(pg);poly(c.map(p=>[p[0],p[1],z1]),m,[0,0,1],out);poly(c.map(p=>[p[0],p[1],z0]),m,[0,0,-1],out);
  for(let i=0;i<c.length;i++){const a=c[i],b=c[(i+1)%c.length],e=n2([b[1]-a[1],a[0]-b[0]]);poly([[a[0],a[1],z0],[b[0],b[1],z0],[b[0],b[1],z1],[a[0],a[1],z1]],m,[e[0],e[1],0],out);}}
function boxAA([x0,y0,z0],[x1,y1,z1],m,out){for(const [f,r] of [[[[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],[1,0,0]],[[[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]],[-1,0,0]],[[[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]],[0,1,0]],[[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],[0,-1,0]],[[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],[0,0,1]]])poly(f,m,r,out);}
function sweep(path,zc,hw,hz,m,out){
  const N=path.length,T=path.map((p,i)=>n2(sub2(path[Math.min(N-1,i+1)],path[Math.max(0,i-1)]))),O=T.map(t=>[-t[1],t[0]]);
  const C=(i,s,zs)=>[path[i][0]+O[i][0]*hw*s,path[i][1]+O[i][1]*hw*s,zc+hz*zs];
  for(let i=0;i<N-1;i++)for(const [a,b,r] of [[[1,-1],[1,1],[O[i][0],O[i][1],0]],[[-1,1],[-1,-1],[-O[i][0],-O[i][1],0]],[[1,1],[-1,1],[0,0,1]],[[-1,-1],[1,-1],[0,0,-1]]])
    poly([C(i,a[0],a[1]),C(i,b[0],b[1]),C(i+1,b[0],b[1]),C(i+1,a[0],a[1])],m,r,out);
}
function wing(out){
  const a=.30,d=[-Math.cos(a),Math.sin(a)],u=[Math.sin(a),Math.cos(a)],L0=[-1.99,1.005];
  const P=([c,h])=>[L0[0]+c*d[0]+h*u[0],L0[1]+c*d[1]+h*u[1]],cen=P([.16,.006]);
  const prof=[[0,0],[.012,.011],[.05,.019],[.14,.022],[.26,.016],[.38,.004],[.38,-.002],[.26,-.004],[.14,-.004],[.05,-.006],[.012,-.006],[0,0]];
  grid(prof.map(q=>{const [x,y]=P(q);return [[x,y,0],[x,y,.955]];}),'paint','wing',p=>[p[0]-cen[0],p[1]-cen[1],0],out);
  prism([[-1.975,1.03],[-2.40,1.16],[-2.395,.975],[-2.12,.972]],.955,.969,'paint',out);
  sweep([[-1.90,.89],[-1.95,.955],[-2.02,1.005],[-2.10,1.035],[-2.16,1.045]],.40,.017,.008,'black',out);
}
function nozzle(y0,z0,out){
  const xf=RF(y0,z0)[0]+.004,seg=28,C=(r,a)=>Array.from({length:seg+1},(_,i)=>{const t=i/seg*Math.PI*2;return [xf-a,y0+r*Math.cos(t),z0+r*Math.sin(t)];});
  const radial=s=>p=>[0,(p[1]-y0)*s,(p[2]-z0)*s];
  grid([C(.047,-.01),C(.047,.026)],'chrome','noz',radial(1),out);
  grid([C(.047,.026),C(.034,.026)],'chrome','noz',()=>[-1,0,0],out);
  grid([C(.034,.026),C(.034,-.012)],'black','noz',radial(-1),out);
  grid([C(.034,-.012),C(.0005,-.012)],'black','noz',()=>[-1,0,0],out);
}
function bucket(tris){const o={};for(const t of tris){const b=o[t.m]||(o[t.m]={p:[],n:[]});for(let i=0;i<3;i++){b.p.push(...t.p[i]);b.n.push(...t.n[i]);}}return o;}
// Wheel in local axes: axle along +z (outboard), hub at the origin.
function wheelParts(w){
  const spin=[],fixed=[],H=w.w/2,seg=56,ring=(r,z)=>Array.from({length:seg+1},(_,i)=>{const a=i/seg*Math.PI*2;return [r*Math.cos(a),r*Math.sin(a),z];});
  const rr=r=>.262+(r-.262)*(w.r-.262)/(.343-.262),rc=rr(.30);
  const tire=[[.262,-.86],[.292,-.975],[.318,-.99],[.334,-.92],[.340,-.74],[.342,-.37],[.343,0],[.342,.37],[.340,.74],[.334,.92],[.318,.99],[.292,.975],[.262,.86]];
  grid(tire.map(([r,z])=>ring(rr(r),z*H)),'tire','w',p=>{const r=Math.hypot(p[0],p[1]);return [p[0]/r*(r-rc),p[1]/r*(r-rc),p[2]];},spin);
  grid([[.246,.80],[.254,.90],[.264,.935],[.271,.88],[.266,.80]].map(([r,z])=>ring(r,z*H)),'lip','w',p=>{const r=Math.hypot(p[0],p[1]);return [p[0]/r*(r-.258),p[1]/r*(r-.258),p[2]-.86*H];},spin);
  grid([ring(.248,.80*H),ring(.248,-.80*H)],'barrel','w',p=>[-p[0],-p[1],0],spin);
  grid([ring(.248,.22*H),ring(.06,.22*H)],'disc','w',()=>[0,0,1],spin);
  for(let s=0;s<6;s++){
    const path=[];for(let i=0;i<=8;i++){const t=i/8,r=mixf(.058,.250,t),th=s*Math.PI/3;path.push({c:[r*Math.cos(th),r*Math.sin(th)],tn:[-Math.sin(th),Math.cos(th)],zf:mixf(.93,.80,t)*H,hw:mixf(.016,.0065,t)});}
    const P=(i,e,deep)=>{const q=path[i];return [q.c[0]+q.tn[0]*q.hw*e,q.c[1]+q.tn[1]*q.hw*e,q.zf-(deep?.03:0)];};
    for(let i=0;i<8;i++){const tn=path[i].tn;
      poly([P(i,-1,0),P(i,1,0),P(i+1,1,0),P(i+1,-1,0)],'spokes',[0,0,1],spin);
      poly([P(i,1,0),P(i,1,1),P(i+1,1,1),P(i+1,1,0)],'spokes',[tn[0],tn[1],0],spin);
      poly([P(i,-1,1),P(i,-1,0),P(i+1,-1,0),P(i+1,-1,1)],'spokes',[-tn[0],-tn[1],0],spin);}
  }
  grid([ring(.062,.70*H),ring(.062,.94*H)],'hub','w',p=>[p[0],p[1],0],spin);
  grid([ring(.062,.94*H),ring(.001,.94*H)],'hub','w',()=>[0,0,1],spin);
  grid([ring(.024,.945*H),ring(.001,.945*H)],'emblem','w',()=>[0,0,1],spin);
  return {spin:bucket(spin),fixed:bucket(fixed)};
}
function build(){
  const N=Math.round((X0-X1)/.025),main=[];
  for(let i=0;i<=N;i++)main.push(section(X0-(X0-X1)*i/N));
  const f0=main[0],r0=main[N],ft=noseTargets(f0),rt=rearTargets(r0);
  const mod=(base,tg,t)=>base.map((pts,s)=>pts.map((p,k)=>lerp3(p,tg[s][k],t)));
  const st=[...[1,.86,.7,.52,.34,.17].map(t=>mod(f0,ft,t)),...main,...[.17,.34,.52,.7,.86,1].map(t=>mod(r0,rt,t))];
  let H=[];
  SEGS.forEach((sg,s)=>grid(st.map(sec=>sec[s]),sg[1],s,(p,dk)=>[0,-dk[2],dk[1]],H));
  for(const r of RULES)H=applyRule(H,r);
  WHEELS.forEach(w=>well(w,H));
  fascia(ft,H);chin(H);rearCap(rt,H);wing(H);
  for(const [z0,z1] of [[0,.006],[.244,.256],[.494,.506]])prism([[-1.96,.205],[-2.165,.32],[-2.165,.412],[-1.96,.222]],z0,z1,'black',H);
  boxAA([-2.157,.640,0],[-2.146,.770,.162],'black',H);boxAA([-2.161,.650,0],[-2.148,.760,.15],'plate',H);
  for(const z of [.17,.47])nozzle(.548,z,H);
  const all=[];for(const t of H){all.push(t);all.push({p:[mz(t.p[0]),mz(t.p[2]),mz(t.p[1])],n:[mz(t.n[0]),mz(t.n[2]),mz(t.n[1])],m:t.m});}
  return {body:bucket(all),wheels:WHEELS.map(wheelParts)};
}
return {build,WHEELS,MATS,WHEEL_MATS};
})();
function transformMesh(d,m){const p=[],n=[];for(let i=0;i<d.p.length;i+=3){const [x,y,z]=[d.p[i],d.p[i+1],d.p[i+2]],[a,b,c]=[d.n[i],d.n[i+1],d.n[i+2]];p.push(m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]);n.push(...norm([m[0]*a+m[4]*b+m[8]*c,m[1]*a+m[5]*b+m[9]*c,m[2]*a+m[6]*b+m[10]*c]));}return {p,n};}
// Static car geometry in scene coordinates, for offline reference renders.
export function carParts(){
  const g=CAR.build(),out=[];
  for(const [m,d] of Object.entries(g.body))out.push({...d,color:CAR.MATS[m].c,emit:CAR.MATS[m].emit||0});
  CAR.WHEELS.forEach((w,i)=>{for(const side of [1,-1]){const M=matrix([w.x,w.y,w.z*side],[1,1,side]);for(const part of ['spin','fixed'])for(const [m,d] of Object.entries(g.wheels[i][part]))out.push({...transformMesh(d,M),color:CAR.WHEEL_MATS[m].c,emit:0});}});
  return out;
}
const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uMVP;uniform mat4 uModel;uniform vec3 uEye;uniform float uPlume;uniform float uTime;varying vec3 vNormal;varying vec3 vWorld;varying vec3 vLocal;varying vec2 vPlumeUV;varying float vPlumeAge;varying float vLocalY;varying float vLocalZ;
void main(){
 vec3 local=aPosition;vPlumeUV=aNormal.xy;vPlumeAge=aPosition.z;
 if(uPlume>1.5){
  float age=fract(aPosition.z+uTime*.62+fract(uPlume)*3.);vPlumeAge=age;
  if(uPlume>2.5){
   vec2 direction=normalize(aPosition.xy+vec2(.001));
   local=vec3(direction.x*(.12+age)*(1.+abs(aPosition.x)),.05+.16*sin(age*3.14159),direction.y*(.12+age)*(1.+abs(aPosition.y)));
  }else{
   float spread=.08+pow(age,1.25);vec2 swirl=vec2(sin(age*13.+aPosition.x*21.),cos(age*11.+aPosition.y*23.))*.055*age;
   local=vec3(aPosition.xy*spread+swirl,age);
  }
  vec3 center=(uModel*vec4(local,1.)).xyz,toEye=normalize(uEye-center);
  vec3 right=normalize(cross(abs(toEye.y)>.95?vec3(1.,0.,0.):vec3(0.,1.,0.),toEye)),up=cross(toEye,right);
  float radius=length(uModel[0].xyz)*aNormal.z*(.2+1.3*sqrt(age));
  vec3 offset=(right*aNormal.x+up*aNormal.y)*radius;
  local+=vec3(dot(offset,uModel[0].xyz)/dot(uModel[0].xyz,uModel[0].xyz),dot(offset,uModel[1].xyz)/dot(uModel[1].xyz,uModel[1].xyz),dot(offset,uModel[2].xyz)/dot(uModel[2].xyz,uModel[2].xyz));
 }
 vLocal=local;vWorld=(uModel*vec4(local,1.)).xyz;vNormal=mat3(uModel)*aNormal;vLocalY=local.y;vLocalZ=local.z;gl_Position=uMVP*vec4(local,1.);
}`;
const fragment=`precision highp float;varying vec3 vLocal;varying vec2 vPlumeUV;varying float vPlumeAge;varying vec3 vNormal;varying vec3 vWorld;varying float vLocalY;varying float vLocalZ;uniform vec4 uColor;uniform vec3 uEye;uniform float uMetal;uniform float uFloor;uniform float uTravel;uniform float uRough;uniform float uEmit;uniform float uSpec;uniform float uMirror;uniform float uAO;uniform vec3 uShadows[3];uniform float uLanes;uniform float uFogK;uniform float uPlume;uniform float uTime;uniform vec3 uShadowYaw;uniform vec3 uShadowHeight;
${sceneryShader}
// Painted line of half-width hw metres, kept at least about a pixel wide when distant.
float paint(float d,float hw){
#ifdef DERIV
  float fw=fwidth(d);
#else
  float fw=.02;
#endif
  float w=max(hw,fw*.75);return (1.-smoothstep(w,w+fw,abs(d)))*min(1.,hw/w+.3);
}
// GGX-style artistic surface shading. Lighting is not a calibrated optical model.
vec3 siteLight(vec3 n,vec3 v,vec3 l,vec3 albedo,vec3 f0,float rough,float metal){
 vec3 h=normalize(v+l);float nl=max(dot(n,l),0.),nv=max(dot(n,v),.001),nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
 float a=rough*rough,a2=a*a,d=nh*nh*(a2-1.)+1.;float distribution=a2/max(3.141593*d*d,.00001);
 float k=pow(rough+1.,2.)/8.,geometry=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);
 vec3 f=f0+(1.-f0)*pow(1.-vh,5.);
 return ((1.-f)*(1.-metal)*albedo/3.141593+distribution*geometry*f/max(4.*nl*nv,.001)*uSpec)*nl;
}
void main(){
 if(uPlume>.5){
  float alpha=0.;vec3 color=vec3(.84,.89,.91);
  if(uPlume>1.5){
   vec2 uv=vPlumeUV;float age=vPlumeAge;
   float noise=siteNoise(uv*3.6+vec2(age*17.,-uTime*1.8+fract(uPlume)*13.));
   float detail=siteNoise(uv*8.3+vec2(age*23.,uTime*.7));
   float edge=length(uv)+(noise-.5)*.28+(detail-.5)*.10;
   alpha=(1.-smoothstep(.25,.98,edge))*smoothstep(0.,.09,age)*(1.-smoothstep(.68,1.,age));
   alpha*=.6+.4*noise;alpha*=smoothstep(.015,.10,vWorld.y);
   color*=.73+.24*noise+.12*(1.-uv.y*.5);
  }else{
   float z=clamp(vLocalZ,0.,1.),r=length(vLocal.xy)/(.2+.8*z);
   float noise=siteNoise(vec2(z*18.-uTime*11.,r*5.+fract(uPlume)*17.));
   alpha=pow(max(0.,1.-r*r),1.6)*smoothstep(0.,.018,z)*(1.-smoothstep(.2,1.,z));
   alpha*=.75+.25*noise;color=vec3(.91,.94,.95);
  }
  if(alpha<.008)discard;
  gl_FragColor=vec4(siteDisplay(color),uColor.a*alpha);return;
 }
 if(uFloor>9.5){gl_FragColor=vec4(siteDisplay(siteSky(normalize(vWorld-uEye))),1.);return;}
  vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;n*=uMirror;
  vec3 v=normalize(uEye-vWorld);
  vec3 l=normalize(vec3(-.56,.12,-.81));
  vec3 fill=normalize(vec3(.62,.58,.57));
  float ndl=max(dot(n,l),0.);
  float ndf=max(dot(n,fill),0.);
  float hemi=n.y*.5+.5;
  float ao=mix(1.,.5+.5*smoothstep(.04,.62,vLocalY),uAO);
  vec3 albedo=siteLinear(uColor.rgb);float rough=max(.10,uRough),metal=uMetal;
  vec3 f0=mix(vec3(.045),albedo,metal);
  vec3 color=albedo;
  if(uFloor<.5){
  color=albedo*mix(vec3(.23,.19,.14),vec3(.60,.73,.91),hemi)*mix(.82,.20,metal);
  color+=siteLight(n,v,l,albedo,f0,rough,metal)*vec3(3.6,2.72,1.85);
  color+=siteLight(n,v,fill,albedo,f0,max(.32,rough),metal)*vec3(1.35,1.65,2.10);
  color*=ao;
  float rim=pow(1.-max(dot(n,v),0.),4.);
  // Analytic sunrise environment, with broad highlights that reveal the body panels.
  vec3 reflection=reflect(-v,n);
  vec3 environment=mix(vec3(.085,.09,.075),siteSky(reflection),smoothstep(-.12,.15,reflection.y));
  float strip=exp(-pow((reflection.y-.56-.16*reflection.x)/(.045+uRough*.15),2.));
  float softbox=pow(max(dot(reflection,normalize(vec3(-.32,.88,.34))),0.),mix(75.,8.,uRough));
  float kicker=pow(max(dot(reflection,normalize(vec3(.2,.32,-.93))),0.),mix(110.,12.,uRough));
  environment+=vec3(.85,.91,1.)*(strip*.40+softbox*.45);
  environment+=vec3(.95,.72,.48)*kicker*.32;
  float horizon=exp(-pow((reflection.y+.12)/(.055+uRough*.12),2.));
  environment+=vec3(.62,.76,.86)*horizon*.28;
  float fresnel=.04+.96*pow(1.-max(dot(n,v),0.),5.);
  vec3 reflectionTint=mix(vec3(1.),albedo,metal);
  float reflectivity=uSpec*mix(.22,.82,metal)*(1.-rough*.45);
  color+=environment*reflectionTint*reflectivity*(.35+fresnel)*ao;
  color+=vec3(.20,.32,.48)*rim*ndf*.12*uSpec;
  color+=albedo*uEmit;
  }
  if(uFloor>.5&&uFloor<3.5){
    float wx=vWorld.x+uTravel,wz=vWorld.z;
    float gx=step(.988,fract(wx*.45));float gz=step(.988,fract(wz*.45));
    float fade=exp(-length(vWorld.xz)*.038/uFogK);
    if(uFloor>1.5&&uFloor<2.5){
      float grain=siteNoise(vec2(wx,wz)*8.),patches=siteFbm(vec2(wx,wz)*.055);
      color=mix(vec3(.085,.13,.045),vec3(.17,.22,.08),patches)+vec3(.015,.02,.005)*(grain-.5);
    }else{
    vec2 ground=vec2(wx,wz);float grain=siteNoise(ground*70.),aggregate=siteNoise(ground*12.),patches=siteNoise(ground*.065);
    float detail=exp(-length(uEye-vWorld)*.025),grainFilter=1.;
#ifdef DERIV
    float footprint=max(fwidth(wx),fwidth(wz));
    detail*=1.-smoothstep(.5,1.8,footprint*12.);grainFilter=1.-smoothstep(.3,1.4,footprint*70.);
#endif
    color=mix(vec3(.063,.076,.080),vec3(.090,.10,.10),patches)+vec3((grain-.5)*.018*grainFilter+(aggregate-.5)*.024)*detail;
    color+=vec3(.020,.016,.011)*pow(max(dot(reflect(-v,n),l),0.),18.);
    if(uFloor<1.5){
      vec3 concrete=mix(vec3(.27,.28,.25),vec3(.34,.33,.28),patches)+vec3((grain-.5)*.015)*detail;
      float joints=max(paint((fract(wx/4.5+.5)-.5)*4.5,.012),paint((fract(wz/4.5+.5)-.5)*4.5,.012));
      concrete*=1.-joints*.20;
      if(uLanes>.5){float outside=smoothstep(6.,6.12,abs(wz));color=mix(color,concrete,outside);color=mix(color,vec3(.15,.17,.075),smoothstep(14.,17.,abs(wz)));}
      else color=concrete;
    }
    float grid=(paint((fract(wx*.2+.5)-.5)*5.,.009)+paint((fract(wz*.2+.5)-.5)*5.,.009));
    if(uFloor<2.5)color+=vec3(.018,.026,.028)*grid*fade;
    if(uFloor<2.5){
    if(uLanes<.5){
      float lane=step(abs(abs(wz)-2.55),.02);color+=lane*vec3(.16,.2,.18)*fade;
      float dash=step(abs(wz),.014)*step(.5,fract(wx*.18));color+=dash*.11*fade;
    }else{
      float track=step(abs(wz),5.1);
      color+=track*vec3(.008,.01,.009);
      color+=paint(abs(wz)-5.1,.06)*vec3(.2,.25,.22);
      color+=paint(abs(wz)-1.7,.04)*step(.45,fract(wx*.25))*vec3(.13,.16,.14);
      float ahead=track*step(-.1,wx);
      color+=paint((fract(wx*.1+.5)-.5)*10.,.04)*ahead*vec3(.06,.08,.07);
      color+=paint((fract(wx*.02+.5)-.5)*50.,.1)*ahead*vec3(.15,.19,.17);
      color+=paint(wx,.14)*track*vec3(.4,.44,.42);
    }
    }
    }
    for(int i=0;i<3;i++){
      vec3 sh=uShadows[i];vec2 delta=vWorld.xz-sh.xy;
      float angle=uShadowYaw[i],ca=cos(angle),sa=sin(angle);
      vec2 local=mat2(ca,sa,-sa,ca)*delta;
      vec2 q=abs(local)-vec2(1.92,.76);
      float sd=length(max(q,0.))+min(max(q.x,q.y),0.);
      float softness=mix(1.9,.55,clamp(sh.z/.7,0.,1.));
      float shadow=1.-smoothstep(-.20,softness,sd);
      float core=exp(-pow(local.x/1.9,4.)-pow(local.y/.72,4.));
      float tire=exp(-pow((local.x-1.325)/.28,2.)-pow((abs(local.y)-.79)/.18,2.))
                +exp(-pow((local.x+1.455)/.28,2.)-pow((abs(local.y)-.815)/.18,2.));
      vec2 castOffset=vec2(.56,.81)*uShadowHeight[i]/.12;
      float along=clamp(dot(delta,castOffset)/max(dot(castOffset,castOffset),.01),0.,1.);
      vec2 castLocal=mat2(ca,sa,-sa,ca)*(delta-castOffset*along);
      vec2 cq=abs(castLocal)-vec2(1.88,.74);
      float castSD=length(max(cq,0.))+min(max(cq.x,cq.y),0.);
      float penumbra=.18+along*.65+uShadowHeight[i]*.08;
      float castShadow=1.-smoothstep(-.1,penumbra,castSD);
      float shade=sh.z*(shadow*.55+core*.25+tire*.27)+castShadow*sh.z*.46;
      color*=1.-clamp(shade,0.,.86);
    }
  }
  if(uFloor>3.5&&uFloor<4.5){
    vec2 ground=vec2(vWorld.x+uTravel,vWorld.z);float scrub=siteFbm(ground*.025);
    color=mix(vec3(.28,.25,.14),vec3(.12,.20,.065),smoothstep(.27,.72,scrub));
    color+=vec3(.025,.018,.008)*(siteNoise(ground*.8)-.5);
    color*=.78+.28*max(n.y,0.)+.20*max(dot(n,l),0.);
  }
  if(uFloor>4.5&&uFloor<5.5){
    vec2 ground=vec2(vWorld.x+uTravel,vWorld.z);
    float ripple=sin(ground.x*1.4+sin(ground.y*.6))*sin(ground.y*2.2);
    vec3 waterReflection=siteSky(reflect(-v,normalize(vec3(ripple*.012,1.,ripple*.018))));
    color=mix(vec3(.16,.31,.34),waterReflection,.52)+vec3(.17,.13,.07)*pow(max(dot(reflect(-v,n),l),0.),85.);
  }
  float fog=1.-exp(-length(uEye-vWorld)*.00032);
  color=mix(color,siteSky(normalize(vec3(vWorld.x-uEye.x,.025,vWorld.z-uEye.z))),fog);
  gl_FragColor=vec4(siteDisplay(color),uColor.a);
}`;
// Screen-space finishing pass: soft bloom on bright highlights (sky glow, gas cores, lamps) plus a gentle
// vignette. The MSAA scene stays in the default framebuffer; only a quarter-resolution glow is added on top.
const POST_VERTEX='attribute vec2 aQuad;varying vec2 vUv;void main(){vUv=aQuad*.5+.5;gl_Position=vec4(aQuad,0.,1.);}';
const POST_BRIGHT='precision mediump float;varying vec2 vUv;uniform sampler2D uTex;uniform vec2 uTexel;uniform float uThreshold;void main(){vec3 c=(texture2D(uTex,vUv+vec2(-1.,-1.)*uTexel).rgb+texture2D(uTex,vUv+vec2(1.,-1.)*uTexel).rgb+texture2D(uTex,vUv+vec2(-1.,1.)*uTexel).rgb+texture2D(uTex,vUv+vec2(1.,1.)*uTexel).rgb)*.25;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(uThreshold,uThreshold+.16,l),1.);}';
const POST_BLUR='precision mediump float;varying vec2 vUv;uniform sampler2D uTex;uniform vec2 uDir;void main(){vec3 c=texture2D(uTex,vUv).rgb*.227;c+=(texture2D(uTex,vUv+uDir*1.385).rgb+texture2D(uTex,vUv-uDir*1.385).rgb)*.316;c+=(texture2D(uTex,vUv+uDir*3.231).rgb+texture2D(uTex,vUv-uDir*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}';
const POST_ADD='precision mediump float;varying vec2 vUv;uniform sampler2D uTex;uniform float uGain;void main(){gl_FragColor=vec4(texture2D(uTex,vUv).rgb*uGain,1.);}';
const POST_VIGNETTE='precision mediump float;varying vec2 vUv;uniform float uStrength;void main(){vec2 d=(vUv-.5)*vec2(1.,.8);gl_FragColor=vec4(vec3(1.-uStrength*smoothstep(.32,.82,length(d))),1.);}';
export const POST_SETTINGS={threshold:.8,gain:.62,vignette:.26,scale:4};
export class Scene {
  constructor(canvas){this.canvas=canvas;this.dirty=true;const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL is unavailable. Try enabling hardware acceleration.');this.gl=gl;this.cut=false;this.frameX=0;this.dist=6.6;this.setCamera('focus');
    const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
    const deriv=gl.getExtension('OES_standard_derivatives')?'#extension GL_OES_standard_derivatives : enable\n#define DERIV 1\n':'';
    const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,deriv+fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.useProgram(p);this.program=p;
    this.loc={};for(const x of ['uMVP','uModel','uColor','uEye','uMetal','uFloor','uTravel','uRough','uEmit','uSpec','uMirror','uAO','uShadows','uLanes','uFogK','uPlume','uTime','uShadowYaw','uShadowHeight'])this.loc[x]=gl.getUniformLocation(p,x);
    this.ap=gl.getAttribLocation(p,'aPosition');this.an=gl.getAttribLocation(p,'aNormal');this.meshes={};
    this.upload('box',box());this.upload('cyl',cylinder());this.upload('plume',coldPlume());this.upload('gas-cloud',plumeCloud());this.upload('ground-cloud',plumeCloud(60));
    this.scenery=sceneryMeshes();for(const mesh of this.scenery)this.upload(mesh.name,mesh);
    const geo=CAR.build();this.bodyMats=Object.keys(geo.body);for(const m of this.bodyMats)this.upload('car:'+m,geo.body[m]);
    this.wheelMeshes=geo.wheels.map((wp,i)=>{const list=[];for(const part of ['spin','fixed'])for(const [m,d] of Object.entries(wp[part])){this.upload(`w${i}:${part}:${m}`,d);list.push({mesh:`w${i}:${part}:${m}`,m,spin:part==='spin'});}return list;});
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    try{if(!/[?&]post=0\b/.test(globalThis.location?.search||''))this.initPost(shader);}catch{this.post=null;}gl.useProgram(this.program);
    this.ptrs=new Map();this.pinch=0;let drag=null;
    const pt=(e)=>({x:e.clientX,y:e.clientY});
    const pinchSpan=()=>{const pts=[...this.ptrs.values()];return Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);};
    canvas.addEventListener('pointerdown',e=>{this.cameraTween=null;this.ptrs.set(e.pointerId,pt(e));canvas.setPointerCapture(e.pointerId);if(this.ptrs.size===2){this.pinch=pinchSpan();drag=null;}else drag=[e.clientX,e.clientY];});
    canvas.addEventListener('pointermove',e=>{if(this.ptrs.has(e.pointerId))this.dirty=true;if(this.ptrs.has(e.pointerId))this.ptrs.set(e.pointerId,pt(e));if(this.ptrs.size===2){const span=pinchSpan();if(this.pinch)this.nudgeZoom((this.pinch-span)*.02);this.pinch=span;drag=null;return;}if(!drag)return;this.yaw+=(e.clientX-drag[0])*.008;this.elev=Math.max(-.1,Math.min(1.1,this.elev+(e.clientY-drag[1])*.005));drag=[e.clientX,e.clientY];});
    const release=e=>{this.ptrs.delete(e.pointerId);this.pinch=0;if(this.ptrs.size===0)drag=null;};
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.nudgeZoom(e.deltaY*.005);},{passive:false});
    canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_','0'].includes(e.key))this.dirty=true;this.cameraTween=null;const yaw=.08,elev=.05;if(e.key==='ArrowLeft'){this.yaw-=yaw;e.preventDefault();}if(e.key==='ArrowRight'){this.yaw+=yaw;e.preventDefault();}if(e.key==='ArrowUp'){this.elev=Math.min(1.1,this.elev+elev);e.preventDefault();}if(e.key==='ArrowDown'){this.elev=Math.max(-.1,this.elev-elev);e.preventDefault();}if(e.key==='+'||e.key==='='){this.nudgeZoom(-.45);e.preventDefault();}if(e.key==='-'||e.key==='_'){this.nudgeZoom(.45);e.preventDefault();}if(e.key==='0'){this.reset();e.preventDefault();}});
    this.alive=true;canvas._impulse=this;
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(!this.alive)return;const el=document.getElementById('scene-error');if(el){el.hidden=false;el.textContent='WebGL context was lost. Reload the experiment.';}});
  }
  upload(name,data){const gl=this.gl,pb=gl.createBuffer(),nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.p),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.n),gl.STATIC_DRAW);this.meshes[name]={pb,nb,count:data.p.length/3};}
  nudgeZoom(delta){this.dirty=true;this.cameraTween=null;this.zoom=Math.max(5.2,Math.min(15,this.zoom+delta));}
  easeToward(target,k){this.dirty=true;const a=Math.max(0,Math.min(1,k));this.yaw+=(target.yaw-this.yaw)*a;this.elev+=(target.elev-this.elev)*a;this.zoom+=(target.zoom-this.zoom)*a;}
  setCamera(name){this.dirty=true;this.cameraTween=null;this.cam=CAMERAS[name]?name:'focus';const p=CAMERAS[this.cam];this.yaw=p.yaw;this.elev=p.elev;this.zoom=p.zoom;this.shot={...p.shot};this.frozenFrame=null;this.frozenDistance=null;}
  transitionCamera(name,animated=true){
    const from={yaw:this.yaw,elev:this.elev,zoom:this.zoom};this.setCamera(name);
    if(animated){
      const delta=((this.yaw-from.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
      this.cameraTween={from,to:{yaw:from.yaw+delta,elev:this.elev,zoom:this.zoom},start:performance.now()};Object.assign(this,from);
    }
  }
  advanceCamera(now){
    if(!this.cameraTween)return;this.dirty=true;
    const {from,to,start}=this.cameraTween,u=now>=start+800?1:Math.max(0,(now-start)/800),k=u*u*u*(10-15*u+6*u*u);
    for(const key of ['yaw','elev','zoom'])this[key]=from[key]+(to[key]-from[key])*k;
    if(u===1)this.cameraTween=null;
  }
  camera(target,d,aspect,elevation=this.elev,yaw=this.yaw,fov=.64){const eye=[target[0]+Math.cos(yaw)*d,target[1]+Math.sin(elevation)*d,target[2]+Math.sin(yaw)*d];// A near plane proportional to framing distance keeps depth precision for ground layers centimetres apart.
    return {eye,vp:mul(perspective(aspect,Math.max(.15,Math.min(4,d*.04)),Math.max(4000,d*8),fov),view(eye,target))};}
  // Smallest camera distance that keeps every point inside the HUD-safe part of the frame.
  fit(points,target,aspect,elevation=this.elev,yaw=this.yaw){
    const inside=d=>{const m=this.camera(target,d,aspect,elevation,yaw).vp;for(const [x,y,z] of points){const w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return false;const cx=(m[0]*x+m[4]*y+m[8]*z+m[12])/w,cy=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;if(Math.abs(cx)>.84||cy>.56||cy<-.7)return false;}return true;};
    let lo=3,hi=8000;if(!inside(hi))return hi;for(let i=0;i<30;i++){const mid=Math.sqrt(lo*hi);if(inside(mid))hi=mid;else lo=mid;}return hi;
  }
  // World point (metres, launch x measured from the start line) to canvas CSS pixels, or null off-screen.
  project([X,Y,Z]){const m=this.vp;if(!m)return null;const x=X-this.frameX,w=m[3]*x+m[7]*Y+m[11]*Z+m[15];if(w<=0)return null;const cx=(m[0]*x+m[4]*Y+m[8]*Z+m[12])/w,cy=(m[1]*x+m[5]*Y+m[9]*Z+m[13])/w;if(Math.abs(cx)>1.02||Math.abs(cy)>1.02)return null;return [(cx+1)/2*this.canvas.clientWidth,(1-cy)/2*this.canvas.clientHeight];}
  annotateVessel(root){
    // Same local centre as the two cutaway cylinders, transformed by the actual body pose.
    const x=-.6,y=.72;
    this.vesselAnnotation={point:this.project([root[0]*x+root[4]*y+root[12]+(this.frameX??0),root[1]*x+root[5]*y+root[13],root[2]*x+root[6]*y+root[14]])};
  }
  drawM(mesh,m,color,o={}){
    const gl=this.gl,g=this.meshes[mesh];
    if(!g)return;
    if(o.glass)gl.depthMask(false);
    // No depth bias: experiment floors stay in front of the coastal plane by geometry (coast at -0.12 m,
    // distance-scaled near plane). A slope-scaled bias grows with distance and let floors cover roads and pads.
    gl.bindBuffer(gl.ARRAY_BUFFER,g.pb);gl.enableVertexAttribArray(this.ap);gl.vertexAttribPointer(this.ap,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,g.nb);gl.enableVertexAttribArray(this.an);gl.vertexAttribPointer(this.an,3,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(this.loc.uMVP,false,mul(this.vp,m));gl.uniformMatrix4fv(this.loc.uModel,false,m);
    gl.uniform4fv(this.loc.uColor,color.length===4?color:[...color,1]);gl.uniform1f(this.loc.uMetal,o.metal||0);gl.uniform1f(this.loc.uFloor,o.floor||0);gl.uniform1f(this.loc.uRough,o.rough??.45);gl.uniform1f(this.loc.uEmit,o.emit||0);
    gl.uniform1f(this.loc.uSpec,o.spec||0);gl.uniform1f(this.loc.uMirror,o.mirror||1);gl.uniform1f(this.loc.uAO,o.ao||0);gl.uniform1f(this.loc.uPlume,o.plume||0);
    gl.drawArrays(gl.TRIANGLES,0,g.count);
    if(o.glass)gl.depthMask(true);
  }
  draw(mesh,p,s,color,r=[0,0,0],metal=0,parent=I(),floor=0,rough=.45,emit=0,glass=false,plume=0){this.drawM(mesh,mul(parent,matrix(p,s,r)),color,{metal,floor,rough,emit,glass,plume});}
  environment(eye){
    if(!this.scenery)return;
    // Sky follows the eye; the physical campus stays fixed in world coordinates.
    // Drawing before the experiment lets its ground/road and telemetry keep priority.
    const size=Math.max(1800,this.dist*1.2);
    this.draw('box',eye,[size,size,size],[1,1,1],[0,0,0],0,I(),10,1,0,true);
    const parent=matrix([-this.frameX,0,0]);
    for(const mesh of this.scenery){
      // The dedicated underside camera intentionally looks up through the pad.
      if(this.cam==='hop-under'&&mesh.floor)continue;
      this.drawM(mesh.name,parent,mesh.color,mesh);
    }
    this.canvas.dataset.environment='starbase-sunrise';
  }
  initPost(shader){
    const gl=this.gl,program=fragment=>{const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,POST_VERTEX));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fragment));gl.bindAttribLocation(p,0,'aQuad');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const loc={};for(const name of ['uTex','uTexel','uThreshold','uDir','uGain','uStrength'])loc[name]=gl.getUniformLocation(p,name);return {p,loc};};
    const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
    const texture=()=>{const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);return {tex,w:0,h:0};};
    const target=()=>{const t=texture();t.fb=gl.createFramebuffer();return t;};
    this.post={quad,scene:texture(),a:target(),b:target(),bright:program(POST_BRIGHT),blur:program(POST_BLUR),add:program(POST_ADD),vignette:program(POST_VIGNETTE),enabled:true};
  }
  sizeTarget(t,w,h){
    const gl=this.gl;if(t.w===w&&t.h===h)return true;gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,w,h,0,gl.RGB,gl.UNSIGNED_BYTE,null);t.w=w;t.h=h;
    if(!t.fb)return true;gl.bindFramebuffer(gl.FRAMEBUFFER,t.fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.tex,0);
    const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);return ok;
  }
  applyPost(){
    const gl=this.gl,P=this.post,W=this.canvas.width,H=this.canvas.height,S=POST_SETTINGS;if(W<8||H<8)return;
    const qw=Math.max(2,Math.round(W/S.scale)),qh=Math.max(2,Math.round(H/S.scale));
    if(!this.sizeTarget(P.scene,W,H)||!this.sizeTarget(P.a,qw,qh)||!this.sizeTarget(P.b,qw,qh)){P.enabled=false;return;}
    gl.bindTexture(gl.TEXTURE_2D,P.scene.tex);gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,W,H);
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disableVertexAttribArray(this.an);
    gl.bindBuffer(gl.ARRAY_BUFFER,P.quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.activeTexture(gl.TEXTURE0);
    const pass=(prog,source,target,setup)=>{gl.useProgram(prog.p);gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.fb:null);gl.viewport(0,0,target?target.w:W,target?target.h:H);if(source)gl.bindTexture(gl.TEXTURE_2D,source.tex);gl.uniform1i(prog.loc.uTex,0);setup?.(prog.loc);gl.drawArrays(gl.TRIANGLES,0,6);};
    pass(P.bright,P.scene,P.a,l=>{gl.uniform2f(l.uTexel,1/W,1/H);gl.uniform1f(l.uThreshold,S.threshold);});
    for(let i=0;i<2;i++){pass(P.blur,P.a,P.b,l=>gl.uniform2f(l.uDir,(1+i)/qw,0));pass(P.blur,P.b,P.a,l=>gl.uniform2f(l.uDir,0,(1+i)/qh));}
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);pass(P.add,P.a,null,l=>gl.uniform1f(l.uGain,S.gain));
    gl.blendFunc(gl.ZERO,gl.SRC_COLOR);pass(P.vignette,null,null,l=>gl.uniform1f(l.uStrength,S.vignette));
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    this.canvas.dataset.post='bloom';
  }
  render(state){this.renderScene(state);if(this.post?.enabled)this.applyPost();}
  renderScene({sample,hop,c,experiment,cutaway,vectors,compare,ghosts,mode,invert,turn,entries,autoFrame=true}){this.vesselAnnotation=null;this.dirty=false;this.canvas.dataset.drawCount=String((Number(this.canvas.dataset.drawCount)||0)+1);const gl=this.gl,w=this.canvas.clientWidth,h=this.canvas.clientHeight,dpr=Math.min(devicePixelRatio,2);if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=w*dpr;this.canvas.height=h*dpr;}gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(.71,.70,.62,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(this.loc.uTime,sample.t??0);
    gl.uniform3fv(this.loc.uShadowYaw,new Float32Array([...(entries??[]).slice(0,3).map(e=>e.sample.yaw??0),0,0,0].slice(0,3)));
    const shadowHeight=experiment==='hop'?Math.max(0,sample.y??0)+.65:experiment==='invert'?Math.max(.1,sample.y??.65):.65;
    gl.uniform3fv(this.loc.uShadowHeight,new Float32Array([shadowHeight,shadowHeight,shadowHeight]));
    if(experiment==='turn'&&turn){this.renderTurn({entries,c,cutaway,vectors,turn,w,h});return;}
    if(experiment==='hop'){this.renderHop({sample,c,cutaway,vectors,hop,w,h});return;}
    if(experiment==='invert'&&invert?.rig){this.renderInvert({sample,c,cutaway,vectors,invert,w,h});return;}
    if(experiment==='launch'&&entries?.length){this.renderComparison({entries,c,cutaway,vectors,mode,autoFrame,w,h});return;}
    const target=experiment==='invert'?[0,1.7,0]:[0,.5,0],eye=[Math.cos(this.yaw)*this.zoom,target[1]+Math.sin(this.elev)*this.zoom,Math.sin(this.yaw)*this.zoom];this.vp=mul(perspective(w/h),view(eye,target));gl.uniform3fv(this.loc.uEye,eye);gl.uniform1f(this.loc.uTravel,sample.x);
    const lift=0;
    gl.uniform3fv(this.loc.uShadows,new Float32Array([0,0,experiment==='invert'?0:.62*Math.exp(-lift*1.6),0,0,0,0,0,0]));
    gl.uniform1f(this.loc.uFogK,1);
    gl.uniform1f(this.loc.uLanes,0);
    this.environment(eye);
    this.draw('box',[0,-.08,0],[110,.1,110],[.08,.1,.09],[0,0,0],0,I(),1,.9,0);
    if(experiment==='launch'){for(let i=-5;i<7;i++){let x=i*4-(sample.x%4);this.draw('box',[x,-.005,-2.56],[.08,.012,.22],[.38,.44,.4],[0,0,0],.2,I(),0,.6);}if(sample.v>8){const span=Math.min(2.2,sample.v*.03);for(let i=0;i<6;i++){const x=-1.2-i*.55-(sample.x%0.4);this.draw('box',[x,.04,1.05-(i%2)*.2],[span,.008,.012],[.72,.82,.78,.16],[0,0,0],0,I(),0,.4);}}}
    let root=matrix([0,experiment==='invert'?1.8:lift,0],[1,1,1],[0,0,experiment==='invert'?c.angle*Math.PI/180:0]);
    if(experiment==='invert'){this.draw('box',[0,-.16,0],[6,.22,3.1],[.18,.22,.21],[0,0,0],.55,root,0,.4);for(const z of [-1.5,1.5])this.draw('box',[0,-.02,z],[6,.035,.03],[.88,.28,.17],[0,0,0],.5,root,0,.35);this.draw('cyl',[0,1.8,-1.8],[.25,.25,.7],[.3,.34,.32],[0,0,0],.4,root,0,.45);this.draw('box',[0,.7,-2],[.3,2.2,.3],[.14,.18,.16],[0,0,0],.3,root,0,.5);}
    this.car(root,cutaway,sample,c,mode,experiment);
    if(compare&&experiment==='launch')for(let i=0;i<ghosts.length;i++){const delta=Math.max(-7,Math.min(2,(ghosts[i].x-sample.x)*.25));this.car(matrix([delta,0,-3.5-i*3.05]),false,ghosts[i],c,i,experiment,true);}
    if(vectors){const green=[.56,.83,.66],red=[.97,.34,.22],blue=[.38,.68,.82];const arrow=(p,length,color,rot)=>{if(length<.05)return;const group=mul(root,matrix(p,[1,1,1],[0,0,rot]));this.draw('box',[length/2,0,0],[length,.025,.025],color,[0,0,0],0,group,0,.35);for(const z of [-1,1])this.draw('box',[length-.1,z*.06,0],[.22,.025,.025],color,[0,0,z*.6],0,group,0,.35);};if(experiment==='launch'){arrow([.9,.15,1.3],sample.tire/17000,green,0);arrow([-2.2,.8,0],sample.thrust/13000,red,0);if(mode>0)arrow([0,.35,1.25],sample.downforce/22000,blue,-Math.PI/2);}else if(experiment==='hop')arrow([0,.8,1.3],sample.thrust/16000,red,Math.PI/2);else if(experiment==='invert'&&invert){arrow([0,.22,1.15],Math.max(0,invert.normal)/22000,green,Math.PI/2);arrow([0,.48,1.28],invert.downforce/22000,blue,-Math.PI/2);arrow([.95,.18,1.3],invert.demand/17000,red,Math.PI);}}
  }
  renderTurn({entries,c,cutaway,vectors,turn,w,h}){
    const track=turn.track,selected=entries[turn.focus],sample=selected.sample,focus=this.cam==='turn-focus',gl=this.gl;
    this.frameX=0;
    const key=JSON.stringify([track.radius,track.width,track.sweep]);
    if(key!==this.turnRoadKey){
      const old=this.meshes['turn-road'];if(old){gl.deleteBuffer(old.pb);gl.deleteBuffer(old.nb);}
      this.upload('turn-road',turnRoadMesh(track));this.turnRoadKey=key;
      const shoulder=this.meshes['turn-shoulder'];if(shoulder){gl.deleteBuffer(shoulder.pb);gl.deleteBuffer(shoulder.nb);}
      this.upload('turn-shoulder',turnRoadMesh({...track,width:track.width+3.4}));
    }
    const b=turn.bounds,p=Number.isFinite(turn.reveal)?Math.max(0,Math.min(1,turn.reveal)):null;
    const blend=p===null?1:p*p*(3-2*p),mix=(a,b)=>a+(b-a)*blend;
    // Showcase starts around both live body envelopes, then reveals the full road.
    // The full bounds contain both traces, so the moving frame keeps the no-fan car.
    const pair={minX:Math.min(...entries.map(e=>e.sample.x))-3.8,maxX:Math.max(...entries.map(e=>e.sample.x))+3.8,minZ:Math.min(...entries.map(e=>e.sample.z))-3,maxZ:Math.max(...entries.map(e=>e.sample.z))+3};
    const frame=p===null?b:Object.fromEntries(['minX','maxX','minZ','maxZ'].map(key=>[key,mix(pair[key],b[key])]));
    const target=focus?[sample.x,.6,sample.z]:[(frame.minX+frame.maxX)/2,.5,(frame.minZ+frame.maxZ)/2];
    const bounds=focus?[-4.1,4.1].flatMap(x=>[-2.6,2.6].flatMap(z=>[0,2.2].map(y=>[sample.x+x,y,sample.z+z]))):[frame.minX,frame.maxX].flatMap(x=>[frame.minZ,frame.maxZ].flatMap(z=>[0,2.2].map(y=>[x,y,z])));
    const yaw=this.yaw,elevation=p===null||focus?this.elev:mix(.32,this.elev);if(focus)this.yaw-=sample.yaw;else if(p!==null)this.yaw=mix(1.05,yaw);
    const distance=this.fit(bounds,target,w/h,elevation)*this.zoom/6.6,{eye,vp}=this.camera(target,distance,w/h,elevation);this.vp=vp;this.dist=distance;this.yaw=yaw;
    gl.uniform3fv(this.loc.uEye,eye);gl.uniform1f(this.loc.uTravel,0);gl.uniform1f(this.loc.uFogK,Math.max(1,distance/40));gl.uniform1f(this.loc.uLanes,0);
    gl.uniform3fv(this.loc.uShadows,new Float32Array([...entries.flatMap(e=>[e.sample.x,e.sample.z,.6]),0,0,0]));
    this.environment(eye);
    this.draw('box',[0,-.09,0],[800,.12,800],[.065,.13,.08],[0,0,0],0,I(),2,.95);
    // A gravel shoulder softens the asphalt-to-grass edge (visual only; runoff physics is unchanged).
    this.draw('turn-shoulder',[0,-.012,0],[1,1,1],[.3,.27,.2],[0,0,0],0,I(),4,.95);
    this.draw('turn-road',[0,0,0],[1,1,1],[.085,.12,.13],[0,0,0],0,I(),3,.95);
    // Scrub marks where the solver reports a grip-limited path, revealed as the cars pass.
    for(const [i,marks] of (turn.marks||[]).entries()){const now=entries[i]?.sample?.t??0;for(const m of marks){if(m.t>now)break;for(const side of [-.8,.8])this.draw('box',[m.x-Math.sin(m.yaw)*side,.007,m.z-Math.cos(m.yaw)*side],[m.len,.004,.2],[.02,.02,.022,.38],[0,m.yaw,0],0,I(),0,.95,0,true);}}
    this.draw('box',[-3,-.005,0],[6,.025,track.width],[.085,.12,.13],[0,0,0],0,I(),3,.95);
    const finish=track.centerline.at(-1),exit=matrix([finish.x,0,finish.z],[1,1,1],[0,track.sweep,0]);
    this.draw('box',[3,-.005,0],[6,.025,track.width],[.085,.12,.13],[0,0,0],0,exit,3,.95);
    for(const edge of track.edges)this.draw('box',[edge.x,.018,edge.z],[edge.halfLength*2,.012,.08],[.67,.75,.65],[0,-edge.angle,0],0,I(),0,.95);
    track.edges.forEach((edge,i)=>{if(i%4===0)this.draw('box',[edge.x,.025,edge.z],[edge.halfLength*1.6,.014,.24],i%8===0?[.65,.29,.20]:[.65,.70,.67],[0,-edge.angle,0],0,I());});
    for(let j=0;j<track.centerline.length-1;j+=4){const a=track.centerline[j],b=track.centerline[j+1],len=Math.hypot(b.x-a.x,b.z-a.z);this.draw('box',[(a.x+b.x)/2,.021,(a.z+b.z)/2],[len,.018,.065],[.4,.52,.52],[0,-Math.atan2(b.z-a.z,b.x-a.x),0],0,I());}
    const marks=Math.ceil(track.width/.65);
    for(let i=0;i<marks;i++)for(const row of [0,1])this.draw('box',[row*.22,.025,-track.width/2+(i+.5)*track.width/marks],[.22,.016,track.width/marks],(i+row)%2?[.72,.77,.73]:[.1,.15,.16],[0,0,0],0,exit);
    const overlap=Math.hypot(entries[0].sample.x-entries[1].sample.x,entries[0].sample.z-entries[1].sample.z)<1.4;
    const ordered=[...entries].sort((a,b)=>(a.mode===turn.focus?1:0)-(b.mode===turn.focus?1:0));
    for(const entry of ordered){
      if(overlap&&entry.mode!==turn.focus)continue;
      const s=entry.sample,root=matrix([s.x,0,s.z],[1,1,1],[0,s.yaw,0]);
      const visual=entry.ended?{...s,v:0,tire:0,downforce:0}:s;
      this.locator([s.x,0,s.z],TURN_RGB[entry.mode]||[.9,.9,.9],distance);
      this.car(root,cutaway&&entry.mode===turn.focus,visual,c,entry.mode,'turn');
    }
    if(vectors&&!selected.ended){
      const actual=(c.mass+sample.gas)*Math.abs(sample.a),demand=sample.demand,scale=2.7/Math.max(actual,demand,sample.downforce,1),direction=Math.sign(sample.a)||1;
      const root=matrix([sample.x,.35,sample.z],[1,1,1],[0,sample.course,0]);
      for(const [force,color,x] of [[actual,[.56,.83,.66],-.5],[demand,[.97,.4,.25],.5]]){
        const len=force*scale;if(len<.02)continue;
        this.draw('box',[x,.25,-direction*len/2],[.045,.045,len],color,[0,0,0],0,root);
        for(const sign of [-1,1])this.draw('box',[x+sign*.06,.25,-direction*(len-.1)],[.035,.035,.24],color,[0,sign*.55,0],0,root);
      }
      const len=sample.downforce*scale;if(len>.02){
        this.draw('box',[0,.3+len/2,1.25],[.045,len,.045],[.38,.68,.82],[0,0,0],0,root);
        for(const sign of [-1,1])this.draw('box',[sign*.06,.4,1.25],[.035,.23,.035],[.38,.68,.82],[0,0,-sign*.55],0,root);
      }
    }
    this.canvas.dataset.turnFocus=String(turn.focus);this.canvas.dataset.turnOverlap=String(overlap);
    entries.forEach(e=>{this.canvas.dataset['turnState'+e.mode]=e.status;this.canvas.dataset['turnX'+e.mode]=String(e.sample.x);this.canvas.dataset['turnZ'+e.mode]=String(e.sample.z);this.canvas.dataset['turnWreck'+e.mode]='false';});
  }
  renderInvert({sample,c,cutaway,vectors,invert,w,h}){
    const rig=invert.rig,a=sample.angle,pose=invertPose(sample,rig),tracking=this.cam==='invert-track';
    this.frameX=0;
    const extent=invert.bounds;
    const target=tracking?[sample.x,sample.y,0]:[(extent.minX+extent.maxX)/2,extent.maxY/2,0];
    const bounds=tracking?[-2.6,2.6].flatMap(x=>[-1.3,1.3].flatMap(z=>[-.8,.8].map(y=>[sample.x+x*Math.cos(a)-y*Math.sin(a),sample.y+x*Math.sin(a)+y*Math.cos(a),z]))):[extent.minX-.4,extent.maxX+.4].flatMap(x=>[-2.4,2.4].flatMap(z=>[0,extent.maxY+.3].map(y=>[x,y,z])));
    const distance=this.fit(bounds,target,w/h)*this.zoom/6.6,{eye,vp}=this.camera(target,distance,w/h);this.vp=vp;this.dist=distance;
    const gl=this.gl;gl.uniform3fv(this.loc.uEye,eye);gl.uniform1f(this.loc.uTravel,0);gl.uniform1f(this.loc.uFogK,Math.max(1,distance/18));gl.uniform1f(this.loc.uLanes,0);
    gl.uniform3fv(this.loc.uShadows,new Float32Array([sample.x,0,.5*Math.exp(-sample.clearance*.25),0,0,0,0,0,0]));
    this.environment(eye);
    this.draw('box',[0,-.08,0],[150,.1,150],[.08,.1,.09],[0,0,0],0,I(),1,.9);
    const deck=matrix([0,rig.height,0],[1,1,1],[0,0,sample.platformAngle??a]);
    this.draw('box',[0,-.12,0],[2*rig.halfLength,.24,2*rig.halfWidth],[.17,.23,.24],[0,0,0],.55,deck,0,.42);
    for(const z of [-rig.halfWidth,rig.halfWidth])this.draw('box',[0,.012,z],[2*rig.halfLength,.025,.035],[.55,.78,.79],[0,0,0],.4,deck);
    for(const x of [-rig.halfLength,rig.halfLength])this.draw('box',[x,.018,0],[.06,.025,2*rig.halfWidth],[.97,.45,.27],[0,0,0],.4,deck);
    // Stationary supports sit outside the car's motion plane.
    for(const z of [-2.1]){
      this.draw('box',[0,rig.height/2,z],[.22,rig.height,.22],[.15,.22,.24],[0,0,0],.5,I());
      this.draw('box',[0,.1,z],[3.2,.2,.6],[.14,.2,.22],[0,0,0],.4,I());
    }
    this.draw('cyl',[0,rig.height,-1.05],[.2,.2,2.5],[.38,.48,.49],[0,0,0],.7,I());
    for(let y=0;y<=rig.height;y++)this.draw('box',[.2,y,2.1],[.28,.025,.025],[.6,.72,.72],[0,0,0],0,I());
    // Test-rig dressing (visual): A-frame legs, hazard base, a hydraulic actuator tied to the solved
    // platform angle, and a protractor with a needle that follows the stored platform angle.
    const beam=(a,b,size,color,metal=.5)=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);this.draw('box',[(a[0]+b[0])/2,(a[1]+b[1])/2,a[2]],[len,size,size],color,[0,0,Math.atan2(dy,dx)],metal,I(),0,.45);};
    for(const x of [-1.5,1.5])beam([x,.2,-2.1],[0,rig.height-.1,-2.1],.16,[.2,.27,.29]);
    for(let i=-4;i<=4;i++)this.draw('box',[i*.36,.205,-2.42],[.18,.02,.03],i%2?[.93,.72,.2]:[.07,.08,.08],[0,0,0],0,I());
    const platform=sample.platformAngle??a,ca=Math.cos(platform),sa=Math.sin(platform),attach=[1.9*ca+.24*sa,rig.height+1.9*sa-.24*ca,-1.7],anchor=[2.9,.25,-1.7];
    const reach=Math.hypot(attach[0]-anchor[0],attach[1]-anchor[1]),dir=[(attach[0]-anchor[0])/reach,(attach[1]-anchor[1])/reach],split=[anchor[0]+dir[0]*reach*.58,anchor[1]+dir[1]*reach*.58,-1.7];
    this.draw('box',[anchor[0],.12,-1.7],[.5,.24,.5],[.15,.2,.22],[0,0,0],.5,I());
    beam(anchor,split,.2,[.62,.66,.63],.7);beam(split,attach,.1,[.86,.88,.86],.9);
    const R=1.55,cz=-2.42,cy=rig.height;
    for(let k=0;k<=12;k++){const th=k*Math.PI/12,major=k%3===0,len=major?.42:.24;this.draw('box',[Math.cos(th)*(R+len/2),cy+Math.sin(th)*(R+len/2),cz],[len,.06,.06],major?[.97,.78,.6]:[.72,.82,.82],[0,0,th],0,I(),0,.5,major?.45:.15);}
    for(let k=0;k<24;k++){const a0=k*Math.PI/24,a1=(k+1)*Math.PI/24,m=(a0+a1)/2;this.draw('box',[Math.cos(m)*R,cy+Math.sin(m)*R,cz],[R*(a1-a0)+.01,.035,.035],[.5,.62,.62],[0,0,m+Math.PI/2],0,I());}
    this.draw('box',[ca*(R+.2)/2,cy+sa*(R+.2)/2,cz-.03],[R+.2,.08,.08],[.98,.55,.35],[0,0,platform],0,I(),0,.4,.8);
    this.invertAnnotations={gauge:this.project([ca*(R+.45),cy+sa*(R+.45),cz]),angle:platform*180/Math.PI};
    const damage=invert.damage??{wrecked:false,progress:0};
    if(damage.wrecked)pose.position[1]-=.62*damage.progress*Math.abs(Math.cos(a));
    const root=matrix(pose.position,[1,1,1],[0,0,a]);
    this.car(root,cutaway,sample,c,1,'invert',false,damage);
    if(damage.wrecked){this.hopDebris(damage.progress,matrix([sample.x,0,0]));if(damage.progress<1)this.draw('ground-cloud',[sample.x,.04,0],[1.6+damage.progress*5,1.1,1.6+damage.progress*5],[.82,.76,.66,.75*(1-damage.progress)],[0,0,0],0,I(),0,1,0,true,3.31);}
    if(vectors){
      const weight=(c.mass+sample.gas)*9.80665,scale=2.4/Math.max(weight,sample.normal,sample.downforce,1);
      const forces=[[sample.normal,-Math.sin(a),Math.cos(a),[.56,.83,.66],1.15],[sample.downforce,Math.sin(a),-Math.cos(a),[.38,.68,.82],1.4],[sample.tire,Math.sign(sample.alongForce??sample.tire)*Math.cos(a),Math.sign(sample.alongForce??sample.tire)*Math.sin(a),[.56,.83,.66],1.65],[weight,0,-1,[.97,.4,.25],1.9]];
      if(sample.limit!=='IMPACT')for(const [force,dx,dy,color,z] of forces){
        const len=force*scale;if(len<.02)continue;const r=Math.atan2(dy,dx),parent=matrix([sample.x,sample.y,z],[1,1,1],[0,0,r]);
        this.draw('box',[len/2,0,0],[len,.035,.035],color,[0,0,0],0,parent);
        for(const sign of [-1,1])this.draw('box',[len-.1,sign*.06,0],[.23,.035,.035],color,[0,0,sign*.6],0,parent);
      }
    }
    Object.assign(this.canvas.dataset,{invertPhase:sample.limit,invertContact:String(sample.contact),invertSuction:String(sample.downforce),invertX:String(sample.x),invertY:String(sample.y),invertAngle:String(a),invertPlatformAngle:String(sample.platformAngle??a),invertOutcome:invert.outcome,invertWreck:String(damage.wrecked)});
  }
  renderHop({sample,c,cutaway,vectors,hop,w,h}){
    this.frameX=0;
    const peak=Math.max(.5,hop?.peakHeight??sample.y),tracking=this.cam==='hop-track'||this.cam==='hop-under';
    const jetContext=this.cam==='hop-track'?1.4*(1-Math.exp(-Math.max(0,sample.y)*.65)):0;
    const target=[0,tracking?sample.y+.65-jetContext:peak/2+.55,0];
    // Keep some jet/pad context below a tracked car, without a valve-edge camera jump.
    const lower=this.cam==='hop-under'?sample.y:Math.max(0,sample.y-3.5);
    const bounds=tracking?[-2.6,2.6].flatMap(x=>[-1.25,1.25].flatMap(z=>[lower,sample.y+2.1].map(y=>[x,y,z]))):[-3.8,2.7].flatMap(x=>[-2,1.3].flatMap(z=>[0,peak+2.1].map(y=>[x,y,z])));
    const distance=this.fit(bounds,target,w/h)*this.zoom/6.6;
    // Brief impact shake after a wrecked touchdown; skipped for reduced motion and scrubbing.
    const age=hop?.touchdownAge,shake=hop?.damage?.wrecked&&Number.isFinite(age)&&age<.6&&!prefersReducedMotion()?.07*(1-age/.6):0;
    const {eye,vp}=this.camera(shake?[target[0],target[1]+shake*Math.sin(age*95),target[2]+shake*.6*Math.sin(age*77)]:target,distance,w/h);this.vp=vp;this.dist=distance;
    const gl=this.gl;gl.uniform3fv(this.loc.uEye,eye);gl.uniform1f(this.loc.uTravel,0);
    gl.uniform1f(this.loc.uFogK,Math.max(1,distance/16));gl.uniform1f(this.loc.uLanes,0);
    gl.uniform3fv(this.loc.uShadows,new Float32Array([0,0,.62*Math.exp(-sample.y*.16),0,0,0,0,0,0]));
    this.environment(eye);
    if(this.cam!=='hop-under'){
    const span=Math.max(160,peak*2+120);
    this.draw('box',[0,-.08,0],[span,.1,span],[.08,.1,.09],[0,0,0],0,I(),1,.9);
    this.draw('box',[0,-.012,0],[6,.03,4.5],[.17,.22,.23],[0,0,0],.2,I(),3,.7);
    for(const z of [-2.2,2.2])this.draw('box',[0,.007,z],[6,.015,.045],[.55,.33,.25],[0,0,0],0,I());
    for(const x of [-2.95,2.95])this.draw('box',[x,.007,0],[.045,.015,4.45],[.55,.33,.25],[0,0,0],0,I());
    // Pad graphics: landing ring, H marking, hazard edging and low blast deflectors (visual only).
    this.draw('cyl',[0,.008,0],[1.72,1.72,.012],[.78,.62,.42],[Math.PI/2,0,0],0,I(),0,.6);
    this.draw('cyl',[0,.011,0],[1.58,1.58,.012],[.17,.22,.23],[Math.PI/2,0,0],.2,I(),3,.7);
    for(const x of [-.42,.42])this.draw('box',[x,.016,0],[.16,.012,1.15],[.86,.88,.84],[0,0,0],0,I(),0,.6);
    this.draw('box',[0,.016,0],[.84,.012,.16],[.86,.88,.84],[0,0,0],0,I(),0,.6);
    for(let i=-7;i<=7;i++)for(const z of [-2.47,2.47])this.draw('box',[i*.4,.006,z],[.36,.012,.22],i%2?[.93,.72,.2]:[.07,.08,.08],[0,0,0],0,I(),0,.7);
    for(const x of [-3.3,3.3])this.draw('box',[x,.05,0],[.34,.1,4.3],[.44,.47,.46],[0,0,x>0?-.35:.35],.2,I(),0,.7);
    }
    // Flat corner markings and inset lights, clear of the solved vehicle path.
    if(this.cam!=='hop-under')for(const x of [-2.7,2.7])for(const z of [-1.95,1.95]){
      this.draw('box',[x,.012,z],[.48,.012,.055],[.79,.55,.34],[0,0,0],0,I(),0,.5,.35);
      this.draw('box',[x,.012,z],[.055,.012,.40],[.79,.55,.34],[0,0,0],0,I(),0,.5,.35);
    }
    // A straight world-space path, since the model has no horizontal motion.
    this.draw('box',[-3.4,peak/2,-1.5],[.025,peak,.025],[.34,.48,.52,.38],[0,0,0],0,I());
    if(sample.y>0)this.draw('box',[-3.4,sample.y/2,-1.5],[.038,sample.y,.038],[.88,.5,.33,.7],[0,0,0],0,I());
    const raw=tracking?Math.max(1,distance/6):Math.max(.25,peak/5),power=10**Math.floor(Math.log10(raw));
    const step=([1,2,5,10].find(n=>n*power>=raw)||10)*power;
    const min=tracking?Math.max(0,Math.floor((sample.y-distance*.5)/step)*step):0;
    const max=tracking?sample.y+distance*.5:peak+step;
    const ticks=[];
    for(const x of [-4.5,4.5])this.draw('box',[x,peak/2,-2.7],[.016,peak,.016],[.32,.44,.5,.22],[0,0,0],0,I());
    for(let y=min;y<=max&&ticks.length<16;y+=step){
      this.draw('box',[0,y,-2.7],[9,.012,.012],[.32,.44,.5,.16],[0,0,0],0,I());
      this.draw('box',[-3.4,y,-1.5],[.3,.018,.035],[.46,.58,.61,.65],[0,0,0],0,I());
      const point=this.project([-3.65,y,-1.5]);if(point)ticks.push({height:y,point});
    }
    if(hop?.apex)this.draw('box',[-3.4,hop.peakHeight,-1.5],[.65,.028,.05],[.93,.67,.4],[0,0,0],0,I());
    this.draw('box',[-3.4,sample.y,-1.5],[.5,.04,.06],[.95,.5,.3],[0,0,0],0,I());
    const stopped=hop?.stopped;
    // Touchdown dust ring: cosmetic, timed from the moment playback reached contact.
    if(stopped&&hop?.touchdown&&age!==null&&age!==undefined&&age<2.6&&this.cam!=='hop-under'){
      const wrecked=hop.damage?.wrecked,p=Math.min(1,age/2.6),spread=(wrecked?1.6:1.1)+p*(wrecked?5.2:3);
      this.draw('ground-cloud',[0,.04,0],[spread,wrecked?1.1:.7,spread],wrecked?[.82,.76,.66,.75*(1-p)]:[1,1,1,.5*(1-p)],[0,0,0],0,I(),0,1,0,true,3.31);
    }
    const root=matrix(hopPosition(sample));
    const damage=hop?.damage??{wrecked:false,progress:0};
    const visual=stopped?{...sample,thrust:0,flow:0}:sample;
    this.car(root,cutaway,visual,c,2,'hop',false,damage);
    if(damage.wrecked)this.hopDebris(damage.progress);
    this.canvas.dataset.hopOutcome=damage.wrecked?'WRECKED':'INTACT';
    this.canvas.dataset.hopNozzles='4';
    this.canvas.dataset.hopPlumes=String(!stopped&&sample.flow>0&&sample.thrust>0?4:0);
    if(vectors){
      const weight=(c.mass+sample.gas)*9.80665,scale=2/Math.max(weight,sample.thrust,1);
      for(const [force,color,direction,x] of [[stopped?0:sample.thrust,[.97,.4,.25],1,1.65],[weight,[.48,.72,.85],-1,2.1]]){
        const length=force*scale;if(length<.02)continue;
        this.draw('box',[x,.8+direction*length/2,1.3],[.035,length,.035],color,[0,0,0],0,root);
        for(const sign of [-1,1])this.draw('box',[x+sign*.06,.8+direction*(length-.08),1.3],[.2,.035,.035],color,[0,0,sign*direction*.8],0,root);
      }
    }
    this.hopAnnotations={ticks,car:this.project([0,sample.y+1.65,0]),apex:hop?.apex?this.project([-3.4,hop.peakHeight,-1.5]):null,height:sample.y,velocity:sample.vy};
    this.canvas.dataset.hopHeight=String(sample.y);this.canvas.dataset.hopVelocity=String(sample.vy);
  }
  renderComparison({entries,c,cutaway,vectors,mode,autoFrame,w,h}){
    const active=entries.filter(e=>e.visible!==false),selected=active.find(e=>e.mode===mode)||active[0]||entries[0];
    const xs=active.map(e=>e.sample.x),focus=this.cam==='focus',cinema=this.cam==='cinema',aspect=w/h;
    const carBounds=list=>list.flatMap(e=>[-2.5,2.5].flatMap(dx=>[-1.15,1.15].flatMap(dz=>[0,1.55].map(y=>[e.sample.x+dx,y,laneZ(e.mode)+dz]))));
    // Lift the overview smoothly as the real separation grows; never compress lanes.
    const spread=Math.max(...xs)-Math.min(...xs),lift=Math.max(0,Math.min(1,(spread-8)/170));
    let view;
    if(cinema){
     const sx=selected.sample.x,T=selected.sample.t??0,shot=directorShot(T,c.boostAt??0,prefersReducedMotion());
     const dyaw=this.yaw-CAMERAS.cinema.yaw,delev=this.elev-CAMERAS.cinema.elev,user=this.zoom/6.6;
     const near=active.filter(e=>Math.abs(e.sample.x-sx)<14),mid=(Math.min(...xs)+Math.max(...xs))/2;
     const shots=[
      {weight:shot.rear,target:[sx+2.2,.7,aspect>1.3?-2.6:0],yaw:Math.PI-.42,elev:.1,points:carBounds(near.length?near:[selected])},
      {weight:shot.side,target:[sx,.65,laneZ(selected.mode)],yaw:Math.PI/2-.2,elev:.06,points:carBounds([selected]),pad:1.35},
      {weight:shot.wide,target:[mid,.65,0],yaw:.95,elev:.08+.2*lift*lift*(3-2*lift),points:carBounds(active)}
     ].filter(x=>x.weight>1e-4);
     let target=[0,0,0],yaw=0,elev=0,logD=0;
     for(const x of shots){
      // Fit in a frame centred on the shot target, then blend in log-distance for an even dolly.
      const local=x.points.map(p=>[p[0]-x.target[0],p[1],p[2]]),d=this.fit(local,[0,x.target[1],x.target[2]],aspect,x.elev,x.yaw)*(x.pad||1);
      target=target.map((v,i)=>v+x.target[i]*x.weight);yaw+=x.yaw*x.weight;elev+=x.elev*x.weight;logD+=Math.log(d)*x.weight;
     }
     const k=shot.kick,shake=k*.012;
     view={origin:target[0],target:[0,target[1],target[2]],distance:Math.exp(logD)*user,yaw:yaw+dyaw+shake*Math.sin(T*83),elevation:Math.max(-.05,elev+delev+shake*.7*Math.sin(T*71+1)),fov:.64*(1+.1*k),cars:active};
    }else{
     const origin=focus?selected.sample.x:(Math.min(...xs)+Math.max(...xs))/2;
     const autoLift=this.cam==='field'?.20*lift*lift*(3-2*lift):0;
     if(autoFrame||!this.frozenFrame)this.frozenFrame={origin,z:focus?laneZ(mode):0,autoLift};
     const frame=autoFrame?{origin,z:focus?laneZ(mode):0,autoLift}:this.frozenFrame;
     const elevation=this.elev+(frame.autoLift??0),cars=focus?active.filter(e=>e.mode===mode):active;
     const local=carBounds(cars).map(p=>[p[0]-frame.origin,p[1],p[2]]);
     const required=this.fit(local.length?local:[[0,0,0]],[0,.65,frame.z],aspect,elevation);
     if(autoFrame||!this.frozenDistance)this.frozenDistance=required;
     view={origin:frame.origin,target:[0,.65,frame.z],distance:(autoFrame?required:this.frozenDistance)*this.zoom/6.6,yaw:this.yaw,elevation,fov:.64,cars};
    }
    this.frameX=view.origin;
    const allCars=launchPlacements(entries,this.frameX),shown=new Set(view.cars.map(e=>e.mode)),cars=allCars.filter(e=>shown.has(e.mode));
    const {eye,vp}=this.camera(view.target,view.distance,aspect,view.elevation,view.yaw,view.fov);this.vp=vp;this.dist=view.distance;
    const gl=this.gl;gl.uniform3fv(this.loc.uEye,eye);gl.uniform1f(this.loc.uTravel,this.frameX);
    gl.uniform1f(this.loc.uFogK,Math.max(1,view.distance/16));gl.uniform1f(this.loc.uLanes,1);
    const shadows=new Float32Array(9);cars.forEach((e,i)=>shadows.set([e.x,e.z,.62],i*3));gl.uniform3fv(this.loc.uShadows,shadows);
    this.environment(eye);
    const span=Math.max(160,...cars.map(e=>Math.abs(e.x)*2+140)),back=Math.min(-span/2,-this.frameX-40);
    this.draw('box',[(back+span/2)/2,-.08,0],[span/2-back,.1,70],[.08,.1,.09],[0,0,0],0,I(),1,.9,0);
    this.trackside(xs,eye);
    for(const e of cars){
      if(e.sample.x>0)this.draw('box',[e.sample.x/2-this.frameX,.004,e.z],[e.sample.x,.008,.075],[...SCENARIO_COLORS[e.mode].rgb,.3],[0,0,0],0,I(),0,.6);
      this.tireMarks(e);
      this.locator([e.x,0,e.z],SCENARIO_COLORS[e.mode].rgb,view.distance);
      const root=matrix([e.x,0,e.z]);
      const visual=e.unsupported&&e.status!=='ACTIVE'?{...e.sample,thrust:0,flow:0}:e.sample;
      this.car(root,cutaway&&e.mode===mode,visual,c,e.mode,'launch',false);
      if(vectors&&e.mode===mode){
        const arrow=(length,color,y)=>{if(length<.02)return;this.draw('box',[length/2,y,1.3],[length,.035,.035],color,[0,0,0],0,root);for(const sign of [-1,1])this.draw('box',[length-.1,y+sign*.06,1.3],[.22,.025,.025],color,[0,0,sign*.6],0,root);};
        arrow(e.sample.tire/17000,[.56,.83,.66],.25);arrow(e.sample.thrust/13000,[.97,.34,.22],.7);
      }
    }
    this.annotations=cars.map(e=>({mode:e.mode,point:this.project([e.sample.x,1.65,e.z]),x:e.sample.x,status:e.status}));
    const min=0,max=Math.max(...xs)+60;
    this.distanceMarks=[];
    for(let x=min;x<=max&&this.distanceMarks.length<16;x+=50){const point=this.project([x,2.55,-7.4]);if(point)this.distanceMarks.push({x,point});}
  }
  // Wide shots: a soft beacon in the car's colour so distant cars stay findable (display only).
  locator([x,y,z],rgb,distance){
    const k=Math.max(0,Math.min(1,(distance-40)/60));if(k<=0)return;
    const h=distance*.07,w=Math.max(.18,distance*.006);
    this.draw('box',[x,y+1.4+h/2,z],[w,h,w],[...rgb,.32*k],[0,0,0],0,I(),0,1,.9,true);
    this.draw('cyl',[x,y+.02,z],[2.6+distance*.01,2.6+distance*.01,.01],[...rgb,.22*k],[Math.PI/2,0,0],0,I(),0,1,.6,true);
  }
  // Trackside parallax cues: distance boards every 50 m and edge posts every 10 m. Purely visual.
  trackside(xs,eye){
    const hi=Math.max(...xs)+160,near=0;
    for(let x=Math.ceil(near/10)*10;x<=hi;x+=10){
      if(x%50===0){
        const p=x-this.frameX;
        this.draw('box',[p,1.05,-7.4],[.14,2.1,.14],[.16,.2,.21],[0,0,0],.4,I(),0,.5);
        this.draw('box',[p,2.35,-7.4],[1.9,.72,.09],[.09,.13,.14],[0,0,0],.3,I(),0,.45);
        this.draw('box',[p,2.74,-7.4],[1.9,.06,.1],[.62,.86,.76],[0,0,0],0,I(),0,.4,.6);
        this.draw('box',[p,.012,0],[.18,.02,10.2],[.58,.66,.62],[0,0,0],0,I(),0,.6);
      }
      for(const z of [-5.75,5.75]){
        const p=x-this.frameX,coral=(x/10)%2===0;
        this.draw('box',[p,.38,z],[.09,.76,.09],coral?[.86,.36,.28]:[.86,.9,.88],[0,0,0],0,I(),0,.5,coral?.25:0);
      }
    }
  }
  // Rubber laid down only while the solver reports a traction-limited launch. Display only.
  tireMarks(e){
    const end=Math.min(e.sample.x,e.marks??0);if(!(end>.3))return;
    const fade=Math.min(1,end/6);
    for(const z of [-.81,.81])this.draw('box',[end/2-this.frameX-1.45,.006,e.z+z],[end,.004,.2],[.02,.02,.022,.5*fade],[0,0,0],0,I(),0,.95,0,true);
  }
  car(root,cut,s,c,mode,experiment,ghost=false,damage={wrecked:false,progress:0}){
    const paint=SCENARIO_COLORS[experiment==='invert'?1:experiment==='hop'?2:mode].rgb;
    const chassisRoot=root,crush=damage.wrecked?damage.progress:0;
    if(crush)root=mul(root,matrix([0,.02,0],[1.06,1-.48*crush,1.03],[.04*crush,0,.025*crush]));
    if(cut&&!ghost)this.annotateVessel(root);
    const red=[.92,.12,.08];
    if(experiment==='invert')this.draw('box',[0,.006,0],[4.4,.006,1.95],[.02,.02,.022,.4],[0,0,0],0,root,0,.95);
    if(!cut){for(const m of this.bodyMats){const M=CAR.MATS[m];this.drawM('car:'+m,root,m==='paint'?(ghost?[...paint,.4]:crush?paint.map(v=>v*(1-.5*crush)):paint):ghost?ghostColor(m):M.c,{metal:M.metal,rough:M.rough,spec:ghost?0:M.spec,emit:ghost?0:M.emit,ao:M.ao});}}
    else{
      this.draw('box',[.35,.38,0],[2.45,.12,1.4],[.18,.24,.22],[0,0,0],.55,root,0,.4);
      for(let i=-4;i<5;i++)this.draw('box',[.35+i*.24,.45,0],[.014,.025,1.35],[.38,.42,.4],[0,0,0],.35,root,0,.4);
      for(const z of [-.46,.46]){const cold=Math.max(0,Math.min(1,(293.15-s.temp)/150)),col=[.827-.408*cold,.647+.145*cold,.490+.447*cold];this.draw('cyl',[-.6,.72,z],[.275,.275,2.28],[col[0],col[1],col[2],.22],[0,Math.PI/2,0],0,root,0,.25);this.draw('cyl',[-.6,.72,z],[.24,.24,2.2],col,[0,Math.PI/2,0],.7,root,0,.18);for(const x of [-1.4,-.6,.2])this.draw('cyl',[x,.72,z],[.253,.253,.055],[.13,.17,.15],[0,Math.PI/2,0],.8,root,0,.3);this.draw('box',[-1.82,.65,z],[.6,.035,.035],red,[0,0,0],.5,root,0,.3);}
      this.draw('box',[1.25,.62,0],[.62,.34,1.05],[.12,.15,.14],[0,0,0],.65,root,0,.35);
      for(const m of this.bodyMats){const M=CAR.MATS[m];if(M.emit){this.drawM('car:'+m,root,M.c,{emit:M.emit});continue;}const a=m==='paint'?.13:m.startsWith('glass')?.16:.24;this.drawM('car:'+m,root,[...(m==='paint'?paint:M.c),a],{rough:.45,glass:true});}
    }
    const spin=(s.distance??s.x)/CAR.WHEELS[0].r;
    CAR.WHEELS.forEach((w,i)=>{for(const side of [1,-1]){const wheelRoot=mul(chassisRoot,matrix([crush*(i===0?1:-1)*.65,crush*.04,crush*side*.6],[1,1,1],[crush*side*.7,crush*side*.35,crush*.3])),positioned=mul(wheelRoot,matrix([w.x,w.y,w.z*side],[1,1,1],[0,experiment==='turn'&&i===0?(s.steer??0):0,0]));const still=mul(positioned,matrix([0,0,0],[1,1,side])),turn=mul(positioned,matrix([0,0,0],[1,1,side],[0,0,-spin]));
      for(const part of this.wheelMeshes[i]){const M=CAR.WHEEL_MATS[part.m];this.drawM(part.mesh,part.spin?turn:still,ghost?(part.m==='tire'?[.08,.09,.09,.45]:GHOST.dark):M.c,{metal:M.metal,rough:M.rough,spec:ghost?0:M.spec,mirror:side});}
      // Spoke blur: a translucent rim disc fades in with wheel speed (display only).
      const blur=ghost||crush?0:Math.max(0,Math.min(.72,((Math.abs(s.v??0))-6)/26));
      if(blur>.02)this.draw('cyl',[0,0,w.w*.43],[.25,.25,.012],[.16,.19,.2,blur],[0,0,0],.5,still,0,.35,0,true);}});
    if(experiment==='hop'&&!crush){
      // Four physical mounts, with the same total effective area as the solver.
      for(const [x,y,z] of HOP_MOUNTS){
        this.draw('box',[x,.23,z],[.32,.16,.28],[.13,.17,.18],[0,0,0],.65,root);
        this.draw('cyl',[x,y,z],[.115,.115,.18],[.5,.55,.56],[Math.PI/2,0,0],.8,root,0,.25);
        this.draw('cyl',[x,y-.095,z],[.079,.079,.012],[.018,.025,.026],[Math.PI/2,0,0],.2,root);
        const plume=coldGasVisual(s,true);
        if(plume.active&&!ghost){
          const seed=(x>0?.11:.03)+(z>0?.05:0);
          this.draw('plume',[x,y-.11,z],[.13,.13,plume.core],[.95,.97,1,.44],[Math.PI/2,0,0],0,root,0,1,0,true,1+seed);
          this.draw('gas-cloud',[x,y-.11,z],[plume.spread,plume.spread,plume.length],[1,1,1,plume.opacity],[Math.PI/2,0,0],0,root,0,1,0,true,2+seed);
        }
      }
      const plume=coldGasVisual(s,true);
      if(plume.ground>0&&!ghost&&this.cam!=='hop-under'){
        const spread=1.5+plume.ground*1.3+Math.min(2,(s.y||0)*.16);
        this.draw('ground-cloud',[0,.04-(s.y||0),0],[spread,.8,spread],[1,1,1,.60*plume.ground],[0,0,0],0,root,0,1,0,true,3.07);
      }
    }else if(experiment==='launch'&&mode===2&&!ghost){
      const plume=coldGasVisual(s);
      if(plume.active)for(const [i,z] of [-.47,-.17,.17,.47].entries()){
        const seed=.03+i*.07;
        this.draw('plume',[-2.20,.548,z],[.13,.13,plume.core],[.95,.97,1,.48],[0,-Math.PI/2,0],0,root,0,1,0,true,1+seed);
        this.draw('gas-cloud',[-2.20,.548,z],[plume.spread,plume.spread,plume.length],[1,1,1,plume.opacity],[0,-Math.PI/2,0],0,root,0,1,0,true,2+seed);
      }
    }
  }

  hopDebris(progress,parent=I()){
    // Display-only fragments and dust, reconstructed from a single visual clock.
    // Fixed indices replace randomness so pause, replay and scrubbing are stable.
    for(let i=0;i<16;i++){
      const angle=i*2.39996,r=.5+progress*(.8+(i%5)*.3),y=.08+Math.sin(Math.PI*progress)*(.3+i%3*.2);
      this.draw('box',[Math.cos(angle)*r,y,Math.sin(angle)*r],[.12+i%3*.04,.035,.09],[.22,.25,.25],[progress*i,.3*i,progress*3],.5,parent);
      if(progress<1)this.draw('cyl',[Math.cos(angle)*r,.1+progress*.4,Math.sin(angle)*r],[.15+progress*.3,.15+progress*.3,.05],[.48,.45,.4,(1-progress)*.08],[Math.PI/2,0,0],0,parent,0,1,0,true);
    }
    // Broken windshield / buckled hood; no combustion or pressure-vessel explosion.
    this.draw('box',[.7,.35,.05],[1.2,.045,.7],[.13,.15,.16],[0,.15,.22],.4,parent);
    for(let i=0;i<5;i++)this.draw('box',[.2+i*.14,.57-i*.025,.08],[.025,.025,.7],[.55,.6,.61,.8],[0,.2,0],.2,parent);
  }

  reset(){this.setCamera(this.cam);this.frameX=0;this.frozenFrame=null;this.frozenDistance=null;}
  dispose(){this.alive=false;const P=this.post;if(P){for(const t of [P.scene,P.a,P.b]){this.gl.deleteTexture(t.tex);if(t.fb)this.gl.deleteFramebuffer(t.fb);}this.gl.deleteBuffer(P.quad);for(const k of ['bright','blur','add','vignette'])this.gl.deleteProgram(P[k].p);this.post=null;}for(const mesh of Object.values(this.meshes)){this.gl.deleteBuffer(mesh.pb);this.gl.deleteBuffer(mesh.nb);}this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
