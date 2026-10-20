// Canonical dependency-free single-phase Peng–Robinson dry-air approximation.
// Generated runtime is src/air-table.js; keep API names for saved worker bundles.
export const AIR_R=8.314462618/.0289586;
export const AIR_T_MIN=140,AIR_T_MAX=2000,AIR_RHO_MIN=.01,AIR_RHO_MAX=1176.5653464767372;
export const AIR_MODEL='peng-robinson-consistent-gas-v3';
const RU=8.314462618,M=.0289586,TC=132.5306,PC=3.786e6,OM=.0335;
const K=.37464+1.54226*OM-.26992*OM*OM,B=.07780*RU*TC/PC,A=.45724*RU*RU*TC*TC/PC,SQ=Math.SQRT2;
const LOW=[3.56839620,-1.49840650e-3,4.91800570e-6,-4.84734570e-9,1.65406090e-12,-1.06234600e3,3.71582920];
const HIGH=[3.08792717,1.24597184e-3,-4.23718945e-7,6.76105860e-11,-3.59323274e-15,-9.78641600e2,5.98005924];
function poly(T,a){
 const [a1,a2,a3,a4,a5,a6,a7]=a;
 return {cp:AIR_R*(a1+a2*T+a3*T*T+a4*T**3+a5*T**4),h:AIR_R*(a1*T+a2*T*T/2+a3*T**3/3+a4*T**4/4+a5*T**5/5+a6),s:AIR_R*(a1*Math.log(T)+a2*T+a3*T*T/2+a4*T**3/3+a5*T**4/4+a7)};
}
const AT200=poly(200,LOW),LO1000=poly(1000,LOW),HI1000=poly(1000,HIGH);
function ideal(T){
 // Explicit constant-cp continuation below the NASA fit, not an EOS fallback.
 if(T<200)return {cp:AT200.cp,h:AT200.h+AT200.cp*(T-200),s:AT200.s+AT200.cp*Math.log(T/200)};
 const p=poly(T,T<1000?LOW:HIGH);
 if(T>=1000){p.h+=LO1000.h-HI1000.h;p.s+=LO1000.s-HI1000.s;}
 return p;
}
export function insideTable(T,rho){return Number.isFinite(T)&&Number.isFinite(rho)&&T>=AIR_T_MIN&&T<=AIR_T_MAX&&rho>=AIR_RHO_MIN&&rho<=AIR_RHO_MAX;}
const bad=()=>({p:NaN,u:NaN,h:NaN,s:NaN,cp:NaN,cv:NaN,dpdr:NaN,dpdT:NaN,ok:false});
export function propsAtTR(T,rho){
 if(!insideTable(T,rho))return bad();
 const v=M/rho,f=1+K*(1-Math.sqrt(T/TC)),a=A*f*f,da=-A*K*f/Math.sqrt(T*TC),dda=A*K*(1+K)/(2*Math.sqrt(TC)*T**1.5);
 const den=v*v+2*B*v-B*B,log=Math.log((v+(1+SQ)*B)/(v+(1-SQ)*B)),ig=ideal(T);
 const p=RU*T/(v-B)-a/den,dpdT=RU/(v-B)-da/den;
 const dpdr=(RU*T/(v-B)**2-a*(2*v+2*B)/den**2)*M/(rho*rho);
 const u=ig.h-AIR_R*T+(T*da-a)*log/(2*SQ*B*M);
 const h=u+p/rho,s=ig.s-AIR_R*Math.log(rho*AIR_R*T/1e5)+AIR_R*Math.log(1-B/v)+da*log/(2*SQ*B*M);
 const cv=ig.cp-AIR_R+T*dda*log/(2*SQ*B*M),cp=cv+T*dpdT*dpdT/(rho*rho*dpdr);
 const ok=[p,u,h,s,cv,cp,dpdr,dpdT].every(Number.isFinite)&&p>0&&cv>0&&cp>=cv&&dpdr>0;
 return ok?{p,u,h,s,cp,cv,dpdr,dpdT,ok:true}:bad();
}
export function rhoFromPT(p,T){
 if(!(p>0)||!Number.isFinite(p)||!insideTable(T,AIR_RHO_MIN))return {rho:NaN,ok:false};
 let lo=AIR_RHO_MIN,hi=AIR_RHO_MAX;
 if(p<propsAtTR(T,lo).p||p>propsAtTR(T,hi).p)return {rho:NaN,ok:false};
 let rho=Math.max(lo,Math.min(hi,p/(AIR_R*T)));
 for(let i=0;i<50;i++){
  const s=propsAtTR(T,rho);if(!s.ok)return {rho:NaN,ok:false};
  if(Math.abs(s.p-p)<Math.max(1e-5,p*1e-11))return {rho,ok:true};
  if(s.p<p)lo=rho;else hi=rho;
  const next=rho-(s.p-p)/s.dpdr;rho=next>lo&&next<hi?next:(lo+hi)/2;
 }
 return {rho:NaN,ok:false};
}
export function tempFromRU(rho,u){
 if(!Number.isFinite(u)||!insideTable(AIR_T_MIN,rho))return {T:NaN,ok:false};
 let lo=AIR_T_MIN,hi=AIR_T_MAX;
 if(u<propsAtTR(lo,rho).u||u>propsAtTR(hi,rho).u)return {T:NaN,ok:false};
 let T=293;
 for(let i=0;i<50;i++){
  const s=propsAtTR(T,rho);if(!s.ok)return {T:NaN,ok:false};
  if(Math.abs(s.u-u)<1e-7)return {T,ok:true};
  if(s.u<u)lo=T;else hi=T;
  const next=T-(s.u-u)/s.cv;T=next>lo&&next<hi?next:(lo+hi)/2;
 }
 return {T:NaN,ok:false};
}
export function propsFromPs(p,s,Tseed=293){
 if(!(p>0)||!Number.isFinite(s))return {T:NaN,rho:NaN,u:NaN,h:NaN,cp:NaN,ok:false};
 let lo=AIR_T_MIN,hi=AIR_T_MAX;
 const state=T=>{const r=rhoFromPT(p,T);return r.ok?{T,rho:r.rho,...propsAtTR(T,r.rho)}:null;};
 const low=state(lo),high=state(hi);
 if(!low?.ok||!high?.ok||s<low.s-1e-8||s>high.s+1e-8)return {T:NaN,rho:NaN,u:NaN,h:NaN,cp:NaN,ok:false};
 let T=Math.min(hi,Math.max(lo,Tseed));
 for(let i=0;i<40;i++){
  const pr=state(T);if(!pr?.ok)return {T:NaN,rho:NaN,u:NaN,h:NaN,cp:NaN,ok:false};
  if(Math.abs(pr.s-s)<1e-7)return pr;
  if(pr.s<s)lo=T;else hi=T;
  const next=T-(pr.s-s)*T/pr.cp;T=next>lo&&next<hi?next:(lo+hi)/2;
 }
 return {T:NaN,rho:NaN,u:NaN,h:NaN,cp:NaN,ok:false};
}
export function soundSpeed(T,rho){
 const p=propsAtTR(T,rho),a=p.ok?Math.sqrt(p.dpdr+T*p.dpdT*p.dpdT/(rho*rho*p.cv)):NaN;
 return {a,ok:Number.isFinite(a)&&a>0};
}
