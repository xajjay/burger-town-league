"""Build minimap-sim map data from AJ's painted layouts.
Paint legend (AJ): RED = walls / out of bounds (can't pass), BLUE = hallway or door (passable),
WHITE = short wall / obstacle (vault over, cover, see over). Everything else inside the outline is floor.
Grid codes: 0 outside, 1 outdoor, 2 indoor, 3 (unused), 4 wall, 5 hull (walk under, blocks sight), 6 short wall.
Usage: python3 build_map.py            -> writes dyn-mapdata.js with every map in MAPS.
       python3 build_map.py Moscow Miami -> rebuilds just those maps and keeps the rest of an existing dyn-mapdata.js.
Unpainted outer edge: set outline=True (the light map outline bounds the footprint).
Blue drawn inside red: set cyan_open=True (cells under blue become passable)."""
import cv2, numpy as np, json, sys
from cfg_maps import MAPS

def masks(img, excl, extra_red):
    a = img.astype(int); b, g, r = a[..., 0], a[..., 1], a[..., 2]
    red = (r > 150) & (g < 90) & (b < 90)
    cyan = (g > 150) & (b > 150) & (r < 130)
    mx = a.max(2); mn = a.min(2)
    white = (mn > 205) & (mx - mn < 30)
    for (x0, y0, x1, y1) in excl: red[y0:y1, x0:x1] = False; white[y0:y1, x0:x1] = False
    red = red.astype(np.uint8)
    for (p, q) in extra_red: cv2.line(red, p, q, 1, 5)
    gray = a.mean(2); sat = mx - mn
    light = (gray > 85) & (sat < 40) & ~(white)
    return red > 0, cyan, white, light

