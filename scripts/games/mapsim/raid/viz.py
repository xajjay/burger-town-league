import json,numpy as np,cv2,sys
res=json.load(open(sys.argv[1])); cls=np.load('cls.npy'); H,W=cls.shape; CS=1.5; S=3.2  # px per map px
img=np.zeros((int(H*CS*S),int(W*CS*S),3),np.uint8)
col={0:(0,0,0),1:(55,55,55),2:(115,115,115),3:(60,120,160),4:(20,20,170)}
for k,c in col.items():
    m=np.kron(cls==k,np.ones((int(CS*S*10),int(CS*S*10)),bool))
    m=cv2.resize(m.astype(np.uint8),(img.shape[1],img.shape[0]),interpolation=cv2.INTER_NEAREST).astype(bool)
    img[m]=c
fr=res['frames']; t0=float(sys.argv[2]); t1=float(sys.argv[3])
v=img.copy()
sel=[f for f in fr if t0<=f['t']<=t1]
for i in range(8):
    c=(80,110,255) if i<4 else (255,200,60)
    pts=[(int(f['p'][i][0]*S),int(f['p'][i][1]*S)) for f in sel if f['p'][i][2]]
    for a,b in zip(pts,pts[1:]):
        if abs(a[0]-b[0])+abs(a[1]-b[1])<30: cv2.line(v,a,b,c,1)
    if sel and sel[-1]['p'][i][2]:
        x,y=int(sel[-1]['p'][i][0]*S),int(sel[-1]['p'][i][1]*S); cv2.circle(v,(x,y),5,c,-1); cv2.putText(v,str(i+1),(x+5,y-5),cv2.FONT_HERSHEY_SIMPLEX,0.45,(255,255,255),1)
for k in res['kills']:
    if t0<=k['t']<=t1: x,y=int(k['x']*S),int(k['y']*S); cv2.drawMarker(v,(x,y),(0,0,255) if k['v']<4 else (0,255,255),cv2.MARKER_TILTED_CROSS,8,2)
lab=str(sel[-1].get('h','')) if sel else ''
cv2.putText(v,f"t {t0}-{t1} {sel[-1]['s'] if sel else ''} {lab}",(10,20),cv2.FONT_HERSHEY_SIMPLEX,0.6,(255,255,255),1)
cv2.imwrite(sys.argv[4],v)
