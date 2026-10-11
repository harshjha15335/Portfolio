/** Static admission inspection. Visual anatomy/clothing/animation still requires a rendered review. */
export function inspectCharacter(bytes){
 if(bytes.length<20||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB v2 header');
 if(bytes.length>8*1024*1024)throw Error('8 MiB character file ceiling exceeded');
 const length=bytes.readUInt32LE(12);if(bytes.readUInt32LE(16)!==0x4e4f534a||20+length>bytes.length)throw Error('Invalid JSON chunk');
 const gltf=JSON.parse(bytes.subarray(20,20+length).toString('utf8'));const binOffset=20+length;
 if(gltf.asset?.version!=='2.0'||binOffset+8>bytes.length||bytes.readUInt32LE(binOffset+4)!==0x004e4942)throw Error('Embedded GLB binary chunk required');
 const binLength=bytes.readUInt32LE(binOffset);if(binOffset+8+binLength>bytes.length)throw Error('Truncated binary');const bin=bytes.subarray(binOffset+8,binOffset+8+binLength);
 if((gltf.extensionsRequired??[]).some(x=>!['KHR_materials_unlit','KHR_materials_emissive_strength'].includes(x)))throw Error('Required decoder/extension is unsupported');
 if([...(gltf.buffers??[]),...(gltf.images??[])].some(x=>Object.hasOwn(x,'uri')))throw Error('External/data URI references are not accepted');
 if(gltf.buffers?.length!==1||gltf.buffers[0].byteLength>bin.length)throw Error('Exactly one embedded buffer required');
 for(const v of gltf.bufferViews??[])if(v.buffer!==0||!Number.isInteger(v.byteLength)||v.byteLength<=0||(v.byteOffset??0)<0||(v.byteOffset??0)+v.byteLength>bin.length)throw Error('Invalid buffer view bounds');
 const sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
 for(const a of gltf.accessors??[]){const v=gltf.bufferViews?.[a.bufferView],size=sizes[a.componentType]*components[a.type];if(!v||!size||a.sparse||!Number.isInteger(a.count)||a.count<=0)throw Error('Unsupported accessor');const stride=v.byteStride??size;if(stride<size||(a.byteOffset??0)<0||(a.byteOffset??0)+(a.count-1)*stride+size>v.byteLength)throw Error('Accessor exceeds its buffer view');}
 let triangles=0,primitives=0;const skins=gltf.skins??[];
 if(!skins.length||skins.some(s=>s.joints.length<15||s.joints.length>80||s.joints.some(j=>!gltf.nodes?.[j])))throw Error('Expected a humanoid rig with 15–80 valid joints');
 for(const mesh of gltf.meshes??[])for(const p of mesh.primitives??[]){
  if((p.mode??4)!==4||p.extensions?.KHR_draco_mesh_compression)throw Error('Only uncompressed triangle primitives are admitted');
  if(!gltf.accessors?.[p.attributes?.POSITION]||p.attributes.JOINTS_0===undefined||p.attributes.WEIGHTS_0===undefined||p.attributes.NORMAL===undefined)throw Error('Every character primitive must have positions, normals and skin weights');
  const count=gltf.accessors[p.indices??p.attributes.POSITION]?.count;if(!Number.isInteger(count)||count<=0||count%3!==0)throw Error('Invalid triangle count');triangles+=count/3;primitives++;
 }
 if(!primitives||primitives>4||triangles>12000)throw Error('Character ceiling: 12,000 triangles and four primitives');
 if((gltf.materials??[]).length>4)throw Error('Maximum four materials');
 if(!(gltf.nodes??[]).some(n=>n.mesh!==undefined&&n.skin!==undefined&&skins[n.skin]))throw Error('No skinned mesh node');
 const textures=(gltf.images??[]).map(image=>{const v=gltf.bufferViews?.[image.bufferView];if(!v)throw Error('Embedded image view missing');const b=bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);let width,height;
  if(image.mimeType==='image/png'&&b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){width=b.readUInt32BE(16);height=b.readUInt32BE(20);}
  else if(image.mimeType==='image/jpeg'&&b[0]===255&&b[1]===216){let i=2;while(i+9<b.length){if(b[i++]!==255)continue;const marker=b[i++];if(marker===216||marker===217)continue;const size=b.readUInt16BE(i);if(size<2||i+size>b.length)break;if([192,193,194].includes(marker)){height=b.readUInt16BE(i+3);width=b.readUInt16BE(i+5);break;}i+=size;}}
  if(!width||!height||width>1024||height>1024)throw Error('Textures must be embedded PNG/JPEG at most 1024×1024');return {width,height,mimeType:image.mimeType};
 });if(!textures.length||textures.length>4)throw Error('Expected 1–4 authored character textures');
 const animations=gltf.animations??[];
 const jointNodes=new Set(skins.flatMap(s=>s.joints));
 const clips=['idle','walk'].map(name=>{const a=animations.find(a=>new RegExp(name,'i').test(a.name??''));if(!a||!a.channels?.length||!a.channels.some(c=>['rotation','translation'].includes(c.target?.path)&&jointNodes.has(c.target.node)))throw Error(`Rig-bound ${name} animation is required`);
  for(const channel of a.channels){const sampler=a.samplers?.[channel.sampler],output=gltf.accessors?.[sampler?.output],input=gltf.accessors?.[sampler?.input];if(!sampler||!output||!input||output.componentType!==5126||output.type!==(channel.target.path==='rotation'?'VEC4':'VEC3')||output.count!==input.count*(sampler.interpolation==='CUBICSPLINE'?3:1))throw Error('Invalid animation output accessor');}
  let duration=0;for(const s of a.samplers??[]){const input=gltf.accessors?.[s.input],v=gltf.bufferViews?.[input?.bufferView];if(!input||!v||input.componentType!==5126||input.type!=='SCALAR'||input.count<2||input.sparse)throw Error('Animation times must be non-sparse float scalars');const offset=(v.byteOffset??0)+(input.byteOffset??0),stride=v.byteStride??4;let previous=-1;for(let i=0;i<input.count;i++){const pos=offset+i*stride;if(pos+4>bin.length)throw Error('Animation accessor exceeds binary');const t=bin.readFloatLE(pos);if(!Number.isFinite(t)||t<0||t<=previous)throw Error('Animation times must strictly increase');previous=t;}duration=Math.max(duration,previous);}
  if(duration<=0)throw Error('Animation duration must be positive');return {name:a.name,duration,channels:a.channels.length};
 });
 return {triangles,primitives,materials:(gltf.materials??[]).length,joints:skins.map(s=>s.joints.length),textures,clips,visualReviewRequired:['human proportions','clothing and texture quality','human-scale floor alignment','Idle and Walk move the intended skeleton','foot sliding/facing direction','new Medium draw/triangle/texture/program counts']};
}
