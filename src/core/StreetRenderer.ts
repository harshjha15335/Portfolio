import * as THREE from 'three';
import {EffectComposer,RenderPass,EffectPass,NormalPass,SSAOEffect,FXAAEffect,ToneMappingEffect,ToneMappingMode} from 'postprocessing';
export type RenderPreset='high'|'medium'|'low';
/** Single tone mapper; no bloom, grain, vignette or walking depth of field. */
export class StreetRenderer {
 private composer:EffectComposer|null=null;private normal:NormalPass|null=null;private preset:RenderPreset='low';
 constructor(private renderer:THREE.WebGLRenderer,private scene:THREE.Scene,private camera:THREE.Camera){}
 setPreset(preset:RenderPreset){if(this.preset===preset)return;this.composer?.dispose();this.composer=null;this.normal=null;this.preset=preset;
  if(preset!=='high'){this.renderer.toneMapping=THREE.ACESFilmicToneMapping;return;}
  this.renderer.toneMapping=THREE.NoToneMapping;
  this.composer=new EffectComposer(this.renderer,{frameBufferType:THREE.HalfFloatType});this.composer.addPass(new RenderPass(this.scene,this.camera));
  const effects=[];
  if(preset==='high'){this.normal=new NormalPass(this.scene,this.camera);this.composer.addPass(this.normal);effects.push(new SSAOEffect(this.camera,this.normal.texture,{samples:9,rings:3,radius:.06,intensity:.8,bias:.03,resolutionScale:.5}));}
  effects.push(new ToneMappingEffect({mode:ToneMappingMode.ACES_FILMIC}),new FXAAEffect());this.composer.addPass(new EffectPass(this.camera,...effects));
 }
 resize(w:number,h:number){this.composer?.setSize(w,h);}
 render(delta:number){if(this.composer)this.composer.render(delta);else this.renderer.render(this.scene,this.camera);}
 dispose(){this.composer?.dispose();this.composer=null;}
}
