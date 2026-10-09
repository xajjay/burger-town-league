import cv2,numpy as np
im=cv2.imread('snd.png').astype(np.int16)
g=im.mean(2); sat=im.max(2)-im.min(2)
H,W=g.shape
bright=(g>85)&(sat<40); col=sat>=40
bar=(bright|col).astype(np.uint8)
cv2.line(bar,(645,58),(955,112),1,3)
bar[:96,640:960]=1  # toolbar region is outside but block flood through it
bar=cv2.dilate(bar,np.ones((5,5),np.uint8))
ff=(1-bar).astype(np.uint8); mask=np.zeros((H+2,W+2),np.uint8)
cv2.floodFill(ff,mask,(5,5),2)
outside=cv2.dilate((ff==2).astype(np.uint8),np.ones((5,5),np.uint8))>0
outside[:96,640:960]|=(g[:96,640:960]<85)|True
# re-open: toolbar area under top edge: keep only above the line
yy,xx=np.mgrid[:H,:W]
lineY=58+(xx-645)*(112-58)/(955-645)
outside[(yy<96)&(xx>=640)&(xx<960)]=(yy<lineY)[(yy<96)&(xx>=640)&(xx<960)]
print('outside frac',outside.mean())
vis=np.zeros((H,W,3),np.uint8); vis[~outside]=(60,60,60); vis[bright&~outside]=(200,200,200); vis[col&~outside]=(0,0,255)
cv2.imwrite('base_vis.png',vis)
np.save('outside.npy',outside); np.save('bright.npy',bright)
