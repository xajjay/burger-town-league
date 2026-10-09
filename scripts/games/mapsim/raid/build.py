"""Build the Raid grid + mode data for dyn-mapsim from the overhead map, AJ's annotations and tracked footage.
Reference frame = raidsnd.png pixels (ref px). Map px = (ref - ORG) * SC. Grid cell = CELL ref px."""
import cv2, numpy as np, json, glob, sys
ORG = (200, 40); SC = 0.25; CELL = 6
out = np.load('outside.npy'); br = np.load('bright.npy'); op = np.load('opened.npy').astype(bool); thin = np.load('thin.npy')
Hr, Wr = out.shape
W = int(np.ceil((1335 - ORG[0]) / CELL)); H = int(np.ceil((950 - ORG[1]) / CELL))
CS = CELL * SC
def m(x, y): return [round((x - ORG[0]) * SC, 1), round((y - ORG[1]) * SC, 1)]

# ---- bright components: which are buildings (walk inside), which are solid, which are low cover, which are floor
n, lab, st, cen = cv2.connectedComponentsWithStats(op.astype(np.uint8))
def comp_at(x, y): return lab[y, x]
BUILD = {comp_at(950, 300): 'bedroom', comp_at(600, 450): 'kitchen', comp_at(950, 560): 'art', comp_at(1250, 550): 'garage'}
ROCKS = comp_at(510, 260)
SOLID = {comp_at(664, 162): 'bar', comp_at(790, 280): 'stairs pillar', comp_at(414, 480): 'yard box', comp_at(520, 680): 'laundry wall', comp_at(605, 750): 'laundry', comp_at(788, 740): 'statue', comp_at(838, 142): 'box'}
kind = np.zeros(n, np.uint8)  # 0 none, 2 building, 4 solid, 3 low cover, 1 floor (stairs/annotations)
for i in range(1, n):
    x, y, w, h, a = st[i]
    if i == ROCKS: kind[i] = 1
    elif i in BUILD: kind[i] = 2
    elif i in SOLID: kind[i] = 4
    elif a < 30: kind[i] = 1
    elif 940 < x < 1080 and 680 < y < 780: kind[i] = 1   # curved stair edging
    elif x > 1230 and 370 < y < 470: kind[i] = 2         # garage spawn annotation sits inside the garage
    else: kind[i] = 3                                    # planters, cars, benches: low cover
pix = kind[lab]
pix[~op] = 0
# the garage spawn annotation area: fill inside the garage rectangle
pix[300:590, 1180:1318][~out[300:590, 1180:1318]] = 2
# thin lines that are walls/fences (the rest are ledges/steps/annotation)
WALL_LINES = [((536, 50), (537, 200)), ((540, 772), (575, 772)), ((540, 802), (575, 802)), ((1165, 318), (1175, 345))]
COVER_LINES = [((360, 462), (395, 462)), ((428, 462), (428, 488)), ((428, 512), (428, 555)), ((428, 580), (428, 612))]
wl = np.zeros_like(out, np.uint8)
for (a, b) in WALL_LINES: cv2.line(wl, a, b, 1, 4)
wallline = (wl > 0) & thin
cl_ = np.zeros_like(out, np.uint8)
for (a, b) in COVER_LINES: cv2.line(cl_, a, b, 1, 4)
coverline = (cl_ > 0) & thin

# ---- cells
cls = np.zeros((H, W), np.uint8)
for cy in range(H):
    for cx in range(W):
        x0, y0 = ORG[0] + cx * CELL, ORG[1] + cy * CELL
        blk_out = out[y0:y0 + CELL, x0:x0 + CELL]; blk = pix[y0:y0 + CELL, x0:x0 + CELL]
        if blk_out.size == 0 or blk_out.mean() > 0.5: continue
        fr = lambda k: (blk == k).mean()
        if wallline[y0:y0 + CELL, x0:x0 + CELL].mean() > 0.08: cls[cy, cx] = 4
        elif coverline[y0:y0 + CELL, x0:x0 + CELL].mean() > 0.08: cls[cy, cx] = 3
        elif fr(4) > 0.4: cls[cy, cx] = 4
        elif fr(3) > 0.4: cls[cy, cx] = 3
        elif fr(2) > 0.5: cls[cy, cx] = 2
        else: cls[cy, cx] = 1
# rocks: open-sided cover in the court (AJ has a P4 setup inside it): walkable
cls[32:46, 162:168][cls[32:46, 162:168] == 2] = 4   # AC unit strip beside the garage is solid
# keep only the main walkable area (drops the text labels outside the map)
nl, cl2 = cv2.connectedComponents(((cls == 1) | (cls == 2)).astype(np.uint8), connectivity=4)
sizes = [(cl2 == k).sum() for k in range(nl)]; keep = int(np.argmax(sizes[1:]) + 1)
for k in range(1, nl):
    if k != keep and sizes[k] < 400: cls[cl2 == k] = 0
