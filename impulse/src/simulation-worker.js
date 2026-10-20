import {simulateComparison,simulateHop,simulateInvert,simulateTurnComparison} from './physics.js';

self.onmessage=({data})=>{
  try {
    const run=data.kind==='hop'?simulateHop(data.config):data.kind==='invert'?simulateInvert(data.config):null;
    const result=data.kind==='turn'?simulateTurnComparison(data.config):run?{config:{...data.config},duration:Math.max(.01,run.samples.at(-1).t),runs:[run,run,run]}:simulateComparison(data.config,data.gas);
    self.postMessage({id:data.id,result});
  } catch(error) {
    self.postMessage({id:data.id,error:error.message});
  }
};
