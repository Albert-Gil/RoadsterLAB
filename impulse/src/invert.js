// Invert presentation is reconstructed from SI solver samples, never a display trajectory.
export const INVERT_METRICS=[
 {key:'platformAngle',title:'Platform angle',unit:'°',scale:180/Math.PI},
 {key:'along',title:'Deck displacement',unit:'m',scale:1},
 {key:'clearance',title:'Ground clearance',unit:'m',scale:1},
 {key:'v',title:'Speed',unit:'m/s',scale:1},
 {key:'normal',title:'Contact load',unit:'kN',scale:.001},
 {key:'downforce',title:'Fan suction',unit:'kN',scale:.001},
 {key:'capacity',title:'Friction capacity',unit:'kN',scale:.001}
];
export function invertPose(sample,rig){
 const a=sample.angle??0;
 return {position:[sample.x+rig.bodyHalfHeight*Math.sin(a),sample.y-rig.bodyHalfHeight*Math.cos(a),0],angle:a};
}
export function invertDamage(run,time,age=1.2){
 const info=run?.invert,wrecked=info?.outcome==='WRECKED'&&info.impactAt!==null&&time>=info.impactAt-1e-8;
 return {wrecked:!!wrecked,progress:wrecked?Math.max(0,Math.min(1,age/1.2)):0};
}
export function invertPrediction(run){
 const i=run.invert;
 if(run.status==='DECK CONTACT LIMIT')return {outcome:'UNRESOLVED',tone:'limited',title:'Deck recontact / model limit',detail:`Body reaches the moving deck again at T+${i.deckContactAt.toFixed(3)} s. Playback stops before penetration; no ground-impact or damage prediction.`};
 if(i.impactAt!==null)return {outcome:i.outcome,tone:i.outcome==='WRECKED'?'wrecked':'intact',title:i.outcome==='WRECKED'?'Wrecked on impact':'Intact by speed rule',detail:`${i.impactSpeed.toFixed(2)} m/s impact at T+${i.impactAt.toFixed(2)} s / ${i.threshold.toFixed(1)} m/s illustrative wreck threshold`};
 if(run.status==='HELD')return {outcome:'HELD',tone:'intact',title:i.sealAt===null?'Attachment maintained':'Supported / seal lost',detail:`${i.rotation?.start??0}° → ${i.rotation?.end??180}°. The car remains supported at the end of this run${i.sealAt!==null?"; the seal was lost":""}.`};
 return {outcome:'UNRESOLVED',tone:'limited',title:'Run window reached',detail:'Motion continues beyond the modeled window; no supported impact outcome.'};
}
