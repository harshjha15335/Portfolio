"""Original CC0 surface study maps, 256px. No photographs/downloaded artwork.
Author: Portfolio project (original mathematical texture generator).
Not a photogrammetry asset. OpenGL tangent-space normals; roughness is linear.
"""
from pathlib import Path
from PIL import Image, ImageFilter
import random, math, hashlib, json
out=Path('public/surfaces');out.mkdir(parents=True,exist_ok=True)
records=[]
for name in ['asphalt','plaster']:
 rng=random.Random('CST-Fort-sprint2:'+name);n=256
 heights=Image.new('L',(n,n));hp=heights.load()
 for y in range(n):
  for x in range(n):hp[x,y]=int(100+rng.random()*100)
 coarse=heights.filter(ImageFilter.GaussianBlur(5));cp=coarse.load()
 base=Image.new('RGB',(n,n));rough=Image.new('RGB',(n,n));normal=Image.new('RGB',(n,n));bp=base.load();rp=rough.load();np=normal.load()
 for y in range(n):
  for x in range(n):
   h=hp[x,y];c=cp[x,y];grain=(h-150)*(.30 if name=='asphalt' else .1)+(c-150)*.4
   v=max(0,min(255,int((168 if name=='asphalt' else 216)+grain)))
   bp[x,y]=(v,max(0,v-3),max(0,v-8)) if name=='plaster' else (v,v,min(255,v+2))
   r=int((229 if name=='asphalt' else 237)+(h-150)*.16);rp[x,y]=(r,r,r)
   strength=.003 if name=='asphalt' else .0014
   dx=(hp[(x+1)%n,y]-hp[(x-1)%n,y])*strength;dy=(hp[x,(y+1)%n]-hp[x,(y-1)%n])*strength
   l=math.sqrt(1+dx*dx+dy*dy);np[x,y]=(int(127.5-dx/l*127.5),int(127.5+dy/l*127.5),int(127.5+127.5/l))
 for channel,img in [('color',base),('roughness',rough),('normal',normal)]:
  path=out/f'{name}-{channel}.png';img.save(path,optimize=True);records.append({'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'width':n,'height':n,'colorSpace':'sRGB' if channel=='color' else 'linear','channel':channel,'surface':name})
(out/'provenance.json').write_text(json.dumps({'author':'Portfolio project — original texture generator','license':'CC0-1.0','licenseUrl':'https://creativecommons.org/publicdomain/zero/1.0/','source':'scripts/generate-surface-maps.py','modifications':'Original authored micro-surface studies; no third-party input, no photographs. 256px, RGB PNG, OpenGL normal convention.','files':records},indent=2)+'\n')
(out/'LICENSE.txt').write_text('Original surface maps and their generator are dedicated to the public domain under CC0 1.0 Universal.\nAuthor: Portfolio project. No third-party artwork or photographs were used.\nhttps://creativecommons.org/publicdomain/zero/1.0/legalcode\n')
