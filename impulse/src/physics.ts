/** SI throughout. All vehicle parameters are illustrative, not Tesla specifications. */
import { propsAtTR, rhoFromPT, tempFromRU, propsFromPs, soundSpeed, insideTable, AIR_T_MIN, AIR_T_MAX, AIR_MODEL } from './air-table.js';
export const G = 9.80665, R = 287.05, GAMMA = 1.4, CV = R / (GAMMA - 1), CP = CV + R, ATM = 101325;
export { AIR_T_MIN };
/** Config pressure stays in bar absolute; UI/presets may use bar gauge. */
export function gaugeToAbsoluteBar(gauge: number) { return gauge + ATM / 1e5; }
export function absoluteToGaugeBar(absolute: number) { return absolute - ATM / 1e5; }
/** Unmarked legacy links store absolute bar. */
export function presetPressure(value: number, unit: string | null) { return unit === 'barg' ? gaugeToAbsoluteBar(value) : value; }
export type Experiment = 'launch' | 'invert' | 'hop' | 'turn';
export type Config = { mass: number; power: number; grip: number; fan: number; pressure: number; volume: number; nozzle: number; valveRise:number; feedLoss:number; expansionRatio:number; boostAt: number; leak: number; angle: number; invertStart: number; invertDuration: number; heatTransfer:number; heatSourceTemp:number; pulse: number; landingBurn: number; wreckSpeed: number; landingTarget: number; landingLead: number; manualBurnAt: number; manualBurnDuration: number; manualBurnCommand: number; turnSpeed:number; turnSteer:number; turnRadius:number; turnSweep:number; turnWidth:number };
export const DEFAULTS: Config = { mass: 1800, power: 900, grip: 1.3, fan: 80, pressure: 400 + ATM / 1e5, volume: 600, nozzle: 10, valveRise:0, feedLoss:0, expansionRatio:1, boostAt: 0, leak: 20, angle: 180, invertStart: 0, invertDuration: 4, heatTransfer:250, heatSourceTemp:293, pulse: .65, landingBurn: 0, wreckSpeed: 5, landingTarget: 1.5, landingLead: .02, manualBurnAt: 2.21, manualBurnDuration: 1, manualBurnCommand: 100, turnSpeed:100/3.6, turnSteer:4*Math.PI/180, turnRadius:40, turnSweep:Math.PI/2, turnWidth:10 };
export type GasState = { mass: number; temp: number; u: number };
/** he is outflow stagnation enthalpy (static enthalpy + jet kinetic energy), J/kg. */
/** energy is electrical work ∫(F_tire v + P_fan) dt in joules, not tank internal energy. */
export type Sample = { t: number; x: number; v: number; a: number; pressure: number; temp: number; gas: number; u: number; thrust: number; tire: number; downforce: number; flow: number; he: number; energy: number; limit: string; y: number; vy: number; traction?:number; motor?:number; resist?:number; heatRate?:number; heatEnergy?:number; nozzlePressure?:number; nozzleTemp?:number; exitVelocity?:number; nozzleMach?:number; choked?:number; inletPressure?:number; valveCommand?:number; separated?:number; bodyOmega?:number; frontNormal?:number; rearNormal?:number; valve?: number; angle?: number; platformAngle?: number; platformOmega?: number; alongForce?: number; along?: number; alongV?: number; vx?: number; normal?: number; demand?: number; capacity?: number; clearance?: number; contact?: number; z?:number; yaw?:number; course?:number; steer?:number; distance?:number; lateralAccel?:number; laneError?:number; utilization?:number; utilizationValid?:number };
export type LandingPlan = { ignitionAt: number | null; maxOpenTime: number; predictedSpeed: number; feasible: boolean; reason: string; cutoff: string; coastTime: number };
export type Run = { samples: Sample[]; sixty: number | null; hundred: number | null; finalGas: GasState; used: number; status: string; peakHeight: number; landingSpeed: number | null; turn?:TurnInfo; invert?: { rig: typeof INVERT_RIG; bounds:{minX:number;maxX:number;maxY:number}; events: {t:number;label:string}[]; sealAt:number|null; detachAt:number|null; detachReason:string|null; impactAt:number|null; impactSpeed:number|null; outcome:string; threshold:number; impactEnergy:number|null; fanPower:number; frictionWork:number; deckContactAt?:number|null; stopReason?:string; rotation?:{start:number;end:number;duration:number}; platformWork?:number }; landing?: { outcome: string; threshold: number; impactEnergy: number | null; burnStart: number | null; target: number; lead: number; plan: LandingPlan | null; controller: string; mode: string; manualAt: number; manualDuration: number; manualCommand: number; burnEnd: number | null } };

/** A threshold rule for presentation, not a structural vehicle model. */
export function touchdownOutcome(speed: number | null, threshold: number) {
  return speed === null ? 'NO TOUCHDOWN' : speed > threshold ? 'WRECKED' : 'INTACT';
}
/** Four balanced nozzles replace two equivalent banks without changing total area. */
export function hopNozzles(c: Config) {
  const totalArea = c.nozzle * 2e-4;
  return { totalArea, areaEach: totalArea / 4, count: 4 };
}

export function initialGas(c: Config): GasState {
  const T = 293, V = c.volume / 1000, { rho, ok } = rhoFromPT(c.pressure * 1e5, T);
  if (!ok) throw new Error('initial fill outside air table');
  const { u, ok: okU } = propsAtTR(T, rho);
  if (!okU) throw new Error('initial fill properties unavailable');
  return { mass: rho * V, temp: T, u };
}
export function pressureOf(c: Config, gas: GasState) {
  const rho = gas.mass / (c.volume / 1000), pr = propsAtTR(gas.temp, rho);
  return pr.ok ? pr.p : NaN;
}
export function gasValidity(c: Config, gas: GasState) {
  const rho = gas.mass / (c.volume / 1000);
  if (!(gas.mass > 0) || !Number.isFinite(gas.u) || !Number.isFinite(gas.temp)) return { ok: false, reason: 'OUT OF TABLE' };
  if (!insideTable(gas.temp, rho)) return { ok: false, reason: 'OUT OF TABLE' };
  const pr = propsAtTR(gas.temp, rho);
  if (!pr.ok) return { ok: false, reason: 'OUT OF TABLE' };
  return { ok: true, reason: '' };
}
/** Ensure GasState has consistent u (e.g. share links that only store mass/temp). */
export function withInternalEnergy(c: Config, gas: { mass: number; temp: number; u?: number }): GasState {
  const atTemp = propsAtTR(gas.temp, gas.mass / (c.volume / 1000));
  // Reject inconsistent or obsolete EOS energies while retaining mass and temperature.
  if (atTemp.ok && gas.u !== undefined && Number.isFinite(gas.u) && Math.abs(gas.u-atTemp.u)<.1)
    return { mass: gas.mass, temp: gas.temp, u: gas.u };
  const rho = gas.mass / (c.volume / 1000), pr = propsAtTR(gas.temp, rho);
  return { mass: gas.mass, temp: gas.temp, u: pr.ok ? pr.u : NaN };
}

/** Restore both legacy mass/temperature links and newer energy-bearing links. */
export function gasFromPreset(c: Config, params: URLSearchParams): GasState | null {
  if (!params.has('gasMass') || !params.has('gasTemp')) return null;
  const mass = Number(params.get('gasMass')), temp = Number(params.get('gasTemp'));
  if (!Number.isFinite(mass) || !Number.isFinite(temp) || mass<=0 || mass>initialGas(c).mass+1e-6 || temp<AIR_T_MIN || temp>AIR_T_MAX) return null;
  const rawU=params.get('gasU');
  const u=rawU!==null && rawU.trim()!=='' && Number.isFinite(Number(rawU)) ? Number(rawU) : undefined;
  const gas=withInternalEnergy(c,{mass,temp,u});
  return gasValidity(c,gas).ok ? gas : null;
}

type NozzleResult = { flow: number; thrust: number; he: number; ok: boolean; exitPressure?:number; exitTemp?:number; velocity?:number; mach?:number; choked?:boolean; inletPressure?:number; separated?:boolean };
let nozzleCacheKey = '', nozzleCache: NozzleResult = { flow: 0, thrust: 0, he: 0, ok: true };

export function nozzleFlow(p0:number,temp0:number,area:number,expansionRatio=1):NozzleResult{
 if(!Number.isFinite(expansionRatio)||expansionRatio<1||expansionRatio>1.5)throw new Error('Invalid nozzle expansion ratio');
 if(![p0,temp0,area].every(Number.isFinite)||temp0<AIR_T_MIN||temp0>AIR_T_MAX||area<0)return {flow:0,thrust:0,he:0,ok:false};
 if(p0<=ATM||area===0)return {flow:0,thrust:0,he:0,ok:true,exitPressure:ATM,exitTemp:temp0,velocity:0,mach:0,choked:false};
 const key=`${p0}:${temp0}:${area}:${expansionRatio}`;if(key===nozzleCacheKey)return nozzleCache;
 const r=rhoFromPT(p0,temp0),stag=r.ok?propsAtTR(temp0,r.rho):null;
 if(!stag?.ok)return {flow:0,thrust:0,he:0,ok:false};
 const state=(pe:number)=>{
  const st=propsFromPs(pe,stag.s,temp0*(pe/p0)**.2857);
  if(!st.ok)return null;
  const v=Math.sqrt(Math.max(0,2*(stag.h-st.h))),a=soundSpeed(st.T,st.rho);
  return a.ok?{...st,pe,v,mach:v/a.a}:null;
 };
 let exit=state(ATM),choked=!exit||exit.mach>1;
 if(choked){
  let lo=ATM,hi=p0;
  for(let i=0;i<28;i++){
   const mid=Math.sqrt(lo*hi),st=state(mid);
   if(!st||st.mach>1)lo=mid;else hi=mid;
  }
  exit=state(Math.sqrt(lo*hi));
  // The throat must actually be a supported sonic state. A temperature-bound
  // endpoint is not a sonic solution and must not silently substitute for one.
  if(!exit||Math.abs(exit.mach-1)>2e-5)return {flow:0,thrust:0,he:stag.h,ok:false};
 }
 if(!exit)return {flow:0,thrust:0,he:stag.h,ok:false};
 const flow=.9*area*exit.rho*exit.v;
 let exitArea=area,separated=false;
 if(choked&&expansionRatio>1){
  const targetFlux=exit.rho*exit.v/expansionRatio,ambient=state(ATM);
  // Lightweight off-design surrogate: a bell requiring exit pressure below
  // ambient is treated as separated, with throat-only delivery. No shock solve.
  if(ambient&&ambient.rho*ambient.v>targetFlux){separated=true;}
  else{
   let lo=ATM,hi=exit.pe;
   for(let i=0;i<26;i++){
    const mid=Math.sqrt(lo*hi),st=state(mid);
    if(!st||st.rho*st.v<targetFlux)lo=mid;else hi=mid;
   }
   const expanded=state(Math.sqrt(lo*hi));
   if(!expanded||Math.abs(expanded.rho*expanded.v/targetFlux-1)>2e-5)return {flow:0,thrust:0,he:stag.h,ok:false};
   exit=expanded;exitArea=area*expansionRatio;
  }
 }
 const result={flow,thrust:flow*exit.v+(exit.pe-ATM)*exitArea,he:stag.h,ok:true,exitPressure:exit.pe,exitTemp:exit.T,velocity:exit.v,mach:exit.mach,choked,separated};
 nozzleCacheKey=key;nozzleCache=result;return result;
}

