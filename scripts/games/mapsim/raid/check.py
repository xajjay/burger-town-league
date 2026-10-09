import cv2,numpy as np,json
base=cv2.imread('snd.png'); cls=np.load('cls.npy'); H,W=cls.shape
D=json.load(open('doors.json'))
M=open('dyn-mapdata.js').read(); d=json.loads(M[M.index('Raid = ')+7:M.rindex(';\n})')])
def ref(p): return (int(p[0]/0.25+200), int(p[1]/0.25+40))
v=(base*0.55).astype(np.uint8); ov=v.copy()
for cy in range(H):
    for cx in range(W):
        k=cls[cy,cx]; x0,y0=200+cx*6,40+cy*6
        if k==4: cv2.rectangle(ov,(x0,y0),(x0+5,y0+5),(40,40,230),-1)
        elif k==3: cv2.rectangle(ov,(x0,y0),(x0+5,y0+5),(60,150,200),-1)
v=cv2.addWeighted(ov,0.8,v,0.2,0)
for i,dd in enumerate(D):
    x0,x1,y0,y1=dd['r']; cx=200+(x0+x1+1)*3; cy=40+(y0+y1+1)*3
    cv2.circle(v,(cx,cy),11,(60,220,60),2); cv2.putText(v,str(i+1),(cx-7,cy+5),cv2.FONT_HERSHEY_SIMPLEX,0.45,(255,255,255),2)
for h in d['HP']['hills']:
    sh=h['sh']
    if 'r' in sh: cv2.circle(v,ref((sh['x'],sh['y'])),int(sh['r']/0.25),(255,255,255),1); c=ref((sh['x'],sh['y']))
    else:
        pts=np.array([ref(p) for p in sh['pts']],np.int32); cv2.polylines(v,[pts],True,(255,255,255),1); c=tuple(pts.mean(0).astype(int))
    cv2.putText(v,h['c'],c,cv2.FONT_HERSHEY_SIMPLEX,0.6,(255,255,255),2)
for p in d['via']: cv2.drawMarker(v,ref(p),(200,200,0),cv2.MARKER_DIAMOND,9,1)
cv2.putText(v,"Raid sim check: red = walls/solid, orange = low cover (planters, cars), green numbers = doorways, cyan diamonds = route points",(20,935),cv2.FONT_HERSHEY_SIMPLEX,0.5,(255,255,255),1)
for i,dd in enumerate(D): cv2.putText(v,"%d %s"%(i+1,dd['n']),(1340,60+i*20),cv2.FONT_HERSHEY_SIMPLEX,0.42,(200,255,200),1)
cv2.imwrite('raid_sim_check.png',v)
