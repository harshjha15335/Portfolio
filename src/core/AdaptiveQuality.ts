/** Hysteresis prevents render-scale oscillation; hidden/menu time is never sampled. */
export class AdaptiveQuality {
  scale: number;
  low = false;
  private samples:number[]=[];
  private elapsed=0;
  private warmup=3;
  constructor(mobile:boolean) {this.scale=mobile?.85:1;this.low=mobile;}
  sample(seconds:number):boolean {
    if(!Number.isFinite(seconds)||seconds<=0||seconds>10)return false;
    if(this.warmup>0){this.warmup-=seconds;return false;}
    this.samples.push(seconds);this.elapsed+=seconds;
    if(this.elapsed<4||this.samples.length<5)return false;
    const fps=this.samples.length/this.elapsed;this.samples=[];this.elapsed=0;
    const previous=this.scale;
    if(fps<42){this.scale=Math.max(.6,this.scale-.1);this.low=true;}
    else if(fps>57&&this.scale<1){this.scale=Math.min(1,this.scale+.05);if(this.scale>=.9)this.low=false;}
    return Math.abs(previous-this.scale)>.001;
  }
}