/** Prescribed smooth opening, instantaneous closure; rise time is seconds. */
export function valveOpening(elapsed:number,rise=0){
 if(!Number.isFinite(rise)||rise<0||rise>.2)throw new Error('Invalid valve rise time');
 if(elapsed<0)return 0;if(rise===0)return 1;
 const q=Math.max(0,Math.min(1,elapsed/rise));return q*q*(3-2*q);
}
/** Assumed fractional feed pressure loss, isenthalpic before the nozzle. */
export function gasDelivery(c:Config,p:number,T:number,area:number):NozzleResult{
 const loss=c.feedLoss??0,ratio=c.expansionRatio??1;
 if(!Number.isFinite(loss)||loss<0||loss>30)throw new Error('Invalid feed pressure loss');
 const inletPressure=ATM+Math.max(0,p-ATM)*(1-loss/100);
 if(loss===0||p<=ATM)return {...nozzleFlow(p,T,area,ratio),inletPressure:p};
 const r=rhoFromPT(p,T),start=r.ok?propsAtTR(T,r.rho):null;
 if(!start?.ok)return {flow:0,thrust:0,he:0,ok:false};
 let inletT=T,solved=false;
 for(let i=0;i<12;i++){
  const r=rhoFromPT(inletPressure,inletT),st=r.ok?propsAtTR(inletT,r.rho):null;
  if(!st?.ok)break;
  const error=st.h-start.h;if(Math.abs(error)<1e-5){solved=true;break;}
  inletT-=error/st.cp;if(inletT<AIR_T_MIN||inletT>AIR_T_MAX)break;
 }
 if(!solved)return {flow:0,thrust:0,he:start.h,ok:false};
 return {...nozzleFlow(inletPressure,inletT,area,ratio),he:start.h,inletPressure};
}

/** Heat from an imposed reservoir into the gas; positive Q adds tank energy.
 * UA is W/K, source and internal temperatures K. No unmodeled finite wall store. */
export function tankHeatRate(c:Config,temperature:number){
 const ua=c.heatTransfer??0,source=c.heatSourceTemp??293;
 if(!Number.isFinite(ua)||ua<0||ua>2000||!Number.isFinite(source)||source<250||source>350)throw new Error('Invalid vessel heat settings');
 return ua*(source-temperature);
}
/** Fixed-mass heat-only trajectory, reused by sealed experiments and forecasts. */
export function sealedThermal(c:Config,gas:GasState,end:number){
 const points:{t:number;gas:GasState;heat:number}[]=[{t:0,gas:{...gas},heat:0}];
 let u=gas.u,time=0,valid=true;
 if(tankHeatRate(c,gas.temp)===0)return {at:(_time:number)=>({gas:{...gas},heat:0,rate:0}),end,valid};
 let stagesValid=true;
 const derivative=(state:number[])=>{const th=tankThermo(c,gas.mass,state[0]);if(!th.ok)stagesValid=false;return [th.ok?tankHeatRate(c,th.T)/gas.mass:0];};
 while(time<end-1e-10){
  const current=tankThermo(c,gas.mass,u);
  if(!current.ok){valid=false;break;}
  // Resolve the gas thermal time constant even for nearly empty shared tanks.
  const cv=propsAtTR(current.T,current.rho).cv;
  const step=Math.min(.02,end-time,.25*gas.mass*cv/c.heatTransfer);
  stagesValid=true;
  const next=rk4([u],time,step,derivative)[0],th=tankThermo(c,gas.mass,next);
  if(!stagesValid||!th.ok){valid=false;break;}
  // At floating-point equilibrium the remaining sealed history is constant.
  time=next===u?end:time+step;u=next;
  points.push({t:time,gas:{mass:gas.mass,temp:th.T,u},heat:gas.mass*(u-gas.u)});
 }
 return {end:time,valid,at:(at:number)=>{
  let lo=0,hi=points.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(points[m].t<=at)lo=m;else hi=m-1;}
  const a=points[lo],b=points[Math.min(lo+1,points.length-1)],k=b.t>a.t?Math.max(0,Math.min(1,(at-a.t)/(b.t-a.t))):0;
  const u=a.gas.u+k*(b.gas.u-a.gas.u),T=tankThermo(c,gas.mass,u).T;
  return {gas:{mass:gas.mass,u,temp:T},heat:gas.mass*(u-gas.u),rate:tankHeatRate(c,T)};
 }};
}

export function fanModel(c: Config) {
  const u = c.fan / 100, area = .015 + c.leak / 100 * .12, stall = 11000, qFree = 18;
  const dp = stall * u * u / (1 + stall * Math.pow(.65 * area, 2) * 2 / (1.225 * qFree * qFree));
  const q = .65 * area * Math.sqrt(2 * dp / 1.225);
  return { downforce: dp * 4, power: dp * q / .7, dp, q };
}

function tankThermo(c: Config, m: number, u: number) {
  const V = c.volume / 1000, rho = m / V;
  const { T, ok } = tempFromRU(rho, u);
  if (!ok) return { ok: false as const, T: NaN, p: NaN, rho };
  const pr = propsAtTR(T, rho);
  if (!pr.ok) return { ok: false as const, T, p: NaN, rho };
  return { ok: true as const, T, p: pr.p, rho };
}

function forces(c: Config, s: number[], t: number, mode: number, valveOverride?:boolean) {
  const [, v, m, uInt, fanForce] = s, mass = c.mass + m;
  const th = tankThermo(c, m, uInt);
  const nozzle = mode === 2 && (valveOverride??(t >= c.boostAt && t < c.boostAt + 2)) && th.ok
    ? gasDelivery(c,th.p, th.T, c.nozzle * 1e-4)
    : { flow: 0, thrust: 0, he: th.ok ? propsAtTR(th.T, th.rho).h : 0, ok:true };
  const opening=mode===2&&(valveOverride??(t>=c.boostAt&&t<c.boostAt+2))?valveOpening(t-c.boostAt,c.valveRise??0):0;
  nozzle.flow*=opening;nozzle.thrust*=opening;
  const f = mode > 0 ? fanModel(c) : { downforce: 0, power: 0, dp: 0, q: 0 };
  const drag = .5 * 1.225 * .58 * v * v, aero = .5 * 1.225 * .65 * v * v;
  const normal = mass * G + fanForce + aero, rolling = v > .01 ? .012 * normal : 0;
  const L = 2.8, h = .42, lf = 1.5, ht = .5, hd = .6;
  const base = (mass * G * lf + (fanForce + aero) * 1.45 + h * (nozzle.thrust - drag - rolling) - nozzle.thrust * ht + drag * hd) / L;
  const traction = Math.max(0, c.grip * base / (1 - c.grip * h / L));
  const power = Math.max(0, c.power * 1000 - f.power), motor = Math.min(42000, power / Math.max(v, .1));
  const tire = Math.min(motor, traction), a = (tire + nozzle.thrust - drag - rolling) / mass;
  const rear = base + tire * h / L;
  const limit = !th.ok || !nozzle.ok ? 'OUT OF TABLE' : normal - rear < 0 ? 'CONTACT LIMIT' : traction < motor ? 'TRACTION LIMITED' : v * 42000 > power ? 'POWER LIMITED' : 'TORQUE LIMITED';
  return { ...nozzle, opening, a, tire, traction, motor, resist: drag + rolling, downforce: fanForce + aero, target: f.downforce, electric: tire * v + f.power, limit, T: th.T, p: th.p, thermoOk: th.ok && nozzle.ok };
}
function rk4(s: number[], t: number, dt: number, deriv: (s: number[], t: number) => number[]) {
  const a = deriv(s, t), b = deriv(s.map((v, i) => v + a[i] * dt / 2), t + dt / 2), d = deriv(s.map((v, i) => v + b[i] * dt / 2), t + dt / 2), e = deriv(s.map((v, i) => v + d[i] * dt), t + dt);
  return s.map((v, i) => v + dt / 6 * (a[i] + 2 * b[i] + 2 * d[i] + e[i]));
}
export function simulateLaunch(c: Config, mode = 2, start = initialGas(c), dt = .002): Run {
  const gas0 = withInternalEnergy(c, start);
  let s = [0, 0, gas0.mass, gas0.u, mode > 0 ? fanModel(c).downforce : 0, 0, 0], t = 0, sixty: number | null = null, hundred: number | null = null;
  const samples: Sample[] = []; let status = 'COMPLETE';
  let heldValve=c.boostAt===0,stageSupported=true;
  const derivative = (s: number[], t: number) => {
    const f = forces(c, s, t, mode,heldValve);
    if(!f.thermoOk)stageSupported=false;
    const mdot = f.thermoOk ? f.flow : 0;
    const heat=f.thermoOk?tankHeatRate(c,f.T):0;
    const du = s[2] > 1e-6 && f.thermoOk ? ((s[3] - f.he)*mdot+heat)/s[2] : 0;
    return [s[1], f.a, -mdot, du, (f.target - s[4]) / .12, f.electric,heat];
  };
  function record(f:ReturnType<typeof forces>){samples.push({ t, x: s[0], v: s[1], a: f.a, gas: s[2], u: s[3], temp: f.T, pressure: f.p, thrust: f.thrust, tire: f.tire, downforce: f.downforce, flow: f.flow, he: f.he, energy: s[5], heatRate:tankHeatRate(c,f.T),heatEnergy:s[6],nozzlePressure:f.exitPressure??ATM,nozzleTemp:f.exitTemp??f.T,exitVelocity:f.velocity??0,nozzleMach:f.mach??0,choked:f.choked?1:0,inletPressure:f.inletPressure??f.p,valve:f.opening,valveCommand:mode===2&&t>=c.boostAt&&t<c.boostAt+2?1:0,separated:f.separated?1:0, limit: f.limit, y: 0, vy: 0, traction: f.traction, motor: f.motor, resist: f.resist });}
  let previousValve=mode===2&&t>=c.boostAt&&t<c.boostAt+2;
  for (let i = 0; t < 6 + dt / 2; i++) {
    const f = forces(c, s, t, mode),currentValve=mode===2&&t>=c.boostAt&&t<c.boostAt+2;
    const changed=currentValve!==previousValve;
    if(changed)record(forces(c,s,t,mode,previousValve));
    if(changed||i%Math.max(1,Math.round(.01/dt))===0||t>=6-1e-9||f.limit==='OUT OF TABLE'||f.limit==='CONTACT LIMIT')record(f);
    previousValve=currentValve;
    if (f.limit === 'CONTACT LIMIT' || f.limit === 'OUT OF TABLE') { status = f.limit; break; }
    let step = Math.min(dt, 6 - t); if (step < 1e-9) break;
    for (const event of [c.boostAt, c.boostAt + 2]) if (t < event - 1e-9 && t + step > event) step = event - t;
    heldValve=t>=c.boostAt&&t<c.boostAt+2;
    stageSupported=true;
    const next = rk4(s, t, step, derivative);
    if (!stageSupported||!tankThermo(c,next[2],next[3]).ok) {
      status='OUT OF TABLE';
      if(samples.length) samples[samples.length-1].limit=status;
      break;
    }
    if (sixty === null && next[1] >= 26.8224) sixty = t + step * (26.8224 - s[1]) / (next[1] - s[1]);
    if (hundred === null && next[1] >= 100 / 3.6) hundred = t + step * (100 / 3.6 - s[1]) / (next[1] - s[1]);
    s = next; t += step;
    for(const event of [c.boostAt,c.boostAt+2,6])if(Math.abs(t-event)<1e-9)t=event;
  }
  const th = tankThermo(c, s[2], s[3]);
  return { samples, sixty, hundred, finalGas: { mass: s[2], temp: th.ok ? th.T : gas0.temp, u: s[3] }, used: gas0.mass - s[2], status, peakHeight: 0, landingSpeed: null };
}
function invertFan(c:Config){
  let fan=fanModel(c);
  if(fan.power>c.power*1000){
    let lo=0,hi=c.fan;
    for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(fanModel({...c,fan:mid}).power>c.power*1000)hi=mid;else lo=mid;}
    fan=fanModel({...c,fan:lo});
  }
  return fan;
}
export function invertState(c: Config) {
  const fan = invertFan(c), weight = (c.mass + initialGas(c).mass) * G, rad = c.angle * Math.PI / 180;
  const normal = fan.downforce + weight * Math.cos(rad), demand = Math.abs(weight * Math.sin(rad)), available = c.grip * Math.max(0, normal);
  return { ...fan, normal, demand, available, weight, status: normal <= 0 ? 'CONTACT LOST' : demand > available ? 'SLIDING' : 'ATTACHED', margin: normal / weight };
}

