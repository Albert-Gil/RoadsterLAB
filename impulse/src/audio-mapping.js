export const AUDIO_MIX = Object.freeze({
 music:.35, motor:.38, aero:.16, thrust:.55, suction:.44, turnSuction:.14, leak:.15,
 surface:.20, scrub:.26, skid:.34, smoothing:.065,
 scrubAt:.65, scrubFull:.98, skidOn:.15, skidOff:.07,
});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:0));
const smooth=(x,a,b)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u);};

// Quantities in SI. Gains, thresholds, speed bands and pitch are perceptual mappings.
// No RPM, acoustic pressure or unmodeled slip variables are invented here.
export function audioTargets(s,experiment,{config={},mode=2,info={},fan={q:0,dp:0,power:0,downforce:0}}={}){
 const speed=Math.abs(s.v||0),contact=experiment==='invert'?s.contact===1:experiment!=='hop';
 const drive=experiment==='launch'||experiment==='turn';
 const motor=drive&&contact&&s.tire>0?AUDIO_MIX.motor*(.3+.7*smooth(speed,0,12)):0;
 const bands=speed<25?[Math.cos(clamp(speed/25)*Math.PI/2),Math.sin(clamp(speed/25)*Math.PI/2),0]:[0,Math.cos(clamp((speed-25)/35)*Math.PI/2),Math.sin(clamp((speed-25)/35)*Math.PI/2)];
 const layers={motor_low:motor*bands[0],motor_mid:motor*bands[1],motor_high:motor*bands[2],
  aero_noise:AUDIO_MIX.aero*clamp((speed/65)**1.6),thrust_loop:0,suction_loop:0,
  seal_leak_loop:0,surface_slide_loop:0,tire_scrub_loop:0,tire_skid_loop:0};
 const thrust=(experiment==='launch'||experiment==='hop')&&s.thrust>1&&s.flow>0;
 if(thrust)layers.thrust_loop=AUDIO_MIX.thrust*Math.sqrt(clamp(s.thrust/90000));
 // Invert sample downforce is suction alone. Launch/Turn include separate aero loads.
 const fanOn=experiment==='invert'?contact&&s.downforce>0:
  experiment==='turn'?mode===1&&info.fanForce>0:experiment==='launch'&&mode>0&&fan.power>0;
 // Invert may clamp fan input to the electrical budget. Its sampled suction
 // supplies the actual pressure; scale the same orifice airflow, not the command.
 const actualSuction=experiment==='turn'?(info.fanForce||0):s.downforce;
 const fanScale=(experiment==='invert'||experiment==='turn')&&fan.downforce>0?Math.sqrt(clamp(actualSuction/fan.downforce)):1;
 const airflow=fan.q*fanScale,fanPower=experiment==='invert'?(s.downforce/4)*airflow/.7:experiment==='turn'?(info.fanPower||0):fan.power;
 if(fanOn){
  layers.suction_loop=(experiment==='turn'?AUDIO_MIX.turnSuction:experiment==='invert'?AUDIO_MIX.suction:.22)*Math.sqrt(clamp(fanPower/150000));
  // fanModel.q is leakage volume flow, not fan power; ambient rho = 1.225 kg/m³.
  layers.seal_leak_loop=AUDIO_MIX.leak*Math.sqrt(clamp(1.225*airflow/12));
 }
 let utilization=0,sliding=0;
 if(experiment==='launch')utilization=s.limit==='TRACTION LIMITED'?1:0;
 if(experiment==='turn'&&s.normal>0&&config.grip>0){
  const actualLateral=Math.min(s.demand||0,s.capacity||0);
  utilization=Math.hypot(info.driveForce||0,actualLateral)/(config.grip*s.normal);
 }
 if(experiment==='invert'&&contact){
  utilization=s.capacity>0?(s.tire||0)/s.capacity:0;
  sliding=Math.abs(s.alongV||0); // actual modeled tire/deck relative sliding
  if(fanOn)layers.surface_slide_loop=AUDIO_MIX.surface*smooth(sliding,.03,2)*Math.sqrt(clamp((s.normal||0)/30000));
 }
 if(contact&&speed>.15)layers.tire_scrub_loop=AUDIO_MIX.scrub*smooth(utilization,AUDIO_MIX.scrubAt,AUDIO_MIX.scrubFull);
 return {layers,thrust,fan:fanOn,sliding,utilization,
  motorRate:.88+.28*clamp(speed/75),fanRate:.9+.15*clamp(config.fan/100)*fanScale};
}
