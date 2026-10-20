// One running calculation and one replaceable queued request; stale results never install.
export class SimulationClient {
  constructor(factory=()=>{
    if(globalThis.IMPULSE_WORKER_SOURCE){
      const url=URL.createObjectURL(new Blob([globalThis.IMPULSE_WORKER_SOURCE],{type:'text/javascript'}));
      const worker=new Worker(url); URL.revokeObjectURL(url); return worker;
    }
    return new Worker(new URL('./simulation-worker.js',import.meta.url),{type:'module'});
  }) {
    this.factory=factory;this.sequence=0;this.cache=new Map();this.latest=null;this.queued=null;this.running=null;
  }
  cancel(){
    if(this.latest)this.latest.reject(new DOMException('Superseded calculation','AbortError'));
    this.latest=null;this.queued=null;
  }
  compute(config,gas,kind='launch'){
    this.cancel();
    const key=JSON.stringify([kind,Object.keys(config).sort().map(k=>[k,config[k]]),gas]);
    return new Promise((resolve,reject)=>{
      const request={id:++this.sequence,kind,config:{...config},gas:{...gas},key,resolve,reject};
      this.latest=request;
      if(this.cache.has(key)){resolve(this.cache.get(key));this.latest=null;return;}
      this.queued=request;this.pump();
    });
  }
  pump(){
    if(this.running||!this.queued)return;
    if(!this.worker){
      try {
        this.worker=this.factory();
        this.worker.onmessage=({data})=>this.receive(data);
        this.worker.onerror=()=>{
          const error=new Error('Background simulation failed. Reload to retry.');
          this.latest?.reject(error);this.latest=null;this.queued=null;this.running=null;
          this.worker?.terminate();this.worker=null;
        };
      }catch(error){this.latest?.reject(error);this.latest=null;this.queued=null;return;}
    }
    this.running=this.queued;this.queued=null;
    this.worker.postMessage({id:this.running.id,config:this.running.config,gas:this.running.gas,kind:this.running.kind});
  }
  receive(data){
    const request=this.running;
    if(!request||data.id!==request.id)return;
    if(data.result){
      if(this.cache.size>=12)this.cache.delete(this.cache.keys().next().value);
      this.cache.set(request.key,data.result);
    }
    if(this.latest?.id===request.id){
      data.error?request.reject(new Error(data.error)):request.resolve(data.result);
      this.latest=null;
    }
    this.running=null;this.pump();
  }
}
