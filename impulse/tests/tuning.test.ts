import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,gaugeToAbsoluteBar,simulateComparison,simulateHop,simulateInvert,simulateTurnComparison} from '../src/physics.ts';
import {TUNING_GUIDES,parameterHint,tuningRows,tuningDifference} from '../src/tuning.js';

test('tuning reports every Launch case from solver results and isolates fan changes',()=>{
 const a=tuningRows('launch',simulateComparison(DEFAULTS)),b=tuningRows('launch',simulateComparison({...DEFAULTS,fan:0}));
 assert.equal(a.length,3);assert.ok(a.every(row=>row.unit==='s'&&row.value!>0));
 assert.equal(tuningDifference(b[0],a[0]),'Unchanged');
 assert.notEqual(b[1].value,a[1].value);assert.equal(b[0].value,b[1].value);
 assert.match(parameterHint('launch','fan'),/Electric-only stays unchanged/);
});

test('Hop and Invert tuning summaries distinguish landing, no lift, held and impact',()=>{
 const result=(run:any)=>({runs:[run,run,run]});
 const noLift=tuningRows('hop',result(simulateHop({...DEFAULTS,pressure:gaugeToAbsoluteBar(20),nozzle:2})));
 assert.equal(noLift[1].value,null);assert.match(noLift[1].text,/INSUFFICIENT LIFT/);assert.ok(!JSON.stringify(noLift).includes('INTACT'));
 const manual=simulateHop({...DEFAULTS,pulse:.35,landingBurn:2}),rows=tuningRows('hop',result(manual));
 assert.equal(rows[1].value,manual.landingSpeed);assert.equal(rows[1].detail,'INTACT');
 const held=tuningRows('invert',result(simulateInvert(DEFAULTS))),fall=tuningRows('invert',result(simulateInvert({...DEFAULTS,fan:0})));
 assert.equal(held[1].value,null);assert.match(held[1].text,/No impact/);assert.equal(fall[1].value,null);assert.equal(fall[1].detail,'DECK CONTACT LIMIT');
 const fixed=tuningRows('invert',result(simulateInvert({...DEFAULTS,invertStart:180,angle:180,fan:0})));assert.ok(fixed[1].value!>0);
});

test('Turn tuning compares departure and clear outcomes without comparing unlike event times',()=>{
 const a=tuningRows('turn',simulateTurnComparison(DEFAULTS)),b=tuningRows('turn',simulateTurnComparison({...DEFAULTS,turnSpeed:60/3.6}));
 assert.equal(a[0].detail,'LEFT LANE');assert.equal(a[1].detail,'CORNER CLEAR');
 assert.equal(b[0].detail,'CORNER CLEAR');assert.match(tuningDifference(b[0],a[0]),/LEFT LANE/);
 assert.ok(!tuningDifference(b[0],a[0]).includes('+'),'departure and exit are distinct events');
 assert.ok(!JSON.stringify(a).includes('WRECKED'));
});

test('small real changes are not mislabeled unchanged, and guides cover all experiments',()=>{
 const a={id:'apex',label:'Apex',text:'1.00 m',value:1,unit:'m',detail:''},b={...a,value:1.001};
 assert.equal(tuningDifference(b,a),'Change < 0.01 m');assert.equal(tuningDifference(a,a),'Unchanged');
 assert.equal(tuningDifference(a,undefined),'');
 for(const kind of ['launch','invert','hop','turn']){const guide=TUNING_GUIDES[kind];assert.ok(guide.start&&guide.scope&&guide.presets.length>=3);assert.equal(new Set(guide.presets.map(p=>p[0])).size,guide.presets.length);}
});
