// Admit an original vehicle body (taxi or auto) built by scripts/vehicles/build_<kind>.py: copy it into
// public/models/vehicles, hash it and write the record the runtime verifies it by.
// Usage: node scripts/vehicles/import-vehicle.mjs <taxi|auto> <work-dir>
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const [kind,work]=process.argv.slice(2);if(!['taxi','auto'].includes(kind)||!work)throw Error('Usage: node scripts/vehicles/import-vehicle.mjs <taxi|auto> <work-dir>');
const ALLOWANCE={taxi:5000,auto:3600};
const bytes=await readFile(resolve(work,`${kind}.glb`));
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
if(json.images?.length||json.textures?.length||json.materials?.length)throw Error('Vehicle bodies carry no textures or materials');
const parts={};
for(const mesh of json.meshes){if(mesh.primitives.length!==1)throw Error(`${mesh.name}: one primitive expected`);const p=mesh.primitives[0];parts[mesh.name]=json.accessors[p.indices??p.attributes.POSITION].count/3;}
for(const name of ['body','glass','lamps','tail'])if(!(name in parts))throw Error(`Missing part ${name}`);
const body=json.meshes.find(m=>m.name==='body').primitives[0].attributes;if(!('COLOR_0' in body&&'TEXCOORD_0' in body))throw Error('Body needs COLOR_0 and TEXCOORD_0');
const triangles=Object.values(parts).reduce((a,b)=>a+b,0);if(triangles>ALLOWANCE[kind])throw Error(`${kind} has ${triangles} triangles; the allowance is ${ALLOWANCE[kind]}`);
await copyFile(resolve(work,`${kind}.glb`),resolve(root,`public/models/vehicles/${kind}.glb`));
const record={id:`${kind}-body`,url:`/models/vehicles/${kind}.glb`,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,triangles,parts,
 origin:'original',author:'Harsh Jha portfolio (modelled as code)',source:`scripts/vehicles/build_${kind}.py`,license:'Original work for this repository (no third-party licence applies)',
 notes:'No third-party geometry or images. Body colour in COLOR_0, (roughness, 1 - metalness) in TEXCOORD_0, ambient occlusion baked in Blender; glass, lamps and tail are position-only parts drawn with the vehicle\'s own materials.'};
await writeFile(resolve(root,`public/models/vehicles/${kind}.provenance.json`),JSON.stringify(record,null,2)+'\n');
console.log(kind,record.sha256,record.bytes,triangles,JSON.stringify(parts));
