// Predict-then-reveal: questions are graded only from solver results.
// No outcome text is invented here; unresolved model states stay ungraded.
import {hopLandingPrediction} from './hop.js';
import {invertPrediction} from './invert.js';

export const SPEED_UNITS={
 si:{label:'km/h',scale:3.6,milestone:'0–100 km/h',milestoneKey:'hundred',milestoneSpeed:100/3.6,other:'0–60 mph',otherKey:'sixty'},
 us:{label:'mph',scale:2.2369362920544,milestone:'0–60 mph',milestoneKey:'sixty',milestoneSpeed:26.8224,other:'0–100 km/h',otherKey:'hundred'}
};
export const speedUnit=units=>SPEED_UNITS[units]||SPEED_UNITS.si;

export const PREDICTIONS={
 launch:{
  prompt:'How quickly does the thrust-assisted car reach 100 km/h?',
  options:[['under-1','Under 1 s'],['1-2','1 – 2 s'],['over-2','Over 2 s']],
  answer(result){
   const run=result?.runs?.[2],time=run?.hundred;
   if(!Number.isFinite(time))return {key:null,label:run?`Not reached · ${run.status}`:'Unavailable'};
   return {key:time<1?'under-1':time<=2?'1-2':'over-2',label:`${time.toFixed(2)} s to 100 km/h`};
  }
 },
 invert:{
  prompt:'Will the car stay attached through the rotation?',
  options:[['held','It holds on'],['falls','It comes off']],
  answer(result){
   const run=result?.runs?.[2];if(!run?.invert)return {key:null,label:'Unavailable'};
   const p=invertPrediction(run);
   // A deck-recontact limit is only reached after the body has left its support.
   if(run.status==='DECK CONTACT LIMIT')return {key:'falls',label:p.title};
   if(p.outcome==='HELD')return {key:'held',label:p.title};
   if(run.invert.detachAt!==null)return {key:'falls',label:p.title};
   return {key:null,label:p.title};
  }
 },
 hop:{
  prompt:'Will the car survive the landing?',
  options:[['intact','Lands intact'],['wrecked','Wrecked on landing']],
  answer(result){
   const run=result?.runs?.[2];if(!run)return {key:null,label:'Unavailable'};
   const p=hopLandingPrediction(run);
   return {key:p.outcome==='INTACT'?'intact':p.outcome==='WRECKED'?'wrecked':null,label:p.title};
  }
 },
 turn:{
  prompt:'Which cars make the corner?',
  options:[['both','Both'],['fan','Only with fan'],['nofan','Only without fan'],['none','Neither']],
  answer(result){
   const runs=result?.runs;if(!runs||runs.length<2)return {key:null,label:'Unavailable'};
   const clear=runs.map(r=>r.status==='CORNER CLEAR');
   const key=clear[0]&&clear[1]?'both':clear[1]?'fan':clear[0]?'nofan':'none';
   const label=key==='both'?'Both cars clear the corner':key==='fan'?'Only the fan-assisted car clears':key==='nofan'?'Only the car without fan clears':'Both cars leave the lane';
   return {key,label};
  }
 }
};

export function gradePrediction(kind,result,choice){
 const question=PREDICTIONS[kind];if(!question)return null;
 const answer=question.answer(result);
 const picked=question.options.find(([key])=>key===choice);
 return {answer,choice:picked?picked[0]:null,choiceLabel:picked?picked[1]:null,
  correct:picked&&answer.key!==null?picked[0]===answer.key:null};
}

// The same setup and starting inventory must reproduce the same outcome.
export function revealKey(kind,config,startGas=null){
 const gas=startGas?[startGas.mass,startGas.temp,startGas.u].map(v=>Number.isFinite(v)?+v.toPrecision(10):null):null;
 return JSON.stringify([kind,Object.keys(config).sort().map(key=>[key,config[key]]),gas]);
}
