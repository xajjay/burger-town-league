from reg import *
import glob,json,sys
S=0.245
rs=cv2.resize(ref,None,fx=S,fy=S,interpolation=cv2.INTER_AREA)
def m1(a,angs):
    best=(-2,None)
    for ang in angs:
        t=tmpl(a,ang)
        res=cv2.matchTemplate(rs,t,cv2.TM_CCOEFF_NORMED,mask=mask); res[~np.isfinite(res)]=-2
        _,mv,_,ml=cv2.minMaxLoc(res)
        if mv>best[0]: best=(mv,(ang,(ml[0]+R)/S-PAD,(ml[1]+R)/S-PAD))
    return best
out={}
groups={}
for f in sorted(glob.glob('mm/mm/*.jpg')):
    k=f.split('/')[-1].rsplit('_',1)[0]; groups.setdefault(k,[]).append(f)
import sys
for k,fs in groups.items():
    if k!=sys.argv[1]: continue
    prev=None; tr=[]
    for f in fs:
        a=prepmm(f)
        if prev is not None:
            b=m1(a,[(prev+d)%360 for d in range(-21,22,3)])
            if b[0]<0.8: b2=m1(a,range(0,360,4)); b=b2 if b2[0]>b[0] else b
        else: b=m1(a,range(0,360,3))
        if b[1] is None: tr.append([0,prev or 0,0,0]); continue
        prev=b[1][0]; tr.append([round(b[0],3),b[1][0],round(b[1][1],1),round(b[1][2],1)])
    out[k]=tr; print(k,len(tr),np.mean([x[0] for x in tr]),flush=True)
json.dump(out,open('tracks_'+sys.argv[1]+'.json','w'))
