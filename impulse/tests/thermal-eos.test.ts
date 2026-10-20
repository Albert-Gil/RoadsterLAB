import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,ATM,initialGas,pressureOf,nozzleFlow,simulateLaunch,simulateHop,simulateInvert,simulateTurn,tankHeatRate,sealedThermal,comparisonCsv,simulateComparison,hopCsv,invertCsv,turnCsv,simulateTurnComparison,gasFromPreset} from '../src/physics.ts';
import {AIR_T_MIN,AIR_T_MAX,propsAtTR,rhoFromPT,tempFromRU,propsFromPs,soundSpeed} from '../src/air-table.js';
const close=(a:number,b:number,rel=1e-7)=>assert.ok(Math.abs(a-b)<=rel*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);

test('cold/unstable air is rejected without a hidden ideal-gas or sound fallback',()=>{
 for(const T of [90,120,139.99]){
  assert.equal(propsAtTR(T,200).ok,false);assert.equal(rhoFromPT(2.48944e6,T).ok,false);assert.equal(soundSpeed(T,200).ok,false);
 }
 for(const T of [140,180,293,600,999,1001,1500,2000])for(const p of [ATM,5e6,4e7,6.5e7]){
  const r=rhoFromPT(p,T);assert.ok(r.ok);const s=propsAtTR(T,r.rho);
  assert.ok(s.ok&&s.cv>0&&s.cp>=s.cv&&s.dpdr>0);
  close(s.h,s.u+s.p/r.rho,1e-13);close(s.p,p,1e-10);close(tempFromRU(r.rho,s.u).T,T,1e-8);
 }
});

test('EOS heat capacities, entropy derivatives and sound agree with independent finite differences',()=>{
 for(const T of [160,230,293,400,800,1200])for(const rho of [1,50,400]){
  const s=propsAtTR(T,rho),h=.001;
  close(s.cv,(propsAtTR(T+h,rho).u-propsAtTR(T-h,rho).u)/(2*h),1e-6);
  const rp=rhoFromPT(s.p,T+h),rm=rhoFromPT(s.p,T-h);
  close(s.cp,(propsAtTR(T+h,rp.rho).h-propsAtTR(T-h,rm.rho).h)/(2*h),1e-5);
  close(s.cp/T,(propsAtTR(T+h,rp.rho).s-propsAtTR(T-h,rm.rho).s)/(2*h),1e-5);
  const ds=(propsAtTR(T,rho+h).s-propsAtTR(T,rho-h).s)/(2*h);
  close(ds,-s.dpdT/(rho*rho),1e-5);
  const dp=Math.max(1,s.p*1e-5),hi=propsFromPs(s.p+dp,s.s,T),lo=propsFromPs(s.p-dp,s.s,T);
  if(hi.ok&&lo.ok)close(soundSpeed(T,rho).a**2,2*dp/(hi.rho-lo.rho),2e-5);
 }
});

test('converging nozzle preserves isentropic energy and pressure thrust through choking',()=>{
 for(const ratio of [1.01,1.2,2,10,400]){
  const p=ratio*ATM,T=293,area=.001,n=nozzleFlow(p,T,area);
  assert.ok(n.ok);const stagnation=propsAtTR(T,rhoFromPT(p,T).rho),exit=propsAtTR(n.exitTemp!,rhoFromPT(n.exitPressure!,n.exitTemp!).rho);
  close(exit.s,stagnation.s,1e-9);close(stagnation.h-exit.h,.5*n.velocity!**2,1e-9);
  close(n.thrust,n.flow*n.velocity!+(n.exitPressure!-ATM)*area,1e-12);
  assert.ok(n.mach!<=1.00003);
  if(n.choked){close(n.mach!,1,2e-5);assert.ok(n.exitPressure!>ATM);}else close(n.exitPressure!,ATM);
 }
 assert.equal(nozzleFlow(2*ATM,139,.001).ok,false);
});

test('imposed heat rate has correct direction, units, equilibrium and zero-conductance limit',()=>{
 assert.equal(tankHeatRate(DEFAULTS,283),2500);assert.equal(tankHeatRate(DEFAULTS,303),-2500);assert.equal(tankHeatRate(DEFAULTS,293),0);
 assert.equal(tankHeatRate({...DEFAULTS,heatTransfer:0},180),0);
 const mass=100,u=propsAtTR(200,mass/.6).u,start={mass,temp:200,u};
 const c={...DEFAULTS,heatTransfer:1000},history=sealedThermal(c,start,10),end=history.at(10);
 assert.ok(history.valid);assert.equal(end.gas.mass,mass);assert.ok(end.gas.temp>200&&end.gas.temp<293);
 close(mass*(end.gas.u-u),end.heat,1e-12);close(end.rate,1000*(293-end.gas.temp),1e-12);
 const cold=sealedThermal({...c,heatSourceTemp:250},{mass,temp:300,u:propsAtTR(300,mass/.6).u},10).at(10);
 assert.ok(cold.heat<0&&cold.gas.temp<300&&cold.gas.temp>250);
 for(const config of [{heatTransfer:-1},{heatTransfer:2001},{heatSourceTemp:NaN},{heatSourceTemp:351}])assert.throws(()=>tankHeatRate({...DEFAULTS,...config},200));
});