def footprint(red, seed):
    H, W = red.shape
    bar = cv2.dilate(cv2.morphologyEx(red.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)), np.ones((5, 5), np.uint8))
    ff = (1 - bar).astype(np.uint8); m = np.zeros((H + 2, W + 2), np.uint8)
    cv2.floodFill(ff, m, seed, 2)
    out = cv2.dilate((ff == 2).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    return ~out

def footprint_outline(img, seed, thr=60):
    """maps whose outer edge isn't painted red: flood the dark background from a corner, the light outline stops it"""
    H, W = img.shape[:2]
    bar = (img.astype(int).mean(2) > thr).astype(np.uint8)
    bar = cv2.dilate(bar, np.ones((3, 3), np.uint8))
    ff = (1 - bar).astype(np.uint8); m = np.zeros((H + 2, W + 2), np.uint8)
    cv2.floodFill(ff, m, seed, 2)
    out = cv2.dilate((ff == 2).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    return ~out

def structure(img, painted):
    a = img.astype(int); mx = a.max(2); mn = a.min(2); gray = a.mean(2)
    s = ((gray > 85) & (mx - mn < 40)) | (((a[..., 2] > 150) & (a[..., 1] < 90) & (a[..., 0] < 90)) if painted else False)
    return cv2.GaussianBlur(s.astype(np.float32), (0, 0), 3)

def register(src, base_s, scales, crop=(0.2, 0.8, 0.22, 0.78)):
    """find s, dx, dy with base = src * s + (dx, dy): a central crop of the base is searched inside the scaled source"""
    h, w = base_s.shape; y0, y1, x0, x1 = int(h * crop[0]), int(h * crop[1]), int(w * crop[2]), int(w * crop[3])
    t = base_s[y0:y1, x0:x1]
    best = (-2,)
    for s in scales:
        cs = cv2.resize(src, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        if cs.shape[0] < t.shape[0] or cs.shape[1] < t.shape[1]: continue
        r = cv2.matchTemplate(cs, t, cv2.TM_CCOEFF_NORMED); r[~np.isfinite(r)] = -2; _, mv, _, ml = cv2.minMaxLoc(r)
        if mv > best[0]: best = (mv, s, x0 - ml[0], y0 - ml[1])
    return best

def register2(src, base_s, scales):
    a = register(src, base_s, scales)
    # reverse: central crop of the scaled source searched inside the base
    best = (-2,)
    for s in scales:
        cs = cv2.resize(src, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        h, w = cs.shape; y0, y1, x0, x1 = int(h * 0.2), int(h * 0.8), int(w * 0.2), int(w * 0.8)
        t = cs[y0:y1, x0:x1]
        if base_s.shape[0] < t.shape[0] or base_s.shape[1] < t.shape[1]: continue
        r = cv2.matchTemplate(base_s, t, cv2.TM_CCOEFF_NORMED); r[~np.isfinite(r)] = -2; _, mv, _, ml = cv2.minMaxLoc(r)
        if mv > best[0]: best = (mv, s, ml[0] - x0, ml[1] - y0)
    return a if a[0] >= best[0] else best

def b36(v):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'; s = ''
    while True:
        s = d[v % 36] + s; v //= 36
        if not v: return s

def build(name, C, log):
    img = cv2.imread(C['paint'])
    red, cyan, white, light = masks(img, C.get('excl', []), C.get('extra_red', []))
    foot = footprint_outline(img, C.get('seed', (5, 5))) if C.get('outline') else footprint(red, C.get('seed', (5, 5)))
    # base frame: the paint image itself, or warped onto another reference (Raid keeps its old frame)
    if C.get('base'):
        bimg = cv2.imread(C['base'])
        bfoot = ~np.load(C['base_outside']) if C.get('base_outside') else None
        reg = register(foot.astype(np.float32), bfoot.astype(np.float32), np.arange(0.95, 1.25, 0.005))
        log.append('%s paint->base %s' % (name, [round(float(x), 3) for x in reg]))
        _, s, dx, dy = reg; M = np.float32([[s, 0, dx], [0, s, dy]]); Hb, Wb = bimg.shape[:2]
        warp = lambda m: cv2.warpAffine(m.astype(np.uint8), M, (Wb, Hb), flags=cv2.INTER_NEAREST) > 0
        red, cyan, white, light, foot = warp(red), warp(cyan), warp(white), warp(light), warp(foot)
        base_img = bimg
    else:
        base_img = img
    # annotation images -> base frame
    bstruct = structure(base_img, not C.get('base'))
    xf = {'base': (1.0, 0.0, 0.0)}
    for k, path in C.get('ann', {}).items():
        a = cv2.imread(path)
        if k in C.get('xf', {}):
            xf[k] = tuple(C['xf'][k]); log.append('%s %s -> base (fixed) %s' % (name, k, xf[k])); continue
        reg = (register2 if C.get('reg2') else register)(structure(a, False), bstruct, np.arange(*C.get('scales', (0.9, 1.12, 0.005))))
        xf[k] = (float(reg[1]), float(reg[2]), float(reg[3])); log.append('%s %s -> base score %.3f s %.3f d %.0f,%.0f' % (name, k, reg[0], reg[1], reg[2], reg[3]))
    def T(k, p): s, dx, dy = xf[k]; return (p[0] * s + dx, p[1] * s + dy)
    ORG = C['org']; SC = C['sc']; CELL = C['cell']
    x0b, y0b, x1b, y1b = C['bbox']
    W = int(np.ceil((x1b - ORG[0]) / CELL)); H = int(np.ceil((y1b - ORG[1]) / CELL))
    redd = cv2.dilate(red.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    hull = np.zeros_like(red)
    for poly in C.get('hull', []):
        mk = np.zeros(red.shape, np.uint8); cv2.fillPoly(mk, [np.int32([T(poly['img'], p) for p in poly['pts']])], 1); hull |= (mk > 0)
    cls = np.zeros((H, W), np.uint8)
    for cy in range(H):
        for cx in range(W):
            X0, Y0 = int(ORG[0] + cx * CELL), int(ORG[1] + cy * CELL)
            sl = (slice(Y0, Y0 + CELL), slice(X0, X0 + CELL))
            f = foot[sl]
            if f.size == 0 or f.mean() < 0.5: continue
            rf = redd[sl].mean(); wf = white[sl].mean()
            if rf > 0.2: cls[cy, cx] = 5 if hull[sl].mean() > 0.5 else 4
            elif wf > 0.15: cls[cy, cx] = 6
            elif light[sl].mean() > 0.5: cls[cy, cx] = 2
            else: cls[cy, cx] = 1
    if C.get('cyan_open'):
        cy_ = cv2.dilate(cyan.astype(np.uint8), np.ones((C.get('cyan_w', 7),) * 2, np.uint8)) > 0
        for cy in range(H):
            for cx in range(W):
                X0, Y0 = int(ORG[0] + cx * CELL), int(ORG[1] + cy * CELL)
                if cls[cy, cx] in (4, 6) and cy_[Y0:Y0 + CELL, X0:X0 + CELL].mean() > 0.3: cls[cy, cx] = 2
    for r in C.get('cell_edits', []):   # [x0,x1,y0,y1,code] in cells
        cls[r[2]:r[3] + 1, r[0]:r[1] + 1] = r[4]
    walk = np.isin(cls, [1, 2, 5, 6]).astype(np.uint8)
    nl, lab = cv2.connectedComponents(walk, connectivity=4)
    sizes = [(lab == k).sum() for k in range(nl)]; main = int(np.argmax(sizes[1:]) + 1)
    pocket = 0
    for k in range(1, nl):
        if k != main: cls[lab == k] = 4 if sizes[k] < 400 else cls[lab == k]; pocket += sizes[k]
    log.append('%s grid %dx%d pockets filled %d' % (name, W, H, pocket))
    def mm(p, k='base'):
        q = T(k, p); return [round((q[0] - ORG[0]) * CELL * SC / CELL, 1), round((q[1] - ORG[1]) * SC, 1)]
    def shp(sh, k):
        if 'r' in sh: c = mm((sh['x'], sh['y']), k); return dict(x=c[0], y=c[1], r=round(sh['r'] * xf[k][0] * SC, 1))
        return dict(pts=[mm(p, k) for p in sh['pts']])
    out = dict(W=W, H=H, cs=CELL * SC, spb=C.get('spb'), box=[0, 0, round(W * CELL * SC, 1), round(H * CELL * SC, 1)], name=C.get('label', name))
    flat = cls.flatten(); rle = []; i = 0
    while i < len(flat):
        j = i
        while j < len(flat) and flat[j] == flat[i]: j += 1
        rle.append('ABCDEFG'[flat[i]] + b36(j - i)); i = j
    out['rle'] = ''.join(rle)
    if 'HP' in C:
        hp = C['HP']; hills = []
        for h in hp['hills']:
            k = h['img']; sp = [mm(s[:2], k) + [s[2]] for s in h['sp']]
            sp += [mm(p, hp['base_img']) + [0] for p in hp['base_sp']]
            hills.append(dict(c=h['c'], n=h['n'], sh=shp(h['sh'], h.get('shimg', hp['shimg'])), sp=sp, hold=[mm(p, k) for p in h['hold']], brk=[mm(p, k) for p in h['brk']]))
        out['HP'] = dict(hills=hills, start=[[mm(p, hp['base_img']) for p in hp['start'][0]], [mm(p, hp['base_img']) for p in hp['start'][1]]])
    if 'CTL' in C:
        c = C['CTL']; k = c['img']
        out['CTL'] = dict(zones=[dict(c=z['c'], n=z['n'], sh=shp(z['sh'], k), hold=[mm(p, z.get('himg', k)) for p in z.get('hold', [])]) for z in c['zones']],
                          atk=[mm(p, k) for p in c['atk']], **{'def': [mm(p, k) for p in c['def']]}, atk2=[mm(p, c.get('a2img', k)) for p in c.get('atk2', [])])
    if 'SND' in C:
        c = C['SND']; k = c['img']
        out['SND'] = dict(sites=[dict(c=s['c'], n=s['n'], x=mm(s['p'], k)[0], y=mm(s['p'], k)[1]) for s in c['sites']], atk=[mm(p, k) for p in c['atk']], **{'def': [mm(p, k) for p in c['def']]})
    # route points: spread over the walkable map (farthest-point sampling on open cells)
    ok = np.argwhere(np.isin(cls, [1, 2]))
    ok = [tuple(p) for p in ok if all(0 <= p[0] + dy < H and 0 <= p[1] + dx < W and cls[p[0] + dy, p[1] + dx] in (1, 2) for dy in (-3, 0, 3) for dx in (-3, 0, 3))]
    rng = np.random.RandomState(7); pick = [ok[rng.randint(len(ok))]]
    oka = np.array(ok)
    dmin = np.full(len(ok), 1e9)
    for _ in range(C.get('nvia', 22) - 1):
        dmin = np.minimum(dmin, np.hypot(oka[:, 0] - pick[-1][0], oka[:, 1] - pick[-1][1])); pick.append(tuple(oka[int(np.argmax(dmin))]))
    out['via'] = [[round((p[1] + 0.5) * CELL * SC, 1), round((p[0] + 0.5) * CELL * SC, 1)] for p in pick]
    return out, cls, base_img, (ORG, SC, CELL, xf)

if __name__ == '__main__':
    log = []; res = {}; dbg = {}
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    for name, C in MAPS.items():
        if only and name not in only: continue
        res[name], cls, bimg, meta = build(name, C, log); dbg[name] = (cls, bimg, meta)
    keep = {}
    if only:
        import os, re
        if os.path.exists('dyn-mapdata.js'):
            for line in open('dyn-mapdata.js').read().split('\n'):
                mm_ = re.match(r'DY\.MS\.MAPS\.(\w+) = (\{.*\});$', line)
                if mm_ and mm_.group(1) not in res: keep[mm_.group(1)] = mm_.group(2)
    js = '/* Burger Town Leagues — DYNASTY: map data for the minimap sim (generated from AJ\'s painted layouts,\n   hill/spawn/setup screenshots and Control zones by scripts/games/mapsim/build_map.py). */\n(function(root){ var DY = root.DY = root.DY || {}; DY.MS = DY.MS || {}; DY.MS.MAPS = DY.MS.MAPS || {};\n'
    for name, d in keep.items(): js += 'DY.MS.MAPS.' + name + ' = ' + d + ';\n'
    for name, d in res.items(): js += 'DY.MS.MAPS.' + name + ' = ' + json.dumps(d, separators=(',', ':')) + ';\n'
    js += '})(typeof window !== "undefined" ? window : globalThis);\n'
    open('dyn-mapdata.js', 'w').write(js)
    print('\n'.join(log)); print('js bytes', len(js))
    import pickle; pickle.dump({k: (v[0], v[2]) for k, v in dbg.items()}, open('dbg.pkl', 'wb'))
    # previews
    for name, (cls, bimg, (ORG, SC, CELL, xf)) in dbg.items():
        v = (bimg * 0.45).astype(np.uint8); ov = v.copy()
        col = {4: (40, 40, 230), 5: (200, 80, 200), 6: (230, 230, 230), 2: (120, 120, 120)}
        H, W = cls.shape
        for cy in range(H):
            for cx in range(W):
                k = cls[cy, cx]
                if k in col: X0, Y0 = int(ORG[0] + cx * CELL), int(ORG[1] + cy * CELL); cv2.rectangle(ov, (X0, Y0), (X0 + CELL - 1, Y0 + CELL - 1), col[k], -1)
        v = cv2.addWeighted(ov, 0.75, v, 0.25, 0)
        d = res[name]
        def rp(p): return (int(p[0] / SC + ORG[0]), int(p[1] / SC + ORG[1]))
        for mode in ('HP', 'CTL'):
            if mode not in d: continue
            zs = d[mode]['hills'] if mode == 'HP' else d[mode]['zones']
            for z in zs:
                sh = z['sh']; c3 = (0, 255, 0) if mode == 'HP' else (255, 0, 255)
                if 'r' in sh: cv2.circle(v, rp((sh['x'], sh['y'])), int(sh['r'] / SC), c3, 2); cen = rp((sh['x'], sh['y']))
                else: pts = np.int32([rp(p) for p in sh['pts']]); cv2.polylines(v, [pts], True, c3, 2); cen = tuple(pts.mean(0).astype(int))
                cv2.putText(v, z['c'], cen, cv2.FONT_HERSHEY_SIMPLEX, 0.7, c3, 2)
                if mode == 'HP':
                    for s in z['sp']: cv2.circle(v, rp(s), 6, (0, 0, 255) if s[2] == 2 else (0, 140, 255) if s[2] == 1 else (200, 200, 200), 2)
            if mode == 'CTL':
                for p in d[mode]['atk']: cv2.drawMarker(v, rp(p), (255, 200, 0), cv2.MARKER_TRIANGLE_UP, 10, 2)
                for p in d[mode]['def']: cv2.drawMarker(v, rp(p), (0, 0, 255), cv2.MARKER_TRIANGLE_UP, 10, 2)
        for p in d['via']: cv2.drawMarker(v, rp(p), (0, 220, 255), cv2.MARKER_DIAMOND, 9, 1)
        cv2.imwrite('prev_%s.png' % name, v)
