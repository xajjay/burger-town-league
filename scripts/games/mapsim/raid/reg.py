import cv2,numpy as np,glob,sys
outside=np.load('outside.npy'); bright=np.load('bright.npy')
ref=np.where(outside,0.0,np.where(bright,1.0,0.35)).astype(np.float32)
ref=cv2.GaussianBlur(ref,(0,0),2)
PAD=500
ref=cv2.copyMakeBorder(ref,PAD,PAD,PAD,PAD,cv2.BORDER_CONSTANT,value=0)
C=(115,107); R=74
def prepmm(f):
    a=cv2.imread(f,0).astype(np.float32)
    c=np.where(a>115,1.0,np.where(a>50,0.35,0.0)).astype(np.float32)
    return cv2.GaussianBlur(c,(0,0),1)
def tmpl(a,ang):
    M=cv2.getRotationMatrix2D(C,ang,1.0)
    r=cv2.warpAffine(a,M,(a.shape[1],a.shape[0]),flags=cv2.INTER_LINEAR)
    t=r[C[1]-R:C[1]+R,C[0]-R:C[0]+R].copy()
    return t
yy,xx=np.mgrid[-R:R,-R:R]; mask=((xx**2+yy**2)<R*R)&~((abs(xx)<9)&(abs(yy)<11))
mask=mask.astype(np.float32)
def match(a,s,angs):
    rs=cv2.resize(ref,None,fx=s,fy=s,interpolation=cv2.INTER_AREA)
    best=(-2,None)
    for ang in angs:
        t=tmpl(a,ang)
        res=cv2.matchTemplate(rs,t,cv2.TM_CCOEFF_NORMED,mask=mask)
        res[~np.isfinite(res)]=-2
        _,mv,_,ml=cv2.minMaxLoc(res)
        if mv>best[0]: best=(mv,(ang,(ml[0]+R)/s-PAD,(ml[1]+R)/s-PAD))
    return best
if __name__=='__main__':
    for f in sys.argv[1:]:
        a=prepmm(f)
        for s in [0.15,0.2,0.25,0.3,0.35,0.4,0.5]:
            print(f,s,match(a,s,range(0,360,6)))