/** Rotating deck rig, SI. Body rectangle is a disclosed contact proxy. */
export const INVERT_RIG={height:5.5,halfLength:4,halfWidth:1.55,bodyHalfLength:2.35,bodyHalfHeight:.65,holdTime:6,timeLimit:8};
/** Piecewise analytic Coulomb sliding and ballistic translation; dt samples it only. */
function simulateInvertFixed(c:Config,dt=.002):Run{
  if(!(dt>0)||!Number.isFinite(dt))throw new Error('Invert timestep must be finite and positive');
  if(!Number.isFinite(c.angle)||c.angle<0||c.angle>180||!Number.isFinite(c.grip)||c.grip<0||!Number.isFinite(c.fan)||c.fan<0||c.fan>100||!Number.isFinite(c.leak)||c.leak<0||c.leak>100||!(c.mass>0)||!(c.power>=0)||!Number.isFinite(c.mass)||!Number.isFinite(c.power)||!Number.isFinite(c.wreckSpeed)||c.wreckSpeed<0)throw new Error('Invalid Invert configuration');
  const gas=initialGas(c),mass=c.mass+gas.mass,load=invertState(c),rig={...INVERT_RIG};
  const rad=c.angle*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad);
  const contact=load.normal>1e-9*load.weight;
  const acceleration=contact?Math.max(0,(load.demand-load.available)/mass):0;
  const sliding=contact&&acceleration>1e-9;
  const edgeDistance=rig.halfLength-rig.bodyHalfLength;
  const sealAt=contact?(sliding?Math.sqrt(2*edgeDistance/acceleration):null):0;
  const unsealedNormal=Math.max(0,load.weight*cs),unsealedA=Math.max(0,G*sn-c.grip*unsealedNormal/mass);
  const sealSpeed=sealAt===null?0:acceleration*sealAt;
  // After seal loss, gravity can still press tires onto the deck. Translate
  // without pitching until the full body clears it (a disclosed guide constraint).
  const remaining=2*rig.bodyHalfLength;
  const clearingTime=sealSpeed>0?2*remaining/(Math.sqrt(sealSpeed**2+2*unsealedA*remaining)+sealSpeed):0;
  const supportedAfterSeal=contact&&cs>1e-9;
  const detachAt=sealAt===null?null:sealAt+(supportedAfterSeal?clearingTime:0);
  const detachReason=detachAt===null?null:!contact?'NORMAL CONTACT LOST':supportedAfterSeal?'PLATFORM CLEAR':'SEAL LOST / NORMAL CONTACT LOST';
  const qAt=(time:number)=>{
    if(!sliding)return 0;
    if(sealAt!==null&&time>sealAt){const tau=time-sealAt;return -edgeDistance-sealSpeed*tau-.5*unsealedA*tau*tau;}
    return -.5*acceleration*time*time;
  };
  const alongVelocity=(time:number)=>!sliding?0:sealAt!==null&&time>sealAt?-sealSpeed-unsealedA*(time-sealAt):-acceleration*time;
  const bodyRadius=rig.bodyHalfLength*Math.abs(sn)+rig.bodyHalfHeight*Math.abs(cs);
  const origin=(q:number)=>[q*cs-rig.bodyHalfHeight*sn,rig.height+q*sn+rig.bodyHalfHeight*cs];
  const release=origin(detachAt===null?0:qAt(detachAt)),slideV=detachAt===null?0:alongVelocity(detachAt);
  const releaseV=[slideV*cs,slideV*sn];
  const flightTime=detachAt===null||release[1]<bodyRadius?null:(releaseV[1]+Math.sqrt(releaseV[1]**2+2*G*(release[1]-bodyRadius)))/G;
  const distanceToGround=sn>1e-12?(rig.height+rig.bodyHalfHeight*cs-bodyRadius)/sn:Infinity;
  const surfaceGroundTime=sliding?(distanceToGround<=edgeDistance?Math.sqrt(2*distanceToGround/acceleration):sealAt!+2*(distanceToGround-edgeDistance)/(Math.sqrt(sealSpeed**2+2*unsealedA*(distanceToGround-edgeDistance))+sealSpeed)):Infinity;
  const flightImpact=detachAt===null||flightTime===null?Infinity:detachAt+flightTime;
  const predictedImpact=Math.min(flightImpact,surfaceGroundTime<= (detachAt??Infinity)?surfaceGroundTime:Infinity);
  const limit=sliding?rig.timeLimit:detachAt===null?rig.holdTime:rig.timeLimit;
  const impactAt=predictedImpact<=limit?predictedImpact:null;
  const end=impactAt??limit,status=impactAt!==null?'IMPACT':!sliding&&contact?'HELD':'TIME LIMIT';
  const events=[{t:0,label:'RELEASE'}];
  if(sliding)events.push({t:0,label:'SLIDING'});
  if(sealAt!==null&&sealAt>0&&sealAt<=end)events.push({t:sealAt,label:'SEAL LOST'});
  if(detachAt!==null&&detachAt<=end)events.push({t:detachAt,label:'DETACHED'});
  events.push({t:end,label:status==='HELD'?'HOLD COMPLETE':status==='IMPACT'?'GROUND IMPACT':'RUN STOP'});
  const thermal=sealedThermal(c,gas,end);
  const samples:Sample[]=[];
  function record(time:number,onSurface:boolean,phase:string,sealedOverride=false){
    const coast=detachAt===null?time:Math.min(time,detachAt),q=qAt(coast),vAlong=alongVelocity(coast),sealed=onSurface&&(sealedOverride||sealAt===null||time<sealAt);
    const normal=onSurface?(sealed?Math.max(0,load.normal):unsealedNormal):0,capacity=c.grip*normal;
    let [x,y]=origin(q),vx=vAlong*cs,vy=vAlong*sn;
    if(!onSurface&&detachAt!==null){const tau=time-detachAt;x=release[0]+releaseV[0]*tau;y=release[1]+releaseV[1]*tau-.5*G*tau*tau;vx=releaseV[0];vy=releaseV[1]-G*tau;}
    const fanTime=sealAt===null?time:Math.min(time,sealAt);
    const warmed=thermal.at(time);
    const row:Sample={t:time,x,y,v:Math.hypot(vx,vy),vy,vx,a:onSurface?(sealed?acceleration:unsealedA):G,angle:rad,along:q,alongV:vAlong,
      normal,demand:onSurface?load.demand:0,capacity,
      clearance:Math.max(0,y-bodyRadius),contact:onSurface?1:0,pressure:pressureOf(c,warmed.gas),temp:warmed.gas.temp,gas:gas.mass,u:warmed.gas.u,heatRate:warmed.rate,heatEnergy:warmed.heat,
      thrust:0,tire:onSurface?(sliding?capacity:load.demand):0,downforce:sealed?load.downforce:0,
      flow:0,he:0,valve:0,energy:load.power*fanTime,limit:phase};
    // Keep direct, structured-clone worker, JSON and CSV representations equal.
    for(const key of Object.keys(row) as (keyof Sample)[])if(Object.is(row[key],-0))(row[key] as number)=0;
    samples.push(row);
  }
  // Explicit left/right limits retain force and electrical-work discontinuities.
  const times=new Set<number>([0,end]);
  for(let time=dt;time<end;time+=dt)times.add(time);
  for(const event of [sealAt,detachAt])if(event!==null&&event>0&&event<end)times.add(event);
  for(const time of [...times].sort((a,b)=>a-b)){
    if(sealAt!==null&&time===sealAt&&time>0)record(time,true,'SLIDING',true);
    else if(detachAt!==null&&time===detachAt&&time>0)record(time,true,'SLIDING / SEAL LOST');
    const onSurface=detachAt===null||time<detachAt;
    record(time,onSurface,time===impactAt?'IMPACT':onSurface?sliding?(sealAt!==null&&time>=sealAt?'SLIDING / SEAL LOST':'SLIDING'):'ATTACHED':'FALLING / SEAL LOST');
  }
  const last=samples.at(-1)!,impactSpeed=impactAt===null?null:last.v;
  return {samples,sixty:null,hundred:null,finalGas:thermal.at(end).gas,used:0,status,peakHeight:Math.max(...samples.map(s=>s.y)),landingSpeed:null,
    invert:{rig,bounds:{minX:Math.min(-rig.halfLength*Math.abs(cs)-.25*Math.abs(sn),...samples.map(s=>s.x-rig.bodyHalfLength*Math.abs(cs)-rig.bodyHalfHeight*Math.abs(sn))),maxX:Math.max(rig.halfLength*Math.abs(cs)+.25*Math.abs(sn),...samples.map(s=>s.x+rig.bodyHalfLength*Math.abs(cs)+rig.bodyHalfHeight*Math.abs(sn))),maxY:Math.max(rig.height+rig.halfLength*Math.abs(sn)+.25*Math.abs(cs),...samples.map(s=>s.y+bodyRadius))},events,sealAt:sealAt!==null&&sealAt<=end?sealAt:null,detachAt:detachAt!==null&&detachAt<=end?detachAt:null,detachReason:detachAt!==null&&detachAt<=end?detachReason:null,
      impactAt,impactSpeed,outcome:impactSpeed===null?status==='HELD'?'HELD':'UNRESOLVED':touchdownOutcome(impactSpeed,c.wreckSpeed),threshold:c.wreckSpeed,
      impactEnergy:impactSpeed===null?null:.5*mass*impactSpeed**2,fanPower:load.power,frictionWork:sliding?load.available*Math.min(edgeDistance,Math.abs(last.along!))+c.grip*unsealedNormal*Math.max(0,Math.abs(last.along!)-edgeDistance):0}};
}

