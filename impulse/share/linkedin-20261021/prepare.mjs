// Prepare publication examples through the existing solver; no physics tuning/fitting.
import {DEFAULTS,simulateComparison,simulateHop,simulateInvert,simulateTurnComparison} from '../../src/physics.ts';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../../dist/',import.meta.url));
const hop={...DEFAULTS,pulse:.4,landingBurn:1,landingTarget:1,landingLead:.04,valveRise:.12,feedLoss:4};
const configs={launch:{...DEFAULTS},hop,invert:{...DEFAULTS},turn:{...DEFAULTS,turnSweep:120*Math.PI/180}};
const single=(config,run)=>({config,duration:run.samples.at(-1).t,runs:[run,run,run]});
const results={launch:simulateComparison(configs.launch),hop:single(hop,simulateHop(hop)),invert:single(configs.invert,simulateInvert(configs.invert)),turn:simulateTurnComparison(configs.turn)};
// Keep every valve discontinuity and exact endpoints; reduce publication JSON size.
for(const result of Object.values(results))for(const run of new Set(result.runs))run.samples=run.samples.filter((s,i,a)=>i%4===0||i===a.length-1||i>0&&(s.t===a[i-1].t||s.valve!==a[i-1].valve)||i<a.length-1&&s.t===a[i+1].t);
await mkdir(output,{recursive:true});await writeFile(output+'publication-data.json',JSON.stringify({configs,results}));
for(const name of ['studio.html','studio.js'])await copyFile(new URL(name,import.meta.url),output+'publication-'+name);
const run=results.hop.runs[2];await writeFile(new URL('HOP-SETUP.json',import.meta.url),JSON.stringify({config:hop,apex_m:run.peakHeight,touchdown_speed_m_s:run.landingSpeed,flight_seconds:results.hop.duration,landing_plan:run.landing.plan},null,2)+'\n');
await writeFile(new URL('TURN-SETUP.json',import.meta.url),JSON.stringify({config:configs.turn,sweep_degrees:120,duration:results.turn.duration,outcomes:results.turn.runs.map(r=>({status:r.status,laneExitAt:r.turn.laneExitAt,exitAt:r.turn.exitAt}))},null,2)+'\n');
console.log(`Publication assets prepared. Hop ${run.peakHeight.toFixed(2)} m / ${run.landingSpeed.toFixed(2)} m/s touchdown.`);
