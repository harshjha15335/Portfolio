import * as THREE from 'three';

/**
 * World-space ageing and sun-aware haze for every lit street material.
 *
 * One identical shader injection is applied to all MeshStandardMaterials, so the
 * renderer keeps the same number of program variants; per-material strength is a
 * uniform (people, vehicles and glass stay at zero). No textures are allocated.
 */
const STRENGTH:Record<string,number>={plaster:1,stone:.85,paving:.75,asphalt:.8,solid:.55,wood:.5,metal:.4,fabric:.25,pool:0,glass:0,foliage:0};
export const WEATHER_CACHE_KEY='street-weather-v1';

export type AtmosphereUniforms={uSunDir:{value:THREE.Vector3};uSunHaze:{value:THREE.Color};uShelterMin:{value:THREE.Vector3};uShelterMax:{value:THREE.Vector3}};
export function createAtmosphereUniforms(sunPosition:THREE.Vector3,target:THREE.Vector3,haze:string):AtmosphereUniforms{
 // Empty shelter box until a world supplies one; interiors inside it age far less than street façades.
 return {uSunDir:{value:sunPosition.clone().sub(target).normalize()},uSunHaze:{value:new THREE.Color(haze)},uShelterMin:{value:new THREE.Vector3(1,1,1)},uShelterMax:{value:new THREE.Vector3(-1,-1,-1)}};
}

const VERTEX_HEAD='uniform float uWorldUv;\nvarying vec3 vWeatherPos;\nvarying vec3 vWeatherNormal;\n';
const VERTEX_BODY=`#include <worldpos_vertex>
vec4 weatherWorld = vec4( transformed, 1.0 );
vec3 weatherNormal = objectNormal;
#ifdef USE_BATCHING
 weatherWorld = batchingMatrix * weatherWorld;
 weatherNormal = mat3( batchingMatrix ) * weatherNormal;
#endif
#ifdef USE_INSTANCING
 weatherWorld = instanceMatrix * weatherWorld;
 weatherNormal = mat3( instanceMatrix ) * weatherNormal;
#endif
weatherWorld = modelMatrix * weatherWorld;
vWeatherPos = weatherWorld.xyz;
vWeatherNormal = mat3( modelMatrix ) * weatherNormal;
// Ground maps in world metres when a material asks for it (uWorldUv = tiles per metre).
if ( uWorldUv > 0.0 ) {
 #ifdef USE_MAP
 vMapUv = weatherWorld.xz * uWorldUv;
 #endif
 #ifdef USE_NORMALMAP
 vNormalMapUv = weatherWorld.xz * uWorldUv;
 #endif
 #ifdef USE_ROUGHNESSMAP
 vRoughnessMapUv = weatherWorld.xz * uWorldUv;
 #endif
}`;

const FRAGMENT_HEAD=`uniform float uWeather;
uniform vec3 uSunDir;
uniform vec3 uSunHaze;
uniform vec3 uShelterMin;
uniform vec3 uShelterMax;
varying vec3 vWeatherPos;
varying vec3 vWeatherNormal;
float weatherHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float weatherNoise( vec2 p ) {
 vec2 i = floor( p ), f = fract( p ), u = f * f * ( 3.0 - 2.0 * f );
 return mix( mix( weatherHash( i ), weatherHash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( weatherHash( i + vec2( 0.0, 1.0 ) ), weatherHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
`;

// Vertical façades: soot/rain streaks, damp splash band at the base, patchy repaint
// and black ledge grime. Ground: oil stains and broad wear. All in metres.
const FRAGMENT_COLOR=`#include <color_fragment>
vec3 wp = vWeatherPos;
float sheltered = step( uShelterMin.x, wp.x ) * step( wp.x, uShelterMax.x ) * step( uShelterMin.y, wp.y ) * step( wp.y, uShelterMax.y ) * step( uShelterMin.z, wp.z ) * step( wp.z, uShelterMax.z );
float weatherAmount = uWeather * ( 1.0 - 0.8 * sheltered );
if ( weatherAmount > 0.001 ) {
 vec3 wn = normalize( vWeatherNormal );
 vec3 base = diffuseColor.rgb;
 float luma = dot( base, vec3( 0.299, 0.587, 0.114 ) );
 vec3 aged = mix( base, vec3( luma ) * vec3( 1.05, 1.0, 0.9 ), 0.22 );
 float vertical = 1.0 - smoothstep( 0.35, 0.8, abs( wn.y ) );
 if ( vertical > 0.01 ) {
  float along = abs( wn.x ) > abs( wn.z ) ? wp.z : wp.x;
  vec2 wall = vec2( along, wp.y );
  float patches = 0.65 * weatherNoise( wall * 0.22 + wp.xz * 0.03 ) + 0.35 * weatherNoise( wall * 0.61 + 17.1 );
  aged *= mix( 1.0, 0.6 + 0.75 * patches, vertical );
  // Fine detail fades into the haze anyway; skip it for distant pixels.
  if ( distance( wp, cameraPosition ) < 55.0 ) {
   float mould = smoothstep( 0.55, 0.85, weatherNoise( vec2( along * 0.5 + 11.0, wp.y * 0.35 ) ) );
   aged = mix( aged, aged * vec3( 0.6, 0.63, 0.55 ), mould * 0.75 * vertical );
   float streakColumn = smoothstep( 0.55, 0.88, weatherNoise( vec2( along * 3.0, 1.7 ) ) );
   float streakLength = smoothstep( 0.25, 0.85, weatherNoise( vec2( along * 3.0 + 3.0, wp.y * 0.25 ) ) );
   float streaks = streakColumn * streakLength;
   aged = mix( aged, aged * vec3( 0.34, 0.33, 0.31 ), streaks * vertical );
   float baseHeight = 0.7 + 1.5 * weatherNoise( vec2( along * 0.55, 3.1 ) );
   float splash = ( 1.0 - smoothstep( 0.0, baseHeight, wp.y ) ) * vertical;
   aged = mix( aged, aged * vec3( 0.36, 0.31, 0.25 ), splash * 0.8 );
  }
 } else if ( wn.y > 0.7 ) {
  if ( wp.y > 0.6 ) {
   aged *= 0.62;
  } else {
   float wear = weatherNoise( wp.xz * 0.08 + 3.7 );
   float stains = smoothstep( 0.6, 0.85, weatherNoise( wp.xz * 0.45 ) );
   aged *= 0.82 + 0.3 * wear;
   aged = mix( aged, aged * vec3( 0.55, 0.53, 0.52 ), stains * 0.65 );
  }
 }
 diffuseColor.rgb = mix( base, aged, weatherAmount );
}`;

