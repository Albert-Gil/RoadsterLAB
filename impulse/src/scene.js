export const SCENARIO_COLORS = [
  {name:'Electric only',hex:'#dce1e5',rgb:[.86,.88,.9]},
  {name:'Fan assisted',hex:'#59cbdc',rgb:[.35,.80,.86]},
  {name:'Thrust assisted',hex:'#ef7955',rgb:[.94,.47,.33]}
];
// Native WebGL renderer. Original procedural Roadster built from designed character lines; Lambert lighting, no environment reflections.
const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function matrix(p=[0,0,0],s=[1,1,1],r=[0,0,0]){const [x,y,z]=r,c=Math.cos,d=Math.sin;const rx=[1,0,0,0,0,c(x),d(x),0,0,-d(x),c(x),0,0,0,0,1],ry=[c(y),0,-d(y),0,0,1,0,0,d(y),0,c(y),0,0,0,0,1],rz=[c(z),d(z),0,0,-d(z),c(z),0,0,0,0,1,0,0,0,0,1];let m=mul(mul(rz,ry),rx);for(let j=0;j<3;j++)for(let i=0;i<3;i++)m[j*4+i]*=s[j];m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;}
const sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);},dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
function view(eye,target){const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
function perspective(aspect){const f=Math.min(1,aspect/1.6)/Math.tan(.5/2),n=.1,far=160;return [f/aspect,0,0,0,0,f,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0];}
function triangles(faces){const p=[],n=[];for(const f of faces){for(let i=1;i<f.length-1;i++){const a=f[0],b=f[i],c=f[i+1],v=norm(cross(sub(b,a),sub(c,a)));p.push(...a,...b,...c);n.push(...v,...v,...v);}}return {p,n};}
function box(){const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];return triangles([[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[1,2,6,5],[0,4,7,3]].map(f=>f.map(i=>v[i])));}
function cylinder(){const f=[],seg=48;for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2;const p=t=>[Math.cos(t),Math.sin(t)];const [x,y]=p(a),[u,v]=p(b);f.push([[x,y,-.5],[u,v,-.5],[u,v,.5],[x,y,.5]],[[0,0,.5],[x,y,.5],[u,v,.5]],[[0,0,-.5],[u,v,-.5],[x,y,-.5]]);}return triangles(f);}

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
  paint:{c:[.86,.87,.858],metal:.18,rough:.24,spec:.42,ao:.55},
  blade:{c:[.80,.815,.81],metal:.3,rough:.22,spec:.35,ao:.3},
  glassD:{c:[.03,.034,.038],metal:.1,rough:.04,spec:1},
  glassS:{c:[.20,.15,.11],metal:.1,rough:.05,spec:.9},
  black:{c:[.022,.023,.026],metal:.2,rough:.16,spec:.45},
  satin:{c:[.042,.044,.047],rough:.85},
  well:{c:[.028,.03,.032],rough:.95},
  chrome:{c:[.72,.74,.75],metal:.9,rough:.12,spec:.6},
  light:{c:[.95,.97,1],emit:2.2},
  red:{c:[.95,.10,.06],emit:2},
  amber:{c:[1,.55,.12],emit:1.1},
  plate:{c:[.93,.93,.9],emit:.22}
};
const WHEEL_MATS={tire:{c:[.035,.035,.038],rough:.85},lip:{c:[.07,.075,.08],metal:.7,rough:.2,spec:.4},barrel:{c:[.62,.63,.64],metal:.5,rough:.35},disc:{c:[.88,.86,.85],metal:.1,rough:.45},spokes:{c:[.03,.031,.035],metal:.3,rough:.18,spec:.5},hub:{c:[.04,.04,.045],metal:.4,rough:.25},emblem:{c:[.75,.76,.77],metal:.8,rough:.2}};

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
const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uMVP;uniform mat4 uModel;varying vec3 vNormal;varying vec3 vWorld;varying float vLocalY;void main(){vWorld=(uModel*vec4(aPosition,1.)).xyz;vNormal=mat3(uModel)*aNormal;vLocalY=aPosition.y;gl_Position=uMVP*vec4(aPosition,1.);}`;
const fragment=`precision highp float;varying vec3 vNormal;varying vec3 vWorld;varying float vLocalY;uniform vec4 uColor;uniform vec3 uEye;uniform float uMetal;uniform float uFloor;uniform float uTravel;uniform float uRough;uniform float uEmit;uniform float uSpec;uniform float uMirror;uniform float uAO;uniform vec4 uShadow;
void main(){
  vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;n*=uMirror;
  vec3 v=normalize(uEye-vWorld);
  vec3 l=normalize(vec3(.42,.88,.28));
  vec3 fill=normalize(vec3(-.62,.24,-.55));
  float ndl=max(dot(n,l),0.);
  float ndf=max(dot(n,fill),0.);
  float hemi=n.y*.5+.5;
  float ao=mix(1.,.5+.5*smoothstep(.04,.62,vLocalY),uAO);
  vec3 albedo=uColor.rgb;
  vec3 color=albedo*(.16+.22*hemi+.62*ndl+.24*ndf+.10*max(dot(n,v),0.))*ao;
  float sheen=pow(max(dot(n,normalize(l+v)),0.),mix(90.,12.,uRough))*mix(.12,.012,uRough);
  float rim=pow(1.-max(dot(n,v),0.),4.);
  color+=(vec3(sheen)*(1.-uMetal*.2)*(1.+uSpec*2.)+uSpec*rim*.08*hemi)*ao;
  // Broad studio reflection and cool edge light reveal body curvature.
  vec3 reflection=reflect(-v,n);
  float softbox=pow(max(dot(reflection,normalize(vec3(-.25,.92,.3))),0.),18.);
  color+=vec3(.72,.83,.91)*softbox*uSpec*.24;
  color+=vec3(.35,.55,.65)*rim*ndf*.055;
  color+=albedo*uEmit;
  if(uFloor>.5){
    float gx=step(.988,fract((vWorld.x+uTravel)*.45));float gz=step(.988,fract(vWorld.z*.45));
    float fade=exp(-length(vWorld.xz)*.038);
    color=vec3(.042,.05,.048)+vec3(.028,.036,.034)*max(gx,gz)*fade;
    float lane=step(abs(abs(vWorld.z)-2.55),.02);color+=lane*vec3(.16,.2,.18)*fade;
    float dash=step(abs(vWorld.z),.014)*step(.5,fract((vWorld.x+uTravel)*.18));color+=dash*.11*fade;
    vec2 q=abs(vWorld.xz-uShadow.xy)-vec2(2.,.78);float sd=length(max(q,0.))+min(max(q.x,q.y),0.);
    color*=1.-uShadow.z*(1.-smoothstep(-.25,.75,sd));
  }
  float fog=1.-exp(-length(uEye-vWorld)*.012);color=mix(color,vec3(.045,.052,.05),fog);
  gl_FragColor=vec4(color,uColor.a);
}`;
const GHOST={paint:[.62,.66,.64,.4],glass:[.05,.07,.08,.3],lit:[.7,.75,.78,.3],dark:[.06,.07,.07,.42]};
const ghostColor=m=>m==='paint'||m==='blade'?GHOST.paint:m==='glassD'||m==='glassS'?GHOST.glass:['light','red','amber','plate','chrome'].includes(m)?GHOST.lit:GHOST.dark;
export class Scene {
  constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL is unavailable. Try enabling hardware acceleration.');this.gl=gl;this.yaw=.88;this.elev=.22;this.zoom=6.6;this.cut=false;this.shot={yaw:.84,elev:.2,zoom:6.1};
    const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
    const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.useProgram(p);this.program=p;
    this.loc={};for(const x of ['uMVP','uModel','uColor','uEye','uMetal','uFloor','uTravel','uRough','uEmit','uSpec','uMirror','uAO','uShadow'])this.loc[x]=gl.getUniformLocation(p,x);
    this.ap=gl.getAttribLocation(p,'aPosition');this.an=gl.getAttribLocation(p,'aNormal');this.meshes={};
    this.upload('box',box());this.upload('cyl',cylinder());
    const geo=CAR.build();this.bodyMats=Object.keys(geo.body);for(const m of this.bodyMats)this.upload('car:'+m,geo.body[m]);
    this.wheelMeshes=geo.wheels.map((wp,i)=>{const list=[];for(const part of ['spin','fixed'])for(const [m,d] of Object.entries(wp[part])){this.upload(`w${i}:${part}:${m}`,d);list.push({mesh:`w${i}:${part}:${m}`,m,spin:part==='spin'});}return list;});
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    this.ptrs=new Map();this.pinch=0;let drag=null;
    const pt=(e)=>({x:e.clientX,y:e.clientY});
    const pinchSpan=()=>{const pts=[...this.ptrs.values()];return Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);};
    canvas.addEventListener('pointerdown',e=>{this.ptrs.set(e.pointerId,pt(e));canvas.setPointerCapture(e.pointerId);if(this.ptrs.size===2){this.pinch=pinchSpan();drag=null;}else drag=[e.clientX,e.clientY];});
    canvas.addEventListener('pointermove',e=>{if(this.ptrs.has(e.pointerId))this.ptrs.set(e.pointerId,pt(e));if(this.ptrs.size===2){const span=pinchSpan();if(this.pinch)this.nudgeZoom((this.pinch-span)*.02);this.pinch=span;drag=null;return;}if(!drag)return;this.yaw+=(e.clientX-drag[0])*.008;this.elev=Math.max(-.1,Math.min(1.1,this.elev+(e.clientY-drag[1])*.005));drag=[e.clientX,e.clientY];});
    const release=e=>{this.ptrs.delete(e.pointerId);this.pinch=0;if(this.ptrs.size===0)drag=null;};
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.nudgeZoom(e.deltaY*.005);},{passive:false});
    canvas.addEventListener('keydown',e=>{const yaw=.08,elev=.05;if(e.key==='ArrowLeft'){this.yaw-=yaw;e.preventDefault();}if(e.key==='ArrowRight'){this.yaw+=yaw;e.preventDefault();}if(e.key==='ArrowUp'){this.elev=Math.min(1.1,this.elev+elev);e.preventDefault();}if(e.key==='ArrowDown'){this.elev=Math.max(-.1,this.elev-elev);e.preventDefault();}if(e.key==='+'||e.key==='='){this.nudgeZoom(-.45);e.preventDefault();}if(e.key==='-'||e.key==='_'){this.nudgeZoom(.45);e.preventDefault();}if(e.key==='0'){this.reset();e.preventDefault();}});
    this.alive=true;canvas._impulse=this;
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(!this.alive)return;const el=document.getElementById('scene-error');if(el){el.hidden=false;el.textContent='WebGL context was lost. Reload the experiment.';}});
  }
  upload(name,data){const gl=this.gl,pb=gl.createBuffer(),nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.p),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.n),gl.STATIC_DRAW);this.meshes[name]={pb,nb,count:data.p.length/3};}
  nudgeZoom(delta){this.zoom=Math.max(5.2,Math.min(15,this.zoom+delta));}
  easeToward(target,k){const a=Math.max(0,Math.min(1,k));this.yaw+=(target.yaw-this.yaw)*a;this.elev+=(target.elev-this.elev)*a;this.zoom+=(target.zoom-this.zoom)*a;}
  drawM(mesh,m,color,o={}){
    const gl=this.gl,g=this.meshes[mesh];
    if(!g)return;
    if(o.glass)gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER,g.pb);gl.enableVertexAttribArray(this.ap);gl.vertexAttribPointer(this.ap,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,g.nb);gl.enableVertexAttribArray(this.an);gl.vertexAttribPointer(this.an,3,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(this.loc.uMVP,false,mul(this.vp,m));gl.uniformMatrix4fv(this.loc.uModel,false,m);
    gl.uniform4fv(this.loc.uColor,color.length===4?color:[...color,1]);gl.uniform1f(this.loc.uMetal,o.metal||0);gl.uniform1f(this.loc.uFloor,o.floor||0);gl.uniform1f(this.loc.uRough,o.rough??.45);gl.uniform1f(this.loc.uEmit,o.emit||0);
    gl.uniform1f(this.loc.uSpec,o.spec||0);gl.uniform1f(this.loc.uMirror,o.mirror||1);gl.uniform1f(this.loc.uAO,o.ao||0);
    gl.drawArrays(gl.TRIANGLES,0,g.count);
    if(o.glass)gl.depthMask(true);
  }
  draw(mesh,p,s,color,r=[0,0,0],metal=0,parent=I(),floor=0,rough=.45,emit=0,glass=false){this.drawM(mesh,mul(parent,matrix(p,s,r)),color,{metal,floor,rough,emit,glass});}
  render({sample,hopScale=.55,c,experiment,cutaway,vectors,compare,ghosts,mode,invert}){const gl=this.gl,w=this.canvas.clientWidth,h=this.canvas.clientHeight,dpr=Math.min(devicePixelRatio,2);if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=w*dpr;this.canvas.height=h*dpr;}gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(.045,.052,.05,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const target=experiment==='invert'?[0,1.7,0]:[0,.5,0],eye=[Math.cos(this.yaw)*this.zoom,target[1]+Math.sin(this.elev)*this.zoom,Math.sin(this.yaw)*this.zoom];this.vp=mul(perspective(w/h),view(eye,target));gl.uniform3fv(this.loc.uEye,eye);gl.uniform1f(this.loc.uTravel,sample.x);
    const lift=experiment==='invert'?0:sample.y*hopScale;
    gl.uniform4fv(this.loc.uShadow,[0,0,experiment==='invert'?0:.62*Math.exp(-lift*1.6),0]);
    this.draw('box',[0,-.08,0],[110,.1,110],[.08,.1,.09],[0,0,0],0,I(),1,.9,0);
    if(experiment==='launch'){for(let i=-5;i<7;i++){let x=i*4-(sample.x%4);this.draw('box',[x,-.005,-2.56],[.08,.012,.22],[.38,.44,.4],[0,0,0],.2,I(),0,.6);}if(sample.v>8){const span=Math.min(2.2,sample.v*.03);for(let i=0;i<6;i++){const x=-1.2-i*.55-(sample.x%0.4);this.draw('box',[x,.04,1.05-(i%2)*.2],[span,.008,.012],[.72,.82,.78,.16],[0,0,0],0,I(),0,.4);}}}
    let root=matrix([0,experiment==='invert'?1.8:lift,0],[1,1,1],[0,0,experiment==='invert'?c.angle*Math.PI/180:0]);
    if(experiment==='invert'){this.draw('box',[0,-.16,0],[6,.22,3.1],[.18,.22,.21],[0,0,0],.55,root,0,.4);for(const z of [-1.5,1.5])this.draw('box',[0,-.02,z],[6,.035,.03],[.88,.28,.17],[0,0,0],.5,root,0,.35);this.draw('cyl',[0,1.8,-1.8],[.25,.25,.7],[.3,.34,.32],[0,0,0],.4,root,0,.45);this.draw('box',[0,.7,-2],[.3,2.2,.3],[.14,.18,.16],[0,0,0],.3,root,0,.5);}
    this.car(root,cutaway,sample,c,mode,experiment);
    if(compare&&experiment==='launch')for(let i=0;i<ghosts.length;i++){const delta=Math.max(-7,Math.min(2,(ghosts[i].x-sample.x)*.25));this.car(matrix([delta,0,-3.5-i*3.05]),false,ghosts[i],c,i,experiment,true);}
    if(vectors){const green=[.56,.83,.66],red=[.97,.34,.22],blue=[.38,.68,.82];const arrow=(p,length,color,rot)=>{if(length<.05)return;const group=mul(root,matrix(p,[1,1,1],[0,0,rot]));this.draw('box',[length/2,0,0],[length,.025,.025],color,[0,0,0],0,group,0,.35);for(const z of [-1,1])this.draw('box',[length-.1,z*.06,0],[.22,.025,.025],color,[0,0,z*.6],0,group,0,.35);};if(experiment==='launch'){arrow([.9,.15,1.3],sample.tire/17000,green,0);arrow([-2.2,.8,0],sample.thrust/13000,red,0);if(mode>0)arrow([0,.35,1.25],sample.downforce/22000,blue,-Math.PI/2);}else if(experiment==='hop')arrow([0,.8,1.3],sample.thrust/16000,red,Math.PI/2);else if(experiment==='invert'&&invert){arrow([0,.22,1.15],Math.max(0,invert.normal)/22000,green,Math.PI/2);arrow([0,.48,1.28],invert.downforce/22000,blue,-Math.PI/2);arrow([.95,.18,1.3],invert.demand/17000,red,Math.PI);}}
  }
  car(root,cut,s,c,mode,experiment,ghost=false){
    const paint=SCENARIO_COLORS[experiment==='invert'?1:experiment==='hop'?2:mode].rgb;
    const red=[.92,.12,.08];
    if(experiment==='invert')this.draw('box',[0,.006,0],[4.4,.006,1.95],[.02,.02,.022,.4],[0,0,0],0,root,0,.95);
    if(!cut){for(const m of this.bodyMats){const M=CAR.MATS[m];this.drawM('car:'+m,root,m==='paint'?(ghost?[...paint,.4]:paint):ghost?ghostColor(m):M.c,{metal:M.metal,rough:M.rough,spec:ghost?0:M.spec,emit:ghost?0:M.emit,ao:M.ao});}}
    else{
      this.draw('box',[.35,.38,0],[2.45,.12,1.4],[.18,.24,.22],[0,0,0],.55,root,0,.4);
      for(let i=-4;i<5;i++)this.draw('box',[.35+i*.24,.45,0],[.014,.025,1.35],[.38,.42,.4],[0,0,0],.35,root,0,.4);
      for(const z of [-.46,.46]){const hot=Math.max(0,(s.temp-150)/300),cold=Math.max(0,(293-s.temp)/500),col=[.28+hot*.55,.38+cold*.12,.5+cold*.45];this.draw('cyl',[-.6,.72,z],[.275,.275,2.28],[col[0],col[1],col[2],.22],[0,Math.PI/2,0],0,root,0,.25);this.draw('cyl',[-.6,.72,z],[.24,.24,2.2],col,[0,Math.PI/2,0],.7,root,0,.18);for(const x of [-1.4,-.6,.2])this.draw('cyl',[x,.72,z],[.253,.253,.055],[.13,.17,.15],[0,Math.PI/2,0],.8,root,0,.3);this.draw('box',[-1.82,.65,z],[.6,.035,.035],red,[0,0,0],.5,root,0,.3);}
      this.draw('box',[1.25,.62,0],[.62,.34,1.05],[.12,.15,.14],[0,0,0],.65,root,0,.35);
      for(const m of this.bodyMats){const M=CAR.MATS[m];if(M.emit){this.drawM('car:'+m,root,M.c,{emit:M.emit});continue;}const a=m==='paint'?.13:m.startsWith('glass')?.16:.24;this.drawM('car:'+m,root,[...(m==='paint'?paint:M.c),a],{rough:.45,glass:true});}
    }
    const spin=s.x/CAR.WHEELS[0].r;
    CAR.WHEELS.forEach((w,i)=>{for(const side of [1,-1]){const still=mul(root,matrix([w.x,w.y,w.z*side],[1,1,side])),turn=mul(root,matrix([w.x,w.y,w.z*side],[1,1,side],[0,0,-spin]));
      for(const part of this.wheelMeshes[i]){const M=CAR.WHEEL_MATS[part.m];this.drawM(part.mesh,part.spin?turn:still,ghost?(part.m==='tire'?[.08,.09,.09,.45]:GHOST.dark):M.c,{metal:M.metal,rough:M.rough,spec:ghost?0:M.spec,mirror:side});}}});
    const jet=s.thrust>100&&!ghost&&(experiment==='hop'?s.y>0.04||s.vy>1:s.v>2);
    if((mode===2||experiment==='hop')&&jet){for(const z of [-.47,-.17,.17,.47]){const len=Math.min(2.4,s.flow*.07+s.thrust/80000);for(let i=0;i<10;i++){const fade=(1-i/10)*.2;const pos=experiment==='hop'?[-1.7,-i*len/8,z]:[-2.19-i*len/8,.548,z];this.draw('cyl',pos,[.05+i*.03,.05+i*.03,.16],[.78,.94,.95,fade],experiment==='hop'?[Math.PI/2,0,0]:[0,Math.PI/2,0],0,root,0,.15,1.2+i*.08);}}}
  }
  reset(){this.yaw=.88;this.elev=.22;this.zoom=6.6;}
  dispose(){this.alive=false;for(const mesh of Object.values(this.meshes)){this.gl.deleteBuffer(mesh.pb);this.gl.deleteBuffer(mesh.nb);}this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