base = cls.copy()
# ---- building walls: indoor cells touching outdoor (4-neighbour) become wall
wall = np.zeros_like(cls, bool)
for cy in range(H):
    for cx in range(W):
        if cls[cy, cx] != 2: continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < W and 0 <= ny < H and base[ny, nx] in (1, 3): wall[cy, cx] = True
cls[wall] = 4

# ---- doors from tracked walkthrough footage: where a tracked path crosses a wall cell, open it
def cellof(x, y): return int((y - ORG[1]) // CELL), int((x - ORG[0]) // CELL)
cross = np.zeros_like(cls, np.int32)
paths = []
for f in sorted(glob.glob('tracks_*.json')):
    for k, tr in json.load(open(f)).items():
        pts = [(x, y) for s, a, x, y in tr if s >= 0.82]
        paths.append(pts)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            d = np.hypot(x1 - x0, y1 - y0)
            if d > 45: continue
            nn = int(d / 2) + 1
            for j in range(nn + 1):
                x = x0 + (x1 - x0) * j / nn; y = y0 + (y1 - y0) * j / nn
                cy, cx = cellof(x, y)
                if 0 <= cx < W and 0 <= cy < H and cls[cy, cx] == 4: cross[cy, cx] += 1
np.save('cross.npy', cross)
DOORS = json.load(open('doors.json'))
for d in DOORS:
    x0, x1, y0, y1 = d['r']
    for yy in range(y0, y1 + 1):
        for xx in range(x0, x1 + 1):
            if 0 <= xx < W and 0 <= yy < H and wall[yy, xx] and cls[yy, xx] == 4: cls[yy, xx] = 2
doors = DOORS
# anything walkable that can't be reached from the middle of the map becomes solid
nl, cl3 = cv2.connectedComponents(((cls == 1) | (cls == 2)).astype(np.uint8), connectivity=4)
main = cl3[70, 95]
for k in range(1, nl):
    if k != main:
        n_ = (cl3 == k).sum(); ys_, xs_ = np.where(cl3 == k); print('unreachable pocket', n_, 'cells near', int(xs_.mean()), int(ys_.mean())); cls[cl3 == k] = 4
np.save('cls.npy', cls)

# ---- RLE
flat = cls.flatten(); rle = []
i = 0
def b36(v):
    s = ''; d = '0123456789abcdefghijklmnopqrstuvwxyz'
    while True:
        s = d[v % 36] + s; v //= 36
        if not v: return s
while i < len(flat):
    j = i
    while j < len(flat) and flat[j] == flat[i]: j += 1
    rle.append('ABCDE'[flat[i]] + b36(j - i)); i = j
rle = ''.join(rle)

# ---- annotations (ref px), from AJ's screenshots registered onto the base map
HILLS = [
  dict(c='P1', n='Statue', sh=dict(x=790, y=747, r=97),
       sp=[(438, 520, 2), (1163, 493, 2)], hold=[(583, 680), (743, 768), (693, 825), (453, 575)], brk=[(1118, 530), (1018, 715), (858, 763), (806, 570)]),
  dict(c='P2', n='Kitchen', sh=dict(pts=[(562, 389), (675, 389), (675, 511), (524, 511), (524, 461), (562, 461)]),
       sp=[(306, 427, 2), (421, 252, 1), (936, 712, 2), (1041, 247, 1)], hold=[(481, 412), (591, 469), (566, 347), (601, 504)], brk=[(761, 497), (721, 450), (801, 557), (906, 662)]),
  dict(c='P3', n='Garage', sh=dict(pts=[(1180, 320), (1309, 320), (1309, 580), (1180, 580)]),
       sp=[(1210, 251, 2), (855, 256, 1), (853, 526, 2), (885, 821, 1)], hold=[(1245, 354), (1160, 613), (1290, 539), (1120, 321)], brk=[(995, 439), (1005, 731), (975, 481), (905, 646)]),
  dict(c='P4', n='Court', sh=dict(pts=[(367, 90), (533, 90), (533, 285), (490, 318), (435, 343), (393, 301), (367, 266)]),
       sp=[(306, 432, 2), (526, 762, 1), (874, 222, 2), (966, 467, 1)], hold=[(351, 522), (498, 235), (396, 382), (409, 252)], brk=[(571, 252), (521, 305), (511, 500), (593, 222)]),
  dict(c='P5', n='Mid', sh=dict(pts=[(708, 414), (871, 414), (871, 512), (708, 512)]),
       sp=[(465, 492, 2), (538, 182, 1), (1073, 432, 2), (1058, 257, 1), (1008, 727, 1)], hold=[(753, 497), (753, 247), (653, 425), (693, 702)], brk=[(918, 687), (863, 437), (820, 577), (868, 247)]),
]
BASE_W = [(258, 412), (262, 437), (258, 462), (282, 425)]
BASE_E = [(1268, 405), (1290, 430), (1268, 455), (1250, 430)]
def mm(p): return m(p[0], p[1])
def shp(sh):
    if 'r' in sh: return dict(x=mm((sh['x'], sh['y']))[0], y=mm((sh['x'], sh['y']))[1], r=round(sh['r'] * SC, 1))
    return dict(pts=[mm(p) for p in sh['pts']])
hp = dict(hills=[], start=[[mm(p) for p in BASE_W], [mm(p) for p in BASE_E]])
for h in HILLS:
    sp = [mm(s[:2]) + [s[2]] for s in h['sp']] + [mm(BASE_W[1]) + [0], mm(BASE_E[1]) + [0]]
    hp['hills'].append(dict(c=h['c'], n=h['n'], sh=shp(h['sh']), sp=sp, hold=[mm(p) for p in h['hold']], brk=[mm(p) for p in h['brk']]))
snd = dict(sites=[dict(c='A', n='Statue steps', x=mm((737, 632))[0], y=mm((737, 632))[1]), dict(c='B', n='Pool', x=mm((712, 232))[0], y=mm((712, 232))[1])],
           atk=[mm(p) for p in BASE_E], def_=[mm(p) for p in BASE_W])
snd['def'] = snd.pop('def_')
ctl = dict(zones=[dict(c='A', n='Statue', sh=dict(x=mm((790, 743))[0], y=mm((790, 743))[1], r=round(72 * SC, 1)),
                       hold=[mm(p) for p in [(583, 680), (693, 825), (858, 763), (1018, 715)]]),
                  dict(c='B', n='Pool', sh=dict(pts=[mm(p) for p in [(538, 57), (706, 57), (706, 112), (650, 116), (622, 140), (618, 175), (640, 205), (706, 210), (706, 248), (663, 248), (663, 263), (538, 263)]]),
                       hold=[mm(p) for p in [(498, 235), (571, 252), (760, 180), (640, 300)]])],
           atk=[mm(p) for p in BASE_E] + [mm((1163, 493)), mm((1210, 251))], def_=[mm(p) for p in BASE_W] + [mm((438, 520))])
ctl['def'] = ctl.pop('def_')
ctl['atk2'] = [mm(p) for p in [(1008, 727), (885, 821), (1013, 703), (966, 467)]]
VIA = json.load(open('via.json')) if glob.glob('via.json') else []
data = dict(W=W, H=H, cs=CS, rle=rle, box=[0, 0, round(W * CS, 1), round(H * CS, 1)], via=[mm(p) for p in VIA], HP=hp, SND=snd, CTL=ctl)
js = '/* Burger Town Leagues — DYNASTY: map data for the minimap sim (generated by build.py from the Raid overhead map,\n   AJ\'s hill/spawn/setup annotations and tracked walkthrough footage). */\n(function(root){ var DY = root.DY = root.DY || {}; DY.MS = DY.MS || {}; DY.MS.MAPS = DY.MS.MAPS || {};\nDY.MS.MAPS.Raid = ' + json.dumps(data, separators=(',', ':')) + ';\n})(typeof window !== "undefined" ? window : globalThis);\n'
open('dyn-mapdata.js', 'w').write(js)
print('grid', W, H, 'rle', len(rle), 'js', len(js), 'doors', len(doors), 'walls', int((cls == 4).sum()))

# ---- preview
S = 4
v = np.zeros((H * S, W * S, 3), np.uint8)
col = {0: (0, 0, 0), 1: (60, 60, 60), 2: (150, 150, 150), 3: (60, 120, 160), 4: (20, 20, 230)}
for k, c in col.items(): v[np.kron(cls == k, np.ones((S, S), bool))] = c
for pts in paths:
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if np.hypot(x1 - x0, y1 - y0) > 45: continue
        cv2.line(v, (int((x0 - ORG[0]) / CELL * S), int((y0 - ORG[1]) / CELL * S)), (int((x1 - ORG[0]) / CELL * S), int((y1 - ORG[1]) / CELL * S)), (0, 255, 0), 1)
cv2.imwrite('grid_prev.png', v)
