import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {applyStreetAtmosphere,createAtmosphereUniforms,WEATHER_CACHE_KEY,weatherStrength} from '../src/game/World/StreetAtmosphere';

const uniforms=()=>createAtmosphereUniforms(new THREE.Vector3(-39,13,-72),new THREE.Vector3(0,0,-26),'#f2b682');
const shader=(material:THREE.Material)=>({uniforms:{} as Record<string,{value:unknown}>,vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader,material});

describe('street atmosphere',()=>{
 it('patches every lit material once with one shared program key',()=>{
  const plaster=Object.assign(new THREE.MeshStandardMaterial(),{userData:{surface:'plaster'}});
  const person=new THREE.MeshStandardMaterial();const sign=new THREE.MeshBasicMaterial();
  const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),plaster),new THREE.Mesh(new THREE.BoxGeometry(),plaster),new THREE.Mesh(new THREE.BoxGeometry(),person),new THREE.Mesh(new THREE.BoxGeometry(),sign));
  expect(applyStreetAtmosphere(root,uniforms())).toBe(2);
  expect(applyStreetAtmosphere(root,uniforms())).toBe(0);
  expect(plaster.customProgramCacheKey()).toBe(person.customProgramCacheKey());
  expect(plaster.customProgramCacheKey()).toContain(WEATHER_CACHE_KEY);
  expect(sign.userData.weatherPatched).toBeUndefined();
 });
 it('ages façades and ground but leaves people, vehicles and glass untouched',()=>{
  const material=(userData:Record<string,unknown>)=>Object.assign(new THREE.MeshStandardMaterial(),{userData});
  expect(weatherStrength(material({surface:'plaster'}))).toBe(1);
  expect(weatherStrength(material({surface:'asphalt'}))).toBeGreaterThan(0);
  expect(weatherStrength(material({surface:'glass'}))).toBe(0);
  expect(weatherStrength(material({}))).toBe(0);
  expect(weatherStrength(material({weather:.35}))).toBe(.35);
 });
 it('keeps an existing compile hook and injects into the standard chunks',()=>{
  const material=new THREE.MeshStandardMaterial();material.userData.surface='stone';
  let previous=0;material.onBeforeCompile=()=>{previous++;};material.customProgramCacheKey=()=>'hero';
  const root=new THREE.Mesh(new THREE.BoxGeometry(),material);applyStreetAtmosphere(root,uniforms());
  const compiled=shader(material);material.onBeforeCompile(compiled as never,{} as THREE.WebGLRenderer);
  expect(previous).toBe(1);expect(material.customProgramCacheKey()).toBe(`hero|${WEATHER_CACHE_KEY}`);
  expect(compiled.vertexShader).toContain('vWeatherPos = weatherWorld.xyz;');
  expect(compiled.fragmentShader).toContain('diffuseColor.rgb = mix( base, aged, weatherAmount );');
  expect(compiled.fragmentShader).toContain('uSunHaze');
  expect((compiled.uniforms.uWeather as {value:number}).value).toBe(.85);
 });
 it('patches a clone of a patched material instead of trusting its copied flag',()=>{
  const original=new THREE.MeshStandardMaterial();applyStreetAtmosphere(new THREE.Mesh(new THREE.BoxGeometry(),original),uniforms());
  const copy=original.clone();expect(copy.userData.weatherPatched).toBe(true);expect(copy.customProgramCacheKey()).not.toContain(WEATHER_CACHE_KEY);
  expect(applyStreetAtmosphere(new THREE.Mesh(new THREE.BoxGeometry(),copy),uniforms())).toBe(1);
  expect(copy.customProgramCacheKey()).toBe(original.customProgramCacheKey());
 });
});
