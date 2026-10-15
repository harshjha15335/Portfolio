import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
// Studio review of the modelled district traffic: every model at its near, far and distant level, front three-
// quarter and rear three-quarter, lit like the street (sun, sky fill, environment reflections) with the
// districts' shared paint material. Needs the dev server. Usage: node scripts/review-vehicles.mjs [out-dir]
const base=process.env.STREET_CAPTURE_URL??'http://127.0.0.1:5173/';
const out=process.argv[2]??'docs/screenshots/vehicles';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:900,height:600}});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>console.log('ERROR',e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log(m.text().slice(0,300));});
 await page.goto(new URL('models/vehicles/city/provenance.json',base).href);
 const shots=await page.evaluate(async()=>{
  document.body.innerHTML='';document.body.style.margin='0';
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const {RoomEnvironment}=await import('/node_modules/.vite/deps/three_addons_environments_RoomEnvironment__js.js').catch(()=>import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js'));
  const models=await import('/src/game/World/districts/CityVehicleModels.ts');
  const {createCityVehicle}=await import('/src/game/World/districts/CityVehicles.ts');
  await models.preloadCityVehicleModels(location.origin);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,600);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;document.body.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#c9c2b4');
  scene.environment=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;
  const sun=new THREE.DirectionalLight('#ffd2a8',3.2);sun.position.set(-8,10,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12});scene.add(sun,new THREE.HemisphereLight('#a8c0e0','#6b5a48',1.1));
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:'#5a5c5d',roughness:.95}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const camera=new THREE.PerspectiveCamera(30,900/600,.1,200);
  const kinds=[['hatch','Hatchback'],['sedan','Sedan'],['suv','SUV'],['bus','BEST bus'],['bike','Motorbike']];
  const shots=[];
  for(const [kind,label] of kinds){
   for(const seed of (kind==='bus'?['b1','b3']:kind==='bike'?['m1','m2','m3','m4']:['a2'])){
    const size=kind==='bus'?11:kind==='bike'?2.2:4.6,h=kind==='bus'?3.6:kind==='bike'?1.1:1.5,d=size*1.25;
    for(const level of [0,1,2]){
     const m=createCityVehicle(kind,seed,false,level);scene.add(m);
     for(const [view,yaw] of [['front',Math.PI-.62],['rear',-.62]]){
      m.rotation.y=yaw;camera.position.set(0,h*.9+.5,d);camera.lookAt(0,h*.42,0);
      renderer.render(scene,camera);shots.push({name:`${kind}-${seed}-${['near','far','distant'][level]}-${view}`,label,data:renderer.domElement.toDataURL('image/jpeg',.9)});
     }
     scene.remove(m);m.geometry.dispose();
    }
   }
  }
  return shots;
 });
 const fs=await import('node:fs/promises');
 for(const s of shots){await fs.writeFile(`${out}/${s.name}.jpg`,Buffer.from(s.data.split(',')[1],'base64'));console.log(s.name);}
}finally{await browser.close();}