/** Smooth prescribed platform motion; angles are radians, time is seconds.
 * Quintic easing starts and finishes with zero angular velocity/acceleration. */
export function invertRotation(c:Config,time:number){
  const z=Math.max(0,Math.min(1,time/c.invertDuration)),delta=(c.angle-c.invertStart)*Math.PI/180;
  return {angle:c.invertStart*Math.PI/180+delta*(10*z**3-15*z**4+6*z**5),
    omega:delta*(30*z*z-60*z**3+30*z**4)/c.invertDuration,
    alpha:delta*(60*z-180*z*z+120*z**3)/c.invertDuration**2};
}

/** Signed separating-axis gap of the same finite body/deck proxies as rendering.
 * Negative means overlap. Contact response after a new collision is unsupported. */
export function invertDeckGap(p:{x:number;y:number;angle:number;platformAngle:number},rig=INVERT_RIG){
 const e=[Math.cos(p.angle),Math.sin(p.angle)],n=[-e[1],e[0]],d=[Math.cos(p.platformAngle),Math.sin(p.platformAngle)],dn=[-d[1],d[0]];
 const delta=[p.x+.12*dn[0],p.y-rig.height+.12*dn[1]],dot=(a:number[],b:number[])=>a[0]*b[0]+a[1]*b[1];
 return Math.max(...[e,n,d,dn].map(axis=>Math.abs(dot(delta,axis))-rig.bodyHalfLength*Math.abs(dot(e,axis))-rig.bodyHalfHeight*Math.abs(dot(n,axis))-rig.halfLength*Math.abs(dot(d,axis))-.12*Math.abs(dot(dn,axis))));
}
/** Guided supported pitch on a prescribed rotating deck. Locked tires use Coulomb
 * friction. Departure spin is conserved in free flight. Secondary deck contact
 * stops before penetration; tipping and collision response remain unsupported.
 * The external rig actuator supplies/removes work; it is not the vehicle battery. */
export function simulateInvert(c:Config,dt=.002):Run{
  if(!Number.isFinite(c.invertStart)||c.invertStart<0||c.invertStart>180||!Number.isFinite(c.invertDuration)||c.invertDuration<1||c.invertDuration>20)throw new Error('Invalid Invert rotation');
  // Retain the exact analytic stationary-deck limit and its event semantics.
  if(c.invertStart===c.angle){
    const r=simulateInvertFixed(c,dt);
    for(const s of r.samples){s.platformAngle=s.angle;s.platformOmega=0;s.bodyOmega=0;s.alongForce=s.tire;}
    r.invert!.rotation={start:c.invertStart,end:c.angle,duration:c.invertDuration};r.invert!.platformWork=0;
    return r;
  }
  // Reuse stationary validation without generating a trajectory.
  if(!(dt>0)||!Number.isFinite(dt)||!Number.isFinite(c.angle)||c.angle<0||c.angle>180||!Number.isFinite(c.grip)||c.grip<0||!Number.isFinite(c.fan)||c.fan<0||c.fan>100||!Number.isFinite(c.leak)||c.leak<0||c.leak>100||!(c.mass>0)||!(c.power>=0)||!Number.isFinite(c.mass)||!Number.isFinite(c.power)||!Number.isFinite(c.wreckSpeed)||c.wreckSpeed<0)throw new Error('Invalid Invert configuration');
  const rig={...INVERT_RIG},gas=initialGas(c),mass=c.mass+gas.mass,fan=invertFan(c),pressure=pressureOf(c,gas),h=rig.bodyHalfHeight;
  const inertia=mass*((2*rig.bodyHalfLength)**2+(2*h)**2)/12;
  const end=c.invertDuration+2,thermal=sealedThermal(c,gas,end),step=Math.min(dt,.002),samples:Sample[]=[],events=[{t:0,label:'ROTATION START'}];
  let time=0,state=[0,0,0,0],sealed=true,contact=true,sealAt:number|null=null,detachAt:number|null=null,detachReason:string|null=null,impactAt:number|null=null;
  let deckContactAt:number|null=null;
  let departure={x:0,y:0,vx:0,vy:0,angle:0,omega:0},slideRecorded=false,rotationRecorded=false;
  function forces(t:number,s:number[],slip?:number){
    const {angle,omega,alpha}=invertRotation(c,t),[q,u]=s;
    // a_n=q*alpha+2*u*omega-h*omega²; a_t=q''-h*alpha-q*omega².
    const suction=sealed?fan.downforce:0,normal=suction+mass*(G*Math.cos(angle)+q*alpha+2*u*omega-h*omega*omega);
    const drive=h*alpha+q*omega*omega-G*Math.sin(angle),capacity=c.grip*Math.max(0,normal);
    const direction=slip??(Math.abs(u)>1e-9?Math.sign(u):Math.abs(mass*drive)>capacity?Math.sign(drive):0);
    const friction=direction?-direction*capacity:-mass*drive;
    return {angle,omega,alpha,normal,suction,drive,capacity,friction,acceleration:drive+friction/mass,direction};
  }
  function advance(t:number,s:number[],dt:number,direction:number){
    return rk4(s,t,dt,(v:number[],at:number)=>{
      const f=forces(at,v,direction);
      return [v[1],f.acceleration,Math.abs(f.friction*v[1]),(f.normal-f.suction)*v[0]*f.omega-f.friction*h*f.omega+inertia*f.alpha*f.omega];
    });
  }
  function pose(t:number,s:number[]){
    if(!contact){const tau=t-detachAt!;return {x:departure.x+departure.vx*tau,y:departure.y+departure.vy*tau-.5*G*tau*tau,vx:departure.vx,vy:departure.vy-G*tau,angle:departure.angle+departure.omega*tau,omega:departure.omega};}
    const {angle,omega}=invertRotation(c,t),[q,u]=s,cs=Math.cos(angle),sn=Math.sin(angle);
    return {x:q*cs-h*sn,y:rig.height+q*sn+h*cs,vx:u*cs-q*omega*sn-h*omega*cs,vy:u*sn+q*omega*cs-h*omega*sn,angle,omega};
  }
  const clearance=(t:number,s:number[])=>{const p=pose(t,s);return p.y-rig.bodyHalfLength*Math.abs(Math.sin(p.angle))-h*Math.abs(Math.cos(p.angle));};
  function record(phase?:string){
    const p=pose(time,state),f=forces(time,state),rotation=invertRotation(c,time),warmed=thermal.at(time);
    const row:Sample={t:time,x:p.x,y:p.y,vx:p.vx,vy:p.vy,v:Math.hypot(p.vx,p.vy),a:contact?Math.hypot(f.acceleration-h*f.alpha-state[0]*f.omega**2,state[0]*f.alpha+2*state[1]*f.omega-h*f.omega**2):G,angle:p.angle,bodyOmega:p.omega,platformAngle:rotation.angle,platformOmega:rotation.omega,along:state[0],alongV:state[1],
      normal:contact?Math.max(0,f.normal):0,downforce:contact?f.suction:0,tire:contact?Math.abs(f.friction):0,alongForce:contact?f.friction:0,demand:contact?Math.abs(mass*f.drive):0,capacity:contact?f.capacity:0,
      clearance:Math.max(0,clearance(time,state)),contact:contact?1:0,pressure:pressureOf(c,warmed.gas),temp:warmed.gas.temp,gas:gas.mass,u:warmed.gas.u,heatRate:warmed.rate,heatEnergy:warmed.heat,thrust:0,flow:0,he:0,valve:0,energy:fan.power*(sealAt??time),
      limit:phase??(!contact?'FALLING / SEAL LOST':Math.abs(state[1])>1e-8?'SLIDING':time<c.invertDuration?'ROTATING / ATTACHED':'ATTACHED / FINAL ANGLE')};
    for(const key of Object.keys(row) as (keyof Sample)[])if(Object.is(row[key],-0))(row[key] as number)=0;
    samples.push(row);
  }
  function detach(reason:string){departure=pose(time,state);contact=false;sealed=false;sealAt??=time;detachAt=time;detachReason=reason;events.push({t:time,label:'DETACHED'});}
  const initial=forces(0,state);
  if(initial.normal<=0){sealAt=0;detach('NORMAL CONTACT LOST');}
  record();
  while(time<end-1e-10&&impactAt===null&&deckContactAt===null){
    const span=Math.min(step,end-time,time<c.invertDuration?c.invertDuration-time:Infinity);
    const f=forces(time,state),direction=f.direction;
    if(contact&&direction&&!slideRecorded){slideRecorded=true;events.push({t:time,label:'SLIDING'});}
    const next=contact?advance(time,state,span,direction):state.slice();
    const checks:{kind:string;value:(t:number,s:number[])=>number}[]=[{kind:'IMPACT',value:clearance}];
    if(!contact)checks.push({kind:'DECK CONTACT',value:(t,s)=>invertDeckGap({...pose(t,s),platformAngle:invertRotation(c,t).angle},rig)+1e-6});
    if(contact){
      checks.push({kind:'DETACH',value:(t,s)=>forces(t,s).normal});
      if(sealed)checks.push({kind:'SEAL',value:(_,s)=>rig.halfLength-rig.bodyHalfLength-Math.abs(s[0])});
      checks.push({kind:'CLEAR',value:(_,s)=>rig.halfLength+rig.bodyHalfLength-Math.abs(s[0])});
      if(Math.abs(state[1])>1e-9)checks.push({kind:'STOP',value:(_,s)=>Math.sign(state[1])*s[1]});
    }
    let hit='',fraction=1;
    for(const check of checks){
      if(check.value(time+span,next)>0)continue;
      let lo=0,hi=span;
      for(let j=0;j<32;j++){const mid=(lo+hi)/2,s=contact?advance(time,state,mid,direction):state;if(check.value(time+mid,s)>0)lo=mid;else hi=mid;}
      const ratio=(lo+hi)/2/span;if(ratio<fraction){fraction=ratio;hit=check.kind;}
    }
    const elapsed=span*fraction;
    state=contact?advance(time,state,elapsed,direction):state;
    time+=elapsed;
    if(hit==='STOP'){state[1]=0;record();continue;}
    if(hit==='DECK CONTACT'){deckContactAt=time;events.push({t:time,label:'DECK RECONTACT / MODEL LIMIT'});record('DECK CONTACT LIMIT');break;}
    if(hit==='IMPACT'){impactAt=time;events.push({t:time,label:'GROUND IMPACT'});record('IMPACT');break;}
    if(hit){
      record();
      if(hit==='SEAL'){
        sealed=false;sealAt=time;events.push({t:time,label:'SEAL LOST'});
        if(forces(time,state).normal<=0)detach('SEAL LOST / NORMAL CONTACT LOST');
      }else detach(hit==='CLEAR'?'PLATFORM CLEAR':'NORMAL CONTACT LOST');
      record();continue;
    }
    if(!rotationRecorded&&time>=c.invertDuration-1e-9){rotationRecorded=true;events.push({t:time,label:'ROTATION COMPLETE'});}
    record();
  }
  const last=samples.at(-1)!,status=deckContactAt!==null?'DECK CONTACT LIMIT':impactAt!==null?'IMPACT':contact&&Math.abs(state[1])<1e-6?'HELD':'TIME LIMIT',impactSpeed=impactAt===null?null:last.v;
  if(impactAt===null)events.push({t:time,label:status==='HELD'?'HOLD COMPLETE':'RUN STOP'});
  const radius=(s:Sample)=>rig.bodyHalfLength*Math.abs(Math.cos(s.angle!))+h*Math.abs(Math.sin(s.angle!));
  return {samples,sixty:null,hundred:null,finalGas:thermal.at(time).gas,used:0,status,peakHeight:Math.max(...samples.map(s=>s.y)),landingSpeed:null,
    invert:{rig,bounds:{minX:Math.min(-4.25,...samples.map(s=>s.x-radius(s))),maxX:Math.max(4.25,...samples.map(s=>s.x+radius(s))),maxY:Math.max(rig.height+4.25,...samples.map(s=>s.y+rig.bodyHalfLength*Math.abs(Math.sin(s.angle!))+h*Math.abs(Math.cos(s.angle!))))},events,sealAt,detachAt,detachReason,impactAt,impactSpeed,deckContactAt,stopReason:deckContactAt!==null?"Secondary deck contact requires a collision/contact response model":"",
      outcome:impactSpeed===null?status==='HELD'?'HELD':'UNRESOLVED':touchdownOutcome(impactSpeed,c.wreckSpeed),threshold:c.wreckSpeed,impactEnergy:impactSpeed===null?null:.5*mass*impactSpeed**2+.5*inertia*(last.bodyOmega??0)**2,fanPower:fan.power,frictionWork:state[2],platformWork:state[3],rotation:{start:c.invertStart,end:c.angle,duration:c.invertDuration}}};
}

