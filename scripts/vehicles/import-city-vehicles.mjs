// Admit the modelled district traffic built by build_car.py, build_bus.py and build_bike.py (their *-city.glb
// outputs): copy into public/models/vehicles/city, check each has 'near' and 'far' RGBA-coloured meshes within the
// lofted bodies' triangle counts, hash them and write the record the runtime verifies them by.
// Usage: node scripts/vehicles/import-city-vehicles.mjs <work-dir>
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const [work]=process.argv.slice(2);if(!work)throw Error('Usage: node scripts/vehicles/import-city-vehicles.mjs <work-dir>');
// Allowances are the lofted bodies' counts (CityVehicles.ts) these replace, near / far.
const MODELS=[
 {name:'hatchback',source:'build_car.py hatchback',paintKey:'#c7c9c8',allow:[4944,2160]},
 {name:'saloon',source:'build_car.py saloon',paintKey:'#5a1f24',allow:[4944,2160]},
 {name:'suv',source:'build_car.py suv',paintKey:'#e9e9e6',allow:[4944,2160]},
 {name:'bus-double',source:'build_bus.py double',paintKey:'#b3241b',allow:[3742,1558]},
 {name:'bus-single',source:'build_bus.py single',paintKey:'#b3241b',allow:[3742,1558]},
 {name:'motorbike',source:'build_bike.py',paintKey:'#1d2d5a',allow:[2187,769]},
];
await mkdir(resolve(root,'public/models/vehicles/city'),{recursive:true});
const files=[];
for(const model of MODELS){
 const bytes=await readFile(resolve(work,`${model.name}-city.glb`));
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 if(json.images?.length||json.textures?.length||json.materials?.length)throw Error(`${model.name}: no textures or materials expected`);
 const triangles={};
 for(const mesh of json.meshes){
  if(mesh.primitives.length!==1)throw Error(`${model.name}/${mesh.name}: one primitive expected`);
  const p=mesh.primitives[0];if(!('COLOR_0' in p.attributes)||json.accessors[p.attributes.COLOR_0].type!=='VEC4')throw Error(`${model.name}/${mesh.name}: RGBA COLOR_0 expected`);
  triangles[mesh.name]=json.accessors[p.indices??p.attributes.POSITION].count/3;
 }
 if(!('near' in triangles&&'far' in triangles))throw Error(`${model.name}: needs near and far meshes`);
 if(triangles.near>model.allow[0]||triangles.far>model.allow[1])throw Error(`${model.name}: ${triangles.near}/${triangles.far} triangles exceeds ${model.allow.join('/')}`);
 await copyFile(resolve(work,`${model.name}-city.glb`),resolve(root,`public/models/vehicles/city/${model.name}.glb`));
 files.push({name:model.name,url:`/models/vehicles/city/${model.name}.glb`,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,triangles,paintKey:model.paintKey,source:`scripts/vehicles/${model.source}`});
 console.log(model.name,bytes.length,JSON.stringify(triangles));
}
const record={origin:'original',author:'Harsh Jha portfolio (modelled as code)',license:'Original work for this repository (no third-party licence applies)',
 notes:'No third-party geometry or images. Built in Blender from code; ambient occlusion baked into COLOR_0, whose alpha marks paint faces recoloured at runtime. Each file holds near and far meshes decimated to the triangle counts of the lofted bodies they replace.',files};
await writeFile(resolve(root,'public/models/vehicles/city/provenance.json'),JSON.stringify(record,null,2)+'\n');