// Linear distance fog, thinner with height and tinted toward the low sun.
const FRAGMENT_FOG=`#ifdef USE_FOG
 vec3 weatherView = normalize( vWeatherPos - cameraPosition );
 float weatherSun = pow( max( dot( weatherView, uSunDir ), 0.0 ), 3.0 );
 float weatherFogFactor = smoothstep( fogNear, fogFar, vFogDepth ) * mix( 0.55, 1.0, exp( - max( vWeatherPos.y, 0.0 ) * 0.03 ) );
 gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, uSunHaze, weatherSun ), weatherFogFactor );
#endif`;

export function weatherStrength(material:THREE.Material){
 const surface=material.userData.surface as string|undefined;
 if(material.userData.weather!==undefined)return material.userData.weather as number;
 return surface===undefined?0:STRENGTH[surface]??0;
}

/** Patch every lit material under `root`. Existing onBeforeCompile hooks keep running first. */
export function applyStreetAtmosphere(root:THREE.Object3D,uniforms:AtmosphereUniforms){
 const seen=new Set<THREE.Material>();
 root.traverse(object=>{
  const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(seen.has(material)||!(material as THREE.MeshStandardMaterial).isMeshStandardMaterial||material.userData.weatherPatched)continue;
   seen.add(material);patchMaterial(material as THREE.MeshStandardMaterial,uniforms);
  }
 });
 return seen.size;
}

export function patchMaterial(material:THREE.MeshStandardMaterial,uniforms:AtmosphereUniforms){
 const previous=material.onBeforeCompile.bind(material),previousKey=material.customProgramCacheKey.bind(material);
 const strength={value:weatherStrength(material)};
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  shader.uniforms.uWeather=strength;shader.uniforms.uWorldUv={value:material.userData.worldUv??0};shader.uniforms.uSunDir=uniforms.uSunDir;shader.uniforms.uSunHaze=uniforms.uSunHaze;shader.uniforms.uShelterMin=uniforms.uShelterMin;shader.uniforms.uShelterMax=uniforms.uShelterMax;
  shader.vertexShader=VERTEX_HEAD+shader.vertexShader.replace('#include <worldpos_vertex>',VERTEX_BODY);
  shader.fragmentShader=FRAGMENT_HEAD+shader.fragmentShader.replace('#include <color_fragment>',FRAGMENT_COLOR).replace('#include <fog_fragment>',FRAGMENT_FOG);
 };
 material.customProgramCacheKey=()=>`${previousKey()}|${WEATHER_CACHE_KEY}`;
 material.userData.weatherPatched=true;material.needsUpdate=true;
}

/** Sky dome with warm horizon haze and a soft low-sun glow matching the fog tint. */
export function createSkyMaterial(uniforms:AtmosphereUniforms){
 return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uSunDir:uniforms.uSunDir,uSunHaze:uniforms.uSunHaze},
  vertexShader:'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform vec3 uSunDir; uniform vec3 uSunHaze; varying vec3 vPosition;
void main(){
 vec3 d=normalize(vPosition); float h=max(d.y,0.0);
 vec3 horizon=vec3(.86,.70,.52); vec3 middle=vec3(.55,.60,.62); vec3 top=vec3(.26,.39,.55);
 vec3 c=mix(horizon,middle,smoothstep(0.,.3,h)); c=mix(c,top,smoothstep(.2,.9,h));
 float sun=max(dot(d,uSunDir),0.0);
 c=mix(c,uSunHaze,pow(sun,5.0)*.75*(1.-smoothstep(.1,.6,h)));
 c+=vec3(1.0,.72,.45)*(pow(sun,48.0)*.55+pow(sun,900.0)*1.6);
 float cloud=sin(d.x*24.+d.z*12.)*sin(d.z*33.-d.y*42.);
 c=mix(c,mix(vec3(.78,.70,.62),uSunHaze*1.05,pow(sun,3.0)),smoothstep(.38,.85,cloud)*smoothstep(.02,.12,h)*(1.-smoothstep(.25,.5,h))*.35);
 gl_FragColor=vec4(c,1.);
}`});
}