test('nearly empty sealed inventory resolves its short thermal time constant',()=>{
 const mass=.006,c={...DEFAULTS,heatTransfer:2000},gas={mass,temp:200,u:propsAtTR(200,mass/.6).u};
 const history=sealedThermal(c,gas,1);assert.ok(history.valid);close(history.end,1);
 let previous=200;
 for(const t of [0,.0001,.001,.01,.1,1]){
  const s=history.at(t);assert.ok(s.gas.temp>=previous&&s.gas.temp<=293+1e-8);
  close(s.heat,mass*(s.gas.u-gas.u),1e-12);previous=s.gas.temp;
 }
 close(history.at(1).gas.temp,293,1e-8);
});

function balance(run:any,c:any,start=initialGas(c)){
 let out=0,heat=0,mass=0;
 for(let i=1;i<run.samples.length;i++){
  const a=run.samples[i-1],b=run.samples[i],dt=b.t-a.t;
  out+=dt*(a.flow*a.he+b.flow*b.he)/2;heat+=dt*((a.heatRate??0)+(b.heatRate??0))/2;mass+=dt*(a.flow+b.flow)/2;
 }
 const end=run.finalGas,delta=end.mass*end.u-start.mass*start.u;
 close(delta,heat-out,2e-4);close(run.samples.at(-1).heatEnergy,heat,2e-4);close(run.used,mass,2e-4);
}

test('heated Launch and manual Hop close open-system energy and mass balances',()=>{
 const c={...DEFAULTS,heatTransfer:1000};
 const launch=simulateLaunch(c);balance(launch,c);
 const hop=simulateHop({...c,pulse:.35,landingBurn:2});balance(hop,{...c,pulse:.35,landingBurn:2});
 const coast=launch.samples.filter(s=>s.t>2.01);assert.equal(coast.at(-1)!.gas,coast[0].gas);assert.ok(coast.at(-1)!.temp>coast[0].temp);
 const adiabatic=simulateLaunch({...c,heatTransfer:0});assert.ok(launch.finalGas.temp>adiabatic.finalGas.temp);assert.ok(launch.samples.at(-1)!.heatEnergy!>0);
});

test('sealed experiments heat without consuming inventory or mechanical battery energy',()=>{
 const c={...DEFAULTS,heatSourceTemp:330,heatTransfer:1000};
 for(const run of [simulateLaunch(c,0),simulateInvert(c),simulateTurn(c)]){
  assert.equal(run.used,0);close(run.finalGas.mass,initialGas(c).mass);assert.ok(run.finalGas.temp>293);
  balance(run,c);assert.equal(run.samples.at(-1)!.flow,0);
 }
 const run=simulateLaunch(c,0),g=run.finalGas,p=new URLSearchParams({gasMass:String(g.mass),gasTemp:String(g.temp),gasU:String(g.u)});
 assert.ok(g.temp>293);assert.deepEqual(gasFromPreset(c,p),g);
});

test('heated auto landing forecasts coast heating and thermal runs converge',()=>{
 const c={...DEFAULTS,pulse:.2,landingBurn:1,heatTransfer:1000};
 const r=simulateHop(c),fine=simulateHop(c,.001);
 assert.equal(r.status,'TOUCHDOWN');assert.equal(fine.status,'TOUCHDOWN');
 assert.ok(Math.abs(r.landingSpeed!-1.5)<.1);assert.ok(Math.abs(r.landing!.plan!.predictedSpeed-r.landingSpeed!)<.15);
 close(r.landingSpeed!,fine.landingSpeed!,.01);close(r.used,fine.used,.003);balance(r,c);
});

test('CSV includes signed heat and nozzle outputs, with finite supported samples',()=>{
 const c={...DEFAULTS,pulse:.35,landingBurn:2};
 const csvs=[comparisonCsv(simulateComparison(c)),hopCsv(simulateHop(c),c),invertCsv(simulateInvert(c),c),turnCsv(simulateTurnComparison(c))];
 for(const csv of csvs){assert.ok(csv.split('\n')[0].includes('heat_rate_W'));assert.ok(csv.split('\n')[0].includes('heat_input_J'));assert.ok(!/NaN|Infinity/.test(csv));}
 assert.ok(csvs[0].includes('nozzle_exit_pressure_Pa'));assert.ok(csvs[1].includes('nozzle_mach'));
});
