// Original, decorative Starbase-inspired scenery. SI geometry, no solver inputs,
// collisions, live site data or external assets. Static meshes are batched by material.
export const SCENERY_NAME='STARBASE-INSPIRED / SUNRISE';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Decorative dunes stay outside the experiment area and clear of campus foundations.
export function coastalHeight(x,z){
 const edge=smooth(-930,-850,z)*(1-smooth(-240,-180,z));
 const foundation=(cx,cz,w,d)=>1-smooth(0,30,Math.max(Math.abs(x-cx)-w,Math.abs(z-cz)-d));
 const clear=Math.max(foundation(-200,-555,310,165),foundation(140,-245,32,20));
 const ridge=.5+.28*Math.sin(x*.019+Math.sin(z*.014))+.22*Math.sin(z*.031+x*.006);
 return edge*(1-clear)*(.25+3.2*ridge*ridge);
}
export const sceneryShader=`
vec3 siteLinear(vec3 c){return pow(max(c,vec3(0.)),vec3(2.2));}
vec3 siteDisplay(vec3 c){c=max(c,vec3(0.));return pow(clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.),vec3(1./2.2));}
float siteHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float siteNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(siteHash(i),siteHash(i+vec2(1.,0.)),f.x),mix(siteHash(i+vec2(0.,1.)),siteHash(i+vec2(1.,1.)),f.x),f.y);}
float siteFbm(vec2 p){return .57*siteNoise(p)+.28*siteNoise(p*2.07+13.7)+.15*siteNoise(p*4.13-7.2);}
vec3 siteSky(vec3 ray){
 float h=max(ray.y,0.);vec3 sun=normalize(vec3(-.56,.12,-.81));
 vec3 sky=mix(vec3(.97,.72,.53),vec3(.36,.61,.82),smoothstep(.015,.30,h));
 sky=mix(sky,vec3(.15,.39,.70),smoothstep(.35,1.,h)*.60);
 float alignment=max(dot(ray,sun),0.);
 sky+=vec3(1.,.66,.32)*pow(alignment,18.)*.22;
 sky+=vec3(1.,.81,.52)*pow(alignment,180.)*.36;
 sky+=vec3(1.,.92,.72)*smoothstep(.99988,.99997,alignment)*3.5;
 if(h>.015){
  vec2 uv=ray.xz/max(.12,h)*1.7;float clouds=siteFbm(uv*vec2(.65,1.6)+vec2(4.,11.));
  float cloud=smoothstep(.51,.76,clouds)*smoothstep(.015,.11,h)*(1.-smoothstep(.55,.85,h));
  sky=mix(sky,mix(vec3(.64,.68,.75),vec3(1.,.89,.75),clouds),cloud*.75);
 }
 return siteLinear(mix(vec3(.72,.74,.72),sky,smoothstep(-.07,.025,ray.y)));
}
`;

