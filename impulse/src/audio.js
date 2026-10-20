const WRECK_DURATION=1.55;
// Deterministic layers: panel slam, low chassis thump, tearing metal, glass and debris.
// Generated once on audio opt-in so an impact never blocks the playback frame.
export function synthesizeWreck(sampleRate){
 const data=new Float32Array(Math.ceil(sampleRate*WRECK_DURATION));let seed=0x52d735b1,low=0,mid=0,phase=0;
 const dents=[[.012,.7,.045],[.045,.52,.045],[.095,.4,.055],[.16,.26,.07],[.24,.18,.07],[.34,.1,.065]];
 const debris=[[.13,.15],[.21,.13],[.3,.12],[.42,.09],[.57,.065],[.73,.045],[.89,.027],[1.07,.013]];
 for(let i=0;i<data.length;i++){
  const t=i/sampleRate;seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const white=(seed>>>0)/2147483648-1;
  low+=.018*(white-low);mid+=.22*(white-mid);const high=white-mid;
  phase+=2*Math.PI*(42+85*Math.exp(-t*30))/sampleRate;
  const attack=1-Math.exp(-t*1100);
  let value=attack*(.9*Math.sin(phase)*Math.exp(-t*13)+.8*(mid+.18*high)*Math.exp(-t*55));
  for(const [at,amp,decay] of dents){const d=t-at;if(d>0&&d<.35)value+=amp*(1-Math.exp(-d*950))*Math.exp(-d/decay)*(mid*1.8+high*.28);}
  if(t<.6)value+=attack*Math.exp(-t*9)*(.08*Math.sin(2*Math.PI*137*t)+.045*Math.sin(2*Math.PI*223*t)+.025*Math.sin(2*Math.PI*347*t));
  // Small high-frequency fragments arrive after the body impact rather than as a tone.
  for(const [at,amp] of debris){const d=t-at;if(d>0&&d<.12)value+=amp*high*(1-Math.exp(-d*2000))*Math.exp(-d*95);}
  value+=low*.5*attack*Math.exp(-t*11);data[i]=Math.tanh(value*1.6);
 }
 const dry=data.slice();let peak=0;
 for(let i=0;i<data.length;i++){
  let value=dry[i];for(const [delay,amount] of [[.019,.13],[.041,.08],[.079,.035]]){const j=i-Math.round(delay*sampleRate);if(j>=0)value+=dry[j]*amount;}
  data[i]=value;peak=Math.max(peak,Math.abs(value));
 }
 for(let i=0;i<data.length;i++)data[i]*=.9/Math.max(peak,.001)*Math.min(1,(data.length-1-i)/(sampleRate*.025));
 return data;
}

// Stylized sonification of simulated speed and thrust, not a Tesla recording.
export class SimulationAudio {
  enabled = false;
  volume = .35;
  impactCount = 0;
  impacts = new Set();
  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, .025);
  }
  async toggle() {
    if (this.enabled) { this.enabled = false; this.silence(); return false; }
    if (!this.ctx) this.init();
    await this.ctx.resume();
    this.enabled = this.ctx.state === 'running';
    return this.enabled;
  }
  init() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Audio is unavailable in this browser.');
    const ctx = this.ctx = new Context();
    const master = this.master = ctx.createGain(); master.gain.value = this.volume;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 10; limiter.ratio.value = 8;
    limiter.attack.value = .003; limiter.release.value = .15;
    master.connect(limiter); limiter.connect(ctx.destination);
    this.motor = ctx.createGain(); this.motor.gain.value = 0; this.motor.connect(master);
    this.tones = [1, 2.01, 3].map((ratio, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine'; gain.gain.value = [1, .3, .12][i];
      osc.connect(gain); gain.connect(this.motor); osc.start();
      return { osc, ratio };
    });
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const wreck=synthesizeWreck(ctx.sampleRate);
    this.wreckBuffer=ctx.createBuffer(1,wreck.length,ctx.sampleRate);this.wreckBuffer.getChannelData(0).set(wreck);
    const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'bandpass'; this.filter.Q.value = .65;
    this.jet = ctx.createGain(); this.jet.gain.value = 0;
    noise.connect(this.filter); this.filter.connect(this.jet); this.jet.connect(master); noise.start();
  }
  silence() {
    if (!this.ctx) return;
    this.silenceMotion();
    for (const voice of this.impacts) {
      voice.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, .01);
      for (const source of voice.sources) { try { source.stop(this.ctx.currentTime + .04); } catch {} }
    }
    this.impacts.clear();
  }
  silenceMotion() {
    this.motor.gain.setTargetAtTime(0, this.ctx.currentTime, .025);
    this.jet.gain.setTargetAtTime(0, this.ctx.currentTime, .025);
  }
  // A buffered collision transient, never an explosion or a structural prediction.
  impact(speed) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running' || document.hidden || !Number.isFinite(speed) || speed <= 0) return false;
    const ctx=this.ctx,now=ctx.currentTime,gain=ctx.createGain(),source=ctx.createBufferSource();
    gain.gain.value=.5+.35*Math.min(1,speed/18);gain.connect(this.master);source.buffer=this.wreckBuffer;source.connect(gain);
    const voice={gain,sources:[source]};this.impacts.add(voice);
    source.onended=()=>{source.disconnect();gain.disconnect();this.impacts.delete(voice);};
    source.start(now);source.stop(now+WRECK_DURATION+.02);this.impactCount++;return true;
  }
  update(sample, experiment, playing) {
    if (!this.ctx) return;
    if (!this.enabled || document.hidden) { this.silence(); return; }
    if (!playing) { this.silenceMotion(); return; }
    const now = this.ctx.currentTime;
    const speed = Math.max(0, sample.v), load = Math.min(1, sample.tire / 42000);
    for (const {osc, ratio} of this.tones) osc.frequency.setTargetAtTime((85 + speed * 9) * ratio, now, .06);
    this.motor.gain.setTargetAtTime(experiment === 'launch' ? .12 * load * Math.min(1, speed / 3) : 0, now, .04);
    const thrust = Math.min(1, Math.max(0, sample.thrust) / 80000);
    const flow = Math.min(1, Math.max(0, sample.flow) / 100);
    this.filter.frequency.setTargetAtTime(550 + 1800 * thrust + 600 * flow, now, .04);
    this.jet.gain.setTargetAtTime(.6 * Math.sqrt(flow * thrust), now, .025);
  }
}
