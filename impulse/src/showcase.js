// Presentation time maps to existing solver time; no physics runs in this module.
export const SHOWCASE_STEPS = [
 {kind:'launch',seconds:9,title:'Three systems. One start line.',caption:'Electric drive, fan suction and cold-gas thrust compete with the same vehicle and starting fill.',patch:{},shots:[[0,'field'],[4.5,'focus']]},
 {kind:'hop',seconds:8,title:'Spend the air. Save the landing.',caption:'A short pulse lifts the car. Automatic braking uses the remaining air to slow the return.',patch:{pulse:.25,landingBurn:1,valveRise:.06,feedLoss:8,expansionRatio:1.15},shots:[[0,'hop-track']]},
 {kind:'invert',seconds:10,title:'Turn gravity on its head.',caption:'The platform rotates from upright to inverted. Fan suction adds the contact load needed to stay attached.',patch:{},shots:[[0,'invert-field'],[5,'invert-track']]},
 {kind:'turn',seconds:9,title:'Same steering. A different outcome.',caption:'A 120-degree corner. Same speed and steering. The car without fan assistance runs wide and continues onto the grass.',patch:{turnSweep:120*Math.PI/180},shots:[[0,'turn-field']]}
];
export const SHOWCASE_DURATION = SHOWCASE_STEPS.reduce((sum,s)=>sum+s.seconds,0);
export function showcaseFrame(time){
 const clock=Math.max(0,Math.min(SHOWCASE_DURATION,time));let start=0,index=0;
 for(;index<SHOWCASE_STEPS.length-1;index++){if(clock<start+SHOWCASE_STEPS[index].seconds)break;start+=SHOWCASE_STEPS[index].seconds;}
 const step=SHOWCASE_STEPS[index],local=clock-start;
 return {index,step,clock,local,done:clock>=SHOWCASE_DURATION,
  fraction:Math.max(0,Math.min(1,(local-1)/(step.seconds-2))),
  camera:step.shots.filter(([at])=>local>=at).at(-1)[1]};
}
export function showcaseStart(index){return SHOWCASE_STEPS.slice(0,index).reduce((sum,s)=>sum+s.seconds,0);}
