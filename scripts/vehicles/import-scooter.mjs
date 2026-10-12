// Admit the built scooter: copy it into public/models/vehicles, hash it, and write the
// provenance record the street loads it by. Usage: node scripts/vehicles/import-scooter.mjs <work-dir>
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const work=process.argv[2];if(!work)throw Error('Usage: node scripts/vehicles/import-scooter.mjs <work-dir>');
const spec=JSON.parse(await readFile(resolve(root,'scripts/vehicles/scooter.json'),'utf8'));
const stats=JSON.parse(await readFile(resolve(work,'scooter.stats.json'),'utf8'));
const bytes=await readFile(resolve(work,'scooter.glb'));
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
if(json.images?.length||json.textures?.length)throw Error('The scooter must carry no textures');
// Count what the GLB actually draws (Blender's n-gon count can differ by a degenerate face or two).
const primitive=json.meshes[0].primitives[0];stats.triangles=json.accessors[primitive.indices??primitive.attributes.POSITION].count/3;
if(stats.triangles>5000)throw Error(`Scooter has ${stats.triangles} triangles; the allowance is 5000`);
await copyFile(resolve(work,'scooter.glb'),resolve(root,'public/models/vehicles/scooter.glb'));
const record={id:'parked-scooter',url:'/models/vehicles/scooter.glb',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,
 triangles:stats.triangles,sourceTriangles:stats.sourceTriangles,size:stats.size.map(v=>+v.toFixed(3)),
 title:spec.title,author:spec.author,source:spec.origin,license:spec.license,licenseUrl:spec.licenseUrl,credit:spec.credit,
 mirror:`https://github.com/${spec.source.repository}/tree/${spec.source.commit}/${spec.source.path}`,licenseEvidence:spec.source.licenseEvidence,
 modifications:`Decal removed; decimated from ${stats.sourceTriangles} to ${stats.triangles} triangles per material; base colour, roughness and metalness re-sampled from the source textures into vertex data (COLOR_0, TEXCOORD_0 = roughness, 1 - metalness); textures dropped; scaled to ${spec.lengthMetres} m, grounded and turned to face +Z. Built by scripts/vehicles/build_scooter.py.`};
await writeFile(resolve(root,'public/models/vehicles/scooter.provenance.json'),JSON.stringify(record,null,2)+'\n');
console.log(record.sha256,record.bytes,record.triangles);
