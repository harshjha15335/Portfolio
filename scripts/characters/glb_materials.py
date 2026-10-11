import json,struct,sys
src,dst=sys.argv[1],sys.argv[2]
b=open(src,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+n]); rest=b[20+n:]
for m in j['materials']:
    if m.get('name','').endswith('_hair'): m['alphaMode']='MASK'; m['alphaCutoff']=0.42; m['doubleSided']=True
    else: m.pop('alphaMode',None); m['doubleSided']=False
    pbr=m.setdefault('pbrMetallicRoughness',{}); pbr['metallicFactor']=0
j['asset']['generator']='Blender glTF exporter + Portfolio Rocketbox conversion (scripts/characters)'
js=json.dumps(j,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
out=struct.pack('<III',0x46546C67,2,12+8+len(js)+len(rest))+struct.pack('<II',len(js),0x4E4F534A)+js+rest
open(dst,'wb').write(out); print(dst,len(out),[ (m['name'],m.get('alphaMode')) for m in j['materials']])
