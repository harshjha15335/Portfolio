import numpy as np
from PIL import Image
def warm(img, strength=1.0, gain=(0.72,0.57,0.46), desat=0.22):
    a=np.asarray(img.convert('RGB')).astype(np.float32)/255
    r,g,b=a[...,0],a[...,1],a[...,2]
    mx=a.max(2); mn=a.min(2); v=mx; s=np.where(mx>0,(mx-mn)/np.maximum(mx,1e-5),0)
    hue=np.zeros_like(mx); d=np.maximum(mx-mn,1e-5)
    hr=((g-b)/d)%6; hue=np.where(mx==r,hr*60,hue)
    hue=np.where((mx==g)&(mx!=r),((b-r)/d+2)*60,hue)
    def ramp(x,a0,a1): return np.clip((x-a0)/(a1-a0),0,1)
    m=ramp(hue,0,6)*(1-ramp(hue,32,44))*ramp(s,0.10,0.2)*(1-ramp(s,0.62,0.75))*ramp(v,0.28,0.42)
    m=np.where(hue>300,0,m)*strength
    t=a*np.array(gain)[None,None,:]; L=(t*np.array([.3,.59,.11])).sum(2,keepdims=True); t=t*(1-desat)+L*desat
    out=a*(1-m[...,None])+t*m[...,None]
    return Image.fromarray((np.clip(out,0,1)*255+.5).astype(np.uint8)), m
if __name__=='__main__':
    import sys
    im=Image.open(sys.argv[1]); o,m=warm(im,float(sys.argv[3]) if len(sys.argv)>3 else 1)
    w=Image.new('RGB',(1024,512)); w.paste(im.convert('RGB').resize((512,512)),(0,0)); w.paste(o.resize((512,512)),(512,0)); w.save(sys.argv[2])