export function invertCsv(run:Run,c:Config){
  const info=run.invert!,config='"'+JSON.stringify(c).replaceAll('"','""')+'"',rig='"'+JSON.stringify(info.rig).replaceAll('"','""')+'"';
  return ['time_s,com_x_m,com_y_m,vx_m_s,vy_m_s,speed_m_s,body_angle_rad,platform_angle_rad,platform_angular_velocity_rad_s,body_angular_velocity_rad_s,along_m,along_velocity_m_s,contact,clearance_m,normal_N,suction_N,friction_N,demand_N,capacity_N,electrical_J,heat_rate_W,heat_input_J,gas_kg,temperature_K,tank_u_J_kg,pressure_Pa,phase,run_status,outcome,impact_speed_m_s,wreck_threshold_m_s,detach_reason,rig_json,config_json',
    ...run.samples.map(s=>[s.t,s.x,s.y,s.vx,s.vy,s.v,s.angle,s.platformAngle,s.platformOmega,s.bodyOmega??0,s.along,s.alongV,s.contact,s.clearance,s.normal,s.downforce,s.tire,s.demand,s.capacity,s.energy,s.heatRate??0,s.heatEnergy??0,s.gas,s.temp,s.u,s.pressure,s.limit,run.status,info.outcome,info.impactSpeed??'',info.threshold,info.detachReason??'',rig,config].join(','))].join('\n');
}
// Exact-state cache; only the adiabatic tank path is reused, never a trajectory.
type HopProfile={points:{t:number;dv:number;dy:number}[];maxOpenTime:number;cutoff:string};
const hopProfiles=new Map<string,HopProfile>();
function hopBurnProfile(c:Config,state:number[]):HopProfile {
  const key=JSON.stringify([c.mass,c.volume,c.nozzle,c.valveRise,c.feedLoss,c.expansionRatio,c.heatTransfer,c.heatSourceTemp,state[2],state[3]]);
  const cached=hopProfiles.get(key);if(cached)return cached;
  const h=.01,area=hopNozzles(c).totalArea;
  let s=[0,0,state[2],state[3]],valid=true,cutoff='FORECAST TIME LIMIT';
  const points=[{t:0,dv:0,dy:0}];
  const derivative=(a:number[],time:number)=>{
    const th=tankThermo(c,a[2],a[3]);
    const n=th.ok?gasDelivery(c,th.p,th.T,area):{ok:false,thrust:0,flow:0,he:0};
    if(!n.ok){valid=false;return [a[1],-G,0,0];}
    const opening=valveOpening(time,c.valveRise??0);
    return [a[1],n.thrust*opening/(c.mass+a[2])-G,-n.flow*opening,((a[3]-n.he)*n.flow*opening+tankHeatRate(c,th.T))/a[2]];
  };
  for(let i=1;i<=6000;i++){
    const th=tankThermo(c,s[2],s[3]);
    if(!th.ok){cutoff='GAS MODEL LIMIT';break;}
    const n=gasDelivery(c,th.p,th.T,area);
    if(!n.ok){cutoff='GAS MODEL LIMIT';break;}
    if(n.flow<=1e-9){cutoff='PRESSURE EXHAUSTED';break;}
    valid=true;const next=rk4(s,(i-1)*h,h,derivative);
    if(!valid||!tankThermo(c,next[2],next[3]).ok){cutoff='GAS MODEL LIMIT';break;}
    s=next;points.push({t:i*h,dv:s[1],dy:s[0]});
  }
  // Keep a 20 ms numerical reserve before any forecast limit. An explicitly
  // closed valve holds a supported tank state while the car can continue coasting.
  points.splice(Math.max(1,points.length-2));
  const maxOpenTime=points.at(-1)!.t;
  const result={points,maxOpenTime,cutoff};
  if(hopProfiles.size>=8)hopProfiles.delete(hopProfiles.keys().next().value!);
  hopProfiles.set(key,result);return result;
}

/** Predict one coast/full-burn descent using the actual remaining adiabatic tank.
 * The profile's x/v are integrals of F(m,u)/(m_dry+m)-g, not a second car run.
 * A valve-duty time warp preserves its tank path; gravity stays in physical time.
 */
