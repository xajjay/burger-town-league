"""Rebuild the walls of existing minimap grids from AJ's cleaner painted layouts, keeping each map's frame
(outline, hills, spawns, sites, zones stay where they are), and register the clean in-game minimap art onto
the same frame for the viewer.

Usage: python3 regrid.py <dyn-mapdata.js in> <img dir> <dyn-mapdata.js out> [Map ...]
  img dir holds <Map>_paint.(png|jpg) (red = wall, blue = hallway/door, white = short wall) and <Map>_art.jpg
  (the plain grey minimap on white).
"""
import cv2, numpy as np, json, re, sys, os, glob

SRC, IMG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ONLY = sys.argv[4:]
# editor toolbars / spawn icons / labels to ignore on each paint (pixel boxes x0, y0, x1, y1)
EXCL = {
  'Apocalypse': [(640, 0, 960, 70), (165, 300, 255, 420), (150, 270, 270, 300), (160, 410, 260, 440), (1080, 605, 1185, 635), (1095, 640, 1180, 760), (1090, 760, 1180, 784), (510, 300, 555, 340), (515, 615, 562, 660)],
  'Raid': [(595, 0, 935, 70), (110, 370, 205, 480), (1215, 375, 1290, 490)],
  'Checkmate': [(65, 295, 140, 395), (1305, 480, 1380, 580)],
  'Express': [(550, 0, 820, 80), (170, 170, 300, 320), (990, 165, 1120, 305), (636, 285, 680, 330), (690, 590, 740, 635)],
  'Garrison': [(575, 0, 845, 65), (95, 230, 165, 320), (1250, 475, 1325, 565)],
  'Miami': [(410, 0, 720, 60), (160, 460, 235, 560), (830, 670, 915, 770)],
  'Moscow': [(595, 0, 870, 50), (165, 310, 240, 405), (1185, 295, 1290, 365)],
  'Standoff': [(390, 0, 725, 95), (210, 735, 300, 845)],
}

def dec(rle, n):
    g = np.zeros(n, np.uint8); i = 0
    for v, k in re.findall(r'([A-G])([0-9a-z]+)', rle):
        k = int(k, 36); g[i:i + k] = 'ABCDEFG'.index(v); i += k
    return g

def b36(v):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'; s = ''
    while True:
        s = d[v % 36] + s; v //= 36
        if not v: return s

def masks(img, excl):
    a = img.astype(int); b, g, r = a[..., 0], a[..., 1], a[..., 2]
    red = (r > 150) & (g < 90) & (b < 90)
    cyan = (g > 140) & (b > 140) & (r < 140)
    mx = a.max(2); mn = a.min(2)
    white = (mn > 205) & (mx - mn < 30)
    light = (a.mean(2) > 85) & (mx - mn < 40) & ~white
    for (x0, y0, x1, y1) in excl:
        red[y0:y1, x0:x1] = False; white[y0:y1, x0:x1] = False; cyan[y0:y1, x0:x1] = False
    return red, cyan, white, light

