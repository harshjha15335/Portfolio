import type * as THREE from 'three';
type Sample={frameMs:number;renderCpuMs:number;draws:number;triangles:number;textures:number;geometries:number;programs:number;scale:number;preset:string;phase:string;worldX:number;worldZ:number;walkingSimulatedMs:number};
export function distribution(values:number[]){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),p=(q:number)=>a[Math.max(0,Math.ceil(a.length*q)-1)];return {count:a.length,min:a[0],mean:a.reduce((x,y)=>x+y,0)/a.length,p50:p(.5),p95:p(.95),p99:p(.99),max:a[a.length-1]};}
/** Explicit opt-in instrumentation. RAF wall intervals and JS render calls are not GPU times. */
export class GPUFrameProfiler {
 private active:string|null=null;private samples:Sample[]=[];private gpuMs:number[]=[];
 private gl:WebGL2RenderingContext;private extension:{TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number}|null;
 private pending:WebGLQuery[]=[];private query:WebGLQuery|null=null;private disjoint=0;private started=0;
 readonly device:Record<string,unknown>;
 constructor(private renderer:THREE.WebGLRenderer){
  this.gl=renderer.getContext() as WebGL2RenderingContext;this.extension=this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const debug=this.gl.getExtension('WEBGL_debug_renderer_info'),gpu=debug?String(this.gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):String(this.gl.getParameter(this.gl.RENDERER));
  this.device={browser:navigator.userAgent,platform:navigator.platform,gpu,vendor:debug?this.gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):this.gl.getParameter(this.gl.VENDOR),softwareDetected:/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu),timerQueryAvailable:Boolean(this.extension),webglVersion:this.gl.getParameter(this.gl.VERSION),maxTextureSize:this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),maxTextures:this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS),devicePixelRatio};
 }
 programDiagnostics(){return this.renderer.info.programs?.map(p=>({id:p.id,usedTimes:p.usedTimes,cacheKey:p.cacheKey}));}
 begin(scenario:string){if(this.active)throw new Error('Benchmark already active');this.clearQueries();this.active=scenario;this.samples=[];this.gpuMs=[];this.disjoint=0;this.started=performance.now();}
 beforeRender(){if(!this.active||!this.extension)return;this.pollQueries();if(this.pending.length>=3)return;const q=this.gl.createQuery();if(q){this.query=q;this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT,q);}}
 afterRender(sample:Sample){if(!this.active)return;if(this.query&&this.extension){this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.pending.push(this.query);this.query=null;}if(this.samples.length<6000)this.samples.push(sample);}
 finish(){if(!this.active)throw new Error('No benchmark active');this.pollQueries();const scenario=this.active;this.active=null;const samples=this.samples;const report={schema:1,programVariants:this.programDiagnostics(),scenario,startedAt:new Date(Date.now()-(performance.now()-this.started)).toISOString(),durationMs:performance.now()-this.started,device:this.device,viewport:{width:innerWidth,height:innerHeight},framebuffer:{width:this.renderer.domElement.width,height:this.renderer.domElement.height},frameTimeMs:distribution(samples.map(s=>s.frameMs)),renderCpuMs:distribution(samples.map(s=>s.renderCpuMs)),gpuTimeMs:distribution(this.gpuMs),gpuDisjointEvents:this.disjoint,unresolvedGpuQueries:this.pending.length,drawCalls:distribution(samples.map(s=>s.draws)),submittedTriangles:distribution(samples.map(s=>s.triangles)),peakTextures:Math.max(0,...samples.map(s=>s.textures)),peakPrograms:Math.max(0,...samples.map(s=>s.programs)),presets:[...new Set(samples.map(s=>s.preset))],scales:[...new Set(samples.map(s=>s.scale))],phases:[...new Set(samples.map(s=>s.phase))],samples};this.clearQueries();return report;}
 private pollQueries(){if(!this.extension)return;if(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT)){this.disjoint++;this.clearQueries();this.gpuMs=[];return;}this.pending=this.pending.filter(q=>{if(!this.gl.getQueryParameter(q,this.gl.QUERY_RESULT_AVAILABLE))return true;this.gpuMs.push(Number(this.gl.getQueryParameter(q,this.gl.QUERY_RESULT))/1e6);this.gl.deleteQuery(q);return false;});}
 private clearQueries(){if(this.query&&this.extension){this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.gl.deleteQuery(this.query);this.query=null;}this.pending.forEach(q=>this.gl.deleteQuery(q));this.pending=[];}
 dispose(){this.active=null;this.clearQueries();}
}