function planHopLanding(c: Config, state: number[], time: number, target: number, lead: number): LandingPlan {
  const height=state[0]+Math.max(0,state[1])**2/(2*G),apex=time+Math.max(0,state[1])/G;
  const fallTime=Math.sqrt(2*height/G),ballisticSpeed=G*fallTime;
  const thermal=sealedThermal(c,{mass:state[2],u:state[3],temp:tankThermo(c,state[2],state[3]).T},Math.max(0,apex-time)+fallTime);
  const base={ignitionAt:null,maxOpenTime:0,predictedSpeed:ballisticSpeed,feasible:ballisticSpeed<=target,reason:'BALLISTIC TARGET MET',cutoff:'',coastTime:fallTime};
  if(ballisticSpeed<=target)return base;
  const {points,maxOpenTime,cutoff}=hopBurnProfile(c,state);
  // Heat depends on elapsed coast time, so the old open-time-only time warp
  // cannot be reused. Precompute five actual heated ignition states. Interpolate
  // the short burn forecast in initial u, without changing the full-run solver.
  // All profiles use the same 10 ms time grid; stop at the common safe horizon.
  const heating=(c.heatTransfer??0)>0;
  const warmProfiles=heating?Array.from({length:5},(_,i)=>{
    const gas=thermal.at(Math.max(0,apex-time)+fallTime*i/4).gas;
    return {u:gas.u,profile:hopBurnProfile(c,[0,0,gas.mass,gas.u])};
  }):[];
  function thermalProfile(delay:number){
    const gas=thermal.at(Math.max(0,apex-time)+delay).gas;
    const z=Math.min(3,Math.floor(Math.max(0,delay/fallTime*4))),a=warmProfiles[z],b=warmProfiles[z+1];
    const k=b.u!==a.u?Math.max(0,Math.min(1,(gas.u-a.u)/(b.u-a.u))):0;
    const length=Math.min(a.profile.points.length,b.profile.points.length);
    const points=Array.from({length},(_,i)=>{const x=a.profile.points[i],y=b.profile.points[i];return {t:x.t,dv:x.dv+k*(y.dv-x.dv),dy:x.dy+k*(y.dy-x.dy)};});
    return {points,maxOpenTime:points.at(-1)!.t,cutoff:a.profile.cutoff};
  }
  type Candidate={delay:number;speed:number;rebound:boolean};
  function predict(delay:number):Candidate {
    const y0=Math.max(0,height-.5*G*delay*delay),v0=-G*delay;
    const path=heating?thermalProfile(delay):{points,maxOpenTime,cutoff};
    const burnPoints=path.points;
    let y=y0,v=v0,last=burnPoints[0];
    if(y0<=1e-10)return {delay,speed:-v0,rebound:false};
    for(let i=1;i<burnPoints.length;i++){
      const p=burnPoints[i],nextY=y0+v0*p.t+p.dy,nextV=v0+p.dv;
      if(nextY<=0){
        const dt=p.t-last.t,a=(nextV-v)/dt;let lo=0,hi=dt;
        for(let j=0;j<22;j++){const q=(lo+hi)/2;if(y+v*q+.5*a*q*q>0)lo=q;else hi=q;}
        return {delay,speed:Math.abs(v+a*(lo+hi)/2),rebound:false};
      }
      if(nextV>1e-7)return {delay,speed:Infinity,rebound:true};
      y=nextY;v=nextV;last=p;
    }
    return {delay,speed:Math.sqrt(Math.max(0,v*v+2*G*y)),rebound:false};
  }
  const candidates:Candidate[]=[],count=(c.heatTransfer??0)>0?32:96,spacing=fallTime/count;
  let previous=predict(0);candidates.push(previous);
  for(let i=1;i<=count;i++){
    const candidate=predict(i*spacing);
    if(previous.rebound&&!candidate.rebound){
      let lo=previous.delay,hi=candidate.delay;
      for(let j=0;j<24;j++){const mid=(lo+hi)/2;if(predict(mid).rebound)lo=mid;else hi=mid;}
      candidates.push(predict(hi));
    }
    candidates.push(candidate);previous=candidate;
  }
  let best=candidates.reduce((a,b)=>b.speed<a.speed?b:a);
  // Refine the best supported interval, including hardware-limited cases.
  let lo=Math.max(0,best.delay-spacing),hi=Math.min(fallTime,best.delay+spacing);
  for(let i=0;i<24;i++){
    const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3,pa=predict(a),pb=predict(b);
    if(pa.speed<best.speed)best=pa;if(pb.speed<best.speed)best=pb;
    if(pa.speed<pb.speed)hi=b;else lo=a;
  }
  candidates.push(best);
  const feasible=best.speed<=target+.01;
  let chosen=best;
  if(feasible){
    const safe=candidates.filter(p=>!p.rebound&&p.speed<=target);
    if(safe.length){
      chosen=safe.reduce((a,b)=>b.delay>a.delay?b:a);
      lo=chosen.delay;hi=Math.min(fallTime,lo+spacing);
      for(let i=0;i<28;i++){const mid=(lo+hi)/2,p=predict(mid);if(!p.rebound&&p.speed<=target)lo=mid;else hi=mid;}
      chosen=predict(lo);
    }
  }
  const ignitionDelay=Math.max(0,chosen.delay-(feasible?lead:0));
  const selected=heating?thermalProfile(ignitionDelay):{maxOpenTime};
  return {ignitionAt:apex+ignitionDelay,maxOpenTime:selected.maxOpenTime,predictedSpeed:chosen.speed,
    feasible,reason:feasible?'TARGET WITHIN FORECAST':'RESERVE LIMITED / BEST EFFORT',cutoff,coastTime:chosen.delay};
}

export function simulateHop(c: Config, dt = .002): Run {
  if (!(dt > 0) || !Number.isFinite(dt)) throw new Error('Hop timestep must be finite and positive');
  const start = initialGas(c), target = c.landingTarget??1.5, lead = c.landingLead??.02;
  if(!Number.isFinite(target)||target<.25||target>5||!Number.isFinite(lead)||lead<0||lead>.2)throw new Error('Invalid landing controller settings');
  const landingMode=c.landingBurn??0,manualAt=c.manualBurnAt??2.21,manualDuration=c.manualBurnDuration??1,manualCommand=c.manualBurnCommand??100;
  if(![0,1,2].includes(landingMode)||!Number.isFinite(manualAt)||manualAt<0||manualAt>120||!Number.isFinite(manualDuration)||manualDuration<0||manualDuration>5||!Number.isFinite(manualCommand)||manualCommand<0||manualCommand>100)throw new Error('Invalid manual landing settings');
  const manualEnd=manualAt+manualDuration;
  const threshold = c.wreckSpeed ?? 5;
  if (!(threshold >= 0) || !Number.isFinite(threshold)) throw new Error('Invalid wreck speed');
  let s = [0, 0, start.mass, start.u,0], t = 0, airborne = false, peakHeight = 0;
  let landingSpeed: number | null = null, burnStart: number | null = null, braking = false, openTime=0;
  let plan:LandingPlan|null=null,manualSafety:HopProfile|null=null,burnEnd:number|null=null;
  let stageSupported=true;
  const samples: Sample[] = []; let status = 'TIME LIMIT', previousControl:{throttle:number;phase:string}|null=null;
  const hardware = hopNozzles(c);
  function delivery(state: number[], throttle: number,elapsed=Infinity) {
    const th = tankThermo(c, state[2], state[3]);
    if (!th.ok) return { flow: 0, thrust: 0, he: 0, T: th.T, p: th.p, ok: false };
    // A bounded duty-cycle valve command scales mean flow and force together.
    const n = throttle > 0 ? gasDelivery(c,th.p, th.T, hardware.totalArea) : {flow:0,thrust:0,he:0,ok:true};
    const opening=throttle*valveOpening(elapsed,c.valveRise??0);
    return {...n,flow:n.flow*opening,thrust:n.thrust*opening,opening,T:th.T,p:th.p};
  }
  function command() {
    if (t < c.pulse) return {throttle:1,phase:'THRUST PULSE'};
    if(landingMode===2){
      if(!airborne||manualDuration===0||manualCommand===0)return {throttle:0,phase:'MANUAL BURN DISABLED'};
      if(t>=manualEnd-1e-10)return {throttle:0,phase:burnStart===null?'MANUAL WINDOW MISSED':'MANUAL BURN COMPLETE'};
      if(t<manualAt)return {throttle:0,phase:'WAITING FOR MANUAL IGNITION'};
      if(burnStart===null&&s[1]>=0)return {throttle:0,phase:'MANUAL WINDOW / WAITING FOR DESCENT'};
      if(!manualSafety)manualSafety=hopBurnProfile(c,s);
      braking=true;
      if(openTime>=manualSafety.maxOpenTime-1e-9)return {throttle:0,phase:manualSafety.cutoff+' / VALVE CLOSED'};
      const duty=manualCommand/100,n=delivery(s,duty);
      if(!n.ok)return {throttle:duty,phase:'OUT OF TABLE'};
      if(n.thrust<=0)return {throttle:0,phase:'PRESSURE EXHAUSTED'};
      if(burnStart===null)burnStart=t;
      return {throttle:duty,phase:s[1]>0?'MANUAL BURN / REBOUND':'MANUAL LANDING BURN'};
    }
    if(landingMode===1&&airborne&&!plan)plan=planHopLanding(c,s,t,target,lead);
    if (!c.landingBurn || !airborne || s[1] >= 0) return {throttle:0,phase:'BALLISTIC COAST'};
    if(plan?.ignitionAt===null)return {throttle:0,phase:'BALLISTIC TARGET MET'};
    if(!braking&&t<(plan?.ignitionAt??Infinity))return {throttle:0,phase:'DESCENT / WAITING TO BRAKE'};
    braking=true;
    if(openTime>=(plan?.maxOpenTime??0)-1e-9)return {throttle:0,phase:(plan?.cutoff??'GAS MODEL LIMIT')+' / VALVE CLOSED'};
    const n = delivery(s,1), mass = c.mass+s[2], brake = n.thrust/mass-G;
    if (!n.ok) return {throttle:1,phase:'OUT OF TABLE'};
    if (n.thrust <= 0) return {throttle:0,phase:'PRESSURE EXHAUSTED'};
    if (burnStart === null) burnStart=t;
    if (brake <= 0) return {throttle:1,phase:'INSUFFICIENT BRAKING'};
    // Full available braking until near the target; bounded velocity feedback
    // then prevents an early-ignition rebound. This is mean valve duty, not
    // an unsupported physical regulator or a change in nozzle exit pressure.
    const required=mass*(G+(-s[1]-target)/.025);
    return {throttle:Math.max(0,Math.min(1,required/n.thrust)),phase:'LANDING BURN'};
  }
  function derivative(state: number[], throttle: number,elapsed=Infinity) {
    const n=delivery(state,throttle,elapsed),a=n.thrust/(c.mass+state[2])-G;
    if(!n.ok)stageSupported=false;
    const heat=n.ok?tankHeatRate(c,n.T):0;
    const mdot=n.ok?n.flow:0,du=state[2]>1e-6&&n.ok?((state[3]-n.he)*mdot+heat)/state[2]:0;
    return [state[1],!airborne&&state[0]<=0&&state[1]<=0?Math.max(0,a):a,-mdot,du,heat];
  }
  function record(throttle: number, limit: string) {
    const elapsed=t<c.pulse||limit==='THRUST PULSE'?t:t-(burnStart??t),n=delivery(s,throttle,elapsed);
    samples.push({t,x:0,v:Math.abs(s[1]),a:derivative(s,throttle,elapsed)[1],pressure:n.p,temp:n.T,gas:s[2],u:s[3],thrust:n.thrust,tire:0,downforce:0,flow:n.flow,he:n.he,energy:0,heatRate:tankHeatRate(c,n.T),heatEnergy:s[4],nozzlePressure:n.exitPressure??ATM,nozzleTemp:n.exitTemp??n.T,exitVelocity:n.velocity??0,nozzleMach:n.mach??0,choked:n.choked?1:0,inletPressure:n.inletPressure??n.p,valveCommand:throttle,separated:n.separated?1:0,limit,y:Math.max(0,s[0]),vy:s[1],valve:n.opening??0});
  }
  while(t<=120){
    const control=command(),n=delivery(s,control.throttle);
    if(!n.ok){status='OUT OF TABLE';if(samples.length)samples.at(-1)!.limit=status;else record(0,status);break;}
    // Preserve both sides of valve discontinuities at identical timestamps.
    // Interpolation selects the right side; trapezoidal exports retain the true
    // left-limit flow instead of inventing a ramp through a closed valve.
    if(previousControl&&control.throttle!==previousControl.throttle)record(previousControl.throttle,previousControl.phase);
    if(landingMode===2&&burnStart!==null&&burnEnd===null&&previousControl?.throttle&&control.throttle===0)burnEnd=t;
    peakHeight=Math.max(peakHeight,s[0]);record(control.throttle,control.phase);
    if(!airborne&&t>=c.pulse){status='INSUFFICIENT LIFT';samples.at(-1)!.limit=status;break;}
    if(t>=120)break;
    let step=Math.min(dt,120-t);
    if(t<c.pulse&&t+step>c.pulse)step=c.pulse-t;
    if(plan?.ignitionAt!==null&&plan?.ignitionAt!==undefined&&t<plan.ignitionAt&&t+step>plan.ignitionAt)step=plan.ignitionAt-t;
    if(landingMode===2){
      for(const event of [manualAt,manualEnd])if(t<event&&t+step>event)step=event-t;
      // Initial manual ignition is descent-only; align an apex inside its window.
      if(burnStart===null&&t>=c.pulse&&s[1]>0&&t+s[1]/G>t&&t+s[1]/G<t+step)step=s[1]/G;
    }
    if(braking&&control.throttle>0)step=Math.min(step,((manualSafety?.maxOpenTime??plan?.maxOpenTime??0)-openTime)/control.throttle);
    // Hold each controller command through an RK4 step. Pulse closure is an exact
    // step boundary; no RK stage applies the next valve state to the previous step.
    const integrate=(h:number)=>{stageSupported=true;return rk4(s,t,h,(state,stageTime)=>derivative(state,control.throttle,stageTime-(t<c.pulse?0:burnStart??t)));};
    const next=integrate(step);
    if(!stageSupported||!tankThermo(c,next[2],next[3]).ok){status='OUT OF TABLE';samples.at(-1)!.limit=status;break;}
    if(next[0]>1e-10)airborne=true;
    if(airborne&&next[0]<=0){
      let lo=0,hi=step;
      for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(integrate(mid)[0]>0)lo=mid;else hi=mid;}
      const contact=integrate((lo+hi)/2);
      landingSpeed=Math.abs(contact[1]);t+=(lo+hi)/2;s=contact;s[0]=0;
      if(burnStart!==null&&burnEnd===null)burnEnd=t;
      status='TOUCHDOWN';if(control.throttle>0)record(control.throttle,'PRE-TOUCHDOWN');record(0,status);break;
    }
    if(braking)openTime+=control.throttle*step;
    previousControl=control;
    s=next;t+=step;
    if(Math.abs(t-c.pulse)<1e-10)t=c.pulse;
  }
  const th=tankThermo(c,s[2],s[3]);
  return {samples,sixty:null,hundred:null,finalGas:{mass:s[2],temp:th.ok?th.T:start.temp,u:s[3]},used:start.mass-s[2],status,peakHeight,landingSpeed,
    landing:{outcome:touchdownOutcome(landingSpeed,threshold),threshold,impactEnergy:landingSpeed===null?null:.5*(c.mass+s[2])*landingSpeed**2,burnStart,target,lead,plan,controller:landingMode===2?'manual-window-v1':landingMode===1?'blowdown-lookahead-v1':'ballistic',mode:['off','automatic','manual'][landingMode],manualAt,manualDuration,manualCommand,burnEnd}};
}
export function sampleAt(run: Run, t: number): Sample {
  const a = run.samples; let lo = 0, hi = a.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (a[mid].t <= t) lo = mid; else hi = mid - 1; }
  const left = a[lo], right = a[Math.min(lo + 1, a.length - 1)]; const k = right.t > left.t ? Math.max(0, Math.min(1, (t - left.t) / (right.t - left.t))) : 0;
  const out = { ...left }; for (const key of Object.keys(left) as (keyof Sample)[]) if (key !== 'limit') (out[key] as number) = (left[key] as number) + k * ((right[key] as number) - (left[key] as number)); return out;
}

