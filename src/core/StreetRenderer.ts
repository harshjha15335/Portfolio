import * as THREE from 'three';
import {ShadowPassMetrics} from './ShadowPassMetrics';
import {EffectComposer,RenderPass,EffectPass,NormalPass,SSAOEffect,FXAAEffect,ToneMappingEffect,ToneMappingMode} from 'postprocessing';
export type RenderPreset='high'|'medium'|'low';
/** Single tone mapper; no bloom, grain, vignette or walking depth of field. */
export class StreetRenderer {
 private composer:EffectComposer|null=null;private normal:NormalPass|null=null;private preset:RenderPreset='low';
 private shadowMetrics:ShadowPassMetrics|null=null;
 frameCost={shadowDraws:0,shadowTriangles:0,shadowDrawCpuMs:0,mainAndOtherDraws:0,mainAndOtherTriangles:0,casters:{} as Record<string,{draws:number;triangles:number}>};
 constructor(private renderer:THREE.WebGLRenderer,private scene:THREE.Scene,private camera:THREE.Camera,diagnostics=false){if(diagnostics)this.shadowMetrics=new ShadowPassMetrics();}
 setPreset(preset:RenderPreset){if(this.preset===preset)return;this.composer?.dispose();this.composer=null;this.normal=null;this.preset=preset;
  if(preset!=='high'){this.renderer.toneMapping=THREE.ACESFilmicToneMapping;return;}
  this.renderer.toneMapping=THREE.NoToneMapping;
  this.composer=new EffectComposer(this.renderer,{frameBufferType:THREE.HalfFloatType});this.composer.addPass(new RenderPass(this.scene,this.camera));
  const effects=[];
  if(preset==='high'){this.normal=new NormalPass(this.scene,this.camera);this.composer.addPass(this.normal);effects.push(new SSAOEffect(this.camera,this.normal.texture,{samples:9,rings:3,radius:.06,intensity:.8,bias:.03,resolutionScale:.5}));}
  effects.push(new ToneMappingEffect({mode:ToneMappingMode.ACES_FILMIC}),new FXAAEffect());this.composer.addPass(new EffectPass(this.camera,...effects));
 }
 resize(w:number,h:number){this.composer?.setSize(w,h);}
 render(delta:number){this.shadowMetrics?.prepare(this.scene);if(this.composer)this.composer.render(delta);else this.renderer.render(this.scene,this.camera);const c=this.shadowMetrics?.cost;this.frameCost={shadowDraws:c?.draws??0,shadowTriangles:c?.triangles??0,shadowDrawCpuMs:c?.drawCpuMs??0,mainAndOtherDraws:this.renderer.info.render.calls-(c?.draws??0),mainAndOtherTriangles:this.renderer.info.render.triangles-(c?.triangles??0),casters:c?.casters??{}};}
 dispose(){this.composer?.dispose();this.composer=null;}
}