const MATERIALS={
 steel:{color:[.46,.51,.54],metal:.8,rough:.28,spec:.8},
 rocket:{color:[.66,.70,.73],metal:.94,rough:.23,spec:1},
 dark:{color:[.13,.17,.19],metal:.55,rough:.45,spec:.35},
 white:{color:[.79,.80,.76],metal:.18,rough:.4,spec:.25},
 concrete:{color:[.49,.49,.44],rough:.95},
 glass:{color:[.12,.25,.30],metal:.45,rough:.13,spec:1},
 heatshield:{color:[.055,.065,.074],rough:.77},
 warm:{color:[1,.68,.30],emit:.8},
 paint:{color:[.81,.75,.56],rough:.9},
 green:{color:[.24,.32,.19],rough:1},
 sand:{color:[.48,.44,.31],rough:1},
 straw:{color:[.51,.48,.28],rough:1},
 coast:{color:[.33,.39,.26],floor:4,rough:1},
 water:{color:[.24,.45,.51],floor:5,rough:.22}
};
// Pure geometry builder: deterministic, cached once in CPU memory, uploaded once per Scene.
let cached;
export function sceneryMeshes(){
 if(cached)return cached;
 const groups=Object.fromEntries(Object.keys(MATERIALS).map(k=>[k,{p:[],n:[]}]));
 const unit=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const tri=(mat,a,b,c,normal)=>{const n=normal||unit(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i]))),g=groups[mat];g.p.push(...a,...b,...c);g.n.push(...n,...n,...n);};
 const quad=(mat,a,b,c,d)=>{tri(mat,a,b,c);tri(mat,a,c,d);};
 const beam=(mat,a,b,width,depth=width)=>{
  const axis=unit(b.map((v,i)=>v-a[i])),u=unit(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),v=cross(axis,u);
  const ring=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>p.map((q,i)=>q+u[i]*x*width/2+v[i]*y*depth/2));
  const A=ring(a),B=ring(b);for(let j=0;j<4;j++)quad(mat,A[j],A[(j+1)%4],B[(j+1)%4],B[j]);quad(mat,...A);quad(mat,...B.slice().reverse());
 };
 // A vertical beam's first transverse axis is Z, so swap width/depth for XYZ boxes.
 const box=(mat,[x,y,z],[w,h,d])=>beam(mat,[x,y-h/2,z],[x,y+h/2,z],d,w);
 const lathe=(mat,[x,y,z],profile,segments=40)=>{
  for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
   const [ya,ra]=profile[j],[yb,rb]=profile[j+1],a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
   const point=(t,h,r)=>[x+Math.cos(t)*r,y+h,z+Math.sin(t)*r];
   const A=point(a,ya,ra),B=point(b,ya,ra),C=point(b,yb,rb),D=point(a,yb,rb);
   // Smooth cylindrical normals, with analytic profile slope (caps remain flat).
   const normal=t=>unit([(yb-ya)*Math.cos(t),ra-rb,(yb-ya)*Math.sin(t)]),na=normal(a),nb=normal(b),g=groups[typeof mat==='function'?mat((ya+yb)/2,(a+b)/2):mat];
   g.p.push(...A,...C,...B,...A,...D,...C);g.n.push(...na,...nb,...nb,...na,...na,...nb);
  }
 };
 const cylinder=(mat,p,r,h,seg=32)=>lathe(mat,p,[[0,0],[0,r],[h,r],[h,0]],seg);
 // Coastal ground extends beyond every experiment; water and marsh are decorative.
 // Kept 12 cm below the experiment floors (top at -3 cm) so the two never z-fight at distance.
 quad('coast',[-3600,-.12,-2900],[3600,-.12,-2900],[3600,-.12,2900],[-3600,-.12,2900]);
 const shore=x=>-970+24*Math.sin(x*.004)+12*Math.sin(x*.011);
 const channel=x=>-350+65*Math.sin(x*.0028)+22*Math.sin(x*.008),channelWidth=x=>22+8*Math.sin(x*.005+2);
 for(let x=-3500;x<3500;x+=70){
  const next=x+70;quad('water',[x,-.035,-2800],[next,-.035,-2800],[next,-.035,shore(next)],[x,-.035,shore(x)]);
  const a=channel(x),b=channel(next),wa=channelWidth(x),wb=channelWidth(next);
  quad('water',[x,-.04,a-wa],[next,-.04,b-wb],[next,-.04,b+wb],[x,-.04,a+wa]);
  for(const side of [-1,1])quad('sand',[x,-.038,a+side*wa],[next,-.038,b+side*wb],[next,-.038,b+side*(wb+2.5)],[x,-.038,a+side*(wa+2.5)]);
 }
 for(let x=-1200;x<1200;x+=40)for(let z=-930;z<-180;z+=30){
  const point=(a,b)=>[a,-.044+coastalHeight(a,b),b];
  quad('coast',point(x,z),point(x,z+30),point(x+40,z+30),point(x+40,z));
 }
 // Fine grass silhouettes are static and batched, outside the solved road/rig envelope.
 for(let i=0;i<480;i++){
  const x=-1000+(i*137.37)%2100,z=-205-(i*37.31)%600,h=coastalHeight(x,z);
  if(h<.15||Math.abs(z-channel(x))<channelWidth(x)+5)continue;
  for(let j=0;j<5;j++){
   const a=i*2.399+j*1.8,r=.12+j*.04,cx=x+Math.cos(a)*r,cz=z+Math.sin(a)*r,y=coastalHeight(cx,cz)-.02,high=.22+(i%7)*.07;
   tri(i%3?'straw':'green',[cx-.035,y,cz],[cx+.10*Math.cos(a),y+high,cz+.08*Math.sin(a)],[cx+.035,y,cz+.018]);
  }
 }
 // Rocket and launch mount: intentionally schematic rather than a site replica.
 const X=-340,Z=-545;
 box('concrete',[X,1,Z],[60,2,60]);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;cylinder('dark',[X+Math.cos(a)*8,2,Z+Math.sin(a)*8],1.1,12,16);}
 cylinder('steel',[X,13,Z],7.5,2,48);
 lathe((y,a)=>y>69&&Math.sin(a)>.58?'heatshield':'rocket',[X,15,Z],[[0,0],[0,4.5],[68,4.5],[69,4.5],[99,4.5],[105,4.15],[110,3.2],[115,1.7],[118,0]],64);
 for(let y=3;y<104;y+=3)cylinder('dark',[X,15+y,Z],4.515,.055,48);
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2,dx=Math.cos(a),dz=Math.sin(a);
  beam('dark',[X+dx*4.5,78,Z+dz*4.5],[X+dx*7,78,Z+dz*7],.4,2.8);
  const fin=(height,reach,size)=>{
   const a=[X+dx*4.3,15+height,Z+dz*4.3],b=[X+dx*reach,15+height-1.5,Z+dz*reach],c=[X+dx*(reach-.5),15+height-size,Z+dz*(reach-.5)],d=[X+dx*4.3,15+height-size-1,Z+dz*4.3];
   quad('heatshield',a,b,c,d);
  };fin(105,6.8,6);fin(77,8.2,11);
 }
 for(let i=0;i<8;i++){const a=i*Math.PI/4;beam('steel',[X+4.55*Math.cos(a),16,Z+4.55*Math.sin(a)],[X+4.55*Math.cos(a),79,Z+4.55*Math.sin(a)],.13);}
 cylinder('heatshield',[X,15,Z],4.52,.7,48);
 // Lattice tower, cross bracing, platforms, two catch arms and umbilical.
 const TX=X-31,TZ=Z+3;
 box('concrete',[TX,1.5,TZ],[26,3,26]);
 for(const dx of [-8,8])for(const dz of [-8,8])beam('dark',[TX+dx,3,TZ+dz],[TX+dx,148,TZ+dz],1.1);
 for(let level=0;level<13;level++){
  const y=5+level*11;
  for(const z of [-8,8]){beam('dark',[TX-8,y,TZ+z],[TX+8,y,TZ+z],.65);beam('dark',[TX-8,y,TZ+z],[TX+8,y+11,TZ+z],.45);beam('dark',[TX+8,y,TZ+z],[TX-8,y+11,TZ+z],.45);}
  for(const x of [-8,8]){beam('dark',[TX+x,y,TZ-8],[TX+x,y,TZ+8],.65);beam('dark',[TX+x,y,TZ-8],[TX+x,y+11,TZ+8],.45);beam('dark',[TX+x,y,TZ+8],[TX+x,y+11,TZ-8],.45);}
  box('steel',[TX,y,TZ],[16,.25,16]);
  if(level%2===0)box('warm',[TX+8.7,y+1,TZ+1],[.4,.25,.7]);
 }
 for(const z of [-6,6]){
  beam('steel',[TX+5,104,TZ+z],[X+5,104,TZ+z],1.1,1.5);
  beam('dark',[TX+5,108,TZ+z],[X+5,104,TZ+z],.65);
  for(let j=0;j<5;j++)beam('dark',[TX+6+j*6,104,TZ+z],[TX+10+j*6,107-j*.45,TZ+z],.35);
 }
 beam('dark',[TX+7,130,TZ],[X,130,Z],1.0);beam('dark',[TX+7,135,TZ],[X-1,130,Z],.65);
 // Tank farm, pipe racks, hangars: clear silhouettes plus finer repeating detail.
 for(let i=0;i<8;i++){
  const x=X+64+(i%4)*14,z=Z-5-Math.floor(i/4)*19,h=25+(i%3)*3;
  lathe('white',[x,0,z],[[0,0],[0,4.6],[1,5],[h-2,5],[h,3.7],[h+.6,0]],32);
  cylinder('steel',[x,h+.5,z],.8,1.5,16);cylinder('steel',[x,.8,z],5.03,.18,32);
  beam('dark',[x+5.2,0,z],[x+5.2,h,z],.18);
 }
 for(let row=0;row<3;row++)for(let j=0;j<5;j++){
  const x=X+55+j*12,z=Z+35+row*8;box('concrete',[x,1.1,z],[5,2.2,5]);
  // Horizontal pressure vessels, with rounded ends.
  for(let k=0;k<12;k++){
   const a=k*Math.PI*2/12,b=(k+1)*Math.PI*2/12;
   quad('white',[x-4.5,4+2.3*Math.cos(a),z+2.3*Math.sin(a)],[x+4.5,4+2.3*Math.cos(a),z+2.3*Math.sin(a)],[x+4.5,4+2.3*Math.cos(b),z+2.3*Math.sin(b)],[x-4.5,4+2.3*Math.cos(b),z+2.3*Math.sin(b)]);
  }
 }
 for(const z of [Z+65,Z-20]){for(let x=X-10;x<X+190;x+=20){box('dark',[x,3,z],[.3,6,.3]);beam('steel',[x,5,z],[x+20,5,z],.4);}beam('steel',[X-20,5.8,z],[X+190,5.8,z],.5);}
 const hangar=(x,z,w,h,d)=>{
  box('white',[x,h/2,z],[w,h,d]);box('steel',[x,h+.4,z],[w+3,.8,d+3]);
  for(let q=-w/2+2;q<w/2;q+=6)box('steel',[x+q,h/2,z+d/2+.06],[.16,h,.12]);
  for(let q=-w/2+12;q<w/2;q+=24){box('dark',[x+q,h*.36,z+d/2+.12],[19,h*.72,.15]);for(let y=2;y<h*.7;y+=3)box('steel',[x+q,y,z+d/2+.25],[18,.12,.13]);}
  box('glass',[x,h*.84,z+d/2+.14],[w-4,h*.12,.2]);
 };
 hangar(X+270,Z+30,110,48,85);hangar(X+170,Z-100,70,32,60);
 // Near-field testing outpost is behind all supported Turn roads (z >= -120 m).
 hangar(140,-245,45,7,22);
 box('concrete',[140,-.01,-223],[62,.10,24]);box('dark',[140,7.5,-232],[49,.3,14]);
 for(const x of [120,140,160]){box('glass',[x,3,-233.7],[13,3.4,.2]);box('warm',[x,4.9,-233.4],[11,.07,.12]);}
 // Small scrub patches and marker lights give the track surroundings scale.
 for(let i=0;i<110;i++){
  const x=-380+(i*73.73)%900,z=-195-(i*31.31)%500,r=.65+(i%5)*.25;
  if(z<Z+100&&x<X+380)continue;
  for(let j=0;j<3;j++){const a=j*2.094+i;tri('green',[x-r,0,z],[x+Math.cos(a)*.5,1+(i%3)*.35,z+Math.sin(a)*.5],[x+r,0,z+.4]);}
 }
 for(let i=0;i<26;i++){
  const x=-160+i*50;box('concrete',[x,.13,12],[.65,.26,.65]);box('warm',[x,.31,12],[.28,.10,.28]);
 }
 cached=Object.entries(groups).filter(([,g])=>g.p.length).map(([key,g])=>({name:'site:'+key,...g,...MATERIALS[key]}));
 return cached;
}