export function hopCsv(run: Run, c: Config) {
  const config='"'+JSON.stringify(c).replaceAll('"','""')+'"';
  return ['time_s,height_m,vertical_velocity_m_s,acceleration_m_s2,pressure_Pa,temperature_K,gas_kg,tank_u_J_kg,thrust_N,massflow_kg_s,outflow_h_J_kg,heat_rate_W,heat_input_J,nozzle_exit_pressure_Pa,nozzle_exit_temperature_K,exit_velocity_m_s,nozzle_mach,choked,nozzle_active,valve_opening,valve_command,feed_pressure_Pa,nozzle_separated,valve_duty,phase,run_status,landing_speed_m_s,wreck_threshold_m_s,outcome,landing_burn,burn_start_s,target_speed_m_s,ignition_lead_s,forecast_feasible,controller,manual_start_s,manual_duration_s,manual_command_pct,burn_end_s,config_json',
    ...run.samples.map(s=>[s.t,s.y,s.vy,s.a,s.pressure,s.temp,s.gas,s.u,s.thrust,s.flow,s.he,s.heatRate??0,s.heatEnergy??0,s.nozzlePressure??ATM,s.nozzleTemp??s.temp,s.exitVelocity??0,s.nozzleMach??0,s.choked??0,s.flow>1e-8?1:0,s.valve??0,s.valveCommand??0,s.inletPressure??s.pressure,s.separated??0,s.valve??0,s.limit,run.status,run.landingSpeed??'',run.landing?.threshold??c.wreckSpeed,run.landing?.outcome??'NO TOUCHDOWN',c.landingBurn,run.landing?.burnStart??'',run.landing?.target??c.landingTarget,run.landing?.lead??c.landingLead,run.landing?.plan?.feasible??'',run.landing?.controller??'',run.landing?.manualAt??'',run.landing?.manualDuration??'',run.landing?.manualCommand??'',run.landing?.burnEnd??'',config].join(','))].join('\n');
}


export type TurnEdge={x:number;z:number;angle:number;halfLength:number;halfWidth:number;kind:string};
export type TurnTrack={radius:number;width:number;sweep:number;halfLength:number;halfWidth:number;edges:TurnEdge[];centerline:{x:number;z:number}[]};
export type TurnInfo={mode:number;curvature:number;requestedCurvature:number;beta:number;effectiveSteer:number;gripLimited:boolean;lateralCapacity:number;lateralDemand:number;driveForce:number;fanPower:number;drivePower:number;fanForce:number;laneExitAt:number|null;laneExitSide:string|null;exitAt:number|null;outcome:string;events:{t:number;label:string}[]};
export const TURN_WHEELBASE=2.8,TURN_REAR_CG=1.45;
/** Same physical road for both cases; steering command never changes road geometry. */
export function turnTrack(c:Config):TurnTrack{
 const radius=c.turnRadius,width=c.turnWidth,sweep=c.turnSweep;
 if(![radius,width,sweep].every(Number.isFinite)||radius<15||radius>100||width<6||width>18||sweep<Math.PI/6||sweep>Math.PI*5/6)throw new Error('Invalid Turn track geometry');
 const count=Math.max(12,Math.ceil((radius+width/2)*sweep/1.5)),edges:TurnEdge[]=[],centerline=[];
 for(let j=0;j<=count;j++){const a=sweep*j/count;centerline.push({x:radius*Math.sin(a),z:radius*(Math.cos(a)-1)});}
 for(const side of [-1,1])for(let j=0;j<count;j++){
  const r=radius+side*width/2,a=sweep*j/count,b=sweep*(j+1)/count;
  const x1=r*Math.sin(a),z1=r*Math.cos(a)-radius,x2=r*Math.sin(b),z2=r*Math.cos(b)-radius;
  edges.push({x:(x1+x2)/2,z:(z1+z2)/2,angle:Math.atan2(z2-z1,x2-x1),halfLength:Math.hypot(x2-x1,z2-z1)/2+.003,halfWidth:0,kind:side<0?'INNER':'OUTER'});
 }
 return {radius,width,sweep,halfLength:2.35,halfWidth:1.03,edges,centerline};
}
/** Separating-axis gap to painted lane edges. Crossing is an event, never an impact. */
export function turnLaneGap(x:number,z:number,yaw:number,track:TurnTrack){
 const forward=[Math.cos(yaw),-Math.sin(yaw)],side=[Math.sin(yaw),Math.cos(yaw)];
 let gap=Infinity,edge=track.edges[0];
 for(const w of track.edges){
  const along=[Math.cos(w.angle),Math.sin(w.angle)],normal=[-along[1],along[0]],dx=x-w.x,dz=z-w.z;
  let separation=-Infinity;
  for(const axis of [forward,side,along,normal]){
   const carRadius=track.halfLength*Math.abs(axis[0]*forward[0]+axis[1]*forward[1])+track.halfWidth*Math.abs(axis[0]*side[0]+axis[1]*side[1]);
   const railRadius=w.halfLength*Math.abs(axis[0]*along[0]+axis[1]*along[1])+w.halfWidth*Math.abs(axis[0]*normal[0]+axis[1]*normal[1]);
   separation=Math.max(separation,Math.abs(dx*axis[0]+dz*axis[1])-carRadius-railRadius);
  }
  if(separation<gap){gap=separation;edge=w;}
 }
 return {gap,edge};
}
function turnLoads(c:Config,mode:number){
 const mass=c.mass+initialGas(c).mass,v=c.turnSpeed,aero=.5*1.225*.65*v*v,drag=.5*1.225*.58*v*v;
 const evaluate=(command:number)=>{const fan=fanModel({...c,fan:command}),normal=mass*G+aero+fan.downforce,driveForce=drag+.012*normal;return {fan,normal,driveForce,drivePower:driveForce*v,power:fan.power+driveForce*v};};
 let command=mode===1?c.fan:0,load=evaluate(command);
 if(load.power>c.power*1000&&command>0){let lo=0,hi=command;for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(evaluate(mid).power<=c.power*1000)lo=mid;else hi=mid;}command=lo;load=evaluate(command);}
 const tireMax=c.grip*load.normal,capacity=Math.sqrt(Math.max(0,tireMax*tireMax-load.driveForce**2));
 return {...load,mass,capacity,aero,command,supported:load.power<=c.power*1000+1e-6&&load.driveForce<=tireMax+1e-8};
}
/** Steady-state bicycle geometry with a vehicle-level combined friction circle.
 * Effective curvature saturates; no transient tire slip/yaw or tire heating is solved.
 */