def register(src_mask, dst, scales):
    """dst = src * s + (dx, dy) in dst cells; src_mask is a float 0..1 image, dst a float image."""
    best = (-1,)
    pad = 40
    D = cv2.copyMakeBorder(dst.astype(np.float32), pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    for s in scales:
        t = cv2.resize(src_mask.astype(np.float32), None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        if t.shape[0] >= D.shape[0] or t.shape[1] >= D.shape[1] or t.sum() < 10: continue
        r = cv2.matchTemplate(D, t, cv2.TM_CCORR_NORMED); _, mv, _, ml = cv2.minMaxLoc(r)
        if mv > best[0]: best = (mv, s, ml[0] - pad, ml[1] - pad)
    return best

def bbox(m):
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max(), ys.max()

src = open(SRC).read()
maps = {}
order = []
for line in src.split('\n'):
    m = re.match(r'DY\.MS\.MAPS\.(\w+) = (\{.*\});$', line)
    if m: maps[m.group(1)] = json.loads(m.group(2)); order.append(m.group(1))

log = []
for name in order:
    if ONLY and name not in ONLY: continue
    pp = glob.glob(os.path.join(IMG, name + '_paint.*'))
    if not pp: continue
    d = maps[name]; W, H, CS = d['W'], d['H'], d['cs']
    g = dec(d['rle'], W * H).reshape(H, W)
    img = cv2.imread(pp[0])
    red, cyan, white, light = masks(img, EXCL.get(name, []))
    # --- register paint walls onto the old wall cells
    oldw = (g == 4).astype(np.float32)
    ox0, oy0, ox1, oy1 = bbox(g == 4); nx0, ny0, nx1, ny1 = bbox(red)
    s0 = ((ox1 - ox0) / (nx1 - nx0) + (oy1 - oy0) / (ny1 - ny0)) / 2
    # crop the paint to its walls (plus a margin) so the template fits inside the grid
    m0 = 30; cx0, cy0 = max(0, nx0 - m0), max(0, ny0 - m0); cx1, cy1 = min(red.shape[1], nx1 + m0), min(red.shape[0], ny1 + m0)
    rm = cv2.GaussianBlur(red[cy0:cy1, cx0:cx1].astype(np.float32), (0, 0), 2)
    reg = register(rm, cv2.GaussianBlur(oldw, (0, 0), 0.7), np.arange(s0 * 0.85, s0 * 1.15, s0 * 0.004))
    sc = reg[1]; dx = reg[2] - cx0 * sc; dy = reg[3] - cy0 * sc
    log.append('%s paint->grid score %.3f s %.4f d %d,%d' % (name, reg[0], sc, dx, dy))
    # --- reclassify every cell inside the old footprint from the new paint
    ninv = 1.0 / sc
    def frac(mask, cx, cy):
        X0, Y0 = int((cx - dx) * ninv), int((cy - dy) * ninv); X1, Y1 = int((cx + 1 - dx) * ninv) + 1, int((cy + 1 - dy) * ninv) + 1
        X0, Y0 = max(0, X0), max(0, Y0); X1, Y1 = min(mask.shape[1], X1), min(mask.shape[0], Y1)
        if X1 <= X0 or Y1 <= Y0: return None
        return mask[Y0:Y1, X0:X1].mean()
    redd = cv2.dilate(red.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    cyd = cv2.dilate(cyan.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    new = g.copy()
    for cy in range(H):
        for cx in range(W):
            if g[cy, cx] == 0: continue
            rf = frac(redd, cx, cy)
            if rf is None: continue
            if g[cy, cx] == 5: continue                       # Checkmate plane hull stays as it was
            wf, cf, lf = frac(white, cx, cy), frac(cyd, cx, cy), frac(light, cx, cy)
            if rf > 0.35 and cf < 0.3: new[cy, cx] = 4
            elif wf > 0.2 and cf < 0.3: new[cy, cx] = 6
            elif lf > 0.5 or cf >= 0.3: new[cy, cx] = 2
            else: new[cy, cx] = 1
    # objectives stay playable: hills, Control zones, bomb sites and spawns keep their old open cells
    keep = np.zeros((H, W), np.uint8)
    def shape_mask(sh):
        if 'r' in sh: cv2.circle(keep, (int(sh['x'] / CS), int(sh['y'] / CS)), int(sh['r'] / CS) + 1, 1, -1)
        else: cv2.fillPoly(keep, [np.int32([[q[0] / CS, q[1] / CS] for q in sh['pts']])], 1)
    for h in (d.get('HP') or {}).get('hills', []):
        shape_mask(h['sh'])
        for q in h['sp']: cv2.circle(keep, (int(q[0] / CS), int(q[1] / CS)), 3, 1, -1)
    for z in (d.get('CTL') or {}).get('zones', []): shape_mask(z['sh'])
    for st in (d.get('SND') or {}).get('sites', []): cv2.circle(keep, (int(st['x'] / CS), int(st['y'] / CS)), int(9 / CS) + 1, 1, -1)
    for k in ('atk', 'def'):
        for q in (d.get('SND') or {}).get(k, []) + (d.get('CTL') or {}).get(k, []): cv2.circle(keep, (int(q[0] / CS), int(q[1] / CS)), 3, 1, -1)
    rest = (keep > 0) & np.isin(g, [1, 2, 5, 6]) & (new == 4)
    new[rest] = g[rest]
    log.append('%s objective cells kept open %d' % (name, rest.sum()))
    # keep the outer ring of the old map as it was (the outline is part of the frame)
    edge = (g != 0) & (cv2.erode((g != 0).astype(np.uint8), np.ones((3, 3), np.uint8)) == 0)
    new[edge] = g[edge]
    # fill small sealed pockets (unreachable floor) with wall
    walk = np.isin(new, [1, 2, 5, 6]).astype(np.uint8)
    nl, lab = cv2.connectedComponents(walk, connectivity=4)
    sizes = [(lab == k).sum() for k in range(nl)]; main = int(np.argmax(sizes[1:]) + 1)
    for k in range(1, nl):
        if k != main and sizes[k] < 400: new[lab == k] = 4
    ch = (new != g).sum()
    log.append('%s cells changed %d of %d (walls %d -> %d)' % (name, ch, (g != 0).sum(), (g == 4).sum(), (new == 4).sum()))
    flat = new.flatten(); rle = []; i = 0
    while i < len(flat):
        j = i
        while j < len(flat) and flat[j] == flat[i]: j += 1
        rle.append('ABCDEFG'[flat[i]] + b36(j - i)); i = j
    d['rle'] = ''.join(rle)
    # route points: same farthest-point sampling as build_map.py, on the new grid
    ok = np.argwhere(np.isin(new, [1, 2]))
    ok = [tuple(p) for p in ok if all(0 <= p[0] + yy < H and 0 <= p[1] + xx < W and new[p[0] + yy, p[1] + xx] in (1, 2) for yy in (-3, 0, 3) for xx in (-3, 0, 3))]
    rng = np.random.RandomState(7); pick = [ok[rng.randint(len(ok))]]; oka = np.array(ok); dmin = np.full(len(ok), 1e9)
    for _ in range(len(d['via']) - 1):
        dmin = np.minimum(dmin, np.hypot(oka[:, 0] - pick[-1][0], oka[:, 1] - pick[-1][1])); pick.append(tuple(oka[int(np.argmax(dmin))]))
    d['via'] = [[round((p[1] + 0.5) * CS, 1), round((p[0] + 0.5) * CS, 1)] for p in pick]
    # --- register the clean minimap art onto the old footprint
    ap = os.path.join(IMG, name + '_art.jpg')
    if os.path.exists(ap):
        art0 = cv2.imread(ap); rots = [art0, cv2.rotate(art0, cv2.ROTATE_90_CLOCKWISE), cv2.rotate(art0, cv2.ROTATE_180), cv2.rotate(art0, cv2.ROTATE_90_COUNTERCLOCKWISE)]
        ofp = (g != 0).astype(np.float32); gx0, gy0, gx1, gy1 = bbox(g != 0)
        def aspect_err(im):
            f = im.astype(int).min(2) < 225; x0_, y0_, x1_, y1_ = bbox(f); return abs(np.log(((x1_ - x0_) / (y1_ - y0_)) / ((gx1 - gx0) / (gy1 - gy0))))
        rots = rots + [cv2.flip(im, 1) for im in rots]
        def fit(art):
            af = (art.astype(int).min(2) < 225).astype(np.uint8)
            af = cv2.morphologyEx(af, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
            n2, l2, st2, _ = cv2.connectedComponentsWithStats(af); k2 = 1 + int(np.argmax(st2[1:, cv2.CC_STAT_AREA])); af = (l2 == k2).astype(np.float32)
            bx0, by0, bx1, by1 = bbox(af > 0)
            s1 = ((gx1 - gx0) / (bx1 - bx0) + (gy1 - gy0) / (by1 - by0)) / 2
            best = (-1,)
            for s in np.arange(s1 * 0.9, s1 * 1.1, s1 * 0.004):
                t = cv2.resize(af, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) > 0.5
                ys0, xs0 = np.nonzero(t)
                tx0, ty0 = int(round(gx0 - bx0 * s)), int(round(gy0 - by0 * s))
                for ddx in range(-4, 5):
                    for ddy in range(-4, 5):
                        X, Y = tx0 + ddx, ty0 + ddy
                        ys = ys0 + Y; xs = xs0 + X
                        keep = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W)
                        canvas = np.zeros((H, W), bool); canvas[ys[keep], xs[keep]] = True
                        inter = (canvas & (ofp > 0)).sum(); uni = (canvas | (ofp > 0)).sum() + (~keep).sum()
                        iou = inter / max(1, uni)
                        if iou > best[0]: best = (iou, s, X, Y)
            return best
        cands = [k for k, im in enumerate(rots) if aspect_err(im) < 0.25] or [0]
        fits = {k: fit(rots[k]) for k in cands}
        # silhouettes of near-symmetric maps (Checkmate's rectangle) can't tell 0 from 180: prefer the orientation whose
        # light roofs sit on the painted walls
        def roofs(k):
            iou_, s_, X_, Y_ = fits[k]; im = cv2.resize(rots[k], (max(1, int(round(rots[k].shape[1] * s_))), max(1, int(round(rots[k].shape[0] * s_)))), interpolation=cv2.INTER_AREA)
            lt = (im.astype(int).mean(2) > 150) & (im.astype(int).mean(2) < 225); hit = 0; tot = 0
            ys, xs = np.nonzero(lt); ys = ys + Y_; xs = xs + X_; kk = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W)
            return (new[ys[kk], xs[kk]] == 4).mean() if kk.any() else 0
        top = max(f[0] for f in fits.values())
        near = [k for k in fits if fits[k][0] >= top - 0.015]
        rot = max(near, key=roofs); art = rots[rot]
        if rot: log.append('%s art orientation %d (rot %d deg%s)' % (name, rot, (rot % 4) * 90, ', mirrored' if rot >= 4 else ''))
        iou, s, X, Y = fits[rot]
        # art pixel (0,0) sits at cell (X, Y); one art px = s cells
        cv2.imwrite(os.path.join(IMG, '..', 'art_' + name.lower() + '.jpg'), art, [cv2.IMWRITE_JPEG_QUALITY, 90])
        d['art'] = dict(src='/images/dynasty/maps/' + name.lower() + '.jpg', x=round(X * CS, 2), y=round(Y * CS, 2), w=round(art.shape[1] * s * CS, 2), h=round(art.shape[0] * s * CS, 2))
        log.append('%s art IoU %.3f s %.4f at %d,%d' % (name, iou, s, X, Y))
        # preview: art with the new walls on top
        A = cv2.resize(art, (int(round(art.shape[1] * s * 4)), int(round(art.shape[0] * s * 4))))
        cvs = np.full((H * 4, W * 4, 3), 255, np.uint8)
        x0, y0 = X * 4, Y * 4
        sx0, sy0 = max(0, -x0), max(0, -y0); ex, ey = min(A.shape[1], W * 4 - x0), min(A.shape[0], H * 4 - y0)
        cvs[max(0, y0):max(0, y0) + ey - sy0, max(0, x0):max(0, x0) + ex - sx0] = A[sy0:ey, sx0:ex]
        ov = cvs.copy()
        wm = cv2.resize((new == 4).astype(np.uint8), (W * 4, H * 4), interpolation=cv2.INTER_NEAREST) > 0
        ov[wm] = (40, 40, 220)
        sw = cv2.resize((new == 6).astype(np.uint8), (W * 4, H * 4), interpolation=cv2.INTER_NEAREST) > 0
        ov[sw] = (0, 220, 255)
        cv2.imwrite(os.path.join(IMG, '..', 'chk_%s.png' % name), cv2.addWeighted(ov, 0.45, cvs, 0.55, 0))
js = '/* Burger Town Leagues — DYNASTY: map data for the minimap sim (generated from AJ\'s painted layouts,\n   hill/spawn/setup screenshots and Control zones by scripts/games/mapsim/build_map.py; walls redrawn from AJ\'s\n   clean layouts and minimap art registered by scripts/games/mapsim/regrid.py). */\n(function(root){ var DY = root.DY = root.DY || {}; DY.MS = DY.MS || {}; DY.MS.MAPS = DY.MS.MAPS || {};\n'
for name in order: js += 'DY.MS.MAPS.' + name + ' = ' + json.dumps(maps[name], separators=(',', ':')) + ';\n'
js += '})(typeof window !== "undefined" ? window : globalThis);\n'
open(OUT, 'w').write(js)
print('\n'.join(log))
