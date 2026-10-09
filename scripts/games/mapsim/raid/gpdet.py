import cv2,numpy as np,glob,json
S=0.245; OFF=(112,-35)
pts=[]
fs=sorted(glob.glob('gp/gp/*.jpg'))
for fi,f in enumerate(fs):
    a=cv2.imread(f).astype(np.int16); b,g,r=a[...,0],a[...,1],a[...,2]
    for team,m in (('g',(g-np.maximum(r,b)>14)&(g>100)),('r',(r-np.maximum(g,b)>35)&(r>110))):
        n,lab,st,cen=cv2.connectedComponentsWithStats(m.astype(np.uint8))
        for i in range(1,n):
            ar=st[i,4]
            if ar<8 or ar>90: continue
            x,y=cen[i]
            pts.append([fi,team,round(x/S+OFF[0],1),round(y/S+OFF[1],1),int(ar)])
json.dump(pts,open('gp_pts.json','w'))
import collections
print(len(pts),collections.Counter(p[1] for p in pts), len(fs))