export function simulateTurn(c:Config,mode=1,dt=.002,track=turnTrack(c)):Run{
 if(!(dt>0)||!Number.isFinite(dt))throw new Error('Turn sample interval must be finite and positive');
 if(![0,1].includes(mode)||![c.turnSpeed,c.turnSteer,c.turnRadius,c.turnSweep,c.turnWidth,c.mass,c.power,c.grip,c.fan,c.leak,c.wreckSpeed].every(Number.isFinite)||c.turnSpeed<=0||c.turnSpeed>60||Math.abs(c.turnSteer)>Math.PI/6||c.turnRadius<15||c.turnRadius>100||c.turnWidth<6||c.turnWidth>18||c.turnSweep<Math.PI/6||c.turnSweep>Math.PI*5/6||c.mass<=0||c.power<0||c.grip<0||c.grip>3||c.fan<0||c.fan>100||c.leak<0||c.leak>100||c.wreckSpeed<0)throw new Error('Invalid Turn configuration');
 const gas=initialGas(c),load=turnLoads(c,mode),v=c.turnSpeed,requestedBeta=Math.atan(TURN_REAR_CG/TURN_WHEELBASE*Math.tan(c.turnSteer));
 const requestedCurvature=Math.tan(c.turnSteer)*Math.cos(requestedBeta)/TURN_WHEELBASE;
 const curvature=Math.sign(requestedCurvature)*Math.min(Math.abs(requestedCurvature),load.capacity/load.mass/v**2);
 const beta=Math.asin(TURN_REAR_CG*curvature),effectiveSteer=Math.atan(TURN_WHEELBASE*curvature/Math.cos(beta));
 const lateralAccel=v*v*curvature,demand=load.mass*v*v*Math.abs(requestedCurvature),gripLimited=demand>load.capacity+1e-6;
 const pose=(time:number)=>{const course=curvature*v*time;return {x:Math.abs(curvature)>1e-12?Math.sin(course)/curvature:v*time,z:Math.abs(curvature)>1e-12?-2*Math.sin(course/2)**2/curvature:0,yaw:course-beta,course};};
 const endPoint=track.centerline.at(-1)!,tangent=[Math.cos(track.sweep),-Math.sin(track.sweep)];
 const exitGap=(time:number)=>{const p=pose(time),forward=[Math.cos(p.yaw),-Math.sin(p.yaw)],side=[Math.sin(p.yaw),Math.cos(p.yaw)];return (p.x-endPoint.x)*tangent[0]+(p.z-endPoint.z)*tangent[1]-track.halfLength*Math.abs(forward[0]*tangent[0]+forward[1]*tangent[1])-track.halfWidth*Math.abs(side[0]*tangent[0]+side[1]*tangent[1]);};
 // Bounded observation window lets a car missing the exit continue through runoff.
 const limit=Math.min(30,track.radius*track.sweep/v+2),speedBound=v+Math.abs(curvature*v)*Math.hypot(track.halfLength,track.halfWidth);
 let end=0,status=load.supported?'TIME LIMIT':'SPEED HOLD LIMIT',laneExitAt:number|null=null,laneExitSide:string|null=null,exitAt:number|null=null;
 if(load.supported){
  // Event search is independent of output sampling. After first lane departure,
  // continue the same analytic path without contact forces, damage or a reset.
  for(let j=0;j<20000&&end<limit;j++){
   let step=Math.min(.025,limit-end);
   if(laneExitAt===null){const p=pose(end),contact=turnLaneGap(p.x,p.z,p.yaw,track);
    if(contact.gap<=1e-7){laneExitAt=end;laneExitSide=contact.edge.kind;}
    else step=Math.min(step,contact.gap/speedBound*.8);
   }
   const next=end+step;
   if(exitGap(next)>=0){let lo=end,hi=next;for(let k=0;k<42;k++){const mid=(lo+hi)/2;if(exitGap(mid)>=0)hi=mid;else lo=mid;}end=(lo+hi)/2;exitAt=end;status=laneExitAt===null?'CORNER CLEAR':'OFF TRACK';break;}
   if(next===end){status='MODEL LIMIT';break;}
   end=next;
  }
  if(status==='TIME LIMIT'&&end<limit-1e-7)status='MODEL LIMIT';
  if(status==='TIME LIMIT'&&laneExitAt!==null)status='OFF TRACK';
 }
 if(end/dt>100000)throw new Error('Turn sample interval creates excessive output');
 const times=[0];for(let time=dt;time<end;time+=dt)times.push(time);if(laneExitAt!==null&&laneExitAt>0&&laneExitAt<end)times.push(laneExitAt);if(end>0)times.push(end);times.sort((a,b)=>a-b);
 const thermal=sealedThermal(c,gas,end);
 const samples:Sample[]=times.map(time=>{
  const p=pose(time),warmed=thermal.at(time),row:Sample={t:time,...p,y:0,v,vy:0,vx:v*Math.cos(p.course),a:lateralAccel,steer:c.turnSteer,distance:v*time,lateralAccel,
   laneError:Math.hypot(p.x,p.z+track.radius)-track.radius,utilization:load.capacity>0?demand/load.capacity:0,utilizationValid:load.capacity>0||demand===0?1:0,
   normal:load.normal,demand,capacity:load.capacity,pressure:pressureOf(c,warmed.gas),gas:gas.mass,temp:warmed.gas.temp,u:warmed.gas.u,heatRate:warmed.rate,heatEnergy:warmed.heat,
   thrust:0,tire:load.supported?load.driveForce:0,downforce:load.fan.downforce+load.aero,flow:0,he:0,valve:0,energy:load.power*time,
   limit:time===end?status:laneExitAt!==null&&time>=laneExitAt?'OFF TRACK / CONTINUING':gripLimited?'GRIP LIMITED / WIDER TURN':'TRACKING STEERING'};
  for(const key of Object.keys(row) as (keyof Sample)[])if(Object.is(row[key],-0))(row[key] as number)=0;
  return row;
 });
 const outcome=status==='CORNER CLEAR'?'CLEAR':status==='OFF TRACK'?'LEFT LANE':'UNRESOLVED';
 return {samples,sixty:null,hundred:null,finalGas:thermal.at(end).gas,used:0,status,peakHeight:0,landingSpeed:null,
  turn:{mode,curvature,requestedCurvature,beta,effectiveSteer,gripLimited,lateralCapacity:load.capacity,lateralDemand:demand,driveForce:load.driveForce,fanPower:load.fan.power,drivePower:load.drivePower,fanForce:load.fan.downforce,laneExitAt,laneExitSide,exitAt,outcome,events:[{t:0,label:gripLimited?'GRIP LIMITED':'ENTRY'},...(laneExitAt===null?[]:[{t:laneExitAt,label:'LEFT LANE'}]),{t:end,label:status}]}};
}
export function simulateTurnComparison(c:Config){
 const track=turnTrack(c),runs=[0,1].map(mode=>simulateTurn(c,mode,.002,track));
 const points=[...track.centerline,...runs.flatMap(r=>r.samples)],margin=track.width/2+4;
 const bounds={minX:Math.min(...points.map(p=>p.x))-margin,maxX:Math.max(...points.map(p=>p.x))+margin,minZ:Math.min(...points.map(p=>p.z!))-margin,maxZ:Math.max(...points.map(p=>p.z!))+margin};
 return {version:'impulse-turn-runoff-v2',config:{...c},initialGas:initialGas(c),track,bounds,duration:Math.max(.01,...runs.map(r=>r.samples.at(-1)!.t)),runs};
}
export function turnCsv(result:ReturnType<typeof simulateTurnComparison>){
 const config='"'+JSON.stringify(result.config).replaceAll('"','""')+'"';
 return ['scenario,mode,time_s,x_m,z_m,body_yaw_rad,course_rad,front_steering_rad,speed_m_s,distance_m,lateral_acceleration_m_s2,lane_error_m,normal_N,lateral_demand_N,lateral_capacity_N,demand_capacity_ratio,demand_capacity_ratio_valid,drive_force_N,fan_power_W,drive_power_W,electrical_J,heat_rate_W,heat_input_J,gas_kg,temperature_K,tank_u_J_kg,pressure_Pa,phase,run_status,outcome,lane_exit_time_s,lane_exit_side,exit_gate_time_s,model_version,config_json',
 ...result.runs.flatMap((run,i)=>run.samples.map(s=>[i?'Fan assisted':'No fan',i,s.t,s.x,s.z,s.yaw,s.course,s.steer,s.v,s.distance,s.lateralAccel,s.laneError,s.normal,s.demand,s.capacity,s.utilizationValid?s.utilization:'',s.utilizationValid,run.turn!.driveForce,run.turn!.fanPower,run.turn!.drivePower,s.energy,s.heatRate??0,s.heatEnergy??0,s.gas,s.temp,s.u,s.pressure,s.limit,run.status,run.turn!.outcome,run.turn!.laneExitAt??'',run.turn!.laneExitSide??'',run.turn!.exitAt??'',result.version,config].join(',')))].join('\n');
}

/** Comparison configurations always share hardware and the same starting inventory. */
export function comparisonKey(c: Config, gas = initialGas(c)) {
  return JSON.stringify([Object.keys(c).sort().map(k=>[k,c[k as keyof Config]]),gas.mass,gas.temp,gas.u]);
}
export function simulateComparison(c: Config, gas = initialGas(c)) {
  const start=withInternalEnergy(c,gas);
  return {version:'impulse-consistent-pr-thermal-v3',config:{...c},initialGas:{...start},duration:6,
    runs:[0,1,2].map(mode=>simulateLaunch(c,mode,{...start}))};
}
export function comparisonSample(run: Run, t: number) {
  const end=run.samples.at(-1)!;
  const unsupported=run.status==='CONTACT LIMIT'||run.status==='OUT OF TABLE';
  return {sample:sampleAt(run,Math.min(t,end.t)),ended:t>end.t+1e-8,unsupported,
    status:unsupported&&t>=end.t-1e-8?run.status:'ACTIVE',endTime:end.t};
}
export function comparisonCsv(result: ReturnType<typeof simulateComparison>) {
  const header='scenario,mode,run_status,time_s,distance_m,speed_m_s,acceleration_m_s2,pressure_Pa,temperature_K,tank_u_J_kg,outflow_h_J_kg,gas_kg,thrust_N,tire_N,downforce_N,massflow_kg_s,electrical_J,heat_rate_W,heat_input_J,nozzle_exit_pressure_Pa,nozzle_exit_temperature_K,exit_velocity_m_s,nozzle_mach,choked,nozzle_active,valve_opening,valve_command,feed_pressure_Pa,nozzle_separated,initial_gas_kg,initial_temperature_K,initial_u_J_kg,model_version,config_json';
  const config='"'+JSON.stringify(result.config).replaceAll('"','""')+'"';
  const names=['Electric only','Fan assisted','Thrust assisted'];
  const rows=result.runs.flatMap((run,mode)=>run.samples.map(s=>[names[mode],mode,run.status,s.t,s.x,s.v,s.a,s.pressure,s.temp,s.u,s.he,s.gas,s.thrust,s.tire,s.downforce,s.flow,s.energy,s.heatRate??0,s.heatEnergy??0,s.nozzlePressure??ATM,s.nozzleTemp??s.temp,s.exitVelocity??0,s.nozzleMach??0,s.choked??0,s.flow>1e-8?1:0,s.valve??0,s.valveCommand??0,s.inletPressure??s.pressure,s.separated??0,result.initialGas.mass,result.initialGas.temp,result.initialGas.u,result.version,config].join(',')));
  return [header,...rows].join('\n');
}
