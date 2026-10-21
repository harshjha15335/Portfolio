/** Original quiet synthesized soundscape. Created only after the visitor enables sound. */
export class StreetAudio {
  private context:AudioContext;
  private master:GainNode;
  private engine:OscillatorNode;
  private engineGain:GainNode;
  private nextStep=0;
  constructor() {
    this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=.06;this.master.connect(this.context.destination);
    const noise=this.context.createBuffer(1,this.context.sampleRate*3,this.context.sampleRate);const data=noise.getChannelData(0);
    let seed=1976;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=seed/2147483647*2-1;}
    const source=this.context.createBufferSource();source.buffer=noise;source.loop=true;
    const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=330;const bed=this.context.createGain();bed.gain.value=.18;source.connect(filter);filter.connect(bed);bed.connect(this.master);source.start();
    this.engine=this.context.createOscillator();this.engine.type='triangle';this.engine.frequency.value=58;this.engineGain=this.context.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();
  }
  setActive(active:boolean){if(active)void this.context.resume().catch(()=>{});else void this.context.suspend().catch(()=>{});}
  update(speed:number,riding:boolean,auto:boolean) {
    const now=this.context.currentTime;this.engine.frequency.setTargetAtTime((auto?76:48)+speed*1.5,now,.2);this.engineGain.gain.setTargetAtTime(riding?.12:0,now,.2);
    if(!riding&&speed>.3&&now>this.nextStep){this.nextStep=now+Math.max(.28,.6-speed*.07);const step=this.context.createOscillator(),gain=this.context.createGain();step.frequency.setValueAtTime(115,now);step.frequency.exponentialRampToValueAtTime(38,now+.09);gain.gain.setValueAtTime(.3,now);gain.gain.exponentialRampToValueAtTime(.001,now+.12);step.connect(gain);gain.connect(this.master);step.start();step.stop(now+.13);step.onended=()=>{step.disconnect();gain.disconnect();};}
  }
  dispose(){void this.context.close().catch(()=>{});}
}
