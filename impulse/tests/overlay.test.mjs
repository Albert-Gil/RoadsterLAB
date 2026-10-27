import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,G,simulateComparison,simulateHop,simulateInvert,simulateTurnComparison,sampleAt} from '../src/physics.ts';
import {launchBudget,turnCircle,invertBudget,hopBudget,overlayScale,overlayHTML} from '../src/overlay.js';
import {castsShadow,lightMatrix,SUN} from '../src/scene.js';

const finiteHTML=html=>{assert.ok(html.length>0);assert.ok(!/NaN|undefined|Infinity/.test(html),html.slice(0,200));};

test('Launch diagnostics are the solver limits: tire force is the lower of grip and motor',()=>{
  const result=simulateComparison(DEFAULTS);
  for(const run of result.runs)for(const s of run.samples.filter(s=>s.limit!=='OUT OF TABLE')){
    assert.ok(Math.abs(s.tire-Math.min(s.traction,s.motor))<1e-6*Math.max(1,s.tire),`${s.t} ${s.limit}`);
    if(s.limit==='TRACTION LIMITED')assert.ok(s.traction<s.motor);
    assert.ok(s.resist>=0);
  }
  const s=sampleAt(result.runs[2],1.1),b=launchBudget(s,DEFAULTS);
  assert.equal(b.binding,s.traction<s.motor?'grip':'motor');
  // Net force over mass reproduces the solver acceleration.
  assert.ok(Math.abs(b.accelG*G-s.a)<1e-6*Math.max(1,Math.abs(s.a)));
  const scale=overlayScale('launch',result.runs,DEFAULTS);
  assert.ok(scale>=b.traction&&scale>=b.motor&&scale>=b.thrust);
  finiteHTML(overlayHTML(b,{scale,title:'Thrust assisted'}));
  assert.equal(launchBudget({...s,traction:undefined},DEFAULTS),null,'samples without diagnostics show no panel');
});

test('Turn friction circle reserves drive force before lateral capacity',()=>{
  const result=simulateTurnComparison(DEFAULTS),scale=overlayScale('turn',result.runs,DEFAULTS);
  const [noFan,fan]=result.runs.map(r=>turnCircle(r.samples[1]));
  for(const d of [noFan,fan]){
    assert.ok(Math.abs(d.total**2-d.capacity**2-d.drive**2)<1e-6*d.total**2);
    assert.equal(d.lateral,Math.min(d.demand,d.capacity));
    assert.equal(d.over,d.demand>d.capacity+1e-6);
    assert.ok(scale>=d.total&&scale>=d.demand);
  }
  assert.ok(fan.total>noFan.total,'the fan raises normal load and the circle grows');
  finiteHTML(overlayHTML(fan,{scale,title:'Fan',second:noFan,secondTitle:'No fan',secondColor:'#fff'}));
});

test('Invert and Hop budgets come straight from samples',()=>{
  const inv=simulateInvert(DEFAULTS),s=sampleAt(inv,1.2),b=invertBudget(s,DEFAULTS);
  assert.equal(b.contact,!!s.contact);assert.equal(b.needed,s.contact?s.demand:0);assert.equal(b.available,s.contact?s.capacity:0);
  if(b.available>0)assert.ok(Math.abs(b.utilization-b.needed/b.available)<1e-12);
  finiteHTML(overlayHTML(b,{scale:overlayScale('invert',[inv],DEFAULTS)}));
  const hop=simulateHop(DEFAULTS),h=hopBudget(sampleAt(hop,.1),DEFAULTS);
  assert.ok(Math.abs(h.ratio-h.thrust/((DEFAULTS.mass+sampleAt(hop,.1).gas)*G))<1e-12);
  finiteHTML(overlayHTML(h,{scale:overlayScale('hop',[hop],DEFAULTS)}));
});

test('shadow casters skip floors, glass, plumes and paint-thin decals; light matrix is texel-snapped',()=>{
  const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],at=(y,sy)=>[1,0,0,0,0,sy,0,0,0,0,1,0,0,y,0,1];
  assert.equal(castsShadow('box',at(-.08,.1),{floor:1}),false);
  assert.equal(castsShadow('box',at(.02,.012),{}),false,'road paint does not cast');
  assert.equal(castsShadow('box',at(1,2),{}),true);
  assert.equal(castsShadow('car:paint',I,{}),true);
  assert.equal(castsShadow('plume',I,{plume:1}),false);assert.equal(castsShadow('box',at(1,2),{glass:true}),false);
  const {matrix:M,range}=lightMatrix({center:[3,0,-2],extent:12,height:4},2048);
  assert.ok(range>0);
  const half=1024;assert.ok(Math.abs(M[12]*half-Math.round(M[12]*half))<1e-6&&Math.abs(M[13]*half-Math.round(M[13]*half))<1e-6);
  const project=p=>[0,1,2].map(r=>M[r]*p[0]+M[4+r]*p[1]+M[8+r]*p[2]+M[12+r]);
  const c=project([3,0,-2]);assert.ok(c.every(v=>Math.abs(v)<1),'focus centre is inside the shadow map');
  const towardSun=project([3+SUN[0]*5,SUN[1]*5,-2+SUN[2]*5]);assert.ok(towardSun[2]<c[2],'points toward the sun are nearer the light');
});
