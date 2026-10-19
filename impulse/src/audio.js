// Stylized sonification of simulated speed and thrust, not a Tesla recording.
export class SimulationAudio {
  enabled = false;
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
    const master = ctx.createGain(); master.gain.value = .35; master.connect(ctx.destination);
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
    const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'bandpass'; this.filter.Q.value = .65;
    this.jet = ctx.createGain(); this.jet.gain.value = 0;
    noise.connect(this.filter); this.filter.connect(this.jet); this.jet.connect(master); noise.start();
  }
  silence() {
    if (!this.ctx) return;
    this.motor.gain.setTargetAtTime(0, this.ctx.currentTime, .025);
    this.jet.gain.setTargetAtTime(0, this.ctx.currentTime, .025);
  }
  update(sample, experiment, playing) {
    if (!this.ctx) return;
    if (!this.enabled || !playing || document.hidden) { this.silence(); return; }
    const now = this.ctx.currentTime;
    const speed = Math.max(0, sample.v), load = Math.min(1, sample.tire / 42000);
    for (const {osc, ratio} of this.tones) osc.frequency.setTargetAtTime((85 + speed * 9) * ratio, now, .06);
    this.motor.gain.setTargetAtTime(experiment === 'launch' ? .12 * load * Math.min(1, speed / 3) : 0, now, .04);
    const thrust = Math.min(1, Math.max(0, sample.thrust) / 80000);
    this.filter.frequency.setTargetAtTime(550 + 2400 * thrust, now, .04);
    this.jet.gain.setTargetAtTime(.6 * Math.sqrt(thrust), now, .025);
  }
}
